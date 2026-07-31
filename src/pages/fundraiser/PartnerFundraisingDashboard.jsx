// src/pages/fundraiser/PartnerFundraisingDashboard.jsx
//
// TEAM B — Partner Administrator fundraising dashboard (the SECOND of exactly two authenticated
// dashboards). Scoped to :organizationId; the backend enforces requirePartnerAdminFor server-side
// (cross-org ⇒ 403). Participants are records/rows (no participant login). Estimated earnings +
// payouts are HELD. Truthful states throughout.
import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { fundraiserApi, stateFor } from "../../api/fundraiserApi.js";
import { isFundraiserUiEnabled } from "../../config/fundraiserGate.js";
import { pageWrap, box, h, btn, btnGhost, Stat, StateView, Empty, HeldBadge } from "./FundraiserUI.jsx";

export default function PartnerFundraisingDashboard() {
  const { organizationId } = useParams();
  const [state, setState] = useState("loading");
  const [ov, setOv] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [earnings, setEarnings] = useState(null);
  const [payout, setPayout] = useState(null);
  const [newP, setNewP] = useState({ campaignId: "", displayName: "" });
  // FE-SEG-1: display-scope selection only. "" ⇒ All campaigns (unfiltered, today's
  // behavior). Sent to the backend ONLY as the ?campaignId= query param; path
  // organizationId remains the sole authorization key. allCampaigns holds the full
  // list captured from the unfiltered overview so the selector never narrows itself.
  const [selectedCampaignId, setSelectedCampaignId] = useState("");
  const [allCampaigns, setAllCampaigns] = useState([]);

  const load = useCallback(async () => {
    if (!isFundraiserUiEnabled()) { setState("dormant"); return; } // gate OFF ⇒ no API request
    if (!organizationId) { setState("forbidden"); return; }
    setState("loading");
    const cid = selectedCampaignId || undefined; // omit the param entirely on "All"
    const o = await fundraiserApi.partner.overview(organizationId, cid);
    const s = stateFor(o);
    if (s !== "ok") { setState(s); return; }
    if (!o.data || !o.data.dashboard) { setState("error"); return; } // fail closed on malformed
    setState("ok");
    setOv(o.data);
    // Populate the selector from the UNFILTERED response only; a filtered overview
    // narrows campaigns[] to the selected campaign and would erase the other options.
    if (!cid) setAllCampaigns(o.data.campaigns || []);
    const [c, e, p] = await Promise.all([
      fundraiserApi.partner.campaigns(organizationId),
      fundraiserApi.partner.earnings(organizationId, cid),
      fundraiserApi.partner.payoutStatus(organizationId),
    ]);
    setCampaigns(stateFor(c) === "ok" ? c.data : []);
    setEarnings(e.data); setPayout(p.status === 503 ? { held: true } : p.data);
  }, [organizationId, selectedCampaignId]);
  useEffect(() => { load(); }, [load]);

  async function addParticipant(e) {
    e.preventDefault();
    if (!newP.campaignId || !newP.displayName.trim()) return;
    const r = await fundraiserApi.partner.createParticipant(organizationId, newP);
    if (r.ok) { setNewP({ campaignId: newP.campaignId, displayName: "" }); load(); }
  }

  if (!isFundraiserUiEnabled()) return <StateView state="dormant" />;
  if (state !== "ok") return <div style={pageWrap}><h1 style={h}>Fundraising — Partner</h1><StateView state={state} onRetry={load} /></div>;

  const rows = ov.participants || [];
  return (
    <div style={pageWrap}>
      <h1 style={h}>Fundraising — Partner Administrator</h1>

      <div style={box}>
        <h2 style={h}>Campaign summary</h2>
        <div style={{ marginBottom: 12 }}>
          <label htmlFor="fr-campaign-filter" style={{ fontSize: 13, color: "#8a7c6c", marginRight: 8 }}>Campaign</label>
          <select id="fr-campaign-filter" value={selectedCampaignId} onChange={(e) => setSelectedCampaignId(e.target.value)} style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb" }}>
            <option value="">All campaigns</option>
            {allCampaigns.map((c) => <option key={c.campaignId} value={c.campaignId}>{c.title || c.campaignId}</option>)}
          </select>
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <Stat label="Campaigns" value={ov.campaigns?.length ?? 0} />
          <Stat label="Participants" value={rows.length} />
          <Stat label="Visits" value={ov.totals?.visits ?? 0} />
          <Stat label="Scans" value={ov.totals?.scans ?? 0} />
          <Stat label="Conversions" value={ov.totals?.conversions ?? 0} />
        </div>
        <p style={{ marginTop: 12 }}>
          Estimated earnings: <strong>{earnings?.available ? `${earnings.estimateCents}¢` : "—"}</strong> <HeldBadge>{earnings?.reason || "held"}</HeldBadge>
          &nbsp;·&nbsp; Payout review: <strong>{payout?.posture || "manual_review_only"}</strong> <HeldBadge />
        </p>
      </div>

      <div style={box}>
        <h2 style={h}>Campaigns</h2>
        {campaigns.length === 0 ? <Empty>No campaigns yet.</Empty> : (
          <ul style={{ margin: 0, paddingLeft: 18 }}>{campaigns.map((c) => <li key={c.campaignId}>{c.title} — <em>{c.status}</em>{c.programLabel ? ` · ${c.programLabel}` : ""}</li>)}</ul>
        )}
      </div>

      <div style={box}>
        <h2 style={h}>Participant roster</h2>
        <form onSubmit={addParticipant} style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          <input placeholder="Campaign ID" value={newP.campaignId} onChange={(e) => setNewP({ ...newP, campaignId: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb" }} />
          <input placeholder="Display name" value={newP.displayName} onChange={(e) => setNewP({ ...newP, displayName: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb", flex: 1, minWidth: 160 }} />
          <button style={btn} type="submit">Add participant</button>
        </form>
        {rows.length === 0 ? <Empty>{selectedCampaignId ? "This campaign has no participants yet." : "No participants yet. Add one above or import a CSV."}</Empty> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ textAlign: "left", color: "#8a7c6c", fontSize: 13 }}><th>Participant</th><th>Referral</th><th>Visits</th><th>Scans</th><th>Conv.</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.attributionId} style={{ borderTop: "1px solid #f0ebe3" }}>
                  <td style={{ padding: "8px 0" }}>{r.displayName || r.attributionId}</td>
                  <td><code style={{ fontSize: 12 }}>{r.referralCode}</code></td>
                  <td>{r.visits ?? 0}</td><td>{r.scans ?? 0}</td><td>{r.conversions ?? 0}</td>
                  <td style={{ textAlign: "right" }}><a style={btnGhost} href={r.referralLink} target="_blank" rel="noreferrer">Link / QR</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ marginTop: 10, color: "#8a7c6c", fontSize: 13 }}>Participants are records managed here — they have no login or dashboard.</p>
      </div>
    </div>
  );
}
