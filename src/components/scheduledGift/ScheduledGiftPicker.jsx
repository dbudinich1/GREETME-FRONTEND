// src/components/scheduledGift/ScheduledGiftPicker.jsx
//
// Choose the ACTUAL gift for a scheduled occasion (Report 117 rev 3, U1; Team 6 contract v1): a gift box or a
// Branded Goods item, its option and quantity, where it is delivered, and the most the sender authorises on
// the occasion date. Built from the existing pieces — the Gift Place catalogue hook and product cards, the Branded
// Goods catalogue, the gift-box address rules and the gift-box quote (which writes nothing and charges nothing), the
// saved-card status and the scheduler's own card step. NOTHING is charged or ordered here: the selection is saved
// on the recipient's occasion, and on the occasion date the server checks availability and the full total first.
// Shown only while SCHEDULED_PHYSICAL_GIFT_AVAILABLE is true (the caller gates it).
import { useEffect, useState } from 'react';
import Modal from '../Modal';
import api from '../../api/api';
import { useProviderCatalogue } from '../giftPlace/useProviderCatalogue';
import { GiftProductGrid } from '../giftPlace/GiftProductCard';
import { fromCatalogProduct, fromProviderProduct, projectGiftCards } from '../../pages/giftPlaceViewModel';
import { toGiftBoxQuoteRequest, parseGiftBoxQuote, giftBoxErrorCopy } from '../providerCheckout/giftBoxRules';
import SaveAuthorizationModal from '../w07Auth/SaveAuthorizationModal';
import { centsToDollarString } from '../../utils/qrCashAmount';
import {
  deliveryFromContact, missingDelivery, buildScheduledGiftSetting, scheduledGiftProblems, scheduledGiftConsentText,
  GIFT_BOX_MAX_QUANTITY, MAX_TOTAL_CENTS_LIMIT,
} from '../../utils/scheduledPhysicalGift';

