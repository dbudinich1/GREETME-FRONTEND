// src/utils/orderStatus.js
//
// W42 gift-order status presentation (contract: T2-w42-combined-orders.md, `status.kind` set).
//
// The backend owns status meaning (contract: T2-w42-status-semantics.md): every row carries a
// non-empty kind and label, and the label is rendered VERBATIM. kind only picks the badge colour.
// The guards below are DEFENSIVE ONLY and can never invent a state:
//   * a missing/blank label, or a kind outside the documented set, shows "Status unavailable";
//   * a label asserting PAST-TENSE delivery ("delivered") under any kind other than "delivered" is
//     not trusted and is replaced by that kind's own plain text (never "Processing" unless the kind IS
//     processing) - the backend only emits "delivered" with provider proof, so this should not fire;
//   * "Delivered" is shown only for kind "delivered".
// Release 2 (2026-10-07): kind "on_hold" = paid, but not yet sent to the fulfilment partner (e.g. held
// merchandise). It has its own amber badge so it never looks like an order in progress.

/** The plain text for each documented kind, used only when a label must be rewritten. */
export const GIFT_KIND_TEXT = Object.freeze({
  processing: 'Processing',
  on_hold: 'On hold',
  submitted: 'Submitted',
  shipped: 'Shipped',
  delivered: 'Delivered',
  awaiting_recipient: 'Waiting for recipient',
  completed: 'Completed',
  issue: 'Needs attention',
  canceled: 'Canceled',
  refunded: 'Refunded',
  expired: 'Expired',
  unknown: 'Status unavailable',
});

export const STATUS_UNAVAILABLE = 'Status unavailable';

const PAST_TENSE_DELIVERY = /\bdelivered\b/i;

export function giftOrderStatusLabel(status) {
  const kind = typeof status?.kind === 'string' ? status.kind : '';
  const label = typeof status?.label === 'string' ? status.label.trim() : '';
  if (!Object.prototype.hasOwnProperty.call(GIFT_KIND_TEXT, kind) || !label) return STATUS_UNAVAILABLE;
  if (kind !== 'delivered' && PAST_TENSE_DELIVERY.test(label)) return GIFT_KIND_TEXT[kind];
  return label;
}

/** Only an https tracking URL is ever linked, and only when the backend marks tracking available. */
export function giftOrderTrackingHref(tracking) {
  if (!tracking || tracking.available !== true) return null;
  try {
    const u = new URL(String(tracking.trackingUrl || ''));
    return u.protocol === 'https:' ? u.href : null;
  } catch {
    return null;
  }
}

const NEUTRAL = { background: '#f3f4f6', color: '#4b5563', borderColor: '#d1d5db' };
const GIFT_BADGE = {
  processing: { background: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe' },
  submitted: { background: '#eef2ff', color: '#4338ca', borderColor: '#c7d2fe' },
  on_hold: { background: '#fff7ed', color: '#9a3412', borderColor: '#fed7aa' },
  shipped: { background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' },
  delivered: { background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' },
  completed: { background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' },
  awaiting_recipient: { background: '#fffbeb', color: '#92400e', borderColor: '#fcd34d' },
  issue: { background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' },
  canceled: NEUTRAL,
  refunded: { background: '#faf5ff', color: '#6b21a8', borderColor: '#e9d5ff' },
  expired: NEUTRAL,
  unknown: NEUTRAL,
};

/** Badge colors by kind; an unknown kind gets the neutral style (never a "processing" look). */
export function giftStatusBadgeStyle(kind) {
  return Object.prototype.hasOwnProperty.call(GIFT_BADGE, kind) ? GIFT_BADGE[kind] : NEUTRAL;
}
