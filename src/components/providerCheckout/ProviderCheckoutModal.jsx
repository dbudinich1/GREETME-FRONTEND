// src/components/providerCheckout/ProviderCheckoutModal.jsx
//
// The Greet-Me-branded checkout step for a provider-fulfilled gift.
//
// THE CUSTOMER NEVER LEAVES GREET-ME. There is no vendor storefront, no hosted payment page and no
// redirect of any kind: this modal opens over /dashboard/gifts and the customer stays on that route
// from the first field to the confirmation.
//
// THE CARD NEVER REACHES GREET-ME. The payment fields are handed to the provider's own tokenizer,
// loaded from the URL the provider returned, and only the resulting ONE-TIME TOKEN is posted to our
// backend. The fields are cleared the moment tokenization finishes, whichever way it went.
//
// GREET-ME CHARGES NOTHING HERE. The provider is the merchant of record for its own goods; the
// total shown is the provider's own quote, and no Greet-Me payment object exists for it.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import GreetMeLogo from '../GreetMeLogo';
import {
  CHECKOUT_STATUS, FIELD_LIMITS, canRetry, formatMinor, providerDisplayName, reviewQuote,
  statusCopy, toPrepareRequest, validateCheckoutForm,
} from './providerCheckoutModel';
import { clearCardFields, loadTokenizer, tokenizeCard } from './acceptJsLoader';
import {
  fetchProviderProducts, fetchTokenizationConfig, prepareCheckout, submitCheckout,
} from '../../api/providerCheckout';

const EMPTY_CARD = { cardNumber: '', expMonth: '', expYear: '', cvv: '', postalCode: '' };

