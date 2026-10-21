// src/pages/giftPlaceViewModel.js
//
// ONE GIFT CARD SHAPE, whatever supplied the product.
//
// WHY THIS EXISTS. The Gift Place used to render Printful merchandise through one hand-written card
// and provider-fulfilled arrangements through a completely different list, with different fields,
// different prices, a different action and a different position for it. Two grids describing the
// same decision is how a shopper ends up comparing a flower to a tote bag and finding the page has
// changed shape underneath them.
//
// So every source is PROJECTED into the one view model below, and the card component consumes only
// this. A new provider is then a projector — never a second grid.
//
// WHY IT IS A PLAIN MODULE. Merch.jsx is JSX and cannot be imported under `node --test`, so anything
// living inside it can only be asserted by scraping its source. That is strong enough for structural
// claims but it cannot prove a PROJECTION — that a Printful product and a Florist One arrangement
// really do arrive at the same six fields. Holding the rule here makes that executable.

/** The exact fields a gift card renders. Nothing else reaches the card. */
export const GIFT_CARD_FIELDS = Object.freeze([
  "id", "name", "description", "imageUrl", "priceLabel", "priceMinor", "source",
]);

/** Where a card's product came from. Presentation never branches on this; ordering and keys do. */
export const GIFT_SOURCES = Object.freeze({
  CATALOG: "catalog",     // the Greet-Me / Printful curated catalogue
  PROVIDER: "provider",   // a provider-fulfilled category (flowers, gift boxes)
  // The CANONICAL customer catalog (GET /api/gifts/catalog) — founder-curated, published,
  // provider-fulfilled products (Florist One, Goody), driving View All and every category
  // selector below. Distinct from PROVIDER above: PROVIDER was the page's OLD live-provider
  // display source; CURATED is the founder's own curated/categorized set.
  CURATED: "curated",
});

/**
 * THE ACTION LABEL, decided by CONTEXT and not by product type.
 *
 * Shopping for a greeting attaches one gift to it, so the action is "Select Gift". A direct
 * storefront visit adds to a cart, so it is "Add to Cart". The founder's rule is that the label may
 * change and the card must not: same position, same size, same weight. Keeping the two strings here,
 * beside each other, is what makes that checkable.
 */
export const GIFT_ACTION_LABELS = Object.freeze({
  greeting: "Select Gift",
  store: "Add to Cart",
  // A PROVIDER-FULFILLED CATEGORY BOUGHT OUTSIDE A GREETING, keyed by gift type.
  //
  // "Add to Cart" would be a plain lie here: a flower never enters the cart, cannot be combined with
  // merchandise, and is paid for at the florist's own checkout. The shopper is ordering an
  // arrangement, so the button says so.
  //
  // Keyed rather than hardcoded so a second provider category names its own action instead of
  // inheriting a flower's. Anything without an entry falls back to the store label, which is what
  // keeps every existing non-provider category byte-identical.
  flowers: "Order Flowers",
});

/**
 * The card's action label.
 *
 * `context` is the shopper's situation — a greeting attaches one gift, a store visit does not — and
 * it still wins outright: shopping FOR a greeting is always "Select Gift", whatever the category.
 * `giftType` refines the store case only.
 */
export const actionLabelFor = (context, giftType = null) => {
  if (context === "greeting") return GIFT_ACTION_LABELS.greeting;
  if (giftType && GIFT_ACTION_LABELS[giftType]) return GIFT_ACTION_LABELS[giftType];
  return GIFT_ACTION_LABELS.store;
};

const finite = (n) => (typeof n === "number" && Number.isFinite(n) ? n : null);

/** Minor units to a display string, in the currency the source stated. No rounding, no maths. */
export function formatMinor(minor, currency = "USD") {
  const cents = finite(minor);
  if (cents === null) return "";
  const major = cents / 100;
  const fixed = major.toFixed(cents % 100 === 0 ? 0 : 2);
  return currency === "USD" ? `$${fixed}` : `${fixed} ${currency}`;
}

/**
 * A price RANGE, for catalogue products whose variants span one.
 *
 * Deliberately preserved rather than flattened to a single number: a tote at $24 and a tote at $44
 * is two prices, and showing one of them would misprice the other.
 */
