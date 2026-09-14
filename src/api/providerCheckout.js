// src/api/providerCheckout.js
//
// The in-Greet-Me provider checkout client.
//
// Thin wrappers over the EXISTING api client, which already attaches the bearer token. Nothing here
// holds a key, names a vendor, or contacts anything but the Greet-Me backend — the tokenizer is the
// only thing the browser talks to directly, and it is handed the card without passing through here.
//
// ORDER OF CALLS, and why it matters:
//   1. availability  — costs nothing and always answers 200. Ask FIRST.
//   2. tokenization  — the provider's publishable key material, fetched only when a customer has
//                      deliberately opened the checkout.
//   3. prepare       — the provider prices the order; the reply carries the attempt id.
//   4. submit        — the one-time token plus that attempt id. Exactly once.
//
// The gated calls answer 503 while the provider is dormant, and the shared client turns any 5xx
// into a thrown error with a global "server error" signal. That is why every gated call below is
// preceded by the availability question in the component: a dormant provider must be quiet, not an
// error banner.

import api from './api';
import { assertNoPaymentMaterial } from '../components/providerCheckout/providerCheckoutModel';

const BASE = '/api/gifts/provider-checkout';

/** Turn the shared client's 5xx throw back into data for the one case that is not an error. */
async function callOrUnavailable(fn) {
  try {
    return await fn();
  } catch (err) {
    if (err?.status === 503) return { ok: false, unavailable: true, code: err.code || 'PROVIDER_CHECKOUT_UNAVAILABLE' };
    throw err;
  }
}

/** Is this category purchasable right now? Posture only — no vendor call, no storage read. */
export async function fetchCheckoutAvailability(giftType) {
  const res = await api.request(`${BASE}/availability?giftType=${encodeURIComponent(giftType)}`);
  return { available: res?.available === true, reason: res?.reason ?? null };
}

/**
 * The provider's LIVE product list, for the founder-restricted test surface.
 *
 * READ ONLY and founder-gated at the backend: an ordinary authenticated user gets 403 and this
 * resolves to an empty list, so the picker simply does not appear. Prices come from the provider
 * and are displayed as received — the browser never sends a price back, and the total that is
 * charged comes from the provider's own quote at prepare time regardless.
 */
export async function fetchProviderProducts(giftType) {
  const { products } = await fetchProviderCatalog(giftType);
  return products;
}

/**
 * The same one call, with the FAILURE PRESERVED.
 *
 * WHY THIS EXISTS. `api.request` does not throw on a network failure — it returns
 * `{ ok: false, status: 0, networkError: true }` — and a 404 comes back the same shape. Read through
 * `fetchProviderProducts` alone, all of those are indistinguishable from a genuinely empty catalogue,
 * so a surface that only sees the array can do nothing but tell the customer that nothing is
 * available. That is a false statement about the provider's stock, and it also hides the one case
 * where trying again is the right answer.
 *
 * `ok` is therefore returned separately from `products`: "we could not look" and "there is nothing
 * here" are different sentences, and only one of them is true at a time. One network call site —
 * fetchProviderProducts delegates here rather than repeating the request.
 */
export async function fetchProviderCatalog(giftType) {
  const res = await callOrUnavailable(() => api.request(`${BASE}/catalog?giftType=${encodeURIComponent(giftType)}`));
  if (Array.isArray(res?.products)) return { ok: true, products: res.products };
  // A dormant provider is not a failure: it answered, and the answer is that there is nothing to
  // show. Everything else — a dead network, a 404, an unreadable body — is.
  if (res?.unavailable === true) return { ok: true, products: [] };
  return { ok: false, products: [] };
}

/**
 * The provider's CURRENT publishable tokenization configuration.
 *
 * Never cached, never persisted, never put in localStorage: the provider states these values change
 * and must not be stored, so it is fetched at the moment the payment step is opened and held only
 * for the life of that step.
 */
export async function fetchTokenizationConfig({ giftType, region, rail } = {}) {
  return callOrUnavailable(() => api.request(`${BASE}/tokenization`, {
    method: 'POST',
    body: JSON.stringify({ giftType, region, rail }),
  }));
}

/** Ask the provider to validate and PRICE the order. The reply's total is the only total. */
export async function prepareCheckout(payload) {
  // The backend refuses payment material too; refusing it here as well means a client bug cannot
  // even put a card number on the wire.
  assertNoPaymentMaterial(payload);
  return callOrUnavailable(() => api.request(`${BASE}/prepare`, {
    method: 'POST',
    body: JSON.stringify(payload),
  }));
}

/**
 * Submit the prepared order with the one-time token.
 *
 * The token is the ONLY payment material that crosses this boundary, it is used once, and it is
 * never stored by the caller. `attemptId` is the duplicate protection: sending it twice replays the
 * first outcome instead of placing a second order.
 */
export async function submitCheckout({ attemptId, giftType, paymentToken, paymentBinding } = {}) {
  return callOrUnavailable(() => api.request(`${BASE}/submit`, {
    method: 'POST',
    body: JSON.stringify({ attemptId, giftType, paymentToken, paymentBinding }),
  }));
}

/**
 * RETRY THE GIFT LINK for an order the provider has already accepted.
 *
 * The SAME /submit endpoint, and deliberately so — there is no second route. An attempt that is
 * already settled takes the replay branch, which returns before the provider is ever resolved, so
 * this cannot submit, tokenize or charge anything no matter how often it is called. It carries the
 * attempt id and nothing else: NO payment token, NO binding, NO card material of any kind, because
 * the order it is recovering was paid for long before this call exists.
 *
 * Resolves with `{ giftClaimToken, giftLinkFailed, ... }`. A token comes back only once the backend
 * has proven the gift record exists; a pending reservation is never projected.
 */
export async function retryGiftLink({ attemptId, giftType } = {}) {
  return callOrUnavailable(() => api.request(`${BASE}/submit`, {
    method: 'POST',
    body: JSON.stringify({ attemptId, giftType }),
  }));
}

/** Read a checkout attempt back. Reports the submission acknowledgement, never a delivery status. */
export async function readCheckout(attemptId) {
  return api.request(`${BASE}/${encodeURIComponent(attemptId)}`);
}
