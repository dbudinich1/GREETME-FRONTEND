// src/pages/merchGiftBinding.test.mjs — GIFTING-INTEGRITY
// Merchandise cart context and recipient binding through checkout.
//
// Run: node --test src/pages/merchGiftBinding.test.mjs
//
// cartService.js is plain JS, so the cart contract is tested behaviourally
// against a stubbed localStorage. Checkout's contact derivation is sliced from
// the shipped source and evaluated, so editing it changes what runs here.
// The JSX components themselves cannot be imported under `node --test`, so
// claims about them ("this value is stamped only when…") are asserted as the
// source invariants they are.
//
// No network, no real storage.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(path.join(HERE, "..", "..", rel), "utf8").replace(/\r\n/g, "\n");

const MERCH = read("src/pages/Merch.jsx");
const CHECKOUT = read("src/pages/Checkout.jsx");
const GIFTS = read("src/pages/Gifts.jsx");
const SEND = read("src/pages/SendGreeting.jsx");

// ---- minimal localStorage so cartService can be exercised for real ----
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};
const { default: cartService } = await import("../services/cartService.js");

// The exact predicate SendGreeting uses to decide what may attach.
const ATTACHABLE = (i) => i.sendContext === "greeting-flow";

const merchItem = (over = {}) => ({
  printfulSyncVariantId: 4001,
  name: "Greet-Me Mug — 11oz",
  price: 18,
  priceCents: 1800,
  category: "Merch",
  ...over,
});

// ============================================================
// 1 — MERCH CART CONTEXT
// ============================================================
test("attached merchandise returns with a non-empty attachable cart", () => {
  store.clear();
  cartService.addItem(merchItem({ sendContext: "greeting-flow" }));
  const attachable = cartService.getCart().filter(ATTACHABLE);
  assert.equal(attachable.length, 1);
  assert.equal(attachable[0].printfulSyncVariantId, 4001);
});

test("standalone merchandise stays independent and never attaches", () => {
  store.clear();
  cartService.addItem(merchItem());                       // storefront visit
  assert.equal(cartService.getCart().length, 1, "the item is still in the cart");
  assert.equal(cartService.getCart().filter(ATTACHABLE).length, 0, "but it is not attachable");
});

test("only the Greet-Me items attach when both kinds share the cart", () => {
  store.clear();
  cartService.addItem(merchItem({ name: "Standalone Tee" }));
  cartService.addItem(merchItem({ name: "Gift Mug", sendContext: "greeting-flow" }));
  cartService.addItem(merchItem({ name: "Another Standalone" }));

  const attachable = cartService.getCart().filter(ATTACHABLE);
  assert.equal(attachable.length, 1);
  assert.equal(attachable[0].name, "Gift Mug");
  assert.equal(cartService.getCart().length, 3, "the standalone items are untouched");
});

test("items tagged for another flow do not attach", () => {
  store.clear();
  cartService.addItem(merchItem({ sendContext: "recipient-settings" }));
  cartService.addItem(merchItem({ sendContext: "" }));
  cartService.addItem(merchItem({ sendContext: null }));
  assert.equal(cartService.getCart().filter(ATTACHABLE).length, 0);
});

test("Merch.jsx stamps the tag only when entered from the send flow", () => {
  const block = MERCH.slice(MERCH.indexOf("const addVariantToCart"), MERCH.indexOf("setAddedItems((prev)"));
  assert.match(block, /\.\.\.\(cameFromSendGreeting && \{ sendContext: 'greeting-flow' \}\),/);
  // Conditional spread, never an unconditional assignment.
  assert.doesNotMatch(block, /^\s+sendContext: 'greeting-flow',/m);
  // Exactly the contract Gifts.jsx already uses.
  assert.ok(GIFTS.includes("...(cameFromSendGreeting && { sendContext: 'greeting-flow' }),"));
  assert.match(MERCH, /const cameFromSendGreeting = returnTo === 'send';/);
});

