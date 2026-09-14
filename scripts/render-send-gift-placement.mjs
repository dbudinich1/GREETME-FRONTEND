// scripts/render-send-gift-placement.mjs
//
// Renders the Send form's top field row at ONE desktop width, in three gift states, to standalone
// HTML files — so the Recipient | Occasion | Tone region can be compared across them by eye.
//
// WHAT THESE ARE. The REAL SendGreeting page, bundled and mounted in jsdom with only its
// side-effecting edges stubbed (auth, the API client, the cart), and the resulting DOM written out.
// They are not screenshots: this environment has no browser. The page styles itself inline, so the
// files render faithfully on their own — open them in any browser and screenshot from there.
//
// ALL DATA IS SYNTHETIC. No network, no provider call, no order, no tokenization, no charge, no
// greeting, no recipient contact. The flower is a made-up DEMO product and the real Florist One order
// number is deliberately absent.
//
// Run (Node 20.x):
//   node scripts/render-send-gift-placement.mjs

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PAGES = join(ROOT, "src", "pages");
const OUT = join(ROOT, "..", "reports", "send-gift-placement");

const BUNDLE = join(PAGES, ".__rsgp.bundle.mjs");
const ENTRY = join(PAGES, ".__rsgp.entry.jsx");
const AUTH_STUB = join(PAGES, ".__rsgp.auth.js");
const API_STUB = join(PAGES, ".__rsgp.api.js");
const CART_STUB = join(PAGES, ".__rsgp.cart.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, CART_STUB];

const DESKTOP_WIDTH = 1280;
const CONTACTS = [{ id: "c1", name: "Dana Example", email: "dana@example.com" }];

/** A made-up arrangement. Nothing here corresponds to a real order. */
const FLOWER_PRODUCT = {
  providerProductId: "DEMO-T18",
  name: "Sunlit Rose Bouquet",
  priceMinor: 6499,
  currency: "USD",
  imageUrl: "https://example.test/demo-rose.jpg",
};

const BASE_FORM = { contactId: "c1", occasionType: "Birthday", tone: "Heartfelt" };

const STATES = [
  { file: "01-no-gift.html", label: "No gift selected", search: "", saved: null },
  {
    file: "02-qr-cash-selected.html",
    label: "QR Cash selected",
    search: "?returnTo=send&giftType=qrcash",
    saved: { formData: BASE_FORM, giftSettings: { type: "qrcash", amount: 25 } },
  },
  {
    file: "03-flower-selected.html",
    label: "Flower selected",
    search: "?returnTo=send&giftType=flowers",
    saved: { formData: BASE_FORM, giftSettings: { type: "flowers", flowersProduct: FLOWER_PRODUCT } },
  },
];

function writeStubs() {
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => ({\n"
    + "  user: { id: 'u1', email: 'sender@example.com', name: 'Sender', emailVerified: true,\n"
    + "          tier: 'close_circle', profilePhoto: null },\n"
    + "  refreshUser: async () => {},\n"
    + "});\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");
  writeFileSync(API_STUB,
    "const contacts = " + JSON.stringify(CONTACTS) + ";\n"
    + "async function get(url = '') {\n"
    + "  if (String(url).includes('contacts')) return { data: { contacts } };\n"
    + "  return { data: {} };\n"
    + "}\n"
    + "const noop = async () => ({ data: {} });\n"
    + "export default { get, post: noop, put: noop, patch: noop, delete: noop, request: noop };\n");
  writeFileSync(CART_STUB,
    "let items = [];\n"
    + "export default {\n"
    + "  getCart: () => items, addItem: () => items, removeItem: () => items, updateItem: () => items,\n"
    + "  getTotal: () => 0, getCount: () => items.length, clear: () => { items = []; },\n"
    + "  hasItem: () => false, hasMerch: () => false, hasNonMerch: () => false, clearMerch: () => {},\n"
    + "};\n");
  writeFileSync(ENTRY,
    'export { default as SendGreeting } from "./SendGreeting.jsx";\n'
    + 'export { MemoryRouter } from "react-router-dom";\n');
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  writeStubs();

  await esbuild.build({
    entryPoints: [ENTRY],
    outfile: BUNDLE,
    bundle: true,
    format: "esm",
    platform: "browser",
    jsx: "automatic",
    jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty" },
    plugins: [{
      name: "stub-side-effects",
      setup(build) {
        const STUBS = new Map([
          ["../context/AuthContext", AUTH_STUB],
          ["../api/api", API_STUB],
          ["../services/cartService", CART_STUB],
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

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = React;
  const { SendGreeting, MemoryRouter } = await import(pathToFileURL(BUNDLE).href);

  for (const state of STATES) {
    const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
      url: `http://localhost/dashboard/send${state.search}`,
      pretendToBeVisual: true,
    });
    const { window } = dom;
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
    global.IS_REACT_ACT_ENVIRONMENT = true;
    global.fetch = async () => { throw new Error("offline rendering makes no network request"); };
    window.fetch = global.fetch;
    // One desktop width for all three, so the comparison is about the layout and nothing else.
    Object.defineProperty(window, "innerWidth", { value: DESKTOP_WIDTH, configurable: true });
    window.matchMedia = (q) => ({
      matches: false, media: q, addEventListener() {}, removeEventListener() {},
      addListener() {}, removeListener() {},
    });

    if (state.saved) window.sessionStorage.setItem("sendGreetingState", JSON.stringify(state.saved));

    const host = window.document.getElementById("root");
    const root = createRoot(host);
    await act(async () => {
      root.render(
        React.createElement(
          MemoryRouter,
          { initialEntries: [`/dashboard/send${state.search}`] },
          React.createElement(SendGreeting),
        ),
      );
    });
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });

    const banner = `<div style="font:600 13px system-ui;padding:10px 14px;background:#111;color:#fff">`
      + `Send form — ${state.label} — rendered offline at ${DESKTOP_WIDTH}px. Synthetic data only.`
      + `</div>`;
    const html = `<!doctype html><html><head><meta charset="utf-8">`
      + `<title>Send form — ${state.label}</title></head>`
      + `<body style="margin:0;background:#f6f7f9">${banner}`
      + `<div style="width:${DESKTOP_WIDTH}px;margin:0 auto;background:#fff">${host.innerHTML}</div>`
      + `</body></html>`;
    writeFileSync(join(OUT, state.file), html, "utf8");
    console.log(`wrote ${state.file}`);

    await act(() => root.unmount());
  }

  console.log(`\nOutput directory: ${OUT}`);
}

main()
  .catch((e) => { console.error("FAILED:", e?.message || e); process.exitCode = 1; })
  .finally(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } } });
