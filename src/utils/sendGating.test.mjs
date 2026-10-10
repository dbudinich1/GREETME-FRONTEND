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

// ---- LANE E3 E3F-M1: QR Cash failure disposition (idempotency key rotation) ----
import { qrCashFailureDisposition, qrCashNotCharged, QR_CASH_OUTCOME_UNKNOWN_MESSAGE } from "./sendGating.js";

test("E3F-M1: network error / timeout on /charge-now -> 'unknown' (key kept, no new PaymentIntent)", () => {
  assert.equal(qrCashFailureDisposition(Object.assign(new Error("Network error"), { networkError: true }), "charge"), "unknown");
  assert.equal(qrCashFailureDisposition(new TypeError("Failed to fetch"), "charge"), "unknown");
  assert.equal(qrCashFailureDisposition(new Error("Gift charge failed"), "charge"), "unknown", "unrecognised response");
});

test("E3F-M1: 5xx from /charge-now -> 'unknown' (the PaymentIntent may exist)", () => {
  for (const status of [500, 502, 503, 504]) {
    assert.equal(qrCashFailureDisposition(Object.assign(new Error("Server error"), { status, code: "GIFT_CHARGE_FAILED" }), "charge"), "unknown", String(status));
  }
});

test("E3F-M1: ANY failure after 3DS succeeded (/finalize) -> 'unknown' — even a 4xx, network or not-ok body", () => {
  for (const err of [
    Object.assign(new Error("Server error"), { status: 500 }),
    Object.assign(new Error("x"), { status: 402 }),
    Object.assign(new Error("Network error"), { networkError: true }),
    new Error("Gift finalization failed"),
  ]) assert.equal(qrCashFailureDisposition(err, "finalize"), "unknown");
});

test("E3F-M1: known non-charges rotate the key as today — 402 decline, 3DS failure/cancel, 4xx pre-charge refusals", () => {
  assert.equal(qrCashFailureDisposition(Object.assign(new Error("Your card was declined"), { status: 402 }), "charge"), "rotate");
  assert.equal(qrCashFailureDisposition(qrCashNotCharged(new Error("Authentication canceled")), "charge"), "rotate", "3DS cancel");
  assert.equal(qrCashFailureDisposition(qrCashNotCharged(new Error("Payment was not completed after authentication.")), "charge"), "rotate");
  for (const status of [400, 401, 403, 404, 429]) {
    assert.equal(qrCashFailureDisposition(Object.assign(new Error("x"), { status }), "charge"), "rotate", String(status));
  }
});

test("E3F-M1: post-charge failures never rotate; outcome-unknown copy", () => {
  assert.equal(qrCashFailureDisposition(new Error("send failed"), "charged"), "keep");
  assert.equal(QR_CASH_OUTCOME_UNKNOWN_MESSAGE, "We couldn't confirm your payment. Please check your email or account before trying again.");
});

// ---- LANE E3 E3F-M2: unknown outcome blocks Pay and pins the key across reopen ----
import { qrCashKeyForOpen } from "./sendGating.js";

test("E3F-M2: reopen after an unknown outcome reuses the SAME key; otherwise a fresh key as before", () => {
  let n = 0;
  const mint = () => `k${++n}`;
  assert.equal(qrCashKeyForOpen({ outcomeUnknown: true, currentKey: "k-old", mint }), "k-old");
  assert.equal(n, 0, "nothing minted while unknown");
  assert.equal(qrCashKeyForOpen({ outcomeUnknown: false, currentKey: "k-old", mint }), "k1");
  assert.equal(qrCashKeyForOpen({ outcomeUnknown: true, currentKey: null, mint }), "k2", "no prior key -> fresh");
});

