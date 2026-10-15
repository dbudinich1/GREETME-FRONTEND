// src/pages/giftReturnRoundTrip.browser.test.mjs
//
// E01 — THE GIFT PLACE ROUND TRIP KEEPS THE GIFT THE SENDER CHOSE.
//
// The defect (Report 66/68): "Return to Greeting" sent `?giftType=merch` for anything that was not a
// flower, and the Send page let that URL type overwrite the type the Gift Place had already saved. A
// gift box, a flower returned through the header button, a Branded Goods pick, and a header return with
// nothing picked all reached review as `merch` — a type the review has no branch for — so it offered a
// plain "Send Now" and the backend refused the send ("Please re-select your gift.").
//
// The repair (Merch.jsx only): the return carries no gift type, and a Branded Goods pick made during a
// send saves `marketplace`, so the Send page restores the type each pick recorded.
//
// These four proofs drive the REAL Gift Place and the REAL Send page through one router, exactly as a
// sender does: browse, pick, return, press Done & Send, then the review's main button. Only the
// side-effecting edges are stubbed (auth, the API client, the provider transport). The cart is the real
// localStorage cart. No network, no provider, no Stripe, no order, no charge, no send.
//
// Run (Node 20.x):
//   node --test src/pages/giftReturnRoundTrip.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__grrt.bundle.mjs");
const ENTRY = join(__dirname, ".__grrt.entry.jsx");
const AUTH_STUB = join(__dirname, ".__grrt.auth.js");
const API_STUB = join(__dirname, ".__grrt.api.js");
const PROVIDER_STUB = join(__dirname, ".__grrt.provider.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, PROVIDER_STUB];

let React, createRoot, act, mod, window;

/** Synthetic catalogue. Nothing here corresponds to a real product, price or order. */
const FLOWER = { providerProductId: "RT-FLOWER", name: "Round Trip Roses", priceMinor: 6499, currency: "USD", imageUrl: null };
const GIFT_BOX = { providerProductId: "RT-BOX", name: "Round Trip Gift Box", priceMinor: 5500, currency: "USD", imageUrl: null };
const CURATED = [
  { p: FLOWER, vendor: "florist_one", category: "flowers" },
  { p: GIFT_BOX, vendor: "goody", category: "gift_baskets" },
].map(({ p, vendor, category }) => ({
  id: `gm-${p.providerProductId}`, vendor, title: p.name, description: "", priceCents: p.priceMinor,
  giftType: "Gifts", occasion: null, currency: p.currency, images: [], variants: [],
  greetMeCategories: [category], source: vendor, providerProductId: p.providerProductId,
}));
const MERCH = [{
  syncProductId: "RT-TEE", name: "Round Trip Tee", brandable: true, imageUrl: null,
  variantCount: 1, priceCentsMin: 2500, priceCentsMax: 2500,
  variants: [{ syncVariantId: "RT-TEE-M", label: "Medium", priceCents: 2500 }],
}];
const CONTACTS = [{ id: "c1", name: "Dana Example", email: "dana@example.com" }];

/** The draft SendGreeting's own onBrowse saves before it opens the Gift Place. */
const DRAFT_AT_BROWSE = {
  formData: {
    contactId: "c1", occasionType: "Birthday", customOccasion: "", customMessage: "",
    aiContext: "", giftAmount: "", tone: "warm",
  },
  giftSettings: { type: "marketplace", amount: 25, customAmount: "", maxSpend: 50, autoGift: false },
  defaultPhoto: null, memoryPhotos: [], useMemoryPhotos: false, excludedMemoryPhotos: [],
};

before(async () => {
  writeFileSync(AUTH_STUB,
    "const user = { id: 'u1', email: 'sender@example.com', name: 'Sender', emailVerified: true,\n"
    + "  tier: 'close_circle', photoUrl: 'https://example.test/sender.jpg', voiceUrl: 'https://example.test/v.mp3' };\n"
    + "export const useAuth = () => ({ user, loading: false, isAuthenticated: true, refreshUser: async () => user,\n"
    + "  refreshProfile: async () => user, updateUser: () => {}, logout: () => {}, getToken: () => null });\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");

  // Reads answer with fixtures; the send itself is recorded and refused, so a test that reached it
  // would fail loudly rather than pass for the wrong reason.
  writeFileSync(API_STUB,
    "export const __sends = [];\n"
    + "const merch = " + JSON.stringify(MERCH) + ";\n"
    + "const curated = " + JSON.stringify(CURATED) + ";\n"
    + "const contacts = " + JSON.stringify(CONTACTS) + ";\n"
    + "const known = {\n"
    + "  async request(url = '') {\n"
    + "    if (String(url).includes('/api/merch/products')) return { products: merch };\n"
    + "    return {};\n"
    + "  },\n"
    + "  async getGiftCatalog() { return { ok: true, products: curated }; },\n"
    + "  async getSmartCardTiles() { return { ok: false }; },\n"
    + "  async getContacts() { return { contacts }; },\n"
    + "  async getHeartsBalance() { return { balance: 0 }; },\n"
    + "  async getSendEntitlementPreflight() { return { ok: true, canSendGreeting: true }; },\n"
    + "  async sendGreeting(p) { __sends.push(p); throw Object.assign(new Error('no test may send'), { code: 'TEST' }); },\n"
    + "  async get() { return { data: {} }; },\n"
    + "};\n"
    + "export default new Proxy(known, { get: (t, k) => (k in t ? t[k] : (k === 'then' ? undefined : async () => ({}))) });\n");

  writeFileSync(PROVIDER_STUB,
    "const flowers = " + JSON.stringify([FLOWER]) + ";\n"
    + "const boxes = " + JSON.stringify([GIFT_BOX]) + ";\n"
    + "export async function fetchCheckoutAvailability() { return { available: true, purchasable: true }; }\n"
    + "export async function fetchProviderCatalog(giftType) {\n"
    + "  return { ok: true, products: giftType === 'flowers' ? flowers : giftType === 'gift_boxes' ? boxes : [] };\n"
    + "}\n"
    + "export async function fetchProviderProducts() { return []; }\n"
    + "export async function fetchTokenizationConfig() { throw new Error('no test may fetch tokenization'); }\n"
    + "export async function retryGiftLink() { throw new Error('no test may retry a gift link'); }\n"
    + "export async function prepareCheckout() { throw new Error('no test may prepare a checkout'); }\n"
    + "export async function submitCheckout() { throw new Error('no test may submit a checkout'); }\n");

  writeFileSync(ENTRY,
    'import { useLocation } from "react-router-dom";\n'
    + 'export { default as Merch } from "./Merch.jsx";\n'
    + 'export { default as SendGreeting } from "./SendGreeting.jsx";\n'
    + 'export { MemoryRouter, Routes, Route } from "react-router-dom";\n'
    + 'export { __sends } from "../api/api";\n'
    + 'export const __visited = [];\n'
    + 'export function LocationProbe() {\n'
    + '  const l = useLocation();\n'
    + '  const at = `${l.pathname}${l.search}`;\n'
    + '  if (__visited.at(-1) !== at) __visited.push(at);\n'
    + '  return <div data-testid="rt-location" data-path={l.pathname} data-search={l.search} hidden />;\n'
    + '}\n');

  await esbuild.build({
    entryPoints: [ENTRY],
    outfile: BUNDLE,
    bundle: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{
      name: "stub-side-effects",
      setup(build) {
        const STUBS = new Map([
          ["../context/AuthContext", AUTH_STUB],
          ["../../context/AuthContext", AUTH_STUB],
          ["../api/api", API_STUB],
          ["../../api/api", API_STUB],
          ["../api/providerCheckout", PROVIDER_STUB],
          ["../../api/providerCheckout", PROVIDER_STUB],
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

  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: "http://localhost/", pretendToBeVisual: true,
  });
  window = dom.window;
  global.window = window;
  global.document = window.document;
  // Defined, not assigned: Node 21+ ships a read-only global `navigator`.
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true, writable: true });
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
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  }));
  global.alert = () => { throw new Error("no path here may need an alert"); };
  window.alert = global.alert;

  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  mod = await import(pathToFileURL(BUNDLE).href);
});

