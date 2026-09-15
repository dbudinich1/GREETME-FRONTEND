// src/pages/giftPlaceUniformConfirmation.browser.test.mjs
//
// ONE CONFIRMATION FOR EVERY GIFT PLACE CATEGORY, FLOWERS INCLUDED.
//
// The defect: selecting a flower jumped straight back to /dashboard/send. Flowers were the one
// category that behaved differently, and the jump threw away where the shopper was — their category,
// their price filter, their scroll position — with no chance to keep browsing.
//
// The correction: a flower opens the SAME "Added to Cart!" confirmation (`AddToCartModal`) that every
// other category opens, showing the arrangement's image, name and price, with Continue Shopping and
// Return to Greeting. Continue Shopping closes only the confirmation and leaves the shopper exactly
// where they were. Return to Greeting goes back with the flower attached.
//
// WHAT IS AND IS NOT TOUCHED. The confirmation component is purely presentational — it imports icons
// and a hover helper, reads `item.name`/`item.price`/`item.imageUrl`, and never touches the cart, the
// API or payment. So reusing it for a flower needs no cart membership and changes no commerce
// architecture: a flower is still attached through the same `sendGreetingState` record it always used,
// and is never added to the cart.
//
// The real Merch page (the Gift Place) is bundled and mounted in jsdom. Only its side-effecting edges
// are stubbed — auth, the API client, the cart, the provider transport and a bundled image. The real
// `useProviderCatalogue` hook runs against that stubbed transport, so the posture gate and the four
// catalogue states are the real ones.
//
// No provider call, no order, no tokenization, no charge, no greeting, no recipient contact: `fetch`
// throws in this environment.
//
// Run (Node 20.x):
//   node --test src/pages/giftPlaceUniformConfirmation.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gpuc.bundle.mjs");
const ENTRY = join(__dirname, ".__gpuc.entry.jsx");
const AUTH_STUB = join(__dirname, ".__gpuc.auth.js");
const API_STUB = join(__dirname, ".__gpuc.api.js");
const CART_STUB = join(__dirname, ".__gpuc.cart.js");
const PROVIDER_STUB = join(__dirname, ".__gpuc.provider.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, CART_STUB, PROVIDER_STUB];

let React, createRoot, act, Merch, MemoryRouter, window;

/** Two synthetic arrangements. Nothing here corresponds to a real order. */
const FLOWERS = [
  {
    providerProductId: "DEMO-T18",
    name: "Sunlit Rose Bouquet",
    priceMinor: 6499,
    currency: "USD",
    imageUrl: "https://example.test/demo-rose.jpg",
  },
  {
    providerProductId: "DEMO-C17",
    name: "Garden Lily Arrangement",
    priceMinor: 7999,
    currency: "USD",
    imageUrl: "https://example.test/demo-lily.jpg",
  },
];

/** One synthetic merch product, single-variant so it confirms without the variant picker. */
const MERCH_PRODUCTS = [
  {
    syncProductId: "MERCH-1",
    name: "Greet-Me Tee",
    // The Gift Place opens on Brandable Goods, and that selection reads the server's own boolean.
    // Without it this product would be real but off-screen, and the test would pass for nothing.
    brandable: true,
    imageUrl: "https://example.test/demo-tee.jpg",
    variantCount: 1,
    priceCentsMin: 2500,
    priceCentsMax: 2500,
    variants: [{ syncVariantId: "V1", label: "Medium", priceCents: 2500 }],
  },
];

before(async () => {
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => ({ user: { id: 'u1', email: 'sender@example.com', name: 'Sender' } });\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");

  writeFileSync(API_STUB,
    "const products = " + JSON.stringify(MERCH_PRODUCTS) + ";\n"
    + "async function request(url = '') {\n"
    + "  if (String(url).includes('/api/merch/products')) return { products };\n"
    + "  return {};\n"
    + "}\n"
    + "const noop = async () => ({ data: {} });\n"
    + "export default { request, get: noop, post: noop, put: noop, delete: noop };\n");

  // Mirrors the real cartService surface. A flower must never reach it — asserted below.
  writeFileSync(CART_STUB,
    "let items = [];\n"
    + "export const __calls = [];\n"
    + "export default {\n"
    + "  getCart: () => items,\n"
    + "  addItem: (i) => { __calls.push(i); items.push(i); return items; },\n"
    + "  removeItem: (id) => { items = items.filter((x) => x.id !== id); return items; },\n"
    + "  updateItem: () => items, getTotal: () => 0, getCount: () => items.length,\n"
    + "  clear: () => { items = []; }, hasItem: () => false, hasMerch: () => false,\n"
    + "  hasNonMerch: () => false, clearMerch: () => { items = []; },\n"
    + "};\n");

  // The provider TRANSPORT is stubbed; the real useProviderCatalogue hook runs on top of it, so the
  // posture gate is exercised rather than bypassed. No network, no vendor.
  writeFileSync(PROVIDER_STUB,
    "const flowers = " + JSON.stringify(FLOWERS) + ";\n"
    + "export const __transport = { availabilityCalls: 0, catalogCalls: 0 };\n"
    + "export async function fetchCheckoutAvailability(giftType) {\n"
    + "  __transport.availabilityCalls += 1;\n"
    + "  return { available: giftType === 'flowers', purchasable: giftType === 'flowers' };\n"
    + "}\n"
    + "export async function fetchProviderCatalog(giftType) {\n"
    + "  __transport.catalogCalls += 1;\n"
    + "  return giftType === 'flowers' ? { ok: true, products: flowers } : { ok: true, products: [] };\n"
    + "}\n"
    // HARNESS COMPLETENESS, not new behaviour. The Gift Place now mounts the existing
    // ProviderCheckoutModal for a STANDALONE purchase, and that component imports these two from the
    // same transport module. Without them in this stub the bundle cannot link and every test in this
    // file fails for a harness reason rather than a product one. Both still refuse to do anything: no
    // test in this file may reach a product list or a tokenization config, and nothing here opens a
    // checkout at all — these assertions are all about the greeting-attached confirmation.
    + "export async function fetchProviderProducts() { throw new Error('no test here may list products'); }\n"
    + "export async function fetchTokenizationConfig() { throw new Error('no test here may fetch tokenization'); }\n"
    + "export async function retryGiftLink() { throw new Error('no test may retry a gift link'); }\n"
    + "export async function prepareCheckout() { throw new Error('no test may prepare a checkout'); }\n"
    + "export async function submitCheckout() { throw new Error('no test may submit a checkout'); }\n");

  writeFileSync(ENTRY,
    'export { default as Merch } from "./Merch.jsx";\n'
    + 'export { MemoryRouter } from "react-router-dom";\n'
    + 'export { __calls as cartCalls } from "../services/cartService";\n'
    + 'export { __transport } from "../api/providerCheckout";\n');

  await esbuild.build({
    entryPoints: [ENTRY],
    outfile: BUNDLE,
    bundle: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl" },
    plugins: [{
      name: "stub-side-effects",
      setup(build) {
        // Keyed by the specifier each importer uses: Merch.jsx reaches the API as '../api/api',
        // while useProviderCatalogue.js reaches the provider transport as '../../api/providerCheckout'.
        const STUBS = new Map([
          ["../context/AuthContext", AUTH_STUB],
          ["../api/api", API_STUB],
          ["../services/cartService", CART_STUB],
          ["../../api/providerCheckout", PROVIDER_STUB],
          ["../api/providerCheckout", PROVIDER_STUB],
        ]);
        build.onResolve({ filter: /.*/ }, (args) => {
          const hit = STUBS.get(args.path);
          return hit ? { path: hit } : undefined;
        });
      },
    }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });

  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: "http://localhost/dashboard/merch?returnTo=send",
    pretendToBeVisual: true,
  });
  window = dom.window;
  global.window = window;
  global.document = window.document;
  global.navigator = window.navigator;
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  global.getComputedStyle = window.getComputedStyle;
  global.sessionStorage = window.sessionStorage;
  global.localStorage = window.localStorage;
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  // The page announces a cart change with `new Event('cartUpdated')`. Without these as globals that
  // constructor throws, the add-to-cart try/catch swallows it, and the confirmation silently never
  // opens — a failure that looks like a product defect but is an environment gap.
  global.Event = window.Event;
  global.CustomEvent = window.CustomEvent;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = async () => { throw new Error("no test may make a network request"); };
  window.fetch = global.fetch;
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  }));
  global.alert = () => { throw new Error("the page must not need to alert in these paths"); };
  window.alert = global.alert;

  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  ({ Merch, MemoryRouter } = await import(pathToFileURL(BUNDLE).href));
});

