// src/components/founderCatalog/catalogDrawerModel.js
//
// CHECKPOINT 2 — the drawer's vocabulary, as a plain module.
//
// It lives here rather than inside ManageCatalogDrawer.jsx for the same reason merchSelection.js
// exists: JSX cannot be imported under `node --test`, so anything defined inside a component can
// only be asserted by scraping source. Holding the vocabulary here makes it executable, and the
// component and the tests read the SAME values instead of two lists that must be kept in step.

/**
 * The ids a product may be STORED under.
 *
 * `apparel` is storable and deliberately has NO customer selector yet — storing and surfacing are
 * separate decisions. `view_all` is a utility control and `brandable_goods` is a boolean
 * collection, so neither is a category and neither appears here.
 */
export const STORABLE_CATEGORY_IDS = Object.freeze([
  'gift_cards',
  'gift_baskets',
  'flowers',
  'americana',
  'faith_and_inspiration',
  'tech',
  'apparel',
]);

export const CATEGORY_LABELS = Object.freeze({
  gift_cards: 'Gift Cards',
  gift_baskets: 'Gift Baskets',
  flowers: 'Flowers',
  americana: 'Americana',
  faith_and_inspiration: 'Faith & Inspiration',
  tech: 'Tech',
  apparel: 'Apparel (stored, no selector yet)',
});

export const SECTIONS = Object.freeze([
  { id: 'draft', label: 'Draft' },
  { id: 'published', label: 'Published' },
  { id: 'retired', label: 'Retired' },
  { id: 'providers', label: 'Providers' },
  // Printful is a LIVE supplier, not a dormant provider, so it gets its own section rather than a
  // row in Providers. Putting it there would have meant registering it in the two-provider
  // registry, whose boot invariant asserts exactly two registrations — and would have described a
  // shipping, charging supplier as dormant.
  { id: 'merch', label: 'Merch (Printful)' },
]);

/** Curation state of one merch product, as a short label. */
export function merchStatusLabel(curation) {
  if (!curation) return 'Visible';
  if (curation.state === 'retired') return 'Retired';
  if (curation.displayEnabled === false) return 'Hidden';
  return 'Visible';
}

/**
 * The placement rule, evaluated locally so the founder is told BEFORE saving.
 *
 * A product that would be visible and active must appear somewhere: either in the Brandable Goods
 * collection or under at least one category. The server enforces the same rule — this only makes
 * the refusal legible in advance instead of after a round trip.
 */
export function merchPlacementError(draft) {
  const visible = draft.displayEnabled !== false && draft.state !== 'retired';
  const placed = draft.brandable === true
    || (Array.isArray(draft.greetMeCategories) && draft.greetMeCategories.length > 0);
  return visible && !placed
    ? 'A visible product needs Brandable Goods or at least one category.'
    : null;
}

/** True when a draft differs from what was last saved — drives the unsaved-change guard. */
export function merchIsDirty(draft, saved) {
  if (!draft || !saved) return false;
  return draft.displayEnabled !== saved.displayEnabled
    || draft.brandable !== saved.brandable
    || String(draft.featuredRank ?? '') !== String(saved.featuredRank ?? '')
    || [...(draft.greetMeCategories || [])].sort().join(',')
      !== [...(saved.greetMeCategories || [])].sort().join(',');
}

/**
 * Server refusal codes, rendered as something a founder can act on.
 *
 * A refusal is information, not an error to swallow: each one says why the server said no and
 * what would change the answer. The ETag message is the important one — it states plainly that
 * nothing was overwritten, because the natural fear on a save conflict is that work was lost.
 */
export const REFUSAL_COPY = Object.freeze({
  NO_CATEGORIES: 'Assign at least one category before publishing.',
  UNAVAILABLE: 'The vendor reports this product as unavailable.',
  SOURCE_NOT_FULFILLABLE:
    'This source has no active checkout or fulfilment path yet, so it cannot be published.',
  PROVIDER_DORMANT:
    'The provider is dormant. Publishing becomes possible only after it is separately activated.',
  etag_conflict:
    'This record changed since you opened it. Reload it and re-apply your edit — nothing was overwritten.',
  NO_VISIBLE_PLACEMENT:
    'A visible product needs Brandable Goods or at least one category. Hide or retire it instead.',
  WRITES_DISABLED:
    'Curation writes are turned off in this release. Existing curation is still applied to the storefront.',
  UNKNOWN_PRODUCT: 'That product is not one of the curated Printful products.',
  merch_unavailable:
    'The curation store is unavailable, so terms cannot be changed right now. The storefront is unaffected.',
});

/**
 * Toggle a category on or off.
 *
 * Duplicate-free by construction: a toggle can only add an id that is currently absent, so the
 * array sent to the server can never carry the same id twice.
 */
export function toggleCategoryId(current, categoryId) {
  const list = Array.isArray(current) ? current : [];
  return list.includes(categoryId) ? list.filter((c) => c !== categoryId) : [...list, categoryId];
}
