// src/components/providerCheckout/sendFlowFlowers.browser.test.mjs
//
// FLOWERS AS AN EMBEDDED STEP OF SEND GREET-ME — the corrected interaction, as rendered.
//
// The real components are bundled and mounted in jsdom with the network stubbed at `fetch`, so what
// is asserted is what a sender would actually get. Two claims are under test, and they are the two
// defects this packet corrects:
//
//   1. CHOOSING FLOWERS SHOWS FLOWERS. Selecting the category loads and displays the catalogue in
//      place — no "Send a flower gift" button in between, no navigation, and loading / empty /
//      retry-error all still reachable.
//
//   2. AN ACCEPTED ORDER CONTINUES THE SEND, AND NOTHING ELSE DOES. The checkout hands off exactly
//      once, only on the backend's own `accepted` status, and it has no "Done" of its own to offer
//      while the Greet-Me is still unsent. Cancelling, declining, a refused submission, an UNCERTAIN
//      confirmation, a moved price and a double click each leave the handoff uncalled.
//
// Run (Node 20.x):
//   node --test src/components/providerCheckout/sendFlowFlowers.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__sff.bundle.mjs");
const ENTRY = join(__dirname, ".__sff.entry.jsx");
const START_URL = "http://localhost/dashboard/send";

let React, createRoot, act, Entry, Modal, Selector, Review, MemoryRouter, window;
let PRISTINE_APPEND_CHILD;

before(async () => {
  writeFileSync(ENTRY,
    'export { default as Entry } from "./ProviderCheckoutEntry.jsx";\n'
    + 'export { default as Modal } from "./ProviderCheckoutModal.jsx";\n'
    + 'export { default as Selector } from "../GiftSelectorModal.jsx";\n'
    + 'export { default as Review } from "../PreSendReviewModal.jsx";\n'
    + 'export { MemoryRouter } from "react-router-dom";\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: START_URL });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.localStorage = window.localStorage;
  window.performance.getEntriesByType = (type) => (type === "resource" ? RESOURCES : []);
  PRISTINE_APPEND_CHILD = window.document.head.appendChild;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Entry, Modal, Selector, Review, MemoryRouter } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

// ---------------------------------------------------------------------------
// The stubbed world — identical in shape to providerCheckout.browser.test.mjs, so the two files
// cannot disagree about what the backend and the tokenizer do.
// ---------------------------------------------------------------------------

const TOKENIZER_URL = "https://tokenizer.example/v1/Accept.js";
const TOKENIZATION = {
  provider: "florist_one", rail: "authorize_net_accept_js",
  apiLoginId: "login-id", publicClientKey: "public-client-key",
  acceptJsUrl: TOKENIZER_URL, tokenizationKeyFingerprint: "fp-1",
};
const QUOTE = {
  provider: "florist_one", providerProductId: "T18-1A", providerVariantId: null,
  productMinor: 5499, shippingMinor: 2499, taxMinor: 499, feesMinor: 0,
  totalMinor: 8497, currency: "USD", taxKnown: true, quoteVersion: "qv-1",
};
const PREPARED = {
  ok: true, attemptId: "gpc_1", provider: "florist_one", giftType: "flowers",
  status: "preparing", currency: "USD", orderTotalMinor: 8497, deliveryDate: "2026-09-15", region: "US",
  quote: QUOTE,
};
const PRODUCTS = [
  { providerProductId: "T18-1A", name: "Autumn Warmth", priceMinor: 5499, currency: "USD", imageUrl: null, provider: "florist_one" },
  { providerProductId: "T163-1A", name: "Sunlit Roses", priceMinor: 6499, currency: "USD", imageUrl: null, provider: "florist_one" },
];

let REQUESTS = [];
let ROUTES = {};

function stubFetch() {
  REQUESTS = [];
  globalThis.fetch = async (url, options = {}) => {
    const path = String(url);
    const body = options.body ? JSON.parse(options.body) : null;
    REQUESTS.push({ path, method: options.method || "GET", body });
    const handler = Object.entries(ROUTES).find(([key]) => path.includes(key))?.[1];
    const payload = handler ? await handler(body) : { ok: true };
    return { status: 200, ok: true, headers: { get: () => null }, json: async () => payload };
  };
  window.fetch = globalThis.fetch;
}

/** The live world: available, with a catalogue, a quote and a tokenizer configuration. */
const liveRoutes = (overrides = {}) => ({
  "/provider-checkout/availability": async () => ({ ok: true, available: true }),
  "/provider-checkout/catalog": async () => ({ ok: true, products: PRODUCTS }),
  "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
  "/provider-checkout/prepare": async () => PREPARED,
  ...overrides,
});

let RESOURCES = [];
const completeTokenizerCore = () => RESOURCES.push({ name: "https://tokenizer.example/v1/AcceptCore.js" });

function installTokenizer({ decline = false } = {}) {
  const seen = [];
  const original = PRISTINE_APPEND_CHILD.bind(window.document.head);
  window.document.head.appendChild = (node) => {
    const appended = original(node);
    if (node.tagName === "SCRIPT" && node.src === TOKENIZER_URL) {
      window.Accept = {
        dispatchData: (payload, cb) => {
          seen.push(payload);
          if (decline) {
            cb({ messages: { resultCode: "Error", message: [{ text: "Credit card number is invalid." }] } });
          } else {
            cb({ messages: { resultCode: "Ok" }, opaqueData: { dataValue: "ONE-TIME-TOKEN" } });
          }
        },
      };
      setTimeout(() => { node.dispatchEvent(new window.Event("load")); completeTokenizerCore(); }, 0);
    }
    return appended;
  };
  return seen;
}

let root, host;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function mount(Component, props) {
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(MemoryRouter, null, React.createElement(Component, props)));
  });
  await flush();
}
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const byId = (id) => document.getElementById(id);
const setVal = (el, v) => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const click = async (el) => {
  await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); });
  await flush(); await flush(); await flush();
};

