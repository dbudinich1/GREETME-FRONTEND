// src/pages/checkoutCreditDisplay.browser.test.mjs
//
// CREDIT CONTRACT INTEGRITY (2026-09-29, final checkout display correction) — MOUNTED proof that
// Checkout.jsx's order summary never shows "Credit Applied -$5.00" (or a discounted total) once
// the backend has refused the courtesy credit for subscriber_ineligible or status_unverifiable,
// while preserving the stored credit code and the existing eligibility/verification message.
// Modeled on the same stub-edges esbuild pattern as giftClaimManualReview.browser.test.mjs /
// creditClaimSubscriberStates.browser.test.mjs — a NEW file, since it exercises a different page.
//
// NO NETWORK: `fetch` throws if anything ever reaches it; every response is a fixture the fake
// api module returns directly. Stripe.js is never loaded (VITE_STRIPE_PUBLISHABLE_KEY is left
// unset, so Checkout.jsx's own `loadStripe(...)` call is never made — see its module-level guard).
//
// Run (Node 20.x): node --test src/pages/checkoutCreditDisplay.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__ccd.bundle.mjs");
const ENTRY = join(__dirname, ".__ccd.entry.jsx");
const AUTH_STUB = join(__dirname, ".__ccd.auth.js");
const API_STUB = join(__dirname, ".__ccd.api.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB];

let React, createRoot, act, Checkout, MemoryRouter, Routes, Route, window, apiMod;

before(async () => {
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => ({ user: { id: 'u1', email: 'u1@example.com', name: 'Test User' }, isAuthenticated: true });\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");

  // api.post is the ONLY call Checkout.jsx's subscription path makes. Each test queues the exact
  // response it wants; every call is recorded so a test can prove exactly one request was made.
  writeFileSync(API_STUB,
    "export const __calls = [];\n"
    + "export const __responses = { post: null };\n"
    + "const api = {\n"
    + "  async post(endpoint, body) { __calls.push({ endpoint, body }); const r = __responses.post;\n"
    + "    if (r instanceof Error) throw r; return r; },\n"
    + "  async request(path, opts) { __calls.push({ path, opts }); return { ok: true }; },\n"
    + "};\n"
    + "export default api;\n");

  writeFileSync(ENTRY,
    'export { default as Checkout } from "./Checkout.jsx";\n'
    + 'export { MemoryRouter, Routes, Route } from "react-router-dom";\n'
    + 'export { __calls, __responses } from "../api/api";\n');

  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{
      name: "stub-edges",
      setup(build) {
        const STUBS = new Map([
          ["../context/AuthContext", AUTH_STUB],
          ["../api/api", API_STUB],
        ]);
        build.onResolve({ filter: /.*/ }, (a) => {
          const hit = STUBS.get(a.path);
          return hit ? { path: hit } : undefined;
        });
      },
    }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });

  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: "http://localhost/dashboard/checkout",
    pretendToBeVisual: true,
  });
  window = dom.window;
  global.window = window;
  global.document = window.document;
  try { global.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  global.getComputedStyle = window.getComputedStyle;
  global.sessionStorage = window.sessionStorage;
  global.localStorage = window.localStorage;
  global.Event = window.Event;
  global.CustomEvent = window.CustomEvent;
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = async () => { throw new Error("no test may make a network request"); };
  window.fetch = global.fetch;
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  }));

  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  ({ Checkout, MemoryRouter, Routes, Route } = await import(pathToFileURL(BUNDLE).href));
  apiMod = await import(pathToFileURL(BUNDLE).href);
});
after(() => {
  for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
});

// A single Social Butterfly subscription in the cart — credit-eligible (not close_circle) —
// exactly the shape src/pages/Pricing.jsx's handleAddPlanToCart writes.
const SUBSCRIPTION_CART_ITEM = {
  id: 1, type: "subscription", name: "Social Butterfly™ Plan", price: 24.99, quantity: 1,
  planId: "founders-social-butterfly", period: "year", pricingMode: "founders",
  priceId: "price_1TtuTcCf7KAA6aLajfuuitXc", purchaseType: "subscription", planTier: "social_butterfly",
  billingPeriod: "yearly",
};

const COURTESY_CREDIT_FIXTURE = { creditCode: "code-checkout-display-1", amount: 5, source: "courtesy", claimedAt: new Date().toISOString() };

beforeEach(() => {
  apiMod.__calls.length = 0;
  apiMod.__responses.post = null;
  window.localStorage.setItem("greetme_cart", JSON.stringify([SUBSCRIPTION_CART_ITEM]));
  window.localStorage.setItem("greetme_courtesy_credit", JSON.stringify(COURTESY_CREDIT_FIXTURE));
  window.localStorage.removeItem("greetme_referral_code");
});

const text = (host) => (host.textContent || "").replace(/\s+/g, " ").trim();

async function mount() {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: ["/dashboard/checkout"] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/dashboard/checkout", element: React.createElement(Checkout) })),
    ));
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  }
  return { host, unmount: () => act(() => root.unmount()) };
}

