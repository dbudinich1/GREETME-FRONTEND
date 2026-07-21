// src/import/xlsxReader.js
//
// TEAM A — shared workbook reader (Slice 1). Parses genuine .xlsx and legacy .xls LOCALLY and
// normalizes the chosen worksheet to the SAME { fields, rows } shape that Papa.parse(header:true)
// produces for CSV — so Excel rows flow through the UNCHANGED mapping/normalization/preview/dedup/
// validation/commit pipeline. No new backend endpoint, no workbook binary ever leaves the browser.
//
// SheetJS (xlsx 0.20.3, official SheetJS distribution — NOT the vulnerable npm xlsx@0.18.5) is the
// engine. It is imported STATICALLY here and this whole module is loaded via a DYNAMIC import() from
// the Wizard, so SheetJS is code-split into its own async chunk and is ABSENT from the main bundle;
// it loads only when the user selects an Excel file.
//
// SAFETY: workbook content is treated strictly as data. Formulas are NEVER evaluated — only cached/
// displayed values (cell.w, then cell.v) are used; a formula cell with no cached value becomes "".
// No macros/scripts/external links/connections are executed (SheetJS is a parser, not an evaluator).
// Every value passes the existing spreadsheet-formula-injection sanitizer. Encrypted/corrupt/macro/
// mismatched files are rejected with a clear, stable error code.

import * as XLSX from "xlsx";
import { LIMITS, checkSheetCount, sanitizeCellValue } from "./importCore.js";

// Support sheets produced by the Greet-Me template generator (never imported as contacts).
export const SUPPORT_SHEET_NAMES = Object.freeze(["instructions", "lists", "reference"]);
const isSupportName = (name) => SUPPORT_SHEET_NAMES.includes(String(name == null ? "" : name).trim().toLowerCase());

// ---- content sniffing (magic bytes) + extension/content agreement -------------------------------
const extOf = (filename) => { const n = String(filename || ""); const i = n.lastIndexOf("."); return i < 0 ? "" : n.slice(i).toLowerCase(); };
const isZip = (b) => b && b.length >= 4 && b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05 || b[2] === 0x07); // "PK.."
const isOle = (b) => b && b.length >= 8 && b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0 && b[4] === 0xa1 && b[5] === 0xb1 && b[6] === 0x1a && b[7] === 0xe1; // OLE2/CFB

// A macro-enabled OOXML package stores xl/vbaProject.bin — its name appears verbatim in the zip.
function hasVbaProject(bytes) {
  const needle = [0x76, 0x62, 0x61, 0x50, 0x72, 0x6f, 0x6a, 0x65, 0x63, 0x74, 0x2e, 0x62, 0x69, 0x6e]; // "vbaProject.bin"
  const n = bytes.length, m = needle.length;
  for (let i = 0; i + m <= n; i++) { let k = 0; for (; k < m; k++) if (bytes[i + k] !== needle[k]) break; if (k === m) return true; }
  return false;
}

// Decide the parse route from BOTH extension and actual bytes. Returns { format } or { reject: code }.
export function sniffWorkbook(bytes, filename) {
  const ext = extOf(filename);
  const zip = isZip(bytes), ole = isOle(bytes);
  if (ext === ".xlsm") return { reject: "macro_workbook" };                 // macro-enabled: reject up front
  if (ext === ".csv") {
    if (zip || ole) return { reject: "content_mismatch" };                  // a workbook renamed .csv
    return { format: "csv" };
  }
  if (ext === ".xlsx") {
    if (!zip) return { reject: ole ? "encrypted_or_unsupported" : "content_mismatch" }; // encrypted OOXML is OLE, not zip
    if (hasVbaProject(bytes)) return { reject: "macro_workbook" };          // .xlsx carrying VBA → treat as macro
    return { format: "xlsx" };
  }
  if (ext === ".xls") {
    if (!ole) return { reject: "content_mismatch" };
    return { format: "xls" };
  }
  return { reject: "unsupported_extension" };
}

// ---- cell → safe text (never executes a formula) ------------------------------------------------
function cellText(cell) {
  if (!cell) return "";
  if (cell.t === "e") return "";                       // error cell → empty
  if (cell.w != null) return sanitizeCellValue(String(cell.w));   // formatted / cached display text
  if (cell.v != null) return sanitizeCellValue(String(cell.v));   // raw cached value (formula results included, never cell.f)
  return "";                                           // formula with no cached value, or blank
}

// One worksheet → { fields, rows, rowCount }. Header = first row of the used range; blank data rows skipped.
function sheetToFieldsRows(ws) {
  if (!ws || !ws["!ref"]) return { fields: [], rows: [], rowCount: 0 };
  const range = XLSX.utils.decode_range(ws["!ref"]);
  const fields = [];
  for (let c = range.s.c; c <= range.e.c; c++) fields.push(cellText(ws[XLSX.utils.encode_cell({ r: range.s.r, c })]));
  const rows = [];
  for (let r = range.s.r + 1; r <= range.e.r; r++) {
    const o = {}; let any = false;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const key = fields[c - range.s.c];
      const val = cellText(ws[XLSX.utils.encode_cell({ r, c })]);
      if (val !== "") any = true;
      if (key) o[key] = val;
    }
    if (any) rows.push(o);
  }
  return { fields: fields.map((f) => String(f)), rows, rowCount: rows.length };
}

