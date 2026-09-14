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
});

export const actionLabelFor = (context) => (
  context === "greeting" ? GIFT_ACTION_LABELS.greeting : GIFT_ACTION_LABELS.store
);

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
export function fromProviderProduct(p) {
  if (!p) return null;
  return Object.freeze({
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
