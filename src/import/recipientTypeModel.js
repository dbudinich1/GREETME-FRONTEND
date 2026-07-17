// src/import/recipientTypeModel.js
//
// TEAM A — corporate recipient-TYPE resolution for the Import Wizard. Pure + Node-testable.
// Single-type imports (Employees/Clients/Vendors) auto-apply a fixed recipientType and never
// require a type column. A Mixed List reads a recipientType column, normalizes recognized synonyms,
// and asks the user to map each UNIQUE unknown value once (row overrides allowed). Nothing is
// silently guessed. recipientType is the only backend field written — no new backend fields.

export const CANONICAL_RECIPIENT_TYPES = Object.freeze(["employee", "client", "vendor"]);

// The corporate recipient-type selector options ("Who are you importing?").
export const RECIPIENT_KINDS = Object.freeze([
  { value: "employee", label: "Employees", blurb: "Import employees with birthdays, hire dates, departments, titles, and workplace details." },
  { value: "client", label: "Clients", blurb: "Import client contacts, companies, relationship details, and important dates." },
  { value: "vendor", label: "Vendors", blurb: "Import vendors, service partners, companies, and relationship details." },
  { value: "mixed", label: "Universal List", blurb: "Import a combined file — recognized types are normalized; unknown types are mapped once during review." },
]);

// Options used when the user maps an unknown type or overrides a row (single canonical types only).
export const RECIPIENT_TYPE_OPTIONS = Object.freeze([
  { value: "employee", label: "Employee" },
  { value: "client", label: "Client" },
  { value: "vendor", label: "Vendor" },
]);

const _norm = (s) => String(s == null ? "" : s).toLowerCase().replace(/[^a-z0-9]/g, "");
export function recipientTypeKey(raw) { return _norm(raw); }

// Recognized synonyms → canonical type. Unknown → null (must be user-mapped).
const TYPE_SYNONYMS = (() => {
  const m = {};
  const add = (canon, words) => words.forEach((w) => { m[_norm(w)] = canon; });
  add("employee", ["employee", "employees", "staff"]);
  add("client", ["client", "clients", "customer", "customers"]);
  add("vendor", ["vendor", "vendors", "supplier", "suppliers"]);
  return m;
})();

export function normalizeRecipientTypeRaw(raw) {
  const key = _norm(raw);
  if (!key) return null;                 // blank → no type (unknown, but not a value to map)
  return TYPE_SYNONYMS[key] || null;     // null → unknown value that needs a user mapping
}
export function isCanonicalType(v) { return CANONICAL_RECIPIENT_TYPES.includes(v); }
export function isMixedKind(kind) { return kind === "mixed"; }

// Resolve one row's recipientType.
//   kind = "employee"|"client"|"vendor"  → fixed, auto-applied (no column required)
//   kind = "mixed"                       → row override > synonym-normalized column > unique mapping
// Returns "" when a mixed row's type is unknown and unmapped (surfaced as needing a choice).
export function resolveRecipientTypeForRow(row, state = {}) {
  const { kind, typeMappings = {}, rowTypeOverrides = {} } = state;
  const index = row && row.index;
  const ov = rowTypeOverrides[index];
  if (ov && isCanonicalType(ov)) return ov;
  if (kind && kind !== "mixed") return isCanonicalType(kind) ? kind : "";   // single-type auto-apply
  const raw = (row && row.contact && row.contact.recipientType) || "";
  const det = normalizeRecipientTypeRaw(raw);
  if (det) return det;
  const mapped = typeMappings[_norm(raw)];
  return isCanonicalType(mapped) ? mapped : "";
}

// Stamp recipientType onto an already-built payload (same order as rows). Personal ownership
// (no kind / "personal") keeps whatever the CSV carried; corporate kinds resolve per row.
export function applyRecipientTypes(payload = [], rows = [], typeState = {}) {
  if (!typeState.kind || typeState.kind === "personal") return payload;
  return payload.map((c, i) => ({ ...c, recipientType: resolveRecipientTypeForRow(rows[i], typeState) }));
}

// For a Mixed List: unique raw type values that are neither blank, recognized, nor yet mapped/
// overridden — each needs ONE user mapping. Single-type kinds never need this.
export function buildRecipientTypeSummary(rows = [], state = {}) {
  const { kind, typeMappings = {}, rowTypeOverrides = {} } = state;
  if (kind !== "mixed") {
    return { needsTypeMapping: false, uniqueUnknownTypes: [], unresolvedCount: 0, mixed: false };
  }
  const unknown = new Map();
  let unresolved = 0;
  for (const r of rows) {
    const raw = (r && r.contact && r.contact.recipientType) || "";
    const ov = rowTypeOverrides[r.index];
    if (ov && isCanonicalType(ov)) continue;
    if (normalizeRecipientTypeRaw(raw)) continue;      // recognized synonym
    const key = _norm(raw);
    if (!key) { unresolved += 1; continue; }           // blank type in a mixed file → unresolved
    if (typeMappings[key] && isCanonicalType(typeMappings[key])) continue;  // already mapped
    unresolved += 1;
    const e = unknown.get(key) || { raw, key, count: 0 };
    e.count += 1; unknown.set(key, e);
  }
  return { needsTypeMapping: unknown.size > 0 || unresolved > 0, uniqueUnknownTypes: [...unknown.values()], unresolvedCount: unresolved, mixed: true };
}
