// src/pages/giftPlaceStandalonePurchase.browser.test.mjs
//
// BUYING A FLOWER WITH NO GREET-ME — the standalone Gift Place purchase.
//
// THE DEFECT. Outside a greeting the flower cards were dead. The catalogue loaded, the grid rendered,
// prices rendered, the button was enabled and fired its handler — and the handler returned:
//
//     if (!cameFromSendGreeting) return;
//
// That guard was not a mistake. The only checkout the Gift Place knew about was the cart's, and a
// flower cannot ride it: the cart and Checkout.jsx key on `printfulSyncVariantId`. So the missing piece
// was a checkout, never a cart entry.
//
// THE CORRECTION. A flower chosen outside a greeting opens the SAME "Added to Cart!" confirmation every
// other category opens — the founder's uniform selection rule, confirmation FIRST — and its Go to
// Checkout opens the EXISTING `ProviderCheckoutModal` with its greeting arguments left off. No second
// checkout, no flower-shaped copy of one, no parallel cart.
//
// WHAT THE ABSENCES MEAN, because they are the safety properties and not omissions:
//   * no `contactId`  -> the backend stores null, and the send-time binding refuses a gift whose
//                        contactId is absent. The order is structurally unattachable to any greeting.
//   * no `onAccepted` -> the checkout shows its OWN terminal confirmation (provider order number +
//                        Done) instead of handing off to a greeting dispatch. No greeting is created.
//   * no sessionStorage write, no cartService call, no navigation.
//
// A NOTE ON WHAT IS ASSERTED WHERE. React props are not readable from the DOM, so "no contactId" and
// "no onAccepted" are asserted at the point they are actually decided — the element in Merch.jsx — with
// comments stripped first, so the file's own prose about what it does not do can never be mistaken for
// the behaviour it denies. Everything observable is asserted from the mounted DOM instead.
//
// The real Merch page is bundled and mounted. Only its side-effecting edges are stubbed: auth, the API
// client, the cart, the provider transport. The real `useProviderCatalogue` runs on that transport, so
// the posture gate is the real one. `prepareCheckout` and `submitCheckout` THROW in this file — no test
// may price, tokenize, place or charge anything, and the throw is what enforces it.
//
// Run (Node 20.x):
//   node --test src/pages/giftPlaceStandalonePurchase.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gpsp.bundle.mjs");
const ENTRY = join(__dirname, ".__gpsp.entry.jsx");
const AUTH_STUB = join(__dirname, ".__gpsp.auth.js");
const API_STUB = join(__dirname, ".__gpsp.api.js");
const CART_STUB = join(__dirname, ".__gpsp.cart.js");
const PROVIDER_STUB = join(__dirname, ".__gpsp.provider.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, CART_STUB, PROVIDER_STUB];

let React, createRoot, act, Merch, MemoryRouter, useLocation, window;

const FLOWERS = [
  { providerProductId: "DEMO-T18", name: "Sunlit Rose Bouquet", priceMinor: 6499, currency: "USD",
    imageUrl: "https://example.test/demo-rose.jpg" },
  { providerProductId: "DEMO-C17", name: "Garden Lily Arrangement", priceMinor: 7999, currency: "USD",
    imageUrl: "https://example.test/demo-lily.jpg" },
];

const MERCH_PRODUCTS = [
  { syncProductId: "MERCH-1", name: "Greet-Me Tee", brandable: true,
    imageUrl: "https://example.test/demo-tee.jpg", variantCount: 1,
    priceCentsMin: 2500, priceCentsMax: 2500,
    variants: [{ syncVariantId: "V1", label: "Medium", priceCents: 2500 }] },
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

  // The provider TRANSPORT. The catalogue reads are recorded; every MONEY-MOVING call throws, which is
  // what makes "no order was placed" a property of this harness rather than a claim in a comment.
  writeFileSync(PROVIDER_STUB,
    "const flowers = " + JSON.stringify(FLOWERS) + ";\n"
    + "export const __transport = { availabilityCalls: 0, catalogCalls: 0, productCalls: 0 };\n"
    + "export async function fetchCheckoutAvailability(giftType) {\n"
    + "  __transport.availabilityCalls += 1;\n"
    + "  return { available: giftType === 'flowers', purchasable: giftType === 'flowers' };\n"
    + "}\n"
    + "export async function fetchProviderCatalog(giftType) {\n"
    + "  __transport.catalogCalls += 1;\n"
    + "  return giftType === 'flowers' ? { ok: true, products: flowers } : { ok: true, products: [] };\n"
    + "}\n"
    // Imported by ProviderCheckoutModal. It is only called at the PRODUCT step, which a checkout
    // opened with a product in hand never reaches; the counter proves that.
    + "export async function fetchProviderProducts() { __transport.productCalls += 1; return flowers; }\n"
    + "export async function fetchTokenizationConfig() { throw new Error('no test may fetch tokenization'); }\n"
    + "export async function retryGiftLink() { throw new Error('no test may retry a gift link'); }\n"
    + "export async function prepareCheckout() { throw new Error('no test may prepare a checkout'); }\n"
    + "export async function submitCheckout() { throw new Error('no test may submit a checkout'); }\n");

  writeFileSync(ENTRY,
    'export { default as Merch } from "./Merch.jsx";\n'
    + 'export { MemoryRouter, useLocation } from "react-router-dom";\n'
    + 'export { __calls as cartCalls } from "../services/cartService";\n'
    + 'export { __transport } from "../api/providerCheckout";\n');

  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{
      name: "stub-side-effects",
      setup(build) {
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
    url: "http://localhost/dashboard/gifts",
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
  ({ Merch, MemoryRouter, useLocation } = await import(pathToFileURL(BUNDLE).href));
});

after(() => {
  for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
});

beforeEach(async () => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  const { cartCalls } = await import(pathToFileURL(BUNDLE).href);
  cartCalls.length = 0;
});

const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
const buttons = (host) => [...host.querySelectorAll("button")];
const byText = (host, re) => buttons(host).find((b) => re.test(text(b)));
const click = async (el) => {
  await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
};

/** Source with comments removed — prose must never satisfy a behavioural assertion. */
const stripComments = (s) => s
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ")
  .split("\n").map((l) => l.split("//")[0]).join("\n");

const MERCH_SRC = stripComments(readFileSync(join(__dirname, "Merch.jsx"), "utf8"));
const MODAL_SRC = stripComments(
  readFileSync(join(__dirname, "..", "components", "providerCheckout", "ProviderCheckoutModal.jsx"), "utf8"));

/** The JSX element that mounts the provider checkout inside the Gift Place. */
function providerCheckoutElement() {
  const at = MERCH_SRC.indexOf("<ProviderCheckoutModal");
  assert.notEqual(at, -1, "Merch.jsx must mount the existing ProviderCheckoutModal");
  const end = MERCH_SRC.indexOf("/>", at);
  assert.notEqual(end, -1, "the ProviderCheckoutModal element must be self-closing");
  return MERCH_SRC.slice(at, end + 2);
}

const confirmationOpen = (host) =>
  [...host.querySelectorAll("h3")].some((h) => /Added to Cart!/.test(text(h)));
const checkoutOpen = (host) => !!host.querySelector('[data-testid="provider-checkout-modal"]');

/**
 * Where the router was actually told to go.
 *
 * RECORDED, NOT PERFORMED, and observed through the REAL router rather than by stubbing `navigate`:
 * a probe under the same MemoryRouter reports every location change. That means "it did not navigate"
 * is a fact about the router's state, not about a spy the page might have bypassed.
 */
let navigations = [];

function LocationProbe() {
  const loc = useLocation();
  const seen = `${loc.pathname}${loc.search}`;
  React.useEffect(() => { navigations.push(seen); }, [seen]);
  return null;
}

async function mountGiftPlace({ search = "" } = {}) {
  navigations = [];
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: [`/dashboard/gifts${search}`] },
      React.createElement(Merch),
      React.createElement(LocationProbe),
    ));
  });
  await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  // The initial location is not a navigation. Cleared here so every assertion below counts only what
  // the shopper's own actions caused.
  navigations = [];
  return { host, root, unmount: () => act(() => root.unmount()) };
}

