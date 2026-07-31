// src/pages/fundraiser/PartnerFundraisingHome.jsx
//
// TEAM C — stable, param-less HOME for the "Greet-Me Fundraise" PARTNER ADMIN interface.
// The primary-nav "Greet-Me Fundraise" header points here so Team C has one fixed destination
// while the org-scoped dashboard (/dashboard/fundraiser/partner/:organizationId) is built out.
//
// SAFETY / SCOPE:
//  • Reuses the existing dark gate + truthful state views (FundraiserUI) — no new design system,
//    no duplicate dashboard. This is the "smallest safe home shell," not a second interface.
//  • NEVER exposes Founder Admin controls (that surface lives at /dashboard/fundraiser/admin).
//  • Nav visibility is Founder-authorized; what THIS page renders is still governed by
//    isFundraiserUiEnabled() and, once enabled, the backend (401/403/503). No client role grants access.
//  • Participants are attribution records only — this is NOT a participant login/dashboard.
import { isFundraiserUiEnabled } from "../../config/fundraiserGate.js";
import { StateView, pageWrap, box, h } from "./FundraiserUI.jsx";

export default function PartnerFundraisingHome() {
  // Dark gate OFF (default) → truthful dormant state; the backend is never called.
  if (!isFundraiserUiEnabled()) {
    return <div style={pageWrap}><StateView state="dormant" /></div>;
  }
  // Gate ON → partner access is organization-scoped. There is no param-less
  // "my organizations" partner endpoint (GET /partner/orgs does not exist — Tier 2),
  // so this home cannot resolve an org and must NOT fetch or redirect. Truthful
  // in-component state: partners reach their dashboard via a direct organization link.
  return (
    <div style={pageWrap}>
      <div style={box}>
        <h2 style={h}>Greet-Me Fundraise — Partner Admin</h2>
        <p style={{ color: "#7b6a59" }}>
          Partner dashboard access is organization-scoped. Open the direct
          dashboard link issued for your organization to manage your campaign.
          There is no shared partner home page — each organization reaches its
          dashboard through its own link.
        </p>
      </div>
    </div>
  );
}
