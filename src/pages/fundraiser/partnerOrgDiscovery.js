// src/pages/fundraiser/partnerOrgDiscovery.js
//
// TEAM D (B3B) — pure, React-free helpers for partner organization discovery. Extracted so the
// routing decision is unit-testable without a DOM. No fetch, no state, no side effects.

// The EXISTING org-scoped partner dashboard route (registered in App.jsx, H17 — never modified here).
export function partnerDashboardPath(organizationId) {
  return `/dashboard/fundraiser/partner/${organizationId}`;
}

// Routing decision from a discovery result. Zero → empty; exactly one → single (auto-open); more
// than one → multiple (chooser). NEVER selects a default when multiple organizations exist.
export function classifyOrganizations(organizations) {
  const list = Array.isArray(organizations) ? organizations : [];
  if (list.length === 0) return { mode: "empty", organizationId: null };
  if (list.length === 1) return { mode: "single", organizationId: list[0].organizationId };
  return { mode: "multiple", organizationId: null };
}