async function awaitTokenizerReady({ ticks = 40 } = {}) {
  for (let i = 0; i < ticks; i += 1) {
    if (!tid("provider-checkout-securing")) return;
    await flush();
  }
  throw new Error("the tokenizer never reached its ready state");
}

async function fillDetails() {
  setVal(byId("pc-delivery-date"), "2026-09-15");
  setVal(byId("pc-first"), "Dana");
  setVal(byId("pc-address1"), "12 Elm St");
  setVal(byId("pc-city"), "Newark");
  setVal(byId("pc-state"), "NJ");
  setVal(byId("pc-zip"), "07102");
  setVal(byId("pc-recipient-phone"), "(201) 555-0123");
  setVal(byId("pc-billing-line1"), "1 Sender St");
  setVal(byId("pc-billing-city"), "Hoboken");
  setVal(byId("pc-billing-state"), "NJ");
  setVal(byId("pc-billing-zip"), "07030");
  setVal(byId("pc-cust-phone"), "(973) 555-1111");
  setVal(byId("pc-message"), "Thinking of you");
  setVal(byId("pc-cust-first"), "Sam");
  setVal(byId("pc-cust-email"), "sam@example.com");
  await flush();
}

async function fillCard() {
  setVal(byId("pc-card"), "4111111111111111");
  setVal(byId("pc-exp-month"), "01");
  setVal(byId("pc-exp-year"), "30");
  setVal(byId("pc-cvv"), "123");
  await flush();
}

/**
 * Drive the embedded checkout to the point of pressing Place Order, with the submit reply under
 * test. Returns the accepted-handoff calls the caller was given.
 */
async function payWith(submitReply, { decline = false, onAccepted } = {}) {
  const handoffs = [];
  ROUTES = liveRoutes({ "/provider-checkout/submit": async () => submitReply });
  installTokenizer({ decline });
  await mount(Modal, {
    isOpen: true,
    onClose: () => {},
    giftType: "flowers",
    product: PRODUCTS[0],
    customer: { firstName: "Sam", lastName: "Ops", email: "sam@example.com" },
    onAccepted: onAccepted || ((r) => handoffs.push(r)),
  });
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await awaitTokenizerReady();
  await fillCard();
  if (tid("provider-checkout-accept-price")) await click(tid("provider-checkout-accept-price"));
  await click(tid("provider-checkout-pay"));
  return handoffs;
}

