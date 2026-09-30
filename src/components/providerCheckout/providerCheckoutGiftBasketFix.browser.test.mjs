// src/components/providerCheckout/providerCheckoutGiftBasketFix.browser.test.mjs
//
// THE PRODUCTION DEFECT THIS FILE PROVES FIXED (2026-09-30, founder-reported).
//
// A Gift Basket (Goody, giftType "gift_boxes") checkout showed flower-specific copy — "we will
// price your flower order", "the florist may need to call", "allow the florist to substitute
// flowers" — because the checkout modal used to receive a hardcoded `giftType="flowers"` for EVERY
// standalone provider-fulfilled selection, whatever category the chosen product actually belonged
// to (fixed in src/pages/Merch.jsx, proven separately in giftPlaceStandalonePurchase.browser.test.mjs
// test 10+11). That same mis-tagging is what would have sent the PRICING REQUEST itself to the
// wrong provider (Florist One instead of Goody) with a product code Florist One could never
// recognize — this file proves the category now travels correctly all the way into the payload.
//
// This file mounts the REAL ProviderCheckoutModal directly, as providerCheckout.browser.test.mjs
// already does, and reuses its exact harness so nothing about the mounting or stubbing is invented
// fresh here.
//
// Run (Node 20.x, or Node 22+/25 with --no-experimental-global-navigator — see
// feedback_node_version_breaks_fe_browser_tests):
//   node --no-experimental-global-navigator --test src/components/providerCheckout/providerCheckoutGiftBasketFix.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__pcgb.bundle.mjs");
const ENTRY = join(__dirname, ".__pcgb.entry.jsx");
const START_URL = "http://localhost/dashboard/gifts";

let React, createRoot, act, Modal, MemoryRouter, window;

before(async () => {
  writeFileSync(ENTRY, 'export { default as Modal } from "./ProviderCheckoutModal.jsx";\n'
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
  try { globalThis.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.localStorage = window.localStorage;
  window.performance.getEntriesByType = (type) => (type === "resource" ? RESOURCES : []);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Modal, MemoryRouter } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

// ---------------------------------------------------------------------------
// The stubbed world — same shapes as providerCheckout.browser.test.mjs
// ---------------------------------------------------------------------------

const TOKENIZER_URL = "https://tokenizer.example/v1/Accept.js";
const TOKENIZATION = {
  provider: "goody", rail: "authorize_net_accept_js",
  apiLoginId: "login-id", publicClientKey: "public-client-key",
  acceptJsUrl: TOKENIZER_URL, tokenizationKeyFingerprint: "fp-1",
};

/** A quote whose parts sum exactly to the total, for either category. */
function quoteFor(provider) {
  return {
    provider, productMinor: 2000, shippingMinor: 599, taxMinor: 150, feesMinor: 0,
    totalMinor: 2749, currency: "USD", taxKnown: true, quoteVersion: "qv-1",
  };
}
function preparedFor(provider, giftType) {
  return {
    ok: true, attemptId: "gpc_gb1", provider, giftType,
    status: "preparing", currency: "USD", orderTotalMinor: 2749, deliveryDate: "2026-09-15", region: "US",
    quote: quoteFor(provider),
  };
}

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

let PRISTINE_APPEND_CHILD;
let RESOURCES = [];
const completeTokenizerCore = () => RESOURCES.push({ name: "https://tokenizer.example/v1/AcceptCore.js" });
function installTokenizer() {
  PRISTINE_APPEND_CHILD = PRISTINE_APPEND_CHILD || window.document.head.appendChild;
  const original = PRISTINE_APPEND_CHILD.bind(window.document.head);
  window.document.head.appendChild = (node) => {
    const appended = original(node);
    if (node.tagName === "SCRIPT" && node.src === TOKENIZER_URL) {
      window.Accept = {
        dispatchData: (payload, cb) => cb({ messages: { resultCode: "Ok" }, opaqueData: { dataValue: "ONE-TIME-TOKEN" } }),
      };
      setTimeout(() => {
        node.dispatchEvent(new window.Event("load"));
        // The library fetching its own core — the evidence readiness waits for (see
        // providerCheckout.browser.test.mjs, which this mirrors).
        completeTokenizerCore();
      }, 0);
    }
    return appended;
  };
}

let root, host;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function mount(props) {
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(MemoryRouter, null, React.createElement(Modal, props)));
  });
  await flush();
}
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const byId = (id) => document.getElementById(id);
const bodyText = () => (document.body.textContent || "").replace(/\s+/g, " ");
const setVal = (el, v) => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const click = async (el) => {
  await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); });
  await flush(); await flush(); await flush();
};

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
async function awaitTokenizerReady({ ticks = 40 } = {}) {
  for (let i = 0; i < ticks; i += 1) {
    if (!tid("provider-checkout-securing")) return;
    await flush();
  }
  throw new Error("the tokenizer never reached its ready state");
}

