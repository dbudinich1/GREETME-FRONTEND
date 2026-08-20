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

// SLICE E3 — the OTHER dormancy. The management gate (DORMANT_REASON) hides the whole surface;
// this one means the surface is live but runs may not be authorized yet. They are different facts
// with different consequences, so they must stay distinguishable: this client previously stamped
// every 503 with DORMANT_REASON and threw the server's own answer away, which made an
// execution-gate refusal indistinguishable from the feature being switched off entirely.
export const EXECUTION_DORMANT_REASON = "corporate_campaign_execution_disabled";

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

    // Dormant gate. TWO different 503s reach here — the management flag gate (surface off, returned
    // before auth/reads) and the execution interlock on schedule/activate (surface on, runs not
    // authorized). Report the server's OWN reason so callers can tell them apart; only fall back to
    // the management default when the body is absent or unreadable, which is what an older server
    // that sends a bare 503 looks like.
    if (res.status === 503) {
      let reason = DORMANT_REASON;
      try {
        const body = await res.json();
        if (body && typeof body.reason === "string" && body.reason) reason = body.reason;
      } catch { /* empty or non-JSON body — keep the conservative default */ }
      return { ok: false, dormant: true, status: 503, reason };
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
    // SLICE D — the delivery contract + the two owner-only final actions. These map 1:1 onto the
    // shipped backend endpoints; the client adds no persistence, no defaults, and no local state.
    updateDeliveryConfig: (orgId, campaignId, body) => call("PATCH", `${one(orgId, campaignId)}/delivery-config`, { body: body || {} }),
    schedule: (orgId, campaignId) => call("POST", `${one(orgId, campaignId)}/schedule`, { body: {} }),
    activate: (orgId, campaignId) => call("POST", `${one(orgId, campaignId)}/activate`, { body: {} }),
    // CORP-3 association bridge — read + select only (org-scoped corporate contacts).
    listOrgContacts: (orgId) => call("GET", `/organizations/${encodeURIComponent(orgId)}/contacts`),
    readAudience: (orgId, campaignId) => call("GET", `${one(orgId, campaignId)}/audience`),
    setAudience: (orgId, campaignId, audienceRefs) => call("PUT", `${one(orgId, campaignId)}/audience`, { body: { audienceRefs: Array.isArray(audienceRefs) ? audienceRefs : [] } }),
  };
}
