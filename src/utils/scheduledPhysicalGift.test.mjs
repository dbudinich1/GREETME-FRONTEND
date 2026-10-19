// src/utils/scheduledPhysicalGift.test.mjs
// Run (Node 20.x): node --test src/utils/scheduledPhysicalGift.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as G from "./scheduledPhysicalGift.js";
import { SCHEDULED_PHYSICAL_GIFT_AVAILABLE } from "../config/scheduledPhysicalGift.js";

const DELIVERY = { firstName: "Evelyn", lastName: "Park", address1: "41 Orchard Lane", address2: "Apt 2", city: "Montclair", state: "NJ", postalCode: "07042", country: "US" };

test("the feature ships switched off", () => {
  assert.equal(SCHEDULED_PHYSICAL_GIFT_AVAILABLE, false);
});

test("delivery is prefilled from the saved record in the contract's shape; state names become 2-letter codes; non-US is not converted", () => {
  const d = G.deliveryFromContact({ firstName: "Evelyn", lastName: "Park", shippingAddress: { line1: "41 Orchard Lane", line2: "Apt 2", city: "Montclair", state: "New Jersey", zip: "07042", country: "United States" } });
  assert.deepEqual(d, { ...DELIVERY, phone: "" });
  assert.deepEqual(G.missingDelivery(d), []);
  const partial = G.deliveryFromContact({ firstName: "Jonah", shippingAddress: { line1: "12 Harbor Way", city: "Portland" } });
  assert.deepEqual(G.missingDelivery(partial), ["state", "postalCode"], "only what is missing (last name is optional, as at checkout)");
  assert.equal(G.deliveryFromContact({ shippingAddress: { country: "Canada" } }).country, "", "a non-US address is shown as missing, not converted");
  assert.ok(G.missingDelivery({ ...DELIVERY, postalCode: "ABC" }).includes("postalCode"));
});

test("Gift box snapshot: provider product, variants, quantity (1..10), maximum, frozen delivery; type gift_boxes", () => {
  const s = G.buildScheduledGiftSetting({ vendor: "gift_boxes", providerProductId: 77, variants: ["v1"], quantity: 2, name: "Cookie Box", imageUrl: "https://x/i.png" }, { maxTotalCents: 6000, delivery: { ...DELIVERY, phone: "" } });
  assert.deepEqual(s, { type: "gift_boxes", autoGift: true, scheduledGift: { v: 1, vendor: "gift_boxes", name: "Cookie Box", imageUrl: "https://x/i.png", maxTotalCents: 6000, delivery: DELIVERY, providerProductId: "77", variants: ["v1"], quantity: 2 } });
  assert.equal(G.buildScheduledGiftSetting({ vendor: "gift_boxes", providerProductId: "a", quantity: 99 }, { maxTotalCents: 1, delivery: DELIVERY }).scheduledGift.quantity, 10);
  assert.deepEqual(G.scheduledGiftProblems(s), []);
});

test("Branded Goods snapshot: one items[] entry per unit with the sync variant id; type merch", () => {
  const s = G.buildScheduledGiftSetting({ vendor: "merch", syncVariantId: "4011", quantity: 2, name: "Mug" }, { maxTotalCents: 4200, delivery: DELIVERY });
  assert.equal(s.type, "merch");
  assert.deepEqual(s.scheduledGift.items, [{ syncVariantId: 4011 }, { syncVariantId: 4011 }]);
  assert.equal("providerProductId" in s.scheduledGift, false);
  assert.deepEqual(G.scheduledGiftProblems(s), []);
});

test("an incomplete selection is reported: no product, no maximum, an incomplete address", () => {
  assert.deepEqual(G.scheduledGiftProblems({ type: "merch", autoGift: true }), ["product"]);
  const s = G.buildScheduledGiftSetting({ vendor: "merch", syncVariantId: 0 }, { maxTotalCents: 0, delivery: { ...DELIVERY, state: "" } });
  assert.deepEqual(G.scheduledGiftProblems(s), ["product", "maxTotal", "delivery"]);
});

test("consent: new on first enable or any product/variant/quantity/delivery change or a higher maximum; a lower maximum keeps it; off needs none", () => {
  const a = G.buildScheduledGiftSetting({ vendor: "gift_boxes", providerProductId: "77", variants: ["v1"], quantity: 1 }, { maxTotalCents: 6000, delivery: DELIVERY });
  assert.equal(G.needsScheduledGiftConsent(null, a), true, "first enable");
  assert.equal(G.needsScheduledGiftConsent(a, a), false, "unchanged");
  const lower = { ...a, scheduledGift: { ...a.scheduledGift, maxTotalCents: 5000 } };
  assert.equal(G.needsScheduledGiftConsent(a, lower), false, "a lower maximum keeps consent");
  assert.equal(G.needsScheduledGiftConsent(a, { ...a, scheduledGift: { ...a.scheduledGift, maxTotalCents: 7000 } }), true, "a higher maximum");
  assert.equal(G.needsScheduledGiftConsent(a, { ...a, scheduledGift: { ...a.scheduledGift, quantity: 2 } }), true, "quantity");
  assert.equal(G.needsScheduledGiftConsent(a, { ...a, scheduledGift: { ...a.scheduledGift, delivery: { ...DELIVERY, city: "Newark" } } }), true, "delivery");
  assert.equal(G.needsScheduledGiftConsent(a, { ...a, autoGift: false }), false, "off: nothing to consent to");
  assert.deepEqual(G.scheduledGiftConsentsFor(["christmas"]), { christmas: { accepted: true, wordingVersion: "sched-gift-v1" } });
});

test("consent wording names the date and the maximum, promises no delivery date, and says what happens otherwise", () => {
  const t = G.scheduledGiftConsentText({ dateLabel: "December 25", maxTotalCents: 6000 });
  assert.match(t, /on December 25/); assert.match(t, /up to \$60\.00/);
  assert.match(t, /Delivery follows after the occasion date/);
  assert.match(t, /nothing is charged and your greeting is sent without the gift/);
});

test("contract v1 limits: the maximum is 1..100000 cents; vendor ids are the gift types", () => {
  const d = { firstName: "A", address1: "1 Main", city: "Town", state: "NJ", postalCode: "07000", country: "US" };
  const over = G.buildScheduledGiftSetting({ vendor: "merch", syncVariantId: 5 }, { maxTotalCents: 100001, delivery: d });
  assert.deepEqual(G.scheduledGiftProblems(over), ["maxTotal"]);
  assert.equal(over.scheduledGift.vendor, "merch");
  assert.equal(G.buildScheduledGiftSetting({ vendor: "gift_boxes", providerProductId: "x" }, { maxTotalCents: 100000, delivery: d }).scheduledGift.vendor, "gift_boxes");
});
