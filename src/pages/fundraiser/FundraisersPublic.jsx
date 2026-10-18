// src/pages/fundraiser/FundraisersPublic.jsx
//
// Public Fundraisers page (Report 77 rev 6; wording accepted temporarily by the founder, no copy edits).
// Reuses the For Business page frame and the existing ContactSalesModal with the accepted source
// "fundraiser". Structural claims only: no figures, no payout promise. Dark while the fundraiser gate
// is off (the truthful "not currently enabled" state is shown instead).
import { useState } from 'react';
import ContactSalesModal from '../../components/ContactSalesModal';
import { isFundraiserUiEnabled } from '../../config/fundraiserGate.js';
import FundraiserUnavailable from './FundraiserUnavailable.jsx';

const STEPS = [
  ['We set you up', 'Greet-Me sets up your organization and your partner agreement.'],
  ['Share your links', 'Create a campaign and give each participant their own link and QR code to share with family, friends and fans.'],
  ['Supporters join', 'When a supporter subscribes to Greet-Me through one of your links, your organization earns a share of that supporter’s subscription payments for as long as they stay subscribed, as set in your partner agreement.'],
];

export default function FundraisersPublic() {
  const [open, setOpen] = useState(false);
  if (!isFundraiserUiEnabled()) return <FundraiserUnavailable />;
  const cta = (
    <button type="button" data-testid="fr-contact" onClick={() => setOpen(true)}
      style={{ padding: '0.875rem 2rem', background: 'white', color: '#667eea', border: 'none', borderRadius: 'var(--radius-lg, 12px)', fontSize: '1rem', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 12px rgba(0,0,0,0.15)' }}>
      Contact Greet-Me
    </button>
  );
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)', width: '100%', maxWidth: '100%', overflowX: 'hidden', padding: '0.5rem', boxSizing: 'border-box' }} data-testid="fundraisers-public">
      <div style={{ maxWidth: '1280px', margin: '0 auto' }}>
        <div style={{ background: '#f8fafc', borderRadius: 'var(--radius-xl, 16px)', border: '1px solid #e2e8f0', padding: 'clamp(1rem, 4vw, 2rem)', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
          <section style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 'var(--radius-xl, 16px)', padding: 'clamp(1.75rem, 5vw, 2.5rem) clamp(1rem, 4vw, 2rem)', textAlign: 'center', color: 'white', boxShadow: '0 4px 20px rgba(102,126,234,0.3)' }}>
            <h1 style={{ fontSize: 'clamp(1.6rem, 5vw, 2.25rem)', fontWeight: 700, margin: '0 0 0.75rem', lineHeight: 1.2, color: 'white' }}>Fundraise with Greet-Me</h1>
            <p style={{ fontSize: '1.125rem', opacity: 0.95, lineHeight: 1.6, maxWidth: 720, margin: '0 auto 1.5rem', color: 'white' }}>
              A fundraiser that keeps working after the event is over.
            </p>
            {cta}
          </section>

          <section style={{ marginTop: '2rem' }}>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 700, textAlign: 'center', margin: '0 0 1.25rem', color: 'var(--text-primary)' }}>How it works</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
              {STEPS.map(([t, d], i) => (
                <div key={t} style={{ background: 'white', border: '1px solid #e2e8f0', borderRadius: 'var(--radius-lg, 12px)', padding: '1.25rem' }}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#eef2ff', color: '#4f46e5', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>{i + 1}</div>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0 0 6px', color: 'var(--text-primary)' }}>{t}</h3>
                  <p style={{ margin: 0, lineHeight: 1.55, color: 'var(--text-secondary)', fontSize: '0.95rem' }}>{d}</p>
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', margin: '1.25rem 0 0' }}>
              For schools, booster clubs, youth sports, community groups and nonprofits.
            </p>
          </section>

          <section style={{ marginTop: '2rem', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: 'var(--radius-xl, 16px)', padding: '1.75rem 1rem', textAlign: 'center', color: 'white' }}>
            <p style={{ fontSize: '1.15rem', fontWeight: 600, margin: '0 0 1rem', color: 'white' }}>Interested? Tell us about your organization.</p>
            {cta}
          </section>
          <p style={{ textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '1rem 0 0' }}>
            Already a partner? Sign in, then choose Fundraisers › Partner Dashboard.
          </p>
        </div>
      </div>
      <ContactSalesModal isOpen={open} onClose={() => setOpen(false)} source="fundraiser" pageContext="Fundraisers"
        title="Contact Greet-Me" subtitle="Tell us about your organization and we’ll reply by email." />
    </div>
  );
}
