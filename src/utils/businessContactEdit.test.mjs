// src/utils/businessContactEdit.test.mjs
//
// BIZ-EDIT-1 (Team 6, 2026-10-29): the business-contact Edit is filled from the stored record and saves ONLY what changed.
// Run (Node 20): node --test src/utils/businessContactEdit.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadBusinessContactForEdit, businessRecordForForm, businessContactPatch } from "./businessContactEdit.js";

// The management read's shape (BE routes/corporateContactsRoutes.js projectManagedContact).
const STORED = {
  id: "b1", name: "Erin Employee", email: "erin@corp.test", phone: "555-0100", company: "Fixture Co", department: "Ops", notes: "n",
  firstName: "Erin", lastName: "Employee", corporateContactType: "employee",
  occasions: [{ id: "o1", type: "birthday", date: "1990-03-09", autoSend: true }, { id: "o2", type: "graduation", date: "2026-06-01", autoSend: false }],
  shippingAddress: { line1: "1 Main St", line2: "", city: "Town", state: "NJ", zip: "07000", country: "US" },
  deliveryPhone: "555-0199", readiness: { ready: true },
};
// What the form holds after it is filled from the record and nothing is touched (ContactForm merges the address over its defaults).
const untouched = () => {
  const f = businessRecordForForm(STORED);
  return { ...f, gender: "", relationshipCategory: "", relationship: "", occasionGiftSettings: {}, memoryPhotos: [],
    shippingAddress: { line1: "", line2: "", city: "", state: "", zip: "", country: "United States", ...f.shippingAddress } };
};

test("the form is filled from the stored record: email, delivery names, FULL dates and the address", () => {
  const f = businessRecordForForm(STORED);
  assert.equal(f.email, "erin@corp.test");
  assert.equal(f.firstName, "Erin"); assert.equal(f.lastName, "Employee");
  assert.deepEqual(f.occasions, [{ id: "o1", type: "birthday", date: "1990-03-09", autoSend: true }, { id: "o2", type: "graduation", date: "2026-06-01", autoSend: false }]);
  assert.equal(f.shippingAddress.line1, "1 Main St");
  assert.equal("shippingAddress" in businessRecordForForm({ ...STORED, shippingAddress: null }), false, "no stored address: none is invented");
});

test("an untouched save sends NOTHING (an empty patch): email, names, occasions and address are all kept by the server", () => {
  assert.deepEqual(businessContactPatch(STORED, untouched()), {});
});

test("changing only the email sends only the email", () => {
  assert.deepEqual(businessContactPatch(STORED, { ...untouched(), email: " new@corp.test " }), { email: "new@corp.test" });
});

test("the name is sent whenever it differs from the STORED name, a capitalisation fix included (Team 5 S2); an untouched tidy name is not", () => {
  const lower = { ...STORED, name: "erin employee" };
  assert.deepEqual(businessContactPatch(lower, { ...untouched(), name: "Erin Employee" }), { name: "Erin Employee" });
  assert.deepEqual(businessContactPatch(STORED, { ...untouched(), name: " Erin Employee " }), {}, "same as stored");
  assert.deepEqual(businessContactPatch(lower, { ...untouched(), name: "Erin Employee" }, { nameTyped: false }), {}, "only the form's blur tidy-up (Team 5 S1): not sent");
  assert.deepEqual(businessContactPatch(lower, { ...untouched(), name: "Erin Smith" }, { nameTyped: false }), { name: "Erin Smith" }, "anything beyond the tidy-up is sent");
  assert.deepEqual(businessContactPatch(STORED, { ...untouched(), name: "Erin Smith" }), { name: "Erin Smith" });
});

test("delivery names are sent only when changed (an owner's deliberate clear is a change)", () => {
  assert.deepEqual(businessContactPatch(STORED, { ...untouched(), lastName: "Smith" }), { lastName: "Smith" });
  assert.deepEqual(businessContactPatch(STORED, { ...untouched(), firstName: "" }), { firstName: "" });
});

test("an occasion change sends the WHOLE occasion list with full dates and ids kept; nothing else", () => {
  const f = untouched();
  f.occasions = [...f.occasions.map((o) => (o.type === "birthday" ? { ...o, date: "1990-03-10" } : o)), { type: "anniversary", date: "2015-10-30", autoSend: true }];
  assert.deepEqual(businessContactPatch(STORED, f), { occasions: [
    { id: "o1", type: "birthday", date: "1990-03-10", autoSend: true },
    { id: "o2", type: "graduation", date: "2026-06-01", autoSend: false },
    { type: "anniversary", date: "2015-10-30", autoSend: true },
  ] });
  const removed = untouched(); removed.occasions = removed.occasions.slice(0, 1);
  assert.deepEqual(businessContactPatch(STORED, removed), { occasions: [{ id: "o1", type: "birthday", date: "1990-03-09", autoSend: true }] });
});