beforeEach(() => {
  delete window.Accept;
  delete window.__greetmeTokenizerLoad;
  RESOURCES = [];
  if (PRISTINE_APPEND_CHILD) window.document.head.appendChild = PRISTINE_APPEND_CHILD;
  ROUTES = {};
  stubFetch();
});

// ===========================================================================
// 1. Choosing Flowers shows flowers
// ===========================================================================

test("selecting Flowers loads and displays the catalogue, with NO button in between", async () => {
  // THE CORRECTION. Before this packet the same render produced one button reading "Send a flower
  // gift" and no products at all; the arrangements were behind that click and a modal. Now the
  // category IS the request, and the catalogue is what answers it.
  ROUTES = liveRoutes();
  await mount(Entry, { selectedCategory: "flowers", product: null, customer: null, onSelect: () => {} });

  assert.ok(tid("provider-checkout-entry"), "the surface renders once the provider is live");
  assert.ok(tid("provider-catalogue"), "the catalogue itself is on screen");
  assert.ok(tid("provider-product-T18-1A"), "the first arrangement is on screen");
  assert.ok(tid("provider-product-T163-1A"), "and so is the second");
  assert.equal(tid("provider-price-T18-1A").textContent, "$54.99", "the provider's own price, as received");

  // The removed step, asserted as ABSENT rather than assumed gone.
  assert.equal(
    /Send a flower gift/i.test(document.body.textContent), false,
    "the extra 'Send a flower gift' step must be gone",
  );
  // And no second navigation replaced it: no checkout is mounted, and nothing is a link.
  assert.equal(tid("provider-checkout-modal"), null, "no checkout opens merely from browsing");
  assert.equal(host.querySelector("a"), null, "nothing navigates away to show a flower");
});

test("the catalogue is loaded exactly once, and only after the posture answer says it may be", async () => {
  ROUTES = liveRoutes();
  await mount(Entry, { selectedCategory: "flowers", product: null, customer: null, onSelect: () => {} });

  const availability = REQUESTS.filter((r) => r.path.includes("/availability"));
  const products = REQUESTS.filter((r) => r.path.includes("/catalog"));
  assert.equal(products.length, 1, "one catalogue read, not one per render");
  assert.ok(availability.length >= 1, "the posture is asked");
  // ORDER IS THE CONTAINMENT. The catalogue read must never precede the answer that allows it.
  assert.ok(
    REQUESTS.findIndex((r) => r.path.includes("/availability"))
    < REQUESTS.findIndex((r) => r.path.includes("/catalog")),
    "availability is asked before the catalogue is read",
  );
});

test("while the provider is dormant nothing renders and the catalogue is never read", async () => {
  ROUTES = {
    "/provider-checkout/availability": async () => ({ ok: true, available: false, reason: "provider_disabled" }),
    "/provider-checkout/catalog": async () => { throw new Error("a dormant provider must never be asked for products"); },
  };
  await mount(Entry, { selectedCategory: "flowers", product: null, customer: null, onSelect: () => {} });

  assert.equal(tid("provider-checkout-entry"), null, "no surface at all while dormant");
  assert.equal(REQUESTS.some((r) => r.path.includes("/catalog")), false, "and no catalogue read");
});

test("the loading state is shown while the catalogue is in flight", async () => {
  let release;
  ROUTES = liveRoutes({
    "/provider-checkout/catalog": () => new Promise((r) => { release = () => r({ ok: true, products: PRODUCTS }); }),
  });
  await mount(Entry, { selectedCategory: "flowers", product: null, customer: null, onSelect: () => {} });

  assert.ok(tid("provider-catalogue-loading"), "the sender is told it is loading");
  assert.equal(tid("provider-catalogue"), null, "and no empty catalogue is shown beside it");

  release();
  await flush(); await flush();
  assert.equal(tid("provider-catalogue-loading"), null, "the notice clears");
  assert.ok(tid("provider-catalogue"), "and the arrangements arrive");
});

