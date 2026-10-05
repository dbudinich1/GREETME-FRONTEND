// src/utils/creditCap.js
//
// Defence in depth for the founder rule "no referral or courtesy credit above $5". The server already caps
// the amount; these clamps make sure no screen can ever render or subtract a larger figure.
export const MAX_CREDIT_CENTS = 500;

/** Cents clamped to 0..500; negative, NaN and non-numeric are 0; Infinity is the max; non-integers are kept. */
export function clampCreditCents(amountCents) {
  return Math.max(0, Math.min(Number(amountCents) || 0, MAX_CREDIT_CENTS));
}

/** Dollars (e.g. a stored courtesy `amount`) clamped to 0..5. */
export function clampCreditDollars(amountDollars) {
  return Math.max(0, clampCreditCents(Math.round((Number(amountDollars) || 0) * 100)) / 100);
}
