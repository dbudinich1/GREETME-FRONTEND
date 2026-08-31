// src/pages/fundraiser/founderActivateEconomics.browser.test.mjs
//
// TEAM B (F3) — RENDERED coverage of ACTIVATE APPROVED ECONOMICS on the founder dashboard. The
// REAL FounderFundraisingDashboard is esbuild-transformed and mounted in jsdom against the REAL
// fundraiserApi client over a controllable global fetch. Only the fundraiser flag gate is stubbed.
//
// Activation puts terms into force from a chosen instant and may supersede the terms already
// running. So these tests are written to fail if the UI ever activates a version the server did
// not mark approved, activates without an explicit effective instant and a stated reason,
// transmits an instant other than the one previewed, guesses at an ambiguous or impossible date,
// sends anything beyond the two agreed fields, claims an activation the server never granted, or
// leaks a machine code into the page. Activation is also NOT campaign activation — nothing here
// may change campaign status or move payouts.
//
// The process timezone is deliberately NOT UTC: a control that silently reinterpreted the typed
// value in the browser's zone would shift the instant, and these tests must catch that.
//
// Run under the supported runtime (engines: node 20.x):
//   node --test src/pages/fundraiser/founderActivateEconomics.browser.test.mjs

process.env.TZ = "America/New_York";

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__f3founder.bundle.mjs");
let React, createRoot, act, Founder, window;

const GATE_STUB = `export const isFundraiserUiEnabled = () => !!globalThis.__flag;`;

let storageWrites = [];
let consoleLines = [];

before(async () => {
  // The zone must really be non-UTC, or the round-trip assertions below prove nothing. Asserted
  // against the RUNTIME's own offset, not against the process.env.TZ assignment above: a runner
  // that pins TZ itself, or a platform that ignores the assignment, would otherwise leave these
  // tests silently passing in UTC while claiming to prove the local zone cannot shift the instant.
  assert.notEqual(new Date("2026-09-01T00:00").getTimezoneOffset(), 0,
    "this suite is only meaningful under a non-UTC runtime timezone; got UTC");
  assert.notEqual(new Date("2026-11-01T01:30").getTimezoneOffset(), 0,
    "the ambiguous-instant case also requires a non-UTC runtime timezone");
  assert.notEqual(
    new Date("2026-09-01T00:00").toISOString(), "2026-09-01T00:00:00.000Z",
    "a local-zone parse must differ from the UTC instant for these assertions to bite",
  );

  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /fundraiserGate\.js$/ }, (a) => ({ path: a.path, namespace: "gate" }));
    b.onLoad({ filter: /.*/, namespace: "gate" }, () => ({ contents: GATE_STUB, loader: "js" }));
  } };
  const entry = join(__dirname, ".__f3founder.jsx");
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

  // Putting terms into force must not touch anything but the server. Storage writes and console
  // output are recorded so "nothing else changed" is proven rather than assumed.
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

/** A sealed, APPROVED version exactly as the economics history returns it. */
const APPROVED = Object.freeze({
  id: "economics_approved_v7", organizationId: ORG.organizationId, campaignId: CAMPAIGNS[0].campaignId,
  economicsVersion: 7, status: "approved",
  approvedBy: "founder_1", approvedAt: "2026-08-20T12:00:00.000Z",
  rules: {
    initialSubscriptionShare: { type: "percent_of_base", basis: "ENSR", percent: 10 },
    renewalShare: { type: "percent_of_base", basis: "ENGP", percent: 12.5 },
    giftParticipationEnabled: true,
    giftShare: { type: "percent_of_base", basis: "gross", percent: 3 },
  },
  treatments: { ...TREATMENTS },
});

/** An older version already in force — what activation would supersede. */
const IN_FORCE = Object.freeze({
  ...APPROVED, id: "economics_active_v6", economicsVersion: 6, status: "active",
  effectiveFrom: "2026-01-01T00:00:00.000Z",
});

/** The server's answer to a successful activation. */
const ACTIVATED = { ...APPROVED, status: "active", effectiveFrom: "2026-09-01T00:00:00.000Z" };

