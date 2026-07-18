// src/components/importWizard/reviewScreen.browser.test.mjs
//
// BROWSER-LEVEL interaction test for the original live control defect. The .jsx ReviewScreen is
// transformed with esbuild (JSX + import.meta.env neutralized; api/router/papaparse stubbed) and
// mounted with the REAL react-dom/client into a jsdom document. We then drive the controls the way a
// user does — set a <select> value + dispatch a native change event (pointer), focus for keyboard
// reachability, resize to a mobile width — and assert the three values persist and the card stays
// mounted. jsdom has no CSS layout/paint, so visual layout is out of scope (that's the reviewer's
// live pass); DOM structure, control wiring, value persistence, and mount lifetime ARE covered here.
//
// ENFORCEABLE: jsdom + esbuild are declared devDependencies (package.json + package-lock.json), so
// `npm ci` installs them deterministically. These imports are UNCONDITIONAL and TOP-LEVEL — if the
// deps are missing the module fails to load (ERR_MODULE_NOT_FOUND) and the whole run fails. There is
// NO skip path: this test cannot silently pass when its dependencies are absent.
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
let React, createRoot, ReviewScreen, act;

before(async () => {
  // 1) Transform the real ReviewScreen (JSX) → ESM, stubbing side-effectful imports.
  const stub = {
    name: "stub",
    setup(b) {
      b.onResolve({ filter: /(^react-router-dom$|^papaparse$|\/api\/api$|corporateCampaigns\.js$)/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
        contents: "export default {}; export const useNavigate=()=>()=>{}; export const createCorporateCampaignsClient=()=>({listMemberships:async()=>({ok:false})});",
        loader: "js",
      }));
    },
  };
  writeFileSync(join(__dirname, ".__entry.jsx"), `export { ReviewScreen } from "./ContactImportWizard.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__entry.jsx")],
    outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stub], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__entry.jsx"), { force: true });

  // 2) Real DOM via jsdom, wired as globals BEFORE react-dom loads.
  const dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  // 3) Real React 19 + react-dom/client (resolved from installed node_modules) + the transformed screen.
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ ReviewScreen } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(join(__dirname, ".__entry.jsx"), { force: true }); } catch { /* ignore */ } });

// Set a <select>/<input> value the way the browser does, then fire the native change event React listens for.
function fireChange(el, value) {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}
const q = (sel) => document.querySelector(sel);
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const optionValues = (sel) => [...sel.options].map((o) => o.value);

// A stateful harness that owns reviewState exactly like the wizard does.
function mount(rows, opts = {}) {
  document.body.innerHTML = "";                          // isolate: no stale tree for querySelector
  const container = document.createElement("div");      // fresh root each mount
  document.body.appendChild(container);
  const root = createRoot(container);
  function Harness() {
    const [st, setSt] = React.useState(() => freshReviewState({ business: !!opts.business, kind: opts.kind || null }));
    return React.createElement(ReviewScreen, {
      rows, state: st, setState: setSt, business: !!opts.business, demo: !!opts.demo, busy: false,
      skipped: 0, onCommit() {}, onStartOver() {},
    });
  }
  return { root, render: async () => { await act(async () => { root.render(React.createElement(Harness)); }); } };
}
const row = (i, o = {}) => ({ contact: { fullName: o.name ?? "Person " + i, email: o.email ?? `p${i}@x.co`, relationship: o.relationship ?? "", recipientType: o.recipientType ?? "" }, index: i, __raw: {}, __map: {}, duplicate: o.dup ?? null });

test("pointer: group→relation dependency, all three values persist, card stays mounted, Save&next + Back", async () => {
  const rows = [row(0, { relationship: "bestie" }), row(1, { relationship: "amigo" })]; // two attention cards
  const h = mount(rows, {});
  await h.render();

  // the active card shows the three controls
  assert.ok(tid("attention-card"), "attention card mounted");
  assert.ok(tid("group-select") && tid("relation-select") && tid("closeness-select"), "all three controls present");
  assert.equal(tid("closeness-select").value, "greetme_worthy", "Greet-Me Worthy preselected");

  // 1) open the group dropdown and select "friend" by pointer → relation options must update
  await act(async () => fireChange(tid("group-select"), "friend"));
  const relOpts = optionValues(tid("relation-select"));
  assert.ok(relOpts.includes("close_friend") && relOpts.includes("neighbor"), "relation options followed the group");
  assert.ok(!relOpts.includes("sibling"), "family relations are not offered under friend");

  // 2) select a relation, 3) change closeness
  await act(async () => fireChange(tid("relation-select"), "close_friend"));
  await act(async () => fireChange(tid("closeness-select"), "inner_circle"));

  // all three values remain displayed AND the row is still mounted (the original defect)
  assert.equal(tid("group-select").value, "friend");
  assert.equal(tid("relation-select").value, "close_friend");
  assert.equal(tid("closeness-select").value, "inner_circle");
  assert.ok(tid("attention-card"), "card did NOT unmount after resolving");

  // keyboard reachability — the control is focusable and not disabled
  tid("group-select").focus();
  assert.equal(document.activeElement, tid("group-select"), "group select is keyboard-focusable");
  assert.equal(tid("relation-select").disabled, false);

  // 4) Save & next advances to the second card
  await act(async () => tid("save-next").dispatchEvent(new window.Event("click", { bubbles: true })));
  assert.match(q('[data-testid="attention-card"]').textContent, /Contact 2 of 2/, "advanced one card");

  // 5) Back restores the first card AND its saved selections
  const backBtn = [...document.querySelectorAll("button")].find((b) => /Back/.test(b.textContent));
  await act(async () => backBtn.dispatchEvent(new window.Event("click", { bubbles: true })));
  assert.match(tid("attention-card").textContent, /Contact 1 of 2/, "returned to the first card");
  assert.equal(tid("group-select").value, "friend", "selection preserved after Back");
  assert.equal(tid("relation-select").value, "close_friend");
  assert.equal(tid("closeness-select").value, "inner_circle");
});

test("mobile width: the three controls still render (no width-based unmount)", async () => {
  Object.defineProperty(window, "innerWidth", { value: 375, configurable: true });
  window.dispatchEvent(new window.Event("resize"));
  const h = mount([row(0, { relationship: "bestie" })], {});
  await h.render();
  assert.ok(tid("group-select") && tid("relation-select") && tid("closeness-select"), "all three controls render at 375px");
  assert.ok(tid("attention-card"));
});

test("Universal: audience control appears above the relationship controls and gates Save&next", async () => {
  const rows = [row(0, { recipientType: "contractor" })];
  const h = mount(rows, { business: true, kind: "mixed" });
  await h.render();
  assert.ok(tid("audience-select"), "required audience control present");
  assert.equal(tid("save-next").disabled, true, "Save & next blocked until the audience is chosen");
  await act(async () => fireChange(tid("audience-select"), "client"));
  assert.equal(tid("save-next").disabled, false, "resolving the audience unblocks Save & next");
});
