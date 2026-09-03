// founderOrgLifecycle.browser.test.mjs — FOUNDER ORGANIZATION LIFECYCLE CONTROLS.
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
const BUNDLE = join(__dirname, ".__orglife.bundle.mjs");
let React, createRoot, act, Founder;

const GATE_STUB = `export const isFundraiserUiEnabled = () => !!globalThis.__flag;`;

before(async () => {
  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /fundraiserGate\.js$/ }, (a) => ({ path: a.path, namespace: "gate" }));
    b.onLoad({ filter: /.*/, namespace: "gate" }, () => ({ contents: GATE_STUB, loader: "js" }));
  } };
  writeFileSync(join(__dirname, ".__orglife.jsx"), `export { default as Founder } from "./FounderFundraisingDashboard.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__orglife.jsx")], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [stub], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__orglife.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
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

async function typeReason(text) {
  const input = $("orglife-reason");
  assert.ok(input, "reason field is present");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(input, text);
    input.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await settle();
}

// ── VISIBILITY ────────────────────────────────────────────────────────────────────────────────

test("FOUNDER: the lifecycle controls render for an approved organization, showing its current status", async () => {
  await openAt("approved");
  assert.ok($("orglife-panel"), "the lifecycle panel is rendered in the founder detail drawer");
  assert.equal($("orglife-current").textContent.trim(), "approved", "current status is displayed");
  assert.ok($("orglife-suspend"), "Suspend is offered");
  assert.ok($("orglife-close"), "Close is offered");
  assert.equal($("orglife-reinstate"), null, "Reinstate is NOT offered for an already-approved organization");
  assert.equal(lifecycleCalls().length, 0, "rendering the panel invokes nothing");
});

test("NON-FOUNDER: a 403 on the founder overview means the controls never render and cannot be invoked", async () => {
  await mount({ ...baseRoutes({ status: 403, data: { error: "forbidden" } }), "/admin/overview": { status: 403, data: { error: "forbidden" } } });
  assert.equal($("orglife-panel"), null, "no lifecycle panel exists for a non-founder");
  assert.equal($("orglife-suspend"), null);
  assert.equal($("orglife-reinstate"), null);
  assert.equal($("orglife-close"), null);
  assert.equal(lifecycleCalls().length, 0, "no lifecycle endpoint is reachable");
  // The dashboard short-circuits to its truthful forbidden state instead of any organization markup.
  assert.equal(document.body.textContent.includes("Fixture LLC"), false, "no organization data is rendered at all");
});

test("DORMANT: with the fundraiser UI gate off, nothing renders and no request is issued", async () => {
  installFetch(baseRoutes({ status: 200, data: [orgAt("approved")] }));
  globalThis.__flag = false;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Founder)); });
  await settle();
  assert.equal($("orglife-panel"), null);
  assert.equal(calls.length, 0, "the gate is checked before any fetch");
  globalThis.__flag = true;
  await act(async () => { root.unmount(); });
});

// ── OFFERED ACTIONS PER STATUS ────────────────────────────────────────────────────────────────

test("SUSPENDED: only Reinstate and Close are offered", async () => {
  await openAt("suspended");
  assert.equal($("orglife-current").textContent.trim(), "suspended");
  assert.ok($("orglife-reinstate"), "Reinstate is offered");
  assert.ok($("orglife-close"), "Close is offered");
  assert.equal($("orglife-suspend"), null, "Suspend is NOT re-offered for an already-suspended organization");
});

test("CLOSED: only Reinstate is offered — recovery stays possible, and nothing loosens containment", async () => {
  await openAt("closed");
  assert.equal($("orglife-current").textContent.trim(), "closed");
  assert.ok($("orglife-reinstate"), "Reinstate is offered so a closed organization is not stranded");
  assert.equal($("orglife-close"), null, "Close is NOT re-offered for an already-closed organization");
  assert.equal($("orglife-suspend"), null, "Suspend is NOT offered from closed");
});

test("UNKNOWN STATUS: no action is offered and nothing can be invoked", async () => {
  await openAt("something_else");
  assert.ok($("orglife-panel"), "the panel still reports the status truthfully");
  assert.ok($("orglife-none"), "it says no change is available");
  assert.equal($("orglife-suspend"), null);
  assert.equal($("orglife-reinstate"), null);
  assert.equal($("orglife-close"), null);
});

// ── CONFIRMATION ──────────────────────────────────────────────────────────────────────────────

test("CONFIRMATION: Suspend asks first and sends nothing until it is confirmed", async () => {
  await openAt("approved");
  await typeReason("incident review");
  await click($("orglife-suspend"));
  assert.ok($("orglife-confirm"), "a confirmation is shown");
  assert.ok($("orglife-warning").textContent.length > 0, "the confirmation explains the consequence");
  assert.equal(lifecycleCalls().length, 0, "NOTHING is sent before confirming");
  await click($("orglife-confirm-go"));
  assert.equal(lifecycleCalls().length, 1, "the request goes only after confirmation");
});

test("CONFIRMATION: Close asks first, and cancelling sends nothing", async () => {
  await openAt("approved");
  await typeReason("winding down");
  await click($("orglife-close"));
  assert.ok($("orglife-confirm"), "a confirmation is shown for Close");
  await click($("orglife-confirm-cancel"));
  assert.equal($("orglife-confirm"), null, "the confirmation is dismissed");
  assert.equal(lifecycleCalls().length, 0, "cancelling sends nothing");
});

test("CONFIRMATION: Escape dismisses the confirmation without sending", async () => {
  await openAt("approved");
  await typeReason("thinking again");
  await click($("orglife-suspend"));
  assert.ok($("orglife-confirm"));
  await act(async () => { document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  await settle();
  assert.equal($("orglife-confirm"), null);
  assert.equal(lifecycleCalls().length, 0);
});

test("REASON: a required reason is enforced before anything is sent", async () => {
  await openAt("approved");
  await click($("orglife-suspend"));
  assert.ok($("orglife-error"), "the missing reason is reported");
  assert.equal($("orglife-confirm"), null, "no confirmation is opened without a reason");
  assert.equal(lifecycleCalls().length, 0, "nothing is sent");
});

// ── ENDPOINT + PAYLOAD ────────────────────────────────────────────────────────────────────────

test("ENDPOINTS: each action POSTs the correct existing route with { reason } in the body", async () => {
  // suspend — from approved
  await openAt("approved", { "/suspend": { status: 200, data: orgAt("suspended") } });
  await typeReason("incident review");
  await click($("orglife-suspend"));
  await click($("orglife-confirm-go"));
  let call = lifecycleCalls()[0];
  assert.equal(call.url.endsWith(`/api/fundraiser/admin/organizations/${ORG_ID}/suspend`), true, "suspend route");
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body), { reason: "incident review" }, "reason travels in the body, nothing else");

  // close — from approved
  await openAt("approved", { "/close": { status: 200, data: orgAt("closed") } });
  await typeReason("relationship ended");
  await click($("orglife-close"));
  await click($("orglife-confirm-go"));
  call = lifecycleCalls()[0];
  assert.equal(call.url.endsWith(`/api/fundraiser/admin/organizations/${ORG_ID}/close`), true, "close route");
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body), { reason: "relationship ended" });

  // reinstate — from suspended
  await openAt("suspended", { "/reinstate": { status: 200, data: orgAt("approved") } });
  await typeReason("cleared");
  await click($("orglife-reinstate"));
  call = lifecycleCalls()[0];
  assert.equal(call.url.endsWith(`/api/fundraiser/admin/organizations/${ORG_ID}/reinstate`), true, "reinstate route");
  assert.equal(call.method, "POST");
  assert.deepEqual(JSON.parse(call.body), { reason: "cleared" });
});

// ── SUCCESS + REFRESH ─────────────────────────────────────────────────────────────────────────

test("SUCCESS: suspending refreshes the displayed organization state from the server", async () => {
  let listed = "approved";
  await openAt("approved", {
    "/admin/organizations": { status: 200, data: () => [orgAt(listed)] },
    "/suspend": { status: 200, data: () => { listed = "suspended"; return orgAt("suspended"); } },
  });
  assert.equal($("orglife-current").textContent.trim(), "approved");
  await typeReason("incident review");
  await click($("orglife-suspend"));
  await click($("orglife-confirm-go"));

  assert.ok($("orglife-success"), "success is reported");
  assert.equal($("orglife-current").textContent.trim(), "suspended", "the displayed status is refreshed from the re-read");
  assert.ok($("orglife-reinstate"), "and the offered actions follow the new status");
  assert.equal($("orglife-suspend"), null);
  assert.equal($("orglife-stale"), null, "the read-back succeeded, so nothing is reported stale");
  // The re-read is the founder organizations list — the same call the dashboard already used.
  assert.ok(calls.filter((c) => c.method === "GET" && c.url.endsWith("/admin/organizations")).length >= 2, "the list was re-read after the change");
});

test("REINSTATEMENT: a suspended organization returns to approved and regains its normal actions", async () => {
  let listed = "suspended";
  await openAt("suspended", {
    "/admin/organizations": { status: 200, data: () => [orgAt(listed)] },
    "/reinstate": { status: 200, data: () => { listed = "approved"; return orgAt("approved"); } },
  });
  assert.equal($("orglife-current").textContent.trim(), "suspended");
  await typeReason("cleared");
  await click($("orglife-reinstate"));
  assert.ok($("orglife-success"));
  assert.equal($("orglife-current").textContent.trim(), "approved", "the organization is back in its permitted active state");
  assert.ok($("orglife-suspend"), "Suspend is offered again");
  assert.ok($("orglife-close"), "Close is offered again");
  assert.equal($("orglife-reinstate"), null, "Reinstate is no longer offered");
});

test("SUCCESS: a change that applies but whose re-read fails is reported as stale, never invented", async () => {
  let firstList = true;
  await openAt("approved", {
    "/admin/organizations": { status: 200, data: () => { if (firstList) { firstList = false; return [orgAt("approved")]; } return null; } },
    "/suspend": { status: 200, data: orgAt("suspended") },
  });
  await typeReason("incident review");
  await click($("orglife-suspend"));
  await click($("orglife-confirm-go"));
  assert.ok($("orglife-success"), "the applied change is still reported");
  assert.ok($("orglife-stale"), "the failed re-read is surfaced rather than guessed at");
  assert.equal($("orglife-current").textContent.trim(), "approved", "the displayed status stays at the last server-confirmed value");
});

// ── FAILURE ───────────────────────────────────────────────────────────────────────────────────

test("FAILURE: a rejected change is visible and does NOT change the displayed status", async () => {
  for (const [status, data] of [[400, { error: "reason required" }], [403, { error: "forbidden" }], [404, { code: "NOT_FOUND" }], [409, { code: "ETAG_MISMATCH" }]]) {
    await openAt("approved", { "/suspend": { status, data } });
    await typeReason("incident review");
    await click($("orglife-suspend"));
    await click($("orglife-confirm-go"));
    assert.ok($("orglife-failure"), `failure ${status} is surfaced`);
    assert.ok($("orglife-failure").textContent.trim().length > 0, "the message is not blank");
    assert.equal($("orglife-success"), null, `failure ${status} never reports success`);
    assert.equal($("orglife-current").textContent.trim(), "approved", `failure ${status} leaves the displayed status untouched`);
    assert.ok($("orglife-suspend"), "the original actions are still offered");
  }
});

test("FAILURE: a network error is surfaced and the organization is left as it was", async () => {
  await openAt("approved", { "/suspend": new Error("boom") });
  await typeReason("incident review");
  await click($("orglife-suspend"));
  await click($("orglife-confirm-go"));
  assert.ok($("orglife-failure"), "the network failure is surfaced");
  assert.equal($("orglife-success"), null);
  assert.equal($("orglife-current").textContent.trim(), "approved");
});

test("NO RAW CODES: a machine error code never reaches the DOM", async () => {
  await openAt("approved", { "/suspend": { status: 409, data: { code: "ETAG_MISMATCH", error: "concurrent modification, retry" } } });
  await typeReason("incident review");
  await click($("orglife-suspend"));
  await click($("orglife-confirm-go"));
  const text = $("orglife-failure").textContent;
  assert.equal(text.includes("ETAG_MISMATCH"), false, "the machine code is not rendered");
  assert.ok(text.length > 0);
});