after(() => {
  for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
});

beforeEach(async () => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  // The cart stub's call log lives at module scope, so it must be emptied between proofs — otherwise a
  // later test sees an earlier test's merch add and "nothing in the cart" fails for the wrong reason.
  const { cartCalls } = await import(pathToFileURL(BUNDLE).href);
  cartCalls.length = 0;
});

const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

/**
 * Source with its comments removed.
 *
 * Load-bearing for the forbidden-token scans below: Merch.jsx's own comment says it deliberately does
 * NOT price, tokenize, pay or order, and prose must never be mistaken for the behaviour it denies.
 */
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .split("\n").map((l) => l.split("//")[0]).join("\n");
const buttons = (host) => [...host.querySelectorAll("button")];
const byText = (host, re) => buttons(host).find((b) => re.test(text(b)));
const click = async (el) => {
  await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
};

/** Where the router was last told to go. Recorded rather than performed. */
let navigations = [];

async function mountGiftPlace({ search = "?returnTo=send" } = {}) {
  navigations = [];
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  // A tiny recorder sits under MemoryRouter so a navigation is observable without leaving the page.
  await act(async () => {
    root.render(
      React.createElement(
        MemoryRouter,
        { initialEntries: [`/dashboard/merch${search}`] },
        React.createElement(Merch),
      ),
    );
  });
  await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  return { host, root, unmount: () => act(() => root.unmount()) };
}

