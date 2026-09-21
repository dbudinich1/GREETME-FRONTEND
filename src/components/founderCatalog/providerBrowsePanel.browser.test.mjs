// src/components/founderCatalog/providerBrowsePanel.browser.test.mjs
//
// FULL CATALOG INTEGRATION — browse, one-click Add as Draft, refresh, attention indicators.
//
// The REAL components, esbuild-bundled into jsdom with an INJECTED client. No network, no vendor,
// no backend. Declared runtime: Node 20.x, as package.json says.
//
// THE CENTRAL PROOFS are the two safety ones: a dormant provider is stated rather than requested,
// and Add as Draft sends TWO IDENTIFIERS and no product data at all.
//
// Run: node --test src/components/founderCatalog/providerBrowsePanel.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import {
  attentionBadge, hasChanged, changedSummary, browsePaging, browseProducts,
  isDormantBrowse, clampBrowseCount, BROWSE_PAGE_SIZE, MAX_BROWSE_PAGE_SIZE, ATTENTION_COPY,
  browseTraversal, browseCountCopy,
} from "./catalogDrawerModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__pbp.entry.jsx");
const BUNDLE = join(__dirname, ".__pbp.bundle.mjs");

let React, createRoot, act, ProviderBrowsePanel, ManageCatalogDrawer, dom, root, reactRoot;

const BROWSE_PRODUCT = (over = {}) => ({
  providerProductId: "box-1",
  name: "Roasted and Toasted",
  description: "Small-batch beans.",
  brandName: "Bean Co",
  imageUrl: "https://vendor.example/box.png",
  priceCents: 7800,
  currency: "USD",
  variantNames: ["Dark Roast", "Medium Roast"],
  variantsRequired: true,
  providerStatus: "active",
  directSendEligible: true,
  ineligibleReasons: [],
  restrictedStates: ["AK"],
  alreadyInCatalog: false,
  suggestedCategoryIds: ["gift_baskets"],
  ...over,
});

const ITEM = (over = {}) => ({
  id: "gm-prov-e1",
  internal: { source: "prov", vendor: "prov", externalProductId: "e1" },
  vendorAuthoritative: {
    title: "Vendor Mug", description: "", images: [{ url: "https://vendor.example/mug.png" }],
    priceCents: 2500, currency: "USD", available: true, variants: [], syncedAt: "2026-09-05T00:00:00.000Z",
  },
  curation: { greetMeCategories: [], brandable: false, featuredRank: null, overrides: { title: null, description: null, imageUrl: null } },
  lifecycle: { state: "draft", displayEnabled: false, curatedAt: null, curatedBy: null, lastPublishedAt: null, lastPublishedBy: null },
  display: { title: "Vendor Mug", imageUrl: null },
  provider: {
    providerStatus: "active", directSendEligible: true, lastRefreshAt: "2026-09-21T00:00:00.000Z",
    lastChangedAt: null, changedFields: [], refreshError: null, attention: "none",
  },
  etag: '"e1"',
  ...over,
});

const PROVIDERS = (browseAvailable = true) => ([
  { providerId: "prov", label: "Gift Boxes", enabled: browseAvailable, orderPlacementAllowed: false, browseAvailable, reason: browseAvailable ? "allowed" : "provider_disabled", launchBlockerIds: [] },
]);

