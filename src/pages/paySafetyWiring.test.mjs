// src/pages/paySafetyWiring.test.mjs — LANE E3 (2026-10-10) source-wiring locks.
// SendGreeting.jsx is a PROTECTED SUBSYSTEM file; these assert only the LANE E3 additions and that
// the locked verification gate and the idempotency/finalize semantics are untouched.
// Run (Node 20): node --test src/pages/paySafetyWiring.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(__dirname, p), "utf8").replace(/\r\n/g, "\n");
const SEND = read("SendGreeting.jsx");
const GIFTBOX = read("../components/providerCheckout/GiftBoxCheckoutModal.jsx");
const FLOWERS = read("../components/providerCheckout/ProviderCheckoutModal.jsx");

function body(src, start) {
  const i = src.indexOf(start);
  assert.ok(i > -1, `missing: ${start}`);
  const end = src.indexOf("\n  };\n", i);
  return src.slice(i, end);
}

const PREFLIGHT = body(SEND, "const runGiftEntitlementPreflight = async (giftAttemptId, { early = false } = {}) => {");
const CHARGE = body(SEND, "const handleGiftConfirm = async (paymentMethodId, stripeInstance) => {");

test("email unconfirmed: the preflight checks the server reason BEFORE canSendGreeting (no client-side emailVerified inference)", () => {
  const block = PREFLIGHT.indexOf("const emailBlocked = emailConfirmationBlock({ preflight });");
  const stop = PREFLIGHT.indexOf("if (emailBlocked) return openEmailConfirmationCaution(emailBlocked);", block);
  const can = PREFLIGHT.indexOf("if (preflight?.canSendGreeting) return { proceed: true, giftOnlyToken: null };");
  assert.ok(block > -1 && stop > block && can > stop, "email check -> stop -> canSendGreeting");
  // A missing emailVerified / demo account must never be blocked by the client: no user-based inference.
  assert.doesNotMatch(PREFLIGHT, /emailConfirmationBlock\(\{[^}]*user/);
  assert.doesNotMatch(PREFLIGHT, /emailVerified/);
});

test("email unconfirmed: checkout does not open — every caution outcome resolves proceed:false (no Gift-only token, no top-up/upgrade route)", () => {
  const start = SEND.indexOf("const openEmailConfirmationCaution = (emailPreflight) => new Promise((resolve) => {");
  assert.ok(start > -1);
  const fn = SEND.slice(start, SEND.indexOf("\n  });\n", start));
  assert.match(fn, /resolve\(\{ proceed: false, giftOnlyToken: null \}\)/);
  assert.doesNotMatch(fn, /proceed: true/);
  assert.doesNotMatch(fn, /requestGiftOnlyAuthorization|saveDraftFor|navigate\(/);
  assert.match(fn, /onTopUp: stop, onUpgrade: stop, onContinueGiftOnly: stop, onClose: stop/);
  // The three review handlers already stop on !early.proceed before opening the card/payment step
  // (asserted by sendGatingWiring.test.mjs); the preflight they call is the one above.
  assert.match(SEND, /const runEarlyGiftEntitlementCheck = \(\) => \{\s*giftOnlyAcknowledgedRef\.current = false;\s*return runGiftEntitlementPreflight\(null, \{ early: true \}\);/);
});

test("the caution gets the EXISTING resend action (api.resendVerificationEmail)", () => {
  assert.match(SEND, /<GiftEntitlementCautionModal[\s\S]{0,300}onResendConfirmation=\{async \(\) => api\.resendVerificationEmail\(\)\}/);
});

test("QR Cash: a ref guard refuses a second charge call while an attempt (charge, 3DS, finalize) is in flight", () => {
  assert.match(SEND, /const qrCashChargeInFlight = useRef\(false\);/);
  assert.match(CHARGE, /^const handleGiftConfirm = async \(paymentMethodId, stripeInstance\) => \{\s*if \(qrCashChargeInFlight\.current\) return;/);
  const set = CHARGE.indexOf("qrCashChargeInFlight.current = true;");
  const charge = CHARGE.indexOf("api.chargeGift(");
  assert.ok(set > -1 && charge > set, "guard set before /charge-now");
  assert.match(CHARGE, /\} finally \{\s*qrCashChargeInFlight\.current = false;\s*setGiftCharging\(false\);/);
  // The one explicit SEND_ENTITLEMENT_AT_RISK re-attempt is awaited, so the outer finally cannot
  // release the guard while it runs.
  assert.match(CHARGE, /return await handleGiftConfirm\(paymentMethodId, stripeInstance\);/);
});

test("QR Cash: 409 PAYMENT_ALREADY_IN_PROGRESS shows the server message and KEEPS the giftRequestId; no retry", () => {
  const i = CHARGE.indexOf("if (error?.code === PAYMENT_ALREADY_IN_PROGRESS_CODE) {");
  assert.ok(i > -1);
  const branch = CHARGE.slice(i, CHARGE.indexOf("}", i) + 1);
  assert.match(branch, /setGiftChargeError\(paymentInProgressMessage\(error\)\);\s*return;/);
  assert.doesNotMatch(branch, /setGiftRequestId|handleGiftConfirm|chargeGift/);
  assert.ok(i < CHARGE.indexOf("setGiftRequestId(crypto.randomUUID());"), "returns before the generic rotate");
});

test("QR Cash: /charge-now EMAIL_NOT_VERIFIED closes the card step and shows the confirm-email caution", () => {
  const i = CHARGE.indexOf("if (error?.code === 'EMAIL_NOT_VERIFIED') {");
  assert.ok(i > -1);
  const branch = CHARGE.slice(i, CHARGE.indexOf("return;", i));
  assert.match(branch, /setIsGiftConfirmOpen\(false\);[\s\S]*openEmailConfirmationCaution\(/);
});

test("unchanged: amounts, idempotency id generation, /finalize call, and the locked verification gate", () => {
  assert.match(CHARGE, /const giftAmountCents = Math\.round\(giftAmountDollars \* 100\);/);
  assert.match(CHARGE, /api\.finalizeGift\(\{\s*paymentIntentId: chargeResult\.paymentIntentId,/);
  assert.match(CHARGE, /\/\/ Fresh idempotency key so the next attempt isn't blocked by Stripe\s*setGiftRequestId\(crypto\.randomUUID\(\)\);/);
  assert.match(SEND, /setGiftRequestId\(crypto\.randomUUID\(\)\);\s*setIsPreSendReviewOpen\(false\);\s*setIsGiftConfirmOpen\(true\);/);
  assert.match(SEND, /if \(error\?\.code === 'EMAIL_NOT_VERIFIED'\) \{\s*setPendingSendPayload\(greetingData\);\s*setShowVerificationCheckpoint\(true\);/);
  assert.match(SEND, /<EmailVerificationModal[\s\S]{0,120}onResend=\{async \(\) => api\.resendVerificationEmail\(\)\}/);
});

test("Flowers and Gift Box checkouts show the same confirm-email message on a 403 EMAIL_NOT_VERIFIED", () => {
  assert.match(GIFTBOX, /if \(code === 'EMAIL_NOT_VERIFIED'\) \{[\s\S]{0,300}setFailure\(EMAIL_UNCONFIRMED_MESSAGE\);\s*return;/);
  assert.ok(GIFTBOX.indexOf("if (code === 'EMAIL_NOT_VERIFIED')") < GIFTBOX.indexOf("setOutcomeUnknown(true);\n      setFailure(OUTCOME_UNKNOWN_MESSAGE);"), "not treated as an unknown outcome");
  assert.match(FLOWERS, /setFailure\(err\?\.code === 'EMAIL_NOT_VERIFIED'\s*\? EMAIL_UNCONFIRMED_MESSAGE/);
  // Both already carry their own synchronous in-flight guard (unchanged).
  assert.match(GIFTBOX, /if \(submitting\.current\) return;/);
  assert.match(FLOWERS, /submitting\.current/);
});