test("returning from Merch preserves the draft and reopens the same gift mode", () => {
  assert.match(MERCH, /navigate\('\/dashboard\/send\?returnTo=send&giftType=merch'\)/);
  // SendGreeting restores the snapshot it wrote before browsing, and re-selects
  // the gift type carried on the URL.
  assert.match(SEND, /sessionStorage\.setItem\('sendGreetingState'/);
  assert.match(SEND, /if \(returnTo === 'send' && !hasRestoredStateRef\.current\)/);
  assert.match(SEND, /setGiftSettings\(\{ \.\.\.parsed\.giftSettings, type: giftType \}\)/);
});

test("SendGreeting attaches only the tagged items", () => {
  assert.match(SEND, /cartService\.getCart\(\)\s*\n?\s*\.filter\(i => i\.sendContext === 'greeting-flow'\)/);
});

// ============================================================
// 2 — CONTACT BINDING THROUGH CHECKOUT
// ============================================================
// The shipped derivation, evaluated against controlled storage.
const CONTACT_SRC = (() => {
  const a = CHECKOUT.indexOf("const sendDraftContactId = (() => {");
  assert.ok(a !== -1, "Checkout must derive a contact for an attached purchase");
  const b = CHECKOUT.indexOf("})();", a) + "})();".length;
  return CHECKOUT.slice(a, b);
})();

function deriveContact(sendDraftId, draftJson) {
  const local = {
    getItem: (k) => (k === `greetme_send_resume_${sendDraftId}` ? draftJson : null),
  };
  const fn = new Function("sendDraftId", "localStorage",
    CONTACT_SRC + "\nreturn sendDraftContactId;");
  return fn(sendDraftId, local);
}

test("the contact is read from the send draft named by the checkout token", () => {
  const got = deriveContact("draft-abc", JSON.stringify({ contactId: "contact-1", formData: {} }));
  assert.equal(got, "contact-1");
});

test("a standalone checkout derives no contact", () => {
  assert.equal(deriveContact(null, null), null);
});

test("a missing, corrupt or contactless draft yields null rather than a guess", () => {
  assert.equal(deriveContact("draft-abc", null), null);
  assert.equal(deriveContact("draft-abc", "{not json"), null);
  assert.equal(deriveContact("draft-abc", JSON.stringify({ formData: {} })), null);
  assert.equal(deriveContact("draft-abc", JSON.stringify({ contactId: "" })), null);
  assert.equal(deriveContact("draft-abc", JSON.stringify({ contactId: 12345 })), null);
});

test("the contact is sent with create-checkout, only when present", () => {
  const start = CHECKOUT.indexOf("purchaseType: 'merch',");
  assert.ok(start !== -1, "the merch checkout payload must exist");
  // Search forward from the payload — "fundraiserCheckoutField" also appears in
  // the import list far above it.
  const block = CHECKOUT.slice(start, CHECKOUT.indexOf("fundraiserCheckoutField({", start));
  assert.match(block, /\.\.\.\(sendDraftContactId && \{ contactId: sendDraftContactId \}\),/);
  assert.match(block, /\.\.\.\(sendDraftId && \{ sendDraftId \}\),/);
  // Never unconditional: a storefront order must omit it by design.
  assert.doesNotMatch(block, /^\s+contactId:\s*sendDraftContactId,\s*$/m);
});

test("the draft survives the Stripe return so the contact is still resolvable", () => {
  const SUCCESS = read("src/pages/PaymentSuccess.jsx");
  // PaymentSuccess only clears the draft when it is expired/invalid; the happy
  // path hands it to SendGreeting, which is the single consumer that deletes it.
  assert.match(SUCCESS, /const isValid = parsed && parsed\.expiresAt && Date\.now\(\) <= new Date\(parsed\.expiresAt\)\.getTime\(\);/);
  assert.match(SUCCESS, /if \(!isValid\) \{/);
  assert.match(SUCCESS, /navigate\(`\/dashboard\/send\?resumeDraft=\$\{sendDraftId\}`, \{ replace: true \}\)/);
  assert.match(SEND, /deleteResumeDraft\(resumeDraft\);/);
});

test("the resume send carries both the draft token and the contact", () => {
  // sendDraftId names the purchase; contactId names the recipient. The backend
  // requires both to agree with the paid order before anything is sent.
  assert.match(SEND, /sendDraftId: resumeDraft,/);
  assert.match(SEND, /contactId: selectedContact\.id,/);
});
