// src/pages/fundraiser/founderApproveEconomics.browser.test.mjs
//
// TEAM B (F2) — RENDERED coverage of REVIEW AND APPROVE on the founder dashboard. The REAL
// FounderFundraisingDashboard is esbuild-transformed and mounted in jsdom against the REAL
// fundraiserApi client over a controllable global fetch. Only the fundraiser flag gate is stubbed.
//
// Approval SEALS terms: it cannot be undone by editing. So these tests are written to fail if the
// UI ever seals something the founder did not see, seals without a stated reason, seals without an
// explicit confirmation, seals a version the client assembled rather than one the server holds, or
// claims a seal the server never granted. Approval is also NOT activation — nothing here may
// activate economics, touch the campaign, or move payouts.
//
// Run under the supported runtime (engines: node 20.x):
//   node --test src/pages/fundraiser/founderApproveEconomics.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__f2founder.bundle.mjs");
let React, createRoot, act, Founder, window;

const GATE_STUB = `export const isFundraiserUiEnabled = () => !!globalThis.__flag;`;

let storageWrites = [];
let consoleLines = [];

before(async () => {
  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /fundraiserGate\.js$/ }, (a) => ({ path: a.path, namespace: "gate" }));
    b.onLoad({ filter: /.*/, namespace: "gate" }, () => ({ contents: GATE_STUB, loader: "js" }));
  } };
  const entry = join(__dirname, ".__f2founder.jsx");
  writeFileSync(entry, `export { default as Founder } from "./FounderFundraisingDashboard.jsx";\n`);
  await esbuild.build({
    entryPoints: [entry], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [stub], logLevel: "silent",
  });
  rmSync(entry, { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/founder" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.MouseEvent = window.MouseEvent;
  globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  // Sealing terms must not touch anything but the server. Storage writes and console output are
  // recorded so "nothing else changed" is proven rather than assumed.
  for (const store of [window.localStorage, window.sessionStorage]) {
    for (const m of ["setItem", "removeItem", "clear"]) {
      const orig = store[m].bind(store);
      store[m] = (...a) => { storageWrites.push({ method: m, key: a[0] }); return orig(...a); };
    }
  }
  for (const m of ["log", "warn", "error", "info", "debug"]) {
    const orig = console[m].bind(console);
    console[m] = (...a) => { consoleLines.push({ method: m, text: String(a[0]) }); return orig(...a); };
  }

  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Founder } = await import(pathToFileURL(BUNDLE).href));

  // A pre-existing auth token, so "the token is unchanged" is a real observation.
  window.localStorage.setItem("token", "tkn_founder_fixture");
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

// ── fixtures ──────────────────────────────────────────────────────────────────────────────────
const ORG = { organizationId: "org_ce665b98", legalName: "NJ Mediation Service", orgType: "nonprofit", status: "approved", adminUserIds: [] };
const CAMPAIGNS = [
  { campaignId: "cmp_dccf5283", organizationId: ORG.organizationId, title: "Spring Drive", status: "draft" },
  { campaignId: "cmp_fall00042", organizationId: ORG.organizationId, title: "Fall Drive", status: "active" },
];
const OVERVIEW = { organizations: { total: 1 }, campaigns: { total: 2 }, participants: { total: 0 }, economics: { activeVersions: 0 } };

const TREATMENTS = Object.freeze({
  onboardingFeeTreatment: "excluded_retained",
  veteransContributionTreatment: "excluded",
  discountTreatment: "ineligible",
  taxTreatment: "excluded_from_base",
  processorFeeTreatment: "net_of_processor",
});

/** A complete DRAFT exactly as the economics history returns it. */
const DRAFT = Object.freeze({
  id: "economics_draft_v4", organizationId: ORG.organizationId, campaignId: CAMPAIGNS[0].campaignId,
  economicsVersion: 4, status: "draft",
  rules: {
    initialSubscriptionShare: { type: "percent_of_base", basis: "ENSR", percent: 10 },
    renewalShare: { type: "none" },
    giftParticipationEnabled: false,
  },
  treatments: { ...TREATMENTS },
});

