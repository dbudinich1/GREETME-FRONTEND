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
// SLICE D — the consolidated premium surface.
import CampaignCard from "./CampaignCard.jsx";
import ContactTiles from "./ContactTiles.jsx";
import IndividualContactPicker from "./IndividualContactPicker.jsx";
import {
  readViewerOwnerCapability, readExecutionCapability, findAudienceOverlaps, overlapLine,
  GIFT_PAYMENT_DISCLOSURE,
} from "./corporateDashboardModel.js";

// How many overlapping contacts to name before the list becomes wallpaper. The rest are counted,
// never hidden - a warning that silently truncates reads as "these are all of them".
const OVERLAP_SHOWN = 6;
import "./premiumDashboard.css";

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
export default function GreetingAutomationCampaigns({ client: injectedClient, navigate: injectedNavigate } = {}) {
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
  // SLICE D — the organisation contact pool and the individual-selection surface.
  const [contacts, setContacts] = useState([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [pickerCampaign, setPickerCampaign] = useState(null);
  // SLICE F1 - which campaign is expanded, by CAMPAIGN ID and never by array position. The list
  // re-sorts and re-fetches; an index would silently expand a different campaign the moment one
  // was created or removed. Null means all four tiles are collapsed.
  const [expandedCampaignId, setExpandedCampaignId] = useState(null);
  // Fails closed: nobody is treated as the owner until the server says so on a successful list.
  const [isOwnerViewer, setIsOwnerViewer] = useState(false);
  // SLICE E3 — the backend's execution interlock, published on the campaign list. Fails closed for
  // exactly the same reason ownership does: until a successful response says otherwise, the two
  // owner-only actions must not look pressable. This is the SERVER's answer held verbatim — the
  // dashboard never infers it, never remembers it across organizations, and never invents it.
  const [canAuthorizeRun, setCanAuthorizeRun] = useState(false);
  // Navigation without a Router dependency. The app mounts a HashRouter, so a hash assignment IS
  // the route change; injecting it keeps this component mountable on its own, which useNavigate()
  // would prevent by throwing outside a <Router>.
  // Recomputed from the campaigns and contacts already loaded - no extra request, and it cannot
  // disagree with what the cards show because it reads the same data they do.
  const overlaps = useMemo(
    () => findAudienceOverlaps(rows.map((r) => r.campaign), contacts),
    [rows, contacts],
  );

  const goTo = injectedNavigate || ((path) => { try { window.location.hash = `#${path}`; } catch { /* non-browser host */ } });

  // Organization context is derived purely from the membership response + any explicit
  // selection. Never guesses; clears a selection that is no longer active.
  const ctx = useMemo(() => resolveOrganizationContext(membershipResult, selectedOrgId), [membershipResult, selectedOrgId]);
  const effectiveOrgId = ctx.selectedOrgId;

  // SLICE D — the organisation's contact pool. Categories come from the PERSISTED
  // corporateContactType the backend now returns; the frontend never infers or stores one.
  const loadContacts = useCallback(async (orgId) => {
    if (typeof client.listOrgContacts !== "function") { setContacts([]); return; }
    setLoadingContacts(true);
    try {
      const res = await client.listOrgContacts(orgId);
      setContacts(res && res.ok ? ((res.data && res.data.contacts) || []) : []);
    } catch {
      setContacts([]);           // a contact-load failure must never surface stale or partial data
    }
    setLoadingContacts(false);
  }, [client]);

  const loadMemberships = useCallback(async () => {
    const res = await client.listMemberships();
    setMembershipResult(res);
    const active = activeMemberships(res).map((m) => m.corporateOrganizationId);
    // Drop an explicit selection that vanished/became inactive (membership-change safety).
    setSelectedOrgId((prev) => (prev && active.includes(prev) ? prev : null));
  }, [client]);

  const loadCampaigns = useCallback(async (orgId) => {
    // STALE-AUTHORITY RESET, before the first awaited request.
    //
    // Ownership belongs to ONE organization. Switching organizations, or failing to load one, must
    // never leave the previous organization's `true` on screen — an owner-only control would stay
    // enabled for an organization the viewer may not own. Clearing FIRST means the window between
    // organizations is unauthorized rather than optimistically authorized, and every path below —
    // dormant, unauthorized, non-ok, or thrown — leaves it false unless a successful response says
    // otherwise.
    // The execution capability is organization-scoped in exactly the same way and is cleared on the
    // same line of defence: a stale `true` carried across a switch would re-enable Schedule for an
    // organization whose interlock has not been read yet.
    setIsOwnerViewer(false); setCanAuthorizeRun(false);
    setCampaignAuthError(false); setCampaignDormant(false); setLoadingCampaigns(true);
    try {
      const listRes = await client.listCampaigns(orgId);
      setCapabilityResult(listRes); // server-derived capability (ok / dormant / unauthorized) — never fabricated
      if (listRes.dormant) { setCampaignDormant(true); setRows([]); setLoadingCampaigns(false); return; }
      if (listRes.unauthorized) { setCampaignAuthError(true); setRows([]); setLoadingCampaigns(false); return; } // 401/403 clears protected data
      if (!listRes.ok) { setRows([]); setLoadingCampaigns(false); return; }
      // Only a SUCCESSFUL list can confer ownership, and only if it says so exactly.
      setIsOwnerViewer(readViewerOwnerCapability(listRes));
      setCanAuthorizeRun(readExecutionCapability(listRes));
      const list = (listRes.data && (listRes.data.campaigns || listRes.data.items || listRes.data)) || [];
      const arr = Array.isArray(list) ? list : [];
      const merged = await Promise.all(arr.map(async (campaign) => {
        const cid = campaign.campaignId || campaign.id;
        const rRes = await client.readReadiness(orgId, cid);
        const readiness = (rRes.ok && rRes.data) ? rRes.data : {};
        return { summary: deriveCampaignSummary(campaign, readiness), campaign: { ...campaign, campaignId: cid }, readiness };
      }));
      setRows(merged); setLoadingCampaigns(false);
    } catch {
      // A thrown load cannot retain ownership or execution capability either. Fail closed.
      setIsOwnerViewer(false); setCanAuthorizeRun(false);
      setRows([]); setLoadingCampaigns(false);
    }
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
      loadContacts(effectiveOrgId);
    } else {
      setRows([]);
      setContacts([]);
    }
  }, [effectiveOrgId, loadCampaigns, loadContacts]);

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

  // phase === "ready" — SLICE D consolidated surface: a wide campaigns viewport with its own
  // internal scroll, and the three contact tiles beneath it. Both stay on one desktop screen.
  // Ownership is the AUTHORITATIVE backend signal, not the caller's membership role. The two are
  // different facts: a member can hold an owner ROLE while the organisation names someone else as
  // its current owner, and only the latter may authorize a run.
  const isOwner = isOwnerViewer;
  return (
    <div className="gcd-root" data-testid="corporate-dashboard">
      <div className="gcd-underlay">
        <header className="gcd-hero">
          <div className="gcd-eyebrow">Corporate</div>
          <h1 className="gcd-title">{TERMS.SURFACE}</h1>
          <p className="gcd-sub">Set up organization-wide greetings once per campaign. {TERMS.YOU_DONT_NEED_EVERYTHING}</p>
        </header>

        {showCreateForm ? (
          <div className="gcd-panel" style={{ padding: 4 }}>
            <CreateCampaignForm
              name={newName} type={newType} onName={setNewName} onType={setNewType}
              onSubmit={handleCreate} onCancel={() => setShowCreateForm(false)} creating={creating}
            />
          </div>
        ) : null}

        {/* A — CAMPAIGNS: fixed-height internal scroll, sticky header + Add CTA. */}
        <section className="gcd-panel" data-testid="campaigns-panel" aria-labelledby="gcd-campaigns-head">
          <div className="gcd-panel-head">
            <div>
              <h2 className="gcd-panel-title" id="gcd-campaigns-head">Campaigns</h2>
              <p className="gcd-panel-note">Every campaign shows the same sections, whatever its state.</p>
            </div>
            <button type="button" className="gcd-btn gcd-btn--primary" data-testid="open-create" onClick={openCreate}>
              + {TERMS.CREATE}
            </button>
          </div>

          {/* SLICE E5 - OVERLAP WARNING. Names the people and the campaigns involved, then stops.
              It blocks nothing and disables nothing: someone may genuinely belong in two
              campaigns, and the organization knows whether that is intended far better than this
              surface does. A guardrail that refuses would be wrong more often than it was right. */}
          {overlaps.length > 0 ? (
            <div className="gcd-overlap" data-testid="overlap-warning" role="status">
              <p className="gcd-overlap-head">
                {overlaps.length === 1
                  ? "One contact is set to receive more than one campaign:"
                  : `${overlaps.length} contacts are set to receive more than one campaign:`}
              </p>
              <ul className="gcd-overlap-list">
                {overlaps.slice(0, OVERLAP_SHOWN).map((o) => (
                  <li key={o.contactId} data-testid={`overlap-${o.contactId}`}>{overlapLine(o)}</li>
                ))}
              </ul>
              {overlaps.length > OVERLAP_SHOWN ? (
                <p className="gcd-overlap-more" data-testid="overlap-more">
                  and {overlaps.length - OVERLAP_SHOWN} more
                </p>
              ) : null}
              <p className="gcd-overlap-note">
                That may be exactly what you want. Adjust an audience if it isn’t.
              </p>
            </div>
          ) : null}
          <div className="gcd-scroll" data-testid="campaign-viewport" tabIndex={0} role="region" aria-label="Campaigns list">
            {loadingCampaigns ? (
              <p className="gcd-empty">Loading campaigns…</p>
            ) : rows.length === 0 ? (
              <div className="gcd-empty" data-testid="campaigns-empty">
                <div style={{ fontSize: "2rem" }}>📣</div>
                <p style={{ margin: "8px 0 0" }}>No campaigns yet. Create your first — a name is enough to start.</p>
              </div>
            ) : (
              rows.map((r) => (
                <CampaignCard
                  key={r.campaign.campaignId}
                  campaign={r.campaign}
                  contacts={contacts}
                  orgId={effectiveOrgId}
                  client={client}
                  isOwner={isOwner}
                  canAuthorizeRun={canAuthorizeRun}
                  busy={loadingCampaigns}
                  /* DEFENCE IN DEPTH, not the primary source. The list above is authoritative; this
                     only catches the race where the interlock closes between a load and a click. */
                  onExecutionDormant={() => setCanAuthorizeRun(false)}
                  expanded={expandedCampaignId === r.campaign.campaignId}
                  onToggleExpanded={(cid) => setExpandedCampaignId((cur) => (cur === cid ? null : cid))}
                  onOpenIndividualPicker={(c) => setPickerCampaign(c)}
                  onAfterMutate={async () => { await loadCampaigns(effectiveOrgId); }}
                />
              ))
            )}
          </div>
        </section>

        {/* F1C ADDENDUM — the standing gift/payment note. Deliberately OUTSIDE the scroll
            viewport and outside every campaign card: one note for the surface, not one per tile.
            It is presentational only — a paragraph and a link. It performs no request, holds no
            state, and reads nothing about the account, so rendering it can never cause a payment
            call or make a reader wait. It is styled as a quiet aside, not an alert: no role
            "alert", no error tone, nothing to dismiss or agree to, and it never disables Save. */}
        <aside className="gcd-paynote" data-testid="gift-payment-note">
          <svg className="gcd-paynote-icon" viewBox="0 0 24 24" width="18" height="18"
            fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"
            strokeLinejoin="round" aria-hidden="true" focusable="false">
            <rect x="3" y="8" width="18" height="4" rx="1" />
            <path d="M12 8v13" />
            <path d="M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7" />
            <path d="M7.5 8a2.5 2.5 0 0 1 0-5A4.8 8 0 0 1 12 8a4.8 8 0 0 1 4.5-5 2.5 2.5 0 0 1 0 5" />
          </svg>
          <p className="gcd-paynote-text" data-testid="gift-payment-note-text">
            {GIFT_PAYMENT_DISCLOSURE.text}{" "}
            <a className="gcd-paynote-link" data-testid="gift-payment-note-link"
              href={GIFT_PAYMENT_DISCLOSURE.linkHref}>
              {GIFT_PAYMENT_DISCLOSURE.linkLabel}
            </a>
          </p>
        </aside>

        {/* B — CONTACT TILES: Employees / Clients / Vendors, always visible beneath the viewport.

            SLICE E5 - Manage is handled INSIDE the tile, which opens its own roster inline. It is
            deliberately NOT routed to /dashboard/contacts: that page reads the PERSONAL contact
            partition, while these contacts live under the organization with contactScope
            "corporate". Navigating there would show a different roster and let a reader believe it
            was this one. The dead `pickerCategory` state this used to set is gone - it was written
            and never read, so the button did nothing at all. */}
        <ContactTiles
          contacts={contacts}
          loading={loadingContacts}
          onAddCategory={(key) => {
            // The EXISTING import wizard route, with this category carried in the URL.
            goTo(`/dashboard/import-wizard?mode=corporate&category=${encodeURIComponent(key)}`);
          }}
          onImportCategory={(key) => {
            goTo(`/dashboard/import-wizard?mode=corporate&category=${encodeURIComponent(key)}`);
          }}
          onSelectIndividual={() => setPickerCampaign(rows.length ? rows[0].campaign : null)}
        />

        {pickerCampaign ? (
          <IndividualContactPicker
            contacts={contacts}
            orgId={effectiveOrgId}
            campaign={pickerCampaign}
            client={client}
            onClose={() => setPickerCampaign(null)}
            onSaved={async () => { setPickerCampaign(null); await loadCampaigns(effectiveOrgId); }}
          />
        ) : null}
      </div>
    </div>
  );
}
