// scripts/render-gift-place-confirmation.mjs
//
// Renders the Gift Place's uniform "Added to Cart!" confirmation to standalone HTML files — a standard
// product and a flower side by side, and the catalogue the shopper is returned to by Continue Shopping.
//
// WHAT THESE ARE. The REAL Merch page (the Gift Place), bundled and mounted in jsdom with only its
// side-effecting edges stubbed (auth, the API client, the cart, the provider transport). The real
// useProviderCatalogue hook runs on that stubbed transport, so the posture gate is the real one. The
// resulting DOM is written out. They are not screenshots: this environment has no browser. The page
// styles itself inline, so the files render faithfully on their own — open them in any browser.
//
// ALL DATA IS SYNTHETIC. No network, no provider call, no order, no tokenization, no charge, no
// greeting, no recipient contact. The real Florist One order number appears nowhere.
//
// Run (Node 20.x):
//   node scripts/render-gift-place-confirmation.mjs

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PAGES = join(ROOT, "src", "pages");
const OUT = join(ROOT, "..", "reports", "gift-place-confirmation");

const BUNDLE = join(PAGES, ".__rgpc.bundle.mjs");
const ENTRY = join(PAGES, ".__rgpc.entry.jsx");
const AUTH_STUB = join(PAGES, ".__rgpc.auth.js");
const API_STUB = join(PAGES, ".__rgpc.api.js");
const CART_STUB = join(PAGES, ".__rgpc.cart.js");
const PROVIDER_STUB = join(PAGES, ".__rgpc.provider.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, CART_STUB, PROVIDER_STUB];

const DESKTOP_WIDTH = 1280;

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

function writeStubs() {
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
    + "export default {\n"
    + "  getCart: () => items, addItem: (i) => { items.push(i); return items; },\n"
    + "  removeItem: () => items, updateItem: () => items, getTotal: () => 0,\n"
    + "  getCount: () => items.length, clear: () => { items = []; }, hasItem: () => false,\n"
    + "  hasMerch: () => false, hasNonMerch: () => false, clearMerch: () => {},\n"
    + "};\n");
  writeFileSync(PROVIDER_STUB,
    "const flowers = " + JSON.stringify(FLOWERS) + ";\n"
    + "export async function fetchCheckoutAvailability(t) { return { available: t === 'flowers', purchasable: t === 'flowers' }; }\n"
    + "export async function fetchProviderCatalog(t) { return { ok: true, products: t === 'flowers' ? flowers : [] }; }\n"
    + "export async function retryGiftLink() { throw new Error('not authorized in rendering'); }\n"
    + "export async function prepareCheckout() { throw new Error('not authorized in rendering'); }\n"
    + "export async function submitCheckout() { throw new Error('not authorized in rendering'); }\n");
  writeFileSync(ENTRY,
    'export { default as Merch } from "./Merch.jsx";\n'
    + 'export { MemoryRouter } from "react-router-dom";\n');
}

const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeStubs();

  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl" },
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
        build.onResolve({ filter: /.*/ }, (a) => {
          const hit = STUBS.get(a.path);
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
  const { window } = dom;
  Object.assign(global, {
    window, document: window.document, navigator: window.navigator,
    HTMLElement: window.HTMLElement, Node: window.Node,
    getComputedStyle: window.getComputedStyle,
    sessionStorage: window.sessionStorage, localStorage: window.localStorage,
    Event: window.Event, CustomEvent: window.CustomEvent,
    requestAnimationFrame: (cb) => window.setTimeout(cb, 0),
    cancelAnimationFrame: (id) => window.clearTimeout(id),
    IS_REACT_ACT_ENVIRONMENT: true,
  });
  global.fetch = async () => { throw new Error("offline rendering makes no network request"); };
  window.fetch = global.fetch;
  Object.defineProperty(window, "innerWidth", { value: DESKTOP_WIDTH, configurable: true });
  window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {} });

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = React;
  const { Merch, MemoryRouter } = await import(pathToFileURL(BUNDLE).href);

  const host = window.document.getElementById("root");
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(MemoryRouter, { initialEntries: ["/dashboard/merch?returnTo=send"] },
      React.createElement(Merch)));
  });
  const settle = async () => { await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); }); };
  await settle();

  const click = async (el) => {
    await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    await settle();
  };
  const snap = (file, label) => {
    const banner = `<div style="font:600 13px system-ui;padding:10px 14px;background:#111;color:#fff">`
      + `Greet-Me Gift Place — ${label} — rendered offline at ${DESKTOP_WIDTH}px. Synthetic data only.</div>`;
    writeFileSync(join(OUT, file),
      `<!doctype html><html><head><meta charset="utf-8"><title>Gift Place — ${label}</title></head>`
      + `<body style="margin:0;background:#f6f7f9">${banner}`
      + `<div style="width:${DESKTOP_WIDTH}px;margin:0 auto;background:#fff">${host.innerHTML}</div>`
      + `</body></html>`, "utf8");
    console.log(`wrote ${file}`);
  };

  const actions = () => [...host.querySelectorAll('[data-testid^="gift-card-action-"]')];
  const button = (re) => [...host.querySelectorAll("button")].find((b) => re.test(text(b)));

  // 1 — a STANDARD product's confirmation, on the default category.
  const merchBtn = actions().find((b) => /MERCH-1/.test(b.getAttribute("data-testid") || ""));
  if (!merchBtn) throw new Error("the standard product card did not render");
  await click(merchBtn);
  snap("01-standard-product-confirmation.html", "standard product — Added to Cart!");
  await click(button(/Continue Shopping/));

  // 2 — a FLOWER, in the same confirmation.
  const flowersTile = [...host.querySelectorAll("button, div[role='button'], label")]
    .find((el) => text(el) === "Flowers" || /^Flowers/.test(text(el)));
  if (!flowersTile) throw new Error("the Flowers category control did not render");
  await click(flowersTile);
  await settle();
  const flowerBtn = actions()[0];
  if (!flowerBtn) throw new Error("the flower catalogue did not render");
  await click(flowerBtn);
  snap("02-flower-confirmation.html", "flower — the SAME Added to Cart! surface");

  // 3 — Continue Shopping puts the shopper back in the same flower catalogue.
  await click(button(/Continue Shopping/));
  snap("03-continue-shopping-same-catalogue.html", "after Continue Shopping — same flower catalogue");

  await act(() => root.unmount());
  console.log(`\nOutput directory: ${OUT}`);
}

main()
  .catch((e) => { console.error("FAILED:", e?.message || e); process.exitCode = 1; })
  .finally(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } } });
