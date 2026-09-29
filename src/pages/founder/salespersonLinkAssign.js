// src/pages/founder/salespersonLinkAssign.js
//
// PURE state model for the "link this salesperson's own Greet-Me account" panel — the sibling of
// src/pages/fundraiser/partnerAdminAssign.js's partner-administrator panel. No React, no DOM, no
// fetch: every UI state is decided by these functions, so all of them are directly unit-testable.
//
// The RESOLVE half is IDENTICAL to the fundraiser panel's — same resolver, same response shape —
// so `resolveOutcome`/`STATES` are reused from there rather than re-implemented. Only the LINK half
// is new: it targets a different endpoint (PUT …/linked-user) with different server-side error
// codes, and unlike partner-administrator assignment, there is no reason to refuse linking a
// founder's own account here, so `canLink` carries no `isFounder` restriction.
//
// The panel grants nothing. Resolution and linking are both founder-only server operations
// (requireFounder); this module only decides what to display from the server's own answers.

export { STATES, resolveOutcome } from "../fundraiser/partnerAdminAssign.js";
import { STATES } from "../fundraiser/partnerAdminAssign.js";

/** The four outcomes a link/unlink write can settle into — separate from the resolve-side STATES. */
export const LINK_STATES = Object.freeze({
  LINKED: "linked",
  UNLINKED: "unlinked",
  LINK_FAILED: "link_failed",
});

/**
 * PURE. Map a link/unlink response to a panel state.
 *
 * 200 → LINKED · 400 INVALID_LINKED_USER → invalid_user · 404 → salesperson_not_found ·
 * 409 USER_ALREADY_LINKED → already_linked · 403 → forbidden · else → service_failure.
 */
export function linkOutcome(res) {
  if (!res || res.networkError || res.status === 0) {
    return { state: LINK_STATES.LINK_FAILED, reason: "service_failure" };
  }
  if (res.ok === true && res.status === 200) return { state: LINK_STATES.LINKED, reason: null };
  if (res.status === 400) return { state: LINK_STATES.LINK_FAILED, reason: "invalid_user" };
  if (res.status === 404) return { state: LINK_STATES.LINK_FAILED, reason: "salesperson_not_found" };
  if (res.status === 409) return { state: LINK_STATES.LINK_FAILED, reason: "already_linked" };
  if (res.status === 403) return { state: LINK_STATES.LINK_FAILED, reason: "forbidden" };
  return { state: LINK_STATES.LINK_FAILED, reason: "service_failure" };
}

/** PURE. Human-readable, truthful message for a link/unlink outcome. Never claims success on failure. */
export function linkMessageFor(state, reason) {
  if (state === LINK_STATES.LINKED) return "Account linked.";
  if (state === LINK_STATES.UNLINKED) return "Account unlinked.";
  if (state === LINK_STATES.LINK_FAILED) {
    switch (reason) {
      case "invalid_user": return "That account id was rejected. Nothing was changed.";
      case "salesperson_not_found": return "This salesperson no longer exists. Nothing was changed.";
      case "already_linked": return "That account is already linked to a different salesperson.";
      case "forbidden": return "Founder access is required. Nothing was changed.";
      default: return "Linking failed. Nothing was changed.";
    }
  }
  return "";
}

/** PURE. Linking is offered only for a resolved account with a usable userId. No founder exclusion. */
export function canLink(resolveState, account) {
  return resolveState === STATES.RESOLVED && !!account
    && typeof account.userId === "string" && account.userId !== "";
}
