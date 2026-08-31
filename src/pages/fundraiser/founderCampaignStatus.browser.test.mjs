// src/pages/fundraiser/founderCampaignStatus.browser.test.mjs
//
// TEAM B (F4) — RENDERED coverage of the CAMPAIGN STATUS panel on the founder dashboard. The REAL
// FounderFundraisingDashboard is esbuild-transformed and mounted in jsdom against the REAL
// fundraiserApi client over a controllable global fetch. Only the fundraiser flag gate is stubbed.
//
// A campaign's status decides whether new fundraiser attribution accrues. So these tests are
// written to fail if the UI ever offers a move the server would reject, makes a campaign live
// without economics in force, closes one without a deliberate destructive confirmation, claims a
// status the server never returned, or reaches past the campaign into economics or payouts.
//
// Run under the supported runtime (engines: node 20.x):
//   node --test src/pages/fundraiser/founderCampaignStatus.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__f4founder.bundle.mjs");
let React, createRoot, act, Founder, window;

const GATE_STUB = `export const isFundraiserUiEnabled = () => !!globalThis.__flag;`;

let storageWrites = [];
let consoleLines = [];

before(async () => {
  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /fundraiserGate\.js$/ }, (a) => ({ path: a.path, namespace: "gate" }));
    b.onLoad({ filter: /.*/, namespace: "gate" }, () => ({ contents: GATE_STUB, loader: "js" }));
  } };
  const entry = join(__dirname, ".__f4founder.jsx");
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

  window.localStorage.setItem("token", "tkn_founder_fixture");
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

// ── fixtures ──────────────────────────────────────────────────────────────────────────────────
const ORG = { organizationId: "org_ce665b98", legalName: "NJ Mediation Service", orgType: "nonprofit", status: "approved", adminUserIds: [] };
const OTHER_ORG = { organizationId: "org_second999", legalName: "Second Org", orgType: "school", status: "approved", adminUserIds: [] };
const OVERVIEW = { organizations: { total: 2 }, campaigns: { total: 1 }, participants: { total: 0 }, economics: { activeVersions: 1 } };

const CID = "cmp_dccf5283";
const campaignAt = (status, over = {}) => ({
  campaignId: CID, organizationId: ORG.organizationId, title: "Spring Drive", status, ...over,
});

/** An economics version the history confirms as ACTIVE. */
const ACTIVE_ECONOMICS = {
  id: "economics_active_001", campaignId: CID, economicsVersion: 3, status: "active",
  effectiveFrom: "2026-08-01T00:00:00.000Z",
  rules: {
    initialSubscriptionShare: { type: "percent_of_base", basis: "ENSR", percent: 10 },
    renewalShare: { type: "none" },
    giftParticipationEnabled: false,
  },
  treatments: {
    onboardingFeeTreatment: "excluded_retained", veteransContributionTreatment: "excluded",
    discountTreatment: "ineligible", taxTreatment: "excluded_from_base", processorFeeTreatment: "net_of_processor",
  },
};
/** Same terms, but sealed rather than in force — approved is NOT active. */
const APPROVED_ONLY = { ...ACTIVE_ECONOMICS, id: "economics_approved_002", status: "approved" };

// ── harness ───────────────────────────────────────────────────────────────────────────────────
let calls = [];
let activeRoutes = null;

function installFetch(routes) {
  calls = [];
  activeRoutes = routes;
  globalThis.fetch = (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || "GET", body: opts.body, headers: opts.headers || {} });
    // Suffix-first: the status URL ends "/status", which "/payouts/status" would otherwise swallow.
    const key = Object.keys(activeRoutes).find((k) => u.endsWith(k)) || Object.keys(activeRoutes).find((k) => u.includes(k));
    const r = key ? activeRoutes[key] : { status: 200, data: {} };
    if (r === "pending") return new Promise(() => {});
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.data });
  };
  return routes;
}

// NOTE the key ordering below: "/payouts/status" is a suffix of nothing else, but the campaign
// status URL ends "/status" too. Both are listed, and endsWith picks the longer literal first
// only because "/payouts/status" is checked as its own key — so each is asserted explicitly.
const STATUS_SUFFIX = `/campaigns/${CID}/status`;

