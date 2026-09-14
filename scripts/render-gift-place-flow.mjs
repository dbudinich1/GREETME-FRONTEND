// scripts/render-gift-place-flow.mjs
//
// Renders the corrected Gift Place / send / QR states to standalone HTML files.
//
// WHAT THESE ARE, AND WHAT THEY ARE NOT. They are the REAL components, bundled and mounted in jsdom
// against a stubbed backend, with the resulting DOM written out. They are not screenshots: this
// environment has no browser to drive. The components style themselves inline, so the files render
// faithfully on their own — open them in any browser and screenshot from there.
//
// ALL DATA IS OBVIOUSLY SYNTHETIC, and the order reference is a fake one. The real order number from
// the controlled live test is deliberately not used anywhere in these demonstrations.
//
// Run (Node 20.x):
//   node scripts/render-gift-place-flow.mjs <outputDir>

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
const OUT = resolve(process.argv[2] || join(ROOT, "..", "reports", "gift-place-flow"));

mkdirSync(OUT, { recursive: true });

writeFileSync(ENTRY,
  'export { default as Modal } from "./ProviderCheckoutModal.jsx";\n'
  + 'export { default as Selector } from "../GiftSelectorModal.jsx";\n'
  + 'export { default as Review } from "../PreSendReviewModal.jsx";\n'
  + 'export { GiftProductGrid } from "../giftPlace/GiftProductCard.jsx";\n'
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
const { Modal, Selector, Review, GiftProductGrid, MemoryRouter } = await import(pathToFileURL(BUNDLE).href);

// --- the stubbed world, all synthetic -------------------------------------
const TOKENIZER_URL = "https://tokenizer.example/v1/Accept.js";
const TOKENIZATION = {
  provider: "florist_one", rail: "authorize_net_accept_js", apiLoginId: "login-id",
  publicClientKey: "public-client-key", acceptJsUrl: TOKENIZER_URL, tokenizationKeyFingerprint: "fp-1",
};
const PREPARED = {
  ok: true, attemptId: "gpc_demo", provider: "florist_one", giftType: "flowers", status: "preparing",
  currency: "USD", orderTotalMinor: 10694, deliveryDate: "2026-09-20", region: "US",
  quote: {
    provider: "florist_one", providerProductId: "DEMO-T18", providerVariantId: null,
    productMinor: 7499, shippingMinor: 2499, taxMinor: 696, feesMinor: 0,
    totalMinor: 10694, currency: "USD", taxKnown: true, quoteVersion: "qv-demo",
  },
};
// A FAKE reference, deliberately unlike any real order number.
const DEMO_ORDER = "DEMO-0000-TEST";

const FLOWER_CARDS = [
  { id: "DEMO-T18", source: "provider", name: "Autumn Warmth Bouquet", description: "A hand-tied seasonal arrangement in warm tones.", imageUrl: null, priceLabel: "$74.99", priceMinor: 7499 },
  { id: "DEMO-T163", source: "provider", name: "Sunlit Roses", description: "A dozen long-stemmed roses.", imageUrl: null, priceLabel: "$64.99", priceMinor: 6499 },
  { id: "DEMO-C17", source: "provider", name: "Garden Basket", description: "", imageUrl: null, priceLabel: "$89.99", priceMinor: 8999 },
];
const TECH_CARDS = [
  { id: "DEMO-SP1", source: "catalog", name: "Laptop Sleeve", description: "Additional sizes and models available", imageUrl: null, priceLabel: "$39 – $44", priceMinor: 3900 },
  { id: "DEMO-SP2", source: "catalog", name: "MagSafe tough case", description: "Additional sizes and models available", imageUrl: null, priceLabel: "$29", priceMinor: 2900 },
  { id: "DEMO-SP3", source: "catalog", name: "White glossy mug", description: "", imageUrl: null, priceLabel: "$15", priceMinor: 1500 },
];

let ROUTES = {};
globalThis.fetch = async (url) => {
  const path = String(url);
  const handler = Object.entries(ROUTES).find(([k]) => path.includes(k))?.[1];
  const payload = handler ? await handler() : { ok: true };
  return { status: 200, ok: true, headers: { get: () => null }, json: async () => payload };
};
window.fetch = globalThis.fetch;
const live = (o = {}) => ({
  "/provider-checkout/availability": async () => ({ ok: true, available: true }),
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
        dispatchData: (p, cb) => cb({ messages: { resultCode: "Ok" }, opaqueData: { dataValue: "DEMO-TOKEN" } }),
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
async function mountRaw(html) {
  document.body.innerHTML = `<div>${html}</div>`;
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

let n = 0;
function capture(slug, caption) {
  n += 1;
  const name = `${String(n).padStart(2, "0")}-${slug}.html`;
  const page = `<!doctype html>
<html><head><meta charset="utf-8"><title>${caption}</title>
<style>
  :root { --primary:#4F2D7F; --border:#e5e7eb; --bg-primary:#fff; --bg-secondary:#f1f5f9;
          --text-primary:#111827; --text-secondary:#6b7280; --text-tertiary:#9ca3af;
          --radius-md:8px; --radius-xl:14px; --shadow-lg:0 10px 30px rgba(0,0,0,.12); --error:#b91c1c; }
  body { margin:0; font:14px/1.5 -apple-system,Segoe UI,Roboto,sans-serif; background:#f1f5f9; color:#0f172a; }
  .cap { padding:14px 18px; background:#0f172a; color:#e2e8f0; font-weight:600; }
  .cap small { display:block; font-weight:400; color:#94a3b8; margin-top:3px; }
  .stage { padding:24px; max-width: 980px; }
  button { font-family: inherit; }
</style></head>
<body>
<div class="cap">${caption}<small>Greet-Me &mdash; rendered from the real components. Synthetic data only; the order reference is fake.</small></div>
<div class="stage">${document.body.innerHTML}</div>
</body></html>`;
  writeFileSync(join(OUT, name), page, "utf8");
  console.log("wrote", name);
}

const selectorProps = (type) => ({
  isOpen: true, onClose: () => {},
  occasions: [{ type: "just_because", date: "2026-09-20" }],
  occasionGiftSettings: { just_because: { type, autoGift: false } },
  onGiftChange: () => {}, getOccasionLabel: () => "Birthday", getOccasionEmoji: () => "\u{1F381}",
  context: "oneoff", onBrowse: () => {},
});

// 1 — Choose a Gift: exactly four choices
ROUTES = live();
await mount(Selector, selectorProps("none"));
capture("choose-a-gift", "1 &mdash; Choose a Gift: exactly four choices, single-select, no products");

// 2 — Gift Place, a NON-flowers category
await mount(GiftProductGrid, {
  cards: TECH_CARDS, state: "ready", actionLabel: "Select Gift", onAction: () => {}, emptyLabel: "Tech",
});
capture("gift-place-tech", "2 &mdash; Gift Place: Tech, in the shared grid");

// 3 — Gift Place, FLOWERS in the identical grid
await mount(GiftProductGrid, {
  cards: FLOWER_CARDS, state: "ready", actionLabel: "Select Gift", onAction: () => {}, emptyLabel: "Flowers",
});
capture("gift-place-flowers", "3 &mdash; Gift Place: Flowers, in the IDENTICAL grid &mdash; same card, same action, same place");

// 3b — the distinct states
await mount(GiftProductGrid, { cards: [], state: "loading", actionLabel: "Select Gift", onAction: () => {}, emptyLabel: "Flowers" });
capture("gift-place-loading", "3b &mdash; Loading: skeletons at the real card size");
await mount(GiftProductGrid, { cards: [], state: "failed", actionLabel: "Select Gift", onAction: () => {}, onRetry: () => {}, emptyLabel: "Flowers" });
capture("gift-place-failed", "3c &mdash; Failed to load, with Try again &mdash; never shown as &ldquo;nothing available&rdquo;");
await mount(GiftProductGrid, { cards: [], state: "ready", actionLabel: "Select Gift", onAction: () => {}, emptyLabel: "Flowers" });
capture("gift-place-empty", "3d &mdash; Genuinely empty: Coming Soon");

// 4 — the selected flower, back on the greeting
await mountRaw(`
  <div data-testid="selected-gift-summary" style="display:flex;align-items:center;gap:0.875rem;padding:0.875rem;margin-bottom:1rem;border:1px solid var(--border);border-radius:0.75rem;background:var(--bg-primary);max-width:520px;">
    <div style="width:56px;height:56px;flex-shrink:0;border-radius:0.5rem;background:linear-gradient(135deg,#ec4899 0%,#8b5cf6 100%);display:flex;align-items:center;justify-content:center;font-size:1.5rem;">&#127873;</div>
    <div style="flex:1;min-width:0;">
      <div style="font-size:0.6875rem;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:var(--text-tertiary);">Selected Gift</div>
      <div style="font-size:0.9375rem;font-weight:600;color:var(--text-primary);">Autumn Warmth Bouquet</div>
      <div style="font-size:0.875rem;color:var(--primary);font-weight:700;">$74.99</div>
    </div>
    <button type="button" style="padding:0.5rem 0.875rem;border-radius:0.5rem;border:1px solid var(--border);background:transparent;color:var(--text-secondary);font-size:0.8125rem;font-weight:600;cursor:pointer;white-space:nowrap;">Change Gift</button>
  </div>`);
capture("selected-gift-on-greeting", "4 &mdash; The selected flower, back on the greeting, with Change Gift");

// 4b — the review step, one primary action: Continue
await mount(Review, {
  isOpen: true, onClose: () => {},
  recipientName: "Alex Demo", recipientEmail: "alex.demo@example.test",
  occasionLabel: "Birthday", messagePreview: "Happy birthday! Thinking of you today.",
  photoCount: 3, giftMode: "flowers",
  qrCashAttachment: null, curatedAttachment: null, marketplaceAttachments: null,
  flowersAttachment: { providerProductId: "DEMO-T18", name: "Autumn Warmth Bouquet", priceMinor: 7499, currency: "USD" },
  sending: false,
  onConfirmDirectSend: () => {}, onConfirmQRCashFresh: () => {}, onMarketplaceCheckout: () => {},
  onConfirmFlowersCheckout: () => {}, onRemoveAttachment: () => {},
});
capture("send-review-continue", "4b &mdash; Send Greet-Me review: ONE primary action, and it is Continue");

// 5 + 6 — the checkout, then the Greet-Me-branded handoff
ROUTES = live({
  "/provider-checkout/submit": async () => ({
    ok: true, status: "accepted", providerOrderId: DEMO_ORDER, giftClaimToken: "demo-gift-token",
    dispatched: "yes", customerCharged: "yes", checkout: { provider: "florist_one" },
  }),
});
installTokenizer();
await mount(Modal, {
  isOpen: true, onClose: () => {}, giftType: "flowers",
  product: { providerProductId: "DEMO-T18", name: "Autumn Warmth Bouquet", priceMinor: 7499, currency: "USD" },
  customer: { firstName: "Sam", lastName: "Demo", email: "sam.demo@example.test" },
  contactId: "demo-contact", onAccepted: () => {},
});
setVal(byId("pc-delivery-date"), "2026-09-20");
setVal(byId("pc-first"), "Alex");
setVal(byId("pc-last"), "Demo");
setVal(byId("pc-address1"), "1 Example Street");
setVal(byId("pc-city"), "Newark");
setVal(byId("pc-state"), "NJ");
setVal(byId("pc-zip"), "07102");
setVal(byId("pc-recipient-phone"), "(201) 555-0100");
setVal(byId("pc-message"), "Happy birthday!");
setVal(byId("pc-billing-line1"), "2 Example Street");
setVal(byId("pc-billing-city"), "Hoboken");
setVal(byId("pc-billing-state"), "NJ");
setVal(byId("pc-billing-zip"), "07030");
setVal(byId("pc-cust-first"), "Sam");
setVal(byId("pc-cust-email"), "sam.demo@example.test");
setVal(byId("pc-cust-phone"), "(973) 555-0100");
await flush();
await click(tid("provider-checkout-continue"));
for (let i = 0; i < 40 && tid("provider-checkout-securing"); i += 1) await flush();
capture("checkout-payment", "5a &mdash; The florist&rsquo;s own quote, approved before anything is charged (merchant-of-record disclosure retained)");

setVal(byId("pc-card"), "4111111111111111");
setVal(byId("pc-exp-month"), "01");
setVal(byId("pc-exp-year"), "30");
setVal(byId("pc-cvv"), "123");
await flush();
if (tid("provider-checkout-accept-price")) await click(tid("provider-checkout-accept-price"));
await click(tid("provider-checkout-pay"));
capture("checkout-handoff", "5b/6 &mdash; Greet-Me-branded handoff: no supplier name, no order number, no Done &mdash; &ldquo;Sending your Greet-Me&hellip;&rdquo;");

// 7 — the ordinary final confirmation
await mountRaw(`
  <div style="max-width:520px;background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08);">
    <div style="width:72px;height:72px;margin:0 auto 22px;border-radius:50%;background:linear-gradient(135deg,#7f1d1d,#b91c1c);"></div>
    <h2 style="font-size:1.5rem;margin:0 0 12px;">Your Greet-Me has been sent</h2>
    <p style="margin:0;color:#6b7280;">That Greet-Me is on its way.</p>
    <p data-testid="send-gift-confirmed" style="margin:10px 0 0;color:#6b7280;">Your selected gift is confirmed.</p>
  </div>`);
capture("final-confirmation", "7 &mdash; The ordinary Greet-Me confirmation, plus one line: &ldquo;Your selected gift is confirmed.&rdquo;");

// 8 — accepted gift, failed greeting: the safe retry
await mountRaw(`
  <div data-testid="gift-confirmed-send-failed" role="alert" style="max-width:520px;padding:0.875rem 1rem;border-radius:0.625rem;border:1px solid #fcd34d;background:#fffbeb;">
    <p style="margin:0 0 0.5rem;font-weight:700;color:#92400e;">Your gift is confirmed, but your Greet-Me could not be sent.</p>
    <button type="button" style="padding:0.6rem 1.1rem;border-radius:0.5rem;border:none;background:#b45309;color:#fff;font-weight:700;cursor:pointer;">Retry your Greet-Me</button>
  </div>`);
capture("safe-retry", "8 &mdash; Gift confirmed, greeting failed: a GREETING-only retry. It never reopens checkout or recharges.");

// 9 — the recipient's QR surprise announcement
await mountRaw(`
  <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:40px 32px;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.08);">
    <div style="font-size:2.5rem;margin-bottom:1rem;">&#127873;</div>
    <h1 style="font-size:1.5rem;margin:0 0 0.5rem;color:#111827;">Something special is coming your way</h1>
    <p style="font-size:0.95rem;color:#6b7280;margin:0 0 1.5rem;">Sam sent you something with their Greet-Me.</p>
    <p style="font-size:0.95rem;color:#6b7280;line-height:1.6;margin:0 0 1.5rem;">Your sender arranged a surprise just for you. It may arrive separately from your Greet-Me, so keep an eye out!</p>
    <a href="#" style="color:#4F2D7F;font-weight:600;text-decoration:none;">See your Greet-Me</a>
  </div>`);
capture("qr-physical-gift", "9 &mdash; Behind the recipient&rsquo;s QR: informational only. No product, price, supplier, order number, tracking or claim action.");

rmSync(BUNDLE, { force: true });
console.log("\nOutput directory:", OUT);
