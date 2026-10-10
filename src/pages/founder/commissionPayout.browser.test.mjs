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
  // Partial refunds (T5 R2 item C): net = original - |reversal rows| (two rows on the pending one).
  { id: "e_part_pend", status: "pending", salespersonCommissionMinor: 1000, currency: "usd" },
  { id: "x_r1", status: "reversed", salespersonCommissionMinor: -300, currency: "usd", reversalOf: "e_part_pend" },
  { id: "x_r2", status: "reversed", salespersonCommissionMinor: -100, currency: "usd", reversalOf: "e_part_pend" },
  { id: "e_part_appr", status: "approved", salespersonCommissionMinor: 800, currency: "usd", approvedNetMinor: 500 },
  { id: "x_r3", status: "reversed", salespersonCommissionMinor: -300, currency: "usd", reversalOf: "e_part_appr" },
  // Over-reversed by two partial refunds: net < 0, still nothing to pay.
  { id: "e_over", status: "approved", salespersonCommissionMinor: 200, currency: "usd" },
  { id: "x_r4", status: "reversed", salespersonCommissionMinor: -150, currency: "usd", reversalOf: "e_over" },
  { id: "x_r5", status: "reversed", salespersonCommissionMinor: -150, currency: "usd", reversalOf: "e_over" },
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
  assert.equal(within(rowOf("e_reversed"), "fcc-payout-reversed").textContent, "Fully reversed by refunds or disputes — nothing to pay.");
  assert.match(within(rowOf("e_reversed"), "fcc-payout-net").textContent, /Net after refunds or disputes: 0 usd \(minor units\)/);
  assert.match(within(rowOf("e_flower"), "fcc-affiliate-unverified").textContent, /not yet verified/);
  // No refund: unchanged - no net line, no blocking text.
  for (const id of ["e_pending", "e_approved", "e_paid", "e_flower"]) {
    assert.equal(within(rowOf(id), "fcc-payout-net"), null, `${id}: no net line without refunds`);
    assert.equal(within(rowOf(id), "fcc-payout-reversed"), null, `${id}: not blocked`);
  }
  assert.equal(within(rowOf("e_paid"), "fcc-payout-paid").textContent, "Paid by hand on 2026-09-30 · ref ACH-7");
});

test("partial refund: the net is shown next to the original and the entry can still be approved and paid", async () => {
  const a = payoutApi();
  await open(a);
  const pend = rowOf("e_part_pend");
  assert.match(pend.textContent, /1,000 usd \(minor units\)/, "the ledger still shows the original");
  assert.equal(within(pend, "fcc-payout-net").textContent,
    "Original 1,000 usd (minor units) · refunds or disputes −400 usd (minor units) · Net after refunds or disputes: 600 usd (minor units)");
  assert.equal(within(pend, "fcc-payout-reversed"), null, "a partial refund is not a block");
  assert.ok(within(pend, "fcc-approve"), "Approve is offered");
  await click(within(pend, "fcc-approve"));
  assert.match(within(rowOf("e_part_pend"), "fcc-payout-confirm").textContent, /The amount to pay is the net after refunds or disputes: 600 usd \(minor units\)\./);
  await click(within(rowOf("e_part_pend"), "fcc-payout-go"));
  assert.deepEqual(a.calls.find((c) => c[0] === "approve"), ["approve", "sp1", "e_part_pend"]);
  assert.ok(within(rowOf("e_part_pend"), "fcc-record-payment"), "after approval the payment step is offered");

  const appr = rowOf("e_part_appr");
  assert.match(within(appr, "fcc-payout-net").textContent, /Net after refunds or disputes: 500 usd \(minor units\)/);
  await click(within(appr, "fcc-record-payment"));
  assert.match(within(rowOf("e_part_appr"), "fcc-payout-confirm").textContent, /net after refunds or disputes: 500 usd/);
  setVal(within(rowOf("e_part_appr"), "fcc-pay-reference"), "ACH-NET");
  await flush();
  await click(within(rowOf("e_part_appr"), "fcc-payout-go"));
  assert.deepEqual(a.calls.find((c) => c[0] === "pay").slice(0, 3), ["pay", "sp1", "e_part_appr"]);
  assert.match(within(rowOf("e_part_appr"), "fcc-payout-paid").textContent, /ref ACH-NET/);
});

