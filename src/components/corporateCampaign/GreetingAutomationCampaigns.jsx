// src/components/corporateCampaign/GreetingAutomationCampaigns.jsx
//
// TEAM A — Greeting Automation Campaigns surface. The corporateOrganizationId is derived
// EXCLUSIVELY from the authenticated user's active corporate memberships
// (GET /api/corporate-campaigns/memberships) — NEVER from a user id, role, or list order.
// Capability is SERVER-derived: while the feature is dormant the endpoints return 503 and the
// entire surface stays hidden with zero campaign writes. No client self-enabling flag.

import { useCallback, useEffect, useMemo, useState } from "react";
import { createCorporateCampaignsClient } from "../../api/corporateCampaigns.js";
import {
  activeMemberships, resolveOrganizationContext, deriveCampaignSummary, TERMS,
} from "./campaignSurfaceModel.js";
import CampaignDetail from "./CampaignDetail.jsx";

const PURPLE = "linear-gradient(135deg, #6d74ee 0%, #764ba2 100%)";

function StatusPill({ label, kind }) {
  const c = kind === "ready"
    ? { fg: "#1f9d6b", bg: "rgba(31,157,107,.12)", bd: "rgba(31,157,107,.35)" }
    : kind === "processing"
    ? { fg: "#4a3fb0", bg: "rgba(109,92,240,.12)", bd: "rgba(109,92,240,.30)" }
    : { fg: "#bd7a10", bg: "rgba(214,145,16,.15)", bd: "rgba(214,145,16,.4)" };
  return <span style={{ fontSize: ".72rem", fontWeight: 700, color: c.fg, background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 999, padding: "3px 10px" }}>{label}</span>;
}

// Dormant / not-enrolled state. Truthful graceful degradation (D1): when the corporate feature is
// dormant or the account is not enrolled, render a stable, informative panel instead of a blank
// content area. It makes ZERO writes and ZERO new endpoint calls, and adds no button, form, link,
// enrollment flow, date promise, or access implication — it only tells the truth about the state.
function DormantNotice() {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }} data-testid="corporate-campaign-dormant">
      <div style={{ background: "#fffdf8", border: "1px solid #e7e0d4", borderRadius: 16, padding: "40px 32px", textAlign: "center" }}>
        <h1 style={{ margin: "0 0 12px", fontSize: "1.4rem", fontWeight: 700, color: "#332a52" }} data-testid="corporate-campaign-dormant-heading">
          Corporate Campaign Dashboard
        </h1>
        <p style={{ margin: 0, color: "#605c78", fontSize: ".98rem", lineHeight: 1.6, maxWidth: "52ch", marginLeft: "auto", marginRight: "auto" }} data-testid="corporate-campaign-dormant-body">
          Corporate campaign management is available to enrolled organizations. Your account isn’t currently enrolled.
        </p>
      </div>
    </div>
  );
}

function Shell({ children }) {
  return (
    <div style={{ maxWidth: 1080, margin: "0 auto" }}>
      <header style={{ background: PURPLE, color: "#fff", borderRadius: 20, padding: "28px 28px 30px", marginBottom: 24 }}>
        <div style={{ fontFamily: "monospace", fontSize: ".7rem", letterSpacing: ".14em", opacity: .85, textTransform: "uppercase" }}>Corporate</div>
        <h1 style={{ margin: "6px 0 6px", fontSize: "1.7rem", fontWeight: 700 }}>{TERMS.SURFACE}</h1>
        <p style={{ margin: 0, opacity: .92, fontSize: ".95rem", maxWidth: "48ch" }}>
          Set up organization-wide greetings once per campaign. {TERMS.YOU_DONT_NEED_EVERYTHING}
        </p>
      </header>
      {children}
    </div>
  );
}

