// src/pages/merchSelection.js
//
// GIFTS — the marketplace selector vocabulary and the ONE selection rule that feeds the single
// shared product area on /dashboard/gifts.
//
// WHY THIS IS A PLAIN MODULE AND NOT PART OF Merch.jsx
// ----------------------------------------------------
// Merch.jsx is JSX and cannot be imported under `node --test`, so anything living inside it can
// only be asserted by scraping its source. That is strong enough for structural claims ("there is
// one grid", "no Shopify branch remains") but it cannot prove a PARTITION — that Brandable Goods
// and Tech and View All each resolve to exactly the right products, once each, from one list.
// Holding the vocabulary and the rule here makes that partition executable, so the counts are
// proven by running the real code rather than by matching a regular expression against it.
//
// `id` is a MACHINE IDENTIFIER and is the only thing that routes or is ever stored on a product;
// `label` is display copy. They are deliberately different in form (snake_case vs Title Case) so
// a copy edit can never change what a control selects.

export const GREET_ME_CATEGORIES = [
  { id: 'gift_cards', label: 'Gift Cards' },
  { id: 'gift_baskets', label: 'Gift Baskets' },
  { id: 'flowers', label: 'Flowers' },
  { id: 'americana', label: 'Americana' },
  { id: 'faith_and_inspiration', label: 'Faith & Inspiration' },
  { id: 'tech', label: 'Tech' },
];

// `apparel` is a VALID category a product may carry, but it renders NO top-level control at
// launch. Listing it here documents that the omission is a deliberate launch decision rather
// than an oversight, and keeps the post-launch exposure to a one-line change.
export const POST_LAUNCH_CATEGORY_IDS = ['apparel'];

// VIEW ALL is a UTILITY CONTROL, not a category. It is never stored on a product.
export const VIEW_ALL = 'view_all';

// BRANDABLE GOODS is a COLLECTION, not a category. No product ever carries this id: membership is
// the `brandable` boolean the server sends, and selectProducts below never consults
// greetMeCategories for it. It LEADS the selector row and is the default selection, but it is
// resolved by the same single rule as every other selector and renders into the same single
// product area — it is a selection, not a second surface.
export const BRANDABLE = 'brandable_goods';

export const BRANDABLE_TAGLINE = 'See it with our brand. Make it yours.';

// The unified selector row, in render order. One array, so the order on screen and the order
// asserted in tests cannot drift apart. `kind` drives presentation only — never selection.
export const SELECTOR_ROW = [
  { id: BRANDABLE, label: 'Brandable Goods', kind: 'collection' },
  ...GREET_ME_CATEGORIES.map((c) => ({ ...c, kind: 'category' })),
  { id: VIEW_ALL, label: 'View All', kind: 'utility' },
];

// Brandable Goods leads the row and opens the page.
export const DEFAULT_SELECTION = BRANDABLE;

/**
 * The ONE selection rule behind the shared product area.
 *
 * Every selector resolves through here, so there is exactly one definition of what is on screen
 * and no way for two surfaces to disagree. A product is returned at most once for any selection.
 *
 * - BRANDABLE  → the server's `brandable === true` boolean, never inferred from a category
 * - VIEW_ALL   → everything purchasable, once each
 * - otherwise  → membership in that category id
 *
 * A product with an empty greetMeCategories array is not yet assigned to a launch category; it
 * stays reachable through View All (and Brandable Goods, if flagged) rather than being silently
 * unreachable.
 */
export function selectProducts(products, selection) {
  const all = Array.isArray(products) ? products : [];
  if (selection === BRANDABLE) return all.filter((p) => p.brandable === true);
  if (selection === VIEW_ALL) return all;
  return all.filter(
    (p) => Array.isArray(p.greetMeCategories) && p.greetMeCategories.includes(selection)
  );
}

/** Display copy for the current selection — used by the empty state. */
export function selectionLabel(selection) {
  const found = SELECTOR_ROW.find((s) => s.id === selection);
  return found ? found.label : '';
}

// ── PRICE RANGE ────────────────────────────────────────────────────────────────────────────
//
// The price filter is PRESENTATION ONLY. It decides what is shown; it never changes a price.
// Every number below is read straight from what the server sent and is passed through untouched —
// nothing is rounded, recalculated or persisted, and checkout keeps getting its authoritative
// price through the existing path.

const finite = (n) => (typeof n === 'number' && Number.isFinite(n) ? n : null);

/**
 * The prices a product can actually be bought at.
 *
 * Variants are the real purchase points, so when they exist they ARE the price set: a laptop
 * sleeve at $39 and $44 is two prices, not a $39–$44 continuum. Returns [] when the product
 * carries no usable variant prices, and the interval fallback takes over.
 */
export function variantPrices(product) {
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  return variants.map((v) => finite(v?.priceCents)).filter((c) => c !== null);
}

/**
 * The [low, high] a product spans, used only to compute the overall bounds of the control.
 * Prefers real variant prices and falls back to the server's own min/max interval.
 */
function productSpan(product) {
  const prices = variantPrices(product);
  if (prices.length) return [Math.min(...prices), Math.max(...prices)];
  const lo = finite(product?.priceCentsMin);
  const hi = finite(product?.priceCentsMax);
  if (lo === null && hi === null) return null;
  const low = lo === null ? hi : lo;
  const high = hi === null ? lo : hi;
  return [Math.min(low, high), Math.max(low, high)];
}

/**
 * The floor and ceiling of the whole loaded catalog.
 *
 * Deliberately computed from EVERY loaded product rather than from the current selection, so the
 * control keeps the same scale when the shopper switches category — the handles do not jump, and
 * a range chosen under one selector still means the same thing under the next.
 *
 * Returns null when nothing can be priced, which is the caller's signal to render no control at
 * all rather than an empty one.
 */
export function priceBounds(products) {
  const all = Array.isArray(products) ? products : [];
  let floor = null;
  let ceiling = null;
  for (const p of all) {
    const span = productSpan(p);
    if (!span) continue;
    floor = floor === null ? span[0] : Math.min(floor, span[0]);
    ceiling = ceiling === null ? span[1] : Math.max(ceiling, span[1]);
  }
  return floor === null ? null : { floor, ceiling };
}

/**
 * Does this product belong in the chosen range? Inclusive at both ends.
 *
 *  - With variants: true when AT LEAST ONE purchasable variant price is inside the range. A
 *    product is therefore shown once because one of its options qualifies, never once per option.
 *  - Without variants: the server's priceCentsMin/priceCentsMax interval is used, and the product
 *    is shown when that interval OVERLAPS the range — an item spanning $24–$44 is a real candidate
 *    for a $30–$35 search even though neither endpoint sits inside it.
 *  - With no price information at all: shown. The filter must never hide a product it cannot
 *    price, least of all at the default full range.
 */
export function matchesPriceRange(product, minCents, maxCents) {
  const lo = finite(minCents);
  const hi = finite(maxCents);
  if (lo === null || hi === null) return true;

  const prices = variantPrices(product);
  if (prices.length) return prices.some((c) => c >= lo && c <= hi);

  const span = productSpan(product);
  if (!span) return true;
  return span[0] <= hi && span[1] >= lo;
}

/** Apply the range to an already-selected set. Order and identity are preserved. */
export function filterByPrice(products, minCents, maxCents) {
  const all = Array.isArray(products) ? products : [];
  return all.filter((p) => matchesPriceRange(p, minCents, maxCents));
}
