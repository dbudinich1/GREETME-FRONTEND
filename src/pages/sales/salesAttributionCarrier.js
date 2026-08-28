// src/pages/sales/salesAttributionCarrier.js
//
// TEAM B (SALES S1) — salesperson attribution carrier. Carries ONLY the opaque
// salesperson token from the public /#/s/:token landing through the ordinary
// sign-up / subscription journey to Checkout, mirroring the existing fundraiser
// carrier (pages/fundraiser/attributionCarrier.js) and the checkout
// sessionStorage pattern it follows.
//
// It never decodes the token, never derives a salesperson identity, and never
// persists to a cookie, localStorage, server session, or profile state. The
// browser therefore holds an opaque string and nothing else — the server is the
// only place a salesperson identity exists.
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

// Opaque syntax bounds only — a client-side sanity check, NEVER treated as
// verification. The backend issues base64url tokens of 32 random bytes
// (services/sales/salesModel.js#generateAttributionToken), so 43 characters is
// the expected length; the range stays deliberately generous. No decoding.
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
export function isValidTokenSyntax(t) { return typeof t === "string" && TOKEN_RE.test(t); }

function store() {
  try {
    return typeof sessionStorage !== "undefined"
      ? sessionStorage
      : (typeof globalThis !== "undefined" ? globalThis.sessionStorage : null);
  } catch { return null; }
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
  const s = store(); if (!s) return false;
  const incumbent = readToken();
  // Already held by someone. The first referral stands; re-following the same link is a no-op
  // that still reports success, because the carrier does hold that token.
  if (incumbent !== null) return incumbent === rawToken;
  try { s.setItem(SALES_ATTRIBUTION_KEY, rawToken); return true; } catch { return false; }
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
  const s = store(); if (!s) return false;
  if (readToken() === null) return false;          // nothing to replace; captureToken owns that
  try { s.setItem(SALES_ATTRIBUTION_KEY, rawToken); return true; } catch { return false; }
}

/** Read the preserved token (only if syntactically valid). Never throws. */
export function readToken() {
  const s = store(); if (!s) return null;
  let v = null;
  try { v = s.getItem(SALES_ATTRIBUTION_KEY); } catch { return null; }
  return isValidTokenSyntax(v) ? v : null;
}

/**
 * Strictly clear the carrier. Called after a definitively completed checkout —
 * the attribution is by then permanent server-side, bound to the paid
 * subscription, so the browser copy has no further purpose. Renewals need no
 * carrier at all: they resolve from the durable binding.
 */
export function clearToken() {
  const s = store(); if (!s) return;
  try { s.removeItem(SALES_ATTRIBUTION_KEY); } catch { /* noop */ }
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