test("an empty catalogue says so, and is not mistaken for a failure", async () => {
  ROUTES = liveRoutes({ "/provider-checkout/catalog": async () => ({ ok: true, products: [] }) });
  await mount(Entry, { selectedCategory: "flowers", product: null, customer: null, onSelect: () => {} });

  assert.ok(tid("provider-catalogue-empty"), "the empty state is its own state");
  assert.equal(tid("provider-catalogue-error"), null, "nothing failed, so nothing says it did");
  assert.equal(tid("provider-catalogue"), null);
});

test("a failed catalogue read offers Try again, and the retry succeeds", async () => {
  // "We could not look" and "there is nothing" are different sentences. Only one is true here.
  let attempts = 0;
  ROUTES = liveRoutes({
    "/provider-checkout/catalog": async () => {
      attempts += 1;
      if (attempts === 1) return { ok: false, error: "upstream unavailable", status: 500 };
      return { ok: true, products: PRODUCTS };
    },
  });
  // The client turns a non-ok body into a throw; force that shape explicitly for the first attempt.
  ROUTES["/provider-checkout/catalog"] = async () => {
    attempts += 1;
    if (attempts === 1) throw new Error("network");
    return { ok: true, products: PRODUCTS };
  };
  await mount(Entry, { selectedCategory: "flowers", product: null, customer: null, onSelect: () => {} });

  assert.ok(tid("provider-catalogue-error"), "the failure is stated");
  assert.equal(tid("provider-catalogue-empty"), null, "and never as an empty catalogue");
  assert.ok(tid("provider-catalogue-retry"), "with a way to try again");

  await click(tid("provider-catalogue-retry"));
  assert.equal(tid("provider-catalogue-error"), null, "the error clears on success");
  assert.ok(tid("provider-product-T18-1A"), "and the arrangements arrive");
  assert.equal(attempts, 2, "exactly one retry, not a loop");
});

test("in ATTACH mode a chosen arrangement is reported, shown selected, and opens no checkout", async () => {
  const picked = [];
  ROUTES = liveRoutes();
  await mount(Entry, {
    selectedCategory: "flowers", product: null, customer: null,
    onSelect: (p) => picked.push(p), selectedProductId: null,
  });
  await click(tid("provider-product-T163-1A"));

  assert.equal(picked.length, 1, "the choice is reported once");
  assert.equal(picked[0].providerProductId, "T163-1A");
  // THE GREETING OWNS THE CHECKOUT. This surface must not be able to finish on its own.
  assert.equal(tid("provider-checkout-modal"), null, "attach mode opens no checkout");

  // Selection is drawn from the CALLER's state, so it is the caller that remembers the choice.
  await mount(Entry, {
    selectedCategory: "flowers", product: null, customer: null,
    onSelect: () => {}, selectedProductId: "T163-1A",
  });
  assert.equal(tid("provider-product-T163-1A").getAttribute("aria-pressed"), "true");
  assert.equal(tid("provider-product-T18-1A").getAttribute("aria-pressed"), "false");
});

test("in STANDALONE mode a chosen arrangement opens the existing checkout at the DETAILS step", async () => {
  // The marketplace still reaches a checkout — one click, not two, and it starts past the picker
  // because the arrangement is already in hand.
  ROUTES = liveRoutes();
  await mount(Entry, { selectedCategory: "flowers", product: null, customer: { email: "sam@example.com" } });
  await click(tid("provider-product-T18-1A"));

  assert.ok(tid("provider-checkout-modal"), "the existing checkout opens");
  assert.ok(tid("provider-checkout-details"), "already at the details step");
  assert.equal(tid("provider-checkout-picker"), null, "the product step is not repeated");
});

