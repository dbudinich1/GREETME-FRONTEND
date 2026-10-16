// fundraiserP1Model.test.mjs — Report 87 A7 pure helpers. Run: node --test src/pages/fundraiser/fundraiserP1Model.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  money, quarterLabel, isoDate, validateYearRates, buildYearRatesRule, dateToUtcInstant, termsLine, partnerTermsRules,
  activeTermsFromHistories, partnerStatus, lastEndedInterval, failureText, totalsByKey, quarterlyRows, BRANDED_GOODS_NOT_CALCULATED,
} from "./fundraiserP1Model.js";

test("money formats minor units and never invents a zero", () => {
  assert.equal(money(123456), "$1,234.56");
  assert.equal(money(0), "$0.00");
  assert.equal(money(-500), "−$5.00");
  for (const v of [null, undefined, "x", NaN]) assert.equal(money(v), "—");
});

test("year rates: rev 6 validation; nothing is defaulted", () => {
  assert.deepEqual(validateYearRates({ y1: "20", y2: "15.5", y3: "0" }), { ok: true, errors: {}, yearRates: { year_1: 20, year_2: 15.5, year_3_plus: 0 } });
  const bad = validateYearRates({ y1: "", y2: "101", y3: "1.234" });
  assert.equal(bad.ok, false);
  assert.deepEqual(Object.keys(bad.errors).sort(), ["y1", "y2", "y3"]);
  assert.equal(bad.yearRates, null);
  assert.deepEqual(buildYearRatesRule({ year_1: 20, year_2: 15, year_3_plus: 10 }),
    { kind: "year_rates", basis: "ENSR", yearRates: { year_1: 20, year_2: 15, year_3_plus: 10 } });
});

test("dates: 00:00 UTC on the chosen day; impossible dates refused", () => {
  assert.deepEqual(dateToUtcInstant("2027-01-31"), { ok: true, iso: "2027-01-31T00:00:00.000Z" });
  assert.equal(dateToUtcInstant("2027-02-30").ok, false);
  assert.equal(dateToUtcInstant("").ok, false);
  assert.equal(isoDate("2027-01-31T05:00:00.000Z"), "2027-01-31");
  assert.equal(isoDate("nope"), "");
  assert.equal(quarterLabel("2026-Q4"), "2026 Q4");
});

test("terms line: Year 1 / Year 2 / Year 3+, legacy kinds, and not set", () => {
  assert.equal(termsLine({ kind: "year_rates", yearRates: { year_1: 20, year_2: 15, year_3_plus: 10 } }), "Year 1 20% · Year 2 15% · Year 3+ 10%");
  assert.equal(termsLine({ initialSubscriptionShare: { type: "percent_of_base", percent: 12 }, renewalShare: { type: "percent_of_base", percent: 8 } }), "First payment 12% · Renewals 8%");
  assert.equal(termsLine(null), "Not set");
  assert.deepEqual(partnerTermsRules({ kind: "year_rates", yearRates: { year_1: 1, year_2: 2, year_3_plus: 3 } }), { kind: "year_rates", yearRates: { year_1: 1, year_2: 2, year_3_plus: 3 } });
  assert.equal(partnerTermsRules(null), null);
});

test("terms in force: newest ACTIVE version with an OPEN window across campaigns", () => {
  const hist = [
    [{ status: "active", effectiveFrom: "2026-01-01T00:00:00.000Z", effectiveThrough: "2026-06-01T00:00:00.000Z", rules: { v: "old" } },
      { status: "active", effectiveFrom: "2026-06-01T00:00:00.000Z", effectiveThrough: null, rules: { v: "a" } }],
    [{ status: "approved", effectiveFrom: null, rules: { v: "x" } }, { status: "draft" }],
  ];
  assert.deepEqual(activeTermsFromHistories(hist).rules, { v: "a" });
  assert.equal(activeTermsFromHistories([[{ status: "draft" }]]), null);
  assert.equal(activeTermsFromHistories([]), null);
});

test("partner status as rev 6 presents it", () => {
  assert.equal(partnerStatus({ status: "applied" }), "prepared");
  assert.equal(partnerStatus({ status: "approved" }), "active");
  assert.equal(partnerStatus({ status: "approved", relationship: { status: "ended" } }), "ended");
  assert.equal(partnerStatus({ status: "suspended" }), "suspended");
  assert.equal(partnerStatus(null), "unknown");
  assert.deepEqual(lastEndedInterval({ relationship: { intervals: [{ endedAt: "a", resumedAt: "b" }, { endedAt: "c", resumedAt: null }] } }), { endedAt: "c", resumedAt: null });
  assert.equal(lastEndedInterval({}), null);
});

test("failure text: codes select a sentence and are never shown", () => {
  for (const code of ["NOT_APPLIED", "ORG_NOT_ACTIVE", "TERMS_NOT_ACTIVE", "NO_PARTNER_ADMIN", "NO_ACTIVE"]) {
    const t = failureText({ ok: false, status: 409, data: { code } });
    assert.ok(t.length > 0); assert.ok(!t.includes(code));
  }
  assert.match(failureText({ networkError: true, status: 0 }), /Couldn.t reach the server/);
  assert.match(failureText({ ok: false, status: 500, data: null }), /Nothing was changed/);
});

test("report rows: A5 by key; quarterly rows with and without the A6 split", () => {
  const m = totalsByKey({ rows: [{ key: "cmp_1", recordedMinor: 100 }, { key: null }] });
  assert.equal(m.size, 1); assert.equal(m.get("cmp_1").recordedMinor, 100);
  assert.equal(totalsByKey(null).size, 0);
  const plain = quarterlyRows({ organizations: [{ organizationId: "o", quarters: { "2026-Q4": { grossCents: 92400, records: 3 } }, unsettled: { grossCents: 4200, records: 1 } }] }, "o");
  assert.equal(plain.split, false);
  assert.deepEqual(plain.rows.map((r) => r.label), ["2026 Q4", "Not yet settled"]);
  const split = quarterlyRows({ organizations: [{ organizationId: "o", quarters: { "2026-Q4": { grossCents: 1, subscriptionGrossCents: 1, brandedGoodsGrossCents: 0 } }, unsettled: { records: 0, grossCents: 0 } }] }, "o");
  assert.equal(split.split, true); assert.equal(split.rows.length, 1);
  assert.deepEqual(quarterlyRows({ organizations: [] }, "o"), { rows: [], split: false });
});

test("the Branded Goods sentence states only what is true today", () => {
  assert.equal(BRANDED_GOODS_NOT_CALCULATED, "Branded Goods purchases are recorded; partner amounts for them are not calculated yet.");
});
