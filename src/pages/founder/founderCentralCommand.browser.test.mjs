// src/pages/founder/founderCentralCommand.browser.test.mjs — TEAM 5, 2026-09-29.
//
// The real FounderCentralCommand.jsx is esbuild-transformed and mounted into jsdom with the
// four API clients it reads INJECTED as props (the same dependency-injection shape this codebase
// already uses elsewhere, e.g. SalespersonControlCenter's `api = salesAdminApi` default) rather
// than mocked via node:test's module mocking — esbuild's `bundle: true` inlines a directly-
// imported module's real source into the bundle, so mock.module has no effect on it once
// bundled; injection is the only seam that actually works here. Proves: the founder gate blocks
// a non-founder before any request is issued; each of the four cards renders real data from its
// own client; links point at the existing canonical routes; the QR Cash card reflects
// severity/flagged state; and a failed fetch shows an honest per-card error rather than a crash
// or a silently blank card.
//
// Run (Node 20.x): node --test src/pages/founder/founderCentralCommand.browser.test.mjs

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
const ENTRY = join(__dirname, `.__fcc.${process.pid}.jsx`);
const BUNDLE = join(__dirname, `.__fcc.${process.pid}.bundle.mjs`);
let React, createRoot, Surface, act, window, dom;

before(async () => {
  writeFileSync(ENTRY, `export { default as Surface } from "./FounderCentralCommand.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
    define: { "import.meta.env": "{}" },
  });
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window = dom.window;

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Surface } = await import(pathToFileURL(BUNDLE).href));
});
after(() => {
  try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ }
});

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);

let root;
async function mount(props) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Surface, props)); });
  await flush();
}

// Fake clients matching each real client's shape exactly enough for this component to consume.
const fakeQrCash = (data) => ({ calls: 0, qrCashPayoutSummary() { this.calls++; return Promise.resolve({ ok: true, status: 200, data }); } });
const fakeFundraiser = (data) => ({ calls: 0, overview() { this.calls++; return Promise.resolve({ ok: true, status: 200, data }); } });
const fakeSales = (rows) => ({ calls: 0, list() { this.calls++; return Promise.resolve({ ok: true, status: 200, data: { salespeople: rows } }); } });
const fakeCatalog = (providers) => ({ calls: 0, listProviders() { this.calls++; return Promise.resolve({ ok: true, status: 200, data: { providers } }); } });

const DEFAULT_QR = { ok: true, unresolvedCount: 0, unresolvedTotalCents: 0, oldestUnresolvedClaimedAt: null, oldestUnresolvedAgeMs: null, flaggedCount: 0 };
const DEFAULT_FUNDRAISING = { organizations: { total: 3 }, campaigns: { total: 5 } };
const DEFAULT_SALES = [{ status: "active" }, { status: "active" }, { status: "inactive" }];
const DEFAULT_CATALOG = [{ enabled: true }, { enabled: true }, { enabled: false }];

function defaultProps(overrides = {}) {
  return {
    qrCashApi: fakeQrCash(DEFAULT_QR),
    fundraiserOverviewApi: fakeFundraiser(DEFAULT_FUNDRAISING),
    salesApi: fakeSales(DEFAULT_SALES),
    catalogApi: fakeCatalog(DEFAULT_CATALOG),
    ...overrides,
  };
}

test("a non-founder sees nothing actionable and triggers no request", async () => {
  const props = defaultProps({ user: { plan: "free" } });
  await mount(props);
  assert.ok(tid("founder-command-denied"), "denial state shown");
  assert.equal(tid("founder-central-command"), null, "the real surface never renders");
  assert.equal(props.qrCashApi.calls, 0, "no client call made for a non-founder");
  assert.equal(props.salesApi.calls, 0);
});

test("a founder sees all four cards with real data from each client", async () => {
  await mount(defaultProps({ user: { plan: "founder" } }));
  assert.ok(tid("founder-central-command"), "the surface renders for a founder");

  assert.equal(tid("fcc-qrcash-count").textContent, "0");
  assert.equal(tid("fcc-fundraising-orgs").textContent, "3");
  assert.equal(tid("fcc-fundraising-campaigns").textContent, "5");
  assert.equal(tid("fcc-sales-active").textContent, "2", "only active salespeople counted");
  assert.equal(tid("fcc-catalog-active").textContent, "2 of 3", "only enabled providers counted as active");

  // Every card links to the real, existing canonical route — never a new duplicate surface.
  assert.equal(tid("fcc-sales-open").getAttribute("href"), "#/dashboard/founder/salespeople");
  assert.equal(tid("fcc-fundraising-open").getAttribute("href"), "#/dashboard/fundraiser/admin");
  assert.equal(tid("fcc-catalog-open").getAttribute("href"), "#/dashboard/gifts");
  assert.ok(tid("fcc-qrcash-review").getAttribute("href").includes("qr-cash-payouts"));

  // Honest about the real gap: no resolve action exists, so the card says so rather than
  // pretending "Review Payouts" can close a payout out.
  assert.ok(tid("fcc-qrcash-gap-note"), "the payout-resolution gap is disclosed, not hidden");
});

test("an unresolved, flagged QR Cash payout renders with attention severity and a flagged count", async () => {
  const qr = { ok: true, unresolvedCount: 4, unresolvedTotalCents: 12500, oldestUnresolvedClaimedAt: "2026-08-01T00:00:00.000Z", oldestUnresolvedAgeMs: 30 * 24 * 3600 * 1000, flaggedCount: 2 };
  await mount(defaultProps({ user: { plan: "founder" }, qrCashApi: fakeQrCash(qr) }));
  assert.equal(tid("fcc-qrcash-count").textContent, "4");
  assert.equal(tid("fcc-qrcash-total").textContent, "$125.00");
  assert.match(tid("fcc-qrcash-age").textContent, /30 days/);
  assert.ok(tid("fcc-qrcash-flagged"), "flagged count surfaced");
  assert.match(tid("fcc-qrcash-flagged").textContent, /2 flagged/);
});

test("a failed card fetch shows an honest error, not a fabricated value or a crash", async () => {
  const failingFundraiser = { calls: 0, overview() { this.calls++; return Promise.resolve({ ok: false, status: 403, data: null }); } };
  await mount(defaultProps({ user: { plan: "founder" }, fundraiserOverviewApi: failingFundraiser }));
  assert.ok(tid("fcc-fundraising-error"), "the fundraising card reports its own failure");
  assert.equal(tid("fcc-fundraising-orgs"), null, "no fabricated number is shown in its place");
  // The other three cards, unaffected by this one's failure, still render normally.
  assert.equal(tid("fcc-sales-active").textContent, "2");
});

// == CLOSEOUT W36 (proposed): entry points to existing fundraiser surfaces ==================
const FULL_OVERVIEW = {
  organizations: { total: 3, byStatus: { approved: 2, suspended: 1 } },
  campaigns: { total: 5, byStatus: { active: 2, draft: 3 } },
  participants: { total: 40, active: 37 },
  economics: { activeVersions: 2 },
};
const fakeFundraiserFull = (data, orgs) => ({
  calls: 0, orgCalls: 0, writes: 0,
  overview() { this.calls++; return Promise.resolve({ ok: true, status: 200, data }); },
  organizations() { this.orgCalls++; return Promise.resolve({ ok: true, status: 200, data: orgs }); },
});
const ORGS = [
  { organizationId: "org_a", legalName: "Alpha School" }, { organizationId: "org_b", legalName: "Beta Club" },
];

test("W36: campaigns, participants, partner portal and activation each have a separate card", async () => {
  const fr = fakeFundraiserFull(FULL_OVERVIEW, ORGS);
  await mount(defaultProps({ user: { plan: "founder" }, fundraiserOverviewApi: fr }));
  for (const id of ["campaigns", "participants", "partner", "activation"]) assert.ok(tid(`fcc-card-${id}`), id);
  assert.equal(tid("fcc-campaigns-total").textContent, "5");
  assert.match(tid("fcc-campaigns-bystatus").textContent, /Active 2/);
  assert.equal(tid("fcc-participants-total").textContent, "40");
  assert.equal(tid("fcc-participants-active").textContent, "37");
  assert.match(tid("fcc-activation-orgs").textContent, /Approved 2 \u00b7 Suspended 1/);
  assert.match(tid("fcc-activation-campaigns").textContent, /Draft 3/);
  assert.equal(tid("fcc-activation-economics").textContent, "2");
  // Links go ONLY to routes that already exist.
  assert.equal(tid("fcc-campaigns-open").getAttribute("href"), "#/dashboard/fundraiser/admin");
  assert.equal(tid("fcc-participants-open").getAttribute("href"), "#/dashboard/fundraiser/admin");
  assert.equal(tid("fcc-activation-open").getAttribute("href"), "#/dashboard/fundraiser/admin");
  assert.equal(tid("fcc-partner-org-org_a").getAttribute("href"), "#/dashboard/fundraiser/partner/org_a");
  assert.equal(fr.orgCalls, 1, "the existing organizations read is used once");
  assert.ok(!document.body.textContent.includes("[object Object]"));
});

test("W36: it is read-only - only anchors and no buttons or forms were added", async () => {
  await mount(defaultProps({ user: { plan: "founder" }, fundraiserOverviewApi: fakeFundraiserFull(FULL_OVERVIEW, ORGS) }));
  for (const id of ["campaigns", "participants", "partner", "activation"]) {
    const card = tid(`fcc-card-${id}`);
    assert.equal(card.querySelectorAll("button, form, input, select").length, 0, `${id} has no controls`);
  }
});

test("W36: missing counts read 'unavailable', never 0; failed org read shows its own error", async () => {
  const fr = { overview: () => Promise.resolve({ ok: true, status: 200, data: { organizations: { total: 1 }, campaigns: { total: 1 } } }), organizations: () => Promise.resolve({ ok: false, status: 403, data: null }) };
  await mount(defaultProps({ user: { plan: "founder" }, fundraiserOverviewApi: fr }));
  assert.match(tid("fcc-participants-total").textContent, /unavailable/);
  assert.match(tid("fcc-activation-economics").textContent, /unavailable/);
  assert.ok(tid("fcc-partner-error"));
  assert.equal(tid("fcc-sales-active").textContent, "2", "other cards unaffected");
});

test("W36: a non-founder still triggers no organizations request", async () => {
  const fr = fakeFundraiserFull(FULL_OVERVIEW, ORGS);
  await mount(defaultProps({ user: { plan: "free" }, fundraiserOverviewApi: fr }));
  assert.equal(fr.orgCalls, 0);
  assert.equal(fr.calls, 0);
});

test("W36: more than five organizations shows five links and a pointer to the rest", async () => {
  const many = Array.from({ length: 8 }, (_, i) => ({ organizationId: `o${i}`, legalName: `Org ${i}` }));
  await mount(defaultProps({ user: { plan: "founder" }, fundraiserOverviewApi: fakeFundraiserFull(FULL_OVERVIEW, many) }));
  assert.equal(tid("fcc-partner-list").querySelectorAll("a").length, 5);
  assert.match(tid("fcc-partner-more").textContent, /3 more/);
});
test("Surface 9: the fundraising and activation cards state plainly that payouts are OFF, and keep the activation state beside it", async () => {
  const fr = fakeFundraiserFull(FULL_OVERVIEW, ORGS);
  await mount(defaultProps({ user: { plan: "founder" }, fundraiserOverviewApi: fr }));
  assert.match(tid("fcc-fundraising-payouts").textContent, /^Payouts are OFF\. Nothing is paid out/);
  assert.match(tid("fcc-activation-payouts").textContent, /^Payouts are OFF\./);
  assert.match(tid("fcc-activation-orgs").textContent, /Approved 2/, "activation state is still shown");
});
