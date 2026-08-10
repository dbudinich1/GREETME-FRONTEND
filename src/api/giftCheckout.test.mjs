// giftCheckout.test.mjs — TEAM D. Run: node --test src/api/giftCheckout.test.mjs
// Proves api.giftCheckout: the fundraiser token travels in the BODY (never a fabricated auth
// header), success returns the checkoutUrl, and every non-2xx path fails closed for the CTA.
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import api from "./api.js";

let calls = [];
let next = null;
const origFetch = globalThis.fetch;
const origLS = globalThis.localStorage;

beforeEach(() => {
  calls = [];
  globalThis.localStorage = { _s: { token: "AUTH" }, getItem(k) { return this._s[k] ?? null; }, setItem() {} };
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method, headers: opts.headers || {}, body: opts.body });
    if (next instanceof Error) throw next;
    return next;
  };
});
afterEach(() => { globalThis.fetch = origFetch; globalThis.localStorage = origLS; next = null; });

const resp = (status, body) => ({ ok: status >= 200 && status < 300, status, headers: { get: () => null }, json: async () => body });

test("success returns checkoutUrl; token is in the BODY, not a fabricated auth/role header", async () => {
  next = resp(200, { ok: true, checkoutUrl: "https://shop.example/cart/999:1?attributes[greetMeCorrelationId]=gmc_x", correlationId: "gmc_x" });
  const r = await api.giftCheckout({ token: "ftk_abc012345_v1", variantId: "gm-var-999", quantity: 1 });
  assert.equal(r.ok, true);
  assert.match(r.checkoutUrl, /^https:\/\/shop\.example\/cart\/999:1/);
  const c = calls[0];
  assert.equal(c.method, "POST");
  assert.match(c.url, /\/api\/gifts\/checkout$/);
  const sent = JSON.parse(c.body);
  assert.equal(sent.token, "ftk_abc012345_v1");
  assert.equal(sent.variantId, "gm-var-999");
  assert.equal(sent.quantity, 1);
  // bearer auth header is fine; no fabricated role/org/authority header
  for (const k of Object.keys(c.headers)) assert.ok(!/role|org|founder|partner|authority|capab/i.test(k), `unexpected header ${k}`);
});

test("dormant 503 fails closed (no throw to the caller)", async () => {
  next = resp(503, { ok: false, error: "unavailable" });
  const r = await api.giftCheckout({ token: "ftk_abc012345_v1", variantId: "gm-var-999" });
  assert.equal(r.ok, false);
  assert.equal(r.status, 503);
});

test("422 not-eligible fails closed", async () => {
  next = resp(422, { ok: false, reason: "NOT_ELIGIBLE_CATEGORY" });
  const r = await api.giftCheckout({ token: "ftk_abc012345_v1", variantId: "gm-var-999" });
  assert.equal(r.ok, false);
});

test("a 200 body without a checkoutUrl is treated as failure (never a blind redirect)", async () => {
  next = resp(200, { ok: true });
  const r = await api.giftCheckout({ token: "ftk_abc012345_v1", variantId: "gm-var-999" });
  assert.equal(r.ok, false);
});
