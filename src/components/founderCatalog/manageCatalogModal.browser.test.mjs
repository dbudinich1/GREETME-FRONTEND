// src/components/founderCatalog/manageCatalogModal.browser.test.mjs
//
// PROVIDER-FIRST MANAGE CATALOG (Team C, 2026-09-23) — BROWSER-LEVEL proof of ManageCatalogModal.jsx,
// ProvidersStatusView.jsx and AddToCatalogPicker.jsx, the REAL components, esbuild-bundled and
// mounted into jsdom (the established pattern — see prezzeeSmartCard.browser.test.mjs). The
// `client` prop is a fake, in-test-controlled founderCatalogApi (no network) — the same
// dependency-injection seam the component itself defines (`client = founderCatalogApiDefault`).
//
// Manage Catalog now opens on a PROVIDERS-FIRST view (all four providers, each with its own
// "+ Add Products" action that opens that provider's picker DIRECTLY — no second provider-
// selection screen) with a single collapsed-by-default "Full Live Catalog (N)" section beneath it.
//
// Run (Node 20.x): node --test src/components/founderCatalog/manageCatalogModal.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
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
    // Only THREE providers ever come back from the backend registry — Printful is deliberately
    // outside it (services/providers/registry.js asserts exactly three registrations). The
    // component itself is responsible for adding a truthful Printful row.
    listProviders: async () => { calls.listProviders.push([]); return { ok: true, providers: [
      { providerId: "florist_one", label: "Florist One", enabled: true, browseAvailable: true },
      { providerId: "goody", label: "Goody", enabled: false, reason: "Not yet activated", launchBlockerIds: ["approval_missing"] },
      { providerId: "prezzee", label: "Prezzee", enabled: true, browseAvailable: false, reason: "no_browsable_catalog" },
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

async function openAddFor(s, providerId) {
  await click(s.tid(`provider-add-${providerId}`));
  await flush();
}

// ── Presentation preserved (the softened modal treatment from the prior pass) ─────────────────

test("Manage Catalog is centered, not a side drawer or an edge-anchored full-bleed panel", async () => {
  const s = await mountOpen(fakeClient());
  const backdrop = s.tid("manage-catalog-backdrop");
  const modal = s.tid("manage-catalog-modal");
  assert.ok(backdrop, "a backdrop wrapper must render");
  assert.ok(modal, "the modal must render");
  assert.match(backdrop.getAttribute("style") || "", /position:\s*fixed/);
  assert.match(backdrop.getAttribute("style") || "", /inset:\s*0/, "the BACKDROP covers the full viewport");
  assert.match(backdrop.getAttribute("style") || "", /align-items:\s*center/);
  assert.match(backdrop.getAttribute("style") || "", /justify-content:\s*center/);
  assert.doesNotMatch(modal.getAttribute("style") || "", /inset:/, "the MODAL itself must not be edge-anchored");
});

test("the modal is constrained to ~90% viewport width and a maximum of ~82-85% viewport height", async () => {
  const s = await mountOpen(fakeClient());
  const style = s.tid("manage-catalog-modal").getAttribute("style") || "";
  const widthMatch = /(?:^|;)\s*width:\s*(\d+)vw/.exec(style);
  assert.ok(widthMatch);
  assert.ok(Number(widthMatch[1]) >= 88 && Number(widthMatch[1]) <= 92);
  const heightMatch = /max-height:\s*(\d+)vh/.exec(style);
  assert.ok(heightMatch);
  assert.ok(Number(heightMatch[1]) >= 82 && Number(heightMatch[1]) <= 85);
});

test("a restrained darkened backdrop exists with comfortable margins, and rounded corners/shadow are preserved", async () => {
  const s = await mountOpen(fakeClient());
  const backdropStyle = s.tid("manage-catalog-backdrop").getAttribute("style") || "";
  assert.match(backdropStyle, /background:\s*rgba\(/);
  const alpha = Number(/background:\s*rgba\([^)]*,\s*([\d.]+)\)/.exec(backdropStyle)[1]);
  assert.ok(alpha > 0.15 && alpha < 0.75);
  assert.match(backdropStyle, /padding:/);
  const modalStyle = s.tid("manage-catalog-modal").getAttribute("style") || "";
  assert.match(modalStyle, /border-radius:/);
  assert.match(modalStyle, /box-shadow:/);
});

test("the header is compact (title + close only) and stays outside the scrollable content area", async () => {
  const s = await mountOpen(fakeClient());
  const header = s.q("header");
  assert.ok(header);
  assert.match(header.textContent, /Manage Catalog/);
  assert.ok(header.querySelector('[data-testid="manage-catalog-close"]'));
  assert.doesNotMatch(header.getAttribute("style") || "", /overflow:\s*auto|overflow:\s*scroll/);
  const content = header.nextElementSibling;
  assert.ok(content, "a content sibling must exist immediately after the header");
  assert.match(content.getAttribute("style") || "", /overflow:\s*auto/, "only the content area scrolls");
  // The search box, provider filter and the old generic "Add to Catalog"/"Providers" buttons no
  // longer live in the header — search/filter moved into the Full Live Catalog section, and the
  // generic add/providers buttons were replaced by each provider row's own "+ Add Products".
  assert.ok(!header.querySelector('[data-testid="catalog-search"]'), "search must not live in the header anymore");
  assert.ok(!header.querySelector('[data-testid="provider-filter"]'), "the provider filter must not live in the header anymore");
  assert.ok(!header.querySelector('[data-testid="add-to-catalog-button"]'), "the generic Add to Catalog button must be gone");
  assert.ok(!header.querySelector('[data-testid="providers-view-button"]'), "the generic Providers toggle button must be gone");
});

// ── 1/2/3/4/5. Providers-first opening view ─────────────────────────────────────────────────

test("1. Manage Catalog opens directly on the Providers view — no click required to see it", async () => {
  const s = await mountOpen(fakeClient());
  assert.ok(s.tid("providers-status-list"), "the providers list must be present on open, with no navigation");
});

test("2/3/4/5. Florist One, Goody, Prezzee and Printful all appear in the opening Providers view", async () => {
  const s = await mountOpen(fakeClient());
  for (const id of ["florist_one", "goody", "prezzee", "printful"]) {
    const row = s.tid(`provider-status-${id}`);
    assert.ok(row, `provider row "${id}" must appear in the opening view`);
  }
  assert.match(s.tid("provider-status-florist_one").textContent, /Florist One/);
  assert.match(s.tid("provider-status-goody").textContent, /Goody/);
  assert.match(s.tid("provider-status-prezzee").textContent, /Prezzee/);
  assert.match(s.tid("provider-status-printful").textContent, /Printful/);
});

test("provider status is accurate existing state, not fabricated — an explicitly dormant provider is shown as dormant", async () => {
  const s = await mountOpen(fakeClient());
  assert.match(s.tid("provider-status-badge-florist_one").textContent, /Active/);
  assert.match(s.tid("provider-status-badge-goody").textContent, /Dormant/);
  assert.ok(s.tid("provider-blockers-goody"), "Goody's real launch blockers must still be shown");
});

test("Printful's status reflects its real existing state (a live, shipping supplier) truthfully labeled, without claiming a refresh capability the backend never granted it", async () => {
  const s = await mountOpen(fakeClient());
  assert.match(s.tid("provider-status-badge-printful").textContent, /Active/);
  assert.ok(!s.tid("provider-refresh-printful"), "no fabricated refresh action for a provider outside the refresh-capable registry");
});

// ── 6/7. Every provider has its own Add Products action, opening that provider directly ────

test("6. Every one of the four providers has its own '+ Add Products' action", async () => {
  const s = await mountOpen(fakeClient());
  for (const id of ["florist_one", "goody", "prezzee", "printful"]) {
    assert.ok(s.tid(`provider-add-${id}`), `"+ Add Products" must exist for "${id}"`);
  }
});

test("7. Clicking a provider's '+ Add Products' opens THAT provider's picker directly — no second provider-selection screen", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await openAddFor(s, "florist_one");
  assert.ok(s.tid("add-to-catalog-picker"), "the picker must be showing");
  assert.match(s.tid("add-to-catalog-heading").textContent, /Florist One/, "the heading must identify the chosen provider");
  assert.ok(!s.q('[role="tablist"]'), "no tab bar / second provider-selection screen may appear");
  assert.equal(client.calls.browseProvider.length, 1, "it must browse immediately, with no extra click");
  assert.equal(client.calls.browseProvider[0][0], "florist_one");
});

test("the Prezzee picker opens directly on its one fixed Smart Card item, never a browse step", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await openAddFor(s, "prezzee");
  assert.match(s.tid("add-to-catalog-heading").textContent, /Prezzee/);
  assert.ok(s.tid("prezzee-fixed-item"));
  assert.equal(client.calls.browseProvider.length, 0, "Prezzee must never trigger a browse call");
});

test("the Printful picker opens directly on the Printful catalog browser", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await openAddFor(s, "printful");
  assert.match(s.tid("add-to-catalog-heading").textContent, /Printful/);
  assert.equal(client.calls.browseMerch.length, 1, "it must browse the Printful catalog immediately");
  assert.match(s.text(), /submitted for a reviewed release/i);
});

