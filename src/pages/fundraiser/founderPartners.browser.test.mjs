// founderPartners.browser.test.mjs — Report 87 A7: the founder screens built from the approved rev 6 layout.
//
// RENDERED coverage: the REAL FounderFundraisingDashboard is esbuild-transformed and mounted in jsdom with the
// REAL fundraiserApi + salesAdminApi clients over a controllable global fetch. Only the flag gate is stubbed.
// Replaces the per-panel suites of the previous founder screen (F1-F4 economics/campaign panels, org lifecycle,
// partner-admin panel, org-salesperson field) whose markup rev 6 replaced.
//
// Run under the supported runtime (engines: node 20.x):
//   node --test src/pages/fundraiser/founderPartners.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readdirSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.on("exit", () => { try { for (const n of readdirSync(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) rmSync(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const BUNDLE = join(__dirname, `.__founderp1.${process.pid}.bundle.mjs`);
let React, createRoot, act, Founder, window;

before(async () => {
  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /fundraiserGate\.js$/ }, (a) => ({ path: a.path, namespace: "gate" }));
    b.onLoad({ filter: /.*/, namespace: "gate" }, () => ({ contents: "export const isFundraiserUiEnabled = () => !!globalThis.__flag;", loader: "js" }));
  } };
  const entry = join(__dirname, `.__founderp1.${process.pid}.jsx`);
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
  try { globalThis.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event; globalThis.MouseEvent = window.MouseEvent;
  globalThis.KeyboardEvent = window.KeyboardEvent; globalThis.localStorage = window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Founder } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

// ── fixtures (test data only; never rendered by the product outside this harness) ──
const ORG_ACTIVE = { organizationId: "org_a", legalName: "Hillcrest Boosters", orgType: "school", status: "approved", approvedAt: "2026-11-01T00:00:00.000Z", activatedAt: "2026-11-01T00:00:00.000Z", adminUserIds: ["u_admin"], originationSalespersonId: "sp-ann" };
const ORG_APPLIED = { organizationId: "org_p", legalName: "Lakeview Youth Soccer", orgType: "athletic", status: "applied", adminUserIds: [] };
const ORG_ENDED = { organizationId: "org_e", legalName: "Eastgate Band", orgType: "community", status: "approved", adminUserIds: ["u2"], relationship: { status: "ended", intervals: [{ endedAt: "2027-01-31T00:00:00.000Z", endedBy: "f", resumedAt: null, resumedBy: null }] } };
const CAMPAIGNS_A = [{ campaignId: "cmp_1", organizationId: "org_a", title: "Fall Drive", status: "active" }, { campaignId: "cmp_2", organizationId: "org_a", title: "Spring Drive", status: "draft" }];
const ACTIVE_V = { id: "ev_1", campaignId: "cmp_1", status: "active", effectiveFrom: "2026-11-01T00:00:00.000Z", effectiveThrough: null, rules: { kind: "year_rates", basis: "ENSR", yearRates: { year_1: 20, year_2: 15, year_3_plus: 10 } } };
const ORG_TERMS_A = { versionId: "ot_1", status: "active", kind: "year_rates", basis: "ENSR", yearRates: { year_1: 20, year_2: 15, year_3_plus: 10 }, effectiveFrom: "2026-11-01T00:00:00.000Z" };
const SALESPEOPLE = [{ salespersonId: "sp-ann", displayName: "Ann Seller", status: "active" }, { salespersonId: "sp-old", displayName: "Old Rep", status: "inactive" }];