const baseRoutes = (over = {}) => ({
  "/admin/overview": { status: 200, data: OVERVIEW },
  "/admin/organizations": { status: 200, data: [ORG, OTHER_ORG] },
  "/totals/participants": { status: 200, data: { participants: 0, attributionRecords: 0 } },
  "/totals/ledger": { status: 200, data: { conversions: 0, renewals: 0, refunds: 0 } },
  "/reconciliation": { status: 200, data: { reconciled: true } },
  "/payouts/status": { status: 503, data: { disabled: true } },
  "/audit": { status: 200, data: [] },
  "/campaigns": { status: 200, data: [campaignAt("draft")] },
  "/economics/history": { status: 200, data: [ACTIVE_ECONOMICS] },
  [STATUS_SUFFIX]: { status: 200, data: campaignAt("active") },
  ...over,
});

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await settle(); };

async function setValue(id, value, proto) {
  const el = $(id);
  assert.ok(el, `expected a control [data-testid="${id}"]`);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(proto, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new window.Event(proto === window.HTMLSelectElement.prototype ? "change" : "input", { bubbles: true }));
  });
  await settle();
}
const setTarget = (v) => setValue("f4-target", v, window.HTMLSelectElement.prototype);
const setReason = (v) => setValue("f4-reason", v, window.HTMLTextAreaElement.prototype);
const setCloseAck = (v) => setValue("f4-close-ack", v, window.HTMLInputElement.prototype);

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

async function openRow(legalName) {
  const row = [...document.querySelectorAll("tr")].find((tr) => tr.textContent.includes(legalName));
  assert.ok(row, `the organization row for ${legalName} must render`);
  await click([...row.querySelectorAll("button")].find((b) => b.textContent.trim() === "Open"));
}

/** Mount, open the fixture organization and select the campaign that owns the status panel. */
async function openCampaign(routes = baseRoutes()) {
  await mount(routes);
  await openRow(ORG.legalName);
  await setValue("f1-campaign", CID, window.HTMLSelectElement.prototype);
  return routes;
}

const statusCalls = () => calls.filter((c) => c.method === "POST" && c.url.endsWith(STATUS_SUFFIX));
const campaignReads = () => calls.filter((c) => c.method === "GET" && c.url.endsWith("/campaigns"));

/** Fill a legal transition and open the confirmation. */
async function proposeChange(target, reason = "Board approved the launch on 2026-08-31.") {
  await setTarget(target);
  await setReason(reason);
  if (target === "closed") await setCloseAck(CID);
  await click($("f4-open"));
}

beforeEach(() => { storageWrites = []; consoleLines = []; });

// ── 1 · the panel appears only for a server-returned campaign ─────────────────────────────────

test("F4 presence: no panel before an organization is opened", async () => {
  await mount(baseRoutes());
  assert.equal($("f4-panel"), null);
  assert.equal(statusCalls().length, 0);
});

test("F4 presence: no panel until a campaign is selected", async () => {
  await mount(baseRoutes());
  await openRow(ORG.legalName);
  assert.equal($("f4-panel"), null, "there is no campaign to move yet");
  assert.equal(statusCalls().length, 0);
});

test("F4 presence: the panel renders for the selected server campaign", async () => {
  await openCampaign();
  assert.ok($("f4-panel"));
  assert.equal($("f4-review-campaign-id").textContent, CID);
});

test("F4 presence: the gate being OFF renders no panel and issues no request", async () => {
  await mount(baseRoutes(), { flag: false });
  assert.equal($("f4-panel"), null);
  assert.equal(calls.length, 0);
});

// ── 2 · only server-valid transitions are offered ─────────────────────────────────────────────

for (const [current, expected] of [
  ["draft", ["", "active", "closed"]],
  ["active", ["", "paused", "closed"]],
  ["paused", ["", "active", "closed"]],
]) {
  test(`F4 transitions: ${current} offers exactly ${expected.slice(1).join(" and ")}`, async () => {
    await openCampaign(baseRoutes({ "/campaigns": { status: 200, data: [campaignAt(current)] } }));
    assert.equal($("f4-review-current").textContent, current);
    const values = [...$("f4-target").querySelectorAll("option")].map((o) => o.value);
    assert.deepEqual(values, expected);
    assert.equal($("f4-target").value, "", "no target is preselected");
  });
}

