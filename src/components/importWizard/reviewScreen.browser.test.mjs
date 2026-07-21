// src/components/importWizard/reviewScreen.browser.test.mjs
//
// BROWSER-LEVEL interaction tests for the Individual two-screen flow. The real .jsx wizard is
// esbuild-transformed and mounted with react-dom/client into jsdom. Side-effect modules are stubbed
// with FUNCTIONAL stubs driven by globals: a tiny CSV parser (papaparse), a configurable api
// (getContacts/importContacts via globalThis.__getContacts / __importContacts), a nav recorder
// (useNavigate → globalThis.__nav), and a toast recorder (showManualToast → globalThis.__toasts).
// A fake JWT is placed in localStorage so the sample workspace has a real session discriminator
// (enables reload-restore). jsdom has no CSS layout; DOM structure, wiring, navigation, and
// persistence ARE covered.
//
// ENFORCEABLE: jsdom + esbuild are devDependencies; imports are unconditional (a missing dep fails).
// Run: node --test src/components/importWizard/reviewScreen.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__reviewscreen.bundle.mjs");
let React, createRoot, Wizard, act;

const PAPA_STUB = `export const parse = (file, opts) => { Promise.resolve(file && file.text ? file.text() : "").then((t) => {
  const lines = String(t).trim().split(/\\r?\\n/).filter(Boolean);
  const fields = (lines[0] || "").split(",").map((s) => s.trim());
  const data = lines.slice(1).map((l) => { const cells = l.split(","); const o = {}; fields.forEach((f, i) => { o[f] = (cells[i] || "").trim(); }); return o; });
  opts && opts.complete && opts.complete({ data, meta: { fields } });
}); }; export default { parse };`;
const API_STUB = `export default {
  async getContacts(){ return (globalThis.__getContacts ? globalThis.__getContacts() : { data: [] }); },
  async importContacts(c){ globalThis.__lastImport = c; return (globalThis.__importContacts ? globalThis.__importContacts(c) : { data: { imported: c.length, failed: 0, errors: [] } }); },
};`;
const ROUTER_STUB = `export const useNavigate = () => ((p) => { globalThis.__nav = p; });`;
const NOTIFY_STUB = `export const showManualToast = (...a) => { (globalThis.__toasts || (globalThis.__toasts = [])).push(a); };`;
const COMMS_STUB = `export const COMMS_CATEGORIES = { PROFILE: "profile" };`;
const CORP_STUB = `export const createCorporateCampaignsClient = () => ({ listMemberships: async () => ({ ok: false }) });`;

