// src/api/corporateCampaigns.js
//
// TEAM A — read-only client for the mounted, dormant-gated corporate campaign API
// (/api/corporate-campaigns, Team C). Consumes ONLY the pushed endpoints. Handles:
//   • dormant 503 { disabled:true, reason:"campaign_featured_spread_disabled" } — surface hidden
//   • 401/403 — never surfaces organization data
//   • write conflict (ETag optimistic concurrency is server-internal; a concurrent write
//     surfaces as 409/412) — turned into a refresh/retry result
// `fetchImpl` + `getToken` are injectable so behavior is unit-testable without a browser.
// Never calls gift/fundraising APIs; adds no competing routes; never fabricates readiness.

function viteApiBase() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) {
      return import.meta.env.VITE_API_BASE;
    }
  } catch { /* import.meta.env not present under node:test */ }
  return "";
}

function defaultGetToken() {
  try { return localStorage.getItem("token"); } catch { return null; }
}

export const DORMANT_REASON = "campaign_featured_spread_disabled";

export function createCorporateCampaignsClient({
  fetchImpl = (typeof fetch !== "undefined" ? fetch : undefined),
  getToken = defaultGetToken,
  apiBase = viteApiBase(),
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("corporateCampaignsClient: fetchImpl is required");
  }

  async function call(method, path, { body } = {}) {
    const headers = { "Content-Type": "application/json" };
    const token = getToken && getToken();
    if (token) headers.Authorization = `Bearer ${token}`;

    let res;
    try {
      res = await fetchImpl(`${apiBase}/api/corporate-campaigns${path}`, {
        method,
        headers,
        body: body != null ? JSON.stringify(body) : undefined,
      });
    } catch {
      return { ok: false, networkError: true, status: 0 };
    }

    // Dormant flag gate — returned BEFORE auth/reads while the feature is off.
    if (res.status === 503) {
      return { ok: false, dormant: true, status: 503, reason: DORMANT_REASON };
    }
    // Auth / membership — return no organization data whatsoever.
    if (res.status === 401 || res.status === 403) {
      return { ok: false, unauthorized: true, status: res.status };
    }
    // Optimistic-concurrency conflict — the client should refresh and retry.
    if (res.status === 409 || res.status === 412) {
      return { ok: false, conflict: true, status: res.status };
    }

    let data = null;
    try { data = await res.json(); } catch { /* tolerate empty body */ }

    if (!res.ok) {
      return { ok: false, status: res.status, error: (data && (data.error || data.reason)) || `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status, data };
  }

  const base = (orgId) => `/organizations/${encodeURIComponent(orgId)}/campaigns`;
  const one = (orgId, campaignId) => `${base(orgId)}/${encodeURIComponent(campaignId)}`;

  return {
    // Canonical organization-context source: the authenticated user's active memberships,
    // server-filtered + scoped. The ONLY way the surface learns a corporateOrganizationId.
    listMemberships: () => call("GET", "/memberships"),
    listCampaigns: (orgId) => call("GET", base(orgId)),
    createCampaign: (orgId, body) => call("POST", base(orgId), { body: body || {} }),
    readCampaign: (orgId, campaignId) => call("GET", one(orgId, campaignId)),
    updateFeaturedSpread: (orgId, campaignId, body) => call("PATCH", `${one(orgId, campaignId)}/featured-spread`, { body: body || {} }),
    readReadiness: (orgId, campaignId) => call("GET", `${one(orgId, campaignId)}/readiness`),
    approve: (orgId, campaignId) => call("POST", `${one(orgId, campaignId)}/approve`, { body: {} }),
    lock: (orgId, campaignId, body) => call("POST", `${one(orgId, campaignId)}/lock`, { body: body || {} }),
    unlock: (orgId, campaignId) => call("POST", `${one(orgId, campaignId)}/unlock`, { body: {} }),
  };
}
