// src/import/reviewModel.js
//
// TEAM A — CONFIRMATION-FIRST review model for the Import Wizard. Pure, framework-free, Node-testable.
// Import should feel like a confirmation ("your people are ready"), not a classification quiz.
//
// PRINCIPLES
//   • importCore is the single source of validation truth. Every row (and every inline edit) is run
//     through importCore.computeContactErrors, so the review and the importer can never disagree
//     (audit F1). The age gate needs a real `todayIso`; it is injected via state.context (never guessed).
//   • Every row lands in exactly ONE bucket (audit F2): ready | needs_fix | already_in_list |
//     will_skip | invalid_excluded. Optional relationship details never create a bucket.
//   • Inline Name/Email/Birthday edits re-run validation AND duplicate detection immediately (F3).
//   • Relationship classification is OPTIONAL. A blank relationship persists NO structured fields —
//     no category, relationship, closeness, or profile (F4). Greet-Me Worthy is only ever attached to
//     a contact that actually has a relationship.
//   • Individual rows never carry a business recipientType.

import {
  RELATIONSHIP_CATEGORIES, RELATIONS_BY_CATEGORY, CLOSENESS_OPTIONS,
  resolveRelationshipRaw, isValidRelation, isValidCloseness,
} from "./completionModel.js";
import { normalizeRecipientTypeRaw, isCanonicalType } from "./recipientTypeModel.js";
import { normalizeEmail, computeContactErrors } from "./importCore.js";

export const DEFAULT_CLOSENESS = "greetme_worthy";

// Exactly-one-of buckets.
export const REVIEW_BUCKET = Object.freeze({
  READY: "ready",
  NEEDS_FIX: "needs_fix",
  ALREADY_IN_LIST: "already_in_list",
  WILL_SKIP: "will_skip",
  INVALID_EXCLUDED: "invalid_excluded",
  ADDED: "added",              // successfully committed this session — excluded so it can't be re-submitted
});

// importCore error codes that a user can correct inline (name / email field, or an editable birthday).
const FIXABLE = new Set(["missing_name", "missing_email", "invalid_email", "minor_blocked"]);

// Universal-List audience choices ("Don't add" maps to skip, not an audience value).
export const AUDIENCE_CHOICES = Object.freeze([
  { value: "employee", label: "Employee" },
  { value: "client", label: "Client" },
  { value: "vendor", label: "Vendor" },
  { value: "skip", label: "Don't add this contact" },
]);

// Which inline control a blocked row needs — so the component switches on a field name, never a code.
function _fixFieldFor(code) {
  if (code === "missing_name") return "name";
  if (code === "missing_email" || code === "invalid_email") return "email";
  if (code === "minor_blocked") return "birthday";
  if (code === "needs_audience") return "audience";
  return null;
}

// Plain-language, first-time-user messages. No validation codes ever reach the UI.
export function blockerMessageFor(code) {
  switch (code) {
    case "missing_name": return "Add a name to include this contact.";
    case "missing_email": return "Add an email to include this contact.";
    case "invalid_email": return "This email looks incomplete—fix it to include this contact.";
    case "minor_blocked": return "This birthday indicates the recipient is under 13 and cannot be imported.";
    case "needs_audience": return "We couldn't tell whether this business contact is an employee, client, or vendor.";
    case "consent_required": return "This contact hasn't opted in yet.";
    default: return "This contact can't be added yet.";
  }
}

// state.context carries what validation + dedup need. `todayIso` MUST be a real date in production and
// is injected in tests. `existingEmails` are the user's current recipients (personal import only).
export function freshReviewState({ business = false, kind = null, existingEmails = [], todayIso = null } = {}) {
  return {
    business: !!business, kind: kind || null,
    context: { existingEmails: (existingEmails || []).map(normalizeEmail).filter(Boolean), todayIso: todayIso || null },
    edits: {},
    committed: [],              // emails added successfully this session (partial-import retry safety)
    commitErrors: {},           // email → plain retry message for a backend per-row failure
  };
}

