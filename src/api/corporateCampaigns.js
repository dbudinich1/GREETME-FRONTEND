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
// The one spelling of "Team A has not shipped the ordering contract yet", so the dashboard, the
// tests and the test drive all key on the same string.
export const REORDER_CONTRACT_UNBOUND = "reorder_contract_not_bound";

export const EXECUTION_DORMANT_REASON = "corporate_campaign_execution_disabled";

// ── TEAM C — conflict-body validators ────────────────────────────────────────────────────────
// Small, total, and deliberately unforgiving. Anything that is not exactly the documented shape is
// dropped, because a half-trusted field is worse than an absent one.

/** A machine code such as "campaign_resume_incomplete": short, lower snake case, nothing exotic. */
const isSafeCode = (v) => typeof v === "string" && v.length > 0 && v.length <= 64 && /^[a-z0-9_]+$/.test(v);

/** A short human sentence. Length-capped so a stack trace or a dumped document can never qualify. */
const isSafeText = (v) => typeof v === "string" && v.length > 0 && v.length <= 300 && !/[<>{}]/.test(v);

/** Finite, non-negative, integral. Rejects NaN, Infinity, floats, negatives, numeric strings. */
const isCount = (v) => typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 0;

/**
 * The four documented counts, all required together. A partial or malformed set is dropped
 * entirely rather than reported half-true, and unknown keys are ignored rather than forwarded.
 */
function safeCounts(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const keys = ["examined", "resumed", "ineligible", "conflicts"];
  const out = {};
  for (const k of keys) {
    if (!isCount(raw[k])) return null;
    out[k] = raw[k];
  }
  return out;
}

/** Persistent ordering exists in the UI but not on this server yet. */
export const ORDERING_UNAVAILABLE = "campaign_ordering_unavailable";

/**
 * An opaque server token: `cord_` + exactly 32 LOWERCASE hex characters, per Team A b1c75ab.
 *
 * My first version accepted `cord_[A-Za-z0-9_-]{1,128}`, which would have admitted `cord_v1`,
 * uppercase, and tokens of any length - a validator loose enough to pass values the backend would
 * never mint, and therefore no validator at all. Shape is CHECKED here and nothing more: the token
 * is never parsed, derived from, incremented, or synthesised.
 */
export const isOrderVersion = (v) => typeof v === "string" && /^cord_[a-f0-9]{32}$/.test(v);

/**
 * The shared shape of both the ordering success body and its 409 body: a usable campaign set plus
 * an opaque version. Returns null - meaning "ambiguous" - unless everything validates.
 */
function readOrderPayload(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return null;
  if (!Array.isArray(body.campaigns) || body.campaigns.length === 0) return null;
  if (!isOrderVersion(body.orderVersion)) return null;
  const ids = [];
  for (const c of body.campaigns) {
    if (!c || typeof c !== "object") return null;
    const id = c.campaignId;
    if (typeof id !== "string" || id.length === 0 || ids.includes(id)) return null;  // unique, present
    ids.push(id);
  }
  return { campaigns: body.campaigns, orderVersion: body.orderVersion };
}

