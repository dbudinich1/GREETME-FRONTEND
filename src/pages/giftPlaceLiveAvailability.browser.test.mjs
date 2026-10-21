// src/pages/giftPlaceLiveAvailability.browser.test.mjs
//
// Gift Place live availability (founder-approved 2026-10-21). A stored (curated) card is resolved to the provider's LIVE
// product when chosen. It used to fail open (selectable at display, refused at checkout). Now:
//   * while the live list loads: visible, unselectable, "Checking availability…";
//   * if the live list could not be read: visible, unselectable, "Availability unavailable. Try again." with a WORKING
//     retry (the "Try again." itself) that re-reads the live list and makes the card selectable when it arrives;
//   * the grid never hides a card or changes its slot (no reflow).
// Harness: giftPlaceRequiredOptions.browser.test.mjs, with a controllable provider transport. Money-moving calls THROW.
//
// Run (Node 20.x): node --test src/pages/giftPlaceLiveAvailability.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gplive.bundle.mjs");
const ENTRY = join(__dirname, ".__gplive.entry.jsx");
const AUTH_STUB = join(__dirname, ".__gplive.auth.js");
const API_STUB = join(__dirname, ".__gplive.api.js");
const CART_STUB = join(__dirname, ".__gplive.cart.js");
const PROVIDER_STUB = join(__dirname, ".__gplive.provider.js");
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
      greetMeCategories: ["gift_baskets"], source: "goody", providerProductId: f.providerProductId,
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

  // The provider TRANSPORT, controllable per test: globalThis.__liveMode = "ok" | "fail" | "pending". "pending" holds the
  // catalogue read until globalThis.__releaseLive() is called. Every MONEY-MOVING call throws.
  writeFileSync(PROVIDER_STUB, [
    "const flowers = " + JSON.stringify(FLOWERS) + ";",
    "export const __transport = { availabilityCalls: 0, catalogCalls: 0, productCalls: 0 };",
    "export async function fetchCheckoutAvailability(giftType) {",
    "  __transport.availabilityCalls += 1;",
    "  return { available: giftType === 'gift_boxes', purchasable: giftType === 'gift_boxes' };",
    "}",
    "export async function fetchProviderCatalog(giftType) {",
    "  __transport.catalogCalls += 1;",
    "  if (giftType !== 'gift_boxes') return { ok: true, products: [] };",
    "  const mode = globalThis.__liveMode || 'ok';",
    "  if (mode === 'fail') return { ok: false, products: [] };",
    // The real transport answers a 503 as { ok: true, products: [], unavailable: true } (see api/providerCheckout.js).
    "  if (mode === 'unavailable') return { ok: true, products: [], unavailable: true };",
    "  if (mode === 'pending') await new Promise((r) => { globalThis.__releaseLive = r; });",
    "  return { ok: true, products: flowers };",
    "}",
    "export async function fetchProviderProducts() { __transport.productCalls += 1; return flowers; }",
    "export async function fetchTokenizationConfig() { throw new Error('no test may fetch tokenization'); }",
    "export async function retryGiftLink() { throw new Error('no test may retry a gift link'); }",
    "export async function prepareCheckout() { throw new Error('no test may prepare a checkout'); }",
    "export async function submitCheckout() { throw new Error('no test may submit a checkout'); }",
    "",
  ].join(String.fromCharCode(10)));

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
async function openGiftBaskets(host) {
  const tile = [...host.querySelectorAll("button, div[role='button'], label")]
    .find((el) => /^Gift Baskets/.test(text(el)) || text(el) === "Gift Baskets");
  assert.ok(tile, "the Gift Baskets category control must exist");
  await click(tile);
  for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
}
const card = (host, id) => host.querySelector(`[data-testid="gift-card-gm-${id}"]`);
const action = (host, id) => host.querySelector(`[data-testid="gift-card-action-gm-${id}"]`);


const note = (host, id) => card(host, id).querySelector('[data-testid="gift-card-unavailable"]');
const settleAll = async () => { for (let i = 0; i < 6; i += 1) await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); }); };

