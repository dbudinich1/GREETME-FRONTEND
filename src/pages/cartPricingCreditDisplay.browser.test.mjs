// src/pages/cartPricingCreditDisplay.browser.test.mjs
//
// CREDIT CONTRACT INTEGRITY (2026-09-30, Cart/Pricing display-honesty correction) — MOUNTED proof
// that Cart.jsx and Pricing.jsx apply the same creditCode gate Checkout.jsx already has: a stored
// courtesy {amount} with no backend-issued creditCode must never be displayed or subtracted on
// either page, while a real, coded credit still displays and subtracts consistently — the same
// $24.99 plan + $4.99 platform fee = $29.98 (no credit) / $24.98 (with credit) figures proven for
// Checkout in checkoutCreditDisplay.browser.test.mjs.
//
// Modeled on the same stub-edges esbuild pattern as checkoutCreditDisplay.browser.test.mjs.
// NO NETWORK: `fetch` throws if anything ever reaches it — neither page makes an API call for
// this feature.
//
// Run (Node 20.x): node --test src/pages/cartPricingCreditDisplay.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__cpd.bundle.mjs");
const ENTRY = join(__dirname, ".__cpd.entry.jsx");
const AUTH_STUB = join(__dirname, ".__cpd.auth.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB];

let React, createRoot, act, Cart, Pricing, MemoryRouter, Routes, Route, window;

before(async () => {
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => ({ user: null, isAuthenticated: false });\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");

  writeFileSync(ENTRY,
    'export { default as Cart } from "./Cart.jsx";\n'
    + 'export { default as Pricing } from "./Pricing.jsx";\n'
    + 'export { MemoryRouter, Routes, Route } from "react-router-dom";\n');

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
    url: "http://localhost/dashboard/cart",
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
  ({ Cart, Pricing, MemoryRouter, Routes, Route } = await import(pathToFileURL(BUNDLE).href));
});
after(() => {
  for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
});

// A single Social Butterfly subscription in the cart — credit-eligible (not close_circle) —
// exactly the shape src/pages/Pricing.jsx's own handleAddPlanToCart writes, and the same fixture
// checkoutCreditDisplay.browser.test.mjs uses, so the totals below are directly comparable.
const SUBSCRIPTION_CART_ITEM = {
  id: 1, type: "subscription", name: "Social Butterfly™ Plan", price: 24.99, quantity: 1,
  planId: "founders-social-butterfly", period: "year", pricingMode: "founders",
  priceId: "price_1TtuTcCf7KAA6aLajfuuitXc", purchaseType: "subscription", planTier: "social_butterfly",
  billingPeriod: "yearly",
};

const COURTESY_CREDIT_FIXTURE = { creditCode: "code-cart-pricing-1", amount: 5, source: "courtesy", claimedAt: new Date().toISOString() };
const AMOUNT_ONLY_FIXTURE = { amount: 999, source: "finale", appliedAt: new Date().toISOString() };

beforeEach(() => {
  window.localStorage.setItem("greetme_cart", JSON.stringify([SUBSCRIPTION_CART_ITEM]));
  window.localStorage.removeItem("greetme_referral_code");
  window.localStorage.removeItem("greetme_courtesy_credit");
});

const text = (host) => (host.textContent || "").replace(/\s+/g, " ").trim();

async function mountCart() {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: ["/dashboard/cart"] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/dashboard/cart", element: React.createElement(Cart) })),
    ));
  });
  for (let i = 0; i < 3; i += 1) {
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  }
  return { host, unmount: () => act(() => root.unmount()) };
}

