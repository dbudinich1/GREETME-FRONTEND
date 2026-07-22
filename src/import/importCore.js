// src/import/importCore.js
//
// TEAM A — Contact Import Wizard processing core. Pure, framework-free, Node-testable.
// Owns the "import quality" substance that runs BEFORE any write: header mapping, required-
// field validation, email/phone normalization, spreadsheet formula-injection protection,
// same-file + existing-record duplicate detection, file/row/media limits, minor & privacy
// boundaries, consent/source attribution, idempotency keying, and partial-success accounting.
// No network, no DOM, no arbitrary URL fetching.

// ----- Limits (file-size, row-count, media-type) -----
export const LIMITS = Object.freeze({
  maxBytes: 5 * 1024 * 1024,     // 5 MB
  maxRows: 5000,
  maxSheets: 12,                 // reject workbooks with more than this many worksheets (fail closed)
  allowedMime: Object.freeze([
    "text/csv", "application/csv", "text/plain",
    "application/vnd.ms-excel",  // legacy .xls
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",  // .xlsx
  ]),
  allowedExt: Object.freeze([".csv", ".xlsx", ".xls"]),
});

// Worksheet-count guard (workbooks only). Kept beside checkRowCount for a single limits source.
export function checkSheetCount(n) {
  if (n > LIMITS.maxSheets) return { ok: false, error: "too_many_sheets", max: LIMITS.maxSheets };
  return { ok: true };
}

export function checkFileLimits(file) {
  if (!file) return { ok: false, error: "no_file" };
  const name = String(file.name || "");
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (!LIMITS.allowedExt.includes(ext)) return { ok: false, error: "unsupported_extension" };
  if (file.type && !LIMITS.allowedMime.includes(file.type)) return { ok: false, error: "unsupported_media_type" };
  if (typeof file.size === "number" && file.size > LIMITS.maxBytes) return { ok: false, error: "file_too_large" };
  return { ok: true };
}

export function checkRowCount(n) {
  if (n > LIMITS.maxRows) return { ok: false, error: "too_many_rows", max: LIMITS.maxRows };
  return { ok: true };
}

// ---- Personal import request budget (mirrors the backend contacts-import limits) ----
// The backend caps EACH POST /api/contacts/import at CONTACTS_IMPORT_MAX = 100 rows and rate-limits
// the endpoint to 5 requests/hour/user+IP (rlContactsImport). A single import is therefore safely
// committable only up to 100 × 5 = 500 contacts, sent as ≤5 sequential requests of ≤100 rows. We
// NEVER change or bypass either server limit — we plan against them, send no request larger than the
// per-request cap, keep the sequence inside the hourly budget, and fail closed with a truthful message
// when a selection cannot be committed within that budget. No rate-limit exemption is created.
export const IMPORT_REQUEST_MAX = 100;      // ≤ backend CONTACTS_IMPORT_MAX
export const IMPORT_REQUEST_BUDGET = 5;     // ≤ backend rlContactsImport (5/hour)
export const IMPORT_MAX_COMMITTABLE = IMPORT_REQUEST_MAX * IMPORT_REQUEST_BUDGET; // 500

// Pure: can `count` be committed within the budget, and in how many ≤perRequest requests?
export function planImportRequests(count, { perRequest = IMPORT_REQUEST_MAX, budget = IMPORT_REQUEST_BUDGET } = {}) {
  const max = perRequest * budget;
  const n = Math.max(0, Math.floor(Number(count) || 0));
  if (n > max) return { ok: false, reason: "over_budget", max, perRequest, budget, requestsNeeded: Math.ceil(n / perRequest) };
  return { ok: true, requestCount: Math.ceil(n / perRequest), perRequest, budget, max };
}

// Per-row reason for a not-imported contact when a batch fails AFTER a partial success — truthful and
// status-specific so the wizard surfaces retryable (429) vs terminal (403) correctly.
function importFailureReason(status) {
  if (status === 429) return "Too many requests. Please wait and try again.";
  if (status === 403) return "Recipient/import limit reached.";
  if (status === 401) return "Your session expired. Please sign in again.";
  return "Not imported — the server couldn't be reached. Please try again.";
}

