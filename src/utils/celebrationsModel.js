// src/utils/celebrationsModel.js
//
// Celebrations (the renamed Recipients page, Report 135): two ways into the SAME per-recipient Occasion Scheduler
// records — start from a person, or start from an occasion. Pure functions only (no React, no network).
//
// Truthfulness rules (founder 2026-10-22):
//   * Upcoming shows saved dates and the scheduler's real status where the server reports one
//     (GET /api/dashboard/upcoming scheduleStatus). Otherwise it says only what the record says: "Auto-send on" for
//     an occasion set to auto-send with a date, "Not scheduled" otherwise. Nothing upcoming is ever called sent.
//   * Past shows only real sends (GET /api/greetings/sent) with their real status. A one-time occasion whose date
//     has passed with no matching send reads "No send recorded". A yearly occasion's earlier years are never
//     inferred: the server keeps no per-occurrence history the client can read.
//   * Dates follow the Occasion Scheduler's own rules (utils/helpers.js occasionTypes): a saved date first, else
//     the shared calendar date (fixed, e.g. Christmas 12-25, or calculated, e.g. Mother's Day), else missing.
import { occasionTypes, calculateVaryingOccasionDate } from './helpers.js';

export const RECIPIENT_SEGMENTS = Object.freeze([
  { key: 'individuals', label: 'Individuals' },
  { key: 'friend', label: 'Friends' },
  { key: 'family', label: 'Family' },
  { key: 'professional', label: 'Professional' },
]);
export const CATEGORY_LABELS = Object.freeze({ friend: 'Friend', family: 'Family', professional: 'Professional' });

/** Individuals = everyone, one by one; the categories filter by the recipient's existing relationshipCategory. */
export function filterRecipients(contacts, segment = 'individuals', term = '') {
  const t = String(term || '').trim().toLowerCase();
  return (contacts || []).filter((c) => {
    if (!c) return false;
    if (segment !== 'individuals' && c.relationshipCategory !== segment) return false;
    if (!t) return true;
    return [c.name, c.email, c.relationship].some((v) => String(v || '').toLowerCase().includes(t));
  });
}
export function segmentCounts(contacts) {
  const out = { individuals: (contacts || []).length, friend: 0, family: 0, professional: 0 };
  for (const c of contacts || []) if (c && out[c.relationshipCategory] !== undefined) out[c.relationshipCategory] += 1;
  return out;
}

// The occasion list and sub-occasions, grouped exactly as the Occasion Scheduler groups them (ContactForm: Personal
// Occasions without Get Well; Secular holidays; FaithBasedOccasionSelector: Christianity, Judaism, Islam).
const byCat = (cat) => occasionTypes.filter((o) => o.category === cat && o.value !== 'getwell').map((o) => o.value);
export const OCCASION_GROUPS = Object.freeze([
  { key: 'personal', title: 'Personal occasions', types: byCat('personal') },
  { key: 'secular', title: 'Holidays', types: byCat('secular') },
  { key: 'christian', title: 'Christianity', types: byCat('christian') },
  { key: 'jewish', title: 'Judaism', types: byCat('jewish') },
  { key: 'muslim', title: 'Islam', types: byCat('muslim') },
]);

const def = (type) => occasionTypes.find((o) => o.value === type) || null;
export const occasionLabel = (type) => (def(type) || {}).label || String(type || '').replace(/_/g, ' ');
export const occasionIcon = (type) => (def(type) || {}).icon || '🎉';
/** 'personal': each recipient has their own date (birthday, anniversary, graduation). 'shared': one calendar date for everyone. */
export const occasionDateKind = (type) => ((def(type) || {}).category === 'personal' ? 'personal' : 'shared');
export const isOneTime = (type) => (def(type) || {}).recurring === false;

/** The shared calendar date for a year, exactly as the scheduler pre-fills it ('' when it must be entered). */
export function sharedDateFor(type, year) {
  const d = def(type);
  if (!d || d.category === 'personal') return '';
  if (d.fixedDate) return `${year}-${d.fixedDate}`;
  return calculateVaryingOccasionDate(type, year) || '';
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (s) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(s || '')); return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null; };
const startOfDay = (now) => new Date(now.getFullYear(), now.getMonth(), now.getDate());
const dayDiff = (a, b) => Math.round((a - b) / 86400000);
const feb29 = (p, y) => (p.m === 1 && p.d === 29 && new Date(y, 1, 29).getMonth() !== 1 ? 28 : p.d);

/**
 * The next date an occasion falls on. Yearly occasions repeat on the saved month and day (the backend's own rule,
 * dashboardRoutes /upcoming, with Feb 29 -> Feb 28); one-time occasions only on their saved date.
 * @returns {{date:string, daysUntil:number}|null}
 */
