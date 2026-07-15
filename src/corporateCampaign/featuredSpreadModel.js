// src/corporateCampaign/featuredSpreadModel.js
//
// Isolated Featured-Spread editor state model + reducer + validation + derivations.
// UNMOUNTED in Phase A1 (no component imports it). Pure logic → node-testable. Mirrors the
// backend rules exactly (mutual exclusion, Phase A video rejection, presence derivation).

import { ANIMATION_IMAGE_SOURCE } from "./constants.js";

export function defaultFeaturedSpreadConfig() {
  return {
    animatedMessageEnabled: true,
    animationImageSource: ANIMATION_IMAGE_SOURCE.ORGANIZATION_DEFAULT,
    animationImageRef: null,
    corporateVideoEnabled: false, // Phase A: locked false
    corporateVideoRef: null,
    additionalImagesEnabled: false,
    additionalImageRefs: [],
  };
}

// Editor actions. Turning animation on forces video off and vice-versa (mutual exclusion);
// Phase A refuses to enable corporate video at all.
export const ACTIONS = Object.freeze({
  TOGGLE_ANIMATION: "TOGGLE_ANIMATION",
  SET_ANIMATION_SOURCE: "SET_ANIMATION_SOURCE",
  SET_ANIMATION_IMAGE_REF: "SET_ANIMATION_IMAGE_REF",
  TOGGLE_CORPORATE_VIDEO: "TOGGLE_CORPORATE_VIDEO", // Phase A: no-op (rejected)
  TOGGLE_ADDITIONAL_IMAGES: "TOGGLE_ADDITIONAL_IMAGES",
  SET_ADDITIONAL_IMAGE_REFS: "SET_ADDITIONAL_IMAGE_REFS",
  RESTORE_DEFAULT: "RESTORE_DEFAULT",
});

export function featuredSpreadReducer(state, action) {
  const s = { ...state };
  switch (action.type) {
    case ACTIONS.TOGGLE_ANIMATION: {
      const on = !s.animatedMessageEnabled;
      s.animatedMessageEnabled = on;
      if (on) {
        s.corporateVideoEnabled = false; // mutual exclusion
        s.corporateVideoRef = null;
      }
      return s;
    }
    case ACTIONS.SET_ANIMATION_SOURCE:
      s.animationImageSource = action.source;
      if (action.source === ANIMATION_IMAGE_SOURCE.ORGANIZATION_DEFAULT) s.animationImageRef = null;
      return s;
    case ACTIONS.SET_ANIMATION_IMAGE_REF:
      s.animationImageRef = action.ref || null;
      s.animationImageSource = action.ref
        ? ANIMATION_IMAGE_SOURCE.CAMPAIGN_OVERRIDE
        : ANIMATION_IMAGE_SOURCE.ORGANIZATION_DEFAULT;
      return s;
    case ACTIONS.TOGGLE_CORPORATE_VIDEO:
      // Phase A1: Corporate Video is unavailable — refuse to enable. No fake working state.
      s.corporateVideoEnabled = false;
      s.corporateVideoRef = null;
      return s;
    case ACTIONS.TOGGLE_ADDITIONAL_IMAGES:
      s.additionalImagesEnabled = !s.additionalImagesEnabled;
      return s;
    case ACTIONS.SET_ADDITIONAL_IMAGE_REFS:
      s.additionalImageRefs = Array.isArray(action.refs) ? action.refs : [];
      return s;
    case ACTIONS.RESTORE_DEFAULT:
      return defaultFeaturedSpreadConfig();
    default:
      return s;
  }
}

export function validateFeaturedSpreadConfig(config, { phase = "A" } = {}) {
  const errors = [];
  if (!config || typeof config !== "object") return { valid: false, errors: ["config_required"] };
  const animated = config.animatedMessageEnabled === true;
  const video = config.corporateVideoEnabled === true;
  const images = config.additionalImagesEnabled === true;
  if (animated && video) errors.push("animation_video_mutually_exclusive");
  if (phase === "A") {
    if (video) errors.push("corporate_video_not_available_in_phase_a");
    if (config.corporateVideoRef != null) errors.push("corporate_video_ref_must_be_null_in_phase_a");
  }
  if (config.additionalImageRefs != null && !Array.isArray(config.additionalImageRefs)) {
    errors.push("additional_image_refs_must_be_array");
  }
  if (images && !Array.isArray(config.additionalImageRefs)) errors.push("additional_images_enabled_requires_array");
  return { valid: errors.length === 0, errors };
}

// PRESENCE — derived, never stored.
export function deriveFeaturedPresence(config) {
  if (!config) return false;
  return (
    config.animatedMessageEnabled === true ||
    config.corporateVideoEnabled === true ||
    config.additionalImagesEnabled === true
  );
}

// Whether the corporate-video control should render as unavailable (Phase A always true).
export function corporateVideoUnavailable() {
  return true;
}
