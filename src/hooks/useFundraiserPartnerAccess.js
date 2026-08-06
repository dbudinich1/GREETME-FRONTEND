// src/hooks/useFundraiserPartnerAccess.js
//
// TEAM B (PARTNER-READINESS B3) — server-derived "is this caller a partner administrator?" signal
// for NAVIGATION VISIBILITY ONLY.
//
// WHAT THIS IS NOT: it grants nothing. Route access is still enforced by ProtectedRoute, and every
// fundraiser endpoint independently re-authorizes (401 / 403 NO_FUNDRAISER_ROLE / 503). This hook
// only decides whether a menu item is drawn. No client-asserted role is read, invented, or trusted —
// the answer comes exclusively from the existing authenticated endpoint GET /api/fundraiser/partner/orgs,
// whose result is derived server-side from persisted organization.adminUserIds (approved orgs only).
//
// NO PERSISTENCE: nothing is written to sessionStorage or localStorage, and no cross-mount cache
// exists. The probe runs at most once per DashboardLayout mount and the answer lives in component
// state, so it dies with the component. A newly assigned administrator therefore sees the entry on
// their next page load, with no stale value able to survive a logout, a token change, or an account
// change — because there is nothing to survive.
//
// FAIL CLOSED: only an explicit HTTP 200 carrying at least one organization yields `true`. Every
// other outcome — 401, 403, 503, network failure, malformed body, thrown error — yields `false`.

// NOTE ON SHAPE: `isAuthenticated` is passed IN by the caller (DashboardLayout already holds it
// from useAuth()) rather than pulled from AuthContext here. That keeps this module free of any JSX
// import, so the decision and lifecycle below stay importable — and therefore genuinely testable —
// under plain `node --test`. It is a session-presence flag only; it asserts no role and grants
// nothing. Every authority decision still comes from the server response.
import { useEffect, useRef, useState } from "react";
import { fundraiserApi } from "../api/fundraiserApi.js";
import { isFundraiserUiEnabled } from "../config/fundraiserGate.js";

/**
 * PURE. Decide partner-nav visibility from a fundraiserApi result envelope
 * ({ ok, status, data, networkError }). Exported for direct unit testing.
 * TRUE only for: ok === true AND status 200 AND data.organizations is a non-empty array.
 */
export function decidePartnerAccess(result) {
  if (!result || result.networkError) return false;
  if (result.ok !== true || result.status !== 200) return false;
  const orgs = result.data && result.data.organizations;
  if (!Array.isArray(orgs)) return false;           // malformed body ⇒ fail closed
  return orgs.length >= 1;
}

/**
 * PURE. Whether the probe is allowed to run at all. The flag is checked FIRST so that a disabled
 * fundraiser UI issues NO request whatsoever.
 */
export function shouldProbePartnerAccess({ enabled, isAuthenticated }) {
  return enabled === true && isAuthenticated === true;
}

/**
 * Injectable probe body — no React, no DOM, so the full lifecycle is unit-testable.
 * Calls `fetchOrgs` at most once, and only when qualified. `apply` is invoked with the decided
 * boolean ONLY while `isActive()` is true, which is what prevents a post-unmount state update.
 * Returns the outcome so callers/tests can assert what happened.
 */
export async function runPartnerAccessProbe({ enabled, isAuthenticated, fetchOrgs, apply, isActive = () => true }) {
  if (!shouldProbePartnerAccess({ enabled, isAuthenticated })) {
    return { probed: false, applied: false, access: false, reason: "not_qualified" };
  }
  let result;
  try {
    result = await fetchOrgs();
  } catch {
    // A thrown client error is indistinguishable from a failure ⇒ fail closed, apply nothing new.
    if (isActive()) apply(false);
    return { probed: true, applied: isActive(), access: false, reason: "threw" };
  }
  const access = decidePartnerAccess(result);
  if (!isActive()) return { probed: true, applied: false, access, reason: "unmounted" };
  apply(access);
  return { probed: true, applied: true, access, reason: "applied" };
}

/**
 * React hook. Returns a boolean, defaulting to FALSE until a qualifying 200 arrives.
 * The effect runs once per mount (empty dependency list) — never per render.
 */
export function useFundraiserPartnerAccess(isAuthenticated) {
  const [isPartnerAdmin, setIsPartnerAdmin] = useState(false);
  // Read once at mount; a ref keeps the effect's dependency list empty so re-renders never re-probe.
  const qualifiedRef = useRef({ enabled: isFundraiserUiEnabled(), isAuthenticated: isAuthenticated === true });

  useEffect(() => {
    let active = true;
    const { enabled, isAuthenticated: authed } = qualifiedRef.current;
    runPartnerAccessProbe({
      enabled,
      isAuthenticated: authed,
      fetchOrgs: () => fundraiserApi.partner.myOrganizations(),
      apply: setIsPartnerAdmin,
      isActive: () => active,
    });
    return () => { active = false; };
  }, []); // once per mount

  return isPartnerAdmin;
}

export default useFundraiserPartnerAccess;
