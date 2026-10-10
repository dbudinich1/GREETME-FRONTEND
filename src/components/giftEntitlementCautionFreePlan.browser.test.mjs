// src/components/giftEntitlementCautionFreePlan.browser.test.mjs — LANE E2 (2026-10-10) fixes D + B.
// The real GiftEntitlementCautionModal, bundled and mounted in jsdom.
//
// Proves: an expired trial / free-plan account is told the real reason in plain words, offered
// Upgrade and the existing Gift-only path, and NEVER "Purchase Additional Sends"; a subscribed
// account still sees "Purchase Additional Sends" exactly where it does today.
// Run (Node 20.x): node --test src/components/giftEntitlementCautionFreePlan.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, `.__gecfp.${process.pid}.bundle.mjs`);
const ENTRY = join(__dirname, `.__gecfp.${process.pid}.entry.jsx`);
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

function mount(props) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => { root.render(React.createElement(Component, { isOpen: true, onClose() {}, onTopUp() {}, onUpgrade() {}, onContinueGiftOnly() {}, ...props })); });
  return { container, unmount: () => act(() => root.unmount()) };
}
const q = (c, id) => c.querySelector(`[data-testid="${id}"]`);
const click = (el) => act(() => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
const EXPIRED = { canSendGreeting: false, remaining: 0, reasonCode: "TRIAL_EXPIRED", remediation: ["top_up", "upgrade", "gift_only"] };

test("TRIAL_EXPIRED: plain copy 'Your free trial has ended — upgrade to send.' and no generic caution headline", () => {
  const { container, unmount } = mount({ preflight: EXPIRED, unsubscribed: true });
  assert.equal(q(container, "caution-free-plan-headline").textContent, "Your free trial has ended — upgrade to send.");
  assert.ok(!container.textContent.includes("Your gift may arrive without its Greet-Me"));
  unmount();
});

test("TRIAL_EXPIRED: no 'Purchase Additional Sends' — even if the caller did not pass unsubscribed", () => {
  for (const unsubscribed of [true, false]) {
    const { container, unmount } = mount({ preflight: EXPIRED, unsubscribed });
    assert.equal(q(container, "caution-topup"), null, `unsubscribed=${unsubscribed}`);
    assert.ok(!container.textContent.includes("Purchase Additional Sends"));
    unmount();
  }
});

test("TRIAL_EXPIRED: Upgrade calls onUpgrade; Gift-only is still offered behind its second confirmation", async () => {
  let upgraded = 0, giftOnly = 0;
  const { container, unmount } = mount({ preflight: EXPIRED, unsubscribed: true, onUpgrade: () => { upgraded += 1; }, onContinueGiftOnly: async () => { giftOnly += 1; } });
  assert.match(q(container, "caution-upgrade").textContent, /Upgrade/);
  click(q(container, "caution-upgrade"));
  assert.equal(upgraded, 1);
  click(q(container, "caution-gift-only"));
  assert.equal(giftOnly, 0, "never one click away");
  assert.ok(q(container, "gift-only-second-confirmation"));
  assert.ok(!container.textContent.includes("top up"), "no top-up promise in the confirmation either");
  await act(async () => { click(q(container, "gift-only-confirm")); });
  assert.equal(giftOnly, 1);
  unmount();
});

test("unsubscribed account, any block reason: never offered Purchase Additional Sends", () => {
  for (const reasonCode of ["LIMIT_EXCEEDED", "WALLET_EXHAUSTED", "PREFLIGHT_UNAVAILABLE"]) {
    const { container, unmount } = mount({ preflight: { canSendGreeting: false, remaining: 0, reasonCode }, unsubscribed: true });
    assert.equal(q(container, "caution-topup"), null, reasonCode);
    assert.ok(q(container, "caution-upgrade"), reasonCode);
    assert.ok(q(container, "caution-gift-only"), reasonCode);
    unmount();
  }
});

test("unsubscribed LIMIT_EXCEEDED (trial sends used up): plain, accurate reason", () => {
  const { container, unmount } = mount({ preflight: { canSendGreeting: false, remaining: 0, reasonCode: "LIMIT_EXCEEDED" }, unsubscribed: true });
  assert.match(q(container, "caution-free-plan-headline").textContent, /used all your free trial Greet-Mes — upgrade to send/);
  unmount();
});

test("subscribed account: Purchase Additional Sends still offered where it is today (LIMIT_EXCEEDED, WALLET_EXHAUSTED)", () => {
  for (const reasonCode of ["LIMIT_EXCEEDED", "WALLET_EXHAUSTED"]) {
    let topped = 0;
    const { container, unmount } = mount({ preflight: { canSendGreeting: false, remaining: 0, reasonCode }, unsubscribed: false, onTopUp: () => { topped += 1; } });
    const btn = q(container, "caution-topup");
    assert.ok(btn, reasonCode);
    assert.match(btn.textContent, /Purchase Additional Sends/);
    assert.ok(container.textContent.includes("Your gift may arrive without its Greet-Me"), "copy unchanged for subscribed");
    click(btn);
    assert.equal(topped, 1);
    unmount();
  }
});
