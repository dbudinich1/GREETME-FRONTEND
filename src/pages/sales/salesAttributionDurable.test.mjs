// src/pages/sales/salesAttributionDurable.test.mjs — SALES-ATTR-A durable referral carrier.
//
// Defect: a brand-new prospect must verify email before checkout; the verification link opens a
// NEW tab with empty sessionStorage, so a tab-scoped carrier reached checkout unattributed. The
// carrier now lives in localStorage as { code, capturedAt } with a 30-day window (backend
// ANONYMOUS_ATTRIBUTION_WINDOW_DAYS), migrates a legacy sessionStorage value once, and falls back
// to sessionStorage when localStorage is unavailable.
//
// Run (Node 20.x): node --test src/pages/sales/salesAttributionDurable.test.mjs

import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

class MemStore {
  constructor() { this.m = new Map(); }
  getItem(k) { return this.m.has(k) ? this.m.get(k) : null; }
  setItem(k, v) { this.m.set(k, String(v)); }
  removeItem(k) { this.m.delete(k); }
  clear() { this.m.clear(); }
  get length() { return this.m.size; }
}
class ThrowingStore {
  getItem() { throw new Error("SecurityError"); }
  setItem() { throw new Error("QuotaExceededError"); }
  removeItem() { throw new Error("SecurityError"); }
}

globalThis.sessionStorage = new MemStore();
globalThis.localStorage = new MemStore();

const {
  captureToken, readToken, clearToken, replaceRetiredIncumbent, salesCheckoutField,
  SALES_ATTRIBUTION_KEY, ANONYMOUS_WINDOW_DAYS, ANONYMOUS_WINDOW_MS,
} = await import("./salesAttributionCarrier.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECKOUT = readFileSync(path.join(HERE, "..", "Checkout.jsx"), "utf8").replace(/\r\n/g, "\n");

const NORTH = "N".repeat(43);
const RED = "R".repeat(43);
const DAY = 24 * 60 * 60 * 1000;
const durable = () => JSON.parse(globalThis.localStorage.getItem(SALES_ATTRIBUTION_KEY));
const seed = (code, ageMs) => globalThis.localStorage.setItem(SALES_ATTRIBUTION_KEY,
  JSON.stringify({ code, capturedAt: new Date(Date.now() - ageMs).toISOString() }));

beforeEach(() => {
  globalThis.sessionStorage = new MemStore();
  globalThis.localStorage = new MemStore();
});

test("the window matches the backend anonymous attribution window (30 days)", () => {
  assert.equal(ANONYMOUS_WINDOW_DAYS, 30);
  assert.equal(ANONYMOUS_WINDOW_MS, 30 * DAY);
});

test("capture writes { code, capturedAt } to localStorage, not sessionStorage", () => {
  assert.equal(captureToken(NORTH), true);
  const rec = durable();
  assert.equal(rec.code, NORTH);
  assert.ok(!Number.isNaN(Date.parse(rec.capturedAt)));
  assert.deepEqual(Object.keys(rec).sort(), ["capturedAt", "code"]);
  assert.equal(globalThis.sessionStorage.getItem(SALES_ATTRIBUTION_KEY), null);
});

test("the code survives a NEW TAB (sessionStorage emptied) and still reaches checkout", () => {
  captureToken("alexdemo");
  globalThis.sessionStorage = new MemStore();          // the email-verification link's new tab
  assert.equal(readToken(), "alexdemo");
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), { salesAttributionToken: "alexdemo" });
});

test("first touch wins across tabs", () => {
  assert.equal(captureToken(NORTH), true);
  globalThis.sessionStorage = new MemStore();
  assert.equal(captureToken(RED), false);
  assert.equal(readToken(), NORTH);
  // Only an explicit server "no" lets a later link replace it — unchanged rule.
  assert.equal(replaceRetiredIncumbent(RED, { incumbentValid: null }), false);
  assert.equal(readToken(), NORTH);
  assert.equal(replaceRetiredIncumbent(RED, { incumbentValid: false }), true);
  assert.equal(readToken(), RED);
});

test("an expired code is ignored AND cleared; a later link may then be captured", () => {
  seed(NORTH, 31 * DAY);
  assert.equal(readToken(), null);
  assert.equal(globalThis.localStorage.getItem(SALES_ATTRIBUTION_KEY), null, "expired value cleared");
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), {});
  assert.equal(captureToken(RED), true);
  assert.equal(readToken(), RED);
});

test("a code inside the window is kept", () => {
  seed(NORTH, 29 * DAY);
  assert.equal(readToken(), NORTH);
});

test("malformed durable values are ignored and cleared", () => {
  for (const raw of ["not json", JSON.stringify("x"), JSON.stringify({ code: "BAD CODE", capturedAt: new Date().toISOString() }),
    JSON.stringify({ code: NORTH }), JSON.stringify({ code: NORTH, capturedAt: "never" }),
    JSON.stringify({ code: NORTH, capturedAt: new Date(Date.now() + 2 * DAY).toISOString() }), NORTH]) {
    globalThis.localStorage.setItem(SALES_ATTRIBUTION_KEY, raw);
    assert.equal(readToken(), null, `must ignore ${raw}`);
    assert.equal(globalThis.localStorage.getItem(SALES_ATTRIBUTION_KEY), null, `must clear ${raw}`);
  }
});

