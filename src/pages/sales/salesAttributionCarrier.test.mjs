// src/pages/sales/salesAttributionCarrier.test.mjs — SALES S1 direct-link carrier.
//
// Run: node --test src/pages/sales/salesAttributionCarrier.test.mjs
//
// The carrier is plain JS, so it is exercised behaviourally against a stubbed
// sessionStorage. Claims about the JSX landing and about Checkout's request body
// are source invariants (the established pattern in this repo for files that
// cannot be imported under `node --test`).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ── stub sessionStorage BEFORE importing the carrier ────────────────────────
const mem = new Map();
globalThis.sessionStorage = {
  getItem: (k) => (mem.has(k) ? mem.get(k) : null),
  setItem: (k, v) => mem.set(k, String(v)),
  removeItem: (k) => mem.delete(k),
  clear: () => mem.clear(),
};

const {
  captureToken, readToken, clearToken, salesCheckoutField,
  isValidTokenSyntax, SALES_ATTRIBUTION_KEY,
} = await import("./salesAttributionCarrier.js");

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(HERE, "..", "..", "..", rel), "utf8").replace(/\r\n/g, "\n");

// Prose is not behaviour. These files DOCUMENT what they must never do, so every
// "this must not appear" assertion scans CODE with comments stripped.
const codeOnly = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .split("\n")
  .filter((l) => !l.trim().startsWith("//"))
  .join("\n");
const LANDING = read("src/pages/sales/SalesReferralLanding.jsx");
const APP = read("src/App.jsx");
const CHECKOUT = read("src/pages/Checkout.jsx");

// A realistic backend token: 32 random bytes → 43 base64url chars.
const TOKEN = "abcdEFGH1234_-ijklMNOP5678qrstUVWX90yzAB-_c";

// ── 1. the public link opens a usable page, not a JSON dead end ─────────────
test("1 · the public sales link renders a usable Greet-Me landing", () => {
  assert.match(APP, /<Route path="\/s\/:token" element=\{<Suspense fallback=\{null\}><SalesReferralLanding \/><\/Suspense>\} \/>/);
  assert.match(APP, /const SalesReferralLanding = lazy\(\(\) => import\("\.\/pages\/sales\/SalesReferralLanding"\)\);/);
  // A real page with a continue action into the ordinary journey.
  assert.match(LANDING, /data-testid="sales-referral-landing"/);
  assert.match(LANDING, /navigate\("\/register"\)/);
  assert.match(LANDING, /Welcome to Greet-Me/);
  // No JSON, no API call, no dead end.
  assert.equal(/fetch\(|api\.|axios/.test(LANDING), false, "the landing must call no API");
});

test("1b · the landing exposes no salesperson identity, rate or earnings", () => {
  const code = codeOnly(LANDING);
  for (const leak of ["salespersonId", "email", "commission", "earnings", "displayName"]) {
    assert.equal(new RegExp(leak, "i").test(code), false, `landing must not render ${leak}`);
  }
  // An invalid token still yields a usable page rather than an error screen.
  assert.match(LANDING, /data-testid="sales-referral-invalid"/);
});

// ── 2. the token is carried automatically to ordinary checkout ──────────────
test("2 · a captured token is carried to checkout with no manual entry", () => {
  mem.clear();
  assert.equal(captureToken(TOKEN), true);
  assert.equal(readToken(), TOKEN);
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), { salesAttributionToken: TOKEN });
  // Checkout attaches it on the subscription request, and only there.
  assert.match(CHECKOUT, /\.\.\.salesCheckoutField\(\{ purchaseType: item\.purchaseType \|\| 'subscription' \}\)/);
  assert.match(CHECKOUT, /import \{ salesCheckoutField, clearToken as clearSalesToken \}/);
});

test("2b · the carrier holds ONLY an opaque token — never a salespersonId", () => {
  mem.clear();
  captureToken(TOKEN);
  assert.deepEqual([...mem.keys()], [SALES_ATTRIBUTION_KEY]);
  assert.equal(mem.get(SALES_ATTRIBUTION_KEY), TOKEN);
  // The client never sends an identity, only the token.
  const field = salesCheckoutField({ purchaseType: "subscription" });
  assert.deepEqual(Object.keys(field), ["salesAttributionToken"]);
  assert.equal("salespersonId" in field, false);
  const carrierSrc = readFileSync(path.join(HERE, "salesAttributionCarrier.js"), "utf8");
  assert.equal(/salespersonId/.test(codeOnly(carrierSrc)), false, "the carrier code must not know about salespersonId");
});