const withStatus = (status, over = {}) => ({ ...APPROVED, id: `economics_${status}_v9`, status, ...over });

// ── harness ───────────────────────────────────────────────────────────────────────────────────
let calls = [];
let activeRoutes = null;

function installFetch(routes) {
  calls = [];
  activeRoutes = routes;
  globalThis.fetch = (url, opts = {}) => {
    const u = String(url);
    calls.push({ url: u, method: opts.method || "GET", body: opts.body, headers: opts.headers || {} });
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
  "/economics/history": { status: 200, data: [APPROVED] },
  "/activate": { status: 200, data: ACTIVATED },
  ...over,
});

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const text = (id) => ($(id) ? $(id).textContent : null);
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
async function typeInto(id, value, proto) {
  const el = $(id);
  assert.ok(el, `expected a control [data-testid="${id}"]`);
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window[proto].prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await settle();
}
const typeWhen = (v) => typeInto("f3-when", v, "HTMLInputElement");
const typeReason = (v) => typeInto("f3-reason", v, "HTMLTextAreaElement");
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

/** Mount, open the fixture organization, and select the campaign that owns the approved version. */
async function openApproved(routes = baseRoutes(), campaign = CAMPAIGNS[0].campaignId) {
  await mount(routes);
  const row = [...document.querySelectorAll("tr")].find((tr) => tr.textContent.includes(ORG.legalName));
  assert.ok(row, "the organization row must render");
  await click([...row.querySelectorAll("button")].find((b) => b.textContent.trim() === "Open"));
  await setSelect("f1-campaign", campaign);
  return routes;
}

const activateCalls = () => calls.filter((c) => c.method === "POST" && c.url.includes("/activate"));
const historyReads = () => calls.filter((c) => c.url.includes("/economics/history"));
const bodyOf = (c) => JSON.parse(c.body);

/** Fill both inputs and open the confirmation. */
async function readyToConfirm(when = "2026-09-01T00:00", reason = "Signed term sheet; counsel cleared 2026-08-30.") {
  await typeWhen(when);
  await typeReason(reason);
  await click($("f3-activate"));
}

beforeEach(() => { storageWrites = []; consoleLines = []; });

// ── 1 · the control exists only for a server-returned APPROVED version ────────────────────────

test("F3 eligibility: a server APPROVED version offers review and activation", async () => {
  await openApproved();
  assert.ok($("f3-panel"), "the approved version awaiting activation is surfaced");
  assert.ok($("f3-review"), "and is reviewed before anything can be activated");
  assert.ok($("f3-activate"), "the activation control is offered");
});

for (const status of ["draft", "active", "suspended", "superseded", "archived"]) {
  test(`F3 eligibility: a ${status} version offers NO activation control`, async () => {
    await openApproved(baseRoutes({ "/economics/history": { status: 200, data: [withStatus(status)] } }));
    assert.equal($("f3-panel"), null, `a ${status} version is not activatable; the control must not appear`);
    assert.equal($("f3-activate"), null);
  });
}

test("F3 eligibility: an approved version with no server id is not activatable", async () => {
  const noId = { ...APPROVED }; delete noId.id; delete noId.versionId;
  await openApproved(baseRoutes({ "/economics/history": { status: 200, data: [noId] } }));
  assert.equal($("f3-panel"), null, "without a server identifier there is nothing to activate");
});

test("F3 eligibility: a failed history read offers no activation control", async () => {
  await openApproved(baseRoutes({ "/economics/history": { status: 500, data: { code: "BOOM" } } }));
  assert.equal($("f3-panel"), null, "eligibility must never survive a read the server did not answer");
  assert.equal(activateCalls().length, 0);
});

test("F3 eligibility: an empty history offers no activation control", async () => {
  await openApproved(baseRoutes({ "/economics/history": { status: 200, data: [] } }));
  assert.equal($("f3-panel"), null);
});

