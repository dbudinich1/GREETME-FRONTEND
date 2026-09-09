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
 * Load the provider's tokenizer library from the URL the provider returned. Idempotent: a second
 * call while one is in flight awaits the same load, and a completed load resolves immediately.
 */
export function loadTokenizer(config, { win = typeof window === 'undefined' ? null : window, timeoutMs = 15000 } = {}) {
  const { url } = assertTokenizationConfig(config);
  if (!win || !win.document) {
    return Promise.reject(new TokenizationError(TOKENIZE_ERROR.SCRIPT_BLOCKED, 'No browser document is available.'));
  }
  if (tokenizerOn(win)) return Promise.resolve(tokenizerOn(win));
  if (win.__greetmeTokenizerLoad) return win.__greetmeTokenizerLoad;

  const doc = win.document;
  const promise = new Promise((resolve, reject) => {
    // A tag from an earlier attempt whose library never installed itself is a dead tag: its load
    // event has already fired and will not fire again, so waiting on it would hang until the
    // timeout. It is removed and the load is started cleanly instead.
    const stale = doc.querySelector(`script[data-greetme-tokenizer="${CSS_ESCAPE(url)}"]`);
    if (stale && typeof stale.remove === 'function') stale.remove();
    const script = doc.createElement('script');
    let settled = false;
    const finish = (fn, arg) => { if (!settled) { settled = true; fn(arg); } };
    const timer = setTimeout(() => finish(reject, new TokenizationError(
      TOKENIZE_ERROR.SCRIPT_BLOCKED,
      'The payment form could not be loaded. If a content blocker is active, allow the payment library and try again.',
    )), timeoutMs);

    script.addEventListener('load', () => {
      clearTimeout(timer);
      const tokenizer = tokenizerOn(win);
      if (tokenizer) finish(resolve, tokenizer);
      else finish(reject, new TokenizationError(TOKENIZE_ERROR.LIBRARY_MISSING, 'The payment form did not initialise.'));
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
