// src/components/founderCatalog/addToCatalogPickerGoody.browser.test.mjs
//
// GOODY ADD PRODUCTS CORRECTION (Team C, 2026-09-24) — BROWSER-LEVEL proof of AddToCatalogPicker.jsx
// against the REAL Goody browse response shape, as it actually comes back from
// GET /api/founder/catalog/providers/goody/browse (services/founderCatalog/catalogAdminModel.js
// toBrowseProduct()): { providerProductId, name, imageUrl, priceCents, currency,
// directSendEligible, ineligibleReasons, ... } — NOT the {externalProductId|id, title} shape the
// picker previously assumed (that shape never existed on a real Goody product, which is exactly
// what caused every reported bug: no images, every checkbox highlighting together, and the fixed
// 30-item/no-pagination slice silently omitting products, baskets included).
//
// Mounts AddToCatalogPicker directly (not the whole modal), locked to Goody, matching how
// ManageCatalogModal always opens it in production.
//
// Run (Node 20.x): node --test src/components/founderCatalog/addToCatalogPickerGoody.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__acpg.entry.jsx");
const BUNDLE = join(__dirname, ".__acpg.bundle.mjs");

let React, createRoot, act, AddToCatalogPicker, dom;

// A REAL Goody browse item, shaped exactly as toBrowseProduct() actually returns it.
const GOODY_ITEM = (overrides = {}) => ({
  providerProductId: "goody-prod-1",
  name: "Sunrise Gift Basket",
  description: "A curated basket of morning treats.",
  brandName: "Goody Collective",
  imageUrl: "https://cdn.ongoody.com/products/sunrise-basket.jpg",
  priceCents: 6500,
  currency: "USD",
  variantNames: [],
  variantsRequired: false,
  providerStatus: "active",
  directSendEligible: true,
  ineligibleReasons: [],
  restrictedStates: [],
  alreadyInCatalog: false,
  suggestedCategoryIds: ["gift_baskets"],
  ...overrides,
});

function fakeClient(overrides = {}) {
  const calls = { browseProvider: [], addFromProvider: [], lifecycle: [] };
  const base = {
    browseProvider: async (providerId, args) => {
      calls.browseProvider.push([providerId, args]);
      return { ok: true, products: [GOODY_ITEM()], total: 1, totalIsExact: true, nextCursor: null, traversal: { complete: true, pagesFetched: 1, productsScanned: 1, outcome: "ok" } };
    },
    addFromProvider: async (args) => { calls.addFromProvider.push(args); return { ok: true, item: { id: `goody:${args.externalProductId}`, internal: { vendor: "goody" }, etag: "e1" } }; },
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

async function mountGoody(client, onPublished = () => {}) {
  const s = await mount(React.createElement(AddToCatalogPicker, {
    client, lockedProviderId: "goody", onClose: () => {}, onPublished,
  }));
  await flush();
  return s;
}

// ── Images ───────────────────────────────────────────────────────────────────────────────────

test("each Goody tile renders its own product image from the real imageUrl field", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      GOODY_ITEM({ providerProductId: "g1", name: "Sunrise Basket", imageUrl: "https://cdn.ongoody.com/g1.jpg" }),
      GOODY_ITEM({ providerProductId: "g2", name: "Evening Hamper", imageUrl: "https://cdn.ongoody.com/g2.jpg" }),
    ], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountGoody(client);
  const img1 = s.q('[data-testid="browse-result-goody:g1"] img');
  const img2 = s.q('[data-testid="browse-result-goody:g2"] img');
  assert.ok(img1, "the first tile must render an <img>");
  assert.ok(img2, "the second tile must render an <img>");
  assert.equal(img1.getAttribute("src"), "https://cdn.ongoody.com/g1.jpg");
  assert.equal(img2.getAttribute("src"), "https://cdn.ongoody.com/g2.jpg");
  assert.notEqual(img1.getAttribute("src"), img2.getAttribute("src"), "each tile's image must be its own product's image");
});

