// src/components/founderCatalog/addToCatalogPickerFloristOne.browser.test.mjs
//
// FLORIST ONE ADD PRODUCTS CORRECTION (Team C, 2026-09-24) — BROWSER-LEVEL proof of
// AddToCatalogPicker.jsx against the REAL Florist One browse response shape, as it actually comes
// back from GET /api/founder/catalog/providers/florist_one/browse. That route runs every provider's
// already-normalized product through the ONE shared projection,
// services/founderCatalog/catalogAdminModel.js toBrowseProduct() — the exact same shape Goody's
// picker was already corrected for: { providerProductId, name, imageUrl, priceCents, currency,
// directSendEligible, alreadyInCatalog, ... }. The picker's generic (non-Goody) rendering branch
// had NOT been corrected for this shape — it still read {externalProductId|id, title}, fields that
// never exist on a real product, so every Florist One tile computed the SAME
// "florist_one:undefined" key and collapsed into one shared selection (the identical bug class the
// Goody fix corrected), and it never rendered an image or a price at all.
//
// Mounts AddToCatalogPicker directly (not the whole modal), locked to Florist One, matching how
// ManageCatalogModal always opens it in production.
//
// Run (Node 20.x): node --test src/components/founderCatalog/addToCatalogPickerFloristOne.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__acpf.entry.jsx");
const BUNDLE = join(__dirname, ".__acpf.bundle.mjs");

let React, createRoot, act, AddToCatalogPicker, dom;

// A REAL Florist One browse item, shaped exactly as toBrowseProduct() actually returns it
// (services/floristOne/floristOneCatalog.js toFounderCatalogProduct() feeds into the same shared
// projection Goody uses — confirmed by reading both files directly, not assumed).
const FLORIST_ITEM = (overrides = {}) => ({
  providerProductId: "FO-1001",
  name: "Dozen Red Roses",
  description: "A classic dozen red roses, arranged with greenery.",
  brandName: null,
  imageUrl: "https://cdn.floristone.com/products/fo-1001-large.jpg",
  priceCents: 5999,
  currency: "USD",
  variantNames: [],
  variantsRequired: false,
  providerStatus: "active",
  directSendEligible: true,
  ineligibleReasons: [],
  restrictedStates: [],
  alreadyInCatalog: false,
  suggestedCategoryIds: ["flowers"],
  ...overrides,
});

function fakeClient(overrides = {}) {
  const calls = { browseProvider: [], addFromProvider: [], lifecycle: [] };
  const base = {
    browseProvider: async (providerId, args) => {
      calls.browseProvider.push([providerId, args]);
      return { ok: true, products: [FLORIST_ITEM()], total: 1, totalIsExact: true, nextCursor: null, traversal: { complete: true, pagesFetched: 1, productsScanned: 1, outcome: "ok" } };
    },
    addFromProvider: async (args) => { calls.addFromProvider.push(args); return { ok: true, item: { id: `florist_one:${args.externalProductId}`, internal: { vendor: "florist_one" }, etag: "e1" } }; },
    lifecycle: async (vendor, id, action, etag) => { calls.lifecycle.push([vendor, id, action, etag]); return { ok: true, item: { id } }; },
  };
  return { ...base, ...overrides, calls };
}

before(async () => {
  writeFileSync(ENTRY, `export { default as AddToCatalogPicker } from "./AddToCatalogPicker.jsx";`);
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

async function mountFlorist(client, onPublished = () => {}) {
  const s = await mount(React.createElement(AddToCatalogPicker, {
    client, lockedProviderId: "florist_one", onClose: () => {}, onPublished,
  }));
  await flush();
  return s;
}

// ── Images ───────────────────────────────────────────────────────────────────────────────────

test("each Florist One tile renders its own product image from the real imageUrl field", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      FLORIST_ITEM({ providerProductId: "FO-1", name: "Dozen Red Roses", imageUrl: "https://cdn.floristone.com/fo-1.jpg" }),
      FLORIST_ITEM({ providerProductId: "FO-2", name: "Spring Tulip Bouquet", imageUrl: "https://cdn.floristone.com/fo-2.jpg" }),
    ], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  const img1 = s.q('[data-testid="browse-result-florist_one:FO-1"] img');
  const img2 = s.q('[data-testid="browse-result-florist_one:FO-2"] img');
  assert.ok(img1, "the first tile must render an <img>");
  assert.ok(img2, "the second tile must render an <img>");
  assert.equal(img1.getAttribute("src"), "https://cdn.floristone.com/fo-1.jpg");
  assert.equal(img2.getAttribute("src"), "https://cdn.floristone.com/fo-2.jpg");
  assert.notEqual(img1.getAttribute("src"), img2.getAttribute("src"), "each tile's image must be its own product's image");
});

test("a Florist One product with no imageUrl shows a truthful placeholder, not a broken image", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [FLORIST_ITEM({ imageUrl: null })], total: 1, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  assert.ok(!s.q("img"), "no broken <img> tag with an empty/null src");
  assert.match(s.text(), /No image/);
});

// ── Independent selection (the "select one, highlights every tile" bug) ────────────────────────

test("checking one Florist One product's checkbox does NOT select any other product", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      FLORIST_ITEM({ providerProductId: "FO-1", name: "Dozen Red Roses" }),
      FLORIST_ITEM({ providerProductId: "FO-2", name: "Spring Tulip Bouquet" }),
      FLORIST_ITEM({ providerProductId: "FO-3", name: "Sunflower Basket" }),
    ], total: 3, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  await click(s.tid("browse-checkbox-florist_one:FO-2"));
  await flush();
  assert.equal(s.tid("browse-checkbox-florist_one:FO-1").checked, false, "FO-1 must stay unselected");
  assert.equal(s.tid("browse-checkbox-florist_one:FO-2").checked, true, "only FO-2 was clicked");
  assert.equal(s.tid("browse-checkbox-florist_one:FO-3").checked, false, "FO-3 must stay unselected");
});

test("deselecting one Florist One product does not affect any other selected product", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      FLORIST_ITEM({ providerProductId: "FO-1", name: "Dozen Red Roses" }),
      FLORIST_ITEM({ providerProductId: "FO-2", name: "Spring Tulip Bouquet" }),
    ], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  await click(s.tid("browse-checkbox-florist_one:FO-1"));
  await click(s.tid("browse-checkbox-florist_one:FO-2"));
  await flush();
  assert.equal(s.tid("browse-checkbox-florist_one:FO-1").checked, true);
  assert.equal(s.tid("browse-checkbox-florist_one:FO-2").checked, true);
  // Deselect FO-1 only.
  await click(s.tid("browse-checkbox-florist_one:FO-1"));
  await flush();
  assert.equal(s.tid("browse-checkbox-florist_one:FO-1").checked, false, "FO-1 must now be unselected");
  assert.equal(s.tid("browse-checkbox-florist_one:FO-2").checked, true, "FO-2 must remain selected, untouched by FO-1's deselection");
});

test("each Florist One tile has its own distinct data-testid/key — no shared 'florist_one:undefined' identity", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      FLORIST_ITEM({ providerProductId: "FO-1" }), FLORIST_ITEM({ providerProductId: "FO-2" }),
    ], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  assert.ok(!s.tid("browse-result-florist_one:undefined"), "no product may collapse into an undefined-id key");
  assert.ok(s.tid("browse-result-florist_one:FO-1"));
  assert.ok(s.tid("browse-result-florist_one:FO-2"));
});

// ── Price ────────────────────────────────────────────────────────────────────────────────────

test("each Florist One tile shows its own price from priceCents/currency, distinct per product", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      FLORIST_ITEM({ providerProductId: "FO-1", priceCents: 5999, currency: "USD" }),
      FLORIST_ITEM({ providerProductId: "FO-2", priceCents: 3499, currency: "USD" }),
    ], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  assert.match(s.tid("browse-result-florist_one:FO-1").textContent, /\$59\.99/);
  assert.match(s.tid("browse-result-florist_one:FO-2").textContent, /\$34\.99/);
});

// ── Truthful labeling: already-in-catalog and ineligible products remain visible, disabled ─────

test("a product already in the catalog is truthfully labeled and its checkbox is disabled", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      FLORIST_ITEM({ providerProductId: "FO-1", name: "Already Published Roses", alreadyInCatalog: true }),
    ], total: 1, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  assert.ok(s.tid("browse-result-florist_one:FO-1"), "the product must still be shown, not hidden");
  assert.match(s.tid("browse-status-florist_one:FO-1").textContent, /Already in catalog/);
  assert.equal(s.tid("browse-checkbox-florist_one:FO-1").disabled, true);
});

test("a product with directSendEligible:false is truthfully labeled and its checkbox is disabled, not silently hidden", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      FLORIST_ITEM({ providerProductId: "FO-1", name: "Fulfillable Roses", directSendEligible: true }),
      FLORIST_ITEM({ providerProductId: "FO-2", name: "Unfulfillable Item", directSendEligible: false }),
    ], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  assert.ok(s.tid("browse-result-florist_one:FO-1"), "the eligible product renders normally");
  assert.equal(s.tid("browse-checkbox-florist_one:FO-1").disabled, false);
  assert.ok(s.tid("browse-result-florist_one:FO-2"), "the ineligible product is still shown, not hidden");
  assert.match(s.tid("browse-status-florist_one:FO-2").textContent, /Not eligible for direct send/);
  assert.equal(s.tid("browse-checkbox-florist_one:FO-2").disabled, true);
});

