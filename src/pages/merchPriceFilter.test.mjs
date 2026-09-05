// src/pages/merchPriceFilter.test.mjs — GIFTS price-range filter.
//
// Run: node --test src/pages/merchPriceFilter.test.mjs
//
// The price rules live in merchSelection.js as plain functions, so the filtering claims here are
// proven by RUNNING them rather than by matching source. The placement and empty-state claims are
// structural and are asserted against Merch.jsx, the established pattern for JSX in this repo.
//
// THE CENTRAL PROPERTY: the filter decides what is SHOWN and never what something COSTS. Every
// price in these tests is passed through untouched, and one test below asserts exactly that.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  BRANDABLE,
  VIEW_ALL,
  filterByPrice,
  matchesPriceRange,
  priceBounds,
  selectProducts,
  variantPrices,
} from "./merchSelection.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "Merch.jsx"), "utf8").replace(/\r\n/g, "\n");
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/[^\n]*$/gm, "");
const CODE = stripComments(SRC);

// The launch set as GET /api/merch/products returns it (verified against production 2026-09-05),
// with the variant prices that make the range meaningful. Prices are the server's own cents.
const FIXTURE = [
  {
    syncProductId: 431624815, name: "Hardcover bound notebook", brandable: true, greetMeCategories: [],
    priceCentsMin: 2400, priceCentsMax: 2400,
    variants: [{ syncVariantId: 1, label: "Hardcover Notebook", priceCents: 2400 }],
  },
  {
    syncProductId: 431624305, name: "MagSafe® tough case for iPhone®", brandable: true, greetMeCategories: ["tech"],
    priceCentsMin: 2900, priceCentsMax: 2900,
    variants: [{ syncVariantId: 2, label: "iPhone 16", priceCents: 2900 }, { syncVariantId: 3, label: "iPhone 17", priceCents: 2900 }],
  },
  {
    syncProductId: 431623973, name: "Laptop Sleeve", brandable: true, greetMeCategories: ["tech"],
    priceCentsMin: 3900, priceCentsMax: 4400,
    variants: [{ syncVariantId: 4, label: '13"', priceCents: 3900 }, { syncVariantId: 5, label: '15"', priceCents: 4400 }],
  },
  {
    syncProductId: 431622804, name: "White glossy mug", brandable: true, greetMeCategories: [],
    priceCentsMin: 1400, priceCentsMax: 2000,
    variants: [
      { syncVariantId: 6, label: "11 oz", priceCents: 1400 },
      { syncVariantId: 7, label: "15 oz", priceCents: 1700 },
      { syncVariantId: 8, label: "20 oz", priceCents: 2000 },
    ],
  },
  {
    syncProductId: 431621330, name: "Canvas", brandable: true, greetMeCategories: [],
    priceCentsMin: 3900, priceCentsMax: 5900,
    variants: [
      { syncVariantId: 9, label: '8" × 8"', priceCents: 3900 },
      { syncVariantId: 10, label: '12" × 12"', priceCents: 4900 },
      { syncVariantId: 11, label: '16" × 16"', priceCents: 5900 },
    ],
  },
];

const BOUNDS = priceBounds(FIXTURE);
const full = (list) => filterByPrice(list, BOUNDS.floor, BOUNDS.ceiling);
const namesOf = (list) => list.map((p) => p.name);

// ============================================================
// Bounds
// ============================================================

test("bounds span the whole loaded catalog, from the cheapest to the dearest variant", () => {
  assert.deepEqual(BOUNDS, { floor: 1400, ceiling: 5900 });
});

test("bounds are computed from ALL products, not from the current selection", () => {
  // Tech alone is $29–$44, but the control must still span the full catalog so the handles do not
  // jump when the shopper switches to it.
  const techOnly = selectProducts(FIXTURE, "tech");
  assert.deepEqual(priceBounds(techOnly), { floor: 2900, ceiling: 4400 });
  assert.deepEqual(BOUNDS, { floor: 1400, ceiling: 5900 });
  assert.match(CODE, /priceBounds\(products\)/, "the page must derive bounds from the full list");
});

test("an unpriceable catalog yields no bounds, so no control is rendered", () => {
  assert.equal(priceBounds([]), null);
  assert.equal(priceBounds([{ syncProductId: "x" }]), null);
});

// ============================================================
// 1/2/3 — the default full range changes nothing
// ============================================================

test("the default full range leaves Brandable Goods at five products", () => {
  assert.equal(full(selectProducts(FIXTURE, BRANDABLE)).length, 5);
});

test("the default full range leaves Tech at two products", () => {
  const got = full(selectProducts(FIXTURE, "tech"));
  assert.equal(got.length, 2);
  assert.deepEqual(namesOf(got), ["MagSafe® tough case for iPhone®", "Laptop Sleeve"]);
});

test("View All remains five unique products at the default range", () => {
  const got = full(selectProducts(FIXTURE, VIEW_ALL));
  assert.equal(got.length, 5);
  assert.equal(new Set(got.map((p) => p.syncProductId)).size, 5);
});

