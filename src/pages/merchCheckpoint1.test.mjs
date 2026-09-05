// src/pages/merchCheckpoint1.test.mjs — GIFTS CHECKPOINT 1 (frontend presentation)
//
// Run: node --test src/pages/merchCheckpoint1.test.mjs
//
// What this file proves about /dashboard/gifts:
//   1. Exactly six merchandise category controls, with the exact machine ids.
//   2. View All is a utility control, not a stored category.
//   3. Apparel is a valid post-launch category with NO top-level control.
//   4. Brandable Goods is a collection above the category controls — not a category id, not a
//      chip — carrying the approved copy and the Brand for My Company action.
//   5. Maker Gifts, every customer-facing Shopify branch, and any separate Greet-Me Merch tab
//      are gone.
//   6. Products use the EXISTING card and the EXISTING cart — no second cart, no second
//      checkout, no duplicated product source.
//   7. Gift Cards renders with no purchasing action of any kind.
//
// Merch.jsx is JSX and cannot be imported under `node --test`, so this is a source-invariant
// test — the established pattern in this repo for JSX (see
// src/components/GreetingCardProto/giftingIntegrity.test.mjs, campaignSurface.teamA.test.mjs and
// the scripts/verify-*-lock.mjs family). The declared vocabulary is PARSED out of the source and
// asserted as values, so those claims are about what the constants ARE rather than about how the
// file happens to be formatted. The remaining claims — what renders, in what order, what is
// absent — are genuinely structural, so the source is the right thing to assert.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "Merch.jsx"), "utf8").replace(/\r\n/g, "\n");

// Comments EXPLAIN what the page deliberately does not do — the dormant Gift Cards panel says in
// prose that it offers no denomination selector, no Add to Cart and no checkout action, and says
// that Prezzee is not activated. Scanning raw source for those phrases would therefore fail on the
// documentation rather than on the behaviour. Every "must not offer X" assertion below runs
// against CODE with comments stripped, so it is about what the page DOES.
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");
const CODE = stripComments(SRC);

function block(name) {
  const m = SRC.match(new RegExp(`const ${name} = \\[([\\s\\S]*?)\\];`));
  assert.ok(m, `${name} must be declared in Merch.jsx`);
  return m[1];
}
function singleQuoted(name) {
  const m = SRC.match(new RegExp(`const ${name} = '([^']*)';`));
  assert.ok(m, `${name} must be declared in Merch.jsx`);
  return m[1];
}
const pluck = (text, key) => [...text.matchAll(new RegExp(`${key}: '([^']+)'`, "g"))].map((m) => m[1]);

const CATEGORY_BLOCK = block("GREET_ME_CATEGORIES");
const CATEGORY_IDS = pluck(CATEGORY_BLOCK, "id");
const CATEGORY_LABELS = pluck(CATEGORY_BLOCK, "label");
const POST_LAUNCH_IDS = [...block("POST_LAUNCH_CATEGORY_IDS").matchAll(/'([^']+)'/g)].map((m) => m[1]);
const VIEW_ALL = singleQuoted("VIEW_ALL");
const BRANDABLE_TAGLINE = singleQuoted("BRANDABLE_TAGLINE");

// The dormant Gift Cards branch, isolated so "offers nothing purchasable" is asserted against
// that panel alone and cannot be satisfied by unrelated markup elsewhere on the page.
const GIFT_CARDS_BRANCH = (() => {
  const start = CODE.indexOf("selectedCategory === 'gift_cards'");
  const end = CODE.indexOf("visibleProducts.length === 0", start);
  assert.ok(start > -1 && end > start, "the dormant Gift Cards branch must exist and come first");
  return CODE.slice(start, end);
})();

// ============================================================
// 1/2/3 — Category vocabulary and View All
// ============================================================

test("exactly six merchandise category controls, with exact machine ids and labels", () => {
  assert.equal(CATEGORY_IDS.length, 6);
  assert.deepEqual(CATEGORY_IDS, [
    "gift_cards", "gift_baskets", "flowers", "americana", "faith_and_inspiration", "tech",
  ]);
  assert.deepEqual(CATEGORY_LABELS, [
    "Gift Cards", "Gift Baskets", "Flowers", "Americana", "Faith & Inspiration", "Tech",
  ]);
  for (const id of CATEGORY_IDS) {
    assert.match(id, /^[a-z]+(_[a-z]+)*$/, `"${id}" must be a snake_case machine id`);
  }
});

