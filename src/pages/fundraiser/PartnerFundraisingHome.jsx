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
  // Gate ON → the org-scoped Partner dashboard is the authorized surface. Team C wires organization
  // resolution here (there is no param-less "my organizations" partner endpoint yet). Until then, a
  // truthful loading state — never fabricated data, never Founder Admin.
  return (
    <div style={pageWrap}>
      <div style={box}>
        <h2 style={h}>Greet-Me Fundraise — Partner Admin</h2>
        <StateView state="loading" />
      </div>
    </div>
  );
}
