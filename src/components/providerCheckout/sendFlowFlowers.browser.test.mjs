// src/components/providerCheckout/sendFlowFlowers.browser.test.mjs
//
// THE GIFT PLACE FLOW, AS RENDERED — selector, catalogue, card, checkout handoff.
//
// The real components are bundled and mounted in jsdom with the network stubbed at `fetch`, so what
// is asserted is what a sender would actually get.
//
// The corrections under test:
//   1. The gift decision screen asks ONE question and offers exactly four choices. No products, no
//      duplicate destination, no second gift.
//   2. A provider category loads its catalogue on SELECTION and renders it through the SAME card and
//      grid as every other category — one click, one request, uniform layout.
//   3. A failed catalogue read is distinguishable from an empty one, and offers Try again.
//   4. An accepted order hands off exactly once, shows no provider name and no Done, and nothing
//      short of ACCEPTED hands off at all.
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

let React, createRoot, act, Modal, Selector, Review, Grid, useProviderCatalogue, MemoryRouter, window;
let PRISTINE_APPEND_CHILD;

before(async () => {
  writeFileSync(ENTRY,
    'export { default as Modal } from "./ProviderCheckoutModal.jsx";\n'
    + 'export { default as Selector } from "../GiftSelectorModal.jsx";\n'
    + 'export { default as Review } from "../PreSendReviewModal.jsx";\n'
    + 'export { GiftProductGrid as Grid } from "../giftPlace/GiftProductCard.jsx";\n'
    + 'export { useProviderCatalogue } from "../giftPlace/useProviderCatalogue.js";\n'
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
  ({ Modal, Selector, Review, Grid, useProviderCatalogue, MemoryRouter } =
    await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

// ---------------------------------------------------------------------------
// The stubbed world
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
  { providerProductId: "T18-1A", name: "Autumn Warmth", priceMinor: 5499, currency: "USD", imageUrl: null, description: "A hand-tied seasonal bouquet." },
  { providerProductId: "T163-1A", name: "Sunlit Roses", priceMinor: 6499, currency: "USD", imageUrl: null, description: "" },
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

const liveRoutes = (overrides = {}) => ({
  "/provider-checkout/availability": async () => ({ ok: true, available: true }),
  "/provider-checkout/catalog": async () => ({ ok: true, products: PRODUCTS }),
  "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
  "/provider-checkout/prepare": async () => PREPARED,
  ...overrides,
});

let RESOURCES = [];
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
      setTimeout(() => {
        node.dispatchEvent(new window.Event("load"));
        RESOURCES.push({ name: "https://tokenizer.example/v1/AcceptCore.js" });
      }, 0);
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
const all = (sel) => [...document.querySelectorAll(sel)];
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

/** Drive the embedded checkout to Place Order with the submit reply under test. */
async function payWith(submitReply, { decline = false, onAccepted, contactId = "contact-1" } = {}) {
  const handoffs = [];
  ROUTES = liveRoutes({ "/provider-checkout/submit": async () => submitReply });
  installTokenizer({ decline });
  await mount(Modal, {
    isOpen: true,
    onClose: () => {},
    giftType: "flowers",
    product: PRODUCTS[0],
    customer: { firstName: "Sam", lastName: "Ops", email: "sam@example.com" },
    contactId,
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

/** A trivial harness so the catalogue hook can be mounted and its states observed. */
function Catalogue({ giftType }) {
  const { products, state, retry } = useProviderCatalogue(giftType);
  return React.createElement(Grid, {
    cards: products.map((p) => ({
      id: p.providerProductId, source: "provider", name: p.name,
      description: p.description || "", imageUrl: p.imageUrl || null,
      priceLabel: `$${(p.priceMinor / 100).toFixed(2)}`, priceMinor: p.priceMinor,
    })),
    state,
    actionLabel: "Select Gift",
    onAction: () => {},
    onRetry: retry,
    emptyLabel: "Flowers",
  });
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
// 1. The decision screen asks ONE question
// ===========================================================================

const selectorProps = (type) => ({
  isOpen: true, onClose: () => {},
  occasions: [{ type: "just_because", date: "2026-09-20" }],
  occasionGiftSettings: { just_because: { type, autoGift: false } },
  onGiftChange: () => {},
  getOccasionLabel: () => "Birthday", getOccasionEmoji: () => "*",
  context: "oneoff", onBrowse: () => {},
});

test("the gift screen offers EXACTLY four choices, in the approved order, single-select", async () => {
  await mount(Selector, selectorProps("none"));
  const radios = all('input[type="radio"]');
  assert.equal(radios.length, 4, "exactly four choices");
  assert.deepEqual(radios.map((r) => r.value), ["none", "qrcash", "marketplace", "curated"]);

  const text = document.body.textContent;
  for (const label of ["None", "QR Cash", "Greet-Me Gift Place", "Select"]) {
    assert.ok(text.includes(label), `the screen must offer ${label}`);
  }
  // Single-select: one radio GROUP, so choosing one replaces the last rather than adding to it.
  assert.equal(new Set(radios.map((r) => r.name)).size, 1, "one group means one gift");
  assert.equal(radios.filter((r) => r.checked).length, 1, "exactly one is chosen at a time");
});

test("the decision screen shows no products and offers no second gift", async () => {
  // Selecting each choice in turn: none of them turns this screen into a shopping surface.
  for (const type of ["none", "qrcash", "marketplace", "curated"]) {
    await mount(Selector, selectorProps(type));
    assert.equal(tid("gift-grid"), null, `${type}: no product grid may render here`);
    assert.equal(tid("gift-selector-flowers"), null, `${type}: no inline catalogue`);
    assert.equal(
      /Include QR Cash with this card/i.test(document.body.textContent), false,
      `${type}: no second, separately-charged gift may be offered`,
    );
    assert.equal(
      /Browse Greet-Me Merch/i.test(document.body.textContent), false,
      `${type}: the duplicate destination must be gone`,
    );
  }
});

test("QR Cash is a first-class choice, not an add-on", async () => {
  await mount(Selector, selectorProps("qrcash"));
  const qr = all('input[type="radio"]').find((r) => r.value === "qrcash");
  assert.ok(qr, "QR Cash is offered");
  assert.equal(qr.type, "radio", "as a radio, so it REPLACES another gift rather than joining it");
  assert.equal(qr.checked, true);
  // Choosing it reveals its own amount control — its existing behaviour, untouched.
  assert.match(document.body.textContent, /Select Amount/);
});

// ===========================================================================
// 2. A provider category loads on selection, into the shared grid
// ===========================================================================

test("selecting Flowers loads the catalogue immediately: one click, ONE request", async () => {
  ROUTES = liveRoutes();
  await mount(Catalogue, { giftType: "flowers" });

  assert.ok(tid("gift-grid"), "the arrangements render in the shared grid");
  assert.ok(tid("gift-card-T18-1A"));
  assert.ok(tid("gift-card-T163-1A"));
  // No button stood between the category and its products.
  assert.equal(/Send a flower gift/i.test(document.body.textContent), false);

  const catalogReads = REQUESTS.filter((r) => r.path.includes("/catalog"));
  assert.equal(catalogReads.length, 1, "one catalogue request, not one per render");
  // ORDER IS THE CONTAINMENT: the posture answer precedes the read that depends on it.
  assert.ok(
    REQUESTS.findIndex((r) => r.path.includes("/availability"))
    < REQUESTS.findIndex((r) => r.path.includes("/catalog")),
    "availability is asked before the catalogue is read",
  );
});

test("while the provider is dormant nothing renders and the catalogue is NEVER read", async () => {
  ROUTES = {
    "/provider-checkout/availability": async () => ({ ok: true, available: false, reason: "provider_disabled" }),
    "/provider-checkout/catalog": async () => { throw new Error("a dormant provider must never be asked for products"); },
  };
  await mount(Catalogue, { giftType: "flowers" });

  assert.equal(tid("gift-grid"), null, "no products");
  assert.equal(REQUESTS.some((r) => r.path.includes("/catalog")), false, "and no catalogue read");
  assert.equal(document.querySelector("script[data-greetme-tokenizer]"), null,
    "no payment library is loaded while browsing");
});

test("a FAILED catalogue read is distinguishable from an empty one, and offers Try again", async () => {
  let attempts = 0;
  ROUTES = liveRoutes({
    "/provider-checkout/catalog": async () => {
      attempts += 1;
      // The shared client answers a dead network with a sentinel, NOT a throw — which is exactly why
      // an empty array cannot be trusted to mean "nothing available".
      if (attempts === 1) return { ok: false, status: 0, networkError: true };
      return { ok: true, products: PRODUCTS };
    },
  });
  await mount(Catalogue, { giftType: "flowers" });

  assert.ok(tid("gift-grid-error"), "the failure is stated");
  assert.equal(tid("gift-grid-empty"), null, "and never dressed up as an empty collection");
  assert.match(document.body.textContent, /could not load this collection/i);

  await click(tid("gift-grid-retry"));
  assert.equal(tid("gift-grid-error"), null, "the error clears on success");
  assert.ok(tid("gift-card-T18-1A"), "and the arrangements arrive");
  assert.equal(attempts, 2, "exactly one retry, not a loop");
});

test("an EMPTY catalogue says Coming Soon, and is not mistaken for a failure", async () => {
  ROUTES = liveRoutes({ "/provider-checkout/catalog": async () => ({ ok: true, products: [] }) });
  await mount(Catalogue, { giftType: "flowers" });

  assert.ok(tid("gift-grid-empty"));
  assert.equal(tid("gift-grid-error"), null, "nothing failed, so nothing says it did");
  assert.match(document.body.textContent, /Coming Soon/);
});

test("the loading state renders skeletons in the real grid, not an empty collection", async () => {
  let release;
  ROUTES = liveRoutes({
    "/provider-checkout/catalog": () => new Promise((r) => { release = () => r({ ok: true, products: PRODUCTS }); }),
  });
  await mount(Catalogue, { giftType: "flowers" });

  assert.ok(tid("gift-grid-loading"), "the sender is told it is loading");
  assert.equal(tid("gift-grid-empty"), null, "and it is never called empty in the meantime");
  release();
  await flush(); await flush();
  assert.ok(tid("gift-grid"), "then the arrangements arrive");
});

// ===========================================================================
// 3. ONE card shape across every category
// ===========================================================================

const cardOf = (over) => ({
  id: "x", source: "catalog", name: "Thing", description: "", imageUrl: null,
  priceLabel: "$10", priceMinor: 1000, ...over,
});

test("Flowers and two other categories render the IDENTICAL card structure", async () => {
  // The founder's uniformity rule, asserted by rendering three different sources through the one
  // component and comparing the shape of what comes out.
  const sets = {
    flowers: [cardOf({ id: "T18-1A", source: "provider", name: "Autumn Warmth", description: "A hand-tied bouquet.", priceLabel: "$54.99" })],
    tech: [cardOf({ id: "431623973", name: "Laptop Sleeve", description: "Additional sizes and models available", priceLabel: "$39 - $44" })],
    americana: [cardOf({ id: "431622804", name: "White glossy mug", description: "", priceLabel: "$15" })],
  };

  const shapes = {};
  for (const [category, cards] of Object.entries(sets)) {
    await mount(Grid, {
      cards, state: "ready", actionLabel: "Select Gift", onAction: () => {}, emptyLabel: category,
    });
    const id = cards[0].id;
    const card = tid(`gift-card-${id}`);
    assert.ok(card, `${category} renders a card`);
    const buttons = card.querySelectorAll("button");
    shapes[category] = {
      hasImage: Boolean(tid(`gift-card-image-${id}`)),
      // The description SLOT is always present, even when the text is empty — that is what keeps
      // every card the same height and the grid from going ragged.
      hasDescriptionSlot: Boolean(tid(`gift-card-desc-${id}`)),
      hasPrice: Boolean(tid(`gift-card-price-${id}`)),
      hasAction: Boolean(tid(`gift-card-action-${id}`)),
      // The action is the LAST control of the card, in every case.
      actionIsLast: buttons[buttons.length - 1] === tid(`gift-card-action-${id}`),
      // And the five elements appear in one fixed order.
      order: [...card.querySelectorAll("[data-testid]")]
        .map((n) => n.dataset.testid.replace(`-${id}`, "")),
    };
  }

  const [first, ...rest] = Object.values(shapes);
  for (const shape of rest) {
    assert.deepEqual(shape, first, "every category must render the identical card structure");
  }
  assert.equal(first.hasImage, true);
  assert.equal(first.hasDescriptionSlot, true);
  assert.equal(first.hasPrice, true);
  assert.equal(first.hasAction, true);
  assert.equal(first.actionIsLast, true);
});

test("the action LABEL changes with context; the card does not", async () => {
  const cards = [cardOf({ id: "T18-1A", source: "provider", name: "Autumn Warmth" })];
  const shapeFor = async (actionLabel) => {
    await mount(Grid, { cards, state: "ready", actionLabel, onAction: () => {}, emptyLabel: "Flowers" });
    const card = tid("gift-card-T18-1A");
    return {
      children: card.children.length,
      order: [...card.querySelectorAll("[data-testid]")].map((n) => n.dataset.testid.replace("-T18-1A", "")),
      label: tid("gift-card-action-T18-1A").textContent,
    };
  };

  const greeting = await shapeFor("Select Gift");
  const store = await shapeFor("Add to Cart");
  assert.match(greeting.label, /Select Gift/);
  assert.match(store.label, /Add to Cart/);
  assert.deepEqual(greeting.order, store.order, "the element order must not move with the label");
  assert.equal(greeting.children, store.children);
});

test("choosing an arrangement reports it and starts NO checkout", async () => {
  const picked = [];
  ROUTES = liveRoutes();
  await mount(Grid, {
    cards: [cardOf({ id: "T18-1A", source: "provider", name: "Autumn Warmth" })],
    state: "ready", actionLabel: "Select Gift",
    onAction: (c) => picked.push(c), emptyLabel: "Flowers",
  });
  await click(tid("gift-card-action-T18-1A"));

  assert.equal(picked.length, 1, "the choice is reported once");
  assert.equal(picked[0].id, "T18-1A");
  // SELECTING ATTACHES; CONTINUE PAYS. Nothing here may price, tokenize or order.
  assert.equal(tid("provider-checkout-modal"), null, "no checkout opens at selection");
  for (const path of ["/prepare", "/submit", "/tokenization"]) {
    assert.equal(REQUESTS.some((r) => r.path.includes(path)), false, `selection must not call ${path}`);
  }
});

// ===========================================================================
// 4. The review step: Continue, then payment
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

  await mount(Review, reviewProps(null));
  const idle = [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === "Continue");
  assert.ok(idle, "the one primary action is present");
  assert.equal(idle.disabled, true, "and disabled until an arrangement exists");

  await mount(Review, reviewProps({
    providerProductId: "T18-1A", name: "Autumn Warmth", priceMinor: 5499, currency: "USD",
  }));
  assert.ok(tid("review-flowers"));
  assert.equal(tid("review-flowers-price").textContent, "$54.99");
  // The purchase-time merchant-of-record disclosure is RETAINED — it is required before payment.
  assert.match(document.body.textContent, /delivery and tax are added at the payment step/i);

  const cta = [...host.querySelectorAll("button")].find((b) => b.textContent.trim() === "Continue");
  assert.equal(cta.disabled, false);
  await click(cta);
  assert.deepEqual(calls, { direct: 0, qr: 0, market: 0, flowers: 1 },
    "Continue routes to the flower checkout and to no other terminal handler");
});

// ===========================================================================
// 5. The handoff: accepted continues the send, and nothing else does
// ===========================================================================

const ACCEPTED = {
  ok: true, status: "accepted", providerOrderId: "TEST-ORDER-0001",
  giftClaimToken: "gift-token-abc", dispatched: "yes", customerCharged: "yes",
  checkout: { provider: "florist_one" },
};

test("an ACCEPTED order hands off exactly once, carrying the gift claim token", async () => {
  const handoffs = await payWith(ACCEPTED);

  assert.equal(handoffs.length, 1, "exactly one handoff for one accepted order");
  assert.equal(handoffs[0].status, "accepted");
  // THE POINTER AT THE GIFT RECORD. Without it the greeting would announce nothing, which is the
  // defect this replaces.
  assert.equal(handoffs[0].giftClaimToken, "gift-token-abc");
});

test("the post-payment handoff names no provider, shows no order number, and offers no Done", async () => {
  await payWith(ACCEPTED);

  assert.ok(tid("provider-checkout-handoff"), "it says what is happening");
  assert.match(document.body.textContent, /Payment confirmed/);
  assert.match(document.body.textContent, /Sending your Greet-Me/);

  assert.equal(tid("provider-checkout-done"), null, "no Done button");
  assert.equal(tid("provider-order-number"), null, "no order number on the recipient-bound path");
  assert.equal(document.querySelector('[aria-label="Close checkout"]'), null,
    "and nothing to close: the greeting is mid-send");
  // The florist is Greet-Me's supplier. The last thing a sender reads before their own confirmation
  // must not be a vendor's name.
  assert.equal(/Florist One/i.test(document.body.textContent), false,
    "the handoff must not name the provider");
  assert.equal(/TEST-ORDER-0001/.test(document.body.textContent), false);
});

test("STANDALONE, the same accepted order still ends in Done — the change is scoped to embedding", async () => {
  ROUTES = liveRoutes({ "/provider-checkout/submit": async () => ACCEPTED });
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

  assert.ok(tid("provider-checkout-done"), "a purchase with no greeting waiting keeps its Done");
  assert.ok(tid("provider-order-number"), "and keeps its order number");
  assert.equal(tid("provider-checkout-handoff"), null);
});

test("NOTHING short of accepted hands off", async () => {
  const outcomes = [
    ["a refused submission", { ok: false, status: "submission_failed", dispatched: "no", customerCharged: "no" }],
    ["an UNCERTAIN confirmation", {
      ok: false, status: "confirmation_uncertain", dispatched: "unknown",
      customerCharged: "unknown", retryProhibited: true, requiresHumanResolution: true,
    }],
    ["a moved price", { ok: false, status: "quote_changed", dispatched: "no", customerCharged: "no" }],
    ["an unconfirmable price", { ok: false, status: "quote_unavailable", dispatched: "no", customerCharged: "no" }],
  ];
  for (const [label, reply] of outcomes) {
    const handoffs = await payWith(reply);
    assert.equal(handoffs.length, 0, `${label} must not send a greeting`);
    assert.equal(tid("provider-checkout-handoff"), null, label);
    assert.equal(/Sending your Greet-Me/.test(document.body.textContent), false, label);
  }
});

test("a DECLINED card never hands off and never reaches the backend", async () => {
  const handoffs = await payWith(ACCEPTED, { decline: true });
  assert.equal(handoffs.length, 0);
  assert.ok(tid("provider-checkout-error"));
  assert.equal(REQUESTS.some((r) => r.path.includes("/submit")), false, "nothing was submitted");
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
    customer: { email: "sam@example.com" }, contactId: "contact-1",
    onAccepted: (r) => handoffs.push(r),
  });
  await click(document.querySelector('[aria-label="Close checkout"]'));

  assert.equal(closed, 1);
  assert.equal(handoffs.length, 0, "closing sends no greeting");
  assert.equal(REQUESTS.some((r) => r.path.includes("/submit")), false, "and places no order");
});

test("a DOUBLE CLICK places one order and hands off once", async () => {
  const handoffs = [];
  let submits = 0;
  ROUTES = liveRoutes({
    "/provider-checkout/submit": async () => { submits += 1; return ACCEPTED; },
  });
  installTokenizer();
  await mount(Modal, {
    isOpen: true, onClose: () => {}, giftType: "flowers", product: PRODUCTS[0],
    customer: { email: "sam@example.com" }, contactId: "contact-1",
    onAccepted: (r) => handoffs.push(r),
  });
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await awaitTokenizerReady();
  await fillCard();
  if (tid("provider-checkout-accept-price")) await click(tid("provider-checkout-accept-price"));

  const pay = tid("provider-checkout-pay");
  await act(async () => {
    pay.dispatchEvent(new window.Event("click", { bubbles: true }));
    pay.dispatchEvent(new window.Event("click", { bubbles: true }));
  });
  await flush(); await flush(); await flush(); await flush();

  assert.equal(submits, 1, "exactly one order placed");
  assert.equal(handoffs.length, 1, "exactly one greeting dispatched");
});

test("a duplicate accepted callback cannot send twice", async () => {
  const handoffs = [];
  await payWith(ACCEPTED, { onAccepted: (r) => handoffs.push(r) });
  assert.equal(handoffs.length, 1);
  for (let i = 0; i < 4; i += 1) await flush();
  assert.equal(handoffs.length, 1, "still exactly one handoff after further renders");
});

test("the greeting's recipient travels to prepare, so the order can be bound to it", async () => {
  await payWith(ACCEPTED, { contactId: "contact-42" });
  const prepare = REQUESTS.find((r) => r.path.includes("/prepare"));
  assert.ok(prepare, "prepare was called");
  assert.equal(prepare.body.contactId, "contact-42");
});

test("no card material reaches the Greet-Me backend on the embedded path either", async () => {
  await payWith(ACCEPTED);
  const posted = JSON.stringify(REQUESTS.map((r) => r.body ?? null));
  assert.equal(posted.includes("4111111111111111"), false, "no card number");
  assert.equal(/"cvv"/i.test(posted), false, "no CVV");
  assert.equal(posted.includes("ONE-TIME-TOKEN"), true, "only the one-time token crosses");
});
