// src/api/salesAdminPayout.test.mjs - manual commission payout client calls (founder decision 2026-10-07 #12).
// Run (Node 20.x): node --test src/api/salesAdminPayout.test.mjs
import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { salesAdminApi, salesAdminErrorMessage } from "./salesAdmin.js";

const calls = [];
let reply = { ok: true, status: 200, body: {} };
beforeEach(() => {
  calls.length = 0;
  globalThis.localStorage = { getItem: () => "tok", setItem() {}, removeItem() {} };
  globalThis.fetch = async (url, opts = {}) => {
    calls.push({ url, method: opts.method, body: opts.body ? JSON.parse(opts.body) : undefined });
    return { ok: reply.ok, status: reply.status, json: async () => reply.body };
  };
});
afterEach(() => { delete globalThis.fetch; delete globalThis.localStorage; });

test("approveCommission POSTs the encoded approve route with an empty body", async () => {
  reply = { ok: true, status: 200, body: { ok: true, noop: false, entry: { id: "e1", status: "approved" }, summary: {} } };
  const res = await salesAdminApi.approveCommission("sp/1", "sales:sp1:evt 1");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].url, "/api/sales/admin/salespeople/sp%2F1/ledger/sales%3Asp1%3Aevt%201/approve");
  assert.deepEqual(calls[0].body, {});
  assert.equal(res.ok, true);
});

test("recordCommissionPayment POSTs reference, paidOn and a trimmed optional note only", async () => {
  reply = { ok: true, status: 200, body: { ok: true } };
  await salesAdminApi.recordCommissionPayment("sp1", "e1", { reference: "  ACH-1 ", paidOn: "2026-10-06", note: "  wire " });
  assert.equal(calls[0].url, "/api/sales/admin/salespeople/sp1/ledger/e1/record-payment");
  assert.deepEqual(calls[0].body, { reference: "ACH-1", paidOn: "2026-10-06", note: "wire" });
  await salesAdminApi.recordCommissionPayment("sp1", "e1", { reference: "R", paidOn: "2026-10-06", note: "   " });
  assert.deepEqual(calls[1].body, { reference: "R", paidOn: "2026-10-06" }, "blank note is omitted");
});

test("payout errors read as plain sentences, never raw codes", () => {
  const m = (status, reason) => salesAdminErrorMessage({ ok: false, status, data: { reason } }, { context: "payout" });
  // REVERSED is returned for "nothing left after refunds or disputes" AND for a step the entry's status no longer
  // accepts (e.g. approving a non-pending entry), so the sentence must not claim a reversal.
  assert.equal(m(409, "REVERSED"), "This commission can’t be approved or paid in its current state. Refresh the page to see its latest status.");
  assert.equal(/reversed|refund/i.test(m(409, "REVERSED")), false);
  assert.match(m(409, "NOT_APPROVED"), /Approve this commission first/);
  assert.match(m(409, "PAYMENT_ALREADY_RECORDED"), /different payment is already recorded/);
  assert.match(m(409, "CONFLICT"), /changed while you were working/);
  assert.match(m(400, "INVALID_INPUT"), /reference/i);
  assert.match(m(404, undefined), /not found for this salesperson/);
  for (const s of [m(409, "REVERSED"), m(409, "CONFLICT"), m(400, "INVALID_INPUT")]) assert.equal(/[A-Z]{4,}_[A-Z]+/.test(s), false);
});