before(async () => {
  const stub = {
    name: "stub",
    setup(b) {
      b.onResolve({ filter: /(^react-router-dom$|^papaparse$|\/api\/api$|corporateCampaigns\.js$|utils\/notify$|utils\/commsCatalog$)/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => {
        const p = a.path;
        const contents = /papaparse/.test(p) ? PAPA_STUB
          : /react-router-dom/.test(p) ? ROUTER_STUB
          : /notify/.test(p) ? NOTIFY_STUB
          : /commsCatalog/.test(p) ? COMMS_STUB
          : /corporateCampaigns/.test(p) ? CORP_STUB
          : API_STUB;
        return { contents, loader: "js" };
      });
    },
  };
  writeFileSync(join(__dirname, ".__entry.jsx"), `export { default as Wizard } from "./ContactImportWizard.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__entry.jsx")],
    outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stub], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__entry.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.localStorage = window.localStorage; globalThis.sessionStorage = window.sessionStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // Node's global File/Blob implement .text()/.arrayBuffer() (jsdom's do not) — keep them.
  const payload = window.btoa(JSON.stringify({ sub: "u1", iat: 1000 }));   // fake JWT → real session discriminator
  window.localStorage.setItem("token", `h.${payload}.s`);

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Wizard } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(join(__dirname, ".__entry.jsx"), { force: true }); } catch { /* ignore */ } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const txt = () => document.body.textContent;
const btnByText = (re) => [...document.querySelectorAll("button")].find((b) => re.test(b.textContent));
const fireClick = (el) => el.dispatchEvent(new window.Event("click", { bubbles: true }));
function fireChange(el, value) {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function uploadCsv(csv) {
  const input = document.querySelector('input[type="file"]');
  const file = new File([csv], "contacts.csv", { type: "text/csv" });   // Node global File (has text/arrayBuffer)
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new window.Event("change", { bubbles: true })); });
  await flush(); await flush();
}
async function mountWizard() {
  delete globalThis.__nav; delete globalThis.__toasts; delete globalThis.__importContacts; delete globalThis.__getContacts; delete globalThis.__lastImport;
  try { window.sessionStorage.clear(); } catch { /* ignore */ }
  document.body.innerHTML = "";
  const container = document.createElement("div"); document.body.appendChild(container);
  await act(async () => { createRoot(container).render(React.createElement(Wizard)); });
}
// Personal path is now two entry screens: Screen 1 (Personal) → Screen 2 (choose a group) → upload.
const goIndividual = async (group = "family") => {
  await act(async () => fireClick(tid("panel-personal")));   // Screen 1 → Screen 2
  await act(async () => fireClick(tid(`panel-${group}`)));    // Screen 2 → Individual upload (group context)
};
// Business path mirrors Personal: Screen 1 (Business) → Screen 2 (Employees/Clients/Vendors) → upload.
const goBusiness = async (kind = "employee") => {
  await act(async () => fireClick(tid("panel-business")));    // Screen 1 → Business Screen 2
  await act(async () => fireClick(tid(`panel-${kind}`)));     // Screen 2 → Business upload options
  await flush();
};
const CSV2 = "Name,Email\nAda,ada@x.co\nBo,bo@x.co";

// ---------- SAMPLE (individual) ----------
test("Individual → Try sample → combined preview (no separate list, no Finish/View CTA)", async () => {
  await mountWizard(); await goIndividual();
  await act(async () => fireClick(tid("start-testdrive")));
  assert.ok(tid("confirm-screen"), "sample opens directly on the combined preview");
  assert.match(txt(), /Preview your practice contacts/);
  assert.match(txt(), /Safe practice mode — Nothing will be saved or sent/);
  assert.ok(tid("sample-upload-own") && tid("sample-download") && tid("sample-delete") && tid("sample-exit"));
  assert.equal(tid("add-cta"), null, "individual sample has no commit/View CTA");
  assert.ok(!/View \d+ sample recipient/.test(txt()), "no 'View X sample recipients' for individual");
  assert.ok(!/Finish sample/.test(txt()));
});

test("sample: open optional relationship editor, change a value, return", async () => {
  await mountWizard(); await goIndividual();
  await act(async () => fireClick(tid("start-testdrive")));
  await act(async () => fireClick(tid("details-cta")));
  assert.ok(tid("details-screen"));
  await act(async () => fireChange(tid("group-select"), "friend"));
  const opts = [...tid("relation-select").options].map((o) => o.value);
  assert.ok(opts.includes("close_friend") && !opts.includes("sibling"));
  await act(async () => fireClick(tid("details-done")));
  assert.ok(tid("confirm-screen"));
});

test("sample persists for a same-session reload (remount restores the preview)", async () => {
  await mountWizard(); await goIndividual();
  await act(async () => fireClick(tid("start-testdrive")));
  await flush();
  document.body.innerHTML = "";
  const c2 = document.createElement("div"); document.body.appendChild(c2);
  await act(async () => { createRoot(c2).render(React.createElement(Wizard)); });
  await flush();
  assert.ok(tid("confirm-screen"), "sample restored into the combined preview on reload");
  assert.match(txt(), /Preview your practice contacts/);
});

test("sample: Delete / Exit / Start Over all clear it and return to selection", async () => {
  for (const id of ["sample-delete", "sample-exit"]) {
    await mountWizard(); await goIndividual();
    await act(async () => fireClick(tid("start-testdrive")));
    await act(async () => fireClick(tid(id)));
    assert.match(txt(), /Import Those Important to You?/, `${id} returns to selection`);
  }
  await mountWizard(); await goIndividual();
  await act(async () => fireClick(tid("start-testdrive")));
  await act(async () => fireClick(tid("startover")));
  assert.match(txt(), /Import Those Important to You?/);
});

// ---------- REAL import ----------
test("real full success navigates straight to Recipients with a truthful count", async () => {
  await mountWizard();
  globalThis.__getContacts = () => ({ data: [] });
  globalThis.__importContacts = (c) => ({ data: { imported: c.length, failed: 0, errors: [] } });
  await goIndividual(); await uploadCsv(CSV2);
  assert.ok(tid("confirm-screen"));
  assert.match(tid("add-cta").textContent, /Add 2 contacts/);
  await act(async () => fireClick(tid("add-cta")));
  await flush();
  assert.equal(globalThis.__nav, "/dashboard/contacts", "navigated to the real Recipients page");
  assert.ok((globalThis.__toasts || []).some((a) => /2 contacts added successfully/.test(a.join(" "))));
});

test("real partial success stays on the combined screen; added rows are not re-submitted", async () => {
  await mountWizard();
  globalThis.__getContacts = () => ({ data: [] });
  globalThis.__importContacts = () => ({ data: { imported: 1, failed: 1, errors: [{ contact: { email: "bo@x.co" }, error: "limit reached" }] } });
  await goIndividual(); await uploadCsv(CSV2);
  await act(async () => fireClick(tid("add-cta")));
  await flush();
  assert.equal(globalThis.__nav, undefined, "did NOT navigate on partial");
  assert.ok(tid("partial"), "partial banner shown");
  assert.match(txt(), /could not be added/);
  globalThis.__lastImport = null;
  globalThis.__importContacts = (c) => ({ data: { imported: c.length, failed: 0, errors: [] } });
  if (tid("add-cta")) { await act(async () => fireClick(tid("add-cta"))); await flush(); }
  assert.ok((globalThis.__lastImport || []).every((c) => c.email !== "ada@x.co"), "the already-added row is never re-sent");
});

test("real zero-success failure stays on the screen (fail-closed), never navigates", async () => {
  await mountWizard();
  globalThis.__getContacts = () => ({ data: [] });
  globalThis.__importContacts = () => ({ ok: false, status: 403 });
  await goIndividual(); await uploadCsv(CSV2);
  await act(async () => fireClick(tid("add-cta")));
  await flush();
  assert.equal(globalThis.__nav, undefined, "no navigation on a failed import");
  assert.ok(tid("confirm-screen"), "stayed on the combined screen");
  assert.match(txt(), /limit reached/i);
});

test("real duplicate (existing recipient) is shown as already-in-list and excluded", async () => {
  await mountWizard();
  globalThis.__getContacts = () => ({ data: [{ email: "ada@x.co" }] });
  globalThis.__importContacts = (c) => ({ data: { imported: c.length, failed: 0, errors: [] } });
  await goIndividual(); await uploadCsv(CSV2);
  assert.match(txt(), /already in your recipient list/i);
  assert.match(tid("add-cta").textContent, /Add 1 contact/);
  await act(async () => fireClick(tid("add-cta")));
  await flush();
  assert.ok((globalThis.__lastImport || []).every((c) => c.email !== "ada@x.co"));
});

test("real under-13 row is blocked in the quick-fix area and excluded", async () => {
  await mountWizard();
  globalThis.__getContacts = () => ({ data: [] });
  await goIndividual();
  await uploadCsv("Name,Email,Birthday\nKid,kid@x.co,2018-01-01\nAda,ada@x.co,1990-05-14");
  assert.ok(tid("quickfix"));
  assert.match(txt(), /under 13/);
  assert.match(tid("add-cta").textContent, /Add 1 contact/);
});

// ---------- Business path (mirrors Personal; dormant real import) ----------
test("Business opens its OWN Screen 2 (Employees/Clients/Vendors), not the Personal group screen", async () => {
  await mountWizard();
  await act(async () => fireClick(tid("panel-business")));
  await flush();
  assert.ok(tid("biz-panels"), "Business opened its category selector");
  assert.equal(document.querySelectorAll('[data-testid="biz-panels"] [data-testid^="panel-"]').length, 3);
  for (const id of ["panel-employee", "panel-client", "panel-vendor"]) assert.ok(tid(id), `${id} present`);
  assert.equal(tid("group-panels"), null, "Business does NOT open the Personal group screen");
  assert.equal(tid("panel-personal"), null, "left the Screen-1 selection");
  assert.match(txt(), /BUSINESS RELATIONSHIPS/);
  assert.match(txt(), /Who Are You Importing\?/);
});

test("each Business selection → Business Upload Options (canonical heading, stacked sections, Test Drive)", async () => {
  const cases = [["employee", "Import Employee Contacts"], ["client", "Import Client Contacts"], ["vendor", "Import Vendor Contacts"]];
  for (const [kind, heading] of cases) {
    await mountWizard();
    await goBusiness(kind);
    assert.ok(tid("upload-context"), `${kind} shows the category context`);
    assert.match(txt(), new RegExp(heading), `${kind} canonical heading`);
    assert.match(txt(), /Upload your contacts/);
    assert.ok(tid("choose-csv"), "Choose a CSV file control present");
    assert.match(txt(), /Choose a CSV file/);
    assert.ok(tid("upload-or"), "OR divider present");
    assert.match(txt(), /Safe practice mode/);
    assert.match(txt(), /Test Drive the Import Wizard/);
    assert.ok(tid("download-practice") && tid("start-testdrive"), "practice CTAs present");
    assert.equal(tid("sample-upload-own"), null, "no individual sample bar on business upload options");
  }
});

test("Business Test Drive is ZERO mutation; primary CTA opens the Recipients Practice View (no backend write)", async () => {
  for (const kind of ["employee", "client", "vendor"]) {
    await mountWizard();
    globalThis.__importContacts = (c) => ({ data: { imported: c.length, failed: 0, errors: [] } });
    await goBusiness(kind);
    await act(async () => fireClick(tid("start-testdrive")));
    await flush();
    assert.ok(tid("confirm-screen"), `${kind} test drive opens the preview`);
    assert.match(txt(), /Preview your practice contacts/);
    // primary CTA → Recipients Practice View (explicit marker), persists the session workspace only
    assert.ok(tid("view-practice-recipients"), `${kind} has the Practice View CTA`);
    assert.match(txt(), /See how the fictional contacts will look in your Recipients page/);
    await act(async () => fireClick(tid("view-practice-recipients")));
    await flush();
    assert.equal(globalThis.__nav, "/dashboard/contacts?practice=1", `${kind} navigates to Recipients Practice View`);
    assert.equal(globalThis.__lastImport, undefined, `${kind} test drive made NO import API call`);
    // the fictional contacts were persisted to the session-scoped workspace (never a backend write)
    const raw = window.sessionStorage.getItem("greetme_sample_workspace");
    assert.ok(raw && JSON.parse(raw).contacts.length > 0, `${kind} practice workspace persisted`);
  }
});

test("real Business CSV → truthful dormant state BEFORE any read/write (no API, no parse, no nav)", async () => {
  await mountWizard();
  globalThis.__getContacts = () => ({ data: [{ email: "should-not-be-read@x.co" }] });
  globalThis.__importContacts = (c) => ({ data: { imported: c.length } });
  await goBusiness("client");
  await uploadCsv(CSV2);                                   // choose a real Business CSV
  assert.match(txt(), /Organization import is currently turned off/, "dormant state shown");
  assert.ok(tid("biz-dormant"), "dormant recovery actions present");
  assert.equal(globalThis.__lastImport, undefined, "no import call");
  assert.equal(globalThis.__nav, undefined, "no navigation");
  assert.ok(!tid("confirm-screen"), "never reached a review/commit of a real business file");
});

test("Business upload Change returns to Business Screen 2; Start Over returns to Screen 1", async () => {
  await mountWizard(); await goBusiness("employee");
  assert.match(txt(), /Import Employee Contacts/);
  await act(async () => fireClick(tid("change-group")));
  assert.ok(tid("biz-panels"), "Change returned to Business Screen 2");
  await act(async () => fireClick(tid("panel-vendor")));
  await flush();
  assert.match(txt(), /Import Vendor Contacts/, "new category → new heading");
  assert.ok(!txt().includes("Import Employee Contacts"), "old heading replaced");
  await act(async () => fireClick(btnByText(/Start over/)));
  assert.match(txt(), /Import Those Important to You/);
  assert.ok(tid("panel-personal") && tid("panel-business"));
});

// ---------- Safe defaults + blank templates ----------
test("recommended-default notice appears for eligible blank rows (Friend, exact count)", async () => {
  await mountWizard(); globalThis.__getContacts = () => ({ data: [] });
  await goIndividual("friend"); await uploadCsv(CSV2);
  assert.ok(tid("defaults-notice"), "Friend import with blank relationships → notice");
  assert.match(txt(), /Recommended settings are available/);
  assert.match(txt(), /Apply recommended settings to 2 contacts/);
});

test("FAMILY UX PROOF: before opt-in unchanged; after opt-in shows Family Member; undo restores exactly", async () => {
  await mountWizard();
  globalThis.__getContacts = () => ({ data: [] });
  globalThis.__importContacts = (c) => ({ data: { imported: c.length, failed: 0, errors: [] } });
  await goIndividual("family"); await uploadCsv(CSV2);
  assert.ok(tid("defaults-notice"), "Family now has a canonical recommended default");
  // before opt-in: relationship blank / unchanged
  assert.match(txt(), /Relationship not provided/);
  assert.ok(!txt().includes("Family Member"), "no relationship applied before opt-in");
  // after opt-in: review displays Family / Family Member
  await act(async () => fireClick(tid("apply-defaults")));
  assert.ok(tid("defaults-applied"));
  assert.match(txt(), /Family Member/, "Family Member shown after opt-in");
  // undo restores the exact prior state
  await act(async () => fireClick(tid("undo-defaults")));
  assert.ok(tid("defaults-notice"));
  assert.match(txt(), /Relationship not provided/);
  assert.ok(!txt().includes("Family Member"), "undo removed the applied relationship");
  // and the payload carries the canonical family default when applied + committed
  await act(async () => fireClick(tid("apply-defaults")));
  await act(async () => fireClick(tid("add-cta")));
  await flush();
  const p = globalThis.__lastImport || [];
  assert.ok(p.length === 2 && p.every((c) => c.relationship === "family_member" && c.relationshipCategory === "family" && c.relationshipCloseness === "greetme_worthy"), "family payload");
  assert.ok(p.every((c) => c.recipientType === ""), "Personal → no business recipientType");
});

test("Apply updates rows + count; Undo restores; Review individually dismisses with no change", async () => {
  await mountWizard(); globalThis.__getContacts = () => ({ data: [] });
  await goIndividual("professional"); await uploadCsv(CSV2);
  assert.ok(tid("defaults-notice"));
  await act(async () => fireClick(tid("apply-defaults")));
  assert.ok(tid("defaults-applied"), "applied banner shown");
  assert.match(txt(), /Recommended settings applied to 2 contacts/);
  await act(async () => fireClick(tid("undo-defaults")));
  assert.ok(tid("defaults-notice"), "Undo returns to the available notice");
  assert.equal(tid("defaults-applied"), null);
  await act(async () => fireClick(tid("review-individually")));
  assert.equal(tid("defaults-notice"), null, "Review individually dismisses the notice");
  assert.equal(tid("defaults-applied"), null, "and applies nothing");
});

test("applied defaults flow into the import payload (professional/colleague/greetme_worthy), no business type", async () => {
  await mountWizard(); globalThis.__getContacts = () => ({ data: [] });
  globalThis.__importContacts = (c) => ({ data: { imported: c.length, failed: 0, errors: [] } });
  await goIndividual("professional"); await uploadCsv(CSV2);
  await act(async () => fireClick(tid("apply-defaults")));
  await act(async () => fireClick(tid("add-cta")));
  await flush();
  const p = globalThis.__lastImport || [];
  assert.equal(p.length, 2);
  assert.ok(p.every((c) => c.relationship === "colleague" && c.relationshipCategory === "professional" && c.relationshipCloseness === "greetme_worthy"), "manual-compatible payload");
  assert.ok(p.every((c) => c.recipientType === ""), "Personal Professional → no business recipientType");
  assert.equal(globalThis.__nav, "/dashboard/contacts", "real import mechanics unchanged (navigates)");
});

test("all six blank-template download actions are wired and separate from the Practice CSV", async () => {
  for (const [nav, kind] of [["p", "family"], ["p", "friend"], ["p", "professional"], ["b", "employee"], ["b", "client"], ["b", "vendor"]]) {
    await mountWizard();
    if (nav === "p") await goIndividual(kind); else await goBusiness(kind);
    assert.match(txt(), /Need a file to fill out\?/, `${kind} template block`);
    assert.ok(tid("download-excel-template"), `${kind} Excel template action`);
    assert.ok(tid("download-csv-template"), `${kind} CSV template action`);
    assert.ok(tid("download-practice"), `${kind} Practice CSV still present + separate`);
  }
});

// ---------- Test Drive two-tile structure (rendered DOM, all six paths) ----------
const q = (sel) => document.querySelector(sel);
const within = (containerTid, sel) => q(`[data-testid="${containerTid}"] ${sel}`);
test("Upload/Test-Drive numbering: OPTION labels live ONLY in the two Test Drive tiles (DOM structure)", async () => {
  for (const [nav, kind] of [["p", "family"], ["p", "friend"], ["p", "professional"], ["b", "employee"], ["b", "client"], ["b", "vendor"]]) {
    await mountWizard();
    if (nav === "p") await goIndividual(kind); else await goBusiness(kind);
    const upload = tid("upload-section"), td = tid("testdrive-section");
    assert.ok(upload && td, `${kind}: both containers present`);
    // (1/2) normal-upload container has NO OPTION label / numbered tile
    assert.equal(within("upload-section", '[data-testid^="td-option-"]'), null, `${kind}: no OPTION label in Upload`);
    assert.ok(!/OPTION\s*[12]/.test(upload.textContent), `${kind}: Upload section text has no OPTION 1/2`);
    // (3/4) Safe practice mode heading area has no parent OPTION label — the only OPTION labels are the tiles' eyebrows
    assert.ok(!within("testdrive-section", '[data-testid="option-2-label"]'), `${kind}: no parent OPTION 2 label`);
    // (5) old bullet list absent
    assert.equal(within("testdrive-section", "ul"), null, `${kind}: no bullet list in Test Drive`);
    // (6/7/8) exactly two numbered tiles inside the Test Drive container, in order
    const tiles = td.querySelectorAll('[data-testid^="testdrive-option-"]');
    assert.equal(tiles.length, 2, `${kind}: exactly two Test Drive tiles`);
    assert.equal(tiles[0].getAttribute("data-testid"), "testdrive-option-1");
    assert.equal(tiles[1].getAttribute("data-testid"), "testdrive-option-2");
    assert.equal(within("testdrive-option-1", '[data-testid="td-option-1-label"]').textContent.trim(), "OPTION 1");
    assert.equal(within("testdrive-option-2", '[data-testid="td-option-2-label"]').textContent.trim(), "OPTION 2");
    assert.ok(!within("testdrive-option-2", '[data-testid="td-option-1-label"]'), `${kind}: OPTION 1 only in tile 1`);
    // (9/10) each tile owns its CTA
    assert.ok(within("testdrive-option-1", '[data-testid="download-practice"]'), `${kind}: tile 1 → Download Practice CSV`);
    assert.ok(within("testdrive-option-2", '[data-testid="start-testdrive"]'), `${kind}: tile 2 → Start Test Drive`);
    // (11) internal OR between the two tiles, positioned after tile 1 and before tile 2
    const children = [...td.children];
    const i1 = children.indexOf(tiles[0]), iOr = children.findIndex((c) => c.getAttribute && c.getAttribute("data-testid") === "testdrive-or"), i2 = children.indexOf(tiles[1]);
    assert.ok(i1 >= 0 && iOr > i1 && i2 > iOr, `${kind}: OPTION1 → OR → OPTION2 order`);
    assert.equal(tid("testdrive-or").textContent.trim(), "OR");
  }
});
test("Test Drive OPTION 1 downloads only (no load / no navigate / no API); OPTION 2 loads the review (zero mutation)", async () => {
  // OPTION 1 — download only
  await mountWizard(); await goIndividual("professional");
  window.URL.createObjectURL = () => "blob:stub"; window.URL.revokeObjectURL = () => {};
  await act(async () => fireClick(within("testdrive-option-1", '[data-testid="download-practice"]')));
  await flush();
  assert.equal(tid("confirm-screen"), null, "OPTION 1 did NOT navigate to the review");
  assert.ok(tid("testdrive-option-1"), "still on the upload options screen");
  assert.equal(globalThis.__lastImport, undefined, "OPTION 1 made no import API call");
  assert.equal(globalThis.__nav, undefined, "OPTION 1 did not navigate to prod");
  // OPTION 2 — load fictional data → review, zero mutation
  await mountWizard(); await goIndividual("professional");
  await act(async () => fireClick(within("testdrive-option-2", '[data-testid="start-testdrive"]')));
  await flush();
  assert.ok(tid("confirm-screen"), "OPTION 2 loaded the Test Drive review");
  assert.match(txt(), /Preview your practice contacts/);
  assert.equal(globalThis.__lastImport, undefined, "OPTION 2 made no import API call");
  assert.equal(globalThis.__nav, undefined, "OPTION 2 made no navigation to prod");
});

test("Personal Test Drive loads the CATEGORY dataset (Family names differ from Friends)", async () => {
  await mountWizard(); await goIndividual("family");
  await act(async () => fireClick(tid("start-testdrive")));
  await flush();
  const familyTxt = txt();
  await mountWizard(); await goIndividual("friend");
  await act(async () => fireClick(tid("start-testdrive")));
  await flush();
  const friendTxt = txt();
  assert.match(familyTxt, /Hollis/, "family practice set present");
  assert.match(friendTxt, /Marsh|Nguyen|Vega/, "friend practice set present");
  assert.ok(!/Hollis/.test(friendTxt), "friend preview is a different, category-appropriate dataset");
});

// ---------- Start Over, keyboard, mobile ----------
test("Start Over from the combined screen returns to selection (keyboard-operable)", async () => {
  await mountWizard(); await goIndividual();
  globalThis.__getContacts = () => ({ data: [] });
  await uploadCsv(CSV2);
  const so = tid("startover");
  assert.equal(so.tagName, "BUTTON");
  so.focus(); assert.equal(document.activeElement, so);
  await act(async () => fireClick(so));
  assert.match(txt(), /Import Those Important to You?/);
});

test("mobile width: the combined screen still renders", async () => {
  Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
  window.dispatchEvent(new window.Event("resize"));
  await mountWizard(); await goIndividual();
  await act(async () => fireClick(tid("start-testdrive")));
  assert.ok(tid("confirm-screen") && tid("sample-exit"));
});

// ---------- Screen 1 premium path panels (accessibility + whole-panel activation) ----------
test("entry: exactly two semantic path-panel buttons with full accessible names", async () => {
  await mountWizard();
  assert.match(txt(), /Import Those Important to You/);
  assert.match(txt(), /Greet-Me™ Import Wizard/);
  assert.match(txt(), /Forget Them Not!/);
  const p = tid("panel-personal"), b = tid("panel-business");
  assert.ok(p && b, "both panels present");
  assert.equal(document.querySelectorAll('[data-testid^="panel-"]').length, 2, "exactly two panels");
  assert.equal(p.tagName, "BUTTON"); assert.equal(b.tagName, "BUTTON");   // semantic + keyboard-operable
  assert.match(p.getAttribute("aria-label"), /Personal Relationships — Family, friends/);
  assert.match(b.getAttribute("aria-label"), /Business Relationships — Employees, clients/);
});
test("the WHOLE Personal panel is focusable and opens Screen 2 (pointer)", async () => {
  await mountWizard();
  const p = tid("panel-personal");
  p.focus(); assert.equal(document.activeElement, p, "panel is keyboard-focusable");
  const medallion = p.querySelector(".gmiw-medallion") || p;    // click a child → whole panel activates
  await act(async () => fireClick(medallion));
  await flush();
  assert.ok(tid("group-panels"), "Personal opened Screen 2 (relationship group)");
  assert.match(txt(), /Who Are You Importing\?/);
  assert.match(txt(), /PERSONAL RELATIONSHIPS/);
});
test("the WHOLE Business panel is focusable and opens the Business category screen (pointer)", async () => {
  await mountWizard();
  const b = tid("panel-business");
  b.focus(); assert.equal(document.activeElement, b, "panel is keyboard-focusable");
  await act(async () => fireClick(b.querySelector(".gmiw-panel-title") || b));   // click a child → whole panel
  await flush();
  assert.equal(tid("panel-personal"), null, "left the selection screen");
  assert.ok(tid("biz-panels"), "Business opened its OWN category screen (Employees/Clients/Vendors)");
  assert.equal(tid("group-panels"), null, "Business does NOT open the Personal group screen");
  assert.equal(tid("sample-upload-own"), null, "Business did not open the Individual sample bar");
});

// ---------- Screen 2 — Personal relationship group ----------
test("Screen 2 has exactly Family/Friends/Professional; each routes to the upload with its context", async () => {
  const cases = [["family", "Import Family Contacts"], ["friend", "Import Friend Contacts"], ["professional", "Import Professional Contacts"]];
  await mountWizard(); await act(async () => fireClick(tid("panel-personal")));
  assert.equal(document.querySelectorAll('[data-testid="group-panels"] [data-testid^="panel-"]').length, 3);
  for (const [g, heading] of cases) {
    await mountWizard();
    await act(async () => fireClick(tid("panel-personal")));
    const gp = tid(`panel-${g}`);
    assert.equal(gp.tagName, "BUTTON");
    gp.focus(); assert.equal(document.activeElement, gp, `${g} panel focusable`);
    await act(async () => fireClick(gp.querySelector(".gmiw-panel-title") || gp));   // whole panel
    await flush();
    assert.match(txt(), /Choose a CSV file/, `${g} → Individual upload`);
    assert.ok(tid("upload-context"), `${g} shows the group context`);
    assert.match(txt(), new RegExp(heading), `${g} heading`);
    assert.ok(tid("change-group"), "Change link present");
  }
});
test("Screen 2 Back returns to Screen 1; upload Change returns to Screen 2; Start Over clears context", async () => {
  await mountWizard(); await act(async () => fireClick(tid("panel-personal")));
  await act(async () => fireClick(tid("back-to-path")));
  assert.match(txt(), /Import Those Important to You/);
  assert.ok(tid("panel-personal") && tid("panel-business"), "back to Screen 1");
  // Change from upload → Screen 2, then picking a DIFFERENT category updates the heading immediately
  await mountWizard(); await goIndividual("friend");
  assert.match(txt(), /Import Friend Contacts/);
  await act(async () => fireClick(tid("change-group")));
  assert.ok(tid("group-panels"), "Change returned to Screen 2");
  await act(async () => fireClick(tid("panel-professional")));
  await flush();
  assert.match(txt(), /Import Professional Contacts/, "new category → new heading");
  assert.ok(!txt().includes("Import Friend Contacts"), "old heading replaced");
  // Start Over from upload clears the Personal context → Screen 1 (no upload-context on re-entry)
  await mountWizard(); await goIndividual("family");
  await act(async () => fireClick(btnByText(/Start over/)));    // Shell "← Start over" on the upload screen
  assert.match(txt(), /Import Those Important to You/);
  await act(async () => fireClick(tid("panel-personal")));
  await act(async () => fireClick(tid("panel-professional")));
  await flush();
  assert.match(txt(), /Import Professional Contacts/, "fresh context after Start Over (no stale Family)");
});
test("real import through a Personal group still navigates to Recipients (mechanics intact)", async () => {
  await mountWizard();
  globalThis.__getContacts = () => ({ data: [] });
  globalThis.__importContacts = (c) => ({ data: { imported: c.length, failed: 0, errors: [] } });
  await goIndividual("professional");
  await uploadCsv(CSV2);
  assert.match(tid("add-cta").textContent, /Add 2 contacts/);
  await act(async () => fireClick(tid("add-cta")));
  await flush();
  assert.equal(globalThis.__nav, "/dashboard/contacts");
  // Personal Professional stays individual — payload carried no business recipientType
  assert.ok((globalThis.__lastImport || []).every((c) => c.recipientType === ""));
});

test("Screen 2 renders all three group panels at every representative width (DOM presence)", async () => {
  for (const w of [1200, 900, 768, 640, 375]) {
    Object.defineProperty(window, "innerWidth", { value: w, configurable: true });
    window.dispatchEvent(new window.Event("resize"));
    await mountWizard();
    await act(async () => fireClick(tid("panel-personal")));
    const panels = document.querySelectorAll('[data-testid="group-panels"] .gmiw-panel');
    assert.equal(panels.length, 3, `three panels present at ${w}px`);
    for (const id of ["panel-family", "panel-friend", "panel-professional"]) assert.ok(tid(id), `${id} present at ${w}px`);
    // order preserved: Family, Friends, Professional
    assert.deepEqual([...panels].map((p) => p.getAttribute("data-testid")), ["panel-family", "panel-friend", "panel-professional"]);
    assert.ok(document.querySelector(".gmiw-panels--three"), `resilient grid class applied at ${w}px`);
  }
});
