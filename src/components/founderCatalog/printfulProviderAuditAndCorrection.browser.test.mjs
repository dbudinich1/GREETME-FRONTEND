// src/components/founderCatalog/printfulProviderAuditAndCorrection.browser.test.mjs
//
// PRINTFUL PROVIDER END-TO-END AUDIT AND CORRECTION (Team C, 2026-09-25).
//
// Real response shapes confirmed by reading the backend directly (routes/founderCatalogRoutes.js,
// services/printfulService.js, services/merchCuration/merchCurationModel.js,
// services/merchStaging/merchStagingModel.js) — not guessed:
//
//   GET /merch/browse  -> products: [{ syncProductId, name, thumbnailUrl, variantCount,
//                                       alreadyLive, alreadyStaged }]   (NO price field at all)
//   GET /merch         -> items: [{ syncProductId, supplier, vendorAuthoritative:{ name, imageUrl,
//                                    priceCentsMin, priceCentsMax, variantCount, fulfillmentSource },
//                                    curation:{ displayEnabled, greetMeCategories, brandable,
//                                    featuredRank, state }, hasOverlay, etag }]
//   GET /merch/staged  -> items: [{ syncProductId, state, vendor:{name,thumbnailUrl,...},
//                                    variants, pricingComplete, fulfillmentApproved,
//                                    presentation:{...}, releaseManifest, manifestHash,
//                                    purchasable:false, customerVisible:false }]
//
// CONFIRMED ROOT CAUSE for "already live but can't be found in Full Live Catalog": published
// Printful records live in a SEPARATE Cosmos container (merchCuration) from the vendorGiftCatalog
// container listItems() queries — architecturally invisible to Full Live Catalog until this
// correction merges listMerch() into the same grid.
//
// Mounts the REAL, merged components (esbuild-bundled) — AddToCatalogPicker locked to Printful,
// and ManageCatalogModal for the Full Live Catalog merge/trash-can tests. No real backend call is
// made anywhere in this file; no product is published, unpublished, staged, or restored for real.
//
// Run (Node 20.x): node --test src/components/founderCatalog/printfulProviderAuditAndCorrection.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__ppac.entry.jsx");
const BUNDLE = join(__dirname, ".__ppac.bundle.mjs");

let React, createRoot, act, ManageCatalogModal, AddToCatalogPicker, dom;

// ── Real-shaped fixtures ─────────────────────────────────────────────────────────────────────

const BROWSE_ITEM = (overrides = {}) => ({
  syncProductId: 431624815,
  name: "Greet-Me Notebook",
  thumbnailUrl: "https://files.cdn.printful.com/notebook.jpg",
  variantCount: 1,
  alreadyLive: false,
  alreadyStaged: false,
  ...overrides,
});

const CURATED_ITEM = (overrides = {}) => ({
  syncProductId: 431624815,
  supplier: "printful",
  vendorAuthoritative: { name: "Greet-Me Notebook", imageUrl: "https://files.cdn.printful.com/notebook.jpg", priceCentsMin: 2400, priceCentsMax: 2400, variantCount: 1, fulfillmentSource: "printful" },
  curation: { displayEnabled: true, greetMeCategories: ["tech"], brandable: false, featuredRank: null, state: "active" },
  hasOverlay: true,
  etag: "etag-merch-1",
  ...overrides,
});

const STAGED_ITEM = (overrides = {}) => ({
  syncProductId: 555555,
  state: "pending_pricing",
  vendor: { name: "Greet-Me Tote Bag", thumbnailUrl: "https://files.cdn.printful.com/tote.jpg", capturedAt: "2026-09-20T00:00:00Z", readOnly: true },
  variants: [{ syncVariantId: 1, label: "One size", vendorPriceCents: 1200, vendorAvailable: true, greetMeRetailCents: null }],
  pricingComplete: false,
  fulfillmentApproved: false,
  presentation: { greetMeCategories: [], brandable: false, featuredRank: null, displayEnabled: false, chosen: false },
  releaseManifest: null,
  manifestHash: null,
  purchasable: false,
  customerVisible: false,
  ...overrides,
});

