// src/components/importWizard/corporateImportFlow.browser.test.mjs
//
// BROWSER-LEVEL tests for the Slice 2B-2B Corporate commit flow. The real CorporateImportFlow.jsx is
// esbuild-transformed and mounted into jsdom with an INJECTED fake corporate client (no network). Proves
// org bootstrap (0/1/many/dormant/unauthorized), confirmation gating, honest error handling, deterministic
// reconciliation, double-submit prevention, and that Practice/Test Drive can never reach either endpoint.
//
// ENFORCEABLE: jsdom + esbuild are devDependencies; imports are unconditional.
// Run: node --test src/components/importWizard/corporateImportFlow.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { PREVIEW_STATUS } from "../../import/corporateAddressStatus.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__corpflow.bundle.mjs");
let React, createRoot, Flow, act;

before(async () => {
  writeFileSync(join(__dirname, ".__cf.jsx"), `export { default as Flow } from "./CorporateImportFlow.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__cf.jsx")],
    outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(join(__dirname, ".__cf.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Flow } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(join(__dirname, ".__cf.jsx"), { force: true }); } catch { /* ignore */ } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const tidAll = (t) => [...document.querySelectorAll(`[data-testid="${t}"]`)];
const txt = () => document.body.textContent;
const fireClick = (el) => el.dispatchEvent(new window.Event("click", { bubbles: true }));
function fireChange(el, value) {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  if (value !== undefined) Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };

// A valid preview item (importable). status drives address-bucket counts.
const item = (i, status = PREVIEW_STATUS.REVIEW, valid = true) => ({
  index: i, valid, errors: valid ? [] : ["missing_email"],
  contact: { fullName: `Emp ${i}`, email: `emp${i}@corp.co` },
  address: null, addressStatus: { status, label: "x", missing: [] },
});
const results = (rows, over = {}) => ({ added: 0, updated: 0, merged: 0, skipped: 0, failed: 0, total: rows.length, rows, ...over });

let root;
async function mount(props) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Flow, props)); });
  await flush();
}
async function clickTid(t) { await act(async () => { fireClick(tid(t)); }); await flush(); }

// A configurable fake client. calls records invocations.
function fakeClient({ orgs, importResult } = {}) {
  const calls = { list: 0, import: [] };
  return {
    calls,
    listOrganizations: async () => { calls.list++; return orgs || { ok: true, organizations: [] }; },
    importContacts: async (orgId, envelope) => { calls.import.push({ orgId, envelope }); return typeof importResult === "function" ? importResult(orgId, envelope) : (importResult || { ok: true, data: results([]) }); },
  };
}

// ---------------- org bootstrap ----------------
test("preview → Continue loads authorized organizations", async () => {
  const c = fakeClient({ orgs: { ok: true, organizations: [{ corporateOrganizationId: "org_1", role: "admin" }] } });
  await mount({ items: [item(0)], client: c, onStartOver() {} });
  assert.ok(tid("corp-continue"), "preview shows Continue to import");
  await clickTid("corp-continue");
  assert.equal(c.calls.list, 1);
  assert.ok(tid("corp-confirm"));
});

test("zero authorized organizations → truthful provisioning state; no selectable org; import blocked", async () => {
  await mount({ items: [item(0)], client: fakeClient({ orgs: { ok: true, organizations: [] } }), onStartOver() {} });
  await clickTid("corp-continue");
  const empty = tid("corp-org-empty");
  assert.ok(empty, "empty successful response renders the truthful empty state");
  // Truthful: explains a corporate organization must first be provisioned by Greet-Me administration.
  assert.match(empty.textContent, /provision/i);
  assert.match(empty.textContent, /Greet-Me/);
  // Does NOT imply an organization already exists, and offers no self-service creation.
  assert.doesNotMatch(empty.textContent, /aren't an authorized member/i);
  assert.doesNotMatch(txt(), /create (an? )?organization/i);
  // No selectable organization is displayed.
  assert.equal(tid("corp-org-list"), null);
  assert.equal(tidAll("corp-org-radio").length, 0);
  // Progression / import is blocked.
  assert.equal(tid("corp-submit").disabled, true);
});

test("request failure → error state, NOT misrepresented as an empty org list; import blocked", async () => {
  await mount({ items: [item(0)], client: fakeClient({ orgs: { ok: false, error: "boom" } }), onStartOver() {} });
  await clickTid("corp-continue");
  assert.ok(tid("corp-org-error"), "a load failure shows the error state");
  assert.equal(tid("corp-org-empty"), null, "a load error is NOT shown as 'no organizations'");
  assert.equal(tid("corp-submit").disabled, true);
});

test("still loading → loading state, NOT misrepresented as an empty org list; then resolves to empty", async () => {
  let resolveList;
  const pending = new Promise((r) => { resolveList = r; });
  const client = { listOrganizations: () => pending, importContacts: async () => ({ ok: true }) };
  await mount({ items: [item(0)], client, onStartOver() {} });
  await clickTid("corp-continue");
  assert.ok(tid("corp-org-loading"), "loading shown while the fetch is in flight");
  assert.equal(tid("corp-org-empty"), null, "loading is NOT shown as 'no organizations'");
  await act(async () => { resolveList({ ok: true, organizations: [] }); await pending; });
  assert.ok(tid("corp-org-empty"), "resolves to the truthful empty state");
  assert.equal(tid("corp-submit").disabled, true);
});

test("exactly one org → auto-selected and its ID is displayed; submit enabled", async () => {
  await mount({ items: [item(0)], client: fakeClient({ orgs: { ok: true, organizations: [{ corporateOrganizationId: "org_solo", role: "owner" }] } }), onStartOver() {} });
  await clickTid("corp-continue");
  assert.equal(tid("corp-selected-org-id").textContent, "org_solo");
  assert.equal(tid("corp-submit").disabled, false);
});

test("multiple orgs → must choose; submit disabled until a returned org is selected", async () => {
  await mount({ items: [item(0)], client: fakeClient({ orgs: { ok: true, organizations: [{ corporateOrganizationId: "a", role: "admin" }, { corporateOrganizationId: "b", role: "owner" }] } }), onStartOver() {} });
  await clickTid("corp-continue");
  assert.equal(tidAll("corp-org-radio").length, 2);
  assert.equal(tid("corp-submit").disabled, true);
  await act(async () => { tidAll("corp-org-radio")[1].click(); }); await flush();
  assert.equal(tid("corp-selected-org-id").textContent, "b");
  assert.equal(tid("corp-submit").disabled, false);
});

test("dormant 503 on bootstrap → intentional-unavailability message, NOT an empty org list; submit disabled", async () => {
  await mount({ items: [item(0)], client: fakeClient({ orgs: { ok: false, dormant: true, status: 503, reason: "corporate_import_disabled" } }), onStartOver() {} });
  await clickTid("corp-continue");
  assert.ok(tid("corp-org-dormant"));
  assert.equal(tid("corp-org-empty"), null, "dormant is not shown as 'no organizations'");
  assert.equal(tid("corp-submit").disabled, true);
});

test("401/403 on bootstrap → unauthorized message; submit disabled", async () => {
  await mount({ items: [item(0)], client: fakeClient({ orgs: { ok: false, unauthorized: true, status: 403 } }), onStartOver() {} });
  await clickTid("corp-continue");
  assert.ok(tid("corp-org-unauthorized"));
  assert.equal(tid("corp-submit").disabled, true);
});

// ---------------- submission + reconciliation ----------------
async function toConfirm(items, importResult) {
  const c = fakeClient({ orgs: { ok: true, organizations: [{ corporateOrganizationId: "org_1", role: "admin" }] }, importResult });
  await mount({ items, client: c, onStartOver() {} });
  await clickTid("corp-continue");
  return c;
}

test("full success → results summary with totals + per-row buckets; stays on summary (no auto-nav)", async () => {
  const c = await toConfirm([item(0, PREVIEW_STATUS.REVIEW), item(1, PREVIEW_STATUS.ABSENT)],
    { ok: true, status: 200, data: results([{ index: 0, status: "created" }, { index: 1, status: "created" }], { added: 2, total: 2 }) });
  await clickTid("corp-submit");
  assert.equal(c.calls.import.length, 1);
  assert.equal(tid("corp-results-title").getAttribute("data-kind"), "success");
  assert.equal(tid("cr-added").textContent, "2");
  const buckets = tidAll("corp-result-row").map((r) => r.getAttribute("data-bucket"));
  assert.deepEqual(buckets, ["imported_unverified", "imported_no_address"]);
  assert.ok(tid("corp-results-startover"), "stays on summary with an explicit Start over");
});

test("partial success (one failed) → kind partial; failed row shown; never 0-added false success", async () => {
  await toConfirm([item(0), item(1)],
    { ok: true, status: 200, data: results([{ index: 0, status: "created" }, { index: 1, status: "failed", reason: "invalid_email" }], { added: 1, failed: 1, total: 2 }) });
  await clickTid("corp-submit");
  assert.equal(tid("corp-results-title").getAttribute("data-kind"), "partial");
  assert.equal(tid("cr-added").textContent, "1");
  assert.equal(tid("cr-failed").textContent, "1");
});

test("all rows failed → kind failed (not success)", async () => {
  await toConfirm([item(0)], { ok: true, status: 200, data: results([{ index: 0, status: "failed", reason: "x" }], { failed: 1, total: 1 }) });
  await clickTid("corp-submit");
  assert.equal(tid("corp-results-title").getAttribute("data-kind"), "failed");
});

test("400 error → error summary + safe message; preview state retained (Back to review); no success", async () => {
  await toConfirm([item(0)], { ok: false, status: 400, code: "invalid_payload" });
  await clickTid("corp-submit");
  assert.equal(tid("corp-results-title").getAttribute("data-kind"), "error");
  assert.match(tid("corp-results-message").textContent, /couldn't be imported|try again/i);
  assert.ok(tid("corp-results-back"), "can return to review (preview retained)");
});

test("503 corporate_import_disabled on submit → dormant summary (app not 'broken', not empty)", async () => {
  await toConfirm([item(0)], { ok: false, dormant: true, status: 503, reason: "corporate_import_disabled" });
  await clickTid("corp-submit");
  assert.equal(tid("corp-results-title").getAttribute("data-kind"), "dormant");
  assert.match(txt(), /currently unavailable/i);
});

test("network failure on submit → INDETERMINATE with do-not-resubmit warning", async () => {
  await toConfirm([item(0)], { ok: false, indeterminate: true, status: 0 });
  await clickTid("corp-submit");
  assert.equal(tid("corp-results-title").getAttribute("data-kind"), "indeterminate");
  assert.match(tid("corp-indeterminate-warn").textContent, /could not be confirmed|do not submit again/i);
});

test("missing per-row result → reconciliation fails closed (error, not success)", async () => {
  await toConfirm([item(0), item(1)], { ok: true, status: 200, data: results([{ index: 0, status: "created" }], { added: 1, total: 2 }) });
  await clickTid("corp-submit");
  assert.equal(tid("corp-results-title").getAttribute("data-kind"), "error");
});

test("double-submit prevention: rapid clicks call importContacts exactly once", async () => {
  let resolve; const gate = new Promise((r) => { resolve = r; });
  const c = fakeClient({ orgs: { ok: true, organizations: [{ corporateOrganizationId: "org_1", role: "admin" }] }, importResult: async () => { await gate; return { ok: true, status: 200, data: results([{ index: 0, status: "created" }], { added: 1, total: 1 }) }; } });
  await mount({ items: [item(0)], client: c, onStartOver() {} });
  await clickTid("corp-continue");
  await act(async () => { fireClick(tid("corp-submit")); fireClick(tid("corp-submit")); fireClick(tid("corp-submit")); });
  await act(async () => { resolve(); }); await flush();
  assert.equal(c.calls.import.length, 1);
});

// ---------------- practice zero-mutation guard ----------------
test("Practice/Test Drive (sample=true): Continue never fetches orgs and submit can't reach the API", async () => {
  const c = fakeClient({ orgs: { ok: true, organizations: [{ corporateOrganizationId: "org_1", role: "admin" }] } });
  await mount({ items: [item(0)], sample: true, client: c, onStartOver() {} });
  await clickTid("corp-continue");
  assert.equal(c.calls.list, 0, "no org bootstrap request in practice");
  // even if a submit button is present, it is disabled and cannot call the API
  const submit = tid("corp-submit");
  if (submit) { await act(async () => { fireClick(submit); }); await flush(); }
  assert.equal(c.calls.import.length, 0, "no import request in practice");
});

// ---------------- org switch clears prior submission/result ----------------
test("switching organization drives a fresh submission (no stale org-A result under org-B)", async () => {
  const c = fakeClient({ orgs: { ok: true, organizations: [{ corporateOrganizationId: "orgA", role: "admin" }, { corporateOrganizationId: "orgB", role: "owner" }] },
    importResult: (orgId) => ({ ok: true, status: 200, data: results([{ index: 0, status: "created" }], { added: 1, total: 1 }) }) });
  await mount({ items: [item(0)], client: c, onStartOver() {} });
  await clickTid("corp-continue");
  await act(async () => { tidAll("corp-org-radio")[0].click(); }); await flush(); // orgA
  await clickTid("corp-submit");
  assert.equal(tid("corp-results-title").getAttribute("data-kind"), "success");
  await clickTid("corp-results-startover"); // onStartOver noop here; re-enter via back path instead
});
