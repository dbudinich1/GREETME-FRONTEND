// founderOrgSalesperson.browser.test.mjs — PRE-2 enabling field: "Originating salesperson" on create-organization.
//
// The backend (POST /api/fundraiser/admin/organizations) already binds a FUNDRAISER_PARTNER origination when the body
// carries a validated `salespersonId`; the founder form never sent it. RENDERED coverage: the REAL
// FounderFundraisingDashboard is esbuild-transformed and mounted in jsdom with the REAL fundraiserApi + salesAdminApi
// clients over a controllable global fetch. Only the flag gate is stubbed (same harness as founderOrgLifecycle).
//
// Proves: the select defaults to None · lists only ACTIVE salespeople from the existing sales-admin endpoint ·
// None sends exactly { legalName, orgType } (no salespersonId key) · a chosen salesperson is sent as salespersonId ·
// a failed salespeople read leaves only None and creation still works.
//
// Run under the supported runtime (engines: node 20.x):
//   node --test src/pages/fundraiser/founderOrgSalesperson.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
// CLEAN_SCRATCH: scratch files carry this process id in their name, so concurrent suites cannot collide; all are removed on exit.
import { readdirSync as __scratchLs, rmSync as __scratchRm } from "node:fs";
process.on("exit", () => { try { for (const n of __scratchLs(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __scratchRm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const BUNDLE = join(__dirname, `.__orgsp.${process.pid}.bundle.mjs`);
let React, createRoot, act, Founder;

const GATE_STUB = `export const isFundraiserUiEnabled = () => !!globalThis.__flag;`;

before(async () => {
  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /fundraiserGate\.js$/ }, (a) => ({ path: a.path, namespace: "gate" }));
    b.onLoad({ filter: /.*/, namespace: "gate" }, () => ({ contents: GATE_STUB, loader: "js" }));
  } };
  writeFileSync(join(__dirname, `.__orgsp.${process.pid}.jsx`), `export { default as Founder } from "./FounderFundraisingDashboard.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, `.__orgsp.${process.pid}.jsx`)], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [stub], logLevel: "silent",
  });
  rmSync(join(__dirname, `.__orgsp.${process.pid}.jsx`), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  try { globalThis.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ } globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.MouseEvent = window.MouseEvent;
  globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Founder } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

let calls = [];
function installFetch(routes) {
  calls = [];
  globalThis.fetch = (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || "GET", body: opts.body });
    const key = Object.keys(routes).find((k) => u.endsWith(k)) || Object.keys(routes).find((k) => u.includes(k));
    const r = key ? routes[key] : { status: 200, data: {} };
    const body = typeof r.data === "function" ? r.data() : r.data;
    return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => body });
  };
}

const OVERVIEW = { organizations: { total: 0 }, campaigns: { total: 0 }, participants: { total: 0 }, economics: { activeVersions: 0 } };
const SALESPEOPLE = [
  { salespersonId: "sp-ann", displayName: "Ann Seller", status: "active" },
  { salespersonId: "sp-old", displayName: "Old Rep", status: "inactive" },
  { salespersonId: "sp-bo", displayName: "", status: "active" },
];
const routes = (salesRoute = { status: 200, data: { ok: true, salespeople: SALESPEOPLE } }) => ({
  "/admin/overview": { status: 200, data: OVERVIEW },
  "/admin/organizations": { status: 200, data: [] },
  "/api/sales/admin/salespeople": salesRoute,
});

const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);

async function mount(r) {
  installFetch(r);
  globalThis.__flag = true;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Founder)); });
  await settle();
  return root;
}

async function setValue(el, value) {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
  await act(async () => { setter.call(el, value); el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
}
async function submitCreate(name) {
  await setValue(document.querySelector('input[placeholder="Legal name"]'), name);
  const form = document.querySelector('input[placeholder="Legal name"]').closest("form");
  await act(async () => { form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  await settle();
  const post = calls.filter((c) => c.method === "POST" && c.url.endsWith("/api/fundraiser/admin/organizations"));
  assert.equal(post.length, 1, "exactly one create request");
  return JSON.parse(post[0].body);
}

test("defaults to None and lists only ACTIVE salespeople from the sales-admin endpoint", async () => {
  const root = await mount(routes());
  const sel = $("org-salesperson");
  assert.ok(sel, "the field is rendered");
  assert.equal(sel.value, "", "None is the default");
  const opts = [...sel.options].map((o) => [o.value, o.textContent]);
  assert.deepEqual(opts, [["", "Originating salesperson: None"], ["sp-ann", "Ann Seller (sp-ann)"], ["sp-bo", "sp-bo"]]);
  assert.ok(calls.some((c) => c.method === "GET" && c.url.endsWith("/api/sales/admin/salespeople")), "existing endpoint used");
  await act(async () => root.unmount());
});

test("None ⇒ the create body is exactly { legalName, orgType } (no salespersonId key)", async () => {
  const root = await mount(routes());
  const body = await submitCreate("Lincoln High PTA");
  assert.deepEqual(body, { legalName: "Lincoln High PTA", orgType: "school" });
  assert.ok(!Object.prototype.hasOwnProperty.call(body, "salespersonId"));
  await act(async () => root.unmount());
});

test("a chosen salesperson is sent as salespersonId, and the field resets to None after success", async () => {
  const root = await mount(routes());
  await setValue($("org-salesperson"), "sp-ann");
  const body = await submitCreate("Riverside Boosters");
  assert.deepEqual(body, { legalName: "Riverside Boosters", orgType: "school", salespersonId: "sp-ann" });
  assert.equal($("org-salesperson").value, "", "reset to None after a successful create");
  await act(async () => root.unmount());
});

test("a failed salespeople read leaves only None, and creating an organization still works", async () => {
  const root = await mount(routes({ status: 403, data: { error: "forbidden" } }));
  const sel = $("org-salesperson");
  assert.deepEqual([...sel.options].map((o) => o.value), [""]);
  const body = await submitCreate("Eastside Youth");
  assert.deepEqual(body, { legalName: "Eastside Youth", orgType: "school" });
  await act(async () => root.unmount());
});
