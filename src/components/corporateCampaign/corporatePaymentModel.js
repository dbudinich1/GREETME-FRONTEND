// src/components/corporateCampaign/corporatePaymentModel.js
//
// TEAM I (CONNECTION D) — the PURE state model behind the corporate saved-card panel.
//
// Everything the panel decides lives here and is a plain function of the state it was given: what
// to show, what to call the button, whether a retry is safe, and whether a submit may be sent at
// all. Keeping it pure is what lets the duplicate-submission rule be PROVEN rather than hoped for —
// the interesting cases (already submitting, retry after a decline, retry after authentication)
// are exercised directly instead of through a rendering.
//
// NOTHING HERE EVER TOUCHES CARD DATA. The panel's card fields live inside Stripe's own element,
// which this application never reads; this file sees only a brand, four digits, and a status.

/** The states the panel can be in. Exactly one is true at a time. */
export const CARD_STATE = Object.freeze({
  LOADING: "loading",                 // still asking the server
  READY: "saved_card_ready",          // a usable card is on file
  UPDATE_REQUIRED: "card_update_required", // no usable card — the reader must add one
  UNAVAILABLE: "payments_unavailable",// the server cannot take a card right now
  FORBIDDEN: "not_permitted",         // the viewer is not the organization owner
});

/** Why the last attempt did not produce a saved card. Each maps to something the reader can do. */
export const CARD_FAILURE = Object.freeze({
  DECLINED: "card_declined",
  AUTHENTICATION_REQUIRED: "authentication_required",
  INCOMPLETE: "authorization_incomplete",
  NETWORK: "network_unavailable",
  SERVER: "server_unavailable",
});

/** Copy, in one place, so the panel and the tests cannot disagree about what the reader is told. */
export const CARD_COPY = Object.freeze({
  [CARD_FAILURE.DECLINED]:
    "Your bank declined that card. Try a different card.",
  [CARD_FAILURE.AUTHENTICATION_REQUIRED]:
    "Your bank needs to confirm this card. Start again and complete the confirmation from your bank.",
  [CARD_FAILURE.INCOMPLETE]:
    "That card was not saved. Please try again.",
  [CARD_FAILURE.NETWORK]:
    "We could not reach Greet-Me. Check your connection and try again.",
  [CARD_FAILURE.SERVER]:
    "Card payments are not available right now. Please try again later.",
});

/**
 * Which failures a reader may safely RETRY.
 *
 * A decline and an authentication requirement are both retryable, because retrying means starting a
 * fresh SetupIntent — no charge has occurred and nothing is duplicated by trying again. A server
 * that cannot take cards at all is NOT retryable from this screen: offering a button that cannot
 * work is worse than saying so.
 */
export const RETRYABLE = Object.freeze([
  CARD_FAILURE.DECLINED,
  CARD_FAILURE.AUTHENTICATION_REQUIRED,
  CARD_FAILURE.INCOMPLETE,
  CARD_FAILURE.NETWORK,
]);

export const canRetry = (failure) => RETRYABLE.includes(failure);

/**
 * Turn a client result into the panel's state.
 *
 * FAIL-CLOSED ON READINESS. Anything that is not an explicit `ready: true` is
 * `card_update_required`. A network blip must never render as "your card is ready", because the
 * consequence of that mistake is an administrator believing a campaign can be funded when it
 * cannot.
 */
export function deriveCardState(res) {
  if (!res) return { state: CARD_STATE.LOADING };
  if (res.unauthorized === true) return { state: CARD_STATE.FORBIDDEN };
  if (res.unavailable === true) return { state: CARD_STATE.UNAVAILABLE, failure: CARD_FAILURE.SERVER };
  if (res.networkError === true) return { state: CARD_STATE.UPDATE_REQUIRED, failure: CARD_FAILURE.NETWORK };
  if (res.ok !== true) return { state: CARD_STATE.UPDATE_REQUIRED, failure: CARD_FAILURE.SERVER };

  const pm = res.paymentMethod;
  if (pm && pm.ready === true) {
    return { state: CARD_STATE.READY, card: { brand: pm.brand || null, last4: pm.last4 || null,
      authorizedAt: pm.authorizedAt || null, updatedAt: pm.updatedAt || null } };
  }
  return { state: CARD_STATE.UPDATE_REQUIRED };
}

/**
 * The safe, human display of a saved card.
 *
 * Brand and last four are the ONLY card facts this application ever holds, and a missing one is
 * simply omitted rather than filled with a placeholder that could read as real.
 */
export function describeCard(card) {
  if (!card) return "";
  const brand = typeof card.brand === "string" && card.brand
    ? card.brand.charAt(0).toUpperCase() + card.brand.slice(1)
    : null;
  const last4 = /^[0-9]{4}$/.test(String(card.last4 || "")) ? card.last4 : null;
  if (brand && last4) return `${brand} ending ${last4}`;
  if (last4) return `Card ending ${last4}`;
  if (brand) return brand;
  return "Card on file";
}

/**
 * Map a Stripe.js confirmation error to one of this surface's failures.
 *
 * A raw Stripe message is never shown: it can carry issuer wording that reads as advice Greet-Me
 * did not give. Only the stable code is consumed.
 */
export function classifyStripeError(error) {
  if (!error) return null;
  const code = error.code || error.decline_code || null;
  if (code === "authentication_required") return CARD_FAILURE.AUTHENTICATION_REQUIRED;
  if (error.type === "card_error" || code === "card_declined") return CARD_FAILURE.DECLINED;
  return CARD_FAILURE.INCOMPLETE;
}

/** Map a completed SetupIntent status to a failure, or null when it genuinely succeeded. */
export function classifySetupIntentStatus(status) {
  if (status === "succeeded") return null;
  if (status === "requires_action" || status === "requires_confirmation") {
    return CARD_FAILURE.AUTHENTICATION_REQUIRED;
  }
  return CARD_FAILURE.INCOMPLETE;
}

/**
 * MAY THIS SUBMIT BE SENT?
 *
 * The single duplicate-submission guard, used by the button's disabled state AND by the submit
 * handler itself. One function rather than two conditions, because a disabled button is a
 * courtesy — a double-click, an Enter key and a fast re-render all reach the handler regardless,
 * so the handler has to refuse on the same rule the button renders from.
 */
export function canSubmit({ submitting, stripeReady, cardComplete, state }) {
  if (submitting === true) return false;               // already in flight
  if (stripeReady !== true) return false;              // Stripe.js has not loaded
  if (cardComplete !== true) return false;             // the card element is not filled in
  if (state === CARD_STATE.UNAVAILABLE) return false;  // the server cannot take a card
  if (state === CARD_STATE.FORBIDDEN) return false;    // the viewer is not the owner
  return true;
}

/** What the primary button says. Adding and replacing are different promises, so they read that way. */
export function submitLabel({ state, submitting, replacing }) {
  if (submitting) return replacing ? "Saving card…" : "Saving card…";
  if (replacing || state === CARD_STATE.READY) return "Save new card";
  return "Save card";
}

/** The one-line status a reader sees above the form. */
export function statusLine({ state, card, failure }) {
  if (state === CARD_STATE.LOADING) return "Checking your saved card…";
  if (state === CARD_STATE.FORBIDDEN) return "Only the organization owner can manage the payment method.";
  if (state === CARD_STATE.UNAVAILABLE) return CARD_COPY[CARD_FAILURE.SERVER];
  if (state === CARD_STATE.READY) return `${describeCard(card)} — ready for gift campaigns.`;
  if (failure && CARD_COPY[failure]) return CARD_COPY[failure];
  return "Add a card so gift campaigns can be funded.";
}
