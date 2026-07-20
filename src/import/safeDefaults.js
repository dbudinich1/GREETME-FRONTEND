// src/import/safeDefaults.js
//
// TEAM A — OPT-IN recommended (safe) relationship defaults for the combined Review screen. Pure,
// framework-free, Node-testable. Defaults are NEVER applied silently: the component surfaces a compact
// notice and the user explicitly clicks "Apply". Applying writes into the SAME review `edits` map the
// manual controls use, so a defaulted row is identical to a hand-edited one; Undo restores the exact
// prior edits.
//
// PRECEDENCE (never violated): explicit CSV value > user review edit > opt-in recommended default > blank.
//   • Eligible rows are ONLY those whose relationship is fully blank (no resolved relation, no raw CSV
//     relationship value) and which the user has not edited or explicitly left blank.
//   • Applying fills ONLY blank group/relation/closeness; it never overwrites a supplied/edited value.
//   • recipientType is owned by the path/review audience logic and is NOT touched here.
//
// TAXONOMY GATE: Family's recommended relationship is `loved_one`, which is NOT in the canonical
// completionModel vocabulary. It is HELD here (never substituted with spouse/partner/sibling/etc.) and
// reported. When `loved_one` is authorized + added canonically, set Family's `relationship` and drop
// `pending` — nothing else changes.

import { isValidRelation, isValidCloseness } from "./completionModel.js";
import { buildReview, DEFAULT_CLOSENESS } from "./reviewModel.js";

// Per-path recommended defaults (matrix). `pending` marks a value awaiting a canonical taxonomy
// addition — such a path is NOT applicable until authorized.
export const DEFAULT_MATRIX = Object.freeze({
  family: Object.freeze({ relationshipCategory: "family", relationship: null, label: "Loved One", relationshipCloseness: "greetme_worthy", pending: "loved_one" }),
  friend: Object.freeze({ relationshipCategory: "friend", relationship: "acquaintance", label: "Acquaintance", relationshipCloseness: "greetme_worthy" }),
  professional: Object.freeze({ relationshipCategory: "professional", relationship: "colleague", label: "Colleague", relationshipCloseness: "greetme_worthy" }),
  employee: Object.freeze({ relationshipCategory: "professional", relationship: "employee", label: "Employee", relationshipCloseness: "greetme_worthy" }),
  client: Object.freeze({ relationshipCategory: "professional", relationship: "client", label: "Client", relationshipCloseness: "greetme_worthy" }),
  vendor: Object.freeze({ relationshipCategory: "professional", relationship: "vendor", label: "Vendor", relationshipCloseness: "greetme_worthy" }),
});

// The applicable default for a path, or null when HELD (pending taxonomy) or non-canonical. Every
// returned value is verified against the canonical taxonomy — nothing is invented.
export function defaultForPath(path) {
  const d = DEFAULT_MATRIX[path];
  if (!d || d.pending || !d.relationship) return null;
  if (!isValidRelation(d.relationshipCategory, d.relationship)) return null;
  if (!isValidCloseness(d.relationshipCloseness)) return null;
  return { relationshipCategory: d.relationshipCategory, relationship: d.relationship, relationshipCloseness: d.relationshipCloseness };
}

// Indices eligible for a default = blank-relationship rows heading toward import, never touched by the
// user. Uses the SAME review buckets so a row with a (recognized or unrecognized) CSV relationship, a
// user edit, or an explicit blank is excluded.
export function eligibleIndices(review, state = {}) {
  const edits = state.edits || {};
  return (review.items || []).filter((it) => {
    if (it.hasRelation) return false;                       // already has a resolved relationship
    if (it.rawRel) return false;                            // CSV carried a value → CSV wins, not eligible
    const e = edits[it.index] || {};
    if (e.leftBlank) return false;                          // user explicitly chose blank → user wins
    if (e.group || e.relation) return false;                // user edit → user wins
    return it.bucket === "ready" || it.bucket === "needs_fix";
  }).map((it) => it.index);
}

// Read-only summary for the Review notice: whether a default is available, how many rows it would
// affect, and (if HELD) why. Never mutates.
export function recommendedDefaults(rows = [], state = {}, path = null) {
  const def = defaultForPath(path);
  const review = buildReview(rows, state);
  const indices = def ? eligibleIndices(review, state) : [];
  return {
    def,
    indices,
    count: indices.length,
    available: !!def && indices.length > 0,
    pending: (DEFAULT_MATRIX[path] || {}).pending || null,
  };
}

// Apply a default to the given indices. Returns the next state + an exact undo token (prior edit per
// index, preserving absence). Fills ONLY blank group/relation/closeness (never overwrites).
export function applyRecommendedDefaults(state = {}, indices = [], def = null) {
  if (!def || !indices.length) return { state, appliedCount: 0, undo: { keys: [], prev: {} } };
  const edits = { ...(state.edits || {}) };
  const prev = {};
  for (const i of indices) {
    prev[i] = edits[i];                                     // exact prior (may be undefined)
    const e = { ...(edits[i] || {}) };
    if (!e.group) e.group = def.relationshipCategory;
    if (!e.relation) e.relation = def.relationship;
    if (!isValidCloseness(e.closeness)) e.closeness = def.relationshipCloseness;
    e.appliedDefault = true;                                // provenance marker (never persisted)
    edits[i] = e;
  }
  return { state: { ...state, edits }, appliedCount: indices.length, undo: { keys: [...indices], prev } };
}

// Convenience: compute eligibility + apply in one step (component entry point).
export function applyDefaultsForPath(rows = [], state = {}, path = null) {
  const { def, indices } = recommendedDefaults(rows, state, path);
  return applyRecommendedDefaults(state, indices, def);
}

// Restore the exact pre-application edits (absence restored as absence).
export function undoRecommendedDefaults(state = {}, undo = { keys: [], prev: {} }) {
  if (!undo || !undo.keys || !undo.keys.length) return state;
  const edits = { ...(state.edits || {}) };
  for (const i of undo.keys) {
    if (undo.prev[i] === undefined) delete edits[i];
    else edits[i] = undo.prev[i];
  }
  return { ...state, edits };
}

export { DEFAULT_CLOSENESS };
