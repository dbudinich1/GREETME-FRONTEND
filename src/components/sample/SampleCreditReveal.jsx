// src/components/sample/SampleCreditReveal.jsx
//
// SAMPLE $5 CREDIT REVEAL. Mirrors the real signed-out recipient screen (CreditClaim.jsx, anonymous view):
// same styles, eyebrow, headline, body and button label. Differences (Team 1 Report 70 rev 2 §5.2): a sample
// ribbon, the claim button is INERT (inline note only), and Back/Close actions.
// No API, no storage, no navigation, no analytics events.
import { useState } from 'react';
import { SAMPLE_CHROME } from './sampleGreeting.js';

const R = SAMPLE_CHROME.creditReveal;
const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const styles = { // copied from CreditClaim.jsx styles
  page: { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100%', boxSizing: 'border-box',
    background: 'linear-gradient(160deg, #1B2A4A 0%, #2d1b4e 40%, #1B2A4A 100%)', padding: '2rem 1.5rem', fontFamily: FONT_STACK },
  icon: { width: '4.5rem', height: '4.5rem', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.15)', border: '2px solid rgba(16, 185, 129, 0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 2rem', fontSize: '2rem' },
  eyebrow: { fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 0.75rem' },
  headline: { fontSize: '1.75rem', fontWeight: 500, color: '#fff', lineHeight: 1.4, margin: '0 0 1rem', fontFamily: 'Georgia, serif' },
  body: { fontSize: '0.9375rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.6, margin: '0 0 2.5rem' },
  cta: { display: 'inline-block', padding: '0.875rem 2.5rem', background: '#fff', color: '#1B2A4A', border: 'none', borderRadius: '2rem',
    fontSize: '1.0625rem', fontWeight: 600, fontFamily: 'Georgia, serif', cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,255,255,0.15)', width: '100%' },
  ctaSecondary: { display: 'inline-block', padding: '0.875rem 2.5rem', background: 'transparent', color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '2rem', fontSize: '0.9375rem', fontWeight: 600, fontFamily: 'Georgia, serif', cursor: 'pointer', width: '100%' },
  footer: { fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', margin: '2rem 0 0' },
};

export default function SampleCreditReveal({ onBack, onClose }) {
  const [noteOpen, setNoteOpen] = useState(false);
  return (
    <div style={{ ...styles.page, position: 'relative' }} data-testid="sample-credit-reveal">
      <div data-testid="sample-ribbon" style={{ position: 'absolute', top: 0, left: 0, right: 0, background: '#fde68a', color: '#78350f',
        fontFamily: FONT_STACK, fontSize: '.82rem', fontWeight: 700, textAlign: 'center', padding: '.5rem 1rem' }}>{R.sampleRibbon}</div>
      <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center', paddingTop: '1.5rem' }}>
        <div style={styles.icon}>🎁</div>
        <p style={styles.eyebrow}>{R.eyebrow}</p>
        <h1 style={styles.headline}>{R.headline}</h1>
        <p style={styles.body}>{R.body}</p>
        <button type="button" data-testid="sample-claim-inert" onClick={() => setNoteOpen(true)} style={{ ...styles.cta, marginBottom: '0.75rem' }}>
          {R.buttonLabel}
        </button>
        {noteOpen ? (
          <p data-testid="sample-inert-note" role="status" style={{ color: '#fde68a', fontSize: '.875rem', lineHeight: 1.5, margin: '0 0 1rem' }}>{R.inertNote}</p>
        ) : null}
        <div style={{ display: 'grid', gap: '.6rem', marginTop: '.5rem' }}>
          {onBack ? <button type="button" data-testid="sample-credit-back" style={styles.ctaSecondary} onClick={onBack}>{R.actions[0]}</button> : null}
          {onClose ? <button type="button" data-testid="sample-credit-close" style={styles.ctaSecondary} onClick={onClose}>{R.actions[1]}</button> : null}
        </div>
        <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
      </div>
    </div>
  );
}
