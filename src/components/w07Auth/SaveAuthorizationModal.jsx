// src/components/w07Auth/SaveAuthorizationModal.jsx
//
// W07: the pop-up that opens when SAVE is clicked on the recipient form and something is still needed:
//   * ONE consent block per new or changed QR Cash Auto-Gift occasion (founder-approved wording w07-sched-qrcash-v1), each with its
//     own occasion name, date, amount, fee and total and its own tick box;
//   * a card for future charges when none usable is on file (existing Team 2 steps: POST /qrcash-card/setup, Stripe confirmCardSetup,
//     POST /qrcash-card/complete);
//   * the recipient's mailing address, once, when a shipped gift has none.
// Its SAVE finishes the same save (the parent sends the `occasionGiftConsents` it returns). Cancel saves nothing.
//
// DORMANT: ContactForm renders this only when SCHEDULED_QRCASH_AVAILABLE is true. Nothing is charged here: saving a card only
// authorizes the charges described in the consent text.
import { useEffect, useRef, useState } from 'react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { ShieldCheck, CreditCard, AlertTriangle } from 'lucide-react';
import api from '../../api/api';
import { stripePromise } from '../../stripe/stripeProvider';
import { getErrorMessage } from '../../utils/errorMessages';
import { buildConsentPayload, consentParagraphs, CONSENT_TICK_LABEL, SCHED_QRCASH_WORDING_VERSION } from '../../utils/scheduledQrCashConsent';

export const ERROR_COPY = {
  'consent-missing': 'Please tick the box to authorize future charges.',
  'card-incomplete': 'Please enter your card details.',
  'setup-unconfirmed': "Your bank didn't confirm this card. Please try again or use a different card.",
  unavailable: "We couldn't save your card just now. Please try again.",
  'card-unavailable': 'Card entry is not available right now. Please try again later.',
};

const CARD_ELEMENT_OPTIONS = { style: { base: { fontSize: '16px', color: '#1f2937', '::placeholder': { color: '#9ca3af' } }, invalid: { color: '#dc2626' } } };
const small = { fontSize: '0.75rem', lineHeight: 1.5, color: 'var(--text-secondary)' };
const bad = { ...small, color: '#991b1b' };
const input = { width: '100%', padding: '0.5rem', border: '1px solid var(--border)', borderRadius: 8, fontSize: '0.8125rem', fontFamily: 'inherit', boxSizing: 'border-box' };

/** Inside <Elements>: the card field, plus a handle the modal calls to confirm the SetupIntent. */
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
    <div data-testid="card-element" style={{ padding: '0.75rem', border: '1px solid var(--border)', borderRadius: 8, background: '#fff', margin: '0.5rem 0' }}>
      <CardElement options={CARD_ELEMENT_OPTIONS} onChange={(e) => onChange(Boolean(e && e.complete))} />
    </div>
  );
}

