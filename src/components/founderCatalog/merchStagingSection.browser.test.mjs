// src/components/founderCatalog/merchStagingSection.browser.test.mjs
//
// The Phase 2 staging surface: the real components, bundled and mounted in jsdom with an injected
// client. Same harness as the sibling founder suites.
//
// What this file exists to prove, in the order the damage would matter:
//   1. The retail price field is EMPTY for an unpriced variant — never Printful's number.
//   2. No markup or shipping promise is ever rendered.
//   3. Nothing is offered as purchasable, in any state, including published.
//   4. There is no bulk selection anywhere.
//   5. The final button says "Prepare reviewed release", not "Publish".
//   6. Preparing shows a manifest and states plainly that nothing is live.
//
// Run (Node 20.x): node --test src/components/founderCatalog/merchStagingSection.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__staging.bundle.mjs");
const ENTRY = join(__dirname, ".__staging.entry.jsx");
let React, createRoot, act, Staging, window;

before(async () => {
  writeFileSync(ENTRY, `export { default as Staging } from "./MerchStagingSection.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Staging } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const NEW_ID = 999000111;

const stagedItem = (over = {}) => ({
  syncProductId: NEW_ID,
  state: "pending_pricing",
  vendor: { name: "Enamel Pin", thumbnailUrl: null, capturedAt: "2026-09-06T00:00:00.000Z", readOnly: true },
  variants: [
    { syncVariantId: 8001, label: "Silver", vendorPriceCents: 1100, vendorAvailable: true, greetMeRetailCents: null },
    { syncVariantId: 8002, label: "Gold", vendorPriceCents: 1200, vendorAvailable: true, greetMeRetailCents: null },
  ],
  pricingComplete: false,
  fulfillmentApproved: false,
  presentation: { greetMeCategories: [], brandable: false, featuredRank: null, displayEnabled: false, chosen: false },
  releaseManifest: null,
  manifestHash: null,
  purchasable: false,
  customerVisible: false,
  ...over,
});

function makeClient(over = {}) {
  const calls = [];
  return {
    calls,
    listStaged: async () => { calls.push(["listStaged"]); return { ok: true, state: "present", items: [stagedItem()] }; },
    browseMerch: async (p) => { calls.push(["browseMerch", p]); return {
      ok: true, persisted: false, offset: 0, limit: 20, total: 1,
      products: [{ syncProductId: NEW_ID, name: "Enamel Pin", variantCount: 2, alreadyLive: false, alreadyStaged: false }],
    }; },
    stageMerch: async (id) => { calls.push(["stageMerch", id]); return { ok: true, item: stagedItem() }; },
    patchStagedPricing: async (...a) => { calls.push(["patchStagedPricing", ...a]); return { ok: true, item: stagedItem() }; },
    patchStagedPresentation: async (...a) => { calls.push(["patchStagedPresentation", ...a]); return { ok: true, item: stagedItem() }; },
    approveStagedFulfillment: async (...a) => { calls.push(["approveStagedFulfillment", ...a]); return { ok: true, item: stagedItem() }; },
    prepareStagedRelease: async (...a) => { calls.push(["prepareStagedRelease", ...a]); return { ok: true, item: stagedItem() }; },
    confirmStagedPublished: async (...a) => { calls.push(["confirmStagedPublished", ...a]); return { ok: true, item: stagedItem() }; },
    abandonStaged: async (...a) => { calls.push(["abandonStaged", ...a]); return { ok: true, item: stagedItem() }; },
    ...over,
  };
}

async function mount(client) {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Staging, { client })); });
  return { host, root, $: (sel) => host.querySelector(sel), text: () => host.textContent || "" };
}

const byId = (host, id) => host.querySelector(`[data-testid="${id}"]`);

// ── 1-3 · the price field ───────────────────────────────────────────────────────────────────────

test("1 · an unpriced variant renders an EMPTY retail field, never Printful's price", async () => {
  const { host } = await mount(makeClient());
  for (const [variantId, vendorCents] of [[8001, 1100], [8002, 1200]]) {
    const input = byId(host, `merch-staged-retail-${variantId}`);
    assert.ok(input, `field for ${variantId}`);
    assert.equal(input.value, "", "the retail field starts empty");
    assert.equal(input.getAttribute("placeholder"), null, "no placeholder suggests a number either");
    // Printful's own number is shown, in its own cell, clearly not the retail field.
    const vendorCell = byId(host, `merch-staged-vendorprice-${variantId}`);
    assert.equal(vendorCell.textContent, `$${(vendorCents / 100).toFixed(2)}`);
  }
});

test("2 · the vendor price and the retail field are never the same control", async () => {
  const { host } = await mount(makeClient());
  const vendor = byId(host, "merch-staged-vendorprice-8001");
  const retail = byId(host, "merch-staged-retail-8001");
  assert.notEqual(vendor, retail);
  assert.equal(vendor.querySelector("input"), null, "the vendor price is not editable");
  assert.equal(retail.value, "");
});

test("3 · an already-priced variant shows the FOUNDER's price, formatted", async () => {
  const client = makeClient({
    listStaged: async () => ({ ok: true, state: "present", items: [stagedItem({
      pricingComplete: true,
      variants: [
        { syncVariantId: 8001, label: "Silver", vendorPriceCents: 1100, vendorAvailable: true, greetMeRetailCents: 2500 },
        { syncVariantId: 8002, label: "Gold", vendorPriceCents: 1200, vendorAvailable: true, greetMeRetailCents: 2900 },
      ],
    })] }),
  });
  const { host } = await mount(client);
  assert.equal(byId(host, "merch-staged-retail-8001").value, "25.00");
  assert.notEqual(byId(host, "merch-staged-retail-8001").value, "11.00", "not the vendor's number");
});

// ── 4-6 · no promises, nothing purchasable ──────────────────────────────────────────────────────

test("4 · no markup or shipping promise is rendered anywhere", async () => {
  const { text } = await mount(makeClient());
  const body = text().toLowerCase();
  for (const claim of ["markup", "margin", "shipping included", "free shipping", "includes shipping",
                       "profit", "% above", "recommended price", "suggested price"]) {
    assert.equal(body.includes(claim), false, `must not promise: ${claim}`);
  }
});

test("5 · every state states that nothing is on sale from this screen", async () => {
  for (const state of ["pending_pricing", "pending_fulfillment_approval", "ready_for_code_review", "published"]) {
    const client = makeClient({
      listStaged: async () => ({ ok: true, state: "present", items: [stagedItem({ state })] }),
    });
    const { host } = await mount(client);
    const note = byId(host, `merch-staged-notlive-${NEW_ID}`);
    assert.ok(note, `note present in ${state}`);
    assert.match(note.textContent, /not on sale/i, state);
  }
});

test("6 · no button offers to publish, sell or make purchasable", async () => {
  const client = makeClient({
    listStaged: async () => ({ ok: true, state: "present", items: [stagedItem({
      state: "pending_fulfillment_approval", pricingComplete: true, fulfillmentApproved: true,
      presentation: { greetMeCategories: ["tech"], brandable: true, featuredRank: null, displayEnabled: true, chosen: true },
    })] }),
  });
  const { host } = await mount(client);
  const labels = [...host.querySelectorAll("button")].map((b) => b.textContent.trim().toLowerCase());
  assert.equal(labels.some((l) => l === "publish"), false, "no button is called Publish");
  assert.equal(labels.some((l) => l.includes("put on sale")), false);
  assert.ok(labels.some((l) => l.includes("prepare reviewed release")),
    "the pre-deployment action is named for what it does");
});

// ── 7-8 · one at a time ─────────────────────────────────────────────────────────────────────────

test("7 · the browser offers no multi-select — one product at a time, structurally", async () => {
  const { host } = await mount(makeClient());
  await act(async () => { byId(host, "merch-staging-browse").click(); });

  assert.ok(byId(host, "merch-browse-modal"), "the browser is open");
  const checkboxes = [...host.querySelectorAll('[data-testid^="merch-browse-"] input[type="checkbox"]')];
  assert.equal(checkboxes.length, 0, "no checkbox column exists");
  const labels = [...host.querySelectorAll("button")].map((b) => b.textContent.trim().toLowerCase());
  assert.equal(labels.some((l) => l.includes("select all") || l.includes("stage all") || l.includes("import all")), false);
  assert.ok(byId(host, `merch-browse-stage-${NEW_ID}`), "each row has its own single stage action");
});

test("8 · browsing says plainly that it saves nothing, and stages exactly one id it was given", async () => {
  const client = makeClient();
  const { host } = await mount(client);
  await act(async () => { byId(host, "merch-staging-browse").click(); });
  assert.match(byId(host, "merch-browse-readonly-note").textContent, /saves nothing/i);

  await act(async () => { byId(host, `merch-browse-stage-${NEW_ID}`).click(); });
  const staged = client.calls.filter((c) => c[0] === "stageMerch");
  assert.equal(staged.length, 1, "exactly one stage call");
  assert.equal(staged[0][1], NEW_ID, "with the id the SERVER returned, not one typed anywhere");
  assert.equal(host.querySelector('input[type="text"][data-testid^="merch-browse"]'), null,
    "there is no field to type a product id into");
});

// ── 9-12 · gating and the manifest ──────────────────────────────────────────────────────────────

test("9 · Prepare reviewed release is disabled until pricing, approval and presentation are all done", async () => {
  const cases = [
    [{ pricingComplete: false, fulfillmentApproved: false }, true],
    [{ pricingComplete: true, fulfillmentApproved: false }, true],
    [{ pricingComplete: true, fulfillmentApproved: true }, true],   // presentation still unchosen
    [{ pricingComplete: true, fulfillmentApproved: true,
       presentation: { greetMeCategories: ["tech"], brandable: true, featuredRank: null, displayEnabled: true, chosen: true } }, false],
  ];
  for (const [over, expectDisabled] of cases) {
    const client = makeClient({
      listStaged: async () => ({ ok: true, state: "present", items: [stagedItem(over)] }),
    });
    const { host } = await mount(client);
    const btn = byId(host, `merch-staged-prepare-${NEW_ID}`);
    assert.equal(btn.disabled, expectDisabled, JSON.stringify(over));
  }
});

test("10 · preparing shows the manifest and says nothing is live", async () => {
  const manifest = {
    syncProductId: NEW_ID, greetMeCategories: ["tech"], brandable: true,
    variants: [{ syncVariantId: 8001, printfulVariantId: 400, label: "Silver", greetMeRetailCents: 2500 }],
  };
  const client = makeClient({
    listStaged: async () => ({ ok: true, state: "present", items: [stagedItem({
      pricingComplete: true, fulfillmentApproved: true,
      presentation: { greetMeCategories: ["tech"], brandable: true, featuredRank: null, displayEnabled: true, chosen: true },
    })] }),
    prepareStagedRelease: async () => ({
      ok: true, item: stagedItem({ state: "ready_for_code_review" }),
      releaseManifest: manifest, manifestHash: "a".repeat(64),
      configWritten: false, published: false, customerVisible: false, purchasable: false,
    }),
  });
  const { host } = await mount(client);
  await act(async () => { byId(host, `merch-staged-prepare-${NEW_ID}`).click(); });

  const block = byId(host, `merch-staged-manifest-${NEW_ID}`);
  assert.ok(block, "the manifest is shown for review");
  assert.match(block.textContent, /999000111/);
  assert.match(block.textContent, /not applied by this screen/i);
  const notice = byId(host, "merch-staging-notice").textContent;
  assert.match(notice, /stays hidden when the catalog change is deployed/i);
  assert.match(notice, /only after you confirm/i);
});

test("11 · a manifest mismatch on confirmation is reported, not glossed over", async () => {
  const err = Object.assign(new Error("refused"), { body: { ok: false, error: "MANIFEST_MISMATCH" } });
  const client = makeClient({
    listStaged: async () => ({ ok: true, state: "present", items: [stagedItem({ state: "ready_for_code_review" })] }),
    confirmStagedPublished: async () => { throw err; },
  });
  const { host } = await mount(client);
  await act(async () => { byId(host, `merch-staged-confirm-${NEW_ID}`).click(); });
  const alert = byId(host, "merch-staging-error");
  assert.ok(alert);
  assert.match(alert.textContent, /does not match what was approved/i);
  assert.match(alert.textContent, /do not mark this live/i);
});

test("12 · a staging outage is reported and never presented as an empty catalog", async () => {
  const client = makeClient({
    listStaged: async () => { throw Object.assign(new Error("down"), { body: { ok: false, error: "staging_unavailable" } }); },
  });
  const { host } = await mount(client);
  assert.match(byId(host, "merch-staging-error").textContent, /staging store is unavailable/i);
  assert.match(byId(host, "merch-staging-error").textContent, /live marketplace is unaffected/i);
});

// ── 13 · the founder's next action is always stated ─────────────────────────────────────────────

test("13 · each card states the single next action, in order", async () => {
  const expectations = [
    [{}, /set a retail price for every variant/i],
    [{ pricingComplete: true }, /choose categories/i],
    [{ pricingComplete: true,
       presentation: { greetMeCategories: ["tech"], brandable: true, featuredRank: null, displayEnabled: true, chosen: true } },
      /approve the current printful mapping/i],
    [{ state: "ready_for_code_review", pricingComplete: true, fulfillmentApproved: true,
       presentation: { greetMeCategories: ["tech"], brandable: true, featuredRank: null, displayEnabled: true, chosen: true } },
      /developer/i],
  ];
  for (const [over, re] of expectations) {
    const client = makeClient({
      listStaged: async () => ({ ok: true, state: "present", items: [stagedItem(over)] }),
    });
    const { host } = await mount(client);
    assert.match(byId(host, `merch-staged-next-${NEW_ID}`).textContent, re, JSON.stringify(over));
  }
});

// ── 14-15 · the deployment window is described truthfully ───────────────────────────────────────

test("14 · a prepared release says the deploy will NOT reveal the product", async () => {
  const client = makeClient({
    listStaged: async () => ({ ok: true, state: "present", items: [stagedItem({
      state: "ready_for_code_review", pricingComplete: true, fulfillmentApproved: true,
      presentation: { greetMeCategories: ["tech"], brandable: true, featuredRank: 2, displayEnabled: true, chosen: true },
    })] }),
  });
  const { host } = await mount(client);
  const note = byId(host, `merch-staged-hiddenondeploy-${NEW_ID}`);
  assert.ok(note, "the deployment-window note is shown");
  assert.match(note.textContent, /will not reveal this product/i);
  assert.match(note.textContent, /stays hidden until you confirm/i);
});

test("15 · confirmation reports hidden vs visible truthfully, never a blanket 'live'", async () => {
  const ready = () => stagedItem({
    state: "ready_for_code_review", pricingComplete: true, fulfillmentApproved: true,
    presentation: { greetMeCategories: ["tech"], brandable: true, featuredRank: null, displayEnabled: false, chosen: true },
  });

  // The founder chose HIDDEN.
  const hidden = makeClient({
    listStaged: async () => ({ ok: true, state: "present", items: [ready()] }),
    confirmStagedPublished: async () => ({ ok: true, item: ready(), customerVisible: false, presentationApplied: true }),
  });
  let host = (await mount(hidden)).host;
  await act(async () => { byId(host, `merch-staged-confirm-${NEW_ID}`).click(); });
  let notice = byId(host, "merch-staging-notice").textContent;
  assert.match(notice, /stays hidden, as you chose/i);
  assert.equal(/now visible to customers/i.test(notice), false, "must not claim it went live");

  // The founder chose VISIBLE.
  const visible = makeClient({
    listStaged: async () => ({ ok: true, state: "present", items: [ready()] }),
    confirmStagedPublished: async () => ({ ok: true, item: ready(), customerVisible: true, presentationApplied: true }),
  });
  host = (await mount(visible)).host;
  await act(async () => { byId(host, `merch-staged-confirm-${NEW_ID}`).click(); });
  notice = byId(host, "merch-staging-notice").textContent;
  assert.match(notice, /now visible to customers/i);
});
