// src/import/template.test.mjs — Run: node --test src/import/template.test.mjs
// Blank import templates: CSV + dependency-free XLSX. Validates the ACTUAL .xlsx bytes by unzipping
// them (store method) and asserting structure, so a corrupt/collapsed/formula-bearing file fails.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TEMPLATE_KINDS, templateHeaders, templateCsv, templateColumns, templateFileBase,
  isBusinessTemplateKind, CONTROLLED, templateInstructions,
} from "./templateModel.js";
import { templateXlsx, buildXlsxParts } from "./xlsxTemplate.js";
import { autoMapHeaders, processRow } from "./importCore.js";

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
    assert.equal(d.getUint32(lho, true), 0x04034b50, "local header signature");
    const lNameLen = d.getUint16(lho + 26, true), lExtraLen = d.getUint16(lho + 28, true);
    const size = d.getUint32(lho + 18, true);                       // compressed == uncompressed (store)
    const start = lho + 30 + lNameLen + lExtraLen;
    const data = bytes.subarray(start, start + size);
    assert.equal(crc32(data) >>> 0, d.getUint32(lho + 14, true) >>> 0, `CRC ok for ${name}`);
    files[name] = new TextDecoder().decode(data);
    cd += 46 + nameLen + extraLen + commentLen;
  }
  return files;
}

const CANON_ADDRESS = ["Address Line 1", "Address Line 2", "City", "State/Province", "Postal/ZIP Code", "Country"];

// 18 — six of each are available
test("six CSV + six XLSX templates are available for all canonical kinds", () => {
  assert.deepEqual(TEMPLATE_KINDS, ["family", "friend", "professional", "employee", "client", "vendor"]);
  for (const k of TEMPLATE_KINDS) {
    assert.ok(templateCsv(k).length > 0, `${k} csv`);
    const xlsx = templateXlsx(k);
    assert.ok(xlsx instanceof Uint8Array && xlsx.length > 500, `${k} xlsx bytes`);
    assert.equal(templateFileBase(k), `greetme-${k}-contacts-template`);
  }
});

// 19 — CSV: exact canonical headers, zero contact rows
test("CSV templates have exact canonical headers and ZERO data rows", () => {
  for (const k of TEMPLATE_KINDS) {
    const csv = templateCsv(k);
    const lines = csv.replace(/\r/g, "").split("\n").filter(Boolean);
    assert.equal(lines.length, 1, `${k}: header row only`);
    assert.deepEqual(lines[0].split(","), templateHeaders(k));
    for (const a of CANON_ADDRESS) assert.ok(templateHeaders(k).includes(a), `${k} has ${a}`);
    assert.ok(csv.endsWith("\r\n"), "CRLF terminated");
  }
});

// 20 — XLSX: exact canonical headers, zero data rows
test("XLSX Contacts sheet has exact canonical headers and ZERO data rows", () => {
  for (const k of TEMPLATE_KINDS) {
    const files = unzip(templateXlsx(k));
    const sheet = files["xl/worksheets/sheet1.xml"];
    assert.ok(sheet, `${k} sheet1 present`);
    const rows = sheet.match(/<row\b[^>]*\br="(\d+)"/g) || [];
    assert.equal(rows.length, 1, `${k}: only the header row (no data rows)`);
    const headers = [...sheet.matchAll(/<t[^>]*>([^<]*)<\/t>/g)].map((m) => m[1]);
    assert.deepEqual(headers, templateHeaders(k), `${k} XLSX headers`);
  }
});

// 21 — widths non-collapsed / readable
test("XLSX columns have readable, non-collapsed widths (no hidden columns)", () => {
  for (const k of TEMPLATE_KINDS) {
    const sheet = unzip(templateXlsx(k))["xl/worksheets/sheet1.xml"];
    const cols = [...sheet.matchAll(/<col [^>]*width="([\d.]+)"[^>]*\/>/g)].map((m) => parseFloat(m[1]));
    assert.equal(cols.length, templateColumns(k).length, `${k}: a width per column`);
    for (const w of cols) assert.ok(w >= 12, `width ${w} readable`);
    assert.ok(!/hidden="1"/.test(sheet), "no hidden columns");
    assert.ok(!/customWidth="1"[^>]*width="0"/.test(sheet), "no zero-width columns");
  }
});

