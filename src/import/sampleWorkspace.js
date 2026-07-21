// src/import/sampleWorkspace.js
//
// TEAM A — session-scoped Sample Workspace for the Import Wizard. Sample contacts live ONLY in
// sessionStorage, tagged with the current auth token so a NEW authenticated session never restores
// an old sample. They are NEVER POSTed to any backend endpoint. Pure core is Node-testable; thin
// wrappers touch sessionStorage/localStorage only when present.

import { demoDataset } from "./demoData.js";

export const SAMPLE_STORAGE_KEY = "greetme_sample_workspace";

// Sample kind → demo dataset key. Personal kinds ("individual" plus the three Personal categories
// family/friend/professional — path is context only, no relationship/type invented) + the four
// business recipientKinds (employee/client/vendor/mixed — the last is the "Universal List").
export const SAMPLE_DATASET = Object.freeze({
  individual: "personal", family: "family", friend: "friends", professional: "professional",
  employee: "employees", client: "clients", vendor: "vendors", mixed: "mixed",
});

// ---- Downloadable sample CSV templates (fictional, reserved domains) ----
const COL_MAP = { "Name": "fullName", "Email": "email", "Recipient Type": "recipientType", "Relationship": "relationship", "Company": "company", "Birthday": "birthday" };
function _cell(row, col) {
  const v = row[COL_MAP[col]] == null ? "" : row[COL_MAP[col]];
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
export function sampleColumnsFor(kind) {
  const base = ["Name", "Email", "Relationship", "Company", "Birthday"];
  return kind === "mixed" ? ["Name", "Email", "Recipient Type", "Relationship", "Company", "Birthday"] : base;  // "mixed" = Universal List
}

// ---- Practice-CSV marker (authoritative practice signal — inspected in the PARSED CONTENTS, not the
// filename, so renaming can't defeat it). Practice-CSV-only: it is NOT in blank production templates and
// is stripped before a contact/payload is built (never persisted as contact data).
const _norm = (s) => String(s == null ? "" : s).trim().toLowerCase();
export const PRACTICE_MARKER_HEADER = "Greet-Me Practice File";
export const PRACTICE_MARKER_VALUE = "practice-v2";
// Classify parsed Papa output ({fields, rows}). marked = the marker column is present; valid = it is
// present on ≥1 data row and every non-empty value equals practice-v2 (mixed/conflicting → invalid).
export function detectPracticeCsv(fields = [], rows = []) {
  const col = (fields || []).find((f) => _norm(f) === _norm(PRACTICE_MARKER_HEADER));
  if (!col) return { marked: false, valid: false };
  const vals = (rows || []).map((r) => _norm(r && r[col])).filter(Boolean);
  const valid = vals.length > 0 && vals.every((v) => v === PRACTICE_MARKER_VALUE);
  return { marked: true, valid };
}
// Remove the marker column from parsed fields/rows so it never becomes a contact field or payload value.
export function stripPracticeMarker(fields = [], rows = []) {
  const keep = (fields || []).filter((f) => _norm(f) !== _norm(PRACTICE_MARKER_HEADER));
  const cleaned = (rows || []).map((r) => { const o = {}; for (const k of keep) o[k] = r ? r[k] : ""; return o; });
  return { fields: keep, rows: cleaned };
}

export function sampleCsvFor(kind) {
  const cols = [...sampleColumnsFor(kind), PRACTICE_MARKER_HEADER];   // marker column identifies a Practice CSV
  const rows = demoDataset(SAMPLE_DATASET[kind] || "personal");
  const cellFor = (r, c) => (c === PRACTICE_MARKER_HEADER ? PRACTICE_MARKER_VALUE : _cell(r, c));
  return cols.join(",") + "\n" + rows.map((r) => cols.map((c) => cellFor(r, c)).join(",")).join("\n") + "\n";
}
// Fictional sample contacts (tagged demo:true, reserved domains) for "Try the sample".
export function sampleContactsFor(kind) {
  return demoDataset(SAMPLE_DATASET[kind] || "personal");
}

// ---- Session isolation (pure core) ----
// The workspace is tagged with a NON-SECRET session discriminator derived from the JWT's public
// claims (sub = user id, iat = issued-at) — NEVER the raw bearer token, no token substring, hash,
// or reversible derivative. A different user (sub) or a new login (iat) → different discriminator;
// logged-out → "anon".
function _decodeJwtClaims() {
  try {
    const t = globalThis.localStorage && localStorage.getItem("token");
    if (!t || typeof t !== "string") return null;
    const parts = t.split(".");
    if (parts.length !== 3) return null;                       // opaque token → cannot derive → anon
    const b64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = (typeof atob === "function") ? atob(b64) : Buffer.from(b64, "base64").toString("binary");
    const payload = JSON.parse(decodeURIComponent(escape(json)));
    return (payload && typeof payload === "object") ? payload : null;
  } catch { return null; }
}
export function sessionDiscriminator() {
  const p = _decodeJwtClaims();
  const uid = p && (p.sub || p.userId || p.id);
  if (uid != null && p.iat != null) return `u:${uid}:${p.iat}`;   // non-secret: user id + issued-at only
  return "anon";
}

// Parse stored JSON; return contacts only when the stored NON-SECRET discriminator matches the
// current one. Mismatch, corruption, missing discriminator, or anonymous → cleared (never restore
// another user's / another login's / an authenticated sample under anon).
export function reconcileSampleRaw(rawJson, currentSid) {
  if (!rawJson) return { contacts: [], cleared: false };
  let parsed;
  try { parsed = JSON.parse(rawJson); } catch { return { contacts: [], cleared: true }; }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.contacts)) return { contacts: [], cleared: true };
  if (currentSid === "anon" || parsed.sid !== currentSid) return { contacts: [], cleared: true };
  return { contacts: parsed.contacts, cleared: false };
}
// `kind` (individual | employee | client | vendor | mixed) is stored so a same-session reload can
// restore the sample into the right surface (individual → combined preview; business → its own list).
export function serializeSample(contacts, currentSid, kind = "individual") {
  return JSON.stringify({ sid: currentSid, v: 1, kind: kind || "individual", contacts: Array.isArray(contacts) ? contacts : [] });
}
// Read the stored kind (best-effort; reconcile still owns the security decision on `contacts`).
export function sampleKindFromRaw(rawJson) {
  try { const p = JSON.parse(rawJson); return (p && typeof p.kind === "string") ? p.kind : "individual"; } catch { return "individual"; }
}