function clientStub(over = {}) {
  const calls = { browse: [], added: [], refreshItem: [], refreshProvider: [], list: 0, providers: 0 };
  return {
    calls,
    listItems: async () => { calls.list++; return { ok: true, items: [ITEM()] }; },
    listProviders: async () => { calls.providers++; return { ok: true, providers: PROVIDERS() }; },
    browseProvider: async (providerId, opts) => {
      calls.browse.push({ providerId, ...opts });
      return {
        ok: true, providerId, persisted: false, start: opts?.start || 0, count: opts?.count || 20,
        total: 1, products: [BROWSE_PRODUCT()],
        totalIsExact: true, nextCursor: null,
        traversal: { complete: true, truncated: false, outcome: "complete", pagesFetched: 1, productsScanned: 1, fromPage: 1, error: null },
      };
    },
    addFromProvider: async (body) => { calls.added.push(body); return { ok: true, item: ITEM({ display: { title: "Roasted and Toasted", imageUrl: null } }) }; },
    refreshItem: async (vendor, id, etag) => { calls.refreshItem.push({ vendor, id, etag }); return { ok: true, item: ITEM(), delta: { changed: [], becameUnavailable: false, priceOrVariantsMoved: false } }; },
    refreshProvider: async (providerId, opts) => { calls.refreshProvider.push({ providerId, ...opts }); return { ok: true, provider: providerId, examined: 3, refreshed: 1, unchanged: 2, markedUnavailable: 0, removedByProvider: 0, limited: false, results: [] }; },
    patchItem: async (vendor, id, patch) => ({ ok: true, item: ITEM({ curation: { ...ITEM().curation, ...patch } }) }),
    lifecycle: async () => ({ ok: true, item: ITEM() }),
    createDraft: async () => ({ ok: true, item: ITEM() }),
    ...over,
  };
}

before(async () => {
  writeFileSync(ENTRY, `
    export { default as ProviderBrowsePanel } from "./ProviderBrowsePanel.jsx";
    export { default as ManageCatalogDrawer } from "./ManageCatalogDrawer.jsx";
  `);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    define: { "import.meta.env": JSON.stringify({ VITE_API_BASE: "" }) },
    external: ["react", "react-dom", "react-dom/client"],
    logLevel: "silent",
  });
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://app.test/dashboard/gifts" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  globalThis.MouseEvent = dom.window.MouseEvent; globalThis.getComputedStyle = dom.window.getComputedStyle;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only on some runtimes */ }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ ProviderBrowsePanel, ManageCatalogDrawer } = await import(pathToFileURL(BUNDLE).href));
  root = document.getElementById("root");
});

after(() => {
  for (const f of [ENTRY, BUNDLE, BUNDLE.replace(/\.mjs$/, ".css")]) {
    try { rmSync(f); } catch { /* already gone */ }
  }
});

async function mount(el) {
  if (reactRoot) { await act(async () => reactRoot.unmount()); reactRoot = null; }
  root.innerHTML = "";
  await act(async () => { reactRoot = createRoot(root); reactRoot.render(el); });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
}
const tid = (t) => root.querySelector(`[data-testid="${t}"]`);
const clickEl = async (el) => {
  await act(async () => el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })));
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
};
const setValue = async (el, v) => {
  await act(async () => {
    Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, v);
    el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
    el.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
  });
};
const panelEl = (client, props = {}) => React.createElement(ProviderBrowsePanel, {
  client, providerId: "prov", providerLabel: "Gift Boxes", onAdded: async () => {}, ...props,
});

// ══ BROWSING ════════════════════════════════════════════════════════════════════════════════
test("the panel renders read-only product rows with brand, price, variants and availability", async () => {
  const client = clientStub();
  await mount(panelEl(client));

  assert.ok(tid("provider-browse-panel"));
  assert.ok(tid("browse-item-box-1"));
  assert.equal(tid("browse-image-box-1").getAttribute("src"), "https://vendor.example/box.png");
  assert.match(tid("browse-brand-box-1").textContent, /Bean Co/);
  assert.equal(tid("browse-price-box-1").textContent, "$78.00 USD");
  assert.match(tid("browse-availability-box-1").textContent, /active at provider/);
  assert.match(tid("browse-variants-box-1").textContent, /Dark Roast, Medium Roast/);
  assert.match(tid("browse-suggested-box-1").textContent, /Gift Baskets/);
  assert.match(tid("browse-count").textContent, /Showing 1–1 of 1/);
});

test("a DORMANT provider is stated, not requested — and no products are shown", async () => {
  const client = clientStub({
    browseProvider: async () => ({ ok: false, reason: "provider_disabled", browseAvailable: false, products: [BROWSE_PRODUCT()] }),
  });
  await mount(panelEl(client));
  assert.ok(tid("browse-dormant"), "the dormant state is named");
  assert.match(tid("browse-dormant").textContent, /dormant/i);
  assert.equal(tid("browse-results"), null, "and no product is rendered, even one in the refusal body");
});

