// src/pages/businessContactEdit.browser.test.mjs
//
// BIZ-EDIT-1 (Team 6, 2026-10-29) — the REAL Recipients page (Contacts.jsx + CelebrationsWorkspace + ContactForm) in jsdom under
// a real router. The personal api and the corporate fetch edge are stubbed (no network). Proves: Business Edit is filled from the
// owner-only management read (full stored record), saves ONLY the fields the owner changed (an untouched save sends nothing that
// could overwrite), full-date occasions save, and a record that cannot be loaded opens no form (fail closed). The personal Edit is
// unchanged. Run (Node 20): node --test src/pages/businessContactEdit.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__bizedit.${PID}.${n}`);
const ENTRY = f("entry.jsx"), BUNDLE = f("bundle.mjs"), API = f("api.js"), AUTH = f("auth.js"), NOTIFY = f("notify.js");
const TEMP = [ENTRY, BUNDLE, API, AUTH, NOTIFY];
let React, createRoot, act, M, window;

// The campaign-audience projection the roster shows (BE services/corporateCampaign/audience.js projectContact): no email, month-day.
const ROSTER = [
  { id: "b1", name: "Erin Employee", corporateContactType: "employee", occasionDates: { birthday: "03-09" }, ready: true, hasEmail: true },
  { id: "b2", name: "Cole Client", corporateContactType: "client", occasionDates: {}, ready: true, hasEmail: true },
];
// The management read (BE routes/corporateContactsRoutes.js projectManagedContact): the FULL stored records.
const MANAGED = [
  { id: "b1", name: "Erin Employee", email: "erin@corp.test", phone: "", company: "", department: "", notes: "", firstName: "Erin", lastName: "Employee",
    corporateContactType: "employee", occasions: [{ id: "o1", type: "birthday", date: "1990-03-09", autoSend: true }],
    shippingAddress: null, shippingAddressStatus: null, shippingAddressReviewReason: null, deliveryPhone: null, readiness: { ready: true } },
  { id: "b2", name: "Cole Client", email: "cole@corp.test", phone: "", company: "", department: "", notes: "", firstName: "", lastName: "",
    corporateContactType: "client", occasions: [], shippingAddress: null, readiness: { ready: true } },
];
const CONTACTS = [
  { id: "c1", name: "Avery Fixture", email: "avery@example.test", relationshipCategory: "friend", relationship: "close_friend", relationshipCloseness: "greetme_worthy",
    occasions: [{ id: "o9", type: "birthday", date: "1990-11-14", autoSend: true }], occasionGiftSettings: {}, memoryPhotos: [] },
];

before(async () => {
  writeFileSync(API, `
    export const __calls = [];
    const impl = {
      getContacts: async () => { __calls.push("getContacts"); return { ok: true, data: JSON.parse(JSON.stringify(globalThis.__contacts)) }; },
      getUpcomingOccasions: async () => ({ ok: true, data: [] }),
      getSentGreetings: async () => ({ ok: true, greetings: [] }),
      updateContact: async (id, body) => { (globalThis.__puts = globalThis.__puts || []).push({ id, body: JSON.parse(JSON.stringify(body)) }); return { ok: true, data: { id, ...body } }; } };
    export default new Proxy(impl, { get: (t, k) => (k in t ? t[k] : async () => { throw new Error("network is not available in this test: " + String(k)); }) });
  `);
  writeFileSync(AUTH, `export const useAuth = () => ({ user: { id: "u1", photoUrl: "https://example.test/me.jpg" } });\n`);
  writeFileSync(NOTIFY, `export const showManualToast = (title, message) => { (globalThis.__toasts = globalThis.__toasts || []).push(title + " " + message); };\n`);
  writeFileSync(ENTRY, `export { default as Contacts } from "./Contacts.jsx";\nexport { MemoryRouter, Routes, Route } from "react-router-dom";\n`);
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
  // The corporate edge only. Anything else has no network.
  globalThis.fetch = async (url, init = {}) => {
    const u = String(url);
    const method = init.method || "GET";
    globalThis.__fetches.push(`${method} ${u}`);
    const json = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });
    if (u.endsWith("/api/corporate-campaigns/memberships")) return json({ memberships: [{ corporateOrganizationId: "org_1", status: "active", role: "owner" }] });
    if (u.endsWith("/api/corporate-campaigns/organizations/org_1/contacts")) return json({ contacts: ROSTER, count: ROSTER.length });
    if (u.endsWith("/api/corporate-campaigns/organizations/org_1/campaigns")) return json({ campaigns: [] });
    if (u.endsWith("/api/corporate-contacts/organizations/org_1/contacts") && method === "GET") {
      const r = globalThis.__managed;
      if (typeof r === "number") return json({ ok: false }, r);
      return json({ ok: true, data: { contacts: JSON.parse(JSON.stringify(r)), counts: {} } });
    }
    if (/\/api\/corporate-contacts\/organizations\/org_1\/contacts\/b\d$/.test(u) && method === "PATCH") {
      globalThis.__patches.push({ id: u.split("/").pop(), body: JSON.parse(init.body) });
      if (globalThis.__patchStatus) return json({ ok: false, error: "corporate_contacts_unavailable" }, globalThis.__patchStatus);
      return json({ ok: true, data: { contact: { id: u.split("/").pop() } } });
    }
    throw new Error("no network in this test: " + method + " " + u);
  };
  window.fetch = globalThis.fetch;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
