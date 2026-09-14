// scripts/render-flowers-send-flow.mjs
//
// Renders the CORRECTED flower-in-send-flow surfaces to standalone HTML files, so the interaction can
// be looked at rather than only described.
//
// WHAT THESE ARE, AND WHAT THEY ARE NOT. They are the real components, bundled and mounted in jsdom
// against the same stubbed backend the browser tests use, with the resulting DOM written out. They
// are not screenshots: this environment has no browser to drive and no way to take one. These files
// open in any browser and show the real markup — the components style themselves inline, so they
// render faithfully on their own — and the founder can screenshot them from there.
//
// Run (Node 20.x):
//   node scripts/render-flowers-send-flow.mjs <outputDir>

import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join, resolve } from "node:path";
import { writeFileSync, rmSync, mkdirSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PC = join(ROOT, "src", "components", "providerCheckout");
const BUNDLE = join(PC, ".__render.bundle.mjs");
const ENTRY = join(PC, ".__render.entry.jsx");
const OUT = resolve(process.argv[2] || join(ROOT, "..", "reports", "send-flow-flowers"));

mkdirSync(OUT, { recursive: true });

writeFileSync(ENTRY,
  'export { default as Entry } from "./ProviderCheckoutEntry.jsx";\n'
  + 'export { default as Modal } from "./ProviderCheckoutModal.jsx";\n'
  + 'export { default as Selector } from "../GiftSelectorModal.jsx";\n'
  + 'export { default as Review } from "../PreSendReviewModal.jsx";\n'
  + 'export { MemoryRouter } from "react-router-dom";\n');
await esbuild.build({
  entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
  jsx: "automatic", jsxImportSource: "react",
  external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
  define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
  logLevel: "silent",
});
rmSync(ENTRY, { force: true });

const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/dashboard/send" });
const window = dom.window;
globalThis.window = window; globalThis.document = window.document;
globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
globalThis.getComputedStyle = window.getComputedStyle;
globalThis.localStorage = window.localStorage;
let RESOURCES = [];
window.performance.getEntriesByType = (t) => (t === "resource" ? RESOURCES : []);
const PRISTINE_APPEND_CHILD = window.document.head.appendChild;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const React = (await import("react")).default;
const act = React.act;
const { createRoot } = await import("react-dom/client");
const { Entry, Modal, Selector, Review, MemoryRouter } = await import(pathToFileURL(BUNDLE).href);

// --- the stubbed backend, identical to the browser tests -------------------
const TOKENIZER_URL = "https://tokenizer.example/v1/Accept.js";
const TOKENIZATION = {
  provider: "florist_one", rail: "authorize_net_accept_js", apiLoginId: "login-id",
  publicClientKey: "public-client-key", acceptJsUrl: TOKENIZER_URL, tokenizationKeyFingerprint: "fp-1",
};
const PREPARED = {
  ok: true, attemptId: "gpc_1", provider: "florist_one", giftType: "flowers", status: "preparing",
  currency: "USD", orderTotalMinor: 10694, deliveryDate: "2026-09-20", region: "US",
  quote: {
    provider: "florist_one", providerProductId: "T18-1A", providerVariantId: null,
    productMinor: 7499, shippingMinor: 2499, taxMinor: 696, feesMinor: 0,
    totalMinor: 10694, currency: "USD", taxKnown: true, quoteVersion: "qv-1",
  },
};
const PRODUCTS = [
  { providerProductId: "T18-1A", name: "Autumn Warmth Bouquet", priceMinor: 7499, currency: "USD", imageUrl: null, provider: "florist_one" },
  { providerProductId: "T163-1A", name: "Sunlit Roses", priceMinor: 6499, currency: "USD", imageUrl: null, provider: "florist_one" },
  { providerProductId: "C17-4867", name: "Garden Basket", priceMinor: 8999, currency: "USD", imageUrl: null, provider: "florist_one" },
];
let ROUTES = {};
globalThis.fetch = async (url, options = {}) => {
  const path = String(url);
  const handler = Object.entries(ROUTES).find(([k]) => path.includes(k))?.[1];
  const payload = handler ? await handler() : { ok: true };
  return { status: 200, ok: true, headers: { get: () => null }, json: async () => payload };
};
window.fetch = globalThis.fetch;
const live = (o = {}) => ({
  "/provider-checkout/availability": async () => ({ ok: true, available: true }),
  "/provider-checkout/catalog": async () => ({ ok: true, products: PRODUCTS }),
  "/provider-checkout/tokenization": async () => ({ ok: true, tokenization: TOKENIZATION }),
  "/provider-checkout/prepare": async () => PREPARED,
  ...o,
});
function installTokenizer() {
  const original = PRISTINE_APPEND_CHILD.bind(window.document.head);
  window.document.head.appendChild = (node) => {
    const appended = original(node);
    if (node.tagName === "SCRIPT" && node.src === TOKENIZER_URL) {
      window.Accept = {
        dispatchData: (p, cb) => cb({ messages: { resultCode: "Ok" }, opaqueData: { dataValue: "ONE-TIME-TOKEN" } }),
      };
      setTimeout(() => {
        node.dispatchEvent(new window.Event("load"));
        RESOURCES.push({ name: "https://tokenizer.example/v1/AcceptCore.js" });
      }, 0);
    }
    return appended;
  };
}

let host;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function mount(Component, props) {
  document.body.innerHTML = "";
  host = document.createElement("div");
  document.body.appendChild(host);
  await act(async () => {
    createRoot(host).render(React.createElement(MemoryRouter, null, React.createElement(Component, props)));
  });
  await flush();
}
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const byId = (id) => document.getElementById(id);
const setVal = (el, v) => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
};
const click = async (el) => {
  await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); });
  await flush(); await flush(); await flush();
};

/** Write the current DOM out as a standalone page, with a caption saying what step it is. */
let n = 0;
function capture(slug, caption) {
  n += 1;
  const name = `${String(n).padStart(2, "0")}-${slug}.html`;
  const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>${caption}</title>
<style>
  body { margin:0; font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif; background:#f1f5f9; color:#0f172a; }
  .cap { padding:14px 18px; background:#0f172a; color:#e2e8f0; font-weight:600; }
  .cap small { display:block; font-weight:400; color:#94a3b8; margin-top:3px; }
  .stage { padding:24px; }
</style></head>
<body>
<div class="cap">${caption}<small>Greet-Me &mdash; flower checkout as an embedded step of Send Greet-Me. Rendered from the real components.</small></div>
<div class="stage">${document.body.innerHTML}</div>
</body></html>`;
  writeFileSync(join(OUT, name), page, "utf8");
  console.log("wrote", name);
}

// ===========================================================================
// 1. Choosing Flowers reveals the arrangements IN PLACE
// ===========================================================================
ROUTES = live();
const selectorProps = (type, product) => ({
  isOpen: true, onClose: () => {},
  occasions: [{ type: "just_because", date: "2026-09-20" }],
  occasionGiftSettings: { just_because: { type, autoGift: false, flowersProduct: product } },
  onGiftChange: () => {}, getOccasionLabel: () => "Birthday", getOccasionEmoji: () => "\u{1F381}",
  context: "oneoff",
  flowersCatalogue: React.createElement(Entry, {
    selectedCategory: "flowers", product: null, customer: null,
    onSelect: () => {}, selectedProductId: product?.providerProductId || null,
  }),
});

await mount(Selector, selectorProps("none", null));
capture("gift-options", "Step 1 &mdash; the optional gift, with Fresh Flowers now offered");

await mount(Selector, selectorProps("flowers", null));
capture("flowers-catalogue-inline", "Step 2 &mdash; choosing Flowers loads the catalogue in place, with no extra button between the option and the arrangements");

await mount(Selector, selectorProps("flowers", PRODUCTS[0]));
capture("flowers-chosen", "Step 3 &mdash; the arrangement is attached to the pending Greet-Me");

// The loading and failure states of the same surface.
let release;
ROUTES = live({ "/provider-checkout/catalog": () => new Promise((r) => { release = () => r({ ok: true, products: PRODUCTS }); }) });
await mount(Entry, { selectedCategory: "flowers", product: null, customer: null, onSelect: () => {} });
capture("catalogue-loading", "State &mdash; catalogue loading");
release();

ROUTES = live({ "/provider-checkout/catalog": async () => ({ ok: false, networkError: true, status: 0 }) });
await mount(Entry, { selectedCategory: "flowers", product: null, customer: null, onSelect: () => {} });
capture("catalogue-error", "State &mdash; the catalogue could not be read, with Try again (never shown as &ldquo;nothing available&rdquo;)");

ROUTES = live({ "/provider-checkout/catalog": async () => ({ ok: true, products: [] }) });
await mount(Entry, { selectedCategory: "flowers", product: null, customer: null, onSelect: () => {} });
capture("catalogue-empty", "State &mdash; the provider answered, and has nothing available");

// ===========================================================================
// 2. Send Greet-Me: one primary action
// ===========================================================================
await mount(Review, {
  isOpen: true, onClose: () => {},
  recipientName: "Debbie Hart", recipientEmail: "debbie@example.com",
  occasionLabel: "Birthday", messagePreview: "Happy birthday, Debbie — thinking of you today.",
  photoCount: 3, giftMode: "flowers",
  qrCashAttachment: null, curatedAttachment: null, marketplaceAttachments: null,
  flowersAttachment: {
    providerProductId: "T18-1A", name: "Autumn Warmth Bouquet", priceMinor: 7499, currency: "USD",
  },
  sending: false,
  onConfirmDirectSend: () => {}, onConfirmQRCashFresh: () => {}, onMarketplaceCheckout: () => {},
  onConfirmFlowersCheckout: () => {}, onRemoveAttachment: () => {},
});
capture("send-review", "Step 4 &mdash; Send Greet-Me stays the single primary action; payment is its next step");

// ===========================================================================
// 3. The embedded checkout, through to the accepted handoff
// ===========================================================================
ROUTES = live({
  "/provider-checkout/submit": async () => ({
    ok: true, status: "accepted", providerOrderId: "210103981",
    dispatched: "yes", customerCharged: "yes", checkout: { provider: "florist_one" },
  }),
});
installTokenizer();
await mount(Modal, {
  isOpen: true, onClose: () => {}, giftType: "flowers", product: PRODUCTS[0],
  customer: { firstName: "Daniel", lastName: "Hart", email: "daniel@example.com" },
  onAccepted: () => {},
});
capture("checkout-details", "Step 5 &mdash; the existing checkout opens on the chosen arrangement, still inside the send");

setVal(byId("pc-delivery-date"), "2026-09-20");
setVal(byId("pc-first"), "Debbie");
setVal(byId("pc-last"), "Hart");
setVal(byId("pc-address1"), "12 Elm Street");
setVal(byId("pc-city"), "Newark");
setVal(byId("pc-state"), "NJ");
setVal(byId("pc-zip"), "07102");
setVal(byId("pc-recipient-phone"), "(201) 555-0123");
setVal(byId("pc-message"), "Happy birthday, Debbie!");
setVal(byId("pc-billing-line1"), "1 Sender Street");
setVal(byId("pc-billing-city"), "Hoboken");
setVal(byId("pc-billing-state"), "NJ");
setVal(byId("pc-billing-zip"), "07030");
setVal(byId("pc-cust-first"), "Daniel");
setVal(byId("pc-cust-email"), "daniel@example.com");
setVal(byId("pc-cust-phone"), "(973) 555-1111");
await flush();
await click(tid("provider-checkout-continue"));
for (let i = 0; i < 40 && tid("provider-checkout-securing"); i += 1) await flush();
capture("checkout-payment", "Step 6 &mdash; the florist&rsquo;s own quote, approved before anything is charged");

setVal(byId("pc-card"), "4111111111111111");
setVal(byId("pc-exp-month"), "01");
setVal(byId("pc-exp-year"), "30");
setVal(byId("pc-cvv"), "123");
await flush();
if (tid("provider-checkout-accept-price")) await click(tid("provider-checkout-accept-price"));
await click(tid("provider-checkout-pay"));
capture("accepted-handoff", "Step 7 &mdash; order accepted, and NO &ldquo;Done&rdquo;: it says &ldquo;Sending your Greet-Me&hellip;&rdquo; instead");

// The same order in the marketplace's standalone checkout, which is unchanged and still ends in Done.
await mount(Modal, {
  isOpen: true, onClose: () => {}, giftType: "flowers", product: PRODUCTS[0],
  customer: { firstName: "Daniel", email: "daniel@example.com" },
});
setVal(byId("pc-delivery-date"), "2026-09-20");
setVal(byId("pc-first"), "Debbie");
setVal(byId("pc-address1"), "12 Elm Street");
setVal(byId("pc-city"), "Newark");
setVal(byId("pc-state"), "NJ");
setVal(byId("pc-zip"), "07102");
setVal(byId("pc-recipient-phone"), "(201) 555-0123");
setVal(byId("pc-message"), "Happy birthday, Debbie!");
setVal(byId("pc-billing-line1"), "1 Sender Street");
setVal(byId("pc-billing-city"), "Hoboken");
setVal(byId("pc-billing-state"), "NJ");
setVal(byId("pc-billing-zip"), "07030");
setVal(byId("pc-cust-first"), "Daniel");
setVal(byId("pc-cust-email"), "daniel@example.com");
setVal(byId("pc-cust-phone"), "(973) 555-1111");
await flush();
await click(tid("provider-checkout-continue"));
for (let i = 0; i < 40 && tid("provider-checkout-securing"); i += 1) await flush();
setVal(byId("pc-card"), "4111111111111111");
setVal(byId("pc-exp-month"), "01");
setVal(byId("pc-exp-year"), "30");
setVal(byId("pc-cvv"), "123");
await flush();
if (tid("provider-checkout-accept-price")) await click(tid("provider-checkout-accept-price"));
await click(tid("provider-checkout-pay"));
capture("standalone-still-done", "Unchanged for comparison &mdash; the marketplace checkout, with no greeting waiting, still ends in Done");

rmSync(BUNDLE, { force: true });
console.log("\nOutput directory:", OUT);
