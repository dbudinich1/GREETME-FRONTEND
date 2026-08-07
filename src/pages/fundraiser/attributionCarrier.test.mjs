// src/pages/fundraiser/attributionCarrier.test.mjs — Run: node --test src/pages/fundraiser/attributionCarrier.test.mjs
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  FUNDRAISER_ATTRIBUTION_KEY, isValidTokenSyntax, captureToken, readToken, clearToken, fundraiserCheckoutField,
} from "./attributionCarrier.js";

// Fake sessionStorage (node has none). Mirrors the browser API surface the carrier uses.
function fakeStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), _map: m };
}
beforeEach(() => { globalThis.sessionStorage = fakeStorage(); });

const TOK = "ftk_ABCdef012345_-";

test("token syntax: only ftk_-prefixed opaque strings within bounds are valid", () => {
  assert.equal(isValidTokenSyntax(TOK), true);
  assert.equal(isValidTokenSyntax("ftk_" + "a".repeat(120)), true);
  for (const bad of ["", "abc", "ftk_", "ftk_short", "xtk_ABCdef012345", "ftk_" + "a".repeat(200), 123, null, undefined, {}, [], "ftk_bad token", "<script>"]) {
    assert.equal(isValidTokenSyntax(bad), false, String(bad));
  }
});

test("capture stores only a valid token; malformed/absent is NOT stored (fail-safe)", () => {
  assert.equal(captureToken(TOK), true);
  assert.equal(sessionStorage.getItem(FUNDRAISER_ATTRIBUTION_KEY), TOK);
  globalThis.sessionStorage = fakeStorage();
  assert.equal(captureToken("nope"), false);
  assert.equal(sessionStorage.getItem(FUNDRAISER_ATTRIBUTION_KEY), null);
  assert.equal(captureToken(undefined), false);
});

test("read returns the token only if still syntactically valid; clear removes it", () => {
  captureToken(TOK);
  assert.equal(readToken(), TOK);
  clearToken();
  assert.equal(readToken(), null);
  // a corrupted stored value is treated as absent
  sessionStorage.setItem(FUNDRAISER_ATTRIBUTION_KEY, "garbage");
  assert.equal(readToken(), null);
});

test("checkout field: INCLUDED for subscription + flag-on + valid token", () => {
  captureToken(TOK);
  assert.deepEqual(fundraiserCheckoutField({ purchaseType: "subscription", flagEnabled: true }), { fundraiserAttributionToken: TOK });
});

test("checkout field: INCLUDED for merch + flag-on + valid token (approved subscription-or-merch contract)", () => {
  captureToken(TOK);
  assert.deepEqual(fundraiserCheckoutField({ purchaseType: "merch", flagEnabled: true }), { fundraiserAttributionToken: TOK });
});

test("checkout field OMITTED while flag is OFF (dormant) — never submitted in production (subscription AND merch)", () => {
  captureToken(TOK);
  assert.deepEqual(fundraiserCheckoutField({ purchaseType: "subscription", flagEnabled: false }), {});
  assert.deepEqual(fundraiserCheckoutField({ purchaseType: "merch", flagEnabled: false }), {});
});

test("checkout field OMITTED for every unsupported purchase type — gift/QR Cash/G1G1/one-time remain prohibited", () => {
  captureToken(TOK);
  for (const pt of ["gift", "g1g1", "qr_cash", "hero_hearts", "image_pack", "animation_pack", "one_time", "payment", "", undefined]) {
    assert.deepEqual(fundraiserCheckoutField({ purchaseType: pt, flagEnabled: true }), {}, `purchaseType=${pt}`);
  }
});

test("purchaseType 'gift' is PROHIBITED even with flag-on + valid token (explicit contract guard)", () => {
  captureToken(TOK);
  assert.deepEqual(fundraiserCheckoutField({ purchaseType: "gift", flagEnabled: true }), {});
});

test("checkout field OMITTED when no token was captured", () => {
  assert.deepEqual(fundraiserCheckoutField({ purchaseType: "subscription", flagEnabled: true }), {});
});

test("field carries ONLY the opaque token — no org/campaign/participant/economics/payout keys", () => {
  captureToken(TOK);
  const f = fundraiserCheckoutField({ purchaseType: "subscription", flagEnabled: true });
  assert.deepEqual(Object.keys(f), ["fundraiserAttributionToken"]);
  for (const forbidden of ["organizationId", "campaignId", "participantId", "economicsVersion", "percent", "payout", "allocation"]) {
    assert.equal(forbidden in f, false);
  }
});

test("no-contamination: after clear (post-checkout), a later purchase gets nothing", () => {
  captureToken(TOK);
  fundraiserCheckoutField({ purchaseType: "subscription", flagEnabled: true }); // read (does not clear)
  clearToken();                                                                 // Checkout clears after submit
  assert.deepEqual(fundraiserCheckoutField({ purchaseType: "subscription", flagEnabled: true }), {});
});
