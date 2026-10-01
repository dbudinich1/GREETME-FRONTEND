// src/components/providerCheckout/giftBoxCheckoutModal.browser.test.mjs
//
// BROWSER-LEVEL proof of GiftBoxCheckoutModal — Greet-Me's own checkout for a gift box (Greet-Me
// charges on its Stripe rail; the backend places the real order server-side).
//
// The REAL component is esbuild-bundled and mounted into jsdom, with three edges stubbed through a
// `stub-edges` plugin (the checkoutMergedIntegrationProof.browser.test.mjs technique):
//   ../../api/api                -> a fake client recording every call (no network)
//   @stripe/react-stripe-js      -> Elements passthrough; a CardElement that reports "complete" on
//                                   click; useStripe() returning a fake with createPaymentMethod and
//                                   confirmCardPayment (no Stripe.js, no iframe)
//   ../../stripe/stripeProvider  -> a non-null stripePromise
//
// Run (Node 20.x, or Node 22+/25 each file in its own process):
//   node --test --experimental-test-module-mocks src/components/providerCheckout/giftBoxCheckoutModal.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gbc.bundle.mjs");
const ENTRY = join(__dirname, ".__gbc.entry.jsx");
const API_STUB = join(__dirname, ".__gbc.api.js");
const STRIPE_STUB = join(__dirname, ".__gbc.stripe.jsx");
const PROVIDER_STUB = join(__dirname, ".__gbc.stripeProvider.js");
const TEMP = [BUNDLE, ENTRY, API_STUB, STRIPE_STUB, PROVIDER_STUB];

let React, createRoot, act, Modal, MemoryRouter, window, T;

before(async () => {
  writeFileSync(API_STUB, `
    export const __calls = [];
    export const __responses = {};
    const call = (name) => async (body) => {
      __calls.push({ name, body });
      const r = __responses[name];
      const out = typeof r === "function" ? await r(body, __calls.filter((c) => c.name === name).length) : r;
      if (out instanceof Error) throw out;
      return out;
    };
    const api = {
      quoteGiftBox: call("quoteGiftBox"),
      chargeGiftBox: call("chargeGiftBox"),
      finalizeGiftBox: call("finalizeGiftBox"),
    };
    export default api;
  `);
  writeFileSync(STRIPE_STUB, `
    import React from "react";
    export const Elements = ({ children }) => children;
    export const CardElement = ({ onChange }) => React.createElement("button", {
      type: "button", "data-testid": "fake-card-complete", onClick: () => onChange({ complete: true }),
    }, "card");
    export const useStripe = () => globalThis.__GBC__.stripe;
    export const useElements = () => ({ getElement: () => ({ fakeCard: true }) });
  `);
  writeFileSync(PROVIDER_STUB, "export const stripePromise = { fake: true };\n");
  writeFileSync(ENTRY,
    'export { default as Modal } from "./GiftBoxCheckoutModal.jsx";\n'
    + 'export { MemoryRouter } from "react-router-dom";\n'
    + 'export { __calls, __responses } from "../../api/api";\n');

  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl" },
    plugins: [{
      name: "stub-edges",
      setup(build) {
        const STUBS = new Map([
          ["../../api/api", API_STUB],
          ["@stripe/react-stripe-js", STRIPE_STUB],
          ["../../stripe/stripeProvider", PROVIDER_STUB],
        ]);
        build.onResolve({ filter: /.*/ }, (a) => {
          const hit = STUBS.get(a.path);
          return hit ? { path: hit } : undefined;
        });
      },
    }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/dashboard/send" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  try { globalThis.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async () => { throw new Error("no test may make a network request"); };
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  const m = await import(pathToFileURL(BUNDLE).href);
  ({ Modal, MemoryRouter } = m);
  T = { calls: m.__calls, responses: m.__responses };
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

const PRODUCT = { providerProductId: "BOX-1", name: "Sampler Snack Box", imageUrl: "https://img.example/box.png" };
const QUOTED_AT = "2026-09-30T12:00:00.000Z";

let stripeCalls;
function installStripe({ confirm } = {}) {
  stripeCalls = { createPaymentMethod: 0, confirmCardPayment: [] };
  globalThis.__GBC__ = {
    stripe: {
      createPaymentMethod: async () => { stripeCalls.createPaymentMethod += 1; return { paymentMethod: { id: "pm_test_1" } }; },
      confirmCardPayment: async (secret) => {
        stripeCalls.confirmCardPayment.push(secret);
        return confirm ? confirm(secret) : { paymentIntent: { status: "succeeded" } };
      },
    },
  };
}

const apiError = (status, code, message) => Object.assign(new Error(message || code), { status, code });
const callsOf = (name) => T.calls.filter((c) => c.name === name);

let root;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function mount(props) {
  document.body.innerHTML = "";
  const host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(MemoryRouter, null, React.createElement(Modal, {
      isOpen: true, onClose: () => {}, product: PRODUCT, customer: { email: "s@example.com" }, ...props,
    })));
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
  assert.ok(el, "the control to click must exist");
  await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); });
  await flush(); await flush(); await flush();
};