let calls = [];
let routeFn = null;
function installFetch(fn) {
  calls = []; routeFn = fn;
  globalThis.fetch = (url, opts = {}) => {
    const u = new URL(String(url), "http://x");
    const method = opts.method || "GET";
    const body = opts.body ? JSON.parse(opts.body) : undefined;
    calls.push({ path: u.pathname, search: u.search, method, body });
    const r = routeFn(method, u.pathname, u.searchParams, body) || { status: 404, data: { code: "NOT_FOUND" } };
    return Promise.resolve({ ok: r.status >= 200 && r.status < 300, status: r.status, json: async () => r.data });
  };
}
const A = "/api/fundraiser/admin";
function baseRoutes(over = {}) {
  const orgs = over.orgs || [ORG_ACTIVE, ORG_APPLIED, ORG_ENDED];
  return (method, path, q, body) => {
    if (over.handle) { const r = over.handle(method, path, q, body); if (r) return r; }
    if (method === "GET" && path === `${A}/overview`) return { status: 200, data: { organizations: { total: orgs.length }, campaigns: { total: 2 }, participants: { total: 5 }, economics: { activeVersions: 1 }, ledger: { conversions: 7 } } };
    if (method === "GET" && path === `${A}/organizations`) return { status: 200, data: orgs };
    if (method === "GET" && path === "/api/sales/admin/salespeople") return { status: 200, data: { ok: true, salespeople: SALESPEOPLE } };
    if (method === "GET" && /\/organizations\/[^/]+\/terms$/.test(path)) {
      const id = path.split("/").at(-2);
      const t = id in (over.orgTerms || {}) ? over.orgTerms[id] : (id === "org_a" ? ORG_TERMS_A : null);
      return { status: 200, data: { terms: t, history: t ? [t] : [] } };
    }
    if (method === "GET" && /\/organizations\/org_a\/campaigns$/.test(path)) return { status: 200, data: over.campaignsA || CAMPAIGNS_A };
    if (method === "GET" && /\/organizations\/[^/]+\/campaigns$/.test(path)) return { status: 200, data: [] };
    if (method === "GET" && /\/campaigns\/cmp_1\/economics\/history$/.test(path)) return { status: 200, data: over.histA === undefined ? [ACTIVE_V] : over.histA };
    if (method === "GET" && /\/economics\/history$/.test(path)) return { status: 200, data: [] };
    if (method === "GET" && /\/totals\/participants$/.test(path)) return { status: 200, data: { participants: 4, attributionRecords: 2 } };
    if (method === "GET" && /\/totals\/ledger$/.test(path)) return { status: 200, data: { conversions: 3, renewals: 2, refunds: 1 } };
    if (method === "GET" && path === `${A}/reports/totals`) {
      if (over.totalsStatus) return { status: over.totalsStatus, data: {} };
      const g = q.get("groupBy");
      return { status: 200, data: { groupBy: g, currency: "usd", payable: false, rows: g === "campaign"
        ? [{ key: "cmp_1", label: "Fall Drive", recordedMinor: 4321, reversedMinor: 100, netMinor: 4221, entryCount: 3 }]
        : [{ key: "2026-Q4", label: "2026 Q4", recordedMinor: 4321, reversedMinor: 100, netMinor: 4221, entryCount: 3 }] } };
    }
    if (method === "GET" && /\/reconciliation\/quarterly-gross$/.test(path)) return { status: 200, data: { organizations: [{ organizationId: "org_a", quarters: { "2026-Q4": { grossCents: 92400, records: 3, subscriptionGrossCents: 80000, brandedGoodsGrossCents: 12400 } }, unsettled: { grossCents: 0, records: 0 } }] } };
    if (method === "POST") return { status: 200, data: { organizationId: "org_new", legalName: body && body.legalName, id: "v_x", status: "ok" } };
    return null;
  };
}

const settle = async () => { for (let i = 0; i < 6; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const $ = (id) => document.querySelector(`[data-testid="${id}"]`);
const text = () => document.body.textContent;
async function click(el) { assert.ok(el, "element to click exists"); await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await settle(); }
async function setValue(el, value) {
  assert.ok(el, "input exists");
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
}
const byText = (sel, t) => [...document.querySelectorAll(sel)].find((e) => e.textContent.trim() === t);
let root = null;
async function mount(fn, flag = true) {
  if (root) { await act(async () => root.unmount()); root = null; }
  installFetch(fn); globalThis.__flag = flag;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Founder)); });
  await settle();
}
const posts = () => calls.filter((c) => c.method === "POST");