test("refunds that reach or exceed the original block with true wording and offer no button", async () => {
  await open(payoutApi());
  const over = rowOf("e_over");
  assert.equal(over.querySelector("button"), null);
  assert.equal(within(over, "fcc-payout-reversed").textContent, "Fully reversed by refunds or disputes — nothing to pay.");
  assert.match(within(over, "fcc-payout-net").textContent, /refunds or disputes −300 usd \(minor units\) · Net after refunds or disputes: 0 usd/);
});

test("a paid entry that was paid net of refunds shows the amount actually paid", async () => {
  const entries = [
    { id: "e_pn", status: "paid", salespersonCommissionMinor: 1000, currency: "usd", paidOn: "2026-10-01", paymentReference: "W-1", paidAmountMinor: 600 },
    { id: "x_pn", status: "reversed", salespersonCommissionMinor: -400, currency: "usd", reversalOf: "e_pn" },
  ];
  await open(payoutApi({ ledger: async () => ok({ entries }) }));
  assert.equal(within(rowOf("e_pn"), "fcc-payout-paid").textContent, "Paid by hand on 2026-10-01 · ref W-1 · amount 600 usd (minor units)");
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
  assert.match(err.textContent, /can’t be approved or paid in its current state\. Refresh the page to see its latest status\./);
  assert.equal(/REVERSED|INVALID_REQUEST/.test(err.textContent), false, "no raw code");
  assert.match(rowOf("e_pending").textContent, /pending/);
  assert.match(tid("fcc-summary").textContent, /Commission approved1,000/);
});

// ══ stale page (T5 R2 follow-up note 1): the ledger is re-read right before each write ══════════════
test("Approve re-reads the ledger first; an unchanged net goes straight through", async () => {
  const a = payoutApi();
  let reads = 0;
  const inner = a.ledger;
  a.ledger = async (...args) => { reads++; return inner(...args); };
  await open(a);
  const before = reads;
  await click(within(rowOf("e_part_pend"), "fcc-approve"));
  await click(within(rowOf("e_part_pend"), "fcc-payout-go"));
  assert.equal(reads, before + 1, "one fresh ledger read before the write");
  assert.deepEqual(a.calls.find((c) => c[0] === "approve"), ["approve", "sp1", "e_part_pend"]);
  assert.equal(within(rowOf("e_part_pend"), "fcc-payout-changed"), null);
});

test("a refund that landed after load: Record payment shows the new net, sends nothing, and needs a second confirm", async () => {
  let entries = PAYOUT_ENTRIES.map((e) => ({ ...e }));
  const a = payoutApi({ ledger: async () => ok({ entries }) });
  await open(a);
  await click(within(rowOf("e_part_appr"), "fcc-record-payment"));
  assert.match(within(rowOf("e_part_appr"), "fcc-payout-confirm").textContent, /net after refunds or disputes: 500 usd/);
  setVal(within(rowOf("e_part_appr"), "fcc-pay-reference"), "ACH-STALE");
  await flush();
  // A lost dispute lands on the server after the page loaded: -200 more.
  entries = [...entries, { id: "x_late", status: "reversed", salespersonCommissionMinor: -200, currency: "usd", reversalOf: "e_part_appr" }];
  await click(within(rowOf("e_part_appr"), "fcc-payout-go"));
  assert.equal(a.calls.filter((c) => c[0] === "pay").length, 0, "nothing sent while the amount differs from what was shown");
  const row = rowOf("e_part_appr");
  assert.equal(within(row, "fcc-payout-changed").textContent,
    "The amount changed since this page was loaded, so nothing was saved. The amount to pay is now 300 usd (minor units). Confirm again if that is right.");
  assert.match(within(row, "fcc-payout-confirm").textContent, /net after refunds or disputes: 300 usd \(minor units\)\./, "confirmation shows the server's current net");
  assert.equal(within(row, "fcc-pay-reference").value, "ACH-STALE", "the typed reference is kept");
  assert.ok(rowOf("x_late"), "the page now shows the new reversal row");
  // Second confirm with the same (now shown) net goes through.
  await click(within(rowOf("e_part_appr"), "fcc-payout-go"));
  assert.deepEqual(a.calls.find((c) => c[0] === "pay").slice(0, 3), ["pay", "sp1", "e_part_appr"]);
  assert.match(within(rowOf("e_part_appr"), "fcc-payout-paid").textContent, /ref ACH-STALE/);
});