const DRAFT_WITH_GIFT = Object.freeze({
  ...DRAFT, id: "economics_draft_gift_v6", economicsVersion: 6,
  rules: {
    initialSubscriptionShare: { type: "custom", notes: "flat $3 per conversion" },
    renewalShare: { type: "percent_of_base", basis: "ENGP", percent: 12.5 },
    giftParticipationEnabled: true,
    giftShare: { type: "percent_of_base", basis: "gross", percent: 3 },
  },
});

/** The server's answer to a successful approval: the same version, sealed. */
const SEALED = { ...DRAFT, status: "approved", approvedBy: "founder_1", approvedAt: "2026-08-31T00:00:00.000Z" };

const withStatus = (status, over = {}) => ({ ...DRAFT, id: `economics_${status}_v9`, status, ...over });

// ── harness ───────────────────────────────────────────────────────────────────────────────────
let calls = [];
let activeRoutes = null;

function installFetch(routes) {
  calls = [];
  activeRoutes = routes;
  globalThis.fetch = (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || "GET", body: opts.body, headers: opts.headers || {} });
    // Suffix-first: "/economics/history" and the approve path both contain "/economics".
    const key = Object.keys(activeRoutes).find((k) => u.endsWith(k)) || Object.keys(activeRoutes).find((k) => u.includes(k));
    const r = key ? activeRoutes[key] : { status: 200, data: {} };
    if (r === "pending") return new Promise(() => {});
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.data });
  };
  return routes;
}

const baseRoutes = (over = {}) => ({
  "/admin/overview": { status: 200, data: OVERVIEW },
  "/admin/organizations": { status: 200, data: [ORG] },
  "/totals/participants": { status: 200, data: { participants: 0, attributionRecords: 0 } },
  "/totals/ledger": { status: 200, data: { conversions: 0, renewals: 0, refunds: 0 } },
  "/reconciliation": { status: 200, data: { reconciled: true } },
  "/payouts/status": { status: 503, data: { disabled: true } },
  "/audit": { status: 200, data: [] },
  "/campaigns": { status: 200, data: CAMPAIGNS },
  "/economics/history": { status: 200, data: [DRAFT] },
  "/economics/draft": { status: 200, data: { id: "economics_from_CREATE_response", status: "draft" } },
  "/approve": { status: 200, data: SEALED },
  ...over,
});

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await settle(); };

async function setSelect(id, value) {
  const el = $(id);
  assert.ok(el, `expected a control [data-testid="${id}"]`);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await settle();
}
async function typeReason(text) {
  const el = $("f2-reason");
  assert.ok(el, "expected the approval-reason field");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value").set;
    setter.call(el, text);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await settle();
}
async function pressEscape() {
  await act(async () => {
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await settle();
}

async function mount(routes, { flag = true } = {}) {
  installFetch(routes);
  storageWrites = []; consoleLines = [];
  globalThis.__flag = flag;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Founder)); });
  await settle();
  return root;
}

/** Mount, open the fixture organization, and select the campaign that owns the draft. */
async function openDraft(routes = baseRoutes(), campaign = CAMPAIGNS[0].campaignId) {
  await mount(routes);
  const row = [...document.querySelectorAll("tr")].find((tr) => tr.textContent.includes(ORG.legalName));
  assert.ok(row, "the organization row must render");
  await click([...row.querySelectorAll("button")].find((b) => b.textContent.trim() === "Open"));
  await setSelect("f1-campaign", campaign);
  return routes;
}

const approveCalls = () => calls.filter((c) => c.method === "POST" && c.url.includes("/approve"));
const historyReads = () => calls.filter((c) => c.url.includes("/economics/history"));

/** The full happy path up to (but not through) the confirmation. */
async function reviewAndOpenConfirm(reason = "Signed term sheet 2026-08-31, counsel reviewed.") {
  await typeReason(reason);
  await click($("f2-open"));
}