// The SAMPLE example panels, review tags and banner from the preview must never ship.
function assertNoSamplePanels() {
  for (const id of ["worked-example", "clock-example", "branded-example", "multi-example", "refund-before", "two-partials", "payout-timing", "terms-layers"]) {
    assert.equal($(id), null, `sample panel ${id} must not render`);
  }
  assert.equal(document.querySelector("[data-tag]"), null, "no review change tags");
  const t = text();
  for (const s of ["SAMPLE", "Sample", "sample figures", "Works today", "Needs engineering", "Financial engineering", "In this preview", "(preview)"]) {
    assert.ok(!t.includes(s), `product text must not contain "${s}"`);
  }
}

test("gate off ⇒ dormant state and zero requests", async () => {
  await mount(baseRoutes(), false);
  assert.equal(calls.length, 0);
  assert.match(text(), /Fundraising is not currently enabled/);
});

test("overview error ⇒ truthful error state with the rev 6 heading", async () => {
  await mount((m, p) => (p === `${A}/overview` ? { status: 500, data: {} } : null));
  assert.match(text(), /Fundraising partners/);
  assert.match(text(), /Something went wrong/);
});

test("home: real counts, Ready to activate, partner share from the terms in force; no sample content", async () => {
  await mount(baseRoutes());
  assert.match(text(), /Fundraising partners/);
  assert.match(text(), /Ready to activate:\s*Lakeview Youth Soccer\./);
  const rows = [...document.querySelectorAll("tbody tr")].map((r) => r.textContent);
  assert.ok(rows.some((r) => r.includes("Hillcrest Boosters") && r.includes("Active") && r.includes("Year 1 20% · Year 2 15% · Year 3+ 10%")), rows.join(" | "));
  assert.ok(rows.some((r) => r.includes("Lakeview Youth Soccer") && r.includes("Not active yet") && r.includes("Not set")));
  assert.ok(rows.some((r) => r.includes("Eastgate Band") && r.includes("Partnership ended")));
  assert.match(text(), /NEW SUPPORTERS7|New supporters7/i);
  assertNoSamplePanels();
});

test("empty: no partners yet", async () => {
  await mount(baseRoutes({ orgs: [] }));
  assert.match(text(), /No partners yet\./);
});

