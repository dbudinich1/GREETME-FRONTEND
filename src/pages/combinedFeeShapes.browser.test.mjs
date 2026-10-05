// src/pages/combinedFeeShapes.browser.test.mjs
//
// FEE-POLICY acceptance with REAL backend shapes. scripts/gen-combined-fee-shapes.mjs runs the
// combined backend's own code (buildPrezzeeCardCatalogResponse, giftBoxQuoteBreakdown, and the real
// chargeGiftBox handler for the 409) and these tests feed that output to the real FE components in
// jsdom (api / Stripe edges stubbed; no network, no charge).
//
// Proves: Smart Card shows a DISCLOSED flat "Convenience fee" of $4.99 from the tile's own
// feeCents/totalCents (total = face value + $4.99, no local formula) on the page and in the real
// confirmation modal; the Goody gift-box modal shows ONLY the server display lines with no
// markup/fee wording. CONTRACT T2 section 1A (hidden 5% on the PRODUCT price only): the server's quote carries
// `display` {productCents, shippingHandlingCents, taxCents, totalCents} summing exactly to the charge; the modal renders
// ONLY those lines (Product, S/H, Tax, Total), never feeCents / providerQuotedTotalCents / markup wording; the charge
// echoes quotedTotalCents + providerQuotedTotalCents; the real 409 gift_box_quote_changed carries the fresh display, the
// modal shows it, requires a new click, and charges nothing first.
//
// Run (Node 20): node --test src/pages/combinedFeeShapes.browser.test.mjs
//   PAIR_BE_DIR pins the backend worktree (default C:\1_GREET-ME\cs-be-combined; read-only here). If it is missing the
//   tests are SKIPPED with a printed message (never a silent pass). The backend HEAD the fixtures were generated from is
//   printed and recorded in tests/fixtures/combined-backend-fee-shapes.generated.json (generatedFrom.backendHead).
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { writeFileSync, rmSync, readFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const feRoot = resolve(__dirname, "..", "..");
const BE = process.env.PAIR_BE_DIR || "C:/1_GREET-ME/cs-be-combined";
const SHAPES = join(feRoot, "tests", "fixtures", "combined-backend-fee-shapes.generated.json");
const skip = existsSync(join(BE, "routes", "giftRoutes.js")) ? false : `combined backend not found at ${BE}`;

if (skip) console.warn(`SKIPPED combinedFeeShapes: ${skip}. Set PAIR_BE_DIR to the combined backend worktree to run these tests.`);
const T_ = (name, fn) => test(name, { skip }, fn);
const ENTRY = join(__dirname, ".__cfs.entry.jsx");
const API_STUB = join(__dirname, ".__cfs.api.js");
const STRIPE_STUB = join(__dirname, ".__cfs.stripe.jsx");
const PROVIDER_STUB = join(__dirname, ".__cfs.provider.js");
const BUNDLE = join(__dirname, ".__cfs.bundle.mjs");
const TEMP = [ENTRY, API_STUB, STRIPE_STUB, PROVIDER_STUB, BUNDLE];

let S, React, createRoot, act, M, window, T;

before(async () => {
  if (skip) return;
  const env = { ...process.env, PAIR_BE_DIR: BE }; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [join(feRoot, "scripts", "gen-combined-fee-shapes.mjs"), SHAPES], { encoding: "utf8", env, cwd: feRoot });
  if (r.status !== 0) throw new Error(`generator failed (${r.status}):\n${r.stdout}\n${r.stderr}`);
  S = JSON.parse(readFileSync(SHAPES, "utf8"));
  console.log(`combinedFeeShapes validated against backend ${S.generatedFrom.backendDir} @ ${S.generatedFrom.backendHead}`);

  writeFileSync(API_STUB, `
    export const __calls = []; export const __responses = {};
    const call = (name) => async (body) => {
      __calls.push({ name, body });
      const r = __responses[name];
      const out = typeof r === "function" ? await r(body, __calls.filter((c) => c.name === name).length) : r;
      if (out instanceof Error) throw out;
      return out;
    };
    export default {
      getPrezzeeCardTiles: call("getPrezzeeCardTiles"), chargePrezzeeCard: call("chargePrezzeeCard"), finalizePrezzeeCard: call("finalizePrezzeeCard"),
      quoteGiftBox: call("quoteGiftBox"), chargeGiftBox: call("chargeGiftBox"), finalizeGiftBox: call("finalizeGiftBox"),
    };
  `);
  writeFileSync(STRIPE_STUB, `
    import React from "react";
    export const Elements = ({ children }) => children;
    export const CardElement = ({ onChange }) => React.createElement("button", { type: "button", "data-testid": "fake-card-complete", onClick: () => onChange({ complete: true }) }, "card");
    export const useStripe = () => globalThis.__CFS__.stripe;
    export const useElements = () => ({ getElement: () => ({ fakeCard: true }) });
  `);
  writeFileSync(PROVIDER_STUB, "export const stripePromise = { fake: true };\n");
  writeFileSync(ENTRY, [
    'export { default as SmartCard } from "./PrezzeeSmartCard.jsx";',
    'export { default as PrezzeeModal } from "../components/PrezzeeCardConfirmationModal.jsx";',
    'export { default as GiftBoxModal } from "../components/providerCheckout/GiftBoxCheckoutModal.jsx";',
    'export { MemoryRouter } from "react-router-dom";',
    'export { __calls, __responses } from "../api/api";',
  ].join("\n"));
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react-router-dom"],
    loader: { ".css": "empty", ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl" },
    plugins: [{ name: "stub-edges", setup(b) {
      const STUBS = new Map([["../api/api", API_STUB], ["../../api/api", API_STUB], ["@stripe/react-stripe-js", STRIPE_STUB], ["../stripe/stripeProvider", PROVIDER_STUB], ["../../stripe/stripeProvider", PROVIDER_STUB]]);
      b.onResolve({ filter: /.*/ }, (a) => { const hit = STUBS.get(a.path); return hit ? { path: hit } : undefined; });
    } }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/dashboard/gifts/smart-card" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.MouseEvent = window.MouseEvent; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async () => { throw new Error("no test may make a network request"); };
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
  T = { calls: M.__calls, responses: M.__responses };
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

beforeEach(() => {
  if (skip) return;
  T.calls.length = 0; for (const k of Object.keys(T.responses)) delete T.responses[k];
  globalThis.__CFS__ = { stripe: { createPaymentMethod: async () => ({ paymentMethod: { id: "pm_1" } }), confirmCardPayment: async () => ({ paymentIntent: { status: "succeeded" } }) } };
});

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
let root;
async function mount(el) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(el); }); await flush();
}
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const text = () => (document.body.textContent || "").replace(/\s+/g, " ");
const click = async (el) => { assert.ok(el, "control must exist"); await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); await flush(); await flush(); };
const setVal = (el, v) => { Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, v); el.dispatchEvent(new window.Event("input", { bubbles: true })); };
const apiError = (status, code, message) => Object.assign(new Error(message || code), { status, code });
const fmt = (c) => `$${(c / 100).toFixed(2)}`;

