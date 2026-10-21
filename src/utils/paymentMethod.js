// src/utils/paymentMethod.js
//
// The "Payment method" page (/#/dashboard/payment-method): the sender's saved PERSONAL card that Auto-Gift charges on
// the occasion date (scheduled QR Cash and scheduled physical gifts share it). Pure helpers only; the page reuses the
// EXISTING W07 card endpoints exactly as SaveAuthorizationModal does:
//   GET  /api/payments/qrcash-card/status    -> { ok, card: { present, brand, last4, expMonth, expYear, expired } }
//   POST /api/payments/qrcash-card/setup     -> { ok, clientSecret, setupIntentId, consentWordingVersion }
//   (Stripe confirmCardSetup in the browser)
//   POST /api/payments/qrcash-card/complete  body { setupIntentId, consentAccepted: true, consentWordingVersion } -> { ok, card }
// Nothing here charges anything: saving a card only stores it for the Auto-Gift charges the sender already approved.

export const PAYMENT_METHOD_PATH = '/dashboard/payment-method';

const BRANDS = { visa: 'Visa', mastercard: 'Mastercard', amex: 'American Express', discover: 'Discover', diners: 'Diners Club', jcb: 'JCB', unionpay: 'UnionPay' };

/** 'visa' -> 'Visa'; an unknown brand is shown as sent, with a capital first letter; none -> 'Card'. */
export function brandLabel(brand) {
  const b = typeof brand === 'string' ? brand.trim() : '';
  if (!b) return 'Card';
  return BRANDS[b.toLowerCase()] || `${b[0].toUpperCase()}${b.slice(1)}`;
}

/** The saved card as one line, or null when there is none: "Visa ending 4242 · expires 12/2030". */
export function savedCardLine(card) {
  if (!card || card.present !== true) return null;
  const last4 = typeof card.last4 === 'string' && card.last4 ? ` ending ${card.last4}` : '';
  const exp = Number.isSafeInteger(card.expMonth) && Number.isSafeInteger(card.expYear) ? ` · expires ${String(card.expMonth).padStart(2, '0')}/${card.expYear}` : '';
  return `${brandLabel(card.brand)}${last4}${exp}`;
}

/** The status read's failure as copy: the feature switched off, or anything else (retryable). */
export function statusErrorCopy(err) {
  return err && err.code === 'SCHEDULED_QRCASH_DISABLED'
    ? 'Saved cards for Auto-Gift aren’t available yet.'
    : 'We couldn’t load your saved card just now. Please try again.';
}

/**
 * Replace (or add) the saved card with the existing three steps. `confirm(clientSecret)` is the page's Stripe
 * confirmCardSetup. Returns { ok: true, card } or { ok: false, error } where error is a SaveAuthorizationModal
 * ERROR_COPY key ('unavailable' | 'setup-unconfirmed').
 */
export async function replaceSavedCard({ api, confirm }) {
  let started;
  try { started = await api.setupQrCashCard(); } catch { return { ok: false, error: 'unavailable' }; }
  if (!started || !started.clientSecret || !started.setupIntentId) return { ok: false, error: 'unavailable' };
  let confirmed;
  try { confirmed = await confirm(started.clientSecret); } catch { confirmed = null; }
  if (!confirmed || confirmed.error || !confirmed.setupIntent || confirmed.setupIntent.status !== 'succeeded') return { ok: false, error: 'setup-unconfirmed' };
  let done;
  try {
    done = await api.completeQrCashCard({ setupIntentId: confirmed.setupIntent.id, consentAccepted: true, consentWordingVersion: started.consentWordingVersion });
  } catch { return { ok: false, error: 'unavailable' }; }
  return { ok: true, card: (done && done.card) || null };
}

/** Where to go after signing in: back to the payment-method page when that is where the sender was sent from. Only
 * this page is honoured (emails link to it); every other return keeps today's behaviour (the dashboard). */
export function loginReturnPath(from) {
  const p = typeof from === 'string' ? from : '';
  return p === PAYMENT_METHOD_PATH || p.startsWith(`${PAYMENT_METHOD_PATH}?`) ? p : null;
}
