// src/components/w07Auth/PaymentInfoTriangle.jsx
// The small warning triangle next to the annual-repeat sentence under "Enable Auto-Gift" (QR Cash only, and only once scheduled
// QR Cash is activated: ContactForm renders it behind SCHEDULED_QRCASH_AVAILABLE). Hover, focus or tap shows the text.
import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { PAYMENT_INFO_TEXT } from '../../utils/scheduledQrCashConsent';

export default function PaymentInfoTriangle() {
  const [open, setOpen] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block', verticalAlign: 'middle', marginLeft: 4 }}>
      <button
        type="button" data-testid="payment-info-triangle" aria-label={PAYMENT_INFO_TEXT} aria-expanded={open}
        onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} onFocus={() => setOpen(true)} onBlur={() => setOpen(false)}
        onClick={() => setOpen((o) => !o)}
        style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: '#b45309', display: 'inline-flex', lineHeight: 1 }}
      >
        <AlertTriangle size={14} />
      </button>
      {open && (
        <span role="tooltip" data-testid="payment-info-text" style={{ position: 'absolute', left: '50%', bottom: '130%', transform: 'translateX(-50%)', width: 220, maxWidth: '70vw', background: '#111827', color: '#fff', fontSize: '0.75rem', lineHeight: 1.4, padding: '6px 8px', borderRadius: 6, zIndex: 20, textAlign: 'left', fontWeight: 400 }}>
          {PAYMENT_INFO_TEXT}
        </span>
      )}
    </span>
  );
}
