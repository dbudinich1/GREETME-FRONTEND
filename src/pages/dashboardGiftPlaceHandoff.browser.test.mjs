// src/pages/dashboardGiftPlaceHandoff.browser.test.mjs
//
// Report 135 — the dashboard's "Add a gift" reaches the Gift Place, not the send page's gift-type chooser, and the
// send page names the occasion that was chosen (it read "Just Because" for every greeting).
//
// Drives the REAL Send page and the REAL Gift Place through one router, exactly as the dashboard hands off:
// /dashboard/send?contactId=&occasion=&from=dashboard&gift=choose (DashboardHome handoff) with the words kept in the
// dashboard hand-off. Harness copied from giftReturnRoundTrip.browser.test.mjs (same stubs: no network, no provider,
// no Stripe, no order, no charge, no send).
//
// Run (Node 20.x): node --test src/pages/dashboardGiftPlaceHandoff.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__dgph.bundle.mjs");
const ENTRY = join(__dirname, ".__dgph.entry.jsx");
const AUTH_STUB = join(__dirname, ".__dgph.auth.js");
const API_STUB = join(__dirname, ".__dgph.api.js");
const PROVIDER_STUB = join(__dirname, ".__dgph.provider.js");
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

async function mountAt(url) {
  const { MemoryRouter, Routes, Route, Merch, SendGreeting, LocationProbe } = mod;
  const h = React.createElement;
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [url] },
      h(LocationProbe),
      h(Routes, null,
        h(Route, { path: "/dashboard/gifts", element: h(Merch) }),
        h(Route, { path: "/dashboard/send", element: h(SendGreeting) }),
      )));
  });
  await settle(8);
  return { host, unmount: () => act(() => root.unmount()) };
}
const HANDOFF_KEY = "gm_dashboard_send_handoff_v1";
const DASH = "/dashboard/send?contactId=c1&occasion=Birthday&from=dashboard&gift=choose";

test("Add a gift from the dashboard opens the Gift Place (not the gift-type chooser) with the recipient, occasion, timing and words kept", async () => {
  window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ contactId: "c1", occasion: "Birthday", words: "Happy birthday, Dana", memoryPhotos: [], at: Date.now() }));
  const m = await mountAt(DASH);
  try {
    assert.equal(location(m.host), "/dashboard/gifts?returnTo=send&giftType=marketplace", "the Gift Place is open");
    assert.doesNotMatch(text(m.host), /Choose a Gift \(Optional\)/, "the gift-type chooser never opened");
    const ctx = m.host.querySelector('[data-testid="gift-place-greeting-context"]');
    assert.equal(text(ctx), "for Dana Example · Birthday · Send now", "who, which occasion and when are shown");
    const saved = JSON.parse(window.sessionStorage.getItem("sendGreetingState"));
    assert.equal(saved.formData.contactId, "c1");
    assert.equal(saved.formData.occasionType, "Birthday");
    assert.equal(saved.formData.customMessage, "Happy birthday, Dana", "the dashboard's words travel with the greeting");
    assert.equal(saved.giftSettings.type, "marketplace", "recorded as the chooser's Gift Place option records it");
    assert.equal(mod.__sends.length, 0, "nothing was sent");
  } finally { await m.unmount(); }
});

test("Return to Greeting brings back the same recipient and occasion, and the banner names Birthday, not Just Because", async () => {
  const m = await mountAt(DASH);
  try {
    await click(buttonsByText(m.host, /Return to Greeting/)[0]);
    await settle(8);
    assert.equal(location(m.host).split("?")[0], "/dashboard/send");
    assert.equal(text(m.host.querySelector('[data-testid="send-banner-occasion"]')), "Birthday");
    const sel = [...m.host.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "Just Because"));
    assert.equal(sel.value, "Birthday", "the occasion field and the banner agree");
    assert.equal(mod.__sends.length, 0, "nothing was sent");
  } finally { await m.unmount(); }
});

test("the send page banner follows the selected occasion (any occasion, with or without the gift entry)", async () => {
  const m = await mountAt("/dashboard/send?contactId=c1&occasion=Christmas&from=dashboard");
  try {
    assert.equal(location(m.host).split("?")[0], "/dashboard/send", "no gift entry: the page stays");
    assert.equal(text(m.host.querySelector('[data-testid="send-banner-occasion"]')), "Christmas");
    assert.doesNotMatch(text(m.host.querySelector('[data-testid="send-banner-occasion"]')), /Just Because/);
  } finally { await m.unmount(); }
});

test("without a recipient and occasion, ?gift=choose still opens the chooser as before (no silent navigation)", async () => {
  const m = await mountAt("/dashboard/send?gift=choose");
  try {
    assert.equal(location(m.host).split("?")[0], "/dashboard/send");
    assert.match(text(m.host), /Choose a Gift \(Optional\)/);
  } finally { await m.unmount(); }
});
