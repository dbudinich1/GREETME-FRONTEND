// src/pages/fundraiser/partnerAdminAssign.js
//
// TEAM B (P2) — PURE state model for the founder's partner-administrator assignment panel.
// No React, no DOM, no fetch: every UI state is decided by these functions, so all of them are
// directly unit-testable and the component stays a thin renderer.
//
// The panel grants nothing. Resolution and assignment are both founder-only server operations
// (requireFounderAdmin); this module only decides what to display from the server's own answers.

/** The ten required panel states. */
export const STATES = Object.freeze({
  EMPTY: "empty",
  RESOLVING: "resolving",
  RESOLVED: "resolved",
  INVALID_EMAIL: "invalid_email",
  NOT_FOUND: "not_found",
  AMBIGUOUS: "ambiguous",
  SERVICE_FAILURE: "service_failure",
  ASSIGNING: "assigning",
  ASSIGNED: "assigned",
  ASSIGN_FAILED: "assign_failed",
});

/**
 * PURE. Map a resolver response envelope ({ ok, status, data, networkError }) to a panel state.
 * Fails closed: anything not an explicit, well-formed 200 is a non-resolved state.
 *
 * The founder-entered email is NOT masked (they typed it); only the resolver's approved fields
 * are ever surfaced.
 */
export function resolveOutcome(res) {
  if (!res || res.networkError || res.status === 0) return { state: STATES.SERVICE_FAILURE, account: null };
  if (res.status === 400) return { state: STATES.INVALID_EMAIL, account: null };
  if (res.status === 404) return { state: STATES.NOT_FOUND, account: null };
  if (res.status === 409) return { state: STATES.AMBIGUOUS, account: null };
  if (res.ok !== true || res.status !== 200) return { state: STATES.SERVICE_FAILURE, account: null };

  const d = res.data;
  // Fail closed on a malformed body — a resolved account MUST carry a usable userId.
  if (!d || typeof d !== "object" || typeof d.userId !== "string" || d.userId.trim() === "") {
    return { state: STATES.SERVICE_FAILURE, account: null };
  }
  return {
    state: STATES.RESOLVED,
    // Only the resolver's approved fields are retained — nothing else is carried into the UI.
    account: {
      userId: d.userId,
      email: typeof d.email === "string" ? d.email : "",
      emailVerified: d.emailVerified === true,
      isFounder: d.isFounder === true,
    },
  };
}

/**
 * PURE. Map an assignment response to a panel state. B2's server-side validation supplies the
 * distinctions; this only renders them.
 */
export function assignOutcome(res) {
  if (!res || res.networkError || res.status === 0) return { state: STATES.ASSIGN_FAILED, reason: "service_failure" };
  if (res.ok === true && res.status === 200) return { state: STATES.ASSIGNED, reason: null };
  if (res.status === 400) return { state: STATES.ASSIGN_FAILED, reason: "invalid_user_id" };
  if (res.status === 404) return { state: STATES.ASSIGN_FAILED, reason: "user_not_found" };
  if (res.status === 409) return { state: STATES.ASSIGN_FAILED, reason: "user_is_founder" };
  if (res.status === 403) return { state: STATES.ASSIGN_FAILED, reason: "forbidden" };
  if (res.status === 503) return { state: STATES.ASSIGN_FAILED, reason: "dormant" };
  return { state: STATES.ASSIGN_FAILED, reason: "service_failure" };
}

/** PURE. Human-readable, truthful message per state. Never claims success on a failure. */
export function messageFor(state, reason) {
  switch (state) {
    case STATES.INVALID_EMAIL: return "Enter a valid email address.";
    case STATES.NOT_FOUND: return "No Greet-Me account matches that email address.";
    case STATES.AMBIGUOUS: return "That email matches more than one account. Resolve it manually before assigning.";
    case STATES.SERVICE_FAILURE: return "Could not reach the account service. Nothing was changed.";
    case STATES.ASSIGNED: return "Administrator assigned.";
    case STATES.ASSIGN_FAILED:
      switch (reason) {
        case "invalid_user_id": return "That account id was rejected. Nothing was changed.";
        case "user_not_found": return "That account no longer exists. Nothing was changed.";
        case "user_is_founder": return "That is a platform founder account and cannot be a partner administrator.";
        case "forbidden": return "Founder access is required. Nothing was changed.";
        case "dormant": return "Fundraising is currently unavailable. Nothing was changed.";
        default: return "Assignment failed. Nothing was changed.";
      }
    default: return "";
  }
}

/** PURE. Assignment is offered only for a resolved, non-founder account. */
export function canAssign(state, account) {
  return state === STATES.RESOLVED && !!account && typeof account.userId === "string" && account.userId !== "" && account.isFounder !== true;
}

/** PURE. Truthful read-back: is this userId now present in the organization's adminUserIds? */
export function isAssigned(organization, userId) {
  const ids = organization && Array.isArray(organization.adminUserIds) ? organization.adminUserIds : [];
  return typeof userId === "string" && userId !== "" && ids.includes(userId);
}