// ── 8. Existing provider availability gates remain enforced ────────────────────────────────

test("8. Opening a gated provider's picker still enforces the existing availability gate — the founder sees the real refusal, not a bypass", async () => {
  const client = fakeClient({
    browseProvider: async (providerId) => {
      if (providerId === "goody") return { ok: false, error: "This provider is not available to browse right now." };
      return { ok: true, products: [] };
    },
  });
  const s = await mountOpen(client);
  await openAddFor(s, "goody");
  assert.match(s.text(), /not available to browse right now/i, "the real gate's refusal must reach the founder, unchanged");
});

// ── close-only-when-appropriate / preserved-selection-on-failure, from the picker's own contract ─

test("closing the picker returns to the Providers-first home view, and the picker never auto-closes itself on a partial success", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await openAddFor(s, "florist_one");
  await click(s.tid("browse-checkbox-florist_one:ext1"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.ok(s.tid("add-to-catalog-picker"), "the picker must still be open after a successful publish — the founder closes it explicitly");
  await click(s.tid("add-to-catalog-close"));
  await flush();
  assert.ok(s.tid("providers-status-list"), "closing must return to the Providers-first home view");
});

// ── 9/10. Full Live Catalog is collapsed initially, and expands/collapses correctly ────────

test("9. Full Live Catalog is collapsed when Manage Catalog first opens", async () => {
  const s = await mountOpen(fakeClient());
  assert.ok(s.tid("full-catalog-toggle"), "the collapsed toggle row must exist");
  assert.equal(s.tid("full-catalog-toggle").getAttribute("aria-expanded"), "false");
  assert.ok(!s.tid("full-catalog-expanded"), "the catalog grid must not be rendered while collapsed");
  assert.ok(!s.tid("catalog-grid"));
});

test("10. Clicking the Full Live Catalog row expands it, and clicking again collapses it", async () => {
  const s = await mountOpen(fakeClient());
  await click(s.tid("full-catalog-toggle"));
  await flush();
  assert.equal(s.tid("full-catalog-toggle").getAttribute("aria-expanded"), "true");
  assert.ok(s.tid("full-catalog-expanded"), "the catalog must now be visible");
  assert.ok(s.tid("catalog-grid"));
  await click(s.tid("full-catalog-toggle"));
  await flush();
  assert.equal(s.tid("full-catalog-toggle").getAttribute("aria-expanded"), "false");
  assert.ok(!s.tid("full-catalog-expanded"), "it must collapse again");
});

// ── 11/12. Only customer-visible products appear, and the count is dynamic and accurate ────

test("11. The catalog requests only state:'published' — never draft/unpublished/retired — even while collapsed (so the count is accurate before expanding)", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  assert.equal(client.calls.listItems.length, 1, "the published list must load on open, before any expand click");
  assert.equal(client.calls.listItems[0].state, "published");
});

