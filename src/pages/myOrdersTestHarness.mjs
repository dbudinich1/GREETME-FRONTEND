// src/pages/myOrdersTestHarness.mjs
//
// Shared harness for the "Your Orders" (MerchOrders.jsx) mounted tests. The REAL page and the REAL utils/myOrders.js are
// esbuild-bundled and mounted into jsdom; only the router, the icons and the api client are stubbed. The api stub answers with the
// backend's own shapes (GET /api/orders/history, GET /api/merch/orders legacy, GET /api/gifts/flower-orders legacy) taken from a
// per-render script, so a test can make any read succeed, fail, or never answer. Not a test file (not named *.test.mjs).
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ROUTER_STUB = `export const useNavigate = () => ((p) => { (globalThis.__mo.navigated = globalThis.__mo.navigated || []).push(p); });`;
const ICONS_STUB = `const I = () => null; export const Package = I, Truck = I, ArrowLeft = I, ExternalLink = I; export default {};`;
// Each read is a function of (callIndex) so a test can fail the first call and answer the second ("Try again").
const API_STUB = `
const run = async (name) => {
  const s = globalThis.__mo; s.calls.push(name);
  const n = s.calls.filter((c) => c === name).length;
  const spec = s.script[name];
  if (spec === "never") return new Promise(() => {});
  const v = typeof spec === "function" ? spec(n) : spec;
  if (v === "fail") throw Object.assign(new Error(name + " failed"), { status: 500 });
  return v;
};
export default {
  getOrderHistory: () => run("history"),
  getMerchOrders: () => run("merch"),
  getFlowerOrders: () => run("flowers"),
};
`;

export async function createHarness(tag) {
  const entry = join(__dirname, `.__mo.${tag}.${process.pid}.jsx`);
  const bundle = join(__dirname, `.__mo.${tag}.${process.pid}.bundle.mjs`);
  writeFileSync(entry, `export { default as MerchOrders } from "./MerchOrders.jsx";\n`);
  const stubs = [[/^react-router-dom$/, ROUTER_STUB, "rr"], [/^lucide-react$/, ICONS_STUB, "icons"], [/api[\\/]api$/, API_STUB, "api"]];
  await esbuild.build({
    entryPoints: [entry], outfile: bundle, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
    plugins: [{ name: "stub", setup(b) {
      for (const [filter, contents, ns] of stubs) {
        b.onResolve({ filter }, (a) => ({ path: a.path, namespace: ns }));
        b.onLoad({ filter: /.*/, namespace: ns }, () => ({ contents, loader: "js" }));
      }
    } }],
  });
  rmSync(entry, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  // React reads a global `navigator`; Node < 21 has none (harness fix, mirrors hubW17Coverage).
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.MouseEvent = window.MouseEvent; globalThis.localStorage = window.localStorage;
  globalThis.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id);
  window.scrollTo = () => {};
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const React = (await import("react")).default;
  const { act } = React;
  const { createRoot } = await import("react-dom/client");
  const { MerchOrders } = await import(pathToFileURL(bundle).href);
  const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  /**
   * @param script  { history, merch, flowers }: each a body, "fail", "never", or a function(callNumber) of those
   * @param opts    { width }
   */
  async function render(script = {}, { width = 1280 } = {}) {
    globalThis.__mo = { calls: [], navigated: [], script: { history: { ok: true, orders: [] }, merch: { ok: true, orders: [] }, flowers: { ok: true, orders: [] }, ...script } };
    window.innerWidth = width;
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () => { root.render(React.createElement(MerchOrders)); });
    await flush(); await flush();
    const api = {
      host, flush,
      calls: () => [...globalThis.__mo.calls],
      navigated: () => [...globalThis.__mo.navigated],
      text: () => (host.textContent || "").replace(/\s+/g, " "),
      html: () => host.innerHTML || "",
      tid: (t) => host.querySelector(`[data-testid="${t}"]`),
      all: (t) => [...host.querySelectorAll(`[data-testid="${t}"]`)],
      rows: () => [...host.querySelectorAll('[data-testid="order-row"]')],
      rowWith: (s) => [...host.querySelectorAll('[data-testid="order-row"]')].find((r) => r.textContent.includes(s)),
      click: async (el) => { if (!el) throw new Error("control must exist"); await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await flush(); await flush(); },
      unmount: async () => { await act(async () => root.unmount()); host.remove(); },
    };
    return api;
  }
  function cleanup() { try { rmSync(bundle, { force: true }); } catch { /* ignore */ } }
  return { render, cleanup };
}

