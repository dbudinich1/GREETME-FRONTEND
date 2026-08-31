// src/pages/fundraiser/FounderFundraisingDashboard.jsx
//
// TEAM B — Founder/Admin fundraising dashboard (ONE of exactly two authenticated dashboards).
// Every panel's data is fetched from the backend, which enforces founder_admin server-side. No
// client role grants access. Truthful loading/empty/error/dormant/forbidden states. Payouts +
// economics activation are HELD. Not activated while the gate is false.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { fundraiserApi, stateFor } from "../../api/fundraiserApi.js";
import { isFundraiserUiEnabled } from "../../config/fundraiserGate.js";
import { pageWrap, box, h, btn, btnGhost, Stat, StateView, Empty, HeldBadge } from "./FundraiserUI.jsx";
// P2 — pure state model for the partner-administrator panel (no React/DOM/fetch inside).
import { STATES, resolveOutcome, assignOutcome, messageFor, canAssign, isAssigned } from "./partnerAdminAssign.js";

// NOTE: everything here is module-LOCAL. Exporting helpers from a component file trips
// react-refresh/only-export-components, and a separate module would fall outside this slice's
// authorized paths. The behaviour is proven through the rendered form instead, which is the
// stronger test anyway.
// ── F1 · DRAFT ECONOMICS ──────────────────────────────────────────────────────────────────────
//
// Every enum below is copied from the BACKEND validator (services/fundraiser/economics/
// economicsState.js) so the form can never offer a value the server would reject. Nothing is
// preselected: this module contains no default percentage, basis, share type or treatment,
// because a default here becomes a commercial term nobody chose.
//
// PERCENT UNIT: percentage points. 10 means 10%. The service renders `${percent}% of ${basis}`,
// so a decimal fraction would display as 0.1%. Founder-decided client range is 0-100 inclusive;
// the value is never silently clamped or transformed - it is refused with a visible reason.
const F1_SHARE_TYPES = ["none", "percent_of_base", "custom"];
const F1_BASES = ["ENSR", "ENGP", "gross", "custom"];
const F1_TREATMENTS = Object.freeze({
  onboardingFeeTreatment: ["excluded_retained", "excluded_waived"],
  veteransContributionTreatment: ["excluded", "contribute_from_platform_share_only"],
  discountTreatment: ["ineligible", "eligible_on_net", "eligible_on_gross"],
  taxTreatment: ["excluded_from_base"],
  processorFeeTreatment: ["net_of_processor", "gross_absorbed_by_platform"],
});

/** Percent text -> { ok, value } | { ok:false, error }. Never clamps; never coerces silently. */
function f1ParsePercent(raw) {
  const text = String(raw ?? "").trim();
  if (text === "") return { ok: false, error: "Enter a percentage." };
  const n = Number(text);
  if (!Number.isFinite(n)) return { ok: false, error: "Enter a number between 0 and 100." };
  if (n < 0) return { ok: false, error: "A share cannot be negative." };
  if (n > 100) return { ok: false, error: "A share cannot exceed 100." };
  return { ok: true, value: n };
}

/** Build one share rule from form state, or report why it is not yet resolvable. */
function f1BuildShare(draft) {
  const type = draft.type;
  if (!F1_SHARE_TYPES.includes(type)) return { ok: false, error: "Choose a share type." };
  if (type === "none") return { ok: true, rule: { type: "none" } };
  if (type === "custom") {
    const notes = String(draft.notes ?? "").trim();
    if (notes === "") return { ok: false, error: "Custom terms need a note describing them." };
    return { ok: true, rule: { type: "custom", notes } };
  }
  if (!F1_BASES.includes(draft.basis)) return { ok: false, error: "Choose a basis." };
  const pct = f1ParsePercent(draft.percent);
  if (!pct.ok) return { ok: false, error: pct.error };
  return { ok: true, rule: { type: "percent_of_base", basis: draft.basis, percent: pct.value } };
}

