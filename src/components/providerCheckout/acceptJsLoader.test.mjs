// src/components/providerCheckout/acceptJsLoader.test.mjs
//
// The browser tokenization boundary, driven against a fake window: no network, no processor, no
// card, no key. What is proven here is the whole reason Greet-Me can offer this checkout at all —
// the card goes to the provider's tokenizer and only a one-time token comes back.
//
// Run (Node 20.x): node --test src/components/providerCheckout/acceptJsLoader.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  TOKENIZE_ERROR, assertTokenizationConfig, clearCardFields, cspScriptSrcFor, loadTokenizer,
  tokenizeCard, tokenizerCoreLoaded,
} from './acceptJsLoader.js';

const CONFIG = Object.freeze({
  acceptJsUrl: 'https://tokenizer.example/v1/Accept.js',
  apiLoginId: 'login-id',
  publicClientKey: 'public-client-key',
  rail: 'authorize_net_accept_js',
});

const CARD = Object.freeze({ cardNumber: '4111 1111 1111 1111', expMonth: '01', expYear: '30', cvv: '123' });

/** A fake document whose scripts "load" when told to, so nothing is fetched. */
function fakeWindow({ onAppend } = {}) {
  const scripts = [];
  const resources = [];
  const win = {
    // The evidence the readiness barrier reads. Empty until the library fetches its own core, which
    // is exactly the production window in which `window.Accept` exists but nothing works yet.
    performance: { getEntriesByType: (type) => (type === 'resource' ? resources : []) },
    document: {
      head: {
        appendChild(node) {
          scripts.push(node);
          if (onAppend) onAppend(node, win);
          return node;
        },
      },
      querySelector: () => null,
      createElement: () => {
        const listeners = {};
        return {
          setAttribute(k, v) { this[k] = v; },
          addEventListener(type, fn) { (listeners[type] ||= []).push(fn); },
          fire(type) { (listeners[type] || []).forEach((fn) => fn()); },
        };
      },
    },
  };
  win.scripts = scripts;
  win.resources = resources;
  /** The library finishing a fetch of its own — the proof the loader waits for. */
  win.completeCore = () => resources.push({ name: 'https://tokenizer.example/v1/AcceptCore.js' });
  /** Install the global exactly as the STUB does: present, but with no core behind it yet. */
  win.installStub = (dispatchData = () => {}) => { win.Accept = { dispatchData }; };
  return win;
}

/** The ordinary healthy sequence: stub installs, tag loads, core completes. */
const readyOnAppend = (dispatchData) => (node, w) => {
  w.installStub(dispatchData);
  node.fire('load');
  w.completeCore();
};

// ===========================================================================
// The configuration is validated, never repaired
// ===========================================================================

test('a configuration missing any publishable field is refused', () => {
  for (const bad of [
    {}, { acceptJsUrl: CONFIG.acceptJsUrl }, { ...CONFIG, apiLoginId: '' },
    { ...CONFIG, publicClientKey: '' }, { ...CONFIG, acceptJsUrl: '' },
  ]) {
    assert.throws(() => assertTokenizationConfig(bad), (e) => e.code === TOKENIZE_ERROR.CONFIG_INVALID);
  }
});

test('the tokenizer must be served over https, with no credentials in the address', () => {
  for (const url of ['http://tokenizer.example/Accept.js', 'javascript:alert(1)', 'data:text/javascript,1',
    '//tokenizer.example/Accept.js', 'https://user:pass@tokenizer.example/Accept.js', 'not a url']) {
    assert.throws(() => assertTokenizationConfig({ ...CONFIG, acceptJsUrl: url }),
      (e) => e.code === TOKENIZE_ERROR.CONFIG_INVALID, `${url} must be refused`);
  }
  assert.equal(assertTokenizationConfig(CONFIG).url, CONFIG.acceptJsUrl);
});

test('the CSP requirement is derived from what the provider returned', () => {
  assert.equal(cspScriptSrcFor(CONFIG), 'https://tokenizer.example');
  assert.equal(cspScriptSrcFor({ ...CONFIG, acceptJsUrl: 'https://other.example/a/b.js' }), 'https://other.example');
});

// ===========================================================================
// The script is loaded on demand, once, from exactly that address
// ===========================================================================

