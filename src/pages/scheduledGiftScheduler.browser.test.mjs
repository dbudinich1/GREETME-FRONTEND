// Scheduled physical gift (Report 117 rev 3, U1; Team 6 contract v1) in a recipient's Occasion Scheduler: the REAL
// Recipients page and ContactForm, with the feature switch ON only inside this test's bundle. Proves the scheduler's
// own save sends the snapshot and the consent the sender gave in the picker, and that its other occasions are kept.
// src/pages/scheduledGiftScheduler.browser.test.mjs
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
const f = (n) => join(__dirname, `.__sgcf.${PID}.${n}`);
const ENTRY = f("entry.jsx"), BUNDLE = f("bundle.mjs"), API = f("api.js"), AUTH = f("auth.js"), NOTIFY = f("notify.js"), SGFLAG = f("sgflag.js");
const TEMP = [ENTRY, BUNDLE, API, AUTH, NOTIFY, SGFLAG];
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
    const impl = { getContacts: async () => { __calls.push("getContacts"); return { ok: true, data: JSON.parse(JSON.stringify(globalThis.__contacts)) }; },
      updateContact: async (id, body) => { __calls.push("updateContact:" + id); (globalThis.__bodies = globalThis.__bodies || []).push(body); return { ok: true, data: { id, ...body } }; },
      getQrCashCardStatus: async () => ({ ok: true, card: { present: true, brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 } }),
      request: async (path) => (path === "/api/merch/products" ? { ok: true, products: [{ syncProductId: 9101, name: "Mug", imageUrl: "", priceCentsMin: 1800, priceCentsMax: 1800, variantCount: 1, variants: [{ syncVariantId: 40011, label: "11 oz", priceCents: 1800 }] }] } : {}) };
    export default new Proxy(impl, { get: (t, k) => (k in t ? t[k] : async () => { throw new Error("network is not available in this test: " + String(k)); }) });
  `);
  writeFileSync(AUTH, `export const useAuth = () => ({ user: { id: "u1", photoUrl: "https://example.test/me.jpg" } });\n`);
  writeFileSync(NOTIFY, `export const showManualToast = () => {};\n`);
  writeFileSync(SGFLAG, `export const SCHEDULED_PHYSICAL_GIFT_AVAILABLE = true; export const SCHEDULED_GIFT_WORDING_VERSION = "sched-gift-v1";\n`);
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
        if (/config\/scheduledPhysicalGift(\.js)?$/.test(a.path)) return { path: SGFLAG };
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
async function open(url, { mountOnly = false, state } = {}) {
  globalThis.__contacts = CONTACTS; globalThis.__scrolledTo = null;
  M.__calls.length = 0;
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  if (root) { await act(async () => { root.unmount(); }); root = null; }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const Probe = () => React.createElement("span", { "data-testid": "loc" }, M.useLocation().search || "(none)");
  root = createRoot(host);
  await act(async () => {
    const [pathname, search = ""] = url.split("?");
    root.render(React.createElement(M.MemoryRouter, { initialEntries: [state ? { pathname, search: search ? `?${search}` : "", state } : url] },
      React.createElement(M.Routes, null,
        React.createElement(M.Route, { path: "/dashboard/contacts", element: React.createElement(React.Fragment, null, React.createElement(M.Contacts), React.createElement(Probe)) }),
        React.createElement(M.Route, { path: "/dashboard", element: React.createElement("span", { "data-testid": "dashboard-home" }, "dashboard") }))));
  });
  for (let i = 0; i < 6; i += 1) await wait(0);
  await wait(150); // the form's focus timer
}
const editFormOpen = () => /Edit Recipient/.test(txt()) && Boolean(document.querySelector('input[name="name"]'));
const nameField = () => document.querySelector('input[name="name"]');

const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const setValue = async (el, value) => {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
  await wait(20);
};
const clickEl = async (el) => { assert.ok(el, "element exists"); await act(async () => { el.click(); }); await wait(30); };

test("Occasion Scheduler: choose a Branded Goods item for Christmas, consent, SAVE -> the scheduler's save sends the snapshot and the consent; other occasions kept", async () => {
  await open("/dashboard/contacts?contactId=c1&occasion=christmas");
  assert.ok(editFormOpen());
  const choose = $$("[data-testid=sg-choose]");
  assert.ok(choose.length >= 1, "the physical gift rows offer the picker");
  // Christmas is a faith occasion with gift merch in the fixture: its card holds the entry
  const card = document.querySelector('[data-occasion="christmas"]');
  await clickEl(card.querySelector("[data-testid=sg-choose]"));
  assert.ok($("[data-testid=sg-picker]"));
  await clickEl($("[data-testid=sg-tab-merch]"));
  await wait(50);
  await clickEl([...$("[data-testid=sg-step-product]").querySelectorAll("button")].find((b) => /Choose/.test(b.textContent)));
  for (const [k, v] of [["firstName", "Avery"], ["address1", "9 Pine Rd"], ["city", "Austin"], ["state", "TX"], ["postalCode", "73301"]]) await setValue($(`[data-testid=sg-delivery-${k}]`), v);
  await setValue($("[data-testid=sg-max]"), "40");
  await wait(50);
  await clickEl($("[data-testid=sg-consent]"));
  await clickEl($("[data-testid=sg-save-autogift]"));
  assert.equal($("[data-testid=sg-picker]"), null, "the picker closes");
  assert.match(card.querySelector("[data-testid=sg-entry]").textContent, /Mug/);
  await clickEl(document.querySelector('[data-testid="contact-form-footer"] button[type="submit"]'));
  for (let i = 0; i < 8; i += 1) await wait(20);
  assert.ok(M.__calls.includes("updateContact:c1"), "saved through the Recipients page's own save");
  const body = globalThis.__bodies.at(-1);
  assert.deepEqual(body.occasionGiftSettings.christmas, { type: "merch", autoGift: true, scheduledGift: { v: 1, vendor: "merch", name: "Mug — 11 oz", imageUrl: "", maxTotalCents: 4000,
    delivery: { firstName: "Avery", address1: "9 Pine Rd", city: "Austin", state: "TX", postalCode: "73301", country: "US" }, items: [{ syncVariantId: 40011 }] } });
  assert.deepEqual(body.scheduledGiftConsents, { christmas: { accepted: true, wordingVersion: "sched-gift-v1" } });
  assert.deepEqual(body.occasionGiftSettings.birthday, { type: "qrcash", amount: 25, autoGift: false }, "the other occasion's gift is kept");
  assert.deepEqual(body.occasions.map((o) => o.type).sort(), ["birthday", "christmas"]);
});
