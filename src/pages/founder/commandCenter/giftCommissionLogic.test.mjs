import test from "node:test";
import assert from "node:assert/strict";
import {
  validateDraft, blankDraft, draftFromCurrent, removedTypes, summaryLine, historyRows, giftCommissionErrorMessage,
  GIFT_TYPE_OPTIONS, NEVER_EARN, GIFT_COMMISSION_BANNER,
} from "./giftCommissionLogic.js";

const NOW = new Date("2026-10-03T12:00:00Z");
const good = (o = {}) => ({ ...blankDraft(), ratePercent: "20", types: ["gift_boxes"], ...o });

test("valid draft becomes the exact PUT body (percent -> basis points)", () => {
  const v = validateDraft(good({ mode: "months_from_first_gift", months: "12" }), NOW);
  assert.deepEqual(v.errors, {});
  assert.deepEqual(v.payload, { enabled: true, rateBps: 2000, duration: { mode: "months_from_first_gift", months: 12 }, eligibleTypes: ["gift_boxes"] });
  assert.equal(validateDraft(good({ ratePercent: "12.5" }), NOW).payload.rateBps, 1250);
});
test("validation: rate, months, types, date", () => {
  assert.ok(validateDraft(good({ ratePercent: "" }), NOW).errors.rate);
  assert.ok(validateDraft(good({ ratePercent: "abc" }), NOW).errors.rate);
  assert.ok(validateDraft(good({ ratePercent: "101" }), NOW).errors.rate);
  assert.ok(validateDraft(good({ ratePercent: "-1" }), NOW).errors.rate);
  assert.ok(validateDraft(good({ ratePercent: "10.123" }), NOW).errors.rate);
  assert.ok(validateDraft(good({ mode: "months_from_first_gift", months: "0" }), NOW).errors.months);
  assert.ok(validateDraft(good({ mode: "months_from_first_gift", months: "121" }), NOW).errors.months);
  assert.ok(validateDraft(good({ mode: "months_from_first_gift", months: "1.5" }), NOW).errors.months);
  assert.ok(validateDraft(good({ types: [] }), NOW).errors.types);
  assert.ok(validateDraft(good({ startDate: "2026-10-02" }), NOW).errors.startDate, "past date refused");
  assert.ok(validateDraft(good({ startDate: "10/04/2026" }), NOW).errors.startDate);
  assert.equal(validateDraft(good({ startDate: "2026-10-03" }), NOW).payload.effectiveFrom, undefined, "today means now");
  assert.equal(validateDraft(good({ startDate: "2026-11-01" }), NOW).payload.effectiveFrom, "2026-11-01T00:00:00.000Z");
});
test("QR Cash and Smart Card can never be selected or sent; flowers can", () => {
  assert.deepEqual(NEVER_EARN.map((n) => n.id).sort(), ["gift_cards", "qrcash"]);
  assert.equal(GIFT_TYPE_OPTIONS.find((o) => o.id === "flowers").selectable, true);
  assert.match(GIFT_TYPE_OPTIONS.find((o) => o.id === "flowers").note, /20% florist share; florist payment is verified before approval/);
  const v = validateDraft(good({ types: ["gift_boxes", "qrcash", "gift_cards", "flowers"] }), NOW);
  assert.deepEqual(v.payload.eligibleTypes, ["gift_boxes", "flowers"], "never-earn types are stripped, flowers is kept");
  assert.ok(validateDraft(good({ types: ["qrcash", "gift_cards"] }), NOW).errors.types, "nothing selectable left");
});
test("keep-flowers round trip: every stored selectable type is pre-selected and sent back unchanged", () => {
  const cur = { enabled: true, rateBps: 500, duration: { mode: "ongoing" }, eligibleTypes: ["gift_boxes", "flowers", "merch"] };
  const d = draftFromCurrent(cur);
  assert.deepEqual(d.types, ["gift_boxes", "flowers", "merch"]);
  assert.deepEqual(removedTypes(d), []);
  const v = validateDraft(d, NOW);
  assert.deepEqual(v.payload.eligibleTypes, ["gift_boxes", "flowers", "merch"], "saving without touching types drops nothing");
  const onlyFlowers = draftFromCurrent({ ...cur, eligibleTypes: ["flowers"] });
  assert.deepEqual(validateDraft(onlyFlowers, NOW).payload.eligibleTypes, ["flowers"]);
});
test("removing a stored type is reported (never silent)", () => {
  const d = draftFromCurrent({ enabled: true, rateBps: 500, duration: { mode: "ongoing" }, eligibleTypes: ["gift_boxes", "flowers"] });
  d.types = d.types.filter((t) => t !== "flowers");
  assert.deepEqual(removedTypes(d), ["flowers"]);
});
test("turning it off does not require types and sends enabled:false", () => {
  const v = validateDraft(good({ enabled: false, types: [], ratePercent: "" }), NOW);
  assert.deepEqual(v.errors, {});
  assert.equal(v.payload.enabled, false); assert.equal(v.payload.rateBps, 0);
});
test("plain-language summary", () => {
  assert.equal(summaryLine({ enabled: true, rateBps: 2000, duration: { mode: "months_from_first_gift", months: 12 }, eligibleTypes: ["gift_boxes"] }, "2026-10-03"), "Earns 20% of Greet-Me's margin on gift boxes for 12 months starting 2026-10-03.");
  assert.equal(summaryLine({ enabled: true, rateBps: 1000, duration: { mode: "first_gift_only" }, eligibleTypes: ["gift_boxes", "merch"] }, ""), "Earns 10% of Greet-Me's margin on gift boxes and merch, on the first gift only.");
  assert.match(summaryLine({ enabled: true, rateBps: 500, duration: { mode: "ongoing" }, eligibleTypes: ["merch"] }, "now"), /ongoing starting now/);
  assert.match(summaryLine(null), /off/); assert.match(summaryLine({ enabled: false }), /nothing accrues/);
});
test("history is shown newest first and is display-only", () => {
  const rows = historyRows({ history: [{ enabled: true, rateBps: 1000, duration: { mode: "ongoing" }, eligibleTypes: ["merch"], effectiveFrom: "2026-01-01T00:00:00Z", setAt: "2026-01-01T00:00:00Z", setBy: "u1" }, { enabled: false, rateBps: 0, duration: { mode: "ongoing" }, eligibleTypes: [], effectiveFrom: "2026-05-01T00:00:00Z", setAt: "2026-05-01T00:00:00Z", setBy: "u1" }] });
  assert.equal(rows.length, 2); assert.equal(rows[0].effectiveFrom, "2026-05-01"); assert.match(rows[1].text, /10%/);
  assert.deepEqual(historyRows(null), []);
});
test("errors map from contract codes to plain words, never the raw code", () => {
  for (const reason of ["rate_out_of_range", "duration_invalid", "eligible_types_required", "ineligible_type", "effective_from_in_the_past"]) {
    const m = giftCommissionErrorMessage({ status: 400, data: { reason } });
    assert.ok(m.length > 20); assert.doesNotMatch(m, /_/, reason);
  }
  assert.match(giftCommissionErrorMessage({ status: 403 }), /founder account/);
  assert.match(giftCommissionErrorMessage({ status: 404 }), /no longer exists/);
  assert.match(giftCommissionErrorMessage({ networkError: true }), /reach the server/);
  assert.match(giftCommissionErrorMessage({ status: 500 }), /try again/i);
});
test("banner says OFF platform-wide and payouts off", () => {
  assert.match(GIFT_COMMISSION_BANNER, /OFF platform-wide/); assert.match(GIFT_COMMISSION_BANNER, /payouts are off/);
});
