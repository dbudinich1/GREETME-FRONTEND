// src/import/practiceWorkbook.test.mjs — Run: node --test src/import/practiceWorkbook.test.mjs
// Slice 2: the generated guided + practice .xlsx workbooks must pass the SHIPPED Slice 1 reader contract
// (round-trip), carry the exact taxonomy dropdowns, and be macro/link/connection-free. The generator uses
// a STORE-method zip (no compression), so the OOXML parts appear verbatim in the bytes — we assert on the
// raw workbook string (no unzip dependency) AND parse the real bytes with the deployed SheetJS reader.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  templateXlsx, templatePracticeXlsx, practiceFileBase,
  PRACTICE_MARKER_HEADER, PRACTICE_MARKER_VALUE,
} from "./xlsxTemplate.js";
import {
  sampleContactsFor, detectPracticeCsv, stripPracticeMarker,
  PRACTICE_MARKER_HEADER as WS_HEADER, PRACTICE_MARKER_VALUE as WS_VALUE,
} from "./sampleWorkspace.js";
import { readWorkbookBytes, selectSheet } from "./xlsxReader.js";
import { templateHeaders, TYPE_OPTIONS, DESCRIPTION_OPTIONS, RELATION_OPTIONS_BY_TYPE } from "./templateModel.js";

const KINDS = ["family", "friend", "professional", "employee", "client", "vendor"];
const raw = (bytes) => Buffer.from(bytes).toString("latin1");   // STORE zip → XML parts are verbatim

test("marker constants are the single source of truth (xlsxTemplate re-exports sampleWorkspace's)", () => {
  assert.equal(PRACTICE_MARKER_HEADER, WS_HEADER);
  assert.equal(PRACTICE_MARKER_VALUE, WS_VALUE);
  assert.equal(PRACTICE_MARKER_HEADER, "Greet-Me Practice File");
  assert.equal(PRACTICE_MARKER_VALUE, "practice-v2");
});