/** The whole form, validated the way the server validates it. No inference anywhere. */
function f1BuildPayload({ organizationId, campaignId, initial, renewal, giftEnabled, gift, treatments }) {
  const errors = {};
  if (!organizationId || !campaignId) errors.selection = "Choose an organization and campaign.";

  const i = f1BuildShare(initial);
  if (!i.ok) errors.initial = i.error;
  const r = f1BuildShare(renewal);
  if (!r.ok) errors.renewal = r.error;

  let g = null;
  if (giftEnabled) {
    const built = f1BuildShare(gift);
    if (!built.ok) errors.gift = built.error; else g = built.rule;
  }

  for (const [key, allowed] of Object.entries(F1_TREATMENTS)) {
    if (!allowed.includes(treatments[key])) errors[key] = "Choose a treatment.";
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const rules = {
    initialSubscriptionShare: i.rule,
    renewalShare: r.rule,
    // Stated explicitly either way: the server reads `=== true`, and an absent flag would leave
    // the gift position unsaid rather than deliberately off.
    giftParticipationEnabled: giftEnabled === true,
  };
  if (giftEnabled) rules.giftShare = g;

  return { ok: true, payload: { organizationId, campaignId, rules, treatments: { ...treatments } } };
}

/** Read-only rendering of a stored share, including shapes F1 cannot create (e.g. tiered). */
function f1DescribeShare(rule) {
  if (!rule || typeof rule !== "object") return "\u2014";
  if (rule.type === "none") return "none";
  if (rule.type === "custom") return `custom \u2014 ${rule.notes || "(no note)"}`;
  if (rule.type === "percent_of_base") return `${rule.percent}% of ${rule.basis}`;
  if (rule.type === "tiered") {
    // F1 cannot CREATE a tiered share, but an existing one is valid and must read accurately
    // rather than as malformed.
    const tiers = Array.isArray(rule.tiers) ? rule.tiers : [];
    return `tiered (${tiers.length} tier${tiers.length === 1 ? "" : "s"}) of ${rule.basis}`;
  }
  return String(rule.type || "\u2014");
}

export default function FounderFundraisingDashboard() {
  const [state, setState] = useState("loading");
  const [overview, setOverview] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [selected, setSelected] = useState(null);

  // ── F1 draft-economics form state ──
  // Every field starts EMPTY. There is no preselected share type, basis, percentage or treatment,
  // because a prefilled commercial term is one nobody chose. Gift participation starts visibly off.
  const [ecoCampaignId, setEcoCampaignId] = useState("");
  // Guards against a slow economics read landing after the founder picked a different campaign.
  const ecoCampaignRef = useRef("");
  const [ecoInitial, setEcoInitial] = useState({ type: "", basis: "", percent: "", notes: "" });
  const [ecoRenewal, setEcoRenewal] = useState({ type: "", basis: "", percent: "", notes: "" });
  const [ecoGiftEnabled, setEcoGiftEnabled] = useState(false);
  const [ecoGift, setEcoGift] = useState({ type: "", basis: "", percent: "", notes: "" });
  const [ecoTreatments, setEcoTreatments] = useState({
    onboardingFeeTreatment: "", veteransContributionTreatment: "",
    discountTreatment: "", taxTreatment: "", processorFeeTreatment: "",
  });
  const [ecoErrors, setEcoErrors] = useState({});
  const [ecoBusy, setEcoBusy] = useState(false);
  const [ecoResult, setEcoResult] = useState(null);
  const [ecoMessage, setEcoMessage] = useState(null);

  async function submitDraftEconomics(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (ecoBusy) return;
    setEcoMessage(null); setEcoResult(null);
    const built = f1BuildPayload({
      organizationId: selected && selected.organizationId,
      // Forwarded exactly as the server gave it — never trimmed, rewritten or invented.
      campaignId: ecoCampaignId,
      initial: ecoInitial, renewal: ecoRenewal,
      giftEnabled: ecoGiftEnabled, gift: ecoGift,
      treatments: ecoTreatments,
    });
    if (!built.ok) { setEcoErrors(built.errors); return; }   // zero requests while incomplete
    setEcoErrors({});
    setEcoBusy(true);
    const res = await fundraiserApi.founder.draftEconomics(built.payload);
    setEcoBusy(false);
    if (!res || res.ok !== true) {
      // No optimistic success, and no internal code shown.
      const byStatus = {
        400: "Some terms were rejected. Check the values and try again.",
        401: "Your session has expired. Sign in again to continue.",
        403: "This action is limited to the founder account.",
        404: "That organization or campaign no longer exists.",
        409: "This changed while you were editing. Reload and try again.",
      };
      setEcoMessage(res && res.networkError
        ? "Couldn't reach the server. Check your connection and try again."
        : (byStatus[res && res.status] || "That didn't go through. Please try again."));
      return;
    }
    // State is adopted ONLY from the server's response.
    const v = res.data || {};
    setEcoResult({ versionId: v.versionId || v.id || null, status: v.status || null });
  }
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ legalName: "", orgType: "school" });
  // P2 — partner-administrator panel. `admin.state` is one of STATES; `admin.account` holds ONLY
  // the resolver's four approved fields. Nothing is cached or persisted; it resets per organization.
  const [adminEmail, setAdminEmail] = useState("");
  const [admin, setAdmin] = useState({ state: STATES.EMPTY, account: null, reason: null });

  const load = useCallback(async () => {
    // Gate OFF ⇒ do not issue any fundraiser API request; render the truthful dormant state.
    if (!isFundraiserUiEnabled()) { setState("dormant"); return; }
    setState("loading");
    const ov = await fundraiserApi.founder.overview();
    const s = stateFor(ov);
    if (s !== "ok") { setState(s); return; }
    if (!ov.data || !ov.data.organizations) { setState("error"); return; } // fail closed on malformed
    setState("ok");
    setOverview(ov.data);
    const list = await fundraiserApi.founder.organizations();
    setOrgs(stateFor(list) === "ok" ? list.data : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  // P2 — resolve an administrator by exact email. Founder-only server-side; this only renders the
  // answer. The founder-entered email is NOT masked; only approved resolver fields are displayed.
  const resolveAdmin = useCallback(async (e) => {
    e.preventDefault();
    setAdmin({ state: STATES.RESOLVING, account: null, reason: null });
    const r = await fundraiserApi.founder.resolveUserByEmail(adminEmail);
    const out = resolveOutcome(r);
    setAdmin({ ...out, reason: null });
  }, [adminEmail]);

  // P2 — assign the RESOLVED userId. The client never invents an id; it forwards only what the
  // server resolved. On success the organization is re-read so the panel reflects real state.
  const assignAdmin = useCallback(async () => {
    if (!selected || !canAssign(admin.state, admin.account)) return;
    const userId = admin.account.userId;
    setAdmin((a) => ({ ...a, state: STATES.ASSIGNING, reason: null }));
    const r = await fundraiserApi.founder.assignPartnerAdmin(selected.organizationId, userId);
    const out = assignOutcome(r);
    setAdmin((a) => ({ ...a, state: out.state, reason: out.reason }));
    if (out.state === STATES.ASSIGNED) {
      // Existing read-back behaviour: refresh the organization list so adminUserIds is truthful.
      const list = await fundraiserApi.founder.organizations();
      if (stateFor(list) === "ok" && Array.isArray(list.data)) {
        setOrgs(list.data);
        const fresh = list.data.find((o) => o.organizationId === selected.organizationId);
        if (fresh) setSelected(fresh);
      }
    }
  }, [selected, admin.state, admin.account]);

  const openOrg = useCallback(async (org) => {
    setSelected(org); setDetail({ loading: true });
    // Reset the panel whenever a different organization is opened — no state carries across orgs.
    setAdminEmail(""); setAdmin({ state: STATES.EMPTY, account: null, reason: null });
    // F1 — the draft form is emptied too, so no term or campaign choice leaks between organizations.
    ecoCampaignRef.current = "";
    setEcoCampaignId(""); setEcoErrors({}); setEcoResult(null); setEcoMessage(null);
    setEcoInitial({ type: "", basis: "", percent: "", notes: "" });
    setEcoRenewal({ type: "", basis: "", percent: "", notes: "" });
    setEcoGiftEnabled(false); setEcoGift({ type: "", basis: "", percent: "", notes: "" });
    setEcoTreatments({
      onboardingFeeTreatment: "", veteransContributionTreatment: "",
      discountTreatment: "", taxTreatment: "", processorFeeTreatment: "",
    });
    const [pt, lt, rec, pay, aud, cmp] = await Promise.all([
      fundraiserApi.founder.participantTotals(org.organizationId),
      fundraiserApi.founder.ledgerTotals(org.organizationId),
      fundraiserApi.founder.reconciliation(org.organizationId),
      fundraiserApi.founder.payoutStatus(org.organizationId),
      fundraiserApi.founder.audit(org.organizationId),
      // F1 — campaigns are READ, never invented. The draft form can only ever name a campaign the
      // server returned for this organization, so organizationId/campaignId always agree.
      fundraiserApi.founder.campaigns(org.organizationId),
    ]);
    setDetail({
      participants: pt.data, ledger: lt.data, reconciliation: rec.data,
      payout: pay.status === 503 ? { held: true, dormant: true } : pay.data,
      audit: stateFor(aud) === "ok" ? aud.data : [],
      campaigns: stateFor(cmp) === "ok" && Array.isArray(cmp.data) ? cmp.data : [],
      economics: null,
    });
  }, []);

  // F1 — when a campaign is chosen, read its economics history and surface the version that is
  // actually in force. Nothing here is editable: approved/active terms are immutable server-side,
  // and the only legitimate way to change them is a NEW draft version.
  const selectEcoCampaign = useCallback(async (campaignId) => {
    ecoCampaignRef.current = campaignId;
    setEcoCampaignId(campaignId);
    setEcoResult(null); setEcoMessage(null);
    setDetail((d) => (d ? { ...d, economics: null } : d));
    if (!campaignId) return;
    const hist = await fundraiserApi.founder.economicsHistory(campaignId);
    const versions = stateFor(hist) === "ok" && Array.isArray(hist.data) ? hist.data : [];
    // Prefer the version in force, then one merely approved, then the highest version number.
    const current =
      versions.find((v) => v && v.status === "active") ||
      versions.find((v) => v && v.status === "approved") ||
      versions.slice().sort((a, b) => (b.economicsVersion || 0) - (a.economicsVersion || 0))[0] ||
      null;
    // Ignore a late response for a campaign the founder has since moved away from.
    if (ecoCampaignRef.current !== campaignId) return;
    setDetail((d) => (d ? { ...d, economics: current } : d));
  }, []);

  async function createOrg(e) {
    e.preventDefault();
    if (!form.legalName.trim()) return;
    const r = await fundraiserApi.founder.createOrganization(form);
    if (r.ok) { setForm({ legalName: "", orgType: "school" }); load(); }
  }

  if (!isFundraiserUiEnabled()) return <StateView state="dormant" />;
  if (state !== "ok") return <div style={pageWrap}><h1 style={h}>Fundraising — Founder/Admin</h1><StateView state={state} onRetry={load} /></div>;

  return (
    <div style={pageWrap}>
      <h1 style={h}>Fundraising — Founder/Admin</h1>

      <div style={box}>
        <h2 style={h}>Platform overview</h2>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Stat label="Organizations" value={overview.organizations.total} />
          <Stat label="Campaigns" value={overview.campaigns.total} />
          <Stat label="Participants" value={overview.participants.total} />
          <Stat label="Active economics" value={overview.economics.activeVersions} />
        </div>
        <p style={{ marginTop: 12, color: "#8a7c6c" }}>Proceeds/payouts <HeldBadge /> — checkout binding and payouts are held.</p>
      </div>

      <div style={box}>
        <h2 style={h}>Organizations</h2>
        <form onSubmit={createOrg} style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input placeholder="Legal name" value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb", flex: 1, minWidth: 200 }} />
          <select value={form.orgType} onChange={(e) => setForm({ ...form, orgType: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb" }}>
            <option value="school">School</option><option value="athletic">Athletic</option><option value="youth">Youth</option><option value="community">Community</option><option value="nonprofit">Nonprofit</option><option value="other">Other</option>
          </select>
          <button style={btn} type="submit">Create organization</button>
        </form>
        {orgs.length === 0 ? <Empty>No organizations yet.</Empty> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ textAlign: "left", color: "#8a7c6c", fontSize: 13 }}><th>Name</th><th>Type</th><th>Status</th><th></th></tr></thead>
            <tbody>
              {orgs.map((o) => (
                <tr key={o.organizationId} style={{ borderTop: "1px solid #f0ebe3" }}>
                  <td style={{ padding: "8px 0" }}>{o.legalName}</td><td>{o.orgType}</td><td>{o.status}</td>
                  <td style={{ textAlign: "right" }}><button style={btnGhost} onClick={() => openOrg(o)}>Open</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && detail && !detail.loading ? (
        <section style={box} data-testid="f1-economics">
          <h2 style={h}>Draft economics</h2>

          {/* Existing sealed terms are shown READ-ONLY. An approved or active version is immutable
              server-side, so presenting it as an editable draft would be a lie the UI tells. A
              TIERED share is rendered accurately here even though F1 cannot create one. */}
          {detail.economics && detail.economics.rules ? (
            <div data-testid="f1-existing" style={{ fontSize: ".82rem", background: "#f6f6f6", borderRadius: 8, padding: ".55rem", margin: "0 0 .7rem" }}>
              <strong>Existing terms ({detail.economics.status || "unknown"}) — read-only</strong>
              <div>Initial: <span data-testid="f1-existing-initial">{f1DescribeShare(detail.economics.rules.initialSubscriptionShare)}</span></div>
              <div>Renewal: <span data-testid="f1-existing-renewal">{f1DescribeShare(detail.economics.rules.renewalShare)}</span></div>
              {detail.economics.rules.giftParticipationEnabled ? (
                <div>Gift: <span data-testid="f1-existing-gift">{f1DescribeShare(detail.economics.rules.giftShare)}</span></div>
              ) : null}
            </div>
          ) : null}
          <p style={{ fontSize: ".85rem", color: "#555", margin: "0 0 .75rem" }}>
            Creates a DRAFT only. It does not approve terms, activate economics, or change the
            campaign's status. Percentages are percentage points &mdash; 10 means 10%.
          </p>

          <form onSubmit={submitDraftEconomics} data-testid="f1-form">
            <label style={{ display: "block", marginBottom: ".5rem" }}>
              <span style={{ display: "block", fontSize: ".78rem", fontWeight: 700 }}>Campaign</span>
              {/* The id is never typed. Both ids in the payload come from records the server
                  returned: organizationId from the opened organization, campaignId from this list. */}
              <select data-testid="f1-campaign" value={ecoCampaignId}
                onChange={(ev) => selectEcoCampaign(ev.target.value)}>
                <option value="">Choose a campaign…</option>
                {(detail.campaigns || []).map((c) => (
                  <option key={c.campaignId} value={c.campaignId}>
                    {c.title || c.campaignId} ({c.status})
                  </option>
                ))}
              </select>
              {(detail.campaigns || []).length === 0 ? (
                <span data-testid="f1-no-campaigns" style={{ fontSize: ".8rem", color: "#555" }}>
                  {" "}This organization has no campaigns yet.
                </span>
              ) : null}
            </label>
            {ecoErrors.selection ? <p data-testid="f1-err-selection" style={{ color: "#b00", fontSize: ".8rem" }}>{ecoErrors.selection}</p> : null}

            {[["initial", "Initial subscription share", ecoInitial, setEcoInitial],
              ["renewal", "Renewal share", ecoRenewal, setEcoRenewal]].map(([key, title, val, set]) => (
              <fieldset key={key} style={{ border: "1px solid #ddd", borderRadius: 8, padding: ".6rem", margin: ".6rem 0" }}>
                <legend style={{ fontSize: ".8rem", fontWeight: 700 }}>{title}</legend>
                <select data-testid={`f1-${key}-type`} value={val.type}
                  onChange={(ev) => set({ ...val, type: ev.target.value })}>
                  <option value="">Choose a share type…</option>
                  {F1_SHARE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                {val.type === "percent_of_base" ? (
                  <>
                    <select data-testid={`f1-${key}-basis`} value={val.basis}
                      onChange={(ev) => set({ ...val, basis: ev.target.value })}>
                      <option value="">Choose a basis…</option>
                      {F1_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
                    </select>
                    <label style={{ marginLeft: ".4rem" }}>
                      <input data-testid={`f1-${key}-percent`} value={val.percent} inputMode="decimal"
                        onChange={(ev) => set({ ...val, percent: ev.target.value })} style={{ width: 90 }} />
                      <span style={{ fontSize: ".8rem" }}> % (percentage points, 0–100)</span>
                    </label>
                  </>
                ) : null}
                {val.type === "custom" ? (
                  <input data-testid={`f1-${key}-notes`} value={val.notes} placeholder="Describe the custom terms"
                    onChange={(ev) => set({ ...val, notes: ev.target.value })} />
                ) : null}
                {ecoErrors[key] ? <p data-testid={`f1-err-${key}`} style={{ color: "#b00", fontSize: ".8rem", margin: ".3rem 0 0" }}>{ecoErrors[key]}</p> : null}
              </fieldset>
            ))}

            <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: ".6rem", margin: ".6rem 0" }}>
              <legend style={{ fontSize: ".8rem", fontWeight: 700 }}>Gift participation</legend>
              <label>
                <input type="checkbox" data-testid="f1-gift-toggle" checked={ecoGiftEnabled}
                  onChange={(ev) => setEcoGiftEnabled(ev.target.checked)} />
                <span style={{ fontSize: ".84rem" }}> Include gifts in this campaign’s economics</span>
              </label>
              {ecoGiftEnabled ? (
                <div style={{ marginTop: ".4rem" }}>
                  <select data-testid="f1-gift-type" value={ecoGift.type}
                    onChange={(ev) => setEcoGift({ ...ecoGift, type: ev.target.value })}>
                    <option value="">Choose a share type…</option>
                    {F1_SHARE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {ecoGift.type === "percent_of_base" ? (
                    <>
                      <select data-testid="f1-gift-basis" value={ecoGift.basis}
                        onChange={(ev) => setEcoGift({ ...ecoGift, basis: ev.target.value })}>
                        <option value="">Choose a basis…</option>
                        {F1_BASES.map((b) => <option key={b} value={b}>{b}</option>)}
                      </select>
                      <input data-testid="f1-gift-percent" value={ecoGift.percent} inputMode="decimal"
                        onChange={(ev) => setEcoGift({ ...ecoGift, percent: ev.target.value })} style={{ width: 90 }} />
                    </>
                  ) : null}
                  {ecoGift.type === "custom" ? (
                    <input data-testid="f1-gift-notes" value={ecoGift.notes}
                      onChange={(ev) => setEcoGift({ ...ecoGift, notes: ev.target.value })} />
                  ) : null}
                </div>
              ) : null}
              {ecoErrors.gift ? <p data-testid="f1-err-gift" style={{ color: "#b00", fontSize: ".8rem" }}>{ecoErrors.gift}</p> : null}
            </fieldset>

            <fieldset style={{ border: "1px solid #ddd", borderRadius: 8, padding: ".6rem", margin: ".6rem 0" }}>
              <legend style={{ fontSize: ".8rem", fontWeight: 700 }}>Treatments</legend>
              {Object.entries(F1_TREATMENTS).map(([key, allowed]) => (
                <label key={key} style={{ display: "block", margin: ".3rem 0", fontSize: ".82rem" }}>
                  {key}
                  {" "}
                  <select data-testid={`f1-${key}`} value={ecoTreatments[key]}
                    onChange={(ev) => setEcoTreatments({ ...ecoTreatments, [key]: ev.target.value })}>
                    {/* Even a single-valued treatment must be chosen, never inserted silently. */}
                    <option value="">Choose…</option>
                    {allowed.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                  {ecoErrors[key] ? <span data-testid={`f1-err-${key}`} style={{ color: "#b00" }}> {ecoErrors[key]}</span> : null}
                </label>
              ))}
            </fieldset>

            <button type="submit" data-testid="f1-submit" disabled={ecoBusy}>
              {ecoBusy ? "Creating draft\u2026" : "Create draft economics"}
            </button>
          </form>

          {ecoMessage ? <p data-testid="f1-message" role="status" style={{ color: "#b00", fontSize: ".85rem" }}>{ecoMessage}</p> : null}
          {ecoResult ? (
            <p data-testid="f1-result" style={{ fontSize: ".85rem" }}>
              Draft created. Version <strong data-testid="f1-version">{ecoResult.versionId || "\u2014"}</strong>
              {ecoResult.status ? <> · status <strong data-testid="f1-status">{ecoResult.status}</strong></> : null}
              {" "}— not approved and not active.
            </p>
          ) : null}
        </section>
      ) : null}

      {selected && detail && !detail.loading && (
        <div style={box}>
          <h2 style={h}>{selected.legalName} — detail</h2>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
            <Stat label="Participants" value={detail.participants?.participants ?? 0} />
            <Stat label="Attribution records" value={detail.participants?.attributionRecords ?? 0} />
            <Stat label="Conversions" value={detail.ledger?.conversions ?? 0} />
            <Stat label="Renewals" value={detail.ledger?.renewals ?? 0} />
            <Stat label="Refunds" value={detail.ledger?.refunds ?? 0} />
          </div>
          <p>Reconciliation: {detail.reconciliation?.reconciled ? "✓ reconciled" : `drift ${detail.reconciliation?.driftCount ?? 0}`}</p>
          <p>Payout review: <strong>{detail.payout?.posture || "manual_review_only"}</strong> <HeldBadge /></p>
          {/* P2 — PARTNER ADMINISTRATOR. Resolve an exact email to an account, review it, assign.
              Authorization is entirely server-side (founder-only for both calls); this panel only
              displays the server's answers and never fabricates or caches an identity. */}
          <h3 style={{ ...h, fontSize: 16 }}>Partner administrator</h3>
          <p style={{ margin: "0 0 8px", color: "#5b4f42", fontSize: ".9rem" }}>
            Current: {Array.isArray(selected.adminUserIds) && selected.adminUserIds.length > 0
              ? `${selected.adminUserIds.length} assigned`
              : "none assigned"}
          </p>
          <form onSubmit={resolveAdmin} style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 8 }} data-testid="admin-resolve-form">
            <input
              type="email"
              placeholder="Administrator email"
              value={adminEmail}
              onChange={(e) => { setAdminEmail(e.target.value); setAdmin({ state: STATES.EMPTY, account: null, reason: null }); }}
              style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb", flex: 1, minWidth: 220 }}
              data-testid="admin-email"
            />
            <button style={btn} type="submit" disabled={admin.state === STATES.RESOLVING || admin.state === STATES.ASSIGNING} data-testid="admin-resolve">
              {admin.state === STATES.RESOLVING ? "Resolving…" : "Resolve"}
            </button>
          </form>

          {admin.state === STATES.RESOLVED && admin.account && (
            <div style={{ border: "1px solid #d8cdbb", borderRadius: 6, padding: 10, marginBottom: 8 }} data-testid="admin-resolved">
              {/* Only the resolver's four approved fields are shown. */}
              <div><strong>{admin.account.email}</strong></div>
              <div style={{ color: "#5b4f42", fontSize: ".9rem" }}>
                Email verified: <strong data-testid="admin-verified">{admin.account.emailVerified ? "yes" : "no"}</strong>
                {" · "}Founder account: <strong data-testid="admin-isfounder">{admin.account.isFounder ? "yes" : "no"}</strong>
              </div>
              {admin.account.isFounder ? (
                <p style={{ margin: "8px 0 0", color: "#8a3b2a" }} data-testid="admin-founder-block">
                  A platform founder cannot be a partner administrator.
                </p>
              ) : (
                <button
                  style={{ ...btn, marginTop: 8 }}
                  onClick={assignAdmin}
                  disabled={!canAssign(admin.state, admin.account)}
                  data-testid="admin-assign"
                >Assign as partner administrator</button>
              )}
            </div>
          )}

          {admin.state === STATES.ASSIGNING && <p style={{ color: "#5b4f42" }} data-testid="admin-assigning">Assigning…</p>}

          {[STATES.INVALID_EMAIL, STATES.NOT_FOUND, STATES.AMBIGUOUS, STATES.SERVICE_FAILURE, STATES.ASSIGNED, STATES.ASSIGN_FAILED].includes(admin.state) && (
            <p
              style={{ color: admin.state === STATES.ASSIGNED ? "#2f6f4f" : "#8a3b2a", marginTop: 0 }}
              data-testid={admin.state === STATES.ASSIGNED ? "admin-success" : "admin-error"}
            >{messageFor(admin.state, admin.reason)}</p>
          )}

          {admin.state === STATES.ASSIGNED && admin.account && (
            <p style={{ color: "#5b4f42", fontSize: ".9rem", marginTop: 0 }} data-testid="admin-readback">
              Read-back: {isAssigned(selected, admin.account.userId) ? "present in adminUserIds ✓" : "not yet reflected"}
            </p>
          )}

          <h3 style={{ ...h, fontSize: 16 }}>Audit history</h3>
          {(!detail.audit || detail.audit.length === 0) ? <Empty>No audit events yet.</Empty> : (
            <ul style={{ margin: 0, paddingLeft: 18, color: "#5b4f42" }}>
              {detail.audit.slice(0, 8).map((a) => <li key={a.id}>{a.at} — {a.action} ({a.subjectType})</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
