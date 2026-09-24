// src/pages/merchCanonicalCatalogRouting.browser.test.mjs
//
// TEAM C — "AUTHORIZED CANONICAL CUSTOMER CATALOG CORRECTION" (2026-09-25).
//
// END-TO-END PROOF that the real Merch.jsx page, mounted, consumes GET /api/gifts/catalog as the
// canonical source for View All and every curated category selector, that category routing is
// correct (including multi-category), that Flowers/Gift Baskets no longer independently mirror
// the LIVE uncurated provider feed, and that selecting a curated card still enters the EXISTING
// provider-checkout flow with a LIVE re-verified price — never the curated display price.
//
// Modeled on giftPlaceStandalonePurchase.browser.test.mjs's harness: the real page is bundled and
// mounted; only side-effecting edges (auth, api client, cart, provider transport) are stubbed.
// prepareCheckout/submitCheckout THROW — no test here may price, tokenize, place or charge.
//
// Run (Node 20.x): node --test src/pages/merchCanonicalCatalogRouting.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__mccr.bundle.mjs");
const ENTRY = join(__dirname, ".__mccr.entry.jsx");
const AUTH_STUB = join(__dirname, ".__mccr.auth.js");
const API_STUB = join(__dirname, ".__mccr.api.js");
const CART_STUB = join(__dirname, ".__mccr.cart.js");
const PROVIDER_STUB = join(__dirname, ".__mccr.provider.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, CART_STUB, PROVIDER_STUB];

let React, createRoot, act, Merch, MemoryRouter;

// The Printful-curated merch array — must NEVER appear under View All or Tech once both are
// canonical-catalog-driven. Still used for Brandable Goods, unaffected by this correction.
const MERCH_PRODUCTS = [
  { syncProductId: "MERCH-1", name: "Greet-Me Tee", brandable: true,
    imageUrl: "https://example.test/tee.jpg", variantCount: 1,
    priceCentsMin: 2500, priceCentsMax: 2500,
    variants: [{ syncVariantId: "V1", label: "Medium", priceCents: 2500 }] },
];

// The canonical catalog, exactly as GET /api/gifts/catalog now projects it (toClient() in
// routes/giftCatalogRoutes.js): {id, vendor, title, description, priceCents, currency, images,
// variants, greetMeCategories, source, providerProductId}.
const CURATED_PRODUCTS = [
  {
    id: "gm-goody-charger", vendor: "goody", title: "Portable Charger", description: "A charger.",
    priceCents: 3500, currency: "USD", images: [{ url: "https://example.test/charger.jpg", alt: "" }],
    variants: [], greetMeCategories: ["tech"], source: "goody", providerProductId: "GOODY-CHARGER-1",
  },
  {
    id: "gm-goody-dual", vendor: "goody", title: "Dual Category Gift", description: "",
    priceCents: 2200, currency: "USD", images: [], variants: [],
    greetMeCategories: ["tech", "faith_and_inspiration"], source: "goody", providerProductId: "GOODY-DUAL-1",
  },
  {
    id: "gm-goody-basket", vendor: "goody", title: "Sunrise Gift Basket", description: "",
    priceCents: 5500, currency: "USD", images: [], variants: [],
    greetMeCategories: ["gift_baskets"], source: "goody", providerProductId: "GOODY-BASKET-1",
  },
  {
    id: "gm-florist-bouquet", vendor: "florist_one", title: "Curated Rose Bouquet", description: "",
    priceCents: 5999, currency: "USD", images: [{ url: "https://example.test/bouquet.jpg", alt: "" }],
    variants: [], greetMeCategories: ["flowers"], source: "florist_one", providerProductId: "FO-BOUQUET-1",
  },
];

// The LIVE provider-checkout catalogs — deliberately priced DIFFERENTLY from the curated display
// price above, so a passing "checkout shows the live price" assertion proves the real lookup ran,
// rather than merely echoing the curated card's own number back.
const LIVE_GOODY = [
  { providerProductId: "GOODY-CHARGER-1", name: "Portable Charger (live)", priceMinor: 3499, currency: "USD", imageUrl: "https://example.test/charger-live.jpg" },
  { providerProductId: "GOODY-DUAL-1", name: "Dual Category Gift (live)", priceMinor: 2199, currency: "USD", imageUrl: null },
  { providerProductId: "GOODY-BASKET-1", name: "Sunrise Gift Basket (live)", priceMinor: 5499, currency: "USD", imageUrl: null },
  // An UNCURATED live item — present in the raw provider feed but never chosen in Manage Catalog.
  // It must never reach the Gift Baskets/Tech grid: display is canonical-catalog-only now.
  { providerProductId: "GOODY-UNCURATED-1", name: "Uncurated Live Item", priceMinor: 999, currency: "USD", imageUrl: null },
];
const LIVE_FLORIST_ONE = [
  { providerProductId: "FO-BOUQUET-1", name: "Curated Rose Bouquet (live)", priceMinor: 5899, currency: "USD", imageUrl: "https://example.test/bouquet-live.jpg" },
  { providerProductId: "FO-UNCURATED-1", name: "Uncurated Live Rose", priceMinor: 1999, currency: "USD", imageUrl: null },
];

before(async () => {
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => ({ user: { id: 'u1', email: 'sender@example.com', name: 'Sender' } });\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");

  writeFileSync(API_STUB,
    "const merchProducts = " + JSON.stringify(MERCH_PRODUCTS) + ";\n"
    + "const curatedProducts = " + JSON.stringify(CURATED_PRODUCTS) + ";\n"
    + "async function request(url = '') {\n"
    + "  if (String(url).includes('/api/merch/products')) return { products: merchProducts };\n"
    + "  return {};\n"
    + "}\n"
    + "async function getGiftCatalog() { return { ok: true, products: curatedProducts }; }\n"
    + "async function getSmartCardTiles() { return { ok: false }; }\n"
    + "const noop = async () => ({ data: {} });\n"
    + "export default { request, getGiftCatalog, getSmartCardTiles, get: noop, post: noop, put: noop, delete: noop };\n");

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

  writeFileSync(PROVIDER_STUB,
    "const goody = " + JSON.stringify(LIVE_GOODY) + ";\n"
    + "const floristOne = " + JSON.stringify(LIVE_FLORIST_ONE) + ";\n"
    + "export const __transport = { availabilityCalls: 0, catalogCalls: [], productCalls: 0 };\n"
    + "export async function fetchCheckoutAvailability(giftType) {\n"
    + "  __transport.availabilityCalls += 1;\n"
    + "  return { available: true, purchasable: true };\n"
    + "}\n"
    + "export async function fetchProviderCatalog(giftType) {\n"
    + "  __transport.catalogCalls.push(giftType);\n"
    + "  if (giftType === 'gift_boxes') return { ok: true, products: goody };\n"
    + "  if (giftType === 'flowers') return { ok: true, products: floristOne };\n"
    + "  return { ok: true, products: [] };\n"
    + "}\n"
    + "export async function fetchProviderProducts() { __transport.productCalls += 1; return []; }\n"
    + "export async function fetchTokenizationConfig() { throw new Error('no test may fetch tokenization'); }\n"
    + "export async function retryGiftLink() { throw new Error('no test may retry a gift link'); }\n"
    + "export async function prepareCheckout() { throw new Error('no test may prepare a checkout'); }\n"
    + "export async function submitCheckout() { throw new Error('no test may submit a checkout'); }\n");

  writeFileSync(ENTRY,
    'export { default as Merch } from "./Merch.jsx";\n'
    + 'export { MemoryRouter } from "react-router-dom";\n'
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
  global.window = dom.window;
  global.document = dom.window.document;
  try { global.navigator = dom.window.navigator; } catch { /* already a read-only global on this Node */ }
  global.HTMLElement = dom.window.HTMLElement;
  global.Node = dom.window.Node;
  global.getComputedStyle = dom.window.getComputedStyle;
  global.sessionStorage = dom.window.sessionStorage;
  global.localStorage = dom.window.localStorage;
  global.requestAnimationFrame = (cb) => dom.window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => dom.window.clearTimeout(id);
  global.Event = dom.window.Event;
  global.CustomEvent = dom.window.CustomEvent;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = async () => { throw new Error("no test may make a network request"); };
  dom.window.fetch = global.fetch;
  dom.window.matchMedia = dom.window.matchMedia || ((q) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  }));
  global.alert = () => { throw new Error("the page must not need to alert in these paths"); };
  dom.window.alert = global.alert;
  global.window.__mccrWindow = dom.window;

  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  ({ Merch, MemoryRouter } = await import(pathToFileURL(BUNDLE).href));
});

