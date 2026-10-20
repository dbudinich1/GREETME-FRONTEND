// src/utils/scheduledGiftBackup.test.mjs
//
// Backup gift box (founder-approved, gift boxes only): snapshot shape, consent wording v2, consent-need parity with the
// server, the backup list, and that a gift without a backup is exactly v1.
// Run (Node 20.x): node --test src/utils/scheduledGiftBackup.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import * as G from "./scheduledPhysicalGift.js";
import { planAuthorization } from "./scheduledQrCashConsent.js";

const DELIVERY = { firstName: "Evelyn", lastName: "Park", address1: "41 Orchard Lane", city: "Montclair", state: "NJ", postalCode: "07042", country: "US" };
const BOX = { vendor: "gift_boxes", providerProductId: "box-cookie", variants: [], quantity: 1, name: "Cookie Box", imageUrl: "" };
const TEA = { providerProductId: "box-tea", variants: [], quantity: 1, name: "Tea Sampler", imageUrl: "https://x/t.png" };
const withBackup = (over = {}) => G.buildScheduledGiftSetting(BOX, { maxTotalCents: 5000, delivery: DELIVERY, backup: TEA, approvedTotalCents: 4599, ...over });
const without = () => G.buildScheduledGiftSetting(BOX, { maxTotalCents: 5000, delivery: DELIVERY });

test("snapshot with a backup: backup {providerProductId, variants, quantity, name, imageUrl} and approvedTotalCents; no separate delivery", () => {
  const s = withBackup();
  assert.deepEqual(s.scheduledGift.backup, { providerProductId: "box-tea", variants: [], quantity: 1, name: "Tea Sampler", imageUrl: "https://x/t.png" });
  assert.equal(s.scheduledGift.approvedTotalCents, 4599);
  assert.deepEqual(G.scheduledGiftProblems(s), []);
});

test("snapshot without a backup is byte-identical to v1 (no backup, no approvedTotalCents keys)", () => {
  assert.equal(JSON.stringify(without()),
    '{"type":"gift_boxes","autoGift":true,"scheduledGift":{"v":1,"vendor":"gift_boxes","name":"Cookie Box","imageUrl":"","maxTotalCents":5000,"delivery":{"firstName":"Evelyn","lastName":"Park","address1":"41 Orchard Lane","city":"Montclair","state":"NJ","postalCode":"07042","country":"US"},"providerProductId":"box-cookie","variants":[],"quantity":1}}');
  assert.equal(JSON.stringify(G.buildScheduledGiftSetting(BOX, { maxTotalCents: 5000, delivery: DELIVERY, backup: null, approvedTotalCents: 4599 })), JSON.stringify(without()), "approvedTotalCents only travels with a backup");
});

test("a backup that is the original, or that has no quoted total, is a problem", () => {
  assert.deepEqual(G.scheduledGiftProblems(withBackup({ backup: { ...TEA, providerProductId: "box-cookie" } })), ["backup"]);
  assert.deepEqual(G.scheduledGiftProblems(withBackup({ approvedTotalCents: null })), ["approvedTotal"]);
});

test("backup list excludes the original and boxes whose provider requires an option", () => {
  const boxes = [{ providerProductId: "box-cookie" }, { providerProductId: "box-tea" }, { providerProductId: "box-speaker", requiresOptions: true }, { providerProductId: "box-listed", variants: [{ id: "a" }] }];
  assert.deepEqual(G.backupCandidates(boxes, "box-cookie").map((p) => p.providerProductId), ["box-tea", "box-listed"]);
});

test("consent v2 only with a backup; v1 exactly as today without", () => {
  const settings = { christmas: withBackup(), birthday: without() };
  assert.deepEqual(G.scheduledGiftConsentsFor(["christmas", "birthday"], settings), {
    christmas: { accepted: true, wordingVersion: "sched-gift-v2" }, birthday: { accepted: true, wordingVersion: "sched-gift-v1" } });
  assert.deepEqual(G.scheduledGiftConsentsFor(["birthday"]), { birthday: { accepted: true, wordingVersion: "sched-gift-v1" } });
});

test("v2 wording = the v1 text + the founder-approved sentence; cap = the lower of approvedTotalCents and the maximum", () => {
  const v1 = G.scheduledGiftConsentText({ dateLabel: "December 25", maxTotalCents: 5000 });
  const v2 = G.scheduledGiftConsentText({ dateLabel: "December 25", maxTotalCents: 5000, giftName: "Cookie Box", backupName: "Tea Sampler", capCents: G.backupCapCents(withBackup().scheduledGift) });
  assert.equal(v2, `${v1} If Cookie Box isn't available, we'll order your backup Tea Sampler instead, only if its full total is no more than $45.99.`);
  assert.equal(G.backupCapCents(withBackup({ maxTotalCents: 4000 }).scheduledGift), 4000);
  assert.equal(G.backupCapCents(without().scheduledGift), null);
});

test("consent-need parity: new/changed/removed backup or a changed approvedTotalCents asks; a v1 consent never covers a backup; a lower maximum alone keeps consent", () => {
  const stored = withBackup();
  const v2 = { wordingVersion: "sched-gift-v2", maxTotalCents: 5000 };
  const v1 = { wordingVersion: "sched-gift-v1", maxTotalCents: 5000 };
  assert.equal(G.needsScheduledGiftConsent(stored, withBackup(), v2), false, "unchanged backup, v2 consent: reused");
  assert.equal(G.needsScheduledGiftConsent(stored, withBackup(), v1), true, "a v1 consent cannot cover a backup");
  assert.equal(G.needsScheduledGiftConsent(without(), withBackup(), v1), true, "new backup");
  assert.equal(G.needsScheduledGiftConsent(stored, withBackup({ backup: { ...TEA, providerProductId: "box-other" } }), v2), true, "changed backup");
  assert.equal(G.needsScheduledGiftConsent(stored, without(), v2), true, "removed backup");
  assert.equal(G.needsScheduledGiftConsent(stored, withBackup({ approvedTotalCents: 4799 }), v2), true, "changed approvedTotalCents");
  assert.equal(G.needsScheduledGiftConsent(stored, withBackup({ maxTotalCents: 4500 }), v2), false, "a lower maximum alone keeps it");
  assert.equal(G.needsScheduledGiftConsent(stored, withBackup({ maxTotalCents: 6000 }), v2), true, "a higher maximum asks");
  assert.equal(G.needsScheduledGiftConsent(without(), without(), v1), false, "no backup: v1 behaviour unchanged");
});

test("the final confirmation item carries the backup name and cap only when there is a backup", () => {
  const occasions = [{ type: "christmas", date: "2026-12-25" }, { type: "birthday", date: "2026-11-14" }];
  const card = { present: true, expMonth: 12, expYear: 2030 };
  const plan = planAuthorization({ settings: { christmas: withBackup(), birthday: without() }, initialSettings: {}, occasions, card, formData: {}, labelFor: (k) => k, requiresDelivery: () => false, storedScheduledGiftConsents: {} });
  const byKey = Object.fromEntries(plan.scheduledGiftItems.map((i) => [i.key, i]));
  assert.equal(byKey.christmas.backupName, "Tea Sampler");
  assert.equal(byKey.christmas.capCents, 4599);
  assert.deepEqual(Object.keys(byKey.birthday).sort(), ["date", "dateLabel", "key", "label", "maxTotalCents", "name"], "no backup: the item is exactly as before");
});