test("12. The Full Live Catalog count is dynamic — it reflects the real item count and updates after a removal, not a hardcoded number", async () => {
  const client = fakeClient({
    listItems: async () => ({ ok: true, items: [PUBLISHED_ITEM(), PUBLISHED_ITEM({ id: "florist_one:p2", display: { title: "Tulips" } })] }),
  });
  const s = await mountOpen(client);
  assert.match(s.tid("full-catalog-toggle").textContent, /Full Live Catalog \(2\)/);
  await click(s.tid("full-catalog-toggle"));
  await flush();
  await click(s.tid("trash-florist_one:p1"));
  await flush();
  await click(s.tid("confirm-remove-yes-florist_one:p1"));
  await flush();
  assert.match(s.tid("full-catalog-toggle").textContent, /Full Live Catalog \(1\)/, "the count must update after a successful unpublish");
});

// ── 13/14/15. Compact tiles, search preserved, management expands without disrupting the grid ─

test("13. Compact management tiles replace large images — the grid uses the scoped compact-tile class, not a full-bleed photo layout", async () => {
  const s = await mountOpen(fakeClient());
  await click(s.tid("full-catalog-toggle"));
  await flush();
  assert.ok(s.tid("catalog-grid").className.includes("gm-manage-catalog-grid"));
  const styleTag = s.q("style");
  const css = styleTag.textContent;
  assert.match(css, /grid-template-columns:\s*repeat\(4,\s*1fr\)/, "four compact tiles across on desktop");
  assert.match(css, /@media[^{]*max-width:\s*1100px[\s\S]*repeat\(3,\s*1fr\)/);
  assert.match(css, /@media[^{]*max-width:\s*720px[\s\S]*repeat\(2,\s*1fr\)/);
});

test("14. Catalog search still works inside the expanded Full Live Catalog section", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await click(s.tid("full-catalog-toggle"));
  await flush();
  assert.ok(s.tid("catalog-search"), "search must still exist");
  await setValue(s.tid("catalog-search"), "roses");
  await flushDebounce();
  const last = client.calls.listItems[client.calls.listItems.length - 1];
  assert.equal(last.q, "roses");
});

test("choosing a provider filter re-requests the catalog scoped to that source", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await click(s.tid("full-catalog-toggle"));
  await flush();
  await act(async () => {
    const sel = s.tid("provider-filter");
    Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(sel, "florist_one");
    sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  await flush();
  const last = client.calls.listItems[client.calls.listItems.length - 1];
  assert.equal(last.source, "florist_one");
});

test("15. A tile's management section expands to show categories and collapses again, without disrupting the surrounding grid", async () => {
  const s = await mountOpen(fakeClient());
  await click(s.tid("full-catalog-toggle"));
  await flush();
  assert.ok(!s.tid("expanded-florist_one:p1"));
  await click(s.tid("expand-florist_one:p1"));
  await flush();
  assert.ok(s.tid("expanded-florist_one:p1"), "expanded content must appear");
  assert.ok(s.tid("category-florist_one:p1-flowers"), "category controls must be present once expanded");
  assert.ok(s.tid("catalog-grid"), "the grid itself must still be present, unbroken, while a tile is expanded");
  await click(s.tid("expand-florist_one:p1"));
  await flush();
  assert.ok(!s.tid("expanded-florist_one:p1"), "must collapse again");
});

// ── 17/18/19. Trash requires confirmation; success unpublishes; failure leaves the tile visible ─

test("17. The trash icon requires confirmation before any removal call is made", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await click(s.tid("full-catalog-toggle"));
  await flush();
  await click(s.tid("trash-florist_one:p1"));
  await flush();
  assert.equal(client.calls.lifecycle.length, 0, "no removal call before confirmation");
  assert.ok(s.tid("confirm-remove-florist_one:p1"));
  assert.match(s.text(), /Remove this product from your site\?/);
});

test("18. Confirming removal calls lifecycle 'unpublish' (never a delete) and removes the tile only after the server confirms success", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await click(s.tid("full-catalog-toggle"));
  await flush();
  await click(s.tid("trash-florist_one:p1"));
  await flush();
  await click(s.tid("confirm-remove-yes-florist_one:p1"));
  await flush();
  assert.equal(client.calls.lifecycle.length, 1);
  assert.equal(client.calls.lifecycle[0][2], "unpublish");
  assert.ok(!s.tid("catalog-tile-florist_one:p1"), "the tile must be gone after a successful unpublish");
});

