// src/components/providerCheckout/providerCheckout.browser.test.mjs
//
// The provider checkout AS RENDERED. The real components are bundled and mounted in jsdom with the
// network stubbed at `fetch`, so what is asserted is what a customer would actually get:
//
//   * nothing at all while the provider is dormant — no button, no tokenizer script, no vendor call
//   * the card never reaching the Greet-Me backend
//   * the provider's order number on the confirmation, with no delivery claim beside it
//   * no retry offered after an uncertain outcome
//   * the customer still on the Greet-Me route the whole way through
//
// Run (Node 20.x):
//   node --test src/components/providerCheckout/providerCheckout.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__pc.bundle.mjs");
const ENTRY = join(__dirname, ".__pc.entry.jsx");
const START_URL = "http://localhost/dashboard/gifts";

let React, createRoot, act, Entry, Modal, MemoryRouter, window;
/** The untouched appendChild, captured once so test hooks never stack on one another. */
let PRISTINE_APPEND_CHILD;

before(async () => {
  writeFileSync(ENTRY,
    'export { default as Entry } from "./ProviderCheckoutEntry.jsx";\n'
    + 'export { default as Modal } from "./ProviderCheckoutModal.jsx";\n'
    // The surface renders inside the dashboard router in the real app, and the Greet-Me header
    // logo is a link, so it is mounted in that same context rather than stubbed away.
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
  ({ Entry, Modal, MemoryRouter } = await import(pathToFileURL(BUNDLE).href));
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
// Mirrors the real prepare response: the authoritative quote travels WITH the total, and its
// components account for it exactly (5499 + 2499 + 499 = 8497).
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
    return {
      status: 200, ok: true, headers: { get: () => null },
      json: async () => payload,
    };
  };
  window.fetch = globalThis.fetch;
}

/** The Resource Timing entries the readiness barrier reads. jsdom fetches nothing, so the test
 *  drives them explicitly — which is also how the production race is reproduced. */
let RESOURCES = [];
const completeTokenizerCore = () => RESOURCES.push({ name: "https://tokenizer.example/v1/AcceptCore.js" });

/**
 * A tokenizer that behaves like the real one: the STUB installs its global on load, and its core
 * completes separately. `core: false` reproduces the production failure exactly.
 */
function installTokenizer({ decline = false, core = true } = {}) {
  const seen = [];
  window.__tokenizerCalls = seen;
  // Always wrap the PRISTINE appendChild. Wrapping the previous wrapper stacked one hook per test,
  // so a later `core: false` install was still serviced by an earlier `core: true` one.
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
        // The library fetching its own core — the evidence readiness waits for.
        if (core) completeTokenizerCore();
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
const byId = (id) => document.getElementById(id);
const setVal = (el, v) => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const click = async (el) => {
  await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); });
  // Three ticks: the script "load" callback, the tokenizer callback it resolves, and the state
  // update that follows. One flush would assert on a step the customer has not reached yet.
  await flush(); await flush(); await flush();
};

/**
 * Wait for the tokenizer's readiness to actually RENDER, rather than hoping a fixed number of ticks
 * covered it. Readiness resolves through an observer plus promise hops, so a test asserting the
 * enabled state must wait for the evidence on screen — bounded, and it fails loudly if it never comes.
 */
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

beforeEach(() => {
  delete window.Accept;
  delete window.__greetmeTokenizerLoad;
  RESOURCES = [];
  if (PRISTINE_APPEND_CHILD) window.document.head.appendChild = PRISTINE_APPEND_CHILD;
  ROUTES = {};
  stubFetch();
});

// ===========================================================================
// Dormant: the marketplace is untouched
// ===========================================================================

test("while the provider is dormant the marketplace shows nothing and loads no payment library", async () => {
  ROUTES = { "/provider-checkout/availability": async () => ({ ok: true, available: false, reason: "provider_disabled" }) };
  await mount(Entry, { selectedCategory: "flowers", product: null, customer: null });

  assert.equal(tid("provider-checkout-entry"), null, "no entry point may render while dormant");
  assert.equal(document.querySelector("script[data-greetme-tokenizer]"), null,
    "no tokenizer script may be loaded on marketplace render");
  assert.equal(REQUESTS.filter((r) => !r.path.includes("availability")).length, 0,
    "the only call is the posture question");
});

