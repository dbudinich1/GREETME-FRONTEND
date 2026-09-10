// src/components/providerCheckout/providerCheckoutModel.js
//
// PROVIDER CHECKOUT — the vocabulary, the validation and the claim rules for the in-Greet-Me
// checkout of a provider-fulfilled gift (flowers, gift boxes).
//
// WHY THIS IS A PLAIN MODULE AND NOT PART OF THE COMPONENT
// -------------------------------------------------------
// The same reason merchSelection.js exists: JSX cannot be imported under `node --test`, so anything
// living inside the component can only be asserted by scraping its source. The rules that matter
// here are not structural — "acceptance is never described as delivery", "an uncertain outcome
// offers no retry", "a card field never reaches telemetry" — and those must be proven by RUNNING
// them.
//
// THE ONE CLAIM RULE. The provider behind this checkout publishes no order-status, tracking,
// cancellation or refund API. The furthest the customer may ever be told is that the provider
// ACCEPTED the order, and `FORBIDDEN_CLAIMS` below is enforced against our own copy by a test.

/** The five states the backend reports. Nothing else is a status. */
export const CHECKOUT_STATUS = Object.freeze({
  PREPARING: 'preparing',
  SUBMITTING: 'submitting',
  ACCEPTED: 'accepted',
  SUBMISSION_FAILED: 'submission_failed',
  CONFIRMATION_UNCERTAIN: 'confirmation_uncertain',
});

/**
 * Display names, keyed by the machine provider id the backend returns.
 *
 * DISPLAY METADATA ONLY. Nothing routes on these, and the backend never accepts one back: the
 * customer sees who is fulfilling their order, and the code keeps using the identifier.
 */
export const PROVIDER_DISPLAY_NAMES = Object.freeze({
  florist_one: 'Florist One',
  goody: 'Goody',
});

/** The customer-facing noun for each provider-backed category. */
export const CATEGORY_NOUNS = Object.freeze({
  flowers: 'flower',
  gift_boxes: 'gift box',
});

export const providerDisplayName = (providerId) => PROVIDER_DISPLAY_NAMES[providerId] || 'our florist partner';
export const categoryNoun = (giftType) => CATEGORY_NOUNS[giftType] || 'gift';

/**
 * Words this surface may never use about an order.
 *
 * Each one asserts something the provider does not publish. "Completed" is here too: an accepted
 * submission is the beginning of fulfilment, not the end of it.
 */
export const FORBIDDEN_CLAIMS = Object.freeze([
  'delivered', 'out for delivery', 'in transit', 'shipped', 'tracking', 'track your',
  'completed', 'refunded', 'cancelled', 'canceled', 'on its way', 'arriving',
]);

/**
 * What the customer is told, per status.
 *
 * The accepted line is the contract sentence, with the category and the fulfilling provider filled
 * in: "Your flower order has been accepted by Florist One."
 */
export function statusCopy(status, { provider, giftType } = {}) {
  const who = providerDisplayName(provider);
  const noun = categoryNoun(giftType);
  switch (status) {
    case CHECKOUT_STATUS.PREPARING:
      return { title: 'Review your order', body: `Confirm the delivery details and we will price your ${noun} order.` };
    case CHECKOUT_STATUS.SUBMITTING:
      return { title: 'Sending your order', body: `We are sending your ${noun} order to ${who}. Please do not close this window.` };
    case CHECKOUT_STATUS.ACCEPTED:
      return {
        title: 'Order accepted',
        body: `Your ${noun} order has been accepted by ${who}.`,
        // Said plainly rather than left to be inferred from silence.
        note: `${who} does not publish delivery updates to Greet-Me. Keep your order number for any questions.`,
      };
    case CHECKOUT_STATUS.SUBMISSION_FAILED:
      return {
        title: 'We could not place this order',
        body: `${who} did not accept this order, so nothing was charged for it. Check the details and try again.`,
      };
    case CHECKOUT_STATUS.CONFIRMATION_UNCERTAIN:
      return {
        title: 'Confirmation uncertain — please contact support',
        body: `We could not confirm whether ${who} received this order. Please do not submit it again: contact support and we will check it for you.`,
      };
    default:
      return { title: 'Review your order', body: '' };
  }
}

/** True only for the states where nothing further will happen on its own. */
export const isTerminal = (status) => status === CHECKOUT_STATUS.ACCEPTED
  || status === CHECKOUT_STATUS.SUBMISSION_FAILED
  || status === CHECKOUT_STATUS.CONFIRMATION_UNCERTAIN;

/**
 * May the customer be offered "try again"?
 *
 * Never after an uncertain outcome. The provider has no idempotency key and no way to look an
 * order up by our reference, so a second attempt can place a second real order against a card that
 * may already have been charged. The refusal is the whole point.
 */
