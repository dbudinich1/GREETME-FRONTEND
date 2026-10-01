// W38 FE - pure tests. Run: node --test src/pages/founder/effectiveSalesStatus.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { effectiveSalesStatus } from "./effectiveSalesStatus.js";

const LIVE = { referralPublicLive: true, attributionLive: true };

test("inactive wins regardless of switches", () => {
  for (const c of [LIVE, { referralPublicLive: false, attributionLive: false }, null]) {
    assert.equal(effectiveSalesStatus("inactive", c).key, "inactive");
  }
});
test("active + both switches on = Active", () => assert.equal(effectiveSalesStatus("active", LIVE).label, "Active"));
test("active + either switch off = paused, never 'live'", () => {
  for (const c of [{ referralPublicLive: false, attributionLive: true }, { referralPublicLive: true, attributionLive: false }]) {
    const e = effectiveSalesStatus("active", c);
    assert.equal(e.key, "active_paused");
    assert.match(e.label, /paused/);
  }
});
test("unreadable controls / status are not guessed", () => {
  assert.equal(effectiveSalesStatus("active", null).key, "active_unverified");
  assert.equal(effectiveSalesStatus("active", { referralPublicLive: "yes" }).key, "active_unverified");
  assert.equal(effectiveSalesStatus(undefined, LIVE).key, "unknown");
  assert.equal(effectiveSalesStatus("weird", LIVE).key, "unknown");
});
