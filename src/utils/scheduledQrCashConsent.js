// src/utils/scheduledQrCashConsent.js
//
// W07 authorization flow: the pure rules behind the SAVE modal on the recipient form (ContactForm). DORMANT: every caller is
// gated on SCHEDULED_QRCASH_AVAILABLE (src/config/scheduledQrCash.js), which is false until scheduled QR Cash is activated.
//
// BACKEND CONTRACT (Team 3, branch sprint/closeout-t3-w07-consent: services/scheduledQrCashConsent.js + routes/contactsRoutes.js):
//   POST /api/contacts and PUT /api/contacts/:id accept an optional top-level `occasionGiftConsents`: an array with ONE entry per
//   consent block the sender ticked:
//     { occasionType, occasionDate: "YYYY-MM-DD", giftType: "qrcash", amountCents, recurrence: "yearly",
//       wordingVersion: "w07-sched-qrcash-v1", accepted: true }
//   amountCents and giftType must equal that occasion's occasionGiftSettings entry in the same body; QR Cash only (the server
//   refuses any other giftType). The server derives contactId, fee/total/maxTotalCents, acceptedAt and the IP.
//
// WORDING: founder-approved text, version w07-sched-qrcash-v1 (FOUNDER_REPORTS/30_W07_consent_wording..., reward phrase dropped).
// Changing a word here means a new version string, in step with the backend's accepted list.
import { qrCashQuote, centsToDollarString } from './qrCashAmount.js';

export const SCHED_QRCASH_WORDING_VERSION = 'w07-sched-qrcash-v1';
export const CONSENT_TICK_LABEL = 'I agree';
export const PAYMENT_INFO_TEXT = 'Auto-Gift requires a valid form of payment on file. You will be prompted when you click Save.';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export const DATE_FALLBACK = 'the occasion date';

/** 'YYYY-MM-DD' -> 'December 25' (parsed by hand: no timezone shift). Missing or malformed -> null. */
export function monthDay(isoDate) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(isoDate || ''));
  if (!m) return null;
  const month = MONTHS[Number(m[2]) - 1];
  return month ? `${month} ${Number(m[3])}` : null;
}

/** The sender's amount in whole dollars exactly as the server reads it: `amount`, or `customAmount` when amount is 0 (Custom). */
export function effectiveQrCashDollars(entry) {
  if (!entry || entry.amount === undefined || entry.amount === null) return null;
  const amount = Number(entry.amount);
  const dollars = amount === 0 ? Number(entry.customAmount) : amount;
  return Number.isFinite(dollars) ? dollars : null;
}

/** The approved consent text for ONE occasion, as four paragraphs. Fee and total are the server's arithmetic (calcGiftFees), before any waiver. */
export function consentParagraphs({ amountCents, label, dateLabel }) {
  const q = qrCashQuote(amountCents / 100);
  const total = centsToDollarString(q.totalCents);
  const amount = centsToDollarString(q.amountCents);
  const fee = centsToDollarString(q.feeCents);
  return [
    `I authorize Greet-Me to charge my card ${total} on ${dateLabel} for ${label}: my ${amount} QR Cash gift plus a ${fee} fee. ${total} is the most I will ever be charged for this gift.`,
    `This repeats every year on ${dateLabel} until I stop it. Nothing is charged before that day. If I change the amount, I will be asked again.`,
    `I can stop it any time before ${dateLabel} by turning Auto-Gift off for ${label} or removing it.`,
    `If my card can't be charged, my Greet-Me still sends on time, the gift does not, and I'll be told by email.`,
  ];
}

const sameSetting = (a, b) => !!a && !!b && a.autoGift === true && a.type === b.type && effectiveQrCashDollars(a) === effectiveQrCashDollars(b);

