// src/components/founderCatalog/prezzeeManagementTileAndRecovery.browser.test.mjs
//
// PREZZEE MANAGEMENT TILE AND RECOVERY CONTRACT (Team C, 2026-09-25).
//
// Part 1 — the Manage Catalog tile for the curated Prezzee Smart Card shows the founder-approved
// display name ("Greet-Me Gold Smart Card"), the founder-supplied artwork, and no price
// descriptor. Every other provider's tile is unaffected — proven by mounting a Florist One tile
// alongside a Prezzee tile in the SAME grid and asserting only the Prezzee one changed.
//
// Part 2 — the trash-can lifecycle: unpublish is never a delete, the record survives (fake data
// only, the LIVE trash can is never clicked), and re-adding the Smart Card through Prezzee's own
// Add Products picker safely REPUBLISHES that existing record instead of failing on the backend's
// duplicate-id refusal (a real Cosmos `container.items.create()` 409 "already_exists", since the
// catalog record id is deterministic — see AddToCatalogPicker.jsx's republishExistingPrezzee()).
//
// Both surfaces are the REAL, merged components (esbuild-bundled), mounted with a fake client —
// no real backend call is made anywhere in this file.
//
// Run (Node 20.x): node --test src/components/founderCatalog/prezzeeManagementTileAndRecovery.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__pmtr.entry.jsx");
const BUNDLE = join(__dirname, ".__pmtr.bundle.mjs");

let React, createRoot, act, ManageCatalogModal, AddToCatalogPicker, dom;

const PREZZEE_EXTERNAL_ID = "GREETMEL_GREETME_BRANDED_CARD_2";
const PREZZEE_DOC_ID = "gm-prezzee-GREETMEL_GREETME_BRANDED_CARD_2";

const PREZZEE_ITEM = (overrides = {}) => ({
  id: PREZZEE_DOC_ID,
  internal: { source: "prezzee", vendor: "prezzee", externalProductId: PREZZEE_EXTERNAL_ID },
  vendorAuthoritative: { title: "Greet-Me Smart eGift Card", images: ["https://cdn.prezzee.com/card.jpg"], priceCents: 1000, currency: "USD", variants: [] },
  curation: { greetMeCategories: ["gift_cards"], brandable: false, featuredRank: null },
  lifecycle: { state: "available", displayEnabled: true },
  display: { title: "Greet-Me Smart eGift Card" },
  etag: "etag-prezzee-1",
  ...overrides,
});

const FLORIST_ITEM = (overrides = {}) => ({
  id: "florist_one:p1",
  internal: { source: "florist_one", vendor: "florist_one", externalProductId: "p1" },
  vendorAuthoritative: { title: "Pink Roses", images: ["https://cdn.test/p1.jpg"], priceCents: 7995, currency: "USD", variants: [] },
  curation: { greetMeCategories: [], brandable: false, featuredRank: null },
  lifecycle: { state: "available", displayEnabled: true },
  display: { title: "Pink Roses" },
  etag: "etag-florist-1",
  ...overrides,
});

function fakeModalClient(overrides = {}) {
  const calls = { listItems: [], lifecycle: [], listProviders: [] };
  const base = {
    listItems: async (args) => { calls.listItems.push(args); return { ok: true, items: [PREZZEE_ITEM(), FLORIST_ITEM()] }; },
    listProviders: async () => { calls.listProviders.push([]); return { ok: true, providers: [
      { providerId: "florist_one", label: "Florist One", enabled: true, browseAvailable: true },
      { providerId: "goody", label: "Goody", enabled: true, browseAvailable: true },
      { providerId: "prezzee", label: "Prezzee", enabled: true, browseAvailable: false },
    ] }; },
    lifecycle: async (vendor, id, action, etag) => { calls.lifecycle.push([vendor, id, action, etag]); return { ok: true, item: PREZZEE_ITEM({ id }) }; },
    patchItem: async () => ({ ok: false, error: "not used in this test" }),
    refreshItem: async () => ({ ok: true, item: PREZZEE_ITEM() }),
  };
  return { ...base, ...overrides, calls };
}