export function formatRange(minMinor, maxMinor, currency = "USD") {
  const lo = finite(minMinor);
  const hi = finite(maxMinor);
  if (lo === null && hi === null) return "";
  if (lo === null || hi === null) return formatMinor(lo ?? hi, currency);
  if (lo === hi) return formatMinor(lo, currency);
  return `${formatMinor(lo, currency)} – ${formatMinor(hi, currency)}`;
}

/**
 * Project a Greet-Me / Printful catalogue product.
 *
 * `description` is the short line the card reserves space for. The catalogue has no description
 * field of its own, so the variant hint is used where there is one and the slot stays empty
 * otherwise — an empty slot keeps every card the same height, which is the point of having one.
 */
export function fromCatalogProduct(p) {
  if (!p) return null;
  const hasOptions = Number(p.variantCount) > 1;
  return Object.freeze({
    id: String(p.syncProductId ?? ""),
    source: GIFT_SOURCES.CATALOG,
    name: String(p.name ?? ""),
    description: hasOptions ? "Additional sizes and models available" : "",
    imageUrl: p.imageUrl || null,
    priceLabel: formatRange(p.priceCentsMin, p.priceCentsMax, "USD"),
    // The LOW end, for sorting and for a caller that needs a number. Never used to charge: the
    // amount charged comes from the cart and, for a provider, from its own quote.
    priceMinor: finite(p.priceCentsMin),
  });
}

/**
 * Project a provider-fulfilled arrangement.
 *
 * The provider's own price, passed through exactly as received. It is never an input: what is
 * charged comes from the provider's quote at checkout, after delivery and tax are known.
 */
// A gift box whose provider REQUIRES options (catalog flag `requiresOptions: true`, set only then): no Greet-Me screen
// can take those options yet, so it is shown but cannot be chosen. The server refuses it before any charge regardless
// (quote -> gift_box_selection_invalid); this only keeps the shopper from choosing something that cannot be ordered.
export const OPTIONS_UNAVAILABLE_NOTE = "Options can't be chosen here yet";
export const requiresOptions = (p) => Boolean(p) && p.requiresOptions === true;

/** Curated cards whose gift box (looked up in the provider catalog) requires options carry the same note. */
export function withOptionsNote(cards, providerProducts) {
  const flagged = new Set((providerProducts || []).filter(requiresOptions).map((p) => String(p.providerProductId)));
  if (!flagged.size) return cards;
  return cards.map((c) => (c && c.providerProductId && flagged.has(String(c.providerProductId)) ? Object.freeze({ ...c, unavailableNote: OPTIONS_UNAVAILABLE_NOTE }) : c));
}

// LIVE AVAILABILITY (founder-approved 2026-10-21). A stored (curated) card is resolved to the provider's LIVE product
// when it is chosen. It used to fail open: shown as selectable whatever the live list said, and refused only at checkout.
// Now, until the live list confirms it, it stays VISIBLE (the grid never reflows) but cannot be chosen:
//   loading -> "Checking availability…"; the live read failed -> "Availability unavailable. Try again." (with a retry);
//   live, but the provider no longer lists it -> AVAILABILITY_MISSING_NOTE.
export const AVAILABILITY_CHECKING_NOTE = 'Checking availability…';
export const AVAILABILITY_FAILED_LEAD = 'Availability unavailable.';
export const AVAILABILITY_RETRY_LABEL = 'Try again.';
export const AVAILABILITY_FAILED_NOTE = `${AVAILABILITY_FAILED_LEAD} ${AVAILABILITY_RETRY_LABEL}`;
export const AVAILABILITY_MISSING_NOTE = 'Not available right now';
/** The provider whose live list confirms a curated card, by its stored `source`. Unknown -> every live list. */
export const VENDOR_SOURCE_TO_GIFT_TYPE = Object.freeze({ goody: 'gift_boxes', florist_one: 'flowers' });

/**
 * @param cards  projected cards (curated ones carry providerProductId + vendorSource)
 * @param live   { [giftType]: { state: 'loading'|'ready'|'failed'|'idle', products: [] } }
 * Cards with no provider product (Branded Goods, a curated card with none) are returned untouched; so is a card the
 * live list confirms. Never hides a card.
 */
