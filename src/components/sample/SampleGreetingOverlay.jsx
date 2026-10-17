// src/components/sample/SampleGreetingOverlay.jsx
//
// SAMPLE GREET-ME VIEWER (Report 71 rev 2). The EXISTING card player fed the fixed sample content, isOwner=false
// (recipient wording), framed as a sample with Replay and Close on every screen. It never uses /g/:jobId (no
// "opened" event) and never passes a credit code, gift or claim URL.
//
// The finale's sample QR and its tap-to-reveal come from the player's optional `sample` input
// ({ qrTarget, onCreditTap }). The player accepts that input only once the separately authorized player change
// is applied; the landing does not offer this viewer before then (SAMPLE_ENTRY_ENABLED).
import { useEffect, useState } from 'react';
import GreetingCard from '../GreetingCardProto/GreetingCard';
import SampleCreditReveal from './SampleCreditReveal.jsx';
import { SAMPLE_GREETING, SAMPLE_CHROME, SAMPLE_QR_PATH } from './sampleGreeting.js';

// Team 2 condition 3: same origin pattern as FinaleSpread (window.location.origin).
export function sampleQrTarget() {
  return `${window.location.origin}${SAMPLE_QR_PATH}`;
}

export default function SampleGreetingOverlay({ onClose, startWithReveal = false }) {
  const [creditOpen, setCreditOpen] = useState(startWithReveal);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const esc = (e) => { if (e.key === 'Escape') { if (creditOpen) setCreditOpen(false); else onClose(); } };
    window.addEventListener('keydown', esc);
    const prev = document.body.style.overflow; document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', esc); document.body.style.overflow = prev; };
  }, [onClose, creditOpen]);
  const btn = { padding: '.35rem .8rem', borderRadius: 999, border: '1px solid #d6d0c6', background: '#fff', fontSize: '.8rem', fontWeight: 600, cursor: 'pointer', color: '#374151' };
  return (
    <div role="dialog" aria-modal="true" aria-label={SAMPLE_CHROME.viewerLabel} data-testid="sample-overlay"
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: '#f5f3f0', overflowY: 'auto' }}>
      <div style={{ position: 'sticky', top: 0, zIndex: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '.5rem',
        padding: '.6rem 1rem', background: 'rgba(245,243,240,.94)', backdropFilter: 'blur(6px)', borderBottom: '1px solid #e7e2da',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}>
        <span style={{ fontSize: '.8rem', color: '#6b7280' }}>
          <strong style={{ color: '#1f2937' }}>{SAMPLE_CHROME.viewerLabel}</strong>
          <span style={{ margin: '0 .4rem', opacity: .4 }}>·</span><span style={{ fontStyle: 'italic' }}>Forget Them Not!™</span>
        </span>
        <span style={{ display: 'flex', gap: '.4rem' }}>
          <button type="button" data-testid="sample-replay" style={btn} onClick={() => { setCreditOpen(false); setRound((r) => r + 1); }}>↺ Replay</button>
          <button type="button" data-testid="sample-close" style={btn} onClick={onClose} aria-label="Close sample">✕ Close</button>
        </span>
      </div>
      <div className="gc-public-wrapper">
        <GreetingCard key={round} greeting={SAMPLE_GREETING} isOwner={false} onRetryVideo={null}
          sample={{ qrTarget: sampleQrTarget(), onCreditTap: () => setCreditOpen(true) }} />
      </div>
      {creditOpen ? (
        <div style={{ position: 'fixed', inset: 0, zIndex: 10, overflowY: 'auto' }}>
          <SampleCreditReveal onBack={() => setCreditOpen(false)} onClose={onClose} />
        </div>
      ) : null}
    </div>
  );
}
