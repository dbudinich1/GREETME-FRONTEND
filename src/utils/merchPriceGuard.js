// src/utils/merchPriceGuard.js
//
// Merch expected-price guard (contract: T2-fee-policy-implementation.md, section 3B).
//
// POST /api/payments/create-checkout with purchaseType "merch" takes `expectedSubtotalCents`: the sum
// of the ITEM prices the customer was SHOWN (shipping is never part of it). If the server's
// subtotal differs it answers 409 MERCH_PRICE_CHANGED (or, with the field missing once the rate is
// above 0, MERCH_PRICE_CONFIRMATION_REQUIRED) with the new `subtotalCents` and per-item `priceCents`,
// and NOTHING is charged, created or consumed. The page must then show the new prices and total and
// let the customer confirm with a fresh click; it must never retry at a new price on its own.
//
// Nothing here describes a fee: the price change is presented only as "the item price changed".

export const MERCH_PRICE_CHANGED = 'MERCH_PRICE_CHANGED';
export const MERCH_PRICE_CONFIRMATION_REQUIRED = 'MERCH_PRICE_CONFIRMATION_REQUIRED';

/** True for the two 409 codes that mean "show new prices and reconfirm, nothing was charged". */
export function isMerchPriceConfirmationCode(code) {
  return code === MERCH_PRICE_CHANGED || code === MERCH_PRICE_CONFIRMATION_REQUIRED;
}

/** The item price in whole cents EXACTLY as the cart displays it (priceCents, else price in dollars). */
export function displayedItemCents(item) {
  if (Number.isSafeInteger(item?.priceCents) && item.priceCents >= 0) return item.priceCents;
  const dollars = typeof item?.price === 'number' ? item.price : parseFloat(item?.price) || 0;
  return Math.round(dollars * 100);
}

/** Sum of the displayed ITEM prices of the merch lines (the lines sent to create-checkout). Shipping excluded. */
export function expectedMerchSubtotalCents(cartItems) {
  return (cartItems || [])
    .filter((i) => !!i?.printfulSyncVariantId)
    .reduce((sum, i) => sum + displayedItemCents(i), 0);
}

/**
 * Validate a 409 body and apply it to the cart lines. Returns null when the body cannot be trusted
 * (so the caller shows a generic "please refresh" message and never displays unverified numbers):
 *   { items: updatedCartItems, previousCents, subtotalCents }
 * The body is trusted only if every merch line is covered by `items[]` and the per-item prices sum
 * to `subtotalCents`.
 */
export function applyMerchPriceChange(cartItems, body) {
  if (!body || !Number.isSafeInteger(body.subtotalCents) || body.subtotalCents < 0 || !Array.isArray(body.items)) return null;
  const byVariant = new Map();
  for (const it of body.items) {
    if (!it || it.syncVariantId == null || !Number.isSafeInteger(it.priceCents) || it.priceCents < 0) return null;
    byVariant.set(String(it.syncVariantId), it.priceCents);
  }
  const merchLines = (cartItems || []).filter((i) => !!i?.printfulSyncVariantId);
  let sum = 0;
  for (const line of merchLines) {
    const cents = byVariant.get(String(line.printfulSyncVariantId));
    if (cents === undefined) return null;
    sum += cents;
  }
  if (sum !== body.subtotalCents) return null;
  const updated = (cartItems || []).map((i) => {
    if (!i?.printfulSyncVariantId) return i;
    const cents = byVariant.get(String(i.printfulSyncVariantId));
    return { ...i, priceCents: cents, price: cents / 100 };
  });
  return { items: updated, previousCents: expectedMerchSubtotalCents(cartItems), subtotalCents: body.subtotalCents };
}

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

/** Customer-facing notice for an applied change. Item prices only: no fee, markup or percentage wording. */
export function merchPriceNotice({ code, previousCents, subtotalCents }) {
  if (code === MERCH_PRICE_CONFIRMATION_REQUIRED || previousCents === subtotalCents) {
    return `We refreshed the prices in your cart. Your item subtotal is ${money(subtotalCents)}. Nothing has been charged. Please review it and place your order again.`;
  }
  return `The price of the items in your cart changed from ${money(previousCents)} to ${money(subtotalCents)}. Nothing has been charged. Please review the updated prices and place your order again.`;
}
