// src/utils/profileDeleteBlockers.test.mjs - Release 2b (MILESTONE-release2b-photo-delete-blocker.md).
// Run (Node 20.x): node --test src/utils/profileDeleteBlockers.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { describeProfileAssetInUse } from "./profileDeleteBlockers.js";

const inUse = (data) => Object.assign(new Error("A Greet-Me or campaign still needs this."), { status: 409, code: "PROFILE_ASSET_IN_USE", data: { code: "PROFILE_ASSET_IN_USE", ...data } });

test("not the in-use refusal -> null (caller keeps its own message)", () => {
  assert.equal(describeProfileAssetInUse(Object.assign(new Error("x"), { status: 502, code: "PROFILE_DELETE_FAILED" })), null);
  assert.equal(describeProfileAssetInUse(null), null);
  assert.equal(describeProfileAssetInUse(Object.assign(new Error("x"), { code: "PROFILE_ASSET_IN_USE" })), null, "no detail at all: the server text stays");
});

test("corporate campaign with name and date (the founder's case)", () => {
  const s = describeProfileAssetInUse(inUse({ inUseBy: "corporate_campaign", blockers: [{ kind: "corporate_campaign", scheduledForUtc: "2027-09-02T07:00:00.000Z", campaignName: "Preflight" }] }));
  assert.match(s, /^Your corporate campaign "Preflight" still uses this photo for a greeting scheduled for September 2, 2027/);
  assert.match(s, /Switch that campaign off or remove it, then try again\.$/);
});

test("corporate match with no detail (another account's record) never invents any", () => {
  const s = describeProfileAssetInUse(inUse({ inUseBy: "corporate_campaign", blockers: [{ kind: "corporate_campaign", scheduledForUtc: null, campaignName: null }] }));
  assert.equal(s, "A corporate campaign still uses this photo as its sender photo, so it can't be deleted yet.");
});

test("queued send, voice wording, and the 'more' count", () => {
  const s = describeProfileAssetInUse(inUse({ inUseBy: "queued_send", blockers: [
    { kind: "queued_send", scheduledForUtc: "2026-10-08T13:00:00.000Z", occasionType: "work_anniversary" },
    { kind: "corporate_campaign", scheduledForUtc: null, campaignName: null },
  ] }), "voice");
  assert.match(s, /^A work anniversary greeting scheduled for October 8, 2026/);
  assert.match(s, /is about to send with this voice recording\./);
  assert.match(s, /\(1 more scheduled greeting also uses it\.\)$/);
});

test("older server (inUseBy only) still gets a specific sentence", () => {
  assert.match(describeProfileAssetInUse(inUse({ inUseBy: "corporate_campaign" })), /^A corporate campaign still uses this photo/);
  assert.match(describeProfileAssetInUse(inUse({ inUseBy: "queued_send" })), /^A greeting that is about to send still uses this photo/);
});

test("T5 D2: a corporate greeting already QUEUED says 'try again after it has been sent', never 'switch it off'", () => {
  const s = describeProfileAssetInUse(inUse({ inUseBy: "corporate_campaign", blockers: [{ kind: "corporate_campaign", scheduledForUtc: "2027-09-02T07:00:00.000Z", campaignName: "Preflight", status: "queued" }] }));
  assert.match(s, /^A greeting from your corporate campaign "Preflight" scheduled for September 2, 2027/);
  assert.match(s, /is about to send with this photo\. Try again after it has been sent\.$/);
  assert.doesNotMatch(s, /Switch that campaign off/);
  const v = describeProfileAssetInUse(inUse({ inUseBy: "corporate_campaign", blockers: [{ kind: "corporate_campaign", scheduledForUtc: null, campaignName: null, status: "queued" }] }), "voice");
  assert.equal(v, "A greeting from one of your corporate campaigns is about to send with this voice recording. Try again after it has been sent.");
  // A still-waiting occurrence keeps the switch-off advice (it works for that one).
  const w = describeProfileAssetInUse(inUse({ inUseBy: "corporate_campaign", blockers: [{ kind: "corporate_campaign", scheduledForUtc: "2027-09-02T07:00:00.000Z", campaignName: "Preflight", status: "scheduled" }] }));
  assert.match(w, /Switch that campaign off or remove it, then try again\.$/);
});
