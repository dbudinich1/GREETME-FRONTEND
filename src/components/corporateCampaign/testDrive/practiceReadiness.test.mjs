// src/components/corporateCampaign/testDrive/practiceReadiness.test.mjs
// Pure, framework-free. `node --test src/components/corporateCampaign/testDrive/practiceReadiness.test.mjs`
import { test } from "node:test";
import assert from "node:assert/strict";
import { campaignRequiresAddress, practiceContactWarning, computeWarnings } from "./practiceReadiness.js";

const curatedCampaign = { deliveryConfig: { defaultGift: { type: "curated", maxSpendCents: 3000 } } };
const noGiftCampaign = { deliveryConfig: { defaultGift: null } };
const noneCampaign = { deliveryConfig: { defaultGift: { type: "none" } } };

test("campaignRequiresAddress: curated gift requires an address, no gift does not", () => {
  assert.equal(campaignRequiresAddress(curatedCampaign), true);
  assert.equal(campaignRequiresAddress(noGiftCampaign), false);
  assert.equal(campaignRequiresAddress(noneCampaign), false);
});

test("practiceContactWarning: no address at all -> absent, names 'mailing address'", () => {
  const w = practiceContactWarning({ id: "1", shippingAddress: null }, curatedCampaign);
  assert.ok(w);
  assert.equal(w.status, "absent");
  assert.match(w.message, /mailing address/i);
});

test("practiceContactWarning: founder-approved exact wording (2026-09-27)", () => {
  const w = practiceContactWarning({ id: "1", shippingAddress: null }, curatedCampaign);
  assert.equal(w.statusLabel, "Missing for This Campaign");
  assert.equal(w.message, "Mailing address required for this physical-gift campaign.");
});

test("practiceContactWarning: partial address -> incomplete, names the EXACT missing fields", () => {
  const w = practiceContactWarning({ id: "1", shippingAddress: { line1: "1 Main St", city: "Springfield" } }, curatedCampaign);
  assert.ok(w);
  assert.equal(w.status, "incomplete");
  assert.ok(w.missingFields.length > 0, "names at least one missing field");
  assert.ok(w.missingFields.every((f) => typeof f === "string" && f.length > 0));
});

test("practiceContactWarning: complete + recognized country -> ready (no warning)", () => {
  const complete = { line1: "1 Main St", city: "Springfield", state: "IL", zip: "62701", country: "United States" };
  const w = practiceContactWarning({ id: "1", shippingAddress: complete }, curatedCampaign);
  assert.equal(w, null);
});

test("practiceContactWarning: campaign with no gift never warns, regardless of address", () => {
  const w = practiceContactWarning({ id: "1", shippingAddress: null }, noGiftCampaign);
  assert.equal(w, null);
});

test("computeWarnings: keys the Map by contact.id, only for contacts that actually need something", () => {
  const contacts = [
    { id: "a", shippingAddress: null },
    { id: "b", shippingAddress: { line1: "1 Main St", city: "Springfield", state: "IL", zip: "62701", country: "US" } },
  ];
  const map = computeWarnings(contacts, curatedCampaign);
  assert.equal(map.size, 1);
  assert.ok(map.has("a"));
  assert.ok(!map.has("b"));
});

test("computeWarnings: recalculates cleanly — editing a contact to add a full address clears its warning", () => {
  const before = [{ id: "a", shippingAddress: null }];
  assert.equal(computeWarnings(before, curatedCampaign).size, 1);
  const after = [{ id: "a", shippingAddress: { line1: "1 Main St", city: "Springfield", state: "IL", zip: "62701", country: "US" } }];
  assert.equal(computeWarnings(after, curatedCampaign).size, 0);
});
