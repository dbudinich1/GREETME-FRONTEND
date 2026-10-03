// src/pages/contactsDeepLink.browser.test.mjs
//
// The "Review your Auto-Gift" refusal email and the 10-day reminder link to  #/dashboard/contacts?contactId=<id>&occasion=<type>.
// The REAL Recipients page (Contacts.jsx) and ContactForm are mounted in jsdom under a real router (the hash router's search params
// are the router's location.search); only the api edge is stubbed. Proves: a valid id opens THAT recipient's edit form at THAT
// occasion; the params are consumed so a refresh/Back/close never reopens it; an unknown id, a missing occasion and a hostile
// occasion value all degrade to the plain list (or the plain form) with no error.
// Run (Node 20): node --test src/pages/contactsDeepLink.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__dl.${PID}.${n}`);
const ENTRY = f("entry.jsx"), BUNDLE = f("bundle.mjs"), API = f("api.js"), AUTH = f("auth.js"), NOTIFY = f("notify.js");
const TEMP = [ENTRY, BUNDLE, API, AUTH, NOTIFY];
let React, createRoot, act, M, window;

const CONTACTS = [
  { id: "c1", name: "Avery Fixture", email: "avery@example.test", relationshipCategory: "friend", relationship: "close_friend", relationshipCloseness: "greetme_worthy",
    occasions: [{ type: "birthday", date: "2026-11-14", autoSend: true }, { type: "christmas", date: "2026-12-25", autoSend: true }],
    occasionGiftSettings: { birthday: { type: "qrcash", amount: 25, autoGift: false }, christmas: { type: "merch", autoGift: false } }, memoryPhotos: [] },
  { id: "c2", name: "Blake Other", email: "blake@example.test", occasions: [], occasionGiftSettings: {}, memoryPhotos: [] },
];

