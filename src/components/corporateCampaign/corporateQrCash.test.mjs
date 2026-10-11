// src/components/corporateCampaign/corporateQrCash.test.mjs - RELEASE 2: corporate QR Cash selection (DORMANT) - pure model.
// Design: reports/closeout-sprint/contracts/MILESTONE-release2-corporate-qrcash-and-activation-prep.md
// Run (Node 20.x): node --test src/components/corporateCampaign/corporateQrCash.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  giftOptionState, buildDefaultGift, buildDeliveryConfigBody, buildCampaignDraft, draftFingerprint,
  describeCampaignPlan, selectorSummaries, qrCashDollarsToCents, qrCashCentsToDollars, isQrCashAmountCents,
  CORPORATE_GIFT_OPTIONS,
} from "./corporateDashboardModel.js";
import { giftPayload } from "./oneTimeSendModel.js";
import { SCHEDULED_QRCASH_AVAILABLE } from "../../config/scheduledQrCash.js";

const ON = { qrCashAvailable: true };

const OFF = { qrCashAvailable: false };

test("R2-FE1 the shipped availability flag drives the default: DORMANT = visible but not selectable, ACTIVATED = selectable", () => {
  assert.equal(SCHEDULED_QRCASH_AVAILABLE, true, "shipped state (the Release 2 activation commit sets it; the dormant build has false)");
  assert.ok(CORPORATE_GIFT_OPTIONS.some((o) => o.value === "qrcash"), "always visible");
  // the default follows the shipped constant
  assert.deepEqual(giftOptionState("qrcash"), { selectable: SCHEDULED_QRCASH_AVAILABLE === true, reason: null });
  // and the dormant path is exercised explicitly, whatever the shipped state
  assert.deepEqual(giftOptionState("qrcash", OFF), { selectable: false, reason: null });
  assert.deepEqual(giftOptionState("qrcash", { ...OFF, scheduleMode: "campaign_date" }), { selectable: false, reason: null });
});

test("R2-FE2 available: selectable only for a fixed campaign date, never for a per-contact saved date", () => {
  assert.equal(giftOptionState("qrcash", ON).selectable, true);
  assert.equal(giftOptionState("qrcash", { ...ON, scheduleMode: "campaign_date" }).selectable, true);
  assert.equal(giftOptionState("qrcash", { ...ON, scheduleMode: "contact_saved_date" }).selectable, false);
  for (const nonTrue of [false, null, 1, "true"]) assert.equal(giftOptionState("qrcash", { qrCashAvailable: nonTrue }).selectable, false, String(nonTrue));
  // the others are untouched
  assert.equal(giftOptionState("none").selectable, true);
  assert.equal(giftOptionState("curated").selectable, true);
  assert.equal(giftOptionState("marketplace", ON).selectable, false);
});

test("R2-FE3 the amount input: whole dollars $5-$100 become cents; anything else is null", () => {
  assert.equal(qrCashDollarsToCents("25"), 2500);
  assert.equal(qrCashDollarsToCents(" $25 "), 2500);
  assert.equal(qrCashDollarsToCents("5"), 500);
  assert.equal(qrCashDollarsToCents("100"), 10000);
  for (const bad of ["", "0", "4", "101", "25.50", "25.", "2,5", "abc", "-5", "1e2", "０５", null, undefined, "1000"]) {
    assert.equal(qrCashDollarsToCents(bad), null, String(bad));
  }
  assert.equal(qrCashCentsToDollars(2500), "25");
  assert.equal(qrCashCentsToDollars(2550), "");
  assert.equal(isQrCashAmountCents(10000), true);
  assert.equal(isQrCashAmountCents(10100), false);
});

test("R2-FE4 the wire gift: explicit-unit cents, only while available, never a half-made gift", () => {
  assert.deepEqual(buildDefaultGift({ giftType: "qrcash", qrCashAmountCents: 2500, qrCashAvailable: true }), { type: "qrcash", qrCashAmountCents: 2500 });
  assert.equal(buildDefaultGift({ giftType: "qrcash", qrCashAmountCents: 2500, qrCashAvailable: false }), null, "dormant: no QR gift is ever serialized");
  assert.equal(buildDefaultGift({ giftType: "qrcash", qrCashAmountCents: null, qrCashAvailable: true }), null);
  assert.equal(buildDefaultGift({ giftType: "qrcash", qrCashAmountCents: 2550, qrCashAvailable: true }), null);
  // a QR amount can never ride onto another gift type
  assert.deepEqual(buildDefaultGift({ giftType: "curated", curatedTierCents: 2500, qrCashAmountCents: 2500, qrCashAvailable: true }), { type: "curated", maxSpendCents: 2500 });
  assert.equal(buildDefaultGift({ giftType: "none", qrCashAmountCents: 2500, qrCashAvailable: true }), null);
});

