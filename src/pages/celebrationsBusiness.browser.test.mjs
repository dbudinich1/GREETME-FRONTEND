// src/pages/celebrationsPaths.browser.test.mjs
//
// Walkthrough revision 2026-10-24 (founder) — Celebrations in both contexts: the REAL page (Contacts.jsx +
// CelebrationsWorkspace) in jsdom under a real router; the personal api and the corporate fetch edge are stubbed
// (no network). Proves: Business uses the approved Personal design with its own data and categories; Personal |
// Business sits inside "Your circle"; no "Next up" line; occasion icons from saved occasions; Import Wizard opens
// the importer for the context; Business actions receive the original roster record.
// Run (Node 20): node --test src/pages/celebrationsBusiness.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__cxb.${PID}.${n}`);
const ENTRY = f("entry.jsx"), BUNDLE = f("bundle.mjs"), API = f("api.js"), AUTH = f("auth.js"), NOTIFY = f("notify.js");
const TEMP = [ENTRY, BUNDLE, API, AUTH, NOTIFY];
let React, createRoot, act, M, window;

const Y = new Date().getFullYear();
// The corporate roster read returns this projection (services/corporateCampaign/audience.js projectContact): no email,
// occasion dates as MONTH-DAY only.
const BIZ = [
  { id: "b1", name: "Erin Employee", corporateContactType: "employee", occasionDates: { birthday: "03-09", graduation: "06-01" }, ready: false, hasEmail: true },
  { id: "b2", name: "Cole Client", corporateContactType: "client", occasionDates: {}, ready: false, hasEmail: true },
  { id: "b3", name: "Vera Vendor", corporateContactType: "vendor", occasionDates: { anniversary: "10-30" }, ready: false, hasEmail: true },
  { id: "b4", name: "Una Unsorted", corporateContactType: null, occasionDates: {}, ready: false, hasEmail: false },
];
const CONTACTS = [
  { id: "c1", name: "Avery Fixture", email: "avery@example.test", relationshipCategory: "friend", relationship: "close_friend", relationshipCloseness: "greetme_worthy",
    occasions: [{ id: "o1", type: "birthday", date: "1990-11-14", autoSend: true }, { id: "o2", type: "christmas", date: `${Y}-12-25`, autoSend: true }],
    occasionGiftSettings: { birthday: { type: "qrcash", amount: 25, autoGift: false }, christmas: { type: "merch", autoGift: false } }, memoryPhotos: [],
    shippingAddress: { line1: "1 Main St", city: "Town", state: "NJ", zip: "07000", country: "United States" } },
  { id: "c2", name: "Blake Other", email: "blake@example.test", relationshipCategory: "family", relationship: "sibling", relationshipCloseness: "inner_circle",
    occasions: [{ id: "o3", type: "anniversary", date: "2015-06-20", autoSend: false }, { type: "graduation", date: "2020-05-01", autoSend: false }],
    occasionGiftSettings: { anniversary: { type: "none", autoGift: false } }, memoryPhotos: [] },
  { id: "c3", name: "Casey Third", email: "casey@example.test", relationshipCategory: "professional", relationship: "colleague", occasions: [], occasionGiftSettings: {}, memoryPhotos: [] },
];