test("a Goody product with no imageUrl shows a truthful placeholder, not a broken image", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [GOODY_ITEM({ imageUrl: null })], total: 1, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountGoody(client);
  assert.ok(!s.q('img'), "no broken <img> tag with an empty/null src");
  assert.match(s.text(), /No image/);
});

// ── Independent selection (the "select one, highlights every tile" bug) ────────────────────────

test("checking one Goody product's checkbox does NOT select any other product", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      GOODY_ITEM({ providerProductId: "g1", name: "Sunrise Basket" }),
      GOODY_ITEM({ providerProductId: "g2", name: "Evening Hamper" }),
      GOODY_ITEM({ providerProductId: "g3", name: "Cozy Blanket Set" }),
    ], total: 3, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountGoody(client);
  await click(s.tid("browse-checkbox-goody:g2"));
  await flush();
  assert.equal(s.tid("browse-checkbox-goody:g1").checked, false, "g1 must stay unselected");
  assert.equal(s.tid("browse-checkbox-goody:g2").checked, true, "only g2 was clicked");
  assert.equal(s.tid("browse-checkbox-goody:g3").checked, false, "g3 must stay unselected");
});

test("each Goody tile has its own distinct data-testid/key — no shared 'goody:undefined' identity", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      GOODY_ITEM({ providerProductId: "g1" }), GOODY_ITEM({ providerProductId: "g2" }),
    ], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountGoody(client);
  assert.ok(!s.tid("browse-result-goody:undefined"), "no product may collapse into an undefined-id key");
  assert.ok(s.tid("browse-result-goody:g1"));
  assert.ok(s.tid("browse-result-goody:g2"));
});

// ── Price ────────────────────────────────────────────────────────────────────────────────────

test("each Goody tile shows customer-relevant price information from priceCents/currency", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [GOODY_ITEM({ providerProductId: "g1", priceCents: 7995, currency: "USD" })], total: 1, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountGoody(client);
  assert.match(s.tid("browse-result-goody:g1").textContent, /\$79\.95/);
});

// ── Exclude products the existing Goody adapter cannot fulfil ─────────────────────────────────

test("a product with directSendEligible:false is excluded from the browsable results entirely", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      GOODY_ITEM({ providerProductId: "g1", name: "Fulfillable Basket", directSendEligible: true }),
      GOODY_ITEM({ providerProductId: "g2", name: "Unfulfillable Item", directSendEligible: false, ineligibleReasons: ["VARIANTS_REQUIRED_BUT_NONE_OFFERED"] }),
    ], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountGoody(client);
  assert.ok(s.tid("browse-result-goody:g1"), "the fulfillable product must be shown");
  assert.ok(!s.tid("browse-result-goody:g2"), "the ineligible product must not be shown at all");
  assert.doesNotMatch(s.text(), /Unfulfillable Item/);
});

// ── Pagination / catalog completeness (baskets not silently omitted) ───────────────────────────

test("the initial Goody browse requests the backend's max page size, not the old 30-item slice", async () => {
  const client = fakeClient();
  await mountGoody(client);
  assert.equal(client.calls.browseProvider.length, 1);
  const [providerId, args] = client.calls.browseProvider[0];
  assert.equal(providerId, "goody");
  assert.equal(args.count, 50, "must request the backend's documented max page size (MAX_BROWSE_PAGE_SIZE)");
  assert.equal(args.start, 0);
});