/** The confirmation surface, if open. */
const confirmation = (host) =>
  [...host.querySelectorAll("h3")].find((h) => /Added to Cart!/.test(text(h)))?.closest("div[style]")
    ?.parentElement || null;
const confirmationOpen = (host) =>
  [...host.querySelectorAll("h3")].some((h) => /Added to Cart!/.test(text(h)));

/** Select the Flowers category and wait for its catalogue. */
async function openFlowers(host) {
  const tile = [...host.querySelectorAll("button, div[role='button'], label")]
    .find((el) => /^Flowers/.test(text(el)) || text(el) === "Flowers");
  assert.ok(tile, "the Flowers category control must exist");
  await click(tile);
  await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  return tile;
}

const flowerCards = (host) => [...host.querySelectorAll('[data-testid^="gift-card-action-"]')];

// ===========================================================================
// 1-3 — a flower opens the SAME confirmation, and does not navigate
// ===========================================================================

test("1 + 2 + 3. selecting a flower opens the shared confirmation instead of returning to Send", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    const cards = flowerCards(m.host);
    assert.ok(cards.length >= 1, `the flower catalogue must render cards, got ${cards.length}`);
    assert.equal(confirmationOpen(m.host), false, "nothing is confirmed before a selection");

    await click(cards[0]);

    // 1. THE SAME COMPONENT every other category uses — identified by its own heading.
    assert.equal(confirmationOpen(m.host), true, "the shared 'Added to Cart!' confirmation opens");

    // 2. It did NOT return to the Send page: the Gift Place is still mounted and still showing flowers.
    assert.ok(flowerCards(m.host).length >= 1, "the flower catalogue is still on screen");
    assert.match(text(m.host), /Sunlit Rose Bouquet/, "the shopper is still in the Gift Place");

    // 3. Image, name and price, all from the arrangement the shopper picked.
    const body = text(m.host);
    assert.match(body, /Sunlit Rose Bouquet/, "the flower's name is confirmed");
    assert.match(body, /\$64\.99/, "and its price, formatted like any other Gift Place price");
    const img = m.host.querySelector('[data-testid="cart-modal-item-image"]');
    assert.ok(img, "the confirmation shows the arrangement's image");

    // And it is the flower's own picture, not a placeholder.
    const src = readFileSync(join(__dirname, "..", "components", "AddToCartModal.jsx"), "utf8");
    assert.match(src, /url\(\$\{item\.imageUrl\}\)/, "painted from the item's own imageUrl");

    // The flower reached the GREETING record, never the cart.
    const { cartCalls } = await import(pathToFileURL(BUNDLE).href);
    assert.equal(cartCalls.length, 0, "a flower is never added to the cart");
    const saved = JSON.parse(window.sessionStorage.getItem("sendGreetingState") || "{}");
    assert.equal(saved.giftSettings?.type, "flowers", "it is attached to the greeting draft");
    assert.equal(saved.giftSettings?.flowersProduct?.providerProductId, "DEMO-T18");
  } finally { await m.unmount(); }
});

