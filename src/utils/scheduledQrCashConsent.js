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
import { qrCashQuote, centsToDollarString, QR_CASH_MIN_DOLLARS, QR_CASH_MAX_DOLLARS } from './qrCashAmount.js';
import { needsScheduledGiftConsent, backupCapCents } from './scheduledPhysicalGift.js';

export const SCHED_QRCASH_WORDING_VERSION = 'w07-sched-qrcash-v1';
export const CONSENT_TICK_LABEL = 'I agree';
// LIVE-3 (PROPOSED copy, pending founder approval): shown above the consent text ONLY for an unchanged older Auto-Gift asked for
// its first consent (planAuthorization item.firstConsent). It is not part of the consent wording version.
export const FIRST_CONSENT_NOTE = 'This Auto-Gift was set up before we started asking for payment authorization, so we need your OK before it can send automatically.';
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
  // A scheduled physical gift (Report 117 contract v1) carries its own complete delivery snapshot, chosen in its picker,
  // so it never needs the recipient's stored address here.
  const ownsDelivery = (g) => Boolean(g && g.scheduledGift && g.scheduledGift.delivery && g.scheduledGift.delivery.address1 && g.scheduledGift.delivery.postalCode);
  const physical = Object.values(settings || {}).some((g) => g && !ownsDelivery(g) && typeof requiresDelivery === 'function' && requiresDelivery(g.type));
  if (!physical) return false;
  const a = (formData && formData.shippingAddress) || {};
  const ok = (v) => typeof v === 'string' && v.trim() !== '';
  return !(ok(formData && formData.firstName) && ok(a.line1) && ok(a.city) && ok(a.state) && ok(a.zip));
}

// The backend's routes/giftRoutes.js MIN_GIFT_CENTS / MAX_GIFT_CENTS (500 / 10000), mirrored in qrCashAmount.js.
const MIN_GIFT_CENTS = QR_CASH_MIN_DOLLARS * 100;
const MAX_GIFT_CENTS = QR_CASH_MAX_DOLLARS * 100;

/**
 * LIVE-3: will the occasion-date charge accept this stored consent? The record's `scheduledQrCashConsents[occasionType]` (GET
 * /api/contacts returns the stored contact; backend CONSENT_FIELD) judged EXACTLY by the backend's pre-charge rule, pay-be f5297c8
 * services/scheduledQrCashConsent.js isScheduledQrCashChargeReady (lines 181-193), which matches worker.js
 * _resolveScheduledQrCashConsent (lines 301-312) with its caller's amount range check (lines 510-514):
 *   185  the saved amount is a whole number of cents from MIN_GIFT_CENTS to MAX_GIFT_CENTS
 *   187  the snapshot is a plain object
 *   188  snap.contactId === this contact's id and snap.occasionType === this occasion
 *   189  snap.wordingVersion is an accepted version (the backend accepts only w07-sched-qrcash-v1, this build's version)
 *   190  snap.amountCents is a whole number of cents from MIN_GIFT_CENTS to MAX_GIFT_CENTS
 *   191  snap.acceptedAt is a valid date
 *   192  the saved amount is not more than snap.amountCents
 * Anything else is "no consent", so the sender is asked. Read only: nothing here ever records or assumes a consent.
 */
export function consentCovers(snapshot, amountCents, { contactId, occasionType } = {}) {
  if (!Number.isSafeInteger(amountCents) || amountCents < MIN_GIFT_CENTS || amountCents > MAX_GIFT_CENTS) return false;
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  if (snapshot.contactId !== contactId || snapshot.occasionType !== occasionType) return false;
  if (snapshot.wordingVersion !== SCHED_QRCASH_WORDING_VERSION) return false;
  if (!Number.isSafeInteger(snapshot.amountCents) || snapshot.amountCents < MIN_GIFT_CENTS || snapshot.amountCents > MAX_GIFT_CENTS) return false;
  if (!Number.isFinite(new Date(snapshot.acceptedAt).getTime())) return false;
  return amountCents <= snapshot.amountCents;
}

