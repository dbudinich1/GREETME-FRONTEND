// src/pages/fundraiser/founderDraftEconomics.browser.test.mjs
//
// TEAM B (F1) — RENDERED coverage of the DRAFT-ECONOMICS panel on the founder dashboard. The REAL
// FounderFundraisingDashboard is esbuild-transformed and mounted in jsdom against the REAL
// fundraiserApi client over a controllable global fetch. Only the fundraiser flag gate is stubbed;
// nothing about economics, validation, or the payload is mocked.
//
// F1 creates a DRAFT and nothing else. These tests are written to fail if the UI ever starts
// inventing a commercial term the founder did not choose — a default percentage, a silently
// clamped value, a preselected treatment, an assumed campaign id, or an optimistic success.
//
// Run under the supported runtime (engines: node 20.x):
//   node --test src/pages/fundraiser/founderDraftEconomics.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__f1founder.bundle.mjs");
let React, createRoot, act, Founder, window;

const GATE_STUB = `export const isFundraiserUiEnabled = () => !!globalThis.__flag;`;

// Every storage write attempted anywhere in the flow, so "nothing is persisted locally" is proven
// rather than assumed. Reads stay untouched — the API client legitimately reads the auth token.
let storageWrites = [];

before(async () => {
  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /fundraiserGate\.js$/ }, (a) => ({ path: a.path, namespace: "gate" }));
    b.onLoad({ filter: /.*/, namespace: "gate" }, () => ({ contents: GATE_STUB, loader: "js" }));
  } };
  const entry = join(__dirname, ".__f1founder.jsx");
  writeFileSync(entry, `export { default as Founder } from "./FounderFundraisingDashboard.jsx";\n`);
  await esbuild.build({
    entryPoints: [entry], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [stub], logLevel: "silent",
  });
  rmSync(entry, { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.MouseEvent = window.MouseEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  for (const store of [window.localStorage, window.sessionStorage]) {
    for (const m of ["setItem", "removeItem", "clear"]) {
      const orig = store[m].bind(store);
      store[m] = (...a) => { storageWrites.push({ method: m, key: a[0] }); return orig(...a); };
    }
  }

  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Founder } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

// ── fixtures ──────────────────────────────────────────────────────────────────────────────────
const ORG = { organizationId: "org_ce665b98", legalName: "NJ Mediation Service", orgType: "nonprofit", status: "approved", adminUserIds: [] };
const OTHER_ORG = { organizationId: "org_second999", legalName: "Second Org", orgType: "school", status: "approved", adminUserIds: [] };
// Campaign records exactly as the campaign service returns them.
const CAMPAIGNS = [
  { campaignId: "cmp_dccf5283", organizationId: ORG.organizationId, title: "Spring Drive", status: "draft" },
  { campaignId: "cmp_fall00042", organizationId: ORG.organizationId, title: "Fall Drive", status: "active" },
];
const OVERVIEW = { organizations: { total: 2 }, campaigns: { total: 2 }, participants: { total: 0 }, economics: { activeVersions: 0 } };
const DRAFT_OK = { id: "economics_server_7f21", status: "draft" };

// A sealed, in-force version whose initial share is TIERED — a shape F1 can read but never create.
const ACTIVE_TIERED = {
  id: "economics_active_001", campaignId: CAMPAIGNS[0].campaignId, economicsVersion: 3, status: "active",
  rules: {
    initialSubscriptionShare: { type: "tiered", basis: "ENGP", tiers: [{ thresholdCents: 0, percent: 5 }, { thresholdCents: 50000, percent: 9 }] },
    renewalShare: { type: "percent_of_base", basis: "ENSR", percent: 12.5 },
    giftParticipationEnabled: true,
    giftShare: { type: "custom", notes: "negotiated per gift SKU" },
  },
  treatments: { onboardingFeeTreatment: "excluded_retained", veteransContributionTreatment: "excluded", discountTreatment: "ineligible", taxTreatment: "excluded_from_base", processorFeeTreatment: "net_of_processor" },
};

// ── harness ───────────────────────────────────────────────────────────────────────────────────
let calls = [];

function installFetch(routes) {
  calls = [];
  globalThis.fetch = (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || "GET", body: opts.body });
    // Suffix-first matching: "/campaigns" and "/economics/history" both appear inside the history
    // URL, and only the suffix disambiguates them.
    const key = Object.keys(routes).find((k) => u.endsWith(k)) || Object.keys(routes).find((k) => u.includes(k));
    const r = key ? routes[key] : { status: 200, data: {} };
    if (r === "pending") return new Promise(() => {});
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.data });
  };
}

const baseRoutes = (over = {}) => ({
  "/admin/overview": { status: 200, data: OVERVIEW },
  "/admin/organizations": { status: 200, data: [ORG, OTHER_ORG] },
  "/totals/participants": { status: 200, data: { participants: 0, attributionRecords: 0 } },
  "/totals/ledger": { status: 200, data: { conversions: 0, renewals: 0, refunds: 0 } },
  "/reconciliation": { status: 200, data: { reconciled: true } },
  "/payouts/status": { status: 503, data: { disabled: true } },
  "/audit": { status: 200, data: [] },
  "/campaigns": { status: 200, data: CAMPAIGNS },
  "/economics/history": { status: 200, data: [] },
  "/economics/draft": { status: 200, data: DRAFT_OK },
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
async function setInput(id, value) {
  const el = $(id);
  assert.ok(el, `expected a control [data-testid="${id}"]`);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await settle();
}
async function toggleGift() {
  const el = $("f1-gift-toggle");
  assert.ok(el, "expected the gift-participation checkbox");
  await act(async () => { el.click(); });
  await settle();
}

async function mount(routes, { flag = true } = {}) {
  installFetch(routes);
  storageWrites = [];
  globalThis.__flag = flag;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Founder)); });
  await settle();
  return root;
}

async function openOrgRow(legalName) {
  const row = [...document.querySelectorAll("tr")].find((tr) => tr.textContent.includes(legalName));
  assert.ok(row, `the organization row for ${legalName} must render`);
  const open = [...row.querySelectorAll("button")].find((b) => b.textContent.trim() === "Open");
  assert.ok(open, "the organization row must offer Open");
  await click(open);
}

async function mountAndOpen(routes) {
  await mount(routes);
  await openOrgRow(ORG.legalName);
}

const submit = async () => { await click($("f1-submit")); };
const draftCalls = () => calls.filter((c) => c.method === "POST" && c.url.includes("/economics/draft"));
const lastDraftBody = () => JSON.parse(draftCalls()[draftCalls().length - 1].body);

/** Fill every field with a complete, server-legal set of terms. Nothing is defaulted by the UI. */
async function fillComplete({ percent = "10", campaign = CAMPAIGNS[0].campaignId } = {}) {
  await setSelect("f1-campaign", campaign);
  await setSelect("f1-initial-type", "percent_of_base");
  await setSelect("f1-initial-basis", "ENSR");
  await setInput("f1-initial-percent", percent);
  await setSelect("f1-renewal-type", "none");
  await setSelect("f1-onboardingFeeTreatment", "excluded_retained");
  await setSelect("f1-veteransContributionTreatment", "excluded");
  await setSelect("f1-discountTreatment", "ineligible");
  await setSelect("f1-taxTreatment", "excluded_from_base");
  await setSelect("f1-processorFeeTreatment", "net_of_processor");
}

/** Choose every treatment, leaving the shares alone. */
async function fillTreatments() {
  await setSelect("f1-onboardingFeeTreatment", "excluded_retained");
  await setSelect("f1-veteransContributionTreatment", "excluded");
  await setSelect("f1-discountTreatment", "ineligible");
  await setSelect("f1-taxTreatment", "excluded_from_base");
  await setSelect("f1-processorFeeTreatment", "net_of_processor");
}

beforeEach(() => { storageWrites = []; });

// ── 1 · founder-only visibility ───────────────────────────────────────────────────────────────

test("F1 visibility: gate OFF renders the dormant state, no panel and ZERO requests", async () => {
  await mount(baseRoutes(), { flag: false });
  assert.equal($("f1-economics"), null, "no draft-economics panel while the fundraiser gate is off");
  assert.equal($("f1-form"), null);
  assert.equal(calls.length, 0, "a dormant dashboard must not call the fundraiser API at all");
});

test("F1 visibility: a non-founder (403) sees no panel and can issue no draft", async () => {
  await mount(baseRoutes({ "/admin/overview": { status: 403, data: { error: "forbidden" } } }));
  assert.equal($("f1-economics"), null, "403 must not render the draft-economics panel");
  assert.equal($("f1-form"), null);
  assert.equal(draftCalls().length, 0);
});

test("F1 visibility: an expired session (401) sees no panel and can issue no draft", async () => {
  await mount(baseRoutes({ "/admin/overview": { status: 401, data: { error: "unauthenticated" } } }));
  assert.equal($("f1-economics"), null, "401 must not render the draft-economics panel");
  assert.equal($("f1-form"), null);
  assert.equal(draftCalls().length, 0);
});

test("F1 visibility: the panel appears only once a founder opens an organization", async () => {
  await mount(baseRoutes());
  assert.equal($("f1-economics"), null, "no panel before an organization is selected");
  await openOrgRow(ORG.legalName);
  assert.ok($("f1-economics"), "the panel renders inside the opened organization");
});

// ── 2 · ids come from server records ──────────────────────────────────────────────────────────

test("F1 identity: the campaign is CHOSEN from server records, never typed", async () => {
  await mountAndOpen(baseRoutes());
  const el = $("f1-campaign");
  assert.equal(el.tagName, "SELECT", "the campaign must be picked from the server's list, not free text");
  const values = [...el.querySelectorAll("option")].map((o) => o.value);
  assert.deepEqual(values, ["", CAMPAIGNS[0].campaignId, CAMPAIGNS[1].campaignId]);
  assert.equal(el.value, "", "no campaign is preselected");
  const labels = [...el.querySelectorAll("option")].map((o) => o.textContent);
  assert.ok(labels.some((t) => t.includes("Spring Drive")), "server-supplied titles are shown");
});

test("F1 identity: the payload carries the OPENED organization's id and the SELECTED campaign id", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete({ campaign: CAMPAIGNS[1].campaignId });
  await submit();
  const body = lastDraftBody();
  assert.equal(body.organizationId, ORG.organizationId);
  assert.equal(body.campaignId, CAMPAIGNS[1].campaignId);
});

test("F1 identity: campaigns are re-read per organization and no choice leaks across orgs", async () => {
  await mountAndOpen(baseRoutes());
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  await setSelect("f1-initial-type", "percent_of_base");
  assert.equal($("f1-campaign").value, CAMPAIGNS[0].campaignId);

  await openOrgRow(OTHER_ORG.legalName);
  assert.equal($("f1-campaign").value, "", "opening another organization clears the campaign choice");
  assert.equal($("f1-initial-type").value, "", "and clears every term");
  assert.equal($("f1-gift-toggle").checked, false);

  const campaignReads = calls.filter((c) => c.method === "GET" && c.url.endsWith("/campaigns"));
  assert.equal(campaignReads.length, 2, "campaigns are read per organization");
  assert.ok(campaignReads[0].url.includes(ORG.organizationId));
  assert.ok(campaignReads[1].url.includes(OTHER_ORG.organizationId));
});

test("F1 identity: an organization with no campaigns says so and offers nothing to submit", async () => {
  await mountAndOpen(baseRoutes({ "/campaigns": { status: 200, data: [] } }));
  assert.ok($("f1-no-campaigns"), "the empty state is stated, not hidden");
  assert.deepEqual([...$("f1-campaign").querySelectorAll("option")].map((o) => o.value), [""]);
  await submit();
  assert.equal(draftCalls().length, 0);
  assert.ok($("f1-err-selection"), "the missing campaign is named");
});

// ── 3 · incomplete forms send nothing ─────────────────────────────────────────────────────────

test("F1 gating: submitting an EMPTY form sends zero requests and names every gap", async () => {
  await mountAndOpen(baseRoutes());
  const before = calls.length;
  await submit();
  assert.equal(draftCalls().length, 0, "an empty form must not reach the server");
  assert.equal(calls.length, before, "an empty form must issue no request of any kind");
  assert.ok($("f1-err-selection"), "the missing campaign is named");
  assert.ok($("f1-err-initial"), "the missing initial share is named");
  assert.ok($("f1-err-renewal"), "the missing renewal share is named");
  for (const k of ["onboardingFeeTreatment", "veteransContributionTreatment", "discountTreatment", "taxTreatment", "processorFeeTreatment"]) {
    assert.ok($(`f1-err-${k}`), `the missing ${k} is named`);
  }
  assert.equal($("f1-result"), null, "nothing is reported as created");
});

test("F1 gating: a form missing ONLY the treatments still sends nothing", async () => {
  await mountAndOpen(baseRoutes());
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  await setSelect("f1-initial-type", "none");
  await setSelect("f1-renewal-type", "none");
  const before = calls.length;
  await submit();
  assert.equal(draftCalls().length, 0);
  assert.equal(calls.length, before);
  assert.ok($("f1-err-taxTreatment"));
});

test("F1 gating: a form missing ONLY the campaign still sends nothing", async () => {
  await mountAndOpen(baseRoutes());
  await setSelect("f1-initial-type", "none");
  await setSelect("f1-renewal-type", "none");
  await fillTreatments();
  await submit();
  assert.equal(draftCalls().length, 0, "the client must never invent a campaign id");
  assert.ok($("f1-err-selection"));
});

// ── 4-7 · percentage handling ─────────────────────────────────────────────────────────────────

test("F1 percent: 10 is transmitted as the number 10 — percentage points, never a fraction", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete({ percent: "10" });
  await submit();
  const rule = lastDraftBody().rules.initialSubscriptionShare;
  assert.equal(rule.percent, 10);
  assert.equal(typeof rule.percent, "number");
  assert.notEqual(rule.percent, 0.1, "10% must NOT be sent as the fraction 0.1");
  assert.match(draftCalls()[0].body, /"percent":10\b/, "the wire body carries 10 verbatim");
  assert.equal(rule.basis, "ENSR");
  assert.equal(rule.type, "percent_of_base");
  // The unit is stated on screen so the number is not ambiguous to the founder either.
  assert.match($("f1-economics").textContent.replace(/\s+/g, " "), /percentage points/i);
});

test("F1 percent: 0 is a real, accepted choice — not treated as empty", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete({ percent: "0" });
  await submit();
  assert.equal(draftCalls().length, 1, "0% is a legitimate term and must be sent");
  assert.equal(lastDraftBody().rules.initialSubscriptionShare.percent, 0);
  assert.equal($("f1-err-initial"), null);
});

test("F1 percent: a fractional value is carried through unchanged", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete({ percent: "12.5" });
  await submit();
  assert.equal(lastDraftBody().rules.initialSubscriptionShare.percent, 12.5);
});

