// src/components/scheduledGift/ScheduledGiftPicker.jsx
//
// Choose the ACTUAL gift for a scheduled occasion (Report 117 rev 3, U1; Team 6 contract v1): a gift box or a
// Branded Goods item, its option and quantity, where it is delivered, and the most the sender authorises on
// the occasion date. Built from the existing pieces — the Gift Place catalogue hook and product cards, the Branded
// Goods catalogue, the gift-box address rules and the gift-box quote (which writes nothing and charges nothing).
// The picker ends at the SELECTION (gift, delivery, maximum, Auto-Gift on or off). The saved card and the consent are
// collected at the final confirmation, when the schedule is saved (the scheduler's SaveAuthorizationModal), and a
// valid card and a matching consent are reused. NOTHING is charged or ordered here.
// Shown only while SCHEDULED_PHYSICAL_GIFT_AVAILABLE is true (the caller gates it).
import { useEffect, useState } from 'react';
import Modal from '../Modal';
import api from '../../api/api';
import { useProviderCatalogue } from '../giftPlace/useProviderCatalogue';
import { GiftProductGrid } from '../giftPlace/GiftProductCard';
import { fromCatalogProduct, fromProviderProduct, projectGiftCards } from '../../pages/giftPlaceViewModel';
import { toGiftBoxQuoteRequest, parseGiftBoxQuote, giftBoxErrorCopy } from '../providerCheckout/giftBoxRules';
import { centsToDollarString } from '../../utils/qrCashAmount';
import {
  deliveryFromContact, missingDelivery, buildScheduledGiftSetting, scheduledGiftProblems, backupCandidates, backupCapCents,
  scheduledGiftBackupSentence, GIFT_BOX_MAX_QUANTITY, MAX_TOTAL_CENTS_LIMIT,
} from '../../utils/scheduledPhysicalGift';

