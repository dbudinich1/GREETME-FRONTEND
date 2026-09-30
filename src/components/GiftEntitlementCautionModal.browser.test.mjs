// src/components/GiftEntitlementCautionModal.browser.test.mjs — TEAM 1: gift/entitlement safety.
// The real component, bundled and mounted in jsdom.
//
// Run (Node 20.x): node --test src/components/GiftEntitlementCautionModal.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gecm.bundle.mjs");
const ENTRY = join(__dirname, ".__gecm.entry.jsx");
let React, createRoot, act, Component;

before(async () => {
  writeFileSync(ENTRY, `export { default as Component } from "./GiftEntitlementCautionModal.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  try { globalThis.navigator = dom.window.navigator; } catch { /* already a read-only global */ }
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

function mount(props) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(React.createElement(Component, props)); });
  return { container, root, unmount: () => act(() => root.unmount()) };
}
const q = (container, testid) => container.querySelector(`[data-testid="${testid}"]`);
const click = (el) => act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });

test("closed: renders nothing observable when isOpen is false", () => {
  const { container, unmount } = mount({ isOpen: false, preflight: null, onClose() {}, onTopUp() {}, onUpgrade() {}, onContinueGiftOnly() {} });
  assert.equal(q(container, "gift-entitlement-caution"), null);
  unmount();
});

test("open: the large caution triangle and exact founder-specified copy are present", () => {
  const { container, unmount } = mount({
    isOpen: true, preflight: { canSendGreeting: false, remaining: 0, reasonCode: "LIMIT_EXCEEDED" },
    onClose() {}, onTopUp() {}, onUpgrade() {}, onContinueGiftOnly() {},
  });
  assert.notEqual(q(container, "caution-triangle"), null, "the caution triangle icon must render");
  const text = container.textContent;
  assert.ok(text.includes("Your gift may arrive without its Greet-Me"));
  assert.ok(text.includes("Before we place your gift order, make sure you have a Greet-Me send available"));
  unmount();
});

test("open: all three remediation choices plus Cancel are present", () => {
  const { container, unmount } = mount({
    isOpen: true, preflight: { canSendGreeting: false, remaining: 0, reasonCode: "WALLET_EXHAUSTED" },
    onClose() {}, onTopUp() {}, onUpgrade() {}, onContinueGiftOnly() {},
  });
  assert.notEqual(q(container, "caution-topup"), null);
  assert.notEqual(q(container, "caution-upgrade"), null);
  assert.notEqual(q(container, "caution-gift-only"), null);
  assert.notEqual(q(container, "caution-cancel"), null);
  unmount();
});

test("Top Up and Upgrade call their handlers directly — no second confirmation gate on those two", () => {
  let topUpCalled = false, upgradeCalled = false;
  const { container, unmount } = mount({
    isOpen: true, preflight: { canSendGreeting: false, remaining: 0, reasonCode: "LIMIT_EXCEEDED" },
    onClose() {}, onTopUp: () => { topUpCalled = true; }, onUpgrade: () => { upgradeCalled = true; }, onContinueGiftOnly() {},
  });
  click(q(container, "caution-topup"));
  assert.equal(topUpCalled, true);
  click(q(container, "caution-upgrade"));
  assert.equal(upgradeCalled, true);
  unmount();
});

test("Continue with Gift Only does NOT call onContinueGiftOnly directly — it opens a second confirmation first", () => {
  let called = false;
  const { container, unmount } = mount({
    isOpen: true, preflight: { canSendGreeting: false, remaining: 0, reasonCode: "LIMIT_EXCEEDED" },
    onClose() {}, onTopUp() {}, onUpgrade() {}, onContinueGiftOnly: () => { called = true; },
  });
  click(q(container, "caution-gift-only"));
  assert.equal(called, false, "must NOT call the real handler on the first click");
  assert.notEqual(q(container, "gift-only-second-confirmation"), null, "the second confirmation screen must appear");
  const text = container.textContent;
  assert.ok(text.includes("Your gift may arrive without a Greet-Me"));
  assert.ok(/[Ss]ure/.test(text));
  unmount();
});

test("the second confirmation's explicit Yes calls onContinueGiftOnly exactly once", async () => {
  let calls = 0;
  const { container, unmount } = mount({
    isOpen: true, preflight: { canSendGreeting: false, remaining: 0, reasonCode: "LIMIT_EXCEEDED" },
    onClose() {}, onTopUp() {}, onUpgrade() {}, onContinueGiftOnly: async () => { calls += 1; },
  });
  click(q(container, "caution-gift-only"));
  await act(async () => { click(q(container, "gift-only-confirm")); });
  assert.equal(calls, 1);
  unmount();
});

test("Back on the second confirmation returns to the first screen without calling anything", () => {
  let called = false;
  const { container, unmount } = mount({
    isOpen: true, preflight: { canSendGreeting: false, remaining: 0, reasonCode: "LIMIT_EXCEEDED" },
    onClose() {}, onTopUp() {}, onUpgrade() {}, onContinueGiftOnly: () => { called = true; },
  });
  click(q(container, "caution-gift-only"));
  click(q(container, "gift-only-back"));
  assert.equal(called, false);
  assert.notEqual(q(container, "gift-entitlement-caution"), null, "back to the first screen");
  unmount();
});

test("Cancel calls onClose and nothing else", () => {
  let closeCalled = false, topUpCalled = false, giftOnlyCalled = false;
  const { container, unmount } = mount({
    isOpen: true, preflight: { canSendGreeting: false, remaining: 0, reasonCode: "LIMIT_EXCEEDED" },
    onClose: () => { closeCalled = true; }, onTopUp: () => { topUpCalled = true; },
    onUpgrade() {}, onContinueGiftOnly: () => { giftOnlyCalled = true; },
  });
  click(q(container, "caution-cancel"));
  assert.equal(closeCalled, true);
  assert.equal(topUpCalled, false);
  assert.equal(giftOnlyCalled, false);
  unmount();
});

test("remaining-state copy reflects the specific reasonCode, not a generic message", () => {
  const { container, unmount } = mount({
    isOpen: true, preflight: { canSendGreeting: false, remaining: 0, reasonCode: "TRIAL_EXPIRED" },
    onClose() {}, onTopUp() {}, onUpgrade() {}, onContinueGiftOnly() {},
  });
  assert.ok(container.textContent.includes("free trial has ended"));
  unmount();
});