// ------------------------------------------------------------------------------------------------ fixtures (backend shapes)
const base = (o) => ({
  orderRef: "ord_0000000000000000", source: "gift", category: "curated", createdAt: "2026-09-20T15:00:00.000Z", itemSummary: "", recipientName: "",
  amountCents: null, status: { kind: "processing", label: "Processing" }, tracking: { available: false, carrier: null, trackingNumber: null, trackingUrl: null },
  requestedDeliveryDate: null, providerReference: null, support: false, ...o,
});
const ref = (n) => `ord_${String(n).padStart(16, "0")}`;
export const ROWS = {
  merchShipped: base({ orderRef: ref(101), source: "merch", category: "merch", createdAt: "2026-09-28T14:10:00.000Z", itemSummary: "Logo mug x2, Tote bag", amountCents: 6295, status: { kind: "shipped", label: "Shipped" }, tracking: { available: true, carrier: "UPS", trackingNumber: "1Z999AA10123456784", trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10123456784" } }),
  merchProcessing: base({ orderRef: ref(102), source: "merch", category: "merch", createdAt: "2026-09-30T09:30:00.000Z", itemSummary: "Embroidered cap", amountCents: 2450, status: { kind: "processing", label: "Payment received - preparing your order" } }),
  merchRefunded: base({ orderRef: ref(103), source: "merch", category: "merch", createdAt: "2026-09-02T11:00:00.000Z", itemSummary: "Water bottle", amountCents: 1999, status: { kind: "refunded", label: "Refunded" } }),
  merchUnknown: base({ orderRef: ref(104), source: "merch", category: "merch", createdAt: "2026-09-05T18:45:00.000Z", itemSummary: "Notebook set", amountCents: 1800, status: { kind: "unknown", label: "Status unavailable - contact support" }, support: true }),
  flowers: base({ orderRef: ref(201), source: "flowers", category: "flowers", createdAt: "2026-09-29T12:00:00.000Z", itemSummary: "Spring Garden Bouquet", recipientName: "Dana Lee", amountCents: 6499, status: { kind: "submitted", label: "Flower order submitted" }, requestedDeliveryDate: "2026-10-14", providerReference: "559781630", support: true }),
  boxPlaced: base({ orderRef: ref(301), category: "gift_boxes", createdAt: "2026-09-27T16:20:00.000Z", itemSummary: "Sampler Snack Box", recipientName: "Avery Fixture", amountCents: 6055, status: { kind: "processing", label: "Order placed with our gifting partner" } }),
  boxShipped: base({ orderRef: ref(302), category: "gift_boxes", createdAt: "2026-09-18T10:05:00.000Z", itemSummary: "Coffee Lover Basket", recipientName: "Blake Other", amountCents: 5775, status: { kind: "shipped", label: "On its way" }, tracking: { available: true, carrier: "FedEx", trackingNumber: "794600000000", trackingUrl: null } }),
  boxDelivered: base({ orderRef: ref(303), category: "gift_boxes", createdAt: "2026-09-08T13:15:00.000Z", itemSummary: "Tea & Honey Set", recipientName: "Casey Sample", amountCents: 4725, status: { kind: "delivered", label: "Delivered" }, tracking: { available: true, carrier: "UPS", trackingNumber: "1Z999AA10999999999", trackingUrl: "https://www.ups.com/track?tracknum=1Z999AA10999999999" } }),
  boxIssue: base({ orderRef: ref(304), category: "gift_boxes", createdAt: "2026-09-12T08:00:00.000Z", itemSummary: "Spa Gift Box", recipientName: "Drew Example", amountCents: 8200, status: { kind: "issue", label: "We hit a snag - we are on it" }, support: true }),
  qrAwaiting: base({ orderRef: ref(401), category: "qrcash", createdAt: "2026-09-26T19:00:00.000Z", itemSummary: "QR Cash gift", recipientName: "Eli Fixture", amountCents: 2774, status: { kind: "awaiting_recipient", label: "Waiting for recipient to claim" } }),
  qrPaidOut: base({ orderRef: ref(402), category: "qrcash", createdAt: "2026-09-10T19:00:00.000Z", itemSummary: "QR Cash gift", recipientName: "Fran Fixture", amountCents: 5349, status: { kind: "completed", label: "Paid out to recipient" } }),
  qrExpired: base({ orderRef: ref(403), category: "qrcash", createdAt: "2026-07-20T19:00:00.000Z", itemSummary: "QR Cash gift", recipientName: "Gale Fixture", amountCents: 2774, status: { kind: "expired", label: "Expired after 30 days unclaimed" } }),
  cardReady: base({ orderRef: ref(501), category: "gift_cards", createdAt: "2026-09-24T11:00:00.000Z", itemSummary: "Smart Card $50", recipientName: "Hal Fixture", amountCents: 5499, status: { kind: "completed", label: "Ready for recipient" } }),
  curated: base({ orderRef: ref(601), category: "curated", createdAt: "2026-09-22T09:00:00.000Z", itemSummary: "Curated gift (up to $50)", recipientName: "Ira Fixture", amountCents: 5000, status: { kind: "processing", label: "A gift is being chosen" } }),
  mystery: base({ orderRef: ref(701), category: "mystery_type", createdAt: "2026-09-01T09:00:00.000Z", itemSummary: "Gift", recipientName: "Jo Fixture", status: { kind: "unknown", label: "Status unavailable - contact support" }, support: true }),
};
export const FULL = ["merchProcessing", "flowers", "boxPlaced", "qrAwaiting", "merchShipped", "curated", "boxShipped", "boxIssue", "merchUnknown", "boxDelivered", "merchRefunded", "qrPaidOut", "qrExpired", "mystery"];
export const history = (keys, extra = {}) => ({ ok: true, count: keys.length, truncated: false, orders: keys.map((k) => ROWS[k]), ...extra });

// legacy shapes (GET /api/merch/orders and GET /api/gifts/flower-orders)
export const LEGACY_MERCH = (o = {}) => ({
  id: "ord-1", paidAt: "2026-08-14T05:44:24.083Z", totalCents: 4499, itemSummary: "White glossy mug — 15 oz", statusKind: "processing",
  statusLabel: "Payment received — preparing your order", shippedAt: null, packages: [], ...o,
});
export const LEGACY_FLOWER = (o = {}) => ({
  id: "gpc_attempt_flower_1", giftType: "flowers", itemSummary: "Flowers", recipientName: "Dana Rivers", submittedAt: "2026-09-20T14:03:00.000Z",
  requestedDeliveryDate: "2026-09-25", amountCents: 8499, currency: "USD", orderReference: "559781630",
  status: { kind: "submitted", label: "Flower order submitted" }, tracking: { available: false }, ...o,
});
