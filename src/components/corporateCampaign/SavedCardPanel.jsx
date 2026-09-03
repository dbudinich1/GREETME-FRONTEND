// src/components/corporateCampaign/SavedCardPanel.jsx
//
// TEAM I (CONNECTION D) — the corporate saved-card panel, inside the EXISTING corporate dashboard.
// It is one more `gcd-panel` section beside Campaigns; nothing about the dashboard is redesigned.
//
// THE RULE THIS COMPONENT EXISTS TO KEEP. Raw card data never enters Greet-Me. The number, CVC and
// expiry are typed into Stripe's own `CardElement`, which renders in a cross-origin iframe this
// application cannot read. `stripe.confirmCardSetup` sends them from the browser straight to
// Stripe. What comes back — and all this component ever holds — is a SetupIntent id, a brand, and
// four digits. The client secret is used once, in the call below, and is never put into state,
// never persisted, and never logged.
//
// The Stripe wiring is the repository's EXISTING pattern (src/stripe/stripeProvider.js +
// @stripe/react-stripe-js), the same one GiftConfirmationModal.jsx already uses. No second Stripe
// initialization, no second publishable key, no new dependency.
//
// Every decision — what to show, what the button says, whether a retry is offered, and whether a
// submit may be sent at all — comes from the pure model in corporatePaymentModel.js, so it is
// proven by unit tests rather than only by a rendering.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Elements, CardElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { stripePromise } from "../../stripe/stripeProvider";
import { createCorporatePaymentsClient } from "../../api/corporatePayments.js";
import {
  CARD_STATE, CARD_FAILURE, CARD_COPY,
  deriveCardState, describeCard, classifyStripeError, classifySetupIntentStatus,
  canRetry, canSubmit, submitLabel, statusLine,
} from "./corporatePaymentModel.js";

const CARD_ELEMENT_OPTIONS = {
  hidePostalCode: false,
  style: {
    base: {
      fontSize: "15px",
      color: "#1b1830",
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      "::placeholder": { color: "#928ea8" },
    },
    invalid: { color: "#c0392b" },
  },
};

/**
 * The form. Must be rendered inside <Elements>, because that is what supplies the Stripe hooks.
 *
 * `client` is injected so the whole flow is testable without a network, exactly as the rest of the
 * corporate surface injects its client.
 */