test("a refund after load on an entry with no earlier reversal: Approve shows the amount, then needs a second confirm", async () => {
  let entries = PAYOUT_ENTRIES.map((e) => ({ ...e }));
  const a = payoutApi({ ledger: async () => ok({ entries }) });
  await open(a);
  await click(within(rowOf("e_pending"), "fcc-approve"));
  entries = [...entries, { id: "x_new", status: "reversed", salespersonCommissionMinor: -500, currency: "usd", reversalOf: "e_pending" }];
  await click(within(rowOf("e_pending"), "fcc-payout-go"));
  assert.equal(a.calls.filter((c) => c[0] === "approve").length, 0);
  assert.match(within(rowOf("e_pending"), "fcc-payout-changed").textContent, /The amount to pay is now 2,000 usd \(minor units\)/);
  assert.match(within(rowOf("e_pending"), "fcc-payout-confirm").textContent, /The amount to pay is the net after refunds or disputes: 2,000 usd/);
  await click(within(rowOf("e_pending"), "fcc-payout-go"));
  assert.equal(a.calls.filter((c) => c[0] === "approve").length, 1);
});

test("fully reversed after load: nothing is sent and the row shows the block text", async () => {
  let entries = PAYOUT_ENTRIES.map((e) => ({ ...e }));
  const a = payoutApi({ ledger: async () => ok({ entries }) });
  await open(a);
  await click(within(rowOf("e_approved"), "fcc-record-payment"));
  setVal(within(rowOf("e_approved"), "fcc-pay-reference"), "R-1");
  await flush();
  entries = [...entries, { id: "x_all", status: "reversed", salespersonCommissionMinor: -1000, currency: "usd", reversalOf: "e_approved" }];
  await click(within(rowOf("e_approved"), "fcc-payout-go"));
  assert.equal(a.calls.filter((c) => c[0] === "pay").length, 0);
  assert.equal(within(rowOf("e_approved"), "fcc-payout-reversed").textContent, "Fully reversed by refunds or disputes — nothing to pay.");
  assert.equal(rowOf("e_approved").querySelector("button"), null);
});

test("status changed after load (approved elsewhere): Approve sends nothing and says so", async () => {
  let entries = PAYOUT_ENTRIES.map((e) => ({ ...e }));
  const a = payoutApi({ ledger: async () => ok({ entries }) });
  await open(a);
  await click(within(rowOf("e_pending"), "fcc-approve"));
  entries = entries.map((e) => (e.id === "e_pending" ? { ...e, status: "approved" } : e));
  await click(within(rowOf("e_pending"), "fcc-payout-go"));
  assert.equal(a.calls.filter((c) => c[0] === "approve").length, 0);
  assert.equal(within(rowOf("e_pending"), "fcc-payout-changed").textContent,
    "This commission changed since the page was loaded, so nothing was saved. Check its latest status before you continue.");
  assert.ok(within(rowOf("e_pending"), "fcc-record-payment"), "the row now shows the server's status");
});

test("the re-read fails: nothing is sent and the row says so", async () => {
  let fail = false;
  const base = payoutApi();
  const inner = base.ledger;
  base.ledger = async (...args) => (fail ? { ok: false, status: 503, data: {} } : inner(...args));
  await open(base);
  await click(within(rowOf("e_pending"), "fcc-approve"));
  fail = true;
  await click(within(rowOf("e_pending"), "fcc-payout-go"));
  assert.equal(base.calls.filter((c) => c[0] === "approve").length, 0);
  assert.equal(within(rowOf("e_pending"), "fcc-payout-error").textContent, "Couldn’t re-check the current amount, so nothing was saved. Try again.");
});

test("a client without the payout methods shows no payout controls (page stays usable)", async () => {
  await open(api());
  assert.equal(document.querySelector('[data-testid="fcc-approve"]'), null);
  assert.ok(tid("fcc-ledger"));
});