test("F3 eligibility: the NEWEST approved version is the one offered", async () => {
  const older = { ...APPROVED, id: "economics_approved_v3", economicsVersion: 3 };
  await openApproved(baseRoutes({ "/economics/history": { status: 200, data: [older, APPROVED] } }));
  assert.match(text("f3-review-version"), /economics_approved_v7/, "the highest version wins regardless of array order");
});

// ── 2 · what the founder is shown before deciding ─────────────────────────────────────────────

test("F3 review: the sealed terms are shown in full", async () => {
  await openApproved();
  assert.match(text("f3-review-org"), /NJ Mediation Service/);
  assert.match(text("f3-review-campaign"), /Spring Drive/);
  assert.match(text("f3-review-version"), /economics_approved_v7/);
  assert.match(text("f3-review-status"), /approved/);
  assert.match(text("f3-review-initial"), /10[\s\S]*ENSR/, "the initial share is shown as sealed");
  assert.match(text("f3-review-renewal"), /12\.5[\s\S]*ENGP/, "the renewal share is shown as sealed");
  assert.match(text("f3-review-gift"), /3[\s\S]*gross/, "the gift share is shown as sealed");
  assert.match(text("f3-review-taxTreatment"), /excluded_from_base/);
});

test("F3 review: the version currently in force is named, so supersession is visible", async () => {
  await openApproved(baseRoutes({ "/economics/history": { status: 200, data: [APPROVED, IN_FORCE] } }));
  assert.match(text("f3-review-current"), /economics_active_v6/, "the founder must see what this replaces");
  assert.match(text("f3-review-current"), /2026-01-01T00:00:00\.000Z/);
});

test("F3 review: with nothing in force the panel says so rather than leaving a blank", async () => {
  await openApproved();
  assert.match(text("f3-review-current"), /none/);
});

test("F3 review: the consequences are stated, including what activation does NOT do", async () => {
  await openApproved();
  const notice = text("f3-notice");
  assert.match(notice, /effective/i, "it states the terms take effect");
  assert.match(notice, /supersede/i, "it warns this may supersede what is in force");
  assert.match(notice, /not[\s\S]{0,20}activate the campaign/i, "it states this is not campaign activation");
  assert.match(notice, /payouts remain held/i, "it states payouts remain held");
});

// ── 2b · the punctuation actually reaches the page ────────────────────────────────────────────
//
// In JSX TEXT content a backslash-u sequence is NOT an escape — it renders as six literal
// characters. The same sequence inside a JS string literal is a real escape and renders correctly,
// so the two look identical in source review and differ only on screen. Regex assertions elsewhere
// in this file match on words and never touched the punctuation, which is how seven of these
// reached a frozen commit. These tests read the rendered DOM.

test("F3 rendering: no literal escape sequence survives anywhere in the panel", async () => {
  await openApproved();
  const rendered = $("f3-panel").textContent;
  assert.ok(!/\\u[0-9a-fA-F]{4}/.test(rendered),
    `the panel renders a literal escape sequence: ${(rendered.match(/\\u[0-9a-fA-F]{4}/g) || []).join(", ")}`);
  assert.ok(!rendered.includes("\\"), "no stray backslash may reach the page");
});

test("F3 rendering: no literal escape sequence survives in the confirmation or the result", async () => {
  await openApproved();
  await readyToConfirm();
  assert.ok(!/\\u[0-9a-fA-F]{4}/.test($("f3-confirm").textContent), "the confirmation is clean");
  await click($("f3-confirm-go"));
  assert.ok(!/\\u[0-9a-fA-F]{4}/.test($("f3-activated").textContent), "the result is clean");
  assert.ok(!/\\u[0-9a-fA-F]{4}/.test(document.body.textContent), "and so is the page as a whole");
});

test("F3 rendering: the heading shows a real em dash", async () => {
  await openApproved();
  const heading = $("f3-panel").querySelector("h3").textContent;
  assert.equal(heading, "Approved economics — review and activate");
  assert.ok(heading.includes("—"), "an em dash, not the six characters that spell one");
});