beforeEach(() => { storageWrites = []; consoleLines = []; });

// ── 1 · the control exists only for a server-returned DRAFT ───────────────────────────────────

test("F2 eligibility: a complete server DRAFT offers review and approval", async () => {
  await openDraft();
  assert.ok($("f2-panel"), "the draft awaiting approval is surfaced");
  assert.ok($("f2-review"), "and is reviewed before anything can be approved");
  assert.ok($("f2-open"), "the approval control is offered");
  assert.equal($("f2-incomplete"), null);
});

for (const status of ["active", "approved", "suspended", "superseded", "archived"]) {
  test(`F2 eligibility: a ${status} version offers NO approval control`, async () => {
    await openDraft(baseRoutes({ "/economics/history": { status: 200, data: [withStatus(status)] } }));
    assert.equal($("f2-panel"), null, `${status} terms are sealed or spent; approval must not be offered`);
    assert.equal($("f2-open"), null);
    assert.equal($("f2-reason"), null);
    assert.equal(approveCalls().length, 0);
  });
}

test("F2 eligibility: an INCOMPLETE draft is reviewable but not approvable", async () => {
  const incomplete = { ...DRAFT, rules: { ...DRAFT.rules,
    initialSubscriptionShare: { type: "percent_of_base", basis: "ENSR", percent: null } } };
  await openDraft(baseRoutes({ "/economics/history": { status: 200, data: [incomplete] } }));
  assert.ok($("f2-review"), "the founder can still see what is there");
  assert.ok($("f2-incomplete"), "and is told plainly why it cannot be approved");
  assert.equal($("f2-open"), null, "no approval control for incomplete terms");
  assert.equal($("f2-reason"), null);
  assert.equal(approveCalls().length, 0);
});

test("F2 eligibility: a draft missing a treatment is not approvable", async () => {
  const t = { ...TREATMENTS }; delete t.taxTreatment;
  await openDraft(baseRoutes({ "/economics/history": { status: 200, data: [{ ...DRAFT, treatments: t }] } }));
  assert.ok($("f2-incomplete"));
  assert.equal($("f2-open"), null);
});

test("F2 eligibility: gift participation ON with an unresolvable gift share is not approvable", async () => {
  const bad = { ...DRAFT, rules: { ...DRAFT.rules, giftParticipationEnabled: true, giftShare: { type: "custom", notes: "  " } } };
  await openDraft(baseRoutes({ "/economics/history": { status: 200, data: [bad] } }));
  assert.ok($("f2-incomplete"));
  assert.equal($("f2-open"), null);
});

test("F2 eligibility: with no economics history at all there is nothing to approve", async () => {
  await openDraft(baseRoutes({ "/economics/history": { status: 200, data: [] } }));
  assert.equal($("f2-panel"), null);
  assert.equal(approveCalls().length, 0);
});

test("F2 eligibility: before a campaign is chosen there is no approval control", async () => {
  await mount(baseRoutes());
  const row = [...document.querySelectorAll("tr")].find((tr) => tr.textContent.includes(ORG.legalName));
  await click([...row.querySelectorAll("button")].find((b) => b.textContent.trim() === "Open"));
  assert.equal($("f2-panel"), null, "no campaign selected means no draft and no approval");
  assert.equal(approveCalls().length, 0);
});

// ── 2 · the whole draft is shown before it can be sealed ──────────────────────────────────────

test("F2 review: the entire draft is displayed read-only before approval", async () => {
  await openDraft();
  assert.equal($("f2-review-org").textContent, ORG.legalName);
  assert.match($("f2-review-campaign").textContent, new RegExp(CAMPAIGNS[0].campaignId));
  assert.match($("f2-review-campaign").textContent, /Spring Drive/);
  assert.equal($("f2-review-initial").textContent, "10% of ENSR");
  assert.equal($("f2-review-renewal").textContent, "none");
  assert.equal($("f2-review-gift-position").textContent, "off");
  assert.equal($("f2-review-gift"), null, "no gift share is shown while participation is off");
  for (const [k, v] of Object.entries(TREATMENTS)) {
    assert.equal($(`f2-review-${k}`).textContent, v, `${k} is shown`);
  }
  assert.equal($("f2-review-version").textContent, DRAFT.id);
  assert.equal($("f2-review-status").textContent, "draft");
  // The review is a statement of fact, not a form.
  assert.equal($("f2-review").querySelectorAll("input, select, textarea, button").length, 0,
    "the reviewed terms expose no editable control");
});

