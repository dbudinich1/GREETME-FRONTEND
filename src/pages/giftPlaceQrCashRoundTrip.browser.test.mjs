// src/pages/giftPlaceQrCashRoundTrip.browser.test.mjs
//
// Report 136 — QR Cash chosen in the Gift Place's QR Cash tab comes back to the SAME greeting: recipient, occasion,
// timing, words, photos and the chosen amount; and Back / refresh never reopen gift shopping or the old chooser.
// Drives the REAL Send page and the REAL Gift Place through one router, entered exactly as the dashboard hands off.
// Harness copied from Report 135's dashboardGiftPlaceHandoff.browser.test.mjs (same stubs: no network, no provider,
// no Stripe, no order, no charge, no send).
//
// Run (Node 20.x): node --test src/pages/giftPlaceQrCashRoundTrip.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gpqrt.bundle.mjs");
const ENTRY = join(__dirname, ".__gpqrt.entry.jsx");
const AUTH_STUB = join(__dirname, ".__gpqrt.auth.js");
const API_STUB = join(__dirname, ".__gpqrt.api.js");
const PROVIDER_STUB = join(__dirname, ".__gpqrt.provider.js");
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
    'import { useLocation, useNavigate } from "react-router-dom";\n'
    + 'export { default as Merch } from "./Merch.jsx";\n'
    + 'export { default as SendGreeting } from "./SendGreeting.jsx";\n'
    + 'export { MemoryRouter, Routes, Route } from "react-router-dom";\n'
    + 'export function NavProbe() { globalThis.__navigate = useNavigate(); return null; }\n'
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

async function mountAt(url, { history } = {}) {
  const { MemoryRouter, Routes, Route, Merch, SendGreeting, LocationProbe, NavProbe } = mod;
  const h = React.createElement;
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: history ? [...history, url] : [url], initialIndex: history ? history.length : 0 },
      h(LocationProbe), h(NavProbe),
      h(Routes, null,
        h(Route, { path: "/dashboard", element: h("div", { "data-testid": "dash-home" }, "dashboard") }),
        h(Route, { path: "/dashboard/gifts", element: h(Merch) }),
        h(Route, { path: "/dashboard/send", element: h(SendGreeting) }),
      )));
  });
  await settle(8);
  return { host, unmount: () => act(() => root.unmount()) };
}
const HANDOFF_KEY = "gm_dashboard_send_handoff_v1";
const DASH = "/dashboard/send?contactId=c1&occasion=Birthday&from=dashboard&gift=choose&entry=e1";

const back = async () => { await act(async () => { globalThis.__navigate(-1); }); await settle(8); };
const PHOTO = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
const seedHandoff = () => window.sessionStorage.setItem(HANDOFF_KEY, JSON.stringify({ contactId: "c1", occasion: "Birthday", words: "Happy birthday, Dana", memoryPhotos: [PHOTO], at: Date.now() }));
const qr = (host, id) => host.querySelector(`[data-testid="${id}"]`);
const wait = async (ms) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const pickQrAndAdd = async (host, how) => {
  await click(qr(host, "gift-place-qrcash-tab"));
  if (how.preset) await click(qr(host, `qrcash-preset-${how.preset}`));
  if (how.custom) {
    const el = qr(host, "qrcash-custom");
    const set = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    await act(async () => { set.call(el, how.custom); el.dispatchEvent(new window.Event("input", { bubbles: true })); });
  }
  await click(qr(host, "qrcash-add"));
  for (let i = 0; i < 6; i += 1) await wait(80);
};
const greeting = (host) => ({
  occasion: text(host.querySelector('[data-testid="send-banner-occasion"]')),
  recipient: ([...host.querySelectorAll("select")].find((sel) => [...sel.options].some((o) => o.value === "c1")) || {}).value,
  words: (host.querySelector("textarea") || {}).value,
  photos: [...host.querySelectorAll("img")].filter((i) => (i.getAttribute("src") || "") === PHOTO).length,
});

test("QR Cash $50 from the Gift Place comes back to the same greeting: recipient, occasion, timing, words, photo and the amount; nothing is charged or sent", async () => {
  seedHandoff();
  const m = await mountAt(DASH, { history: ["/dashboard"] });
  try {
    assert.equal(location(m.host), "/dashboard/gifts?returnTo=send&giftType=marketplace");
    assert.equal(text(m.host.querySelector('[data-testid="gift-place-greeting-context"]')), "for Dana Example · Birthday · Send now", "who, what for and when");
    await pickQrAndAdd(m.host, { preset: 50 });
    assert.equal(location(m.host), "/dashboard/send");
    assert.deepEqual(greeting(m.host), { occasion: "Birthday", recipient: "c1", words: "Happy birthday, Dana", photos: 1 });
    assert.match(text(m.host), /QR Cash gift of \$50/);
    assert.doesNotMatch(text(m.host), /Choose a Gift \(Optional\)/, "the old chooser does not open");
    assert.equal(mod.__sends.length, 0);
  } finally { await m.unmount(); }
});