async function openFlowers(host) {
  const tile = [...host.querySelectorAll("button, div[role='button'], label")]
    .find((el) => /^Flowers/.test(text(el)) || text(el) === "Flowers");
  assert.ok(tile, "the Flowers category control must exist");
  await click(tile);
  await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  return tile;
}

const flowerActions = (host) => [...host.querySelectorAll('[data-testid^="gift-card-action-"]')];

// ===========================================================================
// 1-5 — the direct selection, and what the confirmation offers
// ===========================================================================

test("1 + 2. a direct flower button RESPONDS, and opens the uniform confirmation first", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    const cards = flowerActions(m.host);
    assert.ok(cards.length >= 1, `the flower catalogue must render cards, got ${cards.length}`);
    assert.equal(cards[0].disabled, false, "the button was never disabled — it was the handler that returned");
    assert.equal(confirmationOpen(m.host), false, "nothing is confirmed before a selection");

    await click(cards[0]);

    // 1. IT RESPONDS. This is the assertion the old early return failed.
    // 2. AND THE CONFIRMATION COMES FIRST — not the checkout.
    assert.equal(confirmationOpen(m.host), true,
      "a direct flower selection must open the shared 'Added to Cart!' confirmation");
    assert.equal(checkoutOpen(m.host), false,
      "the checkout must NOT open from the product-card click — the confirmation decides");
  } finally { await m.unmount(); }
});

