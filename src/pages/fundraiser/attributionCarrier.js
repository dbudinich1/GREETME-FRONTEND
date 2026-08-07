// src/pages/fundraiser/attributionCarrier.js
//
// TEAM B — Fundraiser attribution-carrier precursor. Carries ONLY the opaque participant token from
// the public /#/f/:token referral landing through the personal-subscription journey to Checkout,
// mirroring the EXISTING checkout sessionStorage pattern (Cart sets `greetme_g1g1_checkout`, Checkout
// reads it). Strictly cleared. Never decodes the token, never derives org/campaign/participant
// identity, never persists in a cookie / server session / localStorage / global profile state.
//
// The token is submitted at checkout as `fundraiserAttributionToken` ONLY for a personal SUBSCRIPTION
// or fundraiser MERCH purchase, AND ONLY while the Fundraiser UI flag is enabled. It is never attached
// to gifts, QR Cash, G1G1, onboarding fees, or any other one-time/unrelated checkout.

export const FUNDRAISER_ATTRIBUTION_KEY = "greetme_fundraiser_attribution";

// Opaque token syntax only (client-side bounds check — NEVER treated as server verification). Matches
// the backend id shape `ftk_<base62-ish>` with conservative bounds. No decoding of contents.
const TOKEN_RE = /^ftk_[A-Za-z0-9_-]{8,128}$/;
export function isValidTokenSyntax(t) { return typeof t === "string" && TOKEN_RE.test(t); }

function store() {
  try { return typeof sessionStorage !== "undefined" ? sessionStorage : (typeof globalThis !== "undefined" ? globalThis.sessionStorage : null); }
  catch { return null; }
}

// Capture a token from the referral landing. Fail-safe: an absent/malformed token is NOT stored, so
// no attributed journey begins. Returns true iff a valid token was captured.
export function captureToken(rawToken) {
  if (!isValidTokenSyntax(rawToken)) return false;
  const s = store(); if (!s) return false;
  try { s.setItem(FUNDRAISER_ATTRIBUTION_KEY, rawToken); return true; } catch { return false; }
}

// Read the preserved token (only if syntactically valid). Never throws.
export function readToken() {
  const s = store(); if (!s) return null;
  let v = null; try { v = s.getItem(FUNDRAISER_ATTRIBUTION_KEY); } catch { return null; }
  return isValidTokenSyntax(v) ? v : null;
}

// Strictly clear the preserved token (after completion/cancellation, or before an unrelated purchase).
export function clearToken() {
  const s = store(); if (!s) return;
  try { s.removeItem(FUNDRAISER_ATTRIBUTION_KEY); } catch { /* noop */ }
}

// The checkout-request fragment. Returns `{ fundraiserAttributionToken }` ONLY when the Fundraiser UI
// flag is enabled AND the purchase is a personal subscription OR fundraiser merch AND a valid token is
// preserved; else `{}` (the field is omitted entirely). Every other purchase type — gift, QR Cash,
// G1G1, onboarding, or any other one-time purchase — is prohibited and yields `{}`. Carries ONLY the
// opaque token — never org/campaign/participant/economics/payout data.
export function fundraiserCheckoutField({ purchaseType, flagEnabled } = {}) {
  if (!flagEnabled) return {};
  if (purchaseType !== "subscription" && purchaseType !== "merch") return {};
  const token = readToken();
  return token ? { fundraiserAttributionToken: token } : {};
}
