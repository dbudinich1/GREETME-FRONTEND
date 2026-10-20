// Pure summaries for the collapsed commission panels. Run: node --test src/pages/founder/commandCenter/commissionSummaries.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduleText, subscriptionSummary, giftSummary, activitySummary } from "./commissionSummaries.js";

test("scheduleText: only a complete, valid bps schedule", () => {
  assert.equal(scheduleText({ year_1: 2000, year_2: 1000, year_3_plus: 1000 }), "20% / 10% / 10%");
  assert.equal(scheduleText({ year_1: 2500, year_2: 1500, year_3_plus: 1000 }), "25% / 15% / 10%");
  assert.equal(scheduleText(null), null);
  assert.equal(scheduleText({ year_1: 2000, year_2: 1000 }), null);
  assert.equal(scheduleText({ year_1: "20", year_2: 1000, year_3_plus: 1000 }), null);
});

test("subscriptionSummary: saved schedule + override state; no saved terms says what is true (A11)", () => {
  const names = { "sp-ref": "Kat" };
  const nameOf = (id) => names[id];
  assert.equal(subscriptionSummary({ compensation: { year_1: 2000, year_2: 1000, year_3_plus: 1000 }, referral: { referrerSalespersonId: "sp-ref", overrideRateBps: 500, status: "active" } }, nameOf),
    "Year 1 / 2 / 3+: 20% / 10% / 10% · Override 5% to Kat");
  assert.equal(subscriptionSummary({ compensation: { year_1: 2000, year_2: 1000, year_3_plus: 1000 }, referral: { referrerSalespersonId: "sp-ref", overrideRateBps: 500, status: "ended" } }, nameOf),
    "Year 1 / 2 / 3+: 20% / 10% / 10% · Override to Kat ended");
  assert.equal(subscriptionSummary({ compensation: null, referral: null }),
    "No terms saved: new customers earn nothing until terms are saved · No override");
  assert.match(subscriptionSummary({ compensation: null, referral: { referrerSalespersonId: "sp-x", overrideRateBps: 500, status: "active" } }), /Override 5% to sp-x$/, "unknown name falls back to the id");
});

test("giftSummary: schedule, fixed, off, unset, loading, error", () => {
  const sched = { year_1: 2000, year_2: 1000, year_3_plus: 1000 };
  assert.equal(giftSummary({ enabled: true, rateSource: "customer_schedule", duration: { mode: "ongoing" }, eligibleTypes: ["gift_boxes"] }, sched), "Inherited (Year 1 20% · Year 2 10% · Year 3+ 10%) · ongoing · gift boxes");
  assert.equal(giftSummary({ enabled: true, rateSource: "customer_schedule", duration: { mode: "ongoing" }, eligibleTypes: ["gift_boxes"] }, null), "Inherited (no subscription terms saved) · ongoing · gift boxes");
  assert.equal(giftSummary({ enabled: true, rateBps: 1250, duration: { mode: "months_from_first_gift", months: 6 }, eligibleTypes: ["gift_boxes", "merch", "flowers"] }), "12.5% of margin · 6 months from first gift · gift boxes, merch and flowers");
  assert.equal(giftSummary({ enabled: false }), "Disabled: nothing accrues");
  assert.equal(giftSummary(null), "Not set: nothing accrues");
  assert.equal(giftSummary(null, null, "loading"), "Loading…");
  assert.equal(giftSummary(null, null, "error"), "Could not load gift commission terms");
});

test("activitySummary: the server's figures only", () => {
  const money = (v) => `$${(v / 100).toFixed(2)}`;
  assert.equal(activitySummary({ pendingCommissionMinor: 4500, approvedCommissionMinor: 0, paidCommissionMinor: 1200 }, money), "Pending $45.00 · Approved $0.00 · Paid $12.00");
  assert.equal(activitySummary(null, money), "Not loaded");
  assert.equal(activitySummary({}, money), "No figures");
});

test("no prefilled percentages: re-opening an OFF gift setting (stored rateBps 0 placeholder) shows a blank rate, not 0", async () => {
  const { draftFromCurrent, blankDraft } = await import("./giftCommissionLogic.js");
  assert.equal(blankDraft().ratePercent, "");
  assert.equal(draftFromCurrent({ enabled: false, rateBps: 0, duration: { mode: "ongoing" }, eligibleTypes: [] }).ratePercent, "");
  assert.equal(draftFromCurrent({ enabled: true, rateBps: 1500, duration: { mode: "ongoing" }, eligibleTypes: ["gift_boxes"] }).ratePercent, "15", "a saved ON rate still prefills");
  assert.equal(draftFromCurrent({ enabled: true, rateSource: "customer_schedule", rateBps: null, duration: { mode: "ongoing" }, eligibleTypes: ["gift_boxes"] }).ratePercent, "");
});

test("linksSummary: saved shareable link and state, account link, unavailable and error", async () => {
  const { linksSummary } = await import("./commissionSummaries.js");
  assert.equal(linksSummary({ state: "ready", vanityUrl: "https://greet-me.com/amir", vanityActive: true }, { linkedUserId: "u1" }), "greet-me.com/amir · Active · Account linked");
  assert.equal(linksSummary({ state: "ready", vanityUrl: "https://greet-me.com/amir", vanityActive: false }, {}), "greet-me.com/amir · Paused · No account linked");
  assert.equal(linksSummary({ state: "ready", vanityUrl: null }, {}), "No shareable link yet · No account linked");
  assert.equal(linksSummary({ state: "unavailable" }, { referralSlug: "amir" }), "Vanity URL: amir · No account linked");
  assert.equal(linksSummary({ state: "error" }, { linkedUserId: "u1" }), "Links not available right now · Account linked");
});