// ---- partial-import state (real success/partial handling) ----
// Mark emails as successfully added so they move to the ADDED bucket and can never be re-submitted.
export function markCommitted(state, emails = []) {
  const add = (emails || []).map(normalizeEmail).filter(Boolean);
  return { ...state, committed: [...new Set([...(state.committed || []), ...add])] };
}
// Attach a plain-language retry note to rows the backend rejected (they stay Ready → retryable).
export function setCommitErrors(state, map = {}) {
  const out = { ...(state.commitErrors || {}) };
  for (const k of Object.keys(map || {})) { const e = normalizeEmail(k); if (e) out[e] = map[k]; }
  return { ...state, commitErrors: out };
}
// Fold "already exists" emails into the existing-recipient set so they read as already-in-list.
export function addExistingEmails(state, emails = []) {
  const add = (emails || []).map(normalizeEmail).filter(Boolean);
  const existing = new Set([...((state.context && state.context.existingEmails) || []), ...add]);
  return { ...state, context: { ...state.context, existingEmails: [...existing] } };
}

// ---- helpers ----
const _edit = (state, i) => (state.edits && state.edits[i]) || {};
const _patch = (state, i, patch) => ({ ...state, edits: { ...state.edits, [i]: { ...(_edit(state, i)), ...patch } } });
const _has = (e, k) => Object.prototype.hasOwnProperty.call(e, k);

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
export function groupLabelFor(group) { return (RELATIONSHIP_CATEGORIES.find((c) => c.value === group) || {}).label || ""; }
export function relationsForGroup(group) { return RELATIONS_BY_CATEGORY[group] || []; }

const _origBirthday = (row) => {
  const raw = (row && row.__raw) || {};
  const map = (row && row.__map) || {};
  const b = map.birthday != null ? raw[map.birthday] : (row && row.contact && row.contact.birthday);
  return b != null ? String(b).trim() : "";
};
// Effective contact values = original fields overlaid with any inline edits.
function _effective(row, e) {
  const c = (row && row.contact) || {};
  return {
    name: String(_has(e, "name") ? e.name : (c.fullName || "")).trim(),
    email: normalizeEmail(_has(e, "email") ? e.email : (c.email || "")),
    birthday: _has(e, "birthday") ? String(e.birthday || "").trim() : _origBirthday(row),
    consent: c.consent || "",
    phone: c.phone || "", company: c.company || "", department: c.department || "",
    source: c.source || "", notes: c.notes || "",
    shippingAddress: c.shippingAddress || null,        // canonical { line1,line2,city,state,zip,country } or null
  };
}

// ---- pure control updaters ----
export function setName(state, i, v) { return _patch(state, i, { name: v }); }
export function setEmail(state, i, v) { return _patch(state, i, { email: v }); }
export function setBirthday(state, i, v) { return _patch(state, i, { birthday: v }); }
// Changing the group clears ONLY an incompatible relationship (a compatible one is kept).
export function setGroup(state, i, group) {
  const e = _edit(state, i);
  const keep = e.relation && isValidRelation(group, e.relation) ? e.relation : "";
  return _patch(state, i, { group: group || "", relation: keep, leftBlank: false });
}
export function setRelation(state, i, relation) {
  const group = relation ? (categoryForRelation(relation) || _edit(state, i).group || "") : (_edit(state, i).group || "");
  return _patch(state, i, { group, relation: relation || "", leftBlank: false });
}
export function setCloseness(state, i, closeness) {
  return _patch(state, i, { closeness: isValidCloseness(closeness) ? closeness : DEFAULT_CLOSENESS });
}
export function leaveRelationshipBlank(state, i) { return _patch(state, i, { group: "", relation: "", leftBlank: true }); }
export function chooseAudience(state, i, v) {
  if (v === "skip") return skipContact(state, i);
  return _patch(state, i, { audience: v, skipped: false });
}
export function skipContact(state, i) { return _patch(state, i, { skipped: true }); }
export function unskipContact(state, i) { return _patch(state, i, { skipped: false }); }

// Resolve a raw closeness cell (canonical VALUE or its exact LABEL) to a canonical value, else "".
function _closenessValue(raw) {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "";
  const v = CLOSENESS_OPTIONS.find((o) => o.value === s);
  if (v) return v.value;
  const l = CLOSENESS_OPTIONS.find((o) => o.label.toLowerCase() === s);
  return l ? l.value : "";
}

