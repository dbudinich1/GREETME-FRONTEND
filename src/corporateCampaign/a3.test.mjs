// Frontend Phase A3 unit tests (pure logic; components are lint-checked separately).
// Run: node --test src/corporateCampaign/a3.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { deriveFeaturedSpreadReadiness } from "./readiness.js";
import { defaultFeaturedSpreadConfig, featuredSpreadReducer, ACTIONS } from "./featuredSpreadModel.js";
import { readinessLabel, defaultStateNotice, availableActions } from "./campaignEditorModel.js";
import { ANIMATION_IMAGE_SOURCE, FEATURED_SPREAD_READINESS as R, APPROVAL_STATUS, LOCK_STATUS } from "./constants.js";
import { resolveScreenOrder, dotScreens, PERSONAL_SCREEN_ORDER } from "../components/GreetingCardProto/resolveScreenOrder.js";

const okSignals = { defaultPhotoValid: true, authorizedVoiceValid: true, voiceStale: false };
const cfg = (o = {}) => ({ ...defaultFeaturedSpreadConfig(), ...o });

// Frontend↔backend readiness PARITY: FE derivation yields the SAME state vocabulary the
// backend service returns (verified there in featuredSpread.test.mjs / corporateCampaignRoutes.test.mjs).
test("FE readiness parity: org-default / needs-photo / needs-voice / images-only / intro-finale-only", () => {
  assert.equal(deriveFeaturedSpreadReadiness(cfg({ animatedMessageEnabled: true }), okSignals), R.READY_ORG_DEFAULT);
  assert.equal(deriveFeaturedSpreadReadiness(cfg({ animatedMessageEnabled: true }), { ...okSignals, defaultPhotoValid: false }), R.NEEDS_DEFAULT_PHOTO);
  assert.equal(deriveFeaturedSpreadReadiness(cfg({ animatedMessageEnabled: true }), { ...okSignals, authorizedVoiceValid: false }), R.NEEDS_AUTHORIZED_VOICE);
  assert.equal(deriveFeaturedSpreadReadiness(cfg({ animatedMessageEnabled: false, additionalImagesEnabled: true, additionalImageRefs: ["blob://a"] }), {}), R.READY_CUSTOMIZED);
  assert.equal(deriveFeaturedSpreadReadiness(cfg({ animatedMessageEnabled: false, additionalImagesEnabled: true, additionalImageRefs: [] }), {}), R.NEEDS_IMAGES);
  assert.equal(deriveFeaturedSpreadReadiness(cfg({ animatedMessageEnabled: false, additionalImagesEnabled: false }), {}), R.READY_INTRO_FINALE_ONLY);
});

// Reducer: mutual exclusion + video never functional.
test("FE reducer: animation/video mutually exclusive; video refuses to enable", () => {
  let s = defaultFeaturedSpreadConfig();
  s = featuredSpreadReducer(s, { type: ACTIONS.TOGGLE_CORPORATE_VIDEO });
  assert.equal(s.corporateVideoEnabled, false);
  s = featuredSpreadReducer(s, { type: ACTIONS.TOGGLE_ADDITIONAL_IMAGES });
  assert.equal(s.additionalImagesEnabled, true);
});

// Editor model: labels, notice, action availability.
test("FE editor model: readiness labels + default notice + action availability", () => {
  assert.equal(readinessLabel(R.READY_ORG_DEFAULT).label, "Ready — Organization Default");
  assert.equal(readinessLabel(R.NEEDS_IMAGES).kind, "blocker");
  assert.match(defaultStateNotice(cfg({ animatedMessageEnabled: false, additionalImagesEnabled: false })), /Intro and Finale only/);
  assert.match(defaultStateNotice(cfg({ animatedMessageEnabled: true, animationImageSource: ANIMATION_IMAGE_SOURCE.ORGANIZATION_DEFAULT })), /default photo and authorized voice/);
  // draft + ready → can approve; approved → can lock; locked → can unlock only
  const draftReady = availableActions({ approvalStatus: APPROVAL_STATUS.DRAFT, lockStatus: LOCK_STATUS.UNLOCKED, featuredSpreadReadiness: R.READY_ORG_DEFAULT });
  assert.equal(draftReady.canApprove, true);
  assert.equal(draftReady.canLock, false);
  const approved = availableActions({ approvalStatus: APPROVAL_STATUS.APPROVED, lockStatus: LOCK_STATUS.UNLOCKED, featuredSpreadReadiness: R.READY_ORG_DEFAULT });
  assert.equal(approved.canLock, true);
  const locked = availableActions({ approvalStatus: APPROVAL_STATUS.APPROVED, lockStatus: LOCK_STATUS.LOCKED, featuredSpreadReadiness: R.READY_ORG_DEFAULT });
  assert.equal(locked.canEdit, false);
  assert.equal(locked.canUnlock, true);
  // blocker readiness → cannot approve/lock
  const blocked = availableActions({ approvalStatus: APPROVAL_STATUS.DRAFT, lockStatus: LOCK_STATUS.UNLOCKED, featuredSpreadReadiness: R.NEEDS_IMAGES });
  assert.equal(blocked.canApprove, false);
});

// Content-derived screen order: personal identical (5/4), corporate all-disabled (4/3).
test("FE screen order: personal 5 screens / 4 dots; corporate all-disabled 4 / 3", () => {
  const personal = resolveScreenOrder({ recipientName: "Alex" });
  assert.deepEqual(personal, [...PERSONAL_SCREEN_ORDER]);
  assert.equal(personal.length, 5);
  assert.equal(dotScreens(personal).length, 4);
  assert.ok(!dotScreens(personal).includes("envelope"));

  const corpFull = resolveScreenOrder({ corporate: true, featuredSpreadPresent: true });
  assert.equal(corpFull.length, 5); // corporate WITH featured keeps 5

  const allOff = resolveScreenOrder({ corporate: true, featuredSpreadPresent: false });
  assert.deepEqual(allOff, ["envelope", "cover", "interior", "finale"]);
  assert.equal(allOff.length, 4);
  assert.equal(dotScreens(allOff).length, 3);
  assert.ok(!allOff.includes("featured")); // featured omitted entirely
});
