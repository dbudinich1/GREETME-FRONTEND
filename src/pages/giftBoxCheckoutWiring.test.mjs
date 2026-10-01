// src/pages/giftBoxCheckoutWiring.test.mjs
//
// STRUCTURAL proof of the gift box entry-point rewiring (Greet-Me direct checkout, 2026-09-30),
// asserted against the real page sources — the established convention for wiring that is real and
// load-bearing but impractical to mount (see checkoutMergedIntegrationProof.browser.test.mjs and
// sendGreetingFlowersWiring.test.mjs). The modal itself is proven by MOUNTING it in
// src/components/providerCheckout/giftBoxCheckoutModal.browser.test.mjs.
//
// Run (Node 20.x): node --test src/pages/giftBoxCheckoutWiring.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(__dirname, rel), "utf8");
const MERCH = read("Merch.jsx");
const SEND = read("SendGreeting.jsx");
const REVIEW = read("../components/PreSendReviewModal.jsx");

/** Comments explain what the code deliberately does NOT do; guards must read the code. */
const codeOnly = (s) => s.split("\n").map((l) => l.split("//")[0]).join("\n");
const slice = (src, start, end, label) => {
  const a = src.indexOf(start);
  assert.ok(a > -1, `${label}: start not found`);
  const b = src.indexOf(end, a + start.length);
  assert.ok(b > a, `${label}: end not found`);
  return src.slice(a, b);
};

// ===========================================================================
// Merch.jsx
// ===========================================================================

test("Merch: selectProviderGiftForGreeting no longer hardcodes 'flowers' — the pick's own category travels", () => {
  const fn = codeOnly(slice(MERCH, "const selectProviderGiftForGreeting =", "const selectProviderGiftStandalone =", "greeting pick"));
  assert.match(fn, /chosen\.giftType === 'gift_boxes' \? 'gift_boxes' : 'flowers'/,
    "the category conditional is present");
  assert.equal(/type:\s*'flowers'/.test(fn), false, "no unconditional type: 'flowers' in the draft blob");
  assert.equal(/giftType:\s*'flowers'/.test(fn), false, "no unconditional giftType: 'flowers' on the confirmation");
  assert.match(fn, /type: pickedGiftType/);
  assert.match(fn, /giftType: pickedGiftType/);
  assert.match(fn, /giftBoxProduct: chosen/, "a gift box gets its own product slot");
  assert.match(fn, /flowersProduct: chosen/, "a flower keeps its original slot");
});

test("Merch: a standalone gift box opens GiftBoxCheckoutModal, never the flowers checkout", () => {
  const code = codeOnly(MERCH);
  assert.match(code, /import GiftBoxCheckoutModal from '\.\.\/components\/providerCheckout\/GiftBoxCheckoutModal'/);
  const go = codeOnly(slice(MERCH, "const handleGoToCheckout =", "const handleReturnToRecipient =", "go to checkout"));
  const boxBranch = go.indexOf("standaloneFlower.giftType === 'gift_boxes'");
  const flowersOpen = go.indexOf("setIsFlowersCheckoutOpen(true)");
  assert.ok(boxBranch > -1, "the gift box branch exists");
  assert.ok(boxBranch < flowersOpen, "and is decided BEFORE the flowers checkout could open");
  assert.match(go, /setIsGiftBoxCheckoutOpen\(true\)/);
  assert.match(code, /<GiftBoxCheckoutModal[\s\S]*?product=\{giftBoxProduct\}/);
  // Standalone: unattachable to any greeting and no handoff.
  const el = code.slice(code.indexOf("<GiftBoxCheckoutModal"), code.indexOf("/>", code.indexOf("<GiftBoxCheckoutModal")));
  assert.equal(/contactId=|onAccepted=/.test(el), false, "no contactId, no onAccepted on the standalone instance");
});

// ===========================================================================
// SendGreeting.jsx
// ===========================================================================

