// src/import/xlsxTemplate.js
//
// TEAM A — dependency-FREE .xlsx (OOXML) generator for the blank import templates. No third-party
// library, no package/lock change. Produces a valid, Excel-openable workbook with:
//   • a Contacts sheet: canonical header row only (ZERO data rows), styled/bold header, frozen header
//     row, autofilter, per-column widths (never collapsed), a date-formatted Birthday column;
//   • an Instructions sheet explaining required fields, controlled values, defaults, overrides, address.
// NO formulas, NO macros (.xlsx not .xlsm), NO external links. Header text is plain words (never a
// formula-trigger prefix). Uses the STORE zip method (no compression) so the writer stays tiny + correct.

import { templateColumns, templateHeaders, templateInstructions, isBusinessTemplateKind } from "./templateModel.js";

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT = "http://schemas.openxmlformats.org/package/2006/content-types";
const PKGREL = "http://schemas.openxmlformats.org/package/2006/relationships";

const xml = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function colLetter(n0) { let n = n0 + 1, s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
const cell = (ref, style, text) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;

function contentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="${CT}">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;
}
function rootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="${PKGREL}"><Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
}
function workbook() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>` +
    `<sheet name="Contacts" sheetId="1" r:id="rId1"/>` +
    `<sheet name="Instructions" sheetId="2" r:id="rId2"/>` +
    `</sheets></workbook>`;
}
function workbookRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="${PKGREL}">` +
    `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/>` +
    `<Relationship Id="rId3" Type="${REL}/styles" Target="styles.xml"/>` +
    `</Relationships>`;
}
function styles() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<styleSheet xmlns="${MAIN}">` +
    `<numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"/></numFmts>` +
    `<fonts count="2">` +
      `<font><sz val="11"/><color theme="1"/><name val="Calibri"/><family val="2"/></font>` +
      `<font><b/><sz val="11"/><color rgb="FF2C2140"/><name val="Calibri"/><family val="2"/></font>` +
    `</fonts>` +
    `<fills count="3">` +
      `<fill><patternFill patternType="none"/></fill>` +
      `<fill><patternFill patternType="gray125"/></fill>` +
      `<fill><patternFill patternType="solid"><fgColor rgb="FFEDE7F6"/><bgColor indexed="64"/></patternFill></fill>` +
    `</fills>` +
    `<borders count="2">` +
      `<border><left/><right/><top/><bottom/><diagonal/></border>` +
      `<border><left style="thin"><color rgb="FFCFC6E0"/></left><right style="thin"><color rgb="FFCFC6E0"/></right><top style="thin"><color rgb="FFCFC6E0"/></top><bottom style="thin"><color rgb="FFCFC6E0"/></bottom><diagonal/></border>` +
    `</borders>` +
    `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
    `<cellXfs count="4">` +
      `<xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
      `<xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="left" vertical="center"/></xf>` +
      `<xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/>` +
      `<xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/>` +
    `</cellXfs>` +
    `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>` +
    `<dxfs count="0"/>` +
    `</styleSheet>`;
}
function contactsSheet(kind) {
  const cols = templateColumns(kind);
  const last = colLetter(cols.length - 1);
  const colXml = cols.map((c, i) => {
    const n = i + 1;
    const style = c.format === "date" ? ` style="2"` : "";
    return `<col min="${n}" max="${n}" width="${c.width}" customWidth="1"${style}/>`;
  }).join("");
  const headerCells = cols.map((c, i) => cell(`${colLetter(i)}1`, 1, c.header)).join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="${MAIN}" xmlns:r="${REL}">` +
    `<dimension ref="A1:${last}1"/>` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15" baseColWidth="10"/>` +
    `<cols>${colXml}</cols>` +
    `<sheetData><row r="1" ht="18" customHeight="1">${headerCells}</row></sheetData>` +
    `<autoFilter ref="A1:${last}1"/>` +
    `</worksheet>`;
}
function instructionsSheet(kind) {
  const blocks = templateInstructions(kind);
  const rows = [];
  let r = 1;
  for (const b of blocks) {
    rows.push(`<row r="${r}" ht="18" customHeight="1">${cell(`A${r}`, 3, b.heading)}</row>`); r += 1;
    for (const line of b.lines) { rows.push(`<row r="${r}">${cell(`A${r}`, 0, line)}</row>`); r += 1; }
    rows.push(`<row r="${r}"></row>`); r += 1;                       // spacer
  }
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="${MAIN}" xmlns:r="${REL}">` +
    `<dimension ref="A1:A${r}"/>` +
    `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<cols><col min="1" max="1" width="104" customWidth="1"/></cols>` +
    `<sheetData>${rows.join("")}</sheetData>` +
    `</worksheet>`;
}

// The ordered set of package parts (name → UTF-8 xml text). Exported for structural testing.
export function buildXlsxParts(kind) {
  return {
    "[Content_Types].xml": contentTypes(),
    "_rels/.rels": rootRels(),
    "xl/workbook.xml": workbook(),
    "xl/_rels/workbook.xml.rels": workbookRels(),
    "xl/styles.xml": styles(),
    "xl/worksheets/sheet1.xml": contactsSheet(kind),
    "xl/worksheets/sheet2.xml": instructionsSheet(kind),
  };
}

// ---- minimal STORE-method ZIP (no compression) ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; }
  return t;
})();
function crc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
const utf8 = (s) => new TextEncoder().encode(s);
function u16(n) { return [n & 0xFF, (n >>> 8) & 0xFF]; }
function u32(n) { return [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF]; }

// Deterministic zip (fixed DOS date/time 1980-01-01 00:00) → byte-stable, reproducible output.
const DOS_TIME = 0, DOS_DATE = 0x0021;

export function zipStore(files) {
  const chunks = [];
  const central = [];
  let offset = 0;
  const push = (arr) => { const b = Uint8Array.from(arr); chunks.push(b); offset += b.length; };
  const pushBytes = (b) => { chunks.push(b); offset += b.length; };
  for (const [name, text] of Object.entries(files)) {
    const nameB = utf8(name);
    const data = utf8(text);
    const crc = crc32(data);
    const localOffset = offset;
    // local file header
    push([...u32(0x04034b50), ...u16(20), ...u16(0), ...u16(0), ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(nameB.length), ...u16(0)]);
    pushBytes(nameB); pushBytes(data);
    central.push({ nameB, crc, size: data.length, localOffset });
  }
  const cdStart = offset;
  for (const e of central) {
    push([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(DOS_TIME), ...u16(DOS_DATE),
      ...u32(e.crc), ...u32(e.size), ...u32(e.size), ...u16(e.nameB.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0),
      ...u32(0), ...u32(e.localOffset)]);
    pushBytes(e.nameB);
  }
  const cdSize = offset - cdStart;
  push([...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(central.length), ...u16(central.length),
    ...u32(cdSize), ...u32(cdStart), ...u16(0)]);
  // concat
  const total = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of chunks) { out.set(b, p); p += b.length; }
  return out;
}

// The .xlsx bytes for a template kind (Uint8Array).
export function templateXlsx(kind) {
  return zipStore(buildXlsxParts(kind));
}

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export { isBusinessTemplateKind, templateHeaders };
