// src/pages/sales/salesFirstTouch.test.mjs — SALES S1 FIRST-TOUCH attribution.
//
// Founder decision: when a prospect follows links from more than one salesperson before
// subscribing, the FIRST valid referral is credited. The previously pinned last-touch behaviour
// is rejected and its test is gone.
//
// These cover the BROWSER half of the contract — which token the carrier ends up holding. The
// server half (resolution, metadata, persistence, immutability, renewals) is proven in the
// backend suite services/sales/attributionIdentityBinding.test.mjs.
//
// Run (Node 20.x): node --test src/pages/sales/salesFirstTouch.test.mjs

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

// A minimal sessionStorage, installed before the module under test reads it.
class MemStore {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  get length() { return this.m.size; }
}
globalThis.sessionStorage = new MemStore();

const {
  captureToken, readToken, clearToken, replaceRetiredIncumbent, salesCheckoutField,
} = await import("./salesAttributionCarrier.js");
const { isTokenStillValid } = await import("./salesAttributionResolve.js");

// Sanitized fixtures. 43-char base64url, matching what the backend actually mints.
const NORTH = "N".repeat(43);
const RED = "R".repeat(43);
const SOUTH = "S".repeat(43);

beforeEach(() => { globalThis.sessionStorage = new MemStore(); });

// ── 1/2 · ORDER DECIDES, IN BOTH DIRECTIONS ─────────────────────────────────

test("1 · North followed first, Red second → the carrier keeps NORTH", () => {
  assert.equal(captureToken(NORTH), true, "first referral is adopted");
  assert.equal(captureToken(RED), false, "the second is not adopted");
  assert.equal(readToken(), NORTH, "the first salesperson keeps the credit");
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), { salesAttributionToken: NORTH });
});

test("2 · Red followed first, North second → the carrier keeps RED", () => {
  assert.equal(captureToken(RED), true);
  assert.equal(captureToken(NORTH), false);
  assert.equal(readToken(), RED, "order decides — there is no favoured salesperson");
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), { salesAttributionToken: RED });
});

test("2b · a third link changes nothing either", () => {
  captureToken(RED); captureToken(NORTH); captureToken(SOUTH);
  assert.equal(readToken(), RED);
});

// ── 3 · SAME LINK AGAIN IS A NO-OP ──────────────────────────────────────────

test("3 · re-following the SAME link is a safe no-op that still reports success", () => {
  assert.equal(captureToken(NORTH), true);
  assert.equal(captureToken(NORTH), true, "the carrier does hold this token, so this is not a refusal");
  assert.equal(readToken(), NORTH);
});

// ── 4/5 · A LATER BAD LINK NEVER DESTROYS A GOOD REFERRAL ───────────────────

test("4 · a later invalid or malformed link does not clear the first valid attribution", () => {
  captureToken(NORTH);
  for (const bad of ["", "   ", "short", null, undefined, 42, {}, [], "!".repeat(43), "x".repeat(200)]) {
    assert.equal(captureToken(bad), false, `must refuse ${String(bad)}`);
    assert.equal(readToken(), NORTH, `must not disturb the incumbent for ${String(bad)}`);
  }
});

test("5 · a later DISABLED salesperson's link cannot displace the first — only a server verdict can", () => {
  captureToken(NORTH);
  // The visitor follows a link whose salesperson is deactivated. The browser has no idea, and
  // must not act on a guess: without a server verdict the incumbent stands.
  assert.equal(captureToken(RED), false);
  assert.equal(readToken(), NORTH);
  // Even an explicit but non-definitive verdict changes nothing.
  for (const verdict of [true, null, undefined, "false", 0]) {
    assert.equal(replaceRetiredIncumbent(RED, { incumbentValid: verdict }), false, String(verdict));
    assert.equal(readToken(), NORTH);
  }
});

// ── 6 · A REVOKED FIRST TOKEN MAY BE REPLACED — SERVER-AUTHORITATIVE ONLY ───

test("6 · a first token the SERVER declares dead is replaced by the next valid token", () => {
  captureToken(NORTH);
  assert.equal(replaceRetiredIncumbent(RED, { incumbentValid: false }), true);
  assert.equal(readToken(), RED, "the next valid referral takes over");
});