async function fillDetails(overrides = {}) {
  const v = {
    "gb-first": "Dana", "gb-address1": "12 Elm St", "gb-city": "Newark", "gb-state": "nj",
    "gb-zip": "07102", ...overrides,
  };
  await act(async () => { for (const [id, val] of Object.entries(v)) setVal(byId(id), val); });
  await flush();
}
async function reachReview() {
  await fillDetails();
  await click(tid("gift-box-get-price"));
  assert.ok(tid("gift-box-checkout-review"), "the review step is reached");
  await click(tid("fake-card-complete"));
}

beforeEach(() => {
  T.calls.length = 0;
  for (const k of Object.keys(T.responses)) delete T.responses[k];
  T.responses.quoteGiftBox = { ok: true, quotedTotalCents: 5499, providerQuotedTotalCents: 5310, feeCents: 189, currency: "usd", quotedAt: QUOTED_AT, quoteValidForMs: 120000 };
  installStripe();
});

// ===========================================================================
// QUOTE
// ===========================================================================

test("quote: a valid form is priced by the server and the total is shown as returned", async () => {
  await mount({});
  await fillDetails();
  await click(tid("gift-box-get-price"));

  const quotes = callsOf("quoteGiftBox");
  assert.equal(quotes.length, 1, "exactly one quote request");
  assert.deepEqual(quotes[0].body, {
    providerProductId: "BOX-1",
    quantity: 1,
    recipient: {
      firstName: "Dana",
      address: { address1: "12 Elm St", city: "Newark", state: "NJ", postalCode: "07102", country: "US" },
    },
  }, "the quote body is the contract shape, state upper-cased, empty optionals omitted");
  assert.match(tid("gift-box-total").textContent, /\$54\.99/, "the server's own total is displayed");
  assert.equal(callsOf("chargeGiftBox").length, 0, "pricing never charges");
});

test("quote: a refused destination shows the server's customer-safe copy verbatim and stays on details", async () => {
  T.responses.quoteGiftBox = apiError(422, "gift_box_quote_refused", "Gift boxes can't be shipped to Alaska right now.");
  await mount({});
  await fillDetails({ "gb-state": "AK" });
  await click(tid("gift-box-get-price"));

  assert.equal(tid("gift-box-checkout-error").textContent, "Gift boxes can't be shipped to Alaska right now.");
  assert.ok(tid("gift-box-checkout-details"), "still on the details step");
  assert.equal(tid("gift-box-checkout-review"), null);
});

test("quote: a provider outage maps to non-technical copy, never the raw code", async () => {
  T.responses.quoteGiftBox = apiError(503, "gift_box_unavailable", "internal detail");
  await mount({});
  await fillDetails();
  await click(tid("gift-box-get-price"));
  assert.match(tid("gift-box-checkout-error").textContent, /temporarily unavailable/i);
  assert.doesNotMatch(bodyText(), /gift_box_unavailable|internal detail/);
});

test("quote: a response missing the fee-free partner price fails closed — nothing payable is shown", async () => {
  T.responses.quoteGiftBox = { ok: true, quotedTotalCents: 5499, quotedAt: QUOTED_AT, quoteValidForMs: 120000 };
  await mount({});
  await fillDetails();
  await click(tid("gift-box-get-price"));
  assert.equal(tid("gift-box-checkout-review"), null, "no review, so no Pay control");
  assert.ok(tid("gift-box-checkout-error"));
});

test("quote: a malformed state code is caught in the browser and never reaches the server", async () => {
  await mount({});
  await fillDetails({ "gb-state": "New Jersey" });
  await click(tid("gift-box-get-price"));
  assert.equal(callsOf("quoteGiftBox").length, 0);
  assert.match(bodyText(), /2-letter state code/);
});

// ===========================================================================
// CHARGE
// ===========================================================================

