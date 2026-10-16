// founderOrgLifecycle.browser.test.mjs — FOUNDER ORGANIZATION LIFECYCLE CONTROLS.
//
// Report 87 A7 / N6: restored from b9c74f4 and PORTED to the rev 6 controls (Activation box: Suspend,
// Reinstate, and the least-prominent "Close organization"). Same seventeen intents.
//
// RENDERED coverage of the suspend / reinstate / close control block. The REAL
// FounderFundraisingDashboard is esbuild-transformed and mounted in jsdom with the REAL
// fundraiserApi client over a controllable global fetch. Only the flag gate is stubbed — exactly
// the harness founderPartnerAdmin.browser.test.mjs established.
//
// Proves: founder visibility · non-founder cannot see or invoke · each action hits the correct
// existing endpoint with the correct payload · confirmation required for the destructive moves ·
// suspended/closed expose only valid next actions · reinstatement returns the org to approved ·
// success refreshes the displayed state · failure is visible and changes nothing displayed.
//
// Run under the supported runtime (engines: node 20.x):
//   node --test src/pages/fundraiser/founderOrgLifecycle.browser.test.mjs

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
const BUNDLE = join(__dirname, `.__orglife.${process.pid}.bundle.mjs`);
let React, createRoot, act, Founder;

const GATE_STUB = `export const isFundraiserUiEnabled = () => !!globalThis.__flag;`;

