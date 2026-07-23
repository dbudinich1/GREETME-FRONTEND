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
  activeMemberships, resolveOrganizationContext, deriveCampaignSummary, interpretCapability, TERMS,
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

// Minimal create form — collects a required name and an optional free-text type. The backend
// accepts both (`name`, `campaignType`) as optional free strings; no new endpoint, no enum, no
// occasion/scheduling semantics implied. Inputs set explicit padding-free-safe styles inline.
function CreateCampaignForm({ name, type, onName, onType, onSubmit, onCancel, creating }) {
  const canCreate = name.trim().length > 0 && !creating;
  const input = { width: "100%", boxSizing: "border-box", padding: "10px 12px", borderRadius: 10, border: "1px solid rgba(27,24,48,.2)", fontSize: ".9rem" };
  return (
    <form data-testid="create-form" onSubmit={(e) => { e.preventDefault(); if (canCreate) onSubmit(); }}
      style={{ background: "#fff", border: "1px solid rgba(27,24,48,.12)", borderRadius: 16, padding: "20px 22px" }}>
      <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.15rem", margin: "0 0 4px" }}>{TERMS.CREATE}</h2>
      <p style={{ color: "#605c78", fontSize: ".82rem", margin: "0 0 16px" }}>Name your campaign and, optionally, add a type. {TERMS.YOU_DONT_NEED_EVERYTHING}</p>
      <label htmlFor="cc-name" style={{ display: "block", fontSize: ".78rem", fontWeight: 700, color: "#1b1830", marginBottom: 5 }}>Campaign name</label>
      <input id="cc-name" data-testid="create-name" value={name} onChange={(e) => onName(e.target.value)} autoFocus
        placeholder="e.g. Q4 Client Appreciation" style={{ ...input, marginBottom: 14 }} />
      <label htmlFor="cc-type" style={{ display: "block", fontSize: ".78rem", fontWeight: 700, color: "#1b1830", marginBottom: 5 }}>Type <span style={{ fontWeight: 400, color: "#928ea8" }}>(optional)</span></label>
      <input id="cc-type" data-testid="create-type" value={type} onChange={(e) => onType(e.target.value)}
        placeholder="e.g. Holiday, Milestone" style={{ ...input, marginBottom: 18 }} />
      <div style={{ display: "flex", gap: 10 }}>
        <button type="submit" data-testid="create-submit" disabled={!canCreate}
          style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 11, padding: "10px 18px", fontWeight: 700, fontSize: ".85rem", cursor: canCreate ? "pointer" : "not-allowed", opacity: canCreate ? 1 : .55 }}>
          {creating ? "Creating…" : TERMS.CREATE}
        </button>
        <button type="button" data-testid="create-cancel" onClick={onCancel}
          style={{ background: "transparent", color: "#1b1830", border: "1px solid rgba(27,24,48,.15)", borderRadius: 11, padding: "10px 18px", fontWeight: 700, fontSize: ".85rem", cursor: "pointer" }}>
          Cancel
        </button>
      </div>
    </form>
  );
}

// `client` is an optional injection seam used ONLY by tests (default = the real server-derived
// client). App usage renders <GreetingAutomationCampaigns /> with no props → identical behavior.
export default function GreetingAutomationCampaigns({ client: injectedClient } = {}) {
  const client = useMemo(() => injectedClient || createCorporateCampaignsClient(), [injectedClient]);
  const [membershipResult, setMembershipResult] = useState(null);
  const [selectedOrgId, setSelectedOrgId] = useState(null); // explicit multi-org selection only
  const [rows, setRows] = useState([]);
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [campaignAuthError, setCampaignAuthError] = useState(false);
  const [campaignDormant, setCampaignDormant] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState(null);
  const [capabilityResult, setCapabilityResult] = useState(null); // server-derived, from the campaign list load
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");

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
    setCapabilityResult(listRes); // server-derived capability (ok / dormant / unauthorized) — never fabricated
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
    const name = newName.trim();
    if (!name) return; // a campaign must be named (client-side only; backend still accepts null)
    const body = { name };
    const campaignType = newType.trim();
    if (campaignType) body.campaignType = campaignType;
    setCreating(true);
    const res = await client.createCampaign(effectiveOrgId, body);
    setCreating(false);
    if (res.ok) {
      setShowCreateForm(false); setNewName(""); setNewType("");
      await loadCampaigns(effectiveOrgId);
    }
  }

  function openCreate() { setNewName(""); setNewType(""); setShowCreateForm(true); }

  // Dormant (corporate capability off / caller not enrolled) → render the Founder-approved
  // read-only state (F3 Draft B) instead of a blank page. Truthful for personal users and
  // non-enrolled organizations. Zero writes, zero new requests, no access claim, no date promise,
  // no support/contact promise. Preserves the existing server-derived dormancy/authorization gate:
  // dormancy is still discovered only via the pre-existing membership probe (503 → dormant).
  if (ctx.phase === "dormant" || campaignDormant) {
    return (
      <div style={{ maxWidth: 1080, margin: "0 auto" }}>
        <div data-testid="corporate-dormant" style={{ textAlign: "center", padding: "48px 24px", border: "1px solid rgba(27,24,48,.1)", borderRadius: 18, background: "#faf9fd" }}>
          <h1 style={{ fontFamily: "Georgia, serif", fontSize: "1.4rem", margin: "0 0 10px", color: "#1b1830" }}>Greet-Me for Business</h1>
          <p style={{ color: "#605c78", maxWidth: "52ch", margin: "0 auto", lineHeight: 1.6 }}>
            Corporate campaign management is available to enrolled organizations. Your account isn’t currently enrolled.
          </p>
        </div>
      </div>
    );
  }

  if (selectedCampaignId && effectiveOrgId) {
    return (
      <CampaignDetail
        orgId={effectiveOrgId}
        campaignId={selectedCampaignId}
        client={client}
        capability={interpretCapability(capabilityResult)}
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
      {showCreateForm ? (
        <CreateCampaignForm
          name={newName}
          type={newType}
          onName={setNewName}
          onType={setNewType}
          onSubmit={handleCreate}
          onCancel={() => setShowCreateForm(false)}
          creating={creating}
        />
      ) : loadingCampaigns ? (
        <p style={{ color: "#605c78" }}>Loading campaigns…</p>
      ) : rows.length === 0 ? (
        <div style={{ textAlign: "center", padding: "48px 24px", border: "1px solid rgba(27,24,48,.1)", borderRadius: 18, background: "#faf9fd" }}>
          <div style={{ fontSize: "2.2rem" }}>📣</div>
          <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.25rem", margin: "10px 0 6px" }}>No campaigns yet</h2>
          {/* Zero-friction empty state — one clear action; no gifts, no media required now. */}
          <p style={{ color: "#605c78", maxWidth: "44ch", margin: "0 auto 18px" }}>
            Create your first campaign — just give it a name to get started. {TERMS.YOU_DONT_NEED_EVERYTHING}
          </p>
          <button data-testid="open-create" onClick={openCreate}
            style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 12, padding: "12px 22px", fontWeight: 700, fontSize: ".9rem", cursor: "pointer" }}>
            + {TERMS.CREATE}
          </button>
        </div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h2 style={{ fontFamily: "Georgia, serif", fontSize: "1.05rem", margin: 0 }}>Campaigns</h2>
            <button data-testid="open-create" onClick={openCreate}
              style={{ background: PURPLE, color: "#fff", border: "none", borderRadius: 11, padding: "9px 16px", fontWeight: 700, fontSize: ".8rem", cursor: "pointer" }}>
              + {TERMS.CREATE}
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
