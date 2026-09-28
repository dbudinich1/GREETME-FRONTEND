// src/components/corporateCampaign/testDrive/corporateTestDriveClient.test.mjs
// Run: node --test src/components/corporateCampaign/testDrive/corporateTestDriveClient.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createCorporateTestDriveClient, createCorporateTestDrivePaymentsClient, testDriveStripeOverride,
} from "./corporateTestDriveClient.js";

// Proof that no method can reach a real backend: stub the global fetch to THROW, then exercise every
// method. If any of them ever called fetch, this test would fail loudly instead of silently passing.
function withPoisonedFetch(fn) {
  const original = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error("corporateTestDriveClient must never call fetch"); };
  return fn().finally(() => { globalThis.fetch = original; });
}

test("no method reaches the network — every call still resolves with global fetch poisoned to throw", async () => {
  await withPoisonedFetch(async () => {
    const client = createCorporateTestDriveClient({ getContacts: () => [] });
    const payments = createCorporateTestDrivePaymentsClient();
    for (const call of [
      client.listMemberships(), client.listCampaigns(), client.listOrgContacts(), client.readReadiness(),
      client.readCampaign(), client.listGiftCatalog(), client.createCampaign(), client.updateFeaturedSpread(),
      client.approve(), client.lock(), client.unlock(), client.updateDeliveryConfig(), client.schedule(),
      client.activate(), client.renameCampaign(), client.removeCampaign(), client.setCampaignEnabled(),
      client.setAudience(), client.reorderCampaigns(),
      payments.getPaymentMethod(), payments.createSetupIntent(), payments.replacePaymentMethod(), payments.completeSetupIntent(),
    ]) {
      await assert.doesNotReject(call);
    }
  });
});

test("listOrgContacts reflects whatever getContacts() currently returns", async () => {
  let contacts = [{ id: "a", name: "Ana", corporateContactType: "employee" }];
  const client = createCorporateTestDriveClient({ getContacts: () => contacts });
  let res = await client.listOrgContacts();
  assert.equal(res.ok, true);
  assert.deepEqual(res.data.contacts, contacts);
  contacts = [...contacts, { id: "b", name: "Ben", corporateContactType: "employee" }];
  res = await client.listOrgContacts();
  assert.equal(res.data.contacts.length, 2);
});

test("listCampaigns returns exactly one fictional campaign with execution authorization OFF", async () => {
  const client = createCorporateTestDriveClient({ getContacts: () => [] });
  const res = await client.listCampaigns();
  assert.equal(res.ok, true);
  assert.equal(res.data.campaigns.length, 1);
  assert.equal(res.data.executionAvailability.canAuthorizeRun, false, "Test Drive can never authorize a real run");
});

test("schedule/activate always refuse — a Test Drive campaign can never actually send", async () => {
  const client = createCorporateTestDriveClient({ getContacts: () => [] });
  const s = await client.schedule();
  const a = await client.activate();
  assert.equal(s.ok, false);
  assert.equal(a.ok, false);
});

test("write methods mutate only this client's own in-memory campaign, never anything external", async () => {
  const client = createCorporateTestDriveClient({ getContacts: () => [] });
  const before = (await client.listCampaigns()).data.campaigns[0];
  assert.equal(before.lockStatus, "unlocked");
  await client.lock();
  const after = (await client.listCampaigns()).data.campaigns[0];
  assert.equal(after.lockStatus, "locked");
});

test("createCorporateTestDrivePaymentsClient: getPaymentMethod always reports no card, mutations refuse", async () => {
  const payments = createCorporateTestDrivePaymentsClient();
  const method = await payments.getPaymentMethod();
  assert.equal(method.ok, true);
  assert.equal(method.paymentMethod.ready, false);
  const setup = await payments.createSetupIntent();
  assert.equal(setup.ok, false, "Test Drive can never begin a real Stripe authorization");
});

test("testDriveStripeOverride resolves to null (Stripe.js never actually loads)", async () => {
  const resolved = await testDriveStripeOverride();
  assert.equal(resolved, null);
});