test("19. A failed removal leaves the tile visible and shows the truthful error — never an implied success", async () => {
  const client = fakeClient({ lifecycle: async () => ({ ok: false, error: "etag_conflict" }) });
  const s = await mountOpen(client);
  await click(s.tid("full-catalog-toggle"));
  await flush();
  await click(s.tid("trash-florist_one:p1"));
  await flush();
  await click(s.tid("confirm-remove-yes-florist_one:p1"));
  await flush();
  assert.ok(s.tid("catalog-tile-florist_one:p1"), "the tile must remain visible after a failed removal");
  assert.match(s.text(), /etag_conflict/);
});

// ── 20. Existing Printful variant management remains available ────────────────────────────

test("20. A published Printful tile still exposes its variant management, unchanged", async () => {
  const client = fakeClient({
    listItems: async () => ({ ok: true, items: [PUBLISHED_ITEM({
      id: "printful:m1",
      internal: { source: "printful", vendor: "printful", externalProductId: "m1" },
      vendorAuthoritative: { title: "Mug", images: [], priceCents: 1999, currency: "USD", variants: [{}, {}, {}] },
    })] }),
  });
  const s = await mountOpen(client);
  await click(s.tid("full-catalog-toggle"));
  await flush();
  await click(s.tid("expand-printful:m1"));
  await flush();
  assert.ok(s.tid("printful-variants-printful:m1"));
  assert.match(s.tid("printful-variants-printful:m1").textContent, /3 variant/);
  assert.ok(!s.tid("refresh-printful:m1"), "Printful must not offer the generic provider-refresh action");
});

// ── 21. Partial publishing failures remain visible and truthful ───────────────────────────

