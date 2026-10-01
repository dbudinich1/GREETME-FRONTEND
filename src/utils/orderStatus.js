// src/utils/orderStatus.js
//
// W42 gift-order status presentation (contract: T2-w42-combined-orders.md, `status.kind` set).
//
// The backend owns status meaning. This layer must never INVENT a state:
//   * a known kind keeps the backend's own label;
//   * a label asserting PAST-TENSE delivery ("delivered") under any kind other than "delivered" is
//     not trusted, and is replaced by that kind's own plain text (never "Processing" unless the
//     kind IS processing);
//   * an unknown kind, or a missing label, is "Status unavailable";
//   * "Delivered" is shown only for kind "delivered".

/** The plain text for each documented kind, used only when a label must be rewritten. */
export const GIFT_KIND_TEXT = Object.freeze({
  processing: 'Processing',
  submitted: 'Submitted',
  shipped: 'Shipped',
  delivered: 'Delivered',
  awaiting_recipient: 'Waiting for recipient',
  completed: 'Completed',
  issue: 'Needs attention',
  canceled: 'Canceled',
  expired: 'Expired',
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
  shipped: { background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' },
  delivered: { background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' },
  completed: { background: '#ecfdf5', color: '#047857', borderColor: '#a7f3d0' },
  awaiting_recipient: { background: '#fffbeb', color: '#92400e', borderColor: '#fcd34d' },
  issue: { background: '#fef2f2', color: '#b91c1c', borderColor: '#fecaca' },
  canceled: NEUTRAL,
  expired: NEUTRAL,
};

/** Badge colors by kind; an unknown kind gets the neutral style (never a "processing" look). */
export function giftStatusBadgeStyle(kind) {
  return Object.prototype.hasOwnProperty.call(GIFT_BADGE, kind) ? GIFT_BADGE[kind] : NEUTRAL;
}