test("charge: a confirmed order sends the full contract body and hands off exactly once", async () => {
  T.responses.chargeGiftBox = {
    ok: true, fulfillmentStatus: "confirmed",
    gift: { claimToken: "claim-1", claimUrl: "https://app.example/#/gift/claim-1", qrImageUrl: "https://blob.example/qr.png", totalCents: 5499 },
  };
  const accepted = [];
  await mount({ contactId: "c-7", onAccepted: (r) => accepted.push(r) });
  await reachReview();
  await click(tid("gift-box-pay"));

  const charges = callsOf("chargeGiftBox");
  assert.equal(charges.length, 1);
  const body = charges[0].body;
  assert.equal(body.providerProductId, "BOX-1");
  assert.equal(body.quantity, 1);
  assert.equal(body.recipient.firstName, "Dana");
  assert.equal(body.quotedTotalCents, 5499, "the fee-inclusive total the customer SAW");
  assert.equal(body.providerQuotedTotalCents, 5310, "the fee-free partner price, passed through unchanged");
  assert.equal(body.quotedAt, QUOTED_AT);
  assert.equal(body.paymentMethodId, "pm_test_1", "from stripe.createPaymentMethod");
  assert.match(body.giftRequestId, /^[0-9a-f-]{36}$/i, "a fresh UUID attempt id");
  assert.equal("cardMessage" in body, false, "no card message is collected or sent (founder decision)");
  assert.equal(document.getElementById("gb-message"), null);
  assert.equal(body.contactId, "c-7");
  assert.equal("giftOnlyToken" in body, false, "no token without an entitlement gate");

  assert.equal(accepted.length, 1, "handed off exactly once");
  assert.equal(accepted[0].fulfillmentStatus, "confirmed");
  assert.equal(accepted[0].giftClaimToken, "claim-1");
  assert.equal(accepted[0].giftType, "gift_boxes");
  assert.ok(tid("gift-box-handoff"), "embedded + confirmed shows the handoff, not a terminal screen");
});

test("charge: a changed server price is SHOWN, never silently charged — the next click pays the new figure", async () => {
  let chargeN = 0;
  T.responses.chargeGiftBox = () => {
    chargeN += 1;
    if (chargeN === 1) return apiError(409, "gift_box_quote_changed", "The price for this gift box has changed.");
    return { ok: true, fulfillmentStatus: "confirmed", gift: { claimToken: "claim-2", totalCents: 6499 } };
  };
  T.responses.quoteGiftBox = (_b, n) => (n === 1
    ? { ok: true, quotedTotalCents: 5499, providerQuotedTotalCents: 5310, feeCents: 189, quotedAt: QUOTED_AT, quoteValidForMs: 120000 }
    : { ok: true, quotedTotalCents: 6499, providerQuotedTotalCents: 6286, feeCents: 213, quotedAt: "2026-09-30T12:01:00.000Z", quoteValidForMs: 120000 });

  await mount({});
  await reachReview();
  await click(tid("gift-box-pay"));

  assert.equal(callsOf("chargeGiftBox").length, 1, "no automatic resubmission at a different amount");
  assert.ok(tid("gift-box-price-changed"), "the change is shown to the customer");
  assert.match(tid("gift-box-price-changed").textContent, /\$54\.99.*\$64\.99/);
  assert.match(tid("gift-box-total").textContent, /\$64\.99/);
  assert.match(tid("gift-box-pay").textContent, /Pay \$64\.99/);

  const firstId = callsOf("chargeGiftBox")[0].body.giftRequestId;
  await click(tid("gift-box-pay"));
  const second = callsOf("chargeGiftBox")[1].body;
  assert.equal(second.quotedTotalCents, 6499, "the reconfirmed figure");
  assert.equal(second.providerQuotedTotalCents, 6286, "and its partner price");
  assert.equal(second.quotedAt, "2026-09-30T12:01:00.000Z");
  assert.equal(second.giftRequestId, firstId, "nothing was charged, so the same attempt continues");
  assert.ok(tid("gift-box-confirmation"), "standalone: the terminal confirmation");
});

test("charge: 3D Secure — confirmCardPayment(clientSecret) then /finalize with the PaymentIntent", async () => {
  T.responses.chargeGiftBox = { ok: true, requiresAction: true, clientSecret: "pi_3ds_secret_x", paymentIntentId: "pi_3ds" };
  T.responses.finalizeGiftBox = { ok: true, fulfillmentStatus: "confirmed", gift: { claimToken: "claim-3", totalCents: 5499 } };
  const accepted = [];
  await mount({ onAccepted: (r) => accepted.push(r) });
  await reachReview();
  await click(tid("gift-box-pay"));

  assert.deepEqual(stripeCalls.confirmCardPayment, ["pi_3ds_secret_x"]);
  const fin = callsOf("finalizeGiftBox");
  assert.equal(fin.length, 1);
  assert.deepEqual(fin[0].body, { paymentIntentId: "pi_3ds" });
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].giftClaimToken, "claim-3");
});