// 22 — frozen header + autofilter
test("XLSX header row is frozen and filterable", () => {
  for (const k of TEMPLATE_KINDS) {
    const sheet = unzip(templateXlsx(k))["xl/worksheets/sheet1.xml"];
    assert.match(sheet, /<pane [^>]*ySplit="1"[^>]*state="frozen"/, `${k} frozen header`);
    assert.match(sheet, /<autoFilter ref="A1:[A-Z]+1"\/>/, `${k} autofilter`);
  }
});

// 23 — date column formatting
test("XLSX Birthday column is date-formatted (numFmt present, applied to the column)", () => {
  for (const k of TEMPLATE_KINDS) {
    const files = unzip(templateXlsx(k));
    assert.match(files["xl/styles.xml"], /<numFmt numFmtId="164" formatCode="yyyy\\-mm\\-dd"\/>/);
    // Birthday column carries style="2" (the date xf)
    const cols = templateColumns(k);
    const birthdayIdx = cols.findIndex((c) => c.header === "Birthday");
    const n = birthdayIdx + 1;
    assert.match(files["xl/worksheets/sheet1.xml"], new RegExp(`<col min="${n}" max="${n}"[^>]*style="2"`), `${k} birthday date style`);
  }
});

// 24 — address columns map to canonical shippingAddress via importCore
test("address template headers map to canonical shippingAddress fields on import", () => {
  const kind = "vendor";
  const headers = templateHeaders(kind);
  const { mapping, unmapped } = autoMapHeaders(headers);
  assert.deepEqual(unmapped, [], `every template header is recognized (${kind})`);
  // build a row with an address and confirm it lands in contact.shippingAddress { line1..country }
  const raw = Object.fromEntries(headers.map((h) => [h, ""]));
  raw["Name"] = "Acme"; raw["Email"] = "acme@example.com";
  raw["Address Line 1"] = "1 Main St"; raw["Address Line 2"] = "Suite 2"; raw["City"] = "Springfield";
  raw["State/Province"] = "IL"; raw["Postal/ZIP Code"] = "62704"; raw["Country"] = "USA";
  const { contact } = processRow(raw, mapping, {});
  assert.deepEqual(contact.shippingAddress, { line1: "1 Main St", line2: "Suite 2", city: "Springfield", state: "IL", zip: "62704", country: "USA" });
});

// 25/26 — personal vs business recipientType columns
test("Personal templates omit Recipient Type; Business templates permit only employee/client/vendor", () => {
  for (const k of ["family", "friend", "professional"]) assert.ok(!templateHeaders(k).includes("Recipient Type"), `${k} has no Recipient Type column`);
  for (const k of ["employee", "client", "vendor"]) assert.ok(templateHeaders(k).includes("Recipient Type"), `${k} has Recipient Type column`);
  assert.deepEqual(CONTROLLED.recipientType, ["employee", "client", "vendor"]);
});

// 28 — blank address does not block import
test("a blank address never blocks import (Name+Email suffices, no shippingAddress emitted)", () => {
  const headers = templateHeaders("family");
  const { mapping } = autoMapHeaders(headers);
  const raw = Object.fromEntries(headers.map((h) => [h, ""]));
  raw["Name"] = "Robin"; raw["Email"] = "robin@example.com";
  const { contact, valid } = processRow(raw, mapping, {});
  assert.equal(valid, true);
  assert.equal("shippingAddress" in contact, false, "no shippingAddress key when address is blank");
});

// 30 — no formulas / macros / external links / formula-prefix headers
test("templates contain NO formula, macro, or external-link injection", () => {
  for (const k of TEMPLATE_KINDS) {
    const parts = buildXlsxParts(k);
    const all = Object.values(parts).join("\n");
    assert.ok(!/<f>/.test(all) && !/<f /.test(all), `${k}: no formula elements`);
    assert.ok(!/vbaProject|macroEnabled|xlsm/.test(all), `${k}: no macros`);
    assert.ok(!/externalLink|externalReference|<hyperlink/.test(all), `${k}: no external links`);
    // no header begins with a formula-trigger character
    for (const h of templateHeaders(k)) assert.ok(!/^[=+\-@]/.test(h), `${k}: header '${h}' not a formula trigger`);
    // CSV likewise has no formula-trigger cell
    assert.ok(!/^[=+\-@]/m.test(templateCsv(k).replace(/^"?/, "")), `${k}: CSV no formula trigger`);
    // instructions carry the required guidance
    const instr = templateInstructions(k).flatMap((b) => [b.heading, ...b.lines]).join(" ");
    assert.match(instr, /Name and Email are required/);
    assert.match(instr, /shipping address/i);
    assert.match(instr, /never arranges, schedules, or pays for a gift/);
  }
});
