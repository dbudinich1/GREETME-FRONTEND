// src/api/salesAdmin.js
//
// TEAM B — SALES S1 · founder-only salesperson management client.
//
// This is a thin transport over endpoints that ALREADY exist and are already founder-guarded
// server-side (`routes/salesRoutes.js`, every admin route behind `requireAuth, requireFounder`).
// It adds no capability. The backend remains the authority: this client never decides who may
// call anything, and a founder-only UI is a convenience, never a control.
//
// Deliberately mirrors `fundraiserApi.js` — same Bearer-from-localStorage read, same
// `{ ok, status, data }` envelope, same network-failure shape — so there is one request story in
// this codebase rather than two.
//
// TOKEN HANDLING, stated once and enforced throughout:
// the raw attribution token is returned by create and rotate EXACTLY ONCE. It is passed straight
// back to the caller and is never written to localStorage, sessionStorage, a cookie, a query
// string, or a log line by this module. Nothing here persists it, so a refresh cannot reproduce
// it — that is a property of the code, not a promise.

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || "";

function authHeaders(extra = {}) {
  let token = null;
  try { token = localStorage.getItem("token"); } catch { /* no-op */ }
  return { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra };
}

async function req(method, endpoint, body) {
  let res, data = null;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: body ? authHeaders({ "Content-Type": "application/json" }) : authHeaders(),
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, data: null, networkError: true };
  }
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

const get = (e) => req("GET", e);
const post = (e, b) => req("POST", e, b);

const BASE = "/api/sales/admin/salespeople";
const one = (id) => `${BASE}/${encodeURIComponent(id)}`;

export const salesAdminApi = {
  /** GET /api/sales/admin/salespeople → { ok, salespeople: [...] } */
  list: () => get(BASE),

  /** GET /api/sales/admin/salespeople/:id → { ok, salesperson } | 404 */
  read: (salespersonId) => get(one(salespersonId)),

  /**
   * POST /api/sales/admin/salespeople
   *
   * `email` is OPTIONAL server-side and is omitted entirely when blank rather than sent as "",
   * because the backend's own comment is explicit that an invented address is indistinguishable
   * from a real one once stored.
   *
   * 201 → { ok, salesperson, attributionToken, attributionLink }  ← the link is shown ONCE
   * 400 → invalid request · 409 → already exists
   */
  create: ({ salespersonId, displayName, email } = {}) => {
    // Trimmed HERE, not only in the page. A stray space in an identifier is indistinguishable
    // from a deliberate one once stored, and the client is the last place that can see both.
    const str = (v) => (typeof v === "string" ? v.trim() : v);
    const body = { salespersonId: str(salespersonId), displayName: str(displayName) };
    const mail = str(email);
    if (mail) body.email = mail;
    return post(BASE, body);
  },
};

/**
 * Turn a transport envelope into one sentence a founder can act on.
 *
 * Deliberately NOT a passthrough of the server's `code`: internal codes, stack traces and flag
 * names are not user-facing text. Unknown failures fall back to a plain, honest sentence rather
 * than exposing whatever the backend happened to say.
 */
export function salesAdminErrorMessage(res, { context = "load" } = {}) {
  if (!res) return "That didn’t go through. Please try again.";
  if (res.networkError) return "Couldn’t reach the server. Check your connection and try again.";
  switch (res.status) {
    case 401: return "Your session has expired. Sign in again to continue.";
    case 403: return "This area is limited to the founder account.";
    case 404: return context === "read" ? "That salesperson no longer exists." : "Not found.";
    case 409: return "A salesperson with that ID already exists. Choose a different ID.";
    case 400: return "Check the details and try again.";
    default:  return "That didn’t go through. Please try again.";
  }
}

export default salesAdminApi;