test("the gift selector offers Flowers only when a catalogue exists, and shows it in place", async () => {
  const changes = [];
  const props = (type, catalogue) => ({
    isOpen: true, onClose: () => {},
    occasions: [{ type: "just_because", date: "2026-09-20" }],
    occasionGiftSettings: { just_because: { type, autoGift: false } },
    onGiftChange: (occ, field, value) => changes.push([occ, field, value]),
    getOccasionLabel: () => "Just Because", getOccasionEmoji: () => "*",
    context: "oneoff", flowersCatalogue: catalogue,
  });

  // No catalogue — the option is not offered at all, so it cannot be selected on a dead surface.
  await mount(Selector, props("none", null));
  assert.equal(document.querySelector('input[value="flowers"]'), null,
    "Flowers is not offered without a catalogue");

  // With one, the option appears and the arrangements render UNDER it the moment it is chosen.
  const marker = React.createElement("div", { "data-testid": "stub-catalogue" }, "arrangements");
  await mount(Selector, props("none", marker));
  assert.ok(document.querySelector('input[value="flowers"]'), "Flowers is offered");
  assert.equal(tid("gift-selector-flowers"), null, "but nothing is shown until it is chosen");

  await mount(Selector, props("flowers", marker));
  assert.ok(tid("gift-selector-flowers"), "choosing Flowers reveals the catalogue");
  assert.ok(tid("stub-catalogue"), "in place, in this modal");
  // Flowers is charged by the provider at its own checkout; a second separately-charged attachment
  // beside it would invent a two-payment send that nothing downstream settles.
  assert.equal(
    /Include QR Cash with this card/i.test(document.body.textContent), false,
    "no second payment is offered alongside a flower order",
  );
});

// ===========================================================================
// 2. The review step: one primary action, and an honest price
// ===========================================================================

test("the review step keeps ONE primary action and routes Flowers to the embedded checkout", async () => {
  const calls = { direct: 0, qr: 0, market: 0, flowers: 0 };
  const reviewProps = (flowersAttachment) => ({
    isOpen: true, onClose: () => {},
    recipientName: "Debbie", recipientEmail: "debbie@example.com",
    occasionLabel: "Birthday", messagePreview: "Happy birthday!", photoCount: 1,
    giftMode: "flowers", qrCashAttachment: null, curatedAttachment: null,
    marketplaceAttachments: null, flowersAttachment, sending: false,
    onConfirmDirectSend: () => { calls.direct += 1; },
    onConfirmQRCashFresh: () => { calls.qr += 1; },
    onMarketplaceCheckout: () => { calls.market += 1; },
    onConfirmFlowersCheckout: () => { calls.flowers += 1; },
    onRemoveAttachment: () => {},
  });

  // No arrangement chosen: the single action is refused rather than duplicated by a second one.
  await mount(Review, reviewProps(null));
  assert.ok(tid("review-flowers-none"), "the sender is told nothing is chosen");
  const idle = [...host.querySelectorAll("button")].find((b) => /Pay the florist and send/i.test(b.textContent));
  assert.ok(idle, "the one primary action is present");
  assert.equal(idle.disabled, true, "and disabled until an arrangement exists");

  // Chosen: the same one button, now armed, routing to the embedded checkout and nowhere else.
  await mount(Review, reviewProps({
    providerProductId: "T18-1A", name: "Autumn Warmth", priceMinor: 5499, currency: "USD",
  }));
  assert.ok(tid("review-flowers"), "the attachment is shown");
  assert.equal(tid("review-flowers-price").textContent, "$54.99");
  // The ARRANGEMENT price, labelled as such. The florist's total is not known until it quotes.
  assert.match(document.body.textContent, /delivery and tax are added at the payment step/i);

  const cta = [...host.querySelectorAll("button")].find((b) => /Pay the florist and send/i.test(b.textContent));
  assert.equal(cta.disabled, false);
  await click(cta);
  assert.deepEqual(calls, { direct: 0, qr: 0, market: 0, flowers: 1 },
    "Flowers routes to the flower checkout, and to no other terminal handler");
  // And the send is still what is promised, not a shopping trip.
  assert.match(document.body.textContent, /sends by itself as soon as the florist accepts/i);
});

// ===========================================================================
// 3. The handoff: accepted continues the send, and nothing else does
// ===========================================================================