test("F2 review: gift participation ON shows the position and the gift share", async () => {
  await openDraft(baseRoutes({ "/economics/history": { status: 200, data: [DRAFT_WITH_GIFT] } }));
  assert.equal($("f2-review-gift-position").textContent, "on");
  assert.equal($("f2-review-gift").textContent, "3% of gross");
  assert.equal($("f2-review-initial").textContent, "custom — flat $3 per conversion");
  assert.equal($("f2-review-renewal").textContent, "12.5% of ENGP");
  assert.equal($("f2-review-version").textContent, DRAFT_WITH_GIFT.id);
});

test("F2 review: the consequences of approving are stated before, not after", async () => {
  await openDraft();
  const notice = $("f2-notice").textContent.replace(/\s+/g, " ").toLowerCase();
  assert.match(notice, /seals these terms/);
  assert.match(notice, /cannot be edited/);
  assert.match(notice, /does not activate economics/);
  assert.match(notice, /does not activate the campaign/);
  assert.match(notice, /payouts remain held/);
  assert.ok(!/\\u[0-9a-f]{4}/i.test($("f2-panel").textContent), "no unrendered escape sequences");
});

test("F2 review: the highest-numbered draft is the one offered", async () => {
  const older = { ...DRAFT, id: "economics_draft_v2", economicsVersion: 2 };
  await openDraft(baseRoutes({ "/economics/history": { status: 200, data: [older, DRAFT] } }));
  assert.equal($("f2-review-version").textContent, DRAFT.id);
  assert.equal($("f2-review-status").textContent, "draft");
});

// ── 3 · a reason is required ──────────────────────────────────────────────────────────────────

test("F2 reason: the field starts empty — no reason is ever pre-written", async () => {
  await openDraft();
  assert.equal($("f2-reason").value, "", "an approval reason must be the founder's own words");
});

test("F2 reason: approving with an empty reason opens no dialog and sends nothing", async () => {
  await openDraft();
  const before = calls.length;
  await click($("f2-open"));
  assert.equal($("f2-confirm"), null, "no confirmation is offered without a stated reason");
  assert.equal(approveCalls().length, 0);
  assert.equal(calls.length, before, "no request of any kind");
  assert.ok($("f2-err-reason"), "the founder is told what is missing");
});

test("F2 reason: whitespace is not a reason", async () => {
  await openDraft();
  await typeReason("     ");
  const before = calls.length;
  await click($("f2-open"));
  assert.equal($("f2-confirm"), null);
  assert.equal(calls.length, before);
  assert.ok($("f2-err-reason"));
});

test("F2 reason: the reason is sent verbatim, trimmed of surrounding whitespace only", async () => {
  await openDraft();
  await reviewAndOpenConfirm("  Board minute 2026-08-31 §4(b)  ");
  await click($("f2-confirm-yes"));
  assert.equal(JSON.parse(approveCalls()[0].body).reason, "Board minute 2026-08-31 §4(b)");
});

// ── 4-6 · confirmation, Cancel and Escape ─────────────────────────────────────────────────────

test("F2 confirm: a stated reason alone does NOT approve — a confirmation is required", async () => {
  await openDraft();
  await reviewAndOpenConfirm();
  assert.ok($("f2-confirm"), "an explicit confirmation is required");
  assert.equal(approveCalls().length, 0, "opening the confirmation must send nothing");
  assert.equal($("f2-confirm").getAttribute("role"), "dialog");
  assert.equal($("f2-confirm-version").textContent, DRAFT.id, "the dialog names the exact version");
  assert.match($("f2-confirm").textContent.replace(/\s+/g, " "),
    /does not activate economics, does not\s*activate the campaign, and payouts remain held/i);
});