test("F3 rendering: the UTC field label shows a real em dash", async () => {
  await openApproved();
  const label = $("f3-when").closest("label").textContent;
  assert.match(label, /^\s*Effective from \(UTC\) — YYYY-MM-DDTHH:MM\s*$/);
});

test("F3 rendering: the activation button shows a real ellipsis", async () => {
  await openApproved();
  assert.equal($("f3-activate").textContent.trim(), "Activate these economics…");
});

test("F3 rendering: the notice shows real apostrophes and em dashes", async () => {
  await openApproved();
  const notice = $("f3-notice").textContent;
  assert.match(notice, /campaign’s currently active/, "a typographic apostrophe");
  assert.match(notice, /cannot be edited — changing them later/, "an em dash");
});

test("F3 rendering: the result line shows a real middle dot and apostrophe", async () => {
  await openApproved();
  await readyToConfirm();
  await click($("f3-confirm-go"));
  const result = $("f3-activated").textContent;
  assert.match(result, /· status/, "a middle dot separates the version from its status");
  assert.match(result, /campaign’s own status is unchanged/, "a typographic apostrophe");
});

test("F3 rendering: the em-dash placeholder for an unusable instant is a real em dash", async () => {
  await openApproved();
  await typeWhen("not a time");
  assert.equal($("f3-utc-value").textContent, "—");
});

// ── 3 · the UTC contract ──────────────────────────────────────────────────────────────────────

test("F3 time: a valid value previews as an exact UTC instant, unshifted by the local zone", async () => {
  await openApproved();
  await typeWhen("2026-09-01T00:00");
  assert.equal(text("f3-utc-value"), "2026-09-01T00:00:00.000Z",
    "the typed value is UTC as labelled; the browser's zone must not move it");
});

for (const [bad, why] of [
  ["2026-09-01", "a date with no time"],
  ["2026-09-01T00", "an hour with no minute"],
  ["09/01/2026 00:00", "a non-ISO shape"],
  ["2026-9-1T0:0", "unpadded fields"],
  ["2026-09-01T00:00Z", "a trailing zone designator"],
  ["2026-09-01T00:00:00", "seconds the contract does not carry"],
  ["   ", "whitespace only"],
]) {
  test(`F3 time: ${why} is refused, not guessed at`, async () => {
    await openApproved();
    await typeWhen(bad);
    assert.equal(text("f3-utc-value"), "—", "nothing may be previewed for an unusable value");
    await typeReason("Reason enough.");
    await click($("f3-activate"));
    assert.equal($("f3-confirm"), null, "an unusable instant must not reach a confirmation");
    assert.ok($("f3-error"), "and the founder is told why");
    assert.equal(activateCalls().length, 0);
  });
}

for (const impossible of ["2026-02-30T00:00", "2026-13-01T00:00", "2026-04-31T12:00", "2025-02-29T00:00", "2026-09-01T24:00", "2026-09-01T12:60"]) {
  test(`F3 time: the impossible value ${impossible} is refused rather than rolled forward`, async () => {
    await openApproved();
    await typeWhen(impossible);
    assert.equal(text("f3-utc-value"), "—", `${impossible} must not silently become a real date`);
    await typeReason("Reason enough.");
    await click($("f3-activate"));
    assert.equal(activateCalls().length, 0);
  });
}

test("F3 time: a real leap day is accepted", async () => {
  await openApproved();
  await typeWhen("2028-02-29T09:30");
  assert.equal(text("f3-utc-value"), "2028-02-29T09:30:00.000Z");
});

test("F3 time: the instant previewed is byte-identical to the instant transmitted", async () => {
  await openApproved();
  await readyToConfirm("2027-03-14T15:09");
  const previewed = text("f3-utc-value");
  assert.equal(previewed, "2027-03-14T15:09:00.000Z");
  assert.ok(text("f3-confirm-text").includes(previewed), "the confirmation restates the very instant previewed");
  await click($("f3-confirm-go"));
  assert.equal(bodyOf(activateCalls()[0]).effectiveFrom, previewed, "and that same string is what is sent");
});