after(() => {
  for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
});

beforeEach(async () => {
  global.window.sessionStorage.clear();
  global.window.localStorage.clear();
  const { cartCalls } = await import(pathToFileURL(BUNDLE).href);
  cartCalls.length = 0;
});

const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
const click = async (el) => {
  await act(async () => { el.dispatchEvent(new global.window.MouseEvent("click", { bubbles: true })); });
  await act(async () => { await new Promise((r) => global.window.setTimeout(r, 0)); });
};

async function mountGiftPlace() {
  const host = global.window.document.createElement("div");
  global.window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: ["/dashboard/gifts"] },
      React.createElement(Merch),
    ));
  });
  await act(async () => { await new Promise((r) => global.window.setTimeout(r, 0)); });
  return { host, unmount: () => act(() => root.unmount()) };
}

function selectorButton(host, label) {
  return [...host.querySelectorAll("button")].find((b) => text(b) === label || new RegExp(`^${label}`).test(text(b)));
}
async function selectCategory(host, label) {
  const btn = selectorButton(host, label);
  assert.ok(btn, `the "${label}" selector must exist`);
  await click(btn);
}

const cardActions = (host) => [...host.querySelectorAll('[data-testid^="gift-card-action-"]')];
const gridResultsText = (host) => text(host);

// ===========================================================================
// View All — canonical, deduplicated, never the Printful merch array
// ===========================================================================

