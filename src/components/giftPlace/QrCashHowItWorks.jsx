// src/components/giftPlace/QrCashHowItWorks.jsx
// "How it works" for QR Cash™ (founder 2026-10-24, walkthrough §6): ONE explanation, shared by the Gift Place's QR Cash
// screen and the dashboard's QR Cash slide, in the founder's approved words. The payout services are the four the claim
// page offers and the backend accepts (GiftClaim.jsx PAYOUT_METHODS; live BE routes/giftRoutes.js VALID_METHODS —
// verified 2026-10-24). Payouts are reviewed and sent by the team (automatic payout is off), so nothing here promises a
// separate delivery, printing or an automatic payout.
import { useEffect, useId, useState } from 'react';
import { Gift, QrCode, HandCoins, X } from 'lucide-react';

const INK = '#2C1D46';

// In the claim screen's own order (GiftClaim.jsx PAYOUT_METHODS), as every payout list must be (founder decision #7).
export const QR_CASH_PAYOUT_SERVICES = Object.freeze(['Zelle', 'Venmo', 'Cash App', 'PayPal']);

export const QR_CASH_HOW_IT_WORKS = Object.freeze([
  {
    key: 'add', Icon: Gift, title: 'Add a little extra love',
    text: 'Attach a QR Cash gift to your Greet-Me. Choose a preset amount or enter your own, from $5 to $100.',
  },
  {
    key: 'delivered', Icon: QrCode, title: 'Delivered inside their Greet-Me',
    text: 'Your recipient clicks or scans the gift’s QR code to open the claim page.',
  },
  {
    key: 'claim', Icon: HandCoins, title: 'Claim their cash gift',
    text: `They choose a supported payment service (${QR_CASH_PAYOUT_SERVICES.slice(0, -1).join(', ')} or ${QR_CASH_PAYOUT_SERVICES.at(-1)}) and provide their payout details. Our team reviews the claim and sends the payment.`,
  },
]);

/** The three approved steps (no frame), for any surface that shows the explanation. */
export function QrCashHowItWorksSteps() {
  return (
    <ol data-testid="qrcash-howitworks-steps" style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '0.875rem' }}>
      {QR_CASH_HOW_IT_WORKS.map((step) => (
        <li key={step.key} data-testid={`qrcash-howitworks-${step.key}`} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem', padding: '0.875rem 1rem', borderRadius: '0.875rem', background: '#F7F3FC', border: '1px solid #ECE4F6' }}>
          <span aria-hidden="true" style={{ width: '2.5rem', height: '2.5rem', flex: 'none', borderRadius: '50%', display: 'grid', placeItems: 'center', background: '#FBF0D2', color: '#7A5B0C' }}><step.Icon size={19} /></span>
          <div style={{ minWidth: 0 }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: INK, lineHeight: 1.3 }}>{step.title}</h3>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.9375rem', color: '#4d4263', lineHeight: 1.55 }}>{step.text}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

/**
 * The explanation as a dialog. `action` (optional) adds one button under the steps, e.g. the dashboard's "Add QR Cash":
 * { label, onClick, testid, icon }. Escape, the backdrop and Close all close it; nothing else happens on close.
 */
export default function QrCashHowItWorks({ open, onClose, action = null }) {
  const titleId = useId();
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div onClick={onClose} aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(17, 12, 30, 0.5)', zIndex: 999, backdropFilter: 'blur(3px)' }} />
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} data-testid="qrcash-howitworks"
        style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', zIndex: 1000, width: 'min(92vw, 34rem)', maxHeight: '90vh', overflow: 'auto', background: '#fff', borderRadius: '1.125rem', boxShadow: '0 24px 60px -20px rgba(17, 12, 30, 0.55)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.75rem', padding: '1rem 1.25rem', borderBottom: '1px solid #ECE4F6' }}>
          <h2 id={titleId} tabIndex={-1} ref={(el) => { if (el && !el.dataset.f) { el.dataset.f = '1'; el.focus({ preventScroll: true }); } }}
            style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: INK, outline: 'none' }}>How QR Cash™ works</h2>
          <button type="button" data-testid="qrcash-howitworks-close" aria-label="Close" onClick={onClose}
            style={{ flex: 'none', width: '2.25rem', height: '2.25rem', minHeight: 0, padding: 0, borderRadius: '50%', border: '1px solid #ECE4F6', background: '#fff', color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ padding: '1rem 1.25rem 1.25rem' }}>
          <QrCashHowItWorksSteps />
          {action ? (
            <button type="button" data-testid={action.testid} onClick={action.onClick}
              style={{ width: '100%', marginTop: '1rem', minHeight: '2.875rem', padding: '0.75rem 1rem', border: 'none', borderRadius: '9999px', background: 'linear-gradient(135deg, #E9C766 0%, #D9AE3C 100%)', color: INK, fontSize: '1rem', fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
              {action.icon ? <action.icon size={18} /> : null}
              {action.label}
            </button>
          ) : null}
        </div>
      </div>
    </>
  );
}

/** A small "How it works" link that opens the explanation, for placing beside a QR Cash title. */
export function QrCashHowItWorksLink({ style = {}, light = false }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="qrcash-howitworks-link" onClick={() => setOpen(true)} aria-haspopup="dialog"
        style={{ minHeight: 0, padding: '0.125rem 0', border: 'none', background: 'none', font: 'inherit', fontSize: '0.875rem', fontWeight: 700, color: light ? '#EBD07A' : '#5b3fa0', textDecoration: 'underline', textUnderlineOffset: '3px', cursor: 'pointer', whiteSpace: 'nowrap', ...style }}>
        How it works
      </button>
      <QrCashHowItWorks open={open} onClose={() => setOpen(false)} />
    </>
  );
}