// ============================================================
// 4/5/6 — narrowing, variant matching, no duplication
// ============================================================

test("narrowing the range removes the products that fall outside it", () => {
  // $14–$25 keeps only the mug ($14–$20) and the notebook ($24).
  const got = filterByPrice(selectProducts(FIXTURE, VIEW_ALL), 1400, 2500);
  assert.deepEqual(namesOf(got).sort(), ["Hardcover bound notebook", "White glossy mug"]);
});

test("a product is included when AT LEAST ONE purchasable variant is inside the range", () => {
  // $58–$59 catches the Canvas only through its 16×16 variant; its other two are cheaper.
  const got = filterByPrice(FIXTURE, 5800, 5900);
  assert.deepEqual(namesOf(got), ["Canvas"]);
  assert.ok(variantPrices(got[0]).includes(5900));
});

test("a multi-variant product is returned once, not once per matching variant", () => {
  // All three mug variants sit inside $14–$20.
  const got = filterByPrice(FIXTURE, 1400, 2000);
  const mugs = got.filter((p) => p.name === "White glossy mug");
  assert.equal(mugs.length, 1, "the mug matched on three variants and must still appear once");
  assert.equal(new Set(got.map((p) => p.syncProductId)).size, got.length, "no duplicates overall");
});

test("the range is inclusive at both ends", () => {
  assert.ok(matchesPriceRange(FIXTURE[0], 2400, 2400), "exact low/high match must be included");
  assert.ok(!matchesPriceRange(FIXTURE[0], 2401, 5000), "just above must be excluded");
  assert.ok(!matchesPriceRange(FIXTURE[0], 100, 2399), "just below must be excluded");
});

test("without variants the server's min/max interval is used, and overlap is enough", () => {
  const noVariants = { syncProductId: "nv", priceCentsMin: 2400, priceCentsMax: 4400 };
  // Neither endpoint is inside $30–$35, but the product genuinely spans it.
  assert.ok(matchesPriceRange(noVariants, 3000, 3500));
  assert.ok(!matchesPriceRange(noVariants, 4500, 5000));
  assert.ok(!matchesPriceRange(noVariants, 1000, 2300));
});

test("a product with no price information is never hidden by the filter", () => {
  const priceless = { syncProductId: "p" };
  assert.ok(matchesPriceRange(priceless, 1000, 2000));
});

test("the filter reports membership and never alters a price", () => {
  const before = JSON.stringify(FIXTURE);
  const got = filterByPrice(FIXTURE, 2000, 4000);
  assert.equal(JSON.stringify(FIXTURE), before, "the input products must be untouched");
  for (const p of got) {
    const original = FIXTURE.find((f) => f.syncProductId === p.syncProductId);
    assert.equal(p, original, "the SAME object is returned — nothing is rebuilt or rounded");
  }
});

// ============================================================
// 7/8/9 — composition with the category selection
// ============================================================

test("category and price filtering compose in the required order", () => {
  // Tech is the case ($29) and the sleeve ($39/$44); $35–$50 keeps only the sleeve.
  const got = filterByPrice(selectProducts(FIXTURE, "tech"), 3500, 5000);
  assert.deepEqual(namesOf(got), ["Laptop Sleeve"]);
  // The page must apply selection first, then price, then render.
  assert.match(CODE, /selectProducts\(products, selectedCategory\)/);
  assert.match(CODE, /filterByPrice\(selectedProducts, minCents, maxCents\)/);
});

test("a chosen range means the same thing under every selector", () => {
  const MIN = 3500, MAX = 5000;
  assert.deepEqual(namesOf(filterByPrice(selectProducts(FIXTURE, "tech"), MIN, MAX)), ["Laptop Sleeve"]);
  assert.deepEqual(
    namesOf(filterByPrice(selectProducts(FIXTURE, VIEW_ALL), MIN, MAX)).sort(),
    ["Canvas", "Laptop Sleeve"]
  );
  // The committed range is page state, independent of the selection, so switching cannot reset it.
  assert.match(CODE, /const \[priceRange, setPriceRange\] = useState\(null\)/);
  assert.ok(
    !/setPriceRange\((?!null\))/.test(CODE.replace(/onChange=\{\(min, max\) => setPriceRange\(\{ min, max \}\)\}/, "")),
    "nothing may reset the range except an explicit reset"
  );
});

test("reset restores the full result for the selected category", () => {
  const narrowed = filterByPrice(selectProducts(FIXTURE, BRANDABLE), 5800, 5900);
  assert.equal(narrowed.length, 1);
  // Reset is a return to null, which resolves to the full bounds.
  assert.match(CODE, /onReset=\{\(\) => setPriceRange\(null\)\}/);
  assert.equal(full(selectProducts(FIXTURE, BRANDABLE)).length, 5);
});

// ============================================================
// 10/11/12 — empty states stay distinct
// ============================================================

