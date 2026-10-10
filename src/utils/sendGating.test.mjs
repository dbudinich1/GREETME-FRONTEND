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

test("SG-M1: expired gifted plan (tier 'free' + subscriptionStatus 'active', lazy expiry) is UNSUBSCRIBED; a paid tier + 'active' is subscribed", () => {
  assert.equal(isUnsubscribedAccount({ tier: "free", subscriptionStatus: "active" }), true);
  assert.equal(isUnsubscribedAccount({ tier: "free", plan: "free", subscriptionStatus: "trialing" }), true);
  assert.equal(canOfferAdditionalSends({ tier: "free", subscriptionStatus: "active" }), false, "no Top Up / packs");
  assert.equal(isUnsubscribedAccount({ tier: "close_circle", subscriptionStatus: "active" }), false);
  assert.equal(isUnsubscribedAccount({ tier: "social_butterfly", subscriptionStatus: "trialing", entitlements: { greetingsPeriod: "trial" } }), false, "paid tier + active/trialing still wins");
  assert.equal(isUnsubscribedAccount({ tier: "free", subscriptionStatus: "active", paymentLocked: true }), false, "paymentLocked unchanged");
});

// ---- LANE E3 (2026-10-10): pay safety ----
import {
  isEmailConfirmationBlock, emailConfirmationBlock, paymentInProgressMessage,
  EMAIL_UNCONFIRMED_MESSAGE, PAYMENT_ALREADY_IN_PROGRESS_MESSAGE,
} from "./sendGating.js";

const EMAIL_MSG = "Confirm your email address to send. Check your inbox for the confirmation link.";

test("E3: the email message is the exact founder/contract copy", () => {
  assert.equal(EMAIL_UNCONFIRMED_MESSAGE, EMAIL_MSG);
});

test("E3: preflight EMAIL_NOT_VERIFIED is recognised in every contract shape", () => {
  for (const pf of [
    { canSendGreeting: false, reasonCode: "EMAIL_NOT_VERIFIED" },
    { canSendGreeting: false, reason: "EMAIL_NOT_VERIFIED" },
    { ok: false, code: "EMAIL_NOT_VERIFIED" },
    { canSendGreeting: false, reasonCode: "X", remediation: ["confirm_email"] },
  ]) assert.equal(isEmailConfirmationBlock(pf), true, JSON.stringify(pf));
  for (const pf of [null, undefined, {}, { canSendGreeting: true, reasonCode: "OK" }, { reasonCode: "TRIAL_EXPIRED", remediation: ["upgrade", "gift_only"] }]) {
    assert.equal(isEmailConfirmationBlock(pf), false, JSON.stringify(pf));
  }
});

test("E3: the client never infers an unconfirmed email itself (missing emailVerified / demo accounts must not be blocked); server preflight only", () => {
  assert.equal(emailConfirmationBlock({ preflight: { canSendGreeting: true, reasonCode: "OK" }, user: { emailVerified: false } }), null);
  assert.equal(emailConfirmationBlock({ preflight: null, user: { emailVerified: false } }), null);
  assert.equal(emailConfirmationBlock({}), null);
});

test("E3: emailConfirmationBlock → a confirm_email-only caution (no top_up / upgrade / gift_only); null for a verified sender", () => {
  // The exact E3-BE (205bb96) preflight body.
  const fromPreflight = emailConfirmationBlock({ preflight: { ok: true, canSendGreeting: false, sendLimitUnlimited: false, remaining: null, reasonCode: "EMAIL_NOT_VERIFIED", remediation: ["confirm_email"], message: EMAIL_MSG } });
  const noMessage = emailConfirmationBlock({ preflight: { canSendGreeting: false, reasonCode: "EMAIL_NOT_VERIFIED" } });
  for (const b of [fromPreflight, noMessage]) {
    assert.equal(b.reasonCode, "EMAIL_NOT_VERIFIED");
    assert.equal(b.canSendGreeting, false);
    assert.equal(b.message, EMAIL_MSG);
    assert.deepEqual(b.remediation, ["confirm_email"]);
    assert.equal(shouldOfferTopUp(b), false);
  }
  // Verified + subscribed: unchanged (no block at all).
  assert.equal(emailConfirmationBlock({ preflight: { canSendGreeting: true, reasonCode: "OK" }, user: { emailVerified: true, tier: "close_circle" } }), null);
  assert.equal(emailConfirmationBlock({ preflight: { canSendGreeting: false, reasonCode: "LIMIT_EXCEEDED" }, user: { emailVerified: true } }), null);
});

test("E3: 409 PAYMENT_ALREADY_IN_PROGRESS shows the server's words; contract copy as fallback; getErrorMessage maps the code", () => {
  const server = "This payment is already in progress. Please finish your bank's verification step, or close and start the gift again.";
  assert.equal(paymentInProgressMessage({ code: "PAYMENT_ALREADY_IN_PROGRESS", message: server }), server);
  assert.equal(paymentInProgressMessage({ code: "PAYMENT_ALREADY_IN_PROGRESS", message: "HTTP 409" }), PAYMENT_ALREADY_IN_PROGRESS_MESSAGE);
  assert.equal(paymentInProgressMessage({}), PAYMENT_ALREADY_IN_PROGRESS_MESSAGE);
  assert.equal(getErrorMessage({ code: "PAYMENT_ALREADY_IN_PROGRESS", status: 409 }), server);
});
