// src/components/founderCatalog/manageCatalogDrawer.browser.test.mjs — CHECKPOINT 2.
//
// The REAL drawer, esbuild-bundled and mounted into jsdom with an INJECTED client. No network, no
// vendor, no backend.
//
// THE CENTRAL PROOF is the provider section: a dormant provider must be presented as disabled and
// must never be REQUESTED. The injected client's browse method throws if it is ever called, so
// "no dormant-provider request is made" is checked rather than argued.
//
// Run (Node 20.x): node --test src/components/founderCatalog/manageCatalogDrawer.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__mcd.entry.jsx");
const BUNDLE = join(__dirname, ".__mcd.bundle.mjs");

let React, createRoot, act, ManageCatalogDrawer, dom, root, reactRoot;

const ITEM = (over = {}) => ({
  id: "gm-goody-e1",
  internal: { source: "goody", vendor: "goody", externalProductId: "e1" },
  vendorAuthoritative: { title: "Vendor Mug", description: "", images: [], priceCents: 2500, currency: "USD", available: true, variants: [], syncedAt: "2026-09-05T00:00:00.000Z" },
  curation: { greetMeCategories: [], brandable: false, featuredRank: null, overrides: { title: null, description: null, imageUrl: null } },
  lifecycle: { state: "draft", displayEnabled: false, curatedAt: null, curatedBy: null, lastPublishedAt: null, lastPublishedBy: null },
  display: { title: "Vendor Mug", imageUrl: null },
  etag: '"e1"',
  ...over,
});

const DORMANT_PROVIDERS = [
  { providerId: "florist_one", label: "Flowers", enabled: false, orderPlacementAllowed: false, browseAvailable: false, reason: "provider_disabled", launchBlockerIds: ["no_order_status_mechanism", "no_programmatic_cancel_or_refund"] },
  { providerId: "goody", label: "Gift Boxes", enabled: false, orderPlacementAllowed: false, browseAvailable: false, reason: "provider_disabled", launchBlockerIds: [] },
];

function clientStub(over = {}) {
  const calls = { list: 0, providers: 0, browse: 0, patch: [], lifecycle: [] };
  return {
    calls,
    listItems: async () => { calls.list++; return { ok: true, items: [ITEM()] }; },
    listProviders: async () => { calls.providers++; return { ok: true, providers: DORMANT_PROVIDERS }; },
    // A booby trap: the drawer must never request a dormant provider.
    browseProvider: async () => { calls.browse++; throw new Error("VENDOR BROWSE REQUESTED WHILE DORMANT"); },
    patchItem: async (vendor, id, patch) => { calls.patch.push({ vendor, id, patch }); return { ok: true, item: ITEM({ curation: { ...ITEM().curation, ...patch } }) }; },
    lifecycle: async (vendor, id, action) => { calls.lifecycle.push({ vendor, id, action }); return { ok: true, item: ITEM() }; },
    ...over,
  };
}

before(async () => {
  writeFileSync(ENTRY, `export { default as ManageCatalogDrawer } from "./ManageCatalogDrawer.jsx";`);
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
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only */ }
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ ManageCatalogDrawer } = await import(pathToFileURL(BUNDLE).href));
  root = document.getElementById("root");
});

after(() => {
  for (const f of [ENTRY, BUNDLE, BUNDLE.replace(/\.mjs$/, ".css")]) {
    try { rmSync(f); } catch { /* already gone */ }
  }
});

async function mount(props) {
  if (reactRoot) { await act(async () => reactRoot.unmount()); reactRoot = null; }
  root.innerHTML = "";
  await act(async () => {
    reactRoot = createRoot(root);
    reactRoot.render(React.createElement(ManageCatalogDrawer, props));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
}

const q = (sel) => root.querySelector(sel);
const clickEl = async (el) => { await act(async () => el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true }))); };

// ── 25 — opens over the marketplace, no route change ───────────────────────────────────────

test("the drawer is closed until asked, then opens over the page as a dialog", async () => {
  await mount({ open: false, onClose() {}, client: clientStub() });
  assert.equal(q('[data-testid="manage-catalog-drawer"]'), null, "nothing renders while closed");

  await mount({ open: true, onClose() {}, client: clientStub() });
  const drawer = q('[data-testid="manage-catalog-drawer"]');
  assert.ok(drawer, "the drawer renders when open");
  assert.equal(drawer.getAttribute("role"), "dialog");
  assert.equal(getComputedStyle(drawer).position, "fixed", "it overlays the page rather than replacing it");
  assert.equal(dom.window.location.pathname, "/dashboard/gifts", "the route must not change");
});