test('the tokenizer script is injected only when tokenization is requested', async () => {
  const win = fakeWindow({ onAppend: readyOnAppend() });
  assert.equal(win.scripts.length, 0, 'nothing may be loaded before it is asked for');

  const tokenizer = await loadTokenizer(CONFIG, { win });
  assert.equal(win.scripts.length, 1);
  assert.equal(win.scripts[0].src, CONFIG.acceptJsUrl, 'the exact provider address, unmodified');
  assert.ok(tokenizer.dispatchData);

  // Already present: no second script tag.
  await loadTokenizer(CONFIG, { win });
  assert.equal(win.scripts.length, 1);
});

test('a blocked script fails with a message a customer can act on', async () => {
  const win = fakeWindow({ onAppend: (node) => node.fire('error') });
  await assert.rejects(loadTokenizer(CONFIG, { win }), (e) => e.code === TOKENIZE_ERROR.SCRIPT_BLOCKED);
});

test('a script that loads without installing the library is refused, not assumed', async () => {
  const win = fakeWindow({ onAppend: (node) => node.fire('load') });
  await assert.rejects(loadTokenizer(CONFIG, { win }), (e) => e.code === TOKENIZE_ERROR.LIBRARY_MISSING);
});

// ===========================================================================
// PRESENCE IS NOT READINESS
//
// Production, 2026-09-10: Accept.js 200, AcceptCore.js 200 twice, nothing blocked — and the library
// still answered "Accept.js is not loaded correctly". The global existed; the core did not.
// ===========================================================================

test('the global appearing WITHOUT its core does not resolve the loader', async () => {
  // The exact production window: stub installed, tag loaded, core never fetched.
  const win = fakeWindow({ onAppend: (node, w) => { w.installStub(); node.fire('load'); } });
  let settled = 'pending';
  const promise = loadTokenizer(CONFIG, { win, timeoutMs: 120 })
    .then(() => { settled = 'resolved'; }, () => { settled = 'rejected'; });

  await new Promise((r) => setTimeout(r, 40));
  assert.equal(settled, 'pending', 'presence of the global must NOT be treated as readiness');
  assert.ok(win.Accept, 'the global really is present — that is the point');

  await promise;
  assert.equal(settled, 'rejected', 'it fails closed rather than proceeding');
});

test('the core completing IS what resolves readiness', async () => {
  let release;
  const win = fakeWindow({
    onAppend: (node, w) => {
      w.installStub();
      node.fire('load');
      // The core arrives a moment later, exactly as the library fetches it.
      release = () => w.completeCore();
    },
  });
  let resolved = false;
  const promise = loadTokenizer(CONFIG, { win, timeoutMs: 2000 }).then(() => { resolved = true; });

  await new Promise((r) => setTimeout(r, 40));
  assert.equal(resolved, false, 'still waiting on evidence');
  release();
  await promise;
  assert.equal(resolved, true, 'evidence of the core arriving is what releases it');
});

test('the barrier reads real resource evidence, not a timer', async () => {
  const win = fakeWindow();
  assert.equal(tokenizerCoreLoaded(win, CONFIG.acceptJsUrl), false, 'no entries, no readiness');
  // An entry for the ENTRY SCRIPT ITSELF proves nothing — the stub is what we already had.
  win.resources.push({ name: CONFIG.acceptJsUrl });
  assert.equal(tokenizerCoreLoaded(win, CONFIG.acceptJsUrl), false);
  // A resource from ANOTHER origin proves nothing about this library.
  win.resources.push({ name: 'https://unrelated.example/thing.js' });
  assert.equal(tokenizerCoreLoaded(win, CONFIG.acceptJsUrl), false);
  // A further resource from the tokenizer's OWN origin is the proof.
  win.completeCore();
  assert.equal(tokenizerCoreLoaded(win, CONFIG.acceptJsUrl), true);
});

test('a core that never arrives fails closed, bounded, with a safe message', async () => {
  const win = fakeWindow({ onAppend: (node, w) => { w.installStub(); node.fire('load'); } });
  const started = Date.now();
  await assert.rejects(loadTokenizer(CONFIG, { win, timeoutMs: 100 }), (e) => {
    assert.equal(e.code, TOKENIZE_ERROR.LIBRARY_MISSING);
    assert.match(e.message, /reload the page/i, 'the customer is told what to do');
    assert.equal(/card|token|key|login/i.test(e.message), false, 'and nothing sensitive is named');
    return true;
  });
  assert.ok(Date.now() - started < 5000, 'bounded, not hanging');
});