// ---- resolve one row's relationship (never mutates) ----
function _relationOf(row, e) {
  const rawRel = (row.contact && row.contact.relationship) || "";
  const det = resolveRelationshipRaw(rawRel);
  let group = "", relation = "";
  if (e.leftBlank) { /* explicit blank */ }
  else if (_has(e, "group") || _has(e, "relation")) {
    group = e.group || (e.relation ? categoryForRelation(e.relation) : "");
    relation = e.relation && isValidRelation(group, e.relation) ? e.relation : "";
  } else if (det.deterministic) { group = det.category; relation = det.relation; }
  // Closeness precedence: user edit > explicit CSV Closeness column (value or label) > default.
  const csvClose = _closenessValue((row.contact && row.contact.relationshipCloseness) || "");
  const closeness = (e.closeness && isValidCloseness(e.closeness)) ? e.closeness : (csvClose || DEFAULT_CLOSENESS);
  return { rawRel, group, relation, closeness, unrecognizedRaw: !!rawRel && !det.deterministic };
}

// Build the whole review. Pure; single pass computes validation, dedup, and buckets.
export function buildReview(rows = [], state = freshReviewState()) {
  const ctx = state.context || {};
  const existing = new Set(ctx.existingEmails || []);
  const committed = new Set((state.committed || []).map(normalizeEmail).filter(Boolean));
  const commitErrors = state.commitErrors || {};
  const seen = new Map();                                   // first valid occurrence of an email in-file
  const items = [];

  for (const row of rows || []) {
    const i = row.index;
    const e = _edit(state, i);
    const eff = _effective(row, e);
    const { errors } = computeContactErrors(
      { name: eff.name, email: eff.email, birthday: eff.birthday, consent: eff.consent },
      { todayIso: ctx.todayIso, minorPolicy: "block", requireConsent: false },   // consent policy: OFF for personal import
    );
    const identityValid = errors.length === 0;

    // duplicate detection (dynamic — reflects inline email edits)
    let duplicate = null;
    if (identityValid && !e.skipped && eff.email) {
      if (existing.has(eff.email)) duplicate = "existing_record";
      else if (seen.has(eff.email)) duplicate = "same_file";
      else seen.set(eff.email, i);
    }

    // audience (business only). Precedence: user review edit > explicit valid CSV cell > path default.
    // Single-type paths default the recipientType from the path, but an explicit valid Recipient Type
    // cell overrides PER ROW (flagged when it differs from the list type); a non-blank UNKNOWN cell needs
    // review and is never guessed. Universal ("mixed") reads the cell / needs review.
    const business = !!state.business, kind = state.kind;
    let audience = "", audienceState = "none";
    if (business) {
      const cellRaw = String((row.contact || {}).recipientType || "").trim();
      const cellNorm = normalizeRecipientTypeRaw(cellRaw);                         // recognized synonym → canonical, else null
      if (e.audience && isCanonicalType(e.audience)) { audience = e.audience; audienceState = "chosen"; }   // user edit wins
      else if (kind && kind !== "mixed") {
        if (cellNorm && isCanonicalType(cellNorm)) { audience = cellNorm; audienceState = cellNorm === kind ? "auto" : "override_cell"; }
        else if (cellRaw) audienceState = "needs_audience";                        // non-blank unknown cell → review
        else { audience = isCanonicalType(kind) ? kind : ""; audienceState = "auto"; }   // blank cell → path default
      } else if (cellNorm) { audience = cellNorm; audienceState = "auto"; }        // mixed: recognized synonym
      else audienceState = "needs_audience";                                       // mixed: unknown/blank → review
    }

    const rel = _relationOf(row, e);

    // ---- bucket (exactly one) ----
    let bucket, blockerCode = null;
    if (committed.has(eff.email)) bucket = REVIEW_BUCKET.ADDED;   // already committed this session — never re-submit
    else if (e.skipped) bucket = REVIEW_BUCKET.WILL_SKIP;
    else if (errors.length && errors.some((c) => !FIXABLE.has(c))) { bucket = REVIEW_BUCKET.INVALID_EXCLUDED; blockerCode = errors.find((c) => !FIXABLE.has(c)); }
    else if (errors.length) { bucket = REVIEW_BUCKET.NEEDS_FIX; blockerCode = errors[0]; }
    else if (duplicate) bucket = REVIEW_BUCKET.ALREADY_IN_LIST;
    else if (audienceState === "needs_audience") { bucket = REVIEW_BUCKET.NEEDS_FIX; blockerCode = "needs_audience"; }
    else bucket = REVIEW_BUCKET.READY;

    // A backend per-row failure leaves the row Ready but flags a plain retry note (retryable next Add).
    const retryNote = (bucket === REVIEW_BUCKET.READY && commitErrors[eff.email]) ? commitErrors[eff.email] : "";

    items.push({
      index: i, name: eff.name, email: eff.email, birthday: eff.birthday, edited: Object.keys(e).length > 0,
      rawRel: rel.rawRel, hasRelation: !!rel.relation, relation: rel.relation, group: rel.group, closeness: rel.closeness,
      relationLabel: relationLabelFor(rel.relation), groupLabel: groupLabelFor(rel.group),
      relationUnrecognizedRaw: rel.unrecognizedRaw, relationProvided: !!rel.relation,
      audience, audienceState, bucket, blockerCode, retryNote,
      blockerMessage: blockerCode ? blockerMessageFor(blockerCode) : "",
      fixField: _fixFieldFor(blockerCode),                 // which control unblocks the row (no codes in the UI)
      errorCodes: errors,
    });
  }

  const by = (b) => items.filter((it) => it.bucket === b);
  const buckets = {
    ready: by(REVIEW_BUCKET.READY),
    needsFix: by(REVIEW_BUCKET.NEEDS_FIX),
    alreadyInList: by(REVIEW_BUCKET.ALREADY_IN_LIST),
    willSkip: by(REVIEW_BUCKET.WILL_SKIP),
    invalidExcluded: by(REVIEW_BUCKET.INVALID_EXCLUDED),
    added: by(REVIEW_BUCKET.ADDED),
  };
  const counts = {
    ready: buckets.ready.length, needsFix: buckets.needsFix.length, alreadyInList: buckets.alreadyInList.length,
    willSkip: buckets.willSkip.length, invalidExcluded: buckets.invalidExcluded.length,
    added: buckets.added.length, total: items.length,
  };
  return {
    items, buckets, counts,
    importCount: counts.ready,
    importEnabled: counts.ready > 0,                        // valid rows import even while blockers remain
  };
}