// ---- sessionStorage wrappers (no-op when storage is unavailable, e.g. Node tests) ----
function _ss() { try { return globalThis.sessionStorage || null; } catch { return null; } }
// Returns { contacts, kind }. Contacts only survive the non-secret session-discriminator check.
export function loadSampleWorkspace() {
  const ss = _ss(); if (!ss) return { contacts: [], kind: "individual" };
  const raw = ss.getItem(SAMPLE_STORAGE_KEY);
  const { contacts, cleared } = reconcileSampleRaw(raw, sessionDiscriminator());
  if (cleared) { try { ss.removeItem(SAMPLE_STORAGE_KEY); } catch { /* ignore */ } return { contacts: [], kind: "individual" }; }
  return { contacts, kind: sampleKindFromRaw(raw) };
}
export function saveSampleWorkspace(contacts, kind = "individual") {
  const ss = _ss(); if (!ss) return;
  try { ss.setItem(SAMPLE_STORAGE_KEY, serializeSample(contacts, sessionDiscriminator(), kind)); } catch { /* ignore */ }
}
export function clearSampleWorkspace() {
  const ss = _ss(); if (!ss) return;
  try { ss.removeItem(SAMPLE_STORAGE_KEY); } catch { /* ignore */ }
}

// ---- Recipients Practice View (fail-closed entry decision). Pure resolver + a thin sessionStorage reader.
// status:
//   "none"    — no practice workspace stored → ignore the marker, render the normal Recipients page
//   "cleared" — malformed / discriminator mismatch → storage cleared, render the normal page (fail closed)
//   "empty"   — a valid workspace with zero contacts → the "no practice contacts" empty state
//   "active"  — a valid workspace with ≥1 contact → render Practice View with these contacts
export function resolvePracticeView(rawJson, currentSid) {
  if (rawJson == null || rawJson === "") return { status: "none", contacts: [] };
  const { contacts, cleared } = reconcileSampleRaw(rawJson, currentSid);
  if (cleared) return { status: "cleared", contacts: [] };
  return { status: contacts.length ? "active" : "empty", contacts, kind: sampleKindFromRaw(rawJson) };
}
// Read + fail-close: returns the resolved practice view, and PURGES storage on a "cleared" (mismatch/
// malformed) outcome so stale/foreign practice data can never be shown. Never throws.
export function readPracticeView() {
  const ss = _ss(); if (!ss) return { status: "none", contacts: [] };
  let raw = null; try { raw = ss.getItem(SAMPLE_STORAGE_KEY); } catch { return { status: "none", contacts: [] }; }
  const res = resolvePracticeView(raw, sessionDiscriminator());
  if (res.status === "cleared") { try { ss.removeItem(SAMPLE_STORAGE_KEY); } catch { /* ignore */ } }
  return res;
}
