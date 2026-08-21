// src/api/corporateContacts.js
//
// TEAM D — SLICE E7: single-record writes for an organization's contacts.
//
// A SEPARATE CLIENT, and deliberately so. The corporate surface is served by two routers mounted
// at two different bases:
//
//   /api/corporate-campaigns  → campaigns, and the READ of an org's contact list
//   /api/corporate-contacts   → the import, and these single-record writes
//
// They also sit behind DIFFERENT dormancy flags — campaignFeaturedSpreadEnabled and
// corporateImportEnabled — so one can be live while the other is not. Folding these calls into the
// campaigns client would have hidden both facts behind a shared base path that is only correct for
// half of them.

const DEFAULT_BASE = "";

function viteApiBase() {
  try {
    return (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || DEFAULT_BASE;
  } catch {
    return DEFAULT_BASE;
  }
}

function defaultGetToken() {
  try {
    return typeof localStorage !== "undefined" ? localStorage.getItem("token") : null;
  } catch {
    return null;
  }
}

// The dormancy reason this router returns while its own flag is false. Named so a caller can tell
// "the feature is not switched on" apart from "the request failed".
export const CONTACTS_DORMANT_REASON = "corporate_import_disabled";

export function createCorporateContactsClient({
  fetchImpl = (typeof fetch !== "undefined" ? fetch : undefined),
  getToken = defaultGetToken,
  apiBase = viteApiBase(),
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("corporateContactsClient: fetchImpl is required");
  }

  async function call(method, path, { body } = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken && getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetchImpl(`${apiBase}/api/corporate-contacts${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      });
    } catch {
      return { ok: false, networkError: true, status: 0 };
    }

    if (res.status === 503) {
      let reason = CONTACTS_DORMANT_REASON;
      try {
        const b = await res.json();
        if (b && typeof b.reason === "string" && b.reason) reason = b.reason;
      } catch { /* an empty or non-JSON body keeps the conservative default */ }
      return { ok: false, dormant: true, status: 503, reason };
    }
    if (res.status === 401 || res.status === 403) return { ok: false, unauthorized: true, status: res.status };
    // 404 is its own answer here: the record is not this organization's corporate contact. The
    // server returns it in place of 403 on purpose, so existence elsewhere cannot be probed.
    if (res.status === 404) return { ok: false, notFound: true, status: 404 };
    if (res.status === 409) return { ok: false, conflict: true, status: 409 };

    let data = null;
    try { data = await res.json(); } catch { /* tolerate an empty body */ }

    if (!res.ok) {
      return { ok: false, status: res.status, error: (data && (data.error || data.reason)) || `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, data };
  }

  const base = (orgId) => `/organizations/${encodeURIComponent(orgId)}/contacts`;

  return {
    createContact: (orgId, contact) => call("POST", base(orgId), { body: contact || {} }),
    updateContact: (orgId, contactId, patch) =>
      call("PATCH", `${base(orgId)}/${encodeURIComponent(contactId)}`, { body: patch || {} }),
    deleteContact: (orgId, contactId) =>
      call("DELETE", `${base(orgId)}/${encodeURIComponent(contactId)}`),
  };
}

/**
 * Which campaigns would still be addressed to this contact.
 *
 * Used to warn BEFORE a delete rather than to prevent one. Removing someone who is in a campaign is
 * a legitimate thing to want; being surprised by it afterwards is not. Switched-off campaigns are
 * excluded for the same reason they are excluded from the overlap warning — one that cannot send is
 * not a reason to hesitate.
 */
export function campaignsContainingContact(campaigns, contactId) {
  if (!contactId) return [];
  return (Array.isArray(campaigns) ? campaigns : [])
    .filter((c) => c && c.enabled !== false && Array.isArray(c.audienceRefs) && c.audienceRefs.includes(contactId))
    .map((c) => c.name || "Untitled campaign");
}

/** "Ada is in VIP and Birthdays." — the same list-joining the overlap warning uses. */
export function deleteWarningLine(contactName, campaignNames) {
  const names = Array.isArray(campaignNames) ? campaignNames : [];
  if (names.length === 0) return null;
  const joined = names.length === 1
    ? names[0]
    : names.length === 2
      ? `${names[0]} and ${names[1]}`
      : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${contactName || "This contact"} is in ${joined}.`;
}
