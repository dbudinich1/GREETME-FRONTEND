// src/components/guidedSetupRouteExclusion.js
//
// Report 87 A7 (founder rule, Q7): the Hearts welcome popup (GuidedSetupFlow) must NOT show on the
// public Fundraisers page. This is a ROUTE-SPECIFIC exclusion only: shouldShowGuidedSetupForUser, the
// Hearts earning rules and the popup on every other page are untouched.
const EXCLUDED_ROUTES = Object.freeze(["/fundraisers"]);

/** True only for the public Fundraisers page (a trailing slash is tolerated). */
export function isGuidedSetupExcludedRoute(pathname) {
  const p = String(pathname || "").replace(/\/+$/, "") || "/";
  return EXCLUDED_ROUTES.includes(p);
}