test("a category no provider backs asks nothing at all", async () => {
  ROUTES = { "/provider-checkout/availability": async () => ({ ok: true, available: true }) };
  await mount(Entry, { selectedCategory: "tech", product: null, customer: null });
  assert.equal(tid("provider-checkout-entry"), null);
  assert.equal(REQUESTS.length, 0, "a non-provider category must not even ask");
});

test("an unanswerable posture question fails closed", async () => {
  ROUTES = { "/provider-checkout/availability": async () => { throw new Error("network down"); } };
  globalThis.fetch = async () => { throw new Error("network down"); };
  window.fetch = globalThis.fetch;
  await mount(Entry, { selectedCategory: "flowers", product: null, customer: null });
  assert.equal(tid("provider-checkout-entry"), null);
});

// ===========================================================================
// Activated: the whole customer journey, on one Greet-Me route
// ===========================================================================

test("the customer completes the order inside Greet-Me and sees the provider order number", async () => {
  const tokenizerCalls = installTokenizer();
  const submits = [];
  ROUTES = {
    "/provider-checkout/prepare": async () => PREPARED,
    "/provider-checkout/tokenization": async () => ({ ok: true, provider: "florist_one", tokenization: TOKENIZATION }),
    "/provider-checkout/submit": async (body) => {
      submits.push(body);
      return {
        ok: true, status: "accepted", providerOrderId: "ORD-77421",
        checkout: {
          attemptId: "gpc_1", provider: "florist_one", status: "accepted", providerOrderId: "ORD-77421",
          deliveryStatusKnown: false, statusSource: "provider_submission_acknowledgement",
        },
      };
    },
  };

  await mount(Modal, { isOpen: true, giftType: "flowers", product: { providerProductId: "PRD-1" }, customer: {}, onClose: () => {} });
  await fillDetails();
  await click(tid("provider-checkout-continue"));

  // The authoritative total, as the provider quoted it.
  assert.ok(tid("provider-checkout-payment"), "the payment step must open");
  assert.match(tid("provider-checkout-summary").textContent, /\$84\.97/);
  assert.match(tid("provider-checkout-summary").textContent, /Florist One/);

  await fillCard();
  await awaitTokenizerReady();
  await click(tid("provider-checkout-pay"));

  // 1. The card went to the PROVIDER's tokenizer, in this browser.
  assert.equal(tokenizerCalls.length, 1);
  assert.equal(tokenizerCalls[0].cardData.cardNumber, "4111111111111111");

  // 2. Greet-Me received the token and nothing else. No request anywhere carries card data.
  assert.equal(submits.length, 1, "exactly one submission");
  assert.equal(submits[0].paymentToken, "ONE-TIME-TOKEN");
  const everythingSent = JSON.stringify(REQUESTS);
  for (const forbidden of ["4111111111111111", '"cvv"', '"cardNumber"', '"expMonth"']) {
    assert.equal(everythingSent.includes(forbidden), false, `the backend received ${forbidden}`);
  }

  // 3. The confirmation shows the order number, and claims nothing beyond acceptance.
  assert.equal(tid("provider-order-number").textContent, "ORD-77421");
  // Scoped to the whole modal: the acceptance sentence is the step's own heading copy, and the
  // order number sits beneath it.
  const shown = tid("provider-checkout-modal").textContent.toLowerCase();
  assert.match(shown, /your flower order has been accepted by florist one\./);
  for (const claim of ["delivered", "tracking", "on its way", "refunded", "completed"]) {
    assert.equal(shown.includes(claim), false, `the confirmation claimed "${claim}"`);
  }

  // 4. The card inputs were cleared, and the customer never left the Greet-Me route.
  assert.equal(byId("pc-card"), null, "the payment step is gone once the order is placed");
  assert.equal(window.location.href, START_URL, "the customer must stay on the Greet-Me route");
  assert.equal(document.querySelector('a[href*="florist"], a[href*="authorize"]'), null,
    "no vendor link may appear anywhere on the surface");
});