const FIELD_LABELS = { firstName: 'First name', lastName: 'Last name', address1: 'Street address', address2: 'Apt, suite (optional)', city: 'City', state: 'State (2 letters)', postalCode: 'ZIP code' };
const card = (s) => s && s.present === true && s.expired !== true;
const box = { border: '1px solid var(--border)', borderRadius: 14, padding: '0.9rem 1rem', marginTop: 12, background: '#fff' };
const h = { fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 6px' };
const sub = { fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '2px 0 0', lineHeight: 1.5 };
const input = { width: '100%', padding: '0.5rem 0.65rem', border: '1px solid var(--border)', borderRadius: 10, fontSize: '0.875rem', boxSizing: 'border-box', background: '#fff' };
const missingInput = { ...input, border: '1px solid #d97706', background: '#fffbeb' };
const btn = (primary) => ({ padding: '0.6rem 1.1rem', borderRadius: 10, border: primary ? 'none' : '1px solid var(--border)', background: primary ? 'var(--primary-dark)' : '#fff', color: primary ? '#fff' : 'var(--text-primary)', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' });

export default function ScheduledGiftPicker({ isOpen, onClose, contact, occasionLabel, occasionDateLabel, initial = null, onSave, deps = {} }) {
  const client = deps.api || api;
  const prior = initial && initial.scheduledGift ? initial.scheduledGift : null;
  const [vendor, setVendorRaw] = useState(prior ? prior.vendor : 'gift_boxes');
  const [boxProduct, setBoxProductRaw] = useState(prior && prior.vendor === 'gift_boxes' ? { providerProductId: prior.providerProductId, name: prior.name, imageUrl: prior.imageUrl } : null);
  const [merchProducts, setMerchProducts] = useState(null);
  const [merchFailed, setMerchFailed] = useState(false);
  const [merchProductRaw, setMerchProduct] = useState(null);
  const [variantId, setVariantIdRaw] = useState(prior && prior.vendor === 'merch' && prior.items && prior.items[0] ? prior.items[0].syncVariantId : null);
  const [quantity, setQuantityRaw] = useState(prior ? (prior.vendor === 'gift_boxes' ? prior.quantity : (prior.items || []).length) || 1 : 1);
  const [delivery, setDeliveryRaw] = useState(prior ? { ...deliveryFromContact({}), ...prior.delivery } : deliveryFromContact(contact));
  const [quote, setQuote] = useState(null);
  const [quoteState, setQuoteState] = useState('idle');
  const [quoteError, setQuoteError] = useState('');
  const [maxDollars, setMaxDollarsRaw] = useState(prior ? (prior.maxTotalCents / 100).toFixed(2) : '');
  const [cardStatus, setCardStatus] = useState(undefined); // undefined = loading
  const [cardStep, setCardStep] = useState(false);
  const [consent, setConsent] = useState(false);
  const [tried, setTried] = useState(false);

  // Any change to what is chosen, where it goes or how many clears a gift-box total already shown and the consent
  // given for the previous choice; a changed option or maximum clears the consent.
  const invalidate = () => { setQuote(null); setQuoteState('idle'); setQuoteError(''); setConsent(false); };
  const setVendor = (v) => { setVendorRaw(v); invalidate(); };
  const setBoxProduct = (v) => { setBoxProductRaw(v); invalidate(); };
  const setQuantity = (v) => { setQuantityRaw(v); invalidate(); };
  const setDelivery = (f) => { setDeliveryRaw(f); invalidate(); };
  const setVariantId = (v) => { setVariantIdRaw(v); setConsent(false); };
  const setMaxDollars = (v) => { setMaxDollarsRaw(v); setConsent(false); };

  const boxes = useProviderCatalogue(isOpen && vendor === 'gift_boxes' ? 'gift_boxes' : null, deps.catalogue || {});
  useEffect(() => {
    if (!isOpen || vendor !== 'merch' || merchProducts || merchFailed) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const r = await client.request('/api/merch/products');
        const list = Array.isArray(r) ? r : (r && (r.products || r.data)) || [];
        if (!cancelled) setMerchProducts(list);
      } catch { if (!cancelled) setMerchFailed(true); }
    })();
    return () => { cancelled = true; };
  }, [isOpen, vendor, merchProducts, merchFailed, client]);
  const merchState = merchProducts ? 'ready' : merchFailed ? 'failed' : 'loading';
  // A previously saved Branded Goods choice is found again in the catalogue by its option id.
  const priorVariantId = prior && prior.vendor === 'merch' && prior.items && prior.items[0] ? prior.items[0].syncVariantId : null;
  const merchProduct = merchProductRaw || (merchProducts && priorVariantId !== null
    ? merchProducts.find((x) => (x.variants || []).some((v) => Number(v.syncVariantId) === Number(priorVariantId))) || null : null);
  const loadCard = async () => {
    try { const r = await client.getQrCashCardStatus(); return (r && r.card) || null; } catch { return null; }
  };
  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    (async () => { const c = await loadCard(); if (!cancelled) setCardStatus(c); })();
    return () => { cancelled = true; };
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const variant = merchProduct ? (merchProduct.variants || []).find((v) => Number(v.syncVariantId) === Number(variantId)) || null : null;
  const product = vendor === 'gift_boxes' ? boxProduct : merchProduct;
  const missing = missingDelivery(delivery);
  const maxCents = Math.round(Number(maxDollars) * 100);
  const itemsCents = vendor === 'merch' && variant && Number.isFinite(variant.priceCents) ? variant.priceCents * quantity : null;
  const minCents = vendor === 'gift_boxes' ? (quote ? quote.display.totalCents : null) : itemsCents;
  const selection = vendor === 'gift_boxes'
    ? (boxProduct ? { vendor, providerProductId: boxProduct.providerProductId, variants: [], quantity, name: boxProduct.name, imageUrl: boxProduct.imageUrl } : null)
    : (merchProduct && variant ? { vendor, syncVariantId: variant.syncVariantId, quantity, name: `${merchProduct.name}${variant.label ? ` — ${variant.label}` : ''}`, imageUrl: merchProduct.imageUrl } : null);
  const setting = selection && Number.isInteger(maxCents) && maxCents > 0 ? buildScheduledGiftSetting(selection, { maxTotalCents: maxCents, delivery }) : null;
  const problems = setting ? scheduledGiftProblems(setting) : ['product'];
  const belowGuide = Number.isInteger(minCents) && maxCents > 0 && maxCents < minCents;
  const ready = setting && problems.length === 0 && !belowGuide;
  const canAutoGift = ready && card(cardStatus) && consent;

  const getTotal = async () => {
    if (!boxProduct || missing.length) return;
    setQuoteState('loading'); setQuoteError('');
    try {
      const res = await client.quoteGiftBox(toGiftBoxQuoteRequest({ ...delivery, phone: delivery.phone || '', quantity: String(quantity) }, boxProduct));
      const parsed = parseGiftBoxQuote(res);
      if (!parsed || parsed.failure || !parsed.quote) { setQuoteState('failed'); setQuoteError((parsed && parsed.failure) || giftBoxErrorCopy(res)); return; }
      const q = parsed.quote;
      setQuote(q); setQuoteState('ready');
      if (!maxDollars) setMaxDollarsRaw((Math.ceil(q.display.totalCents / 100)).toFixed(2));
    } catch (e) { setQuoteState('failed'); setQuoteError(giftBoxErrorCopy(e)); }
  };

  const save = (autoGift) => {
    setTried(true);
    if (!ready) return;
    if (autoGift && !canAutoGift) return;
    onSave(autoGift ? setting : { ...setting, autoGift: false }, { consented: autoGift });
  };

  if (!isOpen) return null;
  const field = (k) => (
    <label key={k} style={{ display: 'block', gridColumn: k === 'address1' || k === 'address2' ? '1 / -1' : undefined }}>
      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{FIELD_LABELS[k]}{missing.includes(k) ? ' — needed' : ''}</span>
      <input data-testid={`sg-delivery-${k}`} value={delivery[k] || ''} style={missing.includes(k) ? missingInput : input}
        onChange={(e) => setDelivery((d) => ({ ...d, [k]: k === 'state' ? e.target.value.toUpperCase().slice(0, 2) : e.target.value }))} />
    </label>
  );

  return (
    <Modal isOpen onClose={onClose} title={`Choose the gift — ${occasionLabel}`} size="lg">
      <div data-testid="sg-picker">
        <p style={sub}>Choose the exact gift now. Nothing is charged today. On {occasionDateLabel} we check it is available and the full total is within your maximum, then charge your saved card and place the order. Delivery follows after the occasion date.</p>

        <section style={box} data-testid="sg-step-product">
          <p style={h}>1. The gift</p>
          <div role="tablist" aria-label="Gift type" style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
            {[['gift_boxes', 'Gift boxes'], ['merch', 'Branded Goods']].map(([k, t]) => (
              <button key={k} type="button" role="tab" aria-selected={vendor === k} data-testid={`sg-tab-${k}`} onClick={() => setVendor(k)}
                style={{ ...btn(vendor === k), padding: '0.45rem 0.9rem' }}>{t}</button>
            ))}
          </div>
          {vendor === 'gift_boxes' ? (
            <GiftProductGrid cards={projectGiftCards(boxes.products, fromProviderProduct)} state={boxes.state} actionLabel="Choose" onRetry={boxes.retry}
              selectedId={boxProduct ? String(boxProduct.providerProductId) : null} emptyLabel="Gift boxes"
              onAction={(c) => setBoxProduct(boxes.products.find((p) => String(p.providerProductId) === c.id) || null)} />
          ) : (
            <GiftProductGrid cards={projectGiftCards(merchProducts || [], fromCatalogProduct)} state={merchState} actionLabel="Choose" onRetry={() => { setMerchProducts(null); setMerchFailed(false); }}
              selectedId={merchProduct ? String(merchProduct.syncProductId) : null} emptyLabel="Branded Goods"
              onAction={(c) => { const p = (merchProducts || []).find((x) => String(x.syncProductId) === c.id) || null; setMerchProduct(p); setVariantId(p && (p.variants || []).length === 1 ? p.variants[0].syncVariantId : null); }} />
          )}
          {product ? (
            <div data-testid="sg-chosen" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center', marginTop: 10 }}>
              <b style={{ fontSize: '0.9rem' }}>{product.name}</b>
              {vendor === 'merch' && merchProduct && (merchProduct.variants || []).length > 1 ? (
                <select data-testid="sg-variant" aria-label="Option" value={variantId ?? ''} onChange={(e) => setVariantId(e.target.value ? Number(e.target.value) : null)} style={{ ...input, width: 'auto' }}>
                  <option value="">Choose an option…</option>
                  {merchProduct.variants.map((v) => <option key={v.syncVariantId} value={v.syncVariantId}>{v.label}{Number.isFinite(v.priceCents) ? ` · ${centsToDollarString(v.priceCents)}` : ''}</option>)}
                </select>
              ) : null}
              <label style={{ fontSize: '0.8125rem' }}>Quantity{' '}
                <select data-testid="sg-quantity" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} style={{ ...input, width: 'auto' }}>
                  {Array.from({ length: GIFT_BOX_MAX_QUANTITY }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            </div>
          ) : null}
        </section>

        <section style={box} data-testid="sg-step-delivery">
          <p style={h}>2. Deliver to</p>
          <p style={sub}>{missing.length ? 'Filled in from their saved details. Add what is missing.' : 'Filled in from their saved details. Change anything that is different.'} US addresses only.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8, marginTop: 8 }}>
            {['firstName', 'lastName', 'address1', 'address2', 'city', 'state', 'postalCode'].map(field)}
          </div>
        </section>

        <section style={box} data-testid="sg-step-total">
          <p style={h}>3. Total and your maximum</p>
          {vendor === 'gift_boxes' ? (
            <>
              {quote ? (
                <div data-testid="sg-quote" style={{ fontSize: '0.875rem', lineHeight: 1.7 }}>
                  Today: item {centsToDollarString(quote.display.productCents)} · S&H {centsToDollarString(quote.display.shippingHandlingCents)} · tax {centsToDollarString(quote.display.taxCents)} · <b>total {centsToDollarString(quote.display.totalCents)}</b>
                </div>
              ) : (
                <button type="button" data-testid="sg-get-total" style={btn(false)} disabled={!boxProduct || missing.length > 0 || quoteState === 'loading'} onClick={getTotal}>
                  {quoteState === 'loading' ? 'Getting today’s total…' : 'Get today’s total'}
                </button>
              )}
              {quoteError ? <p role="alert" style={{ ...sub, color: '#b45309' }}>{quoteError}</p> : null}
              <p style={sub}>Today’s total is a guide. The total on {occasionDateLabel} may differ; it is checked against your maximum before anything is charged.</p>
            </>
          ) : (
            <div data-testid="sg-items" style={{ fontSize: '0.875rem', lineHeight: 1.7 }}>
              {itemsCents !== null ? <>Item{quantity > 1 ? `s (${quantity})` : ''} {centsToDollarString(itemsCents)} · S&H added on the date · tax $0.00</> : 'Choose an option to see its price.'}
            </div>
          )}
          <label style={{ display: 'block', marginTop: 8 }}>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>Your maximum for the full total (item, S&H and any fees)</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span>$</span>
              <input data-testid="sg-max" inputMode="decimal" value={maxDollars} onChange={(e) => setMaxDollars(e.target.value.replace(/[^0-9.]/g, ''))} style={{ ...(tried && !(maxCents > 0) ? missingInput : input), width: 140 }} />
            </div>
          </label>
          {maxCents > MAX_TOTAL_CENTS_LIMIT ? <p role="alert" data-testid="sg-over-limit" style={{ ...sub, color: '#b45309' }}>The maximum can be up to {centsToDollarString(MAX_TOTAL_CENTS_LIMIT)}.</p> : null}
          {belowGuide ? <p role="alert" style={{ ...sub, color: '#b45309' }}>Your maximum is below {vendor === 'gift_boxes' ? 'today’s total' : 'the item price'} ({centsToDollarString(minCents)}), so the gift would not be ordered.</p> : null}
        </section>

        <section style={box} data-testid="sg-step-consent">
          <p style={h}>4. Auto-Gift</p>
          {cardStatus === undefined ? <p style={sub}>Checking your saved card…</p>
            : card(cardStatus) ? <p style={sub} data-testid="sg-card">Charged on {occasionDateLabel} to your saved {cardStatus.brand ? `${cardStatus.brand[0].toUpperCase()}${cardStatus.brand.slice(1)}` : 'card'}{cardStatus.last4 ? ` •••• ${cardStatus.last4}` : ''}.</p>
              : (
                <div data-testid="sg-no-card">
                  <p style={sub}>{cardStatus && cardStatus.expired ? 'Your saved card has expired.' : 'Auto-Gift needs a saved card.'} Add one to turn Auto-Gift on, or keep this gift as a reminder.</p>
                  <button type="button" data-testid="sg-add-card" style={{ ...btn(false), marginTop: 6 }} onClick={() => setCardStep(true)}>Add a card</button>
                </div>
              )}
          {ready ? (
            <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginTop: 10, fontSize: '0.8125rem', lineHeight: 1.5 }}>
              <input type="checkbox" data-testid="sg-consent" checked={consent} disabled={!card(cardStatus)} onChange={(e) => setConsent(e.target.checked)} style={{ marginTop: 3 }} />
              <span data-testid="sg-consent-text">{scheduledGiftConsentText({ dateLabel: occasionDateLabel, maxTotalCents: maxCents })}</span>
            </label>
          ) : tried ? <p role="alert" style={{ ...sub, color: '#b45309' }} data-testid="sg-problems">{problems.includes('product') ? 'Choose a gift and its option. ' : ''}{problems.includes('delivery') ? 'Complete the delivery address. ' : ''}{problems.includes('maxTotal') ? 'Set your maximum. ' : ''}</p> : null}
        </section>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <button type="button" style={btn(false)} data-testid="sg-cancel" onClick={onClose}>Cancel</button>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" style={btn(false)} data-testid="sg-save-reminder" onClick={() => save(false)}>Keep as a reminder</button>
            <button type="button" style={{ ...btn(true), opacity: canAutoGift ? 1 : 0.55 }} data-testid="sg-save-autogift" aria-disabled={!canAutoGift} onClick={() => save(true)}>Turn on Auto-Gift</button>
          </div>
        </div>
      </div>
      {cardStep ? (
        <SaveAuthorizationModal plan={{ items: [], cardState: 'none', need: { card: true, consent: false, address: false } }} card={null}
          formData={{}} setFormData={() => {}} onCancel={() => setCardStep(false)}
          onSave={async () => { setCardStep(false); setCardStatus(await loadCard()); }} />
      ) : null}
    </Modal>
  );
}
