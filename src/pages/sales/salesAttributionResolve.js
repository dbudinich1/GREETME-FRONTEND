// src/pages/sales/salesAttributionResolve.js
//
// TEAM B (SALES S1) — the one server question the referral landing is allowed to ask:
//
//     "is the token this visitor already carries still live?"
//
// It exists for FIRST-TOUCH attribution. When a visitor who already holds one salesperson's
// token follows a second salesperson's link, the first referral keeps the credit — unless the
// server says that first token has been rotated away or its salesperson deactivated. Only the
// server may say so: the browser cannot tell "revoked" from "not yet enabled" from "offline",
// and guessing wrong moves a commission to the wrong person.
//
// It uses the EXISTING public endpoint (POST /api/sales/attribution/resolve), which answers a
// deliberately generic `{ valid }` and discloses no salesperson identity, rate or id. The token
// travels in the request BODY, never the URL, for the reasons that endpoint documents at length.

function viteApiBase() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_API_BASE) {
      return import.meta.env.VITE_API_BASE;
    }
  } catch { /* import.meta.env not present under node:test */ }
  return "";
}

/**
 * Ask the server whether `token` currently resolves to an active salesperson.
 *
 * THREE-VALUED ON PURPOSE. Only a definitive answer may move a referral:
 *   true  — live; the first referral stands.
 *   false — the server resolved it and says no. This is the ONLY value that permits replacement.
 *   null  — indeterminate: dormant (503), network failure, or an unreadable body. Treated as
 *           "leave it alone", because none of those is evidence that the token is dead.
 */
export async function isTokenStillValid(token, {
  fetchImpl = (typeof fetch !== "undefined" ? fetch : undefined),
  apiBase = viteApiBase(),
} = {}) {
  if (typeof token !== "string" || token.length === 0) return null;
  if (typeof fetchImpl !== "function") return null;

  let res;
  try {
    res = await fetchImpl(`${apiBase}/api/sales/attribution/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
  } catch { return null; }

  // The dormant gate answers 503 { disabled: true }. That is "we did not look", not "it is dead".
  if (!res || res.status === 503) return null;
  if (res.status !== 200) return null;

  let body = null;
  try { body = await res.json(); } catch { return null; }
  if (!body || typeof body !== "object" || body.disabled === true) return null;
  if (body.valid === true) return true;
  if (body.valid === false) return false;
  return null;
}