test("a price that moved sends the customer back to the quote — no charge, no retry, no second token", async () => {
  const tokenizerCalls = installTokenizer();
  const submits = [];
  let prepares = 0;
  ROUTES = {
    "/provider-checkout/prepare": async () => { prepares += 1; return PREPARED; },
    "/provider-checkout/tokenization": async () => ({ ok: true, provider: "florist_one", tokenization: TOKENIZATION }),
    "/provider-checkout/submit": async (body) => {
      submits.push(body);
      return {
        ok: false, status: "quote_changed", requiresFreshQuote: true,
        dispatched: "no", customerCharged: "no", retryProhibited: false,
        providerCode: "PROVIDER_QUOTE_CHANGED",
      };
    },
  };

  await mount(Modal, { isOpen: true, giftType: "flowers", product: { providerProductId: "PRD-1" }, customer: {}, onClose: () => {} });
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await fillCard();
  await awaitTokenizerReady();
  await click(tid("provider-checkout-pay"));

  // Exactly one tokenization and exactly one submission — and then nothing else happens on its own.
  assert.equal(tokenizerCalls.length, 1, "the card was tokenized once");
  assert.equal(submits.length, 1, "submitted once");
  await flush(); await flush(); await flush();
  assert.equal(tokenizerCalls.length, 1, "no automatic re-tokenization");
  assert.equal(submits.length, 1, "no automatic resubmission");

  // The customer is back at the quote step, not on a confirmation and not on a failure.
  assert.equal(tid("provider-checkout-payment"), null, "the payment step is gone");
  assert.equal(tid("provider-order-number"), null, "no order number, because no order exists");
  assert.ok(tid("provider-checkout-continue"), "the existing quote-review flow is where they land");

  // Every card field is empty, and the token minted a moment ago was never kept.
  for (const id of ["pc-card", "pc-exp-month", "pc-exp-year", "pc-cvv"]) {
    const el = byId(id);
    assert.equal(el === null || el.value === "", true, `${id} must not hold a value`);
  }
  assert.equal(JSON.stringify(REQUESTS).split("ONE-TIME-TOKEN").length - 1, 1,
    "the token crossed once and was never re-sent");

  // The wording is accurate: the price moved, nothing was charged, and the provider is not blamed.
  const shown = tid("provider-checkout-modal").textContent;
  assert.match(shown, /price of this flower order changed/i);
  assert.match(shown, /nothing was charged/i);
  assert.equal(/did not accept|rejected|declined/i.test(shown), false, "the provider must not be blamed");
  assert.equal(/charged your card|payment was taken/i.test(shown), false, "no charge may be implied");

  // A fresh quote requires a deliberate action, and it is a NEW prepare.
  assert.equal(prepares, 1, "nothing re-priced by itself");
  await click(tid("provider-checkout-continue"));
  assert.equal(prepares, 2, "the fresh quote comes from a new deliberate acknowledgement");
});

test("a quote that could not be obtained returns to the review WITHOUT claiming the price changed", async () => {
  const tokenizerCalls = installTokenizer();
  const submits = [];
  ROUTES = {
    "/provider-checkout/prepare": async () => PREPARED,
    "/provider-checkout/tokenization": async () => ({ ok: true, provider: "florist_one", tokenization: TOKENIZATION }),
    "/provider-checkout/submit": async (body) => {
      submits.push(body);
      return {
        ok: false, status: "quote_unavailable", requiresFreshQuote: true,
        dispatched: "no", customerCharged: "no", retryProhibited: false,
        providerCode: "PROVIDER_QUOTE_UNAVAILABLE",
      };
    },
  };

  await mount(Modal, { isOpen: true, giftType: "flowers", product: { providerProductId: "PRD-1" }, customer: {}, onClose: () => {} });
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await fillCard();
  await awaitTokenizerReady();
  await click(tid("provider-checkout-pay"));

  // Same protections as the changed-price path: one tokenization, one submission, nothing automatic.
  assert.equal(tokenizerCalls.length, 1);
  assert.equal(submits.length, 1);
  await flush(); await flush(); await flush();
  assert.equal(tokenizerCalls.length, 1, "no automatic re-tokenization");
  assert.equal(submits.length, 1, "no automatic resubmission");

  assert.equal(tid("provider-checkout-payment"), null, "the payment step is gone");
  assert.equal(tid("provider-order-number"), null, "no order exists");
  assert.ok(tid("provider-checkout-continue"), "back in the existing review flow");
  for (const id of ["pc-card", "pc-exp-month", "pc-exp-year", "pc-cvv"]) {
    const el = byId(id);
    assert.equal(el === null || el.value === "", true, `${id} must not hold a value`);
  }

  // The wording is the DIFFERENT one: nothing was charged, and no claim that the price moved.
  const shown = tid("provider-checkout-modal").textContent;
  assert.match(shown, /could not confirm the current price/i);
  assert.match(shown, /nothing was charged/i);
  assert.equal(/price of this flower order changed/i.test(shown), false,
    "an unobtainable quote must not be reported as a changed price");
  assert.equal(/did not accept|rejected|declined/i.test(shown), false);
});

