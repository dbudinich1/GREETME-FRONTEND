// src/import/xlsxTemplate.js
//
// TEAM A — dependency-FREE .xlsx (OOXML) generator for the blank import templates. No third-party
// library, no package/lock change. Produces a valid, Excel-openable workbook with:
//   • a Contacts sheet: canonical header row only (ZERO data rows), styled/bold header, frozen header
//     row, autofilter, per-column widths (never collapsed), a date-formatted Birthday column;
//   • THREE list dropdowns (data validation) over the blank working range: Type, Relation (dependent on
//     Type via INDIRECT + named ranges), Description — options derived from the canonical taxonomy;
//   • a hidden Lists sheet holding the option lists (named ranges reference it);
//   • an Instructions sheet;
//   • neutral document properties (creator/company = Greet-Me; NO author/tenant/account identity).
// NO macros/VBA, NO cell formulas, NO external links/connections/Power Query, NO network dependency,
// NO remote images. Header text is plain words. STORE zip method (no compression).

import { templateColumns, templateHeaders, templateInstructions, templateTitle, isBusinessTemplateKind,
  TYPE_OPTIONS, DESCRIPTION_OPTIONS, RELATION_OPTIONS_BY_TYPE } from "./templateModel.js";

const MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const CT = "http://schemas.openxmlformats.org/package/2006/content-types";
const PKGREL = "http://schemas.openxmlformats.org/package/2006/relationships";
const CORE_NS = "http://schemas.openxmlformats.org/package/2006/metadata/core-properties";
const EXT_NS = "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties";

const DATA_ROWS = 5000;   // dropdown validation is prepared for rows 2–5000 (blank working range)

