// src/pages/contactsSaveNetworkError.browser.test.mjs — LIVE-1 (2026-10-11).
//
// Production defect: api.request() RETURNS { ok:false, status:0, networkError:true } when fetch rejects (it does not throw), and the
// Recipients page's add/edit handlers did not look at the result — a save that never reached the server said "Recipient updated
// successfully", closed the form, and ContactForm fired "Saved ✓". A QR Cash Auto-Gift save was silently lost this way.
//
// The REAL Recipients page (Contacts.jsx) + REAL ContactForm + REAL SaveAuthorizationModal, mounted in jsdom under a real router; only
// the api edge, auth, notify and Stripe are stubbed. No network, nothing charged.
// Run (Node 20): node --test src/pages/contactsSaveNetworkError.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__live1.${PID}.${n}`);
const ENTRY = f("entry.jsx"), BUNDLE = f("bundle.mjs"), API = f("api.js"), AUTH = f("auth.js"), NOTIFY = f("notify.js"), STRIPE = f("stripe.jsx"), PROV = f("prov.js");
const TEMP = [ENTRY, BUNDLE, API, AUTH, NOTIFY, STRIPE, PROV];
let React, createRoot, act, M, window;

const NET = { ok: false, status: 0, networkError: true };
const BASE = { id: "c1", name: "Avery Fixture", email: "avery@example.test", relationshipCategory: "friend", relationship: "close_friend", relationshipCloseness: "greetme_worthy", memoryPhotos: [], culturalContext: { heritage: [], faith: null, preferCulturalGifts: false } };
const PLAIN = { ...BASE, occasions: [{ type: "birthday", date: "2026-11-14", autoSend: true }], occasionGiftSettings: {} };
const AUTOGIFT = { ...BASE, occasions: [{ type: "birthday", date: "2026-11-14", autoSend: true }], occasionGiftSettings: { birthday: { type: "qrcash", amount: 25, autoGift: true } } };
const OTHER = { id: "c2", name: "Blake Other", email: "blake@example.test", occasions: [], occasionGiftSettings: {}, memoryPhotos: [] };

before(async () => {
  writeFileSync(API, `
    // every call is recorded. Each write answers with the next queued outcome: "net" = api.request()'s network-failure shape,
    // an Error = thrown (as api.request() throws for 4xx/5xx), anything else = returned as-is.
    export const __calls = [];
    export const __cfg = { list: null, put: [], post: [], card: { ok: true, card: { present: false } } };
    const answer = (q) => { const o = q.length ? q.shift() : { ok: true, data: {} }; if (o === "net") return { ok: false, status: 0, networkError: true }; if (o instanceof Error) throw o; return o; };
    const impl = {
      getContacts: async () => { __calls.push("list"); return __cfg.list ? __cfg.list() : { ok: true, data: JSON.parse(JSON.stringify(globalThis.__contacts)) }; },
      updateContact: async (id, d) => { __calls.push("put:" + id); return answer(__cfg.put); },
      createContact: async (d) => { __calls.push("post"); return answer(__cfg.post); },
      getQrCashCardStatus: async () => { __calls.push("status"); return __cfg.card; },
      setupQrCashCard: async () => { __calls.push("setup"); return { ok: true, clientSecret: "cs_1", setupIntentId: "seti_1", consentWordingVersion: "w07-card-v1" }; },
      completeQrCashCard: async () => { __calls.push("complete"); return { ok: true, card: { present: true } }; },
    };
    export default new Proxy(impl, { get: (t, k) => (k in t ? t[k] : async () => { throw new Error("network is not available in this test: " + String(k)); }) });
  `);
  writeFileSync(AUTH, `export const useAuth = () => ({ user: globalThis.__user });\n`);
  writeFileSync(NOTIFY, `export const showManualToast = (title) => { (globalThis.__toasts ||= []).push(title); };\n`);
  writeFileSync(STRIPE, `
    import React from "react";
    export const Elements = ({ children }) => children;
    export const CardElement = ({ onChange }) => React.createElement("button", { type: "button", "data-testid": "fake-card-complete", onClick: () => onChange({ complete: true }) }, "card");
    export const useStripe = () => ({ confirmCardSetup: async () => ({ setupIntent: { id: "seti_1", status: "succeeded" } }) });
    export const useElements = () => ({ getElement: () => ({ fakeCard: true }) });
  `);
  writeFileSync(PROV, `export const stripePromise = { fake: true };\n`);
  writeFileSync(ENTRY, `export { default as Contacts } from "./Contacts.jsx";\nexport { MemoryRouter, Routes, Route } from "react-router-dom";\nexport { __calls, __cfg } from "../api/api";\n`);
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
        if (a.path === "@stripe/react-stripe-js") return { path: STRIPE };
        if (/stripe\/stripeProvider$/.test(a.path)) return { path: PROV };
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
const settle = async () => { for (let i = 0; i < 6; i += 1) await wait(0); };
const click = async (el) => { assert.ok(el, "control must exist"); await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await settle(); };
function setValue(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
}
const UNCAPPED = { id: "u1", tier: "unforgettable", subscriptionStatus: "active", entitlements: { recipientLimit: null } };
async function open({ contacts, user = UNCAPPED, put = [], post = [], card, list = null }) {
  globalThis.__user = user; globalThis.__contacts = contacts; globalThis.__toasts = [];
  M.__calls.length = 0; M.__cfg.put = put; M.__cfg.post = post; M.__cfg.list = list;
  M.__cfg.card = card || { ok: true, card: { present: false } };
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(M.MemoryRouter, { initialEntries: ["/dashboard/contacts"] },
      React.createElement(M.Routes, null,
        React.createElement(M.Route, { path: "/dashboard/contacts", element: React.createElement(M.Contacts) }))));
  });
  await settle();
}
const editButtons = () => [...document.querySelectorAll("button")].filter((b) => b.textContent.trim() === "Edit" || b.dataset.testid === "cx-edit"); // Report 135: the Celebrations rows edit with an icon button
const submitBtn = () => document.querySelector('[data-testid="contact-form-footer"] button[type="submit"]');
const editOpen = () => /Edit Recipient/.test(txt()) && Boolean(submitBtn());
const addOpen = () => /Add New Recipient/.test(txt()) && Boolean(submitBtn());
const saves = (prefix) => M.__calls.filter((c) => c.startsWith(prefix));
const CONNECTION = /We couldn.t save . check your connection and try again\./;

