// src/pages/sales/salesAttributionCarrier.js
//
// TEAM B (SALES S1) — salesperson attribution carrier. Carries ONLY the opaque
// salesperson token from the public /#/s/:token landing through the ordinary
// sign-up / subscription journey to Checkout, mirroring the existing fundraiser
// carrier (pages/fundraiser/attributionCarrier.js).
//
// It never decodes the token, never derives a salesperson identity, and never
// persists to a cookie, server session, or profile state. The browser therefore
// holds an opaque string (plus the moment it was captured) and nothing else — the
// server is the only place a salesperson identity exists.
//
// ── DURABLE ACROSS TABS (SALES-ATTR-A) ───────────────────────────────────────
// The carrier lives in localStorage as `{ code, capturedAt }`, not tab-scoped sessionStorage. A
// brand-new prospect must verify their email before checkout, and the verification link opens a
// NEW tab whose sessionStorage is empty — with a tab-scoped carrier that sale reached checkout
// unattributed. localStorage survives the new tab.
//
// The held code expires after ANONYMOUS_WINDOW_DAYS (30), matching the backend's founder-ratified
// anonymous attribution window (BACKEND services/sales/salesConstants.js
// ANONYMOUS_ATTRIBUTION_WINDOW_DAYS = 30). An expired or malformed value is ignored and cleared.
// A legacy sessionStorage value (a pre-change, in-flight visitor) is migrated once. Where
// localStorage is unavailable or throws, the carrier falls back to the previous sessionStorage
// behaviour exactly.
//
// The carrier is NOT cleared on logout: on a shared browser a later account could inherit an
// unexpired referral, which is judged minor next to silently losing attribution. It is cleared
// only after a definitively created subscription checkout session (Checkout.jsx).
//
// The token is submitted at checkout as `salesAttributionToken` for a personal
// SUBSCRIPTION only. It is never attached to gifts, QR Cash, G1G1, merchandise,
// onboarding fees, or any other one-time purchase.
//
// ── FIRST TOUCH (founder decision) ───────────────────────────────────────────
// When a prospect follows links from more than one salesperson before subscribing, the FIRST
// valid referral is credited. The carrier is therefore write-once for as long as it holds a
// token: a later link is read, found to be surplus, and discarded without an error — the visitor
// simply carries on.
//
// The single exception is a first token that the SERVER says is no longer live (rotated away,
// or its salesperson deactivated). Only then may the next valid token take its place, and only
// via `replaceRetiredIncumbent`, which refuses to act on anything but an explicit server verdict.
// The browser never decides that a token is dead — it cannot tell "revoked" from "not yet
// enabled" from "network down", and guessing wrong would silently move someone's commission.

export const SALES_ATTRIBUTION_KEY = "greetme_sales_attribution";

// Mirrors BACKEND services/sales/salesConstants.js ANONYMOUS_ATTRIBUTION_WINDOW_DAYS.
export const ANONYMOUS_WINDOW_DAYS = 30;
export const ANONYMOUS_WINDOW_MS = ANONYMOUS_WINDOW_DAYS * 24 * 60 * 60 * 1000;
// Tolerated clock skew for a capturedAt in the future; anything further ahead is malformed.
const FUTURE_SKEW_MS = 5 * 60 * 1000;

// Opaque syntax bounds only — a client-side sanity check, NEVER treated as
// verification. The backend issues base64url tokens of 32 random bytes
// (services/sales/salesModel.js#generateAttributionToken), so 43 characters is
// the expected length; the range stays deliberately generous. No decoding.
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
// The vanity alias is the OTHER public referral form: lowercase, 2-40, internal single hyphens.
// Two shapes, ONE carrier slot and one checkout field — the server decides which (if either) names
// a salesperson. Widening the syntax check here grants nothing: it only decides what is worth
// carrying as far as the server.
const ALIAS_RE = /^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){0,38}[a-z0-9]$/;
export function isValidTokenSyntax(t) {
  return typeof t === "string" && (TOKEN_RE.test(t) || ALIAS_RE.test(t));
}

// ── storage access: every touch is wrapped, nothing here may throw ─────────

function sessionStore() {
  try {
    return typeof sessionStorage !== "undefined"
      ? sessionStorage
      : (typeof globalThis !== "undefined" ? globalThis.sessionStorage : null);
  } catch { return null; }
}

/** A usable localStorage, or null (absent, blocked, or throwing). Probed on every call. */
function durableStore() {
  let ls = null;
  try { ls = typeof globalThis !== "undefined" ? globalThis.localStorage : null; } catch { return null; }
  if (!ls || typeof ls.getItem !== "function" || typeof ls.setItem !== "function"
    || typeof ls.removeItem !== "function") return null;
  try {
    const probe = "__greetme_sales_probe__";
    ls.setItem(probe, "1");
    ls.removeItem(probe);
  } catch { return null; }
  return ls;
}

function safeGet(s, k) { try { return s.getItem(k); } catch { return null; } }
function safeSet(s, k, v) { try { s.setItem(k, v); return true; } catch { return false; } }
function safeRemove(s, k) { try { s.removeItem(k); } catch { /* noop */ } }

