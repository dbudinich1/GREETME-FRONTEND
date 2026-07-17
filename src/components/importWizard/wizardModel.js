// src/components/importWizard/wizardModel.js
//
// TEAM A — Contact Import Wizard mode/commit state machine. Pure, Node-testable. Reuses the
// Phase A5 membership resolution so corporate context comes ONLY from active memberships —
// never from a user id. Encodes: personal vs corporate ownership, demo no-write isolation,
// multi-org selection gating, and commit eligibility (incl. the current backend gaps).

import { resolveOrganizationContext } from "../corporateCampaign/campaignSurfaceModel.js";
import { normalizeEmail } from "../../import/importCore.js";

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

// ---- Existing-recipient awareness (preview↔persistence consistency) ----
// The wizard preview must reflect recipients the user ALREADY has, so an already-present email
// previews as a duplicate (skipped) instead of silently entering toCreate and failing at commit
// with the backend's "Email already exists". These helpers are pure + Node-testable; the network
// call itself stays in the component.

// Pull the contacts array out of an api.getContacts() response. Returns null for an unrecognized
// shape so the caller can FAIL CLOSED (never treat "couldn't read" as "no existing contacts").
export function extractContactsArray(response) {
  if (Array.isArray(response)) return response;
  if (response && Array.isArray(response.data)) return response.data;              // { data: [...] } (getContacts shape)
  if (response && Array.isArray(response.contacts)) return response.contacts;
  if (response && response.data && Array.isArray(response.data.contacts)) return response.data.contacts;
  return null;
}

// Normalize + de-duplicate existing recipient emails (case-insensitive, whitespace-safe via
// importCore.normalizeEmail). Empties are dropped.
export function normalizeExistingEmails(contacts = []) {
  const seen = new Set();
  const out = [];
  for (const c of contacts || []) {
    const e = normalizeEmail(c && c.email);
    if (e && !seen.has(e)) { seen.add(e); out.push(e); }
  }
  return out;
}

// Resolve existing emails from a raw api.getContacts() response with FAIL-CLOSED semantics:
//   { ok:true,  emails:[...] } on a recognized success (an empty account legitimately → [])
//   { ok:false, emails:[]    } on network/401/404 ({ ok:false }) or an unrecognized shape.
// A throw (403/429/5xx) is handled by the caller's try/catch → also fail closed.
export function existingEmailsFromResponse(response) {
  if (response && response.ok === false) return { ok: false, emails: [] };
  const list = extractContactsArray(response);
  if (list == null) return { ok: false, emails: [] };
  return { ok: true, emails: normalizeExistingEmails(list) };
}

// Truthful commit-summary classification: backend "Email already exists" outcomes are NOT
// failures the user must act on — they are recipients already present. Split them out of the
// ambiguous "needs attention" bucket.
export function classifyImportSummary(summary = {}) {
  const errors = Array.isArray(summary.errors) ? summary.errors : [];
  const alreadyPresent = errors.filter((e) => /already exists/i.test((e && e.error) || "")).length;
  const failed = Number(summary.failed || 0);
  return {
    added: Number(summary.added || 0),
    updated: Number(summary.updated || 0),
    skipped: Number(summary.skipped || 0),
    alreadyPresent,
    needsAttention: Math.max(0, failed - alreadyPresent),
  };
}

// The wizard's ordered steps.
export const STEPS = Object.freeze(["mode", "context", "upload", "map", "preview", "commit", "summary"]);
