// src/corporateCampaign/readiness.js
//
// Featured-Spread readiness + readyToSend derivation (frontend mirror). Pure logic.
// UNMOUNTED. Mirrors backend services/corporateCampaign/featuredSpread.js exactly.

import {
  ANIMATION_IMAGE_SOURCE,
  FEATURED_SPREAD_READINESS as R,
  READY_STATES,
  APPROVAL_STATUS,
  LOCK_STATUS,
} from "./constants.js";
import { deriveFeaturedPresence } from "./featuredSpreadModel.js";

export function deriveFeaturedSpreadReadiness(config, signals = {}) {
  if (signals.assetFailed === true) return R.FAILED;
  if (signals.assetProcessing === true) return R.PROCESSING;
  if (!deriveFeaturedPresence(config)) return R.READY_INTRO_FINALE_ONLY;

  const animated = config.animatedMessageEnabled === true;
  const images = config.additionalImagesEnabled === true;
  const refs = Array.isArray(config.additionalImageRefs) ? config.additionalImageRefs : [];

  if (animated) {
    const usesOrgDefault = config.animationImageSource === ANIMATION_IMAGE_SOURCE.ORGANIZATION_DEFAULT;
    if (usesOrgDefault) {
      if (signals.defaultPhotoValid !== true) return R.NEEDS_DEFAULT_PHOTO;
    } else if (!isPresentRef(config.animationImageRef)) {
      return R.NEEDS_IMAGE;
    }
    if (signals.authorizedVoiceValid !== true || signals.voiceStale === true) return R.NEEDS_AUTHORIZED_VOICE;
    if (images && refs.length === 0) return R.NEEDS_IMAGES;
    return usesOrgDefault && !images ? R.READY_ORG_DEFAULT : R.READY_CUSTOMIZED;
  }

  if (images) {
    if (refs.length === 0) return R.NEEDS_IMAGES;
    return R.READY_CUSTOMIZED;
  }
  return R.READY_INTRO_FINALE_ONLY;
}

export function deriveReadyToSend({
  featuredSpreadReadiness,
  approvalStatus,
  lockStatus,
  isScheduledSend = false,
  campaignSchedulingRequirementsPass = true,
} = {}) {
  const readinessOk = READY_STATES.includes(featuredSpreadReadiness);
  const approvalOk = approvalStatus === APPROVAL_STATUS.APPROVED;
  const lockOk = isScheduledSend ? lockStatus === LOCK_STATUS.LOCKED : true;
  const schedulingOk = campaignSchedulingRequirementsPass !== false;
  return readinessOk && approvalOk && lockOk && schedulingOk;
}

function isPresentRef(ref) {
  if (typeof ref === "string") return ref.length > 0;
  if (ref && typeof ref === "object") return true;
  return false;
}
