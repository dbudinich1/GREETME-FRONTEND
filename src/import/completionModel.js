// src/import/completionModel.js
//
// TEAM A — adaptive missing-information completion for the personal Import Wizard. Pure, framework-
// free, Node-testable. Replicates ContactForm's INLINE relationship option model byte-for-byte:
//   Type        = relationshipCategory  (family | friend | professional)
//   Relation    = relationship          (per-category canonical value, e.g. "colleague")
//   Description = relationshipCloseness (inner_circle | greetme_worthy | obligatory)  [REQUIRED in manual]
// relationshipProfile is derived exactly as ContactForm derives it (roleLabel === role value).
// HARD RULE: never infer Description/closeness or relationship description from the raw label —
// only Type/Relation may be resolved deterministically; everything else is a user choice.

// ---- Exact manual option model (mirror of ContactForm.jsx inline <option> arrays) ----
export const RELATIONSHIP_CATEGORIES = Object.freeze([
  { value: "family", label: "Family" },
  { value: "friend", label: "Friend" },
  { value: "professional", label: "Professional" },
]);

export const RELATIONS_BY_CATEGORY = Object.freeze({
  family: Object.freeze([
    { value: "family_member", label: "Family Member" },
    { value: "parent", label: "Parent" }, { value: "sibling", label: "Sibling" }, { value: "child", label: "Child" },
    { value: "grandparent", label: "Grandparent" }, { value: "grandchild", label: "Grandchild" }, { value: "aunt_uncle", label: "Aunt/Uncle" },
    { value: "cousin", label: "Cousin" }, { value: "nephew", label: "Nephew" }, { value: "niece", label: "Niece" },
    { value: "godson", label: "Godson" }, { value: "goddaughter", label: "Goddaughter" }, { value: "spouse", label: "Spouse" },
    { value: "partner", label: "Partner" }, { value: "fiancee", label: "Fiancee" }, { value: "in_law", label: "In-Law" },
  ]),
  friend: Object.freeze([
    { value: "best_friend", label: "Best Friend" }, { value: "close_friend", label: "Close Friend" }, { value: "friend", label: "Friend" },
    { value: "acquaintance", label: "Acquaintance" }, { value: "neighbor", label: "Neighbor" }, { value: "teammate", label: "Teammate" },
    { value: "classmate", label: "Classmate" },
  ]),
  professional: Object.freeze([
    { value: "colleague", label: "Colleague" }, { value: "mentor", label: "Mentor" }, { value: "mentee", label: "Mentee" },
    { value: "boss", label: "Boss" }, { value: "employee", label: "Employee" }, { value: "client", label: "Client" },
    { value: "vendor", label: "Vendor" }, { value: "business_partner", label: "Business Partner" },
  ]),
});

// "Description *" — REQUIRED in the manual form; here it is completed via a bulk default + overrides.
export const CLOSENESS_OPTIONS = Object.freeze([
  { value: "inner_circle", label: "Inner Circle" },
  { value: "greetme_worthy", label: "Greet-Me Worthy" },
  { value: "obligatory", label: "You Gotta Do What Ya Gotta Do" },
]);

export const ROW_STATE = Object.freeze({ READY: "ready", NEEDS_CHOICE: "needs_choice", OPTIONAL_MISSING: "optional_missing" });

// Normalize a raw label to a comparison key (case/space/punctuation-insensitive).
const _norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
// Stable key for a raw relationship value — used to key relationshipMappings consistently.
export function relationshipKey(raw) { return _norm(raw); }

// Deterministic index: every canonical VALUE and LABEL (normalized) → {category, relation}, plus
// the founder-specified safe synonyms. Relation values are unique across categories, so no conflict.
const DETERMINISTIC_INDEX = (() => {
  const idx = {};
  for (const cat of Object.keys(RELATIONS_BY_CATEGORY)) {
    for (const rel of RELATIONS_BY_CATEGORY[cat]) {
      idx[_norm(rel.value)] = { category: cat, relation: rel.value };
      idx[_norm(rel.label)] = { category: cat, relation: rel.value };
    }
  }
  idx[_norm("coworker")] = { category: "professional", relation: "colleague" };   // coworker / co-worker / co worker
  return idx;
})();

// Resolve a raw relationship label to a deterministic {category, relation} — or mark it as needing
// a user mapping. Only EXACT canonical/synonym matches are deterministic; nothing is inferred.
export function resolveRelationshipRaw(raw) {
  const key = _norm(raw);
  if (!key) return { hasRaw: false, deterministic: false };
  const hit = DETERMINISTIC_INDEX[key];
  if (hit) return { hasRaw: true, deterministic: true, category: hit.category, relation: hit.relation };
  return { hasRaw: true, deterministic: false };
}

export function isValidRelation(category, relation) {
  return (RELATIONS_BY_CATEGORY[category] || []).some((r) => r.value === relation);
}
export function isValidCloseness(v) { return CLOSENESS_OPTIONS.some((c) => c.value === v); }

// Build the manual-compatible relationshipProfile (roleLabel === role value), exactly as ContactForm.
export function buildRelationshipProfile(category, relation, closeness) {
  return relation && category ? { group: category, role: relation, roleLabel: relation, closeness: closeness || "" } : null;
}

