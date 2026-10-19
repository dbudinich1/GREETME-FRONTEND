// src/utils/dashboardLauncherState.js
//
// The dashboard's in-progress choices (mode, occasions, people, words, memory photos, gift, dates and gifts) kept
// for ONE round trip to the Recipients page — editing a recipient, or opening their Occasion Scheduler — so the
// sender comes back to exactly what they had. Stored in sessionStorage (this tab only), stamped with the account
// that made it, read once and then cleared. Nothing here is saved to the server or scheduled.
export const LAUNCHER_STATE_KEY = 'gm_dashboard_launcher_v1';
export const LAUNCHER_STATE_MAX_AGE_MS = 2 * 60 * 60 * 1000;

const FIELDS = ['mode', 'occasions', 'audience', 'picks', 'excluded', 'words', 'memoryPhotos', 'gift', 'whoDone', 'persDone', 'rows', 'groupDefaultGift', 'datesOpen'];

/**
 * Keep the launcher's choices. Memory photos are large (data URLs); if they don't fit, the rest is kept without them.
 * @returns {'all'|'without_photos'|'none'}
 */
export function saveLauncherState(storage, userId, state, now = Date.now()) {
  if (!storage || !userId) return 'none';
  const snap = { v: 1, userId: String(userId), savedAt: now };
  for (const f of FIELDS) if (state[f] !== undefined) snap[f] = state[f];
  try { storage.setItem(LAUNCHER_STATE_KEY, JSON.stringify(snap)); return 'all'; } catch { /* quota: retry without photos */ }
  try {
    storage.setItem(LAUNCHER_STATE_KEY, JSON.stringify({ ...snap, memoryPhotos: [], photosDropped: (state.memoryPhotos || []).length }));
    return 'without_photos';
  } catch { return 'none'; }
}

/** The kept choices for this account, or null (none, another account's, too old, or unreadable). Does not clear. */
export function readLauncherState(storage, userId, now = Date.now()) {
  if (!storage || !userId) return null;
  let snap;
  try { snap = JSON.parse(storage.getItem(LAUNCHER_STATE_KEY) || 'null'); } catch { return null; }
  if (!snap || snap.v !== 1 || snap.userId !== String(userId)) return null;
  if (!Number.isFinite(snap.savedAt) || now - snap.savedAt > LAUNCHER_STATE_MAX_AGE_MS || now < snap.savedAt) return null;
  return snap;
}

export function clearLauncherState(storage) {
  try { if (storage) storage.removeItem(LAUNCHER_STATE_KEY); } catch { /* nothing to clear */ }
}
