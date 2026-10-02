// src/utils/platformFee.js
//
// Platform-fee display rule. Contract: Team 2 commit 3819f18 (branch team-2/billing-gifts-claims-gaps),
// reports/closeout-sprint/contracts/T2-fee-policy-implementation.md section 3C and T2-w18-fee-once.md.
//
// ONE platform fee per account, EVER: whichever subscription checkout comes FIRST carries its tier's fee (consumer $4.99
// or Business $19.99) and no later subscription checkout of any kind does (founder 2026-10-02: "once ever", and no
// further fee on a Personal to Business upgrade). The backend decides (GET /api/payments/platform-fee-status answers for
// BOTH tiers) and is always authoritative at checkout. The display layer only reflects that answer:
//   applies: true   -> show feeCents/100 (the server's amount; never a figure this file or plans.js supplies)
//   applies: false  -> omit the fee row and total from the plan price alone ($0)
//   503 / error     -> assert NO amount ("calculated at checkout"); never guess in either direction
//   guest           -> no history, so shown as for a new account (re-decided at authenticated checkout)
// Response shape: { ok, policy:"one_per_account", consumer:{feeCents,applies,reason,listFeeCents}, business:{same} }.
// A Business plan's `platformFee` in config/plans.js is NOT a display source any more.
// The fee is never described as recurring.

/** A new account's list fees. Used ONLY for a guest, who has no history to read. */
export const NEW_ACCOUNT_CONSUMER_FEE = 4.99;
export const NEW_ACCOUNT_BUSINESS_FEE = 19.99;
export const FEE_CALCULATED_AT_CHECKOUT = 'Calculated at checkout';

export const BUSINESS_PLAN_TIERS = Object.freeze(new Set(['small_business', 'medium_business', 'business_scale']));
export const isBusinessPlanTier = (tier) => BUSINESS_PLAN_TIERS.has(tier);

/** Initial state while the status read is in flight: no amount is asserted. */
export const FEE_STATE_PENDING = Object.freeze({ status: 'pending', consumerFee: null, applies: null, businessFee: null, businessApplies: null });
export const FEE_STATE_UNKNOWN = Object.freeze({ status: 'unknown', consumerFee: null, applies: null, businessFee: null, businessApplies: null });

/** One tier's answer -> { fee (dollars, 0 when waived), applies } or null when it cannot be trusted. */
function readTier(t) {
  if (!t || typeof t.applies !== 'boolean' || !Number.isFinite(t.feeCents) || t.feeCents < 0) return null;
  if (t.applies === true && t.feeCents === 0) return null; // "applies" with no amount is malformed: assert nothing
  return { fee: t.applies ? t.feeCents / 100 : 0, applies: t.applies };
}

/** Turn a platform-fee-status response (or the absence of one) into a display state. */
export function interpretPlatformFeeStatus(res, { authenticated }) {
  if (!authenticated) {
    return { status: 'known', consumerFee: NEW_ACCOUNT_CONSUMER_FEE, applies: true, businessFee: NEW_ACCOUNT_BUSINESS_FEE, businessApplies: true };
  }
  if (!(res && res.ok === true)) return FEE_STATE_UNKNOWN;
  const c = readTier(res.consumer);
  const b = readTier(res.business);
  if (!c && !b) return FEE_STATE_UNKNOWN;
  return {
    status: 'known',
    consumerFee: c ? c.fee : null, applies: c ? c.applies : null,
    businessFee: b ? b.fee : null, businessApplies: b ? b.applies : null,
  };
}

/**
 * The fee in dollars for one subscription cart item/plan, or null when it cannot be asserted. 0 means "already paid: show no
 * fee line". The amount ALWAYS comes from the server's answer; `item` is accepted for call-site compatibility only.
 * @param {*} _item
 * @param {boolean} isBusiness
 * @param {{status:string, consumerFee:number|null, businessFee:number|null}} feeState
 */
export function platformFeeFor(_item, isBusiness, feeState) {
  if (!feeState || feeState.status !== 'known') return null;
  return isBusiness ? feeState.businessFee : feeState.consumerFee;
}

/** The value text for the fee row; null fee never prints an amount. */
export function formatFeeAmount(fee) {
  return fee == null ? FEE_CALCULATED_AT_CHECKOUT : `$${fee.toFixed(2)}`;
}
