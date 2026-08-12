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
import ParticipantQrCode from "./ParticipantQrCode.jsx"; // F1-7 — scannable QR from the existing payload

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
  // FE-ROSTER-1: roster management. importText = pasted names (one per line).
  // actionError = last truthful failure message (H9: never show success on non-2xx).
  // busy guards against double-firing a destructive action mid-request.
  // linksFor holds server-retrieved links per participant (never client-fabricated).
  const [importText, setImportText] = useState("");
  const [actionError, setActionError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [linksFor, setLinksFor] = useState({});

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

  // F1-8 - the add form's Campaign ID is PREFILLED from the campaign chosen in the Campaign
  // summary dropdown. Derived, not synced into state: an effect that called setNewP would add a
  // second "setState synchronously within an effect" violation to this file. A typed value still
  // wins, so the existing ability to target another campaign is preserved.
  const addCampaignId = newP.campaignId || selectedCampaignId;

  async function addParticipant(e) {
    e.preventDefault();
    setActionError(null);
    if (!addCampaignId || !newP.displayName.trim()) return;
    const r = await fundraiserApi.partner.createParticipant(organizationId, { ...newP, campaignId: addCampaignId });
    if (!r.ok) { setActionError(`Add failed (${r.status || "network error"}). No participant was added.`); return; } // H9
    setNewP({ campaignId: newP.campaignId, displayName: "" });
    load(); // re-fetch from server; no optimistic roster mutation
  }

  // Bulk import. Backend expects JSON { campaignId, rows:[{ displayName, ... }] } — verified
  // against services/fundraiser/api/partnerApi.js (importRoster → participant.importRoster).
  // NOT a CSV/file upload; a spreadsheet parser would need a new dependency (disallowed this
  // slice), so we accept pasted names (one per line) and map each to a row. Import targets the
  // currently-selected campaign, respecting the FE-SEG-1 scope.
  async function doImport(e) {
    e.preventDefault();
    setActionError(null);
    if (!selectedCampaignId) { setActionError("Select a specific campaign above before importing."); return; }
    const rows = importText.split("\n").map((line) => line.trim()).filter(Boolean).map((displayName) => ({ displayName }));
    if (rows.length === 0) { setActionError("Paste at least one participant name (one per line)."); return; }
    setBusy(true);
    const r = await fundraiserApi.partner.importRoster(organizationId, { campaignId: selectedCampaignId, rows });
    setBusy(false);
    if (!r.ok) { setActionError(`Import failed (${r.status || "network error"}). No participants were added.`); return; } // H9
    setImportText("");
    load(); // re-fetch from server; no optimistic roster mutation
  }

  // Regenerate a participant's referral token. Destructive + irreversible: reason "compromised"
  // revokes the old token and issues a new one (backend regenerationPlan), so any printed QR or
  // shared link stops working. Confirm before firing.
  async function doRegenerate(pid, name) {
    setActionError(null);
    if (!window.confirm(`Regenerate the referral token for "${name}"?\n\nThis invalidates the current link immediately. Any printed QR code or already-shared link will STOP working. This cannot be undone.`)) return;
    setBusy(true);
    const r = await fundraiserApi.partner.regenerate(organizationId, pid, "compromised");
    setBusy(false);
    if (!r.ok) { setActionError(`Token regeneration failed (${r.status || "network error"}). The existing link is unchanged.`); return; } // H9
    setLinksFor((m) => { const n = { ...m }; delete n[pid]; return n; }); // drop any stale cached links
    load();
  }

  // Soft-delete (backend sets status "removed"). Confirm before firing.
  async function doRemove(pid, name) {
    setActionError(null);
    if (!window.confirm(`Remove "${name}" from the roster?\n\nThey will no longer appear here. Historical attribution is preserved server-side.`)) return;
    setBusy(true);
    const r = await fundraiserApi.partner.deactivateParticipant(organizationId, pid);
    setBusy(false);
    if (!r.ok) { setActionError(`Remove failed (${r.status || "network error"}). The participant is unchanged.`); return; } // H9
    load();
  }

  // Retrieve authoritative links/QR from the server (never fabricated client-side).
  async function doLinks(pid) {
    setActionError(null);
    const r = await fundraiserApi.partner.participantLinks(organizationId, pid);
    if (!r.ok || !r.data) { setActionError(`Could not retrieve links (${r.status || "network error"}).`); return; } // H9
    setLinksFor((m) => ({ ...m, [pid]: r.data }));
  }

  if (!isFundraiserUiEnabled()) return <StateView state="dormant" />;
  if (state !== "ok") return <div style={pageWrap}><h1 style={h}>Fundraising — Partner</h1><StateView state={state} onRetry={load} /></div>;

  // FE-ROSTER-1: the backend overview returns removed participants too (organizationOverview
  // filters by campaignId only, never by status — verified at eda1420), so a just-removed
  // participant would otherwise keep rendering. Exclude status "removed" from the roster.
  const rows = (ov.participants || []).filter((r) => r.status !== "removed");
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
          <input placeholder="Campaign ID" value={addCampaignId} onChange={(e) => setNewP({ ...newP, campaignId: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb" }} />
          <input placeholder="Display name" value={newP.displayName} onChange={(e) => setNewP({ ...newP, displayName: e.target.value })} style={{ padding: 8, borderRadius: 6, border: "1px solid #d8cdbb", flex: 1, minWidth: 160 }} />
          <button style={btn} type="submit" disabled={!selectedCampaignId || !newP.displayName.trim()}>Add participant</button>
          {/* F1-8 - names the ACTUAL requirement for adding ONE participant. Deliberately not the
              bulk-import wording, which describes a different action. */}
          {!selectedCampaignId ? (
            <span style={{ alignSelf: "center", fontSize: 13, color: "#8a7c6c" }}>
              Select a specific campaign above &mdash; a participant is added to one campaign.
            </span>
          ) : null}
        </form>

        <form onSubmit={doImport} style={{ marginBottom: 12 }}>
          <label htmlFor="fr-import" style={{ display: "block", fontSize: 13, color: "#8a7c6c", marginBottom: 4 }}>
            Bulk import into {selectedCampaignId ? "the selected campaign" : "a campaign"} — paste one participant name per line
          </label>
          <textarea id="fr-import" value={importText} onChange={(e) => setImportText(e.target.value)} rows={3} placeholder="One participant name per line" style={{ width: "100%", padding: 8, borderRadius: 6, border: "1px solid #d8cdbb", fontFamily: "inherit", boxSizing: "border-box" }} />
          <div style={{ marginTop: 6 }}>
            <button style={btn} type="submit" disabled={busy || !selectedCampaignId}>Import roster</button>
            {!selectedCampaignId ? <span style={{ marginLeft: 8, fontSize: 13, color: "#8a7c6c" }}>Select a specific campaign above to import.</span> : null}
          </div>
        </form>

        {actionError ? <p style={{ margin: "0 0 12px", padding: "8px 12px", borderRadius: 6, background: "#fbeeea", border: "1px solid #e3b7a6", color: "#8a3b25", fontSize: 13 }}>{actionError}</p> : null}

        {rows.length === 0 ? <Empty>{selectedCampaignId ? "This campaign has no participants yet." : "No participants yet. Add one above, or paste names to import."}</Empty> : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead><tr style={{ textAlign: "left", color: "#8a7c6c", fontSize: 13 }}><th>Participant</th><th>Referral</th><th>Visits</th><th>Scans</th><th>Conv.</th><th></th></tr></thead>
            <tbody>
              {rows.map((r) => (
                <React.Fragment key={r.attributionId}>
                <tr style={{ borderTop: "1px solid #f0ebe3" }}>
                  <td style={{ padding: "8px 0" }}>{r.displayName || r.attributionId}</td>
                  <td><code style={{ fontSize: 12 }}>{r.referralCode}</code></td>
                  <td>{r.visits ?? 0}</td><td>{r.scans ?? 0}</td><td>{r.conversions ?? 0}</td>
                  <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                    <a style={btnGhost} href={r.referralLink} target="_blank" rel="noreferrer">Link / QR</a>
                    <button style={{ ...btnGhost, marginLeft: 6 }} type="button" disabled={busy} onClick={() => doLinks(r.participantId)}>Links</button>
                    <button style={{ ...btnGhost, marginLeft: 6 }} type="button" disabled={busy} onClick={() => doRegenerate(r.participantId, r.displayName || r.attributionId)}>Regenerate</button>
                    <button style={{ ...btnGhost, marginLeft: 6, color: "#8a3b25", borderColor: "#8a3b25" }} type="button" disabled={busy} onClick={() => doRemove(r.participantId, r.displayName || r.attributionId)}>Remove</button>
                  </td>
                </tr>
                {linksFor[r.participantId] ? (
                  <tr>
                    <td colSpan={6} style={{ padding: "6px 0 10px", color: "#5b4f42", fontSize: 13 }}>
                      <div>Referral code: <code>{linksFor[r.participantId].referralCode}</code> · token v{linksFor[r.participantId].tokenVersion} · status {linksFor[r.participantId].status}</div>
                      <div>Link: <a href={linksFor[r.participantId].referralLink} target="_blank" rel="noreferrer">{linksFor[r.participantId].referralLink}</a></div>
                      <div style={{ color: "#8a7c6c" }}>QR payload: <code>{linksFor[r.participantId].qrPayload}</code></div>
                      {/* F1-7 — scannable + printable rendering of the SAME payload shown above. Additive: the
                          payload text, the Link / QR anchor, the Links button and all roster behavior are unchanged. */}
                      <ParticipantQrCode payload={linksFor[r.participantId].qrPayload} referralCode={linksFor[r.participantId].referralCode} />
                    </td>
                  </tr>
                ) : null}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
        <p style={{ marginTop: 10, color: "#8a7c6c", fontSize: 13 }}>Participants are records managed here — they have no login or dashboard.</p>
      </div>
    </div>
  );
}
