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

/**
 * The QR Cash dollars a send-page gift setting stands for (`amount`, or `customAmount` when `amount` is 0), or null when
 * no valid amount has been chosen yet. Founder 2026-10-23 (Report 137): a new QR Cash choice has no amount until the
 * sender picks one, so a missing amount is never read as $25.
 */
export function qrCashSettingDollars(gs) {
  if (!gs || gs.amount === undefined || gs.amount === null || gs.amount === '') return null;
  const raw = Number(gs.amount) === 0 ? (Number.isFinite(gs.customAmount) ? gs.customAmount : (gs.customAmount ?? '')) : gs.amount;
  const v = validateQrCashDollars(raw);
  return v.ok ? v.dollars : null;
}

/** The preset QR Cash amounts offered wherever an amount is chosen (the send page's chooser and the Gift Place). */
export const QR_CASH_PRESET_DOLLARS = Object.freeze([10, 25, 50, 100]);

/**
 * A QR Cash choice in the send page's own giftSettings shape. A preset is stored as `amount`; any other whole-dollar
 * amount as `amount: 0` + `customAmount` (the send page reads `amount === 0 ? customAmount : amount`). Every other
 * field of `base` (the greeting's existing gift settings) is kept.
 */
export function qrCashGiftSettings(dollars, base = {}) {
  const preset = QR_CASH_PRESET_DOLLARS.includes(dollars);
  return {
    amount: 25, customAmount: '', maxSpend: 50, autoGift: false, ...base,
    type: 'qrcash', ...(preset ? { amount: dollars, customAmount: '' } : { amount: 0, customAmount: String(dollars) }),
  };
}
