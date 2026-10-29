// src/features/merchBranding/merchBranding.browser.test.mjs — REPORT 153, mounted.
//
// The REAL Merch.jsx page is bundled twice:
//   OFF — with the real, shipped switch (literal false): the page is unchanged — "Brand for My Company" goes to the
//         For Business contact form, no file input, no branding control or card state, no branding API call;
//   ON  — with the switch module replaced (test-only) and the in-memory branding double: logo step, branded cards
//         (Printful mockup image when ready, "preparing", unsupported label), Replace / Clear, and the artwork
//         approval inside the purchase journey (approve stays disabled: checkout not connected, Q1 open).
// Only side-effecting edges are stubbed (auth, api client, cart, provider transport). No network.
//
// Run (Node 20.x): node --test src/features/merchBranding/merchBranding.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const HERE = dirname(fileURLToPath(import.meta.url));
const PAGES = join(HERE, "../../pages");
const T = (n) => join(PAGES, `.__mb153.${n}`);
const TEMP = ["off.mjs", "on.mjs", "entry.jsx", "auth.js", "api.js", "cart.js", "provider.js", "flagsOn.js", "apiProviderOn.js"].map(T);

const MERCH_PRODUCTS = [
  { syncProductId: 431622804, name: "White Glossy Mug", brandable: true, greetMeCategories: [], imageUrl: "https://example.test/mug.jpg", variantCount: 3,
    priceCentsMin: 1400, priceCentsMax: 2000,
    variants: [{ syncVariantId: 5298267871, label: "11 oz", priceCents: 1400 }, { syncVariantId: 5298267872, label: "15 oz", priceCents: 1700 }, { syncVariantId: 5298267873, label: "20 oz", priceCents: 2000 }] },
  { syncProductId: 431623973, name: "Laptop Sleeve", brandable: true, greetMeCategories: ["tech"], imageUrl: "https://example.test/sleeve.jpg", variantCount: 2,
    priceCentsMin: 3900, priceCentsMax: 4400,
    variants: [{ syncVariantId: 5298284576, label: '13"', priceCents: 3900 }, { syncVariantId: 5298284577, label: '15"', priceCents: 4400 }] },
  { syncProductId: 999000111, name: "Unsupported Thing", brandable: true, greetMeCategories: [], imageUrl: "https://example.test/x.jpg", variantCount: 1,
    priceCentsMin: 1000, priceCentsMax: 1000, variants: [{ syncVariantId: 999000112, label: "One", priceCents: 1000 }] },
];

let React, act, createRoot, OFF, ON, win;

async function bundle(out, flagsOn) {
  await esbuild.build({
    entryPoints: [T("entry.jsx")], outfile: out, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl", ".json": "json" },
    plugins: [{
      name: "stubs",
      setup(build) {
        const S = new Map([
          ["../context/AuthContext", T("auth.js")], ["../api/api", T("api.js")], ["../services/cartService", T("cart.js")],
          ["../../api/providerCheckout", T("provider.js")], ["../api/providerCheckout", T("provider.js")],
        ]);
        if (flagsOn) {
          S.set("../features/merchBranding/merchBrandingFlags", T("flagsOn.js"));
          S.set("./brandingApiProvider.js", T("apiProviderOn.js"));
          S.set("../features/merchBranding/brandingApiProvider.js", T("apiProviderOn.js"));
        }
        build.onResolve({ filter: /.*/ }, (a) => (S.has(a.path) ? { path: S.get(a.path) } : undefined));
      },
    }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
}

before(async () => {
  writeFileSync(T("auth.js"), "export const useAuth = () => ({ user: { id: 'u1', email: 'a@example.com', name: 'A' } });\nexport default { useAuth };\n");
  writeFileSync(T("api.js"),
    "const merch = " + JSON.stringify(MERCH_PRODUCTS) + ";\n"
    + "async function request(url = '') { if (String(url).includes('/api/merch/products')) return { products: merch }; return {}; }\n"
    + "async function getGiftCatalog() { return { ok: true, products: [] }; }\nasync function getSmartCardTiles() { return { ok: false }; }\n"
    + "const noop = async () => ({ data: {} });\nexport default { request, getGiftCatalog, getSmartCardTiles, get: noop, post: noop, put: noop, delete: noop };\n");
  writeFileSync(T("cart.js"),
    "export const __calls = [];\nexport default { getCart: () => [], addItem: (i) => { __calls.push(i); return []; }, removeItem: () => [], updateItem: () => [], getTotal: () => 0, getCount: () => 0, clear() {}, hasItem: () => false, hasMerch: () => false, hasNonMerch: () => false, clearMerch() {} };\n");
  writeFileSync(T("provider.js"),
    "export async function fetchCheckoutAvailability() { return { available: true, purchasable: true }; }\n"
    + "export async function fetchProviderCatalog() { return { ok: true, products: [] }; }\nexport async function fetchProviderProducts() { return []; }\n"
    + "export async function fetchTokenizationConfig() { throw new Error('x'); }\nexport async function retryGiftLink() { throw new Error('x'); }\n"
    + "export async function prepareCheckout() { throw new Error('x'); }\nexport async function submitCheckout() { throw new Error('x'); }\n");
  writeFileSync(T("flagsOn.js"), "export function merchBrandingEnabled() { return true; }\n");
  writeFileSync(T("apiProviderOn.js"),
    `import { createInMemoryBrandingApi } from ${JSON.stringify(join(HERE, "brandingApi.js").replace(/\\/g, "/"))};\n`
    + "export const __api = createInMemoryBrandingApi({ measure: async (f) => (f.name.startsWith('small') ? { widthPx: 300, heightPx: 300 } : { widthPx: 4000, heightPx: 4000 }),\n"
    + "  mockupFor: (id) => (id === 5298267871 ? 'https://example.test/mockup-mug.jpg' : null) });\n"
    + "export function getBrandingApi() { return __api; }\n");
  writeFileSync(T("entry.jsx"),
    'export { default as Merch } from "./Merch.jsx";\nexport { MemoryRouter, Routes, Route } from "react-router-dom";\n'
    + 'export { __calls as cartCalls } from "../services/cartService";\n');
  await bundle(T("off.mjs"), false);
  writeFileSync(T("entry.jsx"),
    'export { default as Merch } from "./Merch.jsx";\nexport { MemoryRouter, Routes, Route } from "react-router-dom";\n'
    + 'export { __calls as cartCalls } from "../services/cartService";\nexport { __api } from "../features/merchBranding/brandingApiProvider.js";\n'
    + 'export { __resetBrandingSession } from "../features/merchBranding/useMerchBranding.js";\n');
  await bundle(T("on.mjs"), true);

  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: "http://localhost/dashboard/gifts", pretendToBeVisual: true });
  win = dom.window;
  Object.assign(global, { window: win, document: win.document, HTMLElement: win.HTMLElement, Node: win.Node, getComputedStyle: win.getComputedStyle,
    sessionStorage: win.sessionStorage, localStorage: win.localStorage, Event: win.Event, CustomEvent: win.CustomEvent, File: win.File });
  try { global.navigator = win.navigator; } catch { /* read-only */ }
  global.requestAnimationFrame = (cb) => win.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => win.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = async () => { throw new Error("no test may make a network request"); };
  win.fetch = global.fetch;
  win.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  global.alert = () => { throw new Error("no alert expected"); };
  React = await import("react");
  ({ act } = React);
  ({ createRoot } = await import("react-dom/client"));
  OFF = await import(pathToFileURL(T("off.mjs")).href);
  ON = await import(pathToFileURL(T("on.mjs")).href);
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } } });

const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
const tick = () => act(async () => { await new Promise((r) => win.setTimeout(r, 0)); });
const click = async (el) => { await act(async () => { el.dispatchEvent(new win.MouseEvent("click", { bubbles: true })); }); await tick(); await tick(); };
const q = (host, id) => host.querySelector(`[data-testid="${id}"]`);

async function mount(mod) {
  const host = win.document.createElement("div");
  win.document.body.appendChild(host);
  const root = createRoot(host);
  const h = React.createElement;
  await act(async () => {
    root.render(h(mod.MemoryRouter, { initialEntries: ["/dashboard/gifts"] },
      h(mod.Routes, null,
        h(mod.Route, { path: "/dashboard/gifts", element: h(mod.Merch) }),
        h(mod.Route, { path: "/business", element: h("div", { "data-testid": "business-page" }, "BUSINESS") }))));
  });
  await tick(); await tick();
  return { host, unmount: () => act(() => root.unmount()) };
}
const brandButton = (host) => [...host.querySelectorAll("button")].find((b) => /Brand for My Company/.test(text(b)));

async function chooseFile(host, name, type = "image/png") {
  const input = q(win.document.body, "branding-file-input");
  const file = new win.File([new Uint8Array([137, 80, 78, 71])], name, { type });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new win.Event("change", { bubbles: true })); });
  await click(q(win.document.body, "branding-apply"));
  await tick(); await tick();
}

// ── OFF ──────────────────────────────────────────────────────────────────────────────────
test("OFF: Brand for My Company still opens the For Business contact form; nothing new renders", async () => {
  const m = await mount(OFF);
  try {
    assert.equal(m.host.querySelectorAll('input[type="file"]').length, 0);
    assert.equal(win.document.querySelectorAll('[data-testid^="branding-"], [data-testid^="gift-card-branding-"]').length, 0);
    assert.ok(m.host.querySelector('[data-testid="gift-card-431622804"]'), "the catalog cards render as before");
    const btn = brandButton(m.host);
    assert.ok(btn);
    await click(btn);
    assert.ok(q(m.host, "business-page"), "navigated to /business (contact sales)");
    assert.equal(win.document.querySelectorAll('[data-testid="branding-logo-step"]').length, 0);
  } finally { await m.unmount(); }
});

test("OFF: adding a product uses today's cart path, untouched", async () => {
  const m = await mount(OFF);
  try {
    OFF.cartCalls.length = 0;
    await click(q(m.host, "gift-card-action-999000111"));
    assert.equal(OFF.cartCalls.length, 1);
    assert.equal(OFF.cartCalls[0].printfulSyncVariantId, 999000112);
  } finally { await m.unmount(); }
});

