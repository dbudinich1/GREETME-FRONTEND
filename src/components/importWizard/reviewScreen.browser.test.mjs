// src/components/importWizard/reviewScreen.browser.test.mjs
//
// BROWSER-LEVEL interaction tests. The real .jsx is esbuild-transformed (JSX + import.meta.env
// neutralized; api/router/papaparse stubbed) and mounted with the REAL react-dom/client into jsdom.
// We drive controls the way a user does (native change/click events, focus) and assert the
// confirmation-first flow, inline revalidation, the optional relationship editor, and — via the FULL
// wizard — that Start Over returns to the Individual/Business selection. jsdom has no CSS layout, so
// visual layout is out of scope; DOM structure, wiring, value persistence, and navigation ARE covered.
//
// ENFORCEABLE: jsdom + esbuild are declared devDependencies (package.json + package-lock.json), so
// `npm ci` installs them. These imports are UNCONDITIONAL — a missing dep fails the run (no skip).
// Run: node --test src/components/importWizard/reviewScreen.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { freshReviewState } from "../../import/reviewModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__reviewscreen.bundle.mjs");
const TODAY = "2026-07-18";
let React, createRoot, ReviewScreen, Wizard, act;

before(async () => {
  const stub = {
    name: "stub",
    setup(b) {
      b.onResolve({ filter: /(^react-router-dom$|^papaparse$|\/api\/api$|corporateCampaigns\.js$)/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: "export default { async getContacts(){return {data:[]};}, async importContacts(){return {data:{imported:0,errors:[]}};} };" +
          " export const useNavigate=()=>()=>{}; export const createCorporateCampaignsClient=()=>({listMemberships:async()=>({ok:false})}); export function parse(){}",
        loader: "js",
      }));
    },
  };
  writeFileSync(join(__dirname, ".__entry.jsx"), `export { ReviewScreen, default as Wizard } from "./ContactImportWizard.jsx";\n`);
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
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ ReviewScreen, Wizard } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(join(__dirname, ".__entry.jsx"), { force: true }); } catch { /* ignore */ } });

function fireChange(el, value) {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}
const fireClick = (el) => el.dispatchEvent(new window.Event("click", { bubbles: true }));
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const optionValues = (sel) => [...sel.options].map((o) => o.value);
const btnByText = (re) => [...document.querySelectorAll("button")].find((b) => re.test(b.textContent));

function row(i, o = {}) {
  const __raw = o.bday != null ? { B: o.bday } : {};
  const __map = o.bday != null ? { birthday: "B" } : {};
  return { contact: { fullName: o.name ?? "Person " + i, email: o.email ?? `p${i}@x.co`, relationship: o.relationship ?? "", recipientType: o.recipientType ?? "" }, index: i, __raw, __map };
}
// Mount ReviewScreen with a real, wizard-shaped stateful harness.
function mount(rows, opts = {}) {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  function Harness() {
    const [st, setSt] = React.useState(() => freshReviewState({ business: !!opts.business, kind: opts.kind || null, existingEmails: opts.existingEmails || [], todayIso: TODAY }));
    return React.createElement(ReviewScreen, {
      rows, state: st, setState: setSt, business: !!opts.business, demo: !!opts.demo, busy: false,
      onCommit: opts.onCommit || (() => {}), onStartOver: opts.onStartOver || (() => {}),
    });
  }
  return { render: async () => { await act(async () => { root.render(React.createElement(Harness)); }); } };
}
async function mountWizard() {
  document.body.innerHTML = "";
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => { root.render(React.createElement(Wizard)); });
}

test("clean file → confirmation screen with one primary 'Add X contacts'; no quick-fix, no walkthrough", async () => {
  await mount([row(0), row(1, { relationship: "sibling" })], {}).render();
  assert.ok(tid("confirm-screen"), "confirmation screen shown");
  assert.equal(tid("quickfix"), null, "no quick-fix for a clean file");
  assert.equal(tid("details-screen"), null, "no mandatory relationship editor");
  assert.match(tid("add-cta").textContent, /Add 2 contacts/);
});

test("inline email fix revalidates immediately (quick-fix → ready)", async () => {
  await mount([row(0), row(1, { email: "broken@" })], {}).render();
  assert.ok(tid("quickfix"), "the broken-email row is a quick fix");
  assert.match(tid("add-cta").textContent, /Add 1 contact/);
  await act(async () => fireChange(tid("fix-email-input"), "fixed@x.co"));
  assert.equal(tid("quickfix"), null, "row cleared the quick-fix after a valid email");
  assert.match(tid("add-cta").textContent, /Add 2 contacts/);
});

test("under-13 birthday is blocked; correcting the date re-runs validation", async () => {
  await mount([row(0, { email: "kid@x.co", bday: "2018-01-01" })], {}).render();
  assert.ok(tid("fix-birthday-input"), "minor row offers a birthday fix");
  assert.match(tid("add-cta").textContent, /Add 0 contacts/);
  await act(async () => fireChange(tid("fix-birthday-input"), "1990-01-01"));
  assert.equal(tid("quickfix"), null);
  assert.match(tid("add-cta").textContent, /Add 1 contact/);
});

test("fixing a bad email to an EXISTING recipient revalidates AND re-dedups (stays out of the import)", async () => {
  // row 0 valid; row 1 has a broken email and the user 'fixes' it to an address already in their list.
  await mount([row(0), row(1, { email: "broken@" })], { existingEmails: ["taken@x.co"] }).render();
  assert.match(tid("add-cta").textContent, /Add 1 contact/);        // only row 0 so far
  await act(async () => fireChange(tid("fix-email-input"), "taken@x.co"));
  assert.equal(tid("quickfix"), null, "the email is now valid → leaves the quick-fix");
  assert.match(tid("add-cta").textContent, /Add 1 contact/, "but it's already in the list → NOT added");
  assert.match(document.body.textContent, /already in your list/);
});

test("optional relationship editor: opens on request, group→relation dependency, returns to confirm", async () => {
  await mount([row(0, { name: "Morgan", relationship: "" })], {}).render();
  assert.ok(tid("details-cta"), "quiet optional CTA present");
  await act(async () => fireClick(tid("details-cta")));
  assert.ok(tid("details-screen"), "relationship editor opened only on request");
  assert.ok(tid("group-select") && tid("relation-select") && tid("closeness-select"));
  assert.equal(tid("closeness-select").value, "greetme_worthy");   // Greet-Me Worthy preselected
  await act(async () => fireChange(tid("group-select"), "friend"));
  const rel = optionValues(tid("relation-select"));
  assert.ok(rel.includes("close_friend") && !rel.includes("sibling"), "relation options follow the group");
  await act(async () => fireChange(tid("relation-select"), "close_friend"));
  assert.equal(tid("relation-select").value, "close_friend");
  await act(async () => fireClick(tid("details-done")));
  assert.ok(tid("confirm-screen"), "returned to confirmation");
});

test("Universal unknown audience is a required quick fix; choosing resolves it", async () => {
  await mount([row(0, { recipientType: "contractor" })], { business: true, kind: "mixed" }).render();
  assert.ok(tid("fix-audience-select"), "required audience choice present");
  assert.match(tid("add-cta").textContent, /Continue with 0 contacts/);
  await act(async () => fireChange(tid("fix-audience-select"), "client"));
  assert.equal(tid("quickfix"), null);
  assert.match(tid("add-cta").textContent, /Continue with 1 contact/);
});

test("Start Over on the confirmation screen is a keyboard-operable button that fires the handler", async () => {
  let fired = 0;
  await mount([row(0)], { onStartOver: () => { fired += 1; } }).render();
  const so = tid("startover");
  assert.equal(so.tagName, "BUTTON", "native button → keyboard operable");
  so.focus();
  assert.equal(document.activeElement, so, "focusable");
  await act(async () => fireClick(so));
  assert.equal(fired, 1);
});

test("FULL wizard: Start Over from the Upload screen returns to Individual/Business selection", async () => {
  await mountWizard();
  assert.match(document.body.textContent, /How would you like to import\?/);
  const individual = btnByText(/^Individual/);
  await act(async () => fireClick(individual));
  assert.match(document.body.textContent, /Choose a \.csv file/, "reached the Upload screen");
  const startOver = btnByText(/Start over/);
  assert.equal(startOver.tagName, "BUTTON");
  startOver.focus();
  assert.equal(document.activeElement, startOver, "Start Over is keyboard-focusable");
  await act(async () => fireClick(startOver));
  assert.match(document.body.textContent, /How would you like to import\?/, "Start Over returned to the selection screen");
  assert.equal(document.body.textContent.includes("Choose a .csv file"), false);
});

test("mobile width: the confirmation screen still renders", async () => {
  Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
  window.dispatchEvent(new window.Event("resize"));
  await mount([row(0), row(1, { email: "bad@" })], {}).render();
  assert.ok(tid("confirm-screen") && tid("add-cta") && tid("quickfix"));
});
