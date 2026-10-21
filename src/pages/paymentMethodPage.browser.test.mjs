// src/pages/paymentMethodPage.browser.test.mjs
//
// /#/dashboard/payment-method (founder-approved 2026-10-21): the sender's saved personal card for Auto-Gift, and a way
// to replace it, reusing the EXISTING W07 card endpoints (status, setup, Stripe confirmCardSetup, complete) — no new
// backend call. Linked from Auto-Gift emails, so it must open signed in and, signed out, go to log in and come back.
// Harness: esbuild bundle + jsdom (as w07AuthFlow.browser.test.mjs). Stripe and the API are stubs; nothing is charged.
//
// Run (Node 20.x): node --test src/pages/paymentMethodPage.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__pmpage.${PID}.${n}`);
const ENTRY = f("entry.jsx"), BUNDLE = f("bundle.mjs"), API = f("api.js"), AUTH = f("auth.js"), RSTRIPE = f("rstripe.jsx"), STRIPEPROV = f("stripeprov.js");
const QRCODE = f("qrcode.js");
const TEMP = [ENTRY, BUNDLE, API, AUTH, RSTRIPE, STRIPEPROV, QRCODE];
let React, createRoot, act, M, window;

before(async () => {
  writeFileSync(API, `
    export const __calls = [];
    const impl = {
      getQrCashCardStatus: async () => { __calls.push("status"); if (globalThis.__statusError) { const e = new Error("x"); Object.assign(e, globalThis.__statusError); throw e; } return { ok: true, card: globalThis.__card }; },
      setupQrCashCard: async () => { __calls.push("setup"); if (globalThis.__setupThrows) throw new Error("down"); return { ok: true, clientSecret: "seti_secret", setupIntentId: "seti_1", consentWordingVersion: "w07-card-v1" }; },
      completeQrCashCard: async (b) => { __calls.push("complete:" + JSON.stringify(b)); return { ok: true, card: { present: true, brand: "mastercard", last4: "4444", expMonth: 3, expYear: 2031, expired: false } }; },
    };
    export default new Proxy(impl, { get: (t, k) => (k in t ? t[k] : async () => { throw new Error("network is not available in this test: " + String(k)); }) });
  `);
  writeFileSync(AUTH, `export const useAuth = () => ({ isAuthenticated: globalThis.__authed === true, loading: false, user: globalThis.__authed ? { id: "u1" } : null,
    login: async () => { globalThis.__authed = true; return { success: true }; } });\nexport default { useAuth };\n`);
  writeFileSync(RSTRIPE, `import React from "react";
export const Elements = ({ children }) => children;
export const CardElement = ({ onChange }) => React.createElement("input", { "data-testid": "stub-card", onChange: (e) => onChange && onChange({ complete: e.target.value.length >= 4 }) });
export const useStripe = () => ({ confirmCardSetup: async (secret) => { (globalThis.__stripeCalls = globalThis.__stripeCalls || []).push(secret); return globalThis.__confirmResult; } });
export const useElements = () => ({ getElement: () => ({}) });
`);
  writeFileSync(QRCODE, "export default { toDataURL: async () => '' };\n");
  writeFileSync(STRIPEPROV, `export const stripePromise = Promise.resolve({});\n`);
  writeFileSync(ENTRY, `export { default as PaymentMethod } from "./PaymentMethod.jsx";
export { default as Login } from "./Login.jsx";
export { default as ProtectedRoute } from "../components/ProtectedRoute.jsx";
export { MemoryRouter, Routes, Route, useLocation, Outlet } from "react-router-dom";
export { __calls } from "../api/api";
`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
    plugins: [{ name: "stubs", setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => {
        if (/(^|\/)api\/api$/.test(a.path)) return { path: API };
        if (/context\/AuthContext$/.test(a.path)) return { path: AUTH };
        if (a.path === "@stripe/react-stripe-js") return { path: RSTRIPE };
        if (/stripe\/stripeProvider$/.test(a.path)) return { path: STRIPEPROV };
        if (a.path === "qrcode") return { path: QRCODE };
        return undefined;
      });
    } }],
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  for (const k of ["HTMLElement", "Event", "Node", "getComputedStyle", "localStorage", "sessionStorage", "CustomEvent"]) globalThis[k] = window[k];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.scrollTo = () => {};
  globalThis.fetch = async () => { throw new Error("no network in this test"); }; window.fetch = globalThis.fetch;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
writeFileSync(join(dirname(fileURLToPath(import.meta.url)), `.__pmpage.${process.pid}.qrcode.js`), "export default { toDataURL: async () => '' };\n");
TEMP.push(join(dirname(fileURLToPath(import.meta.url)), `.__pmpage.${process.pid}.qrcode.js`));
afterEach(async () => { if (root) { await act(async () => { root.unmount(); }); root = null; } });
after(() => { for (const t of TEMP) { try { rmSync(t, { force: true }); } catch { /* ignore */ } } });

let root = null;
const wait = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const settle = async () => { for (let i = 0; i < 8; i += 1) await wait(10); };
const $ = (s) => document.querySelector(s);
const clickEl = async (el) => { assert.ok(el, "element exists"); await act(async () => { el.click(); }); await settle(); };
const setValue = async (el, value) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event("input", { bubbles: true })); });
  await settle();
};

