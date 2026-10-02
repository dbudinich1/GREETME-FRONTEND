// src/hooks/usePlatformFeeStatus.js
// Reads GET /api/payments/platform-fee-status once per mount (see utils/platformFee.js for the rules). The answer covers BOTH
// tiers (one platform fee per account, ever): state = { status, consumerFee, applies, businessFee, businessApplies }.
import { useEffect, useState } from 'react';
import api from '../api/api';
import { FEE_STATE_PENDING, FEE_STATE_UNKNOWN, interpretPlatformFeeStatus } from '../utils/platformFee';

export default function usePlatformFeeStatus() {
  const [state, setState] = useState(FEE_STATE_PENDING);

  useEffect(() => {
    let active = true;
    let token = null;
    try { token = localStorage.getItem('token'); } catch { /* no storage */ }
    if (!token) {
      setState(interpretPlatformFeeStatus(null, { authenticated: false }));
      return undefined;
    }
    (async () => {
      let res = null;
      try {
        res = await api.getPlatformFeeStatus();
      } catch {
        res = null; // 503 FEE_HISTORY_UNAVAILABLE or any error: assert no amount
      }
      if (active) setState(res ? interpretPlatformFeeStatus(res, { authenticated: true }) : FEE_STATE_UNKNOWN);
    })();
    return () => { active = false; };
  }, []);

  return state;
}