test("F1 percent: 100 is accepted at the boundary", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete({ percent: "100" });
  await submit();
  assert.equal(lastDraftBody().rules.initialSubscriptionShare.percent, 100);
});

for (const [label, value, why] of [
  ["negative", "-5", /negative/i],
  ["greater than 100", "150", /exceed|100/i],
  ["greater than 100 by a hair", "100.01", /exceed|100/i],
  ["non-numeric", "abc", /number/i],
  ["non-finite", "Infinity", /number/i],
  ["NaN", "NaN", /number/i],
  ["blank", "   ", /percentage|number/i],
]) {
  test(`F1 percent: a ${label} value is REFUSED with a visible reason and sends nothing`, async () => {
    await mountAndOpen(baseRoutes());
    await fillComplete({ percent: value });
    const before = calls.length;
    await submit();
    assert.equal(draftCalls().length, 0, `${label} must never reach the server`);
    assert.equal(calls.length, before, `${label} must issue no request at all`);
    const err = $("f1-err-initial");
    assert.ok(err, `${label} must be explained on screen`);
    assert.match(err.textContent, why);
    assert.equal($("f1-result"), null);
  });
}

test("F1 percent: a refused value is NOT silently clamped, zeroed or rewritten", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete({ percent: "150" });
  await submit();
  assert.equal($("f1-initial-percent").value, "150", "the founder's entry is left exactly as typed");
  assert.equal(draftCalls().length, 0, "and nothing is sent in its place");

  await setInput("f1-initial-percent", "-5");
  await submit();
  assert.equal($("f1-initial-percent").value, "-5", "a negative entry is not coerced to 0");
  assert.equal(draftCalls().length, 0);

  await setInput("f1-initial-percent", "abc");
  await submit();
  assert.equal($("f1-initial-percent").value, "abc", "a non-numeric entry is not coerced to 0");
  assert.equal(draftCalls().length, 0);

  // Correcting the entry is all it takes — the refusal never poisoned the rest of the form.
  await setInput("f1-initial-percent", "10");
  await submit();
  assert.equal(draftCalls().length, 1);
  assert.equal(lastDraftBody().rules.initialSubscriptionShare.percent, 10);
});

// ── 8-10 · share types ────────────────────────────────────────────────────────────────────────

test("F1 shares: no share type is preselected and 'tiered' is not offered for drafting", async () => {
  await mountAndOpen(baseRoutes());
  for (const id of ["f1-initial-type", "f1-renewal-type"]) {
    assert.equal($(id).value, "", `${id} starts unchosen`);
    const values = [...$(id).querySelectorAll("option")].map((o) => o.value);
    assert.deepEqual(values, ["", "none", "percent_of_base", "custom"]);
    assert.ok(!values.includes("tiered"), "F1 must not offer to draft a tiered share");
  }
});

test("F1 shares: 'none' produces exactly { type: 'none' } with no basis or percent", async () => {
  await mountAndOpen(baseRoutes());
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  await setSelect("f1-initial-type", "none");
  assert.equal($("f1-initial-basis"), null, "'none' exposes no basis control");
  assert.equal($("f1-initial-percent"), null, "'none' exposes no percentage control");
  await setSelect("f1-renewal-type", "none");
  await setSelect("f1-onboardingFeeTreatment", "excluded_waived");
  await setSelect("f1-veteransContributionTreatment", "contribute_from_platform_share_only");
  await setSelect("f1-discountTreatment", "eligible_on_net");
  await setSelect("f1-taxTreatment", "excluded_from_base");
  await setSelect("f1-processorFeeTreatment", "gross_absorbed_by_platform");
  await submit();
  const rules = lastDraftBody().rules;
  assert.deepEqual(rules.initialSubscriptionShare, { type: "none" });
  assert.deepEqual(rules.renewalShare, { type: "none" });
});

test("F1 shares: 'custom' REQUIRES a note, then sends the note verbatim", async () => {
  await mountAndOpen(baseRoutes());
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  await setSelect("f1-initial-type", "custom");
  await setSelect("f1-renewal-type", "none");
  await fillTreatments();

  await submit();
  assert.equal(draftCalls().length, 0, "an unexplained custom term must not be sent");
  assert.match($("f1-err-initial").textContent, /note/i);

  await setInput("f1-initial-notes", "   ");
  await submit();
  assert.equal(draftCalls().length, 0, "whitespace is not a description");

  await setInput("f1-initial-notes", "Flat $3 per conversion, invoiced quarterly");
  await submit();
  assert.equal(draftCalls().length, 1);
  assert.deepEqual(lastDraftBody().rules.initialSubscriptionShare,
    { type: "custom", notes: "Flat $3 per conversion, invoiced quarterly" });
});

