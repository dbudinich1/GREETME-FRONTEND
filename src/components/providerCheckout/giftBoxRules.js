// src/components/providerCheckout/giftBoxRules.js
//
// The gift-box checkout's own rules as pure functions and constants, moved out of GiftBoxCheckoutModal.jsx unchanged
// (the modal imports and re-exports them). Shared with the dashboard's group gift boxes (G7) so a group order is
// validated, quoted and judged exactly like a single checkout. No React, no Stripe, no network here.

export const GIFT_BOX_LIMITS = Object.freeze({ maxQuantity: 10 });
export const DEFAULT_QUOTE_VALID_MS = 120000;

const trimmed = (v) => (typeof v === 'string' ? v.trim() : '');

export const EMPTY_GIFT_BOX_FORM = {
  firstName: '', lastName: '', address1: '', address2: '', city: '', state: '', postalCode: '',
  phone: '', quantity: '1',
};

/** Client-side validation. The backend re-validates everything; this only saves a round trip. */
export function validateGiftBoxForm(form) {
  const errors = {};
  if (!trimmed(form.firstName)) errors.firstName = 'Enter the recipient’s first name.';
  if (!trimmed(form.address1)) errors.address1 = 'Enter the street address.';
  if (!trimmed(form.city)) errors.city = 'Enter the city.';
  if (!/^[A-Za-z]{2}$/.test(trimmed(form.state))) errors.state = 'Use the 2-letter state code, e.g. NJ.';
  if (!/^\d{5}(-\d{4})?$/.test(trimmed(form.postalCode))) errors.postalCode = 'Enter a 5-digit ZIP (or ZIP+4).';
  const qty = Number(form.quantity);
  if (!Number.isInteger(qty) || qty < 1 || qty > GIFT_BOX_LIMITS.maxQuantity) {
    errors.quantity = `Choose a quantity from 1 to ${GIFT_BOX_LIMITS.maxQuantity}.`;
  }
  return errors;
}

/** The selection + recipient body shared by the quote and the charge. Empty optionals are omitted. */
export function toGiftBoxQuoteRequest(form, product) {
  const address = {
    address1: trimmed(form.address1),
    city: trimmed(form.city),
    state: trimmed(form.state).toUpperCase(),
    postalCode: trimmed(form.postalCode),
    country: 'US',
  };
  if (trimmed(form.address2)) address.address2 = trimmed(form.address2);
  const recipient = { address };
  if (trimmed(form.firstName)) recipient.firstName = trimmed(form.firstName);
  if (trimmed(form.lastName)) recipient.lastName = trimmed(form.lastName);
  return {
    providerProductId: String(product?.providerProductId ?? ''),
    quantity: Number(form.quantity),
    recipient,
  };
}

/**
 * The checkout's own acceptance rules for a quote response, as a pure function (moved out of fetchQuote unchanged):
 * both the fee-inclusive and the fee-free figures are required, and the server's four display lines must add up to
 * the charge exactly. Returns { quote } or { failure } (customer-safe copy).
 */
export function parseGiftBoxQuote(res, now = Date.now()) {
  if (res?.networkError) return { failure: 'We could not reach Greet-Me. Please check your connection and try again.' };
  if (!res?.ok || !Number.isSafeInteger(res.quotedTotalCents) || res.quotedTotalCents <= 0
      || !Number.isSafeInteger(res.providerQuotedTotalCents) || res.providerQuotedTotalCents <= 0
      || !res.quotedAt) {
    return { failure: res?.status === 401 ? 'Your session has expired. Please sign in again.' : giftBoxErrorCopy(res) };
  }
  const d = res.display;
  const lines = d && [d.productCents, d.shippingHandlingCents, d.taxCents, d.totalCents];
  if (!lines || !lines.every(Number.isSafeInteger) || d.productCents <= 0 || d.shippingHandlingCents < 0 || d.taxCents < 0
      || d.productCents + d.shippingHandlingCents + d.taxCents !== d.totalCents || d.totalCents !== res.quotedTotalCents) {
    return { failure: giftBoxErrorCopy(res) };
  }
  return {
    quote: {
      display: { productCents: d.productCents, shippingHandlingCents: d.shippingHandlingCents, taxCents: d.taxCents, totalCents: d.totalCents },
      quotedTotalCents: res.quotedTotalCents,
      providerQuotedTotalCents: res.providerQuotedTotalCents,
      feeCents: Number.isSafeInteger(res.feeCents) ? res.feeCents : null,
      quotedAt: res.quotedAt,
      validForMs: Number(res.quoteValidForMs) || DEFAULT_QUOTE_VALID_MS,
      receivedAt: now,
    },
  };
}

/** A quote older than its validity window (2 minutes by default) is never charged against. */
export const isGiftBoxQuoteExpired = (q, now = Date.now()) => !q || (now - q.receivedAt) >= (q.validForMs || DEFAULT_QUOTE_VALID_MS);

/** Customer-safe copy for every quote-route error code. Never a raw server string, except the one
 * the backend already writes for customers (a refused destination). */
export function giftBoxErrorCopy(err) {
  const code = err?.code;
  switch (code) {
    case 'gift_box_quote_refused':
      return err?.message || 'This gift box can’t be shipped to that address.';
    case 'INVALID_REQUEST':
      return 'Please check the recipient’s name and address — we couldn’t use them as entered.';
    case 'gift_box_product_unavailable':
    case 'gift_box_product_unsupported':
      return 'This gift box isn’t available right now. Please choose another.';
    case 'gift_box_selection_invalid':
      return 'This gift box can’t be ordered as selected. Please choose another option.';
    case 'gift_box_quote_failed':
    case 'gift_box_quote_not_authoritative':
      return 'We couldn’t get a price for this gift box right now. Please try again in a moment.';
    case 'gift_box_unavailable':
    case 'gift_box_product_lookup_failed':
      return 'Gift boxes are temporarily unavailable. Please try again later.';
    case 'gift_box_request_conflict':
      return 'This checkout was already used for a different order. Please close it and start again.';
    case 'RATE_LIMIT_GENERAL':
      return 'Too many attempts. Please wait a moment and try again.';
    default:
      return 'We couldn’t price this gift box. Please try again.';
  }
}

/** Errors that the backend raises BEFORE any charge is attempted — so a fresh attempt is safe. */
export const PRE_CHARGE_CODES = new Set([
  'INVALID_REQUEST', 'gift_box_product_unavailable', 'gift_box_product_unsupported',
  'gift_box_selection_invalid', 'gift_box_quote_refused', 'gift_box_quote_failed',
  'gift_box_quote_not_authoritative', 'gift_box_unavailable', 'gift_box_product_lookup_failed',
  'gift_box_request_conflict',
]);

export const OUTCOME_UNKNOWN_MESSAGE = 'We couldn’t confirm whether your payment went through. Please don’t try '
  + 'again from here — check your orders, or contact support and we’ll sort it out.';
export const PAID_NOT_FINALIZED_MESSAGE = 'Your payment went through, but we couldn’t finish placing your gift box '
  + 'order. Please try again — you will not be charged again.';
export const PENDING_FALLBACK_MESSAGE = 'Your payment was received. We’re still confirming your gift box order — '
  + 'check back shortly, or contact support if this persists.';