// ---- pagination (F5) — pure, bounded slices; the component owns the page number ----
export function paginate(items = [], page = 0, size = 25) {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const p = Math.min(Math.max(0, page), pages - 1);
  return { slice: items.slice(p * size, p * size + size), page: p, pages, size, total };
}

// ---- payload (ready rows only; F4 relationship contract) ----
export function importableRows(rows = [], state = freshReviewState()) {
  const ready = new Set(buildReview(rows, state).buckets.ready.map((it) => it.index));
  return (rows || []).filter((r) => ready.has(r.index));
}
export function buildReviewPayload(rows = [], state = freshReviewState()) {
  const review = buildReview(rows, state);
  return review.buckets.ready.map((it) => {
    const row = rows.find((r) => r.index === it.index);
    const eff = _effective(row, _edit(state, it.index));
    const out = {
      name: eff.name, email: eff.email, phone: eff.phone, company: eff.company, department: eff.department,
      recipientType: it.audience || "",                    // "" for Individual — boundary enforced here
      consent: eff.consent, source: eff.source, notes: eff.notes,
    };
    // F4: structured relationship fields ONLY when a relationship is actually set.
    if (it.hasRelation) {
      out.relationship = it.relation;
      out.relationshipCategory = it.group;
      out.relationshipCloseness = it.closeness;
      out.relationshipContext = "";
      out.relationshipRaw = it.rawRel || "";
    }
    if (eff.birthday) out.birthday = eff.birthday;
    // Optional shipping address in the canonical shape — preparation only; never blocks import, never
    // triggers gift/automation/payment. Emitted only when at least one field is present.
    if (eff.shippingAddress && Object.values(eff.shippingAddress).some((v) => v)) out.shippingAddress = eff.shippingAddress;
    return out;
  });
}

export { RELATIONSHIP_CATEGORIES, RELATIONS_BY_CATEGORY, CLOSENESS_OPTIONS };