test("an ACCEPTED order hands off exactly once, and offers no Done of its own", async () => {
  const handoffs = await payWith({
    ok: true, status: "accepted", providerOrderId: "210103981",
    dispatched: "yes", customerCharged: "yes", checkout: { provider: "florist_one" },
  });

  assert.equal(handoffs.length, 1, "exactly one handoff for one accepted order");
  assert.equal(handoffs[0].providerOrderId, "210103981", "carrying the provider's own order number");
  assert.equal(handoffs[0].status, "accepted");

  // NEVER "Done" WHILE THE GREET-ME IS UNSENT. That is the whole point of the embedded mode: the
  // flower transaction has no terminal screen of its own, so the combined confirmation is the first
  // and only moment either result is called finished.
  assert.equal(tid("provider-checkout-done"), null, "no Done button");
  assert.ok(tid("provider-checkout-handoff"), "the sender is told the Greet-Me is going out");
  assert.match(tid("provider-checkout-handoff").textContent, /Sending your Greet-Me/);
  assert.equal(document.querySelector('[aria-label="Close checkout"]'), null,
    "and nothing to close: the greeting is mid-send");
  // The order number is still shown — it is the one durable reference the provider gives us.
  assert.equal(tid("provider-order-number").textContent, "210103981");
});

test("STANDALONE, the same accepted order still ends in Done — the change is scoped to embedding", async () => {
  // Nothing about the marketplace's own checkout changed. Without `onAccepted` there is no greeting
  // waiting on it, so Done is the honest terminal control and it is still there.
  ROUTES = liveRoutes({
    "/provider-checkout/submit": async () => ({
      ok: true, status: "accepted", providerOrderId: "210103982",
      dispatched: "yes", customerCharged: "yes", checkout: { provider: "florist_one" },
    }),
  });
  installTokenizer();
  await mount(Modal, {
    isOpen: true, onClose: () => {}, giftType: "flowers", product: PRODUCTS[0],
    customer: { email: "sam@example.com" },
  });
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await awaitTokenizerReady();
  await fillCard();
  if (tid("provider-checkout-accept-price")) await click(tid("provider-checkout-accept-price"));
  await click(tid("provider-checkout-pay"));

  assert.ok(tid("provider-checkout-done"), "the marketplace checkout keeps its Done");
  assert.equal(tid("provider-checkout-handoff"), null, "and has nothing to hand off to");
});

test("a REFUSED submission never hands off, and nothing is presented as sent", async () => {
  const handoffs = await payWith({
    ok: false, status: "submission_failed", dispatched: "no", customerCharged: "no",
    checkout: { provider: "florist_one" },
  });

  assert.equal(handoffs.length, 0, "a refused order must not send a greeting");
  assert.equal(tid("provider-checkout-handoff"), null);
  assert.equal(/Sending your Greet-Me/.test(document.body.textContent), false);
  // The sender is left with the truth and a way forward, exactly as before this packet.
  assert.match(document.body.textContent, /Nothing was charged/i);
});

test("an UNCERTAIN confirmation never hands off — the one that would be easiest to get wrong", async () => {
  // The provider publishes no order-status API, so "we could not confirm" is not "it worked". A
  // greeting announcing an order that may not exist is exactly the failure this refuses.
  const handoffs = await payWith({
    ok: false, status: "confirmation_uncertain", dispatched: "unknown",
    customerCharged: "unknown", retryProhibited: true, requiresHumanResolution: true,
    checkout: { provider: "florist_one" },
  });

  assert.equal(handoffs.length, 0, "an unconfirmed order must not send a greeting");
  assert.equal(tid("provider-checkout-handoff"), null);
  assert.equal(tid("provider-checkout-retry"), null, "and no retry is offered after an uncertain outcome");
  assert.match(document.body.textContent, /Confirmation uncertain/i);
});

test("a DECLINED card never hands off, and the sender stays on the payment step", async () => {
  const handoffs = await payWith({ ok: true, status: "accepted", providerOrderId: "MUST-NOT-REACH" }, { decline: true });

  assert.equal(handoffs.length, 0, "a declined card must not send a greeting");
  assert.equal(tid("provider-checkout-confirmation"), null, "and produces no confirmation");
  assert.ok(tid("provider-checkout-error"), "the decline is shown");
  // The refusal happened in the browser, so the backend was never asked to place anything.
  assert.equal(REQUESTS.some((r) => r.path.includes("/submit")), false, "nothing was submitted");
});