test("a malformed browse entry with no providerProductId is dropped, never rendered as a phantom tile", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      { name: "Missing its id entirely" },
      FLORIST_ITEM({ providerProductId: "FO-1", name: "Real Product" }),
    ], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  assert.equal(s.qa('[data-testid^="browse-result-florist_one:"]').length, 1, "exactly one real tile, the malformed entry is dropped");
  assert.ok(s.tid("browse-result-florist_one:FO-1"));
});

// ── Selected-count footer always matches the actual selected tiles ─────────────────────────────

test("the selected-count footer matches the number of actually-checked tiles as selections change", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      FLORIST_ITEM({ providerProductId: "FO-1" }),
      FLORIST_ITEM({ providerProductId: "FO-2" }),
      FLORIST_ITEM({ providerProductId: "FO-3" }),
    ], total: 3, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  assert.match(s.host.textContent, /0 selected/);
  await click(s.tid("browse-checkbox-florist_one:FO-1"));
  await flush();
  assert.match(s.host.textContent, /1 selected/);
  await click(s.tid("browse-checkbox-florist_one:FO-2"));
  await flush();
  assert.match(s.host.textContent, /2 selected/);
  await click(s.tid("browse-checkbox-florist_one:FO-1"));
  await flush();
  assert.match(s.host.textContent, /1 selected/, "deselecting FO-1 must bring the count back down");
});

// ── Publish Selected: disabled at zero, enabled after a valid selection ────────────────────────

test("Publish Selected is disabled at zero selections and enables only after a valid selection", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [FLORIST_ITEM({ providerProductId: "FO-1" })], total: 1, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  assert.equal(s.tid("publish-selected-button").disabled, true, "must be disabled with zero selections");
  await click(s.tid("browse-checkbox-florist_one:FO-1"));
  await flush();
  assert.equal(s.tid("publish-selected-button").disabled, false, "must enable once a product is selected");
});

// ── Publish payload carries the REAL provider product id ───────────────────────────────────────

test("Publish Selected sends the real providerProductId as externalProductId — never undefined", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [FLORIST_ITEM({ providerProductId: "FO-real-id-123", name: "Dozen Red Roses" })], total: 1, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);
  await click(s.tid("browse-checkbox-florist_one:FO-real-id-123"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.addFromProvider.length, 1);
  assert.deepEqual(client.calls.addFromProvider[0], { providerId: "florist_one", externalProductId: "FO-real-id-123" });
  assert.equal(client.calls.lifecycle.length, 1);
  assert.equal(client.calls.lifecycle[0][2], "publish");
});

test("multiple Florist One products maintain independent selection state and each publishes with its own distinct id", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      FLORIST_ITEM({ providerProductId: "FO-1", name: "Dozen Red Roses", imageUrl: "https://cdn.floristone.com/fo-1.jpg", priceCents: 5999 }),
      FLORIST_ITEM({ providerProductId: "FO-2", name: "Spring Tulip Bouquet", imageUrl: "https://cdn.floristone.com/fo-2.jpg", priceCents: 3499 }),
    ], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountFlorist(client);

  // Distinct images and prices, proven together (the exact regression this task asked for).
  assert.equal(s.q('[data-testid="browse-result-florist_one:FO-1"] img').getAttribute("src"), "https://cdn.floristone.com/fo-1.jpg");
  assert.equal(s.q('[data-testid="browse-result-florist_one:FO-2"] img').getAttribute("src"), "https://cdn.floristone.com/fo-2.jpg");
  assert.match(s.tid("browse-result-florist_one:FO-1").textContent, /\$59\.99/);
  assert.match(s.tid("browse-result-florist_one:FO-2").textContent, /\$34\.99/);

  // Select only FO-1 first — FO-2 must stay untouched.
  await click(s.tid("browse-checkbox-florist_one:FO-1"));
  await flush();
  assert.equal(s.tid("browse-checkbox-florist_one:FO-1").checked, true);
  assert.equal(s.tid("browse-checkbox-florist_one:FO-2").checked, false);

  // Now select FO-2 too — both independently selected.
  await click(s.tid("browse-checkbox-florist_one:FO-2"));
  await flush();
  assert.equal(s.tid("browse-checkbox-florist_one:FO-1").checked, true);
  assert.equal(s.tid("browse-checkbox-florist_one:FO-2").checked, true);

  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.addFromProvider.length, 2, "each selected product must be published as its own call");
  const ids = client.calls.addFromProvider.map((a) => a.externalProductId).sort();
  assert.deepEqual(ids, ["FO-1", "FO-2"], "no two products may collapse into the same id");
});

// ── Publish Selected preserved as a single explicit action ─────────────────────────────────────

test("Publish Selected remains a single explicit action — no product is published merely by browsing or selecting", async () => {
  const client = fakeClient();
  const s = await mountFlorist(client);
  await click(s.tid("browse-checkbox-florist_one:FO-1001"));
  await flush();
  assert.equal(client.calls.addFromProvider.length, 0, "selecting alone must not publish");
  assert.equal(client.calls.lifecycle.length, 0);
});