test("3. the confirmation shows the arrangement's complete image, name and price", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    await click(flowerActions(m.host)[0]);

    const body = text(m.host);
    assert.match(body, /Sunlit Rose Bouquet/, "the flower's name is confirmed");
    assert.match(body, /\$64\.99/, "and its price, formatted like every other Gift Place price");

    const img = m.host.querySelector('[data-testid="cart-modal-item-image"]');
    assert.ok(img, "the confirmation shows the arrangement's image");
    assert.match(img.style.backgroundImage, /demo-rose\.jpg/, "and it is this flower's own picture");
    // COMPLETE, not cropped — the image-fit correction, holding on this surface too.
    assert.equal(img.style.backgroundSize, "contain", "the whole arrangement is shown, not a crop of it");
  } finally { await m.unmount(); }
});

test("4 + 5. the direct confirmation offers Continue Shopping and Go to Checkout, and NOT Return to Greeting",
  async () => {
    const m = await mountGiftPlace();
    try {
      await openFlowers(m.host);
      await click(flowerActions(m.host)[0]);

      assert.ok(byText(m.host, /Continue Shopping/), "Continue Shopping is offered");
      assert.ok(byText(m.host, /Go to Checkout/), "Go to Checkout is offered outside a greeting");
      // 5. THE ONE THING THAT MUST NOT BE THERE. There is no greeting to return to, so offering it
      // would strand the shopper. This is the clause that previously keyed on the flower alone.
      assert.equal(byText(m.host, /Return to Greeting/), undefined,
        "Return to Greeting must not appear when the shopper did not come from a greeting");
      assert.equal(byText(m.host, /Return to Recipient Settings/), undefined,
        "nor the recipient-settings return, with no recipient round trip in play");
    } finally { await m.unmount(); }
  });

// ===========================================================================
// 6 — Continue Shopping leaves the shopper exactly where they were
// ===========================================================================

