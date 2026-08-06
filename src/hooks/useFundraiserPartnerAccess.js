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
 *
 * LIFECYCLE (corrected). The previous version snapshotted qualification into a ref at mount and used
 * an EMPTY dependency list. That was wrong in both directions for a layout that outlives a session
 * change — DashboardLayout renders on public routes (/pricing, /business) outside ProtectedRoute, so
 * `user` can transition without the component ever remounting:
 *   • sign-in during the mount  ⇒ the snapshot stayed `false`, so no probe ever ran and the entry
 *     was permanently hidden for that mount;
 *   • sign-out during the mount ⇒ the snapshot stayed `true` and the resolved `granted` state kept
 *     the entry VISIBLE after authentication was lost.
 *
 * Qualification is now a derived value in the dependency list, so:
 *   • the effect re-runs EXACTLY ONCE per transition into a qualified state (one probe per session);
 *   • ordinary re-renders leave `qualified` unchanged ⇒ no repeat probe;
 *   • losing authentication (or the flag) hides the entry in the SAME RENDER, because the return
 *     value is derived — it never waits for an effect round-trip;
 *   • cleanup marks the in-flight probe inactive AND clears the resolved answer, so a superseded or
 *     late response cannot reveal the entry, and a subsequent session never inherits the previous
 *     session's answer;
 *   • an epoch counter is a second, independent guard: a response whose epoch is no longer current
 *     is discarded even if its `active` flag were somehow still set.
 *
 * `authReady` is the EXISTING AuthContext readiness signal (`!loading`) passed in by the caller —
 * no new authentication state is invented. While auth is still initializing, qualification is false,
 * so no request is issued and nothing is shown.
 */
export function useFundraiserPartnerAccess(isAuthenticated, authReady = true) {
  const [granted, setGranted] = useState(false);
  const epochRef = useRef(0);

  const enabled = isFundraiserUiEnabled();
  const qualified = enabled && authReady !== false && isAuthenticated === true;

  useEffect(() => {
    if (!qualified) return undefined; // unauthenticated / not ready / flag off ⇒ NO request at all
    const epoch = ++epochRef.current;
    let active = true;
    runPartnerAccessProbe({
      enabled: true,
      isAuthenticated: true,
      fetchOrgs: () => fundraiserApi.partner.myOrganizations(),
      apply: setGranted,
      isActive: () => active && epochRef.current === epoch,
    });
    // Ends this qualified session: supersede the in-flight probe and drop its answer.
    return () => { active = false; setGranted(false); };
  }, [qualified]);

  // DERIVED — de-qualification hides immediately, with no dependence on effect timing.
  return qualified && granted;
}

export default useFundraiserPartnerAccess;
