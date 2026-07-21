// src/import/template.test.mjs — Run: node --test src/import/template.test.mjs
// Blank import templates: 15 canonical columns (Type/Relation/Description; NO Phone, NO Recipient Type)
// + dependency-free XLSX with three list dropdowns and account-neutral metadata. Validates the ACTUAL
// .xlsx bytes by unzipping them (store method), so a corrupt/formula/macro/private-metadata file fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEMPLATE_KINDS, templateHeaders, templateCsv, templateFileBase, templateTitle,
  TYPE_OPTIONS, DESCRIPTION_OPTIONS, RELATION_OPTIONS_BY_TYPE,
} from "./templateModel.js";
import { templateXlsx, buildXlsxParts } from "./xlsxTemplate.js";
import { autoMapHeaders, processRow } from "./importCore.js";
import { RELATIONS_BY_CATEGORY } from "./completionModel.js";

const FINAL_HEADERS = [
  "Name", "Email", "Type", "Relation", "Description", "Birthday", "Company", "Department",
  "Address Line 1", "Address Line 2", "City", "State/Province", "Postal/ZIP Code", "Country", "Notes",
];
const esc = (s) => s.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");

// ---- minimal STORE-zip reader (central directory → local files, verifies CRC) ----
const dv = (b) => new DataView(b.buffer, b.byteOffset, b.byteLength);
const CRC_TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); t[n] = c >>> 0; } return t; })();
function crc32(bytes) { let c = 0xFFFFFFFF; for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; }
function unzip(bytes) {
  const d = dv(bytes);
  let eocd = bytes.length - 22;
  while (eocd >= 0 && d.getUint32(eocd, true) !== 0x06054b50) eocd -= 1;
  assert.ok(eocd >= 0, "EOCD record present (valid zip)");
  const count = d.getUint16(eocd + 10, true);
  let cd = d.getUint32(eocd + 16, true);
  const files = {};
  for (let i = 0; i < count; i++) {
    assert.equal(d.getUint32(cd, true), 0x02014b50, "central dir signature");
    const nameLen = d.getUint16(cd + 28, true), extraLen = d.getUint16(cd + 30, true), commentLen = d.getUint16(cd + 32, true);
    const lho = d.getUint32(cd + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cd + 46, cd + 46 + nameLen));
    const lNameLen = d.getUint16(lho + 26, true), lExtraLen = d.getUint16(lho + 28, true);
    const size = d.getUint32(lho + 18, true);
    const start = lho + 30 + lNameLen + lExtraLen;
    const data = bytes.subarray(start, start + size);
    assert.equal(crc32(data) >>> 0, d.getUint32(lho + 14, true) >>> 0, `CRC ok for ${name}`);
    files[name] = new TextDecoder().decode(data);
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

// 1/2/3/4 — exactly the final 15 headers; Phone + Recipient Type absent; Type/Relation/Description once
test("every template has exactly the final 15 headers (no Phone, no Recipient Type)", () => {
  for (const k of TEMPLATE_KINDS) {
    assert.deepEqual(templateHeaders(k), FINAL_HEADERS, `${k} headers`);
    assert.ok(!templateHeaders(k).includes("Phone"), `${k}: no Phone`);
    assert.ok(!templateHeaders(k).includes("Recipient Type"), `${k}: no Recipient Type`);
    assert.ok(!templateHeaders(k).includes("Relationship Group"), `${k}: no Relationship Group`);
    assert.ok(!templateHeaders(k).includes("Closeness"), `${k}: no Closeness`);
    for (const h of ["Type", "Relation", "Description"]) assert.equal(templateHeaders(k).filter((x) => x === h).length, 1, `${k}: ${h} once`);
  }
});

// 5/6/7 — Type→relationshipCategory, Relation→relationship, Description→relationshipCloseness
test("Type/Relation/Description map to relationshipCategory/relationship/relationshipCloseness on import", () => {
  const { mapping, unmapped } = autoMapHeaders(FINAL_HEADERS);
  assert.deepEqual(unmapped, [], "every header auto-maps with zero unmapped columns");
  assert.equal(mapping.relationshipCategory, "Type");
  assert.equal(mapping.relationship, "Relation");
  assert.equal(mapping.relationshipCloseness, "Description");
  const raw = Object.fromEntries(FINAL_HEADERS.map((h) => [h, ""]));
  raw.Name = "Robin"; raw.Email = "robin@example.com"; raw.Type = "Family"; raw.Relation = "Family Member"; raw.Description = "Greet-Me Worthy";
  const { contact } = processRow(raw, mapping, {});
  assert.equal(contact.relationshipCategory, "Family");
  assert.equal(contact.relationship, "Family Member");
  assert.equal(contact.relationshipCloseness, "Greet-Me Worthy");
});

// 11 — every header auto-maps (Personal + Business identical)
test("all headers auto-map with zero unmapped for all six kinds", () => {
  for (const k of TEMPLATE_KINDS) assert.deepEqual(autoMapHeaders(templateHeaders(k)).unmapped, [], `${k}`);
});

// 8/12/13 — XLSX has exactly THREE list dropdowns over rows 2–5000 with canonical values
test("XLSX has three list dropdowns (Type, dependent Relation, Description) over rows 2–5000", () => {
  for (const k of TEMPLATE_KINDS) {
    const files = unzip(templateXlsx(k));
    const sheet = files["xl/worksheets/sheet1.xml"];
    const dvs = [...sheet.matchAll(/<dataValidation type="list"[^>]*sqref="([A-Z]+2:[A-Z]+5000)"><formula1>([^<]+)<\/formula1><\/dataValidation>/g)];
    assert.equal(dvs.length, 3, `${k}: exactly three list validations`);
    const byFormula = Object.fromEntries(dvs.map((m) => [m[2], m[1]]));
    assert.ok(byFormula.GmType && byFormula.GmType.startsWith("C2:"), `${k}: Type dropdown on column C`);
    assert.ok(byFormula.GmDesc && byFormula.GmDesc.startsWith("E2:"), `${k}: Description dropdown on column E`);
    assert.ok(byFormula["INDIRECT($C2)"] && byFormula["INDIRECT($C2)"].startsWith("D2:"), `${k}: dependent Relation (INDIRECT) on column D`);
    const wb = files["xl/workbook.xml"];
    for (const n of ["GmType", "GmDesc", "Family", "Friend", "Professional"]) assert.match(wb, new RegExp(`<definedName name="${n}">Lists!`), `${k}: named range ${n}`);
    const lists = files["xl/worksheets/sheet3.xml"];
    for (const v of [...TYPE_OPTIONS, ...DESCRIPTION_OPTIONS, "Family Member"]) assert.ok(lists.includes(v), `${k}: Lists has "${v}"`);
  }
});

// 14/15/16/18 — dropdown taxonomy is canonical + group-specific; Family Member under Family only
test("dropdown option lists are the canonical taxonomy (Type/Relation/Description)", () => {
  assert.deepEqual(TYPE_OPTIONS, ["Family", "Friend", "Professional"]);
  assert.deepEqual(DESCRIPTION_OPTIONS, ["Inner Circle", "Greet-Me Worthy", "You Gotta Do What Ya Gotta Do"]);
  for (const [label, cat] of [["Family", "family"], ["Friend", "friend"], ["Professional", "professional"]]) {
    assert.deepEqual(RELATION_OPTIONS_BY_TYPE[label], RELATIONS_BY_CATEGORY[cat].map((r) => r.label), `${label} relations`);
  }
  assert.ok(RELATION_OPTIONS_BY_TYPE.Family.includes("Family Member"), "Family includes Family Member");
  assert.ok(RELATION_OPTIONS_BY_TYPE.Friend.includes("Acquaintance"));
  for (const v of ["Colleague", "Employee", "Client", "Vendor"]) assert.ok(RELATION_OPTIONS_BY_TYPE.Professional.includes(v));
  for (const g of ["Friend", "Professional"]) assert.ok(!RELATION_OPTIONS_BY_TYPE[g].includes("Family Member"));
});

// 17 — loved_one absent from every generated part
test("loved_one is absent from every generated XLSX part and every CSV", () => {
  for (const k of TEMPLATE_KINDS) {
    assert.ok(!/loved_one/i.test(Object.values(buildXlsxParts(k)).join("\n")), `${k}: no loved_one in XLSX`);
    assert.ok(!/loved_one/i.test(templateCsv(k)), `${k}: no loved_one in CSV`);
  }
});

// 19/20 — header-only (no fake rows); correct category filename + title
test("XLSX Contacts sheet is header-only (no fake contact rows); correct filename + title", () => {
  for (const k of TEMPLATE_KINDS) {
    const files = unzip(templateXlsx(k));
    const rows = files["xl/worksheets/sheet1.xml"].match(/<row\b[^>]*\br="(\d+)"/g) || [];
    assert.equal(rows.length, 1, `${k}: only the header row on Contacts`);
    const headers = [...files["xl/worksheets/sheet1.xml"].matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]);
    assert.deepEqual(headers, FINAL_HEADERS, `${k}: XLSX headers`);
    assert.equal(templateFileBase(k), `greetme-${k}-contacts-template-v2`);   // V2 filename
    assert.match(files["docProps/core.xml"], new RegExp(`<dc:title>${esc(templateTitle(k))}</dc:title>`));
    assert.match(files["docProps/core.xml"], /<cp:version>2<\/cp:version>/);   // version in neutral metadata
    assert.match(files["xl/worksheets/sheet2.xml"], new RegExp(esc(templateTitle(k))));   // Instructions carries the title
    assert.match(files["xl/worksheets/sheet2.xml"], /Template version: 2/);    // version visible on Instructions
    assert.match(files["xl/worksheets/sheet2.xml"], /The Relation dropdown will remain unavailable or empty until Type is selected/);   // dropdown guidance
  }
});

