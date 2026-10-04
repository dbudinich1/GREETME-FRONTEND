// Command Center hubs (W51 / W50 / W46). The real components are esbuild-bundled into jsdom with injected API clients.
// Proves: the three hub entry points and every tile no hub absorbs are on Central Command; every pre-existing tile still renders
// (inside its hub, same test ids and links); every link on every page resolves to a real route (no dead clicks); gift sales are
// information only and never shown as commission; there is no payout/approve/export control; each panel is gated by its read;
// non-founders trigger no request; permanent contact delete always shows the warning first.
//
// Run (Node 20.x): node --test src/pages/founder/commandCenter/commandCenterHubs.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync, readdirSync as __ls, rmSync as __rm } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.on("exit", () => { try { for (const n of __ls(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __rm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const ENTRY = join(__dirname, `.__cch.${process.pid}.jsx`);
const BUNDLE = join(__dirname, `.__cch.${process.pid}.bundle.mjs`);
let React, createRoot, act, window, M;

before(async () => {
  writeFileSync(ENTRY, [
    `export { default as Command } from "../FounderCentralCommand.jsx";`,
    `export { GiftPlaceHub, SalesHub, FundraiserHub } from "./Hubs.jsx";`,
    `export { default as SalesPerformance } from "./SalesPerformance.jsx";`,
    `export { default as ContactsPage } from "./FounderContactsPage.jsx";`,
    `export { AssignedLinksPanel, GiftSalesPanel } from "./ProfilePanels.jsx";`,
  ].join("\n"));
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
    define: { "import.meta.env": "{}" },
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window = dom.window;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const flush = async () => { await act(async () => { for (let i = 0; i < 6; i++) await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); await flush(); };
const setValue = async (el, value) => {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  await act(async () => { Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value); el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
};
async function mount(Comp, props) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  await act(async () => { createRoot(host).render(React.createElement(Comp, props)); });
  await flush();
}

// ── fakes ─────────────────────────────────────────────────────────────────────────────────────
const ok = (data) => Promise.resolve({ ok: true, status: 200, data });
const counter = (name, fn, calls) => (...a) => { calls.push(name); return fn(...a); };
const FOUNDER = { plan: "founder" };
function cmdProps(extra = {}) {
  const calls = [];
  return {
    user: FOUNDER, calls,
    qrCashApi: { qrCashPayoutSummary: counter("qr", () => ok({ ok: true, unresolvedCount: 2, unresolvedTotalCents: 7500, oldestUnresolvedAgeMs: 3 * 86400000, flaggedCount: 0 }), calls) },
    fundraiserOverviewApi: {
      overview: counter("overview", () => ok({ organizations: { total: 3, byStatus: { approved: 2 } }, campaigns: { total: 5, byStatus: { active: 2 } }, participants: { total: 40, active: 37 }, economics: { activeVersions: 2 } }), calls),
      organizations: counter("orgs", () => ok([{ organizationId: "org_a", legalName: "Org A" }]), calls),
    },
    salesApi: { list: counter("sales", () => ok({ salespeople: [{ status: "active" }, { status: "active" }, { status: "inactive" }] }), calls) },
    catalogApi: { listProviders: counter("catalog", () => ok({ providers: [{ enabled: true }, { enabled: true }, { enabled: false }] }), calls) },
    contactsApi: { list: counter("contacts", () => ok({ contacts: [], counts: { total: 4, followUpDue: 1 }, categories: [] }), calls) },
    ...extra,
  };
}
const PEOPLE = [
  { salespersonId: "sp_a", displayName: "Alex Sample", status: "active", referrerSalespersonId: null, customers: { newInPeriod: 3, total: 11 }, fundraiserPartners: { newInPeriod: 0, total: 1 }, newSubscribers: 3, renewals: 9, revenueMinor: 14800, commission: { waitingApprovalMinor: 1000, approvedMinor: 3000, reversedMinor: -300, directMinor: 3700, overrideMinor: 680, notPaidOut: true }, rank: 1 },
  { salespersonId: "sp_b", displayName: "Bo Sample", status: "inactive", referrerSalespersonId: "sp_a", customers: { newInPeriod: 0, total: 3 }, fundraiserPartners: { newInPeriod: 0, total: 0 }, newSubscribers: 0, renewals: 2, revenueMinor: 4800, commission: { waitingApprovalMinor: 0, approvedMinor: 900, reversedMinor: 0, directMinor: 900, overrideMinor: 0, notPaidOut: true }, rank: 2 },
];
function salesApi(over = {}) {
  const calls = [];
  const api = {
    calls,
    performance: counter("performance", () => ok({ ok: true, period: { key: "30" }, currency: "usd", payouts: { enabled: false }, salespeople: PEOPLE }), calls),
    performanceOne: counter("performanceOne", (id) => ok({
      ok: true, currency: "usd",
      salesperson: { salespersonId: id, displayName: id === "sp_a" ? "Alex Sample" : "Bo Sample", status: id === "sp_a" ? "active" : "inactive", inactivePeriods: id === "sp_b" ? [{ from: "2026-08-01T00:00:00.000Z", to: null }] : [], note: "No commission accrues for this person's own sales while inactive. A referrer's override still accrues." },
      hierarchy: { referrer: id === "sp_b" ? { salespersonId: "sp_a", displayName: "Alex Sample", overrideRateBps: 500, status: "active" } : null, referees: id === "sp_a" ? [{ salespersonId: "sp_b", displayName: "Bo Sample", status: "inactive", overrideRateBps: 500 }] : [] },
      tiles: { customersNew: 3, customersTotal: 11, newSubscribers: 3, renewals: 9, revenueMinor: 14800 },
      commissionByStage: { waitingApprovalMinor: 1000, approvedMinor: 3000, reversedMinor: -300, directMinor: 3700, overrideMinor: 680, notPaidOut: true },
      overrideEarningsBySource: [{ sourceSalespersonId: "sp_b", sourceDisplayName: "Bo Sample", commissionMinor: 680, entryCount: 5 }],
      byDay: [{ date: "2026-10-01", revenueMinor: 1200, commissionMinor: 300, newSubscribers: 1, renewals: 0 }, { date: "2026-10-02", revenueMinor: 0, commissionMinor: 0, newSubscribers: 0, renewals: 0 }],
    }), calls),
    customers: counter("customers", () => ok({ ok: true, truncated: false, customers: [{ customerRef: "abc123", label: "Customer 1", type: "customer", originatedAt: "2026-06-01T00:00:00.000Z", commissionYear: 1, stillPaying: true, revenueMinor: 3600, commissionMinor: 900 }, { customerRef: "def456", label: "Customer 2", type: "fundraiser_partner", originatedAt: "2025-01-01T00:00:00.000Z", commissionYear: 2, stillPaying: false, revenueMinor: 0, commissionMinor: 0 }] }), calls),
    giftSales: counter("giftSales", (id) => ok({ ok: true, informationalOnly: true, truncated: id === "sp_b", attributedCustomersConsidered: id === "sp_b" ? 250 : 11, resolvedAccounts: id === "sp_b" ? 200 : 11, giftSales: id === "sp_a" ? { count: 9, grossGiftVolumeMinor: 40600, byType: [{ giftType: "qr_cash", count: 6, grossGiftVolumeMinor: 30000 }, { giftType: "merch", count: 3, grossGiftVolumeMinor: 10600 }] } : { count: 2, grossGiftVolumeMinor: 6500, byType: [{ giftType: "flowers", count: 2, grossGiftVolumeMinor: 6500 }] } }), calls),
    assignedLinks: counter("assignedLinks", () => ok({ ok: true, referralPublicEnabled: true, links: [
      { type: "share_link", label: "Share link", active: true, tokenVersion: 2, urlAvailable: false, destination: "Greet-Me sign-up, credited to this salesperson", note: "The link is shown once when issued or rotated; only a hash is stored, so it cannot be shown again. Rotate to issue a new one." },
      { type: "vanity_alias", label: "Vanity referral link", active: true, assigned: true, slug: "alex", url: "https://greet-me.com/alex", destination: "Same hand-off as the share link, via the short address" },
      { type: "gift_claim_attribution", label: "QR Cash gift link", active: true, linked: true, destination: "A recipient who claims a QR Cash gift sent by this salesperson's linked account is credited to them" }] }), calls),
    ...over,
  };
  return api;
}
const links = () => [...document.querySelectorAll('a[href^="#/"]')].map((a) => a.getAttribute("href"));

// ── route table: parsed from App.jsx so a link to a route that does not exist is a failing test ─────────
const APP = readFileSync(join(__dirname, "..", "..", "..", "App.jsx"), "utf8");
const DASH = [...APP.matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]);
function resolves(hash) {
  const p = hash.replace(/^#/, "").split("?")[0];
  if (!p.startsWith("/dashboard/")) return false;
  const rest = p.slice("/dashboard/".length);
  return DASH.some((r) => new RegExp(`^${r.replace(/:[^/]+/g, "[^/]+")}$`).test(rest));
}

// ── tests ─────────────────────────────────────────────────────────────────────────────────────
test("Central Command home: three hub entry points + every tile no hub absorbs + Contacts; absorbed tiles not duplicated", async () => {
  await mount(M.Command, cmdProps());
  assert.equal(tid("fcc-hub-gift-open").getAttribute("href"), "#/dashboard/founder/gift-place");
  assert.equal(tid("fcc-hub-sales-open").getAttribute("href"), "#/dashboard/founder/sales");
  assert.equal(tid("fcc-hub-fund-open").getAttribute("href"), "#/dashboard/founder/fundraising");
  assert.ok(tid("fcc-card-qrcash"), "Operational Alerts stays top-level");
  assert.equal(tid("fcc-qrcash-count").textContent, "2");
  assert.ok(tid("fcc-qrcash-review").getAttribute("href").includes("qr-cash-payouts"));
  assert.ok(tid("fcc-card-contacts"));
  assert.equal(tid("fcc-contacts-total").textContent, "4");
  assert.equal(tid("fcc-contacts-open").getAttribute("href"), "#/dashboard/founder/contacts");
  assert.match(tid("fcc-hub-fund-payouts").textContent, /Payouts are OFF/);
  for (const absorbed of ["catalog", "sales", "fundraising", "campaigns", "participants", "partner", "activation"]) assert.equal(tid(`fcc-card-${absorbed}`), null, `${absorbed} lives in its hub, not on home`);
});

test("every pre-existing Central Command tile still renders: top-level or inside its hub, same ids and links", async () => {
  const expectIn = { gift: ["catalog"], sales: ["sales"], fundraiser: ["fundraising", "campaigns", "participants", "partner", "activation"], home: ["qrcash"] };
  for (const [view, ids] of Object.entries(expectIn)) {
    await mount(M.Command, cmdProps({ view }));
    for (const id of ids) assert.ok(tid(`fcc-card-${id}`), `${id} tile present in ${view}`);
  }
  await mount(M.Command, cmdProps({ view: "all" }));
  assert.equal(document.querySelectorAll('[data-testid^="fcc-card-"]').length, 8, "view=all still shows the pre-hub layout");
  for (const c of ["qrcash", "catalog", "sales", "fundraising", "campaigns", "participants", "partner", "activation"]) assert.ok(tid(`fcc-card-${c}`), `${c} exists`);
  assert.match(tid("fcc-fundraising-payouts").textContent, /Payouts are OFF/);
  assert.match(tid("fcc-activation-payouts").textContent, /Payouts are OFF/);
  assert.equal(tid("fcc-sales-open").getAttribute("href"), "#/dashboard/founder/salespeople");
  assert.equal(tid("fcc-catalog-open").getAttribute("href"), "#/dashboard/gifts");
  assert.equal(tid("fcc-fundraising-open").getAttribute("href"), "#/dashboard/fundraiser/admin");
});

test("no dead clicks: every link on home, all hubs, performance and contacts resolves to a real route and each page has a way back", async () => {
  const pages = [
    ["home", M.Command, cmdProps()], ["gift", M.GiftPlaceHub, { commandProps: cmdProps() }],
    ["sales", M.SalesHub, { commandProps: cmdProps(), api: salesApi() }], ["fundraiser", M.FundraiserHub, { commandProps: cmdProps() }],
    ["performance", M.SalesPerformance, { user: FOUNDER, api: salesApi() }],
    ["contacts", M.ContactsPage, { user: FOUNDER, api: { list: () => ok({ contacts: [], counts: { total: 0, followUpDue: 0 }, categories: [] }) } }],
  ];
  let total = 0;
  for (const [name, Comp, props] of pages) {
    await mount(Comp, props);
    const hs = links();
    assert.ok(hs.length > 0, `${name} has links`);
    for (const h of hs) { total++; assert.ok(resolves(h), `${name}: ${h} resolves to a registered route`); }
    if (name !== "home") assert.ok(tid("cc-back-command"), `${name} has a link back to Central Command`);
  }
  assert.ok(total >= 25, `checked ${total} links`);
  for (const r of ["founder/command", "founder/salespeople", "founder/qr-cash-payouts", "fundraiser/admin", "gifts", "founder/gift-place", "founder/sales", "founder/sales/performance", "founder/fundraising", "founder/contacts"]) assert.ok(DASH.includes(r), `route ${r} registered (old routes kept, new ones added)`);
});

test("hub pages list their existing destinations and the Sales hub shows the gift-sales total as information only", async () => {
  await mount(M.GiftPlaceHub, { commandProps: cmdProps() });
  assert.ok(tid("fcc-card-catalog")); assert.ok(tid("cc-link-manage")); assert.ok(tid("cc-link-smart"));
  await mount(M.SalesHub, { commandProps: cmdProps(), api: salesApi() });
  assert.ok(tid("fcc-card-sales")); assert.ok(tid("cc-card-performance"));
  assert.match(tid("cc-gift-sales-30").textContent, /11 orders \(\$471\.00\)/);
  assert.match(tid("cc-card-gift-sales").textContent, /Gift & store sales/);
  assert.match(tid("cc-card-gift-sales").textContent, /including merch and marketplace/);
  assert.match(tid("cc-card-gift-sales").textContent, /no commission is calculated/);
  assert.ok(tid("cc-link-people") && tid("cc-link-performance"));
  await mount(M.FundraiserHub, { commandProps: cmdProps() });
  for (const c of ["fundraising", "campaigns", "participants", "partner", "activation"]) assert.ok(tid(`fcc-card-${c}`));
  assert.ok(tid("cc-link-admin") && tid("cc-link-partner"));
  assert.match(tid("fcc-fundraising-payouts").textContent, /Payouts are OFF/);
});

test("Sales hub: gift tile is gated by its reads (no gift read, or a failing one, shows no tile and nothing breaks)", async () => {
  const noGift = salesApi(); delete noGift.giftSales;
  await mount(M.SalesHub, { commandProps: cmdProps(), api: noGift });
  assert.equal(tid("cc-card-gift-sales"), null); assert.ok(tid("cc-card-performance"));
  const failing = salesApi({ giftSales: () => Promise.resolve({ ok: false, status: 500, data: null }) });
  await mount(M.SalesHub, { commandProps: cmdProps(), api: failing });
  assert.equal(tid("cc-card-gift-sales"), null);
});

test("performance list: sort, filters, rank, gift sales column; detail has tiles, charts, stages, override, customers, gift tile", async () => {
  await mount(M.SalesPerformance, { user: FOUNDER, api: salesApi() });
  assert.equal(document.querySelectorAll('[data-testid^="cc-row-"]').length, 2);
  assert.equal(tid("cc-rank-sp_a").textContent, "1");
  assert.match(tid("cc-gifts-sp_a").textContent, /9\s*\(\$406\.00\)/);
  assert.match(tid("cc-payouts-note").textContent, /Payouts are off/);
  await setValue(tid("cc-filter-status"), "inactive"); await flush();
  assert.equal(document.querySelectorAll('[data-testid^="cc-row-"]').length, 1);
  await setValue(tid("cc-filter-status"), "all"); await flush();
  await click(tid("cc-sort-name")); assert.equal(tid("cc-rank-sp_a"), null, "no rank when sorted by name");
  await click(tid("cc-open-sp_a"));
  assert.equal(tid("cc-detail-name").textContent, "Alex Sample");
  assert.equal(tid("tile-customers-value").textContent, "3");
  assert.match(tid("tile-gifts-value").textContent, /9 \(\$406\.00\)/);
  assert.match(tid("tile-gifts").textContent, /Gift & store sales/);
  assert.match(tid("tile-gifts").textContent, /no commission/);
  assert.match(tid("cc-gift-type-qr_cash").textContent, /QR Cash.*6 \(\$300\.00\)/);
  assert.match(tid("cc-gift-type-merch").textContent, /Merch.*3 \(\$106\.00\)/);
  assert.equal(tid("cc-gifts-truncated"), null, "complete figure: no truncation note");
  assert.ok(tid("chart-revenueMinor") && tid("chart-commissionMinor"));
  assert.match(tid("cc-stage-waitingApprovalMinor").textContent, /Waiting for approval.*\$10\.00/);
  assert.match(tid("cc-stage-approvedMinor").textContent, /Approved \(not paid out\)/);
  assert.match(tid("cc-stage-reversedMinor").textContent, /Reversed \(refund\).*-\$3\.00/);
  assert.match(tid("cc-override-sp_b").textContent, /Bo Sample/);
  assert.equal(document.querySelectorAll('[data-testid^="cc-customer-"]').length, 2);
  assert.match(document.body.textContent, /Year 2/);
  await click(tid("cc-back-list")); assert.ok(tid("cc-perf-table"));
});

test("gift sales are NEVER shown as commission; no payout / approve / export control; no Paid label", async () => {
  await mount(M.SalesPerformance, { user: FOUNDER, api: salesApi() });
  await click(tid("cc-open-sp_a"));
  const text = document.body.textContent;
  assert.doesNotMatch(text, /gift commission|commission on gift|gift earnings|store commission/i);
  assert.match(text, /carry no commission|no commission/);
  for (const b of document.querySelectorAll("button")) assert.doesNotMatch(b.textContent, /approve|\bpay\b|export|download|mark paid/i);
  assert.doesNotMatch(text, /\bPaid\b(?! out)/);
  assert.doesNotMatch(text, /year_|subscription_|entryKind|pending/);
  // Gift sales are a separate figure from commission: the commission tile equals direct + override, with no gift term in it.
  assert.match(tid("tile-commission-value").textContent, /\$43\.80/);
});

test("performance panels are gated: a missing or failing read removes only that panel", async () => {
  const api = salesApi({ customers: () => Promise.resolve({ ok: false, status: 500, data: null }) }); delete api.giftSales;
  await mount(M.SalesPerformance, { user: FOUNDER, api });
  assert.match(tid("cc-gifts-sp_a").textContent, /—/, "no gift read: dash, not a made-up number");
  await click(tid("cc-open-sp_a"));
  assert.ok(tid("tile-revenue"), "the rest of the detail still renders");
  assert.equal(tid("tile-gifts"), null);
  assert.ok(tid("cc-customers-error"));
  assert.ok(tid("cc-gift-unavailable"));
  await mount(M.SalesPerformance, { user: FOUNDER, api: { performance: () => Promise.resolve({ ok: false, status: 500, data: null }) } });
  assert.ok(tid("cc-error")); assert.match(tid("cc-error").textContent, /Nothing was changed/);
  await mount(M.SalesPerformance, { user: FOUNDER, api: { performance: () => ok({ ok: true, salespeople: [] }) } });
  assert.ok(tid("cc-empty"));
});

test("salesperson profile: assigned links (vanity link + copy + state + destination + QR, private link as a state only) and gift sales", async () => {
  const written = [];
  Object.defineProperty(window.navigator, "clipboard", { value: { writeText: (t) => { written.push(t); return Promise.resolve(); } }, configurable: true });
  const api = salesApi();
  await mount(M.AssignedLinksPanel, { api, salespersonId: "sp_a" });
  assert.equal(tid("cc-link-vanity-url").textContent, "https://greet-me.com/alex");
  assert.equal(tid("cc-link-vanity-state").textContent, "Active");
  assert.match(tid("cc-link-vanity").textContent, /Opens: Same hand-off/);
  assert.equal(tid("cc-link-qr"), null, "no separate salesperson QR exists, so none is drawn");
  assert.equal(document.querySelector("img"), null);
  assert.match(tid("cc-link-share").textContent, /version 2/);
  assert.match(tid("cc-link-share").textContent, /cannot be shown again/);
  assert.doesNotMatch(tid("cc-link-share").textContent, /https?:\/\//, "the private link is never displayed");
  assert.match(tid("cc-link-share-rotate").textContent, /Rotate/);
  assert.equal(tid("cc-link-claim-state").textContent, "Active");
  await click(tid("cc-link-vanity-copy"));
  assert.deepEqual(written, ["https://greet-me.com/alex"]);
  await mount(M.GiftSalesPanel, { api, salespersonId: "sp_a" });
  assert.match(tid("cc-profile-gifts-30").textContent, /9 orders \(\$406\.00\)/);
  assert.match(tid("cc-profile-gifts").textContent, /Gift & store sales/);
  assert.match(tid("cc-profile-gifts").textContent, /no commission is calculated/);
  assert.match(tid("cc-gift-type-merch").textContent, /Merch/);
  assert.equal(tid("cc-profile-gifts-truncated"), null);
  await mount(M.GiftSalesPanel, { api, salespersonId: "sp_b" });
  assert.match(tid("cc-profile-gifts-truncated").textContent, /may be incomplete \(200 of 250 customer accounts counted\)/);
  // paused + gated
  const paused = salesApi({ assignedLinks: () => ok({ ok: true, referralPublicEnabled: false, links: [{ type: "vanity_alias", active: false, assigned: true, slug: "bo", url: "https://greet-me.com/bo", destination: "x" }] }) });
  await mount(M.AssignedLinksPanel, { api: paused, salespersonId: "sp_b" });
  assert.equal(tid("cc-link-vanity-state").textContent, "Paused");
  assert.ok(tid("cc-links-platform-off"));
  await mount(M.AssignedLinksPanel, { api: {}, salespersonId: "sp_a" });
  assert.equal(document.body.textContent.trim(), "", "no read => nothing rendered");
  await mount(M.AssignedLinksPanel, { api: { assignedLinks: () => Promise.resolve({ ok: false, status: 500, data: null }) }, salespersonId: "sp_a" });
  assert.ok(tid("cc-links-error"));
});

test("non-founder: every new page shows the denied state and issues no request", async () => {
  const api = salesApi();
  await mount(M.SalesPerformance, { user: { plan: "free" }, api });
  assert.ok(tid("cc-denied")); assert.equal(api.calls.length, 0);
  const cp = cmdProps({ user: { plan: "free" } });
  await mount(M.Command, cp);
  assert.ok(tid("founder-command-denied")); assert.equal(cp.calls.length, 0);
  const calls = [];
  const capi = { list: () => { calls.push("list"); return ok({}); } };
  await mount(M.ContactsPage, { user: { plan: "free" }, api: capi });
  assert.ok(tid("contacts-denied")); assert.equal(calls.length, 0);
});

test("contacts: list, add (arrays), follow-up filter, and PERMANENT delete always warns first", async () => {
  const store = [{ id: "c1", name: "Avery Sample", organization: "Northlake (fictional)", category: "Partner", emails: [{ label: "Work", value: "avery@example.com" }], phones: [], links: [{ label: "Site", url: "https://example.com/n" }, { label: "Bad", url: "javascript:alert(1)" }], notes: "", tags: [], nextFollowUpAt: "2026-10-01" }];
  const calls = [];
  const api = {
    list: (p) => { calls.push(["list", p]); return ok({ contacts: store.slice(), counts: { total: store.length, followUpDue: 1 }, categories: ["Partner"] }); },
    create: (b) => { calls.push(["create", b]); store.push({ id: "c2", ...b }); return Promise.resolve({ ok: true, status: 201, data: { ok: true } }); },
    update: (id, b) => { calls.push(["update", id, b]); return ok({}); },
    remove: (id) => { calls.push(["remove", id]); store.splice(0, store.length); return ok({ ok: true, deleted: true }); },
  };
  await mount(M.ContactsPage, { user: FOUNDER, api });
  assert.ok(tid("contact-c1"));
  assert.ok(tid("link-c1-0")); assert.equal(tid("link-c1-1"), null, "a javascript: link is never rendered as a link");
  assert.equal(tid("link-c1-0").getAttribute("rel"), "noopener noreferrer");
  await click(tid("add-contact"));
  await click(tid("f-save")); assert.ok(tid("err-name"));
  await setValue(tid("f-name"), "Gale Whitfield");
  await click(tid("add-email")); await setValue(tid("f-email-0"), "not-an-email"); await click(tid("f-save")); assert.ok(tid("err-email-0"));
  await setValue(tid("f-email-0"), "gale@example.com");
  await click(tid("add-link")); await setValue(tid("f-link-0"), "javascript:1"); await click(tid("f-save")); assert.ok(tid("err-link-0"));
  await setValue(tid("f-link-0"), "example.com/gale");
  await click(tid("f-save"));
  const created = calls.find((c) => c[0] === "create");
  assert.ok(created); assert.equal(created[1].name, "Gale Whitfield");
  assert.deepEqual(created[1].emails, [{ label: "", value: "gale@example.com" }]);
  assert.equal(created[1].links[0].url, "https://example.com/gale");
  assert.equal(tid("notice").textContent, "Contact added.");
  await click(tid("delete-c1"));
  assert.equal(tid("delete-warning").textContent, "Continuing will delete this contact permanently. Are you sure you want to delete this contact?");
  assert.equal(calls.filter((c) => c[0] === "remove").length, 0, "nothing deleted by opening the warning");
  await click(tid("delete-cancel")); assert.equal(calls.filter((c) => c[0] === "remove").length, 0);
  await click(tid("delete-c1")); await click(tid("delete-confirm-go"));
  assert.deepEqual(calls.filter((c) => c[0] === "remove"), [["remove", "c1"]]);
  assert.equal(tid("notice").textContent, "Contact deleted.");
  await click(tid("filter-due")); assert.ok(calls.some((c) => c[0] === "list" && c[1] && c[1].followUpDue === true));
});

test("contact book 403 (restricted by ops setting): plain 'not available', no link; page shows the same plain message", async () => {
  await mount(M.Command, cmdProps({ contactsApi: { list: () => Promise.resolve({ ok: false, status: 403, data: { ok: false } }) } }));
  assert.match(tid("fcc-contacts-unavailable").textContent, /not available on this account/);
  assert.equal(tid("fcc-contacts-open"), null);
  await mount(M.ContactsPage, { user: FOUNDER, api: { list: () => Promise.resolve({ ok: false, status: 403, data: null }) } });
  assert.match(tid("error").textContent, /not available on this account/);
});

test("performance detail: truncated gift figure shows a plain note", async () => {
  await mount(M.SalesPerformance, { user: FOUNDER, api: salesApi() });
  await click(tid("cc-open-sp_b"));
  assert.match(tid("cc-gifts-truncated").textContent, /200 of 250/);
});

test("Central Command home keeps working when the contacts read is missing or fails (tile and link stay, no number)", async () => {
  await mount(M.Command, cmdProps({ contactsApi: {} }));
  assert.ok(tid("fcc-card-contacts")); assert.equal(tid("fcc-contacts-total"), null); assert.ok(tid("fcc-contacts-open"));
  await mount(M.Command, cmdProps({ contactsApi: { list: () => Promise.resolve({ ok: false, status: 500, data: null }) } }));
  assert.ok(tid("fcc-contacts-error")); assert.ok(tid("fcc-contacts-open"));
});