// ── 26 — the four sections ─────────────────────────────────────────────────────────────────

test("Draft, Published, Retired and Providers are all reachable", async () => {
  const client = clientStub();
  await mount({ open: true, onClose() {}, client });
  const labels = [...root.querySelectorAll("nav button")].map((b) => b.textContent.trim());
  assert.deepEqual(labels, ["Draft", "Published", "Retired", "Providers"]);
  const pressed = [...root.querySelectorAll("nav button")].filter((b) => b.getAttribute("aria-pressed") === "true");
  assert.equal(pressed.length, 1);
  assert.equal(pressed[0].textContent.trim(), "Draft", "the drawer opens on Draft");
});

// ── 27/28 — dormant providers: disabled, explained, never requested ────────────────────────

test("dormant providers are disabled, labelled and list their blockers", async () => {
  const client = clientStub();
  await mount({ open: true, onClose() {}, client });
  await clickEl([...root.querySelectorAll("nav button")].find((b) => b.textContent.trim() === "Providers"));

  assert.ok(q('[data-testid="provider-list"]'), "the provider section renders");
  for (const id of ["florist_one", "goody"]) {
    const card = q(`[data-testid="provider-${id}"]`);
    assert.ok(card, `${id} must be visible`);
    assert.match(card.textContent, /Dormant — not activated/);
    assert.match(card.textContent, /only after it is separately authorized and activated/);
    const browse = q(`[data-testid="browse-${id}"]`);
    assert.equal(browse.disabled, true, `${id} browse must be disabled`);
  }
  const blockers = q('[data-testid="blockers-florist_one"]');
  assert.ok(blockers, "launch blockers must be shown");
  assert.match(blockers.textContent, /no_order_status_mechanism/);
});

test("NO request is made for a dormant provider, and no empty-product message is shown", async () => {
  const client = clientStub();
  await mount({ open: true, onClose() {}, client });
  await clickEl([...root.querySelectorAll("nav button")].find((b) => b.textContent.trim() === "Providers"));

  // Click the disabled control anyway — a disabled button must not fire, and even if it did the
  // guard refuses before reaching the client.
  await clickEl(q('[data-testid="browse-goody"]'));
  assert.equal(client.calls.browse, 0, "the vendor browse must never be requested while dormant");
  assert.ok(!/No products found|no results/i.test(root.textContent), "must not imply a vendor was asked");
});

// ── 29/30/31/32 — category assignment ──────────────────────────────────────────────────────

test("categories support multiple selections and cannot duplicate", async () => {
  const client = clientStub();
  await mount({ open: true, onClose() {}, client });

  await clickEl(q('[data-testid="cat-gm-goody-e1-tech"]'));
  assert.deepEqual(client.calls.patch[0].patch.greetMeCategories, ["tech"]);

  // The component re-renders from the server's response, so a second, different category adds.
  await mount({ open: true, onClose() {}, client: { ...client, listItems: async () => ({ items: [ITEM({ curation: { ...ITEM().curation, greetMeCategories: ["tech"] } })] }) } });
  const c2 = clientStub({ listItems: async () => ({ items: [ITEM({ curation: { ...ITEM().curation, greetMeCategories: ["tech"] } })] }) });
  await mount({ open: true, onClose() {}, client: c2 });
  await clickEl(q('[data-testid="cat-gm-goody-e1-americana"]'));
  assert.deepEqual(c2.calls.patch[0].patch.greetMeCategories, ["tech", "americana"]);

  // Toggling an already-selected id REMOVES it — it can never be sent twice.
  const c3 = clientStub({ listItems: async () => ({ items: [ITEM({ curation: { ...ITEM().curation, greetMeCategories: ["tech"] } })] }) });
  await mount({ open: true, onClose() {}, client: c3 });
  await clickEl(q('[data-testid="cat-gm-goody-e1-tech"]'));
  assert.deepEqual(c3.calls.patch[0].patch.greetMeCategories, [], "toggling off removes, never duplicates");
});

