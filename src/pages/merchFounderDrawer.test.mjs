// src/pages/merchFounderDrawer.test.mjs — CHECKPOINT 2, UPDATED 2026-09-23 (Team C, Unified
// Manage Catalog redesign).
//
// The founder entry point on /dashboard/gifts, and the guarantees that the customer marketplace
// underneath it did not move. Structural claims are asserted against source, the established
// pattern for JSX in this repo.
//
// ManageCatalogDrawer.jsx (Draft/Published/Retired tabs, a founder-visible unpublished holding
// area) is REPLACED by ManageCatalogModal.jsx per the founder-approved redesign — this file now
// scans the new modal, AddToCatalogPicker.jsx and ProvidersStatusView.jsx wherever the old tests
// scanned the drawer. Every safety invariant the old drawer had to hold, the new modal must hold
// too; only the section/tab structure itself (deliberately removed) no longer applies.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { STORABLE_CATEGORY_IDS } from "../components/founderCatalog/catalogDrawerModel.js";
import { SELECTOR_ROW, DEFAULT_SELECTION, BRANDABLE } from "./merchSelection.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(HERE, p), "utf8").replace(/\r\n/g, "\n");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");

const MERCH = read("Merch.jsx");
const MERCH_CODE = stripComments(MERCH);
const MODAL = read("../components/founderCatalog/ManageCatalogModal.jsx");
const MODAL_CODE = stripComments(MODAL);
const PICKER = read("../components/founderCatalog/AddToCatalogPicker.jsx");
const PICKER_CODE = stripComments(PICKER);
const PROVIDERS_VIEW = read("../components/founderCatalog/ProvidersStatusView.jsx");
const PROVIDERS_VIEW_CODE = stripComments(PROVIDERS_VIEW);
const CLIENT = read("../api/founderCatalog.js");
const CLIENT_CODE = stripComments(CLIENT);

// ── 24 — founder-only visibility ───────────────────────────────────────────────────────────