/** The durable record's code, or null — clearing the slot when it is malformed or expired. */
function readDurable(ls, now = Date.now()) {
  const raw = safeGet(ls, SALES_ATTRIBUTION_KEY);
  if (raw === null || raw === undefined) return null;
  let rec = null;
  try { rec = JSON.parse(raw); } catch { rec = null; }
  const ok = rec && typeof rec === "object";
  const code = ok ? rec.code : null;
  const at = ok && typeof rec.capturedAt === "string" ? Date.parse(rec.capturedAt) : NaN;
  if (!isValidTokenSyntax(code) || Number.isNaN(at)
    || at > now + FUTURE_SKEW_MS || now >= at + ANONYMOUS_WINDOW_MS) {
    safeRemove(ls, SALES_ATTRIBUTION_KEY);   // expired or invalid ⇒ ignored and cleared
    return null;
  }
  return code;
}

function writeDurable(ls, code) {
  return safeSet(ls, SALES_ATTRIBUTION_KEY, JSON.stringify({ code, capturedAt: new Date().toISOString() }));
}

/**
 * One-time migration: a pre-change visitor holds a plain token in sessionStorage. If localStorage
 * holds nothing live, move it over (capturedAt = now — the original moment was never recorded)
 * and drop the tab copy. A live durable code is never overwritten: first touch stands.
 */
function migrateLegacy(ls) {
  const ss = sessionStore(); if (!ss) return;
  const legacy = safeGet(ss, SALES_ATTRIBUTION_KEY);
  if (legacy === null || legacy === undefined) return;
  if (readDurable(ls) === null && isValidTokenSyntax(legacy)) {
    if (!writeDurable(ls, legacy)) return;   // keep the tab copy if the move failed
  }
  safeRemove(ss, SALES_ATTRIBUTION_KEY);
}

/** Write `code` to the durable store, or — when unavailable — to sessionStorage as before. */
function writeCode(code) {
  const ls = durableStore();
  if (ls) return writeDurable(ls, code);
  const s = sessionStore(); if (!s) return false;
  return safeSet(s, SALES_ATTRIBUTION_KEY, code);
}

/**
 * Capture a token from the referral landing, FIRST TOUCH.
 *
 * Fail-safe in both directions: a malformed token is never stored, and — just as importantly —
 * never erases a token already held. An existing referral is the more valuable of the two, so
 * nothing about a later visit may destroy it.
 *
 * @returns {boolean} true iff the carrier now holds exactly `rawToken` — which covers both the
 *   first capture and re-following the SAME link (a safe no-op). false means the token was not
 *   adopted: either it was malformed, or an earlier salesperson already holds the credit.
 */
export function captureToken(rawToken) {
  if (!isValidTokenSyntax(rawToken)) return false;
  const incumbent = readToken();
  // Already held by someone. The first referral stands; re-following the same link is a no-op
  // that still reports success, because the carrier does hold that token.
  if (incumbent !== null) return incumbent === rawToken;
  return writeCode(rawToken);
}

/**
 * Replace a first token that the SERVER has declared no longer live.
 *
 * `incumbentValid` must be the server's own answer from POST /api/sales/attribution/resolve.
 * Replacement happens ONLY on a definitive `false`. Anything else — true, undefined, null, a
 * dormant 503, a failed request — leaves the first referral exactly where it is, because none of
 * those means "revoked", and treating them as such would hand the credit to the wrong person.
 *
 * @returns {boolean} true iff the carrier was actually rewritten to `rawToken`
 */
export function replaceRetiredIncumbent(rawToken, { incumbentValid } = {}) {
  if (incumbentValid !== false) return false;      // strictly the server's "no", nothing else
  if (!isValidTokenSyntax(rawToken)) return false;
  if (readToken() === null) return false;          // nothing to replace; captureToken owns that
  return writeCode(rawToken);
}

/** Read the preserved token (only if syntactically valid and unexpired). Never throws. */
export function readToken() {
  const ls = durableStore();
  if (ls) {
    migrateLegacy(ls);
    return readDurable(ls);
  }
  const s = sessionStore(); if (!s) return null;
  const v = safeGet(s, SALES_ATTRIBUTION_KEY);
  return isValidTokenSyntax(v) ? v : null;
}

/**
 * Strictly clear the carrier. Called after a definitively completed checkout —
 * the attribution is by then permanent server-side, bound to the paid
 * subscription, so the browser copy has no further purpose. Renewals need no
 * carrier at all: they resolve from the durable binding. Clears BOTH stores.
 */
export function clearToken() {
  const ls = durableStore(); if (ls) safeRemove(ls, SALES_ATTRIBUTION_KEY);
  const s = sessionStore(); if (s) safeRemove(s, SALES_ATTRIBUTION_KEY);
}

/**
 * The checkout-request fragment.
 *
 * Returns `{ salesAttributionToken }` ONLY for a personal subscription with a
 * valid preserved token; otherwise `{}` so the field is omitted entirely and
 * ordinary checkout behaviour is exactly unchanged.
 *
 * Carries ONLY the opaque token — never a salespersonId, never a rate, never
 * earnings. The server resolves the token and is the sole authority on identity.
 */
export function salesCheckoutField({ purchaseType } = {}) {
  if (purchaseType !== "subscription") return {};
  const token = readToken();
  return token ? { salesAttributionToken: token } : {};
}

/**
 * SALES-ATTR-B — the register / login request fragment.
 *
 * Returns `{ salesAttributionCode }` when a valid code is held, otherwise `{}` so the field is
 * omitted and the auth request is byte-identical to before. The server resolves the code and
 * records the durable pending attribution, so it survives a verification link opened in another
 * browser profile or device. Does NOT clear the carrier — the clear stays at checkout.
 */
export function salesAuthField() {
  const code = readToken();
  return code ? { salesAttributionCode: code } : {};
}
