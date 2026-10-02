// src/components/giftSelectorQrCashAmount.browser.test.mjs
//
// FOUNDER-APPROVED SURFACE 3 AMOUNT STEP, mounted against the REAL GiftSelectorModal (jsdom):
//   * Custom QR Cash amount is whole dollars from $5 to $100 (the server's limits), with plain messages;
//   * the fee ($1.99 + 3%), the total and the timing (charged once, 30 days to claim) are shown for an
//     immediate send (context "oneoff"); no timing is claimed for the scheduled (recipient) context;
//   * an amount the server would refuse cannot be carried forward (Continue is disabled).
//
// Run (Node 20.x): node --test src/components/giftSelectorQrCashAmount.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__gsq.entry.jsx");
const BUNDLE = join(__dirname, ".__gsq.bundle.mjs");
let React, createRoot, act, Selector, window;

before(async () => {
  writeFileSync(ENTRY, 'export { default as Selector } from "./GiftSelectorModal.jsx";\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  Object.assign(global, { window, document: window.document, HTMLElement: window.HTMLElement, Node: window.Node, Event: window.Event, CustomEvent: window.CustomEvent, getComputedStyle: window.getComputedStyle });
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Selector } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { for (const f of [ENTRY, BUNDLE]) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

const q = (id) => document.querySelector(`[data-testid="${id}"]`);
const bodyText = () => (document.body.textContent || "").replace(/\s+/g, " ");

async function mountWith(initial, context = "oneoff") {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  const state = { setting: { type: "qrcash", amount: 25, customAmount: "", autoGift: false, ...initial }, closes: 0 };
  const render = async () => {
    await act(async () => {
      root.render(React.createElement(M(), {
        isOpen: true, onClose: () => { state.closes += 1; }, occasions: [{ type: "just_because", date: "2026-10-01" }],
        occasionGiftSettings: { just_because: state.setting },
        onGiftChange: (_o, field, value) => { state.setting = { ...state.setting, [field]: value }; return render(); },
        getOccasionLabel: () => "Just Because", getOccasionEmoji: () => "x", context, onBrowse: () => {},
      }));
    });
  };
  await render();
  return { state, render };
}
const M = () => Selector;
const customInput = () => document.querySelector('input[type="number"]');
async function typeCustom(h, value) {
  await act(async () => {
    const el = customInput();
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, String(value));
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
}

test("presets show fee ($1.99 + 3%), total and the immediate-send timing", async () => {
  await mountWith({ amount: 10 });
  assert.equal(q("qrcash-fee").textContent, "$2.29");
  assert.equal(q("qrcash-total").textContent, "$12.29");
  assert.match(bodyText(), /Processing fee \(\$1\.99 \+ 3%\)/);
  assert.match(q("qrcash-timing").textContent, /charged once, when you confirm/);
  assert.match(q("qrcash-timing").textContent, /30 days after delivery/);
  assert.match(q("qrcash-timing").textContent, /before any fee-waiver reward/);
  assert.equal(q("qrcash-amount-error"), null);
  assert.equal(q("gift-selector-continue").disabled, false);
});

test("Custom accepts whole dollars $5 to $100 and prices them", async () => {
  const h = await mountWith({ amount: 0, customAmount: "" });
  assert.ok(q("qrcash-amount-error"), "blank custom prompts for an amount");
  assert.equal(q("qrcash-fee-preview"), null);
  assert.equal(q("gift-selector-continue").disabled, true, "nothing to carry forward yet");
  assert.match(bodyText(), /Whole dollars from \$5 to \$100\./);
  const input = customInput();
  assert.equal(input.getAttribute("min"), "5");
  assert.equal(input.getAttribute("max"), "100");
  for (const [typed, fee, total] of [["5", "$2.14", "$7.14"], ["40", "$3.19", "$43.19"], ["100", "$4.99", "$104.99"]]) {
    await typeCustom(h, typed);
    assert.equal(q("qrcash-amount-error"), null, typed);
    assert.equal(q("qrcash-fee").textContent, fee, typed);
    assert.equal(q("qrcash-total").textContent, total, typed);
    assert.equal(q("gift-selector-continue").disabled, false, typed);
  }
});

test("Custom outside $5-$100 shows a plain message, no fee, and Continue is disabled", async () => {
  const h = await mountWith({ amount: 0, customAmount: "" });
  for (const [typed, msg] of [["3", /The smallest QR Cash gift is \$5\./], ["0", /The smallest QR Cash gift is \$5\./], ["101", /The largest QR Cash gift is \$100\./], ["500", /The largest QR Cash gift is \$100\./]]) {
    await typeCustom(h, typed);
    assert.match(q("qrcash-amount-error").textContent, msg, typed);
    assert.equal(q("qrcash-amount-error").getAttribute("role"), "alert");
    assert.equal(q("qrcash-fee-preview"), null, `${typed}: no fee for an amount the server would refuse`);
    assert.equal(q("gift-selector-continue").disabled, true, typed);
  }
});

test("scheduled (recipient) context: same validation and fee, but NO timing claim and no scheduled-charge wording", async () => {
  await mountWith({ amount: 25, autoGift: false }, "recipient");
  assert.equal(q("qrcash-fee").textContent, "$2.74".replace("2.74", "2.74"));
  assert.equal(q("qrcash-timing"), null, "no 'charged once' timing outside an immediate send");
  const t = bodyText();
  assert.doesNotMatch(t, /can.t be sent automatically|can.t be scheduled|Unavailable for QR Cash/i, "the disable-and-relabel option is not in the product");
});

test("non-QR-Cash gift types are unaffected", async () => {
  await mountWith({ type: "curated", maxSpend: 50 });
  assert.equal(q("qrcash-fee-preview"), null);
  assert.equal(q("gift-selector-continue").disabled, false);
});