/**
 * Which state is the saved card in for these occasions?
 *   'ok' | 'none' (no card) | 'expired' | 'expires-before' (valid now, but expires before the earliest occasion date)
 * @param {{present?:boolean, expired?:boolean, expMonth?:number, expYear?:number}|null} card  GET /qrcash-card/status `card`
 * @param {string[]} dates ISO dates of the QR Cash Auto-Gift occasions
 */
export function cardStateFor(card, dates = []) {
  if (!card || card.present !== true) return 'none';
  if (card.expired === true) return 'expired';
  if (Number.isSafeInteger(card.expMonth) && Number.isSafeInteger(card.expYear)) {
    const end = Date.UTC(card.expYear, card.expMonth, 1) - 1; // last moment of the expiry month (UTC), as the server judges it
    for (const d of dates) {
      const t = /^\d{4}-\d{2}-\d{2}/.test(String(d || '')) ? Date.parse(`${String(d).slice(0, 10)}T00:00:00Z`) : NaN;
      if (Number.isFinite(t) && t > end) return 'expires-before';
    }
  }
  return 'ok';
}

/** Is a physical gift selected whose recipient has no complete delivery address yet? */
/** `requiresDelivery(giftType)` is ContactForm's own requiresDeliveryAddress (passed in so there is one definition of "physical"). */
export function addressMissing(formData, settings, requiresDelivery) {
  const physical = Object.values(settings || {}).some((g) => g && typeof requiresDelivery === 'function' && requiresDelivery(g.type));
  if (!physical) return false;
  const a = (formData && formData.shippingAddress) || {};
  const ok = (v) => typeof v === 'string' && v.trim() !== '';
  return !(ok(formData && formData.firstName) && ok(a.line1) && ok(a.city) && ok(a.state) && ok(a.zip));
}

/**
 * What SAVE must ask for. One consent item per QR Cash Auto-Gift occasion that is NEW or CHANGED (gift, amount or Auto-Gift newly
 * on) or, when no usable card is on file, every QR Cash Auto-Gift occasion. Unchanged occasions with a good card, Auto-Gift-off
 * occasions and non-QR-Cash gifts never appear (the server refuses a consent for any other gift type).
 * @returns {{ items: Array<{key,label,date,dateLabel,amountCents}>, cardState: string, need: {card:boolean, consent:boolean, address:boolean} }}
 */
export function planAuthorization({ settings, initialSettings, occasions, card, formData, labelFor, requiresDelivery }) {
  const init = initialSettings && typeof initialSettings === 'object' ? initialSettings : {};
  const all = [];
  for (const [key, g] of Object.entries(settings || {})) {
    if (!g || g.type !== 'qrcash' || g.autoGift !== true) continue;
    const dollars = effectiveQrCashDollars(g);
    if (dollars === null) continue; // no amount: nothing to authorize (the server refuses it separately)
    const occ = (occasions || []).find((o) => o && o.type === key) || {};
    const date = typeof occ.date === 'string' ? occ.date.slice(0, 10) : '';
    all.push({ key, label: (labelFor && labelFor(key)) || key, date, dateLabel: monthDay(date) || DATE_FALLBACK, amountCents: Math.round(dollars * 100), changed: !sameSetting(init[key], g) });
  }
  const state = all.length ? cardStateFor(card, all.map((i) => i.date)) : 'ok';
  const items = all.filter((i) => state !== 'ok' || i.changed).map(({ changed, ...rest }) => rest);
  return {
    items, cardState: state,
    need: { card: all.length > 0 && state !== 'ok', consent: items.length > 0, address: addressMissing(formData, settings, requiresDelivery) },
  };
}

/** The `occasionGiftConsents` array for the ticked items, exactly per the backend contract. */
export function buildConsentPayload(items) {
  return (items || []).map((i) => ({
    occasionType: i.key,
    ...(i.date ? { occasionDate: i.date } : {}),
    giftType: 'qrcash',
    amountCents: i.amountCents,
    recurrence: 'yearly',
    wordingVersion: SCHED_QRCASH_WORDING_VERSION,
    accepted: true,
  }));
}
