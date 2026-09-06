// src/api/founderCatalog.js
//
// CHECKPOINT 2 — the founder catalog-management client.
//
// Thin wrappers over the EXISTING api client, which already attaches the bearer token. Nothing
// here holds an admin secret, sends x-admin-key, persists anything, or contacts a vendor: every
// call goes to the Greet-Me backend, which is the only thing that decides what a founder may do.
//
// Founder visibility on the frontend is COSMETIC. Hiding a control stops a mis-click, not an
// attacker — the backend returns 403 to a non-founder on every one of these routes, and that is
// the authorization.

import api from './api';

const BASE = '/api/founder/catalog';

const qs = (params) => {
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params || {})) {
    if (v === undefined || v === null || v === '') continue;
    search.set(k, String(v));
  }
  const s = search.toString();
  return s ? `?${s}` : '';
};

export const founderCatalogApi = {
  /** state: draft | published | retired | all */
  listItems: ({ state = 'all', source, q, limit = 25, cursor } = {}) =>
    api.request(`${BASE}/items${qs({ state, source, q, limit, cursor })}`),

  getItem: (vendor, id) =>
    api.request(`${BASE}/items/${encodeURIComponent(vendor)}/${encodeURIComponent(id)}`),

  listProviders: () => api.request(`${BASE}/providers`),

  /**
   * Browse a provider's catalog. The drawer only calls this for a provider the server has
   * already reported as browseAvailable — a dormant provider is never requested at all, so the
   * disabled state is not a spinner waiting on a 503.
   */
  browseProvider: (providerId, { q, categoryId, start, count = 20 } = {}) =>
    api.request(`${BASE}/providers/${encodeURIComponent(providerId)}/browse${qs({ q, categoryId, start, count })}`),

  /** ONE product becomes ONE draft. There is no array form and no bulk endpoint. */
  createDraft: ({ source, vendor, externalProductId, snapshot }) =>
    api.request(`${BASE}/items`, {
      method: 'POST',
      body: JSON.stringify({ source, vendor, externalProductId, snapshot }),
    }),

  /**
   * Presentation-only patch. `etag` travels as If-Match so a stale edit is refused with 409
   * rather than overwriting a newer founder decision.
   */
  patchItem: (vendor, id, patch, etag) =>
    api.request(`${BASE}/items/${encodeURIComponent(vendor)}/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: etag ? { 'If-Match': etag } : undefined,
      body: JSON.stringify(patch),
    }),

  lifecycle: (vendor, id, action, etag) =>
    api.request(`${BASE}/items/${encodeURIComponent(vendor)}/${encodeURIComponent(id)}/${action}`, {
      method: 'POST',
      headers: etag ? { 'If-Match': etag } : undefined,
      body: JSON.stringify({}),
    }),

  // ── MERCH (PRINTFUL) ────────────────────────────────────────────────────────────────────────
  // Printful is a LIVE supplier with its own cart, Stripe checkout and fulfilment. These calls
  // curate PRESENTATION only — there is deliberately no create, no browse, no import and no
  // delete, because Phase 1 manages the five products that already exist and nothing else.

  /** The five curated products with their overlay applied, plus the overlay's health state. */
  listMerch: () => api.request(`${BASE}/merch`),

  /** Read-only. Reports whether the curation store is reachable and whether writes are enabled. */
  merchHealth: () => api.request(`${BASE}/merch/health`),

  /**
   * Presentation-only patch on ONE product. `etag` travels as If-Match, so a stale edit is
   * refused with 409 rather than overwriting a newer decision.
   */
  patchMerch: (syncProductId, patch, etag) =>
    api.request(`${BASE}/merch/${encodeURIComponent(syncProductId)}`, {
      method: 'PATCH',
      headers: etag ? { 'If-Match': etag } : undefined,
      body: JSON.stringify(patch),
    }),

  /** retire | restore. Restore returns the product HIDDEN, never straight to the storefront. */
  merchLifecycle: (syncProductId, action, etag) =>
    api.request(`${BASE}/merch/${encodeURIComponent(syncProductId)}/${action}`, {
      method: 'POST',
      headers: etag ? { 'If-Match': etag } : undefined,
      body: JSON.stringify({}),
    }),
};

export default founderCatalogApi;