test("F3 time: an instant that is ambiguous in the local zone is still sent as typed", async () => {
  // 01:30 on this date occurs twice in America/New_York. Labelled UTC, it has exactly one meaning.
  await openApproved();
  await readyToConfirm("2026-11-01T01:30");
  assert.equal(text("f3-utc-value"), "2026-11-01T01:30:00.000Z");
  await click($("f3-confirm-go"));
  assert.equal(bodyOf(activateCalls()[0]).effectiveFrom, "2026-11-01T01:30:00.000Z",
    "an ambiguous local wall-clock time must never be resolved on the founder's behalf");
});

// ── 4 · the gates before anything is sent ─────────────────────────────────────────────────────

test("F3 gate: no effective instant means no confirmation and no request", async () => {
  await openApproved();
  await typeReason("Reason enough.");
  await click($("f3-activate"));
  assert.equal($("f3-confirm"), null);
  assert.ok($("f3-error"));
  assert.equal(activateCalls().length, 0);
});

for (const blank of ["", "   ", "\n\t "]) {
  test(`F3 gate: a blank reason (${JSON.stringify(blank)}) means no confirmation and no request`, async () => {
    await openApproved();
    await typeWhen("2026-09-01T00:00");
    await typeReason(blank);
    await click($("f3-activate"));
    assert.equal($("f3-confirm"), null, "activation must always carry a stated reason");
    assert.ok($("f3-error"));
    assert.equal(activateCalls().length, 0);
  });
}

test("F3 gate: opening the confirmation sends nothing by itself", async () => {
  await openApproved();
  await readyToConfirm();
  assert.ok($("f3-confirm"), "the confirmation is offered");
  assert.equal(activateCalls().length, 0, "and it is only an offer");
});

test("F3 gate: Cancel sends nothing and leaves the version approved", async () => {
  await openApproved();
  await readyToConfirm();
  await click($("f3-cancel"));
  assert.equal($("f3-confirm"), null);
  assert.equal(activateCalls().length, 0);
  assert.match(text("f3-review-status"), /approved/, "the version is untouched");
});

test("F3 gate: Escape dismisses the confirmation without sending", async () => {
  await openApproved();
  await readyToConfirm();
  await pressEscape();
  assert.equal($("f3-confirm"), null);
  assert.equal(activateCalls().length, 0);
});

test("F3 gate: the confirmation names the version and the instant it will take force", async () => {
  await openApproved(baseRoutes({ "/economics/history": { status: 200, data: [APPROVED, IN_FORCE] } }));
  await readyToConfirm("2026-09-01T00:00");
  const t = text("f3-confirm-text");
  assert.match(t, /economics_approved_v7/, "the founder confirms a named version");
  assert.match(t, /2026-09-01T00:00:00\.000Z/, "and a named instant");
  assert.match(t, /supersede/i);
  assert.match(t, /payouts remain held/i);
});

// ── 5 · the request that is actually sent ─────────────────────────────────────────────────────

test("F3 request: exactly one POST, to the approved version's activate path", async () => {
  await openApproved();
  await readyToConfirm();
  await click($("f3-confirm-go"));
  const posts = activateCalls();
  assert.equal(posts.length, 1, "confirming activates once");
  assert.match(posts[0].url, /\/api\/fundraiser\/admin\/organizations\/org_ce665b98\/economics\/economics_approved_v7\/activate$/);
});

test("F3 request: the body carries EXACTLY effectiveFrom and activationReason", async () => {
  await openApproved();
  await readyToConfirm("2026-09-01T00:00", "Signed term sheet; counsel cleared.");
  await click($("f3-confirm-go"));
  const body = bodyOf(activateCalls()[0]);
  assert.deepEqual(Object.keys(body).sort(), ["activationReason", "effectiveFrom"],
    "no rules, no treatments, no status, no economics the client assembled");
  assert.equal(body.effectiveFrom, "2026-09-01T00:00:00.000Z");
  assert.equal(body.activationReason, "Signed term sheet; counsel cleared.");
});