test("while the live list loads: every card visible, unselectable, 'Checking availability…'; clicking does nothing; then selectable", async () => {
  globalThis.__liveMode = "pending";
  const m = await mountGiftPlace();
  try {
    await openGiftBaskets(m.host);
    for (const id of ["BOX-PLAIN", "BOX-REQ", "BOX-LISTED"]) {
      assert.ok(card(m.host, id), `${id} shown`);
      assert.equal(note(m.host, id).textContent, "Checking availability…", id);
      assert.equal(action(m.host, id).disabled, true, id);
    }
    alerts.length = 0;
    await click(action(m.host, "BOX-PLAIN"));
    assert.equal(confirmationOpen(m.host), false, "nothing is chosen");
    assert.deepEqual(alerts, [], "no 'still loading' alert: the card simply cannot be chosen");
    await act(async () => { globalThis.__releaseLive(); });
    await settleAll();
    assert.equal(note(m.host, "BOX-PLAIN"), null, "the live list confirms it");
    assert.equal(action(m.host, "BOX-PLAIN").disabled, false);
    assert.equal(note(m.host, "BOX-REQ").textContent, "Options can't be chosen here yet", "S5 kept");
    await click(action(m.host, "BOX-PLAIN"));
    assert.equal(confirmationOpen(m.host), true);
  } finally { await m.unmount(); globalThis.__liveMode = "ok"; }
});

test("the live list failed: visible, unselectable, 'Availability unavailable. Try again.'; the retry re-reads it and the card becomes selectable", async () => {
  globalThis.__liveMode = "fail";
  const m = await mountGiftPlace();
  try {
    await openGiftBaskets(m.host);
    assert.equal(note(m.host, "BOX-PLAIN").textContent.replace(/\s+/g, " "), "Availability unavailable. Try again.");
    assert.equal(action(m.host, "BOX-PLAIN").disabled, true);
    alerts.length = 0;
    await click(action(m.host, "BOX-PLAIN"));
    assert.equal(confirmationOpen(m.host), false);
    assert.equal(checkoutOpen(m.host), false);
    const { __transport } = await import(pathToFileURL(BUNDLE).href);
    const before = __transport.catalogCalls;
    globalThis.__liveMode = "ok";
    await click(m.host.querySelector('[data-testid="gift-card-availability-retry-gm-BOX-PLAIN"]'));
    await settleAll();
    assert.ok(__transport.catalogCalls > before, "the retry re-read the live list");
    assert.equal(note(m.host, "BOX-PLAIN"), null);
    assert.equal(action(m.host, "BOX-PLAIN").disabled, false);
    await click(action(m.host, "BOX-PLAIN"));
    assert.equal(confirmationOpen(m.host), true);
  } finally { await m.unmount(); globalThis.__liveMode = "ok"; }
});

test("the note sits in the card's existing description slot: same card, same slot, nothing hidden", async () => {
  globalThis.__liveMode = "fail";
  const m = await mountGiftPlace();
  try {
    await openGiftBaskets(m.host);
    const slot = m.host.querySelector('[data-testid="gift-card-desc-gm-BOX-PLAIN"]');
    assert.ok(slot.contains(note(m.host, "BOX-PLAIN")), "inside the reserved description slot");
    assert.equal(slot.style.minHeight, "2.1em");
    assert.equal(m.host.querySelectorAll('[data-testid^="gift-card-gm-"]').length >= 3, true);
  } finally { await m.unmount(); globalThis.__liveMode = "ok"; }
});

test("the provider said it is available but its live list answered 503: 'Availability unavailable. Try again.', not 'not available'", async () => {
  globalThis.__liveMode = "unavailable";
  const m = await mountGiftPlace();
  try {
    await openGiftBaskets(m.host);
    assert.equal(note(m.host, "BOX-PLAIN").textContent.replace(/\s+/g, " "), "Availability unavailable. Try again.");
    assert.equal(action(m.host, "BOX-PLAIN").disabled, true);
    globalThis.__liveMode = "ok";
    await click(m.host.querySelector('[data-testid="gift-card-availability-retry-gm-BOX-PLAIN"]'));
    await settleAll();
    assert.equal(action(m.host, "BOX-PLAIN").disabled, false);
  } finally { await m.unmount(); globalThis.__liveMode = "ok"; }
});
