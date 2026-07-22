// A2 — Personal Import Wizard §4.1 request-budget behavior.
// OBSERVED request counts (fetch spy), not code inspection. Node 20.
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import api from "../api/api.js";
import {
  IMPORT_REQUEST_MAX, checkImportBudget, importBatchKey,
  autoMapHeaders, processRow, detectDuplicates, buildPlan,
} from "./importCore.js";
import {
  classifyCommitOutcome, overCapMessage, rateLimitMessage, IMPORT_RATE_LIMIT_PER_HOUR,
} from "../components/importWizard/wizardModel.js";

const origFetch = global.fetch;
let calls;
function installFetch(resFactory) {
  calls = [];
  global.fetch = async (url, opts = {}) => {
    calls.push({ url: String(url), method: opts.method || "GET", body: opts.body });
    return resFactory(url, opts);
  };
}
function importReqCount() { return calls.filter((c) => c.url.includes("/api/contacts/import")).length; }
function fakeRes(status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (k) => headers[k] ?? headers[String(k).toLowerCase()] ?? null },
    json: async () => body,
  };
}
const contacts = (n) => Array.from({ length: n }, (_, i) => ({ name: `C${i}`, email: `c${i}@example.com` }));
const results200 = (imported = 0, failed = 0, errors = []) =>
  fakeRes(200, { ok: true, data: { imported, failed, errors } });

afterEach(() => { global.fetch = origFetch; });

// ---- constant + budget coupling ----
test("IMPORT_REQUEST_MAX is 100 (mirrors backend CONTACTS_IMPORT_MAX)", () => {
  assert.equal(IMPORT_REQUEST_MAX, 100);
});
test("checkImportBudget: 100 ok · 0 ok · 101 over", () => {
  assert.equal(checkImportBudget(100).ok, true);
  assert.equal(checkImportBudget(0).ok, true);
  const over = checkImportBudget(101);
  assert.equal(over.ok, false);
  assert.equal(over.count, 101);
  assert.equal(over.max, 100);
});

// ---- OBSERVED request counts ----
test("OBSERVED: 100 contacts → EXACTLY ONE POST /api/contacts/import", async () => {
  installFetch(() => results200(100, 0, []));
  const res = await api.importContacts(contacts(100));
  assert.equal(importReqCount(), 1);
  assert.equal(calls[0].method, "POST");
  assert.equal(classifyCommitOutcome(res).status, "success");
});
test("OBSERVED: 101 contacts → ZERO requests, blocked over-cap", async () => {
  installFetch(() => results200());
  const res = await api.importContacts(contacts(101));
  assert.equal(importReqCount(), 0);
  assert.equal(res.ok, false);
  assert.equal(res.blocked, true);
  assert.equal(res.code, "IMPORT_OVER_CAP");
  assert.equal(res.count, 101);
  assert.equal(res.max, 100);
});
test("OBSERVED: 500 contacts → ZERO requests (never chunked/split)", async () => {
  installFetch(() => results200());
  const res = await api.importContacts(contacts(500));
  assert.equal(importReqCount(), 0);
  assert.equal(res.code, "IMPORT_OVER_CAP");
});
test("OBSERVED: preview / mapping / validation / duplicate classification → ZERO requests", () => {
  installFetch(() => results200());
  const { mapping } = autoMapHeaders(["name", "email", "birthday"]);
  const rows = contacts(50).map((c) => ({ name: c.name, email: c.email }));
  const processed = rows.map((r, i) => ({ ...processRow(r, mapping, { todayIso: "2026-07-22" }), index: i }));
  const deduped = detectDuplicates(processed, []);
  const plan = buildPlan(deduped, { duplicateStrategy: "skip" });
  assert.ok(plan);
  assert.equal(importReqCount(), 0);
});
test("OBSERVED: Test Drive review pipeline (local sample rows) → ZERO requests", () => {
  installFetch(() => results200());
  // Test Drive uses the same pure preview pipeline over local sample rows; it never calls importContacts.
  const { mapping } = autoMapHeaders(["name", "email"]);
  const sample = contacts(6).map((c, i) => ({ ...processRow({ name: c.name, email: c.email }, mapping, { todayIso: "2026-07-22" }), index: i, demo: true }));
  buildPlan(detectDuplicates(sample, []), { duplicateStrategy: "skip" });
  assert.equal(importReqCount(), 0);
});

