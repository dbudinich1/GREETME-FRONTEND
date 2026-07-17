// src/import/recipientTypeModel.test.mjs — Run: node --test src/import/recipientTypeModel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECIPIENT_KINDS, CANONICAL_RECIPIENT_TYPES, normalizeRecipientTypeRaw,
  resolveRecipientTypeForRow, buildRecipientTypeSummary, isCanonicalType, applyRecipientTypes,
} from "./recipientTypeModel.js";

const row = (i, recipientType = "") => ({ index: i, contact: { fullName: "N" + i, email: `n${i}@x.co`, recipientType } });

test("single-type kinds auto-apply recipientType and need no column", () => {
  assert.equal(resolveRecipientTypeForRow(row(0, ""), { kind: "employee" }), "employee");
  assert.equal(resolveRecipientTypeForRow(row(0, ""), { kind: "client" }), "client");
  assert.equal(resolveRecipientTypeForRow(row(0, ""), { kind: "vendor" }), "vendor");
  // ignores whatever is in the column for a fixed single-type import
  assert.equal(resolveRecipientTypeForRow(row(0, "supplier"), { kind: "employee" }), "employee");
});

test("Mixed List normalizes recognized synonyms", () => {
  for (const [raw, canon] of [
    ["Employee", "employee"], ["employees", "employee"], ["Staff", "employee"],
    ["Client", "client"], ["customers", "client"], ["Customer", "client"],
    ["Vendor", "vendor"], ["suppliers", "vendor"], ["Supplier", "vendor"],
  ]) {
    assert.equal(normalizeRecipientTypeRaw(raw), canon, raw);
    assert.equal(resolveRecipientTypeForRow(row(0, raw), { kind: "mixed" }), canon);
  }
  assert.equal(normalizeRecipientTypeRaw("partner"), null);   // unknown
  assert.equal(normalizeRecipientTypeRaw(""), null);
});

test("unknown Mixed types require ONE mapping per unique value (grouped); never guessed", () => {
  const rows = [row(0, "partner"), row(1, "partner"), row(2, "contractor")];
  const s0 = buildRecipientTypeSummary(rows, { kind: "mixed" });
  assert.equal(s0.uniqueUnknownTypes.length, 2);
  assert.equal(s0.uniqueUnknownTypes.find((u) => u.raw === "partner").count, 2);
  assert.equal(resolveRecipientTypeForRow(row(0, "partner"), { kind: "mixed" }), "");   // unmapped → "" (not guessed)
  // map "partner" once → both resolve; only "contractor" remains
  const key = s0.uniqueUnknownTypes.find((u) => u.raw === "partner").key;
  const s1 = buildRecipientTypeSummary(rows, { kind: "mixed", typeMappings: { [key]: "vendor" } });
  assert.equal(s1.uniqueUnknownTypes.length, 1);
  assert.equal(resolveRecipientTypeForRow(row(0, "partner"), { kind: "mixed", typeMappings: { [key]: "vendor" } }), "vendor");
});

test("row override supersedes mapping/column", () => {
  assert.equal(resolveRecipientTypeForRow(row(3, "employees"), { kind: "mixed", rowTypeOverrides: { 3: "vendor" } }), "vendor");
  assert.equal(resolveRecipientTypeForRow(row(3, ""), { kind: "employee", rowTypeOverrides: { 3: "client" } }), "client");
});

test("single-type kinds never surface a type-mapping choice", () => {
  const rows = [row(0, "anything"), row(1, "")];
  assert.equal(buildRecipientTypeSummary(rows, { kind: "employee" }).needsTypeMapping, false);
  assert.equal(buildRecipientTypeSummary(rows, { kind: "client" }).uniqueUnknownTypes.length, 0);
});

test("applyRecipientTypes stamps the payload (single auto-apply; personal keeps CSV; mixed resolves)", () => {
  const rows = [row(0, "supplier"), row(1, "")];
  const base = rows.map((r) => ({ name: r.contact.fullName, recipientType: r.contact.recipientType }));
  // single-type Employees → both employee
  assert.deepEqual(applyRecipientTypes(base, rows, { kind: "employee" }).map((c) => c.recipientType), ["employee", "employee"]);
  // Clients / Vendors
  assert.deepEqual(applyRecipientTypes(base, rows, { kind: "vendor" }).map((c) => c.recipientType), ["vendor", "vendor"]);
  // personal ownership → keep whatever the CSV had
  assert.deepEqual(applyRecipientTypes(base, rows, { kind: "personal" }).map((c) => c.recipientType), ["supplier", ""]);
  assert.deepEqual(applyRecipientTypes(base, rows, {}).map((c) => c.recipientType), ["supplier", ""]);
  // mixed → normalized synonym + blank stays ""
  assert.deepEqual(applyRecipientTypes(base, rows, { kind: "mixed" }).map((c) => c.recipientType), ["vendor", ""]);
});

test("kinds + canonical set integrity", () => {
  assert.deepEqual(CANONICAL_RECIPIENT_TYPES, ["employee", "client", "vendor"]);
  assert.deepEqual(RECIPIENT_KINDS.map((k) => k.value), ["employee", "client", "vendor", "mixed"]);
  assert.ok(isCanonicalType("employee") && !isCanonicalType("mixed") && !isCanonicalType("nope"));
});
