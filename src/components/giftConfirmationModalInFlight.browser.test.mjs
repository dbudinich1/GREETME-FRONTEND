// src/components/giftConfirmationModalInFlight.browser.test.mjs — LANE E3 (2026-10-10) fix 2.
// The real GiftConfirmationModal (QR Cash card step), bundled and mounted in jsdom, with ONLY the
// Stripe React bindings and the Stripe loader replaced by in-test stubs (no network, no Stripe).
//
// Proves: Pay is disabled from the first click until the whole attempt settles, so a double click
// (or a click during the 3DS bank step) can never tokenize a second card or call onConfirm (→
// /charge-now) twice; the 409 PAYMENT_ALREADY_IN_PROGRESS server message is displayed.
// Run (Node 20.x): node --test src/components/giftConfirmationModalInFlight.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, `.__gcmif.${process.pid}.bundle.mjs`);
const ENTRY = join(__dirname, `.__gcmif.${process.pid}.entry.jsx`);
let React, createRoot, act, Component;

// Stripe stubs. createPaymentMethod is controlled by each test through globalThis.__stripeStub.
const STRIPE_REACT_STUB = [
  'import { useEffect, createElement } from "react";',
  "export function Elements({ children }) { return children; }",
  "export function CardElement({ onChange }) {",
  "  useEffect(() => { onChange && onChange({ complete: true }); }, []);",
  '  return createElement("div", { "data-testid": "card-element" });',
  "}",
  "export function useStripe() { return globalThis.__stripeStub; }",
  "export function useElements() { return { getElement: () => ({}) }; }",
].join("\n");
const stubPlugin = {
  name: "stripe-stubs",
  setup(build) {
    build.onResolve({ filter: /^@stripe\/react-stripe-js$/ }, () => ({ path: "stripe-react", namespace: "stub" }));
    build.onResolve({ filter: /stripe\/stripeProvider$/ }, () => ({ path: "stripe-provider", namespace: "stub" }));
    build.onLoad({ filter: /^stripe-react$/, namespace: "stub" }, () => ({ contents: STRIPE_REACT_STUB, loader: "js", resolveDir: __dirname }));
    build.onLoad({ filter: /^stripe-provider$/, namespace: "stub" }, () => ({ contents: "export const stripePromise = {};", loader: "js" }));
  },
};

before(async () => {
  writeFileSync(ENTRY, `export { default as Component } from "./GiftConfirmationModal.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "process.env.NODE_ENV": '"production"' },
    plugins: [stubPlugin],
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: dom.window.navigator, configurable: true });
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.Event = dom.window.Event; globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Component } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch {} });

function deferred() { let resolve; const promise = new Promise((r) => { resolve = r; }); return { promise, resolve }; }

function mount(props) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(React.createElement(Component, {
      isOpen: true, onClose() {}, onConfirm() {}, giftAmountCents: 10000, feeCents: 499, totalCents: 10499, ...props,
    }));
  });
  return { unmount: () => act(() => root.unmount()) };
}
const pay = () => document.body.querySelector('[data-testid="qrcash-pay"]');
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); };

test("double click during card tokenization: ONE payment method, ONE onConfirm (charge-now) call", async () => {
  let pmCalls = 0;
  const pm = deferred();
  globalThis.__stripeStub = { createPaymentMethod: () => { pmCalls += 1; return pm.promise; } };
  const confirms = [];
  const { unmount } = mount({ onConfirm: (id) => { confirms.push(id); return new Promise(() => {}); } });
  const btn = pay();
  assert.equal(btn.disabled, false, "enabled with a complete card");
  // Two clicks in the same tick: the parent's state-based `charging` prop cannot have changed yet.
  await act(async () => {
    btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
  });
  assert.equal(pay().disabled, true, "disabled while the first attempt is in flight");
  await act(async () => { pm.resolve({ paymentMethod: { id: "pm_1" } }); });
  await click(pay());
  assert.equal(pmCalls, 1, "a second card was never tokenized");
  assert.deepEqual(confirms, ["pm_1"], "charge requested exactly once");
  unmount();
});

test("Pay stays disabled for the whole attempt (charge + 3DS bank step + finalize) and re-enables only when it settles", async () => {
  globalThis.__stripeStub = { createPaymentMethod: async () => ({ paymentMethod: { id: "pm_2" } }) };
  const attempt = deferred(); // stands in for /charge-now -> confirmCardPayment (3DS) -> /finalize
  let calls = 0;
  const { unmount } = mount({ onConfirm: () => { calls += 1; return attempt.promise; } });
  await click(pay());
  assert.equal(calls, 1);
  assert.equal(pay().disabled, true);
  assert.match(pay().textContent, /Charging/);
  await click(pay()); // pressing Pay again while the bank step is outstanding
  await click(pay());
  assert.equal(calls, 1, "no repeat charge call during an outstanding payment");
  await act(async () => { attempt.resolve(); });
  assert.equal(pay().disabled, false, "re-enabled after the attempt settled");
  unmount();
});

test("charging prop (parent in-flight) disables Pay and Cancel", () => {
  globalThis.__stripeStub = { createPaymentMethod: async () => ({ paymentMethod: { id: "pm_3" } }) };
  const { unmount } = mount({ charging: true });
  assert.equal(pay().disabled, true);
  const cancel = [...document.body.querySelectorAll("button")].find((b) => b.textContent.trim() === "Cancel");
  assert.equal(cancel.disabled, true);
  unmount();
});

test("409 PAYMENT_ALREADY_IN_PROGRESS: the server's message is displayed, not a generic failure", () => {
  globalThis.__stripeStub = { createPaymentMethod: async () => ({ paymentMethod: { id: "pm_4" } }) };
  const server = "This payment is already in progress. Please finish your bank's verification step, or close and start the gift again.";
  const { unmount } = mount({ chargeError: server });
  assert.ok(document.body.textContent.includes(server));
  assert.ok(!document.body.textContent.includes("Failed to charge"));
  unmount();
});

test("ordinary single payment unchanged: one click -> one charge with the card's payment method and the stripe instance", async () => {
  const stripe = { createPaymentMethod: async () => ({ paymentMethod: { id: "pm_5" } }) };
  globalThis.__stripeStub = stripe;
  const seen = [];
  const { unmount } = mount({ onConfirm: async (id, s) => { seen.push([id, s === stripe]); } });
  assert.match(pay().textContent, /Confirm & Charge \$104\.99/);
  await click(pay());
  assert.deepEqual(seen, [["pm_5", true]]);
  assert.equal(pay().disabled, false);
  unmount();
});
