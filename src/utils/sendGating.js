// src/utils/sendGating.js — LANE E2 send-gating fixes (founder-approved 2026-10-10).
//
// Pure helpers, no React. Read-only derivations from data the app ALREADY has (the hydrated
// /api/profile user: tier / plan / subscriptionStatus / paymentLocked / entitlements, and the
// client-safe send-preflight result). Nothing here changes what the backend allows — the server's
// own gates stay authoritative; these only decide what the UI offers and how it explains a block.

// The backend's free plan (services/entitlements.js PLAN_CAPS.free) is the only trial-period tier.
// /api/profile returns tier through getEntitlements(), so a lapsed gifted plan already reads 'free'.
const FREE_TIER = 'free';

/**
 * True when the account has no active paid plan (free tier / trial, active or expired).
 * paymentLocked always counts as subscribed; an active/trialing Stripe status counts only on a
 * non-free tier (an expired gifted plan reads tier "free" + status "active" and is unsubscribed). Unknown user (null) → false, which keeps
 * today's behaviour until the profile is known.
 */
export function isUnsubscribedAccount(user) {
  if (!user) return false;
  if (user.paymentLocked === true) return false;
  const tier = user.tier || user.plan || FREE_TIER;
  // TEAM 5 SG-M1 (lane E3): the active/trialing shortcut applies ONLY to a non-free tier. An expired
  // gifted plan resolves to tier "free" while its stored subscriptionStatus can still read "active"
  // (lazy expiry); the backend treats that account as unsubscribed, so the UI must too.
  if (tier !== FREE_TIER && (user.subscriptionStatus === 'active' || user.subscriptionStatus === 'trialing')) return false;
  if (tier === FREE_TIER) return true;
  return user.entitlements?.greetingsPeriod === 'trial';
}

/**
 * Founder decision (2026-10-10): Anytime sends / Animation Bank packs / "Purchase Additional Sends"
 * are never offered to an unsubscribed account — they can never unblock a free-tier send.
 */
export function canOfferAdditionalSends(user) {
  return !isUnsubscribedAccount(user);
}

/**
 * Whether the gift-entitlement caution may offer "Purchase Additional Sends" for this block.
 * Never for an unsubscribed account, and never for TRIAL_EXPIRED (the backend's trial-expiry gate
 * runs before any wallet/pack balance is consulted, so a pack cannot unblock it).
 */
export function shouldOfferTopUp(preflight, { unsubscribed = false } = {}) {
  if (unsubscribed) return false;
  if (preflight?.reasonCode === 'TRIAL_EXPIRED') return false;
  // The server's own remediation list (backend lane E1 drops "top_up" for TRIAL_EXPIRED /
  // unsubscribed accounts). Absent list → today's behaviour.
  if (Array.isArray(preflight?.remediation) && !preflight.remediation.includes('top_up')) return false;
  return true;
}

export const TRIAL_ENDED_HEADLINE = 'Your free trial has ended — upgrade to send.';

/**
 * Plain, reason-specific copy for a blocked send when the account is on the free plan.
 * Returns null when the generic caution copy applies (subscribed accounts, unchanged).
 */
export function freePlanBlockCopy(preflight, { unsubscribed = false } = {}) {
  const reason = preflight?.reasonCode;
  // PREFLIGHT_UNAVAILABLE is "we couldn't check", not a real answer — never claim the trial ended.
  if (reason === 'PREFLIGHT_UNAVAILABLE') return null;
  if (reason === 'TRIAL_EXPIRED' || (unsubscribed && reason !== 'LIMIT_EXCEEDED')) {
    return {
      headline: TRIAL_ENDED_HEADLINE,
      body: 'Sending Greet-Mes needs a paid plan now. Upgrade to send this one — or send the gift on its own.',
    };
  }
  if (unsubscribed && reason === 'LIMIT_EXCEEDED') {
    return {
      headline: "You've used all your free trial Greet-Mes — upgrade to send.",
      body: 'Sending more Greet-Mes needs a paid plan. Upgrade to send this one — or send the gift on its own.',
    };
  }
  return null;
}

// ---- Recipient cap (fix E) ----

// Fallback ONLY — mirrors backend services/entitlements.js PLAN_CAPS.recipientLimit. The live value
// is the RECIPIENT_LIMIT_REACHED response's `limit`, then the profile's entitlements.recipientLimit.
// null = no recipient cap on that plan.
export const PLAN_RECIPIENT_LIMITS = Object.freeze({
  free: 3,
  close_circle: 5,
  social_butterfly: 15,
  unforgettable: null,
  small_business: 10,
  medium_business: 25,
  business_scale: 100,
});

function positiveInt(v) {
  const n = typeof v === 'string' && v.trim() !== '' ? Number(v) : v;
  return Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * The recipient cap that applies, in priority order: the server's error body `limit`, the hydrated
 * profile's entitlements.recipientLimit, then the static plan config. null when unknown/uncapped.
 */
export function resolveRecipientLimit({ errorData, user } = {}) {
  const fromError = positiveInt(errorData?.limit);
  if (fromError) return fromError;
  const ent = user?.entitlements;
  if (ent && Object.prototype.hasOwnProperty.call(ent, 'recipientLimit')) {
    return positiveInt(ent.recipientLimit);
  }
  const tier = user?.tier || user?.plan;
  if (tier && Object.prototype.hasOwnProperty.call(PLAN_RECIPIENT_LIMITS, tier)) {
    return PLAN_RECIPIENT_LIMITS[tier];
  }
  return null;
}

export function recipientLimitMessage(limit) {
  const n = positiveInt(limit);
  if (!n) return "You've reached your plan's recipient limit. Upgrade to add more recipients.";
  return `Your plan includes ${n} recipient${n === 1 ? '' : 's'}, and you've reached it. Upgrade to add more recipients.`;
}

/** True only when both numbers are known and the count is at/over the cap. */
export function isAtRecipientCap({ limit, count } = {}) {
  const n = positiveInt(limit);
  return !!n && Number.isInteger(count) && count >= n;
}
