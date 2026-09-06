// src/pages/merchFounderDrawer.test.mjs — CHECKPOINT 2.
//
// The founder entry point on /dashboard/gifts, and the guarantees that the customer marketplace
// underneath it did not move. Structural claims are asserted against source, the established
// pattern for JSX in this repo; the drawer's behaviour is proven separately in
// components/founderCatalog/manageCatalogDrawer.browser.test.mjs.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { SECTIONS, STORABLE_CATEGORY_IDS, toggleCategoryId } from "../components/founderCatalog/catalogDrawerModel.js";
import { SELECTOR_ROW, DEFAULT_SELECTION, BRANDABLE } from "./merchSelection.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (p) => readFileSync(join(HERE, p), "utf8").replace(/\r\n/g, "\n");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");

const MERCH = read("Merch.jsx");
const MERCH_CODE = stripComments(MERCH);
const DRAWER = read("../components/founderCatalog/ManageCatalogDrawer.jsx");
const DRAWER_CODE = stripComments(DRAWER);
const CLIENT = read("../api/founderCatalog.js");
const CLIENT_CODE = stripComments(CLIENT);

// ── 24 — founder-only visibility ───────────────────────────────────────────────────────────

test("the Manage Catalog control renders only for a founder", () => {
  assert.match(MERCH_CODE, /const founder = isFounder\(user\)/, "founder status comes from the shared helper");
  assert.match(MERCH_CODE, /\{founder && \(/, "the control is gated on it");
  assert.match(MERCH, /data-testid="manage-catalog-button"/);
  // The drawer itself is mounted behind the same gate.
  assert.match(MERCH_CODE, /\{founder && \(\s*<ManageCatalogDrawer/);
});

test("frontend founder visibility is cosmetic and says so", () => {
  // The backend is the authorization. If this comment ever disappears, the intent is being lost.
  assert.match(MERCH, /Visibility is cosmetic/i);
  assert.match(CLIENT, /cosmetic/i);
  assert.match(CLIENT, /403/, "the client documents that the server refuses a non-founder");
});

// ── 25 — no new route ──────────────────────────────────────────────────────────────────────

test("the drawer introduces no route and no second page", () => {
  for (const token of ["<Route", "useNavigate(", "createBrowserRouter", "window.location.href"]) {
    assert.ok(!DRAWER_CODE.includes(token), `the drawer must not contain "${token}"`);
  }
  assert.match(DRAWER_CODE, /position: 'fixed'/, "it overlays the existing page");
});

// ── 26 — sections ──────────────────────────────────────────────────────────────────────────

test("the drawer offers exactly Draft, Published, Retired, Providers and Merch", () => {
  // Merch (Printful) is a live supplier with its own cart, checkout and fulfilment, so it is its
  // own section rather than a third entry in Providers — that list is the two-provider registry,
  // and listing a shipping supplier there would both break its boot invariant and describe it as
  // dormant. The list stays closed: any other new section still fails this assertion.
  assert.deepEqual(SECTIONS.map((s) => s.label),
    ["Draft", "Published", "Retired", "Providers", "Merch (Printful)"]);
});

// ── 30/31/32 — category vocabulary in the drawer ───────────────────────────────────────────

test("the drawer stores the seven approved categories, and neither View All nor Brandable", () => {
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

// ── 35/36 — no admin key, no vendor from the browser ───────────────────────────────────────

test("no admin key or secret exists anywhere in the founder frontend surface", () => {
  for (const [name, code] of [["Merch.jsx", MERCH_CODE], ["drawer", DRAWER_CODE], ["client", CLIENT_CODE]]) {
    for (const banned of ["x-admin-key", "admin-key", "adminKey", "ADMIN_KEY", "apiKey", "secret"]) {
      assert.ok(!code.includes(banned), `"${banned}" must not appear in ${name}`);
    }
  }
});

test("the founder surface stores nothing in browser storage", () => {
  for (const [name, code] of [["drawer", DRAWER_CODE], ["client", CLIENT_CODE]]) {
    for (const banned of ["localStorage", "sessionStorage", "indexedDB", "document.cookie"]) {
      assert.ok(!code.includes(banned), `${name} must not use ${banned}`);
    }
  }
});

test("no vendor is contacted from the browser — every call goes to the Greet-Me backend", () => {
  // The client's only transport is the existing api client.
  assert.match(CLIENT_CODE, /import api from '\.\/api'/);
  assert.ok(!CLIENT_CODE.includes("fetch("), "the client must not open its own transport");
  for (const vendor of ["printful.com", "goody.com", "floristone", "prezzee", "myshopify", "shopify"]) {
    assert.ok(!CLIENT_CODE.toLowerCase().includes(vendor), `"${vendor}" must not be reachable from the browser`);
    assert.ok(!DRAWER_CODE.toLowerCase().includes(vendor), `"${vendor}" must not appear in the drawer`);
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
  assert.equal((MERCH_CODE.match(/\.map\(\(item\) => \{/g) || []).length, 1);
  assert.equal((MERCH.match(/handleAddToCart\(item, e\)/g) || []).length, 1);
  assert.match(MERCH, /\{visibleProducts\.map\(\(item\) => \{/);
});

test("the price filter and its pipeline are untouched", () => {
  assert.match(MERCH_CODE, /selectProducts\(products, selectedCategory\)/);
  assert.match(MERCH_CODE, /filterByPrice\(selectedProducts, minCents, maxCents\)/);
  assert.match(MERCH_CODE, /priceBounds\(products\)/);
  assert.match(MERCH, /No products in this price range\./);
});

test("Gift Cards, Coming Soon, cart and both return flows are unchanged", () => {
  assert.match(MERCH, /Greet-Me Smart eGift Card/);
  assert.match(MERCH, /Coming later — not yet available/);
  assert.match(MERCH, /Coming Soon/);
  assert.equal((MERCH.match(/cartService\.addItem\(/g) || []).length, 1);
  assert.match(MERCH, /navigate\('\/dashboard\/send\?returnTo=send&giftType=merch'\)/);
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

test("occasion filtering is absent from the customer marketplace and the drawer", () => {
  for (const [name, code] of [["Merch.jsx", MERCH_CODE], ["drawer", DRAWER_CODE], ["client", CLIENT_CODE]]) {
    for (const banned of ["occasion", "Occasion"]) {
      assert.ok(!code.includes(banned), `"${banned}" must stay absent from ${name}`);
    }
  }
});

test("logo upload and preview remain absent", () => {
  for (const [name, code] of [["Merch.jsx", MERCH_CODE], ["drawer", DRAWER_CODE], ["client", CLIENT_CODE]]) {
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