function Inner({ plan, card, formData, setFormData, onSave, onCancel, withStripe }) {
  const { items, need } = plan;
  const [consents, setConsents] = useState({});
  const [errors, setErrors] = useState({});
  const [errorKeys, setErrorKeys] = useState({});
  const [setupError, setSetupError] = useState(null);
  const [submitError, setSubmitError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const confirmRef = useRef(null);
  const cardDone = useRef(false);
  const lock = useRef(false);
  const addr = formData.shippingAddress || {};
  const setAddr = (k) => (e) => { setFormData((p) => ({ ...p, shippingAddress: { ...p.shippingAddress, [k]: e.target.value } })); setErrors((x) => ({ ...x, [k]: undefined })); };
  const setName = (k) => (e) => { setFormData((p) => ({ ...p, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const submit = async () => {
    if (lock.current) return;
    const found = {};
    if (need.address) {
      if (!(formData.firstName || '').trim()) found.firstName = 'First name is needed for the shipping label.';
      if (!(addr.line1 || '').trim()) found.line1 = 'Please enter the street address.';
      if (!(addr.city || '').trim()) found.city = 'Please enter the city.';
      if (!(addr.state || '').trim()) found.state = 'Please enter the state.';
      if (!(addr.zip || '').trim()) found.zip = 'Please enter the ZIP code.';
    }
    const missing = {};
    if (need.consent) for (const it of items) if (!consents[it.key]) missing[it.key] = 'consent-missing';
    let setup = null;
    const needCardNow = need.card && !cardDone.current;
    if (needCardNow && !Object.keys(missing).length) {
      if (!withStripe) setup = 'card-unavailable';
      else if (!cardComplete) setup = 'card-incomplete';
    }
    setErrors(found); setErrorKeys(missing); setSetupError(setup); setSubmitError(null);
    if (Object.keys(found).length || Object.keys(missing).length || setup) return;

    lock.current = true; setBusy(true);
    try {
      if (needCardNow) {
        let started;
        try { started = await api.setupQrCashCard(); } catch { setSetupError('unavailable'); return; }
        if (!started || !started.clientSecret || !started.setupIntentId) { setSetupError('unavailable'); return; }
        const confirmed = await confirmRef.current(started.clientSecret);
        if (!confirmed || confirmed.error || !confirmed.setupIntent || confirmed.setupIntent.status !== 'succeeded') { setSetupError('setup-unconfirmed'); return; }
        try {
          await api.completeQrCashCard({ setupIntentId: confirmed.setupIntent.id, consentAccepted: true, consentWordingVersion: started.consentWordingVersion });
        } catch { setSetupError('unavailable'); return; }
        cardDone.current = true; // the card is on file now; a retry of the save must not set it up again
      }
      try {
        await onSave(buildConsentPayload(items));
      } catch (err) {
        setSubmitError(getErrorMessage(err));
      }
    } finally {
      lock.current = false; setBusy(false);
    }
  };

  const row = (k, ph, value, onChange) => (
    <div>
      <input data-testid={`save-modal-${k}`} placeholder={ph} value={value} onChange={onChange} style={input} autoComplete="off" />
      {errors[k] && <p data-testid={`save-modal-error-${k}`} style={bad}>{errors[k]}</p>}
    </div>
  );

  const cardProblem = plan.cardState === 'expired' ? 'This card has expired, so it can’t be charged. Add a new card to keep Auto-Gift working.'
    : plan.cardState === 'expires-before' ? 'This card expires before the occasion date, so it could not be charged on the day. Add a new card.' : null;

  return (
    <>
      <div onClick={busy ? undefined : onCancel} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 999 }} />
      <div role="dialog" aria-modal="true" aria-label="Finish saving" data-testid="save-modal" style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#fff', borderRadius: 14, boxShadow: '0 20px 60px rgba(0,0,0,0.3)', zIndex: 1000, width: '94%', maxWidth: 520, maxHeight: '92vh', overflow: 'auto', padding: '1.1rem 1.25rem' }}>
        <h2 style={{ margin: '0 0 4px', fontSize: '1.15rem' }}>Almost done</h2>
        <p style={{ margin: '0 0 12px', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {need.card && need.address ? 'We need a payment method for Auto-Gift and the mailing address for this gift before we save.'
            : need.card ? 'Auto-Gift needs a valid payment method on file before we save.'
            : need.consent && need.address ? 'Please confirm your Auto-Gift authorization and give the mailing address for this gift before we save.'
            : need.consent ? (items.length > 1 ? 'Please confirm your authorization for each Auto-Gift below before we save.' : 'You changed this Auto-Gift, so please confirm your authorization before we save.')
            : 'This gift is shipped, so we need the recipient’s mailing address before we save.'}
        </p>

        {need.address && (
          <section data-testid="save-modal-address" style={{ marginBottom: 14 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 6 }}>Mailing address</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {row('firstName', 'Recipient First Name *', formData.firstName || '', setName('firstName'))}
              {row('lastName', 'Recipient Last Name (optional)', formData.lastName || '', setName('lastName'))}
              {row('line1', 'Address Line 1 *', addr.line1 || '', setAddr('line1'))}
              {row('line2', 'Address Line 2', addr.line2 || '', setAddr('line2'))}
              {row('city', 'City *', addr.city || '', setAddr('city'))}
              <div style={{ display: 'flex', gap: 8 }}>
                <div style={{ flex: 1 }}>{row('state', 'State *', addr.state || '', setAddr('state'))}</div>
                <div style={{ flex: 1 }}>{row('zip', 'ZIP Code *', addr.zip || '', setAddr('zip'))}</div>
              </div>
              {row('country', 'Country *', addr.country || 'United States', setAddr('country'))}
            </div>
          </section>
        )}

        {need.consent && (
          <div data-testid="qrcash-authorization">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.9375rem' }}>
              <ShieldCheck size={18} style={{ color: 'var(--primary-dark)' }} /> Payment for Auto-Gift
            </div>
            {cardProblem && <p role="alert" data-testid="card-problem" style={bad}>{cardProblem}</p>}
            {need.card ? (
              <>
                <p style={{ ...small, marginTop: 6 }}>Auto-Gift charges your card on the occasion date. To do that without you present, Greet-Me needs to save a card for future charges.</p>
                {withStripe
                  ? <CardField onReady={(fn) => { confirmRef.current = fn; }} onChange={setCardComplete} />
                  : <p role="alert" style={bad}>{ERROR_COPY['card-unavailable']}</p>}
              </>
            ) : (
              <div data-testid="card-on-file" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0.5rem 0', flexWrap: 'wrap' }}>
                <CreditCard size={18} />
                <b>{card && card.brand ? `${card.brand} ` : 'Card '}ending {card && card.last4 ? card.last4 : ''}{card && card.expMonth ? ` · expires ${String(card.expMonth).padStart(2, '0')}/${card.expYear}` : ''}</b>
                <span style={{ ...small, fontWeight: 700, padding: '2px 8px', borderRadius: 999, background: 'rgba(16,185,129,0.15)', color: '#065f46' }}>On file</span>
              </div>
            )}
            {items.map((it) => (
              <div key={it.key} data-testid={`consent-block-${it.key}`} style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 8 }}>
                {items.length > 1 && <div data-testid={`consent-heading-${it.key}`} style={{ fontWeight: 700, fontSize: '0.8125rem', marginBottom: 4 }}>{it.label}</div>}
                <div data-testid="consent-text" style={{ fontSize: '0.75rem', lineHeight: 1.5 }}>
                  {consentParagraphs(it).map((p, i) => <p key={i} style={{ margin: '0 0 6px' }}>{p}</p>)}
                </div>
                <label style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                  <input type="checkbox" data-testid="consent-checkbox" checked={!!consents[it.key]} onChange={(e) => { setConsents((c) => ({ ...c, [it.key]: e.target.checked })); setErrorKeys((x) => ({ ...x, [it.key]: undefined })); setSetupError(null); }} />
                  {CONSENT_TICK_LABEL}
                </label>
                <p style={{ ...small, marginTop: 2 }}>Wording version {SCHED_QRCASH_WORDING_VERSION} (sent with your confirmation).</p>
                {errorKeys[it.key] && <p role="alert" data-testid="auth-error" style={{ ...bad, fontWeight: 600 }}>{ERROR_COPY[errorKeys[it.key]]}</p>}
              </div>
            ))}
            {setupError && <p role="alert" data-testid="auth-error" style={{ ...bad, fontWeight: 600 }}>{ERROR_COPY[setupError]}</p>}
            <p style={{ ...small, marginTop: 6 }}><AlertTriangle size={12} style={{ verticalAlign: 'middle' }} /> Nothing is charged now. Saving a card only authorizes the charges described above.</p>
          </div>
        )}

        {submitError && <p role="alert" data-testid="save-modal-submit-error" style={{ ...bad, fontWeight: 600, marginTop: 8 }}>{submitError}</p>}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 14 }}>
          <button type="button" data-testid="save-modal-cancel" onClick={onCancel} disabled={busy} style={{ padding: '0.6rem 1rem', borderRadius: 10, border: '1px solid var(--border)', background: '#fff', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>Cancel</button>
          <button type="button" data-testid="save-modal-save" onClick={submit} disabled={busy} style={{ padding: '0.6rem 1.6rem', borderRadius: 10, border: 'none', background: 'var(--primary-dark)', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.7 : 1, fontFamily: 'inherit' }}>{busy ? 'Saving...' : 'SAVE'}</button>
        </div>
      </div>
    </>
  );
}

export default function SaveAuthorizationModal(props) {
  const needsCard = props.plan.need.card;
  if (needsCard && stripePromise) {
    return <Elements stripe={stripePromise}><Inner {...props} withStripe /></Elements>;
  }
  return <Inner {...props} withStripe={false} />;
}
