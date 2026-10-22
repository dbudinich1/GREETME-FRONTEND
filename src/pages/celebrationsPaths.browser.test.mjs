// src/pages/celebrationsPaths.browser.test.mjs
//
// Report 135 — Celebrations (the renamed Recipients page): the REAL page (Contacts.jsx + CelebrationsWorkspace) and the
// REAL Occasion Scheduler (ContactForm) mounted in jsdom under a real router; only the api edge is stubbed and every PUT
// body is recorded. Proves: the Individuals / Friends / Family / Professional filter; both entry paths (a person, an
// occasion) open the SAME recipient's existing schedule and save that one full record with the other occasions,
// gifts and details preserved; shared vs per-recipient dates; Upcoming / Past truthfulness; the Occasions path's
// several-people hand-off to the dashboard's own Dates & gifts resolver.
// Run (Node 20): node --test src/pages/celebrationsPaths.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__cxp.${PID}.${n}`);
const ENTRY = f("entry.jsx"), BUNDLE = f("bundle.mjs"), API = f("api.js"), AUTH = f("auth.js"), NOTIFY = f("notify.js");
const TEMP = [ENTRY, BUNDLE, API, AUTH, NOTIFY];
let React, createRoot, act, M, window;

const Y = new Date().getFullYear();
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
  globalThis.__contacts = CONTACTS; globalThis.__scrolledTo = null; globalThis.__puts = [];
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
        React.createElement(M.Route, { path: "/dashboard", element: React.createElement("span", { "data-testid": "dashboard-home" }, "dashboard") }),
        React.createElement(M.Route, { path: "/dashboard/gifts", element: React.createElement("span", { "data-testid": "gift-place" }, "gift place") }))));
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
const saveForm = async () => {
  const save = document.querySelector('[data-testid="contact-form-footer"] button[type="submit"]');
  assert.ok(save, "the scheduler's own Save");
  await act(async () => { save.click(); });
  for (let i = 0; i < 10; i += 1) await wait(20);
};
const cancelForm = async () => { const c = [...document.querySelectorAll('[data-testid="contact-form-footer"] button')].find((b) => /Cancel/.test(b.textContent)); await act(async () => { c.click(); }); await wait(30); };
const nextNov14 = () => { const t = new Date(); t.setHours(0, 0, 0, 0); let d = new Date(t.getFullYear(), 10, 14); if (d < t) d = new Date(t.getFullYear() + 1, 10, 14); return `${d.getFullYear()}-11-14`; };

test("Recipients path: Individuals / Friends / Family / Professional sit below the Recipients | Occasions toggle and above the search, and filter by relationshipCategory", async () => {
  await open("/dashboard/contacts");
  assert.deepEqual($$('[data-testid="cx-path"] [role=tab]').map((b) => b.textContent), ["Recipients", "Occasions"]);
  assert.deepEqual($$('[data-testid="cx-when"] [role=tab]').map((b) => b.textContent), ["Upcoming Occasions", "Past Occasions"]);
  const seg = tid("cx-segments"), search = document.querySelector('[data-testid="cx-recipients"] input');
  assert.ok(tid("cx-path").compareDocumentPosition(seg) & window.Node.DOCUMENT_POSITION_FOLLOWING, "below the primary toggle");
  assert.ok(seg.compareDocumentPosition(search) & window.Node.DOCUMENT_POSITION_FOLLOWING, "above the search");
  assert.deepEqual($$('[data-testid="cx-segments"] button').map((b) => b.firstChild.textContent), ["Individuals", "Friends", "Family", "Professional"]);
  assert.deepEqual(names(), ["Avery Fixture", "Blake Other", "Casey Third"], "Individuals: everyone");
  await click(tid("cx-seg-friend")); assert.deepEqual(names(), ["Avery Fixture"]);
  await click(tid("cx-seg-family")); assert.deepEqual(names(), ["Blake Other"]);
  await click(tid("cx-seg-professional")); assert.deepEqual(names(), ["Casey Third"]);
  await click(tid("cx-seg-individuals")); assert.equal(names().length, 3);
  for (const b of ["Import Wizard", "Add Recipient"]) assert.ok($$('[data-testid="cx-manager"] .vtop button').some((x) => x.textContent.includes(b)), `the Manager's viewport keeps ${b}`);
});

