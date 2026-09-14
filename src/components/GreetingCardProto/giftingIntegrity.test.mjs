// src/components/GreetingCardProto/giftingIntegrity.test.mjs
// GIFTING-INTEGRITY RESTORATION — universal QR, gift reveal, selector.
//
// Run: node --test src/components/GreetingCardProto/giftingIntegrity.test.mjs
//
// These are source-invariant tests, the established pattern in this repo for
// JSX that cannot be imported under `node --test` (see campaignSurface.teamA
// .test.mjs and the scripts/verify-*-lock.mjs family). The .browser.test.mjs
// harness is not used deliberately: it cannot run on this Node version, where
// globalThis.navigator is getter-only, and every one of its cases is already
// failing on the baseline for that reason.
//
// Each claim below is genuinely structural — "exactly one QR branch exists",
// "this component never renders that CTA", "this option is not offered". Those
// are properties of the source, so the source is what is asserted.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(HERE, "..", "..", "..", rel), "utf8").replace(/\r\n/g, "\n");

const FINALE = read("src/components/GreetingCardProto/FinaleSpread.jsx");
const CLAIM = read("src/pages/GiftClaim.jsx");
const SELECTOR = read("src/components/GiftSelectorModal.jsx");
const SEND = read("src/pages/SendGreeting.jsx");

const codeOnly = (src) =>
  src.split("\n").filter((l) => {
    const t = l.trim();
    return !t.startsWith("//") && !t.startsWith("*") && !t.startsWith("/*");
  }).join("\n");

const FINALE_CODE = codeOnly(FINALE);

// ============================================================
// 19/20/21 — every card renders exactly one QR
// ============================================================
test("the card has exactly two mutually exclusive gift branches", () => {
  // One ternary: a real attached gift, or the courtesy path. No third arm can
  // exist to render an advert in place of a QR.
  assert.match(FINALE, /\{giftQrAvailable \? \(/);
  // Count arms at the branch's own indentation only — nested ternaries inside
  // either arm sit deeper and are not additional card states.
  const branchArms = FINALE.match(/^ {12}\) : /gm) || [];
  assert.equal(branchArms.length, 1, "expected exactly one ':' arm — a second arm means a third card state");
  assert.match(FINALE, /^ {12}\) : \(/m, "the remaining arm must be the courtesy block, not another condition");
});

test("the gift branch is gated on a real claim URL, not on hasGift alone", () => {
  assert.match(FINALE, /const giftQrAvailable = Boolean\(hasGift && gift\?\.claimUrl\);/);
  // hasGift on its own must never decide what is rendered.
  assert.doesNotMatch(FINALE_CODE, /\{hasGift \?/);
  assert.doesNotMatch(FINALE_CODE, /\) : hasGift \?/);
});

test("the QR branch is type-agnostic — no gift type is singled out", () => {
  assert.doesNotMatch(FINALE_CODE, /gift\?\.type === 'qrcash'/);
  assert.doesNotMatch(FINALE_CODE, /gift\.type === 'qrcash'/);
});

test("'Browse Plans' never substitutes for the required QR", () => {
  assert.equal(FINALE.includes("Browse Plans"), false);
  // …and the pricing page is not linked from the gift surface at all.
  assert.equal(FINALE.includes("/#/pricing"), false);
});

test("the courtesy QR is generated whenever no gift QR will render", () => {
  // Keyed on the same predicate as the branch, so the two can never disagree
  // and leave a card with no QR at all.
  assert.match(FINALE, /if \(giftQrAvailable \|\| !courtesyCreditCode\) return;/);
  assert.match(FINALE, /\}, \[giftQrAvailable, courtesyCreditCode\]\);/);
  assert.doesNotMatch(FINALE_CODE, /if \(hasGift \|\| !courtesyCreditCode\) return;/);
});

test("no-gift sends still reach the existing courtesy credit QR", () => {
  assert.match(FINALE, /claim-credit\/\$\{courtesyCreditCode\}/);
  assert.match(FINALE, /alt="Scan to claim your \$5 Greet-Me credit"/);
});