test("charge: a paid order whose fulfilment is not confirmed shows the server's copy and still hands off", async () => {
  T.responses.chargeGiftBox = {
    ok: true, fulfillmentStatus: "pending", error: "Your payment was received. We're still confirming your gift box order.",
    gift: { claimToken: "claim-4", totalCents: 5499 },
  };
  const accepted = [];
  await mount({ onAccepted: (r) => accepted.push(r) });
  await reachReview();
  await click(tid("gift-box-pay"));

  assert.equal(accepted.length, 1, "the caller decides what pending means downstream");
  assert.equal(accepted[0].fulfillmentStatus, "pending");
  assert.equal(accepted[0].message, "Your payment was received. We're still confirming your gift box order.");
  assert.match(tid("gift-box-fulfillment-message").textContent, /still confirming/);
  assert.equal(tid("gift-box-handoff"), null, "never presented as a confirmed handoff");
});

test("charge: a decline shows the server's message, and the next attempt gets a fresh attempt id", async () => {
  let n = 0;
  T.responses.chargeGiftBox = () => {
    n += 1;
    return n === 1 ? apiError(402, "GIFT_CHARGE_FAILED", "Your card was declined.")
      : { ok: true, fulfillmentStatus: "confirmed", gift: { claimToken: "c5", totalCents: 5499 } };
  };
  await mount({});
  await reachReview();
  await click(tid("gift-box-pay"));
  assert.equal(tid("gift-box-checkout-error").textContent, "Your card was declined.");
  await click(tid("gift-box-pay"));
  const [a, b] = callsOf("chargeGiftBox").map((c) => c.body.giftRequestId);
  assert.notEqual(a, b, "a definitive non-charge releases the idempotency key");
});

// ===========================================================================
// ENTITLEMENT GATE
// ===========================================================================

test("entitlement: checkEntitlement runs BEFORE any payment step, and {proceed:false} blocks the charge", async () => {
  const gateCalls = [];
  await mount({ contactId: "c-7", checkEntitlement: async (id) => { gateCalls.push(id); return { proceed: false, giftOnlyToken: null }; } });
  await reachReview();
  await click(tid("gift-box-pay"));

  assert.equal(gateCalls.length, 1, "the gate ran");
  assert.match(gateCalls[0], /^[0-9a-f-]{36}$/i, "with this attempt's id");
  assert.equal(stripeCalls.createPaymentMethod, 0, "no card interaction after a refusal");
  assert.equal(callsOf("chargeGiftBox").length, 0, "and no charge");
  assert.ok(tid("gift-box-pay"), "the customer is left on the review, free to try again");
});

test("entitlement: {proceed:true} passes the gift-only token straight through, bound to the same attempt id", async () => {
  T.responses.chargeGiftBox = { ok: true, fulfillmentStatus: "confirmed", gift: { claimToken: "c6", totalCents: 5499 } };
  const gateCalls = [];
  await mount({ contactId: "c-7", checkEntitlement: async (id) => { gateCalls.push(id); return { proceed: true, giftOnlyToken: "gift-only-xyz" }; } });
  await reachReview();
  await click(tid("gift-box-pay"));

  const body = callsOf("chargeGiftBox")[0].body;
  assert.equal(body.giftOnlyToken, "gift-only-xyz");
  assert.equal(body.giftRequestId, gateCalls[0], "the token's attempt id IS the charge's giftRequestId");
});

test("entitlement: a server-side SEND_ENTITLEMENT_AT_RISK re-runs the gate and retries once when resolved", async () => {
  let n = 0;
  T.responses.chargeGiftBox = () => {
    n += 1;
    return n === 1 ? apiError(409, "SEND_ENTITLEMENT_AT_RISK", "No send available")
      : { ok: true, fulfillmentStatus: "confirmed", gift: { claimToken: "c7", totalCents: 5499 } };
  };
  let gate = 0;
  await mount({ contactId: "c-7", checkEntitlement: async () => { gate += 1; return { proceed: true, giftOnlyToken: gate === 1 ? null : "tok-2" }; } });
  await reachReview();
  await click(tid("gift-box-pay"));
  await flush(); await flush();

  assert.equal(gate >= 2, true, "the caution ran again with a fresh answer");
  const charges = callsOf("chargeGiftBox");  assert.equal(charges.length, 2, "one retry, not a loop");
  assert.equal(charges[1].body.giftOnlyToken, "tok-2");
});

// ===========================================================================
// NO VENDOR SURFACE
// ===========================================================================

test("no vendor-hosted link is ever rendered, at any step", async () => {
  T.responses.chargeGiftBox = { ok: true, fulfillmentStatus: "confirmed", gift: { claimToken: "c8", claimUrl: "https://app.example/#/gift/c8", totalCents: 5499 } };
  await mount({});
  assert.equal(document.querySelectorAll("a[href]").length, 0, "details step");
  await reachReview();
  assert.equal(document.querySelectorAll("a[href]").length, 0, "review step");
  await click(tid("gift-box-pay"));
  assert.equal(document.querySelectorAll("a[href]").length, 0, "confirmation step");
  assert.doesNotMatch(bodyText(), /https?:\/\//, "no URL is printed either");
});
