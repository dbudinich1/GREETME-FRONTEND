// src/components/importWizard/wizardModel.js
//
// TEAM A — Contact Import Wizard mode/commit state machine. Pure, Node-testable. Reuses the
// Phase A5 membership resolution so corporate context comes ONLY from active memberships —
// never from a user id. Encodes: personal vs corporate ownership, demo no-write isolation,
// multi-org selection gating, and commit eligibility (incl. the current backend gaps).

import { resolveOrganizationContext } from "../corporateCampaign/campaignSurfaceModel.js";

export const MODES = Object.freeze({ PERSONAL: "personal", CORPORATE: "corporate", DEMO: "demo" });

// Corporate organization context (delegated to the audited Phase A5 resolver).
export function corporateContext(membershipResult, selectedOrgId = null) {
  return resolveOrganizationContext(membershipResult, selectedOrgId);
}

// What a commit targets. NEVER returns a user id as a corporate org id; demo never writes.
export function commitTarget(mode, { orgId } = {}) {
  if (mode === MODES.PERSONAL) return { kind: "personal", write: true };
  if (mode === MODES.CORPORATE) return { kind: "corporate", orgId: orgId || null, write: !!orgId };
  return { kind: "demo", write: false };
}

// Gate advancing from mode-select to file upload / dataset load.
export function canSelectFile(mode, ctx) {
  if (mode === MODES.PERSONAL || mode === MODES.DEMO) return true;
  return !!(ctx && ctx.phase === "ready"); // corporate requires a resolved active organization
}

// Commit eligibility. Demo never commits real data; corporate requires an org AND a backend
// endpoint that does not yet exist (documented gap); personal commits via the existing endpoint.
export function commitDecision(mode, plan, { orgId } = {}) {
  if (mode === MODES.DEMO) return { allowed: false, reason: "demo_no_write" };
  const pending = plan ? plan.toCreate.length + (plan.toUpdate ? plan.toUpdate.length : 0) : 0;
  if (pending === 0) return { allowed: false, reason: "nothing_to_import" };
  if (mode === MODES.CORPORATE) {
    if (!orgId) return { allowed: false, reason: "org_required" };
    return { allowed: false, reason: "corporate_endpoint_pending" };
  }
  return { allowed: true, reason: "ok" };
}

// Build the personal-import payload from preview rows. Transmits EVERY field the existing
// personal importer recognizes so the backend can derive the birthday occasion + persist
// enrichment — nothing is silently dropped. Birthday is read from the raw mapped column (not the
// processed contact, which omits it) so the FULL date reaches the server; the backend derives the
// manual-shape occasion and, for personal scope, sets autoSend:true. Pure + Node-testable.
export function buildPersonalImportContacts(rows = []) {
  return (rows || []).map((r) => {
    const c = (r && r.contact) || {};
    const raw = (r && r.__raw) || {};
    const map = (r && r.__map) || {};
    const birthday = map.birthday != null ? raw[map.birthday] : undefined;
    const out = {
      name: c.fullName || "",
      email: c.email || "",
      phone: c.phone || "",
      relationship: c.relationship || "",
      company: c.company || "",
      department: c.department || "",
      recipientType: c.recipientType || "",
      consent: c.consent || "",
      source: c.source || "",
      notes: c.notes || "",
    };
    if (birthday != null && String(birthday).trim() !== "") out.birthday = birthday;
    return out;
  });
}

// The wizard's ordered steps.
export const STEPS = Object.freeze(["mode", "context", "upload", "map", "preview", "commit", "summary"]);
