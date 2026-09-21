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

// ── PHASE 2 · STAGING ─────────────────────────────────────────────────────────────────────────

/**
 * The staged lifecycle, as short labels.
 *
 * "Ready for code review" is deliberately not called "ready to publish": the record is waiting on
 * a human to add a config entry and deploy it, and nothing about it is live until they do.
 */
export const STAGED_STATUS_LABEL = Object.freeze({
  pending_pricing: 'Needs pricing',
  pending_fulfillment_approval: 'Needs fulfilment approval',
  ready_for_code_review: 'Ready for code review',
  published: 'Published',
  abandoned: 'Abandoned',
});

export function stagedStatusLabel(item) {
  return STAGED_STATUS_LABEL[item?.state] || 'Unknown';
}

/**
 * What the founder must do next, in order. One sentence, never a list of everything outstanding —
 * the point is the next action, not an audit.
 */
export function stagedNextAction(item) {
  if (!item) return null;
  if (item.state === 'abandoned') return 'Abandoned. Stage the product again to start over.';
  if (item.state === 'published') return 'Live. Presentation is now managed in the Merch section.';
  if (!item.pricingComplete) return 'Set a retail price for every variant.';
  if (!item.presentation?.chosen) return 'Choose categories, Brandable and visibility.';
  if (!item.fulfillmentApproved) return 'Approve the current Printful mapping.';
  if (item.state !== 'ready_for_code_review') return 'Prepare the reviewed release.';
  return 'Send the release manifest to a developer to add to the catalog config and deploy.';
}

/** A staged product is never visible or purchasable, whatever its state. */
export function stagedIsPurchasable() {
  return false;
}

/**
 * May a reviewed release be prepared yet?
 *
 * Mirrors the server so the button is disabled rather than the refusal arriving after a click.
 * The server decides; this only makes the answer legible early.
 */
export function canPrepareRelease(item) {
  return Boolean(item)
    && item.pricingComplete === true
    && item.fulfillmentApproved === true
    && item.presentation?.chosen === true
    && item.state !== 'published'
    && item.state !== 'abandoned';
}

/** A price the founder has typed, as integer cents, or null when it is not a usable price. */
export function parseRetailCents(input) {
  if (input === null || input === undefined) return null;
  const text = String(input).trim();
  if (text === '') return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(text)) return NaN;
  const [whole, frac = ''] = text.split('.');
  const cents = Number(whole) * 100 + Number(frac.padEnd(2, '0'));
  return Number.isSafeInteger(cents) && cents > 0 ? cents : NaN;
}

/**
 * Staging refusals, in founder language.
 *
 * MANIFEST_MISMATCH is the one that matters most: it means the deployed catalog is not what was
 * approved, and the honest response is to stop rather than to mark the product live anyway.
 */
