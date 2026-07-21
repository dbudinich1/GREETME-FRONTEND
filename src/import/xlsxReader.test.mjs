// src/import/xlsxReader.test.mjs — Run: node --test src/import/xlsxReader.test.mjs
// Reader foundation: real .xlsx/.xls parsing, worksheet eligibility/selection, content-vs-extension
// validation, macro/encrypted/corrupt rejection, formula-never-executed, and pipeline-shape parity.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as XLSX from "xlsx";
import {
  readWorkbookBytes, selectSheet, sniffWorkbook, SUPPORT_SHEET_NAMES,
  READER_ERROR_MESSAGES, readerMessage,
} from "./xlsxReader.js";
import { detectPracticeCsv, PRACTICE_MARKER_HEADER, PRACTICE_MARKER_VALUE } from "./sampleWorkspace.js";
import { checkRowCount, checkSheetCount, LIMITS } from "./importCore.js";

const HDR = ["Name", "Email", "Type", "Relation", "Description"];
const ROWS = [
  ["Robin Sample", "robin@example.com", "Family", "Family Member", "Greet-Me Worthy"],
  ["Casey Sample", "casey@example.org", "Friend", "Acquaintance", "Inner Circle"],
];
function wbBytes(sheets, { hidden = {}, bookType = "xlsx" } = {}) {
  const wb = XLSX.utils.book_new();
  for (const [name, aoa] of sheets) XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
  wb.Workbook = { Sheets: wb.SheetNames.map((name) => ({ name, Hidden: hidden[name] || 0 })) };
  return new Uint8Array(XLSX.write(wb, { type: "array", bookType }));
}

test("1 · valid .xlsx parses → single eligible sheet auto-selected, rows normalized to {fields,rows}", async () => {
  const bytes = wbBytes([["Contacts", [HDR, ...ROWS]], ["Instructions", [["x"]]], ["Lists", [["Family"]]]]);
  const r = await readWorkbookBytes(bytes, "my-contacts.xlsx");
  assert.equal(r.ok, true); assert.equal(r.format, "xlsx");
  assert.equal(r.needsSelection, false); assert.equal(r.autoName, "Contacts");
  const sel = selectSheet(r, "Contacts");
  assert.deepEqual(sel.fields, HDR);
  assert.deepEqual(sel.rows[0], { Name: "Robin Sample", Email: "robin@example.com", Type: "Family", Relation: "Family Member", Description: "Greet-Me Worthy" });
});

test("2 · valid legacy .xls (BIFF8) parses", async () => {
  const bytes = wbBytes([["Contacts", [HDR, ...ROWS]]], { bookType: "biff8" });
  const r = await readWorkbookBytes(bytes, "legacy.xls");
  assert.equal(r.ok, true); assert.equal(r.format, "xls"); assert.equal(r.eligible[0].rowCount, 2);
});

test("4 · .xlsm is rejected up front (macro_workbook)", () => {
  assert.deepEqual(sniffWorkbook(new Uint8Array([0x50, 0x4b, 3, 4]), "book.xlsm"), { reject: "macro_workbook" });
});
test("4b · an .xlsx that actually carries xl/vbaProject.bin is rejected as a macro workbook", async () => {
  // a zip whose bytes contain the vba part name → treated as macro even with .xlsx ext
  const fake = new TextEncoder().encode("PK\x03\x04……xl/vbaProject.bin……");
  const b = new Uint8Array(fake); b[0] = 0x50; b[1] = 0x4b; b[2] = 3; b[3] = 4;
  const r = await readWorkbookBytes(b, "macro.xlsx");
  assert.equal(r.ok, false); assert.equal(r.error, "macro_workbook");
});

test("5 · corrupt .xlsx (zip magic, garbage body) fails safe (corrupt_workbook), never throws", async () => {
  const b = new Uint8Array([0x50, 0x4b, 3, 4, ...Array.from({ length: 64 }, (_, i) => (i * 7) & 0xff)]);
  const r = await readWorkbookBytes(b, "broken.xlsx");
  assert.equal(r.ok, false); assert.equal(r.error, "corrupt_workbook");
});
test("6 · corrupt .xls (OLE magic, garbage body) fails safe", async () => {
  const b = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...Array(64).fill(9)]);
  const r = await readWorkbookBytes(b, "broken.xls");
  assert.equal(r.ok, false); assert.equal(r.error, "corrupt_workbook");
});