test("F2 confirm: Cancel issues ZERO requests and leaves the draft untouched", async () => {
  await openDraft();
  await reviewAndOpenConfirm();
  const before = calls.length;
  await click($("f2-confirm-cancel"));
  assert.equal($("f2-confirm"), null, "the dialog closes");
  assert.equal(calls.length, before, "Cancel must issue no request at all");
  assert.equal(approveCalls().length, 0);
  assert.equal($("f2-review-status").textContent, "draft", "the draft is still a draft");
  assert.equal($("f2-approved"), null);
  assert.ok($("f2-open"), "and the founder can review again");
});

test("F2 confirm: Escape issues ZERO requests and leaves the draft untouched", async () => {
  await openDraft();
  await reviewAndOpenConfirm();
  const before = calls.length;
  await pressEscape();
  assert.equal($("f2-confirm"), null, "Escape closes the dialog");
  assert.equal(calls.length, before, "Escape must issue no request at all");
  assert.equal(approveCalls().length, 0);
  assert.equal($("f2-review-status").textContent, "draft");
  assert.equal($("f2-approved"), null);
});

test("F2 confirm: Escape while no dialog is open is inert", async () => {
  await openDraft();
  const before = calls.length;
  await pressEscape();
  assert.equal(calls.length, before);
  assert.equal(approveCalls().length, 0);
  assert.ok($("f2-panel"));
});

test("F2 confirm: cancelling then confirming approves exactly once", async () => {
  await openDraft();
  await reviewAndOpenConfirm();
  await click($("f2-confirm-cancel"));
  await click($("f2-open"));
  await click($("f2-confirm-yes"));
  assert.equal(approveCalls().length, 1, "a cancelled review must not queue a second approval");
});

// ── 7-8 · the endpoint and the body ───────────────────────────────────────────────────────────

test("F2 endpoint: exactly the deployed approve route, with the server's own ids", async () => {
  await openDraft();
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  const call = approveCalls()[0];
  assert.equal(call.method, "POST");
  assert.ok(call.url.endsWith(
    `/api/fundraiser/admin/organizations/${ORG.organizationId}/economics/${DRAFT.id}/approve`),
  `unexpected approve URL: ${call.url}`);
});

test("F2 body: exactly { reason } — no terms, ids or status travel with an approval", async () => {
  await openDraft();
  await reviewAndOpenConfirm("Counsel signed off.");
  await click($("f2-confirm-yes"));
  const body = JSON.parse(approveCalls()[0].body);
  assert.deepEqual(Object.keys(body), ["reason"]);
  assert.equal(body.reason, "Counsel signed off.");
  for (const k of ["rules", "treatments", "status", "versionId", "organizationId", "campaignId", "effectiveFrom", "activate"]) {
    assert.ok(!(k in body), `${k} must not travel with an approval`);
  }
});

test("F2 body: the request carries the founder's existing bearer token, unchanged", async () => {
  await openDraft();
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  const h = approveCalls()[0].headers;
  assert.equal(h.Authorization, "Bearer tkn_founder_fixture");
  assert.equal(window.localStorage.getItem("token"), "tkn_founder_fixture", "the token is not rotated or rewritten");
});

test("F2 provenance: the approved id comes from HISTORY, never from a locally built version", async () => {
  // The create response and the history record deliberately disagree. Approval must follow the
  // server's stored draft, not whatever the client last received from a write.
  const routes = await openDraft(baseRoutes());
  assert.equal($("f2-review-version").textContent, DRAFT.id);
  assert.notEqual(DRAFT.id, routes["/economics/draft"].data.id);
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  assert.ok(approveCalls()[0].url.includes(DRAFT.id));
  assert.ok(!approveCalls()[0].url.includes("economics_from_CREATE_response"),
    "a version id from a create response must never be approved");
});

