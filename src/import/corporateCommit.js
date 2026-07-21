// src/import/corporateCommit.js
//
// TEAM A — Slice 2B-2B PURE commit model for the Corporate import. No React, no network, no globals;
// fully node-testable. Turns the SAME canonical preview rows Slice 2B-1 already displays into the
// backend's existing accepted envelope, classifies the response FAIL-CLOSED, and reconciles per-row
// outcomes DETERMINISTICALLY by the backend's documented `rows[].index` — never by email, name, or a
// guessed position. It NEVER synthesizes birthday/deliveryPhone/occasion/consent/verification and
// NEVER represents review/incomplete/absent/unknown_country as verified.
//
// Backend contract consumed (services/contactImportApply.js @ 7577967):
//   response 200 → { ok:true, data:{ added, updated, merged, skipped, failed, total,
//                                     rows:[ { index, status, reason? } ] } }
//   row.status ∈ created | updated | merged | skipped | failed
//   reconciliation key = row.index (position in the submitted contacts[]). No clientRowId exists.

import { PREVIEW_STATUS } from "./corporateAddressStatus.js";

export const DUPLICATE_STRATEGIES = Object.freeze(["skip", "update", "merge"]);
export const RECIPIENT_CONTEXTS = Object.freeze(["employee", "client"]);

// Backend per-row statuses (mirrored, not invented).
export const ROW_STATUS = Object.freeze({
  CREATED: "created", UPDATED: "updated", MERGED: "merged", SKIPPED: "skipped", FAILED: "failed",
});

// ---------------------------------------------------------------------------------------------
// Payload construction — canonical preview row IS the commit source (no reparse/renormalization).
// ---------------------------------------------------------------------------------------------

// Build the request envelope from the already-previewed items. Only VALID rows are submitted (invalid
// rows are surfaced pre-commit and would fail the backend anyway). Order is preserved. Each contact is
// the exact `item.contact` produced by importCore.processRow at preview time — no field is added,
// renamed, reparsed, or synthesized; UI-only data (addressStatus) is never in item.contact.
export function buildCorporatePayload(items, opts = {}) {
  const duplicateStrategy = DUPLICATE_STRATEGIES.includes(opts.duplicateStrategy) ? opts.duplicateStrategy : "skip";
  const list = Array.isArray(items) ? items : [];
  // Preserve original preview index so per-row reconciliation maps back precisely after filtering.
  const submitted = list.filter((it) => it && it.valid);
  const contacts = submitted.map((it) => it.contact);
  const envelope = { contacts, duplicateStrategy };
  if (opts.requireConsent === true) envelope.requireConsent = true;
  if (RECIPIENT_CONTEXTS.includes(opts.recipientContext)) envelope.recipientContext = opts.recipientContext;
  // submittedIndexes[k] = the preview index of the k-th submitted contact → backend rows[].index maps
  // to this position in `contacts`, which we translate back to the preview row for display.
  const submittedPreviewIndex = submitted.map((it) => it.index);
  return { envelope, submitted, submittedPreviewIndex };
}

// ---------------------------------------------------------------------------------------------
// Pre-commit confirmation counts (display only — no mutation).
// ---------------------------------------------------------------------------------------------
export function confirmationCounts(items) {
  const list = Array.isArray(items) ? items : [];
  const valid = list.filter((it) => it && it.valid);
  const byAddr = (s) => valid.filter((it) => it.addressStatus && it.addressStatus.status === s).length;
  return {
    total: list.length,
    importable: valid.length,
    rejectedPreCommit: list.length - valid.length,
    completeUnverified: byAddr(PREVIEW_STATUS.REVIEW),
    incompleteAddress: byAddr(PREVIEW_STATUS.INCOMPLETE),
    noAddress: byAddr(PREVIEW_STATUS.ABSENT),
    unknownCountry: byAddr(PREVIEW_STATUS.UNKNOWN_COUNTRY),
  };
}

// ---------------------------------------------------------------------------------------------
// Response classification — FAIL CLOSED. A non-2xx / dormant / aborted / indeterminate / malformed
// response is NEVER success and NEVER "0 contacts added".
// ---------------------------------------------------------------------------------------------

const SAFE_MESSAGES = Object.freeze({
  400: "Some rows couldn't be imported. Review the details and try again.",
  401: "Your session has expired. Please sign in again.",
  403: "You're not authorized to import contacts for this organization.",
  404: "Corporate import isn't available.",
  413: "This file is too large to import. Please split it and try again.",
  429: "Too many attempts. Please wait a moment and try again.",
  500: "Something went wrong on our end. Nothing was confirmed as saved.",
  503: "Corporate import is currently unavailable.",
  generic: "The import couldn't be completed. Nothing was confirmed as saved.",
  malformed: "We couldn't read the server's response, so nothing is confirmed. Please check the organization's contacts before retrying.",
  indeterminate: "Import status could not be confirmed. Do not submit again until the organization's contacts are checked.",
  network: "We couldn't reach the server. Nothing was confirmed as saved.",
});

export function messageForStatus(status) {
  return SAFE_MESSAGES[status] || SAFE_MESSAGES.generic;
}

// Whether a body is the recognized corporate results shape (data with numeric totals + rows[]).
export function isRecognizedResultsBody(data) {
  if (!data || typeof data !== "object") return false;
  const numeric = ["added", "updated", "merged", "skipped", "failed", "total"].every((k) => typeof data[k] === "number");
  return numeric && Array.isArray(data.rows);
}