// ---- non-2xx never renders as success; verbatim copy ----
test("classifyCommitOutcome — over-cap block → verbatim over-cap copy, NOT success", () => {
  const o = classifyCommitOutcome({ ok: false, blocked: true, code: "IMPORT_OVER_CAP", count: 250, max: 100 });
  assert.equal(o.status, "error");
  assert.equal(o.message, overCapMessage(250, 100));
  assert.match(o.message, /250 contacts/);
  assert.match(o.message, /limited to 100 at a time/);
  assert.match(o.message, /split your list into files of 100 or fewer/);
});
test("classifyCommitOutcome — 429 names the 5/hr limit and reset window, NOT success", () => {
  const o = classifyCommitOutcome({ ok: false, status: 429, retryAfter: 3600 });
  assert.equal(o.status, "error");
  assert.equal(o.message, rateLimitMessage(3600));
  assert.match(o.message, new RegExp(`${IMPORT_RATE_LIMIT_PER_HOUR} imports per hour`));
  assert.match(o.message, /try again in about 60 minutes/);
});
test("classifyCommitOutcome — 403 / 500 / network / empty-2xx are ALL errors, never success", () => {
  for (const res of [
    { ok: false, status: 403 },
    { ok: false, status: 500 },
    { ok: false, status: 0, networkError: true },
    { ok: true, data: {} },
    {},
    null,
  ]) {
    assert.equal(classifyCommitOutcome(res).status, "error");
  }
});
test("classifyCommitOutcome — 200 results body is success (incl. all-skipped / partial)", () => {
  assert.equal(classifyCommitOutcome({ ok: true, data: { imported: 3, failed: 0, errors: [] } }).status, "success");
  assert.equal(classifyCommitOutcome({ ok: true, data: { imported: 0, failed: 5, errors: [{}] } }).status, "success");
});

// ---- non-2xx propagation THROUGH api.importContacts (observed) ----
test("429 through api.importContacts → {ok:false,status:429,retryAfter}; classified as failure", async () => {
  installFetch(() => fakeRes(429, { error: "rate", code: "RATE_LIMIT_CONTACTS_IMPORT" }, { "Retry-After": "3600" }));
  const res = await api.importContacts(contacts(10));
  assert.equal(importReqCount(), 1);
  assert.equal(res.ok, false);
  assert.equal(res.status, 429);
  assert.equal(res.retryAfter, 3600);
  assert.equal(classifyCommitOutcome(res).status, "error");
});
test("403 through api.importContacts → {ok:false,status:403}; never success", async () => {
  installFetch(() => fakeRes(403, { error: "cap", code: "RECIPIENT_LIMIT_REACHED" }));
  const res = await api.importContacts(contacts(10));
  assert.equal(res.ok, false);
  assert.equal(res.status, 403);
  assert.equal(classifyCommitOutcome(res).status, "error");
});
test("partial result (imported + failed + errors[]) is preserved on a 200", async () => {
  installFetch(() => results200(7, 3, [{ contact: { name: "x", email: "x@example.com" }, error: "Email already exists" }]));
  const res = await api.importContacts(contacts(10));
  assert.equal(importReqCount(), 1);
  const o = classifyCommitOutcome(res);
  assert.equal(o.status, "success");
  assert.equal(o.summary.added, 7);
  assert.equal(o.summary.failed, 3);
});

// ---- retry idempotency DEMONSTRATED (not asserted) ----
test("retry idempotency: identical payload byte-for-byte + stable batch key; all-dup retry is truthful, not fake success", async () => {
  installFetch(() => results200(0, 2, [{ contact: { email: "c0@example.com" }, error: "Email already exists" }]));
  const list = contacts(2);
  const r1 = await api.importContacts(list);
  const body1 = calls[0].body;
  const r2 = await api.importContacts(list);
  const body2 = calls[1].body;
  assert.equal(importReqCount(), 2);
  // A retry sends the IDENTICAL payload → the backend's deterministic id dedups it (no double import).
  assert.equal(body1, body2);
  // The all-already-exist retry is a truthful 200 result (0 added), not a failure and not a fake success.
  assert.equal(classifyCommitOutcome(r2).status, "success");
  assert.equal(classifyCommitOutcome(r1).summary.added, 0);
  // Deterministic client batch key: same set → same key; a different set → a different key.
  const proc = list.map((c) => ({ contact: { email: c.email } }));
  assert.equal(importBatchKey("u1", proc), importBatchKey("u1", proc));
  assert.notEqual(importBatchKey("u1", proc), importBatchKey("u1", proc.slice(0, 1)));
});
