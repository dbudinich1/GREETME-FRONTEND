// src/import/sampleWorkspace.test.mjs — Run: node --test src/import/sampleWorkspace.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  SAMPLE_DATASET, sampleColumnsFor, sampleCsvFor, sampleContactsFor,
  reconcileSampleRaw, serializeSample, sessionDiscriminator,
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
