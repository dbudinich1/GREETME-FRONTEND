// src/corporateCampaign/campaignFeaturedMedia.js
//
// LANE 3 — how a For Business campaign's featured-media choice maps onto the campaign's EXISTING
// storage: `featuredSpreadConfig`, written through PATCH .../featured-spread. Pure logic.
//
// NO ORGANIZATION DEFAULT (founder correction, 2026-10-28). A campaign shows only media it has
// explicitly chosen. A saved config that relied on "organization_default" (the owner's profile
// photo and voice) is read as "No featured media" — nothing is inherited. Nothing saved is deleted
// or migrated either: the stored fields are kept exactly as they are until the campaign is saved.
//
// What the existing storage can hold is verified against the live backend (f5297c8,
// services/corporateCampaign/corporateCampaignService.js#sanitizeFeaturedSpreadConfig): it keeps
// only animatedMessageEnabled, animationImageSource, animationImageRef, additionalImagesEnabled
// and additionalImageRefs, forces corporate video off (and REFUSES a video with a 400), and has
// no field for a campaign voice, a static photo with voice, or a message. So today a campaign can
// save "No featured media"; the other three choices can be built and previewed, and their save is
// refused here with the reason, rather than sent and silently dropped by the server.

import { ANIMATION_IMAGE_SOURCE } from "./constants.js";
import {
  MEDIA_MODES, emptySelection, normalizeMode, validateSelection,
} from "../components/personalization/featuredMediaModel.js";

export const CAMPAIGN_SAVE_REASONS = Object.freeze({
  [MEDIA_MODES.ANIMATE]: "Campaigns can't store their own voice yet, so an animated photo can be previewed here but not saved.",
  [MEDIA_MODES.STATIC]: "Campaigns can't store a static photo yet, so it can be previewed here but not saved.",
  [MEDIA_MODES.VIDEO]: "Campaigns can't store a personal video yet, so it can be previewed here but not saved.",
});

export const CAMPAIGN_MESSAGE_NOTE = "Your message shows in the preview. Campaigns can't store a message yet, so it isn't saved.";

const DEFAULTS = Object.freeze({
  animatedMessageEnabled: false,
  animationImageSource: ANIMATION_IMAGE_SOURCE.CAMPAIGN_OVERRIDE,
  animationImageRef: null,
  corporateVideoEnabled: false,
  corporateVideoRef: null,
  additionalImagesEnabled: false,
  additionalImageRefs: [],
});

// The campaign's EXPLICIT choice, read from what it has stored. Only an animated photo the
// campaign itself chose (campaign_override + its own image ref) counts as featured media.
export function selectionFromCampaignConfig(config) {
  const c = config && typeof config === "object" ? config : null;
  if (
    c && c.animatedMessageEnabled === true &&
    c.animationImageSource === ANIMATION_IMAGE_SOURCE.CAMPAIGN_OVERRIDE &&
    typeof c.animationImageRef === "string" && c.animationImageRef.length > 0
  ) {
    return {
      ...emptySelection(),
      mode: MEDIA_MODES.ANIMATE,
      photo: { url: c.animationImageRef, source: "campaign", durable: true },
    };
  }
  return emptySelection(); // includes the retired organization-default config: nothing is inherited
}

// Whether the stored config still carries the retired organization-default animation (read as
// "No featured media" above). Used only to tell the reader why the saved state reads as none.
export function usesRetiredOrganizationDefault(config) {
  return !!config && config.animatedMessageEnabled === true &&
    config.animationImageSource !== ANIMATION_IMAGE_SOURCE.CAMPAIGN_OVERRIDE;
}

export function campaignSaveSupport(selection) {
  const mode = normalizeMode(selection && selection.mode);
  const notes = [];
  if (selection && typeof selection.message === "string" && selection.message.trim()) notes.push(CAMPAIGN_MESSAGE_NOTE);
  if (mode === MEDIA_MODES.NONE) return { savable: true, reason: null, notes };
  return { savable: false, reason: CAMPAIGN_SAVE_REASONS[mode] || null, notes };
}

// The PATCH body for a savable choice. Every stored field is carried forward unchanged except the
// one the choice decides, so a save never deletes a saved reference.
export function campaignFeaturedSpreadBody(selection, previousConfig) {
  const support = campaignSaveSupport(selection);
  if (!support.savable) return { ok: false, reason: support.reason };
  const { valid, errors } = validateSelection(selection);
  if (!valid) return { ok: false, reason: errors.join(",") };
  const prev = previousConfig && typeof previousConfig === "object" ? previousConfig : {};
  const config = {
    ...DEFAULTS,
    ...prev,
    animatedMessageEnabled: false,
    corporateVideoEnabled: false, // the server refuses anything else
    corporateVideoRef: null,
    additionalImageRefs: Array.isArray(prev.additionalImageRefs) ? prev.additionalImageRefs : [],
  };
  // The server reads `body.featuredSpreadConfig` (routes/corporateCampaignRoutes.js -> updateFeaturedSpread).
  return { ok: true, body: { featuredSpreadConfig: config } };
}

export function savedChoiceLabel(config) {
  const s = selectionFromCampaignConfig(config);
  return s.mode === MEDIA_MODES.ANIMATE ? "Animate a photo" : "No featured media";
}