// ══ refunds on commission ALREADY PAID are deducted from the next payment (founder decision 2026-10-10) ══════════════
const DED_ENTRIES = (refundMinor) => [
  { id: "e_old", status: "paid", salespersonCommissionMinor: 1000, currency: "usd", paidOn: "2026-09-30", paymentReference: "ACH-1", paidAmountMinor: 1000, paidReflectsReversalIds: [] },
  { id: "x_old", status: "reversed", salespersonCommissionMinor: -refundMinor, currency: "usd", reversalOf: "e_old" },
  { id: "e_next", status: "approved", salespersonCommissionMinor: 1000, currency: "usd" },
];

test("deduction: recording the next payment shows the refund deducted and the amount to pay; a partial carries the rest", async () => {
  await open(payoutApi({ ledger: async () => ok({ entries: DED_ENTRIES(300) }) }));
  await click(within(rowOf("e_next"), "fcc-record-payment"));
  assert.equal(within(rowOf("e_next"), "fcc-payout-deduction").textContent,
    "Refunds on commission you already paid: −300 usd (minor units) is deducted from this payment. Amount to pay: 700 usd (minor units)");
  await open(payoutApi({ ledger: async () => ok({ entries: DED_ENTRIES(1500) }) }));
  await click(within(rowOf("e_next"), "fcc-record-payment"));
  assert.match(within(rowOf("e_next"), "fcc-payout-deduction").textContent, /−1,000 usd \(minor units\) is deducted from this payment\. Amount to pay: 0 usd \(minor units\) · still to deduct from later payments: 500 usd \(minor units\)/);
});

test("deduction: an earlier payment's recorded deduction is not shown again; no refund after payment = no deduction line", async () => {
  const entries = [...DED_ENTRIES(300).slice(0, 2),
    { id: "e_mid", status: "paid", salespersonCommissionMinor: 1000, currency: "usd", paidOn: "2026-10-01", paymentReference: "ACH-2", paidAmountMinor: 700, payoutDeductionMinor: 300, payoutDeductions: [{ reversalId: "x_old", amountMinor: 300 }] },
    { id: "e_next", status: "approved", salespersonCommissionMinor: 1000, currency: "usd" }];
  await open(payoutApi({ ledger: async () => ok({ entries }) }));
  assert.match(within(rowOf("e_mid"), "fcc-payout-paid").textContent, /amount 700 usd \(minor units\) · 300 usd \(minor units\) deducted for refunds on commission already paid/);
  await click(within(rowOf("e_next"), "fcc-record-payment"));
  assert.equal(within(rowOf("e_next"), "fcc-payout-deduction"), null, "already recovered");
  await open(payoutApi());
  await click(within(rowOf("e_approved"), "fcc-record-payment"));
  assert.equal(within(rowOf("e_approved"), "fcc-payout-deduction"), null);
});

test("deduction: a refund on paid commission that lands after load sends nothing and needs a second confirm", async () => {
  let entries = DED_ENTRIES(300).filter((e) => e.id !== "x_old");
  const a = payoutApi({ ledger: async () => ok({ entries }) });
  await open(a);
  await click(within(rowOf("e_next"), "fcc-record-payment"));
  assert.equal(within(rowOf("e_next"), "fcc-payout-deduction"), null);
  entries = DED_ENTRIES(300);
  setVal(within(rowOf("e_next"), "fcc-pay-reference"), "ACH-9");
  await flush();
  await click(within(rowOf("e_next"), "fcc-payout-go"));
  assert.equal(a.calls.filter((c) => c[0] === "pay").length, 0, "nothing sent");
  assert.match(within(rowOf("e_next"), "fcc-payout-changed").textContent, /amount to pay is now 700 usd/);
  await click(within(rowOf("e_next"), "fcc-payout-go"));
  assert.equal(a.calls.filter((c) => c[0] === "pay").length, 1, "sent after the second confirm");
});

test("summary shows the refunds still to deduct and already deducted (only when the server sends them)", async () => {
  await open(payoutApi({ summary: async () => ok({ summary: { ...SUMMARY, outstandingDeductionMinor: 500, recoveredDeductionMinor: 1000, postPaymentReversedMinor: 1500 } }) }));
  assert.match(tid("fcc-summary").textContent, /Refunds after payment, still to deduct500/);
  assert.match(tid("fcc-summary").textContent, /Refunds after payment, deducted1,000/);
  await open(payoutApi());
  assert.doesNotMatch(tid("fcc-summary").textContent, /Refunds after payment/);
});
