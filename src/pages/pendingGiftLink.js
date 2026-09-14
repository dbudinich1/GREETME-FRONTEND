// src/pages/pendingGiftLink.js
//
// THE LINK-PENDING RECOVERY MARKER, carried inside the EXISTING sendGreetingState record.
//
// WHY IT EXISTS. A flower order can be accepted and charged while its Greet-Me gift record fails to
// write. The order is recoverable — the backend holds a settled attempt carrying a `pending`
// reservation, and re-posting that attempt id re-runs the link locally — but the browser was the only
// thing that knew the attempt id, and it knew it in React state. A refresh lost the handle, and with
// it the sender's only route back to a parcel they had already paid for.
//
// SO THE HANDLE IS PERSISTED, and nothing else is. This is a pointer to work the SERVER already
// owns: the attempt id it minted, plus the few facts needed to prove on return that the restored
// greeting is the same greeting. Everything the recovery actually does is done server-side.
//
// WHAT IS DELIBERATELY NEVER WRITTEN HERE, and each is a decision rather than an omission:
//   * the claim token        — it is the secret behind the recipient's QR. The server returns it only
//                              once the gift is proven to exist, and it belongs in memory for the
//                              seconds it takes to send, never in storage a later page can read.
//   * card data, payment tokens, provider request bodies, credentials, provider secrets — none of
//                              them are needed to name an attempt, and sessionStorage is readable by
//                              every script on the origin.
//   * a NEW attempt id       — recovery replays the attempt that exists. Minting another would be a
//                              second order.
//   * recipient addresses    — the delivery address is already frozen server-side on the attempt, and
//                              nothing here adds one beyond what the greeting draft legitimately
//                              carried before this marker existed.
//
// ONE RECORD, NOT A NEW STORAGE SYSTEM. The marker is a field on the sendGreetingState blob the send
// flow already writes and restores, so there is one key, one lifetime and one thing to reason about.

/** The existing session record the send flow already uses. Unchanged. */
export const SEND_STATE_KEY = 'sendGreetingState';

/** The one field this module owns inside that record. */
export const PENDING_GIFT_LINK_FIELD = 'pendingGiftLink';

/** The only status the marker may carry. A marker exists because a link is pending; there is no other reason. */
export const PENDING_STATUS = 'pending';

/** Why a restored marker was refused. Reported so a surface can say something true about it. */
export const CORRELATION = Object.freeze({
  OK: 'ok',
  MALFORMED: 'malformed',
  WRONG_SENDER: 'wrong_sender',
  WRONG_CONTACT: 'wrong_contact',
  WRONG_PRODUCT: 'wrong_product',
  WRONG_GIFT_TYPE: 'wrong_gift_type',
});

const readRecord = () => {
  try {
    const raw = sessionStorage.getItem(SEND_STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    // Unreadable storage is the same as no storage: the sender simply has no recovery available.
    return null;
  }
};

const writeRecord = (record) => {
  try {
    sessionStorage.setItem(SEND_STATE_KEY, JSON.stringify(record));
    return true;
  } catch {
    return false;
  }
};

/**
 * Record that an accepted order's gift link is still pending.
 *
 * MERGED into whatever the send flow already stored, so the greeting draft beside it is preserved
 * rather than replaced — the sender must come back to the same greeting, not an empty one.
 */
export function persistPendingGiftLink({
  attemptId, giftType, contactId, productId, userId, draft = null,
} = {}) {
  if (typeof attemptId !== 'string' || !attemptId) return false;
  const existing = readRecord() || {};
  return writeRecord({
    ...existing,
    ...(draft || {}),
    [PENDING_GIFT_LINK_FIELD]: {
      status: PENDING_STATUS,
      // The attempt the SERVER minted. The whole point of the marker.
      attemptId,
      giftType: giftType || null,
      // CORRELATION ONLY. Three facts that must still be true on return, each of which the page
      // already holds and none of which is secret.
      userId: userId || null,
      contactId: contactId || null,
      productId: productId || null,
    },
  });
}

/** The marker, or null. Never throws, whatever storage contains. */
export function readPendingGiftLink() {
  const record = readRecord();
  const marker = record?.[PENDING_GIFT_LINK_FIELD];
  if (!marker || typeof marker !== 'object' || Array.isArray(marker)) return null;
  if (marker.status !== PENDING_STATUS) return null;
  if (typeof marker.attemptId !== 'string' || !marker.attemptId) return null;
  return marker;
}

/** The greeting draft stored beside the marker, so a refresh restores the same greeting. */
export function readSendDraft() {
  return readRecord();
}

/**
 * Does this restored marker belong to the greeting now on screen?
 *
 * FAILS CLOSED. Every check is against a fact the page already holds — the authenticated sender, the
 * selected contact, the chosen arrangement — and never against editable display text. A marker that
 * does not correlate is not replayed at all: submitting it would attach a real, paid parcel to the
 * wrong greeting, or to the wrong person's session on a shared browser.
 *
 * The server enforces the sender independently (the attempt is read in that sender's own partition,
 * so another sender's is not refused but invisible). This check is the browser's half of the same
 * rule, and it exists because a stale marker should never reach the network at all.
 */
export function correlatePendingGiftLink(marker, { userId, contactId, productId, giftType } = {}) {
  if (!marker || typeof marker.attemptId !== 'string' || !marker.attemptId) {
    return { ok: false, reason: CORRELATION.MALFORMED };
  }
  // Each correlating fact must be PRESENT on both sides. A missing value is not a match — it is an
  // unproven claim, and an unproven claim about a charged order fails closed.
  if (!marker.userId || !userId || marker.userId !== userId) {
    return { ok: false, reason: CORRELATION.WRONG_SENDER };
  }
  if (!marker.contactId || !contactId || marker.contactId !== contactId) {
    return { ok: false, reason: CORRELATION.WRONG_CONTACT };
  }
  if (!marker.productId || !productId || marker.productId !== productId) {
    return { ok: false, reason: CORRELATION.WRONG_PRODUCT };
  }
  if (marker.giftType && giftType && marker.giftType !== giftType) {
    return { ok: false, reason: CORRELATION.WRONG_GIFT_TYPE };
  }
  return { ok: true, reason: CORRELATION.OK };
}

/**
 * Remove the marker — and ONLY the marker.
 *
 * The rest of the sendGreetingState record is left exactly as it was, because it belongs to the
 * marketplace and media round trips, not to this recovery.
 *
 * WHEN THIS MAY BE CALLED. Only on a proven terminal condition: the Greet-Me send returned a
 * definitive success. NOT when the gift links — a linked gift whose greeting has not gone out is
 * precisely the state that still needs recovering — and NOT when a component unmounts, which proves
 * nothing about whether the work finished.
 */
export function clearPendingGiftLink() {
  const record = readRecord();
  if (!record || !(PENDING_GIFT_LINK_FIELD in record)) return false;
  const next = { ...record };
  delete next[PENDING_GIFT_LINK_FIELD];
  return writeRecord(next);
}
