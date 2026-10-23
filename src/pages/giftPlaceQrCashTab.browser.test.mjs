// src/pages/giftPlaceQrCashTab.browser.test.mjs
//
// Gift Place, founder 2026-10-22: QR Cash is a tab. It opens an amount screen in place of the products: nothing chosen
// at first, presets $10/$25/$50/$100, an empty custom field, the fee and total before confirming, Cancel back to the
// category, and Add to Greet-Me attaching the amount to a greeting (the one being written, or a new one). Nothing here
// charges, orders or sends: the harness's money-moving calls THROW.
//
// Run (Node 20.x):
//   node --test src/pages/giftPlaceQrCashTab.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gpqr.bundle.mjs");
const ENTRY = join(__dirname, ".__gpqr.entry.jsx");
const AUTH_STUB = join(__dirname, ".__gpqr.auth.js");
const API_STUB = join(__dirname, ".__gpqr.api.js");
const CART_STUB = join(__dirname, ".__gpqr.cart.js");
const PROVIDER_STUB = join(__dirname, ".__gpqr.provider.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, CART_STUB, PROVIDER_STUB];

let React, createRoot, act, Merch, MemoryRouter, useLocation, window;

const BOXES = [
  { providerProductId: "BOX-PLAIN", name: "Cookie Box", priceMinor: 3699, currency: "USD", imageUrl: "https://example.test/box.jpg" },
  // the provider REQUIRES a choice of option: the catalog flags it (requiresOptions: true, BE 519928c)
  { providerProductId: "BOX-REQ", name: "Speaker", priceMinor: 5999, currency: "USD", imageUrl: "https://example.test/speaker.jpg", requiresOptions: true },
  // options are LISTED but none is required: no flag, selectable as today
  { providerProductId: "BOX-LISTED", name: "Charger", priceMinor: 4499, currency: "USD", imageUrl: "https://example.test/charger.jpg",
    variants: [{ id: "blk", name: "Black" }, { id: "wht", name: "White" }] },
];
const FLOWERS = BOXES;

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
    // The canonical catalog exactly as GET /api/gifts/catalog projects it (routes/giftCatalogRoutes.js
    // toClient): the flower fixtures are served as curated Florist One products and resolved to the
    // provider checkout by providerProductId. Smart Card tiles stay dormant ({ ok: false }).
    + "const curated = " + JSON.stringify(FLOWERS.map((f) => ({
      id: "gm-" + f.providerProductId, vendor: "sample", title: f.name, description: "",
      priceCents: f.priceMinor, giftType: "Gifts", occasion: null, currency: f.currency,
      images: f.imageUrl ? [{ url: f.imageUrl, alt: "" }] : [], variants: [],
      greetMeCategories: ["gift_baskets"], source: "sample", providerProductId: f.providerProductId,
    }))) + ";\n"
    + "async function getGiftCatalog() { return { ok: true, products: curated }; }\n"
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

  // The provider TRANSPORT. The catalogue reads are recorded; every MONEY-MOVING call throws, which is
  // what makes "no order was placed" a property of this harness rather than a claim in a comment.
  writeFileSync(PROVIDER_STUB,
    "const flowers = " + JSON.stringify(FLOWERS) + ";\n"
    + "export const __transport = { availabilityCalls: 0, catalogCalls: 0, productCalls: 0 };\n"
    + "export async function fetchCheckoutAvailability(giftType) {\n"
    + "  __transport.availabilityCalls += 1;\n"
    + "  return { available: giftType === 'gift_boxes', purchasable: giftType === 'gift_boxes' };\n"
    + "}\n"
    + "export async function fetchProviderCatalog(giftType) {\n"
    + "  __transport.catalogCalls += 1;\n"
    + "  return giftType === 'gift_boxes' ? { ok: true, products: flowers } : { ok: true, products: [] };\n"
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
  try { global.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
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
  global.alert = (m) => { alerts.push(String(m)); };
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



const alerts = [];
const qr = (host, id) => host.querySelector(`[data-testid="${id}"]`);
const setInput = async (el, value) => {
  const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  await act(async () => { set.call(el, value); el.dispatchEvent(new window.Event("input", { bubbles: true })); });
};
const blur = async (el) => { await act(async () => { el.dispatchEvent(new window.FocusEvent("focusout", { bubbles: true })); el.dispatchEvent(new window.FocusEvent("blur")); }); };
const kept = () => JSON.parse(window.sessionStorage.getItem("sendGreetingState") || "null");

test("the QR Cash tab sits in the one selector row, beside Gift Cards; there is no separate Send QR Cash button", async () => {
  const m = await mountGiftPlace();
  try {
    const labels = [...m.host.querySelectorAll('[data-testid="gift-place-tabs"] button')].map((b) => text(b));
    assert.equal(labels[labels.indexOf("Gift Cards") + 1], "QR Cash™");
    assert.equal(/Send QR Cash/.test(text(m.host)), false);
  } finally { await m.unmount(); }
});

test("opening it: no amount chosen, Add disabled, the custom field empty, the fee and total not yet shown", async () => {
  const m = await mountGiftPlace();
  try {
    await click(qr(m.host, "gift-place-qrcash-tab"));
    assert.ok(qr(m.host, "qrcash-panel"));
    assert.equal(qr(m.host, "gift-grid"), null, "the amount screen replaces the products");
    assert.deepEqual([...m.host.querySelectorAll('[role="radio"]')].map((r) => [text(r), r.getAttribute("aria-checked")]),
      [["$10", "false"], ["$25", "false"], ["$50", "false"], ["$100", "false"]]);
    assert.equal(qr(m.host, "qrcash-custom").value, "");
    assert.equal(qr(m.host, "qrcash-add").disabled, true);
    assert.ok(qr(m.host, "qrcash-summary-empty"));
  } finally { await m.unmount(); }
});

test("a preset shows the existing fee and the full total; a custom amount replaces it; outside the limits is refused", async () => {
  const m = await mountGiftPlace();
  try {
    await click(qr(m.host, "gift-place-qrcash-tab"));
    await click(qr(m.host, "qrcash-preset-25"));
    assert.equal(text(qr(m.host, "qrcash-amount")), "$25.00");
    assert.equal(text(qr(m.host, "qrcash-fee")), "$2.74", "$1.99 + 3% (the backend's calcGiftFees, mirrored)");
    assert.equal(text(qr(m.host, "qrcash-total")), "$27.74");
    assert.equal(qr(m.host, "qrcash-add").disabled, false);
    await setInput(qr(m.host, "qrcash-custom"), "40");
    assert.equal(qr(m.host, "qrcash-preset-25").getAttribute("aria-checked"), "false", "typing an amount clears the preset");
    assert.equal(text(qr(m.host, "qrcash-total")), "$43.19");
    await setInput(qr(m.host, "qrcash-custom"), "3"); await blur(qr(m.host, "qrcash-custom"));
    assert.equal(qr(m.host, "qrcash-add").disabled, true);
    assert.equal(text(qr(m.host, "qrcash-amount-error")), "The smallest QR Cash gift is $5.");
    await setInput(qr(m.host, "qrcash-custom"), "101"); await blur(qr(m.host, "qrcash-custom"));
    assert.equal(text(qr(m.host, "qrcash-amount-error")), "The largest QR Cash gift is $100.");
    await setInput(qr(m.host, "qrcash-custom"), "12.5");
    assert.equal(qr(m.host, "qrcash-custom").value, "125", "only whole dollars can be typed");
  } finally { await m.unmount(); }
});

test("Cancel returns to the category that was showing, and nothing is saved", async () => {
  window.sessionStorage.removeItem("sendGreetingState");
  const m = await mountGiftPlace();
  try {
    const giftBaskets = [...m.host.querySelectorAll('[data-testid="gift-place-tabs"] button')].find((b) => text(b) === "Gift Baskets");
    await click(giftBaskets);
    await click(qr(m.host, "gift-place-qrcash-tab"));
    await click(qr(m.host, "qrcash-preset-50"));
    await click(qr(m.host, "qrcash-cancel"));
    assert.equal(qr(m.host, "qrcash-panel"), null);
    assert.equal(giftBaskets.getAttribute("aria-pressed"), "true");
    assert.equal(kept(), null, "Cancel saves nothing");
    assert.deepEqual(navigations, [], "and goes nowhere");
  } finally { await m.unmount(); }
});

test("no greeting yet: Add to Greet-Me opens the greeting flow with that amount already chosen (nothing charged)", async () => {
  window.sessionStorage.removeItem("sendGreetingState");
  const m = await mountGiftPlace();
  try {
    await click(qr(m.host, "gift-place-qrcash-tab"));
    await setInput(qr(m.host, "qrcash-custom"), "40");
    await click(qr(m.host, "qrcash-add"));
    assert.deepEqual(kept(), { giftSettings: { amount: 0, customAmount: "40", maxSpend: 50, autoGift: false, type: "qrcash" } });
    assert.equal(navigations.at(-1), "/dashboard/send?returnTo=send");
  } finally { await m.unmount(); }
});

test("from a greeting: its recipient, occasion, words, photos and context are kept; only the gift becomes QR Cash; the existing return is used", async () => {
  const greeting = {
    formData: { contactId: "c2", occasionType: "Birthday", customMessage: "Happy birthday, Mom!" },
    giftSettings: { type: "none", amount: 25, customAmount: "", maxSpend: 75, autoGift: false },
    memoryPhotos: ["data:image/png;base64,AA=="], useMemoryPhotos: true, excludedMemoryPhotos: [],
    giftContext: { recipientName: "Margaret", label: "Birthday", timing: "Send now", entry: "k1" },
  };
  window.sessionStorage.setItem("sendGreetingState", JSON.stringify(greeting));
  const m = await mountGiftPlace({ search: "?returnTo=send&giftType=marketplace" });
  try {
    assert.equal(text(m.host.querySelector('[data-testid="gift-place-greeting-context"]')), "for Margaret · Birthday · Send now");
    await click(qr(m.host, "gift-place-qrcash-tab"));
    await click(qr(m.host, "qrcash-preset-50"));
    await click(qr(m.host, "qrcash-add"));
    assert.deepEqual(kept(), { ...greeting, giftSettings: { ...greeting.giftSettings, type: "qrcash", amount: 50, customAmount: "" } });
    assert.equal(navigations.at(-1), "/dashboard/send?returnTo=send", "the existing return (Report 135: in place when the visit carried an entry)");
  } finally { await m.unmount(); window.sessionStorage.removeItem("sendGreetingState"); }
});

test("from a recipient's settings: QR Cash is set in their Occasion Scheduler, so the amount screen says so and offers no Add", async () => {
  const m = await mountGiftPlace({ search: "?returnRecipientId=c2" });
  try {
    await click(qr(m.host, "gift-place-qrcash-tab"));
    assert.ok(qr(m.host, "qrcash-recipient-note"));
    assert.equal(qr(m.host, "qrcash-add"), null);
  } finally { await m.unmount(); }
});

test("the amount screen says plainly it joins a Greet-Me sent now, and where scheduled QR Cash lives", async () => {
  const m = await mountGiftPlace();
  try {
    await click(qr(m.host, "gift-place-qrcash-tab"));
    assert.equal(text(qr(m.host, "qrcash-send-now-note")),
      "Send Now: QR Cash chosen here goes with a Greet-Me you send now. For a scheduled Greet-Me, set QR Cash in that person’s Occasion Scheduler.");
  } finally { await m.unmount(); }
});

test("a greeting that is not sent now is never switched to Send Now: the amount screen points to the Occasion Scheduler and offers no Add", async () => {
  window.sessionStorage.setItem("sendGreetingState", JSON.stringify({
    formData: { contactId: "c2", occasionType: "Birthday" },
    giftSettings: { type: "none", amount: 25, customAmount: "", maxSpend: 50, autoGift: false },
    giftContext: { recipientName: "Margaret", label: "Birthday", timing: "On Mar 3" },
  }));
  const m = await mountGiftPlace({ search: "?returnTo=send&giftType=marketplace" });
  try {
    await click(qr(m.host, "gift-place-qrcash-tab"));
    assert.ok(qr(m.host, "qrcash-recipient-note"));
    assert.equal(qr(m.host, "qrcash-add"), null);
    assert.equal(JSON.parse(window.sessionStorage.getItem("sendGreetingState")).giftSettings.type, "none", "nothing changed");
  } finally { await m.unmount(); window.sessionStorage.removeItem("sendGreetingState"); }
});