test("the Manage Catalog control renders only for a founder", () => {
  assert.match(MERCH_CODE, /const founder = isFounder\(user\)/, "founder status comes from the shared helper");
  assert.match(MERCH_CODE, /\{founder && \(/, "the control is gated on it");
  assert.match(MERCH, /data-testid="manage-catalog-button"/);
  // The modal itself is mounted behind the same gate.
  assert.match(MERCH_CODE, /\{founder && \(\s*<ManageCatalogModal/);
});

test("frontend founder visibility is cosmetic and says so", () => {
  // The backend is the authorization. If this comment ever disappears, the intent is being lost.
  assert.match(MERCH, /Visibility is cosmetic/i);
  assert.match(CLIENT, /cosmetic/i);
  assert.match(CLIENT, /403/, "the client documents that the server refuses a non-founder");
});

// ── 25 — no new route ──────────────────────────────────────────────────────────────────────

test("the modal introduces no route and no second page", () => {
  for (const token of ["<Route", "useNavigate(", "createBrowserRouter", "window.location.href"]) {
    assert.ok(!MODAL_CODE.includes(token), `the modal must not contain "${token}"`);
  }
  assert.match(MODAL_CODE, /position: 'fixed'/, "it overlays the existing page");
});

// ── 26 — NO Draft/Unpublished/Retired sections, per the approved redesign ──────────────────

test("the modal offers no Draft, Unpublished, or Retired tab or section — only currently-published products", () => {
  for (const banned of ["Draft", "Unpublished", "Retired", "'draft'", '"draft"', "state: 'retired'"]) {
    assert.ok(!MODAL_CODE.includes(banned), `the modal must not offer a "${banned}" section — only published products are shown`);
  }
  // The one state the modal's own catalog load ever requests.
  assert.match(MODAL_CODE, /state:\s*'published'/, "the catalog view must request only published records");
});

test("no publication-status badge (Published/Draft/Unpublished label) is rendered on a live tile — every tile shown is already live", () => {
  for (const banned of ["PUBLISHED", "lifecycleBadge"]) {
    assert.ok(!MODAL_CODE.includes(banned), `"${banned}" must not appear — a tile in this view is always published`);
  }
});

test("there is no separate Merch/Printful tab and no 'Add Goody Product' wording — Printful and Goody are providers inside the ONE unified Add to Catalog flow", () => {
  assert.ok(!MODAL_CODE.includes("Add Goody Product"));
  assert.ok(!PICKER_CODE.includes("Add Goody Product"));
  assert.doesNotMatch(MODAL_CODE, /Merch \(Printful\)/);
});

// ── 30/31/32 — category vocabulary is unchanged ────────────────────────────────────────────

test("the modal stores the seven approved categories, and neither View All nor Brandable", () => {
  assert.deepEqual([...STORABLE_CATEGORY_IDS].sort(), [
    "americana", "apparel", "faith_and_inspiration", "flowers", "gift_baskets", "gift_cards", "tech",
  ]);
  assert.ok(!STORABLE_CATEGORY_IDS.includes("view_all"));
  assert.ok(!STORABLE_CATEGORY_IDS.some((id) => /brandable/i.test(id)));
});

test("apparel is storable but has no customer selector", () => {
  assert.ok(STORABLE_CATEGORY_IDS.includes("apparel"));
  assert.ok(!SELECTOR_ROW.some((s) => s.id === "apparel"), "apparel must not appear in the customer row");
});

test("category controls use ONE consistent button treatment, never a mix of pills and checkboxes", () => {
  // Every category toggle in the tile's expanded management area is the SAME <button> element
  // driven by categoryButtonStyle() — never a <input type="checkbox"> for a category (Brandable
  // Goods/Apparel, if ever surfaced, would use the identical button treatment, not a checkbox).
  assert.match(MODAL_CODE, /categoryButtonStyle/, "a single, named style function must govern every category control");
  const categoryBlockStart = MODAL_CODE.indexOf("STORABLE_CATEGORY_IDS.map(");
  const categoryBlockEnd = MODAL_CODE.indexOf("Featured rank", categoryBlockStart);
  const block = MODAL_CODE.slice(categoryBlockStart, categoryBlockEnd);
  assert.match(block, /<button/, "categories render as buttons");
  assert.doesNotMatch(block, /type="checkbox"|type='checkbox'/, "categories must never render as checkboxes");
});

// ── 35/36 — no admin key, no vendor from the browser ───────────────────────────────────────

test("no admin key or secret exists anywhere in the founder frontend surface", () => {
  for (const [name, code] of [["Merch.jsx", MERCH_CODE], ["modal", MODAL_CODE], ["picker", PICKER_CODE], ["providersView", PROVIDERS_VIEW_CODE], ["client", CLIENT_CODE]]) {
    for (const banned of ["x-admin-key", "admin-key", "adminKey", "ADMIN_KEY", "apiKey", "secret"]) {
      assert.ok(!code.includes(banned), `"${banned}" must not appear in ${name}`);
    }
  }
});

test("the founder surface stores nothing in browser storage", () => {
  for (const [name, code] of [["modal", MODAL_CODE], ["picker", PICKER_CODE], ["providersView", PROVIDERS_VIEW_CODE], ["client", CLIENT_CODE]]) {
    for (const banned of ["localStorage", "sessionStorage", "indexedDB", "document.cookie"]) {
      assert.ok(!code.includes(banned), `${name} must not use ${banned}`);
    }
  }
});

test("no vendor is contacted from the browser — every call goes to the Greet-Me backend", () => {
  // The client's only transport is the existing api client.
  assert.match(CLIENT_CODE, /import api from '\.\/api'/);
  assert.ok(!CLIENT_CODE.includes("fetch("), "the client must not open its own transport");
  // NO VENDOR DOMAIN, anywhere — this is the invariant that actually matters (a hardcoded vendor
  // domain would mean a direct-to-vendor browser call bypassing the backend entirely).
  for (const [name, code] of [["Merch.jsx", MERCH_CODE], ["modal", MODAL_CODE], ["picker", PICKER_CODE], ["providersView", PROVIDERS_VIEW_CODE], ["client", CLIENT_CODE]]) {
    for (const vendorDomain of ["printful.com", "goody.com", "floristone.com", "prezzee.com", "myshopify", "shopify"]) {
      assert.ok(!code.toLowerCase().includes(vendorDomain), `"${vendorDomain}" must not appear in ${name}`);
    }
  }
  // The stricter "no bare vendor NAME at all" rule (not just domains) applies only to the
  // generic transport client, exactly as it always did (the original check never scanned
  // Merch.jsx for this — it legitimately carries real Printful merch-cart fields like
  // `printfulSyncProductId`, unrelated to founder-catalog vendor neutrality). The founder-only
  // admin vocabulary files (AddToCatalogPicker.jsx, ManageCatalogModal.jsx's provider filter,
  // ProvidersStatusView.jsx) must legitimately be able to NAME a provider for their own UI (a
  // filter option, a provider tab) — exactly like catalogDrawerModel.js's own pre-existing
  // LAUNCH_PRODUCT_SOURCES = ['goody', 'prezzee'], and exactly like the old drawer's own
  // "Add Goody Product" always could.
  for (const vendor of ["floristone", "prezzee", "printful", "goody"]) {
    assert.ok(!CLIENT_CODE.toLowerCase().includes(vendor), `"${vendor}" must not appear in the transport client`);
  }
  // Every path is under the founder namespace on our own API.
  assert.match(CLIENT_CODE, /const BASE = '\/api\/founder\/catalog'/);
});

test("the client offers no delete, import, bulk or sync method", () => {
  for (const banned of ["delete", "import", "bulk", "syncAll", "sync-all", "importAll"]) {
    assert.ok(!new RegExp(`\\b${banned}\\w*\\s*:`, "i").test(CLIENT_CODE), `"${banned}" method is forbidden`);
  }
  assert.ok(!/method: 'DELETE'/i.test(CLIENT_CODE));
});

test("no NEW bulk backend endpoint was added for multi-select publish — Publish Selected calls the existing single-item endpoints sequentially", () => {
  // The picker's own publish-one helper must call addFromProvider/lifecycle/stageMerch — all
  // pre-existing single-item client methods — never a hand-rolled batch/bulk request.
  assert.match(PICKER_CODE, /client\.addFromProvider\(/);
  assert.match(PICKER_CODE, /client\.lifecycle\(/);
  assert.match(PICKER_CODE, /client\.stageMerch\(/);
  assert.doesNotMatch(PICKER_CODE, /\/items\/bulk|\/publish-selected|\/items\/batch/, "no new bulk-shaped endpoint path may exist");
});

// ── 37/38/39/40 — the customer marketplace did not move ────────────────────────────────────

test("the unified selector order and Brandable default are unchanged", () => {
  assert.deepEqual(SELECTOR_ROW.map((s) => s.label), [
    "Brandable Goods", "Gift Cards", "Gift Baskets", "Flowers",
    "Americana", "Faith & Inspiration", "Tech", "View All",
  ]);
  assert.equal(DEFAULT_SELECTION, BRANDABLE);
  assert.match(MERCH_CODE, /useState\(DEFAULT_SELECTION\)/);
});

test("there is still exactly ONE shared product grid and one add-to-cart path", () => {
  // The page no longer holds a card map at all: one shared grid component renders every
  // category, Flowers included, so "one product surface" is proven by the ABSENCE of any
  // hand-written map plus exactly one grid element. The founder modal is untouched by that.
  assert.equal((MERCH_CODE.match(/\.map\(\(item\) => \{/g) || []).length, 0, "no hand-written card map");
  assert.equal((MERCH_CODE.match(/<GiftProductGrid/g) || []).length, 1, "exactly one grid");
  assert.equal((MERCH_CODE.match(/onAction=\{handleGiftCardAction\}/g) || []).length, 1);
  assert.equal((MERCH.match(/cartService\.addItem\(/g) || []).length, 1, "one add-to-cart path");
});

test("the price filter and its pipeline are untouched", () => {
  assert.match(MERCH_CODE, /selectProducts\(products, selectedCategory\)/);
  assert.match(MERCH_CODE, /const gridSource = providerGiftType \? pricedProviderProducts : selectedProducts/);
  assert.match(MERCH_CODE, /filterByPrice\(gridSource, minCents, maxCents\)/);
  assert.match(MERCH_CODE, /const boundsSource = providerGiftType \? pricedProviderProducts : products/);
  assert.match(MERCH_CODE, /priceBounds\(boundsSource\)/);
  assert.match(MERCH, /No products in this price range\./);
});

test("Gift Cards, Coming Soon, cart and both return flows are unchanged", () => {
  assert.match(MERCH, /Greet-Me Smart eGift Card/);
  assert.match(MERCH, /Coming later — not yet available/);
  assert.match(MERCH, /Coming Soon/);
  assert.equal((MERCH.match(/cartService\.addItem\(/g) || []).length, 1);
  assert.match(MERCH, /navigate\(`\/dashboard\/send\?returnTo=send&giftType=\$\{giftType\}`\)/);
  assert.match(MERCH, /=== 'flowers' \? 'flowers' : 'merch'/);
  assert.match(MERCH, /searchParams\.get\('returnRecipientId'\)/);
  assert.match(MERCH, /sendContext: 'greeting-flow'/);
});

test("QR Cash is byte-identical to its deployed form", () => {
  const lines = MERCH.split("\n");
  const start = lines.findIndex((l) => l.includes("AGP-02 — QR Cash™ featured tile"));
  assert.ok(start > -1);
  let end = start;
  while (end < lines.length && lines[end] !== "      </div>") end += 1;
  const block = lines.slice(start, end + 1).join("\n") + "\n";
  assert.equal(block.split("\n").length - 1, 41);
  assert.equal(
    createHash("sha256").update(block, "utf8").digest("hex"),
    "d01223695e8c4563fd08fb2a9329b52d8a275341a85cf4e078ff673bdce9c76a",
    "the QR Cash tile changed — it must stay byte-identical"
  );
});

// ── 41/42 — deferred features stay absent ──────────────────────────────────────────────────

test("occasion filtering is absent from the customer marketplace and the founder surface", () => {
  for (const [name, code] of [["Merch.jsx", MERCH_CODE], ["modal", MODAL_CODE], ["picker", PICKER_CODE], ["client", CLIENT_CODE]]) {
    for (const banned of ["occasion", "Occasion"]) {
      assert.ok(!code.includes(banned), `"${banned}" must stay absent from ${name}`);
    }
  }
});

test("logo upload and preview remain absent", () => {
  for (const [name, code] of [["Merch.jsx", MERCH_CODE], ["modal", MODAL_CODE], ["picker", PICKER_CODE], ["client", CLIENT_CODE]]) {
    for (const banned of ["logoPreview", "LogoPreview", "logoUpload", "FileReader", "createObjectURL"]) {
      assert.ok(!code.includes(banned), `"${banned}" must stay absent from ${name}`);
    }
  }
});

test("no Shopify customer interaction is restored", () => {
  for (const token of [
    "getGiftCatalog", "startGiftCheckout", "catalogProducts", "handleGiftCheckout",
    "checkoutBusyId", "GiftMarketFilters", "Shopify", "shopify", "maker_gifts", "Maker Gifts",
  ]) {
    assert.ok(!MERCH.includes(token), `"${token}" must not return to the marketplace page`);
  }
});
