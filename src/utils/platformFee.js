// src/utils/platformFee.js
//
// W18 display rule (contract: reports/closeout-sprint/contracts/T2-w18-fee-once.md).
//
// The one-time $4.99 CONSUMER platform fee is charged ONCE, at an account's initial subscription
// activation, never on resubscription/reactivation. The backend decides (GET
// /api/payments/platform-fee-status) and is always authoritative at checkout. The display layer only
// reflects that answer:
//   applies: true   -> show feeCents/100
//   applies: false  -> omit the fee row and total from the plan price alone
//   503 / error     -> assert NO amount ("calculated at checkout"); never guess in either direction
//   guest           -> no history, so shown as for a new account (re-decided at authenticated checkout)
// Business plans keep their $19.99 fee unchanged (no founder rule makes it once-per-account).
// The fee is never described as recurring.

export const NEW_ACCOUNT_CONSUMER_FEE = 4.99;
export const BUSINESS_PLATFORM_FEE = 19.99;
export const FEE_CALCULATED_AT_CHECKOUT = 'Calculated at checkout';

/** Initial state while the status read is in flight: no amount is asserted. */
export const FEE_STATE_PENDING = Object.freeze({ status: 'pending', consumerFee: null, applies: null });
export const FEE_STATE_UNKNOWN = Object.freeze({ status: 'unknown', consumerFee: null, applies: null });

/** Turn a platform-fee-status response (or the absence of one) into a display state. */
export function interpretPlatformFeeStatus(res, { authenticated }) {
  if (!authenticated) {
    return { status: 'known', consumerFee: NEW_ACCOUNT_CONSUMER_FEE, applies: true };
  }
  const c = res && res.ok === true ? res.consumer : null;
  if (c && typeof c.applies === 'boolean' && Number.isFinite(c.feeCents) && c.feeCents >= 0) {
    return { status: 'known', consumerFee: c.applies ? c.feeCents / 100 : 0, applies: c.applies };
  }
  return FEE_STATE_UNKNOWN;
}

/**
 * The fee in dollars for one subscription cart item/plan, or null when it cannot be asserted.
 * @param {{platformFee?:number}|null} item
 * @param {boolean} isBusiness
 * @param {{status:string, consumerFee:number|null}} feeState
 */
export function platformFeeFor(item, isBusiness, feeState) {
  if (isBusiness) return item?.platformFee ?? BUSINESS_PLATFORM_FEE;
  return feeState && feeState.status === 'known' ? feeState.consumerFee : null;
}

/** The value text for the fee row; null fee never prints an amount. */
export function formatFeeAmount(fee) {
  return fee == null ? FEE_CALCULATED_AT_CHECKOUT : `$${fee.toFixed(2)}`;
}