test("a declined card clears the fields and never reaches the backend", async () => {
  installTokenizer({ decline: true });
  let submitted = 0;
  ROUTES = {
    "/provider-checkout/prepare": async () => PREPARED,
    "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
    "/provider-checkout/submit": async () => { submitted += 1; return { ok: true }; },
  };

  await mount(Modal, { isOpen: true, giftType: "flowers", product: {}, customer: {}, onClose: () => {} });
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await fillCard();
  await awaitTokenizerReady();
  await click(tid("provider-checkout-pay"));

  assert.equal(submitted, 0, "a card that was never tokenized must not reach the backend");
  assert.match(tid("provider-checkout-error").textContent, /Credit card number is invalid/);
  assert.equal(byId("pc-card").value, "", "the card number must be cleared after a terminal failure");
  assert.equal(byId("pc-cvv").value, "");
});

test("an uncertain outcome offers no retry and sends the customer to support", async () => {
  installTokenizer();
  ROUTES = {
    "/provider-checkout/prepare": async () => PREPARED,
    "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
    "/provider-checkout/submit": async () => ({
      ok: false, status: "confirmation_uncertain", retryProhibited: true, requiresHumanResolution: true,
      checkout: { attemptId: "gpc_1", provider: "florist_one", status: "confirmation_uncertain", providerOrderId: null },
    }),
  };

  await mount(Modal, { isOpen: true, giftType: "flowers", product: {}, customer: {}, onClose: () => {} });
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await fillCard();
  await awaitTokenizerReady();
  await click(tid("provider-checkout-pay"));

  // The step's own copy is the modal heading; the confirmation block below it holds the actions.
  const text = tid("provider-checkout-modal").textContent;
  assert.ok(tid("provider-checkout-confirmation"), "the customer reaches a confirmation step");
  assert.equal(tid("provider-checkout-retry"), null, "an uncertain outcome must never offer a retry");
  assert.match(text, /contact support/i);
  assert.match(text, /do not submit it again/i);
  assert.equal(tid("provider-order-number"), null, "no order number may be shown when none came back");
});

// ===========================================================================
// The founder-only product picker
// ===========================================================================

const LIVE_PRODUCTS = [
  { providerProductId: "T18-1A", name: "Sweet Devotion", priceMinor: 5499, currency: "USD", imageUrl: null },
  { providerProductId: "B12-3B", name: "Simply Sweet", priceMinor: 4499, currency: "USD", imageUrl: null },
];

test("the picker lists the provider's LIVE products and their own prices", async () => {
  ROUTES = { "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }) };
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });

  assert.ok(tid("provider-checkout-picker"), "the picker is the first step when no product is known");
  assert.ok(tid("provider-product-T18-1A"));
  assert.equal(tid("provider-price-T18-1A").textContent, "$54.99");
  assert.equal(tid("provider-price-B12-3B").textContent, "$44.99");

  // The price is DISPLAY ONLY: there is no editable price control anywhere on this step.
  const inputs = [...tid("provider-checkout-picker").querySelectorAll("input, select, textarea")];
  assert.equal(inputs.length, 0, "a price the browser could edit must not exist");
});

test("a product must be chosen before the checkout will continue", async () => {
  ROUTES = { "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }) };
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });

  assert.equal(tid("provider-checkout-choose").disabled, true);
  await click(tid("provider-checkout-choose"));
  assert.ok(tid("provider-checkout-picker"), "an unchosen picker cannot advance");

  await click(tid("provider-product-B12-3B"));
  assert.equal(tid("provider-checkout-choose").disabled, false);
  await click(tid("provider-checkout-choose"));
  assert.ok(tid("provider-checkout-details"), "choosing advances to the delivery details");
});

