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
import { writeFileSync, rmSync, readFileSync } from "node:fs";
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
  writeFileSync(T("auth.js"), "export const useAuth = () => ({ user: globalThis.__TEST_SIGNED_OUT ? null : { id: 'u1', email: 'a@example.com', name: 'A' } });\nexport default { useAuth };\n");
  writeFileSync(T("api.js"),
    "const merch = " + JSON.stringify(MERCH_PRODUCTS) + ";\n"
    + "async function request(url = '') { if (String(url).includes('/api/merch/products')) return { products: merch }; return {}; }\n"
    + "async function getGiftCatalog() { return { ok: true, products: [{ id: 'am-1', title: 'Liberty Flag Mug', description: 'Founder-designed Americana.', priceCents: 2500, currency: 'USD', greetMeCategories: ['americana'], images: [{ url: 'https://example.test/am.jpg' }], source: 'printful' }] }; }\nasync function getSmartCardTiles() { return { ok: false }; }\n"
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
    + "  mockupFor: (id) => (id === 5298267871 ? 'https://example.test/mockup-mug.jpg' : null),\n"
    + "  eligible: () => (globalThis.__TEST_ELIGIBLE || [431624815, 431623973, 431622804, 431621330]),\n"
    + "  approveOk: () => globalThis.__TEST_APPROVE_OK === true });\n"
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
        h(mod.Route, { path: "/business", element: h("div", { "data-testid": "business-page" }, "BUSINESS") }),
        h(mod.Route, { path: "/login", element: h("div", { "data-testid": "login-page" }, "LOGIN") }))));
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
    assert.ok(!q(m.host, "gift-card-999000111"), "153E: a product the founder has not designated is not in the Brand for My Company assortment");
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
    assert.equal(q(dlg, "branding-approve").disabled, false, "153I: preview ready + rights ticked → approve is available");
    await click(q(dlg, "branding-approve"));
    assert.match(text(q(win.document.body, "branding-error")), /placement hasn’t been approved yet/, "the server refuses (no placement approval exists today)");
    assert.equal(ON.cartCalls.length, 0, "nothing reaches the cart without a signed approval");
    // a product that is not designated keeps its normal path (after Clear branding it is back, unbranded)
    await click([...q(win.document.body, "branding-approval").querySelectorAll("button")].find((b) => /Back to products/.test(text(b))));
    await click(q(m.host, "branding-clear"));
    await click(q(m.host, "gift-card-action-999000111"));
    assert.equal(ON.cartCalls.length, 1);
    assert.equal(ON.cartCalls[0].printfulSyncVariantId, 999000112);
  } finally { await m.unmount(); }
});

// ── 153C: signed out / sign-in expired ──────────────────────────────────────────────────────
test("ON, signed out: the button opens a sign-in step, not the upload; nothing is uploaded; Sign in goes to /login", async () => {
  ON.__resetBrandingSession();
  globalThis.__TEST_SIGNED_OUT = true;
  const m = await mount(ON);
  try {
    const before = ON.__api.calls.length;
    await click(brandButton(m.host));
    const dlg = q(win.document.body, "branding-signin-step");
    assert.ok(dlg, "sign-in step shown");
    assert.equal(text(dlg.querySelector("h2")), "Sign in to brand with your logo");
    assert.match(text(dlg), /Your logo is kept in your Greet-Me account, so only you can see it, replace it or clear it\./);
    assert.ok(!q(dlg, "branding-signin-expired"), "no 'expired' line for a customer who was never signed in");
    assert.equal(win.document.querySelectorAll('input[type="file"]').length, 0, "no file input while signed out");
    assert.equal(ON.__api.calls.length, before, "no branding API call while signed out");
    await click(q(dlg, "branding-signin"));
    assert.ok(q(m.host, "login-page"), "navigated to /login");
    assert.ok(!q(win.document.body, "branding-signin-step"));
  } finally { globalThis.__TEST_SIGNED_OUT = false; await m.unmount(); }
});

test("ON: a sign-in that expires mid-session (401) drops the local branding and asks to sign in again", async () => {
  ON.__resetBrandingSession();
  const m = await mount(ON);
  const real = ON.__api.getMockups;
  try {
    // The upload itself succeeds; the first mockup read (made right after it) is answered 401.
    ON.__api.getMockups = async () => ({ ok: false, status: 401 });
    await click(brandButton(m.host));
    await chooseFile(m.host, "logo.png");
    await tick(); await tick();
    const dlg = q(win.document.body, "branding-signin-step");
    assert.ok(dlg, "sign-in step shown");
    assert.equal(text(q(dlg, "branding-signin-expired")), "Your sign-in has expired. Sign in again to brand products with your logo.");
    assert.equal(m.host.querySelectorAll('[data-testid^="gift-card-branding-"]').length, 0, "local branding dropped");
    assert.ok(!q(m.host, "branding-controls"));
  } finally { ON.__api.getMockups = real; await m.unmount(); }
});