export function withLiveAvailability(cards, live) {
  const lists = live && typeof live === 'object' ? live : {};
  return (cards || []).map((c) => {
    if (!c || c.source !== GIFT_SOURCES.CURATED || !c.providerProductId) return c;
    const own = VENDOR_SOURCE_TO_GIFT_TYPE[c.vendorSource];
    const relevant = (own ? [lists[own]] : Object.values(lists)).filter(Boolean);
    const id = String(c.providerProductId);
    const found = relevant.some((l) => l.state === 'ready' && (l.products || []).some((p) => p && String(p.providerProductId) === id));
    if (found) return c;
    const availability = !relevant.length || relevant.some((l) => l.state === 'loading' || l.state === 'idle') ? 'checking'
      : relevant.some((l) => l.state === 'failed') ? 'failed' : 'missing';
    const note = availability === 'checking' ? AVAILABILITY_CHECKING_NOTE : availability === 'failed' ? AVAILABILITY_FAILED_NOTE : AVAILABILITY_MISSING_NOTE;
    return Object.freeze({ ...c, unavailableNote: note, availability });
  });
}

export function fromProviderProduct(p) {
  if (!p) return null;
  return Object.freeze({
    ...(requiresOptions(p) ? { unavailableNote: OPTIONS_UNAVAILABLE_NOTE } : {}),
    id: String(p.providerProductId ?? ""),
    source: GIFT_SOURCES.PROVIDER,
    name: String(p.name ?? ""),
    // Providers send short marketing copy under varying names. Whichever arrives is shown; none is
    // required, and nothing is invented to fill the slot.
    description: String(p.description ?? p.shortDescription ?? "").trim(),
    imageUrl: p.imageUrl || null,
    priceLabel: formatMinor(p.priceMinor, p.currency || "USD"),
    priceMinor: finite(p.priceMinor),
  });
}

/**
 * Project a canonical curated catalog product (GET /api/gifts/catalog) — a founder-curated,
 * published, provider-fulfilled product. Same six-field card shape as every other projector,
 * plus two EXTRA fields used only for routing a selection into the existing provider-checkout
 * flow: `providerProductId` (the vendor's own product id) and `vendorSource` (which provider —
 * "goody" / "florist_one" — fulfils it). Neither is rendered by the card; both exist purely so
 * the click handler can resolve this display projection back to a live provider product without
 * this module or the card component needing to know a single fact about ordering.
 *
 * The Smart Card / QR Cash experience is excluded HERE, in this vendor-aware module, rather than
 * in Merch.jsx: that page must never name a vendor in its own executable code, and this is the
 * one place a provider's identity is already read from a stored field. Keeping this special
 * noncatalog experience separate means it can never render as an ordinary marketplace tile, even
 * if the backend's own founder-smoke-test gate ever changes.
 */
export function fromCuratedProduct(p) {
  if (!p || p.source === "prezzee") return null;
  const firstImage = Array.isArray(p.images)
    ? p.images.find((i) => typeof i?.url === "string" && i.url !== "")?.url
    : null;
  return Object.freeze({
    id: String(p.id ?? ""),
    source: GIFT_SOURCES.CURATED,
    name: String(p.title ?? ""),
    description: String(p.description ?? "").trim(),
    imageUrl: firstImage || null,
    priceLabel: formatMinor(p.priceCents, p.currency || "USD"),
    // The LOW end, for sorting/price-range purposes only. Never used to charge: what is charged
    // comes from the provider's own quote at checkout, exactly as fromProviderProduct's does.
    priceMinor: finite(p.priceCents),
    providerProductId: p.providerProductId ? String(p.providerProductId) : null,
    vendorSource: p.source || null,
  });
}

/** Project a whole list, dropping anything that cannot produce an identity. */
export function projectGiftCards(items, projector) {
  const all = Array.isArray(items) ? items : [];
  return all.map(projector).filter((c) => c && c.id);
}

/**
 * Is this selector a PROVIDER-fulfilled category, and if so which gift type?
 *
 * The selector ids are the marketplace's vocabulary; the backend routes on gift types. The one
 * translation between them lives here, and it is a lookup rather than a guess.
 */
export const SELECTOR_TO_GIFT_TYPE = Object.freeze({
  flowers: "flowers",
  gift_baskets: "gift_boxes",
  gift_boxes: "gift_boxes",
});

export const giftTypeForSelector = (selector) => SELECTOR_TO_GIFT_TYPE[selector] || null;
export const isProviderSelector = (selector) => Boolean(giftTypeForSelector(selector));
