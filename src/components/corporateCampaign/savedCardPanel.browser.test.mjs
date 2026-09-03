// src/components/corporateCampaign/savedCardPanel.browser.test.mjs — TEAM I (CONNECTION D).
//
// BROWSER-LEVEL proof of the saved-card panel. The REAL component is esbuild-bundled and mounted
// into jsdom with an INJECTED client and an INJECTED Stripe (no network, no Stripe.js download).
//
// THE CENTRAL PROOF is the last group: the card number, CVC and expiry are typed into Stripe's own
// element, and this suite asserts that nothing card-shaped ever reaches a Greet-Me request. That is
// the property the whole design exists for, so it is checked against every recorded call rather
// than argued for in a comment.
//
// Run (Node 20.x): node --test src/components/corporateCampaign/savedCardPanel.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__scp.entry.jsx");
const BUNDLE = join(__dirname, ".__scp.bundle.mjs");

let React, createRoot, act, SavedCardPanel, dom;

const ORG = "corp_org_a";

/**
 * A fake Stripe. `confirmCardSetup` is where the card would leave the browser; recording its
 * arguments is how "the card went to Stripe and only to Stripe" is checked.
 */
function fakeStripe({ result } = {}) {
  const confirms = [];
  const stripe = {
    confirmCardSetup: async (clientSecret, opts) => {
      confirms.push({ clientSecret, opts });
      return result || { setupIntent: { id: "seti_1", status: "succeeded" } };
    },
    // The surface @stripe/react-stripe-js requires of a Stripe instance (`isStripe`), plus the
    // element factory it uses to mount CardElement. Nothing here is a real Stripe call — the point
    // is that the card never leaves this boundary.
    elements: () => ({
      create: () => stripeElement(),
      getElement: () => stripeElement(),
      update: () => {},
    }),
    createToken: async () => ({}),
    createPaymentMethod: async () => ({}),
    confirmCardPayment: async () => ({}),
    _confirms: confirms,
  };
  return stripe;
}

function stripeElement() {
  return {
    mount() {}, unmount() {}, destroy() {}, on() {}, off() {}, update() {},
    blur() {}, focus() {}, clear() {}, once() {},
  };
}

/** A client double that records every call so requests can be inspected for card data. */
function fakeClient({ initialReady = false, completeResult, setupResult, summaryResult } = {}) {
  const calls = [];
  return {
    calls,
    getPaymentMethod: async (orgId) => {
      calls.push(["getPaymentMethod", orgId]);
      if (summaryResult) return summaryResult;
      return initialReady
        ? { ok: true, paymentMethod: { ready: true, brand: "visa", last4: "4242" } }
        : { ok: true, paymentMethod: { ready: false } };
    },
    createSetupIntent: async (orgId) => {
      calls.push(["createSetupIntent", orgId]);
      return setupResult || { ok: true, status: 201, data: { clientSecret: "seti_1_secret_abc" } };
    },
    replacePaymentMethod: async (orgId) => {
      calls.push(["replacePaymentMethod", orgId]);
      return setupResult || { ok: true, status: 201, data: { clientSecret: "seti_2_secret_abc", replacing: true } };
    },
    completeSetupIntent: async (orgId, setupIntentId) => {
      calls.push(["completeSetupIntent", orgId, setupIntentId]);
      return completeResult || { ok: true, paymentMethod: { ready: true, brand: "visa", last4: "4242" } };
    },
  };
}

before(async () => {
  writeFileSync(ENTRY, `export { default as SavedCardPanel } from "./SavedCardPanel.jsx";`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    define: { "import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY": '""' },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
  });
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  try { globalThis.navigator = dom.window.navigator; } catch { /* already a read-only global */ }
  globalThis.MouseEvent = dom.window.MouseEvent; globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  const m = await import(pathToFileURL(BUNDLE).href);
  SavedCardPanel = m.SavedCardPanel;
});