test("Load more appends the next page via the response's own cursor, without discarding the first page", async () => {
  let call = 0;
  const client = fakeClient({
    browseProvider: async (providerId, args) => {
      call += 1;
      if (call === 1) {
        return { ok: true, products: [GOODY_ITEM({ providerProductId: "g1", name: "Page 1 Item" })], total: 1, totalIsExact: false, nextCursor: "p2", traversal: { complete: false, pagesFetched: 1 } };
      }
      assert.equal(args.cursor, "p2", "the second page request must carry the cursor from the first response");
      return { ok: true, products: [GOODY_ITEM({ providerProductId: "g2", name: "Sunrise Gift Basket" })], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true, pagesFetched: 2 } };
    },
  });
  const s = await mountGoody(client);
  assert.ok(s.tid("browse-result-goody:g1"), "page 1 item must be visible");
  assert.ok(s.tid("goody-load-more"), "a Load more control must appear when more pages exist");
  await click(s.tid("goody-load-more"));
  await flush();
  assert.ok(s.tid("browse-result-goody:g1"), "page 1 item must STILL be visible after loading more");
  assert.ok(s.tid("browse-result-goody:g2"), "the newly loaded basket must now be visible");
  assert.ok(!s.tid("goody-load-more"), "Load more must disappear once there is no further cursor");
});

test("no Load more control appears when the first page already covers everything", async () => {
  const client = fakeClient();
  const s = await mountGoody(client);
  assert.ok(!s.tid("goody-load-more"));
});

// ── Basket discovery via search ─────────────────────────────────────────────────────────────

test("searching forwards the founder's query to the backend so gift baskets can be found by name", async () => {
  const client = fakeClient({
    browseProvider: async (providerId, args) => {
      client.calls.browseProvider.push([providerId, args]);
      if (args.q === "basket") {
        return { ok: true, products: [GOODY_ITEM({ providerProductId: "gb1", name: "Deluxe Gift Basket" })], total: 1, totalIsExact: true, nextCursor: null, traversal: { complete: true } };
      }
      return { ok: true, products: [GOODY_ITEM({ providerProductId: "g1", name: "Unrelated Mug" })], total: 1, totalIsExact: true, nextCursor: null, traversal: { complete: true } };
    },
  });
  client.calls.browseProvider = [];
  const s = await mountGoody(client);
  const search = s.tid("provider-browse-search");
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(search, "basket");
    search.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    search.dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  });
  await flush();
  assert.ok(s.tid("browse-result-goody:gb1"), "the basket found by search must be shown");
  const last = client.calls.browseProvider[client.calls.browseProvider.length - 1];
  assert.equal(last[1].q, "basket");
});

// ── Publish payload carries the REAL provider product id ───────────────────────────────────────

test("Publish Selected sends the real providerProductId as externalProductId — never undefined", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [GOODY_ITEM({ providerProductId: "goody-real-id-123", name: "Sunrise Basket" })], total: 1, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountGoody(client);
  await click(s.tid("browse-checkbox-goody:goody-real-id-123"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.addFromProvider.length, 1);
  assert.deepEqual(client.calls.addFromProvider[0], { providerId: "goody", externalProductId: "goody-real-id-123" });
  assert.equal(client.calls.lifecycle.length, 1);
  assert.equal(client.calls.lifecycle[0][2], "publish");
});

test("multi-select publishes each Goody product with its own distinct id — none collapse into the same payload", async () => {
  const client = fakeClient({
    browseProvider: async () => ({ ok: true, products: [
      GOODY_ITEM({ providerProductId: "g1", name: "Sunrise Basket" }),
      GOODY_ITEM({ providerProductId: "g2", name: "Evening Hamper" }),
    ], total: 2, totalIsExact: true, nextCursor: null, traversal: { complete: true } }),
  });
  const s = await mountGoody(client);
  await click(s.tid("browse-checkbox-goody:g1"));
  await click(s.tid("browse-checkbox-goody:g2"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.addFromProvider.length, 2);
  const ids = client.calls.addFromProvider.map((a) => a.externalProductId).sort();
  assert.deepEqual(ids, ["g1", "g2"]);
});

// ── Publish Selected preserved, and nothing published during this correction's own testing ────

test("Publish Selected remains a single explicit action — no product is published merely by browsing or selecting", async () => {
  const client = fakeClient();
  const s = await mountGoody(client);
  await click(s.tid("browse-checkbox-goody:goody-prod-1"));
  await flush();
  assert.equal(client.calls.addFromProvider.length, 0, "selecting alone must not publish");
  assert.equal(client.calls.lifecycle.length, 0);
});
