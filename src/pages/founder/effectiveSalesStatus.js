// src/pages/founder/effectiveSalesStatus.js
//
// CLOSEOUT W38 (FE) - ONE truthful effective status for a salesperson, derived exactly as the Team 2
// trace specifies (reports/closeout-sprint/contracts/T2-w38-effective-status.md), from two reads the
// founder page already makes:
//   1. summary.linkStatus ("active" | "inactive")        - GET .../summary
//   2. controls { referralPublicLive, attributionLive }   - GET .../controls (or attribution-health)
// Display only. It never calls a mutation, never reactivates, never rotates a link.
//
//   inactive                       -> "Inactive"
//   active + a global switch off   -> "Active, referral surface paused"
//   active + both switches on      -> "Active"
//   anything unreadable            -> "unknown" (we do not guess)

export function effectiveSalesStatus(linkStatus, controls) {
  const s = typeof linkStatus === "string" ? linkStatus.toLowerCase() : "";
  if (s === "inactive") {
    return {
      key: "inactive", label: "Inactive",
      detail: "New referrals do not attribute to this salesperson. Existing customers, commissions and history are unchanged.",
    };
  }
  if (s !== "active") {
    return { key: "unknown", label: "Status unavailable", detail: "The salesperson status could not be read." };
  }
  const known = controls && typeof controls === "object"
    && typeof controls.referralPublicLive === "boolean" && typeof controls.attributionLive === "boolean";
  if (!known) {
    return { key: "active_unverified", label: "Active", detail: "Platform referral switches could not be read, so live attribution is not confirmed." };
  }
  if (controls.referralPublicLive && controls.attributionLive) {
    return { key: "active", label: "Active", detail: "Referral links resolve and attribution is recorded." };
  }
  return {
    key: "active_paused", label: "Active, referral surface paused",
    detail: "The salesperson is active, but a platform-wide referral switch is off, so new referrals are not live.",
  };
}
