// src/components/giftPlace/usePendingGiftLinkRecovery.js
//
// ONE automatic recovery attempt after a remount, and never a loop.
//
// An accepted, charged flower order whose gift link is still pending is recoverable by re-posting the
// SAME settled checkout attempt: the backend's replay branch runs the link locally and returns before
// the provider is ever resolved. This hook is what makes that survive a browser refresh.
//
// THE RULES IT ENFORCES, all of them by construction rather than by the caller remembering:
//   * it replays ONCE per mount, latched by a ref, so re-renders cannot fire a second call;
//   * it never replays a marker that does not CORRELATE with the greeting now on screen;
//   * it never opens a checkout, asks for payment, tokenizes, or constructs a new attempt — the only
//     network call it can make is the replay of an attempt id it was given;
//   * it hands back a claim token ONLY when the backend proved the gift linked, so the caller can
//     never send a greeting announcing a gift that may not exist;
//   * subsequent attempts require a visible control. There is no timer and no backoff, because an
//     automatic loop against a money path is how one failure becomes many.

import { useCallback, useEffect, useRef, useState } from 'react';
import { retryGiftLink as retryGiftLinkDefault } from '../../api/providerCheckout';
import { correlatePendingGiftLink, CORRELATION } from '../../pages/pendingGiftLink';

/** What the recovery is doing, so a surface can say something true about it. */
export const RECOVERY = Object.freeze({
  IDLE: 'idle',               // nothing to recover
  WAITING: 'waiting',         // a marker exists, but the page is not ready to correlate it yet
  REPLAYING: 'replaying',     // the one automatic attempt is in flight
  PENDING: 'pending',         // the link did not complete; the visible control is the way forward
  REFUSED: 'refused',         // the marker does not correlate, or is malformed — fails closed
  LINKED: 'linked',           // the gift linked; the caller continues the send
});

/**
 * @param {object}   args
 * @param {object|null} args.marker      the restored link-pending marker, or null
 * @param {boolean}  args.ready          may the marker be correlated yet? (contacts loaded, etc.)
 * @param {object}   args.identity       { userId, contactId, productId, giftType } as the page holds them
 * @param {Function} args.onLinked       called with the proven claim token, at most once
 * @param {object}   [args.deps]         injectable for tests
 */
export function usePendingGiftLinkRecovery({
  marker, ready, identity, onLinked, deps = {},
} = {}) {
  const retry = deps.retryGiftLink || retryGiftLinkDefault;

  const [state, setState] = useState(RECOVERY.IDLE);
  const [refusal, setRefusal] = useState(null);
  // THE ONE-SHOT LATCH. A ref, not state: it must be true for the rest of the synchronous run, and a
  // re-render must not be able to reopen the window.
  const autoAttempted = useRef(false);
  // The hand-off latch. The caller's send is dispatched at most once by this hook, however many times
  // a replay returns a token.
  const handedOff = useRef(false);
  const inFlight = useRef(false);

  /**
   * Replay the SAME attempt. The only network call this hook can make.
   *
   * It carries the attempt id and the gift type and nothing else — no payment token, no binding, no
   * card material — because the order it recovers was paid for before this call existed.
   */
  const replay = useCallback(async (reason) => {
    if (!marker?.attemptId || inFlight.current) return RECOVERY.PENDING;
    inFlight.current = true;
    setState(RECOVERY.REPLAYING);
    try {
      const res = await retry({ attemptId: marker.attemptId, giftType: marker.giftType });
      const token = typeof res?.giftClaimToken === 'string' ? res.giftClaimToken : '';
      if (!token) {
        setState(RECOVERY.PENDING);
        return RECOVERY.PENDING;
      }
      setState(RECOVERY.LINKED);
      // ONCE. A second hand-off would be a second greeting from one order.
      if (!handedOff.current) {
        handedOff.current = true;
        await onLinked?.(token, { marker, reason });
      }
      return RECOVERY.LINKED;
    } catch {
      // Left recoverable on purpose: the order is safe and the visible control still works.
      setState(RECOVERY.PENDING);
      return RECOVERY.PENDING;
    } finally {
      inFlight.current = false;
    }
  }, [marker, onLinked, retry]);

  // THE ONE AUTOMATIC ATTEMPT, on remount. Everything after this is the sender's decision.
  useEffect(() => {
    if (!marker) { setState(RECOVERY.IDLE); return; }
    if (autoAttempted.current) return;
    // Not ready is not a refusal — the page simply cannot correlate yet. Waiting keeps the marker and
    // tries again on the render that can, rather than burning the one attempt on a half-loaded page.
    if (!ready) { setState(RECOVERY.WAITING); return; }

    const correlated = correlatePendingGiftLink(marker, identity || {});
    if (!correlated.ok) {
      // FAILS CLOSED, and the attempt is spent so nothing retries into the same refusal.
      autoAttempted.current = true;
      setRefusal(correlated.reason);
      setState(RECOVERY.REFUSED);
      return;
    }

    autoAttempted.current = true;
    void replay('remount');
  }, [marker, ready, identity, replay]);

  /** The visible control. It replays the same attempt, and nothing else. */
  const retryNow = useCallback(async () => {
    if (state === RECOVERY.REFUSED) return RECOVERY.REFUSED;
    return replay('manual');
  }, [replay, state]);

  return {
    state,
    refusal,
    /** True while the sender should be told the gift is still being attached. */
    isPending: state === RECOVERY.PENDING || state === RECOVERY.REPLAYING,
    isRefused: state === RECOVERY.REFUSED,
    isReplaying: state === RECOVERY.REPLAYING,
    attemptId: marker?.attemptId ?? null,
    retryNow,
    CORRELATION,
  };
}

export default usePendingGiftLinkRecovery;