test("View All shows every canonical curated product, once each, and never the Printful merch array", async () => {
  const m = await mountGiftPlace();
  try {
    await selectCategory(m.host, "View All");
    const body = gridResultsText(m.host);
    for (const title of ["Portable Charger", "Dual Category Gift", "Sunrise Gift Basket", "Curated Rose Bouquet"]) {
      assert.match(body, new RegExp(title), `View All must show "${title}"`);
    }
    assert.doesNotMatch(body, /Greet-Me Tee/, "the Printful-curated merch item must not appear under View All");
    assert.equal(cardActions(m.host).length, 4, "each curated product appears exactly once");
  } finally { await m.unmount(); }
});

// ===========================================================================
// Category routing — Tech, multi-category, Gift Baskets/Flowers curated-only
// ===========================================================================

test("a Goody product tagged only 'tech' appears under Tech, and does not appear under Gift Baskets", async () => {
  const m = await mountGiftPlace();
  try {
    await selectCategory(m.host, "Tech");
    assert.match(gridResultsText(m.host), /Portable Charger/, "the tech-tagged product must appear under Tech");

    await selectCategory(m.host, "Gift Baskets");
    assert.doesNotMatch(gridResultsText(m.host), /Portable Charger/,
      "a product tagged ONLY tech must not remain under Gift Baskets");
  } finally { await m.unmount(); }
});

test("an intentional multi-category product appears under EACH assigned category, once each", async () => {
  const m = await mountGiftPlace();
  try {
    await selectCategory(m.host, "Tech");
    assert.match(gridResultsText(m.host), /Dual Category Gift/, "must appear under Tech");

    await selectCategory(m.host, "Faith & Inspiration");
    assert.match(gridResultsText(m.host), /Dual Category Gift/, "must ALSO appear under Faith & Inspiration");
  } finally { await m.unmount(); }
});

test("Flowers and Gift Baskets show the curated, categorized set — never the raw uncurated live feed", async () => {
  const m = await mountGiftPlace();
  try {
    await selectCategory(m.host, "Gift Baskets");
    assert.match(gridResultsText(m.host), /Sunrise Gift Basket/, "the curated Gift Baskets item must show");
    assert.doesNotMatch(gridResultsText(m.host), /Uncurated Live Item/,
      "an uncurated live Goody product must never populate the Gift Baskets grid");

    await selectCategory(m.host, "Flowers");
    assert.match(gridResultsText(m.host), /Curated Rose Bouquet/, "the curated Flowers item must show");
    assert.doesNotMatch(gridResultsText(m.host), /Uncurated Live Rose/,
      "an uncurated live Florist One product must never populate the Flowers grid");
  } finally { await m.unmount(); }
});

test("Brandable Goods is unaffected — still the Printful merch array, still untouched by the canonical catalog", async () => {
  const m = await mountGiftPlace();
  try {
    // Brandable Goods is the default selection on open.
    assert.match(gridResultsText(m.host), /Greet-Me Tee/, "Brandable Goods must still show the Printful item");
    assert.doesNotMatch(gridResultsText(m.host), /Portable Charger/, "and must not have absorbed curated items");
  } finally { await m.unmount(); }
});

// ===========================================================================
// Checkout preservation — a curated selection resolves to the LIVE provider record, not the
// curated display snapshot, and enters the EXISTING confirmation/checkout flow unmodified.
// ===========================================================================

test("selecting a Tech-tagged curated card opens the shared confirmation with the LIVE price, not the curated display price", async () => {
  const m = await mountGiftPlace();
  try {
    await selectCategory(m.host, "Tech");
    const actions = cardActions(m.host);
    assert.ok(actions.length >= 1);
    const chargerAction = actions.find((el) => /Portable Charger|Add to Cart|Order/.test(text(el.closest("[data-testid]")?.parentElement || el)));
    await click(chargerAction || actions[0]);

    const body = text(m.host);
    assert.match(body, /\$34\.99/, "the confirmation must show the LIVE re-verified price ($34.99), proving the checkout lookup ran");
    assert.doesNotMatch(body, /\$35\.00/, "never the static curated display price");
  } finally { await m.unmount(); }
});

test("a curated card selected outside a greeting offers Go to Checkout — the existing standalone provider purchase flow", async () => {
  const m = await mountGiftPlace();
  try {
    await selectCategory(m.host, "Tech");
    await click(cardActions(m.host)[0]);
    assert.ok(
      [...m.host.querySelectorAll("button")].some((b) => /Go to Checkout/.test(text(b))),
      "Go to Checkout must be offered, exactly as it already is for Flowers"
    );
  } finally { await m.unmount(); }
});

// ===========================================================================
// Special noncatalog experiences stay separate
// ===========================================================================

test("Gift Cards / Smart Card stays its own separate experience, untouched by the canonical catalog", async () => {
  const m = await mountGiftPlace();
  try {
    await selectCategory(m.host, "Gift Cards");
    const body = text(m.host);
    assert.match(body, /Greet-Me Smart eGift Card/);
    assert.doesNotMatch(body, /Portable Charger|Sunrise Gift Basket|Curated Rose Bouquet/,
      "no canonical curated product may leak into the Gift Cards / Smart Card panel");
  } finally { await m.unmount(); }
});
