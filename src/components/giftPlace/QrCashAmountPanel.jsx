// src/components/giftPlace/QrCashAmountPanel.jsx
// QR Cash in the Gift Place (founder 2026-10-22): the amount is chosen here, then attached to a greeting.
// Nothing is charged, ordered or sent from this screen. The amount rules, fee and limits are the existing ones
// (utils/qrCashAmount.js, which mirrors the backend's calcGiftFees and MIN/MAX_GIFT_CENTS); the charge happens
// later, in the greeting's own review and payment step.
import { useState } from 'react';
import { QrCode, X, Gift } from 'lucide-react';
import {
  validateQrCashDollars, qrCashQuote, centsToDollarString, QR_CASH_MIN_DOLLARS, QR_CASH_MAX_DOLLARS, QR_CASH_PRESET_DOLLARS,
} from '../../utils/qrCashAmount';
import { QrCashHowItWorksLink } from './QrCashHowItWorks';

const INK = '#2C1D46';

/**
 * mode: 'greeting' (opened from a greeting being written), 'standalone' (no greeting yet: confirming leads into the
 * greeting flow), or 'recipient' (opened from a recipient's settings, where QR Cash is set in the Occasion Scheduler).
 */
export default function QrCashAmountPanel({ mode = 'standalone', tagline = '', onConfirm, onCancel, isNarrow = false, pendingGift = false, onFinishPending = null }) {
  const [preset, setPreset] = useState(null); // no amount chosen at first
  const [custom, setCustom] = useState('');
  const [customTouched, setCustomTouched] = useState(false);
  const usingCustom = preset === null && custom !== '';
  const check = preset !== null ? { ok: true, dollars: preset } : validateQrCashDollars(custom);
  const quote = check.ok ? qrCashQuote(check.dollars) : null;
  const showError = preset === null && customTouched && custom !== '' && !check.ok;
  // A gift already paid for that still waits for its greeting comes first (Team 5, Report 136): no new greeting here.
  const canConfirm = mode !== 'recipient' && !pendingGift && Boolean(quote);

  const pill = (on) => ({
    minWidth: isNarrow ? 0 : '5.5rem', flex: isNarrow ? '1 1 0' : 'none', height: '2.75rem', padding: '0 1rem',
    borderRadius: '9999px', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 700, fontSize: '1rem',
    border: on ? `2px solid ${INK}` : '1px solid #d9cfe9', background: on ? INK : '#fff', color: on ? '#fff' : INK,
  });

  return (
    <section data-testid="qrcash-panel" aria-labelledby="qrcash-panel-title" style={{
      background: '#fff', border: '1px solid #e7e0f0', borderRadius: '1rem', padding: isNarrow ? '1rem' : '1.5rem 1.75rem',
      boxShadow: '0 12px 30px -24px rgba(44,29,70,.45)', maxWidth: '44rem', margin: '0 auto',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.875rem' }}>
        <span aria-hidden="true" style={{ width: '2.75rem', height: '2.75rem', borderRadius: '0.75rem', flex: 'none', display: 'grid', placeItems: 'center', background: '#FBF0D2', color: '#7A5B0C' }}><QrCode size={22} /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          {/* Founder 2026-10-24 (§6): "How it works" sits beside the QR Cash title and opens the shared explanation. */}
          <div style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', columnGap: '0.75rem', rowGap: '0.125rem' }}>
            <h2 id="qrcash-panel-title" style={{ margin: 0, fontSize: isNarrow ? '1.25rem' : '1.375rem', fontWeight: 700, color: INK }}>QR Cash™</h2>
            <QrCashHowItWorksLink />
          </div>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.9375rem', color: '#5b4f72', lineHeight: 1.5 }}>
            {tagline}
          </p>
        </div>
        {onCancel ? (
          <button type="button" data-testid="qrcash-cancel-x" aria-label="Cancel QR Cash" onClick={onCancel}
            style={{ flex: 'none', width: '2.25rem', height: '2.25rem', minHeight: 0, padding: 0, borderRadius: '50%', border: '1px solid #e7e0f0', background: '#fff', color: INK, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
            <X size={16} />
          </button>
        ) : null}
      </div>

      {mode === 'recipient' ? (
        <p data-testid="qrcash-recipient-note" role="note" style={{ margin: '1.25rem 0 0', padding: '0.875rem 1rem', borderRadius: '0.75rem', background: '#F7F3FC', color: INK, fontSize: '0.9375rem', lineHeight: 1.5 }}>
          QR Cash for a scheduled Greet-Me is set in their Occasion Scheduler. With Auto-Gift on, it is sent automatically on the occasion date and charged to your saved card. Return to their settings to choose it there.
        </p>
      ) : (
        <>
          {/* Founder 2026-10-23: say plainly which flow this joins. QR Cash chosen here goes with a Greet-Me sent now;
              a scheduled Greet-Me keeps its QR Cash in the Occasion Scheduler, and is never switched to Send Now. */}
          {pendingGift ? (
            <div data-testid="qrcash-pending-gift-note" role="alert" style={{ margin: '1rem 0 0', padding: '0.75rem 0.875rem', borderRadius: '0.75rem', background: '#FDF1E4', border: '1px solid #F1D3A8', color: '#5c3a0b', fontSize: '0.875rem', lineHeight: 1.5 }}>
              You have a gift you already paid for that is still waiting to be added to its greeting. Finish that greeting first, then choose QR Cash.
              {onFinishPending ? (
                <button type="button" data-testid="qrcash-finish-pending" onClick={onFinishPending}
                  style={{ display: 'block', marginTop: '0.5rem', padding: 0, minHeight: 0, border: 'none', background: 'none', color: INK, font: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
                  Finish that greeting
                </button>
              ) : null}
            </div>
          ) : null}
          <p data-testid="qrcash-send-now-note" role="note" style={{ margin: '1rem 0 0', padding: '0.625rem 0.875rem', borderRadius: '0.75rem', background: '#F7F3FC', color: INK, fontSize: '0.875rem', lineHeight: 1.5 }}>
            <strong>Send Now:</strong> QR Cash chosen here goes with a Greet-Me you send now. For a scheduled Greet-Me, set QR Cash in that person&rsquo;s Occasion Scheduler.
          </p>
          <fieldset style={{ border: 'none', margin: '1.25rem 0 0', padding: 0 }}>
            <legend style={{ fontSize: '0.8125rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#5A3E8A', padding: 0, marginBottom: '0.625rem' }}>Choose an amount</legend>
            <div role="radiogroup" aria-label="QR Cash amount" style={{ display: 'flex', gap: '0.5rem', flexWrap: isNarrow ? 'nowrap' : 'wrap' }}>
              {QR_CASH_PRESET_DOLLARS.map((d) => (
                <button key={d} type="button" role="radio" aria-checked={preset === d} data-testid={`qrcash-preset-${d}`}
                  onClick={() => { setPreset(d); setCustom(''); setCustomTouched(false); }} style={pill(preset === d)}>${d}</button>
              ))}
            </div>
          </fieldset>

          <label style={{ display: 'block', marginTop: '1rem' }}>
            <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, color: INK, marginBottom: '0.375rem' }}>Or enter your own amount</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', maxWidth: '16rem', height: '2.75rem', padding: '0 0.875rem', borderRadius: '0.75rem',
              border: showError ? '1.5px solid #b45309' : (usingCustom ? `2px solid ${INK}` : '1px solid #d9cfe9'), background: '#fff' }}>
              <span aria-hidden="true" style={{ fontWeight: 700, color: INK }}>$</span>
              <input data-testid="qrcash-custom" inputMode="numeric" pattern="[0-9]*" autoComplete="off" placeholder="" value={custom}
                aria-describedby="qrcash-custom-hint" aria-invalid={showError}
                onChange={(e) => { setPreset(null); setCustom(e.target.value.replace(/[^0-9]/g, '').slice(0, 4)); }}
                onBlur={() => setCustomTouched(true)}
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', font: 'inherit', fontSize: '1rem', fontWeight: 600, color: INK, background: 'transparent', padding: 0, height: '100%' }} />
            </span>
            <span id="qrcash-custom-hint" style={{ display: 'block', marginTop: '0.375rem', fontSize: '0.8125rem', color: showError ? '#b45309' : '#6B6079' }} data-testid={showError ? 'qrcash-amount-error' : undefined} role={showError ? 'alert' : undefined}>
              {showError ? check.message : `Whole dollars from $${QR_CASH_MIN_DOLLARS} to $${QR_CASH_MAX_DOLLARS}.`}
            </span>
          </label>

          <div data-testid="qrcash-summary" aria-live="polite" style={{ marginTop: '1.25rem', padding: '0.875rem 1rem', borderRadius: '0.75rem', background: '#FBF9F6', border: '1px solid #eee6d6', minHeight: '6.25rem' }}>
            {quote ? (
              <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: '1fr auto', rowGap: '0.25rem', fontSize: '0.9375rem', color: INK }}>
                <dt>QR Cash</dt><dd data-testid="qrcash-amount" style={{ margin: 0, textAlign: 'right' }}>{centsToDollarString(quote.amountCents)}</dd>
                <dt>Processing fee</dt><dd data-testid="qrcash-fee" style={{ margin: 0, textAlign: 'right' }}>{centsToDollarString(quote.feeCents)}</dd>
                <dt style={{ fontWeight: 700, borderTop: '1px solid #e7e0f0', paddingTop: '0.375rem' }}>Total</dt>
                <dd data-testid="qrcash-total" style={{ margin: 0, textAlign: 'right', fontWeight: 700, borderTop: '1px solid #e7e0f0', paddingTop: '0.375rem' }}>{centsToDollarString(quote.totalCents)}</dd>
              </dl>
            ) : (
              <p data-testid="qrcash-summary-empty" style={{ margin: 0, fontSize: '0.9375rem', color: '#6B6079', lineHeight: 1.5 }}>Choose an amount to see the processing fee and total.</p>
            )}
          </div>
          <p style={{ margin: '0.625rem 0 0', fontSize: '0.8125rem', color: '#6B6079', lineHeight: 1.5 }}>
            {/* Send Now wording: the Gift Place attaches QR Cash only to a greeting sent now (the send page has no
                scheduling); scheduled Auto-Gift QR Cash is set in the Occasion Scheduler, with its own consent. */}
            Nothing is charged now. You review the greeting and pay before anything is sent.
          </p>
        </>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.625rem', marginTop: '1.25rem', flexWrap: 'wrap' }}>
        {onCancel ? (
          <button type="button" data-testid="qrcash-cancel" onClick={onCancel}
            style={{ height: '2.75rem', padding: '0 1.25rem', borderRadius: '9999px', border: '1px solid #d9cfe9', background: '#fff', color: INK, fontFamily: 'inherit', fontWeight: 600, fontSize: '0.9375rem', cursor: 'pointer', flex: isNarrow ? '1 1 0' : 'none' }}>
            Cancel
          </button>
        ) : null}
        {mode !== 'recipient' ? (
          <button type="button" data-testid="qrcash-add" disabled={!canConfirm} onClick={() => { if (canConfirm) onConfirm(check.dollars); }}
            style={{ height: '2.75rem', padding: '0 1.5rem', borderRadius: '9999px', border: 'none', background: canConfirm ? INK : '#E9E1F2', color: canConfirm ? '#fff' : '#5A3E8A',
              fontFamily: 'inherit', fontWeight: 700, fontSize: '0.9375rem', cursor: canConfirm ? 'pointer' : 'not-allowed', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', flex: isNarrow ? '1.4 1 0' : 'none' }}>
            <Gift size={16} /> Add to Greet-Me
          </button>
        ) : null}
      </div>
    </section>
  );
}