test("F1 shares: 'percent_of_base' REQUIRES both a basis and a percentage", async () => {
  await mountAndOpen(baseRoutes());
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  await setSelect("f1-initial-type", "percent_of_base");
  await setSelect("f1-renewal-type", "none");
  await fillTreatments();

  assert.equal($("f1-initial-basis").value, "", "no basis is preselected");
  assert.equal($("f1-initial-percent").value, "", "no percentage is prefilled");
  assert.deepEqual([...$("f1-initial-basis").querySelectorAll("option")].map((o) => o.value),
    ["", "ENSR", "ENGP", "gross", "custom"]);

  await setInput("f1-initial-percent", "10");
  await submit();
  assert.equal(draftCalls().length, 0, "a percentage without a basis is not a term");
  assert.match($("f1-err-initial").textContent, /basis/i);

  await setSelect("f1-initial-basis", "ENGP");
  await setInput("f1-initial-percent", "");
  await submit();
  assert.equal(draftCalls().length, 0, "a basis without a percentage is not a term");
  assert.match($("f1-err-initial").textContent, /percentage/i);

  await setInput("f1-initial-percent", "10");
  await submit();
  assert.deepEqual(lastDraftBody().rules.initialSubscriptionShare,
    { type: "percent_of_base", basis: "ENGP", percent: 10 });
});

test("F1 shares: the renewal share is validated independently of the initial share", async () => {
  await mountAndOpen(baseRoutes());
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  await setSelect("f1-initial-type", "none");
  await setSelect("f1-renewal-type", "percent_of_base");
  await setSelect("f1-renewal-basis", "gross");
  await setInput("f1-renewal-percent", "-1");
  await fillTreatments();
  await submit();
  assert.equal(draftCalls().length, 0);
  assert.ok($("f1-err-renewal"));
  assert.equal($("f1-err-initial"), null, "a valid initial share is not blamed");

  await setInput("f1-renewal-percent", "4");
  await submit();
  assert.deepEqual(lastDraftBody().rules.renewalShare, { type: "percent_of_base", basis: "gross", percent: 4 });
});

// ── 11-12 · gift participation ────────────────────────────────────────────────────────────────

test("F1 gifts: participation defaults visibly OFF and is stated as false", async () => {
  await mountAndOpen(baseRoutes());
  const box = $("f1-gift-toggle");
  assert.equal(box.type, "checkbox");
  assert.equal(box.checked, false, "gift participation must default to off, visibly");
  assert.equal($("f1-gift-type"), null, "no gift terms are offered while it is off");
  await fillComplete();
  await submit();
  const rules = lastDraftBody().rules;
  assert.equal(rules.giftParticipationEnabled, false, "the off position is stated, not omitted");
  assert.ok(!("giftShare" in rules), "no gift share is invented while participation is off");
});

test("F1 gifts: enabling participation REQUIRES a complete gift share", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete();
  await toggleGift();
  assert.equal($("f1-gift-toggle").checked, true);
  assert.ok($("f1-gift-type"), "enabling reveals the gift terms");
  assert.equal($("f1-gift-type").value, "", "and preselects nothing");

  await submit();
  assert.equal(draftCalls().length, 0, "gift participation without terms must not be sent");
  assert.ok($("f1-err-gift"));

  await setSelect("f1-gift-type", "percent_of_base");
  await submit();
  assert.equal(draftCalls().length, 0, "a gift percentage without a basis is incomplete");

  await setSelect("f1-gift-basis", "ENSR");
  await setInput("f1-gift-percent", "150");
  await submit();
  assert.equal(draftCalls().length, 0, "the gift share is validated by the same rules");

  await setInput("f1-gift-percent", "3");
  await submit();
  assert.equal(draftCalls().length, 1);
  const rules = lastDraftBody().rules;
  assert.equal(rules.giftParticipationEnabled, true);
  assert.deepEqual(rules.giftShare, { type: "percent_of_base", basis: "ENSR", percent: 3 });
});

test("F1 gifts: a custom gift share needs its own note", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete();
  await toggleGift();
  await setSelect("f1-gift-type", "custom");
  await submit();
  assert.equal(draftCalls().length, 0);
  assert.match($("f1-err-gift").textContent, /note/i);

  await setInput("f1-gift-notes", "per-SKU schedule attached to the signed addendum");
  await submit();
  assert.deepEqual(lastDraftBody().rules.giftShare,
    { type: "custom", notes: "per-SKU schedule attached to the signed addendum" });
});

test("F1 gifts: turning participation back off drops the gift share entirely", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete();
  await toggleGift();
  await setSelect("f1-gift-type", "none");
  await toggleGift();
  assert.equal($("f1-gift-toggle").checked, false);
  await submit();
  const rules = lastDraftBody().rules;
  assert.equal(rules.giftParticipationEnabled, false);
  assert.ok(!("giftShare" in rules));
});

// ── 13-14 · treatments ────────────────────────────────────────────────────────────────────────

