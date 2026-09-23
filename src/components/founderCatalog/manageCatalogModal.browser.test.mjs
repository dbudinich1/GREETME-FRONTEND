// src/components/founderCatalog/manageCatalogModal.browser.test.mjs
//
// UNIFIED MANAGE CATALOG (Team C, 2026-09-23) — BROWSER-LEVEL proof of ManageCatalogModal.jsx and
// AddToCatalogPicker.jsx, the REAL components, esbuild-bundled and mounted into jsdom (the
// established pattern — see prezzeeSmartCard.browser.test.mjs). The `client` prop is a fake,
// in-test-controlled founderCatalogApi (no network) — the same dependency-injection seam the
// component itself defines (`client = founderCatalogApiDefault`).
//
// Run (Node 20.x): node --test src/components/founderCatalog/manageCatalogModal.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__mcm.entry.jsx");
const BUNDLE = join(__dirname, ".__mcm.bundle.mjs");

let React, createRoot, act, ManageCatalogModal, dom;

const PUBLISHED_ITEM = (overrides = {}) => ({
  id: "florist_one:p1",
  internal: { source: "florist_one", vendor: "florist_one", externalProductId: "p1" },
  vendorAuthoritative: { title: "Pink Roses", images: ["https://cdn.test/p1.jpg"], priceCents: 7995, currency: "USD", variants: [] },
  curation: { greetMeCategories: [], brandable: false, featuredRank: null },
  lifecycle: { state: "available", displayEnabled: true },
  display: { title: "Pink Roses" },
  etag: "etag-1",
  ...overrides,
});

function fakeClient(overrides = {}) {
  const calls = { listItems: [], lifecycle: [], patchItem: [], listProviders: [], browseProvider: [], addFromProvider: [], stageMerch: [], browseMerch: [], refreshProvider: [] };
  const base = {
    listItems: async (args) => { calls.listItems.push(args); return { ok: true, items: [PUBLISHED_ITEM()] }; },
    listProviders: async () => { calls.listProviders.push([]); return { ok: true, providers: [
      { providerId: "florist_one", label: "Florist One", enabled: true, browseAvailable: true },
      { providerId: "goody", label: "Goody", enabled: false, reason: "Not yet activated", launchBlockerIds: ["approval_missing"] },
    ] }; },
    browseProvider: async (providerId, args) => { calls.browseProvider.push([providerId, args]); return { ok: true, products: [{ externalProductId: "ext1", title: "Test Product" }] }; },
    addFromProvider: async (args) => { calls.addFromProvider.push(args); return { ok: true, item: PUBLISHED_ITEM({ id: `${args.providerId}:${args.externalProductId}`, internal: { source: args.providerId, vendor: args.providerId, externalProductId: args.externalProductId } }) }; },
    lifecycle: async (vendor, id, action, etag) => { calls.lifecycle.push([vendor, id, action, etag]); return { ok: true, item: PUBLISHED_ITEM({ id }) }; },
    patchItem: async (vendor, id, patch, etag) => { calls.patchItem.push([vendor, id, patch, etag]); return { ok: true, item: PUBLISHED_ITEM({ id, curation: { greetMeCategories: patch.greetMeCategories || [], brandable: false, featuredRank: patch.featuredRank ?? null } }) }; },
    refreshItem: async () => ({ ok: true, item: PUBLISHED_ITEM() }),
    refreshProvider: async (providerId, args) => { calls.refreshProvider.push([providerId, args]); return { ok: true, refreshed: 3 }; },
    stageMerch: async (id) => { calls.stageMerch.push(id); return { ok: true }; },
    browseMerch: async (args) => { calls.browseMerch.push(args); return { ok: true, products: [{ syncProductId: 999, name: "Mug", variants: [{}, {}] }] }; },
  };
  return { ...base, ...overrides, calls };
}

before(async () => {
  writeFileSync(ENTRY, `export { default as ManageCatalogModal } from "./ManageCatalogModal.jsx";`);
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
const setValue = async (el, v) => { await act(async () => {
  Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "value").set.call(el, v);
  el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}); };
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });
const flushDebounce = () => act(async () => { await new Promise((r) => setTimeout(r, 350)); });

async function mountOpen(client) {
  const s = await mount(React.createElement(ManageCatalogModal, { open: true, onClose: () => {}, client }));
  await flush();
  return s;
}