test("F4 transitions: a closed campaign offers nothing and says why", async () => {
  await openCampaign(baseRoutes({ "/campaigns": { status: 200, data: [campaignAt("closed")] } }));
  assert.ok($("f4-panel"), "the campaign is still shown");
  assert.equal($("f4-target"), null, "closed offers no target at all");
  assert.equal($("f4-open"), null);
  assert.ok($("f4-terminal"));
  assert.match($("f4-terminal").textContent, /terminal/i);
  assert.equal(statusCalls().length, 0);
});

test("F4 transitions: no invented state is ever offered", async () => {
  const seen = new Set();
  for (const current of ["draft", "active", "paused"]) {
    await openCampaign(baseRoutes({ "/campaigns": { status: 200, data: [campaignAt(current)] } }));
    for (const o of $("f4-target").querySelectorAll("option")) if (o.value) seen.add(o.value);
  }
  assert.deepEqual([...seen].sort(), ["active", "closed", "paused"],
    "the panel must not invent archived, reopened, or any other state");
});

test("F4 transitions: an unrecognised server status offers no move at all", async () => {
  await openCampaign(baseRoutes({ "/campaigns": { status: 200, data: [campaignAt("mystery_state")] } }));
  assert.equal($("f4-review-current").textContent, "mystery_state");
  assert.equal($("f4-target"), null, "an unknown status must not be guessed into a transition");
  assert.equal(statusCalls().length, 0);
});

// ── 3 · the activation safety gate ────────────────────────────────────────────────────────────

test("F4 economics gate: without ACTIVE economics, activation is offered but not enabled", async () => {
  await openCampaign(baseRoutes({ "/economics/history": { status: 200, data: [APPROVED_ONLY] } }));
  const activeOption = [...$("f4-target").querySelectorAll("option")].find((o) => o.value === "active");
  assert.ok(activeOption, "the founder can still see the move exists");
  assert.equal(activeOption.disabled, true, "but it is not an enabled action");
  assert.ok($("f4-economics-gate"));
  assert.equal($("f4-economics-gate").textContent.trim(), "Activate campaign economics first.");
});

test("F4 economics gate: approved-but-not-active economics do NOT satisfy the gate", async () => {
  await openCampaign(baseRoutes({ "/economics/history": { status: 200, data: [APPROVED_ONLY] } }));
  await setTarget("active");
  await setReason("Launching now.");
  const before = calls.length;
  await click($("f4-open"));
  assert.equal($("f4-confirm"), null, "no confirmation is offered for a blocked activation");
  assert.equal(statusCalls().length, 0);
  assert.equal(calls.length, before, "zero requests of any kind");
  assert.equal($("f4-error").textContent, "Activate campaign economics first.");
});

test("F4 economics gate: with no economics history at all, activation is blocked", async () => {
  await openCampaign(baseRoutes({ "/economics/history": { status: 200, data: [] } }));
  assert.ok($("f4-economics-gate"));
  const activeOption = [...$("f4-target").querySelectorAll("option")].find((o) => o.value === "active");
  assert.equal(activeOption.disabled, true);
});

test("F4 economics gate: a FAILED economics read blocks activation rather than assuming it", async () => {
  await openCampaign(baseRoutes({ "/economics/history": { status: 500, data: { error: "boom" } } }));
  assert.ok($("f4-economics-gate"), "an unreadable history is not evidence of active economics");
  assert.equal(statusCalls().length, 0);
});

test("F4 economics gate: with ACTIVE economics, activation is enabled and the version is shown", async () => {
  await openCampaign();
  assert.equal($("f4-economics-gate"), null);
  const activeOption = [...$("f4-target").querySelectorAll("option")].find((o) => o.value === "active");
  assert.equal(activeOption.disabled, false);
  await setTarget("active");
  assert.equal($("f4-review-economics").textContent, ACTIVE_ECONOMICS.id);
});

test("F4 economics gate: closing is never blocked by economics", async () => {
  await openCampaign(baseRoutes({ "/economics/history": { status: 200, data: [] } }));
  const closeOption = [...$("f4-target").querySelectorAll("option")].find((o) => o.value === "closed");
  assert.equal(closeOption.disabled, false, "a campaign can always be closed");
});

test("F4 economics gate: pausing is never blocked by economics", async () => {
  await openCampaign(baseRoutes({
    "/campaigns": { status: 200, data: [campaignAt("active")] },
    "/economics/history": { status: 200, data: [] },
  }));
  const pauseOption = [...$("f4-target").querySelectorAll("option")].find((o) => o.value === "paused");
  assert.equal(pauseOption.disabled, false);
  assert.equal($("f4-economics-gate"), null, "the gate is only about making a campaign live");
});

