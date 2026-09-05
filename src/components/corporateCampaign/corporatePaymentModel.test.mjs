// src/components/corporateCampaign/corporatePaymentModel.test.mjs — TEAM I (CONNECTION D).
//
// The pure model behind the saved-card panel. These are the decisions that must be right whatever
// the rendering does: readiness fails closed, a raw issuer message never becomes Greet-Me's words,
// a retry is offered only where retrying is safe, and a duplicate submit is refused.
//
// Run (Node 20.x): node --test src/components/corporateCampaign/corporatePaymentModel.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  CARD_STATE, CARD_FAILURE, CARD_COPY, RETRYABLE,
  deriveCardState, describeCard, classifyStripeError, classifySetupIntentStatus,
  canRetry, canSubmit, submitLabel, statusLine,
} from "./corporatePaymentModel.js";

// ── Readiness ────────────────────────────────────────────────────────────────────────────────

test("M1 · a ready card yields the ready state and its safe display fields", () => {
  const s = deriveCardState({ ok: true, paymentMethod: { ready: true, brand: "visa", last4: "4242" } });
  assert.equal(s.state, CARD_STATE.READY);
  assert.deepEqual(s.card, { brand: "visa", last4: "4242", authorizedAt: null, updatedAt: null });
});

test("M2 · readiness FAILS CLOSED — a blip never renders as 'your card is ready'", () => {
  assert.equal(deriveCardState({ ok: true, paymentMethod: { ready: false } }).state, CARD_STATE.UPDATE_REQUIRED);
  assert.equal(deriveCardState({ ok: true, paymentMethod: null }).state, CARD_STATE.UPDATE_REQUIRED);
  assert.equal(deriveCardState({ ok: true }).state, CARD_STATE.UPDATE_REQUIRED);
  assert.equal(deriveCardState({ ok: false, status: 500 }).state, CARD_STATE.UPDATE_REQUIRED);

  const net = deriveCardState({ ok: false, networkError: true });
  assert.equal(net.state, CARD_STATE.UPDATE_REQUIRED);
  assert.equal(net.failure, CARD_FAILURE.NETWORK);
});

test("M3 · not-the-owner and payments-unavailable are their own states, not 'add a card'", () => {
  assert.equal(deriveCardState({ ok: false, unauthorized: true }).state, CARD_STATE.FORBIDDEN);
  assert.equal(deriveCardState({ ok: false, unavailable: true }).state, CARD_STATE.UNAVAILABLE);
});

test("M4 · no result at all is LOADING — never a claim in either direction", () => {
  assert.equal(deriveCardState(null).state, CARD_STATE.LOADING);
  assert.equal(deriveCardState(undefined).state, CARD_STATE.LOADING);
});

// ── Safe display ─────────────────────────────────────────────────────────────────────────────

test("M5 · a card is displayed as brand + last four, and nothing more", () => {
  assert.equal(describeCard({ brand: "visa", last4: "4242" }), "Visa ending 4242");
  assert.equal(describeCard({ brand: null, last4: "4242" }), "Card ending 4242");
  assert.equal(describeCard({ brand: "amex", last4: null }), "Amex");
  assert.equal(describeCard({}), "Card on file");
  assert.equal(describeCard(null), "");
});

test("M6 · a malformed last four is not rendered as if it were a real card", () => {
  assert.equal(describeCard({ brand: "visa", last4: "4242424242424242" }), "Visa");
  assert.equal(describeCard({ brand: "visa", last4: "42" }), "Visa");
});

// ── Failure classification ───────────────────────────────────────────────────────────────────

test("M7 · a Stripe error becomes a STABLE code — the issuer's wording is never shown", () => {
  assert.equal(classifyStripeError({ type: "card_error", code: "card_declined", message: "Call your bank at 555-0100" }),
    CARD_FAILURE.DECLINED);
  assert.equal(classifyStripeError({ code: "authentication_required" }), CARD_FAILURE.AUTHENTICATION_REQUIRED);
  assert.equal(classifyStripeError({ type: "api_error" }), CARD_FAILURE.INCOMPLETE);
  assert.equal(classifyStripeError(null), null);

  // The copy shown for a decline is Greet-Me's own, and contains no issuer text.
  assert.doesNotMatch(CARD_COPY[CARD_FAILURE.DECLINED], /555-0100/);
});