test("7 · password-protected .xlsx (encrypted OOXML is an OLE container) is rejected clearly", async () => {
  const b = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1, ...Array(32).fill(0)]);
  const r = await readWorkbookBytes(b, "locked.xlsx");
  assert.equal(r.ok, false); assert.equal(r.error, "encrypted_or_unsupported");
  assert.match(readerMessage(r.error), /password|valid workbook/i);
  assert.ok(READER_ERROR_MESSAGES.password_protected);   // the .xls SheetJS-throw path maps here
});

test("8 · renamed / mismatched content fails safe (content_mismatch)", async () => {
  assert.deepEqual(sniffWorkbook(new Uint8Array([0x50, 0x4b, 3, 4]), "data.csv"), { reject: "content_mismatch" }); // workbook bytes as .csv
  assert.deepEqual(sniffWorkbook(new Uint8Array([0x50, 0x4b, 3, 4]), "old.xls"), { reject: "content_mismatch" });  // zip bytes as .xls
  assert.deepEqual(sniffWorkbook(new TextEncoder().encode("Name,Email"), "book.xlsx"), { reject: "content_mismatch" }); // text as .xlsx
});

test("9 · Instructions / Lists / Reference sheets are excluded", async () => {
  assert.deepEqual([...SUPPORT_SHEET_NAMES].sort(), ["instructions", "lists", "reference"]);
  const bytes = wbBytes([["Contacts", [HDR, ...ROWS]], ["Instructions", [["a"]]], ["Lists", [["b"]]], ["Reference", [["c"]]]]);
  const r = await readWorkbookBytes(bytes, "w.xlsx");
  assert.deepEqual(r.eligible.map((e) => e.name), ["Contacts"]);
  for (const n of ["Instructions", "Lists", "Reference"]) assert.equal(r.sheets.find((s) => s.name === n).reason, "support_sheet");
});

test("10 · hidden and very-hidden sheets are excluded", async () => {
  const bytes = wbBytes([["Visible", [HDR, ...ROWS]], ["Secret", [HDR, ...ROWS]], ["Vault", [HDR, ...ROWS]]], { hidden: { Secret: 1, Vault: 2 } });
  const r = await readWorkbookBytes(bytes, "w.xlsx");
  assert.deepEqual(r.eligible.map((e) => e.name), ["Visible"]);
  assert.equal(r.sheets.find((s) => s.name === "Secret").reason, "hidden");
  assert.equal(r.sheets.find((s) => s.name === "Vault").reason, "very_hidden");
});

test("11 · exactly one eligible sheet auto-selects (no selection needed)", async () => {
  const r = await readWorkbookBytes(wbBytes([["Only", [HDR, ...ROWS]]]), "w.xlsx");
  assert.equal(r.needsSelection, false); assert.equal(r.autoName, "Only");
});
test("12 · multiple eligible sheets require selection (safe metadata: name + row count)", async () => {
  const r = await readWorkbookBytes(wbBytes([["Team A", [HDR, ...ROWS]], ["Team B", [HDR, ROWS[0]]]]), "w.xlsx");
  assert.equal(r.needsSelection, true); assert.equal(r.autoName, null);
  assert.deepEqual(r.eligible.map((e) => ({ name: e.name, rowCount: e.rowCount })), [{ name: "Team A", rowCount: 2 }, { name: "Team B", rowCount: 1 }]);
});
test("13 · selection returns ONE sheet's rows (worksheets never merged)", async () => {
  const r = await readWorkbookBytes(wbBytes([["A", [HDR, ROWS[0]]], ["B", [HDR, ROWS[1]]]]), "w.xlsx");
  assert.deepEqual(selectSheet(r, "A").rows.map((x) => x.Name), ["Robin Sample"]);
  assert.deepEqual(selectSheet(r, "B").rows.map((x) => x.Name), ["Casey Sample"]);
  assert.equal(selectSheet(r, "does-not-exist"), null);
});
test("14 · a workbook with no eligible sheet fails clearly (no mapping/commit)", async () => {
  const r = await readWorkbookBytes(wbBytes([["Contacts", [HDR]], ["Instructions", [["x"]]]]), "empty.xlsx"); // header only ⇒ empty
  assert.equal(r.ok, false); assert.equal(r.error, "no_eligible_sheet");
  assert.match(readerMessage(r.error), /no importable/i);
});