test("search sends the query and resets to the first page", async () => {
  const client = clientStub();
  await mount(panelEl(client));
  await setValue(tid("browse-q"), "hoodie");
  await clickEl(tid("browse-search"));
  const last = client.calls.browse[client.calls.browse.length - 1];
  assert.equal(last.q, "hoodie");
  assert.equal(last.start, 0);
});

test("category filters use EXISTING Greet-Me categories only, and toggle off", async () => {
  const client = clientStub();
  await mount(panelEl(client));
  for (const id of ["gift_cards", "gift_baskets", "flowers", "americana", "faith_and_inspiration", "tech", "apparel"]) {
    assert.ok(tid(`browse-cat-${id}`), `${id} filter present`);
  }
  assert.equal(tid("browse-cat-gift_boxes"), null, "no category was invented");

  await clickEl(tid("browse-cat-tech"));
  assert.equal(client.calls.browse[client.calls.browse.length - 1].categoryId, "tech");
  await clickEl(tid("browse-cat-tech"));
  assert.equal(client.calls.browse[client.calls.browse.length - 1].categoryId, undefined, "clicking again clears it");
});

test("paging asks for the next window and never exceeds the page size", async () => {
  const client = clientStub({
    browseProvider: async (providerId, opts) => {
      client.calls.browse.push({ providerId, ...opts });
      return {
        ok: true, total: 57, start: opts.start, count: opts.count, products: [BROWSE_PRODUCT()],
        totalIsExact: true, nextCursor: null,
        traversal: { complete: true, truncated: false, outcome: "complete", pagesFetched: 1, productsScanned: 57, fromPage: 1, error: null },
      };
    },
  });
  await mount(panelEl(client));
  assert.match(tid("browse-count").textContent, /of 57/);
  await clickEl(tid("browse-next"));
  const last = client.calls.browse[client.calls.browse.length - 1];
  assert.equal(last.start, BROWSE_PAGE_SIZE);
  assert.ok(last.count <= MAX_BROWSE_PAGE_SIZE);
});

// ══ ADD AS DRAFT — THE SAFETY PROOF ═════════════════════════════════════════════════════════
test("Add as Draft sends TWO IDENTIFIERS and no product data whatsoever", async () => {
  const client = clientStub();
  await mount(panelEl(client));
  await clickEl(tid("browse-add-box-1"));

  assert.equal(client.calls.added.length, 1, "one product, one deliberate act");
  const body = client.calls.added[0];
  assert.deepEqual(Object.keys(body).sort(), ["externalProductId", "providerId"]);
  assert.equal(body.externalProductId, "box-1");
  for (const forbidden of ["title", "name", "priceCents", "price", "currency", "variants", "images", "imageUrl", "available", "description", "snapshot"]) {
    assert.equal(forbidden in body, false, `the body must not carry ${forbidden}`);
  }
  assert.match(tid("browse-notice").textContent, /Customers cannot see it/i);
});

test("a product already in the catalog is shown as such and cannot be added again", async () => {
  const client = clientStub({
    browseProvider: async () => ({ ok: true, total: 1, start: 0, count: 20, products: [BROWSE_PRODUCT({ alreadyInCatalog: true })] }),
  });
  await mount(panelEl(client));
  const add = tid("browse-add-box-1");
  assert.equal(add.disabled, true);
  assert.match(add.textContent, /In catalog/);
  await clickEl(add);
  assert.equal(client.calls.added.length, 0);
});

test("adding the same product twice in one session is prevented after the first success", async () => {
  const client = clientStub();
  await mount(panelEl(client));
  await clickEl(tid("browse-add-box-1"));
  assert.equal(client.calls.added.length, 1);
  await clickEl(tid("browse-add-box-1"));
  assert.equal(client.calls.added.length, 1, "the button became 'In catalog'");
});

test("a server refusal is reported in the founder's words and nothing is claimed as added", async () => {
  const client = clientStub({
    addFromProvider: async () => { const e = new Error("nope"); e.body = { error: "PROVIDER_DORMANT" }; throw e; },
  });
  await mount(panelEl(client));
  await clickEl(tid("browse-add-box-1"));
  assert.match(tid("browse-notice").textContent, /dormant/i);
  assert.equal(tid("browse-add-box-1").disabled, false, "it can be retried");
});