// Orchestrate a budgeted personal import. `sendBatch(batch)` MUST call the existing import endpoint and
// resolve to the backend body on 2xx, or throw Error{status[,code]} / resolve {ok:false,status} on
// failure (the api.request contract). Behavior:
//   • > IMPORT_MAX_COMMITTABLE selected → ZERO requests sent → { ok:false, overBudget:true, ... }.
//   • ≤ 100 selected → exactly ONE request → identical to the pre-existing single-request behavior.
//   • 101–500 → ≤5 sequential ≤100 requests, aggregating { imported, failed, errors }.
//   • First batch fails before ANY import → { ok:false, hardFail:true, status, error } (caller re-throws
//     → preserves the truthful 403/429/5xx/network banner; never a false success).
//   • A later batch fails after ≥1 import → aggregated results body with a synthesized per-row error for
//     every not-imported contact → the wizard shows a truthful PARTIAL and un-sent rows stay retryable.
export async function runBudgetedImport(contacts = [], sendBatch, opts = {}) {
  const perRequest = opts.perRequest ?? IMPORT_REQUEST_MAX;
  const budget = opts.budget ?? IMPORT_REQUEST_BUDGET;
  const list = Array.isArray(contacts) ? contacts : [];
  const plan = planImportRequests(list.length, { perRequest, budget });
  if (!plan.ok) {
    // Stop BEFORE any request. Carry a non-zero `data.failed` so the legacy caller never reads it as
    // an all-zero success; the wizard classifier surfaces the truthful over-budget message via overBudget.
    return { ok: false, overBudget: true, max: plan.max, requested: list.length, data: { imported: 0, failed: list.length, errors: [] } };
  }
  const agg = { imported: 0, failed: 0, errors: [] };
  for (let i = 0; i < list.length; i += perRequest) {
    const batch = list.slice(i, i + perRequest);
    let body = null, status = 0, caught = null;
    try { body = await sendBatch(batch); }
    catch (e) { caught = e; status = (e && e.status) || 0; body = null; }
    if (body && body.ok === false) { status = body.status || 0; body = null; }

    if (body == null) {
      if (agg.imported === 0) {
        // Nothing imported yet → preserve the throw contract; caller re-throws this exact error.
        const error = caught || Object.assign(new Error(`HTTP ${status}`), { status });
        return { ok: false, hardFail: true, status, error };
      }
      // Partial: this batch + every un-sent contact are not imported. Fail closed with a truthful,
      // per-row reason so the wizard never shows those as added.
      const remaining = list.slice(i);
      const reason = importFailureReason(status);
      for (const c of remaining) agg.errors.push({ contact: { email: (c && c.email) || "" }, error: reason });
      agg.failed += remaining.length;
      return { ok: true, data: { imported: agg.imported, failed: agg.failed, errors: agg.errors } };
    }
    const s = summarizeImport(body);
    agg.imported += s.added;
    agg.failed += s.failed;
    if (Array.isArray(s.errors)) agg.errors.push(...s.errors);
  }
  return { ok: true, data: { imported: agg.imported, failed: agg.failed, errors: agg.errors } };
}

// Content-based spoof detection: XLSX (and any ZIP) begins with the local-file-header
// signature "PK\x03\x04". A file claiming .csv whose BYTES are actually a zip/xlsx must NOT be
// parsed as CSV — extension alone is never trusted.
export function looksLikeZip(bytes) {
  if (!bytes || bytes.length < 4) return false;
  return bytes[0] === 0x50 && bytes[1] === 0x4b && (bytes[2] === 0x03 || bytes[2] === 0x05 || bytes[2] === 0x07);
}

// ----- Formula-injection protection -----
// A cell beginning with =, +, -, @, or a control char can execute in Excel/Sheets. Neutralize
// by prefixing a single quote. Applied to EVERY imported string value before use/preview.
export function sanitizeCellValue(v) {
  if (typeof v !== "string") return v;
  if (/^[=+\-@\t\r]/.test(v)) return "'" + v;
  return v;
}