test("register: active salespeople only; None sends exactly { legalName, orgType }; then the resolved admin is assigned", async () => {
  await mount(baseRoutes({ handle: (m, p) => (m === "POST" && p === `${A}/users/resolve` ? { status: 200, data: { userId: "u_new", email: "admin@hill.org", emailVerified: true, isFounder: false } } : null) }));
  await click($("register-partner"));
  const sel = $("org-salesperson");
  assert.deepEqual([...sel.options].map((o) => [o.value, o.textContent]), [["", "None"], ["sp-ann", "Ann Seller (sp-ann)"]]);
  await click($("r-next"));
  assert.match(text(), /Enter the organization’s legal name\./);
  await setValue($("r-name"), "Northside PTA");
  await click($("r-next"));
  await click($("r-next"));
  assert.match(text(), /Find the partner administrator’s account first\./);
  await setValue($("r-email"), "admin@hill.org");
  await click($("r-find"));
  assert.match($("r-found").textContent, /Found: admin@hill\.org/);
  await click($("r-next"));
  assert.ok($("step-terms"), "step 3 is the partner share");
  assertNoSamplePanels();
  await click($("r-next"));
  assert.ok($("step-terms"), "incomplete terms keep the founder on step 3");
  await fillTerms();
  await click($("r-next"));
  assert.ok($("step-review"));
  assert.match($("step-review").textContent, /Partner share\s*Year 1 20% · Year 2 15% · Year 3\+ 10%/);
  assert.match($("step-review").textContent, /Takes effect\s*2027-01-01/);
  assertNoSamplePanels();
  await click($("r-save"));
  const create = posts().find((c) => c.path === `${A}/organizations`);
  assert.deepEqual(create.body, { legalName: "Northside PTA", orgType: "school" });
  const assign = posts().find((c) => c.path === `${A}/organizations/org_new/partner-admins`);
  assert.deepEqual(assign.body, { userId: "u_new" });
  assert.match($("register-saved").textContent, /Partner saved, not active yet/);
  assert.match($("register-saved").textContent, /is set up with its administrator and terms\./);
  // ADDENDUM 1: organization terms draft → approve → activate, in that order, after create + assign.
  const order = posts().map((c) => c.path);
  const iD = order.indexOf(`${A}/organizations/org_new/terms/draft`);
  const iA = order.indexOf(`${A}/organizations/org_new/terms/v_x/approve`);
  const iX = order.indexOf(`${A}/organizations/org_new/terms/v_x/activate`);
  assert.ok(order.indexOf(`${A}/organizations/org_new/partner-admins`) < iD && iD < iA && iA < iX, order.join(" | "));
  assert.deepEqual(posts()[iD].body, { rules: { kind: "year_rates", basis: "ENSR", yearRates: { year_1: 20, year_2: 15, year_3_plus: 10 } }, treatments: { onboardingFeeTreatment: "excluded_retained", veteransContributionTreatment: "excluded", discountTreatment: "ineligible", taxTreatment: "excluded_from_base", processorFeeTreatment: "net_of_processor" } });
  assert.deepEqual(posts()[iA].body, { reason: "first terms" });
  assert.deepEqual(posts()[iX].body, { effectiveFrom: "2027-01-01T00:00:00.000Z", activationReason: "first terms" });
});

test("register: a refused terms save is reported on the saved screen; the partner itself is saved", async () => {
  await mount(baseRoutes({ handle: (m, p) => {
    if (m === "POST" && p === `${A}/users/resolve`) return { status: 200, data: { userId: "u1", email: "a@b.c", emailVerified: true, isFounder: false } };
    if (m === "POST" && p.endsWith("/terms/draft")) return { status: 400, data: { code: "INCOMPLETE" } };
    return null;
  } }));
  await click($("register-partner"));
  await setValue($("r-name"), "Southside Club");
  await click($("r-next"));
  await setValue($("r-email"), "a@b.c"); await click($("r-find")); await click($("r-next"));
  await fillTerms(); await click($("r-next"));
  await click($("r-save"));
  assert.match($("register-saved").textContent, /Southside Club is saved\./);
  assert.match($("register-terms-failed").textContent, /The partner share could not be saved\. These terms are incomplete, so they can’t be saved\. Set it from the partner’s page\./);
  assert.equal(posts().filter((c) => c.path.endsWith("/approve")).length, 0);
});

test("register: a chosen salesperson is sent; a founder account cannot be the administrator", async () => {
  let resolveBody = { userId: "u_f", email: "f@x.com", emailVerified: true, isFounder: true };
  await mount(baseRoutes({ handle: (m, p) => (m === "POST" && p === `${A}/users/resolve` ? { status: 200, data: resolveBody } : null) }));
  await click($("register-partner"));
  await setValue($("r-name"), "Westside Club");
  await setValue($("org-salesperson"), "sp-ann");
  await click($("r-next"));
  await setValue($("r-email"), "f@x.com");
  await click($("r-find"));
  assert.match(text(), /A platform founder cannot be a partner administrator\./);
  assert.equal($("r-found"), null);
  resolveBody = { userId: "u_ok", email: "ok@x.com", emailVerified: true, isFounder: false };
  await setValue($("r-email"), "ok@x.com");
  await click($("r-find"));
  await click($("r-next"));
  await fillTerms(); await click($("r-next"));
  await click($("r-save"));
  assert.deepEqual(posts().find((c) => c.path === `${A}/organizations`).body, { legalName: "Westside Club", orgType: "school", salespersonId: "sp-ann" });
});