// 22 — CSV header-only, no dropdown claim
test("CSV templates are header-only (15 cols) and never claim dropdowns/formatting", () => {
  for (const k of TEMPLATE_KINDS) {
    const csv = templateCsv(k);
    const lines = csv.replace(/\r/g, "").split("\n").filter(Boolean);
    assert.equal(lines.length, 1, `${k}: header row only`);
    assert.deepEqual(lines[0].split(","), FINAL_HEADERS);
    assert.ok(csv.endsWith("\r\n"));
  }
});

// 23 — no macros / formulas / external links / connections
test("XLSX contains no macros, cell formulas, external links, or data connections", () => {
  for (const k of TEMPLATE_KINDS) {
    const all = Object.values(buildXlsxParts(k)).join("\n");
    assert.ok(!/<f>|<f /.test(all), `${k}: no cell formula`);
    assert.ok(!/vbaProject|macroEnabled|xlsm|\.bin/.test(all), `${k}: no macros`);
    assert.ok(!/externalLink|externalReference|<connection|<queryTable|customXml/i.test(all), `${k}: no external links/connections/PowerQuery`);
    assert.ok(!/<hyperlinks>|<hyperlink /i.test(all), `${k}: no hyperlink elements`);   // (not the standard HyperlinksChanged app-property)
  }
});

// Account-neutral metadata scan (Part 7) — real byte inspection of every part
test("generated workbook is account-neutral (no author/tenant/org/OneDrive/SharePoint identity)", () => {
  const FORBIDDEN = [/NJ Mediation/i, /onedrive/i, /sharepoint/i, /@[a-z0-9.-]+\.(com|org|net|gov)/i, /tenant/i, /externalLink/i, /<connection/i, /mailto:/i, /[A-Za-z]:\\Users\\/];
  for (const k of TEMPLATE_KINDS) {
    const files = unzip(templateXlsx(k));
    for (const [name, content] of Object.entries(files)) {
      for (const re of FORBIDDEN) assert.ok(!re.test(content), `${k}/${name}: forbidden pattern ${re}`);
    }
    assert.match(files["docProps/core.xml"], /<dc:creator>Greet-Me<\/dc:creator>/);
    assert.match(files["docProps/app.xml"], /<Company>Greet-Me<\/Company>/);
  }
});

// address mapping preserved; personal recipientType stays ""
test("address headers still map to canonical shippingAddress; no Recipient Type column → recipientType ''", () => {
  const { mapping } = autoMapHeaders(FINAL_HEADERS);
  const raw = Object.fromEntries(FINAL_HEADERS.map((h) => [h, ""]));
  raw.Name = "A"; raw.Email = "a@example.com"; raw["Address Line 1"] = "1 Main St"; raw.City = "Reno"; raw.Country = "USA";
  const { contact } = processRow(raw, mapping, {});
  assert.deepEqual(contact.shippingAddress, { line1: "1 Main St", line2: "", city: "Reno", state: "", zip: "", country: "USA" });
  assert.equal(contact.recipientType, "");
});

// blank production templates must NOT carry the Practice-CSV marker (that's Practice-CSV-only)
test("blank production templates never contain the Greet-Me Practice File marker column", () => {
  for (const k of TEMPLATE_KINDS) {
    assert.ok(!templateHeaders(k).includes("Greet-Me Practice File"), `${k}: no practice marker in blank template`);
    assert.ok(!/Greet-Me Practice File|practice-v2/.test(templateCsv(k)), `${k}: no practice marker in blank CSV`);
    assert.ok(!/Greet-Me Practice File|practice-v2/.test(Object.values(buildXlsxParts(k)).join("\n")), `${k}: no practice marker in XLSX`);
  }
});
