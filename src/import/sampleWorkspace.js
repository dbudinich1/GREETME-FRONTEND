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
// Parse stored JSON; return contacts only when the stored token matches the CURRENT session token.
// A mismatch, corruption, or a missing token → cleared (never restore another session's sample).
export function reconcileSampleRaw(rawJson, currentToken) {
  if (!rawJson) return { contacts: [], cleared: false };
  let parsed;
  try { parsed = JSON.parse(rawJson); } catch { return { contacts: [], cleared: true }; }
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.contacts)) return { contacts: [], cleared: true };
  if (parsed.token !== currentToken) return { contacts: [], cleared: true };
  return { contacts: parsed.contacts, cleared: false };
}
export function serializeSample(contacts, currentToken) {
  return JSON.stringify({ token: currentToken, v: 1, contacts: Array.isArray(contacts) ? contacts : [] });
}

// ---- sessionStorage wrappers (no-op when storage is unavailable, e.g. Node tests) ----
function _token() { try { return (globalThis.localStorage && localStorage.getItem("token")) || "anon"; } catch { return "anon"; } }
function _ss() { try { return globalThis.sessionStorage || null; } catch { return null; } }
export function loadSampleWorkspace() {
  const ss = _ss(); if (!ss) return [];
  const { contacts, cleared } = reconcileSampleRaw(ss.getItem(SAMPLE_STORAGE_KEY), _token());
  if (cleared) { try { ss.removeItem(SAMPLE_STORAGE_KEY); } catch { /* ignore */ } }
  return contacts;
}
export function saveSampleWorkspace(contacts) {
  const ss = _ss(); if (!ss) return;
  try { ss.setItem(SAMPLE_STORAGE_KEY, serializeSample(contacts, _token())); } catch { /* ignore */ }
}
export function clearSampleWorkspace() {
  const ss = _ss(); if (!ss) return;
  try { ss.removeItem(SAMPLE_STORAGE_KEY); } catch { /* ignore */ }
}