test("a custom amount ($40) comes back the same way", async () => {
  seedHandoff();
  const m = await mountAt(DASH);
  try {
    await pickQrAndAdd(m.host, { custom: "40" });
    assert.match(text(m.host), /QR Cash gift of \$40/);
    assert.deepEqual(greeting(m.host), { occasion: "Birthday", recipient: "c1", words: "Happy birthday, Dana", photos: 1 });
  } finally { await m.unmount(); }
});

test("Back after the return goes to the dashboard, never into the Gift Place or the chooser", async () => {
  seedHandoff();
  const m = await mountAt(DASH, { history: ["/dashboard"] });
  try {
    await pickQrAndAdd(m.host, { preset: 50 });
    mod.__visited.length = 0;
    await back();
    assert.equal(location(m.host), "/dashboard");
    assert.ok(!mod.__visited.some((v) => v.startsWith("/dashboard/gifts")), "the Gift Place is not reopened");
    assert.doesNotMatch(text(m.host), /Choose a Gift \(Optional\)/);
  } finally { await m.unmount(); }
});

test("refresh (or Back) onto the greeting's address after the return: recipient, occasion, words, photo AND the QR Cash amount are kept; no shopping, no chooser", async () => {
  seedHandoff();
  const m = await mountAt(DASH);
  try { await pickQrAndAdd(m.host, { preset: 50 }); await wait(1300); /* the draft's 1s autosave */ } finally { await m.unmount(); }
  mod.__visited.length = 0;
  const again = await mountAt(DASH);
  try {
    assert.equal(location(again.host), "/dashboard/send?contactId=c1&occasion=Birthday");
    assert.deepEqual(greeting(again.host), { occasion: "Birthday", recipient: "c1", words: "Happy birthday, Dana", photos: 1 });
    assert.match(text(again.host), /QR Cash gift of \$50/, "the amount survives the refresh");
    assert.ok(!mod.__visited.some((v) => v.startsWith("/dashboard/gifts")));
    assert.doesNotMatch(text(again.host), /Choose a Gift \(Optional\)/);
    assert.equal(mod.__sends.length, 0);
  } finally { await again.unmount(); }
});

test("refresh while on the Gift Place's amount screen keeps the greeting and its context; the amount is then chosen and returned normally", async () => {
  seedHandoff();
  const m = await mountAt(DASH);
  const saved = window.sessionStorage.getItem("sendGreetingState");
  await m.unmount();
  const gp = await mountAt("/dashboard/gifts?returnTo=send&giftType=marketplace");
  try {
    assert.equal(window.sessionStorage.getItem("sendGreetingState"), saved, "refreshing the Gift Place keeps the greeting");
    assert.equal(text(gp.host.querySelector('[data-testid="gift-place-greeting-context"]')), "for Dana Example · Birthday · Send now");
    await pickQrAndAdd(gp.host, { preset: 25 });
    assert.equal(location(gp.host), "/dashboard/send");
    assert.match(text(gp.host), /QR Cash gift of \$25/);
    assert.deepEqual(greeting(gp.host), { occasion: "Birthday", recipient: "c1", words: "Happy birthday, Dana", photos: 1 });
  } finally { await gp.unmount(); }
});