test("View All is a utility control and is NOT a category", () => {
  assert.equal(VIEW_ALL, "view_all");
  assert.ok(!CATEGORY_IDS.includes(VIEW_ALL), "View All must not be a category id");
  assert.ok(!CATEGORY_LABELS.includes("View All"), "View All must not be a category label");
  // Rendered outside the category .map, after a separator, so it cannot read as a 7th category.
  const mapIdx = CODE.indexOf("GREET_ME_CATEGORIES.map(");
  const viewAllIdx = CODE.indexOf("setSelectedCategory(VIEW_ALL)");
  assert.ok(mapIdx > -1 && viewAllIdx > mapIdx, "View All must render after the category map");
  // A separator element sits between the last category chip and the View All control.
  const sepIdx = CODE.indexOf('aria-hidden="true"');
  assert.ok(sepIdx > mapIdx && sepIdx < viewAllIdx, "a visual separator must sit between them");
});

test("apparel is a valid post-launch category with no top-level control", () => {
  assert.deepEqual(POST_LAUNCH_IDS, ["apparel"]);
  assert.ok(!CATEGORY_IDS.includes("apparel"), "apparel must render no top-level control");
  assert.ok(!CATEGORY_LABELS.includes("Apparel"), "no Apparel control label may exist");
});

test("the marketplace opens on View All", () => {
  assert.match(SRC, /useState\(VIEW_ALL\)/);
});

// ============================================================
// 4 — Brandable Goods: a prominent collection, not a category
// ============================================================

test("Brandable Goods is not a category id and has no chip", () => {
  assert.ok(!CATEGORY_IDS.some((id) => /brandable/i.test(id)));
  assert.ok(!CATEGORY_LABELS.some((l) => /Brandable/i.test(l)));
});

test("Brandable Goods renders ABOVE the category controls with the approved copy", () => {
  assert.equal(BRANDABLE_TAGLINE, "See it with our brand. Make it yours.");
  const brandableIdx = SRC.indexOf("Brandable Goods\n");
  const categoryBarIdx = SRC.indexOf("GREET_ME_CATEGORIES.map(");
  assert.ok(brandableIdx > -1, "the Brandable Goods heading must render");
  assert.ok(brandableIdx < categoryBarIdx, "Brandable Goods must render above the category controls");
  assert.match(SRC, /\{BRANDABLE_TAGLINE\}/, "the tagline must render");
});

test("membership is the server's brandable boolean — never inferred from a category", () => {
  assert.match(SRC, /products\.filter\(\(p\) => p\.brandable === true\)/);
});

test("Brand for My Company routes to the EXISTING business contact flow", () => {
  assert.match(SRC, /navigate\('\/business\?contact=sales'\)/);
  assert.match(SRC, /Brand for My Company/);
});

// ============================================================
// 5 — Maker Gifts / Shopify / separate Merch tab are gone
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
  assert.ok(!CATEGORY_LABELS.includes("Greet-Me Merch"));
});

// ============================================================
// 6 — Existing card, existing cart, existing checkout
// ============================================================

test("both grids add to cart through the SAME existing handler", () => {
  const adds = SRC.match(/handleAddToCart\(item, e\)/g) || [];
  assert.equal(adds.length, 2, "Brandable Goods and the category grid must share one handler");
  // One cart service, one add path, one checkout navigation. No second implementation.
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

test("the category grid renders the FILTERED product list", () => {
  assert.match(SRC, /\{visibleProducts\.map\(\(item\) => \{/);
  assert.match(SRC, /if \(selectedCategory === VIEW_ALL\) return products;/);
  assert.match(SRC, /p\.greetMeCategories\.includes\(selectedCategory\)/);
});

test("the personal-greeting round trip is preserved", () => {
  assert.match(SRC, /returnTo === 'send'/);
  assert.match(SRC, /searchParams\.get\('returnRecipientId'\)/);
  assert.match(SRC, /navigate\('\/dashboard\/send\?returnTo=send&giftType=merch'\)/);
  assert.match(SRC, /sendContext: 'greeting-flow'/);
});

// ============================================================
// 7 — Gift Cards is dormant and non-purchasable
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
  // Prezzee may be NAMED in a comment explaining that it is not activated; what must not exist is
  // any Prezzee identifier, fetch, or product list in the code the page actually runs.
  assert.ok(!/prezzee/i.test(CODE), "no Prezzee identifier may appear in executable page code");
});