test("F2 provenance: there is no way to type or choose a version id", async () => {
  await openDraft();
  const controls = [...$("f2-panel").querySelectorAll("input, select, textarea")];
  assert.deepEqual(controls.map((c) => c.getAttribute("data-testid")), ["f2-reason"],
    "the reason is the ONLY thing the founder can enter on the approval path");
});

// ── 9-11 · state comes from the server ────────────────────────────────────────────────────────

test("F2 state: nothing is marked approved while the request is still in flight", async () => {
  await openDraft(baseRoutes({ "/approve": "pending" }));
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  assert.equal(approveCalls().length, 1, "the request went out");
  assert.equal($("f2-approved"), null, "but nothing claims success yet");
  assert.equal($("f2-review-status").textContent, "draft", "and the status is not optimistically moved");
  assert.match($("f2-confirm").textContent, /Approving/, "the pending state is visible instead");
});

test("F2 state: the sealed version and status are ADOPTED from the server response", async () => {
  await openDraft(baseRoutes({ "/approve": { status: 200, data: { id: "economics_sealed_by_server", status: "approved" } } }));
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  assert.ok($("f2-approved"));
  assert.equal($("f2-approved-version").textContent, "economics_sealed_by_server");
  assert.equal($("f2-approved-status").textContent, "approved");
});

test("F2 state: an unexpected server status is shown as-is, not normalised to 'approved'", async () => {
  await openDraft(baseRoutes({ "/approve": { status: 200, data: { id: DRAFT.id, status: "suspended" } } }));
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  assert.equal($("f2-approved-status").textContent, "suspended", "the client does not overwrite the server's status");
});

test("F2 state: success says plainly that economics are not active and payouts remain held", async () => {
  await openDraft();
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  const text = $("f2-approved").textContent.replace(/\s+/g, " ");
  assert.match(text, /not active/i);
  assert.match(text, /campaign is unchanged/i);
  assert.match(text, /payouts remain held/i);
  assert.ok(!/\\u[0-9a-f]{4}/i.test(text), "no unrendered escape sequences");
});

test("F2 state: history is re-read after success and the panel reflects STORED state", async () => {
  const routes = await openDraft();
  const readsBefore = historyReads().length;
  await reviewAndOpenConfirm();
  // The server now holds the sealed version; the refresh must pick that up rather than the UI
  // deciding for itself what the history became.
  routes["/economics/history"] = { status: 200, data: [SEALED] };
  await click($("f2-confirm-yes"));
  assert.equal(historyReads().length, readsBefore + 1, "history is reconciled after approval");
  assert.equal($("f2-panel"), null, "the draft is gone because the server says it is sealed");
  assert.ok($("f1-existing"), "and the sealed version now reads as the terms in force");
  assert.match($("f1-existing").textContent, /approved/i);
});

test("F2 state: a draft created in this session becomes approvable via a history record", async () => {
  // Proves the create → reconcile → review → approve chain never approves the create response.
  const routes = await openDraft(baseRoutes({ "/economics/history": { status: 200, data: [] } }));
  assert.equal($("f2-panel"), null, "nothing to approve yet");
  await setSelect("f1-initial-type", "none");
  await setSelect("f1-renewal-type", "none");
  for (const [k, v] of Object.entries(TREATMENTS)) await setSelect(`f1-${k}`, v);
  routes["/economics/history"] = { status: 200, data: [{ ...DRAFT, id: "economics_from_HISTORY", rules: { initialSubscriptionShare: { type: "none" }, renewalShare: { type: "none" }, giftParticipationEnabled: false } }] };
  await click($("f1-submit"));
  assert.ok($("f2-panel"), "the newly created draft is reviewable, from the server's record");
  assert.equal($("f2-review-version").textContent, "economics_from_HISTORY");
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  assert.ok(approveCalls()[0].url.includes("economics_from_HISTORY"));
  assert.ok(!approveCalls()[0].url.includes("economics_from_CREATE_response"));
});

// ── 12-13 · failures are honest and preserve the draft ────────────────────────────────────────

