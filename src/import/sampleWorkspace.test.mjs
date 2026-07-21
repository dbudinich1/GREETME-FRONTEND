// src/import/sampleWorkspace.test.mjs — Run: node --test src/import/sampleWorkspace.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SAMPLE_DATASET, sampleColumnsFor, sampleCsvFor, sampleContactsFor,
  reconcileSampleRaw, serializeSample, sessionDiscriminator, resolvePracticeView,
  detectPracticeCsv, stripPracticeMarker, PRACTICE_MARKER_HEADER, PRACTICE_MARKER_VALUE,
} from "./sampleWorkspace.js";

// ---- Practice CSV marker contract + Sample surnames ----
const KINDS6 = ["family", "friend", "professional", "employee", "client", "vendor"];
test("every generated Practice CSV carries 'Greet-Me Practice File = practice-v2' and Sample surnames", () => {
  assert.equal(PRACTICE_MARKER_HEADER, "Greet-Me Practice File");
  assert.equal(PRACTICE_MARKER_VALUE, "practice-v2");
  for (const kind of KINDS6) {
    const lines = sampleCsvFor(kind).replace(/\r/g, "").split("\n").filter(Boolean);
    const headers = lines[0].split(",");
    assert.ok(headers.includes(PRACTICE_MARKER_HEADER), `${kind}: marker header present`);
    assert.equal(headers[headers.length - 1], PRACTICE_MARKER_HEADER, `${kind}: marker is the last column`);
    for (const row of lines.slice(1)) {
      assert.ok(row.endsWith(PRACTICE_MARKER_VALUE), `${kind}: every row carries the marker value`);
      assert.match(row.split(",")[0], / Sample$/, `${kind}: every contact surname is Sample`);
    }
    // the fictional contacts themselves also use the Sample surname on reserved domains
    for (const c of sampleContactsFor(kind)) { assert.match(c.fullName, / Sample$/); assert.match(c.email, /@example\.(com|org|net)$/); }
  }
});
test("detectPracticeCsv: authoritative marker (marked+valid / conflicting=invalid / unmarked / Sample-surname decoy)", () => {
  const F = ["Name", "Email", PRACTICE_MARKER_HEADER];
  assert.deepEqual(detectPracticeCsv(F, [{ Name: "Robin Sample", Email: "r@example.com", [PRACTICE_MARKER_HEADER]: "practice-v2" }]), { marked: true, valid: true });
  assert.deepEqual(detectPracticeCsv(F, [{ Name: "Robin Sample", [PRACTICE_MARKER_HEADER]: "practice-v9" }]), { marked: true, valid: false });   // conflicting → invalid (fail closed)
  assert.deepEqual(detectPracticeCsv(F, [{ Name: "Robin Sample", [PRACTICE_MARKER_HEADER]: "" }]), { marked: true, valid: false });             // marker column but no value → invalid
  assert.equal(detectPracticeCsv(["Name", "Email"], [{ Name: "x", Email: "x@x.co" }]).marked, false);                                            // no marker → not practice
  // an ORDINARY user CSV where a genuine person's surname is Sample is NOT classified as practice
  assert.equal(detectPracticeCsv(["Name", "Email"], [{ Name: "Real Sample", Email: "real@gmail.com" }]).marked, false);
});
test("stripPracticeMarker removes the marker column (never a contact field / payload value)", () => {
  const { fields, rows } = stripPracticeMarker(["Name", "Email", PRACTICE_MARKER_HEADER], [{ Name: "Robin Sample", Email: "r@example.com", [PRACTICE_MARKER_HEADER]: "practice-v2" }]);
  assert.deepEqual(fields, ["Name", "Email"]);
  assert.equal(PRACTICE_MARKER_HEADER in rows[0], false);
  assert.equal(rows[0].Name, "Robin Sample");
});
test("detection is filename-independent (marker lives in parsed contents, not the name)", () => {
  // whatever the file is called, the parsed marker column drives the decision
  assert.equal(detectPracticeCsv(["Name", PRACTICE_MARKER_HEADER], [{ Name: "Casey Sample", [PRACTICE_MARKER_HEADER]: "practice-v2" }]).valid, true);
});

