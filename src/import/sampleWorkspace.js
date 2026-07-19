// src/import/sampleWorkspace.js
//
// TEAM A — session-scoped Sample Workspace for the Import Wizard. Sample contacts live ONLY in
// sessionStorage, tagged with the current auth token so a NEW authenticated session never restores
// an old sample. They are NEVER POSTed to any backend endpoint. Pure core is Node-testable; thin
// wrappers touch sessionStorage/localStorage only when present.

import { demoDataset } from "./demoData.js";

export const SAMPLE_STORAGE_KEY = "greetme_sample_workspace";

// Sample kind → demo dataset key. "individual" (personal) + the four business recipientKinds
// (employee/client/vendor/mixed — the last is the "Universal List").
export const SAMPLE_DATASET = Object.freeze({
  individual: "personal", employee: "employees", client: "clients", vendor: "vendors", mixed: "mixed",
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
export function sampleCsvFor(kind) {
  const cols = sampleColumnsFor(kind);
  const rows = demoDataset(SAMPLE_DATASET[kind] || "personal");
  return cols.join(",") + "\n" + rows.map((r) => cols.map((c) => _cell(r, c)).join(",")).join("\n") + "\n";
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
