// src/corporateCampaign/campaignEditorModel.js
//
// TEAM C — Phase A3: pure presentation model for the Campaign Featured Spread editor.
// No React → unit-testable. The component consumes these; readiness is NEVER fabricated
// here — it is passed in from the server-derived contract.

import { FEATURED_SPREAD_READINESS as R, READY_STATES, APPROVAL_STATUS, LOCK_STATUS, ANIMATION_IMAGE_SOURCE } from "./constants.js";

export const READINESS_LABELS = Object.freeze({
  [R.READY_ORG_DEFAULT]: { label: "Ready — Organization Default", kind: "ready" },
  [R.READY_CUSTOMIZED]: { label: "Ready — Customized", kind: "ready" },
  [R.READY_INTRO_FINALE_ONLY]: { label: "Ready — Intro and Finale Only", kind: "ready" },
  [R.NEEDS_DEFAULT_PHOTO]: { label: "Needs Default Photo", kind: "blocker" },
  [R.NEEDS_AUTHORIZED_VOICE]: { label: "Needs Authorized Voice", kind: "blocker" },
  [R.NEEDS_IMAGE]: { label: "Needs Image", kind: "blocker" },
  [R.NEEDS_IMAGES]: { label: "Needs Images", kind: "blocker" },
  [R.PROCESSING]: { label: "Processing", kind: "processing" },
  [R.FAILED]: { label: "Failed", kind: "blocker" },
});

export function readinessLabel(readiness) {
  return READINESS_LABELS[readiness] || { label: String(readiness || "unknown"), kind: "unknown" };
}

// Corporate Video is unavailable this release — labeled, never functional.
export const CORPORATE_VIDEO = Object.freeze({ available: false, label: "Corporate Video Message", note: "Unavailable (proposed)" });

export function defaultStateNotice(config) {
  if (!config) return "";
  const anim = config.animatedMessageEnabled === true;
  const images = config.additionalImagesEnabled === true;
  if (!anim && config.corporateVideoEnabled !== true && !images) {
    return "This campaign will use the Intro and Finale only. You can add a Featured Spread anytime.";
  }
  if (anim && config.animationImageSource === ANIMATION_IMAGE_SOURCE.ORGANIZATION_DEFAULT) {
    return "Using your organization's default photo and authorized voice.";
  }
  return "";
}

// Which actions are enabled, from the server-derived state. Never invents readiness.
export function availableActions({ approvalStatus, lockStatus, featuredSpreadReadiness } = {}) {
  const unlocked = lockStatus !== LOCK_STATUS.LOCKED;
  const isReady = READY_STATES.includes(featuredSpreadReadiness);
  return {
    canEdit: unlocked,
    canSaveDraft: unlocked,
    canApprove: unlocked && approvalStatus !== APPROVAL_STATUS.APPROVED && isReady,
    canLock: unlocked && approvalStatus === APPROVAL_STATUS.APPROVED && isReady,
    canUnlock: !unlocked,
    canReturn: true,
  };
}