for (const [label, route, pattern] of [
  ["400", { status: 400, data: { error: "approval reason required", code: undefined } }, /rejected|review the draft again/i],
  ["401", { status: 401, data: { error: "unauthenticated" } }, /session|sign in/i],
  ["403", { status: 403, data: { error: "forbidden", code: "FORBIDDEN" } }, /founder/i],
  ["404", { status: 404, data: { error: "version not found", code: "NOT_FOUND" } }, /no longer exists/i],
  ["409", { status: 409, data: { error: "conflict" } }, /changed while you were reviewing/i],
  ["ETag mismatch (400 + ETAG_MISMATCH)", { status: 400, data: { error: "concurrent modification, retry", code: "ETAG_MISMATCH" } }, /changed while you were reviewing/i],
  ["already left draft", { status: 400, data: { error: "cannot approve from approved", code: "BAD_TRANSITION" } }, /no longer a draft/i],
  ["server says incomplete", { status: 400, data: { error: "incomplete economics: renewalShare not resolvable", code: "INCOMPLETE" } }, /incomplete/i],
]) {
  test(`F2 failure: ${label} is explained plainly and seals nothing`, async () => {
    await openDraft(baseRoutes({ "/approve": route }));
    await reviewAndOpenConfirm("Signed term sheet.");
    await click($("f2-confirm-yes"));
    assert.equal($("f2-approved"), null, `${label} must not render a seal`);
    const msg = $("f2-message");
    assert.ok(msg, `${label} must be explained`);
    assert.match(msg.textContent, pattern);
    assert.ok(!/created|sealed|approved successfully/i.test(msg.textContent), "the message must not imply success");
    // The last confirmed draft survives the failure, unchanged and still reviewable.
    assert.ok($("f2-panel"), "the reviewed draft is preserved");
    assert.equal($("f2-review-version").textContent, DRAFT.id);
    assert.equal($("f2-review-status").textContent, "draft");
    assert.equal($("f2-reason").value, "Signed term sheet.", "the founder's reason is not discarded");
    assert.equal($("f2-confirm"), null, "and the dialog is closed rather than left hanging");
  });
}

