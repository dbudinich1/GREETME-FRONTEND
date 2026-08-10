// src/pages/fundraiser/giftCtaModel.js
// TEAM D — pure decision model for the Shopify gift CTA on Maker-Gift catalog cards.
// Keeps the component thin + unit-testable: NO React, NO network. The CTA is shown ONLY
// when a valid fundraiser attribution token is present AND the catalog item has a giftable
// variant (available + a valid Greet-Me canonical variant id carrying a numeric tail + a
// finite non-negative price). Otherwise the card stays "Available soon" (display-only).

import { isValidTokenSyntax } from "./attributionCarrier.js";

// The canonical variant id the client sends to /api/gifts/checkout (server excludes raw Shopify
// GIDs). Shape: gm-var-<numeric>. The numeric tail is what becomes the cart-permalink variant.
const VARIANT_ID_RE = /^gm-var-\d+$/;

export function isGiftableVariant(v) {
  return Boolean(
    v &&
    v.available === true &&
    typeof v.id === "string" &&
    VARIANT_ID_RE.test(v.id) &&
    typeof v.priceCents === "number" &&
    Number.isFinite(v.priceCents) &&
    v.priceCents >= 0
  );
}

// First giftable variant of a catalog item, or null. (Launch: quantity fixed at 1; a single
// available variant is the common Maker-Gift case.)
export function pickGiftVariant(item) {
  if (!item || !Array.isArray(item.variants)) return null;
  return item.variants.find(isGiftableVariant) || null;
}

// The CTA decision for one card. Returns { showCta, variantId }.
export function giftCtaState({ token, item } = {}) {
  const variant = pickGiftVariant(item);
  const showCta = isValidTokenSyntax(token) && variant != null;
  return { showCta, variantId: showCta ? variant.id : null };
}