test("M8 · a SetupIntent that did not succeed is never treated as a saved card", () => {
  assert.equal(classifySetupIntentStatus("succeeded"), null);
  assert.equal(classifySetupIntentStatus("requires_action"), CARD_FAILURE.AUTHENTICATION_REQUIRED);
  assert.equal(classifySetupIntentStatus("requires_confirmation"), CARD_FAILURE.AUTHENTICATION_REQUIRED);
  assert.equal(classifySetupIntentStatus("processing"), CARD_FAILURE.INCOMPLETE);
  assert.equal(classifySetupIntentStatus(undefined), CARD_FAILURE.INCOMPLETE);
});

// ── Recovery ─────────────────────────────────────────────────────────────────────────────────

test("M9 · a decline and an authentication requirement are both RECOVERABLE", () => {
  assert.equal(canRetry(CARD_FAILURE.DECLINED), true);
  assert.equal(canRetry(CARD_FAILURE.AUTHENTICATION_REQUIRED), true);
  assert.equal(canRetry(CARD_FAILURE.INCOMPLETE), true);
  assert.equal(canRetry(CARD_FAILURE.NETWORK), true);
  // A server that cannot take cards at all is not retryable from this screen.
  assert.equal(canRetry(CARD_FAILURE.SERVER), false);
  assert.equal(RETRYABLE.includes(CARD_FAILURE.SERVER), false);
});

test("M10 · every failure the reader can see has copy that names an action", () => {
  for (const failure of Object.values(CARD_FAILURE)) {
    assert.equal(typeof CARD_COPY[failure], "string", failure);
    assert.ok(CARD_COPY[failure].length > 0, failure);
  }
});

// ── Duplicate-submission protection ──────────────────────────────────────────────────────────

const base = { submitting: false, stripeReady: true, cardComplete: true, state: CARD_STATE.UPDATE_REQUIRED };

test("M11 · a submit already in flight is REFUSED", () => {
  assert.equal(canSubmit(base), true);
  assert.equal(canSubmit({ ...base, submitting: true }), false);
});

test("M12 · a submit is refused until Stripe.js has loaded and the card element is complete", () => {
  assert.equal(canSubmit({ ...base, stripeReady: false }), false);
  assert.equal(canSubmit({ ...base, cardComplete: false }), false);
});

test("M13 · a submit is refused in states where it could not possibly work", () => {
  assert.equal(canSubmit({ ...base, state: CARD_STATE.UNAVAILABLE }), false);
  assert.equal(canSubmit({ ...base, state: CARD_STATE.FORBIDDEN }), false);
  // Replacing an existing card IS allowed.
  assert.equal(canSubmit({ ...base, state: CARD_STATE.READY }), true);
});

// ── Labels and status ────────────────────────────────────────────────────────────────────────

test("M14 · adding and replacing read differently, and both read as in-progress while saving", () => {
  assert.equal(submitLabel({ state: CARD_STATE.UPDATE_REQUIRED, submitting: false, replacing: false }), "Save card");
  assert.equal(submitLabel({ state: CARD_STATE.READY, submitting: false, replacing: true }), "Save new card");
  assert.equal(submitLabel({ state: CARD_STATE.UPDATE_REQUIRED, submitting: true, replacing: false }), "Saving card…");
});

test("M15 · the status line tells the truth in every state", () => {
  assert.match(statusLine({ state: CARD_STATE.LOADING }), /Checking/);
  assert.match(statusLine({ state: CARD_STATE.READY, card: { brand: "visa", last4: "4242" } }), /Visa ending 4242/);
  assert.match(statusLine({ state: CARD_STATE.FORBIDDEN }), /organization owner/);
  assert.equal(statusLine({ state: CARD_STATE.UNAVAILABLE }), CARD_COPY[CARD_FAILURE.SERVER]);
  assert.equal(statusLine({ state: CARD_STATE.UPDATE_REQUIRED, failure: CARD_FAILURE.DECLINED }),
    CARD_COPY[CARD_FAILURE.DECLINED]);
  assert.match(statusLine({ state: CARD_STATE.UPDATE_REQUIRED }), /Add a card/);
});
