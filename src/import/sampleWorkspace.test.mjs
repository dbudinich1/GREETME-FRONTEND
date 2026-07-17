// src/import/sampleWorkspace.test.mjs — Run: node --test src/import/sampleWorkspace.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SAMPLE_DATASET, sampleColumnsFor, sampleCsvFor, sampleContactsFor,
  reconcileSampleRaw, serializeSample,
} from "./sampleWorkspace.js";

test("sample templates are appropriate to the selected path", () => {
  // Universal List ("mixed") carries a Recipient Type column; single-type/individual do not.
  assert.ok(sampleColumnsFor("mixed").includes("Recipient Type"));
  assert.ok(!sampleColumnsFor("employee").includes("Recipient Type"));
  assert.ok(!sampleColumnsFor("individual").includes("Recipient Type"));
  // each path maps to its own fictional dataset (reserved example domains)
  for (const kind of ["individual", "employee", "client", "vendor", "mixed"]) {
    const csv = sampleCsvFor(kind);
    assert.ok(csv.startsWith("Name,Email"), kind);
    assert.ok(/@example\.(com|org|net)/.test(csv), `${kind} uses reserved demo domains`);
    assert.ok(sampleContactsFor(kind).length > 0);
    assert.ok(sampleContactsFor(kind).every((c) => c.demo === true), `${kind} contacts are demo-tagged`);
  }
  assert.deepEqual(Object.keys(SAMPLE_DATASET).sort(), ["client", "employee", "individual", "mixed", "vendor"]);
});

test("session isolation: same token restores; different/new token never restores (cleared)", () => {
  const raw = serializeSample([{ email: "a@example.com" }], "TOKEN_A");
  // same session token → restored
  assert.deepEqual(reconcileSampleRaw(raw, "TOKEN_A"), { contacts: [{ email: "a@example.com" }], cleared: false });
  // new authenticated session (different token) → NOT restored, cleared
  assert.deepEqual(reconcileSampleRaw(raw, "TOKEN_B"), { contacts: [], cleared: true });
  // logged out (anon) → not restored
  assert.deepEqual(reconcileSampleRaw(raw, "anon"), { contacts: [], cleared: true });
});

test("corrupt / missing / malformed storage never leaks a sample", () => {
  assert.deepEqual(reconcileSampleRaw(null, "T"), { contacts: [], cleared: false });     // nothing stored
  assert.deepEqual(reconcileSampleRaw("", "T"), { contacts: [], cleared: false });
  assert.equal(reconcileSampleRaw("{not json", "T").cleared, true);                      // corrupt → cleared
  assert.equal(reconcileSampleRaw(JSON.stringify({ token: "T" }), "T").cleared, true);   // no contacts array
  assert.equal(reconcileSampleRaw(JSON.stringify({ token: "T", contacts: "x" }), "T").cleared, true);
});

test("serializeSample round-trips with the token tag", () => {
  const s = serializeSample([{ email: "b@example.org" }], "TK");
  const p = JSON.parse(s);
  assert.equal(p.token, "TK");
  assert.deepEqual(p.contacts, [{ email: "b@example.org" }]);
});