test("ON: an upload answered 401 shows the sign-in step instead of a generic upload error", async () => {
  ON.__resetBrandingSession();
  const m = await mount(ON);
  const real = ON.__api.uploadLogo;
  try {
    ON.__api.uploadLogo = async () => ({ ok: false, status: 401, error: "Invalid or expired token" });
    await click(brandButton(m.host));
    await chooseFile(m.host, "logo.png");
    assert.ok(!q(win.document.body, "branding-logo-step"));
    assert.ok(q(win.document.body, "branding-signin-expired"));
    assert.ok(!q(win.document.body, "branding-error"), "the server's raw message is not shown");
  } finally { ON.__api.uploadLogo = real; await m.unmount(); }
});

// ── 153E: founder-designated products only ──────────────────────────────────────────────────
const chip = (host, label) => [...host.querySelectorAll("button")].find((b) => text(b) === label);

test("ON, nothing designated (today's state): no upload, a 'not open yet' step, and Contact goes to the business team", async () => {
  ON.__resetBrandingSession();
  globalThis.__TEST_ELIGIBLE = [];
  const m = await mount(ON);
  try {
    const before = ON.__api.calls.filter((c) => c === "uploadLogo").length;
    await click(brandButton(m.host));
    const dlg = q(win.document.body, "branding-none-eligible");
    assert.ok(dlg, "the not-open step");
    assert.equal(text(dlg.querySelector("h2")), "Logo branding isn’t open yet");
    assert.equal(win.document.querySelectorAll('input[type="file"]').length, 0, "no file chooser");
    assert.equal(ON.__api.calls.filter((c) => c === "uploadLogo").length, before);
    assert.equal(m.host.querySelectorAll('[data-testid^="gift-card-branding-"]').length, 0, "no card changes");
    await click(q(dlg, "branding-contact-business"));
    assert.ok(q(m.host, "business-page"), "today's contact-sales route");
  } finally { globalThis.__TEST_ELIGIBLE = undefined; await m.unmount(); }
});

test("ON, one designated product (EXAMPLE: the mug): only it is in the branded assortment; Clear brings the rest back unchanged", async () => {
  ON.__resetBrandingSession();
  globalThis.__TEST_ELIGIBLE = [431622804];
  const m = await mount(ON);
  try {
    const cardsBefore = [...m.host.querySelectorAll('[data-testid^="gift-card-"][data-testid$="1"], [data-testid^="gift-card-4"], [data-testid^="gift-card-9"]')].length;
    await click(brandButton(m.host));
    await chooseFile(m.host, "logo.png");
    await tick(); await tick();
    assert.equal(text(q(m.host, "gift-card-branding-431622804")), "Your logo");
    assert.ok(!q(m.host, "gift-card-431623973"), "laptop sleeve: not designated, not shown in the assortment");
    assert.ok(!q(m.host, "gift-card-999000111"));
    await click(q(m.host, "branding-clear"));
    assert.ok(q(m.host, "gift-card-431623973") && q(m.host, "gift-card-999000111"), "the collection is back");
    assert.equal(m.host.querySelectorAll('[data-testid^="gift-card-branding-"]').length, 0, "unbranded");
    assert.ok(cardsBefore > 0);
  } finally { globalThis.__TEST_ELIGIBLE = undefined; await m.unmount(); }
});

test("ON, logo applied: an Americana product (founder design) is exactly as before — no label, no mockup, same card", async () => {
  ON.__resetBrandingSession();
  globalThis.__TEST_ELIGIBLE = [431622804];
  const m = await mount(ON);
  try {
    await click(chip(m.host, "Americana"));
    const card = q(m.host, "gift-card-am-1");
    assert.ok(card, "the Americana card renders");
    const htmlBefore = card.outerHTML;
    await click(chip(m.host, "Branded Goods") || chip(m.host, "Brandable Goods"));
    await click(brandButton(m.host));
    await chooseFile(m.host, "logo.png");
    await click(chip(m.host, "Americana"));
    const after = q(m.host, "gift-card-am-1");
    assert.equal(after.outerHTML, htmlBefore, "identical markup with a logo applied");
    assert.equal(m.host.querySelectorAll('[data-testid^="gift-card-branding-"]').length, 0);
  } finally { globalThis.__TEST_ELIGIBLE = undefined; await m.unmount(); }
});