function fakePickerClient(overrides = {}) {
  const calls = { browseMerch: [], listMerch: [], listStaged: [], stageMerch: [], merchLifecycle: [], patchMerch: [] };
  const base = {
    browseMerch: async (args) => { calls.browseMerch.push(args); return { ok: true, products: [BROWSE_ITEM()] }; },
    listMerch: async () => { calls.listMerch.push([]); return { ok: true, items: [] }; },
    listStaged: async () => { calls.listStaged.push([]); return { ok: true, items: [] }; },
    stageMerch: async (id) => { calls.stageMerch.push(id); return { ok: true }; },
    merchLifecycle: async (id, action, etag) => { calls.merchLifecycle.push([id, action, etag]); return { ok: true, item: CURATED_ITEM({ syncProductId: id, curation: { ...CURATED_ITEM().curation, displayEnabled: false, state: "active" } }) }; },
    patchMerch: async (id, patch, etag) => { calls.patchMerch.push([id, patch, etag]); return { ok: true, item: CURATED_ITEM({ syncProductId: id, curation: { ...CURATED_ITEM().curation, ...patch } }) }; },
  };
  return { ...base, ...overrides, calls };
}

function fakeModalClient(overrides = {}) {
  const calls = { listItems: [], listProviders: [], listMerch: [], merchLifecycle: [], patchMerch: [] };
  const base = {
    listItems: async (args) => { calls.listItems.push(args); return { ok: true, items: [] }; },
    listProviders: async () => { calls.listProviders.push([]); return { ok: true, providers: [
      { providerId: "florist_one", label: "Florist One", enabled: true, browseAvailable: true },
      { providerId: "goody", label: "Goody", enabled: true, browseAvailable: true },
      { providerId: "prezzee", label: "Prezzee", enabled: true, browseAvailable: false },
    ] }; },
    listMerch: async (args) => { calls.listMerch.push(args); return { ok: true, items: [CURATED_ITEM()] }; },
    merchLifecycle: async (id, action, etag) => { calls.merchLifecycle.push([id, action, etag]); return { ok: true, item: CURATED_ITEM({ syncProductId: id }) }; },
    patchMerch: async (id, patch, etag) => { calls.patchMerch.push([id, patch, etag]); return { ok: true, item: CURATED_ITEM({ syncProductId: id, curation: { ...CURATED_ITEM().curation, ...patch } }) }; },
  };
  return { ...base, ...overrides, calls };
}

before(async () => {
  writeFileSync(ENTRY, [
    `export { default as ManageCatalogModal } from "./ManageCatalogModal.jsx";`,
    `export { default as AddToCatalogPicker } from "./AddToCatalogPicker.jsx";`,
  ].join("\n"));
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".png": "dataurl", ".css": "empty" },
    external: ["react", "react-dom", "react-dom/client"],
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
  ManageCatalogModal = m.ManageCatalogModal;
  AddToCatalogPicker = m.AddToCatalogPicker;
});

