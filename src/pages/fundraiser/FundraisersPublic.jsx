// src/pages/fundraiser/FundraisersPublic.jsx
//
// The dashboard's Fundraisers page (route /fundraisers, inside DashboardLayout). Founder handoff 2026-10-28: the
// "Greet-Me for Organizations" page (organizations/FundraisingPage.jsx) replaces the Report 77 rev 6 pitch. Its
// inquiry still uses the existing /api/contact-sales route with source "fundraiser". Structural claims only: earnings
// stay tied to qualifying subscriptions and the organization's agreement; no rates, figures or payout promises.
// Dark while the fundraiser gate is off (the truthful "not currently enabled" state is shown instead).
import { isFundraiserUiEnabled } from '../../config/fundraiserGate.js';
import FundraiserUnavailable from './FundraiserUnavailable.jsx';
import FundraisingPage from './organizations/FundraisingPage.jsx';

export default function FundraisersPublic() {
  if (!isFundraiserUiEnabled()) return <FundraiserUnavailable />;
  return (
    <div data-testid="fundraisers-public" style={{ width: '100%', maxWidth: '100%', overflowX: 'hidden' }}>
      <FundraisingPage partnerNote="Already a partner? Sign in, then choose Fundraisers › Partner Dashboard." />
    </div>
  );
}
