// src/utils/scheduledPhysicalGift.js
//
// The scheduled physical gift (Report 117 rev 3, Team 6 contract v1): a gift box or a Branded Goods
// item chosen while scheduling, saved under the recipient's occasion as
//   occasionGiftSettings[occasionType] = { type: 'gift_boxes' | 'merch', autoGift: true, scheduledGift: { v: 1, ... } }
// with a sibling consent request scheduledGiftConsents[occasionType] = { accepted: true, wordingVersion }.
// Nothing here prices, charges or orders: the server re-quotes and decides on the occasion date. Pure functions only.
import { SCHEDULED_GIFT_WORDING_VERSION, SCHEDULED_PHYSICAL_GIFT_AVAILABLE } from '../config/scheduledPhysicalGift.js';
import { SCHEDULED_QRCASH_AVAILABLE } from '../config/scheduledQrCash.js';

/** The save-time authorisation step (card, consent, address) runs when EITHER scheduled QR Cash or scheduled physical
 * gifts are live — each independently of the other (Team 5 note on 4bc1680). */
export const authorizationStepEnabled = (qr = SCHEDULED_QRCASH_AVAILABLE, physical = SCHEDULED_PHYSICAL_GIFT_AVAILABLE) => Boolean(qr || physical);

export const SCHEDULED_GIFT_TYPES = Object.freeze({ gift_boxes: 'gift_boxes', merch: 'merch' });
export const GIFT_BOX_MAX_QUANTITY = 10;
export const MAX_TOTAL_CENTS_LIMIT = 100000; // contract v1: maxTotalCents 1..100000 ($1,000)

