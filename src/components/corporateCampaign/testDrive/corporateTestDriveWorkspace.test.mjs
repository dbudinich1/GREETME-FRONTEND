// src/components/corporateCampaign/testDrive/corporateTestDriveWorkspace.test.mjs
// Run: node --test src/components/corporateCampaign/testDrive/corporateTestDriveWorkspace.test.mjs
//
// Mocks sessionStorage/localStorage as plain in-memory objects (sampleWorkspace.js reads them via
// globalThis, no DOM/jsdom needed) so this exercises the REAL saveSampleWorkspace/readPracticeView
// code path, not a stand-in.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";

function fakeStorage() {
  const store = new Map();
  return {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
}
function b64url(obj) { return Buffer.from(JSON.stringify(obj)).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
function fakeJwt(sub, iat) { return `${b64url({ alg: "none" })}.${b64url({ sub, iat })}.sig`; }

beforeEach(() => {
  globalThis.sessionStorage = fakeStorage();
  globalThis.localStorage = fakeStorage();
  globalThis.localStorage.setItem("token", fakeJwt("user-1", 1000));
});

const { readCorporatePracticeWorkspace, addPracticeContact, editPracticeContact } = await import("./corporateTestDriveWorkspace.js");
const { saveSampleWorkspace } = await import("../../../import/sampleWorkspace.js");

test("readCorporatePracticeWorkspace: no workspace stored -> status none, empty contacts", () => {
  const ws = readCorporatePracticeWorkspace();
  assert.equal(ws.status, "none");
  assert.deepEqual(ws.contacts, []);
});

test("readCorporatePracticeWorkspace: maps recipientType -> corporateContactType, assigns stable ids", () => {
  saveSampleWorkspace([
    { name: "Ana Reyes", email: "ana@example.com", recipientType: "employee" },
    { name: "Ben Okafor", email: "ben@example.com", recipientType: "employee" },
  ], "employee");
  const ws = readCorporatePracticeWorkspace();
  assert.equal(ws.status, "active");
  assert.equal(ws.kind, "employee");
  assert.equal(ws.contacts.length, 2);
  assert.equal(ws.contacts[0].corporateContactType, "employee");
  assert.equal(ws.contacts[0].id, "practice-0");
  assert.equal(ws.contacts[1].id, "practice-1");
});

test("addPracticeContact: category is FORCED to the session's kind, never chosen by the caller", () => {
  saveSampleWorkspace([{ name: "Cara Client", email: "cara@example.com", recipientType: "client" }], "client");
  const ws = addPracticeContact({ name: "New Client Co", email: "new@example.com" });
  assert.equal(ws.contacts.length, 2);
  assert.equal(ws.contacts[1].name, "New Client Co");
  assert.equal(ws.contacts[1].corporateContactType, "client", "forced to the Test Drive's own category");
});

test("addPracticeContact: every contact in a Client Test Drive displays Client (category consistency)", () => {
  saveSampleWorkspace([
    { name: "Cara Client", email: "cara@example.com", recipientType: "client" },
    { name: "Nora Client", email: "nora@example.com", recipientType: "client" },
  ], "client");
  const ws = addPracticeContact({ name: "Third Client" });
  assert.ok(ws.contacts.every((c) => c.corporateContactType === "client"));
});

test("editPracticeContact: updates in place, persists back through the SAME session-scoped record", () => {
  saveSampleWorkspace([{ name: "Ames Sample", email: "print@example.com", recipientType: "vendor" }], "vendor");
  const before = readCorporatePracticeWorkspace();
  const id = before.contacts[0].id;
  editPracticeContact(id, { shippingAddress: { line1: "1 Main St", city: "Springfield", state: "IL", zip: "62701", country: "US" } });
  const after = readCorporatePracticeWorkspace();
  assert.equal(after.contacts[0].shippingAddress.city, "Springfield");
  assert.equal(after.contacts[0].corporateContactType, "vendor", "editing never changes the category");
  assert.equal(after.contacts.length, 1, "editing never adds or removes a row");
});

test("edits and additions never reach the network — behaviorally proven with global fetch poisoned", async () => {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("corporateTestDriveWorkspace must never call fetch"); };
  try {
    saveSampleWorkspace([{ name: "Ames Sample", email: "print@example.com", recipientType: "vendor" }], "vendor");
    assert.doesNotThrow(() => addPracticeContact({ name: "Skyline Print Co." }));
    const id = readCorporatePracticeWorkspace().contacts[0].id;
    assert.doesNotThrow(() => editPracticeContact(id, { email: "new@example.com" }));
  } finally { globalThis.fetch = original; }
});