export function nextOccurrence(occ, now = new Date()) {
  const p = parse(occ && occ.date);
  if (!p) return null;
  const today = startOfDay(now);
  if (isOneTime(occ.type)) {
    const d = new Date(p.y, p.m, p.d);
    return d >= today ? { date: ymd(d), daysUntil: dayDiff(d, today) } : null;
  }
  let d = new Date(today.getFullYear(), p.m, feb29(p, today.getFullYear()));
  if (d < today) d = new Date(today.getFullYear() + 1, p.m, feb29(p, today.getFullYear() + 1));
  return { date: ymd(d), daysUntil: dayDiff(d, today) };
}

// The scheduler's statuses (same wording as the dashboard's Upcoming Occasions).
export const SCHEDULE_STATUS = Object.freeze({
  scheduled: ['Ready to send', 'plum', true], queued: ['Creating', 'amber', true], delivered: ['Sent', 'ok', true],
  skipped: ['Not sent', 'muted', false], failed: ['Not sent', 'muted', false], cancelled: ['Cancelled', 'muted', false],
  paused: ['Paused', 'muted', false], skipped_transient: ['Preparing', 'muted', true], skipped_permanent: ['Not sent', 'muted', false],
  skipped_terminal: ['Not sent', 'muted', false],
});
// Past: the greeting statuses the server stores. "completed" = the recipient email was sent.
export const PAST_STATUS = Object.freeze({ completed: ['Sent', 'ok'], pending: ['Creating', 'amber'], processing: ['Creating', 'amber'], failed: ['Not sent', 'muted'], cancelled: ['Cancelled', 'muted'] });

/**
 * The status of one upcoming occurrence. `planned` drives the chip's "lined up" note.
 * Source: 'scheduler' (a real schedule record), 'record' (the saved auto-send setting) or 'none'.
 */
export function upcomingStatus(contactId, occ, next, upcomingRows = []) {
  const row = next && (upcomingRows || []).find((r) => r && String(r.contactId) === String(contactId) && r.occasionType === occ.type && String(r.date).slice(0, 10) === next.date);
  if (row && row.scheduleStatus) {
    const [label, tone, planned] = SCHEDULE_STATUS[row.scheduleStatus] || ['Preparing', 'muted', true];
    return { key: row.scheduleStatus, label, tone, planned, source: 'scheduler' };
  }
  if (next && occ.autoSend !== false) return { key: 'auto', label: 'Auto-send on', tone: 'plum', planned: true, source: 'record' };
  return { key: 'open', label: 'Not scheduled', tone: 'muted', planned: false, source: 'record' };
}

/** A person's saved occasions that are still ahead, soonest first, with their real status and saved gift. */
export function upcomingForContact(contact, upcomingRows = [], now = new Date()) {
  const out = [];
  for (const occ of (contact && contact.occasions) || []) {
    if (!occ || !occ.type) continue;
    const next = nextOccurrence(occ, now);
    const gift = (contact.occasionGiftSettings || {})[occ.type] || null;
    if (!next) {
      // A saved occasion with no date (or a one-time date already passed) is not upcoming. A missing date is shown
      // as missing, never as planned.
      if (!parse(occ.date)) out.push({ type: occ.type, label: occasionLabel(occ.type), icon: occasionIcon(occ.type), date: '', daysUntil: null, missingDate: true, status: { key: 'nodate', label: 'Date needed', tone: 'amber', planned: false, source: 'record' }, gift });
      continue;
    }
    out.push({ type: occ.type, label: occasionLabel(occ.type), icon: occasionIcon(occ.type), date: next.date, daysUntil: next.daysUntil, missingDate: false, status: upcomingStatus(contact.id, occ, next, upcomingRows), gift });
  }
  return out.sort((a, b) => (a.daysUntil ?? 1e9) - (b.daysUntil ?? 1e9));
}

/** A send's occasion as a scheduler type when it is one (the server stores occasionKey = the scheduler type). */
export function sendOccasionType(s) {
  const v = String((s && s.occasionType) || '').trim();
  if (def(v)) return v;
  const byLabel = occasionTypes.find((o) => o.label.toLowerCase() === v.toLowerCase());
  return byLabel ? byLabel.value : null;
}
const PAST_LABELS = { thankyou: 'Thank You', thank_you: 'Thank You', congrats: 'Congratulations', just_because: 'Just Because', holiday: "Season's Greetings", general: 'Thinking of You' };
export const sendOccasionLabel = (s) => { const t = sendOccasionType(s); return t ? occasionLabel(t) : (PAST_LABELS[s && s.occasionType] || String((s && s.occasionType) || 'Greeting')); };

/**
 * The server's sent list carries no contactId (routes/greetingsRoutes.js /sent), so a send belongs to a person by
 * the recipient email it was sent to, else by exact name. Unmatched sends are never attributed.
 */
export function sendBelongsTo(s, contact) {
  if (!s || !contact) return false;
  const e = String(s.recipientEmail || '').trim().toLowerCase();
  if (e && contact.email) return e === String(contact.email).trim().toLowerCase();
  return Boolean(s.recipientName) && String(s.recipientName).trim() === String(contact.name || '').trim();
}
const sendItem = (s) => {
  const [label, tone] = PAST_STATUS[s.status] || ['Creating', 'amber'];
  return { kind: 'send', id: s.id, type: sendOccasionType(s), label: sendOccasionLabel(s), icon: occasionIcon(sendOccasionType(s)), when: s.completedAt || s.createdAt || '', status: { key: s.status, label, tone } };
};