test("an ineligible product is shown with its reasons rather than hidden", async () => {
  const client = clientStub({
    browseProvider: async () => ({ ok: true, total: 1, start: 0, count: 20, products: [BROWSE_PRODUCT({ directSendEligible: false, ineligibleReasons: ["VARIANTS_REQUIRED_BUT_NONE_OFFERED"] })] }),
  });
  await mount(panelEl(client));
  assert.match(tid("browse-ineligible-box-1").textContent, /Not direct-send eligible/);
  assert.match(tid("browse-ineligible-box-1").textContent, /VARIANTS_REQUIRED_BUT_NONE_OFFERED/);
});

// ══ THE DRAWER: REFRESH AND INDICATORS ══════════════════════════════════════════════════════
const drawerEl = (client) => React.createElement(ManageCatalogDrawer, { open: true, onClose() {}, client });

test("a stored record offers a per-item refresh, and it asks about that record only", async () => {
  const client = clientStub();
  await mount(drawerEl(client));
  await clickEl(tid("refresh-gm-prov-e1"));
  assert.deepEqual(client.calls.refreshItem, [{ vendor: "prov", id: "gm-prov-e1", etag: '"e1"' }]);
  assert.match(tid("drawer-success").textContent, /nothing changed at the provider/i);
});

test("attention and changed indicators render from STORED fields, with no extra call", async () => {
  const client = clientStub({
    listItems: async () => ({ ok: true, items: [ITEM({
      provider: { ...ITEM().provider, attention: "removed", changedFields: ["priceCents", "variants"] },
    })] }),
  });
  await mount(drawerEl(client));
  assert.match(tid("attention-gm-prov-e1").textContent, /REMOVED BY PROVIDER/);
  assert.match(tid("changed-gm-prov-e1").textContent, /price and variants/);
  assert.equal(client.calls.browse.length, 0, "no vendor call was needed to say any of that");
  assert.equal(client.calls.refreshItem.length, 0);
});

test("a record needing no attention shows no badge at all", async () => {
  const client = clientStub();
  await mount(drawerEl(client));
  assert.equal(tid("attention-gm-prov-e1"), null);
  assert.equal(tid("changed-gm-prov-e1"), null);
});

test("bulk refresh is offered per provider and reports what it examined", async () => {
  const client = clientStub();
  await mount(drawerEl(client));
  await clickEl(root.querySelector('[data-testid="section-providers"], nav button:nth-child(4)'));
  const bulk = tid("refresh-provider-prov");
  assert.ok(bulk, "the bulk action is on the provider, not on the catalog as a whole");
  await clickEl(bulk);
  assert.deepEqual(client.calls.refreshProvider, [{ providerId: "prov" }]);
  assert.match(tid("drawer-success").textContent, /Checked 3 records: 1 updated/);
});

test("the browse panel opens from the provider row and closes again", async () => {
  const client = clientStub();
  await mount(drawerEl(client));
  await clickEl(root.querySelector('nav button:nth-child(4)'));
  assert.equal(tid("provider-browse-panel"), null, "closed until asked for");
  await clickEl(tid("browse-prov"));
  assert.ok(tid("provider-browse-panel"), "it opened");
  await clickEl(tid("browse-prov"));
  assert.equal(tid("provider-browse-panel"), null, "and closed again");
});

// ══ PURE MODEL ══════════════════════════════════════════════════════════════════════════════
test("paging arithmetic is honest at the edges", () => {
  assert.deepEqual(browsePaging({ start: 0, count: 20, total: 0 }), {
    start: 0, count: 20, total: 0, shownFrom: 0, shownTo: 0, hasPrev: false, hasNext: false, prevStart: 0, nextStart: 20,
  });
  const mid = browsePaging({ start: 20, count: 20, total: 57 });
  assert.equal(mid.shownFrom, 21);
  assert.equal(mid.shownTo, 40);
  assert.equal(mid.hasNext, true);
  const last = browsePaging({ start: 40, count: 20, total: 57 });
  assert.equal(last.shownTo, 57);
  assert.equal(last.hasNext, false);
  assert.equal(clampBrowseCount(9999), MAX_BROWSE_PAGE_SIZE);
  assert.equal(clampBrowseCount("x"), BROWSE_PAGE_SIZE);
});

