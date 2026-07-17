// src/import/reviewModel.js
//
// TEAM A — plain-language Review model for the Import Wizard. Pure, framework-free, Node-testable.
// This is the SINGLE review surface that replaces the old defaults-decision → complete → review
// funnel. It computes, from the deduped rows + a small review state, one persistent list of items
// (name / email / birthday / relationship / plain status) plus a simple summary and the import
// gate — and it builds the final payload by delegating to the already-tested completion/type models.
//
// CONTROL-DEFECT FIX (root cause): the previous completion UI filtered rows down to only the
// "needs choice" set, so a control DISAPPEARED the instant its row resolved — a selection looked
// like it did nothing. Here every kept row stays in `items` for the whole session; a selection only
// flips that row's `status` and the counts. Control value is read straight from state (chooseX →
// state → buildReview), never from a separately-derived value that could overwrite it on rerender.
//
// PLAIN-LANGUAGE RULES:
//   • Only a missing name or an invalid/missing email BLOCKS a row (that row alone is excluded).
//   • A blank/unrecognized relationship is NEVER an error or warning and NEVER blocks import.
//   • Business Employees/Clients/Vendors already know their audience — never re-asked.
//   • A Universal-List row whose audience is genuinely unknown needs ONE required choice
//     (Employee/Client/Vendor/Skip); the import gate opens once every such row is resolved or skipped.
//   • Individual rows never carry a business recipientType (the boundary lives in recipientTypeModel).

import {
  RELATIONS_BY_CATEGORY, resolveRelationshipRaw, buildCompletedImportContacts,
} from "./completionModel.js";
import {
  normalizeRecipientTypeRaw, isCanonicalType, applyRecipientTypes,
} from "./recipientTypeModel.js";
import { isValidEmail } from "./importCore.js";

// Plain-language row statuses (the ONLY concepts the primary UI shows).
export const REVIEW_STATUS = Object.freeze({
  READY: "ready",
  NEEDS_NAME: "needs_name",
  NEEDS_EMAIL: "needs_email",
  NEEDS_AUDIENCE: "needs_audience",   // Universal List only — a genuine required choice
  SKIPPED: "skipped",                 // Universal row the user explicitly set to Skip
  DUPLICATE: "duplicate",             // already in the user's recipients / repeated in-file
});

// The four audience choices offered for a genuinely-unknown Universal-List row.
export const AUDIENCE_CHOICES = Object.freeze([
  { value: "employee", label: "Employee" },
  { value: "client", label: "Client" },
  { value: "vendor", label: "Vendor" },
  { value: "skip", label: "Skip this contact" },
]);

// A fresh review state. `kind` is the recipientKind (null = Individual). Choices are keyed by the
// row's original index so they stay stable no matter how the list is rendered/filtered.
export function freshReviewState({ business = false, kind = null } = {}) {
  return { business: !!business, kind: kind || null, relChoice: {}, audChoice: {}, removed: {}, descriptionDefault: "greetme_worthy" };
}

// ---- pure state updaters (the control actions) ----
// A relationship pick for an Individual row. value = a canonical relation ("close_friend") or ""
// (explicit "Leave blank"). Storing the key — even "" — means the user's choice wins over the
// auto-detected value on every subsequent render.
export function chooseRelationship(state, index, value) {
  return { ...state, relChoice: { ...state.relChoice, [index]: value || "" } };
}
// An audience pick for a Universal-List row. value ∈ employee|client|vendor|skip.
export function chooseAudience(state, index, value) {
  return { ...state, audChoice: { ...state.audChoice, [index]: value } };
}
// Remove a row from THIS import (it leaves the list and every count).
export function removeRow(state, index) {
  return { ...state, removed: { ...state.removed, [index]: true } };
}
export function setDescriptionDefault(state, value) {
  return { ...state, descriptionDefault: value || "greetme_worthy" };
}

// ---- helpers ----
const _birthdayOf = (row) => {
  const raw = (row && row.__raw) || {};
  const map = (row && row.__map) || {};
  const b = map.birthday != null ? raw[map.birthday] : (row && row.contact && row.contact.birthday);
  return b != null && String(b).trim() !== "" ? String(b).trim() : "";
};
// Canonical relation value → its category (relation values are unique across categories).
export function categoryForRelation(relation) {
  if (!relation) return "";
  const det = resolveRelationshipRaw(relation);
  return det.deterministic ? det.category : "";
}
export function relationLabelFor(relation) {
  if (!relation) return "";
  for (const cat of Object.keys(RELATIONS_BY_CATEGORY)) {
    const hit = RELATIONS_BY_CATEGORY[cat].find((r) => r.value === relation);
    if (hit) return hit.label;
  }
  return "";
}