test("edit: PUT never reaches the server — no success alert, no 'Saved ✓', the error is shown and the form stays open", async () => {
  await open({ contacts: [PLAIN], put: ["net"] });
  await click(editButtons()[0]);
  assert.ok(editOpen());
  await click(submitBtn());
  assert.deepEqual(saves("put"), ["put:c1"]);
  assert.doesNotMatch(txt(), /Recipient updated successfully/);
  assert.deepEqual(globalThis.__toasts, [], "no Saved ✓ toast");
  assert.match(txt(), CONNECTION);
  assert.ok(editOpen(), "form still open for a retry");
});

test("edit through the Auto-Gift SaveAuthorizationModal: the card is set up, the PUT network-fails — the modal shows it and stays open; a retry issues exactly ONE more PUT and no setup/complete again", async () => {
  await open({ contacts: [AUTOGIFT], put: ["net", { ok: true, data: { id: "c1" } }] });
  await click(editButtons()[0]);
  await click(submitBtn());
  assert.ok(tid("save-modal"), "authorization modal opened (no card on file)");
  await click(tid("consent-checkbox"));
  await click(tid("fake-card-complete"));
  await click(tid("save-modal-save"));
  assert.deepEqual(M.__calls.filter((c) => c !== "list"), ["status", "setup", "complete", "put:c1"]);
  assert.ok(tid("save-modal"), "modal stays open");
  assert.match(tid("save-modal-submit-error").textContent, CONNECTION);
  assert.doesNotMatch(txt(), /Recipient updated successfully/);
  assert.deepEqual(globalThis.__toasts, []);
  // retry
  await click(tid("save-modal-save"));
  assert.deepEqual(M.__calls.filter((c) => c !== "list"), ["status", "setup", "complete", "put:c1", "put:c1"], "exactly one more PUT; the card is not set up again");
  assert.equal(tid("save-modal"), null, "closed after the save went through");
  assert.match(txt(), /Recipient updated successfully/);
  assert.deepEqual(globalThis.__toasts, ["Saved ✓"]);
  assert.equal(editOpen(), false);
});

test("edit: a successful save is unchanged — success alert, Saved ✓, form closed, list refreshed", async () => {
  await open({ contacts: [PLAIN], put: [{ ok: true, data: { id: "c1" } }] });
  await click(editButtons()[0]);
  const before = M.__calls.filter((c) => c === "list").length;
  await click(submitBtn());
  assert.match(txt(), /Recipient updated successfully/);
  assert.deepEqual(globalThis.__toasts, ["Saved ✓"]);
  assert.equal(editOpen(), false);
  assert.ok(M.__calls.filter((c) => c === "list").length > before, "list refreshed");
});