test("browse reading is fail-closed: any refusal yields no products", () => {
  assert.equal(browseProducts({ ok: true, products: [BROWSE_PRODUCT()] }).length, 1);
  for (const refusal of [null, undefined, { ok: false, products: [BROWSE_PRODUCT()] }, { ok: false, reason: "provider_disabled", products: [BROWSE_PRODUCT()] }]) {
    assert.deepEqual(browseProducts(refusal), [], JSON.stringify(refusal));
  }
  assert.equal(isDormantBrowse({ ok: false, reason: "provider_disabled" }), true);
  assert.equal(isDormantBrowse({ ok: false, reason: "provider_catalog_error" }), false);
  // A product with no identifier could never be added, so it is never offered.
  assert.deepEqual(browseProducts({ ok: true, products: [{ name: "no id" }] }), []);
});

test("every attention state has copy, and 'none' deliberately has none", () => {
  for (const id of ["removed", "inactive", "ineligible", "price_moved", "provider_error"]) {
    assert.ok(ATTENTION_COPY[id], id);
    assert.ok(ATTENTION_COPY[id].label.length > 0);
    assert.ok(ATTENTION_COPY[id].hint.length > 0, "a badge that cannot explain itself is decoration");
  }
  assert.equal(ATTENTION_COPY.none, null);
  assert.equal(attentionBadge({ provider: { attention: "none" } }), null);
  assert.equal(attentionBadge({}), null);
  assert.equal(attentionBadge({ provider: { attention: "removed" } }).label, "REMOVED BY PROVIDER");
});

test("changed summaries read as sentences, not field names", () => {
  assert.equal(hasChanged({ provider: { changedFields: [] } }), false);
  assert.equal(changedSummary({ provider: { changedFields: [] } }), null);
  assert.equal(changedSummary({ provider: { changedFields: ["priceCents"] } }), "The provider changed the price.");
  assert.equal(changedSummary({ provider: { changedFields: ["priceCents", "variants"] } }), "The provider changed the price and variants.");
  assert.equal(
    changedSummary({ provider: { changedFields: ["priceCents", "variants", "title"] } }),
    "The provider changed the price, variants and title.",
  );
});

// ══ MULTI-PAGE SEARCH — TRUNCATION, HONEST EMPTINESS, CONTINUATION ══════════════════════════
//
// The server searches a bounded slice of the provider catalog per request. These prove the panel
// never launders a partial search into a statement about the whole catalog.

const TRUNCATED = (over = {}) => ({
  ok: true, providerId: "prov", persisted: false, start: 0, count: 20,
  total: 0, products: [],
  totalIsExact: false, nextCursor: "p6",
  traversal: { complete: false, truncated: true, outcome: "page_budget", pagesFetched: 5, productsScanned: 500, fromPage: 1, error: null },
  ...over,
});

test("an EMPTY result from a truncated search is never reported as 'no products match'", async () => {
  const client = clientStub({ browseProvider: async (providerId, opts) => { client.calls.browse.push({ providerId, ...opts }); return TRUNCATED(); } });
  await mount(panelEl(client));

  const count = tid("browse-count").textContent;
  assert.doesNotMatch(count, /No products match/i, "that sentence is a claim about the whole catalog");
  assert.match(count, /first 500 products/, "it says what was actually searched");
  assert.ok(tid("browse-truncated"), "and the truncation is stated in its own right");
  assert.match(tid("browse-truncated").textContent, /safety limit/i);
});

test("a COMPLETE search that finds nothing DOES say so plainly", async () => {
  const client = clientStub({
    browseProvider: async () => TRUNCATED({
      totalIsExact: true, nextCursor: null,
      traversal: { complete: true, truncated: false, outcome: "complete", pagesFetched: 2, productsScanned: 140, fromPage: 1, error: null },
    }),
  });
  await mount(panelEl(client));
  assert.equal(tid("browse-count").textContent, "No products match.");
  assert.equal(tid("browse-truncated"), null, "nothing to warn about when the whole catalog was searched");
});