test("guided template: genuine .xlsx (PK zip) with Contacts+Instructions+Lists and 3 dropdowns", () => {
  const bytes = templateXlsx("family");
  assert.ok(bytes[0] === 0x50 && bytes[1] === 0x4b, "PK zip");
  const s = raw(bytes);
  assert.ok(s.includes("xl/worksheets/sheet1.xml") && s.includes("xl/worksheets/sheet2.xml") && s.includes("xl/worksheets/sheet3.xml"));
  assert.match(s, /<pane ySplit="1"[^>]*state="frozen"/);   // frozen header
  assert.match(s, /<autoFilter ref="A1:/);                  // filters
  assert.match(s, /<dataValidations count="3">/);           // three controlled fields
  assert.match(s, /<formula1>GmType<\/formula1>/);
  assert.match(s, /<formula1>INDIRECT\(\$C2\)<\/formula1>/);
  assert.match(s, /<formula1>GmDesc<\/formula1>/);
  assert.ok(!s.includes(PRACTICE_MARKER_HEADER), "blank template has NO practice marker");
});

test("dropdown value lists match the approved taxonomy exactly (no invented values)", () => {
  const s = raw(templateXlsx("family"));
  for (const v of TYPE_OPTIONS) assert.ok(s.includes(v), `Type option ${v}`);
  for (const v of DESCRIPTION_OPTIONS) assert.ok(s.includes(v), `Description option ${v}`);
  for (const label of TYPE_OPTIONS) for (const rel of RELATION_OPTIONS_BY_TYPE[label]) assert.ok(s.includes(rel), `Relation ${rel}`);
});

test("practice workbook: genuine .xlsx, same structure + dropdowns, Sample data, marker column (round-trip)", async () => {
  for (const kind of KINDS) {
    const bytes = templatePracticeXlsx(kind, { contacts: sampleContactsFor(kind), generatedUtc: "2026-07-21" });
    assert.ok(bytes[0] === 0x50 && bytes[1] === 0x4b, `${kind}: PK zip`);
    const s = raw(bytes);
    assert.match(s, /<dataValidations count="3">/, `${kind}: dropdowns present`);
    assert.ok(s.includes(PRACTICE_MARKER_HEADER) && s.includes(PRACTICE_MARKER_VALUE), `${kind}: marker present`);
    // round-trip through the SHIPPED reader
    const r = await readWorkbookBytes(bytes, `renamed-${kind}.xlsx`);   // filename-independent
    assert.equal(r.ok, true, `${kind}: reads ok`);
    assert.deepEqual(r.eligible.map((e) => e.name), ["Contacts"], `${kind}: Contacts only (Instructions/Lists excluded)`);
    assert.equal(r.needsSelection, false, `${kind}: standard workbook does NOT trigger the selector`);
    const sel = selectSheet(r, "Contacts");
    assert.deepEqual(sel.fields.slice(0, templateHeaders(kind).length), templateHeaders(kind), `${kind}: Template V2 columns`);
    assert.ok(sel.fields.includes(PRACTICE_MARKER_HEADER), `${kind}: marker column in parsed fields`);
    assert.deepEqual(detectPracticeCsv(sel.fields, sel.rows), { marked: true, valid: true }, `${kind}: detected as valid Practice`);
    for (const row of sel.rows) { assert.match(row.Name, / Sample$/, `${kind}: Sample surname`); assert.match(row.Email, /@example\.(com|org|net)$/, `${kind}: reserved domain`); }
    const stripped = stripPracticeMarker(sel.fields, sel.rows);
    assert.ok(!stripped.fields.includes(PRACTICE_MARKER_HEADER), `${kind}: marker stripped from contact fields`);
    assert.ok(stripped.rows.every((x) => !(PRACTICE_MARKER_HEADER in x)), `${kind}: marker not in contact objects`);
  }
});

test("filename-independent detection: any name stays practice; a filled GENUINE workbook is NOT practice", async () => {
  const practice = templatePracticeXlsx("family", { contacts: sampleContactsFor("family") });
  for (const name of ["contacts.xlsx", "totally-legit.xlsx", "spreadsheet1.xlsx"]) {
    const sel = selectSheet(await readWorkbookBytes(practice, name), "Contacts");
    assert.equal(detectPracticeCsv(sel.fields, sel.rows).valid, true, `${name}: still practice`);
  }
  // a genuine (filled) guided workbook — no marker — is production-eligible even with a Sample surname
  const genuine = templateXlsx("family", { dataRows: [{ Name: "Real Sample", Email: "real@gmail.com", Type: "Family" }] });
  const gsel = selectSheet(await readWorkbookBytes(genuine, "practice-lookalike.xlsx"), "Contacts");
  assert.equal(detectPracticeCsv(gsel.fields, gsel.rows).marked, false, "unmarked workbook with a Sample surname is NOT practice");
});

test("conflicting / empty / unsupported markers fail closed (never valid)", async () => {
  const bytes = templatePracticeXlsx("family", { contacts: sampleContactsFor("family") });
  const sel = selectSheet(await readWorkbookBytes(bytes, "p.xlsx"), "Contacts");
  assert.equal(detectPracticeCsv(sel.fields, sel.rows).valid, true);                                              // baseline valid
  const conflicting = sel.rows.map((r, i) => (i === 0 ? { ...r, [PRACTICE_MARKER_HEADER]: "practice-v9" } : r));   // unsupported version on one row
  assert.equal(detectPracticeCsv(sel.fields, conflicting).valid, false, "conflicting/unsupported version → fail closed");
  const empty = sel.rows.map((r) => ({ ...r, [PRACTICE_MARKER_HEADER]: "" }));
  assert.equal(detectPracticeCsv(sel.fields, empty).valid, false, "empty marker value → fail closed");
});

test("security: generated workbooks contain NO vba/macros/external-links/connections/embedded packages", () => {
  for (const kind of ["family", "employee"]) {
    for (const bytes of [templateXlsx(kind), templatePracticeXlsx(kind, { contacts: sampleContactsFor(kind) })]) {
      const s = raw(bytes);
      assert.ok(!/vbaProject\.bin/i.test(s), `${kind}: no vbaProject.bin`);
      assert.ok(!/externalLink/i.test(s), `${kind}: no externalLink part`);
      assert.ok(!/connections\.xml/i.test(s), `${kind}: no connections`);
      assert.ok(!/macroEnabled|vnd\.ms-office\.vbaProject/i.test(s), `${kind}: not macro-enabled`);
      assert.ok(!/oleObject|\/embeddings\//i.test(s), `${kind}: no embedded OLE objects`);
      // only the expected package parts are present
      assert.ok(!/\.(exe|bat|js|vbs|dll|scr)/i.test(s.match(/PK[\s\S]*/)?.[0] || ""), `${kind}: no executable entries`);
    }
  }
});

test("practice filename base is versioned and distinct from the blank template", () => {
  assert.equal(practiceFileBase("family"), "greetme-family-practice-workbook-v2");
  assert.equal(practiceFileBase("employee"), "greetme-employee-practice-workbook-v2");
});