test("6. Continue Shopping closes only the confirmation and keeps the flower catalogue and its state",
  async () => {
    const m = await mountGiftPlace();
    try {
      const tile = await openFlowers(m.host);
      const before = flowerActions(m.host).map((b) => b.getAttribute("data-testid"));
      await click(flowerActions(m.host)[0]);
      assert.equal(confirmationOpen(m.host), true, "the confirmation opened");

      await click(byText(m.host, /Continue Shopping/));

      assert.equal(confirmationOpen(m.host), false, "only the confirmation closed");
      assert.equal(checkoutOpen(m.host), false, "and no checkout was opened by continuing to shop");
      assert.equal(navigations.length, 0, "nothing navigated, so scroll position is never rebuilt");
      // The SAME catalogue, the same cards, in the same order — the category was not reset.
      assert.deepEqual(flowerActions(m.host).map((b) => b.getAttribute("data-testid")), before,
        "the shopper is still in the same flower catalogue");
      assert.ok(tile.isConnected, "the Flowers category control is still the selected one");

      // AND THEY CAN PICK ANOTHER. The second arrangement confirms just like the first.
      await click(flowerActions(m.host)[1]);
      assert.equal(confirmationOpen(m.host), true, "a second selection confirms too");
      assert.match(text(m.host), /Garden Lily Arrangement/, "and it is the newly chosen arrangement");
    } finally { await m.unmount(); }
  });

test("6b. the page never unmounts across the whole select / continue / select cycle", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    const grid = m.host.querySelector('[data-testid="gift-grid"]');
    assert.ok(grid, "the grid rendered");
    await click(flowerActions(m.host)[0]);
    await click(byText(m.host, /Continue Shopping/));
    // The SAME DOM node. A remount is what would discard scroll position, and it does not happen.
    assert.ok(grid.isConnected, "the very same grid node is still in the document");
    assert.equal(m.host.querySelector('[data-testid="gift-grid"]'), grid, "and it was never replaced");
  } finally { await m.unmount(); }
});

// ===========================================================================
// 7 — Go to Checkout opens the EXISTING provider checkout
// ===========================================================================

test("7. Go to Checkout opens ProviderCheckoutModal, at its details step, and never the cart", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    await click(flowerActions(m.host)[0]);
    await click(byText(m.host, /Go to Checkout/));

    assert.equal(checkoutOpen(m.host), true, "the existing provider checkout opened");
    assert.equal(confirmationOpen(m.host), false, "and the uniform confirmation closed behind it");

    // NEVER THE PRINTFUL CART. Both the route and the page are wrong for a flower.
    assert.deepEqual(navigations, [], "Go to Checkout must not navigate at all for a flower");

    // THE PRODUCT WAS PASSED THROUGH: with a product in hand the checkout starts at DETAILS. If the
    // product had not been threaded it would have opened its own picker instead.
    assert.ok(m.host.querySelector('[data-testid="provider-checkout-details"]'),
      "the checkout starts at the details step, which only happens when a product was passed");
    assert.equal(m.host.querySelector('[data-testid="provider-checkout-picker"]'), null,
      "so it does not ask the shopper to choose a product again");

    const { __transport } = await import(pathToFileURL(BUNDLE).href);
    assert.equal(__transport.productCalls, 0,
      "and it never fetched its own product list, because it was given one");
  } finally { await m.unmount(); }
});

test("7b. the checkout is closable and closing it returns the shopper to the catalogue, not a new page",
  async () => {
    const m = await mountGiftPlace();
    try {
      await openFlowers(m.host);
      await click(flowerActions(m.host)[0]);
      await click(byText(m.host, /Go to Checkout/));
      assert.equal(checkoutOpen(m.host), true, "the checkout is open");

      const close = m.host.querySelector('[aria-label="Close checkout"]');
      assert.ok(close, "a standalone checkout must be closable — nothing is mid-send behind it");
      await click(close);

      assert.equal(checkoutOpen(m.host), false, "the checkout closed");
      assert.deepEqual(navigations, [], "and closing it navigated nowhere");
      assert.ok(m.host.querySelector('[data-testid="gift-grid"]'), "the catalogue is still there");
    } finally { await m.unmount(); }
  });

// ===========================================================================
// 8-13 — the absences: cart, greeting state, contactId, onAccepted, dispatch, claim
// ===========================================================================

test("8 + 9. a standalone flower never enters the cart and never writes sendGreetingState", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    await click(flowerActions(m.host)[0]);
    await click(byText(m.host, /Go to Checkout/));

    const { cartCalls } = await import(pathToFileURL(BUNDLE).href);
    assert.deepEqual(cartCalls, [], "cartService must never be called for a flower");
    assert.equal(window.sessionStorage.getItem("sendGreetingState"), null,
      "no greeting draft is written — there is no greeting to attach anything to");
    assert.equal(window.sessionStorage.length, 0, "and nothing else was persisted either");
  } finally { await m.unmount(); }
});

