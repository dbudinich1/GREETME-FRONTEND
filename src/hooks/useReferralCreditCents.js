// src/hooks/useReferralCreditCents.js
//
// The REAL amount of a QR Cash referral credit: the EFFECTIVE redeemable value the server reports (GET
// /api/gifts/referral/:code -> referralCreditCents). The founder's rule is no referral credit above $5; the
// server enforces it and returns what will actually be honored, so the only truthful figure is the server's
// own. This hook
// never substitutes a literal: with no code, a failed lookup, a used code or a malformed value it returns
// null, and every surface then shows no credit amount at all (the earlier courtesy-credit honesty rule).
import { useEffect, useState } from 'react';
import api from '../api/api';

/** Pure: the cents to display for a server response, or null when there is no real amount. */
// Founder rule: no referral credit above $5. The server already returns the effective value; this is the
// belt-and-braces ceiling so no screen can ever render a figure above $5.
export const MAX_REFERRAL_CREDIT_CENTS = 500;

export function referralCreditCentsFrom(res) {
  const cents = res && res.ok === true ? res.referralCreditCents : null;
  return Number.isSafeInteger(cents) && cents > 0 ? Math.min(cents, MAX_REFERRAL_CREDIT_CENTS) : null;
}

/** Pure: true only when the server says the credit was capped (strict boolean) AND there is a real amount. */
export function referralCreditCappedFrom(res) {
  return referralCreditCentsFrom(res) !== null && res.referralCreditCapped === true;
}

/** { cents, capped } for a referral code; { cents: null, capped: false } when unknown or malformed. */
export function useReferralCredit(referralCode) {
  const [credit, setCredit] = useState({ cents: null, capped: false });
  useEffect(() => {
    if (!referralCode || typeof referralCode !== 'string') { setCredit({ cents: null, capped: false }); return undefined; }
    let cancelled = false;
    setCredit({ cents: null, capped: false });
    (async () => {
      try {
        const res = await api.getReferral(referralCode);
        if (!cancelled) setCredit({ cents: referralCreditCentsFrom(res), capped: referralCreditCappedFrom(res) });
      } catch {
        if (!cancelled) setCredit({ cents: null, capped: false });
      }
    })();
    return () => { cancelled = true; };
  }, [referralCode]);
  return credit;
}

export default function useReferralCreditCents(referralCode) {
  return useReferralCredit(referralCode).cents;
}
