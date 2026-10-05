// src/utils/creditCap.js
//
// Defence in depth for the founder rule "no referral or courtesy credit above $5". The server already caps
// the amount; these clamps make sure no screen can ever render or subtract a larger figure.
export const MAX_CREDIT_CENTS = 500;

/** Cents clamped to 0..500; anything non-numeric is 0. */
export function clampCreditCents(amountCents) {
  return Math.min(Number(amountCents) || 0, MAX_CREDIT_CENTS);
}

/** Dollars (e.g. a stored courtesy `amount`) clamped to 0..5. */
export function clampCreditDollars(amountDollars) {
  return clampCreditCents(Math.round((Number(amountDollars) || 0) * 100)) / 100;
}
