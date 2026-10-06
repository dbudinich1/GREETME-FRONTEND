// src/api/founderUserGuide.js - founder-only User Guide (W48) transport. Contract: reports/closeout-sprint/contracts/T3-user-guide-contract.md.
// The login token goes ONLY in the Authorization header, never in a URL. The file URL returned by the server is a short-lived
// storage-domain link: it is used immediately and never stored, cached or logged.
const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || "";
const BASE = "/api/founder/user-guide";

function authHeaders() {
  let token = null;
  try { token = localStorage.getItem("token"); } catch { /* no-op */ }
  return token ? { Authorization: `Bearer ${token}` } : {};
}
async function get(endpoint) {
  let res; let data = null;
  try { res = await fetch(`${API_BASE}${endpoint}`, { method: "GET", headers: authHeaders() }); } catch { return { ok: false, status: 0, data: null, networkError: true }; }
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

export const founderUserGuideApi = {
  /** GET -> { ok, configured, files:[20 manifest entries] } */
  list: () => get(BASE),
  /** GET files/:id?disposition=inline|attachment -> { ok, url, expiresAt, filename, ... }. Request a fresh one for every click. */
  fileUrl: (id, disposition) => get(`${BASE}/files/${encodeURIComponent(id)}${disposition ? `?disposition=${encodeURIComponent(disposition)}` : ""}`),
};
