// src/utils/scheduledPhysicalGift.test.mjs
// Run (Node 20.x): node --test src/utils/scheduledPhysicalGift.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as G from "./scheduledPhysicalGift.js";
import { SCHEDULED_PHYSICAL_GIFT_AVAILABLE } from "../config/scheduledPhysicalGift.js";

const DELIVERY = { firstName: "Evelyn", lastName: "Park", address1: "41 Orchard Lane", address2: "Apt 2", city: "Montclair", state: "NJ", postalCode: "07042", country: "US" };

test("the feature ships switched ON (founder activation 2026-10-21)", () => {
  assert.equal(SCHEDULED_PHYSICAL_GIFT_AVAILABLE, true);
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

test("consent parity with the server: reused only when the STORED consent (current wording) matches the stored selection and the maximum is not higher; otherwise asked", () => {
  const a = G.buildScheduledGiftSetting({ vendor: "gift_boxes", providerProductId: "77", variants: ["v1"], quantity: 1 }, { maxTotalCents: 6000, delivery: DELIVERY });
  const stored = { ...a, scheduledGift: { ...a.scheduledGift, selectionHash: "h1" } };
  const consent = { wordingVersion: "sched-gift-v1", maxTotalCents: 6000, selectionHash: "h1" };
  assert.equal(G.needsScheduledGiftConsent(null, a, undefined), true, "first enable");
  assert.equal(G.needsScheduledGiftConsent(stored, a, consent), false, "unchanged with a valid stored consent: reused");
  assert.equal(G.needsScheduledGiftConsent(stored, a, undefined), true, "(a) stored Auto-Gift but no stored consent: asked");
  assert.equal(G.needsScheduledGiftConsent(stored, a, { ...consent, wordingVersion: "old" }), true, "(a) another wording version: asked");
  assert.equal(G.needsScheduledGiftConsent(stored, a, { ...consent, selectionHash: "h0" }), true, "consent belongs to an older selection: asked");
  assert.equal(G.needsScheduledGiftConsent(stored, { ...a, scheduledGift: { ...a.scheduledGift, maxTotalCents: 5000 } }, consent), false, "a lower maximum keeps it");
  assert.equal(G.needsScheduledGiftConsent(stored, { ...a, scheduledGift: { ...a.scheduledGift, maxTotalCents: 7000 } }, consent), true, "a higher maximum");
  assert.equal(G.needsScheduledGiftConsent(stored, { ...a, scheduledGift: { ...a.scheduledGift, quantity: 2 } }, consent), true, "quantity");
  assert.equal(G.needsScheduledGiftConsent(stored, { ...a, scheduledGift: { ...a.scheduledGift, delivery: { ...DELIVERY, city: "Newark" } } }, consent), true, "delivery");
  assert.equal(G.needsScheduledGiftConsent(stored, { ...a, autoGift: false }, undefined), false, "off: nothing to consent to");
  // (b) re-picking the same gift: raw picker values vs the server-normalised snapshot compare equal
  const serverNormalised = { ...stored, scheduledGift: { ...stored.scheduledGift, delivery: { firstName: "Evelyn", lastName: "", address1: "41 Orchard Lane", city: "Montclair", state: "NJ", postalCode: "07042", country: "US" } } };
  const rawRepick = G.buildScheduledGiftSetting({ vendor: "gift_boxes", providerProductId: 77, variants: ["v1"], quantity: "1" }, { maxTotalCents: 6000, delivery: { firstName: " Evelyn", lastName: "", address1: "41 Orchard Lane", address2: "", city: "Montclair", state: "nj", postalCode: "07042", country: "US", phone: "" } });
  assert.equal(G.needsScheduledGiftConsent(serverNormalised, rawRepick, consent), false, "(b) same gift re-picked: not asked again");
  assert.deepEqual(G.scheduledGiftConsentsFor(["christmas"]), { christmas: { accepted: true, wordingVersion: "sched-gift-v1" } });
});

test("the save-time authorisation step runs when either scheduled QR Cash or scheduled physical gifts are live", () => {
  assert.equal(G.authorizationStepEnabled(false, true), true);
  assert.equal(G.authorizationStepEnabled(true, false), true);
  assert.equal(G.authorizationStepEnabled(false, false), false);
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

test("S3: the approved success confirmation, one per Auto-Gift scheduled gift; none for a reminder-only or plain gift", () => {
  assert.equal(G.scheduledGiftSavedConfirmation("December 25"),
    "Confirmed! Your greeting is scheduled to be sent and your gift ordered on December 25. Your saved card will be charged within your approved limit at that time. Physical delivery follows afterward.");
  const settings = { christmas: { type: "merch", autoGift: true, scheduledGift: { v: 1 } }, birthday: { type: "gift_boxes", autoGift: false, scheduledGift: { v: 1 } }, mothers_day: { type: "qrcash", autoGift: true } };
  assert.deepEqual(G.autoGiftScheduledOccasions(settings), ["christmas"]);
  assert.equal(G.scheduledGiftSavedConfirmations(settings, () => "December 25"), G.scheduledGiftSavedConfirmation("December 25"));
  assert.equal(G.scheduledGiftSavedConfirmations({ mothers_day: settings.mothers_day }, () => "x"), "");
  assert.deepEqual(G.autoGiftScheduledOccasions(undefined), []);
});
