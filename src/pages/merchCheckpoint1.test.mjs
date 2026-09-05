// src/pages/merchCheckpoint1.test.mjs — GIFTS CHECKPOINT 1 + UNIFIED SELECTOR CORRECTION
//
// Run: node --test src/pages/merchCheckpoint1.test.mjs
//
// What this file proves about /dashboard/gifts:
//   1. One unified selector row of exactly eight controls, in the approved order, with Brandable
//      Goods leading and selected by default.
//   2. Brandable Goods is a COLLECTION, not a stored category: it has a selector, but no product
//      ever carries its id and membership is the server's `brandable` boolean.
//   3. View All is a utility control, not a stored category. Apparel is a valid post-launch
//      category with no top-level control.
//   4. ONE shared product area: one grid, one add-to-cart handler, one product source, and no
//      product rendered twice.
//   5. The selection PARTITION is correct — Brandable Goods, Tech, View All and the deliberately
//      empty categories each resolve to exactly the right set.
//   6. QR Cash is unchanged and still renders above the selector row.
//   7. Maker Gifts, every customer-facing Shopify branch and any separate Merch tab are gone.
//   8. Gift Cards renders with no purchasing action of any kind.
//
// TWO KINDS OF ASSERTION, DELIBERATELY SPLIT
// ------------------------------------------
// The vocabulary and the selection rule live in src/pages/merchSelection.js, a plain module, so
// they are IMPORTED and exercised as real code — the partition in section 5 is proven by running
// it, not by matching a regular expression against a component. Merch.jsx is JSX and cannot be
// imported under `node --test`, so claims about what it RENDERS (one grid, QR Cash above the row,
// nothing duplicated) remain source-invariant, the established pattern in this repo for JSX.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  BRANDABLE,
  BRANDABLE_TAGLINE,
  DEFAULT_SELECTION,
  GREET_ME_CATEGORIES,
  POST_LAUNCH_CATEGORY_IDS,
  SELECTOR_ROW,
  VIEW_ALL,
  selectProducts,
  selectionLabel,
} from "./merchSelection.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "Merch.jsx"), "utf8").replace(/\r\n/g, "\n");

// Comments EXPLAIN what the page deliberately does not do — the dormant Gift Cards panel says in
// prose that it offers no denomination selector, no Add to Cart and no checkout action. Scanning
// raw source for those phrases would therefore fail on the documentation rather than on the
// behaviour. Every "must not offer X" assertion below runs against CODE with comments stripped.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");
const CODE = stripComments(SRC);

const CATEGORY_IDS = GREET_ME_CATEGORIES.map((c) => c.id);
const CATEGORY_LABELS = GREET_ME_CATEGORIES.map((c) => c.label);

// The dormant Gift Cards branch, isolated so "offers nothing purchasable" is asserted against
// that panel alone and cannot be satisfied by unrelated markup elsewhere on the page.
const GIFT_CARDS_BRANCH = (() => {
  const start = CODE.indexOf("selectedCategory === 'gift_cards'");
  const end = CODE.indexOf("visibleProducts.length === 0", start);
  assert.ok(start > -1 && end > start, "the dormant Gift Cards branch must exist and come first");
  return CODE.slice(start, end);
})();

// A fixture mirroring the SHAPE of the launch set: five Greet-Me-branded Printful products, of
// which the phone case and the laptop sleeve carry `tech`. It proves the PARTITION the selectors
// produce. Which products the server actually flags is server data and is not asserted here.
const FIXTURE = [
  { syncProductId: "p1", name: "Phone Case", brandable: true, greetMeCategories: ["tech"] },
  { syncProductId: "p2", name: "Laptop Sleeve", brandable: true, greetMeCategories: ["tech"] },
  { syncProductId: "p3", name: "Tumbler", brandable: true, greetMeCategories: [] },
  { syncProductId: "p4", name: "Tote", brandable: true, greetMeCategories: [] },
  { syncProductId: "p5", name: "Cap", brandable: true, greetMeCategories: [] },
];
const idsOf = (list) => list.map((p) => p.syncProductId);

// ============================================================
// 1 — The unified selector row
// ============================================================

test("exactly eight selectors, in the approved order", () => {
  assert.equal(SELECTOR_ROW.length, 8);
  assert.deepEqual(
    SELECTOR_ROW.map((s) => s.label),
    [
      "Brandable Goods",
      "Gift Cards",
      "Gift Baskets",
      "Flowers",
      "Americana",
      "Faith & Inspiration",
      "Tech",
      "View All",
    ]
  );
  assert.deepEqual(
    SELECTOR_ROW.map((s) => s.id),
    [
      "brandable_goods",
      "gift_cards",
      "gift_baskets",
      "flowers",
      "americana",
      "faith_and_inspiration",
      "tech",
      "view_all",
    ]
  );
  for (const s of SELECTOR_ROW) {
    assert.match(s.id, /^[a-z]+(_[a-z]+)*$/, `"${s.id}" must be a snake_case machine id`);
  }
});