// ── 1. Wide layout ────────────────────────────────────────────────────────────────────────

test("Manage Catalog opens in a near-full-screen (fixed inset) layout, not a side drawer", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  const modal = s.tid("manage-catalog-modal");
  assert.ok(modal, "the modal must render");
  assert.match(modal.getAttribute("style") || "", /position:\s*fixed/);
  assert.match(modal.getAttribute("style") || "", /inset:/, "must use inset, not a fixed side-panel width");
  assert.doesNotMatch(modal.getAttribute("style") || "", /width:\s*\d+px/, "must not be pinned to a fixed pixel drawer width");
});

// ── 2. Only published/customer-visible products appear ─────────────────────────────────────

test("the catalog view requests only state:'published' — never draft/unpublished/retired", async () => {
  const client = fakeClient();
  await mountOpen(client);
  assert.equal(client.calls.listItems.length, 1);
  assert.equal(client.calls.listItems[0].state, "published");
});

// ── 3. Search works ──────────────────────────────────────────────────────────────────────

test("typing in search re-requests the catalog with the query, debounced", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await setValue(s.tid("catalog-search"), "roses");
  await flushDebounce();
  const last = client.calls.listItems[client.calls.listItems.length - 1];
  assert.equal(last.q, "roses");
});

// ── 4. Provider filtering works ──────────────────────────────────────────────────────────

test("choosing a provider filter re-requests the catalog scoped to that source", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await act(async () => {
    const sel = s.tid("provider-filter");
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(sel, "florist_one");
    sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  await flush();
  const last = client.calls.listItems[client.calls.listItems.length - 1];
  assert.equal(last.source, "florist_one");
});

// ── 5. Responsive grid breakpoints exist ─────────────────────────────────────────────────

test("the grid declares 4 columns on desktop, 3 and 2 at narrower breakpoints", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  const styleTag = s.q("style");
  assert.ok(styleTag, "a scoped stylesheet must exist for the grid");
  const css = styleTag.textContent;
  assert.match(css, /grid-template-columns:\s*repeat\(4,\s*1fr\)/);
  assert.match(css, /@media[^{]*max-width:\s*1100px[\s\S]*repeat\(3,\s*1fr\)/);
  assert.match(css, /@media[^{]*max-width:\s*720px[\s\S]*repeat\(2,\s*1fr\)/);
});

// ── 9/10/11. Trash: confirm required, unpublishes (not deletes), failure leaves it visible ──

test("the trash can requires confirmation before any removal call is made", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await click(s.tid("trash-florist_one:p1"));
  await flush();
  assert.equal(client.calls.lifecycle.length, 0, "no removal call before confirmation");
  assert.ok(s.tid("confirm-remove-florist_one:p1"), 'the "Remove this product from your site?" dialog must appear');
  assert.match(s.text(), /Remove this product from your site\?/);
});

test("confirming removal calls lifecycle 'unpublish' (never a delete) and removes the tile only after success", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await click(s.tid("trash-florist_one:p1"));
  await flush();
  await click(s.tid("confirm-remove-yes-florist_one:p1"));
  await flush();
  assert.equal(client.calls.lifecycle.length, 1);
  assert.equal(client.calls.lifecycle[0][2], "unpublish");
  assert.ok(!s.tid("catalog-tile-florist_one:p1"), "the tile must be gone after a successful unpublish");
});

test("a failed removal leaves the tile visible and shows the truthful error", async () => {
  const client = fakeClient({ lifecycle: async () => ({ ok: false, error: "etag_conflict" }) });
  const s = await mountOpen(client);
  await click(s.tid("trash-florist_one:p1"));
  await flush();
  await click(s.tid("confirm-remove-yes-florist_one:p1"));
  await flush();
  assert.ok(s.tid("catalog-tile-florist_one:p1"), "the tile must remain visible after a failed removal");
  assert.match(s.text(), /etag_conflict/);
});

// ── 13. Product details expand and collapse ─────────────────────────────────────────────

test("a tile's management section expands to show categories and collapses again", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  assert.ok(!s.tid("expanded-florist_one:p1"));
  await click(s.tid("expand-florist_one:p1"));
  await flush();
  assert.ok(s.tid("expanded-florist_one:p1"), "expanded content must appear");
  assert.ok(s.tid("category-florist_one:p1-flowers"), "category controls must be present once expanded");
  await click(s.tid("expand-florist_one:p1"));
  await flush();
  assert.ok(!s.tid("expanded-florist_one:p1"), "must collapse again");
});

