// src/components/providerCheckout/GiftBoxCheckoutModal.jsx
//
// The Greet-Me checkout for a GIFT BOX.
//
// GREET-ME IS THE MERCHANT OF RECORD HERE. Unlike ProviderCheckoutModal (flowers, where the provider
// tokenizes and charges the card itself), a gift box is charged on Greet-Me's OWN Stripe rail and the
// real order is then placed with the delivery partner SERVER-SIDE. So this modal never loads a
// provider tokenizer, never shows a provider-hosted page or link, and never names the partner.
//
// THE STRIPE INTEGRATION IS A CLONE, NOT A NEW ONE. Elements + CardElement + stripe.createPaymentMethod
// and the requiresAction -> stripe.confirmCardPayment(clientSecret) -> finalize sequence are exactly
// the ones QR Cash (GiftConfirmationModal.jsx + SendGreeting.jsx handleGiftConfirm) and the Smart Card
// (PrezzeeCardConfirmationModal.jsx + PrezzeeSmartCard.jsx) already ship.
//
// THE PRICE IS THE SERVER'S. The total shown comes from POST /api/gifts/gift-box/quote and nowhere
// else; the charge request only PROVES which figure the customer saw. If the server's own re-quote
// differs, nothing is charged and the customer is shown the new figure to confirm themselves — a
// different amount is never charged on their behalf without a new click.

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import GreetMeLogo from '../GreetMeLogo';
import api from '../../api/api';
import { stripePromise } from '../../stripe/stripeProvider';
import { EMAIL_UNCONFIRMED_MESSAGE } from '../../utils/sendGating';
import {
  GIFT_BOX_LIMITS, DEFAULT_QUOTE_VALID_MS, validateGiftBoxForm, toGiftBoxQuoteRequest, parseGiftBoxQuote,
  isGiftBoxQuoteExpired, giftBoxErrorCopy, PRE_CHARGE_CODES, OUTCOME_UNKNOWN_MESSAGE, PAID_NOT_FINALIZED_MESSAGE,
  PENDING_FALLBACK_MESSAGE, EMPTY_GIFT_BOX_FORM,
} from './giftBoxRules';

// The visual language of ProviderCheckoutModal.jsx, reused exactly.
const label = { display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-secondary, #475569)' };
const input = {
  width: '100%', padding: '0.5rem 0.65rem', borderRadius: '8px',
  border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg-primary, #fff)', fontSize: '0.95rem',
};
const row = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' };
const primaryButton = (enabled) => ({
  padding: '0.7rem 1rem', borderRadius: 10, border: 'none', fontWeight: 700, color: '#fff',
  background: enabled ? '#4F2D7F' : 'var(--border, #cbd5e1)', cursor: enabled ? 'pointer' : 'not-allowed',
});
const secondaryButton = {
  padding: '0.7rem 1rem', borderRadius: 10, border: '1px solid var(--border, #cbd5e1)',
  background: 'transparent', fontWeight: 600, cursor: 'pointer',
};
const errorText = { color: '#b91c1c' };

// The same CardElement options QR Cash and the Smart Card use.
const CARD_ELEMENT_OPTIONS = {
  hidePostalCode: true,
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#dc2626' },
  },
};

/** Backend limits, mirrored so the customer hears about them before a round trip. */
const fmt = (cents) => `$${(Number(cents) / 100).toFixed(2)}`;
const trimmed = (v) => (typeof v === 'string' ? v.trim() : '');
// The checkout's rules live in giftBoxRules.js (moved unchanged; shared with group gift boxes) and are re-exported.
const EMPTY_FORM = EMPTY_GIFT_BOX_FORM;
// Re-exported exactly as before the move, for existing importers.
export { GIFT_BOX_LIMITS, validateGiftBoxForm, toGiftBoxQuoteRequest, giftBoxErrorCopy };

