// src/import/corporateAddressStatus.test.mjs — Run: node --test src/import/corporateAddressStatus.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { corporateAddressStatus, isRecognizedCountry, isPhysicalGiftEligible, PREVIEW_STATUS } from "./corporateAddressStatus.js";

const A = (o = {}) => ({ line1: "1 Test St", line2: "", city: "Testville", state: "TX", zip: "78701", country: "United States", ...o });

test("absent — no address / all blank", () => {
  assert.equal(corporateAddressStatus(null).status, PREVIEW_STATUS.ABSENT);
  assert.equal(corporateAddressStatus({}).status, PREVIEW_STATUS.ABSENT);
  assert.equal(corporateAddressStatus({ line1: "", city: "" }).status, PREVIEW_STATUS.ABSENT);
});

test("incomplete — a required field missing (reports which)", () => {
  const r = corporateAddressStatus({ line1: "1 St", city: "Austin" });
  assert.equal(r.status, PREVIEW_STATUS.INCOMPLETE);
  assert.deepEqual(r.missing, ["state", "zip", "country"]);
});

test("review — complete + recognized country (NEVER verified)", () => {
  const r = corporateAddressStatus(A());
  assert.equal(r.status, PREVIEW_STATUS.REVIEW);
  assert.notEqual(r.status, "verified");
  assert.equal(r.label, "Needs review");
});

test("unknown_country — all required present but country unrecognized", () => {
  assert.equal(corporateAddressStatus(A({ country: "Freedonia" })).status, PREVIEW_STATUS.UNKNOWN_COUNTRY);
  assert.equal(corporateAddressStatus(A({ country: "ZZ" })).status, PREVIEW_STATUS.UNKNOWN_COUNTRY);
});

test("country recognition (names + real alpha-2; not any 2-char string)", () => {
  assert.equal(isRecognizedCountry("United States"), true);
  assert.equal(isRecognizedCountry("usa"), true);
  assert.equal(isRecognizedCountry("US"), true);
  assert.equal(isRecognizedCountry("GB"), true);
  assert.equal(isRecognizedCountry("Canada"), true);
  assert.equal(isRecognizedCountry("ZZ"), false);      // not a real code
  assert.equal(isRecognizedCountry("Freedonia"), false);
  assert.equal(isRecognizedCountry(""), false);
});

test("physical-gift eligibility is advisory: only a fully-reviewable address qualifies (never absent/incomplete/unknown)", () => {
  assert.equal(isPhysicalGiftEligible(PREVIEW_STATUS.REVIEW), true);
  assert.equal(isPhysicalGiftEligible(PREVIEW_STATUS.ABSENT), false);
  assert.equal(isPhysicalGiftEligible(PREVIEW_STATUS.INCOMPLETE), false);
  assert.equal(isPhysicalGiftEligible(PREVIEW_STATUS.UNKNOWN_COUNTRY), false);
});

test("no status is ever 'verified' (FE must never claim verification)", () => {
  for (const c of [A(), A({ country: "Freedonia" }), { line1: "x" }, {}]) {
    assert.notEqual(corporateAddressStatus(c).status, "verified");
  }
});