// US state names the stored address may carry -> 2-letter code (the contract requires 2 letters).
const STATES = { alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY' };
const s = (v) => (typeof v === 'string' ? v.trim() : '');

export function stateCode(v) {
  const t = s(v);
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  return STATES[t.toLowerCase()] || '';
}

/**
 * The delivery snapshot prefilled from the recipient's saved record (contact.shippingAddress + first/last name), in the
 * contract's shape. Only US addresses can be scheduled (country "US"); anything else returns country '' so the form
 * shows it as missing rather than silently converting it.
 */
export function deliveryFromContact(contact) {
  const a = (contact && contact.shippingAddress) || {};
  const country = s(a.country);
  const us = !country || /^(us|usa|united states( of america)?)$/i.test(country);
  return {
    firstName: s(contact && contact.firstName), lastName: s(contact && contact.lastName), phone: s(a.phone),
    address1: s(a.address1 || a.line1), address2: s(a.address2 || a.line2), city: s(a.city),
    state: stateCode(a.state), postalCode: s(a.postalCode || a.zip), country: us ? 'US' : '',
  };
}

/** The delivery fields still missing (contract v1, as gift-box checkout: first name, address1, city, 2-letter state, US ZIP, country US). */
export function missingDelivery(d) {
  const out = [];
  if (!s(d && d.firstName)) out.push('firstName');
  if (!s(d && d.address1)) out.push('address1');
  if (!s(d && d.city)) out.push('city');
  if (!/^[A-Z]{2}$/.test(s(d && d.state))) out.push('state');
  if (!/^\d{5}(-\d{4})?$/.test(s(d && d.postalCode))) out.push('postalCode');
  if ((d && d.country) !== 'US') out.push('country');
  return out;
}

/** The saved record's address with a completed delivery snapshot merged in (so the recipient's address is kept current). */
export function shippingAddressFromDelivery(stored, d) {
  return { ...(stored || {}), line1: d.address1, line2: d.address2 || '', city: d.city, state: d.state, zip: d.postalCode, country: 'United States' };
}

/**
 * The occasion's gift setting for a chosen product. selection:
 *   Gift box:      { vendor: 'gift_boxes', providerProductId, variants: string[], quantity, name, imageUrl }
 *   Branded Goods: { vendor: 'merch', syncVariantId, quantity, name, imageUrl }   (one items[] entry per unit)
 */
export function buildScheduledGiftSetting(selection, { maxTotalCents, delivery }) {
  const vendor = selection.vendor;
  const base = { v: 1, vendor, name: s(selection.name), imageUrl: s(selection.imageUrl), maxTotalCents: Math.round(Number(maxTotalCents)), delivery: { ...delivery } };
  if (!base.delivery.phone) delete base.delivery.phone;
  if (!base.delivery.address2) delete base.delivery.address2;
  if (!base.delivery.lastName) delete base.delivery.lastName; // optional (contract v1): left out rather than sent empty
  let scheduledGift;
  if (vendor === 'gift_boxes') {
    const quantity = Math.max(1, Math.min(GIFT_BOX_MAX_QUANTITY, Math.floor(Number(selection.quantity) || 1)));
    scheduledGift = { ...base, providerProductId: String(selection.providerProductId), variants: (selection.variants || []).map(String), quantity };
  } else if (vendor === 'merch') {
    const n = Math.max(1, Math.floor(Number(selection.quantity) || 1));
    scheduledGift = { ...base, items: Array.from({ length: n }, () => ({ syncVariantId: Number(selection.syncVariantId) })) };
  } else {
    throw new Error(`unknown vendor ${vendor}`);
  }
  return { type: SCHEDULED_GIFT_TYPES[vendor], autoGift: true, scheduledGift };
}

/** Whether a saved scheduled gift is complete enough to save (a product, a positive maximum, a complete US address). */
export function scheduledGiftProblems(setting) {
  const g = setting && setting.scheduledGift;
  if (!g) return ['product'];
  const out = [];
  if (g.vendor === 'gift_boxes' ? !g.providerProductId : !(g.items && g.items.length && g.items.every((i) => Number.isInteger(i.syncVariantId) && i.syncVariantId > 0))) out.push('product');
  if (!Number.isInteger(g.maxTotalCents) || g.maxTotalCents < 1 || g.maxTotalCents > MAX_TOTAL_CENTS_LIMIT) out.push('maxTotal');
  if (missingDelivery(g.delivery).length) out.push('delivery');
  return out;
}

// The selection a consent is bound to, normalised exactly as the server stores it (BE scheduledGiftSnapshot
// normalizeDelivery + selectionHashOf): vendor, product, options/items, quantity and delivery; last name kept even when
// empty, an empty phone / second line left out, state upper-case, country US. Raw picker values and the server's stored
// snapshot therefore compare equal when they describe the same gift.
export function canonicalSelection(g) {
  if (!g) return null;
  const d = g.delivery || {};
  const delivery = {
    firstName: s(d.firstName), lastName: s(d.lastName), ...(s(d.phone) ? { phone: s(d.phone) } : {}),
    address1: s(d.address1), ...(s(d.address2) ? { address2: s(d.address2) } : {}),
    city: s(d.city), state: s(d.state).toUpperCase(), postalCode: s(d.postalCode), country: 'US',
  };
  const sorted = Object.fromEntries(Object.keys(delivery).sort().map((k) => [k, delivery[k]]));
  return JSON.stringify({
    vendor: g.vendor,
    ...(g.vendor === 'gift_boxes'
      ? { providerProductId: String(g.providerProductId), variants: (g.variants || []).map(String), quantity: Number(g.quantity) }
      : { items: (g.items || []).map((i) => ({ syncVariantId: Number(i.syncVariantId) })) }),
    delivery: sorted,
  });
}

/**
 * Does saving `next` need the sender's (new) consent? Parity with the server (BE reconcileScheduledGiftConsents): the
 * consent recorded for this occasion is reused ONLY when it exists with the current wording version, it belongs to the
 * selection being saved (same canonical selection as the stored snapshot, and the snapshot's selectionHash matches the
 * consent's when both are known) and the new maximum is not higher. Anything else asks — it fails safe. Off needs none.
 * @param prev           the occasion's stored gift setting (server-normalised)
 * @param next           the gift setting about to be saved
 * @param storedConsent  contact.scheduledGiftConsents[occasionType] as stored by the server (undefined = none)
 */
export function needsScheduledGiftConsent(prev, next, storedConsent) {
  const n = next && next.autoGift === true && next.scheduledGift;
  if (!n) return false;
  const c = storedConsent;
  if (!c || c.wordingVersion !== SCHEDULED_GIFT_WORDING_VERSION || !Number.isSafeInteger(c.maxTotalCents)) return true;
  const p = prev && prev.autoGift === true && prev.scheduledGift;
  if (!p) return true;
  if (p.selectionHash && c.selectionHash && p.selectionHash !== c.selectionHash) return true;
  if (canonicalSelection(p) !== canonicalSelection(n)) return true;
  return n.maxTotalCents > c.maxTotalCents;
}

/** The consent request for the occasions the sender has just agreed to. */
export function scheduledGiftConsentsFor(occasionTypes) {
  return Object.fromEntries(occasionTypes.map((t) => [t, { accepted: true, wordingVersion: SCHEDULED_GIFT_WORDING_VERSION }]));
}

/** The consent sentence the sender agrees to (draft wording for founder approval; Team 6 contract v1). */
export function scheduledGiftConsentText({ dateLabel, maxTotalCents }) {
  const max = `$${(maxTotalCents / 100).toFixed(2)}`;
  return `Auto-Gift: on ${dateLabel}, we'll check this gift is available and charge your saved card the full total (item, shipping and any fees) up to ${max}, then place the order. Delivery follows after the occasion date. If it's unavailable or costs more, nothing is charged and your greeting is sent without the gift.`;
}