test("person path: selecting a person opens THEIR Occasion Scheduler; saving sends that full record with every other occasion, gift and the address kept", async () => {
  await open("/dashboard/contacts");
  await click($$('[data-testid="cx-person"]')[0]);
  await wait(100);
  assert.ok(formOpen());
  assert.equal(document.querySelector('input[name="name"]').value, "Avery Fixture");
  await saveForm();
  assert.equal(globalThis.__puts.length, 1);
  const { id, body } = globalThis.__puts[0];
  assert.equal(id, "c1");
  assert.deepEqual(body.occasions.map((o) => [o.type, o.date]), [["birthday", "1990-11-14"], ["christmas", `${Y}-12-25`]], "both occasions kept");
  assert.equal(body.occasionGiftSettings.birthday.type, "qrcash");
  assert.equal(body.occasionGiftSettings.christmas.type, "merch");
  assert.equal(body.shippingAddress.line1, "1 Main St");
});

test("occasion path: the same person's same record opens at that occasion and saves the identical body as the person path", async () => {
  await open("/dashboard/contacts");
  await click($$('[data-testid="cx-person"]')[0]); await wait(100); await saveForm();
  const viaPerson = globalThis.__puts[0].body;
  await open("/dashboard/contacts");
  await click(tid("cx-path-occasions"));
  await click(tid("cx-occ-christmas"));
  const row = rosterRow("c1");
  assert.equal(row.dataset.held, "true"); assert.equal(row.dataset.source, "saved");
  await click(row.querySelector('[data-testid="cx-roster-open"]'));
  await wait(120);
  assert.ok(formOpen());
  assert.equal(document.activeElement, document.querySelector('[data-occasion="christmas"]'), "opened at Christmas");
  await saveForm();
  assert.equal(globalThis.__puts.length, 1);
  assert.equal(globalThis.__puts[0].id, "c1");
  assert.deepEqual(globalThis.__puts[0].body, viaPerson, "both paths read and write the same schedule");
});

test("a person's occasion chip opens their scheduler at that occasion", async () => {
  await open("/dashboard/contacts");
  const avery = $$('[data-testid="cx-row"]').find((r) => r.dataset.contact === "c1");
  const chip = [...avery.querySelectorAll('[data-testid="cx-chip"]')].find((c) => /Christmas/.test(c.textContent));
  await click(chip); await wait(120);
  assert.ok(formOpen());
  assert.equal(document.activeElement, document.querySelector('[data-occasion="christmas"]'));
});

test("occasion path for someone without the occasion: it is added in their scheduler with the shared calendar date, and their other occasions are kept", async () => {
  await open("/dashboard/contacts");
  await click(tid("cx-path-occasions"));
  await click(tid("cx-occ-christmas"));
  assert.equal(tid("cx-roster").dataset.kind, "shared");
  const row = rosterRow("c2");
  assert.equal(row.dataset.held, "false"); assert.equal(row.dataset.source, "shared", "prefilled with the calendar date");
  assert.match(row.textContent, /Dec 25/);
  await click(row.querySelector('[data-testid="cx-roster-open"]'));
  await wait(120);
  assert.ok(formOpen());
  await saveForm();
  const put = globalThis.__puts.find((p) => p.id === "c2");
  assert.ok(put, "saved Blake's record");
  assert.deepEqual(put.body.occasions.map((o) => o.type).sort(), ["anniversary", "christmas", "graduation"], "added, others kept");
  assert.equal(put.body.occasions.find((o) => o.type === "christmas").date, `${Y}-12-25`);
  assert.equal(put.body.occasions.find((o) => o.type === "anniversary").date, "2015-06-20");
  assert.deepEqual(put.body.occasionGiftSettings.anniversary, { type: "none", autoGift: false });
});

test("closing without saving adds nothing (the occasion is only added inside the open form)", async () => {
  await open("/dashboard/contacts");
  await click(tid("cx-path-occasions"));
  await click(tid("cx-occ-christmas"));
  await click(rosterRow("c2").querySelector('[data-testid="cx-roster-open"]'));
  await wait(100);
  await cancelForm();
  assert.equal(globalThis.__puts.length, 0);
  assert.equal(rosterRow("c2").dataset.held, "false");
});

test("per-recipient occasions: birthday dates belong to each person; a missing one is shown as needed, never invented", async () => {
  await open("/dashboard/contacts");
  await click(tid("cx-path-occasions"));
  await click(tid("cx-occ-birthday"));
  assert.equal(tid("cx-roster").dataset.kind, "personal");
  assert.equal(rosterRow("c1").dataset.source, "saved");
  for (const id of ["c2", "c3"]) { assert.equal(rosterRow(id).dataset.source, "missing"); assert.match(rosterRow(id).textContent, /Date needed/); }
});