test("F2 failure: a network failure says the server was unreachable and seals nothing", async () => {
  await openDraft(baseRoutes({ "/approve": new Error("ECONNRESET") }));
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  assert.equal($("f2-approved"), null);
  assert.match($("f2-message").textContent, /couldn't reach the server/i);
  assert.match($("f2-message").textContent, /nothing was approved/i);
  assert.ok($("f2-panel"), "the draft is preserved");
});

test("F2 failure: no raw internal code or server message ever reaches the DOM", async () => {
  await openDraft(baseRoutes({ "/approve": { status: 400, data: { error: "concurrent modification, retry", code: "ETAG_MISMATCH" } } }));
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  const body = document.body.textContent;
  for (const leak of ["ETAG_MISMATCH", "concurrent modification", "BAD_TRANSITION", "INCOMPLETE"]) {
    assert.ok(!body.includes(leak), `"${leak}" must not be shown to the founder`);
  }
  assert.ok($("f2-message"), "but something plain IS said");
});

test("F2 failure: history is NOT re-read on failure, so the reviewed draft cannot shift underfoot", async () => {
  await openDraft(baseRoutes({ "/approve": { status: 409, data: { error: "conflict" } } }));
  await reviewAndOpenConfirm();
  const readsBefore = historyReads().length;
  await click($("f2-confirm-yes"));
  assert.equal(historyReads().length, readsBefore, "a failed approval reconciles nothing");
  assert.equal($("f2-review-version").textContent, DRAFT.id);
});

test("F2 failure: a stale error is cleared before the next attempt", async () => {
  const routes = await openDraft(baseRoutes({ "/approve": { status: 409, data: {} } }));
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  assert.ok($("f2-message"), "first attempt failed");
  routes["/approve"] = { status: 200, data: SEALED };
  await click($("f2-open"));
  assert.equal($("f2-message"), null, "the stale failure must not linger over a fresh review");
  await click($("f2-confirm-yes"));
  assert.ok($("f2-approved"));
});

// ── 14 · nothing else changes ─────────────────────────────────────────────────────────────────

test("F2 blast radius: approval writes nothing to storage and leaves the token alone", async () => {
  await openDraft();
  storageWrites = [];
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  assert.ok($("f2-approved"), "the approval succeeded");
  assert.deepEqual(storageWrites, [], "sealing terms must not persist anything locally");
  assert.equal(window.localStorage.getItem("token"), "tkn_founder_fixture");
});

test("F2 blast radius: approval changes no URL and no cookie", async () => {
  await openDraft();
  const href = window.location.href;
  const cookie = document.cookie;
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  assert.ok($("f2-approved"));
  assert.equal(window.location.href, href, "the URL must not carry approval state");
  assert.equal(document.cookie, cookie);
});

test("F2 blast radius: approval logs nothing to the console", async () => {
  await openDraft();
  consoleLines = [];
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  assert.ok($("f2-approved"));
  assert.deepEqual(consoleLines, [], "an approval is not a debugging session");
});

test("F2 blast radius: exactly one write, and no activation, campaign-status or payout request", async () => {
  const routes = await openDraft();
  const mark = calls.length;                       // everything after this is the approval flow
  await reviewAndOpenConfirm();
  routes["/economics/history"] = { status: 200, data: [SEALED] };
  await click($("f2-confirm-yes"));

  const after = calls.slice(mark);
  for (const c of after) {
    assert.ok(!/\/activate$/.test(c.url), `no activation request (${c.url})`);
    assert.ok(!/\/campaigns\/[^/]+\/status$/.test(c.url), `no campaign-status request (${c.url})`);
    assert.ok(!/\/change-rate$/.test(c.url), `no org-wide rate change (${c.url})`);
    assert.ok(!/\/deactivate$/.test(c.url), `no deactivation request (${c.url})`);
    assert.ok(!(c.method !== "GET" && c.url.includes("/payouts")), `no payout request (${c.url})`);
    assert.ok(!(c.method !== "GET" && c.url.includes("/economics/draft")), `no draft written while approving (${c.url})`);
  }
  const writes = after.filter((c) => c.method !== "GET");
  assert.equal(writes.length, 1, "an approval is exactly one write");
  assert.ok(writes[0].url.endsWith("/approve"));
});

test("F2 blast radius: the panel offers approval and nothing beyond it", async () => {
  await openDraft();
  await reviewAndOpenConfirm();
  const labels = [...$("f2-panel").querySelectorAll("button")].map((b) => b.textContent.trim().toLowerCase());
  assert.deepEqual(labels, ["review and approve these terms", "yes, approve and seal", "cancel"]);
  const panel = $("f2-panel").textContent.toLowerCase();
  for (const word of ["publish", "go live", "pay out", "activate now", "edit terms"]) {
    assert.ok(!panel.includes(word), `the panel must not offer or imply "${word}"`);
  }
});

test("F2 blast radius: switching campaigns clears the approval panel and its reason", async () => {
  const routes = await openDraft();
  await typeReason("Signed term sheet.");
  routes["/economics/history"] = { status: 200, data: [] };
  await setSelect("f1-campaign", CAMPAIGNS[1].campaignId);
  assert.equal($("f2-panel"), null, "the other campaign has no draft");
  assert.equal($("f2-approved"), null);
  routes["/economics/history"] = { status: 200, data: [DRAFT] };
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  assert.equal($("f2-reason").value, "", "a reason never carries across campaigns");
  assert.equal(approveCalls().length, 0);
});

test("F2 blast radius: a double confirm does not seal twice", async () => {
  await openDraft(baseRoutes({ "/approve": "pending" }));
  await reviewAndOpenConfirm();
  await click($("f2-confirm-yes"));
  await click($("f2-confirm-yes"));
  assert.equal(approveCalls().length, 1, "an in-flight approval must not be re-sent");
});
