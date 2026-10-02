// src/utils/qrCashAmount.js
//
// QR Cash amount rules for DISPLAY and pre-submit validation (founder-approved Surface 3).
// Authoritative sources (contract T3-w07-scheduled-qr-cash.md): the backend's utils/giftFees.js
// calcGiftFees() (processing fee = $1.99 + 3% of the gift, rounded) and routes/giftRoutes.js
// MIN_GIFT_CENTS / MAX_GIFT_CENTS (500 / 10000, enforced at POST /api/gifts/charge-now). This module
// only mirrors them so the sender hears about a refused amount BEFORE the charge step; the server stays
// authoritative. qrCashAmount.test.mjs proves the mirror equals the backend function and constants.
// Nothing here charges, authorizes or schedules anything.

export const QR_CASH_MIN_DOLLARS = 5;
export const QR_CASH_MAX_DOLLARS = 100;

/** Validate a sender-typed whole-dollar amount from $5 to $100. */
export function validateQrCashDollars(raw) {
  const text = String(raw ?? '').trim();
  if (text === '') return { ok: false, reason: 'empty', message: 'Enter an amount from $5 to $100.' };
  if (!/^\d+$/.test(text)) return { ok: false, reason: 'format', message: 'Enter a whole-dollar amount from $5 to $100.' };
  const dollars = Number(text);
  if (dollars < QR_CASH_MIN_DOLLARS) return { ok: false, reason: 'min', message: `The smallest QR Cash gift is $${QR_CASH_MIN_DOLLARS}.` };
  if (dollars > QR_CASH_MAX_DOLLARS) return { ok: false, reason: 'max', message: `The largest QR Cash gift is $${QR_CASH_MAX_DOLLARS}.` };
  return { ok: true, dollars };
}

/** Same arithmetic as the backend calcGiftFees(amountCents). */
export function qrCashQuote(dollars) {
  const amountCents = Math.round(dollars * 100);
  const feeCents = 199 + Math.round(amountCents * 0.03);
  return { amountCents, feeCents, totalCents: amountCents + feeCents };
}

export const centsToDollarString = (cents) => `$${(cents / 100).toFixed(2)}`;
