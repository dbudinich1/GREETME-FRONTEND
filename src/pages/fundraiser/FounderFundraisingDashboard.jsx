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
// P2 — pure state model for the partner-administrator panel (no React/DOM/fetch inside).
import { STATES, resolveOutcome, assignOutcome, messageFor, canAssign, isAssigned } from "./partnerAdminAssign.js";

export default function FounderFundraisingDashboard() {
  const [state, setState] = useState("loading");
  const [overview, setOverview] = useState(null);
  const [orgs, setOrgs] = useState([]);
  const [selected, setSelected] = useState(null);
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