test("22/23 · formulas are never executed — cached value used, external/no-cache formula → empty", async () => {
  const ws = XLSX.utils.aoa_to_sheet([HDR, ["Ada Sample", "ada@example.com", "Family", "Family Member", "Greet-Me Worthy"]]);
  ws.F1 = { t: "s", v: "Cached" }; ws.F2 = { t: "n", f: "1+1", v: 2, w: "2" };          // formula WITH cached value
  ws.G1 = { t: "s", v: "External" }; ws.G2 = { t: "s", f: "'[ext.xlsx]S'!A1" };          // external-link formula, NO cache
  ws.H1 = { t: "s", v: "Err" }; ws.H2 = { t: "e", v: 0x07, w: "#DIV/0!" };               // error cell
  ws["!ref"] = "A1:H2";
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, "Contacts");
  const r = await readWorkbookBytes(new Uint8Array(XLSX.write(wb, { type: "array", bookType: "xlsx" })), "f.xlsx");
  const row = selectSheet(r, "Contacts").rows[0];
  assert.equal(row.Cached, "2");            // cached formula result, never re-evaluated
  assert.equal(row.External, "");           // external-link formula with no cached value → empty (never resolved)
  assert.equal(row.Err, "");                // error cell → empty
});

test("25 · sheet count over the limit fails closed (too_many_sheets)", async () => {
  const many = Array.from({ length: LIMITS.maxSheets + 1 }, (_, i) => [`S${i}`, [HDR, ROWS[0]]]);
  const r = await readWorkbookBytes(wbBytes(many), "big.xlsx");
  assert.equal(r.ok, false); assert.equal(r.error, "too_many_sheets");
  assert.equal(checkSheetCount(LIMITS.maxSheets).ok, true);
  assert.equal(checkSheetCount(LIMITS.maxSheets + 1).ok, false);
});
test("26 · row count over 5000 fails closed downstream (before mapping)", async () => {
  const big = [HDR, ...Array.from({ length: LIMITS.maxRows + 1 }, (_, i) => [`P${i} Sample`, `p${i}@example.com`, "", "", ""])];
  const r = await readWorkbookBytes(wbBytes([["Contacts", big]]), "rows.xlsx");
  assert.equal(r.ok, true); assert.equal(r.eligible[0].rowCount, LIMITS.maxRows + 1);
  assert.equal(checkRowCount(r.eligible[0].rowCount).ok, false);   // ingest() enforces this before processRow
});
test("24 · oversized file fails before parsing", async () => {
  const huge = new Uint8Array(LIMITS.maxBytes + 1); huge[0] = 0x50; huge[1] = 0x4b;
  const r = await readWorkbookBytes(huge, "huge.xlsx");
  assert.equal(r.ok, false); assert.equal(r.error, "file_too_large");
});

test("16/17 · Excel-normalized rows carry the marker column so Practice detection is format-independent", async () => {
  const H = [...HDR, PRACTICE_MARKER_HEADER];
  const bytes = wbBytes([["Contacts", [H, [...ROWS[0], PRACTICE_MARKER_VALUE], [...ROWS[1], PRACTICE_MARKER_VALUE]]]]);
  const r = await readWorkbookBytes(bytes, "practice.xlsx");
  const sel = selectSheet(r, "Contacts");
  assert.deepEqual(detectPracticeCsv(sel.fields, sel.rows), { marked: true, valid: true });   // reuses the CSV fail-closed boundary
  const bad = wbBytes([["Contacts", [H, [...ROWS[0], "practice-v9"]]]]);
  const rb = await readWorkbookBytes(bad, "bad.xlsx");
  assert.equal(detectPracticeCsv(selectSheet(rb, "Contacts").fields, selectSheet(rb, "Contacts").rows).valid, false); // conflicting → fail closed
});

test("readerMessage returns clear text for every fail-closed code", () => {
  for (const code of Object.keys(READER_ERROR_MESSAGES)) assert.ok(readerMessage(code).length > 8, code);
  assert.ok(readerMessage("unknown_code").length > 8);   // safe default
});