// ── 4 · review and warnings ───────────────────────────────────────────────────────────────────

test("F4 review: everything the founder is deciding on is displayed", async () => {
  await openCampaign();
  await setTarget("active");
  await setReason("Board approved the launch.");
  assert.equal($("f4-review-org").textContent, ORG.legalName);
  assert.equal($("f4-review-campaign").textContent, "Spring Drive");
  assert.equal($("f4-review-campaign-id").textContent, CID);
  assert.equal($("f4-review-current").textContent, "draft");
  assert.equal($("f4-review-target").textContent, "active");
  assert.equal($("f4-review-economics").textContent, ACTIVE_ECONOMICS.id);
  assert.equal($("f4-review-reason").textContent, "Board approved the launch.");
});

test("F4 review: the economics version is shown only when it is relevant", async () => {
  await openCampaign(baseRoutes({ "/campaigns": { status: 200, data: [campaignAt("active")] } }));
  await setTarget("paused");
  assert.equal($("f4-review-economics"), null, "pausing does not turn on economics");
  await setTarget("closed");
  assert.equal($("f4-review-economics"), null);
});

for (const [target, current, pattern] of [
  ["active", "draft", [/eligible for new fundraiser attribution/i, /economics must already be active/i, /payouts remain held/i]],
  ["paused", "active", [/stops new attribution eligibility/i, /payouts remain held/i]],
  ["closed", "draft", [/terminal/i, /cannot be reopened/i]],
]) {
  test(`F4 warnings: choosing ${target} states its consequence before confirming`, async () => {
    await openCampaign(baseRoutes({ "/campaigns": { status: 200, data: [campaignAt(current)] } }));
    await setTarget(target);
    const text = $("f4-warning").textContent.replace(/\s+/g, " ");
    for (const p of pattern) assert.match(text, p);
    assert.ok(!/\\u[0-9a-f]{4}/i.test($("f4-panel").textContent), "no unrendered escape sequences");
  });
}

// ── 5 · reason and confirmation ───────────────────────────────────────────────────────────────

test("F4 reason: the field starts empty and is never pre-written", async () => {
  await openCampaign();
  assert.equal($("f4-reason").value, "");
});

test("F4 reason: no target chosen means no confirmation and no request", async () => {
  await openCampaign();
  await setReason("Because.");
  const before = calls.length;
  await click($("f4-open"));
  assert.equal($("f4-confirm"), null);
  assert.equal(calls.length, before);
  assert.ok($("f4-error"));
});

test("F4 reason: an empty or whitespace reason blocks the confirmation and sends nothing", async () => {
  await openCampaign();
  await setTarget("active");
  const before = calls.length;
  await click($("f4-open"));
  assert.equal($("f4-confirm"), null, "no confirmation without a stated reason");
  assert.equal(calls.length, before);
  assert.match($("f4-error").textContent, /say why/i);

  await setReason("    ");
  await click($("f4-open"));
  assert.equal($("f4-confirm"), null, "whitespace is not a reason");
  assert.equal(calls.length, before);
});

test("F4 confirm: opening the confirmation sends nothing and names the exact move", async () => {
  await openCampaign();
  await proposeChange("active");
  assert.ok($("f4-confirm"));
  assert.equal(statusCalls().length, 0, "the confirmation is not the action");
  assert.equal($("f4-confirm-target").textContent, "active");
  const text = $("f4-confirm").textContent.replace(/\s+/g, " ");
  assert.match(text, new RegExp(CID));
  assert.match(text, /from draft to active/i);
});

test("F4 confirm: Cancel issues ZERO requests and leaves the status alone", async () => {
  await openCampaign();
  await proposeChange("active");
  const before = calls.length;
  await click($("f4-cancel"));
  assert.equal($("f4-confirm"), null);
  assert.equal(calls.length, before, "Cancel must issue no request at all");
  assert.equal($("f4-review-current").textContent, "draft");
  assert.equal($("f4-changed"), null);
  assert.ok($("f4-open"), "and the founder can review again");
});

