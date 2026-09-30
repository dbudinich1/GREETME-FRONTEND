// src/pages/sendLimitRecoveryPathWiring.test.mjs
//
// SEND-LIMIT RECOVERY CORRECTION (2026-09-30) — proves, against the real source of SendGreeting.jsx
// and PaymentSuccess.jsx, the two frontend halves of "after a successful Top Up/Upgrade, return to
// the exact paused send with the composed Greet-Me AND the already-confirmed gift preserved":
//   - saveDraftForPricingReturn's snapshot now carries confirmedGiftPayload/giftSeparatedByEntitlement
//     and sets the greetme_post_checkout_return session marker;
//   - the returnTo==='send' restore effect rehydrates that same state and arms a one-shot auto-retry;
//   - the auto-retry effect fires handleRetryGreetingOnly exactly once per arm, gated on both the ref
//     and confirmedGiftPayload actually being present (never on an ordinary, gift-free return);
//   - PaymentSuccess.jsx reads and consumes that SAME marker before its unrelated sendDraftId branch,
//     and routes back to /dashboard/send?returnTo=send.
// It also proves handleReviewMarketplaceCheckout (the previously-ungated merch/marketplace checkout
// entry point) now runs the entitlement preflight before writing its resume draft, and forwards
// whatever Gift Only token that preflight returns.
//
// WHY SOURCE-BASED. SendGreeting.jsx is a ~3,800-line page wired to auth/cart/router/draft services;
// mounting it would require stubs of unproven fidelity for a purely structural/wiring claim. This
// follows the exact convention already established in this file's sibling,
// sendGreetingFlowersWiring.test.mjs, for the same reasons.
//
// Run (Node 20.x): node --test src/pages/sendLimitRecoveryPathWiring.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SEND_SRC = readFileSync(join(__dirname, "SendGreeting.jsx"), "utf8").replace(/\r\n/g, "\n");
const SUCCESS_SRC = readFileSync(join(__dirname, "PaymentSuccess.jsx"), "utf8").replace(/\r\n/g, "\n");

const block = (src, startNeedle, endNeedle, label) => {
  const a = src.indexOf(startNeedle);
  assert.ok(a > -1, `${label}: start not found`);
  const b = src.indexOf(endNeedle, a);
  assert.ok(b > a, `${label}: end not found`);
  return src.slice(a, b);
};

// ===========================================================================
// saveDraftForPricingReturn — the shared "go top up/upgrade, then come back" snapshot
// ===========================================================================

const SAVE_DRAFT_FN_END = "navigate('/dashboard/pricing?view=personal&returnTo=send');\n  };";

test("saveDraftForPricingReturn's snapshot carries confirmedGiftPayload and giftSeparatedByEntitlement", () => {
  const fn = block(SEND_SRC, "const saveDraftForPricingReturn = () => {", SAVE_DRAFT_FN_END, "saveDraftForPricingReturn");
  assert.match(fn, /confirmedGiftPayload:\s*confirmedGiftPayload\s*\|\|\s*null/);
  assert.match(fn, /giftSeparatedByEntitlement:\s*!!giftSeparatedByEntitlement/);
});

test("saveDraftForPricingReturn sets the same-tab return marker PaymentSuccess.jsx reads, before navigating to pricing", () => {
  const fn = block(SEND_SRC, "const saveDraftForPricingReturn = () => {", SAVE_DRAFT_FN_END, "saveDraftForPricingReturn") + SAVE_DRAFT_FN_END;
  const markerIdx = fn.indexOf("greetme_post_checkout_return");
  const navIdx = fn.indexOf("navigate('/dashboard/pricing");
  assert.ok(markerIdx > -1, "marker must be set");
  assert.ok(navIdx > markerIdx, "marker must be set BEFORE navigating away, not after");
  assert.match(fn, /sessionStorage\.setItem\('greetme_post_checkout_return',\s*'send'\)/);
});

test("all four Top Up / Upgrade exit points (caution modal x2, recovery panel x2) still route through saveDraftForPricingReturn — no bypass was introduced", () => {
  // The caution modal's onTopUp/onUpgrade invoke it directly; the recovery panel's buttons pass it
  // as a bare onClick handler reference (no separate wrapper that could diverge from this snapshot).
  const directCalls = (SEND_SRC.match(/saveDraftForPricingReturn\(\)/g) || []).length;
  const onClickRefs = (SEND_SRC.match(/onClick=\{saveDraftForPricingReturn\}/g) || []).length;
  assert.equal(directCalls, 2, "caution modal onTopUp/onUpgrade");
  assert.equal(onClickRefs, 2, "recovery panel Top Up/Upgrade buttons");
});

