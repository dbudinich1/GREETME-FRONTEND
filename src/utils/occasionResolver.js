// src/utils/occasionResolver.js
//
// The dashboard's inline date-and-gift resolver: one recipient with several occasions becomes SEPARATE scheduled
// Greet-Mes, one per occasion, saved through that recipient's EXISTING Occasion Scheduler record (PUT
// /api/contacts/:id). One occasion per card, always; nothing here combines occasions or schedules anything itself.
// The scheduler, its 10-day reminder, consent and fulfilment take over exactly as for a ContactForm save.
//
// Pure functions only (no React, no network) so the save payload can be tested directly.
import { occasionTypes, calculateVaryingOccasionDate } from './helpers';
import { RECIPIENT_OCCASIONS } from './dashboardOccasions.js';
import { normalizeGiftSettingsForSave, QRCASH_DEFAULT_DOLLARS } from './occasionGiftSave';
import { SCHEDULED_QRCASH_AVAILABLE, SCHEDULED_QRCASH_UNAVAILABLE_COPY } from '../config/scheduledQrCash';
import { SCHEDULED_PHYSICAL_GIFT_AVAILABLE } from '../config/scheduledPhysicalGift.js';

// Dashboard occasion label -> Occasion Scheduler type: every occasion on the Recipients page's list (utils/helpers.js
// occasionTypes) that the backend scheduler auto-sends. Graduation and Get Well are one-time occasions the scheduler
// never auto-sends (backend scheduler.js), so, like the send page's own occasions, they are sent with Send Now.
export const SCHEDULER_OCCASION_TYPES = Object.freeze(Object.fromEntries(
  RECIPIENT_OCCASIONS.filter((o) => o.value !== 'graduation' && o.value !== 'getwell').map((o) => [o.label, o.value]),
));

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

/**
 * One short, accurate status for a scheduled gift, plus the explanation shown behind the info icon. Only a QR Cash
 * gift on Auto-Gift is charged and sent automatically on the date (and only while scheduled QR Cash is live); every
 * other gift — including other types on Auto-Gift — gets the scheduler's 10-day reminder and is not charged
 * automatically.
 */
export function resolverGiftStatus(gift, scheduledQrCashAvailable = SCHEDULED_QRCASH_AVAILABLE, scheduledPhysicalAvailable = SCHEDULED_PHYSICAL_GIFT_AVAILABLE) {
  if (!gift) return { label: '', detail: '' };
  if (gift.type === 'none') return { label: 'No gift', detail: 'The greeting is scheduled with no gift.' };
  // A chosen product with Auto-Gift consented (Report 117 contract v1), only while scheduled physical gifts are live.
  if (gift.scheduledGift && gift.autoGift === true && scheduledPhysicalAvailable) {
    const base = 'On the occasion date we check the gift is available and the full total is within your maximum, then charge your saved card and place the order. Delivery follows after the occasion date.';
    // With a backup (founder 2026-10-21, S6-S7): the same rule as the consent text, never the contradictory no-gift sentence.
    if (gift.scheduledGift.backup) {
      return { label: 'Auto-Gift on', detail: `${base} If the gift isn’t available, your backup is ordered instead, only within your limit. If the gift costs more than your maximum, or neither gift can be ordered within your limit, nothing is charged and the greeting is sent without the gift.` };
    }
    return { label: 'Auto-Gift on', detail: `${base} If it is unavailable or costs more, nothing is charged and the greeting is sent without the gift.` };
  }
  if (gift.type === 'qrcash' && !scheduledQrCashAvailable) return { label: 'Reminder only \u2014 confirmation required', detail: SCHEDULED_QRCASH_UNAVAILABLE_COPY };
  if (gift.type === 'qrcash' && gift.autoGift === true) {
    return { label: 'Auto-Gift on', detail: 'Sent automatically on the occasion date and charged to your saved card. You can turn Auto-Gift off in their Occasion Scheduler.' };
  }
  return { label: 'Reminder only \u2014 confirmation required', detail: 'We\u2019ll remind you 10 days before so you can confirm the gift. If you don\u2019t, the greeting goes without it, and nothing is charged automatically.' };
}