test("the gift QR points at the claim URL the backend validated", () => {
  assert.match(FINALE, /href=\{gift\.claimUrl\}/);
  // The card never assembles a gift URL of its own.
  assert.doesNotMatch(FINALE_CODE, /\/#\/gift\/\$\{/);
});

test("gift QR copy no longer asserts QR Cash for every gift", () => {
  assert.equal(/alt="[^"]*QR Cash/.test(FINALE), false);
  assert.equal(/aria-label="[^"]*QR Cash/.test(FINALE), false);
  assert.match(FINALE, /'A gift is included with this greeting'/);
  assert.match(FINALE, /'Scan or tap to open your gift'/);
});

// ============================================================
// 14/15 — the reveal
// ============================================================
test("GiftClaim reveals non-cash gifts on the canonical route", () => {
  assert.match(CLAIM, /if \(gift && gift\.giftType && gift\.giftType !== 'qrcash'\) \{/);
  assert.match(CLAIM, /\{gift\.itemSummary\}/);
  assert.match(CLAIM, /\{gift\.statusMessage\}/);
});

test("the non-cash branch precedes every QR Cash branch", () => {
  const nonCash = CLAIM.indexOf("gift.giftType !== 'qrcash'");
  const senderOwn = CLAIM.indexOf("isSenderViewingOwnGift({ gift, userId: accountState.userId })");
  const claimForm = CLAIM.indexOf("VALID_METHODS");
  assert.ok(nonCash !== -1);
  assert.ok(nonCash < senderOwn, "a non-cash gift must not reach the QR Cash owner branch");
  if (claimForm !== -1) assert.ok(nonCash < claimForm, "a non-cash gift must not reach the payout form");
});

test("the reveal renders only server-provided, allow-listed fields", () => {
  const start = CLAIM.indexOf("if (gift && gift.giftType && gift.giftType !== 'qrcash') {");
  const block = CLAIM.slice(start, CLAIM.indexOf("// ---- Sender viewing own gift", start));
  const referenced = new Set([...block.matchAll(/gift\.(\w+)/g)].map((m) => m[1]));
  const allowed = new Set([
    "giftType", "itemSummary", "statusMessage", "senderName", "recipientName", "sourceGreetingJobId",
    // ADDED 2026-09-14 with the physical provider gift. statusTitle is composed SERVER-SIDE exactly
    // like statusMessage beside it — the approved "Something special is coming your way" — so the
    // page still cannot invent a claim of its own about a parcel it knows nothing about. It carries
    // no product, price, provider, order number or delivery assertion.
    "statusTitle",
  ]);
  for (const key of referenced) {
    assert.ok(allowed.has(key), `the reveal must not render gift.${key}`);
  }
  // Nothing about money, fulfilment internals or the buyer's order.
  for (const forbidden of ["giftAmountCents", "merchOrderRef", "trackingNumber", "shippingAddress", "fmt("]) {
    assert.equal(block.includes(forbidden), false, `reveal must not reference ${forbidden}`);
  }
});

test("the pending physical message is the founder-locked sentence", () => {
  // Composed server-side; the page must not invent a status of its own.
  const start = CLAIM.indexOf("if (gift && gift.giftType && gift.giftType !== 'qrcash') {");
  const block = CLAIM.slice(start, CLAIM.indexOf("// ---- Sender viewing own gift", start));
  assert.equal(/on its way/i.test(block), false, "the copy must come from the resolver, not be hardcoded here");
  assert.match(block, /\{gift\.statusMessage\}/);
});

test("an invalid claim still fails safely through the existing branch", () => {
  assert.match(CLAIM, /if \(error \|\| !gift\) \{/);
  assert.match(CLAIM, /'This gift link may be invalid or has already expired\.'/);
});

// ============================================================
// 23 — digital stays out; merchandise comes back
// ============================================================
test("physical goods are reachable through the ONE Gift Place, not a duplicate control", () => {
  // REWRITTEN 2026-09-14. "Greet-Me Merch" and "Greet-Me Gift Place" were two controls for one
  // destination — /dashboard/merch redirects to /dashboard/gifts — so the decision screen asked the
  // same question twice. Merchandise is still fully reachable; it is reached through the Gift Place,
  // which now holds every category including Flowers.
  assert.equal(/value: 'merch'/.test(SELECTOR), false, "the duplicate control must be gone");
  assert.equal(/Browse Greet-Me Merch/.test(SELECTOR), false);
  assert.match(SELECTOR, /\{ value: 'marketplace', label: 'Greet-Me Gift Place'/);
  // And the one destination still carries the merchandise vocabulary through the send flow.
  assert.match(SEND, /navigate\('\/dashboard\/gifts\?returnTo=send&giftType=marketplace'\)/);
});

test("the decision screen offers EXACTLY four choices, in the approved order", () => {
  const start = SELECTOR.indexOf("const GIFT_OPTIONS = [");
  const options = SELECTOR.slice(start, SELECTOR.indexOf("];", start));
  const values = [...options.matchAll(/value: '(\w+)'/g)].map((m) => m[1]);
  // ORDER MATTERS and is asserted as order, not as a set: None, QR Cash, Gift Place, Select.
  assert.deepEqual(values, ["none", "qrcash", "marketplace", "curated"]);
  assert.equal(/prezzee|digital|gift ?card|smart ?card/i.test(options), false);
});

test("the gift decision screen shows no products and offers no second gift", () => {
  // It asks ONE question. It had stopped doing that: an inline flower catalogue turned it into a
  // shopping surface, and an "Include QR Cash with this card" checkbox turned one gift into two.
  // COMMENTS STRIPPED. The file explains at length what it deliberately no longer does, and naming a
  // removed control in order to say "this is gone" is the opposite of shipping it. The guard is about
  // the CODE.
  const selectorCode = codeOnly(SELECTOR);
  assert.equal(/flowersCatalogue|gift-selector-flowers/.test(selectorCode), false,
    "no product catalogue may render on the decision screen");
  assert.equal(/qrCashAddOn/.test(selectorCode), false, "no second, separately-charged gift may be offered");
  assert.equal(/Include QR Cash with this card/.test(selectorCode), false);
  // Single-select is still a radio group, so choosing one option replaces the last.
  assert.match(SELECTOR, /type="radio"/);
  assert.match(SELECTOR, /onGiftChange\(occ\.type, 'type', option\.value\)/);
});

// ============================================================
// The send flow attaches by reference
// ============================================================
test("the paid-checkout resume attaches by draft token, not by self-report", () => {
  assert.match(SEND, /sendDraftId: resumeDraft,/);
  // The client no longer declares payment, price or contents.
  assert.doesNotMatch(codeOnly(SEND), /status: 'paid'/);
  assert.doesNotMatch(codeOnly(SEND), /hasGift: true,/);
});

test("the send payload carries the recipient pointer", () => {
  assert.match(SEND, /contactId: selectedContact\.id,/);
});

test("physical merchandise routes into the same paid-order path, through one destination", () => {
  // One branch for one page. /dashboard/merch redirects to /dashboard/gifts, so routing 'merch'
  // anywhere else was routing it to the same place by a longer road.
  assert.match(SEND, /if \(type === 'marketplace' \|\| type === 'merch'\) \{/);
  assert.match(SEND, /\/dashboard\/gifts\?returnTo=send&giftType=marketplace/);
  // The cart, the checkout and the claim token for merchandise are untouched by this packet.
  assert.match(SEND, /sendDraftId: resumeDraft,/);
});

test("curated attaches the selected tier and nothing it invented", () => {
  const start = SEND.indexOf("...(giftSettings?.type === 'curated' && {");
  const block = SEND.slice(start, SEND.indexOf("}),", start));
  assert.match(block, /type: 'curated'/);
  assert.match(block, /maxSpendCents/);
  // The client no longer asserts a status the server has not established.
  assert.equal(block.includes("intent_recorded"), false);
});

// ============================================================
// 22 — standalone merchandise is untouched
// ============================================================
test("the merch storefront keeps its own independent route", () => {
  // Restoring the gift option must not have moved or gated the storefront.
  assert.match(SELECTOR, /giftSetting\.type === 'marketplace' && onBrowse/);
  assert.match(SEND, /\/dashboard\/gifts\?returnTo=send&giftType=marketplace/);
});