// ===========================================================================
// Restore effect — rehydrating the confirmed-gift recovery state on return
// ===========================================================================

test("the returnTo==='send' restore effect rehydrates confirmedGiftPayload/giftSeparatedByEntitlement and arms the auto-retry ref, only when confirmedGiftPayload was actually saved", () => {
  const restoreBlock = block(
    SEND_SRC,
    "if ((returnTo === 'send' || restoredGiftLink)",
    "// Clean up saved state",
    "restore effect"
  );
  const guardedBlock = block(restoreBlock, "if (parsed.confirmedGiftPayload) {", "}", "confirmedGiftPayload rehydration");
  assert.match(guardedBlock, /setConfirmedGiftPayload\(parsed\.confirmedGiftPayload\)/);
  assert.match(guardedBlock, /setGiftSeparatedByEntitlement\(!!parsed\.giftSeparatedByEntitlement\)/);
  assert.match(guardedBlock, /autoRetryAfterReturnRef\.current\s*=\s*true/);
});

test("autoRetryAfterReturnRef is declared as a ref initialized to false, alongside the existing hasRestoredStateRef", () => {
  assert.match(SEND_SRC, /const hasRestoredStateRef = useRef\(false\);[\s\S]{0,800}const autoRetryAfterReturnRef = useRef\(false\);/);
});

// ===========================================================================
// Auto-retry effect — replaying the paused send exactly once, only when armed
// ===========================================================================

test("the auto-retry effect only fires when BOTH the ref is armed AND confirmedGiftPayload is present, disarms itself before calling, and calls handleRetryGreetingOnly (never a new charge/order path)", () => {
  const effectBlock = block(
    SEND_SRC,
    "useEffect(() => {\n    if (!autoRetryAfterReturnRef.current) return;",
    "}, [confirmedGiftPayload]);",
    "auto-retry effect"
  );
  const lines = effectBlock.split("\n").map((l) => l.trim()).filter(Boolean);
  const guardIdx = lines.findIndex((l) => l.includes("if (!autoRetryAfterReturnRef.current) return;"));
  const giftGuardIdx = lines.findIndex((l) => l.includes("if (!confirmedGiftPayload) return;"));
  const disarmIdx = lines.findIndex((l) => l.includes("autoRetryAfterReturnRef.current = false;"));
  const callIdx = lines.findIndex((l) => l.includes("handleRetryGreetingOnly();"));
  assert.ok(guardIdx > -1 && giftGuardIdx > -1 && disarmIdx > -1 && callIdx > -1, "all four statements must be present");
  assert.ok(guardIdx < giftGuardIdx, "ref guard must be checked before the gift-payload guard");
  assert.ok(giftGuardIdx < disarmIdx, "gift-payload guard must be checked before disarming");
  assert.ok(disarmIdx < callIdx, "ref must be disarmed BEFORE calling — a re-render during the async call must not re-fire");
});

test("an ordinary gift-free return (no confirmedGiftPayload ever saved) never triggers the auto-retry effect — the ref is only armed inside the confirmedGiftPayload branch above", () => {
  // Structural proof: the ONLY assignment to autoRetryAfterReturnRef.current = true in the whole file
  // sits inside the `if (parsed.confirmedGiftPayload)` guard proven above — there is no unconditional
  // arm site that could fire the retry for a plain top-up/upgrade with no gift involved.
  const armSites = [...SEND_SRC.matchAll(/autoRetryAfterReturnRef\.current\s*=\s*true/g)];
  assert.equal(armSites.length, 1, "exactly one arm site must exist");
});

// ===========================================================================
// handleReviewMarketplaceCheckout — the previously-ungated merch/marketplace checkout entry point
// ===========================================================================