// Resolve ONE preview row against the current completion state:
//   state = { descriptionDefault, relationshipMappings: { normKey: {category,relation} },
//             rowOverrides: { index: { category, relation, closeness, skipRelationship } } }
// Precedence for Type/Relation: row override > deterministic > unique-value mapping.
// Precedence for Description: row override > bulk default. NEVER derived from the raw label.
export function resolveRow(row, state = {}) {
  const contact = (row && row.contact) || {};
  const raw = contact.relationship || "";
  const index = row && row.index;
  const override = (state.rowOverrides && state.rowOverrides[index]) || {};
  const det = resolveRelationshipRaw(raw);

  if (override.skipRelationship) {
    return { index, raw, category: "", relation: "", closeness: "", state: ROW_STATE.OPTIONAL_MISSING, resolvedFrom: "skipped", deterministic: false };
  }

  let category = "", relation = "", resolvedFrom = "none";
  if (override.category && override.relation && isValidRelation(override.category, override.relation)) {
    category = override.category; relation = override.relation; resolvedFrom = "override";
  } else if (det.deterministic) {
    category = det.category; relation = det.relation; resolvedFrom = "deterministic";
  } else if (det.hasRaw) {
    const m = (state.relationshipMappings || {})[_norm(raw)];
    if (m && isValidRelation(m.category, m.relation)) { category = m.category; relation = m.relation; resolvedFrom = "mapping"; }
  }

  let closeness = "";
  if (override.closeness && isValidCloseness(override.closeness)) closeness = override.closeness;
  else if (isValidCloseness(state.descriptionDefault)) closeness = state.descriptionDefault;

  let st;
  if (!det.hasRaw && !override.category) st = ROW_STATE.OPTIONAL_MISSING;   // no relationship provided → optional
  else if (category && relation && closeness) st = ROW_STATE.READY;         // fully completed like a manual recipient
  else st = ROW_STATE.NEEDS_CHOICE;                                         // needs a mapping and/or a description

  return { index, raw, category, relation, closeness, state: st, resolvedFrom, deterministic: det.deterministic };
}

// Aggregate completion status over the valid, non-duplicate rows that would be created.
export function buildCompletionSummary(rows = [], state = {}) {
  const resolved = (rows || []).map((r) => resolveRow(r, state));
  const counts = { ready: 0, needs_choice: 0, optional_missing: 0 };
  for (const r of resolved) counts[r.state] += 1;

  // Unique raw values that are NON-deterministic and not yet mapped/overridden → one choice each.
  const unmapped = new Map();
  for (const r of resolved) {
    if (!r.raw) continue;
    if (resolveRelationshipRaw(r.raw).deterministic) continue;
    const key = _norm(r.raw);
    const mapped = (state.relationshipMappings || {})[key];
    const ov = state.rowOverrides && state.rowOverrides[r.index];
    const overridden = ov && (ov.relation || ov.skipRelationship);
    if (mapped || overridden) continue;
    const e = unmapped.get(key) || { raw: r.raw, key, count: 0 };
    e.count += 1; unmapped.set(key, e);
  }

  const needsDescription = resolved.some((r) => r.category && r.relation && !r.closeness);
  return {
    counts,
    total: resolved.length,
    uniqueUnmappedValues: [...unmapped.values()],
    needsDescription,
    unresolvedCount: counts.needs_choice,
    rows: resolved,
  };
}

// Final payload for the toCreate rows — carries the completed structured fields + the original raw
// value + full-date birthday. The backend persists these and derives relationshipProfile itself.
export function buildCompletedImportContacts(rows = [], state = {}) {
  return (rows || []).map((row) => {
    const c = (row && row.contact) || {};
    const raw = (row && row.__raw) || {};
    const map = (row && row.__map) || {};
    const birthday = map.birthday != null ? raw[map.birthday] : undefined;
    const res = resolveRow(row, state);
    const out = {
      name: c.fullName || "",
      email: c.email || "",
      phone: c.phone || "",
      company: c.company || "",
      department: c.department || "",
      recipientType: c.recipientType || "",
      consent: c.consent || "",
      source: c.source || "",
      notes: c.notes || "",
      relationship: res.relation || "",                 // canonical relation (matches manual option list)
      relationshipCategory: res.category || "",
      relationshipCloseness: res.closeness || "",
      relationshipContext: "",
      relationshipRaw: res.raw || (c.relationship || ""),
    };
    if (birthday != null && String(birthday).trim() !== "") out.birthday = birthday;
    return out;
  });
}

// Compatibility for an ALREADY-imported contact that has a raw relationship but no structured
// fields: return the DETERMINISTIC category/relation for display only (never guesses closeness,
// never mutates, never rewrites). Non-deterministic → null (must stay user-confirmed).
export function deterministicStructuredForContact(contact) {
  if (!contact || contact.relationshipCategory) return null;   // already structured → leave as-is
  const det = resolveRelationshipRaw(contact.relationship);
  if (!det.deterministic) return null;
  return { relationshipCategory: det.category, relationship: det.relation };
}
