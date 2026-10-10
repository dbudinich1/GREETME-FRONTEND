// src/utils/sendGating.test.mjs — LANE E2 (2026-10-10) send-gating helpers.
// Run (Node 20): node --test src/utils/sendGating.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isUnsubscribedAccount, canOfferAdditionalSends, shouldOfferTopUp, freePlanBlockCopy, TRIAL_ENDED_HEADLINE,
  resolveRecipientLimit, recipientLimitMessage, isAtRecipientCap, PLAN_RECIPIENT_LIMITS,
} from "./sendGating.js";
import { getErrorMessage } from "./errorMessages.js";

test("isUnsubscribedAccount: free tier (incl. expired trial, lapsed gift → 'free') is unsubscribed", () => {
  assert.equal(isUnsubscribedAccount({ tier: "free", plan: "free" }), true);
  assert.equal(isUnsubscribedAccount({ plan: "free" }), true);
  assert.equal(isUnsubscribedAccount({}), true, "no tier at all defaults to free, as AuthContext does");
  assert.equal(isUnsubscribedAccount({ tier: "free", subscriptionStatus: "canceled" }), true);
  assert.equal(isUnsubscribedAccount({ tier: "x", entitlements: { greetingsPeriod: "trial" } }), true);
});

test("isUnsubscribedAccount: paid tiers, active/trialing Stripe status or paymentLocked are subscribed; unknown user is not judged", () => {
  for (const tier of ["close_circle", "social_butterfly", "unforgettable", "small_business", "founder"]) {
    assert.equal(isUnsubscribedAccount({ tier, entitlements: { greetingsPeriod: "month" } }), false, tier);
  }
  assert.equal(isUnsubscribedAccount({ tier: "free", subscriptionStatus: "active" }), false);
  assert.equal(isUnsubscribedAccount({ tier: "free", subscriptionStatus: "trialing" }), false);
  assert.equal(isUnsubscribedAccount({ tier: "free", paymentLocked: true }), false);
  assert.equal(isUnsubscribedAccount(null), false);
  assert.equal(canOfferAdditionalSends({ tier: "free" }), false);
  assert.equal(canOfferAdditionalSends({ tier: "social_butterfly" }), true);
});

test("shouldOfferTopUp: never for unsubscribed or TRIAL_EXPIRED; unchanged otherwise", () => {
  assert.equal(shouldOfferTopUp({ reasonCode: "TRIAL_EXPIRED" }), false);
  assert.equal(shouldOfferTopUp({ reasonCode: "LIMIT_EXCEEDED" }, { unsubscribed: true }), false);
  assert.equal(shouldOfferTopUp({ reasonCode: "LIMIT_EXCEEDED" }, { unsubscribed: false }), true);
  assert.equal(shouldOfferTopUp({ reasonCode: "WALLET_EXHAUSTED" }), true);
  assert.equal(shouldOfferTopUp({ reasonCode: "WALLET_EXHAUSTED", remediation: ["top_up", "upgrade", "gift_only"] }), true);
  assert.equal(shouldOfferTopUp({ reasonCode: "LIMIT_EXCEEDED", remediation: ["upgrade", "gift_only"] }), false, "server said no top_up");
});

test("freePlanBlockCopy: TRIAL_EXPIRED → exact founder copy; subscribed blocks keep the generic caution (null)", () => {
  assert.equal(TRIAL_ENDED_HEADLINE, "Your free trial has ended — upgrade to send.");
  assert.equal(freePlanBlockCopy({ reasonCode: "TRIAL_EXPIRED" }).headline, TRIAL_ENDED_HEADLINE);
  assert.equal(freePlanBlockCopy({ reasonCode: "WALLET_EXHAUSTED" }, { unsubscribed: true }).headline, TRIAL_ENDED_HEADLINE);
  assert.match(freePlanBlockCopy({ reasonCode: "LIMIT_EXCEEDED" }, { unsubscribed: true }).headline, /free trial Greet-Mes/);
  assert.equal(freePlanBlockCopy({ reasonCode: "LIMIT_EXCEEDED" }, { unsubscribed: false }), null);
  assert.equal(freePlanBlockCopy({ reasonCode: "PREFLIGHT_UNAVAILABLE" }, { unsubscribed: true }), null, "never claim the trial ended when we couldn't check");
});

test("resolveRecipientLimit: server error `limit` wins, then profile entitlements, then plan config", () => {
  assert.equal(resolveRecipientLimit({ errorData: { limit: 7, current: 7 }, user: { tier: "free", entitlements: { recipientLimit: 3 } } }), 7);
  assert.equal(resolveRecipientLimit({ errorData: {}, user: { tier: "close_circle", entitlements: { recipientLimit: 5 } } }), 5);
  assert.equal(resolveRecipientLimit({ user: { tier: "social_butterfly" } }), 15);
  assert.equal(resolveRecipientLimit({ user: { tier: "free" } }), PLAN_RECIPIENT_LIMITS.free);
  assert.equal(resolveRecipientLimit({ user: { tier: "unforgettable", entitlements: { recipientLimit: null } } }), null);
  assert.equal(resolveRecipientLimit({}), null);
});

test("recipientLimitMessage states the number; isAtRecipientCap needs both numbers", () => {
  assert.match(recipientLimitMessage(3), /^Your plan includes 3 recipients/);
  assert.match(recipientLimitMessage(1), /^Your plan includes 1 recipient,/);
  assert.match(recipientLimitMessage(null), /Upgrade/);
  assert.equal(isAtRecipientCap({ limit: 3, count: 3 }), true);
  assert.equal(isAtRecipientCap({ limit: 3, count: 2 }), false);
  assert.equal(isAtRecipientCap({ limit: null, count: 9 }), false);
  assert.equal(isAtRecipientCap({ limit: 3, count: null }), false);
});

test("getErrorMessage: RECIPIENT_LIMIT_REACHED reads the backend's `limit`; TRIAL_EXPIRED is plain", () => {
  assert.match(getErrorMessage({ code: "RECIPIENT_LIMIT_REACHED", data: { limit: 3, current: 3 } }), /Your plan includes 3 recipients/);
  assert.match(getErrorMessage({ code: "RECIPIENT_LIMIT_REACHED" }), /recipient limit/, "falls back when no number was sent");
  assert.equal(getErrorMessage({ code: "TRIAL_EXPIRED" }), "Your free trial has ended — upgrade to send.");
  assert.equal(getErrorMessage({ code: "ANYTIME_REQUIRES_SUBSCRIPTION" }), "Anytime Greet-Me packs are available with an active Greet-Me plan.");
});