// `res` is a corporateContacts client result. Returns a discriminated outcome; never throws.
//   { kind: "success" | "partial" | "failed" | "error" | "dormant" | "indeterminate" | "aborted",
//     status?, code?, message, reconciliation? }
export function classifyCorporateOutcome(res, submittedPreviewIndex) {
  if (!res || typeof res !== "object") return { kind: "error", message: SAFE_MESSAGES.generic };
  if (res.dormant) return { kind: "dormant", status: 503, code: res.reason || "corporate_import_disabled", message: SAFE_MESSAGES[503] };
  if (res.aborted) return { kind: "aborted", message: SAFE_MESSAGES.indeterminate };       // a mutation may have landed
  if (res.indeterminate) return { kind: "indeterminate", status: res.status || 0, message: SAFE_MESSAGES.indeterminate };
  if (res.ok !== true) {
    const status = typeof res.status === "number" ? res.status : undefined;
    if (status === 0 || res.networkError) return { kind: "indeterminate", status: 0, message: SAFE_MESSAGES.indeterminate };
    return { kind: "error", status, code: res.code || res.reason, message: messageForStatus(status) };
  }
  const data = res.data;
  if (!isRecognizedResultsBody(data)) return { kind: "error", status: res.status, message: SAFE_MESSAGES.malformed };

  const reconciliation = reconcileCorporateResults(submittedPreviewIndex, data);
  if (!reconciliation.consistent) return { kind: "error", status: res.status, message: SAFE_MESSAGES.malformed, reconciliation };
  const committed = data.added + data.updated + data.merged;
  if (data.failed > 0 && committed === 0) return { kind: "failed", status: res.status, message: "No contacts could be imported.", data, reconciliation };
  if (data.failed > 0 || reconciliation.missing.length > 0) return { kind: "partial", status: res.status, data, reconciliation };
  return { kind: "success", status: res.status, data, reconciliation };
}

// ---------------------------------------------------------------------------------------------
// Deterministic per-row reconciliation — by row.index ONLY (the backend's documented key).
// `submittedPreviewIndex[k]` is the preview index of the k-th submitted contact; a backend row.index
// of k therefore maps to preview row submittedPreviewIndex[k]. No email/name/position guessing.
// ---------------------------------------------------------------------------------------------
export function reconcileCorporateResults(submittedPreviewIndex, data) {
  const submitted = Array.isArray(submittedPreviewIndex) ? submittedPreviewIndex : [];
  const rows = (data && Array.isArray(data.rows)) ? data.rows : [];

  const seen = new Set();
  const perRow = [];                 // { submitIndex, previewIndex, status, reason }
  const duplicateIndexes = [];
  const extra = [];                  // rows whose index is out of range
  for (const r of rows) {
    const i = r && r.index;
    if (typeof i !== "number" || i < 0 || i >= submitted.length) { extra.push(r); continue; }
    if (seen.has(i)) { duplicateIndexes.push(i); continue; }
    seen.add(i);
    perRow.push({ submitIndex: i, previewIndex: submitted[i], status: r.status, reason: r.reason || null });
  }
  const missing = [];                // submitted rows with no backend result
  for (let i = 0; i < submitted.length; i++) if (!seen.has(i)) missing.push({ submitIndex: i, previewIndex: submitted[i] });

  // Totals must reconcile mathematically: one status per submitted row, and status counts == totals.
  const count = (s) => perRow.filter((p) => p.status === s).length;
  const tallies = {
    created: count(ROW_STATUS.CREATED), updated: count(ROW_STATUS.UPDATED), merged: count(ROW_STATUS.MERGED),
    skipped: count(ROW_STATUS.SKIPPED), failed: count(ROW_STATUS.FAILED),
  };
  const totalsMatch = data
    && tallies.created === data.added && tallies.updated === data.updated && tallies.merged === data.merged
    && tallies.skipped === data.skipped && tallies.failed === data.failed
    && data.total === submitted.length;
  const consistent = extra.length === 0 && duplicateIndexes.length === 0 && missing.length === 0 && !!totalsMatch;

  return { perRow, missing, extra, duplicateIndexes, tallies, totalsMatch: !!totalsMatch, consistent };
}

// Map a backend row status + the preview address status into a truthful row-level label for the summary.
export function rowPresentation(rowStatus, previewAddressStatus) {
  switch (rowStatus) {
    case ROW_STATUS.CREATED: {
      if (previewAddressStatus === PREVIEW_STATUS.ABSENT) return { bucket: "imported_no_address", label: "Imported — no delivery address" };
      if (previewAddressStatus === PREVIEW_STATUS.INCOMPLETE) return { bucket: "imported_incomplete", label: "Imported — incomplete address, pending review" };
      if (previewAddressStatus === PREVIEW_STATUS.UNKNOWN_COUNTRY) return { bucket: "imported_unknown_country", label: "Imported — country needs review" };
      return { bucket: "imported_unverified", label: "Imported — address not verified" };
    }
    case ROW_STATUS.UPDATED: return { bucket: "updated", label: "Updated existing contact" };
    case ROW_STATUS.MERGED: return { bucket: "merged", label: "Merged into existing contact" };
    case ROW_STATUS.SKIPPED: return { bucket: "skipped", label: "Skipped" };
    case ROW_STATUS.FAILED: return { bucket: "failed", label: "Not imported" };
    default: return { bucket: "unknown", label: "Result unavailable" };
  }
}
