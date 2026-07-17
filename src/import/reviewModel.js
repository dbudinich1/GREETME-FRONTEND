// src/import/reviewModel.js
//
// TEAM A — plain-language, LINEAR reconciliation model for the Import Wizard. Pure, framework-free,
// Node-testable. This is the single review brain behind ReviewScreen. It preserves the persistent-
// row architecture that fixed the disappearing-control defect (a row is NEVER dropped from state
// because its status changed) and evolves it into a one-card-at-a-time attention workflow with the
// three canonical relationship controls used by ContactForm.
//
// PER-CONTACT CONTROLS (exact plain-language labels live in the component):
//   1. Relationship group  → relationshipCategory value  (family | friend | professional)
//   2. Relationship        → relationship value          (per-group canonical, e.g. close_friend)
//   3. How close are you?  → relationshipCloseness value (inner_circle | greetme_worthy | obligatory)
// Greet-Me Worthy is the visible default for every row. No new taxonomy — values come straight from
// completionModel (which mirrors ContactForm byte-for-byte).
//
// RULES: only a missing name or invalid email blocks a row (that row alone); a blank/unrecognized
// relationship never blocks and is never guessed; Employees/Clients/Vendors keep their audience
// (never re-asked); a Universal-List row with an unknown audience needs one required choice; the
// import gate opens once every such row is resolved or skipped. Individual rows never carry a
// business recipientType.

import {
  RELATIONSHIP_CATEGORIES, RELATIONS_BY_CATEGORY, CLOSENESS_OPTIONS,
  resolveRelationshipRaw, isValidRelation, isValidCloseness, relationshipKey,
} from "./completionModel.js";
import { normalizeRecipientTypeRaw, isCanonicalType } from "./recipientTypeModel.js";
import { isValidEmail } from "./importCore.js";

export const DEFAULT_CLOSENESS = "greetme_worthy";   // Greet-Me Worthy — visibly preselected, unchanged taxonomy

export const REVIEW_STATUS = Object.freeze({
  READY: "ready",
  NEEDS_NAME: "needs_name",
  NEEDS_EMAIL: "needs_email",
  NEEDS_AUDIENCE: "needs_audience",
  SKIPPED: "skipped",
  DUPLICATE: "duplicate",
});

// The four audience choices for a genuinely-unknown Universal-List row.
export const AUDIENCE_CHOICES = Object.freeze([
  { value: "employee", label: "Employee" },
  { value: "client", label: "Client" },
  { value: "vendor", label: "Vendor" },
  { value: "skip", label: "Skip this contact" },
]);

// Fresh state. Per-row edits are keyed by the row's original index. `edits[i]` may hold:
//   { group, relation, closeness, name, email, audience, leftBlank, skipped, touched }
export function freshReviewState({ business = false, kind = null } = {}) {
  return { business: !!business, kind: kind || null, edits: {}, removed: {} };
}

// ---- helpers ----
const _edit = (state, i) => (state.edits && state.edits[i]) || {};
const _patch = (state, i, patch) => ({ ...state, edits: { ...state.edits, [i]: { ...(_edit(state, i)), ...patch } } });

export function categoryForRelation(relation) {
  if (!relation) return "";
  const det = resolveRelationshipRaw(relation);
  return det.deterministic ? det.category : "";
}
export function relationLabelFor(relation) {
  for (const cat of Object.keys(RELATIONS_BY_CATEGORY)) {
    const hit = RELATIONS_BY_CATEGORY[cat].find((r) => r.value === relation);
    if (hit) return hit.label;
  }
  return "";
}
export function groupLabelFor(group) {
  return (RELATIONSHIP_CATEGORIES.find((c) => c.value === group) || {}).label || "";
}
export function relationsForGroup(group) {
  return RELATIONS_BY_CATEGORY[group] || [];
}
const _birthdayOf = (row) => {
  const raw = (row && row.__raw) || {};
  const map = (row && row.__map) || {};
  const b = map.birthday != null ? raw[map.birthday] : (row && row.contact && row.contact.birthday);
  return b != null && String(b).trim() !== "" ? String(b).trim() : "";
};

// ---- pure control updaters (each individual edit marks the row `touched` so apply-to-all won't
// silently overwrite it) ----
export function setName(state, i, value) { return _patch(state, i, { name: value }); }
export function setEmail(state, i, value) { return _patch(state, i, { email: value }); }
// Changing the group clears ONLY an incompatible relationship; a compatible one is kept.
export function setGroup(state, i, group) {
  const e = _edit(state, i);
  const keep = e.relation && isValidRelation(group, e.relation) ? e.relation : "";
  return _patch(state, i, { group: group || "", relation: keep, leftBlank: false, touched: true });
}
export function setRelation(state, i, relation) {
  const group = relation ? (categoryForRelation(relation) || _edit(state, i).group || "") : (_edit(state, i).group || "");
  return _patch(state, i, { group, relation: relation || "", leftBlank: false, touched: true });
}
export function setCloseness(state, i, closeness) {
  return _patch(state, i, { closeness: isValidCloseness(closeness) ? closeness : DEFAULT_CLOSENESS, touched: true });
}
// "Leave relationship blank" — a valid, explicit choice for Individual rows.
export function leaveRelationshipBlank(state, i) {
  return _patch(state, i, { group: "", relation: "", leftBlank: true, touched: true });
}
// Universal-List audience choice. value ∈ employee|client|vendor|skip.
export function setAudience(state, i, value) { return _patch(state, i, { audience: value, touched: true }); }
export const chooseAudience = setAudience;   // stable alias used by the wizard/tests
export function skipContact(state, i) { return _patch(state, i, { skipped: true }); }
export function unskipContact(state, i) { return _patch(state, i, { skipped: false }); }
export function removeRow(state, i) { return { ...state, removed: { ...state.removed, [i]: true } }; }

