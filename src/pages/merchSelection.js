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