export default function GreetingAutomationCampaigns() {
  const client = useMemo(() => createCorporateCampaignsClient(), []);
  const [membershipResult, setMembershipResult] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null); // explicit multi-org selection only
  const [rows, setRows] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignAuthError, setCampaignAuthError] = useState(false);
  const [campaignDormant, setCampaignDormant] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);

  // Organization context is derived purely from the membership response + any explicit
  // selection. Never guesses; clears a selection that is no longer active.
  const ctx = useMemo(() => resolveOrganizationContext(membershipResult, selectedOrgId), [membershipResult, selectedOrgId]);
  const effectiveOrgId = ctx.selectedOrgId;

  const loadMemberships = useCallback(async () => {
    const res = await client.listMemberships();
    setMembershipResult(res);
    const active = activeMemberships(res).map((m) => m.corporateOrganizationId);
    // Drop an explicit selection that vanished/became inactive (membership-change safety).
    setSelectedOrgId((prev) => (prev && active.includes(prev) ? prev : null));
  }, [client]);

  const loadCampaigns = useCallback(async (orgId) => {
    setCampaignAuthError(false); setCampaignDormant(false); setLoadingCampaigns(true);
    const listRes = await client.listCampaigns(orgId);
    if (listRes.dormant) { setCampaignDormant(true); setRows([]); setLoadingCampaigns(false); return; }
    if (listRes.unauthorized) { setCampaignAuthError(true); setRows([]); setLoadingCampaigns(false); return; } // 401/403 clears protected data
    if (!listRes.ok) { setRows([]); setLoadingCampaigns(false); return; }
    const list = (listRes.data && (listRes.data.campaigns || listRes.data.items || listRes.data)) || [];
    const arr = Array.isArray(list) ? list : [];
    const merged = await Promise.all(arr.map(async (campaign) => {
      const cid = campaign.campaignId || campaign.id;
      const rRes = await client.readReadiness(orgId, cid);
      const readiness = (rRes.ok && rRes.data) ? rRes.data : {};
      return { summary: deriveCampaignSummary(campaign, readiness) };
    }));
    setRows(merged); setLoadingCampaigns(false);
  }, [client]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadMemberships();
  }, [loadMemberships]);

  // Load campaigns ONLY once an organization is resolved (single auto or explicit multi).
  useEffect(() => {
    if (effectiveOrgId) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      loadCampaigns(effectiveOrgId);
    } else {
      setRows([]);
    }
  }, [effectiveOrgId, loadCampaigns]);

  async function handleCreate() {
    if (!effectiveOrgId || creating) return;
    setCreating(true);
    const res = await client.createCampaign(effectiveOrgId, {});
    setCreating(false);
    if (res.ok) await loadCampaigns(effectiveOrgId);
  }

  // Dormant (feature off) or not-enrolled → truthful stable state (D1), zero campaign writes,
  // zero new endpoint calls. Never a blank content area on the live launch surface.
  if (ctx.phase === "dormant" || campaignDormant) return <DormantNotice />;

  if (selectedCampaignId && effectiveOrgId) {
    return (
      <CampaignDetail
        orgId={effectiveOrgId}
        campaignId={selectedCampaignId}
        client={client}
        capability={{ available: true }}
        onBack={() => { setSelectedCampaignId(null); loadMemberships(); }}
      />
    );
  }

  if (membershipResult === null) return <Shell><p style={{ color: "#605c78" }}>Loading…</p></Shell>;

  if (ctx.phase === "unauthorized" || ctx.phase === "error" || campaignAuthError) {
    return <Shell><p style={{ color: "#605c78" }}>You don't have access to corporate campaigns right now.</p></Shell>;
  }

  if (ctx.phase === "no_org") {
    // Safe no-organization state — no org campaign request, no user id, no org creation.
    return (
      <Shell>
        <div style={{ textAlign: "center", padding: "44px 24px", border: "1px solid rgba(27,24,48,.1)", borderRadius: 18, background: "#faf9fd" }}>
          <div style={{ fontSize: "2rem" }}>🏢</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.2rem", margin: "10px 0 6px" }}>No corporate organization yet</h2>
          <p style={{ color: "#605c78", maxWidth: "46ch", margin: "0 auto" }}>
            Your account isn't an active member of a corporate organization. When you're added to one, your campaigns will appear here.
          </p>
        </div>
      </Shell>
    );
  }

  if (ctx.phase === "select_org") {
    // More than one active membership → explicit choice required; no campaigns load yet.
    return (
      <Shell>
        <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.05rem", margin: "0 0 6px" }}>Choose an organization</h2>
        <p style={{ color: "#605c78", fontSize: ".85rem", margin: "0 0 14px" }}>You're an active member of more than one organization. Select one to view its campaigns.</p>
        <div style={{ display: "grid", gap: 10 }}>
          {ctx.memberships.map((m) => (
            <button key={m.corporateOrganizationId} onClick={() => setSelectedOrgId(m.corporateOrganizationId)}
              style={{ textAlign: "left", cursor: "pointer", background: "#fff", border: "1px solid rgba(27,24,48,.12)", borderRadius: 12, padding: "14px 16px" }}>
              <div style={{ fontWeight: 700, fontFamily: "monospace", fontSize: ".85rem" }}>{m.corporateOrganizationId}</div>
              <div style={{ fontSize: ".78rem", color: "#605c78", marginTop: 3 }}>Role: {m.role}</div>
            </button>
          ))}
        </div>
      </Shell>
    );
  }

  // phase === "ready"
  return (
    <Shell>
      {loadingCampaigns ? (
        <p style={{ color: "#605c78" }}>Loading campaigns…</p>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", border: "1px solid rgba(27,24,48,.1)", borderRadius: 18, background: "#faf9fd" }}>
          <div style={{ fontSize: "2.2rem" }}>📣</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", margin: "10px 0 6px" }}>No campaigns yet</h2>
          {/* Zero-friction empty state — one clear action; no gifts, no media required now. */}
          <p style={{ color: "#605c78", maxWidth: "44ch", margin: "0 auto 18px" }}>
            Create your first campaign — the organization default is ready with no extra setup. {TERMS.YOU_DONT_NEED_EVERYTHING}
          </p>
          <button onClick={handleCreate} disabled={creating}
            style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 12, padding: "12px 22px", fontWeight: 700, fontSize: ".9rem", cursor: "pointer" }}>
            {creating ? "Creating…" : `+ ${TERMS.CREATE}`}
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.05rem", margin: 0 }}>Campaigns</h2>
            <button onClick={handleCreate} disabled={creating}
              style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 11, padding: "9px 16px", fontWeight: 700, fontSize: ".8rem", cursor: "pointer" }}>
              {creating ? "Creating…" : `+ ${TERMS.CREATE}`}
            </button>
          </div>
          <div style={{ display: "grid", gap: 12 }}>
            {rows.map(({ summary }) => (
              <button key={summary.campaignId} onClick={() => setSelectedCampaignId(summary.campaignId)}
                style={{ textAlign: "left", cursor: "pointer", background: "#fff", border: "1px solid rgba(27,24,48,.1)", borderRadius: 14, padding: "16px 18px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
                  <div style={{ fontWeight: 700, fontSize: "1rem" }}>{summary.name}</div>
                  <StatusPill label={summary.featuredSpreadStatus} kind={summary.featuredSpreadKind} />
                </div>
                <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 8, fontSize: ".82rem", color: "#605c78" }}>
                  <span>Audience: <b style={{ color: "#1b1830" }}>{summary.audience}</b></span>
                  <span>Type: <b style={{ color: "#1b1830" }}>{summary.occasionType}</b></span>
                  <span>Schedule: <b style={{ color: "#1b1830" }}>{summary.scheduleStatus}</b></span>
                  <span>Approval: <b style={{ color: "#1b1830" }}>{summary.approvalStatus}</b></span>
                  <span>Lock: <b style={{ color: "#1b1830" }}>{summary.lockStatus}</b></span>
                  <span>{summary.ready ? "✅ Ready" : "⏳ Not ready"}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </Shell>
  );
}
