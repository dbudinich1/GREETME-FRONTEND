// src/import/corporateCommit.test.mjs — Run: node --test src/import/corporateCommit.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildCorporatePayload, confirmationCounts, classifyCorporateOutcome, reconcileCorporateResults,
  rowPresentation, isRecognizedResultsBody, messageForStatus, ROW_STATUS,
} from "./corporateCommit.js";
import { PREVIEW_STATUS } from "./corporateAddressStatus.js";

const item = (i, over = {}) => ({
  index: i, valid: true, errors: [],
  contact: { fullName: `N${i}`, email: `n${i}@corp.co`, ...(over.contact || {}) },
  address: over.address || null,
  addressStatus: { status: over.status || PREVIEW_STATUS.ABSENT, label: "x", missing: [] },
  ...over,
});

// ---------- payload identity ----------
test("payload contacts are the EXACT previewed item.contact objects, in order (no reparse)", () => {
  const items = [item(0), item(1), item(2)];
  const { envelope, submittedPreviewIndex } = buildCorporatePayload(items, { duplicateStrategy: "skip" });
  assert.equal(envelope.contacts.length, 3);
  assert.equal(envelope.contacts[0], items[0].contact);   // same reference — not reparsed/renormalized
  assert.deepEqual(envelope.contacts.map((c) => c.email), ["n0@corp.co", "n1@corp.co", "n2@corp.co"]);
  assert.deepEqual(submittedPreviewIndex, [0, 1, 2]);
});

test("only VALID rows are submitted; invalid rows are excluded and preview index is preserved", () => {
  const items = [item(0), { ...item(1), valid: false, errors: ["missing_email"] }, item(2)];
  const { envelope, submittedPreviewIndex } = buildCorporatePayload(items, {});
  assert.deepEqual(envelope.contacts.map((c) => c.email), ["n0@corp.co", "n2@corp.co"]);
  assert.deepEqual(submittedPreviewIndex, [0, 2]);          // backend row.index 1 → preview index 2
});

test("duplicateStrategy is request-level; invalid strategy falls back to skip", () => {
  assert.equal(buildCorporatePayload([item(0)], { duplicateStrategy: "update" }).envelope.duplicateStrategy, "update");
  assert.equal(buildCorporatePayload([item(0)], { duplicateStrategy: "merge" }).envelope.duplicateStrategy, "merge");
  assert.equal(buildCorporatePayload([item(0)], { duplicateStrategy: "nonsense" }).envelope.duplicateStrategy, "skip");
});

test("requireConsent / recipientContext included ONLY when supported values are given", () => {
  const a = buildCorporatePayload([item(0)], {}).envelope;
  assert.equal("requireConsent" in a, false);
  assert.equal("recipientContext" in a, false);
  const b = buildCorporatePayload([item(0)], { requireConsent: true, recipientContext: "client" }).envelope;
  assert.equal(b.requireConsent, true);
  assert.equal(b.recipientContext, "client");
  const c = buildCorporatePayload([item(0)], { recipientContext: "bogus" }).envelope;
  assert.equal("recipientContext" in c, false);
});

test("payload never synthesizes birthday/deliveryPhone/occasion and carries no UI-only addressStatus", () => {
  const items = [item(0, { contact: { fullName: "A", email: "a@corp.co", phone: "555-1" }, status: PREVIEW_STATUS.REVIEW })];
  const { envelope } = buildCorporatePayload(items, {});
  const c = envelope.contacts[0];
  assert.equal("birthday" in c, false);
  assert.equal("deliveryPhone" in c, false);   // never derived from phone
  assert.equal("occasions" in c, false);
  assert.equal("addressStatus" in c, false);    // UI-only, excluded (item.contact never had it)
  assert.equal(c.phone, "555-1");               // general phone passed through unchanged, as its own field
});

// ---------- confirmation counts ----------
test("confirmationCounts buckets valid rows by address status and counts pre-commit rejections", () => {
  const items = [
    item(0, { status: PREVIEW_STATUS.REVIEW }),
    item(1, { status: PREVIEW_STATUS.INCOMPLETE }),
    item(2, { status: PREVIEW_STATUS.ABSENT }),
    item(3, { status: PREVIEW_STATUS.UNKNOWN_COUNTRY }),
    { ...item(4), valid: false, errors: ["missing_email"] },
  ];
  const c = confirmationCounts(items);
  assert.equal(c.total, 5);
  assert.equal(c.importable, 4);
  assert.equal(c.rejectedPreCommit, 1);
  assert.equal(c.completeUnverified, 1);
  assert.equal(c.incompleteAddress, 1);
  assert.equal(c.noAddress, 1);
  assert.equal(c.unknownCountry, 1);
});

// ---------- reconciliation ----------
const results = (rows, over = {}) => ({ added: 0, updated: 0, merged: 0, skipped: 0, failed: 0, total: rows.length, rows, ...over });

test("reconcile maps backend row.index → preview index deterministically", () => {
  const submitted = [0, 2]; // preview indexes of the 2 submitted rows
  const data = results([{ index: 0, status: "created" }, { index: 1, status: "failed", reason: "invalid_email" }], { added: 1, failed: 1, total: 2 });
  const r = reconcileCorporateResults(submitted, data);
  assert.equal(r.consistent, true);
  assert.deepEqual(r.perRow[0], { submitIndex: 0, previewIndex: 0, status: "created", reason: null });
  assert.deepEqual(r.perRow[1], { submitIndex: 1, previewIndex: 2, status: "failed", reason: "invalid_email" });
});