after(() => {
  for (const f of [ENTRY, BUNDLE]) { try { rmSync(f); } catch { /* already gone */ } }
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
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

async function mountPrintfulPicker(client, onPublished = () => {}) {
  const s = await mount(React.createElement(AddToCatalogPicker, {
    client, lockedProviderId: "printful", onClose: () => {}, onPublished,
  }));
  await flush();
  return s;
}

async function mountCatalogExpanded(client) {
  const s = await mount(React.createElement(ManageCatalogModal, { open: true, onClose: () => {}, client }));
  await flush();
  await click(s.tid("full-catalog-toggle"));
  await flush();
  return s;
}

// ── 1. Images ────────────────────────────────────────────────────────────────────────────────

test("a browsed Printful product renders its real thumbnailUrl image", async () => {
  const s = await mountPrintfulPicker(fakePickerClient());
  const img = s.q('[data-testid="browse-result-printful:431624815"] img');
  assert.ok(img, "the tile must render an <img>");
  assert.equal(img.getAttribute("src"), "https://files.cdn.printful.com/notebook.jpg");
});

test("a product with no thumbnailUrl shows a truthful placeholder, not a broken image", async () => {
  const client = fakePickerClient({ browseMerch: async () => ({ ok: true, products: [BROWSE_ITEM({ thumbnailUrl: null })] }) });
  const s = await mountPrintfulPicker(client);
  assert.ok(!s.q("img"));
  assert.match(s.text(), /No image/);
});

// ── 2. Price ─────────────────────────────────────────────────────────────────────────────────

test("a never-curated product shows truthful 'Price set during staging' — never a fabricated number", async () => {
  const s = await mountPrintfulPicker(fakePickerClient());
  assert.match(s.tid("browse-result-printful:431624815").textContent, /Price set during staging/);
});

test("a product that IS already curated shows its real price range", async () => {
  const client = fakePickerClient({
    listMerch: async () => ({ ok: true, items: [CURATED_ITEM({ curation: { ...CURATED_ITEM().curation, displayEnabled: false } })] }),
  });
  const s = await mountPrintfulPicker(client);
  assert.match(s.tid("browse-result-printful:431624815").textContent, /\$24\.00/);
});

// ── 3. Zero-variant products excluded/disabled ──────────────────────────────────────────────

test("a product reporting 0 variants is disabled with the truthful 'Unavailable — no fulfillable variants' state, never silently selectable", async () => {
  const client = fakePickerClient({ browseMerch: async () => ({ ok: true, products: [BROWSE_ITEM({ variantCount: 0 })] }) });
  const s = await mountPrintfulPicker(client);
  const checkbox = s.tid("browse-checkbox-printful:431624815");
  assert.equal(checkbox.disabled, true);
  assert.match(s.tid("browse-result-printful:431624815").textContent, /Unavailable — no fulfillable variants/);
});

test("a product with real variants shows a clear variant count, the truthful 'Eligible to stage' state, and stays selectable", async () => {
  const client = fakePickerClient({ browseMerch: async () => ({ ok: true, products: [BROWSE_ITEM({ variantCount: 3 })] }) });
  const s = await mountPrintfulPicker(client);
  assert.match(s.tid("browse-result-printful:431624815").textContent, /3 variant\(s\)/);
  assert.match(s.tid("browse-result-printful:431624815").textContent, /Eligible to stage/);
  assert.equal(s.tid("browse-checkbox-printful:431624815").disabled, false);
});

// ── 4/8. Published state truthful, and recoverable without a duplicate ────────────────────────

test("4. a product that IS currently published shows the truthful 'Already live' state, is disabled (not re-stageable), and points at Full Live Catalog", async () => {
  const client = fakePickerClient({ listMerch: async () => ({ ok: true, items: [CURATED_ITEM()] }) });
  const s = await mountPrintfulPicker(client);
  const tile = s.tid("browse-result-printful:431624815");
  assert.match(tile.textContent, /Already live/);
  assert.doesNotMatch(tile.textContent, /Published/, "staged/curated merchandise must never be called 'Published' — 'Already live' is the truthful state name");
  assert.match(tile.textContent, /Full Live Catalog/);
  assert.equal(s.tid("browse-checkbox-printful:431624815").disabled, true, "a published product must not be re-selectable — re-staging it would be refused as a duplicate");
});

test("a retired (previously published, now trashed) product shows a truthful state and a Restore & Publish action, never the old static 'Already live'", async () => {
  const client = fakePickerClient({
    listMerch: async () => ({ ok: true, items: [CURATED_ITEM({ curation: { ...CURATED_ITEM().curation, displayEnabled: false, state: "active" } })] }),
  });
  const s = await mountPrintfulPicker(client);
  const tile = s.tid("browse-result-printful:431624815");
  assert.match(tile.textContent, /Retired from your site/);
  assert.doesNotMatch(tile.textContent, /Already live/);
  assert.ok(s.tid("printful-restore-431624815"), "a Restore & Publish action must be offered");
  assert.equal(s.tid("browse-checkbox-printful:431624815").disabled, true, "must not be selectable — re-staging a curated product is refused by the backend");
});

test("Restore & Publish safely republishes the EXISTING record — restore then a presentation patch, never a re-stage, no duplicate", async () => {
  const client = fakePickerClient({
    listMerch: async () => ({ ok: true, items: [CURATED_ITEM({ curation: { ...CURATED_ITEM().curation, displayEnabled: false } })] }),
  });
  let published = false;
  const s = await mountPrintfulPicker(client, () => { published = true; });
  await click(s.tid("printful-restore-431624815"));
  await flush();
  assert.equal(client.calls.stageMerch.length, 0, "must never attempt to re-stage a curated product");
  assert.equal(client.calls.merchLifecycle.length, 1);
  assert.deepEqual(client.calls.merchLifecycle[0].slice(0, 2), [431624815, "restore"]);
  assert.equal(client.calls.patchMerch.length, 1);
  assert.deepEqual(client.calls.patchMerch[0][1], { displayEnabled: true });
  assert.match(s.text(), /Restored and published/);
  assert.equal(published, true, "onPublished must fire so Full Live Catalog refreshes");
});

test("a failed Restore & Publish surfaces the real error truthfully, never a false success", async () => {
  const client = fakePickerClient({
    listMerch: async () => ({ ok: true, items: [CURATED_ITEM({ curation: { ...CURATED_ITEM().curation, displayEnabled: false } })] }),
    merchLifecycle: async () => ({ ok: false, error: "etag_conflict" }),
  });
  const s = await mountPrintfulPicker(client);
  await click(s.tid("printful-restore-431624815"));
  await flush();
  assert.match(s.text(), /etag_conflict/);
  assert.doesNotMatch(s.text(), /Restored and published/);
});

// ── 5/6. "Already staged" explained with real, actionable state ────────────────────────────────

test("5/6. a staged product shows the truthful 'Already staged' state PLUS its real current next action — never bare and unexplained", async () => {
  const client = fakePickerClient({
    browseMerch: async () => ({ ok: true, products: [BROWSE_ITEM({ syncProductId: 555555, name: "Greet-Me Tote Bag", alreadyStaged: true })] }),
    listStaged: async () => ({ ok: true, items: [STAGED_ITEM()] }),
  });
  const s = await mountPrintfulPicker(client);
  const tile = s.tid("browse-result-printful:555555");
  assert.match(tile.textContent, /Already staged/);
  assert.match(tile.textContent, /Set a retail price for every variant/, "must show the REAL next action (stagedNextAction) alongside the state, not a bare label");
  assert.doesNotMatch(tile.textContent, /Already live/, "staged merchandise must never be described as live");
  assert.equal(s.tid("browse-checkbox-printful:555555").disabled, true);
});

test("a staged product further along the pipeline shows ITS OWN real next action", async () => {
  const client = fakePickerClient({
    browseMerch: async () => ({ ok: true, products: [BROWSE_ITEM({ syncProductId: 555555, alreadyStaged: true })] }),
    listStaged: async () => ({ ok: true, items: [STAGED_ITEM({
      pricingComplete: true, fulfillmentApproved: true,
      presentation: { greetMeCategories: ["tech"], brandable: false, featuredRank: null, displayEnabled: false, chosen: true },
      state: "ready_for_code_review",
    })] }),
  });
  const s = await mountPrintfulPicker(client);
  assert.match(s.tid("browse-result-printful:555555").textContent, /Send the release manifest to a developer/);
});

// ── 7. Reviewed-release policy preserved (not authorized for direct publish) ────────────────────

test("7. the reviewed-release explanation is preserved, and selecting a new product still submits to staging, never a direct publish", async () => {
  const client = fakePickerClient();
  const s = await mountPrintfulPicker(client);
  assert.match(s.text(), /reviewed release/i);
  await click(s.tid("browse-checkbox-printful:431624815"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.stageMerch.length, 1);
  assert.equal(client.calls.stageMerch[0], 431624815);
  assert.equal(client.calls.merchLifecycle.length, 0, "a brand-new product must never call the publish-adjacent lifecycle transitions");
  assert.match(s.text(), /Submitted for review/);
});

test("the Printful-specific action button reads 'Stage Selected for Review', truthfully distinct from 'Publish Selected'", async () => {
  const client = fakePickerClient();
  const s = await mountPrintfulPicker(client);
  assert.match(s.tid("publish-selected-button").textContent, /Stage Selected for Review/);
  assert.doesNotMatch(s.tid("publish-selected-button").textContent, /Publish Selected/);
});

// ── Independent selection, accurate counter, and duplicate-free multi-select staging ───────────

test("selecting one eligible Printful product selects only that product — a second eligible tile is unaffected", async () => {
  const client = fakePickerClient({
    browseMerch: async () => ({ ok: true, products: [
      BROWSE_ITEM({ syncProductId: 111, name: "Greet-Me Notebook" }),
      BROWSE_ITEM({ syncProductId: 222, name: "Greet-Me Mug" }),
    ] }),
  });
  const s = await mountPrintfulPicker(client);
  await click(s.tid("browse-checkbox-printful:111"));
  await flush();
  assert.equal(s.tid("browse-checkbox-printful:111").checked, true);
  assert.equal(s.tid("browse-checkbox-printful:222").checked, false, "the second product must be completely unaffected");
  // Clearing the first must not touch the second either.
  await click(s.tid("browse-checkbox-printful:111"));
  await flush();
  assert.equal(s.tid("browse-checkbox-printful:111").checked, false);
  assert.equal(s.tid("browse-checkbox-printful:222").checked, false);
});

test("the selection counter accurately reflects only eligible selections", async () => {
  const client = fakePickerClient({
    browseMerch: async () => ({ ok: true, products: [
      BROWSE_ITEM({ syncProductId: 111, name: "Eligible One" }),
      BROWSE_ITEM({ syncProductId: 222, name: "Eligible Two" }),
    ] }),
  });
  const s = await mountPrintfulPicker(client);
  assert.match(s.text(), /0 selected/);
  await click(s.tid("browse-checkbox-printful:111"));
  await flush();
  assert.match(s.text(), /1 selected/);
  await click(s.tid("browse-checkbox-printful:222"));
  await flush();
  assert.match(s.text(), /2 selected/);
  await click(s.tid("browse-checkbox-printful:111"));
  await flush();
  assert.match(s.text(), /1 selected/);
});

test("Stage Selected for Review is disabled with nothing selected, and enabled once an eligible product is checked", async () => {
  const s = await mountPrintfulPicker(fakePickerClient());
  assert.equal(s.tid("publish-selected-button").disabled, true);
  await click(s.tid("browse-checkbox-printful:431624815"));
  await flush();
  assert.equal(s.tid("publish-selected-button").disabled, false);
});

test("staging two different eligible products submits each with its OWN real syncProductId — no duplicate, no cross-contamination", async () => {
  const client = fakePickerClient({
    browseMerch: async () => ({ ok: true, products: [
      BROWSE_ITEM({ syncProductId: 111, name: "Greet-Me Notebook" }),
      BROWSE_ITEM({ syncProductId: 222, name: "Greet-Me Mug" }),
    ] }),
  });
  const s = await mountPrintfulPicker(client);
  await click(s.tid("browse-checkbox-printful:111"));
  await click(s.tid("browse-checkbox-printful:222"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.stageMerch.length, 2);
  assert.deepEqual([...client.calls.stageMerch].sort(), [111, 222]);
});

test("a partial staging failure across two selected products reports success for one and the exact error for the other — never a false 'all succeeded', and the failed product's checkbox stays checked for retry", async () => {
  let call = 0;
  const client = fakePickerClient({
    stageMerch: async (id) => {
      call += 1;
      client.calls.stageMerch.push(id);
      if (call === 2) return { ok: false, error: "printful_unavailable" };
      return { ok: true };
    },
    browseMerch: async () => ({ ok: true, products: [
      BROWSE_ITEM({ syncProductId: 111, name: "Good One" }),
      BROWSE_ITEM({ syncProductId: 222, name: "Bad One" }),
    ] }),
  });
  const s = await mountPrintfulPicker(client);
  await click(s.tid("browse-checkbox-printful:111"));
  await click(s.tid("browse-checkbox-printful:222"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.match(s.text(), /Submitted for review/, "the succeeded product must show real success");
  assert.match(s.text(), /printful_unavailable/, "the failed product must show its exact, safe error");
  assert.equal(s.tid("browse-checkbox-printful:222").checked, true, "the failed product must stay selected for retry — never silently dropped");
});

// ── 4/9. Published Printful products are now visible in Full Live Catalog with trash-can unpublish ──

test("4. a published Printful product appears in Full Live Catalog with its real name, image and price range", async () => {
  const s = await mountCatalogExpanded(fakeModalClient());
  const tileId = "printful-431624815";
  assert.ok(s.tid(`catalog-tile-${tileId}`), "the published Printful product must be findable in Full Live Catalog");
  assert.match(s.tid(`catalog-tile-${tileId}`).textContent, /Greet-Me Notebook/);
  assert.match(s.tid(`catalog-tile-${tileId}`).textContent, /\$24\.00/);
  const img = s.q(`[data-testid="catalog-tile-${tileId}"] img`);
  assert.equal(img.getAttribute("src"), "https://files.cdn.printful.com/notebook.jpg");
});

test("a Printful product that is NOT currently displayEnabled does not appear in Full Live Catalog (published-only, same rule as every other provider)", async () => {
  const client = fakeModalClient({
    listMerch: async () => ({ ok: true, items: [CURATED_ITEM({ curation: { ...CURATED_ITEM().curation, displayEnabled: false } })] }),
  });
  const s = await mountCatalogExpanded(client);
  assert.ok(!s.tid("catalog-tile-printful-431624815"));
  assert.match(s.tid("full-catalog-toggle").textContent, /Full Live Catalog \(0\)/);
});

test("the Full Live Catalog count includes Printful products alongside the general catalog", async () => {
  const client = fakeModalClient({
    listItems: async () => ({ ok: true, items: [{ id: "florist_one:p1", internal: { source: "florist_one", vendor: "florist_one", externalProductId: "p1" }, vendorAuthoritative: { title: "Roses", images: [], priceCents: 4995, currency: "USD" }, curation: {}, lifecycle: { displayEnabled: true }, display: { title: "Roses" }, etag: "e1" }] }),
  });
  const s = await mountCatalogExpanded(client);
  assert.match(s.tid("full-catalog-toggle").textContent, /Full Live Catalog \(2\)/);
});

test("trashing a published Printful tile requires confirmation, then calls merchLifecycle 'retire' — never the general lifecycle endpoint, never a delete", async () => {
  const client = fakeModalClient();
  const s = await mountCatalogExpanded(client);
  const tileId = "printful-431624815";
  await click(s.tid(`trash-${tileId}`));
  await flush();
  assert.match(s.text(), /Remove this product from your site\?/);
  await click(s.tid(`confirm-remove-yes-${tileId}`));
  await flush();
  assert.equal(client.calls.merchLifecycle.length, 1);
  assert.deepEqual(client.calls.merchLifecycle[0].slice(0, 2), [431624815, "retire"]);
  assert.ok(!s.tid(`catalog-tile-${tileId}`), "the tile must be gone from this view after a successful retire");
});

test("a failed Printful removal leaves the tile visible with the truthful error, never an implied success", async () => {
  const client = fakeModalClient({ merchLifecycle: async () => ({ ok: false, error: "etag_conflict" }) });
  const s = await mountCatalogExpanded(client);
  const tileId = "printful-431624815";
  await click(s.tid(`trash-${tileId}`));
  await flush();
  await click(s.tid(`confirm-remove-yes-${tileId}`));
  await flush();
  assert.ok(s.tid(`catalog-tile-${tileId}`));
  assert.match(s.text(), /etag_conflict/);
});

test("filtering Full Live Catalog to Printful shows the Printful product and hides others; filtering to another provider hides it", async () => {
  const FLORIST_ITEM = { id: "florist_one:p1", internal: { source: "florist_one", vendor: "florist_one", externalProductId: "p1" }, vendorAuthoritative: { title: "Roses", images: [], priceCents: 4995, currency: "USD" }, curation: {}, lifecycle: { displayEnabled: true }, display: { title: "Roses" }, etag: "e1" };
  const client = fakeModalClient({
    // A realistic server-side filter: the source param actually scopes the results, exactly as
    // the real /items?source= route does — a fake that ignores it would hide a real regression.
    listItems: async (args) => ({ ok: true, items: (!args?.source || args.source === "florist_one") ? [FLORIST_ITEM] : [] }),
  });
  const s = await mountCatalogExpanded(client);
  await act(async () => {
    const sel = s.tid("provider-filter");
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(sel, "printful");
    sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  await flush();
  assert.ok(s.tid("catalog-tile-printful-431624815"));
  assert.ok(!s.tid("catalog-tile-florist_one:p1"));
});

// ── No product is published/staged/restored merely by this correction's own testing ────────────

test("opening the Printful tab and viewing tiles never calls stageMerch, merchLifecycle or patchMerch on its own", async () => {
  const client = fakePickerClient({ listMerch: async () => ({ ok: true, items: [CURATED_ITEM({ curation: { ...CURATED_ITEM().curation, displayEnabled: false } })] }) });
  await mountPrintfulPicker(client);
  assert.equal(client.calls.stageMerch.length, 0);
  assert.equal(client.calls.merchLifecycle.length, 0);
  assert.equal(client.calls.patchMerch.length, 0);
});