// Resolve ONE row for display. Never mutates. Reads the control value straight from `state`.
function _reviewRow(row, state) {
  const idx = row && row.index;
  const c = (row && row.contact) || {};
  const name = String(c.fullName || "").trim();
  const email = String(c.email || "").trim();
  const rawRel = c.relationship || "";
  const det = resolveRelationshipRaw(rawRel);

  // Relationship display: an explicit choice (incl. "" = leave blank) always wins over auto-detect.
  const chosen = state.relChoice && Object.prototype.hasOwnProperty.call(state.relChoice, idx);
  let relation = "", relationSource;
  if (chosen) { relation = state.relChoice[idx] || ""; relationSource = relation ? "chosen" : "blank"; }
  else if (det.deterministic) { relation = det.relation; relationSource = "auto"; }
  else relationSource = rawRel ? "unrecognized" : "none";

  // Audience (business only). Employees/Clients/Vendors are auto; Universal may need one choice.
  const business = !!state.business;
  const kind = state.kind;
  let audience = "", audienceState = "none";
  if (business) {
    if (kind && kind !== "mixed") { audience = isCanonicalType(kind) ? kind : ""; audienceState = "auto"; }
    else {
      const ov = state.audChoice && state.audChoice[idx];
      if (ov === "skip") audienceState = "skip";
      else if (ov && isCanonicalType(ov)) { audience = ov; audienceState = "chosen"; }
      else {
        const norm = normalizeRecipientTypeRaw(c.recipientType);
        if (norm) { audience = norm; audienceState = "auto"; } else audienceState = "needs_audience";
      }
    }
  }

  // Status precedence: invalid identity → already-present → skip → required audience → ready.
  let status;
  if (!name) status = REVIEW_STATUS.NEEDS_NAME;
  else if (!isValidEmail(email)) status = REVIEW_STATUS.NEEDS_EMAIL;
  else if (row && row.duplicate) status = REVIEW_STATUS.DUPLICATE;
  else if (audienceState === "skip") status = REVIEW_STATUS.SKIPPED;
  else if (audienceState === "needs_audience") status = REVIEW_STATUS.NEEDS_AUDIENCE;
  else status = REVIEW_STATUS.READY;

  return {
    index: idx, name, email, birthday: _birthdayOf(row), rawRel,
    relation, relationLabel: relationLabelFor(relation), relationSource,
    audience, audienceState, unrecognizedRelationship: relationSource === "unrecognized",
    status, willImport: status === REVIEW_STATUS.READY,
  };
}

// Build the whole review from the deduped rows + state. Pure: safe to call on every render.
export function buildReview(rows = [], state = freshReviewState()) {
  const items = [];
  for (const row of rows || []) {
    if (state.removed && state.removed[row.index]) continue;   // removed rows leave the list entirely
    items.push(_reviewRow(row, state));
  }
  const by = (s) => items.filter((i) => i.status === s);
  const ready = by(REVIEW_STATUS.READY);
  const needsAudience = by(REVIEW_STATUS.NEEDS_AUDIENCE);
  const skipped = by(REVIEW_STATUS.SKIPPED);
  const duplicate = by(REVIEW_STATUS.DUPLICATE);
  const needsFix = items.filter((i) => i.status === REVIEW_STATUS.NEEDS_NAME || i.status === REVIEW_STATUS.NEEDS_EMAIL);
  const importCount = ready.length;
  // Gate: at least one importable row AND no unresolved required audience choice. Invalid and
  // duplicate rows are excluded but never block the button; blank relationships never block.
  const importEnabled = importCount > 0 && needsAudience.length === 0;
  return {
    items,
    summary: {
      ready: ready.length,
      needsChoice: needsAudience.length,     // "needs a required choice"
      willSkip: skipped.length,
      duplicate: duplicate.length,           // "already in your recipients"
      needsFix: needsFix.length,             // "need a name or valid email"
      total: items.length,
    },
    importCount,
    importEnabled,
  };
}

// ---- payload (delegates to the tested completion + type models) ----
// Map the simple review state onto the completion state shape the tested builder consumes.
function _toCompletionState(state) {
  const rowOverrides = {};
  for (const key of Object.keys(state.relChoice || {})) {
    const rel = state.relChoice[key];
    if (rel) {
      const category = categoryForRelation(rel);
      if (category) rowOverrides[key] = { category, relation: rel };
    } else {
      rowOverrides[key] = { skipRelationship: true };  // explicit "Leave blank"
    }
  }
  return { descriptionDefault: state.descriptionDefault || "greetme_worthy", relationshipMappings: {}, rowOverrides };
}
function _toTypeState(state) {
  const rowTypeOverrides = {};
  for (const key of Object.keys(state.audChoice || {})) {
    const a = state.audChoice[key];
    if (a && a !== "skip" && isCanonicalType(a)) rowTypeOverrides[key] = a;
  }
  return { kind: state.kind, typeMappings: {}, rowTypeOverrides };
}
// A row is imported only if it is READY (valid identity, not duplicate, not skipped, audience resolved).
export function importableRows(rows = [], state = freshReviewState()) {
  const review = buildReview(rows, state);
  const readyIdx = new Set(review.items.filter((i) => i.willImport).map((i) => i.index));
  return (rows || []).filter((r) => readyIdx.has(r.index));
}
// Final payload for the ready rows only. Individual → recipientType stripped by applyRecipientTypes.
export function buildReviewPayload(rows = [], state = freshReviewState()) {
  const kept = importableRows(rows, state);
  return applyRecipientTypes(
    buildCompletedImportContacts(kept, _toCompletionState(state)),
    kept,
    _toTypeState(state),
  );
}