test("Occasions path, several people: Set dates & gifts opens the dashboard's own Dates & gifts with exactly those people and that occasion", async () => {
  await open("/dashboard/contacts");
  await click(tid("cx-path-occasions"));
  await click(tid("cx-occ-christmas"));
  assert.equal(tid("cx-bulk-go").disabled, true);
  for (const id of ["c1", "c2"]) await click(rosterRow(id).querySelector("input[type=checkbox]"));
  await click(tid("cx-bulk-go"));
  await wait(20);
  assert.ok(tid("dashboard-home"), "on the dashboard");
  const kept = JSON.parse(window.sessionStorage.getItem("gm_dashboard_launcher_v1"));
  assert.equal(kept.userId, "u1");
  assert.equal(kept.mode, "occasion"); assert.deepEqual(kept.occasions, ["Christmas"]); assert.deepEqual(kept.picks, ["c1", "c2"]);
  assert.equal(kept.datesOpen, true); assert.equal(kept.whoDone, true);
  assert.equal(globalThis.__puts.length, 0, "nothing saved here");
});

test("Upcoming and Past are truthful: the scheduler's real status where reported; Past lists only real sends matched by email; a passed one-time occasion reads 'No send recorded'", async () => {
  globalThis.__upcoming = [{ contactId: "c1", occasionType: "birthday", date: nextNov14(), scheduleStatus: "queued" }];
  globalThis.__sent = [
    { id: "s1", recipientName: "Avery Fixture", recipientEmail: "AVERY@example.test", occasionType: "birthday", status: "completed", createdAt: "2026-01-02T10:00:00Z", completedAt: "2026-01-02T11:00:00Z" },
    { id: "s2", recipientName: "Someone Else", recipientEmail: "x@example.test", occasionType: "christmas", status: "failed", createdAt: "2026-01-03T10:00:00Z" },
  ];
  try {
    await open("/dashboard/contacts");
    const avery = $$('[data-testid="cx-row"]').find((r) => r.dataset.contact === "c1");
    const bday = [...avery.querySelectorAll('[data-testid="cx-chip"]')].find((c) => /Birthday/.test(c.textContent));
    assert.equal(bday.dataset.status, "queued"); assert.match(bday.textContent, /Creating/);
    const xmas = [...avery.querySelectorAll('[data-testid="cx-chip"]')].find((c) => /Christmas/.test(c.textContent));
    assert.equal(xmas.dataset.status, "auto", "no schedule record yet: the saved auto-send setting, not a status");
    const blake = $$('[data-testid="cx-row"]').find((r) => r.dataset.contact === "c2");
    const chips = [...blake.querySelectorAll('[data-testid="cx-chip"]')];
    assert.equal(chips.length, 1, "the passed one-time graduation is not upcoming");
    assert.equal(chips[0].dataset.status, "open", "anniversary with auto-send off: not scheduled");
    assert.doesNotMatch($$('[data-testid="cx-row"]').map((r) => r.textContent).join(" "), /\bSent\b/, "nothing upcoming is called sent");
    // The Celebration Schedule card: upcoming rows carry the same truthful statuses; Past lists only real sends.
    const up = $$('[data-testid="cx-sched-row"]');
    assert.equal(up.find((r) => r.dataset.contact === "c1" && /Birthday/.test(r.textContent)).dataset.status, "queued");
    assert.doesNotMatch(up.map((r) => r.textContent).join(" "), /Sent/, "nothing upcoming is called sent");
    await click(tid("cx-when-past"));
    const past = $$('[data-testid="cx-past-row"]');
    assert.deepEqual(past.filter((r) => r.dataset.contact === "c1").map((r) => r.dataset.status), ["completed"], "only Avery's own send is Avery's (matched by email)");
    assert.ok(past.some((r) => r.dataset.contact === "" && /Someone Else/.test(r.textContent) && r.dataset.status === "failed"), "an unmatched send is listed under its own name, never attributed");
    assert.ok(past.some((r) => r.dataset.contact === "c2" && /No send recorded/.test(r.textContent)), "Blake's passed graduation: No send recorded");
    assert.equal(past.filter((r) => r.dataset.contact === "c3").length, 0, "Casey: nothing invented");
    await setValue(tid("cx-schedule-search"), "christmas");
    assert.deepEqual($$('[data-testid="cx-past-row"]').map((r) => r.dataset.status), ["failed"], "the schedule's own search");
  } finally { globalThis.__upcoming = []; globalThis.__sent = []; }
});