test("F1 treatments: all five start unchosen and each is individually required", async () => {
  const KEYS = ["onboardingFeeTreatment", "veteransContributionTreatment", "discountTreatment", "taxTreatment", "processorFeeTreatment"];
  const CHOICE = {
    onboardingFeeTreatment: "excluded_waived",
    veteransContributionTreatment: "contribute_from_platform_share_only",
    discountTreatment: "eligible_on_gross",
    taxTreatment: "excluded_from_base",
    processorFeeTreatment: "gross_absorbed_by_platform",
  };
  await mountAndOpen(baseRoutes());
  for (const k of KEYS) assert.equal($(`f1-${k}`).value, "", `${k} must start unchosen`);

  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  await setSelect("f1-initial-type", "none");
  await setSelect("f1-renewal-type", "none");

  // Choose them one at a time: the form must stay blocked until the last one is chosen.
  for (let i = 0; i < KEYS.length; i++) {
    await submit();
    assert.equal(draftCalls().length, 0, `still blocked with ${i} of 5 treatments chosen`);
    assert.ok($(`f1-err-${KEYS[i]}`), `${KEYS[i]} is named as missing`);
    await setSelect(`f1-${KEYS[i]}`, CHOICE[KEYS[i]]);
  }
  await submit();
  assert.equal(draftCalls().length, 1);
  assert.deepEqual(lastDraftBody().treatments, CHOICE);
});

test("F1 treatments: taxTreatment has one legal value but is never selected silently", async () => {
  await mountAndOpen(baseRoutes());
  const tax = $("f1-taxTreatment");
  const values = [...tax.querySelectorAll("option")].map((o) => o.value);
  assert.deepEqual(values, ["", "excluded_from_base"], "the sole legal value is still an explicit choice");
  assert.equal(tax.value, "", "a single-valued treatment must NOT be preselected");

  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  await setSelect("f1-initial-type", "none");
  await setSelect("f1-renewal-type", "none");
  await setSelect("f1-onboardingFeeTreatment", "excluded_retained");
  await setSelect("f1-veteransContributionTreatment", "excluded");
  await setSelect("f1-discountTreatment", "ineligible");
  await setSelect("f1-processorFeeTreatment", "net_of_processor");
  await submit();
  assert.equal(draftCalls().length, 0, "the unchosen tax treatment alone blocks the draft");
  assert.ok($("f1-err-taxTreatment"));

  await setSelect("f1-taxTreatment", "excluded_from_base");
  await submit();
  assert.equal(lastDraftBody().treatments.taxTreatment, "excluded_from_base");
});

test("F1 treatments: only the backend's enumerated values are offered", async () => {
  const ENUMS = {
    onboardingFeeTreatment: ["excluded_retained", "excluded_waived"],
    veteransContributionTreatment: ["excluded", "contribute_from_platform_share_only"],
    discountTreatment: ["ineligible", "eligible_on_net", "eligible_on_gross"],
    taxTreatment: ["excluded_from_base"],
    processorFeeTreatment: ["net_of_processor", "gross_absorbed_by_platform"],
  };
  await mountAndOpen(baseRoutes());
  for (const [k, allowed] of Object.entries(ENUMS)) {
    const values = [...$(`f1-${k}`).querySelectorAll("option")].map((o) => o.value);
    assert.deepEqual(values, ["", ...allowed], `${k} offers exactly the server's enum`);
  }
});

// ── 15 · payload shape ────────────────────────────────────────────────────────────────────────

test("F1 payload: exactly organizationId, campaignId, rules and treatments — nothing more", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete();
  await submit();
  const call = draftCalls()[0];
  assert.equal(call.method, "POST");
  assert.ok(call.url.endsWith("/api/fundraiser/admin/economics/draft"));
  const body = JSON.parse(call.body);
  assert.deepEqual(Object.keys(body).sort(), ["campaignId", "organizationId", "rules", "treatments"]);
  // No client-asserted commercial silence: mechanics / lifecycleRules / customTerms are left
  // unspecified rather than sent as null, so the UI never states a term nobody made.
  for (const k of ["mechanics", "lifecycleRules", "customTerms", "status", "actor", "approve", "activate", "effectiveFrom"]) {
    assert.ok(!(k in body), `${k} must not appear in the draft payload`);
  }
  assert.deepEqual(Object.keys(body.rules).sort(), ["giftParticipationEnabled", "initialSubscriptionShare", "renewalShare"]);
  assert.deepEqual(Object.keys(body.treatments).sort(),
    ["discountTreatment", "onboardingFeeTreatment", "processorFeeTreatment", "taxTreatment", "veteransContributionTreatment"]);
});

// ── 16 · success is the server's word, not the client's ───────────────────────────────────────

test("F1 success: the version id and status are ADOPTED from the server response", async () => {
  await mountAndOpen(baseRoutes({ "/economics/draft": { status: 200, data: { versionId: "economics_from_server_77", status: "draft" } } }));
  await fillComplete();
  await submit();
  assert.ok($("f1-result"), "success is reported only after the server answered");
  assert.equal($("f1-version").textContent, "economics_from_server_77");
  assert.equal($("f1-status").textContent, "draft");
});

