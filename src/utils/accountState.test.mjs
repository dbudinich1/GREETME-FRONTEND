// accountState.test.mjs — TEAM D FE-GATE-1. Run: node --test src/utils/accountState.test.mjs
// Proves the isFounder predicate mirrors the backend resolveFundraiserActor gate exactly:
//   user.plan === 'founder' || user.tier === 'founder'
// and is null-safe (undefined user / missing plan / missing tier all → false).
import { test } from "node:test";
import assert from "node:assert/strict";
import { isFounder } from "./accountState.js";

test("isFounder: founder-by-plan → true", () => {
  assert.equal(isFounder({ plan: "founder" }), true);
});

test("isFounder: founder-by-tier → true", () => {
  assert.equal(isFounder({ tier: "founder" }), true);
});

test("isFounder: both plan and tier founder → true", () => {
  assert.equal(isFounder({ plan: "founder", tier: "founder" }), true);
});

test("isFounder: free tier (non-founder plan/tier) → false", () => {
  assert.equal(isFounder({ plan: "free", tier: "free" }), false);
});

test("isFounder: undefined user → false", () => {
  assert.equal(isFounder(undefined), false);
});

test("isFounder: user object with neither field → false", () => {
  assert.equal(isFounder({}), false);
});

// Guard rails against predicate drift beyond the six required cases.
test("isFounder: null user → false", () => {
  assert.equal(isFounder(null), false);
});

test("isFounder: 'Founder' (wrong case) is NOT founder — exact string match, mirrors BE", () => {
  assert.equal(isFounder({ plan: "Founder" }), false);
  assert.equal(isFounder({ tier: "FOUNDER" }), false);
});