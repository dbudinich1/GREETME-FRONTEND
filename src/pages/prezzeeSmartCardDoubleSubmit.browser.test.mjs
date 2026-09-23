// src/pages/prezzeeSmartCardDoubleSubmit.browser.test.mjs
//
// BROWSER-LEVEL proof of the 2026-09-23 duplicate-submit fix. Unlike prezzeeSmartCard.browser.
// test.mjs (which fakes out PrezzeeCardConfirmationModal.jsx entirely, calling onConfirm
// SYNCHRONOUSLY on click), THIS file mounts the REAL PrezzeeCardConfirmationModal.jsx — the
// component that actually contains the fix — so the real gap this closes (a click, then an
// AWAITED stripe.createPaymentMethod() call, only THEN onConfirm) is genuinely exercised. Only
// Stripe.js itself (@stripe/react-stripe-js, ../stripe/stripeProvider) and ../api/api are faked:
// no real network, no real Stripe iframe. createPaymentMethod's own resolution is held open by
// the test so a second click/Enter/repeated invocation has a real window to race into, exactly
// reproducing the production incident (two POST /prezzee-card requests for one reported click).
//
// Run (Node 20.x): node --test src/pages/prezzeeSmartCardDoubleSubmit.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__pscds.entry.jsx");
const FAKE_API = join(__dirname, ".__pscds.fakeApi.js");
const FAKE_STRIPE_PROVIDER = join(__dirname, ".__pscds.fakeStripeProvider.js");
const FAKE_STRIPE_JS = join(__dirname, ".__pscds.fakeStripeJs.jsx");
const BUNDLE = join(__dirname, ".__pscds.bundle.mjs");

let React, createRoot, act, PrezzeeSmartCard, dom, FAKE, MemoryRouter;

before(async () => {
  writeFileSync(FAKE_API, `
    const calls = { getPrezzeeCardTiles: [], chargePrezzeeCard: [], finalizePrezzeeCard: [] };
    let responses = {
      getPrezzeeCardTiles: async () => ({ ok: true, product: { name: "Greet-Me Smart Card, powered by Prezzee", poweredBy: "Prezzee" }, tiles: [
        { id: "prezzee_smart_card_1000", displayAmount: "$10", amountCents: 1000, sharedArtwork: true },
      ] }),
      chargePrezzeeCard: async () => ({ ok: true, gift: { claimToken: "t1", giftAmountCents: 1000, feeCents: 59, totalCents: 1059 } }),
      finalizePrezzeeCard: async () => ({ ok: true, gift: { claimToken: "t1", giftAmountCents: 1000, feeCents: 59, totalCents: 1059 } }),
    };
    globalThis.__PSCDS_TEST__.calls = calls;
    globalThis.__PSCDS_TEST__.setChargeResponse = (fn) => { responses.chargePrezzeeCard = fn; };
    globalThis.__PSCDS_TEST__.resetApiCalls = () => { calls.getPrezzeeCardTiles = []; calls.chargePrezzeeCard = []; calls.finalizePrezzeeCard = []; };
    export default {
      getPrezzeeCardTiles: (...a) => { calls.getPrezzeeCardTiles.push(a); return responses.getPrezzeeCardTiles(...a); },
      chargePrezzeeCard: (...a) => { calls.chargePrezzeeCard.push(a); return responses.chargePrezzeeCard(...a); },
      finalizePrezzeeCard: (...a) => { calls.finalizePrezzeeCard.push(a); return responses.finalizePrezzeeCard(...a); },
    };
  `);
  writeFileSync(FAKE_STRIPE_PROVIDER, `export const stripePromise = Promise.resolve({});`);
  // A minimal, controllable stand-in for @stripe/react-stripe-js. createPaymentMethod's
  // resolution is held open (never auto-resolves) until the test explicitly releases it via
  // __PSCDS_TEST__.resolveCreatePaymentMethod() / rejectCreatePaymentMethod() — this is what
  // creates a genuine, observable race window identical in shape to the real network round trip
  // that caused the production incident.
  writeFileSync(FAKE_STRIPE_JS, `
    import React from "react";
    export function Elements({ children }) { return children; }
    export function CardElement({ onChange }) {
      React.useEffect(() => { onChange({ complete: true }); }, []);
      return React.createElement("div", { "data-testid": "fake-card-element" });
    }
    export function useStripe() {
      return {
        createPaymentMethod: (...args) => {
          globalThis.__PSCDS_TEST__.createPaymentMethodCalls.push(args);
          return new Promise((resolve, reject) => {
            globalThis.__PSCDS_TEST__.pendingCreatePaymentMethod.push({ resolve, reject });
          });
        },
        confirmCardPayment: async () => ({ paymentIntent: { status: "succeeded" } }),
      };
    }
    export function useElements() {
      return { getElement: () => ({}) };
    }
  `);
  writeFileSync(ENTRY, `export { default as PrezzeeSmartCard } from "./PrezzeeSmartCard.jsx";`);
  const redirectPlugin = {
    name: "pscds-test-redirects",
    setup(build) {
      build.onResolve({ filter: /(^|\/)api\/api(\.js)?$/ }, () => ({ path: FAKE_API }));
      build.onResolve({ filter: /stripe\/stripeProvider(\.js)?$/ }, () => ({ path: FAKE_STRIPE_PROVIDER }));
      build.onResolve({ filter: /^@stripe\/react-stripe-js$/ }, () => ({ path: FAKE_STRIPE_JS }));
    },
  };
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
    plugins: [redirectPlugin],
  });
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  try { globalThis.navigator = dom.window.navigator; } catch { /* already a read-only global */ }
  globalThis.MouseEvent = dom.window.MouseEvent; globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.__PSCDS_TEST__ = { createPaymentMethodCalls: [], pendingCreatePaymentMethod: [] };
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  // Added 2026-09-23: PrezzeeSmartCard.jsx now calls useLocation(), which requires a Router
  // ancestor — the real app always provides one (App.jsx); this harness now does too.
  ({ MemoryRouter } = await import("react-router-dom"));
  const m = await import(pathToFileURL(BUNDLE).href);
  PrezzeeSmartCard = m.PrezzeeSmartCard;
  FAKE = globalThis.__PSCDS_TEST__;
});