afterEach(async () => { if (root) { await act(async () => { root.unmount(); }); root = null; } });
after(() => { for (const t of TEMP) { try { rmSync(t, { force: true }); } catch { /* ignore */ } } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const $$ = (s) => [...document.querySelectorAll(s)];
const txt = () => (document.body.textContent || "").replace(/\s+/g, " ");
const wait = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const settle = async () => { for (let i = 0; i < 8; i += 1) await wait(0); };
const click = async (el) => { assert.ok(el, "control must exist"); await act(async () => { el.click(); }); await settle(); };
const setValue = async (el, value) => {
  assert.ok(el, "field must exist");
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event("input", { bubbles: true })); });
  await settle();
};
let root = null;
async function open({ managed = MANAGED, patchStatus = 0 } = {}) {
  globalThis.__contacts = CONTACTS; globalThis.__managed = managed; globalThis.__patchStatus = patchStatus; globalThis.__toasts = [];
  globalThis.__puts = []; globalThis.__patches = []; globalThis.__fetches = [];
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(M.MemoryRouter, { initialEntries: ["/dashboard/contacts"] },
      React.createElement(M.Routes, null,
        React.createElement(M.Route, { path: "/dashboard/contacts", element: React.createElement(M.Contacts) }),
        React.createElement(M.Route, { path: "/dashboard", element: React.createElement("span", null, "dashboard") }))));
  });
  await settle(); await wait(150);
}
const toBusiness = async () => { await click(tid("scope-business")); await settle(); };
const editRow = async (id) => {
  const row = $$('[data-testid="cx-row"]').find((r) => r.dataset.contact === id);
  assert.ok(row, `row ${id}`);
  await click(row.querySelector('[data-testid="cx-edit"]')); await wait(150); await settle();
};
const saveForm = async () => {
  const btn = document.querySelector('[data-testid="contact-form-footer"] button[type="submit"]') || document.querySelector('button[type="submit"]');
  assert.ok(btn, "submit");
  await act(async () => { btn.click(); }); for (let i = 0; i < 10; i += 1) await wait(5);
};
const openOccasions = async () => { const t = tid("special-occasions-toggle"); if (t.getAttribute("aria-expanded") !== "true") await click(t); };
const dateInputOf = (type) => { const box = document.getElementById(`occasion-${type}`); return box && box.closest("div").parentElement.querySelector('input[type="date"]'); };

test("Business Edit is filled from the stored record (email, delivery names, FULL dates), read through the management route", async () => {
  await open(); await toBusiness(); await editRow("b1");
  assert.ok(globalThis.__fetches.includes("GET /api/corporate-contacts/organizations/org_1/contacts"), "the owner-only management read was made");
  assert.equal(document.querySelector('input[name="email"]').value, "erin@corp.test");
  assert.equal(document.querySelector('input[name="name"]').value, "Erin Employee");
  await openOccasions();
  assert.equal(dateInputOf("birthday").value, "1990-03-09", "the full stored date, not month-day");
  assert.ok($$('input[value="Erin"]').length >= 1 || txt().includes("Erin"), "the confirmed first name is loaded");
});

test("an untouched Business save sends an EMPTY patch: nothing that could overwrite the email, names or occasions", async () => {
  await open(); await toBusiness(); await editRow("b1");
  await saveForm();
  assert.equal(globalThis.__patches.length, 1);
  assert.deepEqual(globalThis.__patches[0], { id: "b1", body: {} });
  assert.match(txt(), /Contact updated\./);
  assert.equal(globalThis.__puts.length, 0, "the personal route is never used for a business contact");
});

test("changing only the email sends only the email", async () => {
  await open(); await toBusiness(); await editRow("b1");
  await setValue(document.querySelector('input[name="email"]'), "erin.new@corp.test");
  await saveForm();
  assert.deepEqual(globalThis.__patches.map((p) => p.body), [{ email: "erin.new@corp.test" }]);
});

test("changing an occasion date sends the occasions with FULL dates (ids kept), and nothing else", async () => {
  await open(); await toBusiness(); await editRow("b1");
  await openOccasions();
  await setValue(dateInputOf("birthday"), "1990-03-10");
  await saveForm();
  assert.deepEqual(globalThis.__patches.map((p) => p.body), [{ occasions: [{ id: "o1", type: "birthday", date: "1990-03-10", autoSend: true }] }]);
});

