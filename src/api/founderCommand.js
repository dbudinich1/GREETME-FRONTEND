// src/api/founderCommand.js — TEAM 5 (Founder Central Command), 2026-09-29.
//
// Thin transport over routes/founderCommandRoutes.js, which already exists and is already
// founder-guarded server-side (requireAuth + requireFounder). Mirrors the same request shape
// salesAdminApi.js/fundraiserApi.js already use — one request story, not a new one.

const API_BASE = (import.meta && import.meta.env && import.meta.env.VITE_API_BASE) || "";

function authHeaders() {
  let token = null;
  try { token = localStorage.getItem("token"); } catch { /* no-op */ }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function get(endpoint) {
  let res, data = null;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { method: "GET", headers: authHeaders() });
  } catch {
    return { ok: false, status: 0, data: null, networkError: true };
  }
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

export const founderCommandApi = {
  qrCashPayoutSummary: () => get("/api/founder/command/qr-cash-payouts/summary"),
  qrCashPayoutList: () => get("/api/founder/command/qr-cash-payouts"),
};