beforeEach(() => {
  delete window.Accept;
  RESOURCES = [];
  if (PRISTINE_APPEND_CHILD) window.document.head.appendChild = PRISTINE_APPEND_CHILD;
  ROUTES = {};
  stubFetch();
});

// ===========================================================================
// COPY — category-conditional, never flower-shaped for a gift box
// ===========================================================================

test("a gift box checkout shows provider-neutral, category-correct copy — never flower language", async () => {
  await mount({ isOpen: true, giftType: "gift_boxes", product: { providerProductId: "GOODY-1", name: "Sampler Snack Basket" }, customer: {}, onClose: () => {} });

  const body = bodyText();
  assert.match(body, /price your gift box order/i, "the review step names the real category");
  assert.doesNotMatch(body, /flower/i, "no flower language may appear on a gift box checkout");
  assert.doesNotMatch(body, /florist/i, "no florist language may appear on a gift box checkout");
  // No vendor name either — Goody's name must never reach this generic copy.
  assert.doesNotMatch(body, /goody/i, "no vendor name may appear in the category copy");

  await fillDetails();
  const afterDetails = bodyText();
  assert.match(afterDetails, /delivery partner may need to call/i,
    "the phone helper uses vendor-neutral wording for a non-flower category");
  assert.doesNotMatch(afterDetails, /florist/i);
  assert.match(afterDetails, /allow a substitution of equal or greater value/i,
    "the substitution checkbox uses vendor-neutral wording for a non-flower category");
  assert.doesNotMatch(afterDetails, /flowers of equal or greater value/i);
});

test("a flowers checkout still shows its ORIGINAL flower-specific copy — regression guard", async () => {
  await mount({ isOpen: true, giftType: "flowers", product: { providerProductId: "T18-1A", name: "Sweet Devotion" }, customer: {}, onClose: () => {} });

  const body = bodyText();
  assert.match(body, /price your flower order/i, "flowers keeps its exact original review-step wording");

  await fillDetails();
  const afterDetails = bodyText();
  assert.match(afterDetails, /the florist may need to call about the delivery/i,
    "flowers keeps its exact original phone helper — unchanged by the category fix");
  assert.match(afterDetails, /allow the florist to substitute flowers of equal or greater value/i,
    "flowers keeps its exact original substitution checkbox wording — unchanged by the category fix");
});

// ===========================================================================
// PAYLOAD — the pricing request itself must carry the real category
// ===========================================================================

test("a gift box pricing request carries giftType=gift_boxes, never flower-defaulted", async () => {
  ROUTES = {
    "/provider-checkout/prepare": async (body) => {
      assert.equal(body.giftType, "gift_boxes", "the prepare request must name the real category");
      assert.equal(body.productCode, "GOODY-1", "and the real product code, never a florist SKU");
      return preparedFor("goody", "gift_boxes");
    },
  };
  await mount({ isOpen: true, giftType: "gift_boxes", product: { providerProductId: "GOODY-1", name: "Sampler Snack Basket" }, customer: {}, onClose: () => {} });
  await fillDetails();
  await click(tid("provider-checkout-continue"));

  const prepareCalls = REQUESTS.filter((r) => r.path.includes("/prepare"));
  assert.equal(prepareCalls.length, 1, "exactly one prepare request was sent");
  assert.equal(prepareCalls[0].body.giftType, "gift_boxes");
  assert.notEqual(prepareCalls[0].body.giftType, "flowers",
    "THE DEFECT: a gift box must never be priced as a flower order");

  // The review's own line-item label reflects the real category too.
  assert.match(tid("provider-checkout-line-product").textContent, /Gift box/,
    "the line item is labelled for the real category, not hardcoded 'Flowers'");
});