function SavedCardForm({ orgId, client, initial, onSaved }) {
  const [state, setState] = useState(initial ? initial.state : CARD_STATE.LOADING);
  const [card, setCard] = useState(initial ? initial.card : null);
  const [failure, setFailure] = useState(initial ? initial.failure : null);
  const [submitting, setSubmitting] = useState(false);
  const [cardComplete, setCardComplete] = useState(false);
  // True while the reader is deliberately replacing a card that already works.
  const [replacing, setReplacing] = useState(false);

  const stripe = useStripe();
  const elements = useElements();

  // A ref, not state: the guard has to be correct WITHIN one tick, and a state update is not.
  // Two clicks landing in the same tick would both read `submitting === false` from state.
  const inFlight = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const refresh = useCallback(async () => {
    const res = await client.getPaymentMethod(orgId);
    if (!mounted.current) return;
    const next = deriveCardState(res);
    setState(next.state);
    setCard(next.card || null);
    if (next.failure) setFailure(next.failure);
  }, [client, orgId]);

  useEffect(() => { if (!initial) refresh(); }, [initial, refresh]);

  const submittable = canSubmit({ submitting, stripeReady: Boolean(stripe && elements), cardComplete, state });

  const handleSubmit = useCallback(async (e) => {
    if (e && typeof e.preventDefault === "function") e.preventDefault();

    // THE DUPLICATE-SUBMISSION GUARD, on the same rule the button renders from — plus the
    // synchronous ref, so a double-click cannot open two SetupIntents.
    if (inFlight.current) return;
    if (!canSubmit({ submitting, stripeReady: Boolean(stripe && elements), cardComplete, state })) return;

    inFlight.current = true;
    setSubmitting(true);
    setFailure(null);

    try {
      // 1. Ask Greet-Me to begin (or replace) authorization. Replacement uses its own route so the
      //    existing card stays usable until the new one actually completes.
      const begin = replacing || state === CARD_STATE.READY
        ? await client.replacePaymentMethod(orgId)
        : await client.createSetupIntent(orgId);

      if (!begin || begin.ok !== true) {
        setFailure(begin && begin.networkError ? CARD_FAILURE.NETWORK : CARD_FAILURE.SERVER);
        if (begin && begin.unavailable === true) setState(CARD_STATE.UNAVAILABLE);
        if (begin && begin.unauthorized === true) setState(CARD_STATE.FORBIDDEN);
        return;
      }
      const clientSecret = begin.data && begin.data.clientSecret;
      if (!clientSecret) { setFailure(CARD_FAILURE.SERVER); return; }

      // 2. The card leaves the browser for STRIPE ONLY. `clientSecret` is used here and nowhere
      //    else — it is deliberately not held in state, so it cannot be re-read or re-sent.
      const cardElement = elements.getElement(CardElement);
      if (!cardElement) { setFailure(CARD_FAILURE.INCOMPLETE); return; }

      const confirmed = await stripe.confirmCardSetup(clientSecret, {
        payment_method: { card: cardElement },
      });

      if (confirmed.error) {
        // Stable code only. The issuer's own wording is never shown as if it were Greet-Me's.
        setFailure(classifyStripeError(confirmed.error));
        return;
      }
      const intent = confirmed.setupIntent || {};
      const statusFailure = classifySetupIntentStatus(intent.status);
      if (statusFailure) { setFailure(statusFailure); return; }

      // 3. Tell Greet-Me which SetupIntent to verify. ONLY the id is sent — the server re-verifies
      //    every identity against Stripe's own object rather than trusting this call.
      const done = await client.completeSetupIntent(orgId, intent.id);
      if (!mounted.current) return;
      if (!done || done.ok !== true) {
        setFailure(done && done.networkError ? CARD_FAILURE.NETWORK : CARD_FAILURE.SERVER);
        return;
      }

      const next = deriveCardState(done);
      setState(next.state);
      setCard(next.card || null);
      setReplacing(false);
      setCardComplete(false);
      if (typeof onSaved === "function") onSaved(next);
    } catch {
      if (mounted.current) setFailure(CARD_FAILURE.INCOMPLETE);
    } finally {
      inFlight.current = false;
      if (mounted.current) setSubmitting(false);
    }
  }, [client, orgId, stripe, elements, cardComplete, state, submitting, replacing, onSaved]);

  // The form is offered ONLY where submitting it could actually work: when a card is needed, or
  // when the reader is deliberately replacing one that already works. Rendering it while payments
  // are unavailable, or to someone who is not the owner, would invite an attempt that is refused
  // before it starts — a worse answer than saying plainly that this is not something they can do.
  const showForm = state === CARD_STATE.UPDATE_REQUIRED || (replacing && state === CARD_STATE.READY);
  const retryOffered = Boolean(failure) && canRetry(failure) && showForm;

  return (
    <form data-testid="saved-card-form" onSubmit={handleSubmit}>
      <p className="gcd-panel-note" data-testid="saved-card-status">
        {statusLine({ state, card, failure })}
      </p>

      {state === CARD_STATE.READY && !replacing ? (
        <div data-testid="saved-card-ready" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <span data-testid="saved-card-display" style={{ fontWeight: 700 }}>{describeCard(card)}</span>
          <button
            type="button"
            className="gcd-btn"
            data-testid="replace-card"
            onClick={() => { setReplacing(true); setFailure(null); setCardComplete(false); }}
          >
            Replace card
          </button>
        </div>
      ) : null}

      {showForm ? (
        <div data-testid="saved-card-entry" style={{ marginTop: 12 }}>
          <label htmlFor="gcd-card" style={{ display: "block", fontSize: ".78rem", fontWeight: 700, marginBottom: 6 }}>
            Card details
          </label>
          {/* Stripe's own element. Greet-Me renders the box; Stripe owns everything inside it. */}
          <div id="gcd-card" data-testid="card-element-host"
            style={{ padding: "10px 12px", border: "1px solid rgba(27,24,48,.2)", borderRadius: 10, background: "#fff" }}>
            <CardElement
              options={CARD_ELEMENT_OPTIONS}
              onChange={(ev) => {
                setCardComplete(Boolean(ev && ev.complete));
                if (ev && ev.error) setFailure(CARD_FAILURE.INCOMPLETE);
              }}
            />
          </div>

          {failure ? (
            <p data-testid="saved-card-error" role="alert"
              style={{ color: "#c0392b", fontSize: ".82rem", marginTop: 10 }}>
              {CARD_COPY[failure]}
            </p>
          ) : null}

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              type="submit"
              className="gcd-btn gcd-btn--primary"
              data-testid="submit-card"
              disabled={!submittable}
              aria-busy={submitting ? "true" : "false"}
            >
              {submitLabel({ state, submitting, replacing })}
            </button>
            {replacing ? (
              <button type="button" className="gcd-btn" data-testid="cancel-replace"
                onClick={() => { setReplacing(false); setFailure(null); }}>
                Keep current card
              </button>
            ) : null}
          </div>

          {retryOffered ? (
            <p className="gcd-panel-note" data-testid="retry-hint" style={{ marginTop: 8 }}>
              Nothing was charged. Enter card details again to retry.
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

/**
 * The panel. Supplies the Elements context and nothing else.
 *
 * `stripeOverride` exists for tests only, and is the SAME injection shape `<Elements stripe>`
 * already takes — production always resolves the shared `stripePromise`.
 */
export default function SavedCardPanel({ orgId, client, initial, onSaved, stripeOverride }) {
  const stripeSource = stripeOverride || stripePromise;
  // The panel owns its client so the dashboard never has to import one — see the note beside the
  // import in GreetingAutomationCampaigns.jsx. `client` remains injectable for tests.
  const resolvedClient = useMemo(
    () => client || createCorporatePaymentsClient(),
    [client]
  );

  if (!orgId) return null;

  return (
    <section className="gcd-panel" data-testid="saved-card-panel" aria-labelledby="gcd-card-head">
      <div className="gcd-panel-head">
        <div>
          <h2 className="gcd-panel-title" id="gcd-card-head">Payment method</h2>
          <p className="gcd-panel-note">
            Gift campaigns are charged to this card at the provider’s own quoted cost. Greet-Me adds nothing to it.
          </p>
        </div>
      </div>

      {!stripeSource ? (
        // Truthful rather than a broken form: without a publishable key no card can be collected.
        <p className="gcd-panel-note" data-testid="saved-card-unconfigured">
          {CARD_COPY[CARD_FAILURE.SERVER]}
        </p>
      ) : (
        <Elements stripe={stripeSource}>
          <SavedCardForm orgId={orgId} client={resolvedClient} initial={initial} onSaved={onSaved} />
        </Elements>
      )}
    </section>
  );
}

export { SavedCardForm };