// ---------------------------------------------------------------------------------------------
// Backend shape facts (so a backend regression fails here, not silently in the UI)
// ---------------------------------------------------------------------------------------------
T_("backend: every Smart Card tile carries feeCents 499 and totalCents = amount + 499; face value untouched", () => {
  const tiles = S.smartCard.tiles.tiles;
  assert.equal(tiles.length, 8);
  for (const t of tiles) {
    assert.equal(t.feeCents, 499, t.id);
    assert.equal(t.totalCents, t.amountCents + 499, t.id);
  }
  assert.deepEqual(S.smartCard.calcFor1000, { giftAmountCents: 1000, feeCents: 499, totalCents: 1499 });
});

T_("backend: gift-box quote and 409 carry display lines that sum exactly to the charge (5% on the product only)", () => {
  const G = S.giftBox;
  assert.equal(G.markupRate, 0.05);
  assert.equal(G.markupBasis, "product");
  // unit markup = round(unit x 5%), times quantity; $10.10 x3 = $31.83 product line (contract worked example)
  assert.deepEqual(G.rounding.map((r) => [r.unitCents, r.quantity, r.feeCents]), [[1010, 1, 51], [4500, 1, 225], [999, 1, 50], [1010, 2, 102], [1010, 3, 153]]);
  assert.equal(G.rounding[4].productLineCents + G.rounding[4].feeCents, 3183);
  for (const q of [G.quote, G.quoteQty2, G.quoteAfter, G.charge409.body]) {
    const d = q.display;
    assert.equal(d.productCents + d.shippingHandlingCents + d.taxCents, d.totalCents, "lines sum to the total");
    assert.equal(d.totalCents, q.quotedTotalCents, "the total is the charge");
    assert.equal(q.quotedTotalCents, q.providerQuotedTotalCents + q.feeCents);
  }
  // product line carries the markup; shipping and tax are untouched
  assert.deepEqual(G.quote.display, { productCents: 4725, shippingHandlingCents: 1000, taxCents: 330, totalCents: 6055 });
  assert.deepEqual(G.quoteQty2.display, { productCents: 2122, shippingHandlingCents: 1100, taxCents: 187, totalCents: 3409 });
  assert.equal(G.charge409.status, 409);
  assert.equal(G.charge409.body.code, "gift_box_quote_changed");
  assert.deepEqual(G.charge409.body.display, G.quoteAfter.display);
  assert.equal(G.charge409.body.quotedTotalCents, G.quoteAfter.quotedTotalCents);
  assert.equal(G.charge409.body.providerQuotedTotalCents, G.quoteAfter.providerQuotedTotalCents);
});