// ----- Normalization -----
export function normalizeEmail(raw) {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export function isValidEmail(raw) { return EMAIL_RE.test(normalizeEmail(raw)); }

// E.164-ish normalization: keep a leading +, strip all other non-digits. Never fabricates.
export function normalizePhone(raw) {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  const plus = s.startsWith("+");
  const digits = s.replace(/\D/g, "");
  if (!digits) return "";
  return (plus ? "+" : "") + digits;
}

// ----- Header aliasing / auto-map -----
export const CANONICAL_FIELDS = Object.freeze([
  "fullName", "firstName", "lastName", "email", "phone", "relationship",
  "relationshipCategory", "relationshipCloseness",
  "company", "department", "recipientType", "birthday", "consent", "source", "notes",
  // shipping address (maps to canonical contact.shippingAddress { line1, line2, city, state, zip, country })
  "addressLine1", "addressLine2", "city", "state", "postalCode", "country",
]);
const ALIASES = Object.freeze({
  fullName: ["full name", "name", "contact name", "recipient"],
  firstName: ["first name", "first", "given name", "fname"],
  lastName: ["last name", "last", "surname", "family name", "lname"],
  email: ["email", "e-mail", "email address", "work email"],
  phone: ["phone", "mobile", "cell", "telephone", "tel"],
  relationship: ["relationship", "relation", "role"],
  // "Type" is ContactForm's label for relationshipCategory (Family/Friend/Professional); the six-path
  // templates use it that way. relationshipCategory precedes recipientType in CANONICAL_FIELDS, so a
  // "Type" header maps here. "Description" is the template label for relationshipCloseness.
  relationshipCategory: ["type", "relationship group", "relationship category", "group"],
  relationshipCloseness: ["description", "closeness", "relationship closeness"],
  company: ["company", "employer", "organization", "org", "business"],
  department: ["department", "dept", "team", "division"],
  recipientType: ["recipient type", "category", "employee/client"],
  birthday: ["birthday", "birth date", "dob", "date of birth"],
  consent: ["consent", "opt-in", "optin", "consented"],
  source: ["source", "origin", "list", "acquired from"],
  notes: ["notes", "note", "comments", "remarks"],
  addressLine1: ["address line 1", "address line1", "address1", "address", "street", "street address"],
  addressLine2: ["address line 2", "address line2", "address2", "apt", "suite", "unit"],
  city: ["city", "town"],
  state: ["state", "province", "state/province", "region"],
  postalCode: ["postal/zip code", "postal code", "zip", "zip code", "postcode", "postal", "zip/postal code"],
  country: ["country"],
});
const norm = (h) => String(h || "").trim().toLowerCase().replace(/\s+/g, " ");
export function autoMapHeaders(headers = []) {
  const mapping = {};
  const used = new Set();
  for (const field of CANONICAL_FIELDS) {
    const wants = ALIASES[field] || [];
    const hit = headers.find((h) => wants.includes(norm(h)) && !used.has(h));
    if (hit) { mapping[field] = hit; used.add(hit); }
  }
  const unmapped = headers.filter((h) => !used.has(h)); // never silently dropped — surfaced
  return { mapping, unmapped };
}

// ----- Row processing (map → sanitize → normalize → validate) -----
// minorPolicy: 'block' (default) rejects rows with a birthday under `minAgeYears`; 'flag' warns.
export function processRow(rawRow = {}, mapping = {}, opts = {}) {
  rawRow = rawRow || {}; // tolerate a null/malformed row (never throw)
  const { minorPolicy = "block", minAgeYears = 13, todayIso, requireConsent = false } = opts;
  const get = (field) => {
    const col = mapping[field];
    return col != null ? sanitizeCellValue(rawRow[col]) : undefined;
  };
  const trim = (x) => (typeof x === "string" ? x.trim() : x);

  let fullName = trim(get("fullName")) || "";
  const first = trim(get("firstName")) || "";
  const last = trim(get("lastName")) || "";
  if (!fullName && (first || last)) fullName = [first, last].filter(Boolean).join(" ");

  const email = normalizeEmail(get("email"));
  const phone = normalizePhone(get("phone"));
  const birthday = trim(get("birthday")) || "";

  // Optional shipping address → canonical contact.shippingAddress { line1, line2, city, state, zip,
  // country }. Included ONLY when at least one field is present (a blank address never changes the
  // contact shape and never blocks import). Preparation only — storing an address triggers nothing.
  const shippingAddress = {
    line1: trim(get("addressLine1")) || "",
    line2: trim(get("addressLine2")) || "",
    city: trim(get("city")) || "",
    state: trim(get("state")) || "",
    zip: trim(get("postalCode")) || "",
    country: trim(get("country")) || "",
  };
  const hasAddress = Object.values(shippingAddress).some((v) => v);

  const contact = {
    fullName,
    email,
    phone,                                   // normalized; transmission policy decided by caller
    relationship: trim(get("relationship")) || "",
    relationshipCategory: trim(get("relationshipCategory")) || "",
    relationshipCloseness: trim(get("relationshipCloseness")) || "",
    company: trim(get("company")) || "",
    department: trim(get("department")) || "",
    recipientType: trim(get("recipientType")) || "",
    consent: trim(get("consent")) || "",
    source: trim(get("source")) || "",
    notes: trim(get("notes")) || "",
    ...(hasAddress ? { shippingAddress } : {}),
  };

  const { errors, warnings } = computeContactErrors(
    { name: fullName, email, birthday, consent: contact.consent },
    { minorPolicy, minAgeYears, todayIso, requireConsent },
  );
  return { contact, errors, warnings, valid: errors.length === 0 };
}

// SINGLE authoritative validation verdict for a contact's identity + privacy fields. processRow uses
// it, and the Import Wizard's review model re-runs it after every inline edit so both layers can
// never disagree (audit F1). `email` should already be normalized; `birthday` is a raw date string;
// `todayIso` MUST be supplied for the age gate (never guessed). Returns { errors, warnings }.
export function computeContactErrors(fields = {}, opts = {}) {
  const { name = "", email = "", birthday = "", consent = "" } = fields;
  const { minorPolicy = "block", minAgeYears = 13, todayIso, requireConsent = false } = opts;
  const errors = [];
  const warnings = [];
  if (!String(name).trim()) errors.push("missing_name");
  if (!email) errors.push("missing_email");
  else if (!isValidEmail(email)) errors.push("invalid_email");

  const age = ageFromBirthday(birthday, todayIso);
  if (age != null && age < minAgeYears) {
    if (minorPolicy === "block") errors.push("minor_blocked");
    else warnings.push("minor_flagged");
  }
  if (requireConsent && !/^(y|yes|true|1|opt.?in|consented)$/i.test(consent)) {
    errors.push("consent_required");
  }
  return { errors, warnings };
}

// Whole years between `birthday` and `todayIso`. Returns null when the birthday is missing/unparseable
// or when no reference date is supplied (the age gate is never applied on a guessed "now").
export function ageFromBirthday(birthday, todayIso) {
  if (!birthday) return null;
  const d = new Date(birthday);
  if (isNaN(d.getTime())) return null;
  const now = todayIso ? new Date(todayIso) : null;
  if (!now || isNaN(now.getTime())) return null; // never guess "now"; caller supplies it
  let age = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) age--;
  return age;
}

