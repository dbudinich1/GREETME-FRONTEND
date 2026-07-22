// src/import/importBudget.test.mjs — A2 request-budget closure.
// Proves the wizard sends ≤100 per request, stays inside the 5/hour budget, blocks >500 before any
// request, aggregates partial results, and never reports a not-imported contact as added.
// Run: node --test src/import/importBudget.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  planImportRequests, runBudgetedImport,
  IMPORT_REQUEST_MAX, IMPORT_REQUEST_BUDGET, IMPORT_MAX_COMMITTABLE,
} from "./importCore.js";

const contacts = (n) => Array.from({ length: n }, (_, i) => ({ email: `u${i}@x.co`, name: `U${i}`, birthday: "1990-05-14" }));
const okBody = (batch) => ({ imported: batch.length, failed: 0, errors: [] });
const thrown = (status, extra = {}) => () => { throw Object.assign(new Error(`err ${status}`), { status, ...extra }); };

test("constants: 100 per request, 5 per hour, 500 committable", () => {
  assert.equal(IMPORT_REQUEST_MAX, 100);
  assert.equal(IMPORT_REQUEST_BUDGET, 5);
  assert.equal(IMPORT_MAX_COMMITTABLE, 500);
});

test("planImportRequests: budget boundaries", () => {
  assert.equal(planImportRequests(0).requestCount, 0);
  assert.equal(planImportRequests(1).requestCount, 1);
  assert.equal(planImportRequests(100).requestCount, 1);
  assert.equal(planImportRequests(101).requestCount, 2);
  assert.equal(planImportRequests(500).requestCount, 5);
  const over = planImportRequests(501);
  assert.equal(over.ok, false);
  assert.equal(over.reason, "over_budget");
  assert.equal(over.max, 500);
});

test("100-contact boundary → exactly ONE request (unchanged single-request behavior)", async () => {
  let calls = 0;
  const res = await runBudgetedImport(contacts(100), (b) => { calls++; return okBody(b); });
  assert.equal(calls, 1);
  assert.equal(res.ok, true);
  assert.equal(res.data.imported, 100);
});

test("no request exceeds 100 rows (250 → 100/100/50)", async () => {
  const sizes = [];
  const res = await runBudgetedImport(contacts(250), (b) => { sizes.push(b.length); return okBody(b); });
  assert.deepEqual(sizes, [100, 100, 50]);
  assert.ok(sizes.every((s) => s <= 100));
  assert.equal(res.data.imported, 250);
});

test("five-request budget: 500 → exactly 5 requests", async () => {
  let calls = 0;
  const res = await runBudgetedImport(contacts(500), (b) => { calls++; return okBody(b); });
  assert.equal(calls, 5);
  assert.equal(res.data.imported, 500);
});

test("over-budget prevention: 501 → ZERO requests, truthful over-budget marker", async () => {
  let calls = 0;
  const res = await runBudgetedImport(contacts(501), () => { calls++; return okBody([]); });
  assert.equal(calls, 0);                 // stops BEFORE an impossible sequence
  assert.equal(res.ok, false);
  assert.equal(res.overBudget, true);
  assert.equal(res.max, 500);
  assert.equal(res.requested, 501);
  assert.equal(res.data.failed, 501);     // legacy caller sees non-zero failed → never a false success
});

test("403 (recipient/import limit) first batch, 0 imported → hardFail, original error preserved", async () => {
  const res = await runBudgetedImport(contacts(50), thrown(403, { code: "RECIPIENT_LIMIT_REACHED", message: "RECIPIENT_LIMIT_REACHED (3)" }));
  assert.equal(res.hardFail, true);
  assert.equal(res.status, 403);
  assert.equal(res.error.status, 403);
  assert.equal(res.error.code, "RECIPIENT_LIMIT_REACHED");
});

test("429 first batch, 0 imported → hardFail 429 (truthful, retryable)", async () => {
  const res = await runBudgetedImport(contacts(50), thrown(429));
  assert.equal(res.hardFail, true);
  assert.equal(res.status, 429);
});

test("other non-2xx (500) first batch → hardFail 500", async () => {
  const res = await runBudgetedImport(contacts(50), thrown(500));
  assert.equal(res.hardFail, true);
  assert.equal(res.status, 500);
});

test("network {ok:false,status:0} first batch → hardFail 0 (no false success)", async () => {
  const res = await runBudgetedImport(contacts(50), () => ({ ok: false, status: 0, networkError: true }));
  assert.equal(res.hardFail, true);
  assert.equal(res.status, 0);
});

test("partial: batch 1 imports 100, batch 2 hits 429 → aggregated PARTIAL, never false success", async () => {
  let n = 0;
  const res = await runBudgetedImport(contacts(250), (b) => { n += 1; if (n === 1) return okBody(b); throw Object.assign(new Error("rate"), { status: 429 }); });
  assert.equal(res.ok, true);
  assert.equal(res.data.imported, 100);       // only the successful batch counts
  assert.equal(res.data.failed, 150);         // the failed batch + all un-sent rows
  assert.equal(res.data.errors.length, 150);  // one synthesized per-row error each
  assert.match(res.data.errors[0].error, /Too many requests/);
  assert.ok(res.data.errors[0].contact.email); // carries email so the wizard marks the exact rows
});

test("existing-contact handling: server per-row 2xx errors are aggregated, not dropped", async () => {
  const res = await runBudgetedImport(contacts(2), () => ({ imported: 1, failed: 1, errors: [{ contact: { email: "u1@x.co" }, error: "Email already exists" }] }));
  assert.equal(res.data.imported, 1);
  assert.equal(res.data.failed, 1);
  assert.equal(res.data.errors[0].error, "Email already exists");
});

test("birthday field is carried through unchanged into each batch", async () => {
  let seen = null;
  await runBudgetedImport(contacts(3), (b) => { seen = b[0]; return okBody(b); });
  assert.equal(seen.birthday, "1990-05-14"); // no field stripping in the budget layer
});
