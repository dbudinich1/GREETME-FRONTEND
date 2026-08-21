// src/pages/contactScopeView.js
//
// TEAM D — SLICE E6: the Personal / Business view on the Recipients page.
//
// WHY A VIEW AND NOT A MERGE. Personal and Corporate contacts already share one Cosmos container
// (partition /userId): a Corporate record stores userId = corporateOrganizationId together with
// contactScope "corporate", a Personal one stores the owner's user id. Nothing needs migrating.
// What must NOT happen is a single query that returns both — services/contactScope.js states the
// contract plainly: PERSONAL_SCOPE_SQL admits only an ABSENT scope (legacy) or exactly "personal",
// and "not corporate" is explicitly NOT equivalent to "personal". Relaxing that predicate to make
// one request serve both surfaces would dismantle a deliberate fail-closed boundary.
//
// So: ONE PAGE, TWO ENDPOINTS. The toggle chooses which to call. Neither query learns about the
// other, and the boundary is exactly where it already was.

export const VIEW_SCOPE = Object.freeze({ PERSONAL: "personal", BUSINESS: "business" });

/**
 * May this viewer see the Business view at all?
 *
 * MEMBERSHIP, NEVER SUBSCRIPTION. Subscription tier is a BILLING fact; contact scope is a DATA
 * OWNERSHIP fact. Tying the two together means a declined card, a downgrade, or a trial ending
 * silently changes how existing records are interpreted — an organization whose payment bounces
 * would have its roster re-read as personal, or vanish. Active membership is the fact that
 * actually answers "does this person have a business roster", and it is already the canonical
 * source of organization context everywhere else on the corporate surface.
 *
 * STRICT and FAIL-CLOSED: anything other than a successful response carrying at least one active
 * membership yields false, so a dormant flag, an expired token, or an unreadable body all hide
 * the view rather than offering one that cannot load.
 */
export function canUseBusinessView(membershipResult) {
  if (!membershipResult || membershipResult.ok !== true) return false;
  const list = membershipResult.data && membershipResult.data.memberships;
  if (!Array.isArray(list)) return false;
  return list.some((m) => m && m.status === "active" && typeof m.corporateOrganizationId === "string" && m.corporateOrganizationId);
}

/** The organizations this viewer can actually look at, in a stable order. */
export function businessOrganizations(membershipResult) {
  if (!canUseBusinessView(membershipResult)) return [];
  return membershipResult.data.memberships
    .filter((m) => m && m.status === "active" && m.corporateOrganizationId)
    .map((m) => ({ corporateOrganizationId: m.corporateOrganizationId, role: m.role || null }));
}

/**
 * Resolve the scope actually in force.
 *
 * A viewer who loses access while sitting on the Business view — membership revoked, org
 * suspended — is returned to Personal rather than left looking at a list that can no longer load.
 */
export function effectiveScope(requested, membershipResult) {
  if (requested !== VIEW_SCOPE.BUSINESS) return VIEW_SCOPE.PERSONAL;
  return canUseBusinessView(membershipResult) ? VIEW_SCOPE.BUSINESS : VIEW_SCOPE.PERSONAL;
}

// ── the corporate type filter ────────────────────────────────────────────────────────────────
// "all" is a real option rather than an absent filter, so the control always states what it is
// showing instead of leaving the reader to infer it from an empty selection.
export const CORPORATE_TYPE_FILTERS = Object.freeze([
  { key: "all", label: "All" },
  { key: "employee", label: "Employees", abbr: "EMP" },
  { key: "client", label: "Clients", abbr: "CLI" },
  { key: "vendor", label: "Vendors", abbr: "VND" },
]);

/**
 * Filter a corporate roster by contact type.
 *
 * An unknown or missing type is UNCLASSIFIED and belongs to no category — it appears under "All"
 * and under nothing else. It is never quietly folded into Employees, which is the same rule the
 * campaign audience bubbles follow, and for the same reason: a contact must never be reached by a
 * category nobody assigned them to.
 */
export function filterByCorporateType(contacts, filterKey) {
  const list = Array.isArray(contacts) ? contacts : [];
  if (filterKey === "all" || !filterKey) return list;
  const known = CORPORATE_TYPE_FILTERS.some((f) => f.key === filterKey && f.key !== "all");
  if (!known) return list;                       // an unrecognised filter hides nobody
  return list.filter((c) => c && c.corporateContactType === filterKey);
}

/** Counts per filter, so each control can say how many it would show. */
export function corporateTypeCounts(contacts) {
  const list = Array.isArray(contacts) ? contacts : [];
  const counts = { all: list.length };
  for (const f of CORPORATE_TYPE_FILTERS) {
    if (f.key === "all") continue;
    counts[f.key] = list.filter((c) => c && c.corporateContactType === f.key).length;
  }
  return counts;
}

/**
 * What import is still the best route for.
 *
 * SLICE E7 replaced the read-only state: business contacts can now be added, edited and removed
 * one at a time. Import remains the right tool for MANY at once — and, because a re-import updates
 * people who are already here, for correcting many at once too. Kept under its original export
 * name so no caller had to change; the wording no longer claims a restriction that has gone.
 */
export const BUSINESS_READ_ONLY_NOTICE = Object.freeze({
  text: "Add or edit people here one at a time — or import a file to do many at once. A re-import updates people who are already here.",
  actionLabel: "Import business contacts",
  actionPath: "/dashboard/import-wizard?mode=corporate",
});

/** Pull the contacts array out of a corporate list response, fail-closed. */
export function contactsFromCorporateResponse(res) {
  if (!res || res.ok !== true) return [];
  const data = res.data;
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.contacts)) return data.contacts;
  return [];
}