test("SendGreeting: giftSettings.type === 'gift_boxes' renders GiftBoxCheckoutModal, not ProviderCheckoutModal", () => {
  const code = codeOnly(SEND);
  const block = slice(code, "{giftSettings?.type === 'gift_boxes' && (", ")}", "gift box render block");
  assert.match(block, /<GiftBoxCheckoutModal/);
  assert.equal(/ProviderCheckoutModal/.test(block), false, "the flowers checkout is not used for a gift box");
  assert.match(block, /isOpen=\{isGiftBoxCheckoutOpen\}/);
  assert.match(block, /contactId=\{formData\.contactId \|\| null\}/, "the same recipient binding as flowers");
  assert.match(block, /checkEntitlement=\{runGiftEntitlementPreflight\}/, "the same entitlement gate as flowers");
  assert.match(block, /onAccepted=\{handleGiftBoxAccepted\}/);
  assert.match(block, /product=\{giftSettings\?\.giftBoxProduct \|\| null\}/);

  // The flowers instance is untouched.
  const flowers = slice(code, "<ProviderCheckoutModal", "/>", "flowers instance");
  assert.match(flowers, /giftType="flowers"/);
  assert.match(flowers, /onAccepted=\{handleFlowerOrderAccepted\}/);
});

test("SendGreeting: the review step gets a giftBoxAttachment and a gift box Continue handler", () => {
  const code = codeOnly(SEND);
  assert.match(code, /giftBoxAttachment=\{\s*giftSettings\.type === 'gift_boxes' && giftSettings\.giftBoxProduct/);
  assert.match(code, /onConfirmGiftBoxCheckout=\{handleReviewGiftBoxCheckout\}/);
  const open = slice(code, "const handleReviewGiftBoxCheckout =", "};", "review handler");
  assert.match(open, /setPendingGreetingData\(greetingData\)/);
  assert.match(open, /setIsGiftBoxCheckoutOpen\(true\)/);

  // PreSendReviewModal routes the gift box CTA to that handler — never to a direct send.
  const cta = slice(REVIEW, "if (giftMode === 'gift_boxes') {", "}", "review CTA");
  assert.match(cta, /onClick: onConfirmGiftBoxCheckout/);
  assert.equal(/onConfirmDirectSend/.test(cta), false);
});

test("SendGreeting: an accepted gift box attaches like flowers, with only the discriminator changed", () => {
  const code = codeOnly(SEND);
  const dispatch = slice(code, "const dispatchGiftBoxGreeting =", "const handleGiftBoxAccepted =", "dispatch");
  assert.match(dispatch, /includeGift: true/);
  assert.match(dispatch, /gift: \{ type: 'gift_boxes', claimToken: giftClaimToken \}/);
  assert.match(dispatch, /executeGreetingSend\(payload\)/);

  const accepted = slice(code, "const handleGiftBoxAccepted =", "const handleGiftBoxCheckoutClose", "accepted");
  // Only a CONFIRMED order with a server token sends; anything else holds the greeting.
  assert.match(accepted, /result\?\.fulfillmentStatus === 'confirmed' && giftClaimToken/);
  assert.match(accepted, /result\?\.giftClaimToken/);
  const sendIdx = accepted.indexOf("dispatchGiftBoxGreeting(");
  const holdIdx = accepted.indexOf("setGiftBoxHeldNotice(");
  assert.ok(sendIdx > -1 && holdIdx > sendIdx, "the held path is separate from, and after, the send path");
});

test("SendGreeting: includeGift is false for a gift box until its paid record exists", () => {
  const match = SEND.match(/includeGift:\s*Boolean\(([\s\S]*?)\),\s*\r?\n/);
  assert.ok(match, "the includeGift expression must be findable");
  const decide = new Function("giftSettings", `return Boolean(${match[1]});`);
  assert.equal(decide({ type: "gift_boxes" }), false);
  assert.equal(decide({ type: "flowers" }), false);
  assert.equal(decide({ type: "qrcash" }), true, "unchanged for claimable-up-front types");
});
