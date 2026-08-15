// src/pages/merchOrderStatus.browser.test.mjs
//
// PACKAGE C — RENDERED-COMPONENT coverage of the customer merchandise status
// display. The REAL MerchOrders page is esbuild-transformed and mounted into
// jsdom; only ambient collaborators (router, icons, api client) are stubbed, so
// the rendering under test is genuine.
//
// Proves the frontend renders the backend-provided label verbatim, keeps no
// competing lifecycle map, falls back safely when a label is absent, never
// surfaces a raw internal state or vendor status, preserves the existing
// tracking display, and stays readable at a narrow mobile width.
//
// Run: node --test src/pages/merchOrderStatus.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__merchorders.bundle.mjs");
let React, createRoot, act, MerchOrders;

const ROUTER_STUB = `export const useNavigate = () => (() => {});`;
const ICONS_STUB = `
import React from "react";
const I = () => null;
export const Package = I, Truck = I, ArrowLeft = I, ExternalLink = I;
export default {};
`;
// The api client returns whatever the test places on globalThis.__orders.
const API_STUB = `
export default {
  getMerchOrders: async () => ({ ok: true, orders: globalThis.__orders || [] }),
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
  writeFileSync(join(__dirname, ".__merchorders.jsx"), `export { default as MerchOrders } from "./MerchOrders.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__merchorders.jsx")], outfile: BUNDLE, bundle: true,
    format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stubPlugin()], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__merchorders.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  // NOTE: globalThis.navigator is a getter-only built-in on Node 20+, so it is
  // NOT reassigned here. MerchOrders reads window.innerWidth, never navigator.
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

async function renderWith(orders, { width = 1280 } = {}) {
  globalThis.__orders = orders;
  globalThis.window.innerWidth = width;
  const host = globalThis.document.createElement("div");
  globalThis.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(MerchOrders)); });
  // let the load effect settle
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return { host, text: host.textContent || "", html: host.innerHTML || "", unmount: () => act(async () => root.unmount()) };
}

const ORDER = (o = {}) => ({
  id: "ord-1",
  paidAt: "2026-08-14T05:44:24.083Z",
  totalCents: 4499,
  itemSummary: "White glossy mug — 15 oz",
  statusKind: "processing",
  statusLabel: "Payment received — preparing your order",
  shippedAt: null,
  packages: [],
  ...o,
});

// ── 1. Every supported backend label renders verbatim ───────────────────────
test("every supported backend label renders exactly as provided", async () => {
  const labels = [
    "Payment received — preparing your order",
    "Order placed with our print partner",
    "Approved — production scheduled",
    "Being made",
    "Shipped",
    "We hit a snag — we're on it",
    "Cancelled",
    "Refunded",
  ];
  for (const label of labels) {
    const r = await renderWith([ORDER({ statusLabel: label })]);
    assert.ok(r.text.includes(label), `"${label}" must render`);
    await r.unmount();
  }
});

// ── 2. Backend label takes precedence over any fallback ─────────────────────
test("the backend label always wins over the fallback", async () => {
  const r = await renderWith([ORDER({ statusLabel: "Being made" })]);
  assert.ok(r.text.includes("Being made"));
  assert.ok(!r.text.includes("Processing"), "fallback must not appear when a label exists");
  await r.unmount();
});

// ── 3. Missing label uses a safe fallback ───────────────────────────────────
test("a missing label renders a safe fallback, never blank or undefined", async () => {
  for (const missing of [undefined, null, ""]) {
    const r = await renderWith([ORDER({ statusLabel: missing })]);
    assert.ok(r.text.includes("Processing"), `fallback for ${String(missing)}`);
    assert.ok(!r.text.includes("undefined"), "never renders the word undefined");
    assert.ok(!r.text.includes("null"), "never renders the word null");
    await r.unmount();
  }
});

// ── 4/5. No raw enum or vendor value ever renders ───────────────────────────
test("raw internal states and vendor statuses never reach the DOM", async () => {
  // A hostile payload carrying internal fields the backend would never send.
  const r = await renderWith([ORDER({
    statusLabel: "Being made",
    state: "fulfillment_placed",
    printfulStatus: "inprocess",
    printfulOrderId: 171449412,
    retailReconciliationError: "retail reconciliation failed (subtotal_mismatch)",
    lastFailureReason: "Printful order submit error 400",
  })]);
  for (const banned of [
    "fulfillment_placed", "fulfillment_pending", "pending_fulfillment", "fulfillment_failed",
    "inprocess", "printful", "Printful", "171449412", "reconciliation", "subtotal_mismatch", "400",
  ]) {
    assert.ok(!r.text.includes(banned), `"${banned}" must not render`);
  }
  assert.ok(r.text.includes("Being made"));
  await r.unmount();
});

test("the page contains no competing status vocabulary of its own", async () => {
  // The legacy backend wording must not be hard-coded anywhere in the client.
  const r = await renderWith([ORDER({ statusLabel: "Shipped" })]);
  assert.ok(!r.text.includes("Order received — processing"), "no client-side legacy label");
  await r.unmount();
});

// ── 6. Long labels remain readable on mobile ────────────────────────────────
test("the longest label renders complete and unclipped at a narrow width", async () => {
  const longest = "Payment received — preparing your order";
  const r = await renderWith([ORDER({ statusLabel: longest })], { width: 320 });
  assert.ok(r.text.includes(longest), "full label present at 320px");

  // Scope the truncation check to the BADGE element itself. A page-wide scan
  // would falsely trip on the total-price element, which legitimately uses
  // white-space: nowrap so a currency amount never breaks across lines.
  const badge = [...r.host.querySelectorAll("div")].find(
    (el) => el.textContent === longest
  );
  assert.ok(badge, "status badge element located");
  const css = badge.getAttribute("style") || "";
  assert.ok(!/text-overflow\s*:\s*ellipsis/i.test(css), "badge does not ellipsis-truncate");
  assert.ok(!/white-space\s*:\s*nowrap/i.test(css), "badge does not force a single line");
  assert.ok(!/overflow\s*:\s*hidden/i.test(css), "badge does not clip overflow");
  assert.ok(!/\bmax-width\s*:/i.test(css), "badge is not width-capped");
  await r.unmount();
});

// ── 7. Existing tracking display remains intact ─────────────────────────────
test("tracking link and carrier still render for a shipped order", async () => {
  const r = await renderWith([ORDER({
    statusKind: "shipped",
    statusLabel: "Shipped",
    shippedAt: "2026-08-20T00:00:00.000Z",
    packages: [{
      carrier: "DHLGLOBALMAIL",
      trackingNumber: "TRK123",
      trackingUrl: "https://myorders.co/tracking/82735098/",
      shippedAt: "2026-08-20T00:00:00.000Z",
    }],
  })]);
  assert.ok(r.text.includes("Shipped"));
  assert.ok(r.html.includes("https://myorders.co/tracking/82735098/"), "tracking URL preserved");
  assert.ok(r.html.includes('rel="noopener noreferrer"'), "existing link safety preserved");
  await r.unmount();
});

test("an order without tracking renders without error", async () => {
  const r = await renderWith([ORDER({ packages: [] })]);
  assert.ok(r.text.includes("Payment received"));
  await r.unmount();
});

// ── Item summary and totals still render (no regression) ────────────────────
test("existing order details still render alongside the new labels", async () => {
  const r = await renderWith([ORDER({ statusLabel: "Approved — production scheduled" })]);
  assert.ok(r.text.includes("White glossy mug"), "item summary preserved");
  assert.ok(r.text.includes("44.99"), "total preserved");
  await r.unmount();
});