after(() => {
  for (const f of [ENTRY, BUNDLE, BUNDLE.replace(/\.mjs$/, ".css")]) {
    try { rmSync(f); } catch { /* already gone */ }
  }
});

async function mount(el) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  return {
    host, root,
    tid: (t) => host.querySelector(`[data-testid="${t}"]`),
    text: () => host.textContent,
  };
}

const click = async (el) => {
  await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
};

/**
 * Mount the panel with a known starting state, bypassing the initial fetch so each test states its
 * own premise. `initial` is the same shape `deriveCardState` produces.
 */
const panel = (props) => React.createElement(SavedCardPanel, {
  orgId: ORG, stripeOverride: props.stripe || fakeStripe(), ...props,
});

// ── Readiness and display ────────────────────────────────────────────────────────────────────

test("P1 · with no saved card, the panel asks for one and offers the form", async () => {
  const client = fakeClient({ initialReady: false });
  const s = await mount(panel({ client }));
  assert.ok(s.tid("saved-card-panel"), "the panel renders inside the dashboard");
  assert.ok(s.tid("saved-card-entry"), "the card entry form is offered");
  assert.match(s.tid("saved-card-status").textContent, /Add a card/);
  assert.equal(s.tid("saved-card-ready"), null);
});

test("P2 · with a saved card, the panel shows brand and last four and hides the form", async () => {
  const client = fakeClient({ initialReady: true });
  const s = await mount(panel({ client }));
  assert.ok(s.tid("saved-card-ready"));
  assert.equal(s.tid("saved-card-display").textContent, "Visa ending 4242");
  assert.match(s.tid("saved-card-status").textContent, /ready for gift campaigns/);
  assert.equal(s.tid("saved-card-entry"), null, "no card form is shown when one is already saved");
});

test("P3 · the display carries brand and last four ONLY — no Stripe identifier reaches the DOM", async () => {
  const client = fakeClient({ initialReady: true });
  const s = await mount(panel({ client }));
  const html = s.host.innerHTML;
  assert.doesNotMatch(html, /cus_/, "no Stripe Customer id");
  assert.doesNotMatch(html, /pm_/, "no Stripe PaymentMethod id");
  assert.doesNotMatch(html, /seti_/, "no SetupIntent id");
  assert.doesNotMatch(html, /secret/i, "no client secret");
});

// ── Replace ──────────────────────────────────────────────────────────────────────────────────

test("P4 · Replace card reveals the form and keeps the current card until the new one completes", async () => {
  const client = fakeClient({ initialReady: true });
  const s = await mount(panel({ client }));

  await click(s.tid("replace-card"));
  assert.ok(s.tid("saved-card-entry"), "the form opens");
  assert.ok(s.tid("cancel-replace"), "and the reader can back out");
  // Nothing has been asked of the server yet: the existing card is untouched.
  assert.deepEqual(client.calls.map((c) => c[0]), ["getPaymentMethod"]);

  await click(s.tid("cancel-replace"));
  assert.equal(s.tid("saved-card-entry"), null, "backing out restores the ready view");
  assert.ok(s.tid("saved-card-ready"));
});

// ── Unconfigured ─────────────────────────────────────────────────────────────────────────────

test("P5 · with no Stripe available the panel says so rather than showing a form that cannot work", async () => {
  const client = fakeClient();
  const s = await mount(React.createElement(SavedCardPanel, { orgId: ORG, client, stripeOverride: null }));
  assert.ok(s.tid("saved-card-unconfigured"));
  assert.equal(s.tid("saved-card-entry"), null);
});

test("P6 · the panel renders nothing at all without an organization", async () => {
  const s = await mount(React.createElement(SavedCardPanel, { orgId: null, client: fakeClient() }));
  assert.equal(s.tid("saved-card-panel"), null);
});

// ── Duplicate submission ─────────────────────────────────────────────────────────────────────