test("when the stored record cannot be read, NO form is offered (fail closed): a message, a Close button, no write", async () => {
  await open({ managed: 503 }); await toBusiness(); await editRow("b1");
  assert.ok(tid("business-edit-failed"));
  assert.match(txt(), /couldn’t load this contact’s saved details, so it can’t be edited right now\. Nothing was changed\./);
  assert.equal(document.querySelector('input[name="email"]'), null, "no editable field");
  assert.equal(document.querySelector('button[type="submit"]'), null, "no save button");
  await click(tid("business-edit-close"));
  assert.equal(tid("business-edit-failed"), null, "Close closes the editor");
  assert.equal(globalThis.__patches.length, 0);
});

test("a contact missing from the stored records opens no form either, and says so", async () => {
  await open({ managed: [MANAGED[1]] }); await toBusiness(); await editRow("b1");
  assert.ok(tid("business-edit-failed"));
  assert.match(txt(), /no longer in your business contacts\. Nothing was changed\./);
  assert.equal(document.querySelector('button[type="submit"]'), null);
  assert.equal(globalThis.__patches.length, 0);
});

test("Team 5 S1: an untouched save after the form tidies a lower-case name on blur sends nothing", async () => {
  await open({ managed: [{ ...MANAGED[0], name: "erin employee" }, MANAGED[1]] }); await toBusiness(); await editRow("b1");
  const nameEl = document.querySelector('input[name="name"]');
  assert.equal(nameEl.value, "erin employee");
  await act(async () => { nameEl.focus(); nameEl.blur(); nameEl.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true })); }); await settle();
  assert.equal(nameEl.value, "Erin Employee", "the form's own tidy-up");
  await saveForm();
  assert.deepEqual(globalThis.__patches.map((p) => p.body), [{}]);
});

test("Team 5 S2: a deliberate capitalisation fix to the name is sent", async () => {
  await open({ managed: [{ ...MANAGED[0], name: "erin employee" }, MANAGED[1]] }); await toBusiness(); await editRow("b1");
  await setValue(document.querySelector('input[name="name"]'), "Erin Employee");
  await saveForm();
  assert.deepEqual(globalThis.__patches.map((p) => p.body), [{ name: "Erin Employee" }]);
});

test("Team 5 S8: a refused Business save shows the page's error and NO 'Saved ✓' toast; the form stays open", async () => {
  await open({ patchStatus: 500 }); await toBusiness(); await editRow("b1");
  await setValue(document.querySelector('input[name="email"]'), "erin.new@corp.test");
  await saveForm();
  assert.equal(globalThis.__patches.length, 1);
  assert.match(txt(), /That didn’t go through. Please try again./);
  assert.deepEqual(globalThis.__toasts, [], "no success toast beside the error");
  assert.ok(document.querySelector('input[name="email"]'), "the form is still open");
});

test("a successful Business save: the page says 'Contact updated.' and the form adds no toast of its own", async () => {
  await open(); await toBusiness(); await editRow("b1");
  await saveForm();
  assert.match(txt(), /Contact updated./);
  assert.deepEqual(globalThis.__toasts, []);
});

test("401/403 on the management read: a distinct 'no access' message, no form", async () => {
  for (const status of [401, 403]) {
    await open({ managed: status }); await toBusiness(); await editRow("b1");
    assert.ok(tid("business-edit-failed"));
    assert.match(txt(), /You don’t have access to edit this contact./);
    assert.doesNotMatch(txt(), /try again/);
    assert.equal(document.querySelector('button[type="submit"]'), null);
    if (root) { await act(async () => { root.unmount(); }); root = null; }
  }
});

test("the personal Edit is unchanged: no corporate read, the same full PUT body as before", async () => {
  await open();
  const row = $$('[data-testid="cx-row"]').find((r) => r.dataset.contact === "c1");
  await click(row.querySelector('[data-testid="cx-edit"]')); await wait(150); await settle();
  assert.equal(tid("business-edit-loading"), null); assert.equal(tid("business-edit-failed"), null);
  assert.equal(document.querySelector('input[name="email"]').value, "avery@example.test");
  await saveForm();
  assert.equal(globalThis.__patches.length, 0);
  assert.ok(!globalThis.__fetches.some((u) => u.includes("/api/corporate-contacts/")), "no corporate-contacts request");
  assert.equal(globalThis.__puts.length, 1);
  const body = globalThis.__puts[0].body;
  assert.equal(body.email, "avery@example.test");
  assert.equal(body.name, "Avery Fixture");
  assert.deepEqual(body.occasions, [{ id: "o9", type: "birthday", date: "1990-11-14", autoSend: true }]);
  assert.ok("occasionGiftSettings" in body && "relationshipCategory" in body, "the whole form, as before");
  assert.deepEqual(globalThis.__toasts, ["Saved ✓ Recipient settings have been saved."], "the personal 'Saved ✓' toast is unchanged");
});
