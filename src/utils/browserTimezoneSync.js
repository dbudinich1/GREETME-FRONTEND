// src/utils/browserTimezoneSync.js
//
// CL-03 (Release 1 FE): tell the server the browser's timezone, once per browser session, but only
// when the server has no timezone source for this account yet (profile.timezoneSource null/absent).
// The server decides whether to apply it (PATCH /api/profile/timezone -> { ok, timezone, changed }).
//
// Contract: this NEVER throws, NEVER shows UI and never blocks login. Failures are silent.
// It is never sent when the server already has a source (e.g. the user chose one in Settings).

const SESSION_KEY = 'greetme_tz_sync_attempted';
let attemptedThisPageLoad = false; // covers browsers where sessionStorage is unavailable

function alreadyAttempted() {
  if (attemptedThisPageLoad) return true;
  try { return sessionStorage.getItem(SESSION_KEY) === '1'; } catch { return false; }
}

function markAttempted() {
  attemptedThisPageLoad = true;
  try { sessionStorage.setItem(SESSION_KEY, '1'); } catch { /* ignore */ }
}

export function getBrowserTimezone() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return typeof tz === 'string' && tz.trim() ? tz.trim() : null;
  } catch {
    return null;
  }
}

// Test hook only: resets the in-memory once-per-session guard.
export function __resetBrowserTimezoneSyncForTests() {
  attemptedThisPageLoad = false;
  try { sessionStorage.removeItem(SESSION_KEY); } catch { /* ignore */ }
}

/**
 * @param {object} args
 * @param {object} args.profile  the GET /api/profile `profile` object (already loaded)
 * @param {string} args.token    bearer token of the logged-in user
 * @param {string} args.apiBase  API base URL
 * @param {Function} [args.fetchImpl]  injectable fetch (tests)
 * @returns {Promise<boolean>} true if a request was attempted (informational only)
 */
export async function syncBrowserTimezone({ profile, token, apiBase, fetchImpl } = {}) {
  try {
    if (!profile || !token) return false;
    if (profile.timezoneSource !== null && profile.timezoneSource !== undefined) return false;
    if (alreadyAttempted()) return false;
    const timezone = getBrowserTimezone();
    if (!timezone) return false;
    markAttempted();
    const doFetch = fetchImpl || (typeof fetch === 'function' ? fetch : null);
    if (!doFetch) return false;
    await doFetch(`${apiBase || ''}/api/profile/timezone`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ timezone, source: 'browser' }),
    });
    return true;
  } catch {
    return false; // silent by contract
  }
}