// Apply one relationship selection to every row that shares the EXACT normalized raw value. Opt-in.
// Never overwrites a row the user already changed individually unless `force` (an explicit confirm).
export function applyToAllMatching(state, rows, rawValue, selection = {}, { force = false } = {}) {
  const key = relationshipKey(rawValue);
  if (!key) return state;
  const edits = { ...state.edits };
  for (const row of rows || []) {
    const c = row.contact || {};
    if (relationshipKey(c.relationship) !== key) continue;      // only exact normalized matches
    const cur = edits[row.index] || {};
    if (cur.touched && !force) continue;                        // don't clobber an individual change
    edits[row.index] = {
      ...cur,
      group: selection.group || "",
      relation: selection.relation || "",
      closeness: isValidCloseness(selection.closeness) ? selection.closeness : (cur.closeness || DEFAULT_CLOSENESS),
      leftBlank: !selection.group && !selection.relation ? !!selection.leftBlank : false,
      appliedFromBulk: true,
      // NOTE: intentionally NOT setting touched — a later individual edit still overrides freely.
    };
  }
  return { ...state, edits };
}

// Unique unrecognized raw relationship values shared by 2+ rows → each can drive one "apply to all".
export function bulkRelationshipGroups(rows = [], state = freshReviewState()) {
  const map = new Map();
  for (const row of rows || []) {
    if (state.removed && state.removed[row.index]) continue;
    const raw = (row.contact && row.contact.relationship) || "";
    if (!raw) continue;
    if (resolveRelationshipRaw(raw).deterministic) continue;    // recognized → not a bulk unknown
    const key = relationshipKey(raw);
    const e = map.get(key) || { raw, key, count: 0, indices: [] };
    e.count += 1; e.indices.push(row.index); map.set(key, e);
  }
  return [...map.values()].filter((g) => g.count > 1);          // only offer when 2+ share a value
}

// ---- resolve one row for display (never mutates) ----
function _reviewRow(row, state) {
  const i = row.index;
  const c = row.contact || {};
  const e = _edit(state, i);
  const name = String(e.name !== undefined ? e.name : (c.fullName || "")).trim();
  const email = String(e.email !== undefined ? e.email : (c.email || "")).trim();
  const rawRel = c.relationship || "";
  const det = resolveRelationshipRaw(rawRel);
  const relationUnrecognizedRaw = !!rawRel && !det.deterministic;

  // Relationship group/relation: explicit edit > recognized prepopulation > blank (never guessed).
  let group = "", relation = "";
  if (e.leftBlank) { group = ""; relation = ""; }
  else if (e.group !== undefined || e.relation !== undefined) {
    group = e.group || (e.relation ? categoryForRelation(e.relation) : "");
    relation = e.relation && isValidRelation(group, e.relation) ? e.relation : "";
  } else if (det.deterministic) {
    group = det.category; relation = det.relation;              // recognized → prepopulated
  }
  const closeness = e.closeness && isValidCloseness(e.closeness) ? e.closeness : DEFAULT_CLOSENESS;

  // Audience (business only).
  const business = !!state.business, kind = state.kind;
  let audience = "", audienceState = "none";
  if (business) {
    if (kind && kind !== "mixed") { audience = isCanonicalType(kind) ? kind : ""; audienceState = "auto"; }
    else {
      const a = e.audience;
      if (a === "skip") audienceState = "skip";
      else if (a && isCanonicalType(a)) { audience = a; audienceState = "chosen"; }
      else { const n = normalizeRecipientTypeRaw(c.recipientType); if (n) { audience = n; audienceState = "auto"; } else audienceState = "needs_audience"; }
    }
  }

  let status;
  if (e.skipped) status = REVIEW_STATUS.SKIPPED;
  else if (!name) status = REVIEW_STATUS.NEEDS_NAME;
  else if (!isValidEmail(email)) status = REVIEW_STATUS.NEEDS_EMAIL;
  else if (row.duplicate) status = REVIEW_STATUS.DUPLICATE;
  else if (audienceState === "skip") status = REVIEW_STATUS.SKIPPED;
  else if (audienceState === "needs_audience") status = REVIEW_STATUS.NEEDS_AUDIENCE;
  else status = REVIEW_STATUS.READY;

  return {
    index: i, name, email, birthday: _birthdayOf(row), rawRel, relationUnrecognizedRaw,
    group, groupLabel: groupLabelFor(group), relation, relationLabel: relationLabelFor(relation),
    closeness, closenessLabel: (CLOSENESS_OPTIONS.find((o) => o.value === closeness) || {}).label || "",
    audience, audienceState, status, willImport: status === REVIEW_STATUS.READY,
    edited: !!(e.group || e.relation || e.closeness || e.name !== undefined || e.email !== undefined || e.leftBlank || e.audience || e.skipped),
  };
}