test("a MOVED price never hands off: back to the quote, nothing sent, nothing charged", async () => {
  for (const status of ["quote_changed", "quote_unavailable"]) {
    const handoffs = await payWith({ ok: false, status, dispatched: "no", customerCharged: "no" });
    assert.equal(handoffs.length, 0, `${status} must not send a greeting`);
    assert.ok(tid("provider-checkout-details"), `${status} returns to the quote`);
    assert.equal(tid("provider-checkout-confirmation"), null);
    assert.match(document.body.textContent, /nothing was charged/i);
  }
});

test("CLOSING the checkout hands off nothing and orders nothing", async () => {
  const handoffs = [];
  let closed = 0;
  ROUTES = liveRoutes({
    "/provider-checkout/submit": async () => { throw new Error("closing must never submit an order"); },
  });
  installTokenizer();
  await mount(Modal, {
    isOpen: true, onClose: () => { closed += 1; }, giftType: "flowers", product: PRODUCTS[0],
    customer: { email: "sam@example.com" }, onAccepted: (r) => handoffs.push(r),
  });
  await click(document.querySelector('[aria-label="Close checkout"]'));

  assert.equal(closed, 1, "the caller is told to close");
  assert.equal(handoffs.length, 0, "closing sends no greeting");
  assert.equal(REQUESTS.some((r) => r.path.includes("/submit")), false, "and places no order");
});

test("a DOUBLE CLICK places one order and hands off once", async () => {
  // The provider has no idempotency key, so a second dispatch is a second real order — and a second
  // handoff would be a second greeting. Both are refused, by two independent latches.
  const handoffs = [];
  let submits = 0;
  ROUTES = liveRoutes({
    "/provider-checkout/submit": async () => {
      submits += 1;
      return {
        ok: true, status: "accepted", providerOrderId: "210103981",
        dispatched: "yes", customerCharged: "yes", checkout: { provider: "florist_one" },
      };
    },
  });
  installTokenizer();
  await mount(Modal, {
    isOpen: true, onClose: () => {}, giftType: "flowers", product: PRODUCTS[0],
    customer: { email: "sam@example.com" }, onAccepted: (r) => handoffs.push(r),
  });
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await awaitTokenizerReady();
  await fillCard();
  if (tid("provider-checkout-accept-price")) await click(tid("provider-checkout-accept-price"));

  const pay = tid("provider-checkout-pay");
  // Both clicks dispatched before any await resolves — the real double-click, not two attempts.
  await act(async () => {
    pay.dispatchEvent(new window.Event("click", { bubbles: true }));
    pay.dispatchEvent(new window.Event("click", { bubbles: true }));
  });
  await flush(); await flush(); await flush(); await flush();

  assert.equal(submits, 1, "exactly one order placed");
  assert.equal(handoffs.length, 1, "exactly one greeting dispatched");
});

test("a re-render of an accepted checkout does not hand off again", async () => {
  // The latch is a ref, not derived state: re-rendering the accepted result — which React may do for
  // any reason — must not look like a second acceptance.
  const handoffs = [];
  await payWith(
    {
      ok: true, status: "accepted", providerOrderId: "210103981",
      dispatched: "yes", customerCharged: "yes", checkout: { provider: "florist_one" },
    },
    { onAccepted: (r) => handoffs.push(r) },
  );
  assert.equal(handoffs.length, 1);

  for (let i = 0; i < 3; i += 1) await flush();
  assert.equal(handoffs.length, 1, "still exactly one handoff after further renders");
});

test("no card material reaches the Greet-Me backend on the embedded path either", async () => {
  // The property that must survive every change to this surface. Asserted here too, because a new
  // caller is exactly the kind of change that quietly widens what gets posted.
  await payWith({
    ok: true, status: "accepted", providerOrderId: "210103981",
    dispatched: "yes", customerCharged: "yes", checkout: { provider: "florist_one" },
  });

  const posted = JSON.stringify(REQUESTS.map((r) => r.body ?? null));
  assert.equal(posted.includes("4111111111111111"), false, "no card number");
  assert.equal(/"cvv"/i.test(posted), false, "no CVV");
  assert.equal(posted.includes("ONE-TIME-TOKEN"), true, "only the one-time token crosses");
});