const label = { display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.25rem', color: 'var(--text-secondary, #475569)' };
const input = {
  width: '100%', padding: '0.5rem 0.65rem', borderRadius: '8px',
  border: '1px solid var(--border, #cbd5e1)', background: 'var(--bg-primary, #fff)', fontSize: '0.95rem',
};
const row = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' };

export default function ProviderCheckoutModal({ isOpen, onClose, giftType, product, customer }) {
  // A caller that already knows the product (the marketplace, later) starts at the details step.
  // With no product in hand the customer picks one first, from the PROVIDER's live list.
  const [chosen, setChosen] = useState(product ?? null);
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [step, setStep] = useState(product ? 'details' : 'product');
  const [form, setForm] = useState({
    deliveryDate: '', recipientFirstName: '', recipientLastName: '',
    address1: '', address2: '', city: '', state: '', postalCode: '', recipientPhone: '',
    cardMessage: '', specialInstructions: '', allowSubstitutions: false,
    billingLine1: '', billingLine2: '', billingCity: '', billingState: '', billingZip: '',
    customerFirstName: customer?.firstName || '', customerLastName: customer?.lastName || '',
    customerEmail: customer?.email || '', customerPhone: '',
  });
  const [card, setCard] = useState({ ...EMPTY_CARD });
  const [errors, setErrors] = useState({});
  const [prepared, setPrepared] = useState(null);
  const [tokenization, setTokenization] = useState(null);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  // Set only by an express click on the price-changed notice; reset whenever the quote changes.
  const [priceAcknowledged, setPriceAcknowledged] = useState(false);
  // 'idle' | 'loading' | 'ready' | 'failed' — the tokenizer's PROVEN state, never assumed.
  const [tokenizerState, setTokenizerState] = useState('idle');
  const [failure, setFailure] = useState(null);
  // One submission per prepared attempt, enforced in the browser as well as in the backend: the
  // provider has no idempotency key, so a double-click must never become a second order.
  const submitting = useRef(false);

  const provider = prepared?.provider ?? result?.checkout?.provider ?? null;
  const copy = useMemo(
    () => statusCopy(result?.status ?? (prepared ? CHECKOUT_STATUS.PREPARING : CHECKOUT_STATUS.PREPARING), { provider, giftType }),
    [result, prepared, provider, giftType],
  );

  // Card fields never outlive the modal.
  useEffect(() => { if (!isOpen) { setCard({ ...EMPTY_CARD }); } }, [isOpen]);

  // The live product list, loaded once the customer has deliberately opened the checkout. The
  // backend is founder-gated, so for anyone else this resolves empty and the picker offers nothing.
  useEffect(() => {
    if (!isOpen || step !== 'product' || !giftType) return undefined;
    let cancelled = false;
    setLoadingProducts(true);
    (async () => {
      try {
        const live = await fetchProviderProducts(giftType);
        if (!cancelled) setProducts(live);
      } catch {
        if (!cancelled) setProducts([]);
      } finally {
        if (!cancelled) setLoadingProducts(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isOpen, step, giftType]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const onPrepare = useCallback(async () => {
    const found = validateCheckoutForm(form);
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFailure(null);
    try {
      const res = await prepareCheckout(toPrepareRequest(form, { giftType, product: chosen }));
      if (!res?.ok) {
        setFailure(res?.error || 'We could not price this order. Please check the delivery details.');
        return;
      }
      setPrepared(res);
      // Fetched only now: the customer has deliberately reached the payment step, and the key
      // material is ephemeral by the provider's own instruction.
      const config = await fetchTokenizationConfig({ giftType, region: res.region });
      if (!config?.ok) {
        setFailure('The payment form is unavailable right now. Please try again shortly.');
        return;
      }
      setTokenization(config.tokenization);
      setStep('payment');
    } catch (err) {
      setFailure(err?.message || 'We could not price this order.');
    } finally {
      setBusy(false);
    }
  }, [form, giftType, chosen]);

  // PRELOAD. The tokenizer starts loading the moment the payment step is reached and a valid
  // configuration exists — not when Place Order is clicked. The library fetches its own core after
  // installing its global, and doing that at click time is what produced "Accept.js is not loaded
  // correctly" in production. Here it happens while the customer is still typing.
  useEffect(() => {
    if (step !== 'payment' || !tokenization) return undefined;
    let cancelled = false;
    setTokenizerState('loading');
    loadTokenizer(tokenization).then(
      () => { if (!cancelled) setTokenizerState('ready'); },
      () => { if (!cancelled) setTokenizerState('failed'); },
    );
    return () => { cancelled = true; };
  }, [step, tokenization]);

  // The authoritative review, derived only from the backend's quote. Recomputed when the quote or
  // the chosen product changes, so an acknowledgement can never carry over to a different price.
  const review = useMemo(() => reviewQuote({ prepared, chosen, form }), [prepared, chosen, form]);
  useEffect(() => { setPriceAcknowledged(false); }, [prepared?.quote?.quoteVersion]);
  const cardFilled = Boolean(
    String(card.cardNumber).trim() && String(card.expMonth).trim()
    && String(card.expYear).trim() && String(card.cvv).trim(),
  );
  const quoteAccepted = review.ok && (review.canSubmit || priceAcknowledged);
  // Four independent conditions, each provable on its own: the quote is valid and acknowledged, the
  // tokenizer is PROVEN ready, the card fields carry input, and nothing is already in flight.
  const payAllowed = quoteAccepted && tokenizerState === 'ready' && cardFilled && !busy;

  const onPay = useCallback(async () => {
    // Belt as well as braces: the button is disabled, and the handler refuses anyway. A review that
    // does not reconcile must not be payable through any path, including a synthetic click.
    if (!payAllowed) return;
    if (submitting.current) return;
    submitting.current = true;
    setBusy(true);
    setFailure(null);
    try {
      // 1. The card goes to the PROVIDER's tokenizer, in this browser.
      const { token, issuedAt } = await tokenizeCard(card, tokenization);
      // 2. Cleared immediately on success — the number is not needed again and must not linger.
      clearCardFields(setCard);
      // 3. Only the one-time token crosses to Greet-Me.
      const res = await submitCheckout({
        attemptId: prepared.attemptId,
        giftType,
        paymentToken: token,
        paymentBinding: { issuedAt, fingerprint: tokenization?.tokenizationKeyFingerprint, rail: tokenization?.rail },
      });
      setResult(res);
      setStep('confirmation');
    } catch (err) {
      // Terminal failure: the fields are cleared here too, so a decline never leaves a card number
      // sitting in a form the browser might restore.
      clearCardFields(setCard);
      setFailure(err?.message || 'Your card could not be verified.');
      submitting.current = false;
    } finally {
      setBusy(false);
    }
  }, [card, tokenization, prepared, giftType, payAllowed]);

  if (!isOpen) return null;

  const who = providerDisplayName(provider);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Gift checkout"
      data-testid="provider-checkout-modal"
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
          <button
            type="button"
            onClick={onClose}
            aria-label="Close checkout"
            style={{ padding: 0, width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border, #e2e8f0)', background: 'transparent', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
        </div>

        <h2 style={{ fontSize: '1.15rem', margin: '0 0 0.25rem' }}>{copy.title}</h2>
        <p style={{ margin: '0 0 1rem', color: 'var(--text-secondary, #475569)', fontSize: '0.9rem' }}>{copy.body}</p>

        {failure && (
          <p data-testid="provider-checkout-error" role="alert" style={{ background: '#fef2f2', color: '#991b1b', padding: '0.6rem 0.75rem', borderRadius: 8, fontSize: '0.9rem' }}>
            {failure}
          </p>
        )}

        {step === 'product' && (
          <div data-testid="provider-checkout-picker" style={{ display: 'grid', gap: '0.75rem' }}>
            {loadingProducts && <p style={{ margin: 0 }}>Loading the live selection…</p>}
            {!loadingProducts && products.length === 0 && (
              <p data-testid="provider-checkout-picker-empty" style={{ margin: 0, color: 'var(--text-secondary, #64748b)' }}>
                No products are available to you right now.
              </p>
            )}
            {products.map((p) => {
              const selected = chosen?.providerProductId === p.providerProductId;
              return (
                <button
                  key={p.providerProductId}
                  type="button"
                  data-testid={`provider-product-${p.providerProductId}`}
                  onClick={() => setChosen(p)}
                  style={{
                    display: 'grid', gridTemplateColumns: p.imageUrl ? '72px 1fr auto' : '1fr auto',
                    gap: '0.75rem', alignItems: 'center', textAlign: 'left', cursor: 'pointer',
                    padding: '0.6rem', borderRadius: 10, background: 'var(--bg-primary, #fff)',
                    border: selected ? '2px solid #4F2D7F' : '1px solid var(--border, #e2e8f0)',
                  }}
                >
                  {p.imageUrl && <img src={p.imageUrl} alt="" width="72" height="72" style={{ borderRadius: 8, objectFit: 'cover' }} />}
                  <span>
                    <strong style={{ display: 'block' }}>{p.name}</strong>
                    <small style={{ color: 'var(--text-secondary, #64748b)' }}>{p.providerProductId}</small>
                  </span>
                  {/* The provider's own price, displayed exactly as received. It is never an input:
                      the amount charged comes from the provider's quote at the next step. */}
                  <span data-testid={`provider-price-${p.providerProductId}`} style={{ fontWeight: 700 }}>
                    {formatMinor(p.priceMinor, p.currency)}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              data-testid="provider-checkout-choose"
              disabled={!chosen}
              onClick={() => setStep('details')}
              style={{
                padding: '0.7rem 1rem', borderRadius: 10, border: 'none', fontWeight: 700,
                background: chosen ? '#4F2D7F' : 'var(--border, #cbd5e1)',
                color: '#fff', cursor: chosen ? 'pointer' : 'not-allowed',
              }}
            >
              Continue with this arrangement
            </button>
          </div>
        )}

        {step === 'details' && (
          <div data-testid="provider-checkout-details" style={{ display: 'grid', gap: '0.75rem' }}>
            <div>
              <label style={label} htmlFor="pc-delivery-date">Delivery date</label>
              <input id="pc-delivery-date" type="date" style={input} value={form.deliveryDate} onChange={set('deliveryDate')} />
              {errors.deliveryDate && <small style={{ color: '#b91c1c' }}>{errors.deliveryDate}</small>}
            </div>

            <fieldset style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, padding: '0.75rem' }}>
              <legend style={{ fontSize: '0.8rem', fontWeight: 700 }}>Recipient</legend>
              <div style={row}>
                <div>
                  <label style={label} htmlFor="pc-first">First name</label>
                  <input id="pc-first" style={input} value={form.recipientFirstName} onChange={set('recipientFirstName')} />
                  {errors.recipientFirstName && <small style={{ color: '#b91c1c' }}>{errors.recipientFirstName}</small>}
                </div>
                <div>
                  <label style={label} htmlFor="pc-last">Last name (optional)</label>
                  <input id="pc-last" style={input} value={form.recipientLastName} onChange={set('recipientLastName')} />
                </div>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <label style={label} htmlFor="pc-address1">Street address</label>
                <input id="pc-address1" style={input} value={form.address1} onChange={set('address1')} />
                {errors.address1 && <small style={{ color: '#b91c1c' }}>{errors.address1}</small>}
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <label style={label} htmlFor="pc-address2">Apartment, suite (optional)</label>
                <input id="pc-address2" style={input} value={form.address2} onChange={set('address2')} />
              </div>
              <div style={{ ...row, marginTop: '0.5rem', gridTemplateColumns: '2fr 1fr 1fr' }}>
                <div>
                  <label style={label} htmlFor="pc-city">City</label>
                  <input id="pc-city" style={input} value={form.city} onChange={set('city')} />
                  {errors.city && <small style={{ color: '#b91c1c' }}>{errors.city}</small>}
                </div>
                <div>
                  <label style={label} htmlFor="pc-state">State</label>
                  <input id="pc-state" style={input} value={form.state} onChange={set('state')} />
                  {errors.state && <small style={{ color: '#b91c1c' }}>{errors.state}</small>}
                </div>
                <div>
                  <label style={label} htmlFor="pc-zip">ZIP</label>
                  <input id="pc-zip" style={input} value={form.postalCode} onChange={set('postalCode')} />
                  {errors.postalCode && <small style={{ color: '#b91c1c' }}>{errors.postalCode}</small>}
                </div>
              </div>

              {/* REQUIRED BY THE PROVIDER, and it is the RECIPIENT's — the florist calls this number
                  about the delivery. The sender's telephone is a separate field and is never
                  substituted for it. It is not shown on the review screen. */}
              <div style={{ marginTop: '0.5rem' }}>
                <label style={label} htmlFor="pc-recipient-phone">Recipient telephone number</label>
                <input id="pc-recipient-phone" type="tel" inputMode="tel" autoComplete="off"
                  placeholder="(201) 555-0123" style={input}
                  value={form.recipientPhone} onChange={set('recipientPhone')} />
                {errors.recipientPhone
                  ? <small style={{ color: '#b91c1c' }}>{errors.recipientPhone}</small>
                  : <small style={{ color: 'var(--text-secondary, #64748b)' }}>
                      The florist may need to call about the delivery.
                    </small>}
              </div>
            </fieldset>

            <div>
              <label style={label} htmlFor="pc-message">Card message</label>
              <textarea id="pc-message" rows={3} maxLength={FIELD_LIMITS.cardMessage} style={{ ...input, resize: 'vertical' }}
                value={form.cardMessage} onChange={set('cardMessage')} />
              {errors.cardMessage && <small style={{ color: '#b91c1c' }}>{errors.cardMessage}</small>}
            </div>

            <div>
              <label style={label} htmlFor="pc-instructions">Special instructions (optional)</label>
              <input id="pc-instructions" maxLength={FIELD_LIMITS.specialInstructions} style={input}
                value={form.specialInstructions} onChange={set('specialInstructions')} />
              {errors.specialInstructions && <small style={{ color: '#b91c1c' }}>{errors.specialInstructions}</small>}
            </div>

            <fieldset style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, padding: '0.75rem' }}>
              <legend style={{ fontSize: '0.8rem', fontWeight: 700 }}>Your details</legend>
              <div style={row}>
                <div>
                  <label style={label} htmlFor="pc-cust-first">First name</label>
                  <input id="pc-cust-first" style={input} value={form.customerFirstName} onChange={set('customerFirstName')} />
                  {errors.customerFirstName && <small style={{ color: '#b91c1c' }}>{errors.customerFirstName}</small>}
                </div>
                <div>
                  <label style={label} htmlFor="pc-cust-last">Last name</label>
                  <input id="pc-cust-last" style={input} value={form.customerLastName} onChange={set('customerLastName')} />
                </div>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <label style={label} htmlFor="pc-cust-email">Email</label>
                <input id="pc-cust-email" type="email" style={input} value={form.customerEmail} onChange={set('customerEmail')} />
                {errors.customerEmail && <small style={{ color: '#b91c1c' }}>{errors.customerEmail}</small>}
                <small style={{ color: 'var(--text-secondary, #64748b)' }}>
                  {who} may contact you directly about substitutions, so use an address you read.
                </small>
              </div>
            </fieldset>

            <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem' }}>
              <input type="checkbox" checked={form.allowSubstitutions}
                onChange={(e) => setForm((f) => ({ ...f, allowSubstitutions: e.target.checked }))} />
              Allow the florist to substitute flowers of equal or greater value
            </label>

            {/* BILLING — the cardholder's own details, required by the provider for the charge.
                Self-contained and dependency-free (form, errors, set) so it can move into the
                existing Add Gift flow later without being rewritten. It is NOT a second recipient
                form: the recipient's name, address and telephone are collected once, above. */}
            <fieldset data-testid="provider-checkout-billing"
              style={{ border: '1px solid var(--border, #e2e8f0)', borderRadius: 10, padding: '0.75rem', margin: 0 }}>
              <legend style={{ ...label, marginBottom: 0, padding: '0 0.35rem' }}>Your billing details</legend>
              <small style={{ display: 'block', color: 'var(--text-secondary, #64748b)', marginBottom: '0.5rem' }}>
                The address and telephone number on your card statement — not the delivery address.
              </small>
              <div>
                <label style={label} htmlFor="pc-billing-line1">Street address</label>
                <input id="pc-billing-line1" autoComplete="billing address-line1" style={input}
                  value={form.billingLine1} onChange={set('billingLine1')} />
                {errors.billingLine1 && <small style={{ color: '#b91c1c' }}>{errors.billingLine1}</small>}
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <label style={label} htmlFor="pc-billing-line2">Apartment, suite (optional)</label>
                <input id="pc-billing-line2" autoComplete="billing address-line2" style={input}
                  value={form.billingLine2} onChange={set('billingLine2')} />
              </div>
              <div style={{ ...row, marginTop: '0.5rem', gridTemplateColumns: '2fr 1fr 1fr' }}>
                <div>
                  <label style={label} htmlFor="pc-billing-city">City</label>
                  <input id="pc-billing-city" autoComplete="billing address-level2" style={input}
                    value={form.billingCity} onChange={set('billingCity')} />
                  {errors.billingCity && <small style={{ color: '#b91c1c' }}>{errors.billingCity}</small>}
                </div>
                <div>
                  <label style={label} htmlFor="pc-billing-state">State</label>
                  <input id="pc-billing-state" autoComplete="billing address-level1" maxLength={2} style={input}
                    value={form.billingState} onChange={set('billingState')} />
                  {errors.billingState && <small style={{ color: '#b91c1c' }}>{errors.billingState}</small>}
                </div>
                <div>
                  <label style={label} htmlFor="pc-billing-zip">ZIP</label>
                  <input id="pc-billing-zip" autoComplete="billing postal-code" style={input}
                    value={form.billingZip} onChange={set('billingZip')} />
                  {errors.billingZip && <small style={{ color: '#b91c1c' }}>{errors.billingZip}</small>}
                </div>
              </div>
              <div style={{ marginTop: '0.5rem' }}>
                <label style={label} htmlFor="pc-cust-phone">Your telephone number</label>
                <input id="pc-cust-phone" type="tel" inputMode="tel" autoComplete="billing tel" style={input}
                  placeholder="(201) 555-0123"
                  value={form.customerPhone} onChange={set('customerPhone')} />
                {errors.customerPhone && <small style={{ color: '#b91c1c' }}>{errors.customerPhone}</small>}
              </div>
            </fieldset>

            <button type="button" data-testid="provider-checkout-continue" disabled={busy} onClick={onPrepare}
              style={{ padding: '0.7rem 1rem', borderRadius: 10, border: 'none', background: '#4F2D7F', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              {busy ? 'Pricing your order…' : 'Continue to payment'}
            </button>
          </div>

        )}

        {step === 'payment' && prepared && (
          <div data-testid="provider-checkout-payment" style={{ display: 'grid', gap: '0.75rem' }}>
            {/* The authoritative summary: the provider's own quote, shown exactly as quoted. */}
            <div data-testid="provider-checkout-summary" style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: 10, padding: '0.75rem' }}>
              {!review.ok && (
                <p data-testid="provider-checkout-quote-unavailable" style={{ margin: 0, fontWeight: 600, color: '#b91c1c' }}>
                  We could not display a complete price for this order, so it cannot be paid for here.
                  Please start again or contact support.
                </p>
              )}

              {review.ok && (
                <>
                  <div data-testid="provider-checkout-review-item" style={{ marginBottom: '0.5rem' }}>
                    <strong style={{ display: 'block' }}>{review.productName}</strong>
                    <small style={{ color: 'var(--text-secondary, #64748b)' }}>
                      Item <span data-testid="provider-checkout-review-code">{review.productCode}</span>
                      {review.recipientCityState ? <> · to <span data-testid="provider-checkout-review-city">{review.recipientCityState}</span></> : null}
                      {review.deliveryDate ? <> · delivery <span data-testid="provider-checkout-review-date">{review.deliveryDate}</span></> : null}
                    </small>
                  </div>

                  {review.lines.map((line) => (
                    <div key={line.key} data-testid={`provider-checkout-line-${line.key}`}
                      style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.92rem', padding: '0.15rem 0' }}>
                      <span>{line.label}</span>
                      <span>{formatMinor(line.minor, review.currency)}</span>
                    </div>
                  ))}

                  <div data-testid="provider-checkout-line-total"
                    style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid var(--border, #e2e8f0)', marginTop: '0.4rem', paddingTop: '0.4rem' }}>
                    <span>Total charged by {who}</span>
                    <span>{formatMinor(review.totalMinor, review.currency)}</span>
                  </div>

                  <small style={{ color: 'var(--text-secondary, #64748b)' }}>
                    {who} charges this amount directly; Greet-Me does not add a charge for it.
                  </small>

                  {review.priceChanged && (
                    <div data-testid="provider-checkout-price-changed"
                      style={{ marginTop: '0.6rem', padding: '0.6rem', borderRadius: 8, background: '#fef3c7', border: '1px solid #f59e0b' }}>
                      <strong style={{ display: 'block' }}>The price has changed</strong>
                      <small>
                        This arrangement was listed at {formatMinor(review.priceChanged.catalogMinor, review.currency)} and
                        {' '}{who} has now quoted {formatMinor(review.priceChanged.quotedMinor, review.currency)} for it.
                        The quoted price is the one that will be charged.
                      </small>
                      <button type="button" data-testid="provider-checkout-accept-price"
                        onClick={() => setPriceAcknowledged(true)}
                        style={{ marginTop: '0.5rem', padding: '0.45rem 0.8rem', borderRadius: 8, border: 'none', background: '#b45309', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
                        I understand the new price
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>

            <div>
              <label style={label} htmlFor="pc-card">Card number</label>
              <input id="pc-card" inputMode="numeric" autoComplete="cc-number" style={input}
                value={card.cardNumber} onChange={(e) => setCard((c) => ({ ...c, cardNumber: e.target.value }))} />
            </div>
            <div style={{ ...row, gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div>
                <label style={label} htmlFor="pc-exp-month">Month</label>
                <input id="pc-exp-month" inputMode="numeric" autoComplete="cc-exp-month" style={input}
                  value={card.expMonth} onChange={(e) => setCard((c) => ({ ...c, expMonth: e.target.value }))} />
              </div>
              <div>
                <label style={label} htmlFor="pc-exp-year">Year</label>
                <input id="pc-exp-year" inputMode="numeric" autoComplete="cc-exp-year" style={input}
                  value={card.expYear} onChange={(e) => setCard((c) => ({ ...c, expYear: e.target.value }))} />
              </div>
              <div>
                <label style={label} htmlFor="pc-cvv">Security code</label>
                <input id="pc-cvv" inputMode="numeric" autoComplete="cc-csc" style={input}
                  value={card.cvv} onChange={(e) => setCard((c) => ({ ...c, cvv: e.target.value }))} />
              </div>
            </div>

            <small style={{ color: 'var(--text-secondary, #64748b)' }}>
              Your card details go straight to {who}&apos;s payment processor from this page. Greet-Me never receives them.
            </small>

            {tokenizerState === 'loading' && (
              <p data-testid="provider-checkout-securing" style={{ margin: 0, color: 'var(--text-secondary, #64748b)' }}>
                Securing payment form…
              </p>
            )}
            {tokenizerState === 'failed' && (
              <p data-testid="provider-checkout-tokenizer-failed" style={{ margin: 0, fontWeight: 600, color: '#b91c1c' }}>
                The payment form could not be prepared. Please reload the page and try again.
              </p>
            )}

            {/* Fail closed. A review that does not reconcile, a price that moved and has not been
                acknowledged, a tokenizer that is not PROVEN ready, an empty card form, or a
                submission already in flight — any one of them disables the ONLY control that can
                tokenize a card or place an order. */}
            <button type="button" data-testid="provider-checkout-pay"
              disabled={busy || !payAllowed} onClick={onPay}
              style={{
                padding: '0.7rem 1rem', borderRadius: 10, border: 'none', fontWeight: 700, color: '#fff',
                background: payAllowed ? '#4F2D7F' : 'var(--border, #cbd5e1)',
                cursor: payAllowed ? 'pointer' : 'not-allowed',
              }}>
              {busy ? 'Sending your order…' : `Place order with ${who}`}
            </button>
          </div>
        )}

        {step === 'confirmation' && (
          <div data-testid="provider-checkout-confirmation" style={{ display: 'grid', gap: '0.75rem' }}>
            {result?.providerOrderId && (
              <div style={{ background: 'var(--bg-secondary, #f8fafc)', borderRadius: 10, padding: '0.75rem' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary, #64748b)' }}>{who} order number</div>
                <div data-testid="provider-order-number" style={{ fontSize: '1.1rem', fontWeight: 700, letterSpacing: '0.02em' }}>
                  {result.providerOrderId}
                </div>
              </div>
            )}
            {copy.note && <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-secondary, #64748b)' }}>{copy.note}</p>}

            {canRetry(result) && (
              <button type="button" data-testid="provider-checkout-retry"
                onClick={() => { submitting.current = false; setResult(null); setStep('details'); }}
                style={{ padding: '0.7rem 1rem', borderRadius: 10, border: '1px solid var(--border, #cbd5e1)', background: 'transparent', fontWeight: 600, cursor: 'pointer' }}>
                Edit the order and try again
              </button>
            )}

            <button type="button" data-testid="provider-checkout-done" onClick={onClose}
              style={{ padding: '0.7rem 1rem', borderRadius: 10, border: 'none', background: '#4F2D7F', color: '#fff', fontWeight: 700, cursor: 'pointer' }}>
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