before(async () => {
  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /fundraiserGate\.js$/ }, (a) => ({ path: a.path, namespace: "gate" }));
    b.onLoad({ filter: /.*/, namespace: "gate" }, () => ({ contents: GATE_STUB, loader: "js" }));
  } };
  writeFileSync(join(__dirname, `.__orglife.${process.pid}.jsx`), `export { default as Founder } from "./FounderFundraisingDashboard.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, `.__orglife.${process.pid}.jsx`)], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [stub], logLevel: "silent",
  });
  rmSync(join(__dirname, `.__orglife.${process.pid}.jsx`), { force: true });

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

const ORG_ID = "org_fixture";
const orgAt = (status) => ({ organizationId: ORG_ID, legalName: "Fixture LLC", orgType: "other", status, adminUserIds: [] });

// Route-aware fetch. `routes` maps a URL suffix to { status, data } | Error | "pending".
// `data` may be a function, so a route can answer differently on each call (used to prove the
// read-back after a successful change).
let calls = [];
function installFetch(routes) {
  calls = [];
  globalThis.fetch = (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || "GET", body: opts.body });
    const key = Object.keys(routes).find((k) => u.endsWith(k)) || Object.keys(routes).find((k) => u.includes(k));
    const r = key ? routes[key] : { status: 200, data: {} };
    if (r === "pending") return new Promise(() => {});
    if (r instanceof Error) return Promise.reject(r);
    const body = typeof r.data === "function" ? r.data() : r.data;
    return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => body });
  };
}

const OVERVIEW = { organizations: { total: 1 }, campaigns: { total: 0 }, participants: { total: 0 }, economics: { activeVersions: 0 } };
const baseRoutes = (orgsRoute) => ({
  "/admin/overview": { status: 200, data: OVERVIEW },
  "/admin/organizations": orgsRoute,
  "/totals/participants": { status: 200, data: { participants: 0, attributionRecords: 0 } },
  "/totals/ledger": { status: 200, data: { conversions: 0, renewals: 0, refunds: 0 } },
  "/reconciliation": { status: 200, data: { reconciled: true } },
  "/payouts/status": { status: 503, data: { disabled: true } },
  "/audit": { status: 200, data: [] },
  "/campaigns": { status: 200, data: [] },
  "/terms": { status: 200, data: { terms: null, history: [] } },
});

const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await settle(); };
const lifecycleCalls = () => calls.filter((c) => /\/(suspend|reinstate|close)$/.test(c.url));

async function mount(routes) {
  installFetch(routes);
  globalThis.__flag = true;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Founder)); });
  await settle();
  return root;
}
async function mountAndOpen(routes) {
  const root = await mount(routes);
  const open = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Open");
  assert.ok(open, "the organization row must offer Open");
  await click(open);
  return root;
}
/** Mount at a given organization status and open its detail drawer. */
const openAt = (status, extra = {}) => mountAndOpen({ ...baseRoutes({ status: 200, data: [orgAt(status)] }), ...extra });

async function setReason(prefix, text) {
  const input = $(`${prefix}-reason`);
  assert.ok(input, "reason field is present");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, text);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await settle();
}
const offered = () => ["suspend", "reinstate", "orglife-close", "end-partnership", "activate"].filter((id) => $(id));
async function suspendWith(reason) { await click($("suspend")); if (reason !== undefined) await setReason("suspend-confirm", reason); }

// ── VISIBILITY ────────────────────────────────────────────────────────────────────────────────

test("FOUNDER: the lifecycle controls render for an approved organization, showing its current status", async () => {
  await openAt("approved");
  assert.ok($("activation"), "the Activation box renders on the partner page");
  assert.match($("partner-detail").textContent, /Active/, "current status is displayed");
  assert.deepEqual(offered(), ["suspend", "orglife-close", "end-partnership"]);
});

test("NON-FOUNDER: a 403 on the founder overview means the controls never render and cannot be invoked", async () => {
  await mount({ ...baseRoutes({ status: 200, data: [orgAt("approved")] }), "/admin/overview": { status: 403, data: { error: "forbidden" } } });
  assert.equal($("activation"), null);
  assert.deepEqual(offered(), []);
  assert.equal(lifecycleCalls().length, 0);
});

test("DORMANT: with the fundraiser UI gate off, nothing renders and no request is issued", async () => {
  installFetch(baseRoutes({ status: 200, data: [orgAt("approved")] }));
  globalThis.__flag = false;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Founder)); });
  await settle();
  assert.equal(calls.length, 0);
  assert.equal($("activation"), null);
  await act(async () => root.unmount());
});

test("SUSPENDED: only Reinstate and Close are offered", async () => {
  await openAt("suspended");
  assert.deepEqual(offered(), ["reinstate", "orglife-close"]);
});

test("CLOSED: only Reinstate is offered — recovery stays possible, and nothing loosens containment", async () => {
  await openAt("closed");
  assert.deepEqual(offered(), ["reinstate"]);
});

test("UNKNOWN STATUS: no action is offered and nothing can be invoked", async () => {
  await openAt("weird_status");
  assert.deepEqual(offered(), []);
  assert.equal(lifecycleCalls().length, 0);
});

// ── CONFIRMATION ──────────────────────────────────────────────────────────────────────────────

test("CONFIRMATION: Suspend asks first and sends nothing until it is confirmed", async () => {
  await openAt("approved");
  await suspendWith("Fraud review");
  assert.ok($("suspend-confirm"), "a confirmation is shown");
  assert.match($("suspend-confirm").textContent, /public referral links stop resolving/);
  assert.equal(lifecycleCalls().length, 0, "nothing is sent before confirming");
  await click($("suspend-confirm-yes"));
  assert.equal(lifecycleCalls().length, 1);
});

test("CONFIRMATION: Close asks first, and cancelling sends nothing", async () => {
  await openAt("approved");
  await click($("orglife-close"));
  assert.match($("close-org-confirm").textContent, /Close Fixture LLC\?/);
  await setReason("close-org-confirm", "Ended");
  await click([...$("close-org-confirm").querySelectorAll("button")].find((b) => b.textContent === "Cancel"));
  assert.equal($("close-org-confirm"), null);
  assert.equal(lifecycleCalls().length, 0);
});

test("CONFIRMATION: Escape dismisses the confirmation without sending", async () => {
  await openAt("approved");
  await suspendWith("Fraud review");
  await act(async () => { document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  await settle();
  assert.equal($("suspend-confirm"), null);
  assert.equal(lifecycleCalls().length, 0);
});

test("REASON: a required reason is enforced before anything is sent", async () => {
  await openAt("approved");
  await suspendWith();
  await click($("suspend-confirm-yes"));
  assert.match($("suspend-confirm").textContent, /Say why this organization is changing status\./);
  await setReason("suspend-confirm", "   ");
  await click($("suspend-confirm-yes"));
  assert.equal(lifecycleCalls().length, 0);
});

test("ENDPOINTS: each action POSTs the correct existing route with { reason } in the body", async () => {
  for (const [status, open, prefix, route] of [["approved", "suspend", "suspend-confirm", "suspend"], ["suspended", "reinstate", "reinstate-confirm", "reinstate"], ["approved", "orglife-close", "close-org-confirm", "close"]]) {
    await openAt(status);
    await click($(open));
    await setReason(prefix, "  Board decision  ");
    await click($(`${prefix}-yes`));
    const c = lifecycleCalls().at(-1);
    assert.ok(c.url.endsWith(`/api/fundraiser/admin/organizations/${ORG_ID}/${route}`), c.url);
    assert.equal(c.method, "POST");
    assert.deepEqual(JSON.parse(c.body), { reason: "Board decision" });
  }
});

// ── OUTCOMES ──────────────────────────────────────────────────────────────────────────────────

test("SUCCESS: suspending refreshes the displayed organization state from the server", async () => {
  let reads = 0;
  await openAt("approved", { "/admin/organizations": { status: 200, data: () => [orgAt(++reads > 1 ? "suspended" : "approved")] }, "/suspend": { status: 200, data: orgAt("suspended") } });
  await suspendWith("Fraud review");
  await click($("suspend-confirm-yes"));
  assert.ok(reads >= 2, "the organization list is re-read");
  assert.match($("partner-detail").textContent, /Suspended/);
  assert.match($("orglife-success").textContent, /Suspend applied\./);
  assert.deepEqual(offered(), ["reinstate", "orglife-close"]);
});

test("REINSTATEMENT: a suspended organization returns to approved and regains its normal actions", async () => {
  let reads = 0;
  await openAt("suspended", { "/admin/organizations": { status: 200, data: () => [orgAt(++reads > 1 ? "approved" : "suspended")] }, "/reinstate": { status: 200, data: orgAt("approved") } });
  await click($("reinstate"));
  await setReason("reinstate-confirm", "Review cleared");
  await click($("reinstate-confirm-yes"));
  assert.match($("partner-detail").textContent, /Active/);
  assert.deepEqual(offered(), ["suspend", "orglife-close", "end-partnership"]);
});

test("SUCCESS: a change that applies but whose re-read fails is reported as stale, never invented", async () => {
  let reads = 0;
  await openAt("approved", { "/suspend": { status: 200, data: orgAt("suspended") } });
  // From now on the organization list fails to re-read.
  const orig = globalThis.fetch;
  globalThis.fetch = (url, opts) => (String(url).endsWith("/admin/organizations") && (opts?.method || "GET") === "GET" && ++reads >= 1
    ? Promise.resolve({ ok: false, status: 500, json: async () => ({}) }) : orig(url, opts));
  await suspendWith("Fraud review");
  await click($("suspend-confirm-yes"));
  assert.ok($("orglife-stale"), "the founder is told the list could not be re-read");
  assert.match($("partner-detail").textContent, /Active/, "the last server-confirmed status stands");
});

test("FAILURE: a rejected change is visible and does NOT change the displayed status", async () => {
  await openAt("approved", { "/suspend": { status: 400, data: { error: "reason required" } } });
  await suspendWith("x");
  await click($("suspend-confirm-yes"));
  assert.match($("suspend-confirm").textContent, /That was rejected\. Nothing was changed\./);
  assert.match($("partner-detail").textContent, /Active/);
  assert.equal($("orglife-success"), null);
});

test("FAILURE: a network error is surfaced and the organization is left as it was", async () => {
  await openAt("approved", { "/suspend": new Error("network down") });
  await suspendWith("x");
  await click($("suspend-confirm-yes"));
  assert.match($("suspend-confirm").textContent, /Couldn’t reach the server\. Nothing was changed\./);
  assert.match($("partner-detail").textContent, /Active/);
});

test("NO RAW CODES: a machine error code never reaches the DOM", async () => {
  await openAt("approved", { "/suspend": { status: 409, data: { code: "ETAG_MISMATCH", error: "precondition failed etag" } } });
  await suspendWith("x");
  await click($("suspend-confirm-yes"));
  assert.ok(!document.body.textContent.includes("ETAG_MISMATCH"));
  assert.ok(!document.body.textContent.includes("precondition failed"));
});
