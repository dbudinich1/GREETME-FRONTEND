// src/pages/contactsRecipientCap.browser.test.mjs — LANE E2 (2026-10-10) fix E, frontend part.
//
// The REAL Recipients page (Contacts.jsx) mounted in jsdom under a real router; only the api edge,
// auth and notify are stubbed. Proves: an account already at its plan's recipient cap is told so
// — with the number and an Upgrade link — BEFORE filling the form, and Add Recipient does not open
// the form; below the cap nothing changes.
// Run (Node 20): node --test src/pages/contactsRecipientCap.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__rcap.${PID}.${n}`);
const ENTRY = f("entry.jsx"), BUNDLE = f("bundle.mjs"), API = f("api.js"), AUTH = f("auth.js"), NOTIFY = f("notify.js");
const TEMP = [ENTRY, BUNDLE, API, AUTH, NOTIFY];
let React, createRoot, act, M, window;

const contact = (i) => ({ id: `c${i}`, name: `Person ${i}`, email: `p${i}@example.test`, occasions: [], occasionGiftSettings: {}, memoryPhotos: [] });

before(async () => {
  writeFileSync(API, `
    const impl = { getContacts: async () => ({ ok: true, data: JSON.parse(JSON.stringify(globalThis.__contacts)) }) };
    export default new Proxy(impl, { get: (t, k) => (k in t ? t[k] : async () => { throw new Error("network is not available in this test: " + String(k)); }) });
  `);
  writeFileSync(AUTH, `export const useAuth = () => ({ user: globalThis.__user });\n`);
  writeFileSync(NOTIFY, `export const showManualToast = () => {};\n`);
  writeFileSync(ENTRY, `export { default as Contacts } from "./Contacts.jsx";\nexport { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
    plugins: [{ name: "stubs", setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => {
        if (/(^|\/)api\/api$/.test(a.path)) return { path: API };
        if (/context\/AuthContext$/.test(a.path)) return { path: AUTH };
        if (/utils\/notify$/.test(a.path)) return { path: NOTIFY };
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
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.scrollTo = () => {};
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  globalThis.fetch = async () => { throw new Error("no network in this test"); }; window.fetch = globalThis.fetch;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
let root = null;
afterEach(async () => { if (root) { await act(async () => { root.unmount(); }); root = null; } });
after(() => { for (const t of TEMP) { try { rmSync(t, { force: true }); } catch { /* ignore */ } } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const txt = () => (document.body.textContent || "").replace(/\s+/g, " ");
const wait = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
async function open({ user, contacts }) {
  globalThis.__user = user; globalThis.__contacts = contacts;
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const Probe = () => React.createElement("span", { "data-testid": "loc" }, M.useLocation().pathname);
  root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(M.MemoryRouter, { initialEntries: ["/dashboard/contacts"] },
      React.createElement(M.Routes, null,
        React.createElement(M.Route, { path: "/dashboard/contacts", element: React.createElement(React.Fragment, null, React.createElement(M.Contacts), React.createElement(Probe)) }),
        React.createElement(M.Route, { path: "/pricing", element: React.createElement("span", { "data-testid": "loc" }, "/pricing") }))));
  });
  for (let i = 0; i < 6; i += 1) await wait(0);
}
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); };
const addFormOpen = () => /Add New Recipient/.test(txt());

test("at the cap (profile entitlements.recipientLimit = 3, 3 recipients): the notice states the number with an Upgrade link, before any form", async () => {
  await open({ user: { id: "u1", tier: "free", entitlements: { recipientLimit: 3 } }, contacts: [1, 2, 3].map(contact) });
  const notice = tid("recipient-cap-notice");
  assert.ok(notice, "cap notice shown up front");
  assert.match(notice.textContent, /Your plan includes 3 recipients/);
  assert.ok(tid("recipient-cap-upgrade"), "Upgrade action present");
  await click(tid("add-recipient"));
  assert.equal(addFormOpen(), false, "Add Recipient does not open a form that cannot be saved");
  await click(tid("recipient-cap-upgrade"));
  assert.equal(tid("loc").textContent, "/pricing", "Upgrade goes to Pricing");
});

test("no entitlements on the profile: falls back to the plan config (free = 3)", async () => {
  await open({ user: { id: "u1", tier: "free" }, contacts: [1, 2, 3].map(contact) });
  assert.match(tid("recipient-cap-notice").textContent, /Your plan includes 3 recipients/);
});

test("below the cap: no notice, Add Recipient opens the form as before", async () => {
  await open({ user: { id: "u1", tier: "free", entitlements: { recipientLimit: 3 } }, contacts: [1, 2].map(contact) });
  assert.equal(tid("recipient-cap-notice"), null);
  await click(tid("add-recipient"));
  assert.equal(addFormOpen(), true);
});

test("uncapped plan (recipientLimit null): never annotated", async () => {
  await open({ user: { id: "u1", tier: "unforgettable", subscriptionStatus: "active", entitlements: { recipientLimit: null } }, contacts: [1, 2, 3, 4, 5, 6].map(contact) });
  assert.equal(tid("recipient-cap-notice"), null);
});