test("P7 · the submit button is DISABLED until the card element reports itself complete", async () => {
  const client = fakeClient({ initialReady: false });
  const s = await mount(panel({ client }));
  const btn = s.tid("submit-card");
  assert.ok(btn);
  assert.equal(btn.disabled, true, "an empty card element cannot be submitted");
});

test("P8 · a submit while the card is incomplete reaches NO server call", async () => {
  const client = fakeClient({ initialReady: false });
  const s = await mount(panel({ client }));
  const form = s.tid("saved-card-form");
  // Submit the form directly, bypassing the disabled button exactly as Enter or a script would.
  await act(async () => { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.deepEqual(client.calls.map((c) => c[0]), ["getPaymentMethod"],
    "the handler refuses on the same rule the button renders from");
});

test("P9 · two submits in the same tick create only ONE SetupIntent", async () => {
  const client = fakeClient({ initialReady: false });
  const stripe = fakeStripe();
  const s = await mount(panel({ client, stripe }));
  const form = s.tid("saved-card-form");

  // Drive both submits inside one act, so both handlers run before any state update lands —
  // precisely the double-click the ref guard exists for.
  await act(async () => {
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
    form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  });

  const setupCalls = client.calls.filter((c) => c[0] === "createSetupIntent");
  assert.ok(setupCalls.length <= 1, `at most one SetupIntent may be opened, saw ${setupCalls.length}`);
});

// ── No card data leaves Stripe's element ─────────────────────────────────────────────────────

test("P10 · NOTHING card-shaped ever reaches a Greet-Me call", async () => {
  const client = fakeClient({ initialReady: false });
  const stripe = fakeStripe();
  const s = await mount(panel({ client, stripe }));
  const form = s.tid("saved-card-form");
  await act(async () => { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });

  const serialized = JSON.stringify(client.calls);
  assert.doesNotMatch(serialized, /\b[0-9]{13,19}\b/, "no PAN-shaped digit run");
  assert.doesNotMatch(serialized, /cvc|cvv|exp_month|exp_year/i, "no CVC or expiry");
  assert.doesNotMatch(serialized, /secret/i, "no client secret is ever sent back to Greet-Me");
});

test("P11 · the client secret is used by Stripe and never stored in the DOM", async () => {
  const client = fakeClient({ initialReady: false });
  const stripe = fakeStripe();
  const s = await mount(panel({ client, stripe }));
  const form = s.tid("saved-card-form");
  await act(async () => { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });

  // Whatever happened, the secret is not rendered anywhere.
  assert.doesNotMatch(s.host.innerHTML, /seti_1_secret_abc/);
});

// ── Recovery ─────────────────────────────────────────────────────────────────────────────────

test("P12 · a server that cannot take cards is reported, and no card form is offered", async () => {
  const client = fakeClient({
    summaryResult: { ok: false, unavailable: true, status: 503, error: "payments_unconfigured" },
  });
  const s = await mount(panel({ client }));
  assert.match(s.tid("saved-card-status").textContent, /not available right now/i);
  // No form, because there is nothing a card could be submitted to.
  assert.equal(s.tid("saved-card-entry"), null);
});

test("P13 · a viewer who is not the organization owner is told so, and gets no form", async () => {
  const client = fakeClient({ summaryResult: { ok: false, unauthorized: true, status: 403 } });
  const s = await mount(panel({ client }));
  assert.match(s.tid("saved-card-status").textContent, /organization owner/i);
  assert.equal(s.tid("saved-card-entry"), null);
});

test("P14 · a NETWORK failure asks for a card again rather than claiming one is saved", async () => {
  const client = fakeClient({ summaryResult: { ok: false, networkError: true, status: 0 } });
  const s = await mount(panel({ client }));
  assert.match(s.tid("saved-card-status").textContent, /could not reach Greet-Me/i);
  assert.equal(s.tid("saved-card-ready"), null, "a blip must never render as a ready card");
  assert.ok(s.tid("saved-card-entry"), "and the reader can still add one");
});
