// src/pages/businessFeeDisplay.browser.test.mjs
//
// ONE platform fee per account, EVER, for BOTH tiers (Team 2 3819f18). MOUNTED proof that Cart and Pricing show the Business fee
// from the server's platform-fee-status answer only: a first-time Business account sees $19.99, a returning account sees NO fee line
// and a plan-only total, a failed lookup asserts no amount, and no fixed figure survives. The consumer plan is checked alongside.
//
// NO NETWORK: api is stubbed (getPlatformFeeStatus answers per scenario); fetch throws if reached.
// Run (Node 20.x): node --test src/pages/businessFeeDisplay.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const BUNDLE = join(__dirname, `.__bfd.${PID}.bundle.mjs`);
const ENTRY = join(__dirname, `.__bfd.${PID}.entry.jsx`);
const AUTH_STUB = join(__dirname, `.__bfd.${PID}.auth.js`);
const API_STUB = join(__dirname, `.__bfd.${PID}.api.js`);
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB];

let React, createRoot, act, Cart, Pricing, MemoryRouter, Routes, Route, window, API;

before(async () => {
  writeFileSync(AUTH_STUB, "export const useAuth = () => ({ user: null, isAuthenticated: false });\nexport const AuthContext = { Provider: ({ children }) => children };\nexport default { useAuth };\n");
  writeFileSync(API_STUB, `
    export const __state = { feeStatus: null };
    const impl = { getPlatformFeeStatus: async () => { const r = __state.feeStatus; if (r instanceof Error) throw r; return r; } };
    export default new Proxy(impl, { get: (t, k) => (k in t ? t[k] : async () => ({ ok: true })) });
  `);
  writeFileSync(ENTRY, 'export { default as Cart } from "./Cart.jsx";\nexport { default as Pricing } from "./Pricing.jsx";\nexport { MemoryRouter, Routes, Route } from "react-router-dom";\nexport { __state } from "../api/api";\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{ name: "stub-edges", setup(build) {
      const STUBS = new Map([["../context/AuthContext", AUTH_STUB], ["../api/api", API_STUB]]);
      build.onResolve({ filter: /.*/ }, (a) => { const hit = STUBS.get(a.path); return hit ? { path: hit } : undefined; });
    } }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: "http://localhost/dashboard/cart", pretendToBeVisual: true });
  window = dom.window;
  global.window = window; global.document = window.document;
  try { global.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
  global.HTMLElement = window.HTMLElement; global.Node = window.Node; global.getComputedStyle = window.getComputedStyle;
  global.sessionStorage = window.sessionStorage; global.localStorage = window.localStorage;
  global.Event = window.Event; global.CustomEvent = window.CustomEvent;
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0); global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = async () => { throw new Error("no test may make a network request"); }; window.fetch = global.fetch;
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  ({ Cart, Pricing, MemoryRouter, Routes, Route, __state: API } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } } });

const BUSINESS_ITEM = { id: 1, type: "subscription", name: "Growth Plan", price: 199, quantity: 1, planId: "business-medium-founders", period: "year", pricingMode: "founders", priceId: "price_1TjZrnCf7KAA6aLatOeA2US0", purchaseType: "subscription", planTier: "medium_business", billingPeriod: "yearly" };
const CONSUMER_ITEM = { id: 1, type: "subscription", name: "Social Butterfly™ Plan", price: 24.99, quantity: 1, planId: "founders-social-butterfly", period: "year", pricingMode: "founders", priceId: "price_1TtuTcCf7KAA6aLajfuuitXc", purchaseType: "subscription", planTier: "social_butterfly", billingPeriod: "yearly" };

// The three real answers (shapes generated from Team 2's backend 244938f, which contains 3819f18; see platformFeeBothTiers.contract.test.mjs).
const NEW = { ok: true, policy: "one_per_account", consumer: { feeCents: 499, applies: true, reason: "initial_activation", listFeeCents: 499 }, business: { feeCents: 1999, applies: true, reason: "initial_activation", listFeeCents: 1999 } };
const RETURNING = { ok: true, policy: "one_per_account", consumer: { feeCents: 0, applies: false, reason: "already_authorized", listFeeCents: 499 }, business: { feeCents: 0, applies: false, reason: "already_authorized", listFeeCents: 1999 } };
const DOWN = Object.assign(new Error("We couldn't verify your billing history just now."), { status: 503, code: "FEE_HISTORY_UNAVAILABLE" });

beforeEach(() => {
  window.localStorage.clear();
  window.localStorage.setItem("token", "fixture-token"); // authenticated: the status is read from the server
});

const text = (host) => (host.textContent || "").replace(/\s+/g, " ").trim();
const tid = (host, t) => host.querySelector(`[data-testid="${t}"]`);
const wait = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };

async function mountCart(item, answer) {
  API.feeStatus = answer;
  window.localStorage.setItem("greetme_cart", JSON.stringify([item]));
  const host = window.document.createElement("div"); window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(MemoryRouter, { initialEntries: ["/dashboard/cart"] }, React.createElement(Routes, null, React.createElement(Route, { path: "/dashboard/cart", element: React.createElement(Cart) })))); });
  for (let i = 0; i < 5; i += 1) await wait(0);
  return { host, root };
}
async function mountPricing(answer) {
  API.feeStatus = answer;
  const host = window.document.createElement("div"); window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(MemoryRouter, { initialEntries: ["/pricing?view=business"] }, React.createElement(Routes, null, React.createElement(Route, { path: "/pricing", element: React.createElement(Pricing) })))); });
  for (let i = 0; i < 5; i += 1) await wait(0);
  return { host, root };
}
async function unmount(m) { await act(async () => { m.root.unmount(); }); m.host.remove(); }

test("Cart, first-time Business account: $19.99 fee line and $218.99 total (the server's amount)", async () => {
  const m = await mountCart(BUSINESS_ITEM, NEW);
  assert.match(text(tid(m.host, "cart-platform-fee")), /One-Time Platform Fee\$19\.99/);
  assert.match(text(m.host), /Total\$218\.99/);
  await unmount(m);
});

test("Cart, returning account buying Business: NO fee line, plan-only $199.00 total, and no $19.99 anywhere", async () => {
  const m = await mountCart(BUSINESS_ITEM, RETURNING);
  assert.equal(tid(m.host, "cart-platform-fee"), null, "no fee row");
  assert.match(text(m.host), /Total\$199\.00/);
  assert.doesNotMatch(text(m.host), /19\.99/);
  await unmount(m);
});

test("Cart, failed lookup: Business asserts NO amount and says calculated at checkout", async () => {
  const m = await mountCart(BUSINESS_ITEM, DOWN);
  assert.match(text(tid(m.host, "cart-platform-fee")), /One-Time Platform FeeCalculated at checkout/);
  assert.match(text(tid(m.host, "cart-total-fee-note")), /calculated at checkout/i);
  assert.doesNotMatch(text(m.host), /19\.99|218\.99/);
  await unmount(m);
});

test("Cart consumer plan: $4.99 for a new account, no line for a returning one (unchanged behavior)", async () => {
  let m = await mountCart(CONSUMER_ITEM, NEW);
  assert.match(text(tid(m.host, "cart-platform-fee")), /\$4\.99/);
  assert.match(text(m.host), /Total\$29\.98/);
  await unmount(m);
  m = await mountCart(CONSUMER_ITEM, RETURNING);
  assert.equal(tid(m.host, "cart-platform-fee"), null);
  assert.match(text(m.host), /Total\$24\.99/);
  await unmount(m);
});

test("Cart keeps the approved copy: auto-renewal and the one-time fee, whatever the fee state", async () => {
  for (const answer of [NEW, RETURNING, DOWN]) {
    const m = await mountCart(BUSINESS_ITEM, answer);
    const t = text(tid(m.host, "cart-subscription-terms"));
    assert.match(t, /Subscription automatically renews until cancelled\./);
    assert.match(t, /The platform fee is charged one time only, even if you later upgrade to a Business plan\./);
    await unmount(m);
  }
});

test("Pricing Business plan cards: +$19.99 for a new account; no fee text when already paid; calculated-at-checkout when unknown", async () => {
  let m = await mountPricing(NEW);
  const cards = [...m.host.querySelectorAll('[data-testid="pricing-card-platform-fee"]')];
  assert.equal(cards.length, 3, "Essentials, Growth, Impact (Enterprise has none)");
  for (const c of cards) assert.equal(text(c), "+ $19.99 One-Time Platform Fee");
  await unmount(m);

  m = await mountPricing(RETURNING);
  assert.equal(m.host.querySelectorAll('[data-testid="pricing-card-platform-fee"]').length, 0);
  assert.doesNotMatch(text(m.host), /19\.99/);
  await unmount(m);

  m = await mountPricing(DOWN);
  const unknown = [...m.host.querySelectorAll('[data-testid="pricing-card-platform-fee"]')];
  assert.equal(unknown.length, 3);
  for (const c of unknown) assert.equal(text(c), "+ One-Time Platform Fee, calculated at checkout");
  assert.doesNotMatch(text(m.host), /19\.99/);
  await unmount(m);
});

test("Pricing keeps the approved subscription copy", async () => {
  const m = await mountPricing(RETURNING);
  assert.match(text(tid(m.host, "pricing-subscription-terms")), /Subscription automatically renews until cancelled\. The platform fee is charged one time only, even if you later upgrade to a Business plan\./);
  await unmount(m);
});

test("source: no fixed fee figure is displayed from plans.js or a literal in Cart, Checkout or Pricing", () => {
  const read = (rel) => readFileSync(join(__dirname, "..", rel), "utf8");
  for (const f of ["pages/Cart.jsx", "pages/Checkout.jsx", "pages/Pricing.jsx"]) {
    // code only: JSX comment blocks and // lines are dropped (they may explain the rule by name)
    const s = read(f).replace(/\{\/\*[\s\S]*?\*\/\}/g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
    assert.doesNotMatch(s, /\.platformFee\b/, `${f} must not read plan.platformFee`);
    assert.doesNotMatch(s, /19\.99/, `${f} must not hard-code the Business fee`);
  }
  assert.match(read("config/plans.js"), /DISPLAY-ONLY/);
});