test("register: a refused create is reported and nothing else is sent", async () => {
  await mount(baseRoutes({ handle: (m, p) => {
    if (m === "POST" && p === `${A}/users/resolve`) return { status: 200, data: { userId: "u1", email: "a@b.c", emailVerified: true, isFounder: false } };
    if (m === "POST" && p === `${A}/organizations`) return { status: 409, data: { code: "DUPLICATE_ORGANIZATION" } };
    return null;
  } }));
  await click($("register-partner"));
  await setValue($("r-name"), "Hillcrest Boosters");
  await click($("r-next"));
  await setValue($("r-email"), "a@b.c"); await click($("r-find")); await click($("r-next"));
  await fillTerms(); await click($("r-next"));
  await click($("r-save"));
  assert.match($("register-error").textContent, /The partner was not saved\. A partner with this legal name already exists\./);
  assert.equal(posts().filter((c) => c.path.endsWith("/partner-admins")).length, 0);
});

test("not active yet: checklist; Activate is disabled without an administrator", async () => {
  await mount(baseRoutes());
  await click($("open-org_p"));
  assert.match($("activation").textContent, /○ Partner administrator assigned/);
  assert.equal($("activate").disabled, true);
  assert.match(text(), /Finish the items above to activate\./);
  assert.match($("activation").textContent, /✓ Organization saved/);
  assert.match($("activation").textContent, /○ Partner share set/);
  assert.ok($("change-terms"), "terms can be set before activation (ADDENDUM 1)");
});

test("activate: all three checklist items done ⇒ confirmation, then POST /activate; Not yet sends nothing", async () => {
  const ready = { ...ORG_APPLIED, adminUserIds: ["u9"] };
  await mount(baseRoutes({ orgs: [ready], orgTerms: { org_p: { ...ORG_TERMS_A, versionId: "ot_p" } } }));
  await click($("open-org_p"));
  assert.match($("activation").textContent, /✓ Organization saved.*✓ Partner administrator assigned.*✓ Partner share set/);
  await click($("back-partners"));
  await click($("open-org_p"));
  await click($("activate"));
  assert.match($("activate-confirm").textContent, /Activate Lakeview Youth Soccer\?/);
  await click(byText("button", "Not yet"));
  assert.equal(posts().length, 0);
  await click($("activate"));
  await click($("activate-yes"));
  const p = posts().find((c) => c.path === `${A}/organizations/org_p/activate`);
  assert.ok(p, "activate posted");
  assert.deepEqual(p.body, {});
});

test("activate refused (NOT_APPLIED) ⇒ truthful message, no code shown", async () => {
  const ready = { ...ORG_APPLIED, adminUserIds: ["u9"] };
  await mount(baseRoutes({ orgs: [ready], orgTerms: { org_p: ORG_TERMS_A }, handle: (m, p) => (m === "POST" && p.endsWith("/activate") ? { status: 409, data: { code: "NOT_APPLIED" } } : null) }));
  await click($("open-org_p")); await click($("activate")); await click($("activate-yes"));
  assert.match($("activation-error").textContent, /no longer waiting for activation/);
  assert.ok(!text().includes("NOT_APPLIED"));
});

test("activate refused with the ADDENDUM 1 codes ⇒ plain sentences, codes never shown", async () => {
  for (const [code, re] of [["NO_PARTNER_ADMIN", /Assign a partner administrator before activating\./], ["TERMS_NOT_ACTIVE", /can’t go ahead until the partner share is in place/]]) {
    const ready = { ...ORG_APPLIED, adminUserIds: ["u9"] };
    await mount(baseRoutes({ orgs: [ready], orgTerms: { org_p: ORG_TERMS_A }, handle: (m, p) => (m === "POST" && p.endsWith("/org_p/activate") ? { status: 409, data: { code } } : null) }));
    await click($("open-org_p")); await click($("activate")); await click($("activate-yes"));
    assert.match($("activation-error").textContent, re);
    assert.ok(!text().includes(code));
  }
});

