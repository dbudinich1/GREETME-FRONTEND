// src/pages/team6NamingAndDeadClicks.test.mjs — TEAM 6 CORRECTIONS
//
// Run: node --test src/pages/team6NamingAndDeadClicks.test.mjs
//
// Source-invariant tests (the established pattern in this repo for JSX, see merchCheckpoint1.test.mjs)
// proving the narrow corrections made during the Team 6 naming/navigation/visual-polish pass:
//   1. The Gift Place selector row uses the approved "Branded Goods" label (Part B).
//   2. No stale customer-facing "Merch"/"Merchandise" copy remains in the touched pages (Part C).
//   3. Merch.jsx's Add to Cart / provider-selection paths never silently no-op on a click (Part H).
//   4. A network-level catalog failure is surfaced as a failed load, not an empty "Coming Soon"
//      category (Part U).
//   5. Hero's "Gifted Subscription Bundles" card no longer misroutes into the Gift Place (Part M).
//   6. For Business's Anytime Animation Packs tile reconnects to the real Animation Bank flow
//      instead of running its own fake, card-collecting checkout simulation (Part S).

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { SELECTOR_ROW, BRANDABLE, selectionLabel } from "./merchSelection.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, rel), "utf8").replace(/\r\n/g, "\n");

const MERCH_SRC = read("Merch.jsx");
const MERCH_ORDERS_SRC = read("MerchOrders.jsx");
const CART_SRC = read("Cart.jsx");
const PRICING_SRC = read("Pricing.jsx");
const HERO_SRC = read("HeroProgram.jsx");
const FOR_BUSINESS_SRC = read("../pages/ForBusiness.jsx");

// ============================================================
// 1 — Branded Goods naming
// ============================================================

test("the Gift Place selector row uses the approved 'Branded Goods' label", () => {
  assert.equal(selectionLabel(BRANDABLE), "Branded Goods");
  assert.equal(SELECTOR_ROW[0].label, "Branded Goods");
  // The machine id is an internal identifier and is deliberately left unchanged.
  assert.equal(SELECTOR_ROW[0].id, "brandable_goods");
});

// ============================================================
// 2 — No stale customer-facing "Merch"/"Merchandise" copy
// ============================================================

