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
export function referralCreditCentsFrom(res) {
  const cents = res && res.ok === true ? res.referralCreditCents : null;
  return Number.isSafeInteger(cents) && cents > 0 ? cents : null;
}

export default function useReferralCreditCents(referralCode) {
  const [cents, setCents] = useState(null);
  useEffect(() => {
    if (!referralCode || typeof referralCode !== 'string') { setCents(null); return undefined; }
    let cancelled = false;
    setCents(null);
    (async () => {
      try {
        const res = await api.getReferral(referralCode);
        if (!cancelled) setCents(referralCreditCentsFrom(res));
      } catch {
        if (!cancelled) setCents(null);
      }
    })();
    return () => { cancelled = true; };
  }, [referralCode]);
  return cents;
}