// The scheduler's own date prefill for a newly added occasion (ContactForm handleOccasionToggle): the fixed date
// (Christmas 12-25), else the calculated date (Mother's Day, Thanksgiving, Easter…), else empty for the sender to set.
function fixedDateFor(type, year) {
  const def = occasionTypes.find((o) => o.value === type);
  if (def && def.fixedDate) return `${year}-${def.fixedDate}`;
  return calculateVaryingOccasionDate(type, year) || '';
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
export function finalizeResolverSave(toSave, consents = [], scheduledGiftConsents = null) {
  return {
    ...toSave,
    occasionGiftSettings: normalizeGiftSettingsForSave(toSave.occasionGiftSettings),
    ...(consents.length > 0 ? { occasionGiftConsents: consents } : {}),
    // Scheduled physical gift consents the sender gave in its picker (Report 117 contract v1), only where newly needed.
    ...(scheduledGiftConsents && Object.keys(scheduledGiftConsents).length > 0 ? { scheduledGiftConsents } : {}),
  };
}

/**
 * S3 — scheduled group save: ONE shared scheduler occasion saved to each selected person's own Occasion Scheduler
 * record, one person at a time, through the same full-record save as above. A person whose save needs the
 * scheduler's own authorisation step (consent or card for an existing QR Cash Auto-Gift, or an address for a shipped
 * gift) is NOT saved here: they are reported as needing their Occasion Scheduler, so nothing is consented or
 * authorised silently and the sender never meets a series of modals. Nobody is dropped without being reported.
 *
 * @param {object}   p
 * @param {object[]} p.people        the selected recipient records (2-10)
 * @param {(person) => object} p.rowFor   the person's resolver row { type, date, gift }
 * @param {object}   p.api           { updateContact }
 * @param {(o) => object} p.sanitize sanitizeRelationshipForSave
 * @param {(built) => boolean} [p.validate] the scheduler's own pre-save check (ContactForm validate: relationshipErrors);
 *        false = not saved here, reported as needing their Occasion Scheduler (sanitising alone would blank fields)
 * @param {(person, toSave) => Promise<{consent?:boolean,address?:boolean}|null>} [p.plan] the scheduler's planAuthorization
 * @param {(results) => void} [p.onProgress]
 * @returns {Promise<Array<{id:string,status:'saved'|'needs_scheduler'|'failed',message?:string,need?:object}>>}
 */
export async function saveGroupSchedules({ people, rowFor, api, sanitize, plan, validate, scheduledGiftConsentsFor = () => null, onProgress = () => {} }) {
  const results = [];
  for (const person of people) {
    try {
      const row = rowFor(person);
      if (!rowComplete(row)) { results.push({ id: person.id, status: 'failed', message: 'A date and a gift choice are needed.' }); onProgress(results.slice()); continue; }
      const built = buildResolverContact(person, [row]);
      if (validate && !validate(built)) { results.push({ id: person.id, status: 'needs_scheduler', need: { relationship: true } }); onProgress(results.slice()); continue; }
      const toSave = sanitize(built);
      const need = plan ? await plan(person, toSave) : null;
      if (need && (need.consent || need.address || need.scheduledGiftConsent || need.card)) { results.push({ id: person.id, status: 'needs_scheduler', need }); onProgress(results.slice()); continue; }
      const res = await api.updateContact(person.id, finalizeResolverSave(toSave, [], scheduledGiftConsentsFor(person, toSave)));
      if (res && res.ok === false) {
        throw new Error(res.networkError ? 'We couldn’t save — check your connection and try again.' : (res.error || res.message || 'We couldn’t save this schedule.'));
      }
      results.push({ id: person.id, status: 'saved' });
    } catch (e) {
      results.push({ id: person.id, status: 'failed', message: (e && e.message) || 'We couldn’t save this schedule.' });
    }
    onProgress(results.slice());
  }
  return results;
}