/**
 * What SAVE must ask for. One consent item per QR Cash Auto-Gift occasion that is NEW or CHANGED (gift, amount or Auto-Gift newly
 * on) or, when no usable card is on file, every QR Cash Auto-Gift occasion. Unchanged occasions with a good card, Auto-Gift-off
 * occasions and non-QR-Cash gifts never appear (the server refuses a consent for any other gift type).
 * LIVE-3: when the caller passes the record's stored consents (`storedQrCashConsents`, {} for none), an UNCHANGED QR Cash Auto-Gift
 * occasion with no stored consent covering its amount (an older setting saved before consent existed) is asked for too, so the
 * sender can make it automatic by agreeing (such an item carries `firstConsent: true`, so the dialog can say why it is asked).
 * `contactId` is the record's id, which a stored snapshot must name. A caller that does not pass stored consents is planned exactly
 * as before.
 * @returns {{ items: Array<{key,label,date,dateLabel,amountCents}>, cardState: string, need: {card:boolean, consent:boolean, address:boolean} }}
 */
export function planAuthorization({ settings, initialSettings, occasions, card, formData, labelFor, requiresDelivery, storedScheduledGiftConsents, storedQrCashConsents, contactId }) {
  const init = initialSettings && typeof initialSettings === 'object' ? initialSettings : {};
  const knownConsents = storedQrCashConsents !== undefined;
  const qrConsents = storedQrCashConsents && typeof storedQrCashConsents === 'object' ? storedQrCashConsents : {};
  const all = [];
  for (const [key, g] of Object.entries(settings || {})) {
    if (!g || g.type !== 'qrcash' || g.autoGift !== true) continue;
    const dollars = effectiveQrCashDollars(g);
    if (dollars === null) continue; // no amount: nothing to authorize (the server refuses it separately)
    const occ = (occasions || []).find((o) => o && o.type === key) || {};
    const date = typeof occ.date === 'string' ? occ.date.slice(0, 10) : '';
    const amountCents = Math.round(dollars * 100);
    const unconsented = knownConsents && !consentCovers(qrConsents[key], amountCents, { contactId, occasionType: key });
    const settingChanged = !sameSetting(init[key], g);
    // An UNCHANGED setting asked for only because it has no consent: an older Auto-Gift saved before consent was asked.
    const firstConsent = unconsented && !settingChanged;
    all.push({ key, label: (labelFor && labelFor(key)) || key, date, dateLabel: monthDay(date) || DATE_FALLBACK, amountCents, changed: settingChanged || unconsented, ...(firstConsent ? { firstConsent: true } : {}) });
  }
  // Scheduled physical gifts (Report 117 contract v1) on Auto-Gift: a consent item for each NEW or CHANGED selection (any
  // product/option/quantity/delivery change or a higher maximum; a lower maximum keeps the recorded consent), and the
  // same saved card as QR Cash Auto-Gift. An unchanged, already-consented selection with a usable card asks nothing.
  const sgAll = [];
  for (const [key, g] of Object.entries(settings || {})) {
    if (!g || !g.scheduledGift || g.autoGift !== true) continue;
    const occ = (occasions || []).find((o) => o && o.type === key) || {};
    const date = typeof occ.date === 'string' ? occ.date.slice(0, 10) : '';
    // A backup gift box adds its name and cap (the v2 wording); without one the item is exactly as before.
    const backup = g.scheduledGift.backup ? { backupName: g.scheduledGift.backup.name || '', capCents: backupCapCents(g.scheduledGift) } : {};
    sgAll.push({ key, label: (labelFor && labelFor(key)) || key, date, dateLabel: monthDay(date) || DATE_FALLBACK, name: g.scheduledGift.name || '', maxTotalCents: g.scheduledGift.maxTotalCents, ...backup, changed: needsScheduledGiftConsent(init[key], g, (storedScheduledGiftConsents || {})[key]) });
  }
  const dated = [...all, ...sgAll];
  const state = dated.length ? cardStateFor(card, dated.map((i) => i.date)) : 'ok';
  const items = all.filter((i) => state !== 'ok' || i.changed).map(({ changed, ...rest }) => rest);
  const scheduledGiftItems = sgAll.filter((i) => i.changed).map((i) => ({ key: i.key, label: i.label, date: i.date, dateLabel: i.dateLabel, name: i.name, maxTotalCents: i.maxTotalCents,
    ...(i.backupName !== undefined ? { backupName: i.backupName, capCents: i.capCents } : {}) }));
  return {
    items, scheduledGiftItems, cardState: state,
    need: { card: dated.length > 0 && state !== 'ok', consent: items.length > 0, scheduledGiftConsent: scheduledGiftItems.length > 0, address: addressMissing(formData, settings, requiresDelivery) },
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