test("F3 request: the reason is trimmed but never otherwise rewritten", async () => {
  await openApproved();
  await readyToConfirm("2026-09-01T00:00", "   Board minute 12(b) — 60/40 split.   ");
  await click($("f3-confirm-go"));
  assert.equal(bodyOf(activateCalls()[0]).activationReason, "Board minute 12(b) — 60/40 split.");
});

test("F3 request: no campaign-status or payout call accompanies activation", async () => {
  await openApproved();
  await readyToConfirm();
  await click($("f3-confirm-go"));
  const forbidden = calls.filter((c) => c.method !== "GET" && !c.url.includes("/activate"));
  assert.deepEqual(forbidden, [], "activation must move economics and nothing else");
  assert.equal(calls.filter((c) => c.method !== "GET" && c.url.includes("/payout")).length, 0);
});

test("F3 request: nothing is written to storage and the auth token is unchanged", async () => {
  await openApproved();
  await readyToConfirm();
  await click($("f3-confirm-go"));
  assert.deepEqual(storageWrites, [], "activation is a server fact, not a local one");
  assert.equal(window.localStorage.getItem("token"), "tkn_founder_fixture");
});

test("F3 request: a double click on Confirm sends only once", async () => {
  await openApproved(baseRoutes({ "/activate": "pending" }));
  await readyToConfirm();
  const go = $("f3-confirm-go");
  await click(go);
  await click(go);
  assert.equal(activateCalls().length, 1, "an in-flight activation must not be re-sent");
});

// ── 6 · the version is revalidated at send time ───────────────────────────────────────────────

test("F3 revalidation: a version that stops being approved is no longer sendable", async () => {
  // The panel was drawn for an approved version; the server then reports it active. A control that
  // was legitimate when drawn is not a licence to send.
  const routes = await openApproved();
  await readyToConfirm();
  routes["/economics/history"] = { status: 200, data: [withStatus("active")] };
  await setSelect("f1-campaign", CAMPAIGNS[0].campaignId);
  assert.equal(activateCalls().length, 0, "nothing was sent while the status changed underneath");
  assert.equal($("f3-panel"), null, "and the control is withdrawn");
});

// ── 7 · the outcome is the server's, never the client's ───────────────────────────────────────

test("F3 outcome: success is reported from the SERVER response", async () => {
  await openApproved();
  await readyToConfirm("2026-09-01T00:00");
  await click($("f3-confirm-go"));
  assert.ok($("f3-activated"), "the founder is told the activation landed");
  assert.match(text("f3-activated-version"), /economics_approved_v7/);
  assert.match(text("f3-activated-status"), /active/, "the status shown is the one the server returned");
  assert.match(text("f3-activated-from"), /2026-09-01T00:00:00\.000Z/);
  assert.match(text("f3-activated"), /status is unchanged/i, "and that the campaign did not move");
  assert.match(text("f3-activated"), /payouts remain held/i);
});

test("F3 outcome: the server's effectiveFrom wins over the requested one", async () => {
  await openApproved(baseRoutes({
    "/activate": { status: 200, data: { ...ACTIVATED, effectiveFrom: "2026-09-02T08:00:00.000Z" } },
  }));
  await readyToConfirm("2026-09-01T00:00");
  await click($("f3-confirm-go"));
  assert.match(text("f3-activated-from"), /2026-09-02T08:00:00\.000Z/,
    "what is in force is whatever the server recorded, not what was asked for");
});

test("F3 outcome: history is re-read after activation so the panels reflect the server", async () => {
  await openApproved();
  await readyToConfirm();
  const before = historyReads().length;
  await click($("f3-confirm-go"));
  assert.ok(historyReads().length > before, "the client must not narrate state it did not re-read");
});

test("F3 outcome: the confirmation closes once the activation lands", async () => {
  await openApproved();
  await readyToConfirm();
  await click($("f3-confirm-go"));
  assert.equal($("f3-confirm"), null);
});

// ── 8 · failure never becomes a claimed activation ────────────────────────────────────────────

