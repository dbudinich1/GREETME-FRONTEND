// src/pages/fundraiser/FounderFundraisingDashboard.jsx
//
// TEAM B — Founder/Admin fundraising dashboard (ONE of exactly two authenticated dashboards).
// Every panel's data is fetched from the backend, which enforces founder_admin server-side. No
// client role grants access. Truthful loading/empty/error/dormant/forbidden states. Payouts +
// economics activation are HELD. Not activated while the gate is false.
import React, { useCallback, useEffect, useState } from "react";
import { fundraiserApi, stateFor } from "../../api/fundraiserApi.js";
import { isFundraiserUiEnabled } from "../../config/fundraiserGate.js";
import { pageWrap, box, h, btn, btnGhost, Stat, StateView, Empty, HeldBadge } from "./FundraiserUI.jsx";

export default function FounderFundraisingDashboard() {
  const [state, setState] = useState("loading");
  const [overview, setOverview] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState({ legalName: "", orgType: "school" });

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

  const openOrg = useCallback(async (org) => {
    setSelected(org); setDetail({ loading: true });
    const [pt, lt, rec, pay, aud] = await Promise.all([
      fundraiserApi.founder.participantTotals(org.organizationId),
      fundraiserApi.founder.ledgerTotals(org.organizationId),
      fundraiserApi.founder.reconciliation(org.organizationId),
      fundraiserApi.founder.payoutStatus(org.organizationId),
      fundraiserApi.founder.audit(org.organizationId),
    ]);
    setDetail({
      participants: pt.data, ledger: lt.data, reconciliation: rec.data,
      payout: pay.status === 503 ? { held: true, dormant: true } : pay.data,
      audit: stateFor(aud) === "ok" ? aud.data : [],
    });
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
