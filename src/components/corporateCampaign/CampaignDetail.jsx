// src/components/corporateCampaign/CampaignDetail.jsx
//
// TEAM A — campaign detail surface. Shows the server-derived status fields and hosts entry
// into Team C's CampaignFeaturedSpreadEditor via "Customize Featured Spread". Team A does NOT
// implement editor internals — it mounts Team C's component and wires the API callbacks.
// Readiness is never fabricated here; it comes from the server contract.

import { useCallback, useEffect, useState } from "react";
import CampaignFeaturedSpreadEditor from "../../corporateCampaign/CampaignFeaturedSpreadEditor.jsx";
import { deriveCampaignSummary, writeResultMessage, TERMS, CORPORATE_VIDEO } from "./campaignSurfaceModel.js";

const PURPLE = "linear-gradient(135deg, #6d74ee 0%, #764ba2 100%)";
const btn = (bg, fg = "#fff") => ({ background: bg, color: fg, border: bg === "transparent" ? "1px solid rgba(27,24,48,.15)" : "none", borderRadius: 11, padding: "10px 16px", fontWeight: 700, fontSize: ".82rem", cursor: "pointer" });

export default function CampaignDetail({ orgId, campaignId, client, capability, onBack }) {
  const [campaign, setCampaign] = useState(null);
  const [readiness, setReadiness] = useState({});
  const [showEditor, setShowEditor] = useState(false);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [cRes, rRes] = await Promise.all([
      client.readCampaign(orgId, campaignId),
      client.readReadiness(orgId, campaignId),
    ]);
    // 401/403 → clear protected data; never render stale data from another organization.
    if (cRes.unauthorized || rRes.unauthorized) {
      setCampaign(null); setReadiness({});
      setMessage("You don't have access to this campaign.");
      return;
    }
    const msg = writeResultMessage(cRes) || writeResultMessage(rRes);
    if (msg) setMessage(msg);
    if (cRes.ok) setCampaign(cRes.data.campaign || cRes.data);
    if (rRes.ok) setReadiness(rRes.data || {});
  }, [client, orgId, campaignId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  const summary = deriveCampaignSummary(campaign || {}, readiness);

  async function run(op) {
    setBusy(true); setMessage(null);
    const res = await op();
    setBusy(false);
    // 409 etag_conflict: re-fetch the campaign, show the conflict notice, and require the
    // user to retry the intended mutation. NEVER auto-repeat the mutation.
    if (res && res.conflict) {
      await refresh();
      setMessage(writeResultMessage(res));
      return res;
    }
    const msg = writeResultMessage(res);
    if (msg) { setMessage(msg); return res; }
    await refresh();
    return res;
  }

  // Editor callbacks — thin wiring to the API; the editor owns the config UI.
  const onSaveDraft = (config) => run(() => client.updateFeaturedSpread(orgId, campaignId, { featuredSpreadConfig: config }))
    .then((r) => { if (r && r.ok) setShowEditor(false); });     // Save → Return to Campaign
  const onApprove = () => run(() => client.approve(orgId, campaignId));
  const onLock = () => run(() => client.lock(orgId, campaignId, {}));
  const onUnlock = () => run(() => client.unlock(orgId, campaignId));
  const onReturn = () => setShowEditor(false);                  // Return to Campaign

  const a = summary.actions;

  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <button onClick={onBack} style={{ ...btn("transparent", "#4a3fb0"), marginBottom: 14 }}>← {TERMS.RETURN}s</button>

      <header style={{ background: PURPLE, color: "#fff", borderRadius: 18, padding: "22px 24px" }}>
        <h1 style={{ margin: "0 0 4px", fontSize: "1.35rem" }}>{summary.name}</h1>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: ".8rem", opacity: .93 }}>
          <span>Audience: {summary.audience}</span>
          <span>Type: {summary.occasionType}</span>
          <span>Schedule: {summary.scheduleStatus}</span>
        </div>
      </header>

      {message && (
        <div role="alert" style={{ margin: "12px 0", padding: "10px 14px", borderRadius: 10, background: "rgba(214,145,16,.12)", border: "1px solid rgba(214,145,16,.4)", color: "#7a5410", fontSize: ".85rem" }}>{message}</div>
      )}

      <section style={{ background: "#fff", border: "1px solid rgba(27,24,48,.1)", borderRadius: 14, padding: 18, marginTop: 14 }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: ".85rem" }}>
          <div>{TERMS.FEATURED_SPREAD}: <b>{summary.featuredSpreadStatus}</b></div>
          <div>Approval: <b>{summary.approvalStatus}</b></div>
          <div>Lock: <b>{summary.lockStatus}</b></div>
          <div>Ready to send: <b>{summary.ready ? "Yes" : "No"}</b></div>
        </div>
        {summary.introFinaleOnly && (
          <p style={{ marginTop: 10, fontSize: ".82rem", color: "#1f9d6b" }}>
            Featured Spread omitted — this campaign plays {TERMS.INTRO_FINALE}. Gifts remain independent.
          </p>
        )}
        <p style={{ marginTop: 10, fontSize: ".76rem", color: "#928ea8" }}>
          {CORPORATE_VIDEO.label}: {CORPORATE_VIDEO.note}
        </p>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16 }}>
          {a.canEdit && !showEditor && (
            <button onClick={() => setShowEditor(true)} style={btn(PURPLE)}>{TERMS.CUSTOMIZE}</button>
          )}
          {a.canApprove && <button onClick={onApprove} disabled={busy} style={btn("#1f9d6b")}>Approve</button>}
          {a.canLock && <button onClick={onLock} disabled={busy} style={btn("#4a3fb0")}>Approve &amp; Lock</button>}
          {a.canUnlock && <button onClick={onUnlock} disabled={busy} style={btn("transparent", "#1b1830")}>Unlock</button>}
        </div>
      </section>

      {showEditor && (
        <section style={{ marginTop: 16 }}>
          {/* Team C's editor — capability is server-derived; while dormant it renders nothing. */}
          <CampaignFeaturedSpreadEditor
            capabilityEnabled={capability.available}
            campaignName={summary.name}
            initialConfig={campaign && campaign.featuredSpreadConfig}
            readiness={readiness}
            onSaveDraft={onSaveDraft}
            onApprove={onApprove}
            onLock={onLock}
            onUnlock={onUnlock}
            onReturn={onReturn}
          />
        </section>
      )}
    </div>
  );
}
