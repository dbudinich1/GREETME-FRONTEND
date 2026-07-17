// src/api/fundraiserApi.js
//
// TEAM B — thin fundraiser API client. Reuses the SAME server-verified auth as the rest of the
// app (Bearer token from localStorage); it never sends a role/organization/authority claim — the
// backend derives authority server-side. Returns { ok, status, data } so the UI can render
// truthful states for 401 (sign in), 403 (no access), 503 (dormant), and empty data.

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || "";

function authHeaders(extra = {}) {
  let token = null;
  try { token = localStorage.getItem("token"); } catch { /* no-op */ }
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function req(method, endpoint, body) {
  let res, data = null;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: body ? authHeaders({ "Content-Type": "application/json" }) : authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: null, networkError: true };
  }
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

const get = (e) => req("GET", e);
const post = (e, b) => req("POST", e, b);
const del = (e) => req("DELETE", e);

export const fundraiserApi = {
  founder: {
    overview: () => get("/api/fundraiser/admin/overview"),
    organizations: () => get("/api/fundraiser/admin/organizations"),
    createOrganization: (b) => post("/api/fundraiser/admin/organizations", b),
    suspendOrganization: (id, reason) => post(`/api/fundraiser/admin/organizations/${id}/suspend`, { reason }),
    closeOrganization: (id, reason) => post(`/api/fundraiser/admin/organizations/${id}/close`, { reason }),
    assignPartnerAdmin: (id, userId) => post(`/api/fundraiser/admin/organizations/${id}/partner-admins`, { userId }),
    campaigns: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/campaigns`),
    createCampaign: (b) => post("/api/fundraiser/admin/campaigns", b),
    economicsHistory: (campaignId) => get(`/api/fundraiser/admin/campaigns/${campaignId}/economics/history`),
    participantTotals: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/totals/participants`),
    ledgerTotals: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/totals/ledger`),
    reconciliation: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/reconciliation`),
    audit: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/audit`),
    payoutStatus: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/payouts/status`),
  },
  partner: {
    overview: (orgId) => get(`/api/fundraiser/partner/orgs/${orgId}/overview`),
    campaigns: (orgId) => get(`/api/fundraiser/partner/orgs/${orgId}/campaigns`),
    roster: (orgId, campaignId) => get(`/api/fundraiser/partner/orgs/${orgId}/participants${campaignId ? `?campaignId=${campaignId}` : ""}`),
    createParticipant: (orgId, b) => post(`/api/fundraiser/partner/orgs/${orgId}/participants`, b),
    importRoster: (orgId, b) => post(`/api/fundraiser/partner/orgs/${orgId}/participants/import`, b),
    participantLinks: (orgId, pid) => get(`/api/fundraiser/partner/orgs/${orgId}/participants/${pid}/links`),
    deactivateParticipant: (orgId, pid) => del(`/api/fundraiser/partner/orgs/${orgId}/participants/${pid}`),
    totals: (orgId) => get(`/api/fundraiser/partner/orgs/${orgId}/totals`),
    earnings: (orgId) => get(`/api/fundraiser/partner/orgs/${orgId}/earnings`),
    payoutStatus: (orgId) => get(`/api/fundraiser/partner/orgs/${orgId}/payouts/status`),
    exportContract: (orgId) => get(`/api/fundraiser/partner/orgs/${orgId}/export`),
  },
};

// Map a { status } into a truthful UI state key.
export function stateFor(res) {
  if (res.networkError || res.status === 0) return "error";
  if (res.status === 401) return "signin";
  if (res.status === 403) return "forbidden";
  if (res.status === 503) return "dormant";
  if (!res.ok) return "error";
  return "ok";
}