// A model of the page's QR Cash state machine built ONLY from the helpers SendGreeting uses
// (qrCashKeyForOpen, qrCashFailureDisposition) plus the Pay block, against a fake Stripe that
// counts PaymentIntents per idempotency key (same key -> same PI; different params -> 409).
function makeFakeServer({ finalizeFails = 0 } = {}) {
  const pis = new Map(); // key -> { pm }
  let finalizeFailuresLeft = finalizeFails;
  return {
    get piCount() { return pis.size; },
    chargeNow(key, pm) {
      if (pis.has(key)) {
        if (pis.get(key).pm !== pm) throw Object.assign(new Error("in progress"), { status: 409, code: "PAYMENT_ALREADY_IN_PROGRESS" });
        return { requiresAction: true };
      }
      pis.set(key, { pm });
      return { requiresAction: true };
    },
    finalize() {
      if (finalizeFailuresLeft > 0) { finalizeFailuresLeft -= 1; throw Object.assign(new Error("Server error"), { status: 500 }); }
      return { ok: true };
    },
  };
}
function makePage(server) {
  let n = 0;
  const page = { key: null, unknown: false, error: null, payDisabled: false, open: false };
  page.reopen = () => {
    page.key = qrCashKeyForOpen({ outcomeUnknown: page.unknown, currentKey: page.key, mint: () => `key-${++n}` });
    page.error = page.unknown ? QR_CASH_OUTCOME_UNKNOWN_MESSAGE : null;
    page.payDisabled = page.unknown;
    page.open = true;
  };
  page.close = () => { page.open = false; page.error = null; };
  page.pay = (pm) => {
    if (page.payDisabled || page.unknown) return "blocked";
    let phase = "charge";
    try {
      server.chargeNow(page.key, pm);
      phase = "finalize"; // 3DS succeeded
      server.finalize();
      page.unknown = false;
      return "charged";
    } catch (error) {
      if (error.code === "PAYMENT_ALREADY_IN_PROGRESS") {
        page.error = page.unknown ? QR_CASH_OUTCOME_UNKNOWN_MESSAGE : error.message;
        return "409";
      }
      const d = qrCashFailureDisposition(error, phase);
      if (d === "unknown") { page.unknown = true; page.payDisabled = true; page.error = QR_CASH_OUTCOME_UNKNOWN_MESSAGE; return "unknown"; }
      if (d === "rotate") { page.unknown = false; page.key = `key-${++n}`; }
      return d;
    }
  };
  return page;
}

test("E3F-M2 probe: finalize fails -> 409 -> close -> reopen -> Pay yields at most ONE PaymentIntent", () => {
  const server = makeFakeServer({ finalizeFails: 1 });
  const page = makePage(server);
  page.reopen();
  assert.equal(page.pay("pm_a"), "unknown", "finalize failed after 3DS");
  assert.equal(page.payDisabled, true, "unknown -> Pay disabled");
  assert.equal(page.error, QR_CASH_OUTCOME_UNKNOWN_MESSAGE);
  assert.equal(page.pay("pm_b"), "blocked", "a repeat click cannot reach /charge-now");
  // Even if a 409 arrives for the same key, the unknown message is what shows.
  try { server.chargeNow(page.key, "pm_c"); } catch (e) { page.error = page.unknown ? QR_CASH_OUTCOME_UNKNOWN_MESSAGE : e.message; }
  assert.equal(page.error, QR_CASH_OUTCOME_UNKNOWN_MESSAGE, "never 'close and start the gift again'");
  const keyBefore = page.key;
  page.close();
  page.reopen();
  assert.equal(page.key, keyBefore, "reopen reuses the same key");
  assert.equal(page.payDisabled, true, "still blocked after reopen");
  assert.equal(page.pay("pm_d"), "blocked");
  assert.equal(server.piCount, 1, "at most ONE PaymentIntent");
});

test("E3F-M2 probe: network/5xx unknown outcomes block the same way (one PaymentIntent at most)", () => {
  for (const err of [Object.assign(new Error("Network error"), { networkError: true }), Object.assign(new Error("Server error"), { status: 502 })]) {
    const server = makeFakeServer();
    const real = server.chargeNow.bind(server);
    let first = true;
    server.chargeNow = (k, pm) => { real(k, pm); if (first) { first = false; throw err; } return { requiresAction: true }; };
    const page = makePage(server);
    page.reopen();
    assert.equal(page.pay("pm_a"), "unknown");
    page.close(); page.reopen();
    assert.equal(page.pay("pm_b"), "blocked");
    assert.equal(server.piCount, 1);
  }
});

test("E3F-M2: a definitive known-not-charged outcome (decline) rotates the key and leaves Pay available, as today", () => {
  const server = { chargeNow() { throw Object.assign(new Error("Your card was declined"), { status: 402 }); }, finalize() {} };
  const page = makePage(server);
  page.reopen();
  const k = page.key;
  assert.equal(page.pay("pm_a"), "rotate");
  assert.equal(page.unknown, false);
  assert.notEqual(page.key, k, "fresh key after a decline");
  assert.equal(page.payDisabled, false);
});

test("E3F-M2: a confirmed charge clears the block", () => {
  const server = makeFakeServer();
  const page = makePage(server);
  page.reopen();
  assert.equal(page.pay("pm_a"), "charged");
  assert.equal(page.unknown, false);
  assert.equal(server.piCount, 1);
});