// ── ON ───────────────────────────────────────────────────────────────────────────────────
test("ON: the button opens the focused logo step; SVG is refused with the customer message", async () => {
  ON.__resetBrandingSession();
  const m = await mount(ON);
  try {
    await click(brandButton(m.host));
    assert.ok(q(win.document.body, "branding-logo-step"));
    assert.ok(!q(m.host, "business-page"), "no navigation to contact sales");
    await chooseFile(m.host, "logo.svg", "image/svg+xml");
    assert.match(text(q(win.document.body, "branding-error")), /SVG logos aren’t accepted yet/);
  } finally { await m.unmount(); }
});

test("ON: after upload every card is branded — mockup when ready, preparing otherwise, unsupported clearly labelled", async () => {
  ON.__resetBrandingSession();
  const m = await mount(ON);
  try {
    await click(brandButton(m.host));
    await chooseFile(m.host, "logo.png");
    await tick(); await tick();
    assert.ok(!q(win.document.body, "branding-logo-step"), "the step closes once applied");
    assert.ok(q(m.host, "branding-controls"));
    const mug = q(m.host, "gift-card-branding-431622804");
    assert.equal(text(mug), "Your logo");
    assert.match(q(m.host, "gift-card-image-431622804").style.backgroundImage, /mockup-mug\.jpg/, "the Printful mockup replaces the stock photo");
    assert.equal(text(q(m.host, "gift-card-branding-431623973")), "Preparing branded preview");
    assert.match(q(m.host, "gift-card-image-431623973").style.backgroundImage, /sleeve\.jpg/, "no logo is pasted on the stock photo");
    assert.equal(text(q(m.host, "gift-card-branding-999000111")), "Not available with your logo");
  } finally { await m.unmount(); }
});

test("ON: branding is retained across remounts (browsing); Clear branding restores the normal catalog and deletes the logo", async () => {
  const m = await mount(ON);
  try {
    assert.ok(q(m.host, "gift-card-branding-431622804"), "still branded after a remount");
    await click(q(m.host, "branding-clear"));
    assert.equal(m.host.querySelectorAll('[data-testid^="gift-card-branding-"]').length, 0);
    assert.ok(!q(m.host, "branding-controls"));
    assert.ok(ON.__api.calls.includes("clearLogo"));
    assert.equal(ON.__api._logos.size, 0);
  } finally { await m.unmount(); }
});

test("ON: a too-small logo is explained per product; Replace logo swaps it", async () => {
  ON.__resetBrandingSession();
  const m = await mount(ON);
  try {
    await click(brandButton(m.host));
    await chooseFile(m.host, "small.png");
    const b = q(m.host, "gift-card-branding-431622804");
    assert.equal(text(b), "Needs a larger logo file");
    await click(b);
    assert.match(text(q(win.document.body, "branding-unsuitable")), /^This mug needs a logo at least [\d,]+ px wide for a sharp print; yours is 300 px\. Upload a larger PNG or JPG\.$/);
    await click([...win.document.querySelectorAll('button[aria-label="Close"]')][0]);
    await click(q(m.host, "branding-replace"));
    await chooseFile(m.host, "logo.png");
    assert.equal(text(q(m.host, "gift-card-branding-431622804")), "Your logo");
    assert.ok(ON.__api.calls.includes("replaceLogo"));
    assert.equal(ON.__api._logos.size, 1, "the old logo was deleted on replace");
  } finally { await m.unmount(); }
});

test("ON: adding a branded product opens the artwork approval in the purchase journey; nothing reaches the cart", async () => {
  const m = await mount(ON);
  try {
    ON.cartCalls.length = 0;
    await click(q(m.host, "gift-card-action-431622804"));
    // multi-variant: the existing variant picker opens first, unchanged
    const pick = [...win.document.querySelectorAll("button")].find((b) => /11 oz/.test(text(b)));
    assert.ok(pick, "the existing variant picker");
    await click(pick);
    const dlg = q(win.document.body, "branding-approval");
    assert.ok(dlg);
    assert.ok(q(dlg, "branding-mockup"), "Printful mockup shown");
    assert.ok(q(dlg, "branding-placement-proposal"), "local placement proposal shown, labelled");
    assert.match(text(dlg), /Placement proposal/);
    assert.match(text(dlg), /This drawing is not a photo of the product/);
    assert.match(text(q(dlg, "branding-printed-size")), /^Printed size: [\d.]+ × [\d.]+ in$/);
    await act(async () => { q(dlg, "branding-rights").click(); });
    assert.equal(q(dlg, "branding-approve").disabled, true, "approval stays disabled: checkout not connected (Q1 open)");
    assert.ok(q(dlg, "branding-not-open"));
    assert.equal(ON.cartCalls.length, 0);
    // an unsupported product still adds through the normal path
    await click([...dlg.querySelectorAll("button")].find((b) => /Back to products/.test(text(b))));
    await click(q(m.host, "gift-card-action-999000111"));
    assert.equal(ON.cartCalls.length, 1);
  } finally { await m.unmount(); }
});
