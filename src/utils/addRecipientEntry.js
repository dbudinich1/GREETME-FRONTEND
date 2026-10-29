// src/utils/addRecipientEntry.js
//
// ONE way into Add Recipient (lane 1, 2026-10-28). Every entry point — Home's Add Recipient buttons, the send editor's
// "+ Add Recipient" / "+ Add New", and Celebrations' Add Recipient — opens the SAME full "Add New Recipient" dialog on
// the Recipients page (Contacts.jsx + ContactForm.jsx: contact information, relationship, memory photos, Occasion
// Scheduler). There is no second recipient form.
//
// When the dialog is opened from a composition, the composition says where to come back to (`returnTo`):
//   'dashboard' — Home's launcher. Its choices are kept in the launcher snapshot (utils/dashboardLauncherState.js); after
//                 a save the new recipient's id is added to that snapshot so Home selects them on return.
//   'send'      — the send editor. Its greeting is kept in the existing `sendGreetingState` record (the same one the
//                 Gift Place round trip uses); it comes back on /dashboard/send?returnTo=send, with
//                 &addedContactId=<id> after a save so the new recipient is selected.
// Cancel/close returns to the same place with nothing changed. Nothing here talks to the server.
import { LAUNCHER_STATE_KEY, readLauncherState } from './dashboardLauncherState.js';

export const ADD_RECIPIENT_PATH = '/dashboard/contacts';
export const ADD_RECIPIENT_RETURNS = Object.freeze(['dashboard', 'send']);

/** The navigation that opens the full Add New Recipient dialog: navigate(entry.to, entry.opts). */
export function addRecipientEntry(returnTo = null) {
  const state = { openAddRecipient: true };
  if (ADD_RECIPIENT_RETURNS.includes(returnTo)) state.returnTo = returnTo;
  return { to: ADD_RECIPIENT_PATH, opts: { state } };
}

/** Where the Recipients page should go back to after this visit: 'dashboard', 'send' or null (stay). */
export function readAddRecipientReturn(locationState) {
  const r = locationState && locationState.returnTo;
  return ADD_RECIPIENT_RETURNS.includes(r) ? r : null;
}

/** A recipient id as stored by the server (string or number), or null for anything else. */
export function safeRecipientId(id) {
  if (typeof id !== 'string' && typeof id !== 'number') return null;
  const s = String(id).trim();
  return /^[A-Za-z0-9_-]{1,100}$/.test(s) ? s : null;
}

/** The send editor's return URL: its kept greeting is restored by ?returnTo=send; a saved recipient is selected. */
export function sendReturnPath(addedId = null) {
  const params = new URLSearchParams({ returnTo: 'send' });
  const id = safeRecipientId(addedId);
  if (id) params.set('addedContactId', id);
  return `/dashboard/send?${params.toString()}`;
}

/** The recipient just added from the send editor (from its return URL), or null. */
export function readAddedContactId(search) {
  try { return safeRecipientId(new URLSearchParams(search || '').get('addedContactId')); } catch { return null; }
}

/**
 * Record, in Home's kept launcher snapshot, the recipient just added, so Home selects them when it restores the
 * snapshot. Only an existing, current snapshot for this account is touched. @returns {boolean} recorded
 */
export function noteAddedRecipientForDashboard(storage, userId, addedId) {
  const id = safeRecipientId(addedId);
  if (!id) return false;
  const snap = readLauncherState(storage, userId);
  if (!snap) return false;
  try { storage.setItem(LAUNCHER_STATE_KEY, JSON.stringify({ ...snap, addedRecipientId: id })); return true; } catch { return false; }
}

/**
 * Home's people after a recipient was added from it: the new person is added to the "one or several people" picks
 * when Home's own rules allow it (not a group audience, under the group limit, and not when several occasions are
 * chosen for someone already picked). Otherwise the picks are unchanged; the new person is still in the list.
 */
export function picksWithAddedRecipient({ picks, audience, occasions, addedId, max }) {
  const cur = Array.isArray(picks) ? picks : [];
  const id = safeRecipientId(addedId);
  if (!id || audience !== 'one') return cur;
  if (cur.some((p) => String(p) === id)) return cur;
  if (Array.isArray(occasions) && occasions.length > 1 && cur.length >= 1) return cur;
  if (Number.isFinite(max) && cur.length >= max) return cur;
  return [...cur, id];
}
