// src/pages/prezzeeSmartCardFulfillmentStatus.browser.test.mjs
//
// FIX 2026-09-23 (Team C, Prezzee fulfilment failure safety correction). A real production
// purchase showed "Smart Card purchased" for an order whose Prezzee vendor fulfilment had
// actually failed — finalizePrezzeeCardOrder() always returns the order regardless of vendor
// outcome. The backend now reports `fulfillmentStatus` ("failed"/"pending") on chargePrezzeeCard/
// finalizePrezzeeCard responses whenever it is anything other than confirmed. This file proves
// PrezzeeSmartCard.jsx only shows "Smart Card purchased" for a genuinely confirmed disposition.
//
// Harness identical to prezzeeSmartCard.browser.test.mjs (real component, faked ../api/api and
// ../components/PrezzeeCardConfirmationModal — the modal's own Stripe wiring is proven separately
// in prezzeeSmartCardDoubleSubmit.browser.test.mjs).
//
// Run (Node 20.x): node --test src/pages/prezzeeSmartCardFulfillmentStatus.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__pscfs.entry.jsx");
const FAKE_API = join(__dirname, ".__pscfs.fakeApi.js");
const FAKE_MODAL = join(__dirname, ".__pscfs.fakeModal.jsx");
const BUNDLE = join(__dirname, ".__pscfs.bundle.mjs");

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
    globalThis.__PSCFS_TEST__ = {
      calls,
      setResponses: (r) => { responses = { ...responses, ...r }; },
      reset: () => { calls.getPrezzeeCardTiles = []; calls.chargePrezzeeCard = []; calls.finalizePrezzeeCard = []; },
    };
    export default {
      getPrezzeeCardTiles: (...a) => { calls.getPrezzeeCardTiles.push(a); return responses.getPrezzeeCardTiles(...a); },
      chargePrezzeeCard: (...a) => { calls.chargePrezzeeCard.push(a); return responses.chargePrezzeeCard(...a); },
      finalizePrezzeeCard: (...a) => { calls.finalizePrezzeeCard.push(a); return responses.finalizePrezzeeCard(...a); },
    };
  `);
  writeFileSync(FAKE_MODAL, `
    import React from "react";
    export default function PrezzeeCardConfirmationModal({ isOpen, onClose, onConfirm, charging, chargeError }) {
      if (!isOpen) return null;
      const fakeStripe = { confirmCardPayment: async () => (globalThis.__PSCFS_TEST__.confirm3ds
        ? globalThis.__PSCFS_TEST__.confirm3ds()
        : { paymentIntent: { status: "succeeded" } }) };
      return React.createElement("div", { "data-testid": "fake-modal" },
        chargeError && React.createElement("div", { "data-testid": "modal-error" }, chargeError),
        React.createElement("button", {
          "data-testid": "fake-modal-confirm",
          disabled: charging,
          onClick: () => onConfirm("pm_fake_1", fakeStripe),
        }, "Confirm"),
        React.createElement("button", { "data-testid": "fake-modal-close", onClick: onClose }, "Close"),
      );
    }
  `);
  writeFileSync(ENTRY, `export { default as PrezzeeSmartCard } from "./PrezzeeSmartCard.jsx";`);
  const redirectPlugin = {
    name: "pscfs-test-redirects",
    setup(build) {
      build.onResolve({ filter: /(^|\/)api\/api(\.js)?$/ }, () => ({ path: FAKE_API }));
      build.onResolve({ filter: /PrezzeeCardConfirmationModal(\.jsx)?$/ }, () => ({ path: FAKE_MODAL }));
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
  globalThis.MouseEvent = dom.window.MouseEvent; globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  // Added 2026-09-23: PrezzeeSmartCard.jsx now calls useLocation(), which requires a Router
  // ancestor — the real app always provides one (App.jsx); this harness now does too.
  ({ MemoryRouter } = await import("react-router-dom"));
  const m = await import(pathToFileURL(BUNDLE).href);
  PrezzeeSmartCard = m.PrezzeeSmartCard;
  FAKE = globalThis.__PSCFS_TEST__;
});

after(() => {
  for (const f of [ENTRY, FAKE_API, FAKE_MODAL, BUNDLE]) { try { rmSync(f); } catch { /* already gone */ } }
});

beforeEach(() => { FAKE.reset(); FAKE.confirm3ds = null; });

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

async function purchase(s) {
  await click(s.q('[data-tile-id="prezzee_smart_card_1000"]'));
  await setValue(s.q('input[type="email"]'), "r@example.com");
  await setValue(s.qa("input").filter((i) => i.type !== "email")[0], "Dana");
  await flush();
  await click([...s.qa("button")].find((b) => /continue to payment/i.test(b.textContent)));
  await flush();
  await click(s.tid("fake-modal-confirm"));
  await flush();
}

// ── Confirmed fulfilment still produces the existing success behavior ──────────────────────────

test("a charge response with NO fulfillmentStatus field still shows the existing 'Smart Card purchased' success screen", async () => {
  const s = await mount(withRouter());
  await flush();
  await purchase(s);
  assert.match(s.text(), /Smart Card purchased/i);
  assert.match(s.text(), /\$10\.59/);
});

// ── Definite fulfillment failure must not display success ──────────────────────────────────────

test("a charge response with fulfillmentStatus:'failed' shows a truthful failure screen, never 'Smart Card purchased'", async () => {
  FAKE.setResponses({
    chargePrezzeeCard: async () => ({
      ok: true,
      gift: { claimToken: "t1", giftAmountCents: 1000, feeCents: 59, totalCents: 1059 },
      fulfillmentStatus: "failed",
      error: "Your payment was received, but we could not issue your Smart Card. Contact support for help.",
    }),
  });
  const s = await mount(withRouter());
  await flush();
  await purchase(s);
  assert.doesNotMatch(s.text(), /Smart Card purchased/i, "a definite fulfilment failure must never show the success headline");
  assert.match(s.text(), /could not issue your Smart Card/i);
  assert.match(s.text(), /\$10\.59/, "the charged total is still shown truthfully — money did move");
});

// ── Payment captured but fulfillment unresolved must display a truthful pending message ────────

test("a charge response with fulfillmentStatus:'pending' shows a truthful pending screen, never 'Smart Card purchased'", async () => {
  FAKE.setResponses({
    chargePrezzeeCard: async () => ({
      ok: true,
      gift: { claimToken: "t1", giftAmountCents: 1000, feeCents: 59, totalCents: 1059 },
      fulfillmentStatus: "pending",
      error: "Your payment was received. We're still confirming your Smart Card — check back shortly, or contact support if this persists.",
    }),
  });
  const s = await mount(withRouter());
  await flush();
  await purchase(s);
  assert.doesNotMatch(s.text(), /Smart Card purchased/i, "an unresolved fulfilment must never claim success");
  assert.match(s.text(), /still confirming/i);
});

// ── Same behavior on the 3DS / finalize path ─────────────────────────────────────────────────

test("a 3DS finalize response with fulfillmentStatus:'failed' shows the truthful failure screen, not success", async () => {
  FAKE.setResponses({
    chargePrezzeeCard: async () => ({ ok: true, requiresAction: true, clientSecret: "cs_test_1", paymentIntentId: "pi_test_1" }),
    finalizePrezzeeCard: async () => ({
      ok: true,
      gift: { claimToken: "t2", giftAmountCents: 1000, feeCents: 59, totalCents: 1059 },
      fulfillmentStatus: "failed",
      error: "Your payment was received, but we could not issue your Smart Card. Contact support for help.",
    }),
  });
  const s = await mount(withRouter());
  await flush();
  await purchase(s);
  assert.doesNotMatch(s.text(), /Smart Card purchased/i);
  assert.match(s.text(), /could not issue your Smart Card/i);
});