test("F1 success: an unexpected server status is shown as-is, not normalised to 'draft'", async () => {
  await mountAndOpen(baseRoutes({ "/economics/draft": { status: 200, data: { id: "economics_odd_9", status: "archived" } } }));
  await fillComplete();
  await submit();
  assert.equal($("f1-version").textContent, "economics_odd_9");
  assert.equal($("f1-status").textContent, "archived", "the client does not overwrite the server's status");
});

test("F1 success: the result states plainly that the draft is neither approved nor active", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete();
  await submit();
  const text = $("f1-result").textContent.replace(/\s+/g, " ");
  assert.match(text, /not approved and not active/i);
  assert.ok(!/\\u[0-9a-f]{4}/i.test(text), "no unrendered escape sequences leak into the sentence");
  // The panel's standing promise is on screen too, and free of escape artefacts.
  const panel = $("f1-economics").textContent.replace(/\s+/g, " ");
  assert.match(panel, /does not approve terms, activate economics, or change the campaign's status/i);
  assert.ok(!/\\u[0-9a-f]{4}/i.test(panel), "the panel renders real characters, not escape sequences");
});

// ── 17 · failures are honest ──────────────────────────────────────────────────────────────────

for (const [status, pattern] of [
  [400, /rejected|check the values/i],
  [401, /session|sign in/i],
  [403, /founder/i],
  [404, /no longer exists/i],
  [409, /changed while you were editing|reload/i],
]) {
  test(`F1 failure: ${status} is reported honestly and claims no draft was created`, async () => {
    await mountAndOpen(baseRoutes({ "/economics/draft": { status, data: { error: "INTERNAL_CODE_" + status } } }));
    await fillComplete();
    await submit();
    assert.equal($("f1-result"), null, `${status} must not render a success`);
    assert.equal($("f1-version"), null);
    const msg = $("f1-message");
    assert.ok(msg, `${status} must be explained`);
    assert.match(msg.textContent, pattern);
    assert.ok(!/INTERNAL_CODE_/.test(document.body.textContent), "internal codes are not leaked to the founder");
    assert.ok(!/created|success/i.test(msg.textContent), "the message must not imply success");
  });
}

