// src/api/founderContacts.js - W46 founder contact book transport (founder-only on the server: requireAuth + requireFounder).
// Contract: reports/closeout-sprint/contracts/T3-command-center-backend-contract.md section B. DELETE is a permanent delete.
const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || "";
const BASE = "/api/founder/contacts";

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
const qs = (o = {}) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v !== undefined && v !== null && v !== "" && v !== false) p.set(k, String(v));
  const t = p.toString();
  return t ? `?${t}` : "";
};

export const founderContactsApi = {
  /** GET /?q=&category=&tag=&followUpDue=&sort=&limit= -> { ok, contacts, counts:{total,followUpDue}, categories } */
  list: (params) => req("GET", `${BASE}${qs(params)}`),
  read: (id) => req("GET", `${BASE}/${encodeURIComponent(id)}`),
  create: (contact) => req("POST", BASE, contact),
  update: (id, fields) => req("PATCH", `${BASE}/${encodeURIComponent(id)}`, fields),
  /** PERMANENT delete. */
  remove: (id) => req("DELETE", `${BASE}/${encodeURIComponent(id)}`),
};

export function founderContactsErrorMessage(res) {
  if (!res) return "That didn't go through. Please try again.";
  if (res.networkError) return "Couldn't reach the server. Check your connection and try again.";
  if (res.status === 401) return "Your session has expired. Sign in again to continue.";
  if (res.status === 403) return "This area is limited to the founder account.";
  if (res.status === 404) return "That contact no longer exists.";
  if (res.status === 400) return "Some details aren't valid. Check the highlighted fields.";
  if (res.status === 429) return "Too many requests. Wait a moment and try again.";
  return "That didn't go through. Please try again.";
}