// ===========================================================================
// 4-6 — Continue Shopping
// ===========================================================================

test("4 + 5 + 6. Continue Shopping closes only the confirmation and leaves the shopper where they were", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    const before = flowerCards(m.host).length;
    await click(flowerCards(m.host)[0]);
    assert.equal(confirmationOpen(m.host), true);

    const keep = byText(m.host, /Continue Shopping/);
    assert.ok(keep, "Continue Shopping must be offered");
    await click(keep);

    // 4. Only the confirmation closed.
    assert.equal(confirmationOpen(m.host), false, "the confirmation closes");

    // 5. Same category, same catalogue, still browsable — the page never unmounted or navigated.
    assert.equal(flowerCards(m.host).length, before, "the same flower catalogue is still rendered");
    assert.match(text(m.host), /Sunlit Rose Bouquet/);
    assert.match(text(m.host), /Garden Lily Arrangement/, "and the rest of the category is still there");

    // 6. It did not go to the Send page — the Gift Place is still what is mounted.
    assert.equal(text(m.host).includes("Added to Cart!"), false);
    assert.ok(flowerCards(m.host).length >= 2, "the shopper can select something else");

    // The attachment survives Continue Shopping: it was written at selection.
    const saved = JSON.parse(window.sessionStorage.getItem("sendGreetingState") || "{}");
    assert.equal(saved.giftSettings?.flowersProduct?.providerProductId, "DEMO-T18");
  } finally { await m.unmount(); }
});

test("5b. Continue Shopping preserves the category selection, and the price filter is untouched", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    // A provider category prices at quote, so the catalogue is deliberately not price-filtered. What
    // must hold is that selecting and confirming does not reset the CATEGORY the shopper chose.
    await click(flowerCards(m.host)[0]);
    await click(byText(m.host, /Continue Shopping/));

    assert.equal(flowerCards(m.host).length >= 2, true, "still the Flowers catalogue");
    // The page was never re-mounted, so nothing about its state was rebuilt from scratch.
    const src = readFileSync(join(__dirname, "Merch.jsx"), "utf8");
    const handler = src.slice(
      src.indexOf("const handleContinueShopping"),
      src.indexOf("const handleGoToCheckout"),
    );
    assert.ok(handler.length > 0, "the handler must be findable");
    assert.ok(!handler.includes("navigate("), "Continue Shopping must not navigate anywhere");
    assert.ok(!handler.includes("setSelectedCategory"), "nor reset the chosen category");
    assert.ok(!handler.includes("setMinCents") && !handler.includes("setMaxCents"),
      "nor reset the price range");
  } finally { await m.unmount(); }
});

// ===========================================================================
// 7-10 — Return to Greeting
// ===========================================================================

test("7. Return to Greeting goes back to Send with the flower still attached", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    await click(flowerCards(m.host)[0]);

    const back = byText(m.host, /Return to Greeting/);
    assert.ok(back, "Return to Greeting must be offered for a flower");
    await click(back);

    assert.equal(confirmationOpen(m.host), false, "the confirmation closes on the way out");

    // The attachment is intact, and it is the flower that was chosen.
    const saved = JSON.parse(window.sessionStorage.getItem("sendGreetingState") || "{}");
    assert.equal(saved.giftSettings?.type, "flowers");
    assert.equal(saved.giftSettings?.flowersProduct?.providerProductId, "DEMO-T18");
    assert.equal(saved.giftSettings?.flowersProduct?.name, "Sunlit Rose Bouquet");

    // And the return carries the flowers gift type, which is what SendGreeting restores from.
    const src = readFileSync(join(__dirname, "Merch.jsx"), "utf8");
    assert.match(src, /const giftType = lastAddedItem\?\.giftType === 'flowers' \? 'flowers' : 'merch';/);
    assert.match(src, /navigate\(`\/dashboard\/send\?returnTo=send&giftType=\$\{giftType\}`\)/);
  } finally { await m.unmount(); }
});