// ----- Duplicate detection (same-file + existing-record), before any write -----
export function detectDuplicates(processed = [], existingEmails = []) {
  const existing = new Set((existingEmails || []).map(normalizeEmail).filter(Boolean));
  const seen = new Map(); // email → first index
  return processed.map((p, i) => {
    const email = p.contact && p.contact.email;
    let dup = null;
    if (email) {
      if (existing.has(email)) dup = "existing_record";
      else if (seen.has(email)) dup = "same_file";
      else seen.set(email, i);
    }
    return { ...p, duplicate: dup };
  });
}

// ----- Preview / commit selection accounting -----
// strategy per duplicate kind: 'skip' | 'update' | 'merge' (default skip).
export function buildPlan(deduped = [], { duplicateStrategy = "skip" } = {}) {
  const plan = { toCreate: [], toUpdate: [], toSkip: [], invalid: [] };
  for (const row of deduped) {
    if (!row.valid) { plan.invalid.push(row); continue; }
    if (!row.duplicate) { plan.toCreate.push(row); continue; }
    if (duplicateStrategy === "skip") plan.toSkip.push(row);
    else plan.toUpdate.push(row); // update + merge both go through the update path
  }
  return plan;
}

// ----- Idempotency -----
// Deterministic batch key from a stable scope + the sorted set of emails. A retry of the same
// batch reuses the key; a different payload yields a different key.
export function importBatchKey(scope, processed = []) {
  const emails = processed
    .map((p) => (p.contact && p.contact.email) || "")
    .filter(Boolean)
    .sort()
    .join(",");
  return `imp:${String(scope || "")}:${_hash(String(scope || "") + "|" + emails)}`;
}
function _hash(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h.toString(16);
}

// ----- Partial-success accounting from a backend response -----
export function summarizeImport(response) {
  const d = (response && (response.data || response)) || {};
  return {
    added: d.added ?? d.imported ?? 0,
    updated: d.updated ?? 0,
    merged: d.merged ?? 0,
    skipped: d.skipped ?? 0,
    failed: d.failed ?? (Array.isArray(d.errors) ? d.errors.length : 0),
    errors: Array.isArray(d.errors) ? d.errors : [],
  };
}
