// src/components/corporateCampaign/campaignSurfaceModel.js
//
// TEAM A — pure display/derivation model for the Greeting Automation Campaigns surface.
// Reuses Team C's READ-ONLY labels/actions (campaignEditorModel.js); NEVER fabricates
// readiness (all readiness comes from the server-derived contract). No React → node:test-able.

import { readinessLabel, availableActions, CORPORATE_VIDEO } from "../../corporateCampaign/campaignEditorModel.js";

// Canonical, approved terminology. Guarded by a test against forbidden terms.
export const TERMS = Object.freeze({
  SURFACE: "Greet-Me Automated Campaigns",
  FEATURED_SPREAD: "Campaign Featured Spread",
  CUSTOMIZE: "Customize Featured Spread",
  INTRO_FINALE: "Intro and Finale Only",
  RETURN: "Return to Campaign",
  CREATE: "Create Greet-Me Automated Campaign",
  YOU_DONT_NEED_EVERYTHING: "You don't need everything today.",
});

// Active memberships from the /memberships response. Defensive re-filter on status even
// though the server already scopes to active memberships. Requires a corporateOrganizationId.
export function activeMemberships(membershipResult) {
  if (!membershipResult || membershipResult.ok !== true) return [];
  const list = (membershipResult.data && membershipResult.data.memberships) || [];
  return Array.isArray(list)
    ? list.filter((m) => m && m.status === "active" && m.corporateOrganizationId)
    : [];
}

// Resolve the organization context ENTIRELY from the membership response — never from a user
// id, role, or list order. Preserves a still-valid prior selection; clears one that vanished.
//   phase: "loading" | "dormant" | "unauthorized" | "error" | "no_org" | "select_org" | "ready"
export function resolveOrganizationContext(membershipResult, prevSelectedOrgId = null) {
  if (!membershipResult) return { phase: "loading", memberships: [], selectedOrgId: null };
  if (membershipResult.dormant) return { phase: "dormant", memberships: [], selectedOrgId: null };
  if (membershipResult.unauthorized) return { phase: "unauthorized", memberships: [], selectedOrgId: null };
  if (membershipResult.ok !== true) return { phase: "error", memberships: [], selectedOrgId: null };

  const memberships = activeMemberships(membershipResult);
  if (memberships.length === 0) return { phase: "no_org", memberships, selectedOrgId: null };

  // Membership-change safety: keep a prior selection only if it is still active.
  const priorStillActive = prevSelectedOrgId && memberships.some((m) => m.corporateOrganizationId === prevSelectedOrgId);
  if (priorStillActive) return { phase: "ready", memberships, selectedOrgId: prevSelectedOrgId };

  if (memberships.length === 1) return { phase: "ready", memberships, selectedOrgId: memberships[0].corporateOrganizationId };

  // More than one active membership → explicit selection required; no auto-guess, no campaigns.
  return { phase: "select_org", memberships, selectedOrgId: null };
}

// Interpret an API client result into a surface capability verdict. `available` is the
// server-derived capability the editor's `capabilityEnabled` prop is wired to.
export function interpretCapability(result) {
  if (!result) return { available: false, dormant: false, unauthorized: false, conflict: false };
  if (result.dormant) return { available: false, dormant: true, unauthorized: false, conflict: false };
  if (result.unauthorized) return { available: false, dormant: false, unauthorized: true, conflict: false };
  return { available: result.ok === true, dormant: false, unauthorized: false, conflict: !!result.conflict };
}

// Turn a write result into a user-facing message. ETag conflicts → refresh/retry.
export function writeResultMessage(result) {
  if (!result) return null;
  if (result.dormant) return null; // surface hidden entirely
  if (result.unauthorized) return "You don't have access to this campaign.";
  if (result.conflict) return "This campaign changed in another session. Refresh and try again.";
  if (result.networkError) return "Network error. Please try again.";
  if (!result.ok) return "Something went wrong. Please try again.";
  return null;
}

// Derive the fields shown on a campaign card/row and in the detail header.
export function deriveCampaignSummary(campaign = {}, readiness = {}) {
  const rd = readinessLabel(readiness.featuredSpreadReadiness);
  const actions = availableActions(readiness);
  const present = readiness.featuredSpreadPresent;
  return {
    campaignId: campaign.campaignId || campaign.id || null,
    name: campaign.name || campaign.campaignName || "Untitled campaign",
    audience: campaign.audience || campaign.recipientType || "—",
    occasionType: campaign.occasionType || campaign.type || campaign.campaignType || "—",
    scheduleStatus: campaign.scheduleStatus || (campaign.scheduledForUtc ? "scheduled" : "not_scheduled"),
    featuredSpreadStatus: rd.label,
    featuredSpreadKind: rd.kind, // "ready" | "blocker" | "processing" | "unknown"
    approvalStatus: readiness.approvalStatus || campaign.approvalStatus || "draft",
    lockStatus: readiness.lockStatus || campaign.lockStatus || "unlocked",
    ready: rd.kind === "ready",
    // All three elements disabled → Featured Spread omitted → Intro and Finale Only.
    introFinaleOnly: present === false,
    actions,
  };
}

export { CORPORATE_VIDEO };
