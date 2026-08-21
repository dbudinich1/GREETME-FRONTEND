// src/components/importWizard/wizardModel.js
//
// TEAM A — Contact Import Wizard mode/commit state machine. Pure, Node-testable. Reuses the
// Phase A5 membership resolution so corporate context comes ONLY from active memberships —
// never from a user id. Encodes: personal vs corporate ownership, demo no-write isolation,
// multi-org selection gating, and commit eligibility (incl. the current backend gaps).

import { resolveOrganizationContext } from "../corporateCampaign/campaignSurfaceModel.js";
import { normalizeEmail, summarizeImport } from "../../import/importCore.js";

export const MODES = Object.freeze({ PERSONAL: "personal", CORPORATE: "corporate", DEMO: "demo" });

// Corporate organization context (delegated to the audited Phase A5 resolver).
export function corporateContext(membershipResult, selectedOrgId = null) {
  return resolveOrganizationContext(membershipResult, selectedOrgId);
}

// Map an org context to a routing decision for the "Organization Contacts" CTA:
//   loading    — memberships still resolving
//   dormant    — corporate feature is off → a usable, truthful fail-closed state (recoverable)
//   ineligible — authenticated but not an active org member → the Business/membership entry
//   select_org — active member of multiple orgs → choose one
//   ready      — an active org is resolved → the existing corporate import flow
//   error      — unexpected/unauthorized → a recoverable error state
export function corporateRoute(ctx) {
  const phase = ctx && ctx.phase;
  if (phase === "loading") return "loading";
  if (phase === "dormant") return "dormant";
  if (phase === "ready") return "ready";
  if (phase === "select_org") return "select_org";
  if (phase === "no_org" || phase === "unauthorized") return "ineligible";
  return "error";
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

// SLICE E5 - attach the OCCASION DATES to a processed contact.
//
// processRow reads birthday for age validation but deliberately leaves it out of `contact`:
// normalization is its job, transmission is the caller's. The personal path already makes that
// decision in buildPersonalImportContacts; this is the corporate equivalent, and it carries the
// hire date too.
//
// Both matter for the same reason. The corporate importer derives occasions[] from these raw
// values, and the scheduler matches contacts to campaigns BY OCCASION TYPE - so a corporate
// import without them produces contacts that no Birthdays or Work Anniversaries campaign can
// ever reach. Values are passed through raw; the server owns parsing and rejects a bare month-day.
export function withOccasionDates(contact, raw = {}, map = {}) {
  const pick = (field) => {
    const col = map[field];
    if (col == null) return undefined;
    const v = raw[col];
    return v != null && String(v).trim() !== "" ? v : undefined;
  };
  const birthday = pick("birthday");
  const hireDate = pick("hireDate");
  return {
    ...contact,
    ...(birthday !== undefined ? { birthday } : {}),
    ...(hireDate !== undefined ? { hireDate } : {}),
  };
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

// ---- Commit-outcome classification (FAIL CLOSED) ----
// The import commit must NEVER render "Import complete" for a failed/unrecognized response. A
// success summary is shown ONLY when the response carries a recognized results body
// ({imported|added|errors}). Everything else — non-2xx, {ok:false}, thrown error (surfaced as
// {ok:false,status}), network failure, and empty/malformed 2xx bodies — is a hard failure with a
// clear, status-specific message. Pure + Node-testable.
export const COMMIT_MESSAGES = Object.freeze({
  401: "Your session expired. Please sign in again.",
  403: "Recipient/import limit reached.",
  429: "Too many requests. Please wait and try again.",
  generic: "Import failed. Please try again.",
});
export function commitMessageForStatus(status) {
  return COMMIT_MESSAGES[status] || COMMIT_MESSAGES.generic;
}

// §4.1 — the per-import contact cap (mirrors import/importCore.js IMPORT_REQUEST_MAX, itself
// coupled to the backend CONTACTS_IMPORT_MAX) and the existing five-imports-per-hour limiter
// (BACKEND middleware/rateLimiters.js rlContactsImport). Display constants only; enforcement lives
// in api.importContacts. No limiter or cap is changed here.
export const IMPORT_REQUEST_MAX_LABEL = 100;
export const IMPORT_RATE_LIMIT_PER_HOUR = 5;

// Over-cap copy (§4.1): states the per-import limit, the actual selected count, and the remedy —
// split into files of 100 or fewer. The selection is never silently truncated.
export function overCapMessage(count, max = IMPORT_REQUEST_MAX_LABEL) {
  const n = Number(count) || 0;
  return `You selected ${n} contacts, but each import is limited to ${max} at a time. Please split your list into files of ${max} or fewer and import each one.`;
}

// 429 copy (§4.1): a real rate-limit failure that NAMES the limit and the reset window.
export function rateLimitMessage(retryAfterSeconds) {
  const secs = Number(retryAfterSeconds);
  let when = "Please wait for the limit to reset and try again.";
  if (Number.isFinite(secs) && secs > 0) {
    const mins = Math.ceil(secs / 60);
    when = `Please try again in about ${mins} minute${mins === 1 ? "" : "s"}.`;
  }
  return `Import limit reached: ${IMPORT_RATE_LIMIT_PER_HOUR} imports per hour. ${when}`;
}

// A response body is a recognized SUCCESSFUL import result only if it carries at least one of the
// count/error fields the backend returns ({ imported | added | errors }). This rejects error
// envelopes ({ok:false,...}) and empty/partial 2xx bodies ({}, {ok:true} with no data).
function isRecognizedResultsBody(body) {
  return !!body && (typeof body.imported === "number" || typeof body.added === "number" || Array.isArray(body.errors));
}

// `res` is whatever commitPersonal holds after its try/catch: a 2xx body, a returned {ok:false,status}
// (401/404/network), or a thrown error rebuilt as {ok:false,status,error}. Returns:
//   { status: "success", summary }   — recognized results body (any counts, incl. all-skipped)
//   { status: "error",   message }   — fail closed for everything else
export function classifyCommitOutcome(res) {
  // §4.1 over-cap: the >100 selection was blocked BEFORE any request was sent (api.importContacts).
  if (res && res.blocked && res.code === "IMPORT_OVER_CAP") {
    return { status: "error", message: overCapMessage(res.count, res.max) };
  }
  if (!res || res.ok === false) {
    // Non-2xx / thrown / network / {ok:false} — NEVER rendered as success.
    if (res && res.status === 429) {
      return { status: "error", message: rateLimitMessage(res.retryAfter) };
    }
    return { status: "error", message: commitMessageForStatus(res && res.status) };
  }
  const body = (res && res.data != null) ? res.data : res;
  if (!isRecognizedResultsBody(body)) {
    return { status: "error", message: COMMIT_MESSAGES.generic }; // empty/malformed 2xx → fail closed
  }
  return { status: "success", summary: summarizeImport(res) };
}

// The wizard's ordered steps.
export const STEPS = Object.freeze(["mode", "context", "upload", "map", "preview", "commit", "summary"]);