test("only a QR Cash choice is kept in the refresh draft: a gift box chosen instead stores nothing there (as before)", async () => {
  seedHandoff();
  const m = await mountAt(DASH);
  try {
    await click(buttonsByText(m.host, /^Gift Baskets$/)[0]);
    await settle(6);
    await click(m.host.querySelector('[data-testid^="gift-card-action-"]'));
    await click(buttonsByText(m.host, /Return to Greeting/).at(-1));
    for (let i = 0; i < 6; i += 1) await wait(80);
    assert.match(text(m.host), /Round Trip Gift Box/, "the gift box is on the greeting");
    await wait(1300);
    const drafts = JSON.parse(window.localStorage.getItem("greetme_drafts") || "{}");
    const d = Object.values(drafts).find((x) => x.contactId === "c1" && x.occasionType === "Birthday");
    assert.ok(d, "the draft exists");
    assert.equal(d.giftChoice, null, "no gift choice stored for a gift box");
  } finally { await m.unmount(); }
  // and after QR Cash on a fresh visit (the entry above is used, by design), the draft holds exactly the type and amount
  window.sessionStorage.clear();
  seedHandoff();
  const q = await mountAt(DASH);
  try { await pickQrAndAdd(q.host, { preset: 50 }); await wait(1300); } finally { await q.unmount(); }
  const d2 = Object.values(JSON.parse(window.localStorage.getItem("greetme_drafts") || "{}")).find((x) => x.contactId === "c1" && x.occasionType === "Birthday");
  assert.deepEqual(d2.giftChoice, { type: "qrcash", amount: 50, customAmount: "" });
});

test("a greeting already SENT never brings its QR Cash back: the same person and occasion revisited (e.g. next year) start with no gift", async () => {
  seedHandoff();
  const m = await mountAt(DASH);
  try { await pickQrAndAdd(m.host, { preset: 50 }); await wait(1300); } finally { await m.unmount(); }
  // The send itself is blocked in this harness, so the draft is marked exactly as draftService.markDraftAsSent does.
  const drafts = JSON.parse(window.localStorage.getItem("greetme_drafts") || "{}");
  const id = Object.keys(drafts).find((k) => drafts[k].contactId === "c1" && drafts[k].occasionType === "Birthday");
  assert.deepEqual(drafts[id].giftChoice, { type: "qrcash", amount: 50, customAmount: "" }, "the unsent draft held QR Cash $50");
  drafts[id] = { ...drafts[id], status: "sent", sentAt: new Date().toISOString() };
  window.localStorage.setItem("greetme_drafts", JSON.stringify(drafts));
  window.sessionStorage.clear();
  const later = await mountAt("/dashboard/send?contactId=c1&occasion=Birthday");
  try {
    assert.equal(text(later.host.querySelector('[data-testid="send-banner-occasion"]')), "Birthday");
    assert.doesNotMatch(text(later.host), /QR Cash gift of \$50/, "no QR Cash from the sent greeting");
    assert.equal((later.host.querySelector("textarea") || {}).value, "Happy birthday, Dana", "words keep today's behaviour (restored from the draft as before)");
  } finally { await later.unmount(); }
});

test("from the dashboard's QR Cash slide: the Gift Place opens on its QR Cash tab with the greeting's context; $25 comes back to the same greeting", async () => {
  seedHandoff();
  // What the dashboard writes when Add a gift is pressed on its QR Cash slide (DashboardHome goSendFlow, entry e1 in DASH).
  window.sessionStorage.setItem("gm_giftplace_tab_v1", JSON.stringify({ entry: "e1", tab: "qrcash", at: Date.now() }));
  const m = await mountAt(DASH, { history: ["/dashboard"] });
  try {
    assert.equal(location(m.host), "/dashboard/gifts?returnTo=send&giftType=marketplace");
    assert.ok(qr(m.host, "qrcash-panel"), "the QR Cash tab is open on arrival");
    assert.equal(qr(m.host, "gift-place-qrcash-tab").getAttribute("aria-pressed"), "true");
    assert.equal(text(m.host.querySelector('[data-testid="gift-place-greeting-context"]')), "for Dana Example · Birthday · Send now");
    assert.equal(window.sessionStorage.getItem("gm_giftplace_tab_v1"), null, "the marker is used once");
    await click(qr(m.host, "qrcash-preset-25"));
    await click(qr(m.host, "qrcash-add"));
    for (let i = 0; i < 6; i += 1) await wait(80);
    assert.equal(location(m.host), "/dashboard/send");
    assert.deepEqual(greeting(m.host), { occasion: "Birthday", recipient: "c1", words: "Happy birthday, Dana", photos: 1 });
    assert.match(text(m.host), /QR Cash gift of \$25/);
    assert.equal(mod.__sends.length, 0);
  } finally { await m.unmount(); }
});

test("without the marker (another slide), the same entry opens the Gift Place on its categories as before", async () => {
  seedHandoff();
  const m = await mountAt(DASH);
  try {
    assert.equal(location(m.host), "/dashboard/gifts?returnTo=send&giftType=marketplace");
    assert.equal(qr(m.host, "qrcash-panel"), null);
    assert.equal(qr(m.host, "gift-place-qrcash-tab").getAttribute("aria-pressed"), "false");
  } finally { await m.unmount(); }
});