// Hidden state per sheet (0 visible, 1 hidden, 2 very hidden); undefined ⇒ visible.
function hiddenMap(wb) {
  const m = {};
  const arr = wb && wb.Workbook && Array.isArray(wb.Workbook.Sheets) ? wb.Workbook.Sheets : [];
  for (const s of arr) if (s && s.name != null) m[s.name] = s.Hidden || 0;
  return m;
}

// ---- public: read bytes → eligibility + extracted eligible sheets -------------------------------
// Returns (all failures are fail-closed, never throw to the caller):
//   { ok:false, error:<code> }
//   { ok:true, format, sheetCount,
//     sheets:   [{ name, rowCount, eligible, reason }],           // full inventory (safe metadata only)
//     eligible: [{ name, fields, rows, rowCount }],               // importable sheets, fully extracted
//     needsSelection:boolean, autoName:string|null }
export async function readWorkbookBytes(bytes, filename) {
  const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (typeof u8.length === "number" && u8.length > LIMITS.maxBytes) return { ok: false, error: "file_too_large" };

  const sniff = sniffWorkbook(u8, filename);
  if (sniff.reject) return { ok: false, error: sniff.reject };
  if (sniff.format === "csv") return { ok: false, error: "not_a_workbook" }; // CSV is handled by the existing parser

  let wb;
  try {
    // cellHTML:false avoids HTML parsing; cellDates:true yields formatted dates; formulas are read
    // (cell.f) but NEVER evaluated — cellText only ever uses cell.w / cell.v.
    wb = XLSX.read(u8, { type: "array", cellDates: true, cellHTML: false, cellNF: false, WTF: false });
  } catch (e) {
    const msg = String((e && e.message) || e).toLowerCase();
    if (/password|encrypt/.test(msg)) return { ok: false, error: "password_protected" };
    return { ok: false, error: "corrupt_workbook" };
  }
  const names = Array.isArray(wb.SheetNames) ? wb.SheetNames : [];
  if (!names.length) return { ok: false, error: "corrupt_workbook" };
  const sc = checkSheetCount(names.length);
  if (!sc.ok) return { ok: false, error: sc.error };

  const sheets = [];
  const eligible = [];
  for (const name of names) {
    const hidden = hiddenMap(wb)[name] || 0;
    const extracted = sheetToFieldsRows(wb.Sheets[name]);
    let reason = "eligible";
    if (isSupportName(name)) reason = "support_sheet";
    else if (hidden !== 0) reason = hidden === 2 ? "very_hidden" : "hidden";
    else if (extracted.rowCount === 0) reason = "empty";
    const ok = reason === "eligible";
    sheets.push({ name, rowCount: extracted.rowCount, eligible: ok, reason });
    if (ok) eligible.push({ name, fields: extracted.fields, rows: extracted.rows, rowCount: extracted.rowCount });
  }
  if (eligible.length === 0) return { ok: false, error: "no_eligible_sheet" };
  return {
    ok: true,
    format: sniff.format,
    sheetCount: names.length,
    sheets,
    eligible,
    needsSelection: eligible.length > 1,
    autoName: eligible.length === 1 ? eligible[0].name : null,
  };
}

// Pick one eligible sheet's normalized rows by name (worksheets are NEVER merged).
export function selectSheet(readResult, name) {
  if (!readResult || !readResult.ok) return null;
  const s = readResult.eligible.find((e) => e.name === name);
  return s ? { fields: s.fields, rows: s.rows } : null;
}

// Stable, user-facing messages for each fail-closed code (single source for UI + tests).
export const READER_ERROR_MESSAGES = Object.freeze({
  macro_workbook: "Macro-enabled workbooks (.xlsm) aren’t supported. Save as .xlsx and upload again.",
  password_protected: "This workbook is password-protected. Remove the password and upload again.",
  corrupt_workbook: "This file couldn’t be read as a valid Excel workbook.",
  content_mismatch: "This file’s contents don’t match its extension. Upload a genuine .xlsx, .xls, or .csv.",
  encrypted_or_unsupported: "This .xlsx couldn’t be opened — it may be password-protected or not a valid workbook.",
  unsupported_extension: "Unsupported file type. Upload an .xlsx, .xls, or .csv file.",
  too_many_sheets: `This workbook has too many sheets (max ${LIMITS.maxSheets}).`,
  no_eligible_sheet: "No importable contact sheet was found. Instructions, Lists, and Reference sheets and hidden or empty sheets are skipped.",
  file_too_large: "This file is too large (max 5 MB).",
  not_a_workbook: "This isn’t an Excel workbook.",
});
export const readerMessage = (code) => READER_ERROR_MESSAGES[code] || "This file couldn’t be imported.";