/** A person's past: their real sends (newest first), then one-time occasions whose date passed with no send. */
export function pastForContact(contact, sent = [], now = new Date()) {
  const mine = (sent || []).filter((s) => sendBelongsTo(s, contact)).map(sendItem)
    .sort((a, b) => String(b.when).localeCompare(String(a.when)));
  const today = ymd(startOfDay(now));
  for (const occ of (contact && contact.occasions) || []) {
    if (!occ || !isOneTime(occ.type)) continue;
    const p = parse(occ.date);
    if (!p || occ.date.slice(0, 10) >= today) continue;
    if (mine.some((m) => m.type === occ.type)) continue;
    mine.push({ kind: 'passed', id: `${contact.id}:${occ.type}`, type: occ.type, label: occasionLabel(occ.type), icon: occasionIcon(occ.type), when: occ.date.slice(0, 10), status: { key: 'none', label: 'No send recorded', tone: 'muted' } });
  }
  return mine;
}

/**
 * Starting from an occasion: every recipient, with what their own record holds for it. Holders come first.
 * dateSource: 'saved' (their record), 'shared' (the calendar date the scheduler would pre-fill) or 'missing'.
 */
export function occasionRoster(contacts, type, upcomingRows = [], now = new Date()) {
  const kind = occasionDateKind(type);
  const year = startOfDay(now).getFullYear();
  let shared = sharedDateFor(type, year);
  if (shared && shared < ymd(startOfDay(now))) shared = sharedDateFor(type, year + 1) || shared;
  const rows = (contacts || []).filter(Boolean).map((c) => {
    const occ = (c.occasions || []).find((o) => o && o.type === type) || null;
    const saved = occ && parse(occ.date) ? occ.date.slice(0, 10) : '';
    const next = occ ? nextOccurrence(occ, now) : null;
    const date = saved || shared || '';
    return {
      contact: c, held: Boolean(occ), savedDate: saved, date,
      dateSource: saved ? 'saved' : shared ? 'shared' : 'missing',
      next, status: occ ? (next ? upcomingStatus(c.id, occ, next, upcomingRows) : saved ? { key: 'passed', label: 'Date passed', tone: 'muted', planned: false, source: 'record' } : { key: 'nodate', label: 'Date needed', tone: 'amber', planned: false, source: 'record' }) : null,
      gift: (c.occasionGiftSettings || {})[type] || null,
    };
  });
  rows.sort((a, b) => (a.held === b.held ? (a.next?.daysUntil ?? 1e9) - (b.next?.daysUntil ?? 1e9) || String(a.contact.name).localeCompare(String(b.contact.name)) : a.held ? -1 : 1));
  return { type, label: occasionLabel(type), kind, sharedDate: shared, rows };
}

/** One line per occasion for the Occasions list: who holds it, the soonest date, how many are planned. */
export function occasionSummaries(contacts, upcomingRows = [], sent = [], now = new Date()) {
  const out = {};
  for (const g of OCCASION_GROUPS) for (const type of g.types) {
    const r = occasionRoster(contacts, type, upcomingRows, now);
    const held = r.rows.filter((x) => x.held);
    const soonest = held.map((x) => x.next).filter(Boolean).sort((a, b) => a.daysUntil - b.daysUntil)[0] || null;
    out[type] = {
      type, label: r.label, icon: occasionIcon(type), kind: r.kind, sharedDate: r.sharedDate,
      heldCount: held.length, plannedCount: held.filter((x) => x.status && x.status.planned).length,
      missingCount: held.filter((x) => x.dateSource === 'missing').length, soonest,
      pastCount: (sent || []).filter((s) => sendOccasionType(s) === type).length,
    };
  }
  return out;
}

/** Past sends for one occasion (real sends only). */
export const pastForOccasion = (sent, type) => (sent || []).filter((s) => sendOccasionType(s) === type).map(sendItem)
  .sort((a, b) => String(b.when).localeCompare(String(a.when)));

/** The next saved occasion across everyone (the "Next up" line), or null. */
export function nextUp(contacts, upcomingRows = [], now = new Date()) {
  let best = null;
  for (const c of contacts || []) for (const u of upcomingForContact(c, upcomingRows, now)) {
    if (u.missingDate) continue;
    if (!best || u.daysUntil < best.daysUntil) best = { ...u, contact: c };
  }
  return best;
}

/**
 * Starting from an occasion, several people at once: the dashboard's own Dates & gifts resolver (DashboardHome) is
 * opened with these choices, through its existing one-round-trip launcher state (utils/dashboardLauncherState.js).
 * It saves each person's full record (PUT /api/contacts/:id), keeping their other occasions.
 */
export const launcherChoicesForOccasion = (label, contactIds) => ({
  mode: 'occasion', occasions: [label], audience: 'one', picks: contactIds.map(String), excluded: [], whoDone: true, datesOpen: true,
});