// Whether a row (by its ORIGINAL data) is worth putting in the attention walkthrough. Frozen w.r.t.
// edits so a card does not reshuffle as the user resolves it; respects removals only.
function _needsAttention(row, state) {
  const c = row.contact || {};
  const name = String(c.fullName || "").trim();
  const email = String(c.email || "").trim();
  if (!name || !isValidEmail(email)) return true;             // name/email error
  if (row.duplicate) return false;                            // already present → not a review card
  if (state.business && state.kind === "mixed" && !normalizeRecipientTypeRaw(c.recipientType)) return true; // unknown audience
  const rawRel = c.relationship || "";
  if (rawRel && !resolveRelationshipRaw(rawRel).deterministic) return true; // unrecognized relationship
  return false;
}
// The FROZEN, ordered list of indices to walk in the attention workflow.
export function attentionOrder(rows = [], state = freshReviewState()) {
  return (rows || []).filter((r) => !(state.removed && state.removed[r.index]) && _needsAttention(r, state)).map((r) => r.index);
}

// Build the whole review. Pure; safe on every render.
export function buildReview(rows = [], state = freshReviewState()) {
  const items = [];
  for (const row of rows || []) {
    if (state.removed && state.removed[row.index]) continue;
    items.push(_reviewRow(row, state));
  }
  const order = attentionOrder(rows, state);
  const attention = order.map((i) => items.find((it) => it.index === i)).filter(Boolean);
  const by = (s) => items.filter((it) => it.status === s);
  const ready = by(REVIEW_STATUS.READY);
  const needsAudience = by(REVIEW_STATUS.NEEDS_AUDIENCE);
  const skipped = by(REVIEW_STATUS.SKIPPED);
  const duplicate = by(REVIEW_STATUS.DUPLICATE);
  const needsFix = items.filter((it) => it.status === REVIEW_STATUS.NEEDS_NAME || it.status === REVIEW_STATUS.NEEDS_EMAIL);
  const importCount = ready.length;
  const importEnabled = importCount > 0 && needsAudience.length === 0;
  return {
    items,
    attention,                          // ordered cards to walk (frozen order, respects removals)
    readySection: ready,                // importable rows for the collapsed "X contacts are ready"
    summary: {
      needAttention: order.length,      // "X contacts need your attention"
      ready: ready.length,              // "X ready to import"
      willSkip: skipped.length,         // "X will be skipped"
      duplicate: duplicate.length,      // "X already in your recipients"
      needsChoice: needsAudience.length,// "X still need a required choice" (Universal audience)
      needsFix: needsFix.length,        // name/email still to fix
      total: items.length,
    },
    importCount,
    importEnabled,
  };
}

// ---- navigation (pure, trivial — kept here so Save & next / Back are deterministically testable) ----
export function nextCard(navIndex, queueLength) { return Math.min(navIndex + 1, Math.max(0, queueLength)); }
export function prevCard(navIndex) { return Math.max(0, navIndex - 1); }

// ---- payload (ready rows only; boundary + full-date birthday preserved) ----
export function importableRows(rows = [], state = freshReviewState()) {
  const review = buildReview(rows, state);
  const ready = new Set(review.items.filter((it) => it.willImport).map((it) => it.index));
  return (rows || []).filter((r) => ready.has(r.index));
}
export function buildReviewPayload(rows = [], state = freshReviewState()) {
  const kept = importableRows(rows, state);
  return kept.map((row) => {
    const rr = _reviewRow(row, state);
    const c = row.contact || {};
    const raw = row.__raw || {}, map = row.__map || {};
    const birthday = map.birthday != null ? raw[map.birthday] : c.birthday;
    const out = {
      name: rr.name || "",
      email: rr.email || "",
      phone: c.phone || "",
      company: c.company || "",
      department: c.department || "",
      recipientType: rr.audience || "",          // "" for Individual — business boundary enforced here
      consent: c.consent || "",
      source: c.source || "",
      notes: c.notes || "",
      relationship: rr.relation || "",            // canonical relation (matches manual option list)
      relationshipCategory: rr.group || "",
      relationshipCloseness: rr.closeness || "",  // Greet-Me Worthy by default
      relationshipContext: "",
      relationshipRaw: rr.rawRel || (c.relationship || ""),
    };
    if (birthday != null && String(birthday).trim() !== "") out.birthday = birthday;
    return out;
  });
}

// Re-export the canonical option lists the component renders (single source of truth).
export { RELATIONSHIP_CATEGORIES, RELATIONS_BY_CATEGORY, CLOSENESS_OPTIONS };
