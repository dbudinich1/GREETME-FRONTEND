// src/pages/merchOrdersFlowerVisibility.browser.test.mjs
//
// TEAM 2 — RENDERED-COMPONENT coverage of the new Flower Orders section on the same page as the
// existing branded-goods order list. The REAL MerchOrders page is esbuild-transformed and mounted
// into jsdom, exactly like merchOrderStatus.browser.test.mjs; only ambient collaborators (router,
// icons, api client) are stubbed.
//
// Proves: the section renders independently of the branded-goods list (including when there are
// zero merch orders), shows the honest fixed "Flower order submitted" status and the honest
// "Shipment tracking is not available" copy, never renders a tracking link/button for a flower
// order, shows a Get Help action, and stays quiet (no alarming error box) on a fetch failure while
// still saying something rather than nothing.
//
// Run: node --test src/pages/merchOrdersFlowerVisibility.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__merchordersflowervis.bundle.mjs");
let React, createRoot, act, MerchOrders;

const ROUTER_STUB = `export const useNavigate = () => (() => {});`;
const ICONS_STUB = `
import React from "react";
const I = () => null;
export const Package = I, Truck = I, ArrowLeft = I, ExternalLink = I, Flower2 = I, Gift = I;
export default {};
`;
const API_STUB = `
export default {
  getMerchOrders: async () => ({ ok: true, orders: globalThis.__orders || [] }),
  getOrderHistory: async () => ({ ok: true, orders: globalThis.__orderHistory || [] }),
  getFlowerOrders: async () => {
    if (globalThis.__flowerOrdersError) throw new Error("network down");
    return { ok: true, orders: globalThis.__flowerOrders || [] };
  },
};
`;

function stubPlugin() {
  const map = [
    [/^react-router-dom$/, ROUTER_STUB, "rr"],
    [/^lucide-react$/, ICONS_STUB, "icons"],
    [/api[\\/]api$/, API_STUB, "api"],
  ];
  return { name: "stub", setup(b) {
    for (const [filter, contents, ns] of map) {
      b.onResolve({ filter }, (a) => ({ path: a.path, namespace: ns }));
      b.onLoad({ filter: /.*/, namespace: ns }, () => ({ contents, loader: "js" }));
    }
  } };
}

before(async () => {
  writeFileSync(join(__dirname, ".__merchordersflowervis.jsx"), `export { default as MerchOrders } from "./MerchOrders.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__merchordersflowervis.jsx")], outfile: BUNDLE, bundle: true,
    format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stubPlugin()], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__merchordersflowervis.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  // React reads a global `navigator`; Node < 21 has none (harness fix, mirrors hubW17Coverage).
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.localStorage = window.localStorage;
  globalThis.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ MerchOrders } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

async function renderWith({ orders = [], flowerOrders = [], flowerError = false, width = 1280 } = {}) {
  globalThis.__orders = orders;
  globalThis.__flowerOrders = flowerOrders;
  globalThis.__flowerOrdersError = flowerError;
  globalThis.window.innerWidth = width;
  const host = globalThis.document.createElement("div");
  globalThis.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(MerchOrders)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return { host, text: host.textContent || "", html: host.innerHTML || "", unmount: () => act(async () => root.unmount()) };
}

const FLOWER_ORDER = (o = {}) => ({
  id: "gpc_attempt_flower_1",
  giftType: "flowers",
  itemSummary: "Flowers",
  recipientName: "Dana Rivers",
  submittedAt: "2026-09-20T14:03:00.000Z",
  requestedDeliveryDate: "2026-09-25",
  amountCents: 8499,
  currency: "USD",
  orderReference: "559781630",
  status: { kind: "submitted", label: "Flower order submitted" },
  tracking: { available: false },
  ...o,
});

test("no flower orders: the Flower Orders section does not render at all", async () => {
  const { text, unmount } = await renderWith({ flowerOrders: [] });
  assert.equal(text.includes("Flower Orders"), false);
  await unmount();
});

test("a real flower order renders with the honest status, item summary, recipient, reference and amount", async () => {
  const { text, unmount } = await renderWith({ flowerOrders: [FLOWER_ORDER()] });
  assert.match(text, /Flower Orders/);
  assert.match(text, /Flower order submitted/);
  assert.match(text, /Flowers for Dana Rivers/);
  assert.match(text, /559781630/);
  assert.match(text, /\$84\.99/);
  assert.match(text, /Requested delivery:/);
  assert.match(text, /Shipment tracking is not available/);
  assert.match(text, /Get Help with This Order/);
  await unmount();
});

test("a flower order never renders a tracking link or button, unlike a shipped merch order", async () => {
  const { html, unmount } = await renderWith({ flowerOrders: [FLOWER_ORDER()] });
  assert.equal(html.includes("Track "), false);
  assert.equal(/href="https?:\/\//.test(html), false, "no outbound tracking URL should ever appear for a flower order");
  await unmount();
});

test("the Flower Orders section renders even when there are zero merch orders", async () => {
  const { text, unmount } = await renderWith({ orders: [], flowerOrders: [FLOWER_ORDER()] });
  assert.match(text, /No orders yet/); // existing branded-goods empty state, unchanged
  assert.match(text, /Flower Orders/); // and the flower section still appears
  await unmount();
});

test("an order with no requested delivery date still shows the honest no-tracking copy, without fabricating a date", async () => {
  const { text, unmount } = await renderWith({
    flowerOrders: [FLOWER_ORDER({ requestedDeliveryDate: null })],
  });
  assert.match(text, /Shipment tracking is not available/);
  assert.equal(text.includes("Requested delivery:"), false);
  await unmount();
});

test("an order with no amount available renders without fabricating $0.00", async () => {
  const { text, unmount } = await renderWith({
    flowerOrders: [FLOWER_ORDER({ amountCents: null })],
  });
  assert.match(text, /Flower order submitted/);
  assert.equal(text.includes("$0.00"), false);
  await unmount();
});

test("a flower-orders fetch failure shows a quiet inline notice, not a blank page and not the merch error box", async () => {
  const { text, unmount } = await renderWith({ orders: [], flowerError: true });
  assert.match(text, /couldn.t load your flower orders/i);
  await unmount();
});

test("the existing branded-goods list is unaffected by a present flower order", async () => {
  const MERCH_ORDER = {
    id: "merch-1", paidAt: "2026-08-14T05:44:24.083Z", totalCents: 4499,
    itemSummary: "White glossy mug — 15 oz", statusKind: "processing", statusLabel: "Processing",
    packages: [],
  };
  const { text, unmount } = await renderWith({ orders: [MERCH_ORDER], flowerOrders: [FLOWER_ORDER()] });
  assert.match(text, /White glossy mug/);
  assert.match(text, /Flowers for Dana Rivers/);
  await unmount();
});