test("2c · malformed or absent tokens are never captured", () => {
  mem.clear();
  for (const bad of [undefined, null, "", "short", "has spaces in it", "x".repeat(200), 12345, {}]) {
    assert.equal(captureToken(bad), false, `must refuse ${String(bad)}`);
  }
  assert.equal(mem.size, 0);
  assert.equal(readToken(), null);
  assert.equal(isValidTokenSyntax(TOKEN), true);
});

// ── ordinary checkout is unchanged when no sales link began the journey ─────
test("· ordinary checkout is untouched when no carrier exists", () => {
  mem.clear();
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), {},
    "no token ⇒ the field is omitted entirely");
});

test("· the token is never attached to a non-subscription purchase", () => {
  mem.clear();
  captureToken(TOKEN);
  for (const t of ["merch", "gift", "qrcash", "g1g1", "onboarding", undefined]) {
    assert.deepEqual(salesCheckoutField({ purchaseType: t }), {}, `must not attach to ${String(t)}`);
  }
});

// ── 6. abandoned / unpaid checkout binds nothing ────────────────────────────
test("6 · an abandoned checkout leaves the carrier intact and binds nothing", () => {
  mem.clear();
  captureToken(TOKEN);
  // Nothing in the carrier writes an attribution — binding is server-side only,
  // on a proven-paid webhook. Abandonment simply leaves the token preserved.
  assert.equal(readToken(), TOKEN, "an abandoned journey may be resumed");
  const code = codeOnly(readFileSync(path.join(HERE, "salesAttributionCarrier.js"), "utf8"));
  assert.equal(/fetch\(|axios|XMLHttpRequest|POST/.test(code), false,
    "the carrier must make no request — binding is server-side, on a proven-paid webhook");
});

test("· the carrier clears only on a definitively created checkout session", () => {
  mem.clear();
  captureToken(TOKEN);
  clearToken();
  assert.equal(readToken(), null);
  // Checkout clears it only behind checkoutSessionCreated(data) — never on a
  // failed or retried attempt, which must preserve attribution.
  assert.match(CHECKOUT, /if \(checkoutSessionCreated\(data\)\) clearSalesToken\(\);/);
  const idx = CHECKOUT.indexOf("clearSalesToken()");
  const guard = CHECKOUT.slice(Math.max(0, idx - 120), idx);
  assert.match(guard, /checkoutSessionCreated\(data\)/);
});

// ── 8. renewals require no browser carrier ──────────────────────────────────
test("8 · renewals need no carrier — nothing in the client participates", () => {
  mem.clear();               // a renewal happens months later, in no browser at all
  assert.equal(readToken(), null);
  assert.deepEqual(salesCheckoutField({ purchaseType: "subscription" }), {},
    "a renewal cannot and need not supply a carrier; the server resolves the durable binding");
});

// ── conventions reused, not reinvented ──────────────────────────────────────
test("· the sales carrier mirrors the existing fundraiser carrier conventions", () => {
  const fundraiser = read("src/pages/fundraiser/attributionCarrier.js");
  const sales = readFileSync(path.join(HERE, "salesAttributionCarrier.js"), "utf8");
  for (const fn of ["captureToken", "readToken", "clearToken", "isValidTokenSyntax"]) {
    assert.ok(fundraiser.includes(`export function ${fn}`), `fundraiser has ${fn}`);
    assert.ok(sales.includes(`export function ${fn}`), `sales mirrors ${fn}`);
  }
  // sessionStorage, never localStorage or a cookie.
  assert.match(codeOnly(sales), /sessionStorage/);
  assert.equal(/localStorage|document\.cookie/.test(codeOnly(sales)), false);
  // Distinct storage keys — the two carriers never collide.
  assert.notEqual("greetme_sales_attribution", "greetme_fundraiser_attribution");
  assert.match(sales, /greetme_sales_attribution/);
});