test("continuation resumes with the cursor the server issued, and does not restart", async () => {
  const seen = [];
  const client = clientStub({
    browseProvider: async (providerId, opts) => {
      seen.push(opts);
      return opts?.cursor
        ? { ...TRUNCATED(), total: 1, products: [BROWSE_PRODUCT()], totalIsExact: true, nextCursor: null,
            traversal: { complete: true, truncated: false, outcome: "complete", pagesFetched: 1, productsScanned: 40, fromPage: 6, error: null } }
        : TRUNCATED();
    },
  });
  await mount(panelEl(client));
  await clickEl(tid("browse-continue"));

  assert.equal(seen.length, 2);
  assert.equal(seen[0].cursor, undefined, "the first pass starts at the beginning");
  assert.equal(seen[1].cursor, "p6", "the second resumes exactly where the server stopped");
  assert.ok(tid("browse-item-box-1"), "and the product found later is shown");
  assert.ok(tid("browse-continued"), "the panel says it is continuing rather than pretending to be page one");
  assert.ok(tid("browse-restart"), "and offers a way back to the beginning");
});

test("a NEW search abandons the continuation instead of skipping the catalog's beginning", async () => {
  const seen = [];
  const client = clientStub({
    browseProvider: async (providerId, opts) => { seen.push(opts); return TRUNCATED(); },
  });
  await mount(panelEl(client));
  await clickEl(tid("browse-continue"));
  assert.equal(seen[seen.length - 1].cursor, "p6");

  await setValue(tid("browse-q"), "hoodie");
  await clickEl(tid("browse-search"));
  const last = seen[seen.length - 1];
  assert.equal(last.q, "hoodie");
  assert.equal(last.cursor, undefined, "a new query searches from the start, or it would silently skip products");

  await clickEl(tid("browse-cat-tech"));
  assert.equal(seen[seen.length - 1].cursor, undefined, "so does a new filter");
});

test("a provider failure partway through is described as a failure, not as an empty catalog", async () => {
  const client = clientStub({
    browseProvider: async () => TRUNCATED({
      traversal: { complete: false, truncated: true, outcome: "provider_error", pagesFetched: 1, productsScanned: 100, fromPage: 1, error: "provider_catalog_error" },
      nextCursor: "p2",
    }),
  });
  await mount(panelEl(client));
  assert.match(tid("browse-count").textContent, /stopped responding/i);
  assert.match(tid("browse-truncated").textContent, /stopped responding/i);
  assert.ok(tid("browse-continue"), "and a retry is still offered from the page that failed");
});

test("browseTraversal is fail-closed: completeness is believed only when stated", () => {
  assert.equal(browseTraversal(null).complete, false);
  assert.equal(browseTraversal({ ok: false, reason: "provider_disabled" }).complete, false);
  assert.equal(browseTraversal({ ok: true, total: 3, products: [] }).complete, false, "an old-shaped response claims nothing");
  assert.equal(browseTraversal({ ok: true, totalIsExact: true, traversal: { complete: true } }).complete, true);
  assert.equal(browseTraversal({ ok: true, totalIsExact: true, traversal: { complete: false } }).complete, false);
  assert.equal(browseTraversal({ ok: true, totalIsExact: true, traversal: { complete: true }, nextCursor: "p4" }).nextCursor, "p4");
  assert.equal(browseTraversal({ ok: true, traversal: { outcome: "provider_error" } }).failed, true);
});

test("browseCountCopy never presents a partial search as the catalog's answer", () => {
  const partial = { complete: false, truncated: true, scanned: 500, failed: false };
  assert.match(browseCountCopy({ total: 0, traversal: partial }), /first 500 products/);
  assert.doesNotMatch(browseCountCopy({ total: 0, traversal: partial }), /No products match/);
  assert.equal(browseCountCopy({ total: 0, traversal: { complete: true, scanned: 12 } }), "No products match.");
  assert.match(
    browseCountCopy({ total: 4, paging: browsePaging({ start: 0, count: 20, total: 4 }), traversal: partial }),
    /Showing 1–4 of 4 found so far/,
  );
  assert.equal(
    browseCountCopy({ total: 4, paging: browsePaging({ start: 0, count: 20, total: 4 }), traversal: { complete: true, scanned: 4 } }),
    "Showing 1–4 of 4",
  );
});