// Pricing.jsx only shows its credit-bearing order summary in the post-"Add to Cart" confirmation
// state. Reach it the same way a real user does: click the Social Butterfly plan's own CTA.
async function mountPricingConfirmation() {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: ["/pricing"] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/pricing", element: React.createElement(Pricing) })),
    ));
  });
  for (let i = 0; i < 3; i += 1) {
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  }
  // Find the Social Butterfly card's own CTA by walking up from each candidate CTA button to the
  // SMALLEST ancestor whose text shows its $24.99 price — and rejecting that button if the same
  // ancestor is already large enough to also contain the other two cards' prices (14.99/44.99),
  // which would mean the walk overshot into a shared grid wrapper rather than this card. Robust
  // against unlabeled/shared "Get Started" button text across the three personal-founders cards.
  const buttons = [...host.querySelectorAll("button")].filter((b) => !/Contact Sales/i.test(b.textContent || ""));
  let target = null;
  for (const btn of buttons) {
    let el = btn;
    for (let hop = 0; hop < 12 && el; hop += 1) {
      const t = el.textContent || "";
      if (t.includes("24.99")) {
        if (!t.includes("44.99") && !t.includes("14.99")) target = btn;
        break;
      }
      el = el.parentElement;
    }
    if (target) break;
  }
  assert.ok(target, "the Social Butterfly ($24.99) plan's CTA button must be found");
  await act(async () => { target.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  for (let i = 0; i < 3; i += 1) {
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  }
  // The confirmation modal renders via createPortal directly to document.body (to escape the
  // page's stacking context) — it is a sibling of `host`, not a descendant, so post-click
  // assertions must read document.body, not host.
  assert.match(text(window.document.body), /Added to Cart/i, "must have actually reached the real confirmation state, not a fabricated one");
  return { host: window.document.body, unmount: () => act(() => root.unmount()) };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Cart.jsx
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("Cart: amount-only courtesy credit (no creditCode) shows no discount and the full total", async () => {
  window.localStorage.setItem("greetme_courtesy_credit", JSON.stringify(AMOUNT_ONLY_FIXTURE));
  const m = await mountCart();
  try {
    const body = text(m.host);
    assert.doesNotMatch(body, /Credit Applied/, "no credit-applied line for an uncoded stored amount");
    assert.doesNotMatch(body, /–\$999\.00/);
    assert.match(body, /\$29\.98/, "full, undiscounted total — same figure as Checkout's own no-credit case");
  } finally { await m.unmount(); }
});

test("Cart: no stored courtesy credit at all shows no discount and the full total", async () => {
  const m = await mountCart();
  try {
    const body = text(m.host);
    assert.doesNotMatch(body, /Credit Applied/);
    assert.match(body, /\$29\.98/);
  } finally { await m.unmount(); }
});

test("Cart: a valid backend-backed $5 credit (creditCode present) still displays and subtracts", async () => {
  window.localStorage.setItem("greetme_courtesy_credit", JSON.stringify(COURTESY_CREDIT_FIXTURE));
  const m = await mountCart();
  try {
    const body = text(m.host);
    assert.match(body, /Credit Applied/);
    assert.match(body, /–\$5\.00/);
    assert.match(body, /\$24\.98/, "same discounted total Checkout would show for the identical credit");
  } finally { await m.unmount(); }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Pricing.jsx
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("Pricing: amount-only courtesy credit (no creditCode) shows no discount and the full total", async () => {
  window.localStorage.setItem("greetme_courtesy_credit", JSON.stringify(AMOUNT_ONLY_FIXTURE));
  const m = await mountPricingConfirmation();
  try {
    const body = text(m.host);
    assert.doesNotMatch(body, /Credit Applied/, "no credit-applied line for an uncoded stored amount");
    assert.doesNotMatch(body, /–\$999\.00/);
    assert.match(body, /\$29\.98/, "full, undiscounted total — same figure as Cart and Checkout's own no-credit case");
  } finally { await m.unmount(); }
});

test("Pricing: no stored courtesy credit at all shows no discount and the full total", async () => {
  const m = await mountPricingConfirmation();
  try {
    const body = text(m.host);
    assert.doesNotMatch(body, /Credit Applied/);
    assert.match(body, /\$29\.98/);
  } finally { await m.unmount(); }
});

test("Pricing: a valid backend-backed $5 credit (creditCode present) still displays and subtracts", async () => {
  window.localStorage.setItem("greetme_courtesy_credit", JSON.stringify(COURTESY_CREDIT_FIXTURE));
  const m = await mountPricingConfirmation();
  try {
    const body = text(m.host);
    assert.match(body, /Credit Applied/);
    assert.match(body, /–\$5\.00/);
    assert.match(body, /\$24\.98/, "same discounted total Cart and Checkout would show for the identical credit");
  } finally { await m.unmount(); }
});
