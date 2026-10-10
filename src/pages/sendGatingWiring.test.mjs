// src/pages/sendGatingWiring.test.mjs — LANE E2 (2026-10-10) source-wiring locks.
// SendGreeting.jsx is a PROTECTED SUBSYSTEM file; these assert only the LANE E2 additions.
// Run (Node 20): node --test src/pages/sendGatingWiring.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(__dirname, p), "utf8").replace(/\r\n/g, "\n");
const SEND = read("SendGreeting.jsx");
const BANK = read("AnimationBank.jsx");
const SETTINGS = read("Settings.jsx");

function body(src, start) {
  const i = src.indexOf(start);
  assert.ok(i > -1, `missing: ${start}`);
  const end = src.indexOf("\n  };\n", i);
  return src.slice(i, end);
}

for (const [name, opener] of [
  ["handleReviewQRCashFresh", "setIsGiftConfirmOpen(true)"],
  ["handleReviewFlowersCheckout", "setIsFlowersCheckoutOpen(true)"],
  ["handleReviewGiftBoxCheckout", "setIsGiftBoxCheckoutOpen(true)"],
]) {
  test(`${name}: the existing preflight runs BEFORE the card/payment step opens, and a block stops it`, () => {
    const fn = body(SEND, `const ${name} = async () => {`);
    const pre = fn.indexOf("await runEarlyGiftEntitlementCheck()");
    const stop = fn.indexOf("if (!early.proceed) return;");
    const open = fn.indexOf(opener);
    assert.ok(pre > -1 && stop > pre && open > stop, `${name}: preflight -> stop -> open`);
  });
}

test("the early check reuses runGiftEntitlementPreflight, never mints a Gift Only token itself, and the at-charge check honours the explicit early choice", () => {
  assert.match(SEND, /const runEarlyGiftEntitlementCheck = \(\) => \{\s*giftOnlyAcknowledgedRef\.current = false;\s*return runGiftEntitlementPreflight\(null, \{ early: true \}\);/);
  const fn = body(SEND, "const runGiftEntitlementPreflight = async (giftAttemptId, { early = false } = {}) => {");
  const earlyBranch = fn.slice(fn.indexOf("if (early) {"), fn.indexOf("if (early) {") + 500);
  assert.match(earlyBranch, /giftOnlyAcknowledgedRef\.current = true;/);
  assert.match(earlyBranch, /resolve\(\{ proceed: true, giftOnlyToken: null \}\);\s*return;/);
  assert.doesNotMatch(earlyBranch.slice(0, earlyBranch.indexOf("return;")), /requestGiftOnlyAuthorization/);
  assert.match(fn, /if \(!early && giftOnlyAcknowledgedRef\.current\) \{\s*giftOnlyAcknowledgedRef\.current = false;[\s\S]{0,120}api\.requestGiftOnlyAuthorization\(giftAttemptId\)/);
});

test("the caution modal is told whether the account is unsubscribed; the verification gate is untouched", () => {
  assert.match(SEND, /const unsubscribed = isUnsubscribedAccount\(user\);/);
  assert.match(SEND, /<GiftEntitlementCautionModal[\s\S]{0,200}unsubscribed=\{unsubscribed\}/);
  assert.match(SEND, /error\?\.code === 'EMAIL_NOT_VERIFIED'/);
  assert.match(SEND, /setPendingSendPayload\(greetingData\);\s*setShowVerificationCheckpoint\(true\);/);
});

test("AnimationBank: no packs / Add More / auto-open for an unsubscribed account; Upgrade instead", () => {
  assert.match(BANK, /const unsubscribed = isUnsubscribedAccount\(user\) \|\| wallet\?\.subscribed === false;/);
  assert.match(BANK, /if \(params\.get\('openPacks'\) !== 'true'\) return;\s*if \(unsubscribed\) return;/);
  assert.match(BANK, /\{showPacksModal && !unsubscribed && \(/);
  assert.match(BANK, /onClick=\{\(\) => \(unsubscribed \? navigate\('\/pricing'\) : setShowPacksModal\(true\)\)\}/);
  assert.match(BANK, /\{!unsubscribed && \(\s*<div style=\{\{\s*display: 'grid'/, "balance cards hidden for a free plan");
});

test("Settings: a free-plan account sees no wallet send balances", () => {
  assert.match(SETTINGS, /\{\(isUnsubscribedAccount\(user\) \|\| wallet\?\.subscribed === false\) \? \(\s*<p data-testid="settings-send-balance-free"/);
});

test("Checkout: ANYTIME_REQUIRES_SUBSCRIPTION (backend lane E1) shows the server reason with an Upgrade link", () => {
  const CHECKOUT = read("Checkout.jsx");
  assert.match(CHECKOUT, /submitNeedsPlan: error\?\.code === 'ANYTIME_REQUIRES_SUBSCRIPTION'/);
  assert.match(CHECKOUT, /data-testid="checkout-needs-plan-upgrade"\s*onClick=\{\(\) => navigate\('\/pricing'\)\}/);
});