test("F4 confirm: Escape issues ZERO requests and leaves the status alone", async () => {
  await openCampaign();
  await proposeChange("active");
  const before = calls.length;
  await pressEscape();
  assert.equal($("f4-confirm"), null);
  assert.equal(calls.length, before, "Escape must issue no request at all");
  assert.equal($("f4-review-current").textContent, "draft");
  assert.equal($("f4-changed"), null);
});

test("F4 confirm: Escape with no confirmation open is inert", async () => {
  await openCampaign();
  const before = calls.length;
  await pressEscape();
  assert.equal(calls.length, before);
  assert.equal(statusCalls().length, 0);
});

// ── 6 · closing needs a stronger confirmation ─────────────────────────────────────────────────

test("F4 close: closing demands the campaign ID typed back, and blocks until it matches", async () => {
  await openCampaign();
  await setTarget("closed");
  await setReason("Season over.");
  assert.ok($("f4-close-ack"), "closing asks for more than a click");
  await click($("f4-open"));
  assert.ok($("f4-confirm"));
  assert.equal($("f4-confirm-go").disabled, true, "the confirm button is inert without the acknowledgement");

  const before = calls.length;
  await click($("f4-confirm-go"));
  assert.equal(statusCalls().length, 0, "a disabled destructive confirm sends nothing");
  assert.equal(calls.length, before);

  // The acknowledgement stays reachable while the confirmation is open, so the founder can supply
  // it without losing the review they are looking at.
  await setCloseAck("cmp_WRONG");
  assert.equal($("f4-confirm-go").disabled, true, "a near-miss is still a miss");
  await click($("f4-confirm-go"));
  assert.equal(statusCalls().length, 0);
  assert.equal(calls.length, before);

  await setCloseAck(CID);
  assert.equal($("f4-confirm-go").disabled, false, "the exact ID unlocks it");
  await click($("f4-confirm-go"));
  assert.equal(statusCalls().length, 1);
  assert.equal(JSON.parse(statusCalls()[0].body).status, "closed");
});

test("F4 close: the acknowledgement is not asked for on non-destructive moves", async () => {
  await openCampaign();
  await setTarget("active");
  assert.equal($("f4-close-ack"), null);
  await setTarget("closed");
  assert.ok($("f4-close-ack"));
  await setTarget("active");
  assert.equal($("f4-close-ack"), null, "and it is dropped when the target changes back");
});

test("F4 close: changing the target clears a typed acknowledgement", async () => {
  await openCampaign();
  await setTarget("closed");
  await setCloseAck(CID);
  await setTarget("active");
  await setTarget("closed");
  assert.equal($("f4-close-ack").value, "", "a stale acknowledgement must not carry over");
});

// ── 7 · endpoint and body ─────────────────────────────────────────────────────────────────────

test("F4 endpoint: exactly the deployed status route, with the server's own ids", async () => {
  await openCampaign();
  await proposeChange("active");
  await click($("f4-confirm-go"));
  const call = statusCalls()[0];
  assert.equal(call.method, "POST");
  assert.ok(call.url.endsWith(
    `/api/fundraiser/admin/organizations/${ORG.organizationId}/campaigns/${CID}/status`),
  `unexpected status URL: ${call.url}`);
});

test("F4 body: exactly { status, reason } and nothing else", async () => {
  await openCampaign();
  await proposeChange("active", "Board minute 2026-08-31 §4(b)");
  await click($("f4-confirm-go"));
  const body = JSON.parse(statusCalls()[0].body);
  assert.deepEqual(Object.keys(body).sort(), ["reason", "status"]);
  assert.equal(body.status, "active");
  assert.equal(body.reason, "Board minute 2026-08-31 §4(b)");
  for (const k of ["campaignId", "organizationId", "economicsVersionId", "effectiveFrom", "at", "actor"]) {
    assert.ok(!(k in body), `${k} must not travel with a status change`);
  }
});

test("F4 body: the reason is trimmed of surrounding whitespace only", async () => {
  await openCampaign();
  await proposeChange("active", "   Launch approved.   ");
  await click($("f4-confirm-go"));
  assert.equal(JSON.parse(statusCalls()[0].body).reason, "Launch approved.");
});

test("F4 identity: ids come from server records, and nothing can be typed to change them", async () => {
  await openCampaign();
  await setTarget("active");
  const editable = [...$("f4-panel").querySelectorAll("input, select, textarea")]
    .map((c) => c.getAttribute("data-testid"));
  assert.deepEqual(editable, ["f4-target", "f4-reason"],
    "only the target and the reason are the founder's to enter");
});