test("handleReviewMarketplaceCheckout is async and runs the entitlement preflight BEFORE writing the resume draft or navigating to checkout", () => {
  const fn = block(SEND_SRC, "const handleReviewMarketplaceCheckout = async () => {", "\n  };", "handleReviewMarketplaceCheckout");
  const preflightIdx = fn.indexOf("runGiftEntitlementPreflight(uuid)");
  const writeIdx = fn.indexOf("writeResumeDraft(uuid,");
  const navIdx = fn.indexOf("navigate(`/dashboard/checkout");
  assert.ok(preflightIdx > -1 && writeIdx > -1 && navIdx > -1);
  assert.ok(preflightIdx < writeIdx, "preflight must run before the resume draft is written");
  assert.ok(writeIdx < navIdx, "resume draft must be written before navigating to checkout");
  assert.match(fn, /if \(!proceed\) return;/, "a refused/cancelled preflight must stop before any draft is written");
});

test("handleReviewMarketplaceCheckout forwards whatever giftOnlyToken the preflight returns into the resume draft, never a hardcoded/omitted value", () => {
  const fn = block(SEND_SRC, "const handleReviewMarketplaceCheckout = async () => {", "\n  };", "handleReviewMarketplaceCheckout");
  assert.match(fn, /giftOnlyToken:\s*giftOnlyToken\s*\|\|\s*null/);
});

// ===========================================================================
// PaymentSuccess.jsx — consuming the return marker
// ===========================================================================

test("PaymentSuccess.jsx reads and immediately clears greetme_post_checkout_return, then routes to /dashboard/send?returnTo=send", () => {
  const effectBlock = block(
    SUCCESS_SRC,
    "useEffect(() => {\n    let returnMarker = null;",
    "}, []);",
    "return-marker effect"
  );
  const readIdx = effectBlock.indexOf("sessionStorage.getItem('greetme_post_checkout_return')");
  const clearIdx = effectBlock.indexOf("sessionStorage.removeItem('greetme_post_checkout_return')");
  const navIdx = effectBlock.indexOf("navigate('/dashboard/send?returnTo=send'");
  assert.ok(readIdx > -1 && clearIdx > -1 && navIdx > -1);
  assert.ok(readIdx < clearIdx && clearIdx < navIdx, "must read, then clear, then navigate — clearing after navigate risks a duplicate resume on back/forward");
  assert.match(effectBlock, /navigate\('\/dashboard\/send\?returnTo=send',\s*\{\s*replace:\s*true\s*\}\)/, "must replace history, not push, so Back doesn't return to the success screen");
});

test("the return-marker effect is declared BEFORE the pre-existing sendDraftId fast-resume effect (marketplace-gift and Top-Up/Upgrade are mutually exclusive; marker check must win first)", () => {
  const markerIdx = SUCCESS_SRC.indexOf("greetme_post_checkout_return");
  const sendDraftIdx = SUCCESS_SRC.indexOf("const sendDraftId = params.get('sendDraftId')");
  assert.ok(markerIdx > -1 && sendDraftIdx > -1);
  assert.ok(markerIdx < sendDraftIdx);
});

test("an absent marker (ordinary payment-success visits, e.g. plain subscription or merch-gift checkout) leaves resumeStatus untouched by this effect — no navigate call in that branch", () => {
  const effectBlock = block(
    SUCCESS_SRC,
    "useEffect(() => {\n    let returnMarker = null;",
    "}, []);",
    "return-marker effect"
  );
  // The ENTIRE setResumeStatus/navigate pair must sit inside the `if (returnMarker === 'send')` guard —
  // there must be no unconditional call outside it. Confirmed two ways: the guard opens before both
  // calls, and there is exactly one navigate() call in the whole effect (so it cannot also exist
  // unconditionally outside the guard).
  const guardIdx = effectBlock.indexOf("if (returnMarker === 'send') {");
  const setResumeIdx = effectBlock.indexOf("setResumeStatus('fast-resume')");
  const navigateIdx = effectBlock.indexOf("navigate('/dashboard/send?returnTo=send'");
  assert.ok(guardIdx > -1 && setResumeIdx > -1 && navigateIdx > -1);
  assert.ok(guardIdx < setResumeIdx && setResumeIdx < navigateIdx, "guard must open before both calls, in this order");
  const navigateCallCount = (effectBlock.match(/navigate\(/g) || []).length;
  assert.equal(navigateCallCount, 1, "exactly one navigate call exists in this effect — it cannot also fire unconditionally");
});