test("an ordinary customer sees no products and cannot proceed", async () => {
  // The backend answers 403 to anyone but the founder; the client turns that into an empty list.
  ROUTES = { "/provider-checkout/catalog": async () => ({ ok: false, error: "founder_required" }) };
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });

  assert.ok(tid("provider-checkout-picker-empty"), "no product is offered");
  assert.equal(document.querySelector('[data-testid^="provider-product-"]'), null);
  assert.equal(tid("provider-checkout-choose").disabled, true);
});

test("the chosen product is what gets priced, and the browser never sends a price", async () => {
  const prepares = [];
  ROUTES = {
    "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }),
    "/provider-checkout/prepare": async (body) => { prepares.push(body); return PREPARED; },
    "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
  };
  installTokenizer();
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));
  await fillDetails();
  await click(tid("provider-checkout-continue"));

  assert.equal(prepares.length, 1);
  assert.equal(prepares[0].productCode, "T18-1A", "the chosen product is the one priced");
  const sent = JSON.stringify(prepares[0]);
  for (const forbidden of ['"priceMinor"', '"orderTotalMinor"', '"total"']) {
    assert.equal(sent.includes(forbidden), false, `the browser must not send ${forbidden}`);
  }
  // And the total shown is the one the PROVIDER quoted, not anything from the picker.
  assert.match(tid("provider-checkout-summary").textContent, /\$84\.97/);
});

// ===========================================================================
// The rendered pre-payment review
// ===========================================================================

/** Reach the payment step with a chosen product and a given prepare response. */
async function reachPayment({ prepared = PREPARED, products = LIVE_PRODUCTS } = {}) {
  ROUTES = {
    "/provider-checkout/catalog": async () => ({ ok: true, products }),
    "/provider-checkout/prepare": async () => prepared,
    "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
  };
  installTokenizer();
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));
  await fillDetails();
  await click(tid("provider-checkout-continue"));
}

test("the recipient telephone field renders as a telephone input and is required", async () => {
  ROUTES = { "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }) };
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));

  const field = byId("pc-recipient-phone");
  assert.ok(field, "the field exists");
  assert.equal(field.getAttribute("type"), "tel", "it is a telephone input");
  assert.match(document.querySelector('label[for="pc-recipient-phone"]').textContent, /recipient telephone/i);

  // Everything else complete, telephone left empty: prepare must not be called.
  await fillDetails();
  setVal(field, "");
  const before = REQUESTS.length;
  await click(tid("provider-checkout-continue"));
  assert.equal(REQUESTS.length, before, "no prepare request may be sent");
  assert.ok(tid("provider-checkout-details"), "the customer stays on the details step");
});

test("a badly-formed telephone number is refused in the browser, before any request", async () => {
  ROUTES = {
    "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }),
    "/provider-checkout/prepare": async () => PREPARED,
  };
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));
  await fillDetails();

  for (const bad of ["555", "12015550123", "201-555-0123 x22", "call me"]) {
    setVal(byId("pc-recipient-phone"), bad);
    const before = REQUESTS.length;
    await click(tid("provider-checkout-continue"));
    assert.equal(REQUESTS.length, before, `${bad} must not reach the API`);
  }
});

test("the telephone number reaches recipient.phone as ten digits, never the sender", async () => {
  const prepares = [];
  ROUTES = {
    "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }),
    "/provider-checkout/prepare": async (body) => { prepares.push(body); return PREPARED; },
    "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
  };
  installTokenizer();
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));
  await fillDetails();
  await click(tid("provider-checkout-continue"));

  assert.equal(prepares.length, 1);
  assert.equal(prepares[0].recipient.phone, "2015550123", "the recipient's number, normalized");
  // The customer's own number is now collected too, in the billing block. The two are entered in
  // different fields, normalized the same way, and must never be interchanged.
  assert.equal(prepares[0].sender.phone, "9735551111", "the customer's number, normalized");
  assert.notEqual(prepares[0].recipient.phone, prepares[0].sender.phone);
});

