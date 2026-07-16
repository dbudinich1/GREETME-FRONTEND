// src/import/importCore.test.mjs — Run: node --test src/import/importCore.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  sanitizeCellValue, normalizeEmail, isValidEmail, normalizePhone, autoMapHeaders,
  processRow, detectDuplicates, buildPlan, importBatchKey, summarizeImport,
  checkFileLimits, checkRowCount, LIMITS, looksLikeZip,
} from "./importCore.js";

test("formula-injection: cells starting with = + - @ are neutralized", () => {
  assert.equal(sanitizeCellValue("=SUM(A1)"), "'=SUM(A1)");
  assert.equal(sanitizeCellValue("+1"), "'+1");
  assert.equal(sanitizeCellValue("-2"), "'-2");
  assert.equal(sanitizeCellValue("@cmd"), "'@cmd");
  assert.equal(sanitizeCellValue("Ada Lovelace"), "Ada Lovelace"); // untouched
});

test("email normalization + validation", () => {
  assert.equal(normalizeEmail("  Ada@Example.COM "), "ada@example.com");
  assert.equal(isValidEmail("a@b.co"), true);
  assert.equal(isValidEmail("nope"), false);
  assert.equal(isValidEmail(""), false);
});

test("phone normalization keeps leading + and strips junk; never fabricates", () => {
  assert.equal(normalizePhone("+1 (555) 123-4567"), "+15551234567");
  assert.equal(normalizePhone("555.123.4567"), "5551234567");
  assert.equal(normalizePhone("  "), "");
  assert.equal(normalizePhone(null), "");
});

test("autoMapHeaders maps aliases and surfaces unmapped columns (never silently dropped)", () => {
  const { mapping, unmapped } = autoMapHeaders(["Full Name", "E-Mail", "Mobile", "Mystery"]);
  assert.equal(mapping.fullName, "Full Name");
  assert.equal(mapping.email, "E-Mail");
  assert.equal(mapping.phone, "Mobile");
  assert.deepEqual(unmapped, ["Mystery"]);
});

test("processRow: name synthesis + required-field validation", () => {
  const m = { firstName: "First", lastName: "Last", email: "Email" };
  const ok = processRow({ First: "Ada", Last: "Lovelace", Email: "ADA@example.com" }, m);
  assert.equal(ok.valid, true);
  assert.equal(ok.contact.fullName, "Ada Lovelace");
  assert.equal(ok.contact.email, "ada@example.com");

  const noEmail = processRow({ First: "Ada", Last: "L" }, m);
  assert.ok(noEmail.errors.includes("missing_email"));
  const badEmail = processRow({ First: "A", Last: "B", Email: "bad" }, m);
  assert.ok(badEmail.errors.includes("invalid_email"));
  const noName = processRow({ Email: "a@b.co" }, m);
  assert.ok(noName.errors.includes("missing_name"));
});

test("processRow: minor/privacy boundary blocks or flags by policy; never guesses 'now'", () => {
  const m = { fullName: "Name", email: "Email", birthday: "DOB" };
  const row = { Name: "Kid", Email: "kid@example.com", DOB: "2020-01-01" };
  assert.ok(processRow(row, m, { minorPolicy: "block", todayIso: "2026-07-16" }).errors.includes("minor_blocked"));
  assert.ok(processRow(row, m, { minorPolicy: "flag", todayIso: "2026-07-16" }).warnings.includes("minor_flagged"));
  // No todayIso → age cannot be computed → no minor decision fabricated.
  assert.equal(processRow(row, m, { minorPolicy: "block" }).errors.includes("minor_blocked"), false);
});

