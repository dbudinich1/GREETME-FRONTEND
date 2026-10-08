// src/components/GiftCardVoucherPanel.jsx
//
// Prezzee gift-card voucher / PIN display for the recipient claim page (contract:
// reports/closeout-sprint/contracts/T2-prezzee-claim-response.md).
//
// STATES (driven only by the server's own `status`):
//   being_prepared -> the server's statusMessage + "Check again". No redeem controls, no dead button.
//   redeemable     -> PIN (masked until Reveal, with Copy) and/or an Open action for the voucher URL.
//                     Either secret alone is valid; neither present is treated as still being prepared.
//   unavailable    -> (Release 2b) the server's statusMessage only. No redeem controls, no "Check again".
//
// SECRET HYGIENE (load-bearing): the voucher URL and PIN live ONLY in props/component state. They are
// never written to console, storage, analytics, the address bar, or an error message. The Open link
// is accepted only for http(s) URLs (never javascript:/data:) and opens with rel="noopener noreferrer".
//
// This component makes no claim about purchasability: gift cards are paused server-side and nothing
// here implies they can be bought.

import { useState, useRef, useEffect } from 'react';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

/** Only plain http(s) URLs may be opened. Returns the normalized href or null. */
export function safeVoucherHref(raw) {
  if (typeof raw !== 'string' || !raw.trim()) return null;
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch {
    return null;
  }
}

const btn = (primary) => ({
  padding: '0.7rem 1rem',
  borderRadius: '0.5rem',
  border: primary ? 'none' : '1px solid #d1d5db',
  background: primary ? '#4F2D7F' : '#fff',
  color: primary ? '#fff' : '#374151',
  fontWeight: 600,
  fontSize: '0.9375rem',
  fontFamily: FONT_STACK,
  cursor: 'pointer',
  textDecoration: 'none',
  display: 'inline-block',
});

/**
 * @param {object}   props
 * @param {object}   props.gift       the claim response (status, statusMessage, voucherUrl, giftPin)
 * @param {Function} props.onRefresh  async () => 'ok' | 'expired' | 'error' ; re-reads the claim
 */
export default function GiftCardVoucherPanel({ gift, onRefresh }) {
  const [revealed, setRevealed] = useState(false);
  const [copyState, setCopyState] = useState(null); // null | 'copied' | 'failed'
  const [checking, setChecking] = useState(false);
  const [checkError, setCheckError] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const pin = typeof gift?.giftPin === 'string' && gift.giftPin ? gift.giftPin : null;
  const href = safeVoucherHref(gift?.voucherUrl);
  const ready = gift?.status === 'redeemable' && (pin || href);

  const check = async () => {
    setChecking(true);
    setCheckError(false);
    try {
      const outcome = await onRefresh?.();
      if (outcome === 'error') setCheckError(true);
    } catch {
      setCheckError(true);
    } finally {
      setChecking(false);
    }
  };

  const copyPin = async () => {
    try {
      await navigator.clipboard.writeText(pin);
      setCopyState('copied');
    } catch {
      setCopyState('failed');
    }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopyState(null), 2500);
  };

  // RELEASE 2b: the server withdrew this gift (status "unavailable"): its own message, and no
  // "Check again" — nothing will change by checking, so the button would imply a wait that is untrue.
  if (gift?.status === 'unavailable') {
    return (
      <div data-testid="giftcard-unavailable" style={{ margin: '0 0 1.5rem' }}>
        <p style={{ fontSize: '0.95rem', color: '#6b7280', lineHeight: 1.6, margin: 0 }}>
          {gift.statusMessage || 'This gift is no longer available.'}
        </p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div data-testid="giftcard-preparing" style={{ margin: '0 0 1.5rem' }}>
        <p style={{ fontSize: '0.95rem', color: '#6b7280', lineHeight: 1.6, margin: '0 0 1rem' }}>
          {gift?.statusMessage || 'Your gift is being prepared.'}
        </p>
        {checkError && (
          <p role="alert" style={{ fontSize: '0.875rem', color: '#b91c1c', margin: '0 0 0.75rem' }}>
            We couldn’t check just now. Please try again in a moment.
          </p>
        )}
        <button type="button" data-testid="giftcard-check-again" onClick={check} disabled={checking} style={btn(true)}>
          {checking ? 'Checking…' : 'Check again'}
        </button>
      </div>
    );
  }

  return (
    <div data-testid="giftcard-redeemable" style={{ margin: '0 0 1.5rem', textAlign: 'left' }}>
      <p style={{ fontSize: '0.95rem', color: '#374151', lineHeight: 1.6, margin: '0 0 1rem', textAlign: 'center' }}>
        {gift.statusMessage || 'Your gift card is ready to redeem.'}
      </p>

      {pin && (
        <div style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: '0.75rem', background: '#f9fafb', marginBottom: '0.75rem' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase', color: '#6b7280', marginBottom: '0.375rem' }}>
            Your PIN
          </div>
          <div
            data-testid="giftcard-pin"
            aria-live="polite"
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: '1.25rem', letterSpacing: '0.12em', color: '#111827', wordBreak: 'break-all', marginBottom: '0.75rem' }}
          >
            {revealed ? pin : '•'.repeat(Math.min(Math.max(pin.length, 4), 12))}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button type="button" data-testid="giftcard-reveal" onClick={() => setRevealed((v) => !v)} aria-pressed={revealed} style={btn(false)}>
              {revealed ? 'Hide PIN' : 'Reveal PIN'}
            </button>
            <button type="button" data-testid="giftcard-copy" onClick={copyPin} style={btn(false)}>
              Copy PIN
            </button>
          </div>
          <p role="status" style={{ fontSize: '0.8125rem', margin: '0.5rem 0 0', minHeight: '1.1rem', color: copyState === 'failed' ? '#b91c1c' : '#047857' }}>
            {copyState === 'copied' ? 'PIN copied.' : copyState === 'failed' ? 'Couldn’t copy. Reveal the PIN and copy it by hand.' : ''}
          </p>
        </div>
      )}

      {href && (
        <a
          data-testid="giftcard-open"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...btn(true), width: '100%', boxSizing: 'border-box', textAlign: 'center' }}
        >
          Open your gift card
        </a>
      )}
    </div>
  );
}