// ---- Recipients Practice View fail-closed resolver ----
const SID = "u:USER_A:1000";
const wsWith = (contacts, sid = SID) => serializeSample(contacts, sid, "individual");
test("practice view: valid matching workspace with contacts → active", () => {
  const r = resolvePracticeView(wsWith([{ name: "Ada", email: "ada@example.com" }]), SID);
  assert.equal(r.status, "active");
  assert.equal(r.contacts.length, 1);
});
test("practice view: valid matching workspace with zero contacts → empty", () => {
  assert.equal(resolvePracticeView(wsWith([]), SID).status, "empty");
});
test("practice view: no workspace → none (marker ignored, normal Recipients)", () => {
  assert.equal(resolvePracticeView(null, SID).status, "none");
  assert.equal(resolvePracticeView("", SID).status, "none");
});
test("practice view: different user subject → cleared (fail closed)", () => {
  assert.equal(resolvePracticeView(wsWith([{ email: "a@example.com" }], "u:USER_A:1000"), "u:USER_B:1000").status, "cleared");
});
test("practice view: different issued-at session → cleared", () => {
  assert.equal(resolvePracticeView(wsWith([{ email: "a@example.com" }], "u:USER_A:1000"), "u:USER_A:2000").status, "cleared");
});
test("practice view: anonymous session → cleared (never renders an authenticated sample under anon)", () => {
  assert.equal(resolvePracticeView(wsWith([{ email: "a@example.com" }], "u:USER_A:1000"), "anon").status, "cleared");
});
test("practice view: malformed storage → cleared", () => {
  assert.equal(resolvePracticeView("{not json", SID).status, "cleared");
  assert.equal(resolvePracticeView(JSON.stringify({ nope: 1 }), SID).status, "cleared");
});
test("practice view: resolver never stores a token or token-derived secret", () => {
  const raw = wsWith([{ email: "a@example.com" }]);
  assert.ok(!/token/i.test(raw), "no token substring in the workspace");
  const p = JSON.parse(raw);
  assert.equal(p.sid, SID); assert.equal("token" in p, false);
});

test("sample templates are appropriate to the selected path", () => {
  // Universal List ("mixed") carries a Recipient Type column; single-type/individual do not.
  assert.ok(sampleColumnsFor("mixed").includes("Recipient Type"));
  assert.ok(!sampleColumnsFor("employee").includes("Recipient Type"));
  assert.ok(!sampleColumnsFor("individual").includes("Recipient Type"));
  // each path maps to its own fictional dataset (reserved example domains) — incl. the three Personal
  // categories (family/friend/professional), which carry NO relationship/recipientType (path = context)
  for (const kind of ["individual", "family", "friend", "professional", "employee", "client", "vendor", "mixed"]) {
    const csv = sampleCsvFor(kind);
    assert.ok(csv.startsWith("Name,Email"), kind);
    assert.ok(/@example\.(com|org|net)/.test(csv), `${kind} uses reserved demo domains`);
    assert.ok(sampleContactsFor(kind).length > 0);
    assert.ok(sampleContactsFor(kind).every((c) => c.demo === true), `${kind} contacts are demo-tagged`);
  }
  // Personal-category practice sets never invent a relationship classification or a recipientType.
  for (const kind of ["family", "friend", "professional"]) {
    assert.ok(!sampleColumnsFor(kind).includes("Recipient Type"), `${kind} has no type column`);
    assert.ok(sampleContactsFor(kind).every((c) => !c.recipientType && !c.relationship), `${kind} persists no relationship/type`);
  }
  assert.deepEqual(Object.keys(SAMPLE_DATASET).sort(),
    ["client", "employee", "family", "friend", "individual", "mixed", "professional", "vendor"]);
});

test("session isolation: same discriminator restores; different user / new login / anon never restores", () => {
  const sidA = "u:USER_A:1000";                                   // non-secret: user id + issued-at
  const raw = serializeSample([{ email: "a@example.com" }], sidA);
  assert.deepEqual(reconcileSampleRaw(raw, sidA), { contacts: [{ email: "a@example.com" }], cleared: false }); // same session
  assert.deepEqual(reconcileSampleRaw(raw, "u:USER_B:1000"), { contacts: [], cleared: true });  // different user
  assert.deepEqual(reconcileSampleRaw(raw, "u:USER_A:2000"), { contacts: [], cleared: true });  // new login (new iat)
  assert.deepEqual(reconcileSampleRaw(raw, "anon"), { contacts: [], cleared: true });           // logged-out state
});

test("sessionDiscriminator returns 'anon' with no JWT (Node has no localStorage)", () => {
  assert.equal(sessionDiscriminator(), "anon");
});

test("corrupt / missing / malformed storage never leaks a sample", () => {
  assert.deepEqual(reconcileSampleRaw(null, "T"), { contacts: [], cleared: false });     // nothing stored
  assert.deepEqual(reconcileSampleRaw("", "T"), { contacts: [], cleared: false });
  assert.equal(reconcileSampleRaw("{not json", "T").cleared, true);                      // corrupt → cleared
  assert.equal(reconcileSampleRaw(JSON.stringify({ token: "T" }), "T").cleared, true);   // no contacts array
  assert.equal(reconcileSampleRaw(JSON.stringify({ token: "T", contacts: "x" }), "T").cleared, true);
});

test("serialized workspace stores the non-secret discriminator ONLY — never a token", () => {
  const s = serializeSample([{ email: "b@example.org" }], "u:USER_A:1000");
  const p = JSON.parse(s);
  assert.equal(p.sid, "u:USER_A:1000");
  assert.equal("token" in p, false);                            // no token field
  assert.ok(!/token/i.test(s), "no 'token' substring anywhere in the serialized payload");
  assert.deepEqual(p.contacts, [{ email: "b@example.org" }]);
});
