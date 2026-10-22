// src/utils/dashboardSendHandoff.js
//
// Hand-off from the dashboard's greeting launcher to the EXISTING send flow (/dashboard/send). The dashboard only
// prepares; the send flow keeps its own review, consent, payment and sending rules.
//
//   * recipient + occasion travel in the URL (?contactId=&occasion=), as other entry points already do;
//   * the sender's optional words and memory photos travel once through sessionStorage (photos are data URLs,
//     the same form the send flow already keeps in sessionStorage for its own round trips). The send flow reads
//     the hand-off once, only for the same recipient and occasion, and removes it.

import { RECIPIENT_OCCASIONS, SEASONS_GREETINGS } from './dashboardOccasions.js';

// The send flow's occasion list: its existing five, Season's Greetings, and the Recipients page's occasion list
// (utils/helpers.js occasionTypes, as the Recipients form shows it), so every occasion the dashboard offers reaches
// the send flow. Wedding, Baby, Sympathy and Engagement are not on the Recipients list and are not offered.
// GREETING_RULES untouched.
export const SEND_OCCASION_OPTIONS = Object.freeze([
  'Birthday', 'Anniversary', 'Thank You', 'Congratulations', 'Just Because', SEASONS_GREETINGS,
  ...RECIPIENT_OCCASIONS.map((o) => o.label).filter((l) => l !== 'Birthday' && l !== 'Anniversary'),
]);

// The greeting key a send-flow occasion is generated with. Recipients-list occasions use the Occasion Scheduler's own
// identifier — exactly the key a scheduled send of that occasion is generated with (backend worker occasionKey =
// occasionType) — so a Send Now and a scheduled send of the same occasion get the same greeting. Season's Greetings
// is the generic 'holiday' greeting ("Happy Holidays!"), never a specific holiday. Everything else (Thank You,
// Congratulations, Just Because) keeps the shared normaliser's key, as before.
export const SEND_OCCASION_KEY_OVERRIDES = Object.freeze({
  ...Object.fromEntries(RECIPIENT_OCCASIONS.map((o) => [o.label, o.value])),
  [SEASONS_GREETINGS]: 'holiday',
});

/**
 * The send flow's own option for a URL occasion value, or '' when it has none. Matches the option label
 * (case-insensitive) or a Recipients-list identifier (e.g. "mothers_day", as the scheduler's reminder links carry it).
 */
export function matchSendOccasion(value) {
  const v = String(value || '').trim().toLowerCase();
  if (!v) return '';
  const byLabel = SEND_OCCASION_OPTIONS.find((o) => o.toLowerCase() === v);
  if (byLabel) return byLabel;
  const byValue = RECIPIENT_OCCASIONS.find((o) => o.value === v);
  return byValue ? byValue.label : '';
}

/**
 * The dashboard's "Add a gift" hand-off (?gift=choose with ?contactId= and ?occasion=, Report 135): the recipient and
 * the send page's own occasion option the Gift Place round trip keeps, or null when either is missing (the send page
 * then opens its gift chooser, as before).
 */
export function dashboardGiftPlaceEntry(params) {
  if (!params || params.get('gift') !== 'choose' || params.get('giftType')) return null;
  const contactId = String(params.get('contactId') || '').trim();
  const occasion = matchSendOccasion(params.get('occasion'));
  return contactId && occasion ? { contactId, occasion } : null;
}

export const DASHBOARD_HANDOFF_KEY = 'gm_dashboard_send_handoff_v1';
const HANDOFF_MAX_AGE_MS = 30 * 60 * 1000;
export const HANDOFF_MAX_WORDS = 280;      // the send flow's personal-message limit
export const HANDOFF_MAX_PHOTOS = 8;       // the send flow's MAX_MEMORY_PHOTOS

/** Returns 'all' (everything carried), 'words' (photos did not fit) or 'none'. */
export function writeDashboardHandoff(storage, { contactId, occasion, words, memoryPhotos }, now = Date.now()) {
  const payload = {
    contactId: String(contactId),
    occasion: String(occasion),
    words: String(words || '').slice(0, HANDOFF_MAX_WORDS),
    memoryPhotos: (Array.isArray(memoryPhotos) ? memoryPhotos : []).slice(0, HANDOFF_MAX_PHOTOS),
    at: now,
  };
  try {
    if (!payload.words.trim() && payload.memoryPhotos.length === 0) { storage.removeItem(DASHBOARD_HANDOFF_KEY); return 'all'; }
    storage.setItem(DASHBOARD_HANDOFF_KEY, JSON.stringify(payload));
    return 'all';
  } catch {
    // Storage full (large photos): keep the words at least.
    try {
      storage.removeItem(DASHBOARD_HANDOFF_KEY); // never leave an older hand-off behind
      if (!payload.words.trim()) return 'none';
      storage.setItem(DASHBOARD_HANDOFF_KEY, JSON.stringify({ ...payload, memoryPhotos: [] }));
      return 'words';
    } catch {
      return 'none'; // storage unavailable: the caller tells the sender what was not carried
    }
  }
}

/** Read the hand-off once. Returns it only for the same recipient and occasion and only while fresh; always removes it. */
export function takeDashboardHandoff(storage, { contactId, occasion }, now = Date.now()) {
  let raw = null;
  try { raw = storage.getItem(DASHBOARD_HANDOFF_KEY); storage.removeItem(DASHBOARD_HANDOFF_KEY); } catch { return null; }
  if (!raw) return null;
  let h;
  try { h = JSON.parse(raw); } catch { return null; }
  if (!h || h.contactId !== String(contactId) || h.occasion !== String(occasion)) return null;
  if (typeof h.at !== 'number' || now - h.at > HANDOFF_MAX_AGE_MS || now < h.at) return null;
  return {
    words: String(h.words || '').slice(0, HANDOFF_MAX_WORDS),
    memoryPhotos: (Array.isArray(h.memoryPhotos) ? h.memoryPhotos : []).filter((p) => typeof p === 'string' && p).slice(0, HANDOFF_MAX_PHOTOS),
  };
}