// Scoped to rendered copy, not internal identifiers: route paths (/dashboard/merch),
// component/file names, CSS classes, data-testids, cartService method names and code
// comments are all deliberately left unrenamed per the naming mandate's own carve-out.
test("Merch.jsx's mixed-cart alert no longer says 'merch'", () => {
  assert.doesNotMatch(MERCH_SRC, /adding merch\.?'/i);
  assert.match(MERCH_SRC, /adding Branded Goods/);
});

test("MerchOrders.jsx customer-facing copy no longer says 'merch'", () => {
  assert.doesNotMatch(MERCH_ORDERS_SRC, /Greet-Me merch\b/i);
  assert.doesNotMatch(MERCH_ORDERS_SRC, /place a merch order/i);
  assert.doesNotMatch(MERCH_ORDERS_SRC, />\s*Browse Merch\s*</i);
});

test("Cart.jsx empty-cart copy no longer says 'merch'/'merchandise'", () => {
  assert.doesNotMatch(CART_SRC, /gifts and merchandise/i);
  assert.doesNotMatch(CART_SRC, />\s*Shop Merch\s*</i);
});

test("Pricing.jsx mixed-cart alert no longer says 'merchandise'", () => {
  assert.doesNotMatch(PRICING_SRC, /contains merchandise/i);
});

test("ForBusiness.jsx no longer labels the Branded Goods tile 'Branded Merchandise'", () => {
  assert.doesNotMatch(FOR_BUSINESS_SRC, /Branded Merchandise/);
  assert.match(FOR_BUSINESS_SRC, />\s*Branded Goods\s*</);
});

// ============================================================
// 3 — Merch.jsx: no silent no-op on a click
// ============================================================

test("a Printful product missing variants shows visible feedback instead of a silent return", () => {
  const idx = MERCH_SRC.indexOf("product.variants.length === 0");
  assert.ok(idx > -1, "the missing-variants guard must still exist");
  const nearby = MERCH_SRC.slice(idx, idx + 300);
  assert.match(nearby, /alert\(/, "the guard must tell the shopper something, not just console.warn and return");
});

test("selecting a curated provider card before it resolves shows visible feedback", () => {
  const forGreeting = MERCH_SRC.slice(MERCH_SRC.indexOf("const selectProviderGiftForGreeting"));
  const guardForGreeting = forGreeting.slice(0, forGreeting.indexOf("let saved"));
  assert.match(guardForGreeting, /alert\(/, "selectProviderGiftForGreeting must not silently no-op");

  const standalone = MERCH_SRC.slice(MERCH_SRC.indexOf("const selectProviderGiftStandalone"));
  const guardStandalone = standalone.slice(0, standalone.indexOf("setPickerProduct(null)"));
  assert.match(guardStandalone, /alert\(/, "selectProviderGiftStandalone must not silently no-op");
});

// ============================================================
// 4 — Network failure must not be read as "zero products"
// ============================================================

test("a network-level failure on /api/merch/products is surfaced as an error, not an empty grid", () => {
  const idx = MERCH_SRC.indexOf("/api/merch/products");
  const nearby = MERCH_SRC.slice(idx, idx + 700);
  assert.match(nearby, /networkError/, "the Brandable Goods fetch must check api.js's networkError marker");
  assert.match(nearby, /setError\(new Error/);
});

test("a network-level failure on the canonical gift catalog is surfaced as an error, not an empty grid", () => {
  const idx = MERCH_SRC.indexOf("api.getGiftCatalog()");
  const nearby = MERCH_SRC.slice(idx, idx + 700);
  assert.match(nearby, /networkError/, "the canonical catalog fetch must check api.js's networkError marker");
  assert.match(nearby, /setCuratedError\(new Error/);
});

// ============================================================
// 5 — Hero: Gifted Subscription Bundles no longer misroutes to the Gift Place
// ============================================================

test("the Gifted Subscription Bundles card no longer links to /dashboard/gifts", () => {
  const idx = HERO_SRC.indexOf("key: 'gifted_bundles'"); // the card definition (the modal wiring also mentions the key)
  assert.ok(idx > -1, "the gifted_bundles card must still exist");
  const card = HERO_SRC.slice(idx, HERO_SRC.indexOf("}", HERO_SRC.indexOf("cta:", idx)) + 1);
  assert.doesNotMatch(card, /\/dashboard\/gifts/, "no dedicated bundle destination exists — it must not fall back to the general marketplace");
  assert.match(card, /kind:\s*'contact'/, "it must defer to the existing Contact Sales flow, like the adjacent Bulk/Enterprise card");
});

// ============================================================
// 6 — For Business: Anytime Animation Packs reconnects to the real flow
// ============================================================

test("For Business's Animation Packs tile navigates to the real Animation Bank instead of opening a fake checkout", () => {
  const markerIdx = FOR_BUSINESS_SRC.indexOf("reconnects to the real Animation Bank purchase flow");
  assert.ok(markerIdx > -1, "the tile comment marking the reconnection must be present");
  const nearby = FOR_BUSINESS_SRC.slice(markerIdx, markerIdx + 150);
  assert.match(nearby, /navigate\('\/dashboard\/animations'\)/);
  assert.doesNotMatch(nearby, /setShowAnimationModal/);
});

test("For Business no longer contains its own simulated card-collecting checkout", () => {
  assert.doesNotMatch(FOR_BUSINESS_SRC, /Simulate payment processing/i);
  assert.doesNotMatch(FOR_BUSINESS_SRC, /cardNumber/);
  assert.doesNotMatch(FOR_BUSINESS_SRC, /animationCheckoutStep/);
});