// ── 153I: one upload, every designated product; the approved artwork rides the EXISTING add-to-cart ──
test("ON: ONE logo upload brands every designated product; approving a variant adds the existing cart line carrying the approval", async () => {
  ON.__resetBrandingSession();
  globalThis.__TEST_APPROVE_OK = true;
  const m = await mount(ON);
  try {
    const before = ON.__api.calls.filter((c) => c === "uploadLogo").length;
    await click(brandButton(m.host));
    await chooseFile(m.host, "logo.png");
    await tick(); await tick();
    assert.equal(ON.__api.calls.filter((c) => c === "uploadLogo").length - before, 1, "uploaded once");
    for (const id of ["431622804", "431623973"]) assert.ok(q(m.host, `gift-card-branding-${id}`), `product ${id} branded from the same logo`);
    ON.cartCalls.length = 0;
    await click(q(m.host, "gift-card-action-431622804"));
    await click([...win.document.querySelectorAll("button")].find((b) => /11 oz/.test(text(b))));
    const dlg = q(win.document.body, "branding-approval");
    await act(async () => { q(dlg, "branding-rights").click(); });
    await click(q(dlg, "branding-approve"));
    await tick(); await tick();
    assert.ok(!q(win.document.body, "branding-approval"), "the approval step closes");
    assert.equal(ON.cartCalls.length, 1, "one line, through the existing add-to-cart");
    const line = ON.cartCalls[0];
    assert.equal(line.printfulSyncVariantId, 5298267871, "the same store variant the existing checkout prices");
    assert.equal(line.priceCents, 1400, "the existing price, unchanged");
    assert.match(line.branding.approvalToken, /^memory-approval\..+\.5298267871$/);
    assert.equal(line.branding.logoId, line.branding.approvalToken.split(".")[1]);
    assert.equal(line.name, "White Glossy Mug — 11 oz", "the existing cart name, unchanged (a longer name clips the phone cart row)");
    assert.equal(line.category, "Merch · with your logo", "branding shown on the existing category line");
    assert.equal(ON.__api.calls.filter((c) => c === "uploadLogo").length - before, 1, "no second upload");
  } finally { globalThis.__TEST_APPROVE_OK = false; await m.unmount(); }
});

test("Checkout sends each branded line's approval with its store variant; every other line is unchanged", () => {
  const src = readFileSync(join(PAGES, "Checkout.jsx"), "utf8");
  assert.match(src, /\.map\(\(i\) => \(\{ syncVariantId: i\.printfulSyncVariantId, \.\.\.\(i\.branding \? \{ branding: \{ approvalToken: i\.branding\.approvalToken, logoId: i\.branding\.logoId \} \} : \{\}\) \}\)\);/);
});

test("ON: switching variant in the placement view keeps the logo and updates preview, print area and printed size", async () => {
  ON.__resetBrandingSession();
  const m = await mount(ON);
  try {
    await click(brandButton(m.host));
    await chooseFile(m.host, "logo.png");
    await click(q(m.host, "gift-card-branding-431622804"));
    const dlg = q(win.document.body, "branding-placement");
    const size11 = text(q(dlg, "branding-printed-size"));
    assert.ok(q(dlg, "branding-mockup"), "11 oz: Printful mockup shown");
    const vb11 = dlg.querySelector('[data-testid="branding-placement-proposal"] svg').getAttribute("viewBox");
    await click([...dlg.querySelectorAll("button")].find((b) => text(b) === "20 oz"));
    const vb20 = dlg.querySelector('[data-testid="branding-placement-proposal"] svg').getAttribute("viewBox");
    assert.notEqual(vb20, vb11, "the 20 oz print area is used");
    assert.notEqual(text(q(dlg, "branding-printed-size")), size11, "printed size recomputed for the 20 oz area");
    assert.ok(q(dlg, "branding-mockup-pending"), "20 oz: its own preview (preparing), never the 11 oz image");
    assert.ok(dlg.querySelector('[data-testid="branding-placement-proposal"] image, [data-testid="branding-placement-proposal"] rect[opacity="0.15"]'), "the same logo is placed (jsdom has no blob URLs, so the logo box stands in)");
  } finally { await m.unmount(); }
});

// ── "Remember my logo" (approved: opt-in, with a delete control) ──────────────────────────────
test("ON: Remember my logo is OFF by default; opted in, the saved logo is offered next visit, re-brands in one click, and can be deleted", async () => {
  ON.__resetBrandingSession();
  let m = await mount(ON);
  try {
    await click(brandButton(m.host));
    assert.equal(q(win.document.body, "branding-remember").checked, false, "opt-in");
    assert.ok(!q(win.document.body, "branding-saved-logo"), "nothing saved yet");
    await act(async () => { q(win.document.body, "branding-remember").click(); });
    await chooseFile(m.host, "logo.png");
    assert.ok(q(m.host, "gift-card-branding-431622804"));
  } finally { await m.unmount(); }
  ON.__resetBrandingSession(); // a later visit
  m = await mount(ON);
  try {
    await click(brandButton(m.host));
    await tick(); await tick();
    const savedBox = q(win.document.body, "branding-saved-logo");
    assert.ok(savedBox, "the saved logo is offered");
    assert.equal(text(q(savedBox, "branding-use-saved")), "Use my saved logo");
    assert.equal(text(q(savedBox, "branding-delete-saved")), "Delete my saved logo");
    await click(q(savedBox, "branding-use-saved"));
    assert.ok(!q(win.document.body, "branding-logo-step"));
    assert.equal(text(q(m.host, "gift-card-branding-431622804")), "Your logo", "branded again without a new upload");
    await click(q(m.host, "branding-clear"));
    await click(brandButton(m.host));
    await tick(); await tick();
    assert.ok(q(win.document.body, "branding-saved-logo"), "Clear branding keeps the saved logo");
    await click(q(win.document.body, "branding-delete-saved"));
    assert.ok(!q(win.document.body, "branding-saved-logo"), "deleted");
    assert.ok(ON.__api.calls.includes("deleteSavedLogo"));
  } finally { await m.unmount(); }
});