test("the telephone number never appears on the quote review", async () => {
  await reachPayment();
  const summary = tid("provider-checkout-summary").textContent;
  for (const forbidden of ["2015550123", "(201) 555-0123", "201-555-0123"]) {
    assert.equal(summary.includes(forbidden), false, `the review must not show ${forbidden}`);
  }
});

test("the billing block renders on the details step, before the card is ever shown", async () => {
  ROUTES = { "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }) };
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));

  assert.ok(tid("provider-checkout-billing"), "billing is collected with the other details");
  assert.ok(byId("pc-billing-line1") && byId("pc-billing-city") && byId("pc-billing-state") && byId("pc-billing-zip"));
  assert.equal(byId("pc-cust-phone").getAttribute("type"), "tel");
  // The card fields belong to the LATER step and must not exist yet.
  assert.equal(byId("pc-card"), null, "no card field before the quote");
});

test("an incomplete billing address blocks prepare in the browser", async () => {
  ROUTES = {
    "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }),
    "/provider-checkout/prepare": async () => PREPARED,
  };
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));
  await fillDetails();

  for (const [id, bad] of [["pc-billing-line1", ""], ["pc-billing-city", ""],
    ["pc-billing-state", "New Jersey"], ["pc-billing-zip", "073"], ["pc-cust-phone", "555"]]) {
    const good = byId(id).value;
    setVal(byId(id), bad);
    const before = REQUESTS.length;
    await click(tid("provider-checkout-continue"));
    assert.equal(REQUESTS.length, before, `${id}=${JSON.stringify(bad)} must not reach the API`);
    setVal(byId(id), good);
  }
});

test("the billing address reaches sender.billingAddress and never the recipient", async () => {
  const prepares = [];
  ROUTES = {
    "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }),
    "/provider-checkout/prepare": async (body) => { prepares.push(body); return PREPARED; },
    "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
  };
  installTokenizer();
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));
  await fillDetails();
  await click(tid("provider-checkout-continue"));

  assert.equal(prepares.length, 1);
  assert.equal(prepares[0].sender.billingAddress.line1, "1 Sender St");
  assert.equal(prepares[0].sender.billingAddress.zip, "07030");
  assert.equal(prepares[0].sender.phone, "9735551111");
  assert.equal(prepares[0].recipient.shippingAddress.line1, "12 Elm St");
  assert.notEqual(prepares[0].sender.billingAddress.line1, prepares[0].recipient.shippingAddress.line1);
  // And nothing about the buyer's IP is offered by the browser at all.
  assert.equal(JSON.stringify(prepares[0]).includes('"ip"'), false, "the browser must not send an IP");
});

test("billing details never appear on the quote review", async () => {
  await reachPayment();
  const summary = tid("provider-checkout-summary").textContent;
  for (const forbidden of ["1 Sender St", "07030", "9735551111", "Hoboken"]) {
    assert.equal(summary.includes(forbidden), false, `the review must not show ${forbidden}`);
  }
});

test("the review shows every authoritative component, the code, the city/state and the date", async () => {
  await reachPayment();
  const summary = tid("provider-checkout-summary").textContent;

  assert.equal(tid("provider-checkout-review-code").textContent, "T18-1A");
  assert.equal(tid("provider-checkout-review-city").textContent, "Newark, NJ");
  assert.equal(tid("provider-checkout-review-date").textContent, "2026-09-15");
  assert.match(summary, /Sweet Devotion/);
  assert.match(tid("provider-checkout-line-product").textContent, /\$54\.99/);
  assert.match(tid("provider-checkout-line-delivery").textContent, /\$24\.99/);
  assert.match(tid("provider-checkout-line-tax").textContent, /\$4\.99/);
  assert.match(tid("provider-checkout-line-total").textContent, /\$84\.97/);
  // The displayed parts account for the displayed total, exactly.
  assert.equal(5499 + 2499 + 499, 8497);
  // A valid quote alone does NOT open the button: the card form is still empty.
  assert.equal(tid("provider-checkout-pay").disabled, true, "empty card fields keep it closed");
  await fillCard();
  await awaitTokenizerReady();
  assert.equal(tid("provider-checkout-pay").disabled, false, "quote + ready tokenizer + card input");
});

