// src/pages/referralCreditDisplay.browser.test.mjs
//
// QR Cash REFERRAL CREDIT DISPLAY, mounted against the REAL Cart and Pricing pages (jsdom; only the
// auth edge is stubbed and `fetch` answers the real GET /api/gifts/referral/:code response shape).
//
// Founder rule: no referral or courtesy credit above $5, for any reason. Team 2 returns the EFFECTIVE
// redeemable value (min(stored, $5)) as referralCreditCents. So no surface may show a literal amount: it
// shows exactly what the server returns (never more), and no credit at all when there is no real amount.
//
// Response shape (routes/giftRoutes.js GET /referral/:referralCode):
//   200 { ok: true, referralCreditCents: <int>, referralCode }
//   404 REFERRAL_NOT_FOUND / 409 REFERRAL_ALREADY_USED  (api.js: 404 resolves {ok:false}, 409 throws)
//
// Run (Node 20.x): node --test src/pages/referralCreditDisplay.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__rcd.bundle.mjs");
const ENTRY = join(__dirname, ".__rcd.entry.jsx");
const AUTH_STUB = join(__dirname, ".__rcd.auth.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB];
let React, createRoot, act, Cart, Pricing, MemoryRouter, Routes, Route, window;
let referralResponse; // { status, body } for GET /api/gifts/referral/*
let referralCalls;

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
    plugins: [{ name: "stub-edges", setup(build) {
      const STUBS = new Map([["../context/AuthContext", AUTH_STUB]]);
      build.onResolve({ filter: /.*/ }, (a) => { const hit = STUBS.get(a.path); return hit ? { path: hit } : undefined; });
    } }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: "http://localhost/dashboard/cart", pretendToBeVisual: true });
  window = dom.window;
  Object.assign(global, { window, document: window.document, HTMLElement: window.HTMLElement, Node: window.Node, getComputedStyle: window.getComputedStyle, sessionStorage: window.sessionStorage, localStorage: window.localStorage, Event: window.Event, CustomEvent: window.CustomEvent });
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = async (url) => {
    if (/\/api\/gifts\/referral\//.test(String(url))) {
      referralCalls.push(String(url));
      const r = referralResponse;
      if (r.throws) throw new Error("network down");
      return new Response(JSON.stringify(r.body), { status: r.status, headers: { "content-type": "application/json" } });
    }
    throw new Error(`no test may make this network request: ${url}`);
  };
  window.fetch = global.fetch;
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  ({ Cart, Pricing, MemoryRouter, Routes, Route } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

const SUBSCRIPTION = { id: 1, type: "subscription", name: "Social Butterfly™ Plan", price: 24.99, quantity: 1, planId: "founders-social-butterfly", period: "year", pricingMode: "founders", priceId: "price_1TtuTcCf7KAA6aLajfuuitXc", purchaseType: "subscription", planTier: "social_butterfly", billingPeriod: "yearly" };
const CODE = "REF-FIXTURE-1";
const ok = (cents) => ({ status: 200, body: { ok: true, referralCreditCents: cents, referralCode: CODE } });

beforeEach(() => {
  referralCalls = [];
  window.localStorage.setItem("greetme_cart", JSON.stringify([SUBSCRIPTION]));
  window.localStorage.setItem("greetme_referral_code", CODE);
  window.localStorage.removeItem("greetme_courtesy_credit");
  window.document.body.innerHTML = "";
});

const text = (n) => (n.textContent || "").replace(/\s+/g, " ").trim();
const settle = async () => { for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); }); };
async function mount(path, Comp) {
  const host = window.document.createElement("div"); window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: [path] },
      React.createElement(Routes, null, React.createElement(Route, { path: path.split("?")[0], element: React.createElement(Comp) }))));
  });
  await settle();
  return { host, unmount: () => act(() => root.unmount()) };
}
async function pricingConfirmation() {
  const m = await mount(`/pricing?referral=${CODE}`, Pricing);
  // The smallest ancestor that names ONLY the Social Butterfly card (not Close Circle or Legend).
  const btn = [...m.host.querySelectorAll("button")].filter((b) => !/Contact Sales/i.test(b.textContent || "")).find((b) => {
    let el = b;
    for (let hop = 0; hop < 12 && el; hop += 1) {
      const t = el.textContent || "";
      if (t.includes("Social Butterfly")) return !t.includes("Close Circle") && !t.includes("Legend");
      el = el.parentElement;
    }
    return false;
  });
  assert.ok(btn, "Social Butterfly CTA found");
  await act(async () => { btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  await settle();
  return { host: window.document.body, banner: text(m.host), unmount: m.unmount };
}

// Totals: 24.99 plan + 4.99 platform fee (guest = new account) = 29.98 before credit.
const CASES = [
  ["new mint, $5", 500, "$5.00", "$24.98", "$5"],
  ["new mint, $3 (a $3 gift)", 300, "$3.00", "$26.98", "$3"],
  ["server reports $10 (display follows the server exactly, never a literal)", 1000, "$10.00", "$19.98", "$10"],
];

for (const [name, cents, line, total, label] of CASES) {
  test(`Cart: ${name}: shows the server amount (${line}), never a literal`, async () => {
    referralResponse = ok(cents);
    const m = await mount("/dashboard/cart", Cart);
    try {
      const body = text(m.host);
      assert.match(body, /Credit Applied/);
      assert.ok(body.includes(`–${line}`), `credit line ${line}: ${body}`);
      assert.ok(body.includes(total), `total ${total}`);
      assert.deepEqual(referralCalls.map((u) => u.split("/").pop()), [CODE], "reads the real amount for this code");
    } finally { await m.unmount(); }
  });

  test(`Pricing: ${name}: plan banner and order summary show the server amount`, async () => {
    referralResponse = ok(cents);
    const m = await pricingConfirmation();
    try {
      assert.ok(m.banner.includes(`${label} credit applies`), `banner "${label} credit applies": ${m.banner}`);
      const body = text(m.host);
      assert.match(body, /Credit Applied/);
      assert.ok(body.includes(`–${line}`));
      assert.ok(body.includes(total));
    } finally { await m.unmount(); }
  });
}

const NO_AMOUNT = [
  ["missing amount", { status: 200, body: { ok: true, referralCode: CODE } }],
  ["zero", ok(0)],
  ["malformed (string)", { status: 200, body: { ok: true, referralCreditCents: "500", referralCode: CODE } }],
  ["fractional", { status: 200, body: { ok: true, referralCreditCents: 4.5, referralCode: CODE } }],
  ["unknown code (404)", { status: 404, body: { ok: false, code: "REFERRAL_NOT_FOUND" } }],
  ["already used (409)", { status: 409, body: { ok: false, code: "REFERRAL_ALREADY_USED" } }],
  ["lookup fails", { throws: true }],
];
for (const [name, resp] of NO_AMOUNT) {
  test(`no real amount (${name}): Cart and Pricing show no credit at all and the full total`, async () => {
    referralResponse = resp;
    const c = await mount("/dashboard/cart", Cart);
    try {
      const body = text(c.host);
      assert.doesNotMatch(body, /Credit Applied/);
      assert.doesNotMatch(body, /\$10\b|\$5\.00/);
      assert.ok(body.includes("$29.98"), "full, undiscounted total");
    } finally { await c.unmount(); }
    window.document.body.innerHTML = "";
    const p = await pricingConfirmation();
    try {
      assert.doesNotMatch(p.banner, /credit applies/i);
      const body = text(p.host);
      assert.doesNotMatch(body, /Credit Applied/);
      assert.ok(body.includes("$29.98"));
    } finally { await p.unmount(); }
  });
}

test("effective value 5 while the stored value is 10: Cart and Pricing show $5 and never more than the server returned", async () => {
  // GET /referral returns the EFFECTIVE value in referralCreditCents; a stored/legacy field must not leak into the display.
  referralResponse = { status: 200, body: { ok: true, referralCreditCents: 500, referralCode: CODE, referralGiftValueCents: 1000 } };
  const c = await mount("/dashboard/cart", Cart);
  try {
    const body = text(c.host);
    assert.ok(body.includes("–$5.00") && body.includes("$24.98"), body);
    assert.doesNotMatch(body, /–\$10\.00|\$19\.98/);
  } finally { await c.unmount(); }
  window.document.body.innerHTML = "";
  const p = await pricingConfirmation();
  try {
    assert.ok(p.banner.includes("$5 credit applies"), p.banner);
    assert.doesNotMatch(p.banner + text(p.host), /\$10 credit|–\$10\.00/);
    assert.ok(text(p.host).includes("–$5.00"));
  } finally { await p.unmount(); }
});

test("no hard-coded referral credit literal remains in Cart, Checkout, Pricing or GiftClaim", () => {
  for (const f of ["Cart.jsx", "Checkout.jsx", "Pricing.jsx", "GiftClaim.jsx"]) {
    const src = readFileSync(join(__dirname, f), "utf8").replace(/\r\n/g, "\n");
    const code = src.split("\n").filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join("\n");
    assert.doesNotMatch(code, /(?:referralCode|hasReferralCredit)\s*\?\s*10\b/, `${f}: no "? 10" referral literal`);
    assert.doesNotMatch(code, /\$10 credit|\$10\.00|plan\.price - 10\b/, `${f}: no literal $10 credit`);
  }
});