test("N2: 'Delete my saved logo' hides it only after the server confirms; a refusal keeps it shown with an error line", async () => {
  ON.__resetBrandingSession();
  let m = await mount(ON);
  try {
    await click(brandButton(m.host));
    await act(async () => { q(win.document.body, "branding-remember").click(); });
    await chooseFile(m.host, "logo.png");
  } finally { await m.unmount(); }
  ON.__resetBrandingSession();
  m = await mount(ON);
  const real = ON.__api.clearLogo;
  try {
    ON.__api.clearLogo = async () => ({ ok: false, status: 409, code: "LOGO_CHANGED" });
    await click(brandButton(m.host));
    await tick(); await tick();
    await click(q(win.document.body, "branding-delete-saved"));
    assert.ok(q(win.document.body, "branding-saved-logo"), "still shown after a refusal");
    assert.equal(text(q(win.document.body, "branding-saved-error")), "We couldn’t delete your saved logo. Please try again.");
    ON.__api.clearLogo = real;
    await click(q(win.document.body, "branding-delete-saved"));
    assert.ok(!q(win.document.body, "branding-saved-logo"), "hidden once the server confirms");
  } finally { ON.__api.clearLogo = real; await m.unmount(); }
});

test("153J C7: when an order needs the logo, the order-dependency line is shown — never the temporary-failure line", async () => {
  ON.__resetBrandingSession();
  let m = await mount(ON);
  try {
    await click(brandButton(m.host));
    await act(async () => { q(win.document.body, "branding-remember").click(); });
    await chooseFile(m.host, "logo.png");
  } finally { await m.unmount(); }
  ON.__resetBrandingSession();
  m = await mount(ON);
  const real = ON.__api.clearLogo;
  const NEEDED = "We can’t delete this logo because it’s needed for one of your orders.";
  try {
    // (a) the delete was refused because an order took the logo meanwhile (409 retainedForOrder): row stays.
    ON.__api.clearLogo = async () => ({ ok: false, status: 409, code: "LOGO_IN_USE", retainedForOrder: true });
    await click(brandButton(m.host));
    await tick(); await tick();
    await click(q(win.document.body, "branding-delete-saved"));
    assert.ok(q(win.document.body, "branding-saved-logo"), "still shown");
    assert.equal(text(q(win.document.body, "branding-saved-retained")), NEEDED);
    assert.ok(!q(win.document.body, "branding-saved-error"), "no temporary-failure line");
    // (b) the server stopped offering it but kept it for the order (ok + retainedForOrder): row gone, line shown.
    ON.__api.clearLogo = async () => ({ ok: true, cleared: true, retainedForOrder: true, forgotten: true });
    await click(q(win.document.body, "branding-delete-saved"));
    assert.ok(!q(win.document.body, "branding-saved-logo"), "no longer offered");
    assert.equal(text(q(win.document.body, "branding-saved-retained")), NEEDED);
    assert.ok(!q(win.document.body, "branding-saved-error"));
    // (c) a temporary failure still shows only the approved temporary-failure line.
    ON.__api.clearLogo = real;
  } finally { ON.__api.clearLogo = real; await m.unmount(); }
  ON.__resetBrandingSession();
  m = await mount(ON);
  try {
    ON.__api.clearLogo = async () => ({ ok: false, status: 409, code: "LOGO_CHANGED" });
    await click(brandButton(m.host));
    await tick(); await tick();
    assert.ok(!q(win.document.body, "branding-saved-retained"), "a reopened step starts clean");
    await click(q(win.document.body, "branding-delete-saved"));
    assert.equal(text(q(win.document.body, "branding-saved-error")), "We couldn’t delete your saved logo. Please try again.");
    assert.ok(!q(win.document.body, "branding-saved-retained"), "no order-dependency claim on a temporary failure");
  } finally { ON.__api.clearLogo = real; await m.unmount(); }
});