test("the address: unchanged is not sent; a change replaces it and keeps the delivery phone; an emptied one is an explicit clear", () => {
  const f = untouched(); f.shippingAddress = { ...f.shippingAddress, line1: "2 Oak Ave" };
  assert.deepEqual(businessContactPatch(STORED, f), { shippingAddress: { line1: "2 Oak Ave", line2: "", city: "Town", state: "NJ", zip: "07000", country: "US" }, deliveryPhone: "555-0199" });
  const cleared = untouched(); cleared.shippingAddress = { line1: "", line2: "", city: "", state: "", zip: "", country: "United States" };
  assert.deepEqual(businessContactPatch(STORED, cleared), { shippingAddress: null });
  // No stored address and the form's default country only: still no address, nothing sent.
  const none = { ...STORED, shippingAddress: null };
  assert.deepEqual(businessContactPatch(none, { ...untouched(), shippingAddress: { country: "United States" } }), {});
  assert.deepEqual(businessContactPatch(none, { ...untouched(), shippingAddress: undefined }), {});
});

test("fields the business record does not hold are never sent (relationship, gifts, photos, consents)", () => {
  const f = { ...untouched(), relationshipCategory: "professional", occasionGiftSettings: { birthday: { type: "qrcash", amount: 25, autoGift: true } }, memoryPhotos: ["x"], occasionGiftConsents: [{}] };
  assert.deepEqual(businessContactPatch(STORED, f), {});
});

test("loading: the record by id from the management read; any failure, a missing contact or a malformed row is NOT ok", async () => {
  const client = (res) => ({ listManaged: async (org) => { assert.equal(org, "org_1"); return res; } });
  assert.deepEqual(await loadBusinessContactForEdit(client({ ok: true, contacts: [STORED] }), "org_1", "b1"), { ok: true, record: STORED });
  assert.deepEqual(await loadBusinessContactForEdit(client({ ok: true, contacts: [STORED] }), "org_1", "b9"), { ok: false, notFound: true });
  assert.deepEqual(await loadBusinessContactForEdit(client({ ok: false, unavailable: true, status: 404 }), "org_1", "b1"), { ok: false });
  assert.deepEqual(await loadBusinessContactForEdit(client({ ok: false, dormant: true }), "org_1", "b1"), { ok: false });
  assert.deepEqual(await loadBusinessContactForEdit(client({ ok: false, unauthorized: true, status: 403 }), "org_1", "b1"), { ok: false, unauthorized: true });
  assert.deepEqual(await loadBusinessContactForEdit(client({ ok: true, contacts: [{ id: "b1", name: "Erin" }] }), "org_1", "b1"), { ok: false }, "no email field: not a safe base");
  assert.deepEqual(await loadBusinessContactForEdit({ listManaged: async () => { throw new Error("x"); } }, "org_1", "b1"), { ok: false });
  assert.deepEqual(await loadBusinessContactForEdit(client({ ok: true, contacts: [] }), null, "b1"), { ok: false });
});

test("founder 2026-10-29: hidden or untouched delivery fields are never sent; a form default is not a change (no-country address)", () => {
  // A stored address WITHOUT a country key: the form fills country with its default 'United States'.
  const noCountry = { ...STORED, shippingAddress: { line1: "1 Main St", city: "Town", state: "NJ", zip: "07000" } };
  const f = untouched();
  f.shippingAddress = { line1: "", line2: "", city: "", state: "", zip: "", country: "United States", ...businessRecordForForm(noCountry).shippingAddress };
  assert.equal(f.shippingAddress.country, "United States", "the form default is in the form");
  assert.deepEqual(businessContactPatch(noCountry, f), {}, "untouched: nothing sent, the stored address is kept as it is");
  // Hidden names (empty in the record and in the form) and a stored delivery phone are never sent on their own.
  const noNames = { ...STORED, firstName: undefined, lastName: undefined };
  assert.deepEqual(businessContactPatch(noNames, { ...untouched(), firstName: "", lastName: "" }), {});
  // A genuinely edited address is still sent whole, with the stored delivery phone.
  const edited = { ...f, shippingAddress: { ...f.shippingAddress, city: "Newtown" } };
  assert.deepEqual(businessContactPatch(noCountry, edited), { shippingAddress: { line1: "1 Main St", line2: "", city: "Newtown", state: "NJ", zip: "07000", country: "United States" }, deliveryPhone: "555-0199" });
  // A country the owner actually changes on a record without one is a change.
  assert.ok("shippingAddress" in businessContactPatch(noCountry, { ...f, shippingAddress: { ...f.shippingAddress, country: "Canada" } }));
});