function fakePickerClient(overrides = {}) {
  const calls = { addFromProvider: [], listItems: [], lifecycle: [] };
  const base = {
    addFromProvider: async (args) => { calls.addFromProvider.push(args); return { ok: true, item: PREZZEE_ITEM() }; },
    listItems: async (args) => { calls.listItems.push(args); return { ok: true, items: [] }; },
    lifecycle: async (vendor, id, action, etag) => { calls.lifecycle.push([vendor, id, action, etag]); return { ok: true, item: PREZZEE_ITEM({ id }) }; },
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

async function mountCatalogExpanded(client) {
  const s = await mount(React.createElement(ManageCatalogModal, { open: true, onClose: () => {}, client }));
  await flush();
  await click(s.tid("full-catalog-toggle"));
  await flush();
  return s;
}

async function mountPrezzeePicker(client, onPublished = () => {}) {
  const s = await mount(React.createElement(AddToCatalogPicker, {
    client, lockedProviderId: "prezzee", onClose: () => {}, onPublished,
  }));
  await flush();
  return s;
}

// ── Part 1: management tile display ─────────────────────────────────────────────────────────

test("the Prezzee tile shows the founder-approved name 'Greet-Me Gold Smart Card'", async () => {
  const s = await mountCatalogExpanded(fakeModalClient());
  assert.match(s.tid(`catalog-tile-${PREZZEE_DOC_ID}`).textContent, /Greet-Me Gold Smart Card/);
});

test("the Prezzee tile does NOT show a price descriptor, while another provider's tile still does", async () => {
  const s = await mountCatalogExpanded(fakeModalClient());
  assert.ok(!s.tid(`tile-price-${PREZZEE_DOC_ID}`), "no price element may render on the Prezzee tile");
  assert.doesNotMatch(s.tid(`catalog-tile-${PREZZEE_DOC_ID}`).textContent, /\$10\.00/, "the $10.00 descriptor must be gone");
  assert.ok(s.tid("tile-price-florist_one:p1"), "Florist One's tile must still show its price");
  assert.match(s.tid("catalog-tile-florist_one:p1").textContent, /\$79\.95/);
});

test("the Prezzee tile renders the founder-supplied Smart Card artwork, not the vendor's own image", async () => {
  const s = await mountCatalogExpanded(fakeModalClient());
  const img = s.q(`[data-testid="catalog-tile-${PREZZEE_DOC_ID}"] img`);
  assert.ok(img, "the tile must render an image");
  assert.doesNotMatch(img.getAttribute("src") || "", /cdn\.prezzee\.com/, "must not use the vendor-reported image");
  assert.match(img.getAttribute("src") || "", /^data:image\/png/, "must use the imported founder artwork (bundled as a data URL in this test harness)");
});

test("Florist One's tile is completely unaffected — its own title, price and image are untouched", async () => {
  const s = await mountCatalogExpanded(fakeModalClient());
  const tile = s.tid("catalog-tile-florist_one:p1");
  assert.match(tile.textContent, /Pink Roses/);
  assert.match(tile.textContent, /\$79\.95/);
  const img = s.q('[data-testid="catalog-tile-florist_one:p1"] img');
  assert.equal(img.getAttribute("src"), "https://cdn.test/p1.jpg");
});

// ── Part 2: trash-can lifecycle (unpublish, never delete) ──────────────────────────────────────
// The LIVE trash can is never clicked anywhere in this session — every click below is against a
// fake, in-test client with no network access at all.

test("trashing the Prezzee tile requires confirmation, then calls lifecycle 'unpublish' — never a delete — and only removes the tile after success", async () => {
  const client = fakeModalClient();
  const s = await mountCatalogExpanded(client);
  await click(s.tid(`trash-${PREZZEE_DOC_ID}`));
  await flush();
  assert.equal(client.calls.lifecycle.length, 0, "no removal call before confirmation");
  assert.match(s.text(), /Remove this product from your site\?/);
  await click(s.tid(`confirm-remove-yes-${PREZZEE_DOC_ID}`));
  await flush();
  assert.equal(client.calls.lifecycle.length, 1);
  assert.equal(client.calls.lifecycle[0][2], "unpublish", "must be unpublish, never delete");
  assert.ok(!s.tid(`catalog-tile-${PREZZEE_DOC_ID}`), "the tile is gone from THIS VIEW, but the record itself is not deleted");
});

// ── Part 2: re-adding through Prezzee -> Add Products must republish safely ───────────────────

test("the picker's Prezzee fixed item is present and selectable, independent of any prior publish state (nothing gates it out)", async () => {
  const s = await mountPrezzeePicker(fakePickerClient());
  assert.ok(s.tid("prezzee-fixed-item"), "the Smart Card selection must be offered whether or not it was previously unpublished");
  assert.equal(s.tid("prezzee-fixed-checkbox").checked, false);
});

test("first-time add is unaffected: addFromProvider succeeds, then lifecycle('publish') is called normally", async () => {
  const client = fakePickerClient();
  const s = await mountPrezzeePicker(client);
  await click(s.tid("prezzee-fixed-checkbox"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.addFromProvider.length, 1);
  assert.deepEqual(client.calls.addFromProvider[0], { providerId: "prezzee", externalProductId: PREZZEE_EXTERNAL_ID });
  assert.equal(client.calls.lifecycle.length, 1);
  assert.equal(client.calls.lifecycle[0][2], "publish");
  assert.equal(client.calls.listItems.length, 0, "the recovery lookup must not run when there was no conflict");
  assert.match(s.text(), /Published/);
});

test("re-adding an unpublished Smart Card (addFromProvider throws 409 already_exists) republishes the EXISTING record instead of failing", async () => {
  const client = fakePickerClient({
    addFromProvider: async (args) => {
      client.calls.addFromProvider.push(args);
      const err = new Error("already_exists");
      err.status = 409;
      throw err;
    },
    listItems: async (args) => {
      client.calls.listItems.push(args);
      assert.equal(args.source, "prezzee");
      assert.equal(args.state, "all", "the lookup must include non-published (draft/unpublished) records");
      return { ok: true, items: [PREZZEE_ITEM({ lifecycle: { state: "draft", displayEnabled: false } })] };
    },
  });
  const s = await mountPrezzeePicker(client);
  await click(s.tid("prezzee-fixed-checkbox"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.addFromProvider.length, 1, "exactly one create attempt — no duplicate created, no retry loop");
  assert.equal(client.calls.listItems.length, 1, "the existing record must be looked up by its externalProductId");
  assert.equal(client.calls.lifecycle.length, 1);
  assert.deepEqual(client.calls.lifecycle[0], ["prezzee", PREZZEE_DOC_ID, "publish", "etag-prezzee-1"], "must publish the SAME existing record — id and etag from the found item, not a freshly created one");
  assert.match(s.text(), /Published/, "the founder must see success, never the raw already_exists error");
  assert.doesNotMatch(s.text(), /already_exists/i);
});

test("re-adding when the response is a resolved {ok:false, error:'already_exists'} (not a thrown error) is handled the same way", async () => {
  const client = fakePickerClient({
    addFromProvider: async (args) => { client.calls.addFromProvider.push(args); return { ok: false, error: "already_exists" }; },
    listItems: async (args) => { client.calls.listItems.push(args); return { ok: true, items: [PREZZEE_ITEM()] }; },
  });
  const s = await mountPrezzeePicker(client);
  await click(s.tid("prezzee-fixed-checkbox"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.listItems.length, 1);
  assert.equal(client.calls.lifecycle.length, 1);
  assert.equal(client.calls.lifecycle[0][2], "publish");
  assert.match(s.text(), /Published/);
});

test("a genuinely unrelated addFromProvider failure (not already_exists) is surfaced truthfully, not silently swallowed as success", async () => {
  const client = fakePickerClient({
    addFromProvider: async () => { const err = new Error("provider_unreachable"); err.status = 503; throw err; },
  });
  const s = await mountPrezzeePicker(client);
  await click(s.tid("prezzee-fixed-checkbox"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.listItems.length, 0, "the recovery path must only trigger for already_exists, not any other failure");
  assert.match(s.text(), /provider_unreachable/);
});

test("if the recovery lookup cannot find the record at all, the founder sees a truthful failure, never a false success", async () => {
  const client = fakePickerClient({
    addFromProvider: async () => { const err = new Error("already_exists"); err.status = 409; throw err; },
    listItems: async () => ({ ok: true, items: [] }),
  });
  const s = await mountPrezzeePicker(client);
  await click(s.tid("prezzee-fixed-checkbox"));
  await click(s.tid("publish-selected-button"));
  await flush();
  assert.equal(client.calls.lifecycle.length, 0, "must not attempt to publish a record it never found");
  assert.doesNotMatch(s.text(), /Published/);
});

// ── No product is published or created merely by this correction's own testing ─────────────────

test("selecting the Smart Card alone never calls addFromProvider or lifecycle", async () => {
  const client = fakePickerClient();
  const s = await mountPrezzeePicker(client);
  await click(s.tid("prezzee-fixed-checkbox"));
  await flush();
  assert.equal(client.calls.addFromProvider.length, 0);
  assert.equal(client.calls.lifecycle.length, 0);
});