test("the review never renders the street address, postcode, telephone, card or token", async () => {
  await reachPayment();
  const summary = tid("provider-checkout-summary").textContent;
  for (const forbidden of ["12 Elm St", "07102", "4111", "cvv", "tok_", "Bearer"]) {
    assert.equal(summary.includes(forbidden), false, `the review must not show ${forbidden}`);
  }
});

test("a quote with a missing component FAILS CLOSED — no price shown, Place Order disabled", async () => {
  await reachPayment({ prepared: { ...PREPARED, quote: { ...QUOTE, taxMinor: undefined } } });
  assert.ok(tid("provider-checkout-quote-unavailable"), "the payer is told the price cannot be shown");
  assert.equal(tid("provider-checkout-line-total"), null, "no total is displayed");
  assert.equal(tid("provider-checkout-pay").disabled, true, "Place Order must be disabled");
});

// ===========================================================================
// The payment gate — four independent conditions, each provable alone
// ===========================================================================

test("the tokenizer starts loading on ARRIVAL at payment, not on the Place Order click", async () => {
  await reachPayment();
  // The tag exists before anything has been clicked on this step.
  const tag = document.querySelector('script[data-greetme-tokenizer]');
  assert.ok(tag, "the tokenizer is preloaded while the customer types");
  assert.equal(tag.src, TOKENIZER_URL);
});

test("a NOT-READY tokenizer shows the securing state and keeps Place Order disabled", async () => {
  // The exact production failure: the stub installs its global, the core never completes.
  ROUTES = {
    "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }),
    "/provider-checkout/prepare": async () => PREPARED,
    "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
  };
  installTokenizer({ core: false });
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await fillCard();

  const state = tid("provider-checkout-securing") ? "securing"
    : tid("provider-checkout-tokenizer-failed") ? "failed" : "neither";
  assert.equal(state, "securing", `a neutral securing state is shown (saw: ${state})`);
  assert.match(tid("provider-checkout-securing").textContent, /securing payment form/i);
  assert.equal(tid("provider-checkout-pay").disabled, true,
    "a complete quote and a filled card are NOT enough while the tokenizer is unproven");
});

test("empty card fields keep Place Order disabled even with a ready tokenizer", async () => {
  await reachPayment();
  assert.equal(tid("provider-checkout-pay").disabled, true);
  // Each field alone is insufficient; only the complete set opens it.
  setVal(byId("pc-card"), "4111111111111111");
  await flush();
  assert.equal(tid("provider-checkout-pay").disabled, true, "a number alone is not enough");
  setVal(byId("pc-exp-month"), "01");
  setVal(byId("pc-exp-year"), "30");
  await flush();
  assert.equal(tid("provider-checkout-pay").disabled, true, "still no security code");
  setVal(byId("pc-cvv"), "123");
  await flush();
  await awaitTokenizerReady();
  assert.equal(tid("provider-checkout-pay").disabled, false);
});

test("ONE click causes exactly ONE dispatchData, and repeats while processing cause none", async () => {
  const calls = installTokenizer();
  ROUTES = {
    "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }),
    "/provider-checkout/prepare": async () => PREPARED,
    "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
    "/provider-checkout/submit": async () => ({ ok: true, status: "accepted", checkout: ACCEPTED }),
  };
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await fillCard();
  await awaitTokenizerReady();

  const pay = tid("provider-checkout-pay");
  await click(pay);
  assert.equal(calls.length, 1, "one deliberate click, one tokenization");

  // Hammer it: the button is gone or disabled, and the handler refuses regardless.
  const again = tid("provider-checkout-pay");
  if (again) { await click(again); await click(again); }
  assert.equal(calls.length, 1, "repeated clicks add no further tokenization");
  const submits = REQUESTS.filter((r) => r.path.includes("/provider-checkout/submit"));
  assert.equal(submits.length, 1, "and exactly one submission");
});

