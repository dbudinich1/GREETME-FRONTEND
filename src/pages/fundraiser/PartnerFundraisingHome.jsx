// src/pages/fundraiser/PartnerFundraisingHome.jsx
//
// TEAM D (B3B) — param-less HOME for the "Greet-Me Fundraise" PARTNER ADMIN interface. It performs
// ORGANIZATION DISCOVERY so a partner administrator never has to obtain or type an orgId: on load it
// asks the authenticated endpoint GET /api/fundraiser/partner/orgs for the caller's OWN organization
// assignments, then routes into the EXISTING org-scoped dashboard
// (/dashboard/fundraiser/partner/:organizationId).
//
// SAFETY / SCOPE:
//  • Reuses the existing dark gate + truthful state views (FundraiserUI) — no new design system.
//  • Authorization is server-derived: the request carries only the existing Bearer token; the
//    endpoint returns exactly the caller's orgs. No client value asserts identity or access.
//  • No default is chosen when the caller administers more than one org — a chooser is shown.
//  • NEVER exposes Founder Admin controls, campaign creation, economics, or a manual orgId field.
//  • Participants are attribution records only — this is NOT a participant login/dashboard.
import { useState, useEffect, useCallback } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { fundraiserApi, stateFor } from "../../api/fundraiserApi.js";
import { isFundraiserUiEnabled } from "../../config/fundraiserGate.js";
import { StateView, pageWrap, box, h, btn } from "./FundraiserUI.jsx";
import { partnerDashboardPath, classifyOrganizations } from "./partnerOrgDiscovery.js";

export default function PartnerFundraisingHome() {
  const enabled = isFundraiserUiEnabled();
  const navigate = useNavigate();
  const [phase, setPhase] = useState("loading"); // loading | error | ready
  const [errState, setErrState] = useState("error");
  const [orgs, setOrgs] = useState([]);

  const load = useCallback(async () => {
    if (!enabled) return; // dark gate OFF ⇒ never call the backend
    setPhase("loading");
    const r = await fundraiserApi.partner.myOrganizations();
    if (!r.ok) { setErrState(stateFor(r)); setPhase("error"); return; } // truthful 401/403/503/error
    setOrgs(Array.isArray(r.data?.organizations) ? r.data.organizations : []);
    setPhase("ready");
  }, [enabled]);
  useEffect(() => { load(); }, [load]);

  // Dark gate OFF (default) → truthful dormant state; the backend is never called.
  if (!enabled) return <div style={pageWrap}><StateView state="dormant" /></div>;

  if (phase === "loading") return <div style={pageWrap}><StateView state="loading" /></div>;
  if (phase === "error") return <div style={pageWrap}><StateView state={errState} onRetry={load} /></div>;

  const decision = classifyOrganizations(orgs);

  // Exactly one → open the existing dashboard automatically (no chooser, no manual entry).
  if (decision.mode === "single") return <Navigate to={partnerDashboardPath(decision.organizationId)} replace />;

  // Zero → truthful empty state (no fabricated access, no default org).
  if (decision.mode === "empty") {
    return (
      <div style={pageWrap}>
        <div style={box}>
          <h2 style={h}>Greet-Me Fundraise — Partner Admin</h2>
          <p style={{ color: "#7b6a59" }}>
            No approved fundraising organization is available for this account. If you believe this is
            an error, contact your Greet-Me administrator.
          </p>
        </div>
      </div>
    );
  }

  // Multiple → a simple chooser. Selection is explicit; nothing is pre-selected.
  return (
    <div style={pageWrap}>
      <div style={box}>
        <h2 style={h}>Choose an organization</h2>
        <p style={{ color: "#7b6a59", marginTop: 0 }}>
          You administer more than one fundraising organization. Select one to open its dashboard.
        </p>
        <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
          {orgs.map((o) => (
            <li key={o.organizationId} style={{ borderTop: "1px solid #f0ebe3", padding: "10px 0", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <span>{o.name || o.organizationId} <span style={{ color: "#8a7c6c", fontSize: 13 }}>· {o.status}</span></span>
              <button style={btn} type="button" onClick={() => navigate(partnerDashboardPath(o.organizationId))}>Open dashboard</button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