after(() => {
  for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
});

beforeEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
  mod.__sends.length = 0;
  mod.__visited.length = 0;
  window.document.body.innerHTML = "";
});

const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
const settle = async (n = 4) => {
  for (let i = 0; i < n; i += 1) {
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  }
};
const buttons = (host) => [...host.querySelectorAll("button")];
const buttonsByText = (host, re) => buttons(host).filter((b) => re.test(text(b)));
const click = async (el) => {
  assert.ok(el, "the control must exist");
  await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  await settle();
};
const location = (host) => {
  const el = host.querySelector('[data-testid="rt-location"]');
  return `${el?.dataset.path || ""}${el?.dataset.search || ""}`;
};

/** The Send page has opened the Gift Place: draft saved, Gift Place mounted in greeting context. */
async function mountAtGiftPlace() {
  window.sessionStorage.setItem("sendGreetingState", JSON.stringify(DRAFT_AT_BROWSE));
  const { MemoryRouter, Routes, Route, Merch, SendGreeting, LocationProbe } = mod;
  const h = React.createElement;
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: ["/dashboard/gifts?returnTo=send&giftType=marketplace"] },
      h(LocationProbe),
      h(Routes, null,
        h(Route, { path: "/dashboard/gifts", element: h(Merch) }),
        h(Route, { path: "/dashboard/send", element: h(SendGreeting) }),
        h(Route, { path: "/dashboard/checkout", element: h("div", { "data-testid": "rt-checkout-page" }, "Checkout page") }),
      )));
  });
  await settle(6);
  return { host, unmount: () => act(() => root.unmount()) };
}

