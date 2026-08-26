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
 * Capture a token from the referral landing. Fail-safe: an absent or malformed
 * token is NOT stored, so no attributed journey begins.
 * @returns {boolean} true iff a valid token was captured
 */
export function captureToken(rawToken) {
  if (!isValidTokenSyntax(rawToken)) return false;
  const s = store(); if (!s) return false;
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