after(() => {
  for (const f of [ENTRY, FAKE_API, FAKE_STRIPE_PROVIDER, FAKE_STRIPE_JS, BUNDLE]) { try { rmSync(f); } catch { /* already gone */ } }
});

beforeEach(() => {
  FAKE.resetApiCalls();
  FAKE.createPaymentMethodCalls = [];
  FAKE.pendingCreatePaymentMethod = [];
});

async function mount(el) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  return {
    host, root,
    q: (sel) => host.querySelector(sel), qa: (sel) => [...host.querySelectorAll(sel)],
    tid: (t) => host.querySelector(`[data-testid="${t}"]`),
    text: () => host.textContent,
  };
}
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); };
const clickSync = (el) => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); };
const enterKey = (el) => { el.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true })); };
const setValue = async (el, v) => { await act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}); };
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

function withRouter() {
  return React.createElement(
    MemoryRouter,
    { initialEntries: [{ pathname: "/dashboard/gifts/smart-card", state: null }] },
    React.createElement(PrezzeeSmartCard),
  );
}

async function mountAtConfirmModal() {
  const s = await mount(withRouter());
  await flush();
  await click(s.q('[data-tile-id="prezzee_smart_card_1000"]'));
  await setValue(s.q('input[type="email"]'), "r@example.com");
  await setValue(s.qa("input").filter((i) => i.type !== "email")[0], "Dana");
  await flush();
  await click([...s.qa("button")].find((b) => /continue to payment/i.test(b.textContent)));
  await flush();
  const confirmBtn = [...s.qa("button")].find((b) => /confirm & charge/i.test(b.textContent));
  return { s, confirmBtn };
}

function resolveAllPendingCreatePaymentMethod(result) {
  const pending = FAKE.pendingCreatePaymentMethod.splice(0, FAKE.pendingCreatePaymentMethod.length);
  for (const p of pending) p.resolve(result);
  return pending.length;
}

const FAKE_PM_SUCCESS = { error: undefined, paymentMethod: { id: "pm_fake_1" } };

// ── One user action -> exactly one payment-method request and one POST ──────────────────────

test("one click produces exactly one createPaymentMethod call and exactly one POST /prezzee-card call", async () => {
  const { confirmBtn } = await mountAtConfirmModal();
  await click(confirmBtn);
  assert.equal(FAKE.createPaymentMethodCalls.length, 1, "exactly one createPaymentMethod call");

  await act(async () => { resolveAllPendingCreatePaymentMethod(FAKE_PM_SUCCESS); });
  await flush();

  assert.equal(FAKE.calls.chargePrezzeeCard.length, 1, "exactly one POST /prezzee-card call");
  assert.equal(FAKE.calls.chargePrezzeeCard[0][0].tileId, "prezzee_smart_card_1000");
});