test("F1 failure: a network failure is reported as unreachable, not as success", async () => {
  await mountAndOpen(baseRoutes({ "/economics/draft": new Error("ECONNRESET") }));
  await fillComplete();
  await submit();
  assert.equal($("f1-result"), null);
  assert.match($("f1-message").textContent, /couldn't reach|connection/i);
});

test("F1 failure: a 500 falls back to an honest, non-optimistic message", async () => {
  await mountAndOpen(baseRoutes({ "/economics/draft": { status: 500, data: { error: "boom" } } }));
  await fillComplete();
  await submit();
  assert.equal($("f1-result"), null);
  assert.match($("f1-message").textContent, /didn't go through/i);
});

test("F1 failure: a stale success is cleared before the next attempt", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete();
  await submit();
  assert.ok($("f1-result"), "first attempt succeeded");
  installFetch(baseRoutes({ "/economics/draft": { status: 409, data: {} } }));
  await submit();
  assert.equal($("f1-result"), null, "the previous success must not linger over a failure");
  assert.ok($("f1-message"));
});

// ── 18-19 · existing sealed terms ─────────────────────────────────────────────────────────────

test("F1 existing: an ACTIVE version is rendered READ-ONLY with no control to change it", async () => {
  await mountAndOpen(baseRoutes({ "/economics/history": { status: 200, data: [ACTIVE_TIERED] } }));
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  const existing = $("f1-existing");
  assert.ok(existing, "the in-force version is shown");
  assert.match(existing.textContent, /active/i);
  assert.match(existing.textContent, /read-only/i);
  assert.equal(existing.querySelectorAll("input, select, textarea, button").length, 0,
    "sealed terms expose no editable control");
});

test("F1 existing: sealed terms are never loaded into the draft form", async () => {
  await mountAndOpen(baseRoutes({ "/economics/history": { status: 200, data: [ACTIVE_TIERED] } }));
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  assert.equal($("f1-initial-type").value, "", "the active version does not seed the new draft");
  assert.equal($("f1-renewal-type").value, "");
  assert.equal($("f1-gift-toggle").checked, false, "an active gift position is not copied forward");
  for (const k of ["onboardingFeeTreatment", "veteransContributionTreatment", "discountTreatment", "taxTreatment", "processorFeeTreatment"]) {
    assert.equal($(`f1-${k}`).value, "", `${k} is not prefilled from the sealed version`);
  }
});

test("F1 existing: a TIERED share reads accurately instead of looking malformed", async () => {
  await mountAndOpen(baseRoutes({ "/economics/history": { status: 200, data: [ACTIVE_TIERED] } }));
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  assert.equal($("f1-existing-initial").textContent, "tiered (2 tiers) of ENGP");
  assert.equal($("f1-existing-renewal").textContent, "12.5% of ENSR");
  assert.equal($("f1-existing-gift").textContent, "custom — negotiated per gift SKU");
  // ...and reading one must not make drafting one possible.
  const values = [...$("f1-initial-type").querySelectorAll("option")].map((o) => o.value);
  assert.ok(!values.includes("tiered"), "reading a tiered share must not expose a tiered draft option");
});

test("F1 existing: a single-tier share is described in the singular", async () => {
  const oneTier = { ...ACTIVE_TIERED, rules: { ...ACTIVE_TIERED.rules,
    initialSubscriptionShare: { type: "tiered", basis: "gross", tiers: [{ thresholdCents: 0, percent: 7 }] } } };
  await mountAndOpen(baseRoutes({ "/economics/history": { status: 200, data: [oneTier] } }));
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  assert.equal($("f1-existing-initial").textContent, "tiered (1 tier) of gross");
});

test("F1 existing: an APPROVED version is preferred over a newer draft, and stays read-only", async () => {
  const approved = { ...ACTIVE_TIERED, id: "economics_approved_2", status: "approved", economicsVersion: 2 };
  const draft = { ...ACTIVE_TIERED, id: "economics_draft_5", status: "draft", economicsVersion: 5 };
  await mountAndOpen(baseRoutes({ "/economics/history": { status: 200, data: [draft, approved] } }));
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  assert.match($("f1-existing").textContent, /approved/i);
  assert.equal($("f1-existing").querySelectorAll("input, select, textarea, button").length, 0);
});

test("F1 existing: history is re-read per campaign and does not carry across", async () => {
  await mountAndOpen(baseRoutes({ "/economics/history": { status: 200, data: [ACTIVE_TIERED] } }));
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  assert.ok($("f1-existing"));
  installFetch(baseRoutes({ "/economics/history": { status: 200, data: [] } }));
  await setSelect("f1-campaign", CAMPAIGNS[1].campaignId);
  assert.equal($("f1-existing"), null, "the previous campaign's terms must not linger");
  const reads = calls.filter((c) => c.url.includes("/economics/history"));
  assert.equal(reads.length, 1);
  assert.ok(reads[0].url.includes(CAMPAIGNS[1].campaignId));
});

test("F1 existing: a campaign with no history shows no sealed terms and still allows a draft", async () => {
  await mountAndOpen(baseRoutes());
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  assert.equal($("f1-existing"), null);
  await setSelect("f1-initial-type", "none");
  await setSelect("f1-renewal-type", "none");
  await fillTreatments();
  await submit();
  assert.equal(draftCalls().length, 1);
});

// ── 20 · nothing else happens ─────────────────────────────────────────────────────────────────

test("F1 blast radius: no storage writes anywhere in the flow", async () => {
  await mountAndOpen(baseRoutes({ "/economics/history": { status: 200, data: [ACTIVE_TIERED] } }));
  storageWrites = [];
  await fillComplete();
  await toggleGift();
  await setSelect("f1-gift-type", "none");
  await submit();
  assert.ok($("f1-result"), "the draft was created");
  assert.deepEqual(storageWrites, [], "F1 must not persist anything locally");
});

test("F1 blast radius: no approval, activation, campaign-status or payout request is ever issued", async () => {
  await mountAndOpen(baseRoutes({ "/economics/history": { status: 200, data: [ACTIVE_TIERED] } }));
  const mark = calls.length;                      // everything after this is the F1 flow alone
  await fillComplete();
  await submit();
  assert.equal(draftCalls().length, 1);

  const after = calls.slice(mark);
  for (const c of after) {
    assert.ok(!/\/approve$/.test(c.url), `no approval request (${c.url})`);
    assert.ok(!/\/activate$/.test(c.url), `no activation request (${c.url})`);
    assert.ok(!/\/campaigns\/[^/]+\/status$/.test(c.url), `no campaign-status request (${c.url})`);
    assert.ok(!/\/change-rate$/.test(c.url), `no org-wide rate change (${c.url})`);
    assert.ok(!(c.method !== "GET" && c.url.includes("/payouts")), `no payout request (${c.url})`);
  }
  // Exactly one write in the whole flow, and it is the draft.
  const writes = after.filter((c) => c.method !== "GET");
  assert.equal(writes.length, 1);
  assert.ok(writes[0].url.endsWith("/economics/draft"));
});

test("F1 blast radius: the panel offers no approve/activate/publish control at all", async () => {
  await mountAndOpen(baseRoutes({ "/economics/history": { status: 200, data: [ACTIVE_TIERED] } }));
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  const labels = [...$("f1-economics").querySelectorAll("button")].map((b) => b.textContent.trim().toLowerCase());
  assert.deepEqual(labels, ["create draft economics"]);
  const panel = $("f1-economics").textContent.toLowerCase();
  for (const word of ["publish", "go live", "suspend", "activate economics now"]) {
    assert.ok(!panel.includes(word), `the panel must not offer or imply "${word}"`);
  }
});

test("F1 blast radius: a successful draft neither retries nor auto-resubmits", async () => {
  await mountAndOpen(baseRoutes());
  await fillComplete();
  await submit();
  assert.equal(draftCalls().length, 1);
  await settle();
  await settle();
  assert.equal(draftCalls().length, 1, "success must not retry, poll, or auto-resubmit");
});