// ---------------------------------------------------------------------------------------------
// Smart Card
// ---------------------------------------------------------------------------------------------
T_("Smart Card page: disclosed $4.99 Convenience fee from the tile fields; total = face value + $4.99; never a percentage", async () => {
  T.responses.getPrezzeeCardTiles = S.smartCard.tiles;
  await mount(React.createElement(M.MemoryRouter, null, React.createElement(M.SmartCard)));
  for (const tile of S.smartCard.tiles.tiles) {
    await click(document.querySelector(`[data-tile-id="${tile.id}"]`));
    const t = text();
    assert.match(t, /Convenience fee\$4\.99/, tile.id);
    assert.ok(t.includes(`Smart Card value${fmt(tile.amountCents)}`), "face value shown unchanged");
    assert.ok(t.includes(`Total${fmt(tile.amountCents + 499)}`), `total for ${tile.displayAmount}`);
    assert.doesNotMatch(t, /Processing fee|2\.9|0\.30|5%/);
  }
});

T_("Smart Card confirmation modal: renders the disclosed $4.99 Convenience fee and total from the props it is given", async () => {
  const tile = S.smartCard.tiles.tiles[2]; // $50
  await mount(React.createElement(M.MemoryRouter, null, React.createElement(M.PrezzeeModal, {
    isOpen: true, onClose() {}, onConfirm() {}, displayAmount: tile.displayAmount,
    giftAmountCents: tile.amountCents, feeCents: tile.feeCents, totalCents: tile.totalCents,
  })));
  const t = text();
  assert.ok(t.includes(`Smart Card value (${tile.displayAmount})${fmt(tile.amountCents)}`));
  assert.ok(t.includes("Convenience fee$4.99"));
  assert.ok(t.includes(`Total charge${fmt(tile.amountCents + 499)}`));
  assert.ok(t.includes(`Confirm & Charge ${fmt(tile.amountCents + 499)}`));
  assert.doesNotMatch(t, /Processing fee/);
});