export function createCorporateCampaignsClient({
  fetchImpl = (typeof fetch !== "undefined" ? fetch : undefined),
  getToken = defaultGetToken,
  apiBase = viteApiBase(),
  // TEAM C — the ordering seam. Injected by the test drive and by tests; UNBOUND in production
  // until Team A ships the real organization-scoped ordering contract.
  reorderCampaigns: injectedReorder = null,
} = {}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("corporateCampaignsClient: fetchImpl is required");
  }

  // Identical header construction to call() - one auth story, not two.
  function orderHeaders() {
    const headers = { "Content-Type": "application/json" };
    const token = getToken && getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
    return headers;
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
    //
    // TEAM C — this branch used to discard the body entirely, which was fine while every 409 meant
    // "someone else wrote first" and there was nothing to say. Team A's F2 contract changed that:
    // a 409 can now carry `campaign_resume_incomplete` plus the authoritative campaign state, and
    // a caller that never reads the body cannot tell the reader WHY the campaign refused to switch
    // on. So the body is now parsed and its AUTHORITATIVE fields are passed through.
    //
    // Deliberately conservative: `conflict: true` and `status` are unchanged, so every existing
    // caller — fundraiser, checkout, the rest of the corporate surface — behaves exactly as before
    // and simply ignores the extra fields. Nothing is invented here: no counts are computed, no
    // labels are authored and no remediation is suggested. Only what the server actually sent is
    // forwarded, and a body that is absent or unreadable degrades to precisely the old shape.
    if (res.status === 409 || res.status === 412) {
      let body = null;
      try { body = await res.json(); } catch { body = null; }

      // STRICT ALLOWLIST, FIELD BY FIELD. The body is never spread: an arbitrary server object
      // reaching the client is how stack traces, document ids and internal flags leak into a UI.
      // Each field is named, type-checked, and OMITTED if it does not validate - a malformed field
      // is dropped rather than passed through or replaced with a guess.
      const out = { ok: false, conflict: true, status: res.status };
      if (body && typeof body === "object" && !Array.isArray(body)) {
        if (isSafeCode(body.error)) out.error = body.error;
        if (isSafeText(body.reason)) out.reason = body.reason;
        if (typeof body.enabled === "boolean") out.enabled = body.enabled;
        if (isSafeCode(body.reconciliation)) out.reconciliation = body.reconciliation;
        const counts = safeCounts(body.counts);
        if (counts) out.counts = counts;
      }
      return out;
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
    // SLICE E5 - the runtime switch. Deliberately NOT a variant of schedule/activate: those
    // authorize a run, this records whether the organization wants the campaign running at all.
    // The server keeps it outside the execution interlock for one reason - turning a campaign OFF
    // must never depend on the thing being switched off - so this stays callable while dormant.
    // SLICE F1 - the campaign title. Deliberately NARROW: it sends only `name`, and is not a
    // general campaign-patch method. A campaign's audience, gift, spread, schedule and lifecycle
    // each have their own endpoint with their own rules; one permissive patch would let the
    // dashboard bypass every one of them.
    renameCampaign: (orgId, campaignId, name) =>
      call("PATCH", `${one(orgId, campaignId)}/name`, { body: { name } }),
    setCampaignEnabled: (orgId, campaignId, enabled) =>
      call("PATCH", `${one(orgId, campaignId)}/enabled`, { body: { enabled: enabled === true } }),
    activate: (orgId, campaignId) => call("POST", `${one(orgId, campaignId)}/activate`, { body: {} }),
    // CORP-3 association bridge — read + select only (org-scoped corporate contacts).
    // ── TEAM C — CAMPAIGN ORDERING (contract NOT YET BOUND) ──────────────────────────────
    //
    // Team A owns the organization-scoped ordering contract: its path, its HTTP method and its
    // concurrency representation. NONE of them are known yet, so none of them is guessed here.
    // Inventing a plausible URL would create a second, competing contract the moment Team A
    // shipped a different one, and would silently 404 in production until someone noticed.
    //
    // So this is the SEAM, not the transport. It refuses, in the client's own established
    // failure shape, until a real adapter is injected. The dashboard treats that refusal exactly
    // as it treats any other refusal: the optimistic move rolls back and the reader is told.
    //
    // Binding later is a one-line change HERE and nowhere else.
    // ── TEAM C — CAMPAIGN ORDERING, BOUND to Team A b1c75ab ──────────────────────────────
    //
    //   PUT /organizations/:orgId/campaigns/order
    //   { orderedCampaignIds, expectedVersion }
    //
    // The ordering 409 is NOT the toggle 409. It carries the server's current canonical order and
    // version, so it is a usable answer rather than a bare conflict - and the closed toggle parser
    // is deliberately left untouched. This transport therefore handles its own response entirely.
    reorderCampaigns: injectedReorder || (async ({ orgId, orderedCampaignIds, expectedVersion } = {}) => {
      let res;
      try {
        res = await fetchImpl(`${apiBase}/api/corporate-campaigns${base(orgId)}/order`, {
          method: "PUT",
          headers: orderHeaders(),
          body: JSON.stringify({ orderedCampaignIds, expectedVersion }),
        });
      } catch { return { ok: false, networkError: true, status: 0 }; }

      // A missing route means the backend has not shipped yet. Fail closed, and say so in a way
      // the dashboard can act on without alarming anyone or retrying in a loop.
      if (res.status === 404) return { ok: false, status: 404, unavailable: true, error: ORDERING_UNAVAILABLE };
      if (res.status === 503) return { ok: false, dormant: true, status: 503, reason: DORMANT_REASON };
      if (res.status === 401 || res.status === 403) return { ok: false, unauthorized: true, status: res.status };

      let body = null;
      try { body = await res.json(); } catch { body = null; }

      if (res.status === 409) {
        const canonical = readOrderPayload(body);
        // Complete and valid: the conflict IS the answer, so no second GET is needed.
        if (canonical && body.error === "campaign_order_version_conflict") {
          return { ok: false, status: 409, versionConflict: true, error: body.error, data: canonical };
        }
        // Incomplete or malformed: ambiguous, and the dashboard reloads authoritatively.
        return { ok: false, status: 409, versionConflict: true, ambiguous: true, error: "campaign_order_version_conflict" };
      }

      if (!res.ok) return { ok: false, status: res.status, error: (body && body.error) || `HTTP ${res.status}` };

      const canonical = readOrderPayload(body);
      // A 200 we cannot read is ambiguous too - never a guess.
      if (!canonical) return { ok: false, status: res.status, ambiguous: true, error: "campaign_order_unreadable" };
      return { ok: true, status: res.status, data: canonical };
    }),

    listOrgContacts: (orgId) => call("GET", `/organizations/${encodeURIComponent(orgId)}/contacts`),
    readAudience: (orgId, campaignId) => call("GET", `${one(orgId, campaignId)}/audience`),
    setAudience: (orgId, campaignId, audienceRefs) => call("PUT", `${one(orgId, campaignId)}/audience`, { body: { audienceRefs: Array.isArray(audienceRefs) ? audienceRefs : [] } }),
  };
}