test("close organization: existing route and confirmation; reason required", async () => {
  await mount(baseRoutes());
  await click($("open-org_a"));
  await click($("orglife-close"));
  assert.match($("close-org-confirm").textContent, /Close Hillcrest Boosters\?/);
  assert.match($("close-org-confirm").textContent, /intended as the permanent end of the relationship rather than a pause/);
  await click($("close-org-confirm-yes"));
  assert.equal(posts().length, 0, "no reason ⇒ nothing sent");
  await setValue($("close-org-confirm-reason"), "partner dissolved");
  await click($("close-org-confirm-yes"));
  assert.deepEqual(posts().find((c) => c.path === `${A}/organizations/org_a/close`).body, { reason: "partner dissolved" });
});

test("active: relationship shows the stored salesperson; End partnership sends the date as 00:00 UTC", async () => {
  await mount(baseRoutes());
  await click($("open-org_a"));
  assert.match($("active-since").textContent, /Active since 2026-11-01\./);
  assert.match($("relationship").textContent, /Salesperson\s*Ann Seller/);
  assert.match($("relationship").textContent, /1 assigned/);
  await click($("end-partnership"));
  assert.equal($("end-yes").disabled, true, "no date ⇒ disabled");
  await setValue($("end-date"), "2027-01-31");
  await click($("end-yes"));
  assert.deepEqual(posts().find((c) => c.path === `${A}/organizations/org_a/end`).body, { effectiveAt: "2027-01-31T00:00:00.000Z" });
});

test("active: Suspend needs a reason (zero requests without one) and posts it", async () => {
  await mount(baseRoutes());
  await click($("open-org_a"));
  await click($("suspend"));
  await click($("suspend-confirm-yes"));
  assert.match(text(), /Say why this organization is changing status\./);
  assert.equal(posts().length, 0);
  await setValue($("suspend-confirm-reason"), "fraud review");
  await click($("suspend-confirm-yes"));
  assert.deepEqual(posts().find((c) => c.path === `${A}/organizations/org_a/suspend`).body, { reason: "fraud review" });
});

test("ended: shows the end date and Resume posts /resume", async () => {
  await mount(baseRoutes());
  await click($("open-org_e"));
  assert.match($("ended").textContent, /Partnership ended on 2027-01-31\./);
  await click($("resume"));
  assert.deepEqual(posts().find((c) => c.path === `${A}/organizations/org_e/resume`).body, {});
});

test("partner share: terms in force shown; Change terms uses the existing org-wide change-rate with the year_rates rule", async () => {
  await mount(baseRoutes());
  await click($("open-org_a"));
  assert.match($("terms-line").textContent, /Year 1 20% · Year 2 15% · Year 3\+ 10% · takes effect 2026-11-01/);
  await click($("change-terms"));
  assertNoSamplePanels();
  assert.match(text(), /Branded Goods purchases are recorded; partner amounts for them are not calculated yet\./);
  await click($("save-terms"));
  assert.equal(posts().length, 0, "incomplete ⇒ zero requests");
  await setValue($("terms-y1"), "18"); await setValue($("terms-y2"), "12.5"); await setValue($("terms-y3"), "8");
  await setValue($("terms-from"), "2027-03-01");
  for (const [k, v] of [["onboardingFeeTreatment", "excluded_retained"], ["veteransContributionTreatment", "excluded"], ["discountTreatment", "ineligible"], ["taxTreatment", "excluded_from_base"], ["processorFeeTreatment", "net_of_processor"]]) await setValue($(`terms-${k}`), v);
  await setValue($("terms-reason"), "renewal of agreement");
  await click($("save-terms"));
  const cr = posts().find((c) => c.path === `${A}/organizations/org_a/economics/change-rate`);
  assert.ok(cr, "change-rate posted");
  assert.deepEqual(cr.body.rules, { kind: "year_rates", basis: "ENSR", yearRates: { year_1: 18, year_2: 12.5, year_3_plus: 8 } });
  assert.equal(cr.body.effectiveFrom, "2027-03-01T00:00:00.000Z");
  assert.equal(cr.body.reason, "renewal of agreement");
  assert.equal(cr.body.treatments.taxTreatment, "excluded_from_base");
});

