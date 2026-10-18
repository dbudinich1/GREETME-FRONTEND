// src/utils/occasionResolver.js
//
// The dashboard's inline date-and-gift resolver: one recipient with several occasions becomes SEPARATE scheduled
// Greet-Mes, one per occasion, saved through that recipient's EXISTING Occasion Scheduler record (PUT
// /api/contacts/:id). One occasion per card, always; nothing here combines occasions or schedules anything itself.
// The scheduler, its 10-day reminder, consent and fulfilment take over exactly as for a ContactForm save.
//
// Pure functions only (no React, no network) so the save payload can be tested directly.
import { occasionTypes } from './helpers';
import { normalizeGiftSettingsForSave, QRCASH_DEFAULT_DOLLARS } from './occasionGiftSave';
import { SCHEDULED_QRCASH_AVAILABLE, SCHEDULED_QRCASH_UNAVAILABLE_COPY } from '../config/scheduledQrCash';

// Dashboard occasion label -> Occasion Scheduler type (utils/helpers.js occasionTypes). Only these occasions exist
// in the scheduler; every other dashboard occasion is sent with Send Now, one at a time.
export const SCHEDULER_OCCASION_TYPES = Object.freeze({
  Birthday: 'birthday',
  Anniversary: 'anniversary',
  Christmas: 'christmas',
});

export const isSchedulerOccasion = (label) => Object.prototype.hasOwnProperty.call(SCHEDULER_OCCASION_TYPES, label);

// The scheduler's own gift choices (ContactForm "Gift selector": QR Cash, Branded Goods, Let Greet-Me select a gift,
// Browse Marketplace) plus its "no gift" state. '' = not chosen yet: the resolver requires an explicit choice.
export const RESOLVER_GIFT_OPTIONS = Object.freeze([
  ['', 'Choose a gift…'],
  ['none', 'No gift'],
  ['qrcash', 'QR Cash™'],
  ['merch', 'Branded Goods'],
  ['curated', 'Let Greet-Me select a gift'],
  ['marketplace', 'Browse Marketplace'],
]);

// The scheduler's own wording (ContactForm.jsx, Gift & Delivery copy), including its scheduled-QR-Cash switch.
export function resolverGiftLine(gift, scheduledQrCashAvailable = SCHEDULED_QRCASH_AVAILABLE) {
  if (!gift) return '';
  if (gift.type === 'none') return 'The greeting is scheduled with no gift.';
  if (gift.type === 'qrcash' && !scheduledQrCashAvailable) return SCHEDULED_QRCASH_UNAVAILABLE_COPY;
  if (gift.autoGift === true) {
    return gift.type === 'qrcash' ? 'Gift will be sent automatically on the occasion date.' : 'We’ll remind you 10 days before so you can confirm your gift.';
  }
  return 'You’ll receive a reminder 10 days before to confirm.';
}

function fixedDateFor(type, year) {
  const def = occasionTypes.find((o) => o.value === type);
  return def && def.fixedDate ? `${year}-${def.fixedDate}` : '';
}

/**
 * Prefill one resolver row from the recipient's saved scheduler data.
 * gift: the saved setting object when one exists (kept byte-identical unless the sender changes the type),
 * otherwise null (= "Choose a gift…").
 */
export function prefillRow(contact, label, now = new Date()) {
  const type = SCHEDULER_OCCASION_TYPES[label];
  const saved = ((contact && contact.occasions) || []).find((o) => o && o.type === type);
  const savedGift = contact && contact.occasionGiftSettings ? contact.occasionGiftSettings[type] : undefined;
  return {
    type,
    date: (saved && saved.date) || fixedDateFor(type, now.getFullYear()),
    gift: savedGift && savedGift.type ? savedGift : null,
    prefilled: Boolean(saved || savedGift),
  };
}

/** A new gift choice for a row: unchanged type keeps the saved setting; a new type starts like the scheduler's own default. */
export function chooseGift(row, giftType) {
  if (row.gift && row.gift.type === giftType) return row.gift;
  // Exactly as the scheduler does when QR Cash is picked (ContactForm handleOccasionGiftChange): the amount it
  // displays by default is written, so nothing is saved that the sender was not shown.
  if (giftType === 'qrcash') return { type: 'qrcash', autoGift: false, amount: QRCASH_DEFAULT_DOLLARS };
  return { type: giftType, autoGift: false };
}

/**
 * The QR Cash amount a resolver row shows: exactly what the save will write (the same normaliser), so the screen and
 * the record never disagree. A Custom amount (amount 0 + customAmount, as the scheduler stores it) shows its custom
 * figure. Returns null when the record will carry no usable amount — the row then shows no figure at all.
 */
export function resolverGiftAmount(gift) {
  if (!gift || gift.type !== 'qrcash') return null;
  const saved = normalizeGiftSettingsForSave({ x: gift }).x;
  if (saved.amount === 0) return Number.isFinite(saved.customAmount) && saved.customAmount > 0 ? saved.customAmount : null;
  return typeof saved.amount === 'number' && saved.amount > 0 ? saved.amount : null;
}

export const rowComplete = (row) => Boolean(row && row.date && row.gift && row.gift.type);

/**
 * The complete contact payload for PUT /api/contacts/:id.
 *
 * The endpoint REPLACES the whole occasions array (and blanks most absent fields), so this sends the recipient's
 * full record: every field ContactForm sends, plus the stored shipping address, with only the resolver's occasions
 * changed. Existing occasions keep their id; the resolver's occasions are saved with autoSend:true (a new one is
 * added exactly like the scheduler adds one). Every other occasion and gift setting is passed through unchanged.
 */
export function buildResolverContact(contact, rows) {
  const occasions = ((contact && contact.occasions) || []).map((o) => ({ ...o }));
  const giftSettings = { ...((contact && contact.occasionGiftSettings) || {}) };
  for (const row of rows) {
    const idx = occasions.findIndex((o) => o && o.type === row.type);
    // Saving here IS the request to schedule it, so the occasion is (re)enabled for auto-send; the scheduler skips
    // any occasion whose autoSend is false.
    if (idx >= 0) occasions[idx] = { ...occasions[idx], date: row.date, autoSend: true };
    else occasions.push({ type: row.type, date: row.date, autoSend: true });
    giftSettings[row.type] = row.gift;
  }
  return {
    name: contact.name || '',
    email: contact.email || '',
    firstName: contact.firstName || '',
    lastName: contact.lastName || '',
    gender: contact.gender || '',
    relationshipCategory: contact.relationshipCategory || '',
    relationship: contact.relationship || '',
    relationshipCloseness: contact.relationshipCloseness || '',
    relationshipContext: contact.relationshipContext || '',
    relationshipProfile: contact.relationshipProfile || null,
    occasions,
    occasionGiftSettings: giftSettings,
    avatar: contact.avatar || '',
    memoryPhotos: contact.memoryPhotos || [],
    coverPhoto: contact.coverPhoto || '',
    culturalContext: contact.culturalContext || { heritage: [], faith: null, preferCulturalGifts: false },
    giftPreferences: contact.giftPreferences || { enabled: false, budgetCap: '', giftingMode: 'always' },
    shippingAddress: contact.shippingAddress || {},
  };
}

/** The final body, normalised exactly like ContactForm's commitSave. */
export function finalizeResolverSave(toSave, consents = []) {
  return {
    ...toSave,
    occasionGiftSettings: normalizeGiftSettingsForSave(toSave.occasionGiftSettings),
    ...(consents.length > 0 ? { occasionGiftConsents: consents } : {}),
  };
}