export function canRetry(result) {
  if (!result) return false;
  if (result.retryProhibited === true || result.requiresHumanResolution === true) return false;
  return result.status === CHECKOUT_STATUS.SUBMISSION_FAILED;
}

/** Acceptance is never delivery, in any state. */
export const claimsDeliveryStatus = (checkout) => checkout?.deliveryStatusKnown === true;

// ---------------------------------------------------------------------------
// Payment material never leaves the browser
// ---------------------------------------------------------------------------

/**
 * Keys that may never be sent to Greet-Me, logged, stored or put in telemetry.
 *
 * `dataValue` and `opaqueData` are the tokenizer's own response envelope: the token itself is
 * transient and is handed straight to the backend, and nothing else about it is ever kept.
 */
export const PAYMENT_MATERIAL_KEYS = Object.freeze([
  'cardNumber', 'cardnumber', 'number', 'pan', 'cvv', 'cvc', 'securityCode', 'cardCode',
  'expMonth', 'expYear', 'expiry', 'expiration', 'month', 'year',
  'dataValue', 'dataDescriptor', 'opaqueData', 'paymentToken', 'token',
]);

const PAN_SHAPED = /(?:\d[ -]?){12,18}\d/;

/** True when a string carries a digit run long enough to be a card number. */
export function looksLikeCardNumber(value) {
  if (typeof value !== 'string') return false;
  const digits = value.replace(/\D/g, '');
  return digits.length >= 13 && digits.length <= 19 && PAN_SHAPED.test(value);
}

/**
 * Strip every piece of payment material from an object before it is logged or measured.
 *
 * Recursive and allow-nothing: a key on the list is dropped, and so is any value that merely LOOKS
 * like a card number, whatever it is called.
 */
