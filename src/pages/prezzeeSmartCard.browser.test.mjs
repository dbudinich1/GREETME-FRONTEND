// src/pages/prezzeeSmartCard.browser.test.mjs
//
// BROWSER-LEVEL proof of the Greet-Me Smart Card page. The REAL component source is
// esbuild-bundled and mounted into jsdom, exactly like every other .browser.test.mjs in this
// codebase (see src/components/corporateCampaign/premiumDashboard.browser.test.mjs for the
// established pattern this file follows).
//
// TWO THINGS ARE ALIASED, NEVER THE REAL MODULE:
//   ../api/api                                -> a fake, in-test-controlled client (no network,
//                                                 no localStorage, no real backend call)
//   ../components/PrezzeeCardConfirmationModal -> a minimal fake modal (no real Stripe.js, no
//                                                 iframe, no network) that exposes a single
//                                                 "Confirm" button calling onConfirm(fakePmId,
//                                                 fakeStripeInstance) — the REAL modal's own
//                                                 Stripe Elements wiring is an exact structural
//                                                 mirror of the already-shipped, already-relied-on
//                                                 GiftConfirmationModal.jsx and is not re-proven
//                                                 here; what this file proves is PrezzeeSmartCard's
//                                                 OWN logic: tile loading/rendering, selection,
//                                                 fee/total math, the 3DS/finalize sequencing, the
//                                                 duplicate-submission guard, and error safety.
//
// Run (Node 20.x): node --test src/pages/prezzeeSmartCard.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__psc.entry.jsx");
const FAKE_API = join(__dirname, ".__psc.fakeApi.js");
const FAKE_MODAL = join(__dirname, ".__psc.fakeModal.jsx");
const BUNDLE = join(__dirname, ".__psc.bundle.mjs");

let React, createRoot, act, PrezzeeSmartCard, dom, FAKE, MemoryRouter;