const FIELD_LABELS = { firstName: 'First name', lastName: 'Last name', address1: 'Street address', address2: 'Apt, suite (optional)', city: 'City', state: 'State (2 letters)', postalCode: 'ZIP code' };
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
  const [autoGift, setAutoGift] = useState(prior ? prior.autoGift !== false && initial.autoGift !== false : true);
  const [tried, setTried] = useState(false);
  // Optional backup gift box (gift boxes only): a different box, ordered instead only if the chosen one is unavailable,
  // capped by the lower of the chosen box's quoted total at save (approvedTotalCents) and the maximum.
  const [backup, setBackup] = useState(prior && prior.vendor === 'gift_boxes' && prior.backup ? { providerProductId: prior.backup.providerProductId, name: prior.backup.name, imageUrl: prior.backup.imageUrl } : null);
  const [backupOpen, setBackupOpen] = useState(false);
  const [approvedCents, setApprovedCents] = useState(prior && prior.backup && Number.isSafeInteger(prior.approvedTotalCents) ? prior.approvedTotalCents : null);

  // Any change to what is chosen, where it goes or how many clears a gift-box total already shown.
  const invalidate = () => { setQuote(null); setQuoteState('idle'); setQuoteError(''); setApprovedCents(null); };
  const setVendor = (v) => { setVendorRaw(v); invalidate(); if (v !== 'gift_boxes') { setBackup(null); setBackupOpen(false); } };
  const setBoxProduct = (v) => { setBoxProductRaw(v); invalidate(); if (v && backup && String(v.providerProductId) === String(backup.providerProductId)) setBackup(null); };
  const setQuantity = (v) => { setQuantityRaw(v); invalidate(); };
  const setDelivery = (f) => { setDeliveryRaw(f); invalidate(); };
  const setVariantId = (v) => { setVariantIdRaw(v); };
  const setMaxDollars = (v) => { setMaxDollarsRaw(v); };

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

  const variant = merchProduct ? (merchProduct.variants || []).find((v) => Number(v.syncVariantId) === Number(variantId)) || null : null;
  const product = vendor === 'gift_boxes' ? boxProduct : merchProduct;
  const missing = missingDelivery(delivery);
  const maxCents = Math.round(Number(maxDollars) * 100);
  const itemsCents = vendor === 'merch' && variant && Number.isFinite(variant.priceCents) ? variant.priceCents * quantity : null;
  const minCents = vendor === 'gift_boxes' ? (quote ? quote.display.totalCents : null) : itemsCents;
  const selection = vendor === 'gift_boxes'
    ? (boxProduct ? { vendor, providerProductId: boxProduct.providerProductId, variants: [], quantity, name: boxProduct.name, imageUrl: boxProduct.imageUrl } : null)
    : (merchProduct && variant ? { vendor, syncVariantId: variant.syncVariantId, quantity, name: `${merchProduct.name}${variant.label ? ` — ${variant.label}` : ''}`, imageUrl: merchProduct.imageUrl } : null);
  const backupSel = vendor === 'gift_boxes' && backup ? { ...backup, variants: [], quantity } : null;
  const setting = selection && Number.isInteger(maxCents) && maxCents > 0 ? buildScheduledGiftSetting(selection, { maxTotalCents: maxCents, delivery, backup: backupSel, approvedTotalCents: approvedCents }) : null;
  const backupList = vendor === 'gift_boxes' && boxProduct ? backupCandidates(boxes.products, boxProduct.providerProductId) : [];
  const capCents = setting ? backupCapCents(setting.scheduledGift) : null;
  const problems = setting ? scheduledGiftProblems(setting) : ['product'];
  const belowGuide = Number.isInteger(minCents) && maxCents > 0 && maxCents < minCents;
  const ready = setting && problems.length === 0 && !belowGuide;

  const getTotal = async () => {
    if (!boxProduct || missing.length) return;
    setQuoteState('loading'); setQuoteError('');
    try {
      const res = await client.quoteGiftBox(toGiftBoxQuoteRequest({ ...delivery, phone: delivery.phone || '', quantity: String(quantity) }, boxProduct));
      const parsed = parseGiftBoxQuote(res);
      if (!parsed || parsed.failure || !parsed.quote) { setQuoteState('failed'); setQuoteError((parsed && parsed.failure) || giftBoxErrorCopy(res)); return; }
      const q = parsed.quote;
      setQuote(q); setQuoteState('ready'); setApprovedCents(Number.isSafeInteger(q.quotedTotalCents) ? q.quotedTotalCents : null);
      if (!maxDollars) setMaxDollarsRaw((Math.ceil(q.display.totalCents / 100)).toFixed(2));
    } catch (e) { setQuoteState('failed'); setQuoteError(giftBoxErrorCopy(e)); }
  };

  const save = () => {
    setTried(true);
    if (!ready) return;
    onSave(autoGift ? setting : { ...setting, autoGift: false });
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

        {vendor === 'gift_boxes' && boxProduct ? (
          <section style={box} data-testid="sg-step-backup">
            <p style={h}>Backup gift (optional)</p>
            {backup ? (
              <>
                <div data-testid="sg-backup-chosen" style={{ display: 'flex', flexWrap: 'wrap', gap: 12, alignItems: 'center' }}>
                  {backup.imageUrl ? <img src={backup.imageUrl} alt="" style={{ width: 40, height: 40, objectFit: 'cover', borderRadius: 8 }} /> : null}
                  <b style={{ fontSize: '0.9rem' }}>Backup: {backup.name}</b>
                  <button type="button" data-testid="sg-backup-change" style={{ ...btn(false), padding: '0.35rem 0.8rem' }} onClick={() => setBackupOpen(true)}>Change backup</button>
                  <button type="button" data-testid="sg-backup-remove" style={{ ...btn(false), padding: '0.35rem 0.8rem' }} onClick={() => { setBackup(null); setBackupOpen(false); }}>Remove backup</button>
                </div>
                <p data-testid="sg-backup-cap" style={{ ...sub, marginTop: 8 }}>{capCents !== null
                  ? scheduledGiftBackupSentence({ giftName: boxProduct.name, backupName: backup.name, capCents })
                  : 'Get today’s total and set your maximum to see the most the backup may cost.'}</p>
              </>
            ) : (
              <>
                <p style={sub}>If {boxProduct.name} isn’t available on {occasionDateLabel}, we can order a backup gift box instead, for no more than {boxProduct.name}’s total today and your maximum. Same delivery address.</p>
                {!backupOpen ? <button type="button" data-testid="sg-backup-add" style={{ ...btn(false), marginTop: 8 }} onClick={() => setBackupOpen(true)}>Add a backup gift (optional)</button> : null}
              </>
            )}
            {backupOpen ? (
              <div data-testid="sg-backup-list" style={{ marginTop: 10 }}>
                <GiftProductGrid cards={projectGiftCards(backupList, fromProviderProduct)} state={boxes.state} actionLabel="Choose as backup" onRetry={boxes.retry}
                  selectedId={backup ? String(backup.providerProductId) : null} emptyLabel="Other gift boxes"
                  onAction={(c) => { const p = backupList.find((x) => String(x.providerProductId) === c.id); if (p) { setBackup({ providerProductId: p.providerProductId, name: p.name, imageUrl: p.imageUrl }); setBackupOpen(false); } }} />
                <button type="button" data-testid="sg-backup-cancel" style={{ ...btn(false), marginTop: 8 }} onClick={() => setBackupOpen(false)}>{backup ? 'Keep current backup' : 'No backup'}</button>
              </div>
            ) : null}
          </section>
        ) : null}

        <section style={box} data-testid="sg-step-autogift">
          <p style={h}>4. Auto-Gift</p>
          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: '0.875rem', lineHeight: 1.5 }}>
            <input type="checkbox" data-testid="sg-autogift" checked={autoGift} onChange={(e) => setAutoGift(e.target.checked)} style={{ width: 'auto', flex: 'none', margin: '3px 0 0' }} />
            <span>Order it automatically on {occasionDateLabel}: we charge your saved card the full total, up to your maximum, and place the order.</span>
          </label>
          <p style={sub}>{autoGift ? 'You confirm your card and authorize the charge when you save the schedule. Nothing is charged today.' : 'Off: you get a reminder 10 days before to confirm the gift; nothing is ordered or charged automatically.'}</p>
          {tried && !ready ? <p role="alert" style={{ ...sub, color: '#b45309' }} data-testid="sg-problems">{problems.includes('product') ? 'Choose a gift and its option. ' : ''}{problems.includes('delivery') ? 'Complete the delivery address. ' : ''}{problems.includes('maxTotal') ? 'Set your maximum. ' : ''}{problems.includes('approvedTotal') ? 'Get today’s total to keep the backup gift. ' : ''}{problems.includes('backup') ? 'Choose a different backup gift. ' : ''}{belowGuide ? 'Raise your maximum. ' : ''}</p> : null}
        </section>

        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginTop: 16 }}>
          <button type="button" style={btn(false)} data-testid="sg-cancel" onClick={onClose}>Cancel</button>
          <button type="button" style={btn(true)} data-testid="sg-use" onClick={save}>Use this gift</button>
        </div>
      </div>
    </Modal>
  );
}
