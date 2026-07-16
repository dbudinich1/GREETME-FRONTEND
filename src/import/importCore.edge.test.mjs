// src/import/importCore.edge.test.mjs — Phase 2 edge coverage (Unicode/RTL/malformed/limits).
// Run: node --test src/import/importCore.edge.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { processRow, sanitizeCellValue, checkRowCount, checkFileLimits, looksLikeZip } from "./importCore.js";

const M = { fullName: "Name", email: "Email", notes: "Notes" };

test("Unicode + RTL names preserved through mapping/synthesis", () => {
  for (const name of ["José Ñoño", "李明", "محمد عبدالله", "אברהם לוי", "😀 Emoji"]) {
    const r = processRow({ Name: name, Email: "a@b.co" }, M);
    assert.equal(r.contact.fullName, name);
    assert.equal(r.valid, true);
  }
});

test("First+Last synthesis preserves Unicode", () => {
  const r = processRow({ First: "李", Last: "明" }, { firstName: "First", lastName: "Last", email: "Email", Email: undefined });
  assert.equal(r.contact.fullName, "李 明");
});

test("formula-injection neutralized on Unicode/RTL cells", () => {
  assert.equal(sanitizeCellValue("=مرحبا"), "'=مرحبا");
  const r = processRow({ Name: "@李", Email: "a@b.co", Notes: "=CMD()" }, M);
  assert.equal(r.contact.fullName, "'@李");
  assert.equal(r.contact.notes, "'=CMD()");
});

test("malformed rows (missing mapped columns) fail per-row without throwing", () => {
  assert.doesNotThrow(() => processRow(null, M));
  assert.equal(processRow({}, M).valid, false);
  assert.ok(processRow({ Name: "A" }, M).errors.includes("missing_email"));
  assert.ok(processRow({ Email: "bad" }, M).errors.includes("invalid_email"));
});

test("XLSX/ZIP magic bytes rejected regardless of a .csv extension (spoof safety)", () => {
  assert.equal(looksLikeZip(new Uint8Array([0x50, 0x4b, 0x03, 0x04])), true);
  assert.equal(looksLikeZip(new TextEncoder().encode("Name,Email\nAda,a@b.co")), false); // real CSV bytes
});

test("row-count + media/extension limits hold for edge inputs", () => {
  assert.equal(checkRowCount(5001).ok, false);
  assert.equal(checkFileLimits({ name: "ข้อมูล.csv", type: "text/csv", size: 10 }).ok, true); // unicode filename ok
  assert.equal(checkFileLimits({ name: "sheet.xlsx", type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", size: 10 }).ok, true); // extension allowed at file-gate; content-sniff rejects spoofs
  assert.equal(checkFileLimits({ name: "evil.exe", type: "application/x-msdownload", size: 10 }).error, "unsupported_extension");
});
