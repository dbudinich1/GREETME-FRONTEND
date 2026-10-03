// SURFACE 8 - pure tests for the contact Manage model. Run (Node 20): node --test src/components/corporateCampaign/contactManageModel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EMPTY_FORM, isContactReady, readinessOf, readinessCounts, fromContact, validateContact, toPayload, hasAddress, archiveCopy, writeFailureMessage,
} from "./contactManageModel.js";

const full = {
  id: "c1", name: "Bob Smith", email: "bob@x.co", phone: "555", company: "Co", department: "Sales", notes: "n",
  occasions: [{ type: "birthday", date: "1988-06-12" }, { type: "anniversary", date: "2015-03-02" }, { type: "retirement", date: "2040-01-01" }],
  shippingAddress: { line1: "1 Main", line2: "", city: "Newark", state: "NJ", zip: "07102", country: "United States" },
};

test("READY means a name and a valid email - nothing else", () => {
  assert.equal(isContactReady({ name: "A", email: "a@b.co" }), true);
  assert.equal(isContactReady({ name: "A", email: "nope" }), false);
  assert.equal(isContactReady({ name: " ", email: "a@b.co" }), false);
  assert.equal(isContactReady({ name: "A", email: "a@b.co", occasions: [], shippingAddress: null }), true, "no birthday and no address is still Ready");
  assert.equal(readinessOf({ name: "A", email: "a@b.co" }).label, "Ready");
  assert.deepEqual(readinessCounts([{ name: "A", email: "a@b.co" }, { name: "B", email: "" }]), { total: 2, ready: 1, needs: 1 });
});

test("an address never produces an error, and 'on file' follows the data", () => {
  const errs = validateContact({ ...EMPTY_FORM, name: "A", email: "a@b.co" }, [], null);
  assert.deepEqual(errs, {});
  assert.equal(hasAddress(full), true);
  assert.equal(hasAddress({ shippingAddress: null }), false);
  assert.equal(hasAddress({}), false);
});

test("validation: name and email required, full dates only, duplicates across the organization (self excluded)", () => {
  const others = [{ id: "x", email: "Dup@x.co" }, { id: "y", email: "y@x.co" }];
  assert.equal(validateContact({ ...EMPTY_FORM }, others).name, "A name is required.");
  assert.match(validateContact({ ...EMPTY_FORM, name: "A", email: "bad" }, others).email, /doesn’t look right/);
  assert.equal(validateContact({ ...EMPTY_FORM, name: "A", email: "dup@x.co" }, others).email, "Someone with that email is already here.");
  assert.deepEqual(validateContact({ ...EMPTY_FORM, name: "A", email: "dup@x.co" }, others, "x"), {}, "editing the contact itself is not a duplicate");
  assert.match(validateContact({ ...EMPTY_FORM, name: "A", email: "a@b.co", birthday: "06-12" }, others).birthday, /full date/);
});

test("fromContact and toPayload round-trip the SAME field set, keep unrelated occasions, and send null for no address", () => {
  const draft = fromContact(full);
  assert.equal(draft.birthday, "1988-06-12");
  assert.equal(draft.anniversary, "2015-03-02");
  assert.equal(draft.address.city, "Newark");
  const body = toPayload(draft, { existing: full });
  assert.equal(body.email, "bob@x.co");
  assert.deepEqual(body.occasions.map((o) => o.type).sort(), ["anniversary", "birthday", "retirement"], "the retirement occasion is preserved");
  assert.equal(body.shippingAddress.zip, "07102");
  assert.equal("corporateContactType" in body, false, "edit does not resend the category");
  const cleared = toPayload({ ...draft, address: { line1: "", line2: "", city: "", state: "", zip: "", country: "United States" } }, { existing: full });
  assert.equal(cleared.shippingAddress, null, "an emptied address is an explicit clear");
  const add = toPayload({ ...EMPTY_FORM, name: " Zed ", email: " z@x.co " }, { category: "vendor" });
  assert.equal(add.corporateContactType, "vendor", "an add carries its tile’s category");
  assert.equal(add.name, "Zed");
  assert.deepEqual(add.occasions, []);
});

test("Remove is an archive: the copy says so and warns about campaigns that include the contact", () => {
  const c = archiveCopy({ id: "c1", name: "Bob" }, [{ name: "Birthdays", enabled: true, audienceRefs: ["c1"] }, { name: "Off", enabled: false, audienceRefs: ["c1"] }]);
  assert.match(c.detail, /archives the contact/);
  assert.equal(c.warning, "Bob is in Birthdays.");
  assert.ok(c.scheduledWarning);
  const none = archiveCopy({ id: "c9", name: "Zed" }, []);
  assert.equal(none.warning, null);
  assert.equal(none.scheduledWarning, null);
});

test("failure messages: duplicate vs removed-contact email, and the generic fallback", () => {
  assert.match(writeFailureMessage({ conflict: true, error: "email_archived" }), /removed earlier/);
  assert.equal(writeFailureMessage({ conflict: true, error: "email_already_exists" }), "Someone with that email is already here.");
  assert.match(writeFailureMessage({}), /didn’t go through/);
});

test("the server's own ready flag wins; first and last name travel with the form for shipping labels", () => {
  assert.equal(isContactReady({ ready: true, name: "", email: "" }), true, "roster flag");
  assert.equal(isContactReady({ ready: false, name: "A", email: "a@b.co" }), false, "roster flag");
  assert.equal(isContactReady({ readiness: { ready: true } }), true, "management flag");
  const d = fromContact({ name: "Bob", firstName: "Robert", lastName: "Smith", email: "b@x.co" });
  assert.equal(d.firstName, "Robert");
  assert.equal(toPayload(d, {}).lastName, "Smith");
  assert.match(writeFailureMessage({ error: "invalid_shipping_address" }), /address doesn\u2019t look right/);
});