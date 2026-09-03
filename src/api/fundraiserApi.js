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
    // The route that was missing: orgService.reinstateOrganization transitions the organization back
    // to `approved`. Same founder-only chain, same { reason } body and same required-reason rule as
    // its two siblings (orgService.transition rejects an empty reason with 400 for all three), so it
    // is expressed identically here rather than as a special case.
    reinstateOrganization: (id, reason) => post(`/api/fundraiser/admin/organizations/${id}/reinstate`, { reason }),
    closeOrganization: (id, reason) => post(`/api/fundraiser/admin/organizations/${id}/close`, { reason }),
    assignPartnerAdmin: (id, userId) => post(`/api/fundraiser/admin/organizations/${id}/partner-admins`, { userId }),
    // P1 — founder-only exact-email resolution. POST so the email is carried in the BODY, never in
    // the URL (no PII in logs, history, referrers, or monitoring). Returns exactly
    // { userId, email, emailVerified, isFounder }; 400 INVALID_EMAIL / 404 USER_NOT_FOUND /
    // 409 EMAIL_AMBIGUOUS are surfaced verbatim by the shared { ok, status, data } envelope.
    resolveUserByEmail: (email) => post("/api/fundraiser/admin/users/resolve", { email }),
    campaigns: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/campaigns`),
    createCampaign: (b) => post("/api/fundraiser/admin/campaigns", b),
    economicsHistory: (campaignId) => get(`/api/fundraiser/admin/campaigns/${campaignId}/economics/history`),

    /**
     * F1 — create a DRAFT economics version. Founder-gated server-side (founderApi `F(actor)`).
     *
     * Sends ONLY what the founder actually specified: organizationId, campaignId, rules and
     * treatments. The service signature also accepts mechanics / lifecycleRules / customTerms, but
     * padding the payload with explicit nulls would assert "no custom terms" on the founder's
     * behalf — a commercial statement nobody made. Omitted means unspecified; the service already
     * defaults them to null itself.
     *
     * Creating a draft NEVER approves, activates, or changes a campaign's status.
     */
    draftEconomics: ({ organizationId, campaignId, rules, treatments }) =>
      post("/api/fundraiser/admin/economics/draft", { organizationId, campaignId, rules, treatments }),

    /**
     * F2 — approve a DRAFT economics version. Founder-gated server-side.
     *
     * organizationId and versionId are PATH params and must come from a server record (the
     * economics history), never from anything the client assembled. The body carries exactly one
     * field: the founder's reason. No terms travel with an approval — the server approves what it
     * already holds, so the client cannot smuggle a different set of terms past the review.
     *
     * Approving SEALS the terms. It does not activate economics and does not touch the campaign.
     */
    approveEconomics: (organizationId, versionId, reason) =>
      post(`/api/fundraiser/admin/organizations/${organizationId}/economics/${versionId}/approve`, { reason }),

    /**
     * F3 — activate an APPROVED economics version from a given instant.
     *
     * Body carries EXACTLY the two fields the server reads (`activateEconomics`: `effectiveFrom`,
     * `activationReason`) and nothing else. As with approve, no terms travel: the server activates
     * the sealed version it already holds, so the client cannot substitute different economics
     * between review and activation.
     *
     * `effectiveFrom` must already be an ISO-8601 instant. This method performs NO date parsing or
     * timezone adjustment — the exact instant shown to the founder at confirmation is the exact
     * string sent.
     *
     * Activation may supersede the campaign's currently active version. It does NOT activate the
     * campaign and does not release payouts.
     */
    activateEconomics: (organizationId, versionId, { effectiveFrom, activationReason }) =>
      post(
        `/api/fundraiser/admin/organizations/${organizationId}/economics/${versionId}/activate`,
        { effectiveFrom, activationReason },
      ),

    /**
     * F4 -- move a campaign between lifecycle states. Founder-gated server-side.
     *
     * organizationId and campaignId are PATH params and must come from a server record (the
     * organization's campaign list), never from anything the client assembled. The body carries
     * exactly the two fields the server reads: the target status and the founder's reason.
     *
     * This changes the CAMPAIGN only. It does not activate economics, alter economics terms, or
     * release payouts -- those are separate, separately-gated actions.
     */
    setCampaignStatus: (organizationId, campaignId, status, reason) =>
      post(
        `/api/fundraiser/admin/organizations/${organizationId}/campaigns/${campaignId}/status`,
        { status, reason },
      ),
    participantTotals: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/totals/participants`),
    ledgerTotals: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/totals/ledger`),
    reconciliation: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/reconciliation`),
    audit: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/audit`),
    payoutStatus: (orgId) => get(`/api/fundraiser/admin/organizations/${orgId}/payouts/status`),
  },
  partner: {
    // B3B — the caller's own organization assignments (server-derived; no client identity in the
    // request). Returns { organizations: [{ organizationId, name, status }] }. Powers org discovery.
    myOrganizations: () => get("/api/fundraiser/partner/orgs"),
    overview: (orgId, campaignId) => get(`/api/fundraiser/partner/orgs/${orgId}/overview${campaignId ? `?campaignId=${campaignId}` : ""}`),
    campaigns: (orgId) => get(`/api/fundraiser/partner/orgs/${orgId}/campaigns`),
    roster: (orgId, campaignId) => get(`/api/fundraiser/partner/orgs/${orgId}/participants${campaignId ? `?campaignId=${campaignId}` : ""}`),
    createParticipant: (orgId, b) => post(`/api/fundraiser/partner/orgs/${orgId}/participants`, b),
    importRoster: (orgId, b) => post(`/api/fundraiser/partner/orgs/${orgId}/participants/import`, b),
    regenerate: (orgId, pid, reason) => post(`/api/fundraiser/partner/orgs/${orgId}/participants/${pid}/regenerate`, { reason }),
    participantLinks: (orgId, pid) => get(`/api/fundraiser/partner/orgs/${orgId}/participants/${pid}/links`),
    deactivateParticipant: (orgId, pid) => del(`/api/fundraiser/partner/orgs/${orgId}/participants/${pid}`),
    totals: (orgId) => get(`/api/fundraiser/partner/orgs/${orgId}/totals`),
    earnings: (orgId, campaignId) => get(`/api/fundraiser/partner/orgs/${orgId}/earnings${campaignId ? `?campaignId=${campaignId}` : ""}`),
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