// ── Negative test: double-click while createPaymentMethod is still in flight ────────────────

test("NEGATIVE — double-click during the createPaymentMethod round trip produces exactly one request, not two", async () => {
  const { confirmBtn } = await mountAtConfirmModal();

  // Two clicks fired back to back, BEFORE createPaymentMethod ever resolves — this is exactly the
  // production race window: a real network round trip that used to be entirely unguarded.
  await click(confirmBtn);
  await click(confirmBtn);

  assert.equal(FAKE.createPaymentMethodCalls.length, 1,
    "the synchronous one-shot lock must reject the second click before a second createPaymentMethod call is ever made");
  assert.equal(confirmBtn.disabled, true, "the button must already be disabled after the first click, before createPaymentMethod resolves");

  await act(async () => { resolveAllPendingCreatePaymentMethod(FAKE_PM_SUCCESS); });
  await flush();

  assert.equal(FAKE.calls.chargePrezzeeCard.length, 1, "exactly one POST /prezzee-card call, never two, for two clicks");
});

// ── Negative test: rapid repeated invocation in the same synchronous tick ───────────────────

test("NEGATIVE — five rapid repeated click dispatches in the same tick produce exactly one request", async () => {
  const { confirmBtn } = await mountAtConfirmModal();

  await act(async () => {
    for (let i = 0; i < 5; i++) clickSync(confirmBtn);
  });

  assert.equal(FAKE.createPaymentMethodCalls.length, 1,
    "the ref-based guard is synchronous, so even 5 same-tick invocations before any re-render must collapse to one");

  await act(async () => { resolveAllPendingCreatePaymentMethod(FAKE_PM_SUCCESS); });
  await flush();
  assert.equal(FAKE.calls.chargePrezzeeCard.length, 1);
});

// ── Negative test: Enter and a click landing together ────────────────────────────────────────

test("NEGATIVE — Enter and a mouse click landing together produce exactly one request", async () => {
  const { confirmBtn } = await mountAtConfirmModal();

  // A focused native <button> treats Enter as an equivalent activation to a click; simulate both
  // signals arriving in the same synchronous window a real fast keyboard+mouse overlap would
  // produce, exercising the same handler regardless of trigger source.
  await act(async () => {
    enterKey(confirmBtn);
    clickSync(confirmBtn);
    clickSync(confirmBtn);
  });

  assert.equal(FAKE.createPaymentMethodCalls.length, 1, "Enter/click overlap must still collapse to exactly one request");

  await act(async () => { resolveAllPendingCreatePaymentMethod(FAKE_PM_SUCCESS); });
  await flush();
  assert.equal(FAKE.calls.chargePrezzeeCard.length, 1);
});

// ── Legitimate recovery: a safe createPaymentMethod failure must not permanently lock the button ─

test("a createPaymentMethod validation failure resets the lock so a legitimate retry can proceed", async () => {
  const { confirmBtn, s } = await mountAtConfirmModal();
  await click(confirmBtn);
  assert.equal(FAKE.createPaymentMethodCalls.length, 1);

  await act(async () => {
    resolveAllPendingCreatePaymentMethod({ error: { message: "Your card number is incomplete." } });
  });
  await flush();

  assert.match(s.text(), /Your card number is incomplete\./, "the card error must be shown");
  assert.equal(confirmBtn.disabled, false, "the button must be re-enabled after a safe, pre-server validation failure");
  assert.equal(FAKE.calls.chargePrezzeeCard.length, 0, "no charge attempt must ever have reached the server for a card validation failure");

  // A genuine later retry must work normally — exactly one more createPaymentMethod call, and it
  // reaches the server this time.
  await click(confirmBtn);
  assert.equal(FAKE.createPaymentMethodCalls.length, 2, "the retry must be allowed to call createPaymentMethod again");
  await act(async () => { resolveAllPendingCreatePaymentMethod(FAKE_PM_SUCCESS); });
  await flush();
  assert.equal(FAKE.calls.chargePrezzeeCard.length, 1, "the retry's single charge attempt reaches the server exactly once");
});
