// src/components/providerCheckout/acceptJsLoader.js
//
// The browser side of provider tokenization.
//
// THE CARD NEVER REACHES GREET-ME. The tokenizer script is the provider's processor's own library,
// loaded from the URL the PROVIDER returned through our backend, and the card fields are handed
// straight to it. What comes back is a one-time token; that is the only thing this module returns,
// and it is the only thing the caller sends anywhere.
//
// NOTHING IS HARD-CODED. There is no processor hostname in this repository: the provider documents
// that its key and library URL change and must not be stored, so the URL is read from the response
// every time and validated for SHAPE (https, no credentials in it) rather than against a list.
//
// LOADED ONLY ON DEMAND. The script tag is created when a customer has deliberately opened the
// provider checkout — never on marketplace render, and never while the provider is dormant, because
// the backend returns no configuration at all in that state.

/** Why a tokenization attempt refused. Stable identifiers; callers switch on these. */
export const TOKENIZE_ERROR = Object.freeze({
  CONFIG_INVALID: 'tokenization_config_invalid',
  SCRIPT_BLOCKED: 'tokenization_script_blocked',
  LIBRARY_MISSING: 'tokenization_library_missing',
  DECLINED: 'tokenization_declined',
});

export class TokenizationError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'TokenizationError';
    this.code = code;
  }
}

/**
 * Validate the configuration the backend projected from the provider.
 *
 * HTTPS only, and no credentials embedded in the URL. A configuration that fails here is not
 * repaired or defaulted — a wrong tokenizer is a card going somewhere it should not.
 */
export function assertTokenizationConfig(config) {
  const url = String(config?.acceptJsUrl ?? '');
  const apiLoginId = String(config?.apiLoginId ?? '');
  const publicClientKey = String(config?.publicClientKey ?? '');
  if (!url || !apiLoginId || !publicClientKey) {
    throw new TokenizationError(TOKENIZE_ERROR.CONFIG_INVALID, 'The payment form is not configured.');
  }
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new TokenizationError(TOKENIZE_ERROR.CONFIG_INVALID, 'The payment form address is not usable.');
  }
  if (parsed.protocol !== 'https:') {
    throw new TokenizationError(TOKENIZE_ERROR.CONFIG_INVALID, 'The payment form must be served over https.');
  }
  if (parsed.username || parsed.password) {
    throw new TokenizationError(TOKENIZE_ERROR.CONFIG_INVALID, 'The payment form address is not usable.');
  }
  return { url: parsed.toString(), apiLoginId, publicClientKey };
}

/**
 * The Content-Security-Policy requirement, stated in code so it travels with the thing that needs
 * it. Greet-Me currently ships NO CSP (no meta tag, no header from the static host), so nothing is
 * being weakened here. Whoever adds one must allow the host the provider returns — which is read
 * from the response, so the allowance has to be made deliberately, not derived from this file.
 */
export function cspScriptSrcFor(config) {
  const { url } = assertTokenizationConfig(config);
  return new URL(url).origin;
}

/** Resolve the tokenizer global the provider's library installs, if it is present. */
const tokenizerOn = (win) => (win && win.Accept) || null;

/**
 * PRESENCE IS NOT READINESS.
 *
 * The entry script is a STUB: it installs the global the instant it parses, and only then fetches
 * the rest of the library from its own origin. A `load` event on the tag therefore proves the stub
 * arrived — not that the tokenizer can do anything. Calling it in that window makes the library
 * answer with its own "not loaded correctly", which is precisely what happened in production on
 * 2026-09-10 with every request returning 200.
 *
 * The barrier below is EVIDENCE, not a delay: Resource Timing records an entry only when a resource
 * has finished loading, so an entry from the tokenizer's own origin — other than the entry script
 * itself — is proof that the library completed a fetch of its own. No fixed wait, no guess about
 * the vendor's internals, and no vendor filename hardcoded here.
 */
export function tokenizerCoreLoaded(win, url) {
  const perf = win && win.performance;
  if (!perf || typeof perf.getEntriesByType !== 'function') return false;
  let origin;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  let entries;
  try {
    entries = perf.getEntriesByType('resource') || [];
  } catch {
    return false;
  }
  return entries.some((entry) => {
    const name = entry && typeof entry.name === 'string' ? entry.name : '';
    if (!name || name === url) return false;
    try {
      return new URL(name).origin === origin;
    } catch {
      return false;
    }
  });
}

/**
 * Wait for that evidence, bounded, and FAIL CLOSED if it never arrives.
 *
 * Driven by PerformanceObserver where available so it reacts to the real event; the interval
 * fallback re-checks the SAME evidence rather than assuming time has passed.
 */
function awaitTokenizerCore(win, url, timeoutMs) {
  if (tokenizerCoreLoaded(win, url)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    let settled = false;
    let observer = null;
    let interval = null;
    const stop = () => {
      clearTimeout(timer);
      if (interval) clearInterval(interval);
      if (observer && typeof observer.disconnect === 'function') observer.disconnect();
    };
    const finish = (fn, arg) => { if (!settled) { settled = true; stop(); fn(arg); } };
    const timer = setTimeout(() => finish(reject, new TokenizationError(
      TOKENIZE_ERROR.LIBRARY_MISSING,
      'The payment form did not finish loading. Please reload the page and try again.',
    )), timeoutMs);
    const check = () => { if (tokenizerCoreLoaded(win, url)) finish(resolve); };

    if (typeof win.PerformanceObserver === 'function') {
      try {
        observer = new win.PerformanceObserver(check);
        observer.observe({ type: 'resource', buffered: true });
      } catch {
        observer = null;
      }
    }
    if (!observer) interval = setInterval(check, 50);
    check();
  });
}

