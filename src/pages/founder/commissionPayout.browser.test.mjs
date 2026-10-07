// src/pages/founder/salespersonControlCenterB3.browser.test.mjs
//
// SALES: manual commission payout controls in the ledger (founder decision 2026-10-07 #12).
// The real page, bundled and mounted in jsdom with an injected client.
//
// Run (Node 20.x): node --test src/pages/founder/commissionPayout.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
// CLEAN_SCRATCH: scratch files carry this process id in their name, so concurrent suites cannot collide; all are removed on exit.
import { readdirSync as __scratchLs, rmSync as __scratchRm } from "node:fs";
process.on("exit", () => { try { for (const n of __scratchLs(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __scratchRm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const BUNDLE = join(__dirname, `.__payout.${process.pid}.bundle.mjs`);
const ENTRY = join(__dirname, `.__payout.${process.pid}.entry.jsx`);
let React, createRoot, act, Page, window;

before(async () => {
  writeFileSync(ENTRY, `export { default as Page } from "./SalespersonControlCenter.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  try { globalThis.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ } globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Page } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const FOUNDER = { userId: "u1", plan: "founder" };
const ORDINARY = { userId: "u2", plan: "unforgettable" };

const SUMMARY = {
  salespersonId: "sp1", displayName: "Rep North", status: "active", linkStatus: "active",
  originatedDirectCustomers: 4, originatedFundraiserPartners: 1,
  originalPaidConversions: 3, recurringPaidTransactions: 7, entryCount: 10,
  eligibleRevenueMinor: 123456, pendingCommissionMinor: 2500,
  approvedCommissionMinor: 1000, paidCommissionMinor: 750, reversedCommissionMinor: -250,
};
const HEALTH = { referralsValidated: 12, conversions: 3, lostBeforeConversion: 9 };
const ENTRIES = [
  { id: "led_1", status: "approved", salespersonCommissionMinor: 1000, currency: "USD", effectiveAt: "2026-08-01T00:00:00.000Z" },
  { id: "led_2", status: "pending", salespersonCommissionMinor: 2500, currency: "USD", effectiveAt: "2026-08-14T00:00:00.000Z" },
];
const CONTROLS = { path: "salesperson_attribution", referralPublicLive: false, attributionLive: false };

function api(over = {}) {
  const calls = [];
  const base = {
    list: async () => { calls.push(["list"]); return { ok: true, status: 200, data: { ok: true, salespeople: [{ salespersonId: "sp1", displayName: "Rep North" }] } }; },
    read: async (id) => { calls.push(["read", id]); return { ok: true, status: 200, data: { ok: true, salesperson: { salespersonId: id, displayName: "Rep North", status: "active", referralSlug: "" } } }; },
    create: async () => ({ ok: true, status: 201, data: { ok: true } }),
    setReferralSlug: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: {}, publicReferralLink: null } }),
    removeReferralSlug: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: {}, publicReferralLink: null } }),
    rotateToken: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: {}, attributionLink: "x" } }),
    setStatus: async () => ({ ok: true, status: 200, data: { ok: true, salesperson: {} } }),
    summary: async (id) => { calls.push(["summary", id]); return { ok: true, status: 200, data: { ok: true, summary: SUMMARY } }; },
    attributionHealth: async (id) => { calls.push(["attributionHealth", id]); return { ok: true, status: 200, data: { ok: true, attributionHealth: HEALTH, controls: CONTROLS } }; },
    ledger: async (id) => { calls.push(["ledger", id]); return { ok: true, status: 200, data: { ok: true, entries: ENTRIES } }; },
    pendingForUser: async (uid) => { calls.push(["pendingForUser", uid]); return { ok: true, status: 200, data: { ok: true, pending: { userId: uid, status: "pending" } } }; },
    controls: async () => { calls.push(["controls"]); return { ok: true, status: 200, data: { ok: true, controls: CONTROLS } }; },
  };
  return { ...base, ...over, calls };
}

let root;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); };
const setVal = (el, v) => {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
async function open(a, user = FOUNDER, withDetail = true) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Page, { api: a, user })); });
  await flush();
  if (withDetail && tid("fcc-row-sp1")) { await click(tid("fcc-row-sp1")); await flush(); }
}

// ══ manual payout controls ═════════════════════════════════════════════════════════════════
const PAYOUT_ENTRIES = [
  { id: "e_pending", status: "pending", salespersonCommissionMinor: 2500, currency: "usd", effectiveAt: "2026-08-14T00:00:00.000Z" },
  { id: "e_approved", status: "approved", salespersonCommissionMinor: 1000, currency: "usd", effectiveAt: "2026-08-01T00:00:00.000Z" },
  { id: "e_paid", status: "paid", salespersonCommissionMinor: 750, currency: "usd", paidOn: "2026-09-30", paymentReference: "ACH-7" },
  { id: "e_reversed", status: "pending", salespersonCommissionMinor: 500, currency: "usd" },
  { id: "e_rev_row", status: "reversed", salespersonCommissionMinor: -500, currency: "usd", reversalOf: "e_reversed" },
  { id: "e_flower", status: "pending", salespersonCommissionMinor: 300, currency: "usd", affiliatePaymentUnverified: true },
];
const ok = (data) => ({ ok: true, status: 200, data: { ok: true, ...data } });
function payoutApi(over = {}) {
  let entries = PAYOUT_ENTRIES.map((e) => ({ ...e }));
  const a = api({
    ledger: async () => ok({ entries }),
    approveCommission: async (sp, id) => {
      a.calls.push(["approve", sp, id]);
      entries = entries.map((e) => (e.id === id ? { ...e, status: "approved", approvedBy: "u1" } : e));
      return ok({ noop: false, entry: entries.find((e) => e.id === id), summary: { ...SUMMARY, pendingCommissionMinor: 0, approvedCommissionMinor: 3500 } });
    },
    recordCommissionPayment: async (sp, id, body) => {
      a.calls.push(["pay", sp, id, body]);
      entries = entries.map((e) => (e.id === id ? { ...e, status: "paid", paidOn: body.paidOn, paymentReference: body.reference } : e));
      return ok({ noop: false, entry: entries.find((e) => e.id === id), summary: { ...SUMMARY, approvedCommissionMinor: 0, paidCommissionMinor: 1750 } });
    },
    ...over,
  });
  return a;
}
const rowOf = (id) => [...document.querySelectorAll('[data-testid^="fcc-ledger-row-"]')].find((r) => r.textContent.includes(id));
const within = (row, t) => row.querySelector(`[data-testid="${t}"]`);

test("buttons: Approve on pending, Record payment on approved, a paid note on paid, nothing on reversal rows; reversed original is explained", async () => {
  await open(payoutApi());
  assert.ok(within(rowOf("e_pending"), "fcc-approve"));
  assert.equal(within(rowOf("e_pending"), "fcc-record-payment"), null);
  assert.ok(within(rowOf("e_approved"), "fcc-record-payment"));
  assert.equal(within(rowOf("e_approved"), "fcc-approve"), null);
  assert.match(within(rowOf("e_paid"), "fcc-payout-paid").textContent, /Paid by hand on 2026-09-30 · ref ACH-7/);
  assert.equal(rowOf("e_paid").querySelector("button"), null);
  assert.equal(rowOf("e_rev_row").querySelector("button"), null, "a reversal row has no payout control");
  assert.equal(rowOf("e_reversed").querySelector("button"), null, "a reversed original cannot be approved");
  assert.match(within(rowOf("e_reversed"), "fcc-payout-reversed").textContent, /cannot be approved or paid/);
  assert.match(within(rowOf("e_flower"), "fcc-affiliate-unverified").textContent, /not yet verified/);
});

test("Approve needs an in-page confirmation (no browser dialog); Cancel makes no call", async () => {
  let dialogs = 0;
  window.confirm = () => { dialogs++; return true; };
  const a = payoutApi();
  await open(a);
  await click(within(rowOf("e_pending"), "fcc-approve"));
  assert.equal(a.calls.filter((c) => c[0] === "approve").length, 0, "clicking Approve alone writes nothing");
  assert.match(within(rowOf("e_pending"), "fcc-payout-confirm").textContent, /Approving does not pay anyone/);
  await click(within(rowOf("e_pending"), "fcc-payout-cancel"));
  assert.equal(within(rowOf("e_pending"), "fcc-payout-confirm"), null);
  assert.equal(a.calls.filter((c) => c[0] === "approve").length, 0);
  assert.equal(dialogs, 0, "no window.confirm");
});

test("confirming Approve calls the server, shows the server entry and refreshes the totals", async () => {
  const a = payoutApi();
  await open(a);
  assert.match(tid("fcc-summary").textContent, /Commission approved1,000/);
  await click(within(rowOf("e_pending"), "fcc-approve"));
  await click(within(rowOf("e_pending"), "fcc-payout-go"));
  assert.deepEqual(a.calls.find((c) => c[0] === "approve"), ["approve", "sp1", "e_pending"]);
  assert.match(rowOf("e_pending").textContent, /approved/);
  assert.ok(within(rowOf("e_pending"), "fcc-record-payment"), "the next step is now offered");
  assert.match(tid("fcc-summary").textContent, /Commission pending0/);
  assert.match(tid("fcc-summary").textContent, /Commission approved3,500/, "totals come from the server response");
});

test("Record payment requires a reference, sends reference + date + note, and refreshes the totals", async () => {
  const a = payoutApi();
  await open(a);
  await click(within(rowOf("e_approved"), "fcc-record-payment"));
  assert.equal(within(rowOf("e_approved"), "fcc-payout-go").disabled, true, "no reference, no confirm");
  setVal(within(rowOf("e_approved"), "fcc-pay-reference"), "  WIRE-9 ");
  setVal(within(rowOf("e_approved"), "fcc-pay-date"), "2026-10-06");
  setVal(within(rowOf("e_approved"), "fcc-pay-note"), "paid by wire");
  await flush();
  assert.equal(within(rowOf("e_approved"), "fcc-payout-go").disabled, false);
  assert.match(within(rowOf("e_approved"), "fcc-payout-confirm").textContent, /Greet Me does not send any money/);
  await click(within(rowOf("e_approved"), "fcc-payout-go"));
  const call = a.calls.find((c) => c[0] === "pay");
  assert.deepEqual(call, ["pay", "sp1", "e_approved", { reference: "WIRE-9", paidOn: "2026-10-06", note: "paid by wire" }]);
  assert.match(within(rowOf("e_approved"), "fcc-payout-paid").textContent, /ref WIRE-9/);
  assert.match(tid("fcc-summary").textContent, /Commission paid1,750/);
});

test("a refused step shows a plain sentence in the row and changes nothing", async () => {
  const a = payoutApi({ approveCommission: async () => ({ ok: false, status: 409, data: { ok: false, reason: "REVERSED", code: "INVALID_REQUEST" } }) });
  await open(a);
  await click(within(rowOf("e_pending"), "fcc-approve"));
  await click(within(rowOf("e_pending"), "fcc-payout-go"));
  const err = within(rowOf("e_pending"), "fcc-payout-error");
  assert.ok(err);
  assert.match(err.textContent, /reversed by a refund or dispute/);
  assert.equal(/REVERSED|INVALID_REQUEST/.test(err.textContent), false, "no raw code");
  assert.match(rowOf("e_pending").textContent, /pending/);
  assert.match(tid("fcc-summary").textContent, /Commission approved1,000/);
});

test("a client without the payout methods shows no payout controls (page stays usable)", async () => {
  await open(api());
  assert.equal(document.querySelector('[data-testid="fcc-approve"]'), null);
  assert.ok(tid("fcc-ledger"));
});