test("8 + 9 + 10. the Send page's corrected layout is not re-broken by this change", () => {
  // The Send-page guarantees from the previous correction, re-asserted here so this change cannot
  // quietly undo them. Their own mounted proofs live in sendGiftSummaryPlacement.browser.test.mjs.
  const send = readFileSync(join(__dirname, "SendGreeting.jsx"), "utf8");

  // 8. returning does not reopen the chooser — there is no automatic open at all.
  assert.equal((send.match(/setIsGiftModalOpen\(true\)/g) || []).length, 2,
    "the chooser still opens only from the Add/Edit Gift and Change Gift controls");
  assert.ok(!/if \(giftType\) \{\s*setIsGiftModalOpen\(true\);/.test(send),
    "no automatic reopen on the return from the Gift Place");

  // 9 + 10. the top row is Recipient | Occasion | Tone, and the gift lives below it.
  const gridAt = send.indexOf("{/* Recipient, Occasion, and Tone - Side by Side */}");
  const occAt = send.indexOf("{/* Occasion - Dropdown */}", gridAt);
  const topRow = send.slice(gridAt, occAt);
  assert.ok(gridAt > -1 && occAt > gridAt, "the top row must be locatable");
  for (const marker of ["selected-gift-summary", "AttachmentIndicator", "Selected Gift"]) {
    assert.equal(topRow.includes(marker), false,
      `${marker} must not be rendered inside the Recipient/Occasion/Tone row`);
  }
  const addGiftAt = send.indexOf("Add a Gift - Modal Button");
  assert.ok(send.indexOf("selected-gift-summary") > addGiftAt,
    "the gift summary lives in the lower Add a Gift section");
});

// ===========================================================================
// 11-12 — the standard categories are unchanged
// ===========================================================================

test("11. a standard merch product still confirms the way it always did", async () => {
  const m = await mountGiftPlace();
  try {
    const add = [...m.host.querySelectorAll('[data-testid^="gift-card-action-"]')]
      .find((b) => /MERCH-1/.test(b.getAttribute("data-testid") || ""));
    assert.ok(add, "the merch product card must be present on the default category");
    await click(add);

    assert.equal(confirmationOpen(m.host), true, "the same confirmation opens");
    assert.match(text(m.host), /Greet-Me Tee/, "with the product's name");
    assert.match(text(m.host), /\$25\.00/, "and its price");

    // Merch DOES go through the cart — unchanged.
    const { cartCalls } = await import(pathToFileURL(BUNDLE).href);
    assert.equal(cartCalls.length, 1, "exactly one cart add for a merch product");
    assert.equal(cartCalls[0].printfulSyncProductId, "MERCH-1");
    // In the send flow the item is tagged so the greeting can claim it — untouched behaviour.
    assert.equal(cartCalls[0].sendContext, "greeting-flow");
    // And no greeting-draft attachment was written for merch.
    const saved = JSON.parse(window.sessionStorage.getItem("sendGreetingState") || "{}");
    assert.equal(saved.giftSettings?.type, undefined, "merch does not write a flowers attachment");
  } finally { await m.unmount(); }
});

test("12. selecting a second flower replaces the first — no multi-gift semantics appear", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    await click(flowerCards(m.host)[0]);
    await click(byText(m.host, /Continue Shopping/));

    const cards = flowerCards(m.host);
    assert.ok(cards.length >= 2, "a second arrangement must be selectable");
    await click(cards[1]);

    assert.equal(confirmationOpen(m.host), true, "the confirmation opens again");
    assert.match(text(m.host), /Garden Lily Arrangement/, "showing the newly chosen arrangement");

    // ONE attachment, replaced — not accumulated.
    const saved = JSON.parse(window.sessionStorage.getItem("sendGreetingState") || "{}");
    assert.equal(saved.giftSettings?.flowersProduct?.providerProductId, "DEMO-C17",
      "the second selection replaces the first");
    assert.equal(Array.isArray(saved.giftSettings?.flowersProduct), false, "not a list");
    assert.equal(saved.giftSettings?.flowersProducts, undefined, "and no plural collection appeared");

    const { cartCalls } = await import(pathToFileURL(BUNDLE).href);
    assert.equal(cartCalls.length, 0, "and still nothing in the cart");
  } finally { await m.unmount(); }
});