const xml = (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function colLetter(n0) { let n = n0 + 1, s = ""; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
const cell = (ref, style, text) => `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${xml(text)}</t></is></c>`;
// Index of a header in the (fixed) column set.
function colIndex(kind, header) { return templateColumns(kind).findIndex((c) => c.header === header); }

function contentTypes() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Types xmlns="${CT}">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet2.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/worksheets/sheet3.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>` +
    `<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>` +
    `</Types>`;
}
function rootRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="${PKGREL}">` +
    `<Relationship Id="rId1" Type="${REL}/officeDocument" Target="xl/workbook.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/metadata/core-properties" Target="docProps/core.xml"/>` +
    `<Relationship Id="rId3" Type="${REL}/extended-properties" Target="docProps/app.xml"/>` +
    `</Relationships>`;
}
// Named ranges: GmType, GmDesc (static lists) + one range per Type LABEL (Family/Friend/Professional)
// so the Relation dropdown's INDIRECT($<Type cell>) resolves the matching relation list.
function definedNames() {
  const dn = [];
  dn.push(`<definedName name="GmType">Lists!$A$2:$A$${1 + TYPE_OPTIONS.length}</definedName>`);
  dn.push(`<definedName name="GmDesc">Lists!$B$2:$B$${1 + DESCRIPTION_OPTIONS.length}</definedName>`);
  TYPE_OPTIONS.forEach((label, i) => {
    const col = colLetter(2 + i);                              // C, D, E …
    const n = RELATION_OPTIONS_BY_TYPE[label].length;
    dn.push(`<definedName name="${xml(label)}">Lists!$${col}$2:$${col}$${1 + n}</definedName>`);
  });
  return `<definedNames>${dn.join("")}</definedNames>`;
}
function workbook() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<workbook xmlns="${MAIN}" xmlns:r="${REL}"><sheets>` +
    `<sheet name="Contacts" sheetId="1" r:id="rId1"/>` +
    `<sheet name="Instructions" sheetId="2" r:id="rId2"/>` +
    `<sheet name="Lists" sheetId="3" state="hidden" r:id="rId3"/>` +
    `</sheets>${definedNames()}</workbook>`;
}
function workbookRels() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Relationships xmlns="${PKGREL}">` +
    `<Relationship Id="rId1" Type="${REL}/worksheet" Target="worksheets/sheet1.xml"/>` +
    `<Relationship Id="rId2" Type="${REL}/worksheet" Target="worksheets/sheet2.xml"/>` +
    `<Relationship Id="rId3" Type="${REL}/worksheet" Target="worksheets/sheet3.xml"/>` +
    `<Relationship Id="rId4" Type="${REL}/styles" Target="styles.xml"/>` +
    `</Relationships>`;
}
// Neutral, account-free document properties (no author/tenant/email/organization identity).
function coreProps(kind) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<cp:coreProperties xmlns:cp="${CORE_NS}" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">` +
    `<dc:creator>Greet-Me</dc:creator>` +
    `<cp:lastModifiedBy>Greet-Me</cp:lastModifiedBy>` +
    `<dc:title>${xml(templateTitle(kind))}</dc:title>` +
    `<dc:description>Blank Greet-Me contact import template</dc:description>` +
    `</cp:coreProperties>`;
}
function appProps() {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<Properties xmlns="${EXT_NS}" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">` +
    `<Application>Greet-Me</Application><Company>Greet-Me</Company>` +
    `<DocSecurity>0</DocSecurity><ScaleCrop>false</ScaleCrop><LinksUpToDate>false</LinksUpToDate>` +
    `<SharedDoc>false</SharedDoc><HyperlinksChanged>false</HyperlinksChanged>` +
    `</Properties>`;
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
// The three list validations over the blank working range. Type + Description are static named ranges;
// Relation depends on the row's Type cell via INDIRECT (no macro, no external/network dependency).
function dataValidations(kind) {
  const t = colLetter(colIndex(kind, "Type"));
  const r = colLetter(colIndex(kind, "Relation"));
  const d = colLetter(colIndex(kind, "Description"));
  const dv = (col, f1) => `<dataValidation type="list" allowBlank="1" showInputMessage="1" showErrorMessage="1" sqref="${col}2:${col}${DATA_ROWS}"><formula1>${f1}</formula1></dataValidation>`;
  return `<dataValidations count="3">` +
    dv(t, "GmType") +
    dv(r, `INDIRECT($${t}2)`) +
    dv(d, "GmDesc") +
    `</dataValidations>`;
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
    dataValidations(kind) +
    `</worksheet>`;
}
function instructionsSheet(kind) {
  const blocks = templateInstructions(kind);
  const rows = [];
  let r = 1;
  for (const b of blocks) {
    rows.push(`<row r="${r}" ht="18" customHeight="1">${cell(`A${r}`, 3, b.heading)}</row>`); r += 1;
    for (const line of b.lines) { rows.push(`<row r="${r}">${cell(`A${r}`, 0, line)}</row>`); r += 1; }
    rows.push(`<row r="${r}"></row>`); r += 1;
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
// Hidden Lists sheet: A=Type options, B=Description options, C…=relation options per Type (in TYPE order).
function listsSheet() {
  const columns = [
    { head: "Type", values: TYPE_OPTIONS },
    { head: "Description", values: DESCRIPTION_OPTIONS },
    ...TYPE_OPTIONS.map((label) => ({ head: label, values: RELATION_OPTIONS_BY_TYPE[label] })),
  ];
  const maxRows = 1 + Math.max(...columns.map((c) => c.values.length));
  const rows = [];
  for (let r = 1; r <= maxRows; r++) {
    const cells = columns.map((c, ci) => {
      const text = r === 1 ? c.head : c.values[r - 2];
      return text == null ? "" : cell(`${colLetter(ci)}${r}`, r === 1 ? 3 : 0, text);
    }).join("");
    rows.push(`<row r="${r}">${cells}</row>`);
  }
  const last = colLetter(columns.length - 1);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<worksheet xmlns="${MAIN}" xmlns:r="${REL}">` +
    `<dimension ref="A1:${last}${maxRows}"/>` +
    `<sheetViews><sheetView workbookViewId="0"/></sheetViews>` +
    `<sheetFormatPr defaultRowHeight="15"/>` +
    `<sheetData>${rows.join("")}</sheetData>` +
    `</worksheet>`;
}

// The ordered set of package parts (name → UTF-8 xml text). Exported for structural testing.
export function buildXlsxParts(kind) {
  return {
    "[Content_Types].xml": contentTypes(),
    "_rels/.rels": rootRels(),
    "docProps/core.xml": coreProps(kind),
    "docProps/app.xml": appProps(),
    "xl/workbook.xml": workbook(),
    "xl/_rels/workbook.xml.rels": workbookRels(),
    "xl/styles.xml": styles(),
    "xl/worksheets/sheet1.xml": contactsSheet(kind),
    "xl/worksheets/sheet2.xml": instructionsSheet(kind),
    "xl/worksheets/sheet3.xml": listsSheet(),
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
  const total = chunks.reduce((a, b) => a + b.length, 0);
  const out = new Uint8Array(total);
  let p = 0;
  for (const b of chunks) { out.set(b, p); p += b.length; }
  return out;
}

export function templateXlsx(kind) { return zipStore(buildXlsxParts(kind)); }
export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export { isBusinessTemplateKind, templateHeaders };