test("a price-filtered-out category shows the price message, not Coming Soon", () => {
  const got = filterByPrice(selectProducts(FIXTURE, "tech"), 100, 500);
  assert.equal(got.length, 0, "the fixture must actually produce an empty price result");
  assert.match(SRC, /No products in this price range\./);
  assert.match(CODE, /const hiddenByPrice = selectedProducts\.length > 0 && visibleProducts\.length === 0/);
  // The price branch is evaluated BEFORE the Coming Soon branch, so a real collection is never
  // mislabelled as uncurated.
  const priceIdx = CODE.indexOf("hiddenByPrice && !loading");
  const comingIdx = CODE.indexOf("visibleProducts.length === 0 && !loading");
  assert.ok(priceIdx > -1 && comingIdx > priceIdx, "the price empty state must be checked first");
});

test("the price empty state offers a way out of the filter", () => {
  assert.match(SRC, /Clear price filter/);
});

test("genuinely uncurated categories keep their Coming Soon state", () => {
  for (const id of ["gift_baskets", "flowers", "americana", "faith_and_inspiration"]) {
    assert.deepEqual(selectProducts(FIXTURE, id), [], `${id} must stay empty`);
  }
  // With no selected products at all, hiddenByPrice is false, so Coming Soon renders.
  assert.match(SRC, /Coming Soon/);
  assert.match(SRC, /We&rsquo;re curating this collection/);
});

test("Gift Cards stays dormant, non-purchasable, and is not price-filtered", () => {
  const branch = (() => {
    const start = CODE.indexOf("selectedCategory === 'gift_cards'");
    const end = CODE.indexOf("hiddenByPrice", start);
    assert.ok(start > -1 && end > start);
    return CODE.slice(start, end);
  })();
  assert.match(branch, /Greet-Me Smart eGift Card/);
  for (const forbidden of ["handleAddToCart", "Add to Cart", "denomination", "checkout", "Buy"]) {
    assert.ok(!branch.includes(forbidden), `the dormant panel must not offer "${forbidden}"`);
  }
  // The control is hidden for this selection rather than rendered inertly.
  assert.match(CODE, /selectedCategory !== 'gift_cards' && bounds &&/);
});

// ============================================================
// 13/17/18/19 — the surrounding guarantees still hold
// ============================================================

test("there is still exactly ONE product grid and one card map", () => {
  assert.equal((CODE.match(/\.map\(\(item\) => \{/g) || []).length, 1);
  assert.equal((SRC.match(/handleAddToCart\(item, e\)/g) || []).length, 1);
  assert.match(SRC, /\{visibleProducts\.map\(\(item\) => \{/);
});

test("QR Cash is byte-identical to its deployed form", () => {
  const lines = SRC.split("\n");
  const start = lines.findIndex((l) => l.includes("AGP-02 — QR Cash™ featured tile"));
  assert.ok(start > -1, "the QR Cash block must exist");
  let end = start;
  while (end < lines.length && lines[end] !== "      </div>") end += 1;
  const block = lines.slice(start, end + 1).join("\n") + "\n";
  assert.equal(block.split("\n").length - 1, 41, "the block must still be 41 lines");
  assert.equal(
    createHash("sha256").update(block, "utf8").digest("hex"),
    "d01223695e8c4563fd08fb2a9329b52d8a275341a85cf4e078ff673bdce9c76a",
    "the QR Cash tile changed — it must stay byte-identical"
  );
});

test("the price control cannot widen the page on mobile", () => {
  const comp = readFileSync(join(HERE, "../components/PriceRangeFilter.jsx"), "utf8");
  assert.match(comp, /maxWidth: '100%'/);
  assert.match(comp, /boxSizing: 'border-box'/);
  assert.match(comp, /flexWrap: 'wrap'/, "it may wrap internally instead of overflowing");
  assert.ok(!/width: '\d/.test(comp), "no fixed pixel width may be set on the container");
  // The selector row above it is untouched and still scrolls horizontally.
  assert.match(CODE, /overflowX:\s*'auto'/);
});

test("no Shopify customer-facing identifier is reintroduced", () => {
  for (const token of [
    "getGiftCatalog", "startGiftCheckout", "catalogProducts", "handleGiftCheckout",
    "checkoutBusyId", "GiftMarketFilters", "Shopify", "shopify", "maker_gifts", "Maker Gifts",
  ]) {
    assert.ok(!SRC.includes(token), `"${token}" must not return to the marketplace page`);
  }
  // The control's header comment EXPLAINS which retired Shopify-era surface it deliberately does
  // not revive, so — as elsewhere in this repo — the "must not contain" check runs against code
  // with comments stripped. It is about what the component DOES, not what it documents.
  const compCode = stripComments(
    readFileSync(join(HERE, "../components/PriceRangeFilter.jsx"), "utf8")
  );
  for (const token of ["fetch(", "api.", "localStorage", "sessionStorage", "Shopify", "shopify", "GiftMarketFilters"]) {
    assert.ok(!compCode.includes(token), `the price control must not contain "${token}"`);
  }
});
