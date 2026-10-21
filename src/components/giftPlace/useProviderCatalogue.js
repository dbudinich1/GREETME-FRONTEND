// src/components/giftPlace/useProviderCatalogue.js
//
// LOADING A PROVIDER-FULFILLED CATEGORY, and refusing to while the provider is dormant.
//
// This was the one genuinely load-bearing part of the separate provider surface that used to sit on
// the Gift Place: the posture question, the fail-closed gate, and the four proven states. The surface
// is gone — every category renders through the one shared grid now — but this behaviour is not, so it
// lives here rather than being inlined into a 900-line page where it could only be asserted by
// scraping source text.
//
// THE CONTAINMENT, in order and for a reason:
//   1. Ask whether the category is PURCHASABLE. Costs no vendor call and no storage read.
//   2. Only on an explicit `true`, read the catalogue.
// A dormant provider is therefore never asked for products, and an unanswered posture question is
// not an invitation to sell something — it leaves the gate shut.
//
// The answer is held as the gift type it was given FOR, never as a bare boolean, so switching
// category stops matching immediately and a previous category's "yes" can never sell the next one.

import { useCallback, useEffect, useState } from 'react';
import { fetchCheckoutAvailability, fetchProviderCatalog } from '../../api/providerCheckout';

/**
 * @param {string|null} giftType  the backend gift type, or null for a non-provider category
 * @returns {{ products: Array, state: 'idle'|'loading'|'ready'|'failed', retry: () => void }}
 */
export function useProviderCatalogue(giftType, deps = {}) {
  const askAvailability = deps.fetchCheckoutAvailability || fetchCheckoutAvailability;
  const readCatalogue = deps.fetchProviderCatalog || fetchProviderCatalog;

  const [availableFor, setAvailableFor] = useState(null);
  // The posture question answered "no" or could not be asked, for this gift type. Only `liveState` reads it (the Gift
  // Place's availability notes); `state` is unchanged for every other caller.
  const [postureFailedFor, setPostureFailedFor] = useState(null);
  const [products, setProducts] = useState([]);
  // 'idle' | 'loading' | 'ready' | 'failed' — the catalogue's PROVEN state, never assumed.
  const [state, setState] = useState('idle');
  // A counter rather than a boolean, so a SECOND failure still re-runs the effect.
  const [attempt, setAttempt] = useState(0);
  const [postureAttempt, setPostureAttempt] = useState(0);

  useEffect(() => {
    if (!giftType) return undefined;
    let cancelled = false;
    setPostureFailedFor(null);
    (async () => {
      try {
        const posture = await askAvailability(giftType);
        if (cancelled) return;
        if (posture?.available === true) setAvailableFor(giftType);
        else setPostureFailedFor(giftType);
      } catch {
        // Fail closed. The gate stays shut and no catalogue read follows.
        if (!cancelled) setPostureFailedFor(giftType);
      }
    })();
    return () => { cancelled = true; };
    // `postureAttempt` re-asks only after a failed posture answer (see retry), so a working gate is not re-asked.
  }, [giftType, askAvailability, postureAttempt]);

  useEffect(() => {
    if (!giftType || availableFor !== giftType) return undefined;
    let cancelled = false;
    setState('loading');
    (async () => {
      try {
        const { ok, products: live } = await readCatalogue(giftType);
        if (cancelled) return;
        setProducts(Array.isArray(live) ? live : []);
        // `ok` is READ, not inferred from an empty array. The shared API client answers a dead
        // network and a 404 with a sentinel rather than a throw, so an empty list on its own cannot
        // tell a failed read from an empty collection — and telling a shopper nothing is available
        // when we simply could not look is a false statement about the provider's stock.
        setState(ok ? 'ready' : 'failed');
      } catch {
        if (cancelled) return;
        setProducts([]);
        setState('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [giftType, availableFor, attempt, readCatalogue]);

  const retry = useCallback(() => {
    setAttempt((n) => n + 1);
    if (postureFailedFor) setPostureAttempt((n) => n + 1);
  }, [postureFailedFor]);

  return {
    products,
    // Before the posture answer arrives there is nothing to show and nothing has failed, so the
    // honest state is "loading" rather than an empty collection.
    state: giftType && availableFor !== giftType ? 'loading' : state,
    // The same, except that a posture question answered "no" (or not at all) is 'failed' rather than 'loading': the
    // Gift Place uses it to say "Availability unavailable. Try again." instead of checking forever.
    liveState: !giftType ? 'idle' : postureFailedFor === giftType ? 'failed' : availableFor !== giftType ? 'loading' : state,
    retry,
  };
}

export default useProviderCatalogue;