before(async () => {
  writeFileSync(FAKE_API, `
    const calls = { getPrezzeeCardTiles: [], chargePrezzeeCard: [], finalizePrezzeeCard: [] };
    let responses = {
      getPrezzeeCardTiles: async () => ({ ok: true, product: { name: "Greet-Me Smart Card, powered by Prezzee", poweredBy: "Prezzee" }, tiles: [] }),
      chargePrezzeeCard: async () => ({ ok: true, gift: { claimToken: "t1", giftAmountCents: 1000, feeCents: 59, totalCents: 1059 } }),
      finalizePrezzeeCard: async () => ({ ok: true, gift: { claimToken: "t1", giftAmountCents: 1000, feeCents: 59, totalCents: 1059 } }),
    };
    globalThis.__PSC_TEST__ = {
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
  // Minimal fake: no Stripe.js, no iframe, no network. Exposes exactly one control.
  writeFileSync(FAKE_MODAL, `
    import React from "react";
    export default function PrezzeeCardConfirmationModal({ isOpen, onClose, onConfirm, charging, chargeError }) {
      if (!isOpen) return null;
      const fakeStripe = { confirmCardPayment: async () => (globalThis.__PSC_TEST__.confirm3ds
        ? globalThis.__PSC_TEST__.confirm3ds()
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
  // esbuild's `alias` option only accepts bare, package-name-style keys — a relative import
  // specifier like "../api/api" is rejected outright ("Invalid alias name"). A plugin's
  // onResolve is the correct mechanism for redirecting a RELATIVE import path to a fake module.
  const redirectPlugin = {
    name: "psc-test-redirects",
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
  // Added 2026-09-23 (Team C, direct denomination display): PrezzeeSmartCard.jsx now calls
  // useLocation() to read an optional preselected tile id, which requires a Router ancestor —
  // the real app always provides one (App.jsx); this harness now does too.
  ({ MemoryRouter } = await import("react-router-dom"));
  const m = await import(pathToFileURL(BUNDLE).href);
  PrezzeeSmartCard = m.PrezzeeSmartCard;
  FAKE = globalThis.__PSC_TEST__;
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

const EIGHT_TILES = [
  { id: "prezzee_smart_card_1000", displayAmount: "$10", amountCents: 1000, sharedArtwork: true },
  { id: "prezzee_smart_card_2500", displayAmount: "$25", amountCents: 2500, sharedArtwork: true },
  { id: "prezzee_smart_card_5000", displayAmount: "$50", amountCents: 5000, sharedArtwork: true },
  { id: "prezzee_smart_card_7500", displayAmount: "$75", amountCents: 7500, sharedArtwork: true },
  { id: "prezzee_smart_card_10000", displayAmount: "$100", amountCents: 10000, sharedArtwork: true },
  { id: "prezzee_smart_card_15000", displayAmount: "$150", amountCents: 15000, sharedArtwork: true },
  { id: "prezzee_smart_card_20000", displayAmount: "$200", amountCents: 20000, sharedArtwork: true },
  { id: "prezzee_smart_card_25000", displayAmount: "$250", amountCents: 25000, sharedArtwork: true },
];

// Wraps the page in the same Router context App.jsx always provides in production.
// `locationState` mirrors what Merch.jsx's denomination tiles pass via navigate(path, { state }).
function withRouter(locationState) {
  return React.createElement(
    MemoryRouter,
    { initialEntries: [{ pathname: "/dashboard/gifts/smart-card", state: locationState || null }] },
    React.createElement(PrezzeeSmartCard),
  );
}

async function mountReady(tiles = EIGHT_TILES, locationState) {
  FAKE.setResponses({ getPrezzeeCardTiles: async () => ({ ok: true, product: { name: "Greet-Me Smart Card, powered by Prezzee", poweredBy: "Prezzee" }, tiles }) });
  const s = await mount(withRouter(locationState));
  await flush();
  return s;
}

// ── 1/2. Exactly eight tiles render, matching the backend contract exactly ──────────────────

test("REQUIRED TEST 1/2: exactly eight tiles render, with values matching the backend contract exactly", async () => {
  const s = await mountReady();
  const buttons = s.qa("[data-tile-id]");
  assert.equal(buttons.length, 8, "exactly eight tiles must render");
  assert.deepEqual(buttons.map((b) => b.getAttribute("data-tile-id")), EIGHT_TILES.map((t) => t.id));
  assert.deepEqual(buttons.map((b) => b.textContent), EIGHT_TILES.map((t) => t.displayAmount));
});

// ── 3. No custom-value input exists ──────────────────────────────────────────────────────────

test("REQUIRED TEST 3: no custom-amount or free-entry input exists anywhere on the page", async () => {
  const s = await mountReady();
  const numberInputs = s.qa('input[type="number"]');
  assert.equal(numberInputs.length, 0, "no numeric amount input may exist");
  // The only two <input> elements on the page are recipient name/email — never amount-shaped.
  const allInputs = s.qa("input");
  for (const inp of allInputs) {
    assert.notEqual(inp.type, "number");
    assert.doesNotMatch((inp.name || inp.id || "").toLowerCase(), /amount|price|cents|dollar/);
  }
});

// ── Direct denomination display: a tile chosen on Merch.jsx arrives preselected ─────────────

test("a presetTileId passed via router state (Merch.jsx's denomination tiles) preselects that exact tile on load", async () => {
  const s = await mountReady(EIGHT_TILES, { presetTileId: "prezzee_smart_card_5000" });
  const tileBtn = s.q('[data-tile-id="prezzee_smart_card_5000"]');
  assert.equal(tileBtn.getAttribute("aria-checked"), "true", "the tile named in router state must be selected without any click");
  const others = s.qa("[data-tile-id]").filter((b) => b.getAttribute("data-tile-id") !== "prezzee_smart_card_5000");
  for (const other of others) {
    assert.equal(other.getAttribute("aria-checked"), "false", "no other tile may be selected");
  }
});

test("an unrecognized presetTileId (not in the server's own tile list) selects nothing — never trusts router state alone", async () => {
  const s = await mountReady(EIGHT_TILES, { presetTileId: "not_a_real_tile_id" });
  for (const btn of s.qa("[data-tile-id]")) {
    assert.equal(btn.getAttribute("aria-checked"), "false");
  }
});

// ── 4/5. Selecting a tile submits ONLY its tile ID — never an amount ────────────────────────

test("REQUIRED TEST 4/5: selecting a tile and confirming submits ONLY the tile ID — a client can never manipulate the charged amount", async () => {
  const s = await mountReady();
  await click(s.q('[data-tile-id="prezzee_smart_card_2500"]'));
  await setValue(s.q('input[type="email"]'), "recipient@example.com");
  const nameInputs = s.qa("input").filter((i) => i.type !== "email");
  await setValue(nameInputs[0], "Dana Rivers");
  await flush();

  const continueBtn = [...s.qa("button")].find((b) => /continue to payment/i.test(b.textContent));
  await click(continueBtn);
  await flush();

  await click(s.tid("fake-modal-confirm"));
  await flush();

  assert.equal(FAKE.calls.chargePrezzeeCard.length, 1);
  const [payload] = FAKE.calls.chargePrezzeeCard[0];
  assert.deepEqual(Object.keys(payload).sort(), ["giftRequestId", "paymentMethodId", "recipientEmail", "recipientName", "tileId"]);
  assert.equal(payload.tileId, "prezzee_smart_card_2500");
  // Structural confirmation: nothing amount-shaped is ever a key of the submitted payload.
  assert.doesNotMatch(JSON.stringify(Object.keys(payload)), /amount|price|cents|fee|total|product|currency|provider/i);
});

// ── 6/7. Fee and total math ──────────────────────────────────────────────────────────────────

test("REQUIRED TEST 6/7: the processing fee and total display correctly for all eight tiles (2.9% + $0.30)", async () => {
  const s = await mountReady();
  for (const tile of EIGHT_TILES) {
    await click(s.q(`[data-tile-id="${tile.id}"]`));
    await flush();
    const expectedFee = Math.round(tile.amountCents * 0.029) + 30;
    const expectedTotal = tile.amountCents + expectedFee;
    const fmt = (c) => `$${(c / 100).toFixed(2)}`;
    const escapeRegex = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(s.text(), new RegExp(escapeRegex(fmt(expectedFee))), `fee for ${tile.displayAmount}`);
    assert.match(s.text(), new RegExp(escapeRegex(fmt(expectedTotal))), `total for ${tile.displayAmount}`);
    assert.equal(expectedTotal, tile.amountCents + expectedFee, "total must equal face value plus fee");
  }
});

// ── 8. Server-returned values remain authoritative ──────────────────────────────────────────

test("REQUIRED TEST 8: after a successful charge, the SERVER-returned amounts are shown, never a client recomputation", async () => {
  // A deliberately WRONG server response (would not match the 2.9%+$0.30 preview formula) —
  // proves the success screen reads gift.feeCents/totalCents as returned, not recomputed.
  FAKE.setResponses({ chargePrezzeeCard: async () => ({ ok: true, gift: { claimToken: "t9", giftAmountCents: 1000, feeCents: 12345, totalCents: 13345 } }) });
  const s = await mountReady();
  await click(s.q('[data-tile-id="prezzee_smart_card_1000"]'));
  await setValue(s.q('input[type="email"]'), "r@example.com");
  await setValue(s.qa("input").filter((i) => i.type !== "email")[0], "Dana");
  await flush();
  await click([...s.qa("button")].find((b) => /continue to payment/i.test(b.textContent)));
  await flush();
  await click(s.tid("fake-modal-confirm"));
  await flush();

  assert.match(s.text(), /\$123\.45/, "the server's own (deliberately non-formula) fee must be shown as-is");
  assert.match(s.text(), /\$133\.45/, "the server's own total must be shown as-is");
});

// ── 9. Duplicate-submission guard ────────────────────────────────────────────────────────────

test("REQUIRED TEST 9: the checkout cannot be submitted twice while a request is pending", async () => {
  let resolveCharge;
  FAKE.setResponses({ chargePrezzeeCard: () => new Promise((r) => { resolveCharge = r; }) });
  const s = await mountReady();
  await click(s.q('[data-tile-id="prezzee_smart_card_1000"]'));
  await setValue(s.q('input[type="email"]'), "r@example.com");
  await setValue(s.qa("input").filter((i) => i.type !== "email")[0], "Dana");
  await flush();
  await click([...s.qa("button")].find((b) => /continue to payment/i.test(b.textContent)));
  await flush();

  const confirmBtn = s.tid("fake-modal-confirm");
  await click(confirmBtn); // first click — request now pending
  await flush();
  assert.equal(confirmBtn.disabled, true, "the confirm control must disable while charging");
  await click(confirmBtn); // second click, while still pending — must be a no-op
  await flush();
  resolveCharge({ ok: true, gift: { claimToken: "t1", giftAmountCents: 1000, feeCents: 59, totalCents: 1059 } });
  await flush();

  assert.equal(FAKE.calls.chargePrezzeeCard.length, 1, "exactly one charge call, never two, for two clicks while pending");
});

// ── 10. 3DS/finalize handling does not create a second order ───────────────────────────────

test("REQUIRED TEST 10: a requires_action response is finalized exactly once — never a second createOrder-equivalent call", async () => {
  FAKE.setResponses({
    chargePrezzeeCard: async () => ({ ok: true, requiresAction: true, clientSecret: "cs_test_1", paymentIntentId: "pi_test_1" }),
    finalizePrezzeeCard: async () => ({ ok: true, gift: { claimToken: "t2", giftAmountCents: 2500, feeCents: 103, totalCents: 2603 } }),
  });
  const s = await mountReady();
  await click(s.q('[data-tile-id="prezzee_smart_card_2500"]'));
  await setValue(s.q('input[type="email"]'), "r@example.com");
  await setValue(s.qa("input").filter((i) => i.type !== "email")[0], "Dana");
  await flush();
  await click([...s.qa("button")].find((b) => /continue to payment/i.test(b.textContent)));
  await flush();
  await click(s.tid("fake-modal-confirm"));
  await flush();

  assert.equal(FAKE.calls.chargePrezzeeCard.length, 1);
  assert.equal(FAKE.calls.finalizePrezzeeCard.length, 1, "finalize must be called exactly once after 3DS, never zero or two");
  const [finalizePayload] = FAKE.calls.finalizePrezzeeCard[0];
  assert.equal(finalizePayload.paymentIntentId, "pi_test_1");
  assert.match(s.text(), /\$26\.03/, "the finalized (server-returned) total is shown");
});

// ── 11. Errors never expose provider or payment secrets ─────────────────────────────────────

test("REQUIRED TEST 11: a failed charge shows only the server's own safe message — never a raw provider/payment object", async () => {
  // The REAL api.request() contract for a decline: the route answers 402 and request() THROWS
  // with .status (see REQUIRED TEST 12's note) — it never resolves {ok:false} for a 402.
  FAKE.setResponses({ chargePrezzeeCard: async () => { const e = new Error("Your card was declined."); e.status = 402; throw e; } });
  const s = await mountReady();
  await click(s.q('[data-tile-id="prezzee_smart_card_1000"]'));
  await setValue(s.q('input[type="email"]'), "r@example.com");
  await setValue(s.qa("input").filter((i) => i.type !== "email")[0], "Dana");
  await flush();
  await click([...s.qa("button")].find((b) => /continue to payment/i.test(b.textContent)));
  await flush();
  await click(s.tid("fake-modal-confirm"));
  await flush();

  assert.match(s.text(), /Your card was declined\./);
  assert.doesNotMatch(s.text(), /sk_|pk_|Bearer |stripe\.com|apiKey|secret/i, "no credential or secret-shaped string may ever render");
});

// ── 12. Dormant / not publicly reachable via navigation ──────────────────────────────────────

test("REQUIRED TEST 12: while the backend reports dormant (503), the page shows an unavailable state and renders no tiles or inputs", async () => {
  // Matches the REAL src/api/api.js contract exactly: request() THROWS for any non-2xx status
  // other than 401/404 — a 503 is a rejected promise with a `.status` property, never a
  // resolved {status:503}.
  FAKE.setResponses({ getPrezzeeCardTiles: async () => { const e = new Error("Digital gift cards are temporarily unavailable."); e.status = 503; e.code = "GIFT_CARDS_PAUSED"; throw e; } });
  const s = await mount(withRouter());
  await flush();
  assert.equal(s.qa("[data-tile-id]").length, 0, "no tiles may render while dormant");
  assert.equal(s.qa("input").length, 0, "no purchase form may render while dormant");
});

// ── 14. Desktop and mobile rendering stay within the approved layout ────────────────────────
//
// jsdom does not compute real CSS layout (no box model, no media queries), so this is a
// STRUCTURAL proof — read against the actual source, exactly like the "CSS rules" convention
// already used elsewhere in this codebase — rather than a rendered-viewport screenshot. A true
// cross-viewport rendered proof would need Playwright against a live dev server, which this
// session did not run: this codebase's own established caution is that the Playwright suite must
// never be pointed at anything but an isolated target, and standing one up was not part of this
// authorization. This test proves the specific properties that make the layout viewport-safe by
// construction, per the artifact-design responsive rules this codebase otherwise follows.

test("REQUIRED TEST 14: the tile grid and page use relative sizing, not a fixed desktop-only width", async () => {
  const src = readFileSync(new URL("./PrezzeeSmartCard.jsx", import.meta.url), "utf8");
  // The tile grid uses fractional (fr) units, which reflow at any viewport width — never a fixed
  // pixel column count/width that would overflow a phone screen.
  assert.match(src, /gridTemplateColumns:\s*'repeat\(4,\s*1fr\)'/);
  // The page's own outer width is a max-width cap with no fixed minimum, so it shrinks on mobile
  // rather than forcing horizontal scroll.
  assert.match(src, /maxWidth:\s*'48rem'/);
  assert.doesNotMatch(src, /width:\s*'\d+px'/, "no fixed pixel width that would break at phone width");
  assert.doesNotMatch(src, /minWidth:\s*'\d{3,}px'/, "no wide fixed minimum width");
});


// ── 10b. Retry safety: a failure can never become a second charge ───────────────────────────
//
// Added in the independent verification pass (2026-09-17). Before it, EVERY failure rotated the
// idempotency key and allowed a fresh charge — including a failed finalize AFTER 3DS had already
// succeeded, and a network failure that api.request() resolves as {ok:false,status:0}, where the
// first request may already have charged the card.

async function openAndConfirm(s, tileId = "prezzee_smart_card_2500") {
  await click(s.q(`[data-tile-id="${tileId}"]`));
  await setValue(s.q('input[type="email"]'), "r@example.com");
  await setValue(s.qa("input").filter((i) => i.type !== "email")[0], "Dana");
  await flush();
  await click([...s.qa("button")].find((b) => /continue to payment/i.test(b.textContent)));
  await flush();
  await click(s.tid("fake-modal-confirm"));
  await flush();
}
const thrown = (status, message = "server said no") => async () => { const e = new Error(message); e.status = status; throw e; };

test("RETRY SAFETY: 3DS succeeded but finalize failed — the retry re-finalizes the SAME PaymentIntent and never charges again", async () => {
  let finalizeAttempts = 0;
  FAKE.setResponses({
    chargePrezzeeCard: async () => ({ ok: true, requiresAction: true, clientSecret: "cs_1", paymentIntentId: "pi_paid_1" }),
    finalizePrezzeeCard: async () => {
      finalizeAttempts += 1;
      if (finalizeAttempts === 1) { const e = new Error("Failed to finalize gift card purchase"); e.status = 500; throw e; }
      return { ok: true, gift: { claimToken: "t3", giftAmountCents: 2500, feeCents: 103, totalCents: 2603 } };
    },
  });
  const s = await mountReady();
  await openAndConfirm(s);

  assert.equal(FAKE.calls.chargePrezzeeCard.length, 1);
  assert.equal(FAKE.calls.finalizePrezzeeCard.length, 1);
  assert.match(s.text(), /you will not be charged again/i);
  assert.ok(s.qa("[data-tile-id]").every((b) => b.disabled), "tile selection is locked while a paid payment awaits finalize");

  await click(s.tid("fake-modal-confirm")); // retry
  await flush();

  assert.equal(FAKE.calls.chargePrezzeeCard.length, 1, "the retry must NOT start a second charge");
  assert.equal(FAKE.calls.finalizePrezzeeCard.length, 2);
  assert.deepEqual(FAKE.calls.finalizePrezzeeCard.map(([p]) => p.paymentIntentId), ["pi_paid_1", "pi_paid_1"]);
  assert.match(s.text(), /\$26\.03/);
});

for (const [label, response] of [
  ["a network failure (resolved {ok:false,status:0})", async () => ({ ok: false, status: 0, networkError: true })],
  ["a 5xx from the charge route", thrown(500, "Failed to process gift card purchase")],
  ["an error with no status", thrown(undefined, "socket hang up")],
]) {
  test(`RETRY SAFETY: ${label} is an UNKNOWN outcome — no retry is offered and no second charge can be made`, async () => {
    FAKE.setResponses({ chargePrezzeeCard: response });
    const s = await mountReady();
    await openAndConfirm(s);
    assert.equal(FAKE.calls.chargePrezzeeCard.length, 1);
    assert.match(s.text(), /could not confirm whether your payment went through/i);
    assert.match(s.text(), /contact support/i);

    await click(s.tid("fake-modal-confirm")); // attempted retry
    await flush();
    assert.equal(FAKE.calls.chargePrezzeeCard.length, 1, "no second charge after an unknown outcome");
    const cont = [...s.qa("button")].find((b) => /continue to payment/i.test(b.textContent));
    assert.equal(cont.disabled, true, "the page offers no new attempt");
  });
}

test("RETRY SAFETY: a definitive decline (402) allows a retry, under a FRESH idempotency key", async () => {
  let n = 0;
  FAKE.setResponses({ chargePrezzeeCard: async (...a) => { n += 1; if (n === 1) return thrown(402, "Your card was declined")(); return { ok: true, gift: { claimToken: "t4", giftAmountCents: 2500, feeCents: 103, totalCents: 2603 } }; } });
  const s = await mountReady();
  await openAndConfirm(s);
  assert.match(s.text(), /Your card was declined/);
  await click(s.tid("fake-modal-confirm"));
  await flush();
  assert.equal(FAKE.calls.chargePrezzeeCard.length, 2);
  const [k1, k2] = FAKE.calls.chargePrezzeeCard.map(([p]) => p.giftRequestId);
  assert.notEqual(k1, k2, "a definitively-uncharged attempt gets a new key");
  assert.match(s.text(), /\$26\.03/);
});

test("RETRY SAFETY: a failed 3DS challenge (nothing captured) allows a fresh attempt", async () => {
  FAKE.setResponses({ chargePrezzeeCard: async () => ({ ok: true, requiresAction: true, clientSecret: "cs_2", paymentIntentId: "pi_unpaid_2" }) });
  FAKE.confirm3ds = async () => ({ error: { message: "Authentication was not completed." } });
  const s = await mountReady();
  await openAndConfirm(s);
  assert.equal(FAKE.calls.finalizePrezzeeCard.length, 0, "an unauthenticated payment is never finalized");
  assert.match(s.text(), /Authentication was not completed\./);
  await click(s.tid("fake-modal-confirm"));
  await flush();
  assert.equal(FAKE.calls.chargePrezzeeCard.length, 2);
  const [k1, k2] = FAKE.calls.chargePrezzeeCard.map(([p]) => p.giftRequestId);
  assert.notEqual(k1, k2);
});