function Shell({ children, onClose, showClose = true, closeDisabled = false }) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gift box checkout"
      data-testid="gift-box-checkout-modal"
      style={{
        position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(15,23,42,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
      }}
    >
      <div style={{
        width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: 'var(--bg-primary, #fff)',
        borderRadius: '16px', padding: '1.25rem', boxShadow: '0 20px 60px rgba(15,23,42,0.35)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <GreetMeLogo />
          {showClose && (
            <button
              type="button"
              onClick={onClose}
              disabled={closeDisabled}
              aria-label="Close checkout"
              data-testid="gift-box-checkout-close"
              style={{ padding: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', background: 'transparent', cursor: closeDisabled ? 'not-allowed' : 'pointer' }}
            >
              <X size={16} />
            </button>
          )}
        </div>
        {children}
      </div>
    </div>
  );
}

function GiftBoxCheckoutForm({
  onClose, product, contactId, sendDraftId, onAccepted, checkEntitlement,
}) {
  const stripe = useStripe();
  const elements = useElements();

  // ONE ATTEMPT ID PER PURCHASE ATTEMPT, minted when the checkout opens. It is the backend's Stripe
  // idempotency key, its frozen-snapshot id and the entitlement gate's giftAttemptId all at once, so
  // a retry of the SAME attempt can never become a second charge. Replaced only after an outcome that
  // is DEFINITIVELY not a charge (a decline, a refused request) — the QR Cash retry rule.
  const giftRequestId = useRef(crypto.randomUUID());

  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [errors, setErrors] = useState({});
  // 'details' -> 'review' -> 'processing' (paid, order still resolving) | 'done'
  const [step, setStep] = useState('details');
  // { display{product,S/H,tax,total}, quotedTotalCents (fee-inclusive), providerQuotedTotalCents, feeCents, quotedAt, validForMs, receivedAt }
  const [quote, setQuote] = useState(null);
  const [priceNotice, setPriceNotice] = useState(null);
  const [failure, setFailure] = useState(null);
  const [busy, setBusy] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  const [cardError, setCardError] = useState(null);
  // Paid (3DS succeeded or the server answered "pending") but not yet finalized. From here on the
  // ONLY permitted action is finalize — never another charge.
  const [paidPaymentIntentId, setPaidPaymentIntentId] = useState(null);
  // A failure whose charge outcome is unknown. Locks the pay control for the life of this checkout.
  const [outcomeUnknown, setOutcomeUnknown] = useState(false);
  const [outcome, setOutcome] = useState(null); // { fulfillmentStatus, message, gift }

  // The synchronous double-submit guard (PrezzeeCardConfirmationModal's submitLockRef rule).
  const submitting = useRef(false);
  // The accepted result is handed off EXACTLY ONCE (ProviderCheckoutModal's handedOff rule).
  const handedOff = useRef(false);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const quoteExpired = (q) => isGiftBoxQuoteExpired(q);

  /** Fetch a fresh authoritative price. Returns the new quote, or null (with failure copy set). */
  const fetchQuote = useCallback(async () => {
    let res;
    try {
      res = await api.quoteGiftBox(toGiftBoxQuoteRequest(form, product));
    } catch (err) {
      setFailure(giftBoxErrorCopy(err));
      return null;
    }
    // BOTH figures are required, and the server's four display lines must add up to the charge exactly; the rules
    // live in parseGiftBoxQuote (shared with group gift boxes) and fail closed.
    const parsed = parseGiftBoxQuote(res);
    if (!parsed.quote) {
      setFailure(parsed.failure);
      return null;
    }
    const next = parsed.quote;
    setQuote(next);
    return next;
  }, [form, product]);

  const onGetPrice = useCallback(async () => {
    const found = validateGiftBoxForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFailure(null);
    setPriceNotice(null);
    try {
      const q = await fetchQuote();
      if (q) setStep('review');
    } finally {
      setBusy(false);
    }
  }, [form, fetchQuote]);

  /** The one place a completed (paid) order becomes an outcome, and the one handoff. */
  const finishWith = useCallback((body) => {
    const gift = body?.gift || null;
    // Fail safe: anything other than an explicit "confirmed" is NOT a confirmed order.
    const fulfillmentStatus = body?.fulfillmentStatus === 'confirmed' ? 'confirmed'
      : (body?.fulfillmentStatus === 'failed' ? 'failed' : 'pending');
    const message = fulfillmentStatus === 'confirmed' ? null : (body?.error || PENDING_FALLBACK_MESSAGE);
    setPaidPaymentIntentId(null);
    setOutcome({ fulfillmentStatus, message, gift });
    setStep('done');
    if (typeof onAccepted === 'function' && !handedOff.current) {
      handedOff.current = true;
      onAccepted({
        status: fulfillmentStatus,
        fulfillmentStatus,
        giftType: 'gift_boxes',
        giftClaimToken: typeof gift?.claimToken === 'string' ? gift.claimToken : null,
        gift,
        message,
        giftRequestId: giftRequestId.current,
      });
    }
  }, [onAccepted]);

  /** Finalize an already-paid PaymentIntent. Never charges. */
  const finalizePaid = useCallback(async (paymentIntentId) => {
    let res;
    try {
      res = await api.finalizeGiftBox({ paymentIntentId });
    } catch {
      res = null;
    }
    if (res?.ok && res.pending) {
      setPaidPaymentIntentId(paymentIntentId);
      setFailure(null);
      setStep('processing');
      return;
    }
    if (res?.ok && res.gift) {
      finishWith(res);
      return;
    }
    // Paid but not finalized: keep the PaymentIntent; the next attempt re-finalizes only.
    setPaidPaymentIntentId(paymentIntentId);
    setFailure(PAID_NOT_FINALIZED_MESSAGE);
  }, [finishWith]);

  const onPayRef = useRef(null);

  const onPay = useCallback(async () => {
    if (submitting.current) return;
    if (outcomeUnknown || paidPaymentIntentId) return;
    if (!quote || !stripe || !elements || !cardComplete) return;
    submitting.current = true;
    setBusy(true);
    setFailure(null);
    setCardError(null);

    const release = () => { submitting.current = false; setBusy(false); };

    // A stale price is never submitted: the customer gets a fresh one to look at first.
    if (quoteExpired(quote)) {
      setQuote(null);
      setPriceNotice(null);
      setFailure('This price has expired. Please get an updated price.');
      setStep('details');
      release();
      return;
    }

    // TEAM 1 — gift/entitlement safety, EXACTLY as ProviderCheckoutModal runs it: before any
    // payment interaction at all. Silent when the sender has a send available; otherwise the
    // caller's caution modal pauses here until the sender resolves it.
    let giftOnlyToken = null;
    if (typeof checkEntitlement === 'function') {
      const gate = await checkEntitlement(giftRequestId.current);
      if (!gate.proceed) {
        release();
        return;
      }
      giftOnlyToken = gate.giftOnlyToken;
    }

    // The QR Cash card step, verbatim in shape.
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) { release(); return; }
    const { error: pmError, paymentMethod } = await stripe.createPaymentMethod({ type: 'card', card: cardElement });
    if (pmError) {
      setCardError(pmError.message);
      release();
      return;
    }

    const recipientBody = toGiftBoxQuoteRequest(form, product);
    if (trimmed(form.phone)) recipientBody.recipient.phone = trimmed(form.phone);
    const body = {
      ...recipientBody,
      // Passed through unchanged from the quote: the fee-inclusive charge and the fee-free partner price.
      quotedTotalCents: quote.quotedTotalCents,
      providerQuotedTotalCents: quote.providerQuotedTotalCents,
      quotedAt: quote.quotedAt,
      paymentMethodId: paymentMethod.id,
      giftRequestId: giftRequestId.current,
    };
    if (contactId) body.contactId = contactId;
    if (sendDraftId) body.sendDraftId = sendDraftId;
    if (giftOnlyToken) body.giftOnlyToken = giftOnlyToken;

    // Set only by the entitlement re-check below; the retry is started AFTER this attempt has
    // released its lock, so the two can never overlap.
    let retryAfterEntitlement = false;
    try {
      const res = await api.chargeGiftBox(body);

      if (res?.networkError) {
        // The request may or may not have reached the server.
        setOutcomeUnknown(true);
        setFailure(OUTCOME_UNKNOWN_MESSAGE);
        return;
      }

      if (res?.requiresAction && res.clientSecret) {
        // 3D Secure — the handleGiftConfirm shape.
        const { error: confirmError, paymentIntent } = await stripe.confirmCardPayment(res.clientSecret);
        if (confirmError || paymentIntent?.status !== 'succeeded') {
          setFailure(confirmError?.message || 'Payment was not completed after authentication.');
          // Not charged: a fresh key lets the next attempt through Stripe's idempotency rules.
          giftRequestId.current = crypto.randomUUID();
          return;
        }
        setPaidPaymentIntentId(res.paymentIntentId);
        await finalizePaid(res.paymentIntentId);
        return;
      }

      if (res?.ok && res.pending) {
        setPaidPaymentIntentId(res.paymentIntentId || null);
        setStep('processing');
        return;
      }

      if (res?.ok && res.gift) {
        finishWith(res);
        return;
      }

      // 401 / 404 resolve rather than throw (api.js) — nothing was charged.
      setFailure(res?.status === 401
        ? 'Your session has expired. Please sign in again.'
        : 'We couldn’t complete this purchase. Please try again.');
    } catch (err) {
      const code = err?.code;
      if (code === 'SEND_ENTITLEMENT_AT_RISK' && typeof checkEntitlement === 'function') {
        // The server's own gate refused before any charge. Re-run the SAME caution with a fresh
        // server answer, and retry once if the sender resolves it (ProviderCheckoutModal's rule).
        release();
        const retry = await checkEntitlement(giftRequestId.current);
        retryAfterEntitlement = Boolean(retry?.proceed);
        return;
      }
      if (code === 'gift_box_quote_changed') {
        // NOTHING WAS CHARGED. Show the customer the new figure and make paying it a new click.
        const previous = quote.quotedTotalCents;
        const fresh = await fetchQuote();
        if (fresh) {
          setFailure(null);
          setPriceNotice(`The price for this gift box changed from ${fmt(previous)} to ${fmt(fresh.quotedTotalCents)}. `
            + 'Please review the new total before paying.');
        } else {
          setQuote(null);
          setStep('details');
        }
        return;
      }
      if (code === 'gift_box_quote_expired') {
        setQuote(null);
        setPriceNotice(null);
        setFailure('This price has expired. Please get an updated price.');
        setStep('details');
        return;
      }
      if (err?.status === 402) {
        setFailure(err?.message || 'Your card was declined.');
        giftRequestId.current = crypto.randomUUID();
        return;
      }
      if (code === 'EMAIL_NOT_VERIFIED') {
        // LANE E3 — refused before any charge (403); the same confirm-your-email message as the
        // send preflight. The key is kept: nothing was created under it.
        setFailure(EMAIL_UNCONFIRMED_MESSAGE);
        return;
      }
      if (err?.status === 429) {
        setFailure(giftBoxErrorCopy({ code: 'RATE_LIMIT_GENERAL' }));
        return;
      }
      if (PRE_CHARGE_CODES.has(code)) {
        setFailure(giftBoxErrorCopy(err));
        giftRequestId.current = crypto.randomUUID();
        return;
      }
      // Anything else may have happened after the charge. Keep the key; refuse further attempts.
      setOutcomeUnknown(true);
      setFailure(OUTCOME_UNKNOWN_MESSAGE);
    } finally {
      release();
      // After the lock is released (a `return` above still passes through here).
      if (retryAfterEntitlement) onPayRef.current?.();
    }
  }, [
    quote, stripe, elements, cardComplete, outcomeUnknown, paidPaymentIntentId, form, product,
    contactId, sendDraftId, checkEntitlement, fetchQuote, finalizePaid, finishWith,
  ]);
  useEffect(() => { onPayRef.current = onPay; }, [onPay]);

  const onRetryFinalize = useCallback(async () => {
    if (!paidPaymentIntentId || submitting.current) return;
    submitting.current = true;
    setBusy(true);
    try {
      await finalizePaid(paidPaymentIntentId);
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }, [paidPaymentIntentId, finalizePaid]);

  const handleCardChange = useCallback((event) => {
    setCardComplete(Boolean(event?.complete));
    setCardError(event?.error ? event.error.message : null);
  }, []);

  const embeddedConfirmed = typeof onAccepted === 'function' && outcome?.fulfillmentStatus === 'confirmed';
  const payAllowed = Boolean(quote) && Boolean(stripe) && Boolean(elements) && cardComplete
    && !busy && !outcomeUnknown && !paidPaymentIntentId;
  const productName = product?.name || 'Gift box';
  const displayError = failure || cardError;

  return (
    <Shell onClose={onClose} showClose={!embeddedConfirmed} closeDisabled={busy}>
      {!embeddedConfirmed && step !== 'done' && (
        <>
          <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.25rem' }}>Send a gift box</h2>
          <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary, #475569)', fontSize: '0.9rem' }}>
            {step === 'details'
              ? 'Tell us where it’s going and we’ll get you the exact price, shipping included.'
              : 'Greet-Me charges your card and places the order for you.'}
          </p>
        </>
      )}

      {/* The product the customer already chose. */}
      {step !== 'done' && (
        <div data-testid="gift-box-product" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.75rem' }}>
          {product?.imageUrl && (
            <img src={product.imageUrl} alt="" width="56" height="56" style={{ borderRadius: 8, objectFit: 'cover' }} />
          )}
          <strong>{productName}</strong>
        </div>
      )}

      {displayError && step !== 'done' && (
        <p data-testid="gift-box-checkout-error" role="alert" style={{ background: '#fef2f2', color: '#991b1b', padding: '0.6rem 0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
          {displayError}
        </p>
      )}

      {step === 'details' && (
        <div data-testid="gift-box-checkout-details" style={{ display: 'grid', gap: '0.75rem' }}>
          <fieldset style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, padding: '0.75rem' }}>
            <legend style={{ fontSize: '0.8rem', fontWeight: 700 }}>Recipient</legend>
            <div style={row}>
              <div>
                <label style={label} htmlFor="gb-first">First name</label>
                <input id="gb-first" style={input} value={form.firstName} onChange={set('firstName')} />
                {errors.firstName && <small style={errorText}>{errors.firstName}</small>}
              </div>
              <div>
                <label style={label} htmlFor="gb-last">Last name (optional)</label>
                <input id="gb-last" style={input} value={form.lastName} onChange={set('lastName')} />
              </div>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <label style={label} htmlFor="gb-address1">Street address</label>
              <input id="gb-address1" autoComplete="shipping address-line1" style={input} value={form.address1} onChange={set('address1')} />
              {errors.address1 && <small style={errorText}>{errors.address1}</small>}
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <label style={label} htmlFor="gb-address2">Apartment, suite (optional)</label>
              <input id="gb-address2" autoComplete="shipping address-line2" style={input} value={form.address2} onChange={set('address2')} />
            </div>
            <div style={{ ...row, marginTop: '0.5rem', gridTemplateColumns: '2fr 1fr 1fr' }}>
              <div>
                <label style={label} htmlFor="gb-city">City</label>
                <input id="gb-city" style={input} value={form.city} onChange={set('city')} />
                {errors.city && <small style={errorText}>{errors.city}</small>}
              </div>
              <div>
                <label style={label} htmlFor="gb-state">State</label>
                <input id="gb-state" maxLength={2} style={input} value={form.state} onChange={set('state')} />
                {errors.state && <small style={errorText}>{errors.state}</small>}
              </div>
              <div>
                <label style={label} htmlFor="gb-zip">ZIP</label>
                <input id="gb-zip" style={input} value={form.postalCode} onChange={set('postalCode')} />
                {errors.postalCode && <small style={errorText}>{errors.postalCode}</small>}
              </div>
            </div>
            <div style={{ marginTop: '0.5rem' }}>
              <label style={label} htmlFor="gb-phone">Recipient telephone number (optional)</label>
              <input id="gb-phone" type="tel" inputMode="tel" autoComplete="off" placeholder="(201) 555-0123"
                style={input} value={form.phone} onChange={set('phone')} />
              <small style={{ color: 'var(--text-secondary, #64748b)' }}>
                The delivery partner may need to call about the delivery.
              </small>
            </div>
          </fieldset>

          {/* NO CARD MESSAGE FIELD (founder decision 2026-09-30): a message is not forwarded to the
              delivery partner, so asking for one would promise the customer something untrue. */}

          <div style={{ maxWidth: 140 }}>
            <label style={label} htmlFor="gb-quantity">Quantity</label>
            <input id="gb-quantity" type="number" min={1} max={GIFT_BOX_LIMITS.maxQuantity} step={1}
              style={input} value={form.quantity} onChange={set('quantity')} />
            {errors.quantity && <small style={errorText}>{errors.quantity}</small>}
          </div>

          <small style={{ color: 'var(--text-secondary, #64748b)' }}>Gift boxes ship to US addresses only.</small>

          <button type="button" data-testid="gift-box-get-price" disabled={busy} onClick={onGetPrice}
            style={primaryButton(!busy)}>
            {busy ? 'Getting your price…' : 'Get price'}
          </button>
        </div>
      )}

      {step === 'review' && quote && (
        <div data-testid="gift-box-checkout-review" style={{ display: 'grid', gap: '0.75rem' }}>
          <div data-testid="gift-box-summary" style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: 10, padding: '0.75rem' }}>
            <small style={{ color: 'var(--text-secondary, #64748b)' }}>
              {Number(form.quantity) > 1 ? `${form.quantity} × ` : ''}{productName} · to {trimmed(form.city)}, {trimmed(form.state).toUpperCase()}
            </small>
            {[['product', 'Product', quote.display.productCents], ['sh', 'S/H', quote.display.shippingHandlingCents], ['tax', 'Tax', quote.display.taxCents]].map(([k, l, c]) => (
              <div key={k} data-testid={`gift-box-line-${k}`} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                <span>{l}</span>
                <span>{fmt(c)}</span>
              </div>
            ))}
            <div data-testid="gift-box-total"
              style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginTop: '0.4rem' }}>
              <span>Total, shipping and tax included</span>
              <span>{fmt(quote.quotedTotalCents)}</span>
            </div>
          </div>

          {priceNotice && (
            <div data-testid="gift-box-price-changed"
              style={{ padding: '0.6rem', borderRadius: 8, background: '#fef3c7', border: '1px solid #f59e0b', fontSize: '0.9rem' }}>
              <strong style={{ display: 'block' }}>The price has changed</strong>
              {priceNotice}
            </div>
          )}

          <div>
            <label style={label} htmlFor="gb-card">Payment method</label>
            <div id="gb-card" style={{ padding: '0.75rem', border: '1px solid #d1d5db', borderRadius: '0.5rem', background: '#fff' }}>
              <CardElement options={CARD_ELEMENT_OPTIONS} onChange={handleCardChange} />
            </div>
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary, #6b7280)', lineHeight: 1.6, margin: 0 }}>
            By confirming, you authorize Greet-Me to charge the total shown for this gift box.
          </p>

          {paidPaymentIntentId ? (
            <button type="button" data-testid="gift-box-retry-finalize" disabled={busy} onClick={onRetryFinalize}
              style={primaryButton(!busy)}>
              {busy ? 'Finishing your order…' : 'Try again'}
            </button>
          ) : (
            <button type="button" data-testid="gift-box-pay" disabled={!payAllowed} onClick={onPay}
              style={primaryButton(payAllowed)}>
              {busy ? 'Charging…' : `Pay ${fmt(quote.quotedTotalCents)}`}
            </button>
          )}

          {!busy && !paidPaymentIntentId && !outcomeUnknown && (
            <button type="button" data-testid="gift-box-edit-details"
              onClick={() => { setQuote(null); setPriceNotice(null); setFailure(null); setStep('details'); }}
              style={secondaryButton}>
              Edit recipient details
            </button>
          )}
        </div>
      )}

      {/* PAID, ORDER STILL RESOLVING (202). Only finalize is offered — never a second charge. */}
      {step === 'processing' && (
        <div data-testid="gift-box-processing" style={{ display: 'grid', gap: '0.75rem' }}>
          <p style={{ margin: 0, padding: '0.6rem 0.75rem', borderRadius: 8, background: '#fffbeb', border: '1px solid #fcd34d', fontSize: '0.9rem' }}>
            {PENDING_FALLBACK_MESSAGE}
          </p>
          {paidPaymentIntentId && (
            <button type="button" data-testid="gift-box-check-again" disabled={busy} onClick={onRetryFinalize}
              style={primaryButton(!busy)}>
              {busy ? 'Checking…' : 'Check again'}
            </button>
          )}
          <button type="button" data-testid="gift-box-close-processing" onClick={onClose} style={secondaryButton}>
            Close
          </button>
        </div>
      )}

      {/* EMBEDDED AND CONFIRMED — a handoff, not a destination (ProviderCheckoutModal's rule). */}
      {step === 'done' && embeddedConfirmed && (
        <div data-testid="gift-box-handoff" style={{ display: 'grid', gap: '0.5rem', justifyItems: 'center', padding: '0.5rem 0' }}>
          <p style={{ margin: 0, fontWeight: 700, fontSize: '1rem' }}>Payment confirmed</p>
          <p style={{ margin: 0, color: 'var(--text-secondary, #64748b)' }}>Sending your Greet-Me&hellip;</p>
        </div>
      )}

      {step === 'done' && !embeddedConfirmed && outcome && (
        <div data-testid="gift-box-confirmation" style={{ display: 'grid', gap: '0.75rem' }}>
          {outcome.fulfillmentStatus === 'confirmed' ? (
            <>
              <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Your gift box is ordered</h2>
              {Number.isFinite(Number(outcome.gift?.totalCents)) && outcome.gift?.totalCents != null && (
                <p style={{ margin: 0, color: 'var(--text-secondary, #475569)' }}>
                  Charged <span data-testid="gift-box-charged">{fmt(outcome.gift.totalCents)}</span> by Greet-Me.
                </p>
              )}
            </>
          ) : (
            <>
              <h2 style={{ fontSize: '1.15rem', margin: 0 }}>Payment received</h2>
              <p data-testid="gift-box-fulfillment-message"
                style={{ margin: 0, padding: '0.6rem 0.75rem', borderRadius: 8, background: '#fffbeb', border: '1px solid #fcd34d', fontSize: '0.9rem' }}>
                {outcome.message}
              </p>
            </>
          )}
          <button type="button" data-testid="gift-box-done" onClick={onClose} style={primaryButton(true)}>
            Done
          </button>
        </div>
      )}
    </Shell>
  );
}