const FAILURES = [
  [{ status: 409, data: { code: "BAD_TRANSITION" } }, /no longer be activated/i],
  [{ status: 404, data: { code: "NOT_FOUND" } }, /no longer exists/i],
  [{ status: 409, data: { code: "TAMPERED" } }, /integrity/i],
  [{ status: 409, data: { code: "ETAG_MISMATCH" } }, /changed while you were reviewing/i],
  [{ status: 400, data: { code: "OVERLAP" } }, /overlaps or precedes/i],
  [{ status: 401, data: {} }, /session has expired/i],
  [{ status: 403, data: {} }, /founder account/i],
  [{ status: 423, data: {} }, /on hold/i],
  [{ status: 500, data: {} }, /go through/i],
];

for (const [route, expected] of FAILURES) {
  test(`F3 failure: ${route.status}${route.data.code ? " " + route.data.code : ""} reports plainly and claims nothing`, async () => {
    await openApproved(baseRoutes({ "/activate": route }));
    await readyToConfirm();
    await click($("f3-confirm-go"));
    assert.equal($("f3-activated"), null, "a failure must never render as an activation");
    assert.ok($("f3-message"), "the founder is told what happened");
    assert.match(text("f3-message"), expected);
    assert.match(text("f3-review-status"), /approved/, "the version is left exactly as it was");
  });
}

test("F3 failure: a machine code never reaches the page", async () => {
  for (const code of ["BAD_TRANSITION", "TAMPERED", "ETAG_MISMATCH", "OVERLAP"]) {
    await openApproved(baseRoutes({ "/activate": { status: 409, data: { code } } }));
    await readyToConfirm();
    await click($("f3-confirm-go"));
    assert.ok(!document.body.textContent.includes(code), `${code} must not be shown to a person`);
    assert.ok(!/[A-Z]{4,}_[A-Z]{4,}/.test(text("f3-message")), "the message is a sentence, not a code");
  }
});

test("F3 failure: a network error claims nothing", async () => {
  await openApproved(baseRoutes({ "/activate": new TypeError("Failed to fetch") }));
  await readyToConfirm();
  await click($("f3-confirm-go"));
  assert.equal($("f3-activated"), null);
  assert.match(text("f3-message"), /reach the server/i);
});

test("F3 failure: the control is usable again afterwards", async () => {
  await openApproved(baseRoutes({ "/activate": { status: 500, data: {} } }));
  await readyToConfirm();
  await click($("f3-confirm-go"));
  assert.ok($("f3-activate"), "a failed attempt must not strand the panel");
  assert.equal($("f3-activate").disabled, false);
});

// ── 9 · context changes start clean ───────────────────────────────────────────────────────────

test("F3 context: moving to another campaign clears the effective time and reason", async () => {
  const routes = await openApproved();
  await typeWhen("2026-09-01T00:00");
  await typeReason("Reason for the spring drive.");
  routes["/economics/history"] = { status: 200, data: [{ ...APPROVED, id: "economics_approved_fall", campaignId: CAMPAIGNS[1].campaignId }] };
  await setSelect("f1-campaign", CAMPAIGNS[1].campaignId);
  assert.equal($("f3-when").value, "", "one campaign's effective time must never carry into another");
  assert.equal($("f3-reason").value, "");
  assert.equal($("f3-confirm"), null);
});

test("F3 context: a prior activation result does not follow the founder to another campaign", async () => {
  const routes = await openApproved();
  await readyToConfirm();
  await click($("f3-confirm-go"));
  assert.ok($("f3-activated"));
  routes["/economics/history"] = { status: 200, data: [{ ...APPROVED, id: "economics_approved_fall", campaignId: CAMPAIGNS[1].campaignId }] };
  await setSelect("f1-campaign", CAMPAIGNS[1].campaignId);
  assert.equal($("f3-activated"), null, "a result belongs to the campaign it happened in");
});

test("F3 context: with the fundraiser gate off there is no activation surface at all", async () => {
  await mount(baseRoutes(), { flag: false });
  assert.equal($("f3-panel"), null);
  assert.equal(activateCalls().length, 0);
});