T_("Smart Card: end to end, the charge request is the tile id only (no amount, no fee) and the page shows the server's returned fee", async () => {
  const tile = S.smartCard.tiles.tiles[0];
  T.responses.getPrezzeeCardTiles = S.smartCard.tiles;
  T.responses.chargePrezzeeCard = { ok: true, gift: { claimToken: "t1", giftAmountCents: tile.amountCents, feeCents: tile.feeCents, totalCents: tile.totalCents } };
  await mount(React.createElement(M.MemoryRouter, null, React.createElement(M.SmartCard)));
  await click(document.querySelector(`[data-tile-id="${tile.id}"]`));
  await act(async () => { setVal(document.querySelector('input[type="email"]'), "r@example.com"); setVal([...document.querySelectorAll("input")].find((i) => i.type !== "email"), "Dana"); });
  await click([...document.querySelectorAll("button")].find((b) => /continue to payment/i.test(b.textContent)));
  await click(tid("fake-card-complete"));
  await click([...document.querySelectorAll("button")].find((b) => /Confirm & Charge/.test(b.textContent)));
  const charges = T.calls.filter((c) => c.name === "chargePrezzeeCard");
  assert.equal(charges.length, 1);
  assert.deepEqual(Object.keys(charges[0].body).sort(), ["giftRequestId", "paymentMethodId", "recipientEmail", "recipientName", "tileId"]);
});

// ---------------------------------------------------------------------------------------------
// Goody gift box
// ---------------------------------------------------------------------------------------------
const PRODUCT = { providerProductId: "BOX-1", name: "Sampler Snack Box" };
async function mountGiftBox() {
  await mount(React.createElement(M.MemoryRouter, null, React.createElement(M.GiftBoxModal, { isOpen: true, onClose() {}, product: PRODUCT })));
}
async function reachReview() {
  await act(async () => {
    for (const [id, v] of Object.entries({ "gb-first": "Dana", "gb-address1": "12 Elm St", "gb-city": "Newark", "gb-state": "nj", "gb-zip": "07102" })) setVal(document.getElementById(id), v);
  });
  await click(tid("gift-box-get-price"));
  assert.ok(tid("gift-box-checkout-review"));
  await click(tid("fake-card-complete"));
}

T_("gift box: renders ONLY quote.display (Product, S/H, Tax, Total); never feeCents, the partner price or markup wording", async () => {
  for (const q of [S.giftBox.quote, S.giftBox.quoteQty2]) {
    T.responses.quoteGiftBox = q;
    await mountGiftBox(); await reachReview();
    const d = q.display;
    assert.equal(tid("gift-box-line-product").textContent, `Product${fmt(d.productCents)}`);
    assert.equal(tid("gift-box-line-sh").textContent, `S/H${fmt(d.shippingHandlingCents)}`);
    assert.equal(tid("gift-box-line-tax").textContent, `Tax${fmt(d.taxCents)}`);
    // the Total row wording is unchanged here (P2 copy is the founder's decision); only the amount comes from display
    assert.equal(tid("gift-box-total").textContent.replace(/\s+/g, " "), `Total, shipping and tax included${fmt(d.totalCents)}`);
    assert.equal(d.productCents + d.shippingHandlingCents + d.taxCents, d.totalCents, "the three lines shown add up to the total shown");
    const t = text();
    assert.ok(t.includes(`Pay ${fmt(d.totalCents)}`));
    assert.ok(!t.includes(fmt(q.feeCents)), "the fee amount is never displayed");
    assert.ok(!t.includes(fmt(q.providerQuotedTotalCents)), "the pre-markup partner price is never displayed");
    assert.doesNotMatch(t, /markup|mark-up|5%|at cost|service fee|processing fee|convenience fee|Greet-Me fee/i);
    assert.match(t, /you authorize Greet-Me to charge the total shown/i, "payment disclosure still accurate");
  }
});

T_("gift box: a quote without display lines, or whose lines do not add up to the charge, is refused (nothing to pay)", async () => {
  const good = S.giftBox.quote;
  const bads = [
    { ...good, display: undefined },
    { ...good, display: { ...good.display, taxCents: good.display.taxCents + 1 } },
    { ...good, display: { ...good.display, totalCents: good.display.totalCents + 1 } },
  ];
  for (const bad of bads) {
    T.responses.quoteGiftBox = bad;
    await mountGiftBox();
    await act(async () => {
      for (const [id, v] of Object.entries({ "gb-first": "Dana", "gb-address1": "12 Elm St", "gb-city": "Newark", "gb-state": "nj", "gb-zip": "07102" })) setVal(document.getElementById(id), v);
    });
    await click(tid("gift-box-get-price"));
    assert.equal(tid("gift-box-checkout-review"), null, "no review step, so no pay button");
    assert.equal(tid("gift-box-pay"), null);
  }
});