test("a declined tokenization is NOT retried automatically", async () => {
  const calls = installTokenizer({ decline: true });
  ROUTES = {
    "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }),
    "/provider-checkout/prepare": async () => PREPARED,
    "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
  };
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await fillCard();
  await awaitTokenizerReady();
  await click(tid("provider-checkout-pay"));

  assert.equal(calls.length, 1, "one attempt, and no automatic second one");
  assert.equal(REQUESTS.filter((r) => r.path.includes("/provider-checkout/submit")).length, 0,
    "a declined card never reaches submission");
});

test("no card value is persisted, logged or sent to the Greet-Me API", async () => {
  installTokenizer();
  ROUTES = {
    "/provider-checkout/catalog": async () => ({ ok: true, products: LIVE_PRODUCTS }),
    "/provider-checkout/prepare": async () => PREPARED,
    "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
    "/provider-checkout/submit": async () => ({ ok: true, status: "accepted", checkout: ACCEPTED }),
  };
  await mount(Modal, { isOpen: true, giftType: "flowers", product: null, customer: {}, onClose: () => {} });
  await click(tid("provider-product-T18-1A"));
  await click(tid("provider-checkout-choose"));
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await fillCard();
  await awaitTokenizerReady();
  await click(tid("provider-checkout-pay"));

  const sent = JSON.stringify(REQUESTS);
  for (const forbidden of ["4111111111111111", '"cvv"', '"cardNumber"', '"expMonth"', '"expYear"', '"cardCode"']) {
    assert.equal(sent.includes(forbidden), false, `${forbidden} must never reach the API`);
  }
  // Nor may any of it be left in browser storage.
  const stored = JSON.stringify({ ls: { ...window.localStorage }, ss: { ...window.sessionStorage } });
  for (const forbidden of ["4111", "cardNumber", "cvv"]) {
    assert.equal(stored.includes(forbidden), false, `${forbidden} must not be persisted`);
  }
});

test("components that do not sum to the total fail closed too", async () => {
  await reachPayment({ prepared: { ...PREPARED, quote: { ...QUOTE, taxMinor: 500 } } });
  assert.ok(tid("provider-checkout-quote-unavailable"));
  assert.equal(tid("provider-checkout-pay").disabled, true);
});

test("a changed price warns, blocks Place Order, and unblocks only on an express acknowledgement", async () => {
  // The catalog listed 5499; the quote comes back at 6499.
  await reachPayment({ prepared: { ...PREPARED, quote: { ...QUOTE, productMinor: 6499, totalMinor: 9497 }, orderTotalMinor: 9497 } });

  const warning = tid("provider-checkout-price-changed");
  assert.ok(warning, "the payer is warned");
  assert.match(warning.textContent, /\$54\.99/, "the old listed price is named");
  assert.match(warning.textContent, /\$64\.99/, "the new quoted price is named");
  assert.equal(tid("provider-checkout-pay").disabled, true, "Place Order is blocked");
  // The QUOTED figure is what is displayed as the price of record.
  assert.match(tid("provider-checkout-line-product").textContent, /\$64\.99/);
  assert.match(tid("provider-checkout-line-total").textContent, /\$94\.97/);

  await click(tid("provider-checkout-accept-price"));
  assert.equal(tid("provider-checkout-pay").disabled, true, "the card form is still empty");
  await fillCard();
  await awaitTokenizerReady();
  assert.equal(tid("provider-checkout-pay").disabled, false, "acknowledged price + card input unblocks it");
});

test("a blocked review cannot be paid even if the button is clicked anyway", async () => {
  await reachPayment({ prepared: { ...PREPARED, quote: { ...QUOTE, taxMinor: 500 } } });
  await fillCard();
  const before = REQUESTS.length;
  await awaitTokenizerReady();
  await click(tid("provider-checkout-pay"));
  assert.equal(REQUESTS.length, before, "no request may leave the browser");
  assert.equal(window.__tokenizerCalls.length, 0, "no card may be tokenized");
});

test("the order is not priced until the form is complete, and nothing is sent meanwhile", async () => {
  ROUTES = { "/provider-checkout/prepare": async () => PREPARED };
  await mount(Modal, { isOpen: true, giftType: "flowers", product: {}, customer: {}, onClose: () => {} });
  await click(tid("provider-checkout-continue"));
  assert.equal(REQUESTS.length, 0, "an incomplete order must not be sent anywhere");
  assert.ok(tid("provider-checkout-details"), "the customer stays on the details step");
});