async function chooseCategory(host, label) {
  await click(buttonsByText(host, new RegExp(`^${label}$`))[0]);
  await settle(6);
}
const pickFirstCard = async (host) => click(host.querySelector('[data-testid^="gift-card-action-"]'));
// The header bar's button comes first in the page; the confirmation's own button is rendered last.
const headerReturn = (host) => buttonsByText(host, /Return to Greeting/)[0];
const confirmationReturn = (host) => buttonsByText(host, /Return to Greeting/).at(-1);

/** Back on the Send page: press Done & Send and return the review's main action button. */
async function openReview(host) {
  // The Gift Place's return is the first Send-page location visited, and it carries no gift type.
  // (The Send page then tidies its own URL after restoring, which is pre-existing behaviour.)
  const firstSend = mod.__visited.find((v) => v.startsWith("/dashboard/send"));
  assert.equal(firstSend, "/dashboard/send?returnTo=send", "the return carries no gift type");
  await settle(6);
  const submit = buttonsByText(host, /Done & Send/)[0];
  assert.ok(submit, "the Send page is showing");
  await act(async () => {
    submit.closest("form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
  });
  await settle(6);
  assert.ok(/SENDING TO/i.test(text(host)), "the review screen is open");
  return {
    labels: buttons(host).map(text),
    primary: (re) => buttonsByText(host, re).at(-1),
  };
}

test("E01-1. a gift box returned from the confirmation reaches the gift-box checkout", async () => {
  const m = await mountAtGiftPlace();
  try {
    await chooseCategory(m.host, "Gift Baskets");
    await pickFirstCard(m.host);
    await click(confirmationReturn(m.host));

    const review = await openReview(m.host);
    assert.ok(!review.labels.includes("Send Now"), "no plain Send Now for a gift box");
    assert.match(text(m.host), /Round Trip Gift Box/, "the gift box is the attached gift");
    const cont = review.primary(/^Continue$/);
    assert.ok(cont && !cont.disabled, "the review offers the gift-box Continue");

    await click(cont);
    // The gift-box checkout (GiftBoxCheckoutModal) is what opens. In this harness Stripe has no key,
    // so that modal renders its own not-configured notice — which only that modal renders.
    assert.match(text(m.host), /Payment is not configured/, "the gift-box checkout opened");
    assert.equal(mod.__sends.length, 0, "nothing was sent");
  } finally { await m.unmount(); }
});

test("E01-2. a flower, then Continue Shopping, then the header return reaches the flower checkout", async () => {
  const m = await mountAtGiftPlace();
  try {
    await chooseCategory(m.host, "Flowers");
    await pickFirstCard(m.host);
    await click(buttonsByText(m.host, /Continue Shopping/)[0]);
    await click(headerReturn(m.host));

    const review = await openReview(m.host);
    assert.ok(!review.labels.includes("Send Now"), "no plain Send Now for a flower");
    assert.match(text(m.host), /Round Trip Roses/, "the flower is the attached gift");
    const cont = review.primary(/^Continue$/);
    assert.ok(cont && !cont.disabled, "the review offers the flower Continue");

    await click(cont);
    assert.match(text(m.host), /Review your order/, "the flower checkout (ProviderCheckoutModal) opened");
    assert.equal(mod.__sends.length, 0, "nothing was sent");
  } finally { await m.unmount(); }
});

test("E01-3. Branded Goods picked during a send reaches the cart checkout", async () => {
  const m = await mountAtGiftPlace();
  try {
    await chooseCategory(m.host, "Branded Goods");
    await pickFirstCard(m.host);
    const saved = JSON.parse(window.sessionStorage.getItem("sendGreetingState") || "{}");
    assert.equal(saved.giftSettings?.type, "marketplace", "the pick is saved as marketplace");
    await click(confirmationReturn(m.host));

    const review = await openReview(m.host);
    assert.ok(!review.labels.includes("Send Now"), "no plain Send Now for Branded Goods");
    assert.match(text(m.host), /Round Trip Tee/, "the item is listed at review");
    const cont = review.primary(/Continue to Secure Checkout/);
    assert.ok(cont && !cont.disabled, "the review offers the cart checkout");

    await click(cont);
    assert.equal(location(m.host).split("?")[0], "/dashboard/checkout", "the cart checkout opens");
    assert.equal(mod.__sends.length, 0, "nothing was sent");
  } finally { await m.unmount(); }
});

test("E01-4. the header return with nothing picked cannot reach a failing send", async () => {
  const m = await mountAtGiftPlace();
  try {
    await click(headerReturn(m.host));

    const review = await openReview(m.host);
    assert.ok(!review.labels.includes("Send Now"), "no plain Send Now");
    const cont = review.primary(/Continue to Secure Checkout/);
    assert.ok(cont, "the marketplace review state is shown");
    assert.equal(cont.disabled, true, "and its checkout stays disabled until a gift is added");
    assert.match(text(m.host), /No gift items selected yet/);
    assert.equal(mod.__sends.length, 0, "nothing was sent");
  } finally { await m.unmount(); }
});
