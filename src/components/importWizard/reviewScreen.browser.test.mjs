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
const goIndividual = async () => { await act(async () => fireClick(btnByText(/^Individual/))); };
const CSV2 = "Name,Email\nAda,ada@x.co\nBo,bo@x.co";

// ---------- SAMPLE (individual) ----------
test("Individual → Try sample → combined preview (no separate list, no Finish/View CTA)", async () => {
  await mountWizard(); await goIndividual();
  await act(async () => fireClick(btnByText(/Try the sample/)));
  assert.ok(tid("confirm-screen"), "sample opens directly on the combined preview");
  assert.match(txt(), /Preview your sample contacts/);
  assert.match(txt(), /Sample Mode — Nothing will be saved or sent/);
  assert.ok(tid("sample-upload-own") && tid("sample-download") && tid("sample-delete") && tid("sample-exit"));
  assert.equal(tid("add-cta"), null, "individual sample has no commit/View CTA");
  assert.ok(!/View \d+ sample recipient/.test(txt()), "no 'View X sample recipients' for individual");
  assert.ok(!/Finish sample/.test(txt()));
});

test("sample: open optional relationship editor, change a value, return", async () => {
  await mountWizard(); await goIndividual();
  await act(async () => fireClick(btnByText(/Try the sample/)));
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
  await act(async () => fireClick(btnByText(/Try the sample/)));
  await flush();
  document.body.innerHTML = "";
  const c2 = document.createElement("div"); document.body.appendChild(c2);
  await act(async () => { createRoot(c2).render(React.createElement(Wizard)); });
  await flush();
  assert.ok(tid("confirm-screen"), "sample restored into the combined preview on reload");
  assert.match(txt(), /Preview your sample contacts/);
});

test("sample: Delete / Exit / Start Over all clear it and return to selection", async () => {
  for (const id of ["sample-delete", "sample-exit"]) {
    await mountWizard(); await goIndividual();
    await act(async () => fireClick(btnByText(/Try the sample/)));
    await act(async () => fireClick(tid(id)));
    assert.match(txt(), /How would you like to import\?/, `${id} returns to selection`);
  }
  await mountWizard(); await goIndividual();
  await act(async () => fireClick(btnByText(/Try the sample/)));
  await act(async () => fireClick(tid("startover")));
  assert.match(txt(), /How would you like to import\?/);
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

// ---------- Business regression ----------
test("Business path stays gated — never renders the Individual real 'Add' confirmation or sample bar", async () => {
  await mountWizard();
  await act(async () => fireClick(btnByText(/^Business/)));
  await flush();
  assert.equal(tid("sample-upload-own"), null, "individual sample action bar never appears on Business");
  assert.ok(!/Preview your sample contacts/.test(txt()), "Business does not open the individual sample preview");
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
  assert.match(txt(), /How would you like to import\?/);
});

test("mobile width: the combined screen still renders", async () => {
  Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
  window.dispatchEvent(new window.Event("resize"));
  await mountWizard(); await goIndividual();
  await act(async () => fireClick(btnByText(/Try the sample/)));
  assert.ok(tid("confirm-screen") && tid("sample-exit"));
});