test('a browser with no Resource Timing fails closed rather than assuming readiness', async () => {
  const win = fakeWindow({ onAppend: (node, w) => { w.installStub(); node.fire('load'); } });
  delete win.performance;
  await assert.rejects(loadTokenizer(CONFIG, { win, timeoutMs: 100 }),
    (e) => e.code === TOKENIZE_ERROR.LIBRARY_MISSING);
});

test('tokenization NEVER retries dispatchData automatically', async () => {
  let calls = 0;
  const win = fakeWindow({
    onAppend: readyOnAppend((payload, cb) => {
      calls += 1;
      // The very failure that started this: the library reporting it is not ready.
      cb({ messages: { resultCode: 'Error', message: [{ text: 'Accept.js is not loaded correctly' }] } });
    }),
  });
  await assert.rejects(tokenizeCard(CARD, CONFIG, { win }), (e) => e.code === TOKENIZE_ERROR.DECLINED);
  assert.equal(calls, 1, 'exactly one invocation — a retry is the caller’s decision, never ours');
});

// ===========================================================================
// Tokenization returns a token, and nothing else
// ===========================================================================

test('the card is handed to the provider and only the one-time token comes back', async () => {
  let dispatched = null;
  const win = fakeWindow({
    onAppend: (node, w) => {
      w.Accept = {
        dispatchData: (payload, cb) => {
          dispatched = payload;
          cb({ messages: { resultCode: 'Ok' }, opaqueData: { dataDescriptor: 'COMMON.ACCEPT.INAPP.PAYMENT', dataValue: 'ONE-TIME-TOKEN' } });
        },
      };
      node.fire('load');
      w.completeCore();
    },
  });

  const result = await tokenizeCard(CARD, CONFIG, { win });
  assert.deepEqual(Object.keys(result).sort(), ['issuedAt', 'token']);
  assert.equal(result.token, 'ONE-TIME-TOKEN');
  assert.ok(Date.parse(result.issuedAt), 'the mint time travels with the token so a stale one is refused');

  // The card reached the PROVIDER's library, with the provider's own publishable key.
  assert.equal(dispatched.cardData.cardNumber, '4111111111111111');
  assert.equal(dispatched.authData.clientKey, CONFIG.publicClientKey);
  assert.equal(dispatched.authData.apiLoginID, CONFIG.apiLoginId);
  // And nothing of the card came back out.
  assert.equal(JSON.stringify(result).includes('4111'), false);
  assert.equal(JSON.stringify(result).includes('123'), false);
});

test('a decline surfaces the provider message and no card data', async () => {
  const win = fakeWindow({
    onAppend: (node, w) => {
      w.Accept = {
        dispatchData: (_payload, cb) => cb({
          messages: { resultCode: 'Error', message: [{ code: 'E_WC_05', text: 'Credit card number is invalid.' }] },
        }),
      };
      node.fire('load');
      w.completeCore();
    },
  });
  await assert.rejects(tokenizeCard(CARD, CONFIG, { win }), (e) => {
    assert.equal(e.code, TOKENIZE_ERROR.DECLINED);
    assert.equal(e.message, 'Credit card number is invalid.');
    assert.equal(e.message.includes('4111'), false);
    return true;
  });
});

test('an Ok response with no token is refused rather than treated as payment', async () => {
  const win = fakeWindow({
    onAppend: (node, w) => {
      w.Accept = { dispatchData: (_p, cb) => cb({ messages: { resultCode: 'Ok' }, opaqueData: {} }) };
      node.fire('load');
      w.completeCore();
    },
  });
  await assert.rejects(tokenizeCard(CARD, CONFIG, { win }), (e) => e.code === TOKENIZE_ERROR.DECLINED);
});

test('tokenization refuses outright when there is no browser to do it in', async () => {
  await assert.rejects(tokenizeCard(CARD, CONFIG, { win: null }), (e) => e.code === TOKENIZE_ERROR.SCRIPT_BLOCKED);
});

test('clearing the card fields empties every one of them', () => {
  let state = { cardNumber: '4111111111111111', expMonth: '01', expYear: '30', cvv: '123', postalCode: '07102' };
  clearCardFields((next) => { state = next; });
  assert.deepEqual(state, { cardNumber: '', expMonth: '', expYear: '', cvv: '', postalCode: '' });
  assert.equal(Object.values(state).join(''), '');
});