test("apparel is offered for storage; View All and Brandable Goods are not categories", async () => {
  await mount({ open: true, onClose() {}, client: clientStub() });
  assert.ok(q('[data-testid="cat-gm-goody-e1-apparel"]'), "apparel must be storable");
  assert.equal(q('[data-testid="cat-gm-goody-e1-view_all"]'), null, "View All is never a category");
  assert.equal(q('[data-testid="cat-gm-goody-e1-brandable_goods"]'), null, "Brandable Goods is never a category");
  // Brandable is reachable only as a boolean.
  assert.ok(q('[data-testid="brandable-gm-goody-e1"]'), "brandable must be a checkbox");
});

test("Brandable Goods is sent as a boolean, not a category", async () => {
  const client = clientStub();
  await mount({ open: true, onClose() {}, client });
  const box = q('[data-testid="brandable-gm-goody-e1"]');
  // React tracks a controlled input's value, so a bare assignment is ignored. Drive it through
  // the native setter the way React itself reads it.
  const setChecked = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, "checked").set;
  await act(async () => {
    setChecked.call(box, true);
    box.dispatchEvent(new dom.window.Event("click", { bubbles: true }));
    box.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  assert.deepEqual(client.calls.patch[0].patch, { brandable: true });
});

// ── 33 — lifecycle controls reflect server state ───────────────────────────────────────────

test("lifecycle controls follow the record's server-reported state", async () => {
  const draft = clientStub();
  await mount({ open: true, onClose() {}, client: draft });
  assert.ok(q('[data-testid="publish-gm-goody-e1"]'), "a draft offers Publish");
  assert.ok(q('[data-testid="retire-gm-goody-e1"]'), "a draft offers Retire");
  assert.equal(q('[data-testid="unpublish-gm-goody-e1"]'), null);
  assert.equal(q('[data-testid="reactivate-gm-goody-e1"]'), null);

  const live = clientStub({ listItems: async () => ({ items: [ITEM({ lifecycle: { ...ITEM().lifecycle, displayEnabled: true, state: "available" } })] }) });
  await mount({ open: true, onClose() {}, client: live });
  assert.ok(q('[data-testid="unpublish-gm-goody-e1"]'), "a published record offers Unpublish");
  assert.equal(q('[data-testid="publish-gm-goody-e1"]'), null);

  const retired = clientStub({ listItems: async () => ({ items: [ITEM({ lifecycle: { ...ITEM().lifecycle, state: "retired" } })] }) });
  await mount({ open: true, onClose() {}, client: retired });
  assert.ok(q('[data-testid="reactivate-gm-goody-e1"]'), "a retired record offers Reactivate");
  assert.equal(q('[data-testid="publish-gm-goody-e1"]'), null, "a retired record is not published directly");
});

test("a blocked publication shows the server's reason without changing the record", async () => {
  const client = clientStub({
    lifecycle: async () => { const e = new Error("refused"); e.body = { error: "SOURCE_NOT_FULFILLABLE" }; throw e; },
  });
  await mount({ open: true, onClose() {}, client });
  await clickEl(q('[data-testid="publish-gm-goody-e1"]'));
  const notice = q('[data-testid="drawer-notice"]');
  assert.ok(notice, "a refusal must be explained");
  assert.match(notice.textContent, /no active checkout or fulfilment path/);
});

// ── 34 — ETag conflict ─────────────────────────────────────────────────────────────────────

test("an ETag conflict produces a clear, non-destructive message", async () => {
  const client = clientStub({
    patchItem: async () => { const e = new Error("conflict"); e.status = 409; throw e; },
  });
  await mount({ open: true, onClose() {}, client });
  await clickEl(q('[data-testid="cat-gm-goody-e1-tech"]'));
  const notice = q('[data-testid="drawer-notice"]');
  assert.ok(notice, "a conflict must be surfaced");
  assert.match(notice.textContent, /changed since you opened it/);
  assert.match(notice.textContent, /nothing was overwritten/);
});

// ── internal identity is labelled, vendor facts are read-only ──────────────────────────────

test("internal identity is shown and clearly marked; vendor facts are read-only text", async () => {
  await mount({ open: true, onClose() {}, client: clientStub() });
  const card = q('[data-testid="item-gm-goody-e1"]');
  assert.match(card.textContent, /Internal · goody \/ goody \/ e1/);
  assert.match(card.textContent, /Vendor price \$25\.00/);
  assert.match(card.textContent, /available/);
  assert.match(card.textContent, /synced/);
  // The vendor price is not an input — it cannot be edited from here.
  const inputs = [...card.querySelectorAll("input")].map((i) => i.getAttribute("data-testid"));
  assert.ok(!inputs.includes("price-gm-goody-e1"), "there must be no price editor");
});
