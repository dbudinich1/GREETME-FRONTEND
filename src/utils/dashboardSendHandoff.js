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
  // entry: the dashboard's one-time marker for this Add a gift press, so a repeat of the same URL (Back, refresh)
  // is recognised and never reopens shopping after a gift was chosen.
  const entry = String(params.get('entry') || '').trim().slice(0, 40);
  return contactId && occasion ? { contactId, occasion, ...(entry ? { entry } : {}) } : null;
}

// Report 136: the dashboard's Add a gift pressed on the QR Cash slide opens the Gift Place on its QR Cash tab. The send
// page's own hand-off to the Gift Place is unchanged; this one-time marker, tied to that press's entry, tells the Gift
// Place which tab to open. Read once; ignored for any other entry or after 30 minutes.
export const GIFT_PLACE_TAB_KEY = 'gm_giftplace_tab_v1';
export function writeGiftPlaceTab(storage, entry, tab) {
  if (!storage || !entry || tab !== 'qrcash') return;
  try { storage.setItem(GIFT_PLACE_TAB_KEY, JSON.stringify({ entry: String(entry), tab, at: Date.now() })); } catch { /* storage unavailable: the Gift Place opens as usual */ }
}
export function takeGiftPlaceTab(storage, entry) {
  if (!storage) return null;
  let v = null;
  try { v = JSON.parse(storage.getItem(GIFT_PLACE_TAB_KEY) || 'null'); storage.removeItem(GIFT_PLACE_TAB_KEY); } catch { v = null; }
  return v && v.tab === 'qrcash' && entry && v.entry === String(entry) && Date.now() - Number(v.at || 0) < 30 * 60 * 1000 ? 'qrcash' : null;
}

// Used one-time "Add a gift" entries (Report 135, Team 5 M1), kept apart from the greeting record, which the send
// page's restore deletes. This tab only; the last 20.
export const GIFT_PLACE_ENTRIES_KEY = 'gm_giftplace_entries_v1';
export function markGiftPlaceEntryUsed(storage, entry) {
  if (!storage || !entry) return;
  try {
    const cur = JSON.parse(storage.getItem(GIFT_PLACE_ENTRIES_KEY) || '[]');
    const list = (Array.isArray(cur) ? cur : []).filter((x) => x !== entry);
    storage.setItem(GIFT_PLACE_ENTRIES_KEY, JSON.stringify([...list, String(entry)].slice(-20)));
  } catch { /* storage unavailable: the replaced history entry still keeps Back away from it */ }
}
export function giftPlaceEntryUsed(storage, entry) {
  if (!storage || !entry) return false;
  try { const cur = JSON.parse(storage.getItem(GIFT_PLACE_ENTRIES_KEY) || '[]'); return Array.isArray(cur) && cur.includes(String(entry)); } catch { return false; }
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

// Home Send (Report 145, founder 2026-10-28): the Home Send click is the confirmation for a complete greeting with no gift.
// It leaves ONE intent naming this recipient and occasion, with a random nonce that is also put in the URL (?intent=). The
// send page takes it once (and removes it) and only then sends through its existing no-gift send. An ordinary URL, a
// refresh, Back or a retry carries no matching stored intent, so nothing is sent automatically. Fresh for two minutes.
export const HOME_SEND_INTENT_KEY = 'gm_home_send_intent_v1';
const HOME_SEND_INTENT_MAX_AGE_MS = 2 * 60 * 1000;

/** Records the intent; returns its nonce, or '' when storage is unavailable (the send page then sends nothing by itself). */
export function writeHomeSendIntent(storage, { contactId, occasion }, now = Date.now(), mint = () => (globalThis.crypto && typeof globalThis.crypto.randomUUID === 'function' ? globalThis.crypto.randomUUID() : `${now.toString(36)}-${Math.random().toString(36).slice(2)}`)) {
  const nonce = String(mint());
  try { storage.setItem(HOME_SEND_INTENT_KEY, JSON.stringify({ nonce, contactId: String(contactId), occasion: String(occasion), at: now })); return nonce; } catch { return ''; }
}

/** Takes the intent once: true only for the same nonce, recipient and occasion while fresh. Always removes it. */
export function takeHomeSendIntent(storage, { contactId, occasion, nonce }, now = Date.now()) {
  let raw = null;
  try { raw = storage.getItem(HOME_SEND_INTENT_KEY); storage.removeItem(HOME_SEND_INTENT_KEY); } catch { return false; }
  if (!raw || !nonce) return false;
  let h;
  try { h = JSON.parse(raw); } catch { return false; }
  if (!h || h.nonce !== String(nonce) || h.contactId !== String(contactId) || h.occasion !== String(occasion)) return false;
  return typeof h.at === 'number' && now >= h.at && now - h.at <= HOME_SEND_INTENT_MAX_AGE_MS;
}

// Team 5 F6 (Report 146): a Home intent seen again (refresh, Back) is told apart from one that never arrived, so the send
// page can say which. Used nonces are kept apart from the intent (this tab only; the last 20).
export const HOME_SEND_USED_KEY = 'gm_home_send_used_v1';
export function markHomeSendIntentUsed(storage, nonce) {
  if (!storage || !nonce) return;
  try {
    const cur = JSON.parse(storage.getItem(HOME_SEND_USED_KEY) || '[]');
    const list = (Array.isArray(cur) ? cur : []).filter((n) => n !== String(nonce));
    storage.setItem(HOME_SEND_USED_KEY, JSON.stringify([...list, String(nonce)].slice(-20)));
  } catch { /* storage unavailable: the page then says only that nothing was sent */ }
}
export function homeSendIntentUsed(storage, nonce) {
  if (!storage || !nonce) return false;
  try { const cur = JSON.parse(storage.getItem(HOME_SEND_USED_KEY) || '[]'); return Array.isArray(cur) && cur.includes(String(nonce)); } catch { return false; }
}

// Team 5 F2 (Report 146): the send key belongs to ONE greeting. A Home Send for a different recipient or occasion than
// the one that last used the kept key must start a fresh key (a reused key with different facts is refused 409); the
// same greeting again (retry after a lost reply) keeps it, so the server can converge on one send.
export const HOME_SEND_KEY_FOR_KEY = 'gm_home_send_key_for_v1';
/** Records who the send key is now for; returns true when it was for a DIFFERENT recipient/occasion (drop the key). */
export function claimHomeSendKey(storage, { contactId, occasion }) {
  const forWhom = `${String(contactId)}|${String(occasion)}`;
  let prev = null;
  try { prev = storage.getItem(HOME_SEND_KEY_FOR_KEY); storage.setItem(HOME_SEND_KEY_FOR_KEY, forWhom); } catch { return false; }
  return Boolean(prev) && prev !== forWhom;
}