test("10 + 11. the standalone checkout is mounted WITHOUT contactId and WITHOUT onAccepted", async () => {
  // React props are not readable from the DOM, so this is asserted where it is decided. Comments are
  // stripped first, so the file's own prose about these omissions cannot satisfy the assertion.
  const el = providerCheckoutElement();

  assert.doesNotMatch(el, /contactId/,
    "no contactId may be passed — its absence is what makes the order unattachable to any greeting");
  assert.doesNotMatch(el, /onAccepted/,
    "no onAccepted may be passed — its absence is what selects the standalone terminal confirmation");

  // And what IS passed, so this is a positive statement about the wiring and not only a denial.
  assert.match(el, /giftType="flowers"/, "the gift type is passed");
  assert.match(el, /product=\{standaloneFlower\}/, "the chosen arrangement is passed");
  assert.match(el, /customer=\{user\}/, "the authenticated customer is passed");

  // The whole file, not just this element: Merch must not learn a greeting binding from anywhere.
  assert.doesNotMatch(MERCH_SRC, /formData\.contactId|contactId:/,
    "the Gift Place has no notion of a greeting recipient at all");
});

test("12. no greeting is created, dispatched or navigated to from a standalone purchase", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    await click(flowerActions(m.host)[0]);
    await click(byText(m.host, /Go to Checkout/));

    // Nothing routed to the send flow, and no handoff surface exists on this page.
    assert.deepEqual(navigations, [], "no navigation of any kind occurred");
    assert.equal(m.host.querySelector('[data-testid="provider-checkout-handoff"]'), null,
      "the embedded greeting handoff must never render here");
    assert.doesNotMatch(text(m.host), /Sending your Greet-Me/,
      "and the shopper is never told a greeting is being sent");
  } finally { await m.unmount(); }
});