test("reconcile flags MISSING results (fail closed — never assume success)", () => {
  const r = reconcileCorporateResults([0, 1], results([{ index: 0, status: "created" }], { added: 1, total: 2 }));
  assert.equal(r.consistent, false);
  assert.deepEqual(r.missing.map((m) => m.submitIndex), [1]);
});

test("reconcile flags EXTRA and DUPLICATE result indexes", () => {
  const ex = reconcileCorporateResults([0], results([{ index: 0, status: "created" }, { index: 5, status: "created" }], { added: 2, total: 1 }));
  assert.equal(ex.extra.length, 1);
  assert.equal(ex.consistent, false);
  const dup = reconcileCorporateResults([0, 1], results([{ index: 0, status: "created" }, { index: 0, status: "created" }], { added: 2, total: 2 }));
  assert.deepEqual(dup.duplicateIndexes, [0]);
  assert.equal(dup.consistent, false);
});

test("reconcile requires totals to match the per-status tally AND total == submitted", () => {
  const good = reconcileCorporateResults([0, 1], results([{ index: 0, status: "created" }, { index: 1, status: "skipped" }], { added: 1, skipped: 1, total: 2 }));
  assert.equal(good.consistent, true);
  const badTotals = reconcileCorporateResults([0, 1], results([{ index: 0, status: "created" }, { index: 1, status: "skipped" }], { added: 2, skipped: 0, total: 2 }));
  assert.equal(badTotals.totalsMatch, false);
  assert.equal(badTotals.consistent, false);
});

// ---------- classification (fail closed) ----------
test("classify: recognized results body shape gate", () => {
  assert.equal(isRecognizedResultsBody({ added: 0, updated: 0, merged: 0, skipped: 0, failed: 0, total: 0, rows: [] }), true);
  assert.equal(isRecognizedResultsBody({ added: 0, rows: [] }), false);
  assert.equal(isRecognizedResultsBody(null), false);
});

test("classify success / partial / failed", () => {
  const s = classifyCorporateOutcome({ ok: true, status: 200, data: results([{ index: 0, status: "created" }], { added: 1, total: 1 }) }, [0]);
  assert.equal(s.kind, "success");
  const p = classifyCorporateOutcome({ ok: true, status: 200, data: results([{ index: 0, status: "created" }, { index: 1, status: "failed", reason: "x" }], { added: 1, failed: 1, total: 2 }) }, [0, 1]);
  assert.equal(p.kind, "partial");
  const f = classifyCorporateOutcome({ ok: true, status: 200, data: results([{ index: 0, status: "failed", reason: "x" }], { failed: 1, total: 1 }) }, [0]);
  assert.equal(f.kind, "failed");
});

test("classify NEVER turns a non-2xx / dormant / malformed / network / abort into success", () => {
  assert.equal(classifyCorporateOutcome({ ok: false, status: 400, code: "invalid_payload" }, [0]).kind, "error");
  assert.equal(classifyCorporateOutcome({ ok: false, unauthorized: true, status: 403 }, [0]).kind, "error");
  assert.equal(classifyCorporateOutcome({ ok: false, dormant: true, status: 503, reason: "corporate_import_disabled" }, []).kind, "dormant");
  assert.equal(classifyCorporateOutcome({ ok: true, status: 200, data: { nonsense: 1 } }, [0]).kind, "error"); // malformed 2xx
  assert.equal(classifyCorporateOutcome({ ok: false, networkError: true, status: 0 }, [0]).kind, "indeterminate");
  assert.equal(classifyCorporateOutcome({ ok: false, indeterminate: true, status: 0 }, [0]).kind, "indeterminate");
  assert.equal(classifyCorporateOutcome({ ok: false, aborted: true, status: 0 }, [0]).kind, "aborted");
});

test("classify: a 2xx whose rows don't reconcile is an ERROR (fail closed), not success", () => {
  const o = classifyCorporateOutcome({ ok: true, status: 200, data: results([{ index: 0, status: "created" }], { added: 1, total: 2 }) }, [0, 1]); // missing row 1
  assert.equal(o.kind, "error");
});

// ---------- row presentation ----------
test("rowPresentation distinguishes imported-with-address-review / no-address / not-imported; never 'verified'", () => {
  assert.equal(rowPresentation(ROW_STATUS.CREATED, PREVIEW_STATUS.REVIEW).bucket, "imported_unverified");
  assert.equal(rowPresentation(ROW_STATUS.CREATED, PREVIEW_STATUS.ABSENT).bucket, "imported_no_address");
  assert.equal(rowPresentation(ROW_STATUS.CREATED, PREVIEW_STATUS.INCOMPLETE).bucket, "imported_incomplete");
  assert.equal(rowPresentation(ROW_STATUS.FAILED, null).bucket, "failed");
  // No label may ever CLAIM the address is verified. "not verified" is the truthful exception.
  for (const s of [ROW_STATUS.CREATED, ROW_STATUS.UPDATED, ROW_STATUS.MERGED, ROW_STATUS.SKIPPED, ROW_STATUS.FAILED]) {
    const l = rowPresentation(s, PREVIEW_STATUS.REVIEW).label.toLowerCase();
    assert.ok(!/verified/.test(l) || /not verified/.test(l), `label must not claim verification: ${l}`);
  }
});

test("messageForStatus returns a safe non-empty message for each handled status", () => {
  for (const s of [400, 401, 403, 404, 413, 429, 500, 503]) assert.ok(messageForStatus(s).length > 0);
});