test("a flowers pricing request still carries giftType=flowers — regression guard", async () => {
  ROUTES = { "/provider-checkout/prepare": async () => preparedFor("florist_one", "flowers") };
  await mount({ isOpen: true, giftType: "flowers", product: { providerProductId: "T18-1A", name: "Sweet Devotion" }, customer: {}, onClose: () => {} });
  await fillDetails();
  await click(tid("provider-checkout-continue"));

  const prepareCalls = REQUESTS.filter((r) => r.path.includes("/prepare"));
  assert.equal(prepareCalls[0].body.giftType, "flowers");
  assert.match(tid("provider-checkout-line-product").textContent, /Flowers/,
    "flowers keeps its original 'Flowers' line-item label");
});

// ===========================================================================
// FAILURE SAFETY — a failed prepare can never charge or dispatch anything
// ===========================================================================

test("a failed pricing attempt shows an actionable error and never reaches submit", async () => {
  ROUTES = {
    "/provider-checkout/prepare": async () => (
      { ok: false, code: "PROVIDER_CHECKOUT_PREPARE_FAILED", error: "We could not price this order. Please check the delivery details and try again." }
    ),
    "/provider-checkout/submit": async () => { throw new Error("submit must never be reached after a failed prepare"); },
  };
  await mount({ isOpen: true, giftType: "gift_boxes", product: { providerProductId: "GOODY-1", name: "Sampler Snack Basket" }, customer: {}, onClose: () => {} });
  await fillDetails();
  await click(tid("provider-checkout-continue"));

  assert.ok(tid("provider-checkout-error"), "the inline failure is shown");
  assert.match(tid("provider-checkout-error").textContent, /could not price this order/i);
  assert.equal(REQUESTS.some((r) => r.path.includes("/submit")), false,
    "no submission of any kind may follow a failed pricing attempt");
  // Still at the details step — no payment step, no card fields, nothing to charge.
  assert.ok(tid("provider-checkout-details"), "the checkout stays at details, never advances to payment");
  assert.equal(tid("provider-checkout-payment"), null);
});

// ===========================================================================
// IDEMPOTENCY — a rapid double-click on Pay cannot place two orders
// ===========================================================================

test("a rapid double-click on Place Order submits exactly once", async () => {
  installTokenizer();
  const submits = [];
  ROUTES = {
    "/provider-checkout/prepare": async () => preparedFor("goody", "gift_boxes"),
    "/provider-checkout/tokenization": async () => ({ ok: true, provider: "goody", tokenization: TOKENIZATION }),
    "/provider-checkout/submit": async (body) => {
      submits.push(body);
      return {
        ok: true, status: "accepted", providerOrderId: "ORD-1",
        checkout: { attemptId: "gpc_gb1", provider: "goody", status: "accepted", providerOrderId: "ORD-1", deliveryStatusKnown: false },
      };
    },
  };
  await mount({ isOpen: true, giftType: "gift_boxes", product: { providerProductId: "GOODY-1", name: "Sampler Snack Basket" }, customer: {}, onClose: () => {} });
  await fillDetails();
  await click(tid("provider-checkout-continue"));
  await awaitTokenizerReady();
  await fillCard();

  const payButton = tid("provider-checkout-pay");
  // TWO clicks, back to back, with no await between them — the scenario a fast or double-tapping
  // customer produces. The `submitting` ref inside onPay is what must stop the second one.
  await act(async () => {
    payButton.dispatchEvent(new window.Event("click", { bubbles: true }));
    payButton.dispatchEvent(new window.Event("click", { bubbles: true }));
  });
  await flush(); await flush(); await flush();

  assert.equal(submits.length, 1, "exactly one order may ever be submitted for one double-click");
});