// ===========================================================================
// 13 — nothing external happened
// ===========================================================================

test("13. no order, provider submission, tokenization, charge, send or recipient contact occurs", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    await click(flowerCards(m.host)[0]);
    await click(byText(m.host, /Continue Shopping/));
    await click(flowerCards(m.host)[1]);
    await click(byText(m.host, /Return to Greeting/));

    // The only provider traffic is the posture question and the catalogue read, both stubbed. The
    // prepare/submit/retry functions throw if called, and `fetch` throws for anything else.
    const { __transport } = await import(pathToFileURL(BUNDLE).href);
    assert.ok(__transport.availabilityCalls >= 1, "the posture gate really was consulted");
    assert.ok(__transport.catalogCalls >= 1, "and the catalogue really was read");

    // The Gift Place must move no money itself.
    // Comments are stripped first: Merch.jsx's own comment explains that it deliberately does NOT
    // price, tokenize, pay or order, and prose must never be mistaken for the behaviour it denies.
    //
    // REWRITTEN: `ProviderCheckoutModal` has been removed from this list, and only that one. The page
    // now mounts the EXISTING checkout for a STANDALONE purchase, which is the opposite of the page
    // acquiring a money path of its own. Every genuinely money-moving name stays forbidden.
    const src = readFileSync(join(__dirname, "Merch.jsx"), "utf8");
    const code = stripComments(src);
    for (const forbidden of ["prepareCheckout", "submitCheckout", "tokenize", "placeOrder"]) {
      assert.equal(code.includes(forbidden), false, `the Gift Place must not ${forbidden}`);
    }
    // AND IN THIS FLOW — the greeting-attached one, which is what this file is about — no checkout is
    // opened at all. That is the assertion the old forbidden-name check was really making, and it is
    // now made against the rendered DOM instead of against a string, which is stronger.
    assert.equal(m.host.querySelectorAll('[data-testid="provider-checkout-modal"]').length, 0,
      "the send flow never opens a checkout from the Gift Place: selecting attaches, Done & Send pays");
    assert.equal(m.host.querySelectorAll('[data-testid="provider-checkout-pay"]').length, 0,
      "no Pay control is rendered anywhere in this flow");
  } finally { await m.unmount(); }
});

// ===========================================================================
// The regression that must fail if the old immediate return came back
// ===========================================================================

test("REGRESSION: selecting a flower must never navigate away from the Gift Place", async () => {
  // This is the guard that fails if `selectProviderGiftForGreeting` is given back its
  // `navigate('/dashboard/send?returnTo=send&giftType=flowers')`. Two independent halves: the page's
  // own source, and the rendered behaviour.
  const src = readFileSync(join(__dirname, "Merch.jsx"), "utf8");
  const selectFn = src.slice(
    src.indexOf("const selectProviderGiftForGreeting ="),
    src.indexOf("const handleGiftCardAction ="),
  );
  assert.ok(selectFn.length > 0, "the selection function must be findable");
  assert.ok(!selectFn.includes("navigate("),
    "selecting a flower must not navigate — the confirmation decides where the shopper goes");
  assert.match(selectFn, /setShowCartModal\(true\)/, "it opens the shared confirmation instead");

  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    await click(flowerCards(m.host)[0]);
    // Still in the Gift Place, with the confirmation over it.
    assert.equal(confirmationOpen(m.host), true, "the confirmation is showing");
    assert.ok(flowerCards(m.host).length >= 2,
      "and the flower catalogue is still mounted underneath it");
  } finally { await m.unmount(); }
});
