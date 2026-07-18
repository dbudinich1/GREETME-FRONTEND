// src/components/contactFormValidation.js
//
// TEAM A — GUARDED, OPTIONAL relationship validation for the manual recipient form (ContactForm).
// Pure + Node-testable. This closes the import↔manual compatibility gap: a contact imported WITHOUT a
// relationship (fully blank) must be openable and saveable in Edit Recipient for unrelated edits.
//
// Rules (do not change the canonical taxonomy/labels; never auto-classify a blank relationship):
//   • Fully blank (no group, no relationship) → VALID. The user may save unrelated edits.
//   • A group is chosen → the specific relationship AND closeness become required.
//   • A specific relationship is chosen → a (compatible) group AND closeness become required.
//   • Closeness alone (no group/relationship) → NOT an error; it is stripped on save so nothing
//     dangling is ever persisted.
//   • A complete relationship → unchanged behavior.

// Plain-language errors for a STARTED-but-incomplete relationship. `{}` means valid.
export function relationshipErrors(formData = {}) {
  const cat = String(formData.relationshipCategory || "").trim();
  const rel = String(formData.relationship || "").trim();
  const started = !!(cat || rel);            // closeness alone does not "start" a relationship — it is cleared on save
  if (!started) return {};                   // fully blank → valid (no errors for an untouched section)
  const errors = {};
  if (!cat) errors.relationship = "Choose a relationship group.";
  else if (!rel) errors.relationship = "Choose the specific relationship.";
  if (!String(formData.relationshipCloseness || "").trim()) errors.relationshipCloseness = "Choose how close you are.";
  return errors;
}

// True when the relationship is complete enough to persist structured fields (group + specific).
export function hasCompleteRelationship(formData = {}) {
  return !!(String(formData.relationshipCategory || "").trim() && String(formData.relationship || "").trim());
}

// Normalize before save: if the relationship is not complete, strip closeness + profile so a dangling
// Greet-Me Worthy / relationshipProfile is never persisted without a relationship. Complete → unchanged.
export function sanitizeRelationshipForSave(formData = {}) {
  if (hasCompleteRelationship(formData)) return formData;
  return { ...formData, relationshipCloseness: "", relationshipProfile: null };
}