/**
 * Load the provider's tokenizer library from the URL the provider returned. Idempotent: a second
 * call while one is in flight awaits the same load, and a completed load resolves immediately.
 */
export function loadTokenizer(config, { win = typeof window === 'undefined' ? null : window, timeoutMs = 15000 } = {}) {
  const { url } = assertTokenizationConfig(config);
  if (!win || !win.document) {
    return Promise.reject(new TokenizationError(TOKENIZE_ERROR.SCRIPT_BLOCKED, 'No browser document is available.'));
  }
  // Already loaded AND already proven ready: nothing to do.
  if (tokenizerOn(win) && tokenizerCoreLoaded(win, url)) return Promise.resolve(tokenizerOn(win));
  if (win.__greetmeTokenizerLoad) return win.__greetmeTokenizerLoad;

  const doc = win.document;
  const promise = new Promise((resolve, reject) => {
    // A tag from an earlier attempt whose library never installed itself is a dead tag: its load
    // event has already fired and will not fire again, so waiting on it would hang until the
    // timeout. It is removed and the load is started cleanly instead.
    const stale = doc.querySelector(`script[data-greetme-tokenizer="${CSS_ESCAPE(url)}"]`);
    if (stale && typeof stale.remove === 'function') stale.remove();
    // (A tag from an earlier attempt is always replaced: its load event has already fired and will
    //  not fire again, so waiting on it would hang until the timeout.)
    const script = doc.createElement('script');
    let settled = false;
    const finish = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };
    const timer = setTimeout(() => finish(reject, new TokenizationError(
      TOKENIZE_ERROR.SCRIPT_BLOCKED,
      'The payment form could not be loaded. If a content blocker is active, allow the payment library and try again.',
    )), timeoutMs);

    script.addEventListener('load', () => {
      // TWO PHASES, EACH BOUNDED SEPARATELY. This timer covered "the tag never arrived"; that
      // question is now answered, so it is cleared here and the readiness barrier below carries its
      // own bound. Leaving it running would let the wrong failure win the race and report a blocked
      // script when the truth is an unfinished library.
      clearTimeout(timer);
      const tokenizer = tokenizerOn(win);
      if (!tokenizer) {
        finish(reject, new TokenizationError(TOKENIZE_ERROR.LIBRARY_MISSING, 'The payment form did not initialise.'));
        return;
      }
      awaitTokenizerCore(win, url, timeoutMs).then(
        () => finish(resolve, tokenizerOn(win)),
        (err) => finish(reject, err),
      );
    });
    script.addEventListener('error', () => {
      clearTimeout(timer);
      finish(reject, new TokenizationError(TOKENIZE_ERROR.SCRIPT_BLOCKED, 'The payment form could not be loaded.'));
    });

    script.src = url;
    script.async = true;
    script.setAttribute('data-greetme-tokenizer', url);
    (doc.head || doc.body || doc.documentElement).appendChild(script);
  });
  win.__greetmeTokenizerLoad = promise.finally(() => { delete win.__greetmeTokenizerLoad; });
  return win.__greetmeTokenizerLoad;
}

/** Minimal attribute-selector escaping; the URL is provider-supplied and already https-validated. */
function CSS_ESCAPE(value) {
  return String(value).replace(/["\\]/g, '\\$&');
}

/**
 * Tokenize the card IN THE BROWSER and return only the one-time token.
 *
 * The card fields are passed to the provider's library and are never returned, logged, stored, put
 * in application state beyond the moment of this call, or sent to Greet-Me. On any outcome — success
 * or failure — the caller clears the inputs; `clearCardFields` below is how.
 */
export function tokenizeCard(card, config, { win = typeof window === 'undefined' ? null : window } = {}) {
  const { apiLoginId, publicClientKey } = assertTokenizationConfig(config);
  return loadTokenizer(config, { win }).then((tokenizer) => new Promise((resolve, reject) => {
    if (!tokenizer || typeof tokenizer.dispatchData !== 'function') {
      reject(new TokenizationError(TOKENIZE_ERROR.LIBRARY_MISSING, 'The payment form did not initialise.'));
      return;
    }
    tokenizer.dispatchData({
      authData: { clientKey: publicClientKey, apiLoginID: apiLoginId },
      cardData: {
        cardNumber: String(card?.cardNumber ?? '').replace(/\s/g, ''),
        month: String(card?.expMonth ?? ''),
        year: String(card?.expYear ?? ''),
        cardCode: String(card?.cvv ?? ''),
        ...(card?.postalCode ? { zip: String(card.postalCode) } : {}),
      },
    }, (response) => {
      const token = response?.opaqueData?.dataValue;
      if (response?.messages?.resultCode === 'Ok' && token) {
        // The token, and the moment it was minted. These tokens live minutes, and the backend
        // needs the issue time to refuse a stale one rather than discovering it at the provider.
        resolve({ token, issuedAt: new Date().toISOString() });
        return;
      }
      // The provider's own message is shown, with nothing of the card in it.
      const message = response?.messages?.message?.[0]?.text || 'Your card could not be verified. Check the details and try again.';
      reject(new TokenizationError(TOKENIZE_ERROR.DECLINED, message));
    });
  }));
}

/**
 * Clear the card inputs. Called after a successful tokenization AND after a terminal failure, so
 * the number never lingers in a React state tree or in a form the browser might restore.
 */
export function clearCardFields(setCard) {
  if (typeof setCard === 'function') {
    setCard({ cardNumber: '', expMonth: '', expYear: '', cvv: '', postalCode: '' });
  }
}