/**
 * Props:
 *   isOpen, onClose
 *   product          — the already-chosen catalog product ({ providerProductId, name, imageUrl, ... })
 *   customer         — accepted for parity with ProviderCheckoutModal and deliberately unused: the
 *                      backend reads the sender's email from the authenticated session, never the body
 *   contactId        — the greeting's recipient, when this purchase is a step inside a send
 *   sendDraftId      — the send draft, when attached to one
 *   onAccepted       — called ONCE with { status, fulfillmentStatus, giftType, giftClaimToken, gift,
 *                      message, giftRequestId } whenever the server returns a PAID order (confirmed,
 *                      pending or failed fulfilment). Never called for a decline, a refused request,
 *                      a price change, or a still-resolving (202) payment with no gift record yet.
 *   checkEntitlement — `(attemptId) => Promise<{ proceed, giftOnlyToken }>`, run before any charge.
 */
export default function GiftBoxCheckoutModal({
  isOpen, onClose, product, contactId = null, sendDraftId = null,
  onAccepted = null, checkEntitlement = null,
}) {
  if (!isOpen) return null;

  // The GiftConfirmationModal rule: no key, no payment form — said plainly.
  if (!stripePromise) {
    return (
      <Shell onClose={onClose}>
        <p data-testid="gift-box-stripe-missing" style={{ margin: 0, color: '#92400e' }}>
          Payment is not configured. Please contact support.
        </p>
      </Shell>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <GiftBoxCheckoutForm
        onClose={onClose}
        product={product}
        contactId={contactId}
        sendDraftId={sendDraftId}
        onAccepted={onAccepted}
        checkEntitlement={checkEntitlement}
      />
    </Elements>
  );
}
