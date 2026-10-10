// src/components/giftEntitlementCautionEmail.browser.test.mjs — LANE E3 (2026-10-10) fix 1.
// The real GiftEntitlementCautionModal, bundled and mounted in jsdom.
//
// Proves: an unconfirmed-email block shows ONLY "Confirm your email address to send. Check your inbox
// for the confirmation link." plus the existing resend action — never Top Up / Upgrade / Gift-only —
// and a verified, subscribed sender's caution is exactly what it was.
// Run (Node 20.x): node --test src/components/giftEntitlementCautionEmail.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, `.__gecem.${process.pid}.bundle.mjs`);
const ENTRY = join(__dirname, `.__gecem.${process.pid}.entry.jsx`);
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
const EMAIL_MSG = "Confirm your email address to send. Check your inbox for the confirmation link.";
const EMAIL_BLOCK = { canSendGreeting: false, reasonCode: "EMAIL_NOT_VERIFIED", message: EMAIL_MSG, remediation: ["confirm_email"] };

test("EMAIL_NOT_VERIFIED: shows the confirm-email message and no gift-only / top-up / upgrade offers", () => {
  for (const unsubscribed of [true, false]) {
    const { container, unmount } = mount({ preflight: EMAIL_BLOCK, unsubscribed, onResendConfirmation: async () => ({ ok: true }) });
    assert.equal(q(container, "caution-email-unconfirmed").textContent, EMAIL_MSG);
    for (const id of ["caution-topup", "caution-upgrade", "caution-gift-only", "caution-free-plan-headline"]) {
      assert.equal(q(container, id), null, `${id} (unsubscribed=${unsubscribed})`);
    }
    for (const text of ["Purchase Additional Sends", "Upgrade", "Gift Only", "Your gift may arrive without its Greet-Me"]) {
      assert.ok(!container.textContent.includes(text), text);
    }
    unmount();
  }
});

test("EMAIL_NOT_VERIFIED: falls back to the contract copy when the server sends no message", () => {
  const { container, unmount } = mount({ preflight: { canSendGreeting: false, reasonCode: "EMAIL_NOT_VERIFIED", remediation: ["confirm_email"] } });
  assert.equal(q(container, "caution-email-unconfirmed").textContent, EMAIL_MSG);
  unmount();
});

test("EMAIL_NOT_VERIFIED: the existing resend action is offered and called; Close resolves the block", async () => {
  let resent = 0, closed = 0;
  const { container, unmount } = mount({
    preflight: EMAIL_BLOCK, onResendConfirmation: async () => { resent += 1; return { ok: true }; }, onClose: () => { closed += 1; },
  });
  const btn = q(container, "caution-resend-confirmation");
  assert.match(btn.textContent, /Resend confirmation email/);
  await act(async () => { btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.equal(resent, 1);
  assert.ok(q(container, "caution-resend-sent"));
  click(q(container, "caution-cancel"));
  assert.equal(closed, 1);
  unmount();
});

test("EMAIL_NOT_VERIFIED: resend 400 (already verified) says the email is confirmed", async () => {
  const { container, unmount } = mount({ preflight: EMAIL_BLOCK, onResendConfirmation: async () => { throw Object.assign(new Error("Already verified"), { status: 400 }); } });
  await act(async () => { q(container, "caution-resend-confirmation").dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.ok(q(container, "caution-resend-verified"));
  unmount();
});

test("EMAIL_NOT_VERIFIED: a failed resend says so, without other offers", async () => {
  const { container, unmount } = mount({ preflight: EMAIL_BLOCK, onResendConfirmation: async () => { throw Object.assign(new Error("x"), { status: 429 }); } });
  await act(async () => { q(container, "caution-resend-confirmation").dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  assert.ok(q(container, "caution-resend-error"));
  assert.equal(q(container, "caution-gift-only"), null);
  unmount();
});

test("verified, subscribed sender: caution unchanged (generic copy, Purchase Additional Sends, Upgrade Plan, Gift-only; no email copy)", () => {
  const { container, unmount } = mount({ preflight: { canSendGreeting: false, remaining: 0, reasonCode: "WALLET_EXHAUSTED" }, unsubscribed: false, onResendConfirmation: async () => ({ ok: true }) });
  assert.ok(container.textContent.includes("Your gift may arrive without its Greet-Me"));
  assert.match(q(container, "caution-topup").textContent, /Purchase Additional Sends/);
  assert.match(q(container, "caution-upgrade").textContent, /Upgrade Plan/);
  assert.ok(q(container, "caution-gift-only"));
  assert.equal(q(container, "caution-email-unconfirmed"), null);
  assert.equal(q(container, "caution-resend-confirmation"), null);
  unmount();
});