export const STAGED_REFUSAL_COPY = Object.freeze({
  ALREADY_CURATED: 'That product is already in the live catalog. Manage it in the Merch section.',
  already_staged: 'That product is already staged.',
  single_product_only: 'Products are added one at a time.',
  PRICING_INCOMPLETE: 'Every variant needs a retail price first.',
  APPROVAL_MISSING: 'Approve the current Printful mapping first.',
  PRESENTATION_MISSING: 'Choose categories, Brandable and visibility first.',
  FINGERPRINT_STALE:
    'The Printful mapping changed since it was approved. Re-approve it, then prepare the release again.',
  VARIANT_UNAVAILABLE: 'Printful reports a variant as unavailable, so this cannot be released yet.',
  PRODUCT_GONE: 'This product is no longer in the Printful store.',
  NOT_DEPLOYED:
    'The catalog entry is not in the running backend yet. It has to be added in code and deployed first.',
  MANIFEST_MISMATCH:
    'The deployed catalog entry does not match what was approved. Do not mark this live — have the difference checked first.',
  INVALID_PRICE: 'Enter a price in dollars and cents, above zero.',
  VARIANT_SET_MISMATCH: 'The variant list changed at Printful. Reopen this product and price it again.',
  etag_conflict:
    'This record changed since you opened it. Reload it and re-apply your edit — nothing was overwritten.',
  staging_unavailable:
    'The staging store is unavailable. The live marketplace is unaffected.',
  printful_unavailable: 'Printful is not responding right now. Nothing was changed.',
  printful_unconfigured: 'Printful is not configured in this environment.',
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

// ── POLISH (Founder addendum 2026-09-21) ───────────────────────────────────────────────────
//
// Vocabulary and validation for the curated-product workflow, kept HERE for the reason the header
// gives: JSX cannot be imported under `node --test`, so anything defined inside the component can
// only be asserted by scraping source. These are executable, so the drawer and its tests read the
// same rules rather than two copies that drift.
//
// NOTHING HERE ADDS A CAPABILITY. It labels, formats and validates what the existing API already
// accepts — the create route's own refusals remain the authority, and every one of them is still
// surfaced through REFUSAL_COPY.

/**
 * The lifecycle badge for one record.
 *
 * FOUR STATES, and the draft one says the quiet part out loud. "Draft" alone reads like a
 * half-finished document; what a founder actually needs to know is that customers cannot see it,
 * so the badge says so rather than leaving it to be inferred from which buttons happen to appear.
 *
 * `retired` is checked FIRST because a retired record also has displayEnabled false, and reporting
 * it as merely unpublished would understate a deliberate, reversible removal.
 */
export function lifecycleBadge(lifecycle) {
  const state = lifecycle?.state ?? 'draft';
  const displayEnabled = lifecycle?.displayEnabled === true;
  if (state === 'retired') {
    return { id: 'retired', label: 'RETIRED', tone: 'muted', title: 'Removed from the catalog. Reactivate returns it to draft.' };
  }
  if (displayEnabled) {
    return { id: 'published', label: 'PUBLISHED', tone: 'live', title: 'Visible to customers wherever its categories are shown.' };
  }
  // A record that has been published before and is now hidden is not the same thing as one that
  // has never been published: the first was withdrawn, the second was never offered.
  if (lifecycle?.lastPublishedAt) {
    return { id: 'unpublished', label: 'UNPUBLISHED', tone: 'warn', title: 'Was published, now hidden from customers.' };
  }
  return {
    id: 'draft',
    label: 'DRAFT — NOT VISIBLE TO CUSTOMERS',
    tone: 'draft',
    title: 'Never published. Customers cannot see this record.',
  };
}

/** Money as a founder reads it: the currency is shown, never assumed to be dollars. */
export function formatMoney(cents, currency = 'USD') {
  if (!Number.isInteger(cents)) return '—';
  const amount = (cents / 100).toFixed(2);
  const code = typeof currency === 'string' && currency.trim() !== '' ? currency.trim().toUpperCase() : 'USD';
  return code === 'USD' ? `$${amount} USD` : `${amount} ${code}`;
}

/** The first image a record carries, or null. Preview only — never a second source of truth. */
export function previewImageUrl(item) {
  const override = item?.curation?.overrides?.imageUrl;
  if (typeof override === 'string' && override.trim() !== '') return override.trim();
  const images = Array.isArray(item?.vendorAuthoritative?.images) ? item.vendorAuthoritative.images : [];
  for (const img of images) {
    const url = typeof img === 'string' ? img : img?.url;
    if (typeof url === 'string' && url.trim() !== '') return url.trim();
  }
  return null;
}

/**
 * The ONE provider this narrow launch control adds products for.
 *
 * Named here rather than typed into the component so there is a single place to change it, and so
 * the tests assert the same value the form sends. The drawer as a whole remains provider-generic —
 * this constant scopes the ADD CONTROL only, which is what makes it narrow rather than a catalog
 * manager. The customer-facing LABEL still comes from the backend's own provider list; this is a
 * routing identifier, never display copy.
 */
export const LAUNCH_PRODUCT_SOURCE = 'goody';

/** An empty add-product form. One product, one record — there is no bulk shape here. */
export function emptyProductForm(source = LAUNCH_PRODUCT_SOURCE) {
  return { source, externalProductId: '', title: '', description: '', imageUrl: '', priceDollars: '', currency: 'USD', variants: '' };
}

/**
 * Validate the add-product form BEFORE a round trip, in the founder's words.
 *
 * The server refuses the same things and remains the authority — this only makes the refusal
 * legible in advance, exactly as merchPlacementError already does for placement.
 *
 * PRICE IS ENTERED IN DOLLARS AND STORED IN CENTS. That conversion is the one genuinely dangerous
 * step on this form — a bare "25" meaning $0.25 is how a $25 gift becomes a quarter — so the field
 * is labelled in dollars, parsed strictly, and converted in one place.
 */
export function validateProductForm(form) {
  const errors = {};
  const str = (v) => (typeof v === 'string' ? v.trim() : '');

  if (str(form?.source) === '') errors.source = 'Choose which provider this product comes from.';
  if (str(form?.externalProductId) === '') {
    errors.externalProductId = "Enter the provider's own product ID — it is how the product is looked up later.";
  }
  if (str(form?.title) === '') errors.title = 'Enter the product title.';

  const price = str(form?.priceDollars);
  if (price === '') {
    errors.priceDollars = 'Enter the price in dollars, for example 78.00';
  } else if (!/^\d+(\.\d{1,2})?$/.test(price)) {
    errors.priceDollars = 'Use dollars and cents only, for example 78.00';
  } else if (Math.round(Number(price) * 100) <= 0) {
    errors.priceDollars = 'The price must be more than zero.';
  }

  const currency = str(form?.currency);
  if (!/^[A-Za-z]{3}$/.test(currency)) errors.currency = 'Use a three-letter currency code, for example USD.';

  const image = str(form?.imageUrl);
  if (image !== '' && !/^https:\/\//i.test(image)) errors.imageUrl = 'An image URL must start with https://';

  return { ok: Object.keys(errors).length === 0, errors };
}

/** Dollars to whole cents. Exported so the conversion is tested, not trusted. */
export function dollarsToCents(value) {
  const raw = typeof value === 'string' ? value.trim() : value;
  if (!/^\d+(\.\d{1,2})?$/.test(String(raw))) return null;
  return Math.round(Number(raw) * 100);
}

/**
 * The create body, built from a validated form.
 *
 * Shaped to the EXISTING create contract — `source`, `externalProductId`, `snapshot` — and nothing
 * else. Lifecycle, availability and display are server-owned, so this cannot carry them even by
 * mistake: they are not in the object at all.
 */
export function buildProductPayload(form) {
  const str = (v) => (typeof v === 'string' ? v.trim() : '');
  const imageUrl = str(form?.imageUrl);
  const variants = str(form?.variants)
    .split(',')
    .map((v) => v.trim())
    .filter((v) => v !== '');
  return {
    source: str(form?.source),
    externalProductId: str(form?.externalProductId),
    snapshot: {
      title: str(form?.title),
      description: str(form?.description),
      images: imageUrl === '' ? [] : [{ url: imageUrl }],
      priceCents: dollarsToCents(form?.priceDollars),
      currency: str(form?.currency).toUpperCase(),
      variants,
    },
  };
}
