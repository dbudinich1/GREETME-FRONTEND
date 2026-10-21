// src/pages/PaymentMethod.jsx
//
// /#/dashboard/payment-method — the sender's saved personal card that Auto-Gift charges on the occasion date, and a way
// to replace it. Linked from the Auto-Gift emails ("Update payment method"). Inside the dashboard layout and its
// ProtectedRoute, so a signed-out visitor is sent to log in and brought back here (utils/paymentMethod loginReturnPath).
//
// Reuses the EXISTING W07 card flow exactly as SaveAuthorizationModal does: GET /qrcash-card/status, POST
// /qrcash-card/setup, Stripe confirmCardSetup, POST /qrcash-card/complete. Nothing is charged here.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { CreditCard, AlertTriangle } from 'lucide-react';
import api from '../api/api';
import { stripePromise } from '../stripe/stripeProvider';
import { ERROR_COPY } from '../components/w07Auth/SaveAuthorizationModal';
import { savedCardLine, statusErrorCopy, replaceSavedCard } from '../utils/paymentMethod';

const CARD_ELEMENT_OPTIONS = { style: { base: { fontSize: '16px', color: '#1f2937', '::placeholder': { color: '#9ca3af' } }, invalid: { color: '#dc2626' } } };
const small = { fontSize: '0.8125rem', lineHeight: 1.5, color: 'var(--text-secondary)', margin: '0.5rem 0 0' };
const bad = { ...small, color: '#991b1b', fontWeight: 600 };
const btn = (primary) => ({ padding: '0.6rem 1.2rem', borderRadius: 10, border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--primary-dark)' : '#fff', color: primary ? '#fff' : 'var(--text-primary)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.875rem' });

/** Inside <Elements>: the card field, plus a handle the page calls to confirm the SetupIntent. */
function CardField({ onReady, onChange }) {
  const stripe = useStripe();
  const elements = useElements();
  useEffect(() => {
    onReady(async (clientSecret) => {
      if (!stripe || !elements) return { error: { message: 'not ready' } };
      return stripe.confirmCardSetup(clientSecret, { payment_method: { card: elements.getElement(CardElement) } });
    });
    return () => onReady(null);
  }, [stripe, elements, onReady]);
  return (
    <div data-testid="card-element" style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', margin: '0.75rem 0 0' }}>
      <CardElement options={CARD_ELEMENT_OPTIONS} onChange={(e) => onChange(Boolean(e && e.complete))} />
    </div>
  );
}

function ReplaceCard({ hasCard, withStripe, onSaved, onCancel }) {
  const confirmRef = useRef(null);
  const lock = useRef(false);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const onReady = useCallback((fn) => { confirmRef.current = fn; }, []);

  const save = async () => {
    if (lock.current) return;
    if (!withStripe) { setError('card-unavailable'); return; }
    if (!complete) { setError('card-incomplete'); return; }
    lock.current = true; setBusy(true); setError(null);
    try {
      const res = await replaceSavedCard({ api, confirm: (secret) => (confirmRef.current ? confirmRef.current(secret) : null) });
      if (res.ok) onSaved(res.card); else setError(res.error);
    } finally { lock.current = false; setBusy(false); }
  };

  return (
    <div data-testid="pm-replace" style={{ borderTop: '1px solid var(--border)', marginTop: '1rem', paddingTop: '1rem' }}>
      <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{hasCard ? 'Replace your card' : 'Add a card'}</div>
      <p style={small}>Auto-Gift charges your card on the occasion date. To do that without you present, Greet-Me needs to save a card for future charges.</p>
      {withStripe ? <CardField onReady={onReady} onChange={(c) => { setComplete(c); setError(null); }} /> : <p role="alert" style={bad}>{ERROR_COPY['card-unavailable']}</p>}
      {error ? <p role="alert" data-testid="pm-error" style={bad}>{ERROR_COPY[error]}</p> : null}
      <p style={small}><AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> Nothing is charged now.</p>
      <div style={{ display: 'flex', gap: 8, marginTop: '0.75rem', flexWrap: 'wrap' }}>
        <button type="button" data-testid="pm-save" onClick={save} disabled={busy} style={{ ...btn(true), cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1 }}>{busy ? 'Saving…' : 'Save card'}</button>
        <button type="button" data-testid="pm-cancel" onClick={onCancel} disabled={busy} style={btn(false)}>Cancel</button>
      </div>
    </div>
  );
}

function PaymentMethodInner() {
  const [status, setStatus] = useState({ state: 'loading', card: null, error: null });
  const [replacing, setReplacing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' && window.innerWidth < 420);
  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth < 420);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const load = useCallback(async () => {
    setStatus((s) => ({ ...s, state: 'loading', error: null }));
    try {
      const res = await api.getQrCashCardStatus();
      setStatus({ state: 'ready', card: (res && res.card) || null, error: null });
    } catch (err) {
      setStatus({ state: 'failed', card: null, error: statusErrorCopy(err) });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const line = savedCardLine(status.card);
  const expired = Boolean(status.card && status.card.present === true && status.card.expired === true);

  return (
    <div data-testid="payment-method-page">
      <h1 style={{ fontSize: isNarrow ? '1.5rem' : '1.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>Payment method</h1>
      <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem' }}>The card Auto-Gift charges on the occasion date.</p>

      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border)', boxShadow: '0 1px 2px rgba(0, 0, 0, 0.04)', padding: isNarrow ? '1.25rem' : '1.75rem', maxWidth: 640 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
          <CreditCard style={{ color: 'var(--primary)' }} size={24} />
          <h2 style={{ fontSize: '1.25rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Saved card for Auto-Gift</h2>
        </div>

        {status.state === 'loading' ? (
          <p data-testid="pm-loading" style={{ ...small, margin: 0 }}>Loading your saved card…</p>
        ) : status.state === 'failed' ? (
          <div>
            <p role="alert" data-testid="pm-status-error" style={{ ...bad, margin: 0 }}>{status.error}</p>
            <button type="button" data-testid="pm-retry" onClick={load} style={{ ...btn(false), marginTop: '0.75rem' }}>Try again</button>
          </div>
        ) : (
          <>
            {line ? (
              <div data-testid="pm-card" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <b style={{ fontSize: '1rem' }}>{line}</b>
                {expired
                  ? <span data-testid="pm-expired" style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(220,38,38,0.12)', color: '#991b1b' }}>Expired</span>
                  : <span style={{ fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(16,185,129,0.15)', color: '#065f46' }}>On file</span>}
              </div>
            ) : (
              <p data-testid="pm-none" style={{ margin: 0, fontWeight: 700 }}>No saved card</p>
            )}
            {saved ? <p role="status" data-testid="pm-saved" style={{ ...small, color: '#065f46', fontWeight: 600 }}>Your card is saved.</p> : null}
            {replacing ? (
              <ReplaceCard hasCard={Boolean(line)} withStripe={Boolean(stripePromise)}
                onSaved={(card) => { setReplacing(false); setSaved(true); if (card) setStatus({ state: 'ready', card, error: null }); else load(); }}
                onCancel={() => setReplacing(false)} />
            ) : (
              <button type="button" data-testid="pm-replace-open" onClick={() => { setReplacing(true); setSaved(false); }} style={{ ...btn(!line || expired), marginTop: '1rem' }}>
                {line ? 'Replace card' : 'Add a card'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/** The page inside Stripe Elements when Stripe is configured (the card field needs it), as the modal does. */
export default function PaymentMethod() {
  return stripePromise ? <Elements stripe={stripePromise}><PaymentMethodInner /></Elements> : <PaymentMethodInner />;
}