function Where() { const l = M.useLocation(); return React.createElement("div", { "data-testid": "where" }, l.pathname + l.search); }

async function mount(url) {
  M.__calls.length = 0; globalThis.__stripeCalls = [];
  if (root) { await act(async () => { root.unmount(); }); root = null; }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  const h = React.createElement;
  await act(async () => {
    root.render(h(M.MemoryRouter, { initialEntries: [url] },
      h(Where),
      h(M.Routes, null,
        h(M.Route, { path: "/login", element: h(M.Login) }),
        h(M.Route, { path: "/dashboard", element: h(M.ProtectedRoute, null, h("div", { "data-testid": "layout" }, h(OutletShim))) },
          h(M.Route, { index: true, element: h("div", { "data-testid": "dash-home" }) }),
          h(M.Route, { path: "contacts", element: h("div", { "data-testid": "contacts" }) }),
          h(M.Route, { path: "payment-method", element: h(M.PaymentMethod) })))));
  });
  await settle();
}
// The layout renders its child route through <Outlet/> (from the bundle's own router); the real DashboardLayout is out of scope here.
const OutletShim = (props) => React.createElement(M.Outlet, props);

test("the route is registered inside the protected dashboard layout", () => {
  const app = readFileSync(join(__dirname, "..", "App.jsx"), "utf8");
  const dash = app.slice(app.indexOf('path="/dashboard"'), app.indexOf("</Route>", app.indexOf('path="/dashboard"')));
  assert.match(dash, /<Route path="payment-method" element=\{<PaymentMethod \/>\} \/>/);
});

test("signed in with a saved card: brand, last 4 and expiry", async () => {
  globalThis.__authed = true; globalThis.__statusError = null;
  globalThis.__card = { present: true, brand: "visa", last4: "4242", expMonth: 12, expYear: 2030, expired: false };
  await mount("/dashboard/payment-method");
  assert.ok($("[data-testid=payment-method-page]"));
  assert.match($("h1").textContent, /^Payment method$/);
  assert.match($("[data-testid=pm-card]").textContent, /^Visa ending 4242 · expires 12\/2030On file$/);
  assert.deepEqual(M.__calls, ["status"], "only the existing status read");
});

test("no saved card: 'No saved card' and 'Add a card'", async () => {
  globalThis.__authed = true; globalThis.__card = { present: false };
  await mount("/dashboard/payment-method");
  assert.equal($("[data-testid=pm-none]").textContent, "No saved card");
  assert.equal($("[data-testid=pm-replace-open]").textContent, "Add a card");
});

test("an expired card says so", async () => {
  globalThis.__authed = true; globalThis.__card = { present: true, brand: "visa", last4: "4242", expMonth: 1, expYear: 2024, expired: true };
  await mount("/dashboard/payment-method");
  assert.equal($("[data-testid=pm-expired]").textContent, "Expired");
});