test("21. A partial failure across two selected items reports success for one and the exact error for the other — never a false 'all succeeded'", async () => {
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
  await openAddFor(s, "florist_one");
  await click(s.tid("browse-checkbox-florist_one:ext1"));
  await click(s.tid("browse-checkbox-florist_one:ext2"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.match(s.text(), /Published/, "the succeeded item must show success");
  assert.match(s.text(), /duplicate_product/, "the failed item must show its EXACT safe error");
  const failedCheckbox = s.tid("browse-checkbox-florist_one:ext2");
  assert.equal(failedCheckbox.checked, true, "a failed item must stay selected for correction/retry");
});

test("Printful selection submits to the existing staging endpoint, never a publish call, and is labeled truthfully", async () => {
  const client = fakeClient();
  const s = await mountOpen(client);
  await openAddFor(s, "printful");
  await click(s.tid("browse-checkbox-printful:999"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.stageMerch.length, 1);
  assert.equal(client.calls.stageMerch[0], 999);
  assert.equal(client.calls.lifecycle.length, 0, "Printful must never go through the direct publish transition");
  assert.match(s.text(), /Submitted for review/);
});

// ── Category UX correction (Founder-authorized 2026-09-25, "AUTHORIZED CANONICAL CUSTOMER
// CATALOG CORRECTION") — a visible list of what's currently assigned, a one-click removal per
// category, and an explicit "Set as only category" replacement action, so a founder correcting a
// wrong category can no longer silently ADD a new one while the old one stays invisible. ─────────

async function expandTileWith(categories) {
  const client = fakeClient({
    listItems: async (args) => {
      client.calls.listItems.push(args);
      return { ok: true, items: [PUBLISHED_ITEM({ curation: { greetMeCategories: categories, brandable: false, featuredRank: null } })] };
    },
  });
  const s = await mountOpen(client);
  await click(s.tid("full-catalog-toggle"));
  await flush();
  await click(s.tid("expand-florist_one:p1"));
  await flush();
  return { s, client };
}

test("currently-assigned categories are shown as a visible, labeled list — not just highlighted toggle buttons", async () => {
  const { s } = await expandTileWith(["gift_baskets"]);
  const list = s.tid("selected-categories-florist_one:p1");
  assert.ok(list, "a dedicated selected-categories summary must render");
  assert.match(list.textContent, /Gift Baskets/);
  assert.ok(s.tid("remove-category-florist_one:p1-gift_baskets"), "each listed category must carry its own removal control");
});

test("a product with no categories assigned shows an explicit empty state, not a blank space", async () => {
  const { s } = await expandTileWith([]);
  assert.ok(!s.tid("selected-categories-florist_one:p1"), "no populated list when nothing is assigned");
  assert.ok(s.tid("selected-categories-empty-florist_one:p1"), "an explicit 'none assigned' state must render instead");
  assert.match(s.text(), /No categories assigned yet\./);
});

test("the remove control on a selected category PATCHes it out of the stored array — nothing else in the array is touched", async () => {
  const { s, client } = await expandTileWith(["gift_baskets", "tech"]);
  await click(s.tid("remove-category-florist_one:p1-gift_baskets"));
  await flush();
  assert.equal(client.calls.patchItem.length, 1);
  const [, , patch] = client.calls.patchItem[0];
  assert.deepEqual(patch.greetMeCategories, ["tech"], "gift_baskets removed, tech left exactly as it was");
});

test("'Set as only category' REPLACES the whole stored array — it does not append alongside the wrong one", async () => {
  const { s, client } = await expandTileWith(["gift_baskets"]);
  assert.ok(s.tid("only-category-florist_one:p1-tech"), "the replacement action must be offered for an unselected category");
  await click(s.tid("only-category-florist_one:p1-tech"));
  await flush();
  assert.equal(client.calls.patchItem.length, 1);
  const [, , patch] = client.calls.patchItem[0];
  assert.deepEqual(patch.greetMeCategories, ["tech"], "gift_baskets must be GONE, not merely joined by tech");
});

test("'Set as only category' is not offered for a category that is already the current selection", async () => {
  const { s } = await expandTileWith(["gift_baskets"]);
  assert.ok(!s.tid("only-category-florist_one:p1-gift_baskets"), "no replacement action for an id already selected — the remove control covers that case");
});

test("intentional multi-category assignment is still reachable — the toggle grid still adds a SECOND category without removing the first", async () => {
  const { s, client } = await expandTileWith(["gift_baskets"]);
  await click(s.tid("category-florist_one:p1-tech"));
  await flush();
  assert.equal(client.calls.patchItem.length, 1);
  const [, , patch] = client.calls.patchItem[0];
  assert.deepEqual(patch.greetMeCategories.sort(), ["gift_baskets", "tech"], "the toggle grid still supports intentional multi-category, unchanged");
});