test("F4 identity: the request carries the existing bearer token, unchanged", async () => {
  await openCampaign();
  await proposeChange("active");
  await click($("f4-confirm-go"));
  assert.equal(statusCalls()[0].headers.Authorization, "Bearer tkn_founder_fixture");
  assert.equal(window.localStorage.getItem("token"), "tkn_founder_fixture");
});

// ── 8 · revalidation at send time ─────────────────────────────────────────────────────────────

test("F4 revalidation: a transition that became illegal is refused locally, sending nothing", async () => {
  const routes = await openCampaign();
  await proposeChange("active");
  // The campaign closed underneath the open confirmation. The panel is keyed by status, so the
  // refreshed list remounts it — and the stale confirmation cannot be used to send.
  routes["/campaigns"] = { status: 200, data: [campaignAt("closed")] };
  await click([...document.querySelectorAll("tr")].find((tr) => tr.textContent.includes(ORG.legalName))
    .querySelectorAll("button")[0]);
  await setValue("f1-campaign", CID, window.HTMLSelectElement.prototype);
  assert.equal($("f4-confirm"), null, "the stale confirmation is gone");
  assert.equal($("f4-terminal") !== null, true, "and the panel reflects the closed campaign");
  assert.equal(statusCalls().length, 0);
});

// ── 9 · state comes from the server ───────────────────────────────────────────────────────────

test("F4 state: nothing changes while the request is still in flight", async () => {
  await openCampaign(baseRoutes({ [STATUS_SUFFIX]: "pending" }));
  await proposeChange("active");
  await click($("f4-confirm-go"));
  assert.equal(statusCalls().length, 1, "the request went out");
  assert.equal($("f4-changed"), null, "but nothing claims a new status yet");
  assert.equal($("f4-review-current").textContent, "draft", "and the status is not optimistically moved");
  assert.match($("f4-confirm").textContent, /Changing/);
});

test("F4 state: the new status is ADOPTED from the server response", async () => {
  await openCampaign(baseRoutes({ [STATUS_SUFFIX]: { status: 200, data: { campaignId: CID, status: "active" } } }));
  await proposeChange("active");
  await click($("f4-confirm-go"));
  assert.ok($("f4-changed"));
  assert.equal($("f4-changed-campaign").textContent, CID);
  assert.equal($("f4-changed-status").textContent, "active");
});

test("F4 state: an unexpected server status is shown as-is, not normalised to the target", async () => {
  await openCampaign(baseRoutes({ [STATUS_SUFFIX]: { status: 200, data: { campaignId: CID, status: "paused" } } }));
  await proposeChange("active");
  await click($("f4-confirm-go"));
  assert.equal($("f4-changed-status").textContent, "paused",
    "the client must not overwrite what the server said happened");
});

test("F4 state: success says economics and payouts were untouched", async () => {
  await openCampaign();
  await proposeChange("active");
  await click($("f4-confirm-go"));
  const text = $("f4-changed").textContent.replace(/\s+/g, " ");
  assert.match(text, /economics terms are unchanged/i);
  assert.match(text, /payouts remain held/i);
});

test("F4 state: the campaign list is re-read after success and the panel reflects it", async () => {
  const routes = await openCampaign();
  const readsBefore = campaignReads().length;
  await proposeChange("active");
  routes["/campaigns"] = { status: 200, data: [campaignAt("active")] };
  await click($("f4-confirm-go"));
  assert.equal(campaignReads().length, readsBefore + 1, "the list is reconciled after a change");
  assert.equal($("f4-review-current").textContent, "active", "and now reads the server's stored status");
  assert.deepEqual([...$("f4-target").querySelectorAll("option")].map((o) => o.value), ["", "paused", "closed"],
    "the offered transitions follow the new status");
  assert.equal($("f4-stale"), null);
});

test("F4 state: a FAILED refresh is reported as stale and fabricates no status", async () => {
  const routes = await openCampaign();
  await proposeChange("active");
  routes["/campaigns"] = { status: 500, data: { error: "boom" } };
  await click($("f4-confirm-go"));
  assert.ok($("f4-changed"), "the server's own answer is still reported");
  assert.equal($("f4-changed-status").textContent, "active");
  assert.ok($("f4-stale"), "and the founder is told the list may be out of date");
  assert.equal($("f4-review-current").textContent, "draft",
    "the last server-confirmed status stands rather than an invented one");
});