async function clickCompleteOrder(host) {
  const buttons = [...host.querySelectorAll("button")];
  const btn = buttons.find((b) => /Complete Order/i.test(b.textContent || ""));
  assert.ok(btn, "the 'Complete Order' submit button must be present");
  await act(async () => { btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1 — Before submission, the available credit appears in the existing pending checkout state.
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("1. before submission, the stored courtesy credit shows as an applied -$5.00 discount", async () => {
  const m = await mount();
  try {
    const body = text(m.host);
    assert.match(body, /Credit Applied/);
    assert.match(body, /–\$5\.00/);
    assert.equal(apiMod.__calls.length, 0, "no request has been made yet — this is the pending, pre-submission state");
  } finally { await m.unmount(); }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 2/3 — Subscriber refusal removes the discount AND restores the full total.
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("2+3. subscriber refusal removes the $5 discount from the summary and restores the full total", async () => {
  apiMod.__responses.post = { ok: true, creditApplied: false, creditFailureReason: "subscriber_ineligible", url: null };
  const m = await mount();
  try {
    // Full price without the credit: $24.99 plan + $4.99 platform fee = $29.98.
    const beforeBody = text(m.host);
    assert.match(beforeBody, /\$24\.98/, "pending state shows the discounted total before submission");

    await clickCompleteOrder(m.host);
    const afterBody = text(m.host);

    assert.doesNotMatch(afterBody, /Credit Applied/, "the misleading 'Credit Applied' line must be gone");
    assert.doesNotMatch(afterBody, /–\$5\.00/, "no $5 subtraction must remain anywhere in the summary");
    assert.match(afterBody, /Greet-Me Credit/, "replaced with the saved-for-later status line");
    assert.match(afterBody, /Saved for later/i);
    assert.match(afterBody, /\$29\.98/, "the total is restored to the full, undiscounted price");
    assert.match(afterBody, /This \$5 credit is for non-subscribers/i, "the existing eligibility message is preserved");
  } finally { await m.unmount(); }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4 — Subscriber refusal preserves the credit in storage.
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("4. subscriber refusal preserves the credit code in localStorage — it is not discarded", async () => {
  apiMod.__responses.post = { ok: true, creditApplied: false, creditFailureReason: "subscriber_ineligible", url: null };
  const m = await mount();
  try {
    await clickCompleteOrder(m.host);
    const stored = window.localStorage.getItem("greetme_courtesy_credit");
    assert.ok(stored, "the courtesy credit must remain in storage");
    assert.equal(JSON.parse(stored).creditCode, COURTESY_CREDIT_FIXTURE.creditCode);
  } finally { await m.unmount(); }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 5 — Status-unverifiable removes the discount and restores the full total.
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("5. status-unverifiable removes the discount, restores the full total, and preserves the credit", async () => {
  apiMod.__responses.post = { ok: true, creditApplied: false, creditFailureReason: "status_unverifiable", url: null };
  const m = await mount();
  try {
    await clickCompleteOrder(m.host);
    const body = text(m.host);
    assert.doesNotMatch(body, /Credit Applied/);
    assert.doesNotMatch(body, /–\$5\.00/);
    assert.match(body, /Greet-Me Credit/);
    assert.match(body, /Not applied/i);
    assert.match(body, /\$29\.98/, "full price restored");
    assert.match(body, /couldn.{0,3}t confirm your account status/i, "the existing verification message is preserved");
    assert.ok(window.localStorage.getItem("greetme_courtesy_credit"), "credit preserved for status_unverifiable too");
  } finally { await m.unmount(); }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 6 — Eligible non-subscriber response keeps the $5 reduction (regression: success path untouched).
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("6. an eligible non-subscriber application keeps the $5 reduction shown (unchanged)", async () => {
  apiMod.__responses.post = { ok: true, creditApplied: true, url: "https://checkout.stripe.test/cs_ok" };
  // Prevent the real navigation the success path triggers (window.location.href = data.url) from
  // throwing in jsdom — assert on the DOM in the instant right after the response resolves.
  const originalHref = Object.getOwnPropertyDescriptor(window.location, "href");
  try { delete window.location.href; } catch { /* ignore */ }
  window.location.href = "";

  const m = await mount();
  try {
    const respPromise = new Promise((resolve) => {
      const check = () => (apiMod.__calls.length > 0 ? resolve() : window.setTimeout(check, 5));
      check();
    });
    await clickCompleteOrder(m.host);
    await respPromise;
    const body = text(m.host);
    assert.match(body, /Credit Applied/);
    assert.match(body, /–\$5\.00/);
  } finally {
    await m.unmount();
    if (originalHref) Object.defineProperty(window.location, "href", originalHref);
  }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 7 — Invalid or consumed credit retains its existing (unchanged) behavior.
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("7. an invalid/consumed credit (any OTHER creditFailureReason) is NOT treated as a temporary refusal — existing behavior unchanged", async () => {
  apiMod.__responses.post = { ok: true, creditApplied: false, creditFailureReason: "not_found", url: null };
  const m = await mount();
  try {
    await clickCompleteOrder(m.host);
    const body = text(m.host);
    // Unchanged pre-existing behavior: the generic message, and storage IS cleared for a
    // genuinely-gone credit (this correction only protects the two temporary reasons).
    assert.match(body, /Your credit could not be applied/i);
    assert.equal(window.localStorage.getItem("greetme_courtesy_credit"), null, "a genuinely invalid credit is still removed from storage, as before");
    assert.doesNotMatch(body, /Saved for later/i);
    assert.doesNotMatch(body, /Greet-Me Credit —/i);
  } finally { await m.unmount(); }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 8 — No additional checkout request is triggered by the display-state update.
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("8. the display-state correction itself triggers no additional /create-checkout request", async () => {
  apiMod.__responses.post = { ok: true, creditApplied: false, creditFailureReason: "subscriber_ineligible", url: null };
  const m = await mount();
  try {
    await clickCompleteOrder(m.host);
    assert.equal(apiMod.__calls.length, 1, "exactly one request for the one click — the display update is pure client-side state, no retry loop");
    // Let a few more render/microtask cycles pass to be sure nothing fires asynchronously.
    for (let i = 0; i < 5; i += 1) {
      await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
    }
    assert.equal(apiMod.__calls.length, 1, "still exactly one call after settling — no delayed second request either");
  } finally { await m.unmount(); }
});