before(async () => {
  writeFileSync(API, `
    export const __calls = [];
    const impl = { getContacts: async () => { __calls.push("getContacts"); return { ok: true, data: JSON.parse(JSON.stringify(globalThis.__contacts)) }; } };
    export default new Proxy(impl, { get: (t, k) => (k in t ? t[k] : async () => { throw new Error("network is not available in this test: " + String(k)); }) });
  `);
  writeFileSync(AUTH, `export const useAuth = () => ({ user: { id: "u1", photoUrl: "https://example.test/me.jpg" } });\n`);
  writeFileSync(NOTIFY, `export const showManualToast = () => {};\n`);
  writeFileSync(ENTRY, `export { default as Contacts } from "./Contacts.jsx";\nexport { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";\nexport { __calls } from "../api/api";\n`);
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
  window.HTMLElement.prototype.scrollIntoView = function () { globalThis.__scrolledTo = this; };
  window.scrollTo = () => {};
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  globalThis.fetch = async () => { throw new Error("no network in this test"); }; window.fetch = globalThis.fetch;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
afterEach(async () => { if (root) { await act(async () => { root.unmount(); }); root = null; } }); // the page runs a carousel interval: unmount so Node can exit
after(() => { for (const t of TEMP) { try { rmSync(t, { force: true }); } catch { /* ignore */ } } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const txt = () => (document.body.textContent || "").replace(/\s+/g, " ");
const wait = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
let root = null;
async function open(url, { mountOnly = false } = {}) {
  globalThis.__contacts = CONTACTS; globalThis.__scrolledTo = null;
  M.__calls.length = 0;
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  if (root) { await act(async () => { root.unmount(); }); root = null; }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const Probe = () => React.createElement("span", { "data-testid": "loc" }, M.useLocation().search || "(none)");
  root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(M.MemoryRouter, { initialEntries: [url] },
      React.createElement(M.Routes, null, React.createElement(M.Route, { path: "/dashboard/contacts", element: React.createElement(React.Fragment, null, React.createElement(M.Contacts), React.createElement(Probe)) }))));
  });
  for (let i = 0; i < 6; i += 1) await wait(0);
  await wait(150); // the form's focus timer
}
const editFormOpen = () => /Edit Recipient/.test(txt()) && Boolean(document.querySelector('input[name="name"]'));
const nameField = () => document.querySelector('input[name="name"]');

test("a valid contactId + occasion opens THAT recipient's edit form with the scheduler open and the occasion's card focused; the params are consumed", async () => {
  await open("/dashboard/contacts?contactId=c1&occasion=christmas");
  assert.ok(editFormOpen(), "edit form opened");
  assert.equal(nameField().value, "Avery Fixture", "the right recipient");
  assert.equal(tid("special-occasions-toggle").getAttribute("aria-expanded"), "true", "occasion scheduler opened");
  const card = document.querySelector('[data-occasion="christmas"]');
  assert.ok(card, "the Christmas card is on screen");
  assert.equal(document.activeElement, card, "and focused");
  assert.equal(globalThis.__scrolledTo, card, "and scrolled into view");
  assert.equal(tid("loc").textContent, "(none)", "contactId/occasion removed from the URL");
});

test("a personal occasion (birthday) is focused through its checkbox", async () => {
  await open("/dashboard/contacts?contactId=c1&occasion=birthday");
  assert.ok(editFormOpen());
  assert.equal(document.activeElement, document.getElementById("occasion-birthday"));
});

test("an unknown contactId degrades to the plain list: no form, no error, params consumed", async () => {
  await open("/dashboard/contacts?contactId=does-not-exist&occasion=birthday");
  assert.equal(editFormOpen(), false);
  assert.doesNotMatch(txt(), /Edit Recipient/);
  assert.doesNotMatch(txt(), /error|failed|couldn/i);
  assert.match(txt(), /Avery Fixture/, "the list is shown");
  assert.equal(tid("loc").textContent, "(none)");
});

test("a missing occasion opens the form plainly (nothing focused, scheduler not forced open)", async () => {
  await open("/dashboard/contacts?contactId=c2");
  assert.ok(editFormOpen());
  assert.equal(nameField().value, "Blake Other");
  assert.equal(tid("special-occasions-toggle").getAttribute("aria-expanded"), "false");
  assert.notEqual(document.activeElement && document.activeElement.getAttribute && document.activeElement.getAttribute("data-occasion"), "x");
  assert.equal(globalThis.__scrolledTo, null);
});

test("a hostile or unknown occasion value is ignored (form opens plainly)", async () => {
  for (const bad of ["<script>alert(1)</script>", "not_an_occasion", "%22%3E"]) {
    await open(`/dashboard/contacts?contactId=c1&occasion=${bad}`);
    assert.ok(editFormOpen(), bad);
    assert.equal(tid("special-occasions-toggle").getAttribute("aria-expanded"), "false", `${bad}: nothing forced open`);
  }
});

test("closing the form does not reopen it, and a refresh (the URL without the params) shows the plain list", async () => {
  await open("/dashboard/contacts?contactId=c1&occasion=christmas");
  assert.ok(editFormOpen());
  const cancel = [...document.querySelectorAll('[data-testid="contact-form-footer"] button')].find((b) => /Cancel/.test(b.textContent));
  await act(async () => { cancel.click(); });
  await wait(50);
  assert.equal(editFormOpen(), false, "closed");
  await wait(200);
  assert.equal(editFormOpen(), false, "stays closed (no reopen loop)");
  assert.equal(M.__calls.filter((c) => c === "getContacts").length, 1, "no refetch-driven reopen either");
  // a "refresh": the same page mounted again at the consumed URL
  await open("/dashboard/contacts");
  assert.equal(editFormOpen(), false);
  // the normal Edit button afterwards carries no stale occasion focus
  await open("/dashboard/contacts?contactId=c1&occasion=christmas");
  assert.ok(document.querySelector('[data-occasion="christmas"]'));
});

test("source: the link params are read from location.search, only for the personal list, once", async () => {
  const { readFileSync } = await import("node:fs");
  const C = readFileSync(join(__dirname, "Contacts.jsx"), "utf8");
  assert.match(C, /params\.get\('contactId'\)/);
  assert.match(C, /params\.get\('occasion'\)/);
  assert.match(C, /hasOpenedDeepLinkRef/);
  assert.match(C, /practiceActive \|\| isBusiness \|\| loading/);
  assert.match(C, /\/\^\[a-z0-9_\]\{1,40\}\$\/\.test\(occasion\)/);
});