T_("gift box: the charge echoes quotedTotalCents (= display.totalCents), providerQuotedTotalCents and quotedAt exactly as quoted", async () => {
  const q = S.giftBox.quote;
  T.responses.quoteGiftBox = q;
  T.responses.chargeGiftBox = { ok: true, fulfillmentStatus: "confirmed", gift: { claimToken: "c1", totalCents: q.quotedTotalCents } };
  await mountGiftBox(); await reachReview();
  await click(tid("gift-box-pay"));
  const [call] = T.calls.filter((c) => c.name === "chargeGiftBox");
  assert.equal(call.body.quotedTotalCents, q.display.totalCents);
  assert.equal(call.body.providerQuotedTotalCents, q.providerQuotedTotalCents);
  assert.equal(call.body.quotedAt, q.quotedAt);
  assert.ok(!("display" in call.body) && !("feeCents" in call.body), "the request carries no display or fee field");
});

T_("gift box: the real 409 gift_box_quote_changed shows the fresh display lines, requires a new click, and the first click charged nothing", async () => {
  const before = S.giftBox.quote, after = S.giftBox.quoteAfter, body409 = S.giftBox.charge409.body;
  T.responses.quoteGiftBox = (_b, n) => (n === 1 ? before : after);
  let n = 0;
  T.responses.chargeGiftBox = () => {
    n += 1;
    if (n === 1) return apiError(409, body409.code, body409.error); // exactly what api.js throws for the real 409 body
    return { ok: true, fulfillmentStatus: "confirmed", gift: { claimToken: "c2", totalCents: after.quotedTotalCents } };
  };
  await mountGiftBox(); await reachReview();
  await click(tid("gift-box-pay"));
  assert.equal(T.calls.filter((c) => c.name === "chargeGiftBox").length, 1, "no automatic resubmission");
  const notice = tid("gift-box-price-changed");
  assert.ok(notice, "price change is shown");
  assert.ok(notice.textContent.includes(fmt(before.display.totalCents)) && notice.textContent.includes(fmt(body409.display.totalCents)));
  assert.deepEqual(body409.display, after.display, "the 409 carries the same fresh lines a re-quote returns");
  assert.equal(tid("gift-box-line-product").textContent, `Product${fmt(body409.display.productCents)}`);
  assert.equal(tid("gift-box-line-sh").textContent, `S/H${fmt(body409.display.shippingHandlingCents)}`);
  assert.equal(tid("gift-box-line-tax").textContent, `Tax${fmt(body409.display.taxCents)}`);
  assert.ok(tid("gift-box-total").textContent.includes(fmt(body409.display.totalCents)));
  assert.ok(!text().includes(fmt(body409.feeCents)), "new fee amount still not displayed");
  await click(tid("gift-box-pay"));
  const second = T.calls.filter((c) => c.name === "chargeGiftBox")[1].body;
  assert.equal(second.quotedTotalCents, after.display.totalCents, "reconfirmed figure");
  assert.equal(second.providerQuotedTotalCents, after.providerQuotedTotalCents);
});

T_("no other checkout gained a fee line: Cart, Checkout, Pricing, Merch, flowers contain no new markup/convenience copy", () => {
  for (const f of ["pages/Cart.jsx", "pages/Checkout.jsx", "pages/Merch.jsx", "components/providerCheckout/ProviderCheckoutModal.jsx"]) {
    const src = readFileSync(join(feRoot, "src", f), "utf8");
    assert.doesNotMatch(src, /[Cc]onvenience fee|markup fee|Greet-Me fee/, f);
  }
});