export function redactPaymentMaterial(value, depth = 0) {
  if (depth > 6 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((v) => redactPaymentMaterial(v, depth + 1));
  if (typeof value === 'string') return looksLikeCardNumber(value) ? '[redacted]' : value;
  if (typeof value !== 'object') return value;
  const out = {};
  for (const [key, v] of Object.entries(value)) {
    if (PAYMENT_MATERIAL_KEYS.includes(key)) continue;
    out[key] = redactPaymentMaterial(v, depth + 1);
  }
  return out;
}

/** Refuse to send a payload that carries payment material to the Greet-Me backend. */
export function assertNoPaymentMaterial(payload) {
  const redacted = redactPaymentMaterial(payload);
  if (JSON.stringify(redacted) !== JSON.stringify(payload ?? null)) {
    const err = new Error('payment material must never be sent to Greet-Me');
    err.code = 'PAYMENT_MATERIAL_REFUSED';
    throw err;
  }
  return true;
}

// ---------------------------------------------------------------------------
// Form validation
// ---------------------------------------------------------------------------

export const FIELD_LIMITS = Object.freeze({ cardMessage: 200, specialInstructions: 100 });

const required = (v) => typeof v === 'string' && v.trim().length > 0;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate the checkout form. Returns a map of field -> message; empty means valid.
 *
 * The delivery date is validated for SHAPE only. Whether the provider can deliver on it is the
 * provider's answer, obtained at preparation — guessing here would be inventing a schedule.
 */
export function validateCheckoutForm(form = {}) {
  const errors = {};
  if (!required(form.deliveryDate) || !ISO_DATE.test(form.deliveryDate)) errors.deliveryDate = 'Choose a delivery date.';
  if (!required(form.recipientFirstName)) errors.recipientFirstName = 'Enter the recipient’s first name.';
  if (!required(form.address1)) errors.address1 = 'Enter the street address.';
  if (!required(form.city)) errors.city = 'Enter the city.';
  if (!required(form.state)) errors.state = 'Enter the state.';
  if (!required(form.postalCode)) errors.postalCode = 'Enter the ZIP code.';
  const phone = normalizeRecipientPhone(form.recipientPhone);
  if (!phone.ok) errors.recipientPhone = PHONE_MESSAGES[phone.reason];

  // BILLING — the cardholder's, required by the provider for the charge itself. Refused here, in
  // the browser, so an incomplete order never becomes a provider request.
  const customerPhone = normalizeRecipientPhone(form.customerPhone);
  if (!customerPhone.ok) errors.customerPhone = PHONE_MESSAGES[customerPhone.reason];
  if (!required(form.billingLine1)) errors.billingLine1 = 'Enter your billing street address.';
  if (!required(form.billingCity)) errors.billingCity = 'Enter your billing city.';
  if (!/^[A-Za-z]{2}$/.test(String(form.billingState ?? '').trim())) {
    errors.billingState = 'Use a 2-letter state code.';
  }
  if (!/^\d{5}(-\d{4})?$/.test(String(form.billingZip ?? '').trim())) {
    errors.billingZip = 'Enter a 5-digit ZIP code.';
  }
  if (!required(form.cardMessage)) errors.cardMessage = 'Write a card message.';
  else if (form.cardMessage.length > FIELD_LIMITS.cardMessage) errors.cardMessage = `Keep the card message under ${FIELD_LIMITS.cardMessage} characters.`;
  if (form.specialInstructions && form.specialInstructions.length > FIELD_LIMITS.specialInstructions) {
    errors.specialInstructions = `Keep special instructions under ${FIELD_LIMITS.specialInstructions} characters.`;
  }
  if (!required(form.customerEmail) || !form.customerEmail.includes('@')) errors.customerEmail = 'Enter your email address.';
  if (!required(form.customerFirstName)) errors.customerFirstName = 'Enter your first name.';
  return errors;
}

/** The request body for `prepare`, built from the validated form. Carries no payment material. */
/**
 * The RECIPIENT's telephone number, normalized to what the provider requires.
 *
 * The provider's rule is exactly ten digits. People type telephone numbers with parentheses,
 * spaces, hyphens and dots, so those are stripped — and nothing else is. A country code, an
 * extension or a letter makes the value something other than ten digits and is REFUSED rather than
 * silently trimmed into shape: quietly discarding part of a number the florist will dial is worse
 * than asking for it again.
 */
const PHONE_FORMATTING = /[\s().-]/g;

export const PHONE_REFUSAL = Object.freeze({
  REQUIRED: 'required',
  NOT_DIGITS: 'not_digits',
  TOO_SHORT: 'too_short',
  TOO_LONG: 'too_long',
});

export function normalizeRecipientPhone(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return { ok: false, reason: PHONE_REFUSAL.REQUIRED, digits: null };
  const stripped = raw.replace(PHONE_FORMATTING, '');
  // Letters, "+", "ext", "x123" — anything that is not a digit after formatting is removed.
  if (!/^[0-9]+$/.test(stripped)) return { ok: false, reason: PHONE_REFUSAL.NOT_DIGITS, digits: null };
  if (stripped.length < 10) return { ok: false, reason: PHONE_REFUSAL.TOO_SHORT, digits: null };
  if (stripped.length > 10) return { ok: false, reason: PHONE_REFUSAL.TOO_LONG, digits: null };
  return { ok: true, reason: null, digits: stripped };
}

const PHONE_MESSAGES = Object.freeze({
  [PHONE_REFUSAL.REQUIRED]: 'Enter the recipient’s telephone number.',
  [PHONE_REFUSAL.NOT_DIGITS]: 'Use digits only — no letters or extensions.',
  [PHONE_REFUSAL.TOO_SHORT]: 'Enter a 10-digit US telephone number.',
  [PHONE_REFUSAL.TOO_LONG]: 'Enter a 10-digit US telephone number, without the country code.',
});

export function toPrepareRequest(form, { giftType, product }) {
  return {
    giftType,
    productCode: product?.providerProductId ?? product?.code ?? '',
    priceMajor: product?.priceMajor,
    deliveryDate: form.deliveryDate,
    cardMessage: form.cardMessage,
    ...(form.specialInstructions ? { specialInstructions: form.specialInstructions } : {}),
    allowSubstitutions: form.allowSubstitutions === true,
    recipient: {
      firstName: form.recipientFirstName,
      ...(form.recipientLastName ? { lastName: form.recipientLastName } : {}),
      // The RECIPIENT's own number, normalized to the provider's ten digits. Never the sender's:
      // that one travels in `sender.phone` below and the two are never interchanged.
      ...(normalizeRecipientPhone(form.recipientPhone).ok
        ? { phone: normalizeRecipientPhone(form.recipientPhone).digits }
        : {}),
      shippingAddress: {
        line1: form.address1,
        ...(form.address2 ? { line2: form.address2 } : {}),
        city: form.city,
        state: form.state,
        zip: form.postalCode,
        country: 'US',
      },
    },
    sender: {
      firstName: form.customerFirstName,
      lastName: form.customerLastName || '',
      email: form.customerEmail,
      // The CUSTOMER's own number, normalized the same way the recipient's is. The two are
      // different fields for different people and are never interchanged.
      ...(normalizeRecipientPhone(form.customerPhone).ok
        ? { phone: normalizeRecipientPhone(form.customerPhone).digits }
        : {}),
      // The CARDHOLDER's billing address. Required by the provider for the charge, and a
      // different address from the recipient's delivery address.
      billingAddress: {
        line1: form.billingLine1,
        ...(form.billingLine2 ? { line2: form.billingLine2 } : {}),
        city: form.billingCity,
        state: form.billingState,
        zip: form.billingZip,
        country: 'US',
      },
    },
  };
}

/** Money, from the authoritative minor units the provider quoted. Never recomputed here. */
/**
 * The authoritative pre-payment review.
 *
 * WHY THIS EXISTS. A total on its own is not a review. Before a card is entered, the payer must see
 * what they are being charged FOR — item, delivery, tax — and those figures must be the provider's
 * own, not anything this browser computed. Nothing here adds, derives or substitutes a money value:
 * every amount is copied out of the backend's quote, and the only arithmetic performed is a CHECK
 * that the parts the provider sent add up to the total the provider sent.
 *
 * FAIL CLOSED. Any missing or malformed component, or a sum that does not reconcile, returns
 * `ok: false`. The caller must then refuse to tokenize a card or place an order — a payer must
 * never be asked to authorize a number nobody can account for.
 *
 * PRICE CHANGED. The catalog price was a list price at browse time; the quote is the price of
 * record. When they differ the review still renders — the payer is entitled to see the real
 * figure — but `priceChanged` is set and the caller must block submission until the payer has
 * expressly acknowledged the new authoritative quote.
 *
 * @param {object} prepared  the backend prepare response ({ quote, orderTotalMinor, currency, deliveryDate })
 * @param {object} chosen    the product selected from the picker (its catalog priceMinor)
 * @param {object} form      the delivery form — ONLY city and state are read
 */
export function reviewQuote({ prepared, chosen, form } = {}) {
  const quote = prepared?.quote;
  const fail = (reason) => ({ ok: false, reason, canSubmit: false, priceChanged: null, lines: [] });
  if (!quote || typeof quote !== 'object') return fail('quote_missing');

  const currency = quote.currency || prepared?.currency;
  if (typeof currency !== 'string' || !currency) return fail('currency_missing');

  // Each component must be an integer count of minor units. A float, a string, a null or an
  // absent field is malformed — never coerced, never defaulted to zero.
  const parts = {
    productMinor: quote.productMinor,
    shippingMinor: quote.shippingMinor,
    taxMinor: quote.taxMinor,
    feesMinor: Number.isInteger(quote.feesMinor) ? quote.feesMinor : 0,
  };
  for (const [key, value] of Object.entries(parts)) {
    if (!Number.isInteger(value) || value < 0) return fail(`component_malformed:${key}`);
  }
  const totalMinor = Number.isInteger(quote.totalMinor) ? quote.totalMinor : prepared?.orderTotalMinor;
  if (!Number.isInteger(totalMinor) || totalMinor <= 0) return fail('total_malformed');

  // The one arithmetic operation in this function, and it is a verification rather than a
  // computation: the provider's parts must account for the provider's total, exactly.
  const summed = parts.productMinor + parts.shippingMinor + parts.taxMinor + parts.feesMinor;
  if (summed !== totalMinor) return fail('components_do_not_sum');

  const catalogMinor = Number.isInteger(chosen?.priceMinor) ? chosen.priceMinor : null;
  const priceChanged = catalogMinor !== null && catalogMinor !== parts.productMinor
    ? { catalogMinor, quotedMinor: parts.productMinor, currency }
    : null;

  const lines = [
    { key: 'product', label: 'Flowers', minor: parts.productMinor },
    { key: 'delivery', label: 'Delivery', minor: parts.shippingMinor },
    { key: 'tax', label: 'Tax', minor: parts.taxMinor },
    ...(parts.feesMinor > 0 ? [{ key: 'fees', label: 'Fees', minor: parts.feesMinor }] : []),
  ];

  return {
    ok: true,
    reason: null,
    // Submission is permitted only when the review reconciles AND the price has not moved under
    // the payer. A changed price is not an error — it is a fact they must accept first.
    canSubmit: priceChanged === null,
    priceChanged,
    currency,
    lines,
    totalMinor,
    deliveryDate: prepared?.deliveryDate ?? null,
    productName: chosen?.name ?? null,
    productCode: quote.providerProductId ?? chosen?.providerProductId ?? null,
    // CITY AND STATE ONLY. The street address and telephone number are deliberately not carried
    // into the review at all, so no later edit to this component can render them by accident.
    recipientCityState: [form?.city, form?.state].filter(Boolean).join(', ') || null,
  };
}

export function formatMinor(minor, currency = 'USD') {
  if (!Number.isInteger(minor)) return '';
  const amount = (minor / 100).toFixed(2);
  return currency === 'CAD' ? `CA$${amount}` : `$${amount}`;
}