test("Team 5 L1: a shared date added from the Occasions path is its NEXT occurrence (Mother's Day after this year's has passed)", async () => {
  const secondSundayOfMay = (y) => { const d = new Date(y, 4, 1); const first = (7 - d.getDay()) % 7 + 1; return `${y}-05-${String(first + 7).padStart(2, "0")}`; };
  const t = new Date(); const today = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
  const expected = secondSundayOfMay(t.getFullYear()) >= today ? secondSundayOfMay(t.getFullYear()) : secondSundayOfMay(t.getFullYear() + 1);
  await open("/dashboard/contacts");
  await click(tid("cx-path-occasions"));
  await click(tid("cx-occ-mothers_day"));
  assert.match(rosterRow("c2").textContent, new RegExp(new Date(`${expected}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" })));
  await click(rosterRow("c2").querySelector('[data-testid="cx-roster-open"]'));
  await wait(120);
  await saveForm();
  const put = globalThis.__puts.find((p) => p.id === "c2");
  assert.equal(put.body.occasions.find((o) => o.type === "mothers_day").date, expected);
  assert.deepEqual(put.body.occasions.map((o) => o.type).sort(), ["anniversary", "graduation", "mothers_day"]);
});

test("Report 135 layout: Celebration Manager and Celebration Schedule are separate, both always mounted; switching or searching in one leaves the other's tab, search and content untouched", async () => {
  await open("/dashboard/contacts");
  assert.ok(tid("cx-manager") && tid("cx-schedule"), "two cards");
  assert.match(tid("cx-manager").textContent, /Celebration Manager/); assert.match(tid("cx-schedule").textContent, /Celebration Schedule/);
  assert.ok(tid("cx-manager").compareDocumentPosition(tid("cx-schedule")) & window.Node.DOCUMENT_POSITION_FOLLOWING, "Manager above Schedule");
  const schedBody = tid("cx-schedule-body");
  await click(tid("cx-when-past"));
  await setValue(tid("cx-schedule-search"), "blake");
  const schedHtml = schedBody.innerHTML;
  const rowsNode = tid("cx-rows");
  // the Manager: change path, filter, search, occasion
  await click(tid("cx-seg-family"));
  await setValue(tid("cx-manager-search"), "bl");
  await click(tid("cx-path-occasions"));
  await click(tid("cx-occ-christmas"));
  await setValue(tid("cx-occasion-search"), "chr");
  await click(tid("cx-path-recipients"));
  assert.equal(tid("cx-schedule-body"), schedBody, "the Schedule's viewport was never replaced");
  assert.equal(schedBody.innerHTML, schedHtml, "and its content is unchanged");
  assert.equal(tid("cx-when-past").getAttribute("aria-selected"), "true");
  assert.equal(tid("cx-schedule-search").value, "blake");
  // the Manager kept its own state across its own switch too (both views stay mounted)
  assert.equal(tid("cx-rows"), rowsNode, "the recipients list was not remounted");
  assert.equal(tid("cx-seg-family").getAttribute("aria-selected"), "true");
  assert.equal(tid("cx-manager-search").value, "bl");
  assert.equal(tid("cx-occasion-search").value, "chr");
  // and the Schedule's switch leaves the Manager untouched
  const mgrHtml = tid("cx-manager-body").innerHTML;
  await click(tid("cx-when-upcoming")); await setValue(tid("cx-schedule-search"), "");
  assert.equal(tid("cx-manager-body").innerHTML, mgrHtml);
});

test("founder render (Report 135): My Celebrations; centred Section 1 / Section 2 headings; one gold Add a gift in the Gift Place strip and the Complete-the-moment link, both to the Gift Place; the dashboard can open an occasion here", async () => {
  await open("/dashboard/contacts");
  assert.match(tid("cx-head").textContent, /My Celebrations/);
  assert.equal(document.body.textContent.includes("My People"), false);
  assert.equal(tid("cx-nav"), null, "no separate Start from band");
  for (const [id, eb, t] of [["cx-manager", "Section 1", "Celebration Manager"], ["cx-schedule", "Section 2", "Celebration Schedule"]]) {
    const h = tid(id).querySelector(".sechead");
    assert.ok(h, `${id} heading`); assert.match(h.textContent, new RegExp(`${eb}\s*${t}`));
  }
  const strip = tid("cx-giftstrip");
  assert.ok(tid("cx-manager").compareDocumentPosition(strip) & window.Node.DOCUMENT_POSITION_FOLLOWING && strip.compareDocumentPosition(tid("cx-schedule")) & window.Node.DOCUMENT_POSITION_FOLLOWING, "the strip sits between the sections");
  assert.equal(strip.querySelectorAll(".btn").length, 1, "one button");
  assert.match(strip.textContent, /Add a gift/); assert.doesNotMatch(strip.textContent, /Add QR Cash/);
  await click(tid("cx-add-gift")); await wait(20);
  assert.ok(tid("gift-place"), "Add a gift opens the Gift Place");
  await open("/dashboard/contacts");
  await click(tid("cx-moment-add-gift")); await wait(20);
  assert.ok(tid("gift-place"), "Complete the moment opens the Gift Place");
  await open("/dashboard/contacts", { state: { celebrations: { path: "occasions", occasion: "christmas" } } });
  assert.equal(tid("cx-path-occasions").getAttribute("aria-selected"), "true");
  assert.equal(tid("cx-occ-christmas").getAttribute("aria-selected"), "true");
});