async function fillTerms() {
  await setValue($("terms-y1"), "20"); await setValue($("terms-y2"), "15"); await setValue($("terms-y3"), "10");
  await setValue($("terms-from"), "2027-01-01");
  for (const [k, v] of [["onboardingFeeTreatment", "excluded_retained"], ["veteransContributionTreatment", "excluded"], ["discountTreatment", "ineligible"], ["taxTreatment", "excluded_from_base"], ["processorFeeTreatment", "net_of_processor"]]) await setValue($(`terms-${k}`), v);
  await setValue($("terms-reason"), "first terms");
}

test("partner share: first terms on an active partner use the organization terms routes (ADDENDUM 1)", async () => {
  await mount(baseRoutes({ histA: [], orgTerms: { org_a: null } }));
  await click($("open-org_a"));
  assert.match($("terms-line").textContent, /Not set/);
  await click($("change-terms"));
  await fillTerms();
  await click($("save-terms"));
  assert.ok(posts().some((c) => c.path === `${A}/organizations/org_a/terms/draft`));
  assert.ok(posts().some((c) => c.path === `${A}/organizations/org_a/terms/v_x/approve`));
  assert.ok(posts().some((c) => c.path === `${A}/organizations/org_a/terms/v_x/activate`));
  assert.equal(posts().filter((c) => c.path.endsWith("/economics/draft") || c.path.endsWith("/change-rate")).length, 0);
});

test("partner share: a partner not active yet sets terms through the organization terms routes", async () => {
  await mount(baseRoutes());
  await click($("open-org_p"));
  await click($("change-terms"));
  await fillTerms();
  await click($("save-terms"));
  assert.deepEqual(posts().map((c) => c.path), [`${A}/organizations/org_p/terms/draft`, `${A}/organizations/org_p/terms/v_x/approve`, `${A}/organizations/org_p/terms/v_x/activate`]);
});

test("terms of organizations created before ADDENDUM 1 still read from the open-window campaign version", async () => {
  await mount(baseRoutes({ orgTerms: { org_a: null } }));
  await click($("open-org_a"));
  assert.match($("terms-line").textContent, /Year 1 20% · Year 2 15% · Year 3\+ 10% · takes effect 2026-11-01/);
});

test("the deviation wording is gone", async () => {
  await mount(baseRoutes({ orgTerms: { org_a: null }, histA: [], campaignsA: [] }));
  await click($("open-org_a"));
  await click($("change-terms"));
  for (const t of ["once it is active and has a campaign", "once the partner is active and has a campaign", "Add a campaign first", "is in place on"]) assert.ok(!text().includes(t), t);
});

