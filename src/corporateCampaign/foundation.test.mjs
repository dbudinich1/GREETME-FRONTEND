// Frontend foundation unit tests. Run: node --test src/corporateCampaign
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultFeaturedSpreadConfig,
  featuredSpreadReducer,
  validateFeaturedSpreadConfig,
  deriveFeaturedPresence,
  corporateVideoUnavailable,
  ACTIONS,
} from "./featuredSpreadModel.js";
import { deriveFeaturedSpreadReadiness, deriveReadyToSend } from "./readiness.js";
import { deriveScreenOrder, SCREENS } from "./screenOrder.js";
import { FEATURED_SPREAD_READINESS as R, APPROVAL_STATUS, ANIMATION_IMAGE_SOURCE } from "./constants.js";

test("FE: default config is valid Phase A; corporate video is unavailable", () => {
  assert.equal(validateFeaturedSpreadConfig(defaultFeaturedSpreadConfig(), { phase: "A" }).valid, true);
  assert.equal(corporateVideoUnavailable(), true);
});

test("FE: reducer enforces animation/video mutual exclusion and refuses video enable", () => {
  let s = defaultFeaturedSpreadConfig();
  s = featuredSpreadReducer(s, { type: ACTIONS.TOGGLE_CORPORATE_VIDEO });
  assert.equal(s.corporateVideoEnabled, false); // Phase A refuses
  s = featuredSpreadReducer(s, { type: ACTIONS.TOGGLE_ADDITIONAL_IMAGES });
  assert.equal(s.additionalImagesEnabled, true);
  s = featuredSpreadReducer(s, { type: ACTIONS.TOGGLE_ANIMATION }); // turn off
  assert.equal(s.animatedMessageEnabled, false);
  assert.equal(deriveFeaturedPresence(s), true); // images still on
});

test("FE: readiness + readyToSend mirror backend", () => {
  const imagesOnly = { animatedMessageEnabled: false, additionalImagesEnabled: true, additionalImageRefs: ["blob://a"] };
  assert.equal(deriveFeaturedSpreadReadiness(imagesOnly, {}), R.READY_CUSTOMIZED);
  const allOff = { animatedMessageEnabled: false, additionalImagesEnabled: false };
  assert.equal(deriveFeaturedSpreadReadiness(allOff, {}), R.READY_INTRO_FINALE_ONLY);
  const orgDefault = { animatedMessageEnabled: true, animationImageSource: ANIMATION_IMAGE_SOURCE.ORGANIZATION_DEFAULT };
  assert.equal(
    deriveReadyToSend({ featuredSpreadReadiness: deriveFeaturedSpreadReadiness(orgDefault, { defaultPhotoValid: true, authorizedVoiceValid: true }), approvalStatus: APPROVAL_STATUS.APPROVED }),
    true
  );
});

test("FE: screen order parity 5/4 and 4/3", () => {
  const five = deriveScreenOrder({ featuredPresent: true });
  assert.equal(five.screenCount, 5);
  assert.equal(five.dotCount, 4);
  const four = deriveScreenOrder({ featuredPresent: false });
  assert.equal(four.screenCount, 4);
  assert.equal(four.dotCount, 3);
  assert.equal(four.next(SCREENS.INTRO), "finale");
  assert.equal(four.pageOf(SCREENS.FINALE).label, "Page 3 of 3");
});