test("edit: a non-network server error (400) still shows the server's message; form stays open", async () => {
  await open({ contacts: [PLAIN], put: [Object.assign(new Error("Birthday date is not valid"), { status: 400 })] });
  await click(editButtons()[0]);
  await click(submitBtn());
  assert.match(txt(), /Birthday date is not valid/);
  assert.doesNotMatch(txt(), /Recipient updated successfully/);
  assert.deepEqual(globalThis.__toasts, []);
  assert.ok(editOpen());
});

test("add: POST never reaches the server — not 'stored locally', no success, no toast, error shown, form open, nothing added to the list", async () => {
  await open({ contacts: [OTHER], post: ["net"] });
  await click(tid("add-recipient"));
  assert.ok(addOpen());
  await act(async () => setValue(document.querySelector('input[name="name"]'), "Casey New"));
  await act(async () => setValue(document.querySelector('input[name="email"]'), "casey@example.test"));
  await click(submitBtn());
  assert.deepEqual(saves("post"), ["post"]);
  assert.doesNotMatch(txt(), /Recipient added successfully|stored locally/);
  assert.deepEqual(globalThis.__toasts, []);
  assert.match(txt(), CONNECTION);
  assert.ok(addOpen(), "form still open");
  assert.equal(window.localStorage.getItem("greetme_recipients"), null, "nothing written to the local fallback");
});

test("add: a successful save is unchanged", async () => {
  await open({ contacts: [OTHER], post: [{ ok: true, data: { id: "c9" } }] });
  await click(tid("add-recipient"));
  await act(async () => setValue(document.querySelector('input[name="name"]'), "Casey New"));
  await act(async () => setValue(document.querySelector('input[name="email"]'), "casey@example.test"));
  await click(submitBtn());
  assert.match(txt(), /Recipient added successfully/);
  assert.deepEqual(globalThis.__toasts, ["Saved ✓"]);
  assert.equal(addOpen(), false);
});

test("recipient cap (LANE E2) unchanged: a 403 RECIPIENT_LIMIT_REACHED on add closes the form and shows the cap notice with the number", async () => {
  const cap = Object.assign(new Error("Recipient limit reached"), { status: 403, code: "RECIPIENT_LIMIT_REACHED", data: { limit: 3, current: 3 } });
  await open({ contacts: [OTHER], post: [cap] });
  await click(tid("add-recipient"));
  await act(async () => setValue(document.querySelector('input[name="name"]'), "Casey New"));
  await act(async () => setValue(document.querySelector('input[name="email"]'), "casey@example.test"));
  await click(submitBtn());
  assert.equal(addOpen(), false, "form closed, as before");
  assert.ok(tid("recipient-cap-notice"), "cap notice shown");
  assert.match(tid("recipient-cap-notice").textContent, /3 recipients/);
  assert.doesNotMatch(txt(), /stored locally|Recipient added successfully/);
});

test("recipient cap (LANE E2) unchanged: a 403 RECIPIENT_LIMIT_REACHED on edit shows the cap notice and the form keeps its error", async () => {
  const cap = Object.assign(new Error("Recipient limit reached"), { status: 403, code: "RECIPIENT_LIMIT_REACHED", data: { limit: 3, current: 3 } });
  await open({ contacts: [PLAIN], put: [cap] });
  await click(editButtons()[0]);
  await click(submitBtn());
  assert.ok(tid("recipient-cap-notice"));
  assert.match(tid("recipient-cap-notice").textContent, /3 recipients/);
  assert.ok(editOpen());
  assert.deepEqual(globalThis.__toasts, []);
});

test("fetchRecipients: a refresh that never reaches the server keeps the list on screen instead of emptying it", async () => {
  let fail = false;
  await open({ contacts: [PLAIN, OTHER], list: () => (fail ? { ok: false, status: 0, networkError: true } : { ok: true, data: JSON.parse(JSON.stringify([PLAIN, OTHER])) }) });
  assert.match(txt(), /Avery Fixture/); assert.match(txt(), /Blake Other/);
  // a successful edit triggers a refresh; make that refresh network-fail
  M.__cfg.put = [{ ok: true, data: { id: "c1" } }];
  fail = true;
  await click(editButtons()[0]);
  await click(submitBtn());
  assert.ok(M.__calls.filter((c) => c === "list").length >= 2, "the refresh happened");
  assert.match(txt(), /Avery Fixture/, "list kept");
  assert.match(txt(), /Blake Other/, "list kept");
});

test("NET shape constant matches api.js (guards the stub against drift)", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(join(__dirname, "..", "api", "api.js"), "utf8");
  assert.match(src, /return \{ ok: false, status: 0, networkError: true \};/);
  assert.deepEqual(NET, { ok: false, status: 0, networkError: true });
});