// ── 6. Add to Catalog supports every provider ────────────────────────────────────────────

test("Add to Catalog opens with all four provider tabs: Florist One, Goody, Prezzee, Printful", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await click(s.tid("add-to-catalog-button"));
  await flush();
  for (const id of ["florist_one", "goody", "prezzee", "printful"]) {
    assert.ok(s.tid(`provider-tab-${id}`), `provider tab "${id}" must exist`);
  }
});

test("Florist One and Goody tabs browse for products; Prezzee shows its one fixed item without browsing", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await click(s.tid("add-to-catalog-button"));
  await flush();
  assert.equal(client.calls.browseProvider.length, 1, "florist_one (the default tab) browses immediately");
  assert.equal(client.calls.browseProvider[0][0], "florist_one");

  await click(s.tid("provider-tab-prezzee"));
  await flush();
  assert.ok(s.tid("prezzee-fixed-item"), "the fixed Smart Card item must render");
  assert.equal(client.calls.browseProvider.length, 1, "selecting Prezzee must not trigger a browse call");
});

// ── 7/8. Publish Selected publishes only selected items; partial failure reported truthfully ─

test("Publish Selected calls addFromProvider then lifecycle('publish') for a selected Florist One product", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await click(s.tid("add-to-catalog-button"));
  await flush();
  await click(s.tid("browse-checkbox-florist_one:ext1"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.addFromProvider.length, 1);
  assert.deepEqual(client.calls.addFromProvider[0], { providerId: "florist_one", externalProductId: "ext1" });
  assert.equal(client.calls.lifecycle.length, 1);
  assert.equal(client.calls.lifecycle[0][2], "publish");
});

test("a partial failure across two selected items reports success for one and the exact error for the other — never a false 'all succeeded'", async () => {
  let call = 0;
  const client = fakeClient({
    addFromProvider: async (args) => {
      call += 1;
      if (call === 2) return { ok: false, error: "duplicate_product" };
      return { ok: true, item: PUBLISHED_ITEM({ id: `${args.providerId}:${args.externalProductId}`, internal: { source: args.providerId, vendor: args.providerId, externalProductId: args.externalProductId } }) };
    },
    browseProvider: async () => ({ ok: true, products: [{ externalProductId: "ext1", title: "Good One" }, { externalProductId: "ext2", title: "Bad One" }] }),
  });
  const s = await mountOpen(client);
  await click(s.tid("add-to-catalog-button"));
  await flush();
  await click(s.tid("browse-checkbox-florist_one:ext1"));
  await click(s.tid("browse-checkbox-florist_one:ext2"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.match(s.text(), /Published/, "the succeeded item must show success");
  assert.match(s.text(), /duplicate_product/, "the failed item must show its EXACT safe error");
  // The failed item's checkbox must still be selected (present + checked) for a retry.
  const failedCheckbox = s.tid("browse-checkbox-florist_one:ext2");
  assert.equal(failedCheckbox.checked, true, "a failed item must stay selected");
});

// ── 14. Printful variants remain manageable (staged, never instantly live) ─────────────────

test("Printful selection submits to the existing staging endpoint, never a publish call, and is labeled truthfully", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await click(s.tid("add-to-catalog-button"));
  await flush();
  await click(s.tid("provider-tab-printful"));
  await flush();
  assert.match(s.text(), /submitted for a reviewed release/i);
  await click(s.tid("browse-checkbox-printful:999"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.stageMerch.length, 1);
  assert.equal(client.calls.stageMerch[0], 999);
  assert.equal(client.calls.lifecycle.length, 0, "Printful must never go through the direct publish transition");
  assert.match(s.text(), /Submitted for review/);
});

// ── Providers view is status-only ────────────────────────────────────────────────────────

test("the Providers view shows status badges and blockers, with no browse control", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await click(s.tid("providers-view-button"));
  await flush();
  assert.ok(s.tid("provider-status-florist_one"));
  assert.match(s.tid("provider-status-badge-florist_one").textContent, /Active/);
  assert.match(s.tid("provider-status-badge-goody").textContent, /Dormant/);
  assert.ok(s.tid("provider-blockers-goody"));
  assert.doesNotMatch(s.text(), /Browse products/i, "no product-browsing control may appear in the status view");
});