test("processRow: consent required + cell sanitization applied to output", () => {
  const m = { fullName: "Name", email: "Email", consent: "Consent", notes: "Notes" };
  const bad = processRow({ Name: "A", Email: "a@b.co", Consent: "" }, m, { requireConsent: true });
  assert.ok(bad.errors.includes("consent_required"));
  const good = processRow({ Name: "A", Email: "a@b.co", Consent: "yes" }, m, { requireConsent: true });
  assert.equal(good.valid, true);
  const inj = processRow({ Name: "A", Email: "a@b.co", Notes: "=HACK()" }, m);
  assert.equal(inj.contact.notes, "'=HACK()");
});

test("duplicate detection: same-file and existing-record", () => {
  const rows = [
    { contact: { email: "a@example.com" }, valid: true },
    { contact: { email: "a@example.com" }, valid: true }, // same-file dup
    { contact: { email: "b@example.com" }, valid: true }, // existing
  ];
  const d = detectDuplicates(rows, ["B@EXAMPLE.COM"]);
  assert.equal(d[0].duplicate, null);
  assert.equal(d[1].duplicate, "same_file");
  assert.equal(d[2].duplicate, "existing_record");
});

test("buildPlan routes create/skip/update/invalid by strategy", () => {
  const deduped = [
    { valid: true, duplicate: null },
    { valid: true, duplicate: "existing_record" },
    { valid: false, duplicate: null },
  ];
  const skip = buildPlan(deduped, { duplicateStrategy: "skip" });
  assert.equal(skip.toCreate.length, 1);
  assert.equal(skip.toSkip.length, 1);
  assert.equal(skip.invalid.length, 1);
  const upd = buildPlan(deduped, { duplicateStrategy: "update" });
  assert.equal(upd.toUpdate.length, 1);
});

test("idempotency key is deterministic per (scope, email set) and payload-sensitive", () => {
  const a = [{ contact: { email: "a@example.com" } }, { contact: { email: "b@example.com" } }];
  const b = [{ contact: { email: "b@example.com" } }, { contact: { email: "a@example.com" } }]; // reordered
  assert.equal(importBatchKey("user1", a), importBatchKey("user1", b)); // order-independent
  assert.notEqual(importBatchKey("user1", a), importBatchKey("org9", a)); // scope-sensitive
  assert.notEqual(importBatchKey("user1", a), importBatchKey("user1", [{ contact: { email: "c@example.com" } }]));
});

test("partial-success summary maps backend counts + errors", () => {
  const s = summarizeImport({ data: { added: 8, updated: 2, skipped: 1, failed: 1, errors: [{ row: 4, reason: "invalid_email" }] } });
  assert.equal(s.added, 8); assert.equal(s.updated, 2); assert.equal(s.skipped, 1); assert.equal(s.failed, 1);
  assert.equal(s.errors.length, 1);
});

test("looksLikeZip detects spoofed XLSX/ZIP bytes (never trust extension alone)", () => {
  assert.equal(looksLikeZip(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), true);  // xlsx/zip
  assert.equal(looksLikeZip(new Uint8Array([0x50, 0x4b, 0x05, 0x06])), true);  // empty zip
  assert.equal(looksLikeZip(new Uint8Array([0x4e, 0x61, 0x6d, 0x65])), false); // "Name" (real CSV)
  assert.equal(looksLikeZip(new Uint8Array([])), false);
});

test("file + row limits (size, media-type, extension, row count)", () => {
  assert.equal(checkFileLimits({ name: "c.csv", type: "text/csv", size: 100 }).ok, true);
  assert.equal(checkFileLimits({ name: "c.exe", type: "application/x-msdownload", size: 10 }).error, "unsupported_extension");
  assert.equal(checkFileLimits({ name: "c.csv", type: "image/png", size: 10 }).error, "unsupported_media_type");
  assert.equal(checkFileLimits({ name: "c.csv", type: "text/csv", size: LIMITS.maxBytes + 1 }).error, "file_too_large");
  assert.equal(checkRowCount(LIMITS.maxRows + 1).error, "too_many_rows");
  assert.equal(checkRowCount(10).ok, true);
});
