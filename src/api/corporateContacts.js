// src/api/corporateContacts.js
//
// TEAM A — Slice 2B-2B client for the DORMANT-gated Corporate contact-import API
// (/api/corporate-contacts, backend @ 7577967). Consumes ONLY the two pushed endpoints:
//   GET  /organizations                                   → the caller's authorized orgs (bootstrap)
//   POST /organizations/:orgId/contacts/import            → the contact import (dormant → 503)
// Authorization is ALWAYS backend-derived from the authenticated user's stored active membership;
// this client never sends, trusts, or derives an org id from workbook/typed/query/cached data — the
// orgId in the POST path must be one returned by GET /organizations.
//
// FAIL-CLOSED transport rules:
//   • 503 → { dormant, reason } (surface as intentional unavailability, NOT an empty org list)
//   • 401/403 → { unauthorized } (never surfaces org/contact data)
//   • GET network failure → { networkError } (safe: a read never mutates)
//   • POST network failure / abort → { indeterminate } (a mutation MAY have landed → never a safe
//     one-click resubmit, never "0 added")
// `fetchImpl` + `getToken` are injectable so the flow is unit-/browser-testable without a real network.

function viteApiBase() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) {
      return import.meta.env.VITE_API_BASE;
    }
  } catch { /* import.meta.env absent under node:test */ }
  return "";
}
function defaultGetToken() {
  try { return localStorage.getItem("token"); } catch { return null; }
}

export const DORMANT_REASON = "corporate_import_disabled";

// A shape guard for the bootstrap response (fail closed — never trust a malformed body).
export function isRecognizedOrganizationsBody(data) {
  return !!data && typeof data === "object" && data.ok === true
    && data.data && Array.isArray(data.data.organizations);
}
// Keep only well-formed org entries (id + role strings). Drops malformed/duplicate-id entries so a
// bad row can never silently authorize or produce a hollow selectable option.
export function sanitizeOrganizations(data) {
  const raw = (data && data.data && data.data.organizations) || [];
  const seen = new Set();
  const out = [];
  for (const o of raw) {
    if (!o || typeof o.corporateOrganizationId !== "string" || !o.corporateOrganizationId) continue;
    if (typeof o.role !== "string" || !o.role) continue;
    if (seen.has(o.corporateOrganizationId)) continue;
    seen.add(o.corporateOrganizationId);
    const row = { corporateOrganizationId: o.corporateOrganizationId, role: o.role };
    if (typeof o.name === "string" && o.name.trim()) row.name = o.name.trim(); // display-only, never authority
    out.push(row);
  }
  return out;
}

export function createCorporateContactsClient({
  fetchImpl = (typeof fetch !== "undefined" ? fetch : undefined),
  getToken = defaultGetToken,
  apiBase = viteApiBase(),
} = {}) {
  if (typeof fetchImpl !== "function") throw new Error("corporateContactsClient: fetchImpl is required");

  function headers() {
    const h = { "Content-Type": "application/json" };
    const token = getToken && getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  }

  // Shared status handling for BOTH endpoints (before body parsing).
  function classifyStatus(status) {
    if (status === 503) return { ok: false, dormant: true, status: 503, reason: DORMANT_REASON };
    if (status === 401 || status === 403) return { ok: false, unauthorized: true, status };
    return null;
  }

  async function listOrganizations() {
    let res;
    try {
      res = await fetchImpl(`${apiBase}/api/corporate-contacts/organizations`, { method: "GET", headers: headers() });
    } catch {
      return { ok: false, networkError: true, status: 0 }; // read-only → safe to retry
    }
    const early = classifyStatus(res.status);
    if (early) return early;
    let data = null;
    try { data = await res.json(); } catch { /* tolerate empty body */ }
    if (!res.ok) return { ok: false, status: res.status, error: (data && (data.error || data.reason)) || `HTTP ${res.status}` };
    if (!isRecognizedOrganizationsBody(data)) return { ok: false, status: res.status, malformed: true };
    return { ok: true, status: res.status, organizations: sanitizeOrganizations(data) };
  }

  // orgId MUST come from listOrganizations(); it is the authorized partition selector, never authority.
  async function importContacts(orgId, envelope, { signal } = {}) {
    if (!orgId || typeof orgId !== "string") return { ok: false, status: 400, error: "missing_org" };
    let res;
    try {
      res = await fetchImpl(
        `${apiBase}/api/corporate-contacts/organizations/${encodeURIComponent(orgId)}/contacts/import`,
        { method: "POST", headers: headers(), body: JSON.stringify(envelope || {}), signal },
      );
    } catch (err) {
      // A mutation POST that never returned MAY have committed → indeterminate, never a safe resubmit.
      if (err && (err.name === "AbortError" || err.code === 20)) return { ok: false, aborted: true, status: 0 };
      return { ok: false, indeterminate: true, status: 0 };
    }
    const early = classifyStatus(res.status);
    if (early) return early;
    let data = null;
    try { data = await res.json(); } catch { /* tolerate empty body */ }
    if (!res.ok) return { ok: false, status: res.status, error: (data && (data.error || data.reason)) || `HTTP ${res.status}`, code: data && (data.error || data.reason) };
    return { ok: true, status: res.status, data: (data && data.data) || data };
  }

  return { listOrganizations, importContacts };
}
