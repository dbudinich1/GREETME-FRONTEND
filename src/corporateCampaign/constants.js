// src/corporateCampaign/constants.js
//
// TEAM C — Corporate Campaign Featured Spread · Phase A1 frontend foundation.
//
// Isolated, UNMOUNTED constants + enums for the corporate-campaign editor foundation.
// NOT imported by App.jsx, the personal composer, or the recipient viewer in Phase A1.
// Pure data; safe to unit-test with node. Mirrors the backend contract terminology.

export const RECORD_TYPES = Object.freeze({
  CORPORATE_ORGANIZATION: "corporate_organization",
  CORPORATE_ORGANIZATION_MEMBERSHIP: "corporate_organization_membership",
  GREETING_AUTOMATION_CAMPAIGN: "greeting_automation_campaign",
});

export const ROLES = Object.freeze({
  OWNER: "owner",
  ADMIN: "admin",
  CAMPAIGN_MANAGER: "campaign_manager",
  VIEWER: "viewer",
});

export const MEMBERSHIP_STATUS = Object.freeze({
  ACTIVE: "active",
  SUSPENDED: "suspended",
  REMOVED: "removed",
});

export const ANIMATION_IMAGE_SOURCE = Object.freeze({
  ORGANIZATION_DEFAULT: "organization_default",
  CAMPAIGN_OVERRIDE: "campaign_override",
});

export const FEATURED_SPREAD_READINESS = Object.freeze({
  READY_ORG_DEFAULT: "ready_org_default",
  READY_CUSTOMIZED: "ready_customized",
  READY_INTRO_FINALE_ONLY: "ready_intro_finale_only",
  NEEDS_DEFAULT_PHOTO: "needs_default_photo",
  NEEDS_AUTHORIZED_VOICE: "needs_authorized_voice",
  NEEDS_IMAGE: "needs_image",
  NEEDS_IMAGES: "needs_images",
  PROCESSING: "processing",
  FAILED: "failed",
});

export const READY_STATES = Object.freeze([
  FEATURED_SPREAD_READINESS.READY_ORG_DEFAULT,
  FEATURED_SPREAD_READINESS.READY_CUSTOMIZED,
  FEATURED_SPREAD_READINESS.READY_INTRO_FINALE_ONLY,
]);

export const APPROVAL_STATUS = Object.freeze({ DRAFT: "draft", APPROVED: "approved", CHANGED: "changed" });
export const LOCK_STATUS = Object.freeze({ UNLOCKED: "unlocked", LOCKED: "locked" });

// The server-derived capability flag name the frontend receives (never trusts a local
// value). While the backend LAUNCH_CONTROL.campaignFeaturedSpreadEnabled is false, the
// editor stays inaccessible.
export const CAPABILITY_KEY = "campaignFeaturedSpreadEnabled";