// ── 10 · failures are honest ──────────────────────────────────────────────────────────────────

for (const [label, route, pattern] of [
  ["401", { status: 401, data: { error: "unauthenticated" } }, /session|sign in/i],
  ["403", { status: 403, data: { error: "forbidden", code: "FORBIDDEN" } }, /founder/i],
  ["404", { status: 404, data: { error: "campaign not found", code: "NOT_FOUND" } }, /no longer exists/i],
  ["bad transition (400 + BAD_TRANSITION)", { status: 400, data: { error: "cannot transition draft to paused", code: "BAD_TRANSITION" } }, /no longer possible/i],
  ["concurrent change (400 + ETAG_MISMATCH)", { status: 400, data: { error: "concurrent modification, retry", code: "ETAG_MISMATCH" } }, /changed while you were reviewing/i],
  ["409", { status: 409, data: { error: "conflict" } }, /changed while you were reviewing/i],
  ["held (423)", { status: 423, data: { error: "held", code: "HELD" } }, /on hold/i],
  ["500", { status: 500, data: { error: "boom" } }, /didn't go through/i],
]) {
  test(`F4 failure: ${label} is explained plainly and changes nothing`, async () => {
    await openCampaign(baseRoutes({ [STATUS_SUFFIX]: route }));
    await proposeChange("active", "Launch approved.");
    await click($("f4-confirm-go"));
    assert.equal($("f4-changed"), null, `${label} must not claim a status change`);
    const msg = $("f4-message");
    assert.ok(msg, `${label} must be explained`);
    assert.match(msg.textContent, pattern);
    assert.ok(!/success|changed to/i.test(msg.textContent), "the message must not imply success");
    // The last confirmed status survives, and so does the founder's reason.
    assert.equal($("f4-review-current").textContent, "draft");
    assert.equal($("f4-reason").value, "Launch approved.");
    assert.equal($("f4-confirm"), null, "the confirmation is closed rather than left hanging");
  });
}

test("F4 failure: a network failure says the server was unreachable and changes nothing", async () => {
  await openCampaign(baseRoutes({ [STATUS_SUFFIX]: new Error("ECONNRESET") }));
  await proposeChange("active");
  await click($("f4-confirm-go"));
  assert.equal($("f4-changed"), null);
  assert.match($("f4-message").textContent, /couldn't reach the server/i);
  assert.match($("f4-message").textContent, /unchanged/i);
  assert.equal($("f4-review-current").textContent, "draft");
});

test("F4 failure: no machine code or raw server message ever reaches the DOM", async () => {
  await openCampaign(baseRoutes({
    [STATUS_SUFFIX]: { status: 400, data: { error: "cannot transition draft → paused", code: "BAD_TRANSITION" } },
  }));
  await proposeChange("active");
  await click($("f4-confirm-go"));
  const body = document.body.textContent;
  for (const leak of ["BAD_TRANSITION", "ETAG_MISMATCH", "NOT_FOUND", "cannot transition", "concurrent modification"]) {
    assert.ok(!body.includes(leak), `"${leak}" must not be shown to the founder`);
  }
  assert.ok($("f4-message"), "but something plain IS said");
});

test("F4 failure: the campaign list is NOT re-read on failure", async () => {
  await openCampaign(baseRoutes({ [STATUS_SUFFIX]: { status: 409, data: {} } }));
  await proposeChange("active");
  const readsBefore = campaignReads().length;
  await click($("f4-confirm-go"));
  assert.equal(campaignReads().length, readsBefore, "a failed change reconciles nothing");
  assert.equal($("f4-review-current").textContent, "draft");
});

test("F4 failure: a stale error is cleared before the next attempt", async () => {
  const routes = await openCampaign(baseRoutes({ [STATUS_SUFFIX]: { status: 409, data: {} } }));
  await proposeChange("active");
  await click($("f4-confirm-go"));
  assert.ok($("f4-message"), "first attempt failed");
  routes[STATUS_SUFFIX] = { status: 200, data: campaignAt("active") };
  await proposeChange("active");
  assert.equal($("f4-message"), null, "the stale failure must not linger over a fresh review");
});

// ── 11 · context changes clear the panel ──────────────────────────────────────────────────────

test("F4 context: switching campaigns clears the reason and confirmation", async () => {
  const OTHER = { campaignId: "cmp_fall00042", organizationId: ORG.organizationId, title: "Fall Drive", status: "draft" };
  await openCampaign(baseRoutes({ "/campaigns": { status: 200, data: [campaignAt("draft"), OTHER] } }));
  await setTarget("closed");
  await setReason("Season over.");
  await setValue("f1-campaign", OTHER.campaignId, window.HTMLSelectElement.prototype);
  assert.equal($("f4-review-campaign-id").textContent, OTHER.campaignId);
  assert.equal($("f4-reason").value, "", "a reason never carries across campaigns");
  assert.equal($("f4-target").value, "", "and neither does a target");
  assert.equal($("f4-confirm"), null);
  assert.equal(statusCalls().length, 0);
});

test("F4 context: switching organizations clears the panel entirely", async () => {
  await openCampaign();
  await setTarget("closed");
  await setReason("Season over.");
  await openRow(OTHER_ORG.legalName);
  assert.equal($("f4-panel"), null, "no campaign is selected in the new organization");
  assert.equal(statusCalls().length, 0);
});

test("F4 context: a status change underneath remounts the panel with a clean form", async () => {
  const routes = await openCampaign();
  await proposeChange("active");
  routes["/campaigns"] = { status: 200, data: [campaignAt("active")] };
  await click($("f4-confirm-go"));
  assert.equal($("f4-target").value, "", "the target is cleared once the status really moved");
  assert.equal($("f4-reason").value, "");
  assert.equal($("f4-confirm"), null);
});

// ── 12 · nothing else changes ─────────────────────────────────────────────────────────────────

test("F4 blast radius: exactly one write, and it is the status change", async () => {
  const routes = await openCampaign();
  const mark = calls.length;
  await proposeChange("active");
  routes["/campaigns"] = { status: 200, data: [campaignAt("active")] };
  await click($("f4-confirm-go"));

  const after = calls.slice(mark);
  for (const c of after) {
    assert.ok(!/\/economics\/(draft|activate)$/.test(c.url), `no economics write (${c.url})`);
    assert.ok(!/\/approve$/.test(c.url), `no approval request (${c.url})`);
    assert.ok(!/\/change-rate$/.test(c.url), `no rate change (${c.url})`);
    assert.ok(!(c.method !== "GET" && c.url.includes("/payouts")), `no payout request (${c.url})`);
  }
  const writes = after.filter((c) => c.method !== "GET");
  assert.equal(writes.length, 1, "a status change is exactly one write");
  assert.ok(writes[0].url.endsWith(STATUS_SUFFIX));
});

test("F4 blast radius: no storage write, no cookie, no URL and no console output", async () => {
  await openCampaign();
  const href = window.location.href;
  const cookie = document.cookie;
  storageWrites = []; consoleLines = [];
  await proposeChange("active");
  await click($("f4-confirm-go"));
  assert.ok($("f4-changed"), "the change succeeded");
  assert.deepEqual(storageWrites, [], "a status change must not persist anything locally");
  assert.equal(window.localStorage.getItem("token"), "tkn_founder_fixture");
  assert.equal(window.location.href, href, "the URL must not carry campaign state");
  assert.equal(document.cookie, cookie);
  assert.deepEqual(consoleLines, [], "a status change is not a debugging session");
});

test("F4 blast radius: the panel offers status changes and nothing beyond them", async () => {
  await openCampaign();
  await proposeChange("active");
  const labels = [...$("f4-panel").querySelectorAll("button")].map((b) => b.textContent.trim().toLowerCase());
  assert.deepEqual(labels, ["cancel", "change status to active"]);
  const panel = $("f4-panel").textContent.toLowerCase();
  for (const word of ["approve economics", "activate economics", "release payout", "pay out", "edit terms"]) {
    assert.ok(!panel.includes(word), `the panel must not offer or imply "${word}"`);
  }
});

test("F4 blast radius: a double confirm does not send twice", async () => {
  await openCampaign(baseRoutes({ [STATUS_SUFFIX]: "pending" }));
  await proposeChange("active");
  await click($("f4-confirm-go"));
  await click($("f4-confirm-go"));
  assert.equal(statusCalls().length, 1, "an in-flight change must not be re-sent");
});
