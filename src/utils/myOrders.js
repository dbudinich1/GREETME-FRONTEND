// src/utils/myOrders.js
//
// W42 provider-neutral "Your Orders": turn the existing reads into ONE list of rows and decide what to do when a read fails.
// (Founder-approved review, Surface 11, 2026-10-05.) No new endpoint and no backend change.
//
// READS (all existing): api.getOrderHistory (GET /api/orders/history: merch/Printful, Florist One, Goody and other gift boxes,
// QR Cash, Prezzee gift cards when activated, curated), and - only when that combined read is unavailable - the two older reads
// api.getMerchOrders (GET /api/merch/orders) and api.getFlowerOrders (GET /api/gifts/flower-orders), each independent, so one
// source failing never hides the others. The legacy merch endpoint is not repointed or changed.
//
// HONESTY (T2-w42-status-semantics.md): the backend's status label is shown as it is; "Delivered" only for kind "delivered"
// (the backend emits it only with provider proof); an unknown or missing status is "Status unavailable", never "Processing";
// tracking is linked only when the backend marks it available AND the link is https (see utils/orderStatus.js).

export const CATEGORY_LABEL = {
  merch: 'Branded Goods',
  flowers: 'Flowers',
  gift_boxes: 'Gift box',
  gift_box: 'Gift box', // the contract doc's spelling; the backend's real value is gift_boxes
  gift_cards: 'Gift card',
  qrcash: 'QR Cash',
  curated: 'Curated gift',
  marketplace: 'Marketplace gift',
};
export const categoryLabel = (c) => CATEGORY_LABEL[c] || 'Gift';

const NO_TRACKING = Object.freeze({ available: false, carrier: null, trackingNumber: null, trackingUrl: null });
const last8 = (s) => String(s || '').slice(-8);

/** A row of GET /api/orders/history (any source). The backend already owns status, tracking, reference and support. */
export function rowFromHistory(o) {
  return {
    key: String(o.orderRef),
    source: o.source,
    category: o.category,
    createdAt: o.createdAt || null,
    itemSummary: o.itemSummary || '',
    recipientName: o.recipientName || '',
    amountCents: typeof o.amountCents === 'number' ? o.amountCents : null,
    status: o.status && typeof o.status === 'object' ? o.status : { kind: 'unknown', label: '' },
    tracking: o.tracking && typeof o.tracking === 'object' ? o.tracking : NO_TRACKING,
    requestedDeliveryDate: o.requestedDeliveryDate || null,
    providerReference: o.providerReference || null,
    shortRef: last8(o.orderRef),
    support: o.support === true,
  };
}

const LEGACY_MERCH_KINDS = new Set(['processing', 'shipped', 'issue', 'canceled']);

/**
 * A row of the legacy GET /api/merch/orders. Fallback only (used when the combined read is unavailable). That endpoint collapses a
 * refund into "canceled" and has no way to say "unknown", so: a status the page cannot recognise is "Status unavailable" with Get
 * Help (never "Processing"), and the exact label "Refunded" keeps the refunded badge instead of the cancelled one. The label itself
 * is always shown as the backend sent it.
 */
export function rowFromLegacyMerch(o) {
  const label = typeof o.statusLabel === 'string' ? o.statusLabel.trim() : '';
  let kind = LEGACY_MERCH_KINDS.has(o.statusKind) ? o.statusKind : 'unknown';
  if (label.toLowerCase() === 'refunded') kind = 'refunded';
  const packages = Array.isArray(o.packages) ? o.packages.filter((p) => p && typeof p === 'object') : [];
  const first = packages.find((p) => p.trackingUrl) || packages.find((p) => p.carrier || p.trackingNumber) || null;
  return {
    key: `merch:${o.id}`,
    source: 'merch',
    category: 'merch',
    createdAt: o.paidAt || null,
    itemSummary: o.itemSummary || '',
    recipientName: '',
    amountCents: typeof o.totalCents === 'number' ? o.totalCents : null,
    status: { kind, label },
    tracking: first ? { available: true, carrier: first.carrier || null, trackingNumber: first.trackingNumber || null, trackingUrl: first.trackingUrl || null } : NO_TRACKING,
    requestedDeliveryDate: null,
    providerReference: null,
    shortRef: String(o.id || '').slice(0, 8),
    support: kind === 'unknown',
  };
}

/** A row of the legacy GET /api/gifts/flower-orders. Florist One has no status feed: always "submitted", never shipped or delivered. */
export function rowFromLegacyFlower(o) {
  return {
    key: `flowers:${o.id}`,
    source: 'flowers',
    category: 'flowers',
    createdAt: o.submittedAt || null,
    itemSummary: o.itemSummary || 'Flowers',
    recipientName: o.recipientName || '',
    amountCents: typeof o.amountCents === 'number' ? o.amountCents : null,
    status: { kind: 'submitted', label: (o.status && o.status.label) || 'Flower order submitted' },
    tracking: NO_TRACKING,
    requestedDeliveryDate: o.requestedDeliveryDate || null,
    providerReference: o.orderReference || null,
    shortRef: String(o.id || '').slice(0, 8),
    support: true,
  };
}

/** Newest first; rows without a date go last; ties keep their order. */
export function sortNewest(rows) {
  const t = (r) => { const n = Date.parse(r.createdAt || ''); return Number.isFinite(n) ? n : -Infinity; };
  return rows.map((r, i) => [r, i]).sort((a, b) => (t(b[0]) - t(a[0])) || (a[1] - b[1])).map(([r]) => r);
}

export const NOTE_TEXT = {
  gift: 'We couldn’t load your gift orders just now.',
  merch: 'We couldn’t load your Branded Goods orders just now.',
  flower: 'We couldn’t load your flower orders just now.',
};

/**
 * Load everything the customer has ordered.
 * @returns {Promise<{ rows: object[], truncated: boolean, notes: string[], failed: boolean }>}
 *   notes: which sources could not be read ("gift" | "merch" | "flower"); failed: nothing at all could be read.
 */
export async function loadMyOrders(api) {
  try {
    const res = await api.getOrderHistory();
    if (!res || res.ok !== true || !Array.isArray(res.orders)) throw new Error('order history unavailable');
    const rows = res.orders.filter((o) => o && o.orderRef).map(rowFromHistory);
    return { rows: sortNewest(rows), truncated: res.truncated === true, notes: [], failed: false };
  } catch {
    // The combined read is unavailable: fall back to the two older, independent reads and say so for the gifts.
  }
  const [merch, flowers] = await Promise.allSettled([api.getMerchOrders(), api.getFlowerOrders()]);
  const rows = [];
  const notes = ['gift'];
  if (merch.status === 'fulfilled' && merch.value && Array.isArray(merch.value.orders)) rows.push(...merch.value.orders.filter((o) => o && o.id).map(rowFromLegacyMerch));
  else notes.push('merch');
  if (flowers.status === 'fulfilled' && flowers.value && Array.isArray(flowers.value.orders)) rows.push(...flowers.value.orders.filter((o) => o && o.id).map(rowFromLegacyFlower));
  else notes.push('flower');
  const failed = notes.length === 3; // all three reads failed
  return { rows: sortNewest(rows), truncated: false, notes: failed ? [] : notes, failed };
}