test("campaigns tab: Add a campaign posts the founder create route as a draft", async () => {
  await mount(baseRoutes());
  await click($("open-org_a"));
  await click($("tab-campaigns"));
  assert.match($("panel-campaigns").textContent, /Fall Drive/);
  await click($("founder-add-campaign"));
  await setValue($("founder-campaign-name"), "Winter Drive");
  await act(async () => { document.querySelector('[data-testid="panel-campaigns"] form').dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  await settle();
  assert.deepEqual(posts().find((c) => c.path === `${A}/campaigns`).body, { organizationId: "org_a", title: "Winter Drive" });
  assert.equal($("founder-campaign-note"), null);
});

test("campaigns tab: a create response with termsIssue is explained", async () => {
  await mount(baseRoutes({ handle: (m, p) => (m === "POST" && p === `${A}/campaigns` ? { status: 201, data: { campaignId: "cmp_9", termsIssue: { code: "NO_ORG_TERMS" } } } : null) }));
  await click($("open-org_a"));
  await click($("tab-campaigns"));
  await click($("founder-add-campaign"));
  await setValue($("founder-campaign-name"), "Winter Drive");
  await act(async () => { document.querySelector('[data-testid="panel-campaigns"] form').dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); });
  await settle();
  assert.match($("founder-campaign-note").textContent, /created without terms/);
});

test("reports: recorded amounts from the A5 totals only; quarterly split; no Branded Goods partner amount", async () => {
  await mount(baseRoutes());
  await click($("open-org_a"));
  await click($("tab-reports"));
  const camp = $("report-by-campaign").textContent;
  assert.match(camp, /Fall Drive.*\$43\.21.*\$1\.00.*\$42\.21/);
  assert.match(camp, /Spring Drive.*\$0\.00/);
  assert.match($("report-recorded").textContent, /2026 Q4.*\$43\.21/);
  assert.match($("report-branded-status").textContent, /partner amounts for them are not calculated yet/);
  assert.match($("report-quarterly").textContent, /Subscriptions.*Branded Goods.*2026 Q4.*\$800\.00.*\$124\.00/);
  assert.match($("reports-missing").textContent, /Partner share amounts for Branded Goods purchases/);
  const t = $("report-recorded").textContent + $("report-by-campaign").textContent;
  assert.ok(!/Branded Goods[^.]*\$/.test(t), "no dollar amount is attached to Branded Goods partner earnings");
  assertNoSamplePanels();
  const q = calls.filter((c) => c.path === `${A}/reports/totals`).map((c) => c.search).sort();
  assert.deepEqual(q, ["?groupBy=campaign&organizationId=org_a", "?groupBy=quarter&organizationId=org_a"]);
});

test("reports: a failed totals read is reported, never shown as $0", async () => {
  await mount(baseRoutes({ totalsStatus: 500 }));
  await click($("open-org_a"));
  await click($("tab-reports"));
  assert.equal($("report-by-campaign"), null);
  assert.ok(document.querySelectorAll('[data-testid="report-unavailable"]').length >= 2);
});

test("no pay or payout control anywhere on the founder screens", async () => {
  await mount(baseRoutes());
  const scan = () => [...document.querySelectorAll("button")].map((b) => b.textContent).filter((t) => /pay/i.test(t));
  assert.deepEqual(scan(), []);
  await click($("open-org_a"));
  assert.deepEqual(scan(), []);
  await click($("tab-reports"));
  assert.deepEqual(scan(), []);
});

test("register: a failed salespeople read leaves only None, and registering still works", async () => {
  await mount(baseRoutes({ handle: (m, p) => {
    if (m === "GET" && p === "/api/sales/admin/salespeople") return { status: 403, data: { error: "forbidden" } };
    if (m === "POST" && p === `${A}/users/resolve`) return { status: 200, data: { userId: "u1", email: "a@b.c", emailVerified: true, isFounder: false } };
    return null;
  } }));
  await click($("register-partner"));
  assert.deepEqual([...$("org-salesperson").options].map((o) => o.value), [""]);
  await setValue($("r-name"), "Eastside Youth");
  await click($("r-next"));
  await setValue($("r-email"), "a@b.c"); await click($("r-find")); await click($("r-next"));
  await fillTerms(); await click($("r-next"));
  await click($("r-save"));
  assert.deepEqual(posts().find((c) => c.path === `${A}/organizations`).body, { legalName: "Eastside Youth", orgType: "school" });
});