test("replace: the existing three steps in order (setup -> Stripe confirm -> complete with consent), then the new card is shown; nothing else is called", async () => {
  globalThis.__authed = true; globalThis.__card = { present: true, brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 };
  globalThis.__confirmResult = { setupIntent: { id: "seti_1", status: "succeeded" } };
  await mount("/dashboard/payment-method");
  await clickEl($("[data-testid=pm-replace-open]"));
  assert.ok($("[data-testid=pm-replace]"));
  await clickEl($("[data-testid=pm-save]"));
  assert.equal($("[data-testid=pm-error]").textContent, "Please enter your card details.", "an incomplete card is not sent");
  assert.deepEqual(M.__calls, ["status"]);
  await setValue($("[data-testid=stub-card]"), "4444");
  await clickEl($("[data-testid=pm-save]"));
  assert.deepEqual(M.__calls, ["status", "setup", 'complete:{"setupIntentId":"seti_1","consentAccepted":true,"consentWordingVersion":"w07-card-v1"}']);
  assert.deepEqual(globalThis.__stripeCalls, ["seti_secret"]);
  assert.equal($("[data-testid=pm-replace]"), null);
  assert.match($("[data-testid=pm-card]").textContent, /^Mastercard ending 4444 · expires 03\/2031/);
  assert.equal($("[data-testid=pm-saved]").textContent, "Your card is saved.");
});

test("replace refused by the bank, or the service down: clear message, the old card stays", async () => {
  globalThis.__authed = true; globalThis.__card = { present: true, brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 };
  globalThis.__confirmResult = { error: { message: "declined" } };
  await mount("/dashboard/payment-method");
  await clickEl($("[data-testid=pm-replace-open]"));
  await setValue($("[data-testid=stub-card]"), "4000");
  await clickEl($("[data-testid=pm-save]"));
  assert.equal($("[data-testid=pm-error]").textContent, "Your bank didn't confirm this card. Please try again or use a different card.");
  assert.equal(M.__calls.some((c) => c.startsWith("complete")), false);
  assert.match($("[data-testid=pm-card]").textContent, /Visa ending 4242/);
  globalThis.__setupThrows = true;
  try {
    await clickEl($("[data-testid=pm-save]"));
    assert.equal($("[data-testid=pm-error]").textContent, "We couldn't save your card just now. Please try again.");
  } finally { globalThis.__setupThrows = false; }
  await clickEl($("[data-testid=pm-cancel]"));
  assert.equal($("[data-testid=pm-replace]"), null);
});

test("the status read fails: a clear message and a working retry; switched off: says it isn't available yet", async () => {
  globalThis.__authed = true; globalThis.__statusError = { status: 502, code: "QRCASH_CARD_UNAVAILABLE" };
  await mount("/dashboard/payment-method");
  assert.equal($("[data-testid=pm-status-error]").textContent, "We couldn’t load your saved card just now. Please try again.");
  globalThis.__statusError = null; globalThis.__card = { present: true, brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 };
  await clickEl($("[data-testid=pm-retry]"));
  assert.match($("[data-testid=pm-card]").textContent, /Visa ending 4242/);
  globalThis.__statusError = { status: 503, code: "SCHEDULED_QRCASH_DISABLED" };
  await mount("/dashboard/payment-method");
  assert.equal($("[data-testid=pm-status-error]").textContent, "Saved cards for Auto-Gift aren’t available yet.");
  globalThis.__statusError = null;
});

test("signed out: sent to log in, and after signing in brought back to the payment-method page", async () => {
  globalThis.__authed = false; globalThis.__card = { present: true, brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 };
  try { window.localStorage.clear(); } catch { /* ignore */ }
  await mount("/dashboard/payment-method");
  assert.equal($("[data-testid=where]").textContent, "/login");
  assert.equal($("[data-testid=payment-method-page]"), null);
  await setValue($("input[type=email]"), "sender@example.com");
  await setValue($("input[type=password]"), "secret-pass");
  await act(async () => { $("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  await settle();
  assert.equal($("[data-testid=where]").textContent, "/dashboard/payment-method");
  assert.ok($("[data-testid=payment-method-page]"));
});

test("signed out on any other dashboard route: after signing in, the dashboard exactly as today", async () => {
  globalThis.__authed = false;
  await mount("/dashboard/contacts");
  assert.equal($("[data-testid=where]").textContent, "/login");
  await setValue($("input[type=email]"), "sender@example.com");
  await setValue($("input[type=password]"), "secret-pass");
  await act(async () => { $("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  await settle();
  assert.equal($("[data-testid=where]").textContent, "/dashboard");
});