test("12b. the Gift Place imports no greeting-dispatch capability whatsoever", async () => {
  // Structural: it cannot send a greeting because it has no way to.
  assert.doesNotMatch(MERCH_SRC, /dispatchFlowerGreeting|sendGreeting\(|from ['"]\.\/SendGreeting/,
    "Merch.jsx must import no greeting dispatch");
  assert.doesNotMatch(MERCH_SRC, /submitCheckout|prepareCheckout|tokenize/,
    "and it performs no pricing, tokenization or submission itself — the checkout owns all of that");
});

test("13. no claim token, QR announcement or greeting claim surface is rendered or linked", async () => {
  const m = await mountGiftPlace();
  try {
    await openFlowers(m.host);
    await click(flowerActions(m.host)[0]);
    await click(byText(m.host, /Go to Checkout/));

    // SCOPED TO THE CHECKOUT, deliberately. The Gift Place catalogue advertises QR Cash™ as its own
    // separate product, and that tile is pre-existing and untouched — finding the words "QR Cash" on
    // the page is not this order announcing anything. What must be clean is the surface this purchase
    // produces.
    const modal = m.host.querySelector('[data-testid="provider-checkout-modal"]');
    assert.ok(modal, "the checkout is open, so there is something to scan");
    assert.doesNotMatch(text(modal), /claim/i, "no claim language on the checkout");
    assert.doesNotMatch(text(modal), /QR/i, "no QR announcement on the checkout");

    // And nowhere on the page is there a route into a claim surface.
    for (const a of [...m.host.querySelectorAll("a[href]")]) {
      assert.doesNotMatch(a.getAttribute("href") || "", /\/gift\/|claim/i,
        "no link to a gift claim surface");
    }
    assert.equal(m.host.innerHTML.includes("giftClaimToken"), false, "no token is embedded in the DOM");

    // The page cannot render one, because neither file it depends on for this flow handles one.
    assert.doesNotMatch(MERCH_SRC, /giftClaimToken|claimToken/, "Merch.jsx handles no claim token");
    assert.doesNotMatch(MODAL_SRC, /giftClaimToken/,
      "and the checkout never reads the claim token the API returns, so it cannot display or link it");
  } finally { await m.unmount(); }
});

// ===========================================================================
// 14 — the terminal confirmation
// ===========================================================================

test("14. the standalone terminal confirmation is the provider order number and Done", async () => {
  // HONEST LIMIT. Reaching this state live requires a provider-ACCEPTED order, which this packet
  // forbids and which `submitCheckout` throws to guarantee. So the branch is asserted structurally:
  // with no `onAccepted` (proved in test 10+11) `handedOffAccepted` is false by construction, and this
  // is the branch that false selects.
  assert.match(MODAL_SRC, /step === 'confirmation' && !handedOffAccepted/,
    "the non-embedded confirmation branch must exist");

  const at = MODAL_SRC.indexOf("step === 'confirmation' && !handedOffAccepted");
  const branch = MODAL_SRC.slice(at, at + 1600);
  assert.match(branch, /data-testid="provider-order-number"/,
    "it shows the provider's own order number");
  assert.match(branch, /result\.providerOrderId/, "read from the accepted result");
  assert.match(branch, /data-testid="provider-checkout-done"/, "and a Done action");
  assert.match(branch, /onClick=\{onClose\}/, "whose Done simply closes the checkout");
  // The handoff branch is the OTHER one, and is reachable only with onAccepted.
  assert.match(MODAL_SRC, /const handedOffAccepted = Boolean\(onAccepted\)/,
    "handoff is gated on onAccepted, which the Gift Place does not pass");
});

// ===========================================================================
// 15 — the greeting-attached path is unchanged
// ===========================================================================

test("15. inside a greeting the flower still says Select Gift and still returns to the greeting",
  async () => {
    const m = await mountGiftPlace({ search: "?returnTo=send" });
    try {
      await openFlowers(m.host);
      const card = flowerActions(m.host)[0];
      assert.match(text(card), /Select Gift|Select/, "the greeting label is unchanged");

      await click(card);
      assert.equal(confirmationOpen(m.host), true, "the same uniform confirmation opens");

      // The greeting affordances, exactly as before.
      assert.ok(byText(m.host, /Continue Shopping/), "Continue Shopping is offered");
      assert.ok(byText(m.host, /Return to Greeting/), "Return to Greeting IS offered inside a greeting");
      assert.equal(byText(m.host, /Go to Checkout/), undefined,
        "and Go to Checkout stays suppressed in the send flow");

      // THE ATTACHMENT IS STILL WRITTEN, to the same key, with the same shape.
      const saved = JSON.parse(window.sessionStorage.getItem("sendGreetingState") || "{}");
      assert.equal(saved.giftSettings?.type, "flowers", "the greeting draft still records the type");
      assert.equal(saved.giftSettings?.flowersProduct?.providerProductId, "DEMO-T18",
        "and the chosen arrangement");

      // And it still goes back to the greeting rather than a checkout.
      await click(byText(m.host, /Return to Greeting/));
      assert.deepEqual(navigations, ["/dashboard/send?returnTo=send&giftType=flowers"],
        "Return to Greeting carries giftType=flowers, unchanged");
      assert.equal(checkoutOpen(m.host), false, "no checkout is opened from the greeting path");
    } finally { await m.unmount(); }
  });

test("15b. inside a greeting the flower does not reach the cart either", async () => {
  const m = await mountGiftPlace({ search: "?returnTo=send" });
  try {
    await openFlowers(m.host);
    await click(flowerActions(m.host)[0]);
    const { cartCalls } = await import(pathToFileURL(BUNDLE).href);
    assert.deepEqual(cartCalls, [], "a flower is never a cart line, in either context");
  } finally { await m.unmount(); }
});

// ===========================================================================
// 16 — merchandise is untouched, in both contexts
// ===========================================================================

test("16. merchandise still adds to the cart and still goes to the cart at checkout", async () => {
  const m = await mountGiftPlace();
  try {
    // The Gift Place opens on Brandable Goods, so the merch card is already on screen.
    const merchBtn = flowerActions(m.host).find((b) =>
      /MERCH-1/.test(b.getAttribute("data-testid") || ""));
    assert.ok(merchBtn, "the merch card must render on the default category");
    assert.match(text(merchBtn), /Add to Cart|Add/, "and merch still says Add to Cart outside a greeting");

    await click(merchBtn);
    assert.equal(confirmationOpen(m.host), true, "merch confirms the same way");

    const { cartCalls } = await import(pathToFileURL(BUNDLE).href);
    assert.equal(cartCalls.length, 1, "merch DID reach the cart");
    assert.equal(cartCalls[0].printfulSyncVariantId, "V1", "as a Printful cart line");
    assert.equal(cartCalls[0].sendContext, undefined,
      "and untagged, because a storefront visit is not a greeting");

    // ITS CHECKOUT STILL GOES TO THE CART. This is the regression the standalone branch must not cause.
    await click(byText(m.host, /Go to Checkout/));
    assert.deepEqual(navigations, ["/dashboard/cart"], "merch checkout still routes to the cart");
    assert.equal(checkoutOpen(m.host), false, "and never opens the provider checkout");
  } finally { await m.unmount(); }
});

test("16b. a flower chosen, then merch chosen, releases the arrangement — the cart route is restored",
  async () => {
    // The ordering hazard: if the held arrangement were not released, a merch confirmation's
    // Go to Checkout would open the provider's checkout instead of the cart.
    const m = await mountGiftPlace();
    try {
      await openFlowers(m.host);
      await click(flowerActions(m.host)[0]);
      await click(byText(m.host, /Continue Shopping/));

      // Back to Brandable Goods, and add the merch product.
      const tile = [...m.host.querySelectorAll("button, div[role='button'], label")]
        .find((el) => /Brandable/i.test(text(el)));
      assert.ok(tile, "the Brandable Goods control must exist");
      await click(tile);
      const merchBtn = flowerActions(m.host).find((b) =>
        /MERCH-1/.test(b.getAttribute("data-testid") || ""));
      assert.ok(merchBtn, "the merch card renders again");
      await click(merchBtn);

      await click(byText(m.host, /Go to Checkout/));
      assert.deepEqual(navigations, ["/dashboard/cart"],
        "the merch confirmation goes to the cart, not to the flower checkout");
      assert.equal(checkoutOpen(m.host), false, "the provider checkout must not open for merch");
    } finally { await m.unmount(); }
  });

// ===========================================================================
// 17 — the regression guard
// ===========================================================================

test("17. the inactive early return must not come back", async () => {
  // THE EXACT DEFECT. `if (!cameFromSendGreeting) return;` inside the provider branch of the card
  // action is what made every direct flower button dead. Restoring it fails tests 1-14 above; this
  // guard names it so the reason is unmistakable in a failure log.
  const at = MERCH_SRC.indexOf("const handleGiftCardAction");
  assert.notEqual(at, -1, "handleGiftCardAction must exist");
  const fn = MERCH_SRC.slice(at, at + 900);

  assert.doesNotMatch(fn, /!cameFromSendGreeting\s*\)\s*return\s*;/,
    "a direct flower selection must never be silently discarded again");
  // Both situations must be handled, explicitly.
  assert.match(fn, /selectProviderGiftForGreeting\(card\)/, "the greeting path is handled");
  assert.match(fn, /selectProviderGiftStandalone\(card\)/, "and the standalone path is handled");
});

test("17b. the standalone selection writes no greeting state and no cart line, at the source", async () => {
  const at = MERCH_SRC.indexOf("const selectProviderGiftStandalone");
  assert.notEqual(at, -1, "the standalone selection must exist");
  const fn = MERCH_SRC.slice(at, MERCH_SRC.indexOf("const handleGiftCardAction"));
  assert.doesNotMatch(fn, /sessionStorage/, "it must not touch sessionStorage");
  assert.doesNotMatch(fn, /cartService/, "it must not touch the cart");
  assert.doesNotMatch(fn, /navigate\(/, "it must not navigate");
  assert.match(fn, /setShowCartModal\(true\)/, "it opens the uniform confirmation");
});