test("Brandable Goods leads the row and is selected by default", () => {
  assert.equal(SELECTOR_ROW[0].id, BRANDABLE);
  assert.equal(DEFAULT_SELECTION, BRANDABLE);
  assert.match(SRC, /useState\(DEFAULT_SELECTION\)/, "the page must open on the default selection");
});

test("the row renders as ONE row from ONE array — no selector is hidden or stacked", () => {
  assert.match(CODE, /SELECTOR_ROW\.map\(/, "one map over one ordered array");
  assert.equal((CODE.match(/SELECTOR_ROW\.map\(/g) || []).length, 1, "rendered exactly once");
  assert.ok(!/display:\s*'none'/.test(CODE), "no selector may be hidden");
  // The row is a single flex line that scrolls horizontally rather than wrapping or stacking.
  const rowStart = CODE.indexOf("SELECTOR_ROW.map(");
  const rowStyle = CODE.slice(Math.max(0, rowStart - 400), rowStart);
  assert.match(rowStyle, /display:\s*'flex'/);
  assert.match(rowStyle, /overflowX:\s*'auto'/, "tablet/mobile must scroll horizontally");
  assert.ok(!/flexWrap/.test(rowStyle), "the row must not wrap into stacked lines");
  assert.match(rowStyle, /maxWidth:\s*'100%'/, "the row must not widen the page");
});

test("selectors do not clip: each stays on one line and never shrinks", () => {
  const rowBody = CODE.slice(CODE.indexOf("SELECTOR_ROW.map("));
  assert.match(rowBody, /whiteSpace:\s*'nowrap'/);
  assert.match(rowBody, /flexShrink:\s*0/);
});

test("the selected state is explicit and accessible", () => {
  const rowBody = CODE.slice(CODE.indexOf("SELECTOR_ROW.map("));
  assert.match(rowBody, /const isSelected = selectedCategory === sel\.id/);
  assert.match(rowBody, /aria-pressed=\{isSelected\}/, "selected state must be exposed to AT");
});

test("View All is a utility control, still separated, and never a stored category", () => {
  assert.equal(VIEW_ALL, "view_all");
  assert.equal(SELECTOR_ROW[SELECTOR_ROW.length - 1].id, VIEW_ALL);
  assert.equal(SELECTOR_ROW.find((s) => s.id === VIEW_ALL).kind, "utility");
  assert.ok(!CATEGORY_IDS.includes(VIEW_ALL), "View All must not be a category id");
  assert.ok(!CATEGORY_LABELS.includes("View All"), "View All must not be a category label");
  // A separator still precedes it so it cannot read as a merchandise category.
  const rowBody = CODE.slice(CODE.indexOf("SELECTOR_ROW.map("));
  assert.match(rowBody, /isUtility && \(/);
  assert.match(rowBody, /aria-hidden="true"/);
});

test("the six merchandise categories keep their exact machine ids and labels", () => {
  assert.equal(CATEGORY_IDS.length, 6);
  assert.deepEqual(CATEGORY_IDS, [
    "gift_cards", "gift_baskets", "flowers", "americana", "faith_and_inspiration", "tech",
  ]);
  assert.deepEqual(CATEGORY_LABELS, [
    "Gift Cards", "Gift Baskets", "Flowers", "Americana", "Faith & Inspiration", "Tech",
  ]);
});

test("apparel is a valid post-launch category with no top-level control", () => {
  assert.deepEqual(POST_LAUNCH_CATEGORY_IDS, ["apparel"]);
  assert.ok(!CATEGORY_IDS.includes("apparel"));
  assert.ok(!SELECTOR_ROW.some((s) => s.id === "apparel" || s.label === "Apparel"));
});

// ============================================================
// 2 — Brandable Goods is a collection, not a stored category
// ============================================================

test("Brandable Goods has a selector but is NOT a stored category id", () => {
  assert.ok(SELECTOR_ROW.some((s) => s.id === BRANDABLE), "it must have a selector in the row");
  assert.equal(SELECTOR_ROW[0].kind, "collection", "it is a collection, not a category");
  assert.ok(!CATEGORY_IDS.includes(BRANDABLE), "no product may carry it as a category");
  assert.ok(!CATEGORY_LABELS.some((l) => /Brandable/i.test(l)));
});

test("membership is the server's brandable boolean — never inferred from a category", () => {
  // A product that merely NAMES the collection as a category is not brandable.
  const impostor = [
    { syncProductId: "x", brandable: false, greetMeCategories: [BRANDABLE, "tech"] },
  ];
  assert.deepEqual(selectProducts(impostor, BRANDABLE), [], "category text cannot confer membership");
  // And a brandable product with no categories at all still belongs.
  const orphan = [{ syncProductId: "y", brandable: true, greetMeCategories: [] }];
  assert.deepEqual(idsOf(selectProducts(orphan, BRANDABLE)), ["y"]);
});

test("the Brandable header carries the approved copy and the existing business route", () => {
  assert.equal(BRANDABLE_TAGLINE, "See it with our brand. Make it yours.");
  assert.match(SRC, /\{BRANDABLE_TAGLINE\}/, "the tagline must render");
  assert.match(SRC, /Brand for My Company/);
  assert.match(SRC, /navigate\('\/business\?contact=sales'\)/);
  // It is a HEADER, shown only for this selection — not a permanent surface.
  assert.match(CODE, /selectedCategory === BRANDABLE &&/);
});

test("no separate persistent Brandable product surface remains", () => {
  assert.ok(!SRC.includes("brandableProducts"), "the second product list must be gone");
  // Exactly one place renders product cards, and it is the shared grid.
  assert.equal((CODE.match(/\.map\(\(item\) => \{/g) || []).length, 1, "exactly one product grid");
  assert.ok(!CODE.includes("brandable-${item.syncProductId}"), "the duplicate card key must be gone");
});

// ============================================================
// 3 — The American Gift Place banner is untouched
// ============================================================

test("the American Gift Place branding is preserved", () => {
  assert.match(SRC, /American Gift Place™/);
  assert.match(SRC, /greetmeFlags/);
  assert.match(SRC, /Supporting American businesses, veterans, and first responders/);
});

// ============================================================
// 4 — QR Cash is unchanged and still leads the page
// ============================================================

test("QR Cash renders above the selector row, with its wording and behaviour intact", () => {
  assert.match(SRC, /QR Cash™/);
  assert.match(SRC, /Send • Spend • Gift/);
  assert.match(SRC, /Send QR Cash™/);
  assert.match(SRC, /setShowQRCashModal\(true\)/);
  assert.match(SRC, /<QRCashGiftModal/);
  const qrIdx = SRC.indexOf("AGP-02 — QR Cash™ featured tile");
  const rowIdx = SRC.indexOf("SELECTOR_ROW.map(");
  assert.ok(qrIdx > -1 && rowIdx > qrIdx, "the selector row must sit BENEATH QR Cash");
});

// ============================================================
// 5 — The selection partition: one shared area, correct sets
// ============================================================

test("Brandable Goods resolves to the five branded products", () => {
  const got = selectProducts(FIXTURE, BRANDABLE);
  assert.equal(got.length, 5);
  assert.deepEqual(idsOf(got), ["p1", "p2", "p3", "p4", "p5"]);
});

test("Tech resolves to exactly the phone case and the laptop sleeve", () => {
  const got = selectProducts(FIXTURE, "tech");
  assert.equal(got.length, 2);
  assert.deepEqual(got.map((p) => p.name), ["Phone Case", "Laptop Sleeve"]);
});

test("View All resolves to all five products, once each", () => {
  const got = selectProducts(FIXTURE, VIEW_ALL);
  assert.equal(got.length, 5);
  assert.equal(new Set(idsOf(got)).size, 5, "no product may appear twice");
});

test("no selection ever yields a duplicate product card", () => {
  for (const sel of SELECTOR_ROW) {
    const got = selectProducts(FIXTURE, sel.id);
    assert.equal(new Set(idsOf(got)).size, got.length, `"${sel.id}" produced a duplicate`);
  }
});

test("Gift Baskets, Flowers, Americana and Faith & Inspiration stay deliberately empty", () => {
  for (const id of ["gift_baskets", "flowers", "americana", "faith_and_inspiration"]) {
    assert.deepEqual(selectProducts(FIXTURE, id), [], `"${id}" must invent no products`);
  }
});

test("switching selection replaces the shared set rather than adding to it", () => {
  const brandable = selectProducts(FIXTURE, BRANDABLE);
  const tech = selectProducts(FIXTURE, "tech");
  assert.notDeepEqual(idsOf(brandable), idsOf(tech));
  assert.ok(tech.length < brandable.length, "Tech is a strict subset view, not an addition");
  // The component renders exactly one list, so a switch cannot leave the previous set on screen.
  assert.equal((CODE.match(/visibleProducts\.map\(/g) || []).length, 1);
});

test("selection labels are display copy for the empty state", () => {
  assert.equal(selectionLabel(BRANDABLE), "Brandable Goods");
  assert.equal(selectionLabel("faith_and_inspiration"), "Faith & Inspiration");
  assert.equal(selectionLabel(VIEW_ALL), "View All");
  assert.equal(selectionLabel("not_a_selector"), "");
});

test("a malformed product list is handled without throwing", () => {
  assert.deepEqual(selectProducts(undefined, VIEW_ALL), []);
  assert.deepEqual(selectProducts(null, BRANDABLE), []);
  assert.deepEqual(selectProducts([{ syncProductId: "z" }], "tech"), []);
});

// ============================================================
// 6 — One card, one cart, one checkout, one product source
// ============================================================

test("there is exactly ONE add-to-cart path on the page", () => {
  assert.equal(
    (SRC.match(/handleAddToCart\(item, e\)/g) || []).length,
    1,
    "one grid means one handler invocation site"
  );
  assert.equal((SRC.match(/cartService\.addItem\(/g) || []).length, 1);
  assert.equal((SRC.match(/navigate\('\/dashboard\/cart'\)/g) || []).length, 1);
  assert.ok(!SRC.includes("window.location.href"), "no external checkout redirect may remain");
});

test("products come from the single existing merch endpoint", () => {
  assert.equal(
    (CODE.match(/api\.request\('\/api\/merch\/products'\)/g) || []).length,
    1,
    "exactly one product fetch — no second catalog source"
  );
  assert.ok(!CODE.includes("/api/gifts/catalog"), "the page must not read the vendor gift catalog");
});

test("the grid renders the SELECTED product list through the one shared rule", () => {
  assert.match(SRC, /\{visibleProducts\.map\(\(item\) => \{/);
  assert.match(SRC, /selectProducts\(products, selectedCategory\)/);
});

test("the personal-greeting round trip and direct entry are preserved", () => {
  assert.match(SRC, /returnTo === 'send'/);
  assert.match(SRC, /searchParams\.get\('returnRecipientId'\)/);
  assert.match(SRC, /navigate\('\/dashboard\/send\?returnTo=send&giftType=merch'\)/);
  assert.match(SRC, /sendContext: 'greeting-flow'/);
  // Direct entry: both session headers are conditional, so /dashboard/gifts with no query
  // parameters renders the marketplace on its own.
  assert.match(SRC, /\{returnRecipientId && \(/);
  assert.match(SRC, /\{cameFromSendGreeting && !returnRecipientId && \(/);
});

// ============================================================
// 7 — Maker Gifts / Shopify / separate Merch tab are gone
// ============================================================

test("no Maker Gifts control, branch, or label remains", () => {
  for (const token of ["maker_gifts", "Maker Gifts", "SHOW_MAKER_ATTRIBUTION", "AGP_CATEGORIES"]) {
    assert.ok(!SRC.includes(token), `"${token}" must be gone from the marketplace page`);
  }
});

test("every customer-facing Shopify branch is gone", () => {
  for (const token of [
    "getGiftCatalog", "startGiftCheckout", "catalogProducts", "handleGiftCheckout",
    "checkoutBusyId", "GiftMarketFilters", "Shopify", "shopify",
  ]) {
    assert.ok(!SRC.includes(token), `"${token}" must be gone from the marketplace page`);
  }
});

test("no separate Greet-Me Merch tab exists", () => {
  assert.ok(!CATEGORY_IDS.includes("merch"));
  assert.ok(!SELECTOR_ROW.some((s) => s.label === "Greet-Me Merch"));
});

test("the marketplace page reaches no corporate surface", () => {
  for (const token of ["corporate", "Corporate"]) {
    assert.ok(!CODE.includes(token), `"${token}" must not appear in marketplace page code`);
  }
});

// ============================================================
// 8 — Gift Cards is dormant and non-purchasable
// ============================================================

test("the dormant Gift Cards panel offers no purchasing action", () => {
  assert.match(GIFT_CARDS_BRANCH, /Greet-Me Smart eGift Card/);
  assert.match(GIFT_CARDS_BRANCH, /Coming later — not yet available/);
  for (const forbidden of [
    "handleAddToCart", "Add to Cart", "denomination", "amountCents", "priceCents", "checkout", "Buy",
  ]) {
    assert.ok(
      !GIFT_CARDS_BRANCH.includes(forbidden),
      `the dormant Gift Cards panel must not offer "${forbidden}"`
    );
  }
});

test("Gift Cards is one card, not a Prezzee browser", () => {
  assert.ok(!/\.map\(/.test(GIFT_CARDS_BRANCH), "the dormant panel must render no product list");
  assert.ok(!/prezzee/i.test(CODE), "no Prezzee identifier may appear in executable page code");
});