test("R2-FE5 the config body: a QR campaign is a fixed-date, send-once config; a saved-date QR serializes no gift; others unchanged", () => {
  const base = { scheduleMode: "campaign_date", scheduledForUtc: "2030-12-01T14:00:00.000Z", timeZone: "America/New_York", giftType: "qrcash", qrCashAmountCents: 2500, qrCashAvailable: true };
  const qr = buildDeliveryConfigBody(base);
  assert.deepEqual(qr.defaultGift, { type: "qrcash", qrCashAmountCents: 2500 });
  assert.equal(qr.sendOnce, true);
  assert.equal(JSON.stringify(qr).includes('"amount"'), false);
  assert.equal(JSON.stringify(qr).includes('"maxSpend'), false);
  const saved = buildDeliveryConfigBody({ ...base, scheduleMode: "contact_saved_date", occasionType: "birthday" });
  assert.equal(saved.defaultGift, null);
  assert.equal("sendOnce" in saved, false);
  const noAmount = buildDeliveryConfigBody({ ...base, qrCashAmountCents: null });
  assert.equal(noAmount.defaultGift, null);
  assert.equal("sendOnce" in noAmount, false);
  const dormant = buildDeliveryConfigBody({ ...base, qrCashAvailable: false });
  assert.equal(dormant.defaultGift, null, "dormant: nothing is ever sent for QR Cash");
  // curated is byte-identical to before: no sendOnce key
  const cur = buildDeliveryConfigBody({ scheduleMode: "campaign_date", scheduledForUtc: "2030-12-01T14:00:00.000Z", giftType: "curated", curatedTierCents: 5000 });
  assert.deepEqual(cur, { scheduleMode: "campaign_date", scheduledForUtc: "2030-12-01T14:00:00.000Z", defaultGift: { type: "curated", maxSpendCents: 5000 }, recipientGiftOverrides: [] });
});

test("R2-FE6 the draft reads a saved QR amount back, and the amount lights Save", () => {
  const saved = { audienceRefs: [], deliveryConfig: { scheduleMode: "campaign_date", defaultGift: { type: "qrcash", qrCashAmountCents: 2500 } } };
  const d = buildCampaignDraft(saved, []);
  assert.equal(d.giftType, "qrcash");
  assert.equal(d.qrCashAmountCents, 2500);
  assert.equal(d.qrCashDollarsText, "25");
  const none = buildCampaignDraft({ audienceRefs: [], deliveryConfig: {} }, []);
  assert.equal(none.qrCashAmountCents, null);
  assert.equal(none.qrCashDollarsText, "");
  assert.notEqual(draftFingerprint(d), draftFingerprint({ ...d, qrCashAmountCents: 5000 }));
  // typing text alone (no valid cents change) is not a change
  assert.equal(draftFingerprint(d), draftFingerprint({ ...d, qrCashDollarsText: "25 " }));
  // a non-QR draft ignores the amount entirely
  assert.equal(draftFingerprint({ ...d, giftType: "none" }), draftFingerprint({ ...d, giftType: "none", qrCashAmountCents: 9900 }));
});

test("R2-FE7 the plan and summary say 'once' and name the amount; every other campaign date still says 'every year'", () => {
  const d = { giftType: "qrcash", qrCashAmountCents: 2500, scheduleMode: "campaign_date", scheduledForLocal: "2030-12-15T09:00" };
  const when = (draft) => describeCampaignPlan({ draft, recipientCount: 3 }).find((r) => r.key === "when").value;
  const gift = (draft) => describeCampaignPlan({ draft, recipientCount: 3 }).find((r) => r.key === "gift").value;
  assert.match(when(d), /once\.$/);
  assert.doesNotMatch(when(d), /every year/);
  assert.match(when({ ...d, giftType: "curated" }), /every year\.$/);
  assert.match(gift(d), /\$25 to each person, plus the standard QR Cash fee/);
  assert.match(gift({ ...d, qrCashAmountCents: null }), /enter an amount from \$5 to \$100/);
  const s = selectorSummaries({ draft: d, recipientCount: 3 }).find((r) => r.key === "gift");
  assert.match(s.value, /QR Cash.*\$25 each/);
  assert.equal(s.complete, true);
});

test("R2-FE8 the one-time send gift payload: cents, valid or nothing", () => {
  assert.deepEqual(giftPayload("qrcash", 2500, 2500), { type: "qrcash", qrCashAmountCents: 2500 });
  assert.equal(giftPayload("qrcash", 2500, null), null);
  assert.equal(giftPayload("qrcash", 2500, 2550), null);
  assert.equal(giftPayload("qrcash", 2500, 10100), null);
  assert.deepEqual(giftPayload("curated", 5000, 2500), { type: "curated", maxSpendCents: 5000 });
  assert.equal(giftPayload("none", 2500, 2500), null);
});
