// W37 - pure view-model tests (fixtures only). Run: node --test src/pages/founder/attributionHealthView.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildAttributionHealthView, outcomeLabel, bpsToPercentText } from "./attributionHealthView.js";

// Real shape, as returned by readAttributionCounters.
const REAL = {
  salespersonId: "sp_1",
  totals: { no_referral: 0, referral_validated: 12, attributed: 3, gift_claim_validated: 1, carrier_unavailable: 0, window_expired: 2, unresolvable: 1, attribution_disabled: 0 },
  byDay: { "2026-09-29": { referral_validated: 5, attributed: 1 }, "2026-09-28": { referral_validated: 7, attributed: 2, window_expired: 2 } },
  validatedCount: 12, attributedCount: 3, carrierUnavailableCount: 7, expiredCount: 2, lossRateBps: 8333, consideredCount: 12,
};

test("real shape: labeled metrics, totals, sorted days; nothing stringifies to [object Object]", () => {
  const v = buildAttributionHealthView(REAL);
  assert.equal(v.state, "ok");
  assert.equal(v.metrics.find((m) => m.key === "lossRateBps").value, "83.33%");
  assert.equal(v.metrics.find((m) => m.key === "validatedCount").label, "Referrals validated");
  assert.equal(v.totals.find((t) => t.key === "attributed").count, 3);
  assert.deepEqual(v.days.map((d) => d.day), ["2026-09-28", "2026-09-29"]);
  assert.equal(v.days[0].total, 11);
  assert.equal(v.maxDayTotal, 11);
  assert.ok(!JSON.stringify(v).includes("[object Object]"));
});

test("idle salesperson: null loss rate reads as 'No referrals yet', state empty", () => {
  const v = buildAttributionHealthView({ totals: { attributed: 0 }, byDay: {}, validatedCount: 0, attributedCount: 0, lossRateBps: null });
  assert.equal(v.state, "empty");
  assert.equal(v.metrics.find((m) => m.key === "lossRateBps").value, "No referrals yet");
});

test("empty object is empty; non-objects and arrays are malformed", () => {
  assert.equal(buildAttributionHealthView({}).state, "empty");
  for (const bad of [null, undefined, "x", 4, []]) assert.equal(buildAttributionHealthView(bad).state, "malformed");
});

test("malformed members are skipped, never printed raw", () => {
  const v = buildAttributionHealthView({ totals: { a: "x", b: -1, attributed: 2 }, byDay: { "bad": { attributed: 1 }, "2026-01-01": "nope", "2026-01-02": { attributed: "z" } }, nested: { deep: 1 }, flag: true });
  assert.deepEqual(v.totals.map((t) => t.key), ["attributed"]);
  assert.equal(v.days.length, 0);
  assert.deepEqual(v.extras, [{ key: "flag", label: "Flag", value: "Yes" }]);
});

test("older flat fixture still renders labeled", () => {
  const v = buildAttributionHealthView({ referralsValidated: 12, conversions: 3, lostBeforeConversion: 9 });
  assert.deepEqual(v.extras.map((e) => e.label), ["Referrals validated", "Conversions", "Lost before conversion"]);
});

test("helpers", () => {
  assert.equal(outcomeLabel("window_expired"), "Window expired");
  assert.equal(outcomeLabel("some_new_outcome"), "Some new outcome");
  assert.equal(bpsToPercentText(1000), "10%");
  assert.equal(bpsToPercentText(null), null);
});