test("6b · replacement still refuses a malformed replacement, and refuses on an empty carrier", () => {
  captureToken(NORTH);
  assert.equal(replaceRetiredIncumbent("nope", { incumbentValid: false }), false);
  assert.equal(readToken(), NORTH, "a bad replacement never erases a good incumbent");

  clearToken();
  assert.equal(replaceRetiredIncumbent(RED, { incumbentValid: false }), false,
    "with nothing to replace, first-touch capture owns the slot");
  assert.equal(readToken(), null);
});

test("6c · the server verdict is three-valued; only a definitive 200 {valid:false} permits replacement", async () => {
  const reply = (status, body) => async () => ({
    status, json: async () => { if (body === undefined) throw new Error("no body"); return body; },
  });
  const cases = [
    ["200 valid:true", reply(200, { valid: true }), true],
    ["200 valid:false", reply(200, { valid: false }), false],
    ["503 dormant", reply(503, { valid: false, disabled: true }), null],
    ["200 disabled", reply(200, { valid: false, disabled: true }), null],
    ["500", reply(500, {}), null],
    ["unreadable body", reply(200, undefined), null],
    ["network failure", async () => { throw new Error("offline"); }, null],
  ];
  for (const [label, fetchImpl, expected] of cases) {
    assert.equal(await isTokenStillValid(NORTH, { fetchImpl, apiBase: "" }), expected, label);
  }
  // A dormant server must NOT be read as "revoked".
  assert.equal(await isTokenStillValid(NORTH, { fetchImpl: reply(503, { disabled: true }), apiBase: "" }), null);
});

test("6d · the resolve call sends the token in the BODY and never in the URL", async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push({ url, body: JSON.parse(init.body), method: init.method });
    return { status: 200, json: async () => ({ valid: true }) };
  };
  await isTokenStillValid(NORTH, { fetchImpl, apiBase: "" });
  assert.equal(seen[0].method, "POST");
  assert.equal(seen[0].url, "/api/sales/attribution/resolve");
  assert.equal(seen[0].url.includes(NORTH), false, "the token must never reach the URL");
  assert.deepEqual(seen[0].body, { token: NORTH });
});

// ── 8 · CHECKOUT CANNOT NAME A SALESPERSON ──────────────────────────────────

test("8 · checkout sends ONLY the opaque token — no salespersonId, ever", () => {
  captureToken(RED);
  const field = salesCheckoutField({ purchaseType: "subscription" });
  assert.deepEqual(Object.keys(field), ["salesAttributionToken"]);
  assert.equal(field.salesAttributionToken, RED);
  assert.equal("salespersonId" in field, false);
  // And nothing but a subscription carries it at all.
  for (const t of ["merch", "gift", "hero_hearts", "qrcash", undefined, null]) {
    assert.deepEqual(salesCheckoutField({ purchaseType: t }), {}, `must not attach to ${String(t)}`);
  }
});

// ── 10/11 · VISITOR ISOLATION ───────────────────────────────────────────────

test("10/11 · separate visitors are isolated, and consuming one carrier leaves the other intact", () => {
  const visitorA = new MemStore();
  const visitorB = new MemStore();

  globalThis.sessionStorage = visitorA;
  captureToken(NORTH);
  globalThis.sessionStorage = visitorB;
  captureToken(RED);

  globalThis.sessionStorage = visitorA;
  assert.equal(readToken(), NORTH);
  clearToken();                                  // A completes checkout
  assert.equal(readToken(), null);

  globalThis.sessionStorage = visitorB;
  assert.equal(readToken(), RED, "the other visitor is untouched");

  // And A, now empty, is free to start a fresh first-touch journey.
  globalThis.sessionStorage = visitorA;
  assert.equal(captureToken(SOUTH), true);
  assert.equal(readToken(), SOUTH);
  globalThis.sessionStorage = visitorB;
  assert.equal(readToken(), RED);
});

// ── 12 · NO DEFAULT, EVER ───────────────────────────────────────────────────

test("12 · with no valid token the carrier stays empty — it never falls back to anyone", () => {
  for (const bad of ["", "nope", null, undefined, 42, {}, []]) captureToken(bad);
  assert.equal(readToken(), null, "no default salesperson materialises");
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), {},
    "and checkout sends no attribution field at all");
});

// ── 9 · THE CARRIER IS THE SOLE INPUT TO CREDIT ─────────────────────────────

test("9 · after a completed checkout the carrier is consumed and cannot re-attribute", () => {
  captureToken(NORTH);
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), { salesAttributionToken: NORTH });
  clearToken();                                  // what Checkout.jsx does on success
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), {},
    "a second purchase inherits nothing");
});
