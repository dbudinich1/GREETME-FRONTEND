// src/pages/giftClaimPhysicalGift.test.mjs
//
// THE RECIPIENT'S SIDE OF A PHYSICAL GIFT — what is behind the secured QR, and what must never be.
//
// A flower gift is INFORMATIONAL. The parcel is already bought, paid for and accepted, and it ships
// to the recipient's own address, so there is nothing for them to do and nothing to offer them. The
// surprise is the product, which is why this presentation deliberately says LESS than the
// merchandise one beside it.
//
// Asserted against the real source of GiftClaim.jsx, in the established pattern for this repo's JSX:
// the page is a routed component wired to auth and the API client, and what matters here is which
// server-provided fields it may render and which actions it may offer — structural claims.
//
// Run (Node 20.x):
//   node --test src/pages/giftClaimPhysicalGift.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "GiftClaim.jsx"), "utf8");
// COMMENTS STRIPPED, BOTH KINDS. JSX uses {/* ... */} blocks, and this file explains at length
// what the reveal deliberately never says — naming a forbidden claim in order to forbid it is the
// opposite of making it. Scanning prose would fail the guard on its own documentation.
const BLOCK_COMMENT = new RegExp(String.raw`/\*[\s\S]*?\*/`, 'g');
const codeOnly = (s) => s
  .replace(BLOCK_COMMENT, ' ')
  .split('\n').map((l) => l.split('//')[0]).join('\n');
const CODE = codeOnly(SRC);

/** The non-cash branch: everything a merchandise, curated or physical provider gift can reach. */
const NON_CASH = (() => {
  const start = SRC.indexOf("if (gift && gift.giftType && gift.giftType !== 'qrcash') {");
  assert.ok(start > -1, "the non-cash branch must exist");
  const end = SRC.indexOf("// ---- Sender viewing own gift", start);
  assert.ok(end > start, "the non-cash branch must be bounded");
  return SRC.slice(start, end);
})();

test("the non-cash branch is reached BEFORE any QR Cash payout surface", () => {
  // A physical gift must never touch a claim form, a payout method or an amount. The ordering is what
  // guarantees it, and the ordering is a property of the source.
  const nonCash = SRC.indexOf("if (gift && gift.giftType && gift.giftType !== 'qrcash') {");
  const claimForm = SRC.indexOf("VALID_METHODS");
  assert.ok(nonCash > -1);
  if (claimForm !== -1) {
    assert.ok(nonCash < claimForm, "a non-cash gift must not reach the payout form");
  }
});

test("the physical gift presentation offers NO action of any kind", () => {
  // Nothing to claim, nothing to redeem, nothing to pay. The only controls a recipient sees in this
  // branch are navigation — a link back to the Greet-Me they were sent.
  const code = codeOnly(NON_CASH);
  for (const forbidden of [
    "claimMethod", "VALID_METHODS", "handleClaim", "onClaim", "Redeem", "redeem",
    "Claim your", "payout", "Connect", "stripe", "Stripe", "cardNumber", "billing",
  ]) {
    assert.equal(code.includes(forbidden), false,
      `the non-cash reveal must not offer "${forbidden}"`);
  }
});

test("it renders only server-composed words about the gift, never its own", () => {
  // statusTitle and statusMessage are both composed SERVER-SIDE, from the founder-approved copy, so
  // this page cannot invent a claim about a parcel it knows nothing about. The title is used when the
  // server sent one; every other gift type keeps the wording it always had.
  assert.match(NON_CASH, /gift\.statusTitle/);
  assert.match(NON_CASH, /gift\.statusMessage/);
  // No hard-coded arrival or delivery language anywhere in the branch.
  for (const claim of [
    "delivered", "out for delivery", "in transit", "shipped", "tracking", "track your",
    "on its way", "arriving", "will arrive", "expected",
  ]) {
    assert.equal(new RegExp(claim, "i").test(codeOnly(NON_CASH)), false,
      `the reveal must not assert "${claim}"`);
  }
});

test("no product, price, provider or order reference can reach the recipient", () => {
  const code = codeOnly(NON_CASH);
  for (const forbidden of [
    "providerOrderRef", "providerOrderId", "provider", "providerSnapshot", "fulfillmentSnapshot",
    "florist", "Florist", "priceCents", "totalCents", "giftAmountCents", "orderTotalMinor",
    "shippingAddress", "address1", "phone", "merchOrderRef",
  ]) {
    assert.equal(code.includes(forbidden), false, `the reveal must not reference ${forbidden}`);
  }
  // itemSummary IS rendered — but only because the SERVER sends it for merchandise and deliberately
  // omits it for a physical provider gift. The page renders what arrives; the surprise is protected
  // by the projection, not by a second branch here.
  assert.match(NON_CASH, /gift\.itemSummary && \(/,
    "itemSummary must be rendered conditionally, so its absence simply shows nothing");
});

test("the physical gift is not confused with the QR Cash reveal, which is untouched", () => {
  // QR Cash keeps its actionable presentation: an amount and a real claim path. That is the whole
  // reason the branches are separate, and the reason a QR Cash record presented as flowers is
  // refused server-side rather than quietly rendered here.
  assert.match(CODE, /gift\.giftAmountCents/);
  assert.match(CODE, /gift\.status === 'expired'/);
  // The discriminator is the giftType the resolver returns ONLY for non-cash gifts, so a QR Cash
  // response (which has no such key) falls straight through to its own path.
  assert.match(CODE, /gift\.giftType && gift\.giftType !== 'qrcash'/);
});

test("no gift produces no gift announcement", () => {
  // The branch is gated on a gift EXISTING and carrying a type. A greeting with no gift never enters
  // it, so there is no announcement to suppress.
  assert.match(CODE, /if \(gift && gift\.giftType/);
});