before(async () => {
  writeFileSync(API, `
    export const __calls = [];
    const impl = {
      getContacts: async () => { __calls.push("getContacts"); return { ok: true, data: JSON.parse(JSON.stringify(globalThis.__contacts)) }; },
      getUpcomingOccasions: async (days) => { __calls.push("upcoming:" + days); return { ok: true, data: globalThis.__upcoming || [] }; },
      getSentGreetings: async () => { __calls.push("sent"); return { ok: true, greetings: globalThis.__sent || [] }; },
      updateContact: async (id, body) => { __calls.push("updateContact:" + id); (globalThis.__puts = globalThis.__puts || []).push({ id, body: JSON.parse(JSON.stringify(body)) }); return { ok: true, data: { id, ...body } }; } };
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
  // The corporate edge only (memberships, the org roster, its campaigns). Anything else has no network.
  globalThis.fetch = async (url) => {
    const u = String(url);
    (globalThis.__fetches = globalThis.__fetches || []).push(u);
    const json = (body) => ({ ok: true, status: 200, json: async () => body });
    if (u.endsWith("/api/corporate-campaigns/memberships")) return json(globalThis.__memberships || { memberships: [] });
    if (u.endsWith("/api/corporate-campaigns/organizations/org_1/contacts")) return json({ contacts: BIZ, count: BIZ.length });
    if (u.endsWith("/api/corporate-campaigns/organizations/org_1/campaigns")) return json({ campaigns: [] });
    throw new Error("no network in this test: " + u);
  };
  window.fetch = globalThis.fetch;
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
  globalThis.__contacts = CONTACTS; globalThis.__scrolledTo = null; globalThis.__puts = [];
  M.__calls.length = 0;
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  if (root) { await act(async () => { root.unmount(); }); root = null; }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const Probe = () => React.createElement("span", { "data-testid": "loc" }, M.useLocation().search || "(none)");
  const ImportProbe = () => React.createElement("span", { "data-testid": "import-wizard" }, M.useLocation().search || "(none)");
  root = createRoot(host);
  await act(async () => {
    const [pathname, search = ""] = url.split("?");
    root.render(React.createElement(M.MemoryRouter, { initialEntries: [state ? { pathname, search: search ? `?${search}` : "", state } : url] },
      React.createElement(M.Routes, null,
        React.createElement(M.Route, { path: "/dashboard/contacts", element: React.createElement(React.Fragment, null, React.createElement(M.Contacts), React.createElement(Probe)) }),
        React.createElement(M.Route, { path: "/dashboard", element: React.createElement("span", { "data-testid": "dashboard-home" }, "dashboard") }),
        React.createElement(M.Route, { path: "/dashboard/gifts", element: React.createElement("span", { "data-testid": "gift-place" }, "gift place") }),
        React.createElement(M.Route, { path: "/dashboard/import-wizard", element: React.createElement(ImportProbe) }))));
  });
  for (let i = 0; i < 6; i += 1) await wait(0);
  await wait(150); // the form's focus timer
}
const formOpen = () => /Edit Recipient/.test(txt()) && Boolean(document.querySelector('input[name="name"]'));
const click = async (el) => { assert.ok(el, "control must exist"); await act(async () => { el.click(); }); await wait(0); await wait(0); };
const $$ = (s) => [...document.querySelectorAll(s)];
const setValue = async (el, value) => {
  assert.ok(el, "field must exist");
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event("input", { bubbles: true })); });
  await wait(0);
};
const names = () => $$('[data-testid="cx-row"] .pname').map((e) => e.textContent);
const rosterRow = (id) => $$('[data-testid="cx-roster-row"]').find((r) => r.dataset.contact === id);
const MEMBER = { memberships: [{ corporateOrganizationId: "org_1", status: "active", role: "owner" }] };
const seg = () => $$('[data-testid="cx-segments"] button').map((b) => b.firstChild.textContent);
const rowNames = () => $$('[data-testid="cx-row"] .pname').map((e) => e.textContent);
const toBusiness = async () => { await click(tid("scope-business")); for (let i = 0; i < 6; i += 1) await wait(0); };

test("Personal: no 'Next up' line; Personal | Business sits inside 'Your circle', followed by the categories; occasion icons follow saved occasions", async () => {
  globalThis.__memberships = MEMBER;
  await open("/dashboard/contacts");
  assert.equal(tid("cx-nextup"), null); assert.equal(/Next up/.test(txt()), false);
  const circle = tid("cx-circle");
  assert.ok(circle.contains(tid("scope-toggle")) && circle.contains(tid("cx-segments")), "both inside Your circle");
  assert.ok(tid("scope-toggle").compareDocumentPosition(tid("cx-segments")) & window.Node.DOCUMENT_POSITION_FOLLOWING, "toggle first, then the categories");
  assert.ok(tid("cx-path").compareDocumentPosition(circle) & window.Node.DOCUMENT_POSITION_FOLLOWING, "no longer beside People | Occasions");
  assert.deepEqual(seg(), ["All", "Friends", "Family", "Professional"]);
  const icons = Object.fromEntries($$('[data-testid="cx-row"]').map((r) => [r.dataset.contact, (r.querySelector('[data-testid="cx-occ-icons"]') || { dataset: { types: "" } }).dataset.types]));
  assert.deepEqual(icons, { c1: "birthday christmas", c2: "anniversary graduation", c3: "" }, "the person's own saved occasions, nothing else");
  assert.match(tid("cx-occ-icons").getAttribute("aria-label"), /^Occasions: Birthday, Christmas$/);
  // Import Wizard (top right) opens the personal importer: the legacy CSV modal while VITE_IMPORT_WIZARD_ENTRY is unset.
  assert.ok(tid("cx-manager-actions").contains(tid("cx-import")));
  await click(tid("cx-import"));
  assert.match(txt(), /Import Recipients from CSV/);
});

test("Business uses the same Celebrations design: same sections and controls, its own roster and categories, nothing from the old layout", async () => {
  globalThis.__memberships = MEMBER;
  await open("/dashboard/contacts");
  const personalIds = $$("[data-testid]").map((e) => e.dataset.testid).filter((t) => /^cx-(manager|path|circle|segments|schedule|when|giftstrip|moment|head|manager-actions|import)$/.test(t));
  await toBusiness();
  assert.equal(tid("cx-root").dataset.context, "business");
  const businessIds = $$("[data-testid]").map((e) => e.dataset.testid).filter((t) => /^cx-(manager|path|circle|segments|schedule|when|giftstrip|moment|head|manager-actions|import)$/.test(t));
  assert.deepEqual(businessIds, personalIds, "the page design does not change");
  assert.equal(/My People|Automate personalized Greet-Me greetings|Import Contacts|Ready to Automate/.test(txt()), false, "the old Business layout is gone");
  assert.deepEqual(seg(), ["All", "Employees", "Clients", "Vendors"]);
  assert.deepEqual($$('[data-testid="cx-segments"] .n').map((e) => e.textContent), ["4", "1", "1", "1"], "counts from the roster's own types");
  assert.deepEqual(rowNames(), ["Erin Employee", "Cole Client", "Vera Vendor", "Una Unsorted"]);
  await click(tid("cx-seg-employee")); assert.deepEqual(rowNames(), ["Erin Employee"]);
  await click(tid("cx-seg-vendor")); assert.deepEqual(rowNames(), ["Vera Vendor"]);
  await click(tid("cx-seg-all")); assert.equal(rowNames().length, 4, "an uncategorised contact appears under All only");
  // Icons from the roster's saved occasion types (month-day dates).
  const erin = $$('[data-testid="cx-row"]').find((r) => r.dataset.contact === "b1");
  assert.equal(erin.querySelector('[data-testid="cx-occ-icons"]').dataset.types, "birthday graduation");
  // Personal data never shows in Business, and back again.
  assert.equal(/Avery Fixture/.test(txt()), false);
  await click(tid("scope-personal")); await wait(0);
  assert.deepEqual(seg(), ["All", "Friends", "Family", "Professional"]);
  assert.equal(/Erin Employee/.test(txt()), false);
});

test("Business schedule: yearly month-day dates are listed with 'Date saved' only; one-time dates without a year are not scheduled; no Dates & gifts; Past makes no claim", async () => {
  globalThis.__memberships = MEMBER;
  await open("/dashboard/contacts");
  await toBusiness();
  const rows = $$('[data-testid="cx-sched-row"]').map((r) => `${r.dataset.contact}:${r.querySelector(".pname").textContent}:${r.dataset.status}`);
  assert.deepEqual(rows.sort(), ["b1:Birthday:saved", "b3:Anniversary:saved"]);
  assert.equal(/Auto-send on|Not scheduled|Gift not chosen/.test(tid("cx-schedule").textContent), false, "no invented status or gift");
  await click(tid("cx-when-past"));
  assert.match(tid("cx-schedule").textContent, /Past business sends aren’t listed here\./);
  await click(tid("cx-path-occasions"));
  assert.equal(tid("cx-bulk"), null, "Dates & gifts is a personal-recipient resolver");
  assert.deepEqual($$('[data-testid="cx-roster-open"]').map((b) => b.textContent), ["Edit", "Edit", "Edit", "Edit"]);
});

test("Business actions get the ORIGINAL roster record (never the display mapping), and Import Wizard opens the business importer", async () => {
  globalThis.__memberships = MEMBER;
  await open("/dashboard/contacts");
  await toBusiness();
  await click(tid("cx-import"));
  assert.equal(tid("import-wizard").textContent, "?mode=corporate");
  await open("/dashboard/contacts");
  await toBusiness();
  const erin = $$('[data-testid="cx-row"]').find((r) => r.dataset.contact === "b1");
  await click(erin.querySelector('[data-testid="cx-edit"]')); await wait(150);
  assert.ok(formOpen(), "the same editor the Business view opened before");
  assert.equal(document.querySelector('input[name="name"]').value, "Erin Employee");
  assert.equal($$("input").some((i) => String(i.value).startsWith("2000-")), false, "no display-only placeholder year reaches the editor");
});

test("a viewer without a business membership sees no Personal | Business control", async () => {
  globalThis.__memberships = { memberships: [] };
  await open("/dashboard/contacts");
  assert.equal(tid("scope-toggle"), null);
  assert.deepEqual(seg(), ["All", "Friends", "Family", "Professional"]);
});

test("the filter band and the schedule toggle: fixed band; phones read Upcoming | Past and get a person-plus Add Recipient", async () => {
  const { CELEBRATIONS_CSS } = await import(pathToFileURL(join(__dirname, "../components/celebrations/celebrationsStyles.js")).href);
  assert.match(CELEBRATIONS_CSS, /\.cx \.circle \{ min-height:44px; flex-wrap:nowrap; \}/);
  assert.match(CELEBRATIONS_CSS, /@media \(max-width: 760px\) \{[\s\S]*\.cx \.lbl-long \{ display:none; \}/);
  assert.match(CELEBRATIONS_CSS, /\.cx \.addrec \.addrec-t, \.cx \.addrec \.addrec-plus \{ display:none; \}\s*\.cx \.addrec \.addrec-icon \{ display:inline; \}/);
  globalThis.__memberships = MEMBER;
  await open("/dashboard/contacts");
  assert.deepEqual($$('[data-testid="cx-when"] [role=tab]').map((b) => b.querySelector(".lbl-long").textContent), [" Occasions", " Occasions"]);
});
