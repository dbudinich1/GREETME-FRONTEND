// Run: node --test src/pages/sendGreetingGiftTypeSourceLock.test.mjs
// Source lock: every hardcoded giftType 'flowers' in SendGreeting.jsx sits on a path reachable ONLY
// when the selected gift type is 'flowers'. A gift box ('gift_boxes') has its own checkout and
// dispatch, so a non-flower gift can never be routed through the flowers path (the Merch.jsx bug class).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const dir = dirname(fileURLToPath(import.meta.url));
const strip = (s) => s.replace(/\r\n/g, "\n").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/(^|\s)\/\/.*$/, "")).join("\n");
const SRC = strip(readFileSync(join(dir, "SendGreeting.jsx"), "utf8"));
const MODAL = strip(readFileSync(join(dir, "..", "components", "PreSendReviewModal.jsx"), "utf8"));
const count = (s, re) => (s.match(re) || []).length;

test("the flowers literals are exactly the known flower-only sites", () => {
  assert.equal(count(SRC, /giftType: 'flowers'/g), 3, "pending-link x2 + recovery identity");
  assert.equal(count(SRC, /type: 'flowers', claimToken/g), 1, "dispatchFlowerGreeting payload");
  assert.equal(count(SRC, /giftType="flowers"/g), 1, "ProviderCheckoutModal prop");
});

test("the flowers checkout opens only from handleReviewFlowersCheckout, which is wired only to the flowers CTA", () => {
  assert.equal(count(SRC, /setIsFlowersCheckoutOpen\(true\)/g), 1);
  const h = SRC.slice(SRC.indexOf("const handleReviewFlowersCheckout"), SRC.indexOf("const handleFlowerOrderAccepted"));
  assert.match(h, /setIsFlowersCheckoutOpen\(true\)/);
  assert.equal(count(SRC, /handleReviewFlowersCheckout/g), 2, "definition + onConfirmFlowersCheckout prop only");
  assert.match(SRC, /onConfirmFlowersCheckout=\{handleReviewFlowersCheckout\}/);
  const flowersBranch = MODAL.slice(MODAL.indexOf("giftMode === 'flowers'"), MODAL.indexOf("giftMode === 'gift_boxes'") > MODAL.indexOf("giftMode === 'flowers'") ? MODAL.indexOf("giftMode === 'gift_boxes'") : undefined);
  assert.match(flowersBranch, /onConfirmFlowersCheckout/);
  assert.doesNotMatch(flowersBranch, /onConfirmGiftBoxCheckout/);
});

test("the pending-gift-link marker is persisted from the flowers accepted handler only", () => {
  assert.equal(count(SRC, /persistPendingGiftLink\(/g), 1);
  const acc = SRC.slice(SRC.indexOf("const handleFlowerOrderAccepted"), SRC.indexOf("const dispatchFlowerGreeting"));
  assert.match(acc, /persistPendingGiftLink\(/);
});

test("gift boxes have their own checkout, dispatch type and gate", () => {
  assert.match(SRC, /gift: \{ type: 'gift_boxes', claimToken: giftClaimToken \}/);
  assert.match(SRC, /giftSettings\?\.type === 'gift_boxes' && \(\s*<GiftBoxCheckoutModal/);
  assert.match(MODAL, /giftMode === 'gift_boxes'[\s\S]{0,400}onConfirmGiftBoxCheckout/);
  const gb = SRC.slice(SRC.indexOf("const handleReviewGiftBoxCheckout"), SRC.indexOf("const handleGiftBoxCheckoutClose"));
  assert.doesNotMatch(gb, /setIsFlowersCheckoutOpen|ProviderCheckoutModal|giftType: .flowers./);
});
