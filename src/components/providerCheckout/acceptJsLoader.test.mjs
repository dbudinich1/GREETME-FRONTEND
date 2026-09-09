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
  tokenizeCard,
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
  const win = {
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
  return win;
}

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
  const win = fakeWindow({ onAppend: (node, w) => { w.Accept = { dispatchData: () => {} }; node.fire('load'); } });
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
