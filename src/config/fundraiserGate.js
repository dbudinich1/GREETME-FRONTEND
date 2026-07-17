// src/config/fundraiserGate.js
//
// TEAM B — frontend dark gate for the fundraising dashboards. DEFAULT FALSE. While false, no
// navigation is shown and the routes render a truthful "not available" state. This gate NEVER
// grants access on its own: every dashboard's data comes from the backend, which enforces
// authentication + role on every request (401/403/503). No client-side role value grants access.
export function isFundraiserUiEnabled() {
  try { return import.meta.env.VITE_FUNDRAISER_ENABLED === "true"; } catch { return false; }
}