test("migration: a legacy sessionStorage code moves to localStorage once", () => {
  globalThis.sessionStorage.setItem(SALES_ATTRIBUTION_KEY, NORTH);   // pre-change in-flight visitor
  assert.equal(readToken(), NORTH);
  assert.equal(durable().code, NORTH);
  assert.equal(globalThis.sessionStorage.getItem(SALES_ATTRIBUTION_KEY), null, "tab copy removed");
  globalThis.sessionStorage = new MemStore();                          // new tab
  assert.equal(readToken(), NORTH);
});

test("migration never overwrites a live durable code (first touch stands)", () => {
  seed(NORTH, DAY);
  globalThis.sessionStorage.setItem(SALES_ATTRIBUTION_KEY, RED);
  assert.equal(readToken(), NORTH);
  assert.equal(globalThis.sessionStorage.getItem(SALES_ATTRIBUTION_KEY), null);
});

test("migration ignores a malformed legacy value", () => {
  globalThis.sessionStorage.setItem(SALES_ATTRIBUTION_KEY, "has spaces");
  assert.equal(readToken(), null);
  assert.equal(globalThis.localStorage.getItem(SALES_ATTRIBUTION_KEY), null);
});

test("clearToken clears both stores", () => {
  captureToken(NORTH);
  globalThis.sessionStorage.setItem(SALES_ATTRIBUTION_KEY, RED);
  clearToken();
  assert.equal(globalThis.localStorage.getItem(SALES_ATTRIBUTION_KEY), null);
  assert.equal(globalThis.sessionStorage.getItem(SALES_ATTRIBUTION_KEY), null);
  assert.equal(readToken(), null);
});

test("cleared after a paid subscription at the SAME trigger as before (created checkout session)", () => {
  // Trigger unchanged: Checkout.jsx clears only behind checkoutSessionCreated(data).
  assert.match(CHECKOUT, /if \(checkoutSessionCreated\(data\)\) clearSalesToken\(\);/);
  assert.match(CHECKOUT, /import \{ salesCheckoutField, clearToken as clearSalesToken \} from '\.\/sales\/salesAttributionCarrier\.js';/);
  captureToken(NORTH);
  clearToken();                                   // what Checkout.jsx does on success
  globalThis.sessionStorage = new MemStore();     // later tab
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), {});
});

test("checkout still sends the code as salesAttributionToken, subscription only", () => {
  assert.match(CHECKOUT, /\.\.\.salesCheckoutField\(\{ purchaseType: item\.purchaseType \|\| 'subscription' \}\)/);
  captureToken(NORTH);
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), { salesAttributionToken: NORTH });
  assert.deepEqual(salesCheckoutField({ purchaseType: "gift" }), {});
});

test("carrier is not cleared on logout (no logout wiring)", () => {
  const AUTH = readFileSync(path.join(HERE, "..", "..", "context", "AuthContext.jsx"), "utf8");
  // SALES-ATTR-B: AuthContext may READ the carrier (salesAuthField for register/login) but must
  // import nothing else from it, so it can never clear it.
  const imports = AUTH.match(/import \{([^}]*)\} from '\.\.\/pages\/sales\/salesAttributionCarrier\.js'/g) || [];
  assert.deepEqual(imports, ["import { salesAuthField } from '../pages/sales/salesAttributionCarrier.js'"]);
});

test("localStorage throwing → no crash, falls back to sessionStorage behaviour", () => {
  globalThis.localStorage = new ThrowingStore();
  assert.doesNotThrow(() => captureToken(NORTH));
  assert.equal(globalThis.sessionStorage.getItem(SALES_ATTRIBUTION_KEY), NORTH, "legacy fallback format");
  assert.equal(readToken(), NORTH);
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), { salesAttributionToken: NORTH });
  assert.doesNotThrow(() => clearToken());
  assert.equal(readToken(), null);
});

test("localStorage absent → sessionStorage fallback; both stores throwing → null, never throws", () => {
  globalThis.localStorage = undefined;
  assert.equal(captureToken(NORTH), true);
  assert.equal(readToken(), NORTH);
  globalThis.localStorage = new ThrowingStore();
  globalThis.sessionStorage = new ThrowingStore();
  assert.doesNotThrow(() => {
    assert.equal(captureToken(RED), false);
    assert.equal(readToken(), null);
    assert.equal(replaceRetiredIncumbent(RED, { incumbentValid: false }), false);
    clearToken();
    assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), {});
  });
});

test("localStorage whose setItem throws (quota / Safari private) still captures via fallback", () => {
  const ls = new MemStore();
  ls.setItem = () => { throw new Error("QuotaExceededError"); };
  globalThis.localStorage = ls;
  assert.equal(captureToken(NORTH), true);
  assert.equal(readToken(), NORTH);
});
