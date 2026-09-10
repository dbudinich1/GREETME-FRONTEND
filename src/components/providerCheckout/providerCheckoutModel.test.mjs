// src/components/providerCheckout/providerCheckoutModel.test.mjs
//
// PROVIDER CHECKOUT — the claim rules, the validation, and the promise that payment material never
// leaves the browser. The rules live in a plain module precisely so they can be RUN here rather
// than matched against JSX.
//
// Run (Node 20.x): node --test src/components/providerCheckout/providerCheckoutModel.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import {
  CHECKOUT_STATUS, DISPATCHED, FORBIDDEN_CLAIMS, PAYMENT_MATERIAL_KEYS, assertNoPaymentMaterial, canRetry,
  categoryNoun, claimsDeliveryStatus, formatMinor, isTerminal, looksLikeCardNumber,
  normalizeRecipientPhone, providerDisplayName, redactPaymentMaterial, reviewQuote, statusCopy,
  toPrepareRequest, validateCheckoutForm,
} from './providerCheckoutModel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, rel), 'utf8');

const VALID_FORM = {
  deliveryDate: '2026-09-15', recipientFirstName: 'Dana', recipientLastName: 'Rivers',
  address1: '12 Elm St', city: 'Newark', state: 'NJ', postalCode: '07102',
  // The provider requires the RECIPIENT's number; the sender's is a separate field, deliberately
  // different here so a test can prove the two are never interchanged.
  recipientPhone: '(201) 555-0123',
  cardMessage: 'Thinking of you', customerFirstName: 'Sam', customerEmail: 'sam@example.com',
  customerPhone: '9735551111',
  // The CARDHOLDER's billing details — deliberately a different address from the delivery one.
  billingLine1: '1 Sender St', billingLine2: 'Apt 2', billingCity: 'Hoboken',
  billingState: 'NJ', billingZip: '07030',
};

// ===========================================================================
// What the customer may be told
// ===========================================================================

test('acceptance is the furthest claim, and it names the provider', () => {
  const copy = statusCopy(CHECKOUT_STATUS.ACCEPTED, { provider: 'florist_one', giftType: 'flowers' });
  assert.equal(copy.body, 'Your flower order has been accepted by Florist One.');
  assert.match(copy.note, /does not publish delivery updates/);
});

test('a failure Greet-Me generated itself is never attributed to the provider', () => {
  // The order never left Greet-Me, so saying the provider refused it would be a false statement
  // about a third party. The customer still gets the two facts that matter: it did not go through,
  // and nothing was charged.
  for (const dispatched of [DISPATCHED.NO, null, undefined]) {
    const copy = statusCopy(CHECKOUT_STATUS.SUBMISSION_FAILED, {
      provider: 'florist_one', giftType: 'flowers', dispatched,
    });
    assert.doesNotMatch(copy.body, /Florist One/,
      `a failure with dispatched=${String(dispatched)} must not name the provider`);
    assert.match(copy.body, /Nothing was charged/);
  }
});

test('a refusal the provider actually made may be described as theirs', () => {
  const copy = statusCopy(CHECKOUT_STATUS.SUBMISSION_FAILED, {
    provider: 'florist_one', giftType: 'flowers', dispatched: DISPATCHED.YES,
  });
  assert.match(copy.body, /Florist One did not accept this order/);
  assert.match(copy.body, /nothing was charged/);
});

test('a quote that changed is explained without blaming the provider or implying a charge', () => {
  const copy = statusCopy(CHECKOUT_STATUS.QUOTE_CHANGED, { provider: 'florist_one', giftType: 'flowers' });
  assert.match(copy.body, /price of this flower order changed/i);
  assert.match(copy.body, /nothing was charged/i);
  assert.doesNotMatch(copy.body, /Florist One/, 'the provider was never asked, so it cannot have refused');
  assert.equal(/did not accept|rejected|declined/i.test(`${copy.title} ${copy.body}`), false);
});

test('a changed quote is neither terminal nor retryable — it is a return to the review', () => {
  // Retry here would mean paying again at a price nobody has agreed to. The only way forward is a
  // fresh quote and a fresh acknowledgement, which is a new deliberate action, not a retry.
  assert.equal(isTerminal(CHECKOUT_STATUS.QUOTE_CHANGED), false);
  assert.equal(canRetry({ status: CHECKOUT_STATUS.QUOTE_CHANGED }), false);
  assert.equal(claimsDeliveryStatus({ status: CHECKOUT_STATUS.QUOTE_CHANGED }), false);
});

test('no status copy ever claims delivery, tracking, completion or a refund', () => {
  for (const status of Object.values(CHECKOUT_STATUS)) {
    for (const provider of ['florist_one', 'goody', 'unknown_provider']) {
      const copy = statusCopy(status, { provider, giftType: 'flowers' });
      const text = `${copy.title} ${copy.body} ${copy.note || ''}`.toLowerCase();
      for (const claim of FORBIDDEN_CLAIMS) {
        assert.equal(text.includes(claim), false, `"${claim}" must not appear in ${status} copy`);
      }
    }
  }
});

test('the rendered surfaces contain no forbidden claim either', () => {
  // The copy module is where wording is supposed to live, so the components are checked too: a
  // stray "your flowers are on their way" in JSX would be exactly as untrue.
  for (const file of ['ProviderCheckoutModal.jsx', 'ProviderCheckoutEntry.jsx']) {
    // Only what a customer could READ is checked: comments discuss what must never be claimed, and
    // identifiers ("cancelled" as a cleanup flag) are not copy.
    const source = read(file).replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    const literals = [...source.matchAll(/'([^'\\]*)'|"([^"\\]*)"|`([^`]*)`/g)].map((m) => m[1] ?? m[2] ?? m[3]);
    const jsxText = [...source.matchAll(/>([^<>{}]+)</g)].map((m) => m[1]);
    const visible = [...literals, ...jsxText].join(' \n ').toLowerCase();
    for (const claim of FORBIDDEN_CLAIMS) {
      assert.equal(visible.includes(claim), false, `${file} must not claim "${claim}"`);
    }
  }
});

test('an uncertain outcome never offers a retry; a definite rejection may', () => {
  assert.equal(canRetry({ status: CHECKOUT_STATUS.CONFIRMATION_UNCERTAIN, retryProhibited: true }), false);
  assert.equal(canRetry({ status: CHECKOUT_STATUS.CONFIRMATION_UNCERTAIN }), false);
  assert.equal(canRetry({ status: CHECKOUT_STATUS.ACCEPTED }), false);
  assert.equal(canRetry({ status: CHECKOUT_STATUS.SUBMISSION_FAILED }), true);
  assert.equal(canRetry({ status: CHECKOUT_STATUS.SUBMISSION_FAILED, requiresHumanResolution: true }), false);
  assert.equal(canRetry(null), false);
});

test('every terminal state is terminal, and acceptance never implies delivery', () => {
  assert.equal(isTerminal(CHECKOUT_STATUS.ACCEPTED), true);
  assert.equal(isTerminal(CHECKOUT_STATUS.SUBMISSION_FAILED), true);
  assert.equal(isTerminal(CHECKOUT_STATUS.CONFIRMATION_UNCERTAIN), true);
  assert.equal(isTerminal(CHECKOUT_STATUS.PREPARING), false);
  assert.equal(claimsDeliveryStatus({ status: CHECKOUT_STATUS.ACCEPTED, deliveryStatusKnown: false }), false);
});

test('provider and category names are display metadata with safe fallbacks', () => {
  assert.equal(providerDisplayName('florist_one'), 'Florist One');
  assert.equal(categoryNoun('flowers'), 'flower');
  assert.equal(categoryNoun('gift_boxes'), 'gift box');
  assert.equal(categoryNoun('merch'), 'gift');
  assert.match(providerDisplayName('who_knows'), /partner/);
});

// ===========================================================================
// Payment material never leaves the browser
// ===========================================================================

test('payment material is stripped from anything that could be logged', () => {
  const payload = {
    attemptId: 'gpc_1', cardNumber: '4111111111111111', cvv: '123', expMonth: '01', expYear: '30',
    opaqueData: { dataDescriptor: 'x', dataValue: 'TOKEN' }, paymentToken: 'TOKEN',
    recipient: { firstName: 'Dana', note: '4111 1111 1111 1111' },
  };
  const redacted = redactPaymentMaterial(payload);
  const text = JSON.stringify(redacted);
  for (const leaked of ['4111', 'TOKEN', '123']) {
    assert.equal(text.includes(leaked), false, `redaction leaked ${leaked}`);
  }
  assert.equal(redacted.attemptId, 'gpc_1');
  assert.equal(redacted.recipient.firstName, 'Dana');
});

test('a payload carrying payment material is refused before it can be sent', () => {
  for (const bad of [{ cardNumber: '4111111111111111' }, { cvv: '123' }, { paymentToken: 't' },
    { nested: { opaqueData: {} } }, { note: '4111-1111-1111-1111' }]) {
    assert.throws(() => assertNoPaymentMaterial(bad), (e) => e.code === 'PAYMENT_MATERIAL_REFUSED');
  }
  assert.equal(assertNoPaymentMaterial(toPrepareRequest(VALID_FORM, { giftType: 'flowers', product: { code: 'P1' } })), true);
});

test('the prepare request carries the order and no payment material at all', () => {
  const body = toPrepareRequest({ ...VALID_FORM, specialInstructions: 'Leave with the doorman' },
    { giftType: 'flowers', product: { providerProductId: 'PRD-1', priceMajor: 84.97 } });
  assert.equal(body.giftType, 'flowers');
  assert.equal(body.productCode, 'PRD-1');
  assert.equal(body.recipient.shippingAddress.zip, '07102');
  assert.equal(body.sender.email, 'sam@example.com');
  const keys = JSON.stringify(body);
  for (const key of PAYMENT_MATERIAL_KEYS) {
    assert.equal(keys.includes(`"${key}"`), false, `${key} must not be in the prepare request`);
  }
});

test('a card-shaped string is recognised however it is spaced', () => {
  assert.equal(looksLikeCardNumber('4111111111111111'), true);
  assert.equal(looksLikeCardNumber('4111 1111 1111 1111'), true);
  assert.equal(looksLikeCardNumber('4111-1111-1111-1111'), true);
  assert.equal(looksLikeCardNumber('07102'), false);
  assert.equal(looksLikeCardNumber('gpc_7f3c'), false);
  assert.equal(looksLikeCardNumber(4111111111111111), false);
});

// ===========================================================================
// Validation and money
// ===========================================================================

test('the form refuses anything a shipment could not be made from', () => {
  assert.deepEqual(validateCheckoutForm(VALID_FORM), {});
  assert.ok(validateCheckoutForm({ ...VALID_FORM, deliveryDate: '' }).deliveryDate);
  assert.ok(validateCheckoutForm({ ...VALID_FORM, deliveryDate: '15/09/2026' }).deliveryDate);
  assert.ok(validateCheckoutForm({ ...VALID_FORM, address1: '' }).address1);
  assert.ok(validateCheckoutForm({ ...VALID_FORM, cardMessage: '' }).cardMessage);
  assert.ok(validateCheckoutForm({ ...VALID_FORM, cardMessage: 'x'.repeat(201) }).cardMessage);
  assert.ok(validateCheckoutForm({ ...VALID_FORM, specialInstructions: 'x'.repeat(101) }).specialInstructions);
  assert.ok(validateCheckoutForm({ ...VALID_FORM, customerEmail: 'nope' }).customerEmail);
  // A recipient with one name is a real person: a surname is never required.
  assert.deepEqual(validateCheckoutForm({ ...VALID_FORM, recipientLastName: '' }), {});
});

test('money is formatted from the authoritative minor units and never recomputed', () => {
  assert.equal(formatMinor(8497), '$84.97');
  assert.equal(formatMinor(8497, 'CAD'), 'CA$84.97');
  assert.equal(formatMinor(null), '');
  assert.equal(formatMinor(84.97), '', 'a non-integer is not money this surface may show');
});

// ===========================================================================
// No processor host is hard-coded anywhere on this surface
// ===========================================================================

// ===========================================================================
// The authoritative pre-payment review
// ===========================================================================

const QUOTE = Object.freeze({
  provider: 'florist_one', providerProductId: 'T18-1A', providerVariantId: null,
  productMinor: 5499, shippingMinor: 1999, taxMinor: 499, feesMinor: 0,
  totalMinor: 7997, currency: 'USD', taxKnown: true, quoteVersion: 'qv1',
});
const PREPARED = Object.freeze({ quote: QUOTE, orderTotalMinor: 7997, currency: 'USD', deliveryDate: '2026-09-14' });
const CHOSEN = Object.freeze({ providerProductId: 'T18-1A', name: 'Sweet Devotion', priceMinor: 5499, currency: 'USD' });
const FORM = Object.freeze({
  city: 'Hoboken', state: 'NJ', address1: '123 Private St', address2: 'Apt 4',
  postalCode: '07030', customerPhone: '5551234567',
});

// ===========================================================================
// The recipient telephone number
// ===========================================================================

test('ordinary US formatting is accepted and normalized to exactly ten digits', () => {
  for (const typed of [
    '(201) 555-0123', '201-555-0123', '201 555 0123', '201.555.0123',
    '2015550123', ' (201)555-0123 ', '(201)  555 - 0123',
  ]) {
    const r = normalizeRecipientPhone(typed);
    assert.equal(r.ok, true, `${typed} should be accepted`);
    assert.equal(r.digits, '2015550123');
    assert.equal(r.digits.length, 10);
  }
});

test('missing, short, long, alphabetic and extension values are all refused', () => {
  const cases = [
    ['', 'required'], ['   ', 'required'], [null, 'required'], [undefined, 'required'],
    ['201555012', 'too_short'], ['555-0123', 'too_short'],
    ['12015550123', 'too_long'], ['+1 201 555 0123', 'not_digits'],
    ['201-555-0123 x22', 'not_digits'], ['201-555-0123 ext 4', 'not_digits'],
    ['call me', 'not_digits'], ['201-555-012A', 'not_digits'],
  ];
  for (const [typed, reason] of cases) {
    const r = normalizeRecipientPhone(typed);
    assert.equal(r.ok, false, `${JSON.stringify(typed)} must be refused`);
    assert.equal(r.reason, reason, `${JSON.stringify(typed)} reason`);
    assert.equal(r.digits, null);
  }
});

test('the telephone number is REQUIRED, and its message is shown before any API call', () => {
  const errors = validateCheckoutForm({ ...VALID_FORM, recipientPhone: '' });
  assert.ok(errors.recipientPhone, 'a missing number blocks the form');
  assert.match(errors.recipientPhone, /telephone/i);
  // A complete form has no telephone error at all.
  assert.equal(validateCheckoutForm(VALID_FORM).recipientPhone, undefined);
  // And a badly-formed one is named specifically rather than generically.
  assert.match(validateCheckoutForm({ ...VALID_FORM, recipientPhone: '12015550123' }).recipientPhone, /country code/i);
});

test('the prepare request carries recipient.phone as ten digits — and never the sender’s', () => {
  const req = toPrepareRequest(VALID_FORM, { giftType: 'flowers', product: { providerProductId: 'T18-1A' } });
  assert.equal(req.recipient.phone, '2015550123');
  assert.equal(req.recipient.phone.length, 10);
  // The sender's number is a DIFFERENT value in a DIFFERENT place, and is never substituted.
  assert.equal(req.sender.phone, '9735551111');
  assert.notEqual(req.recipient.phone, req.sender.phone);
});

test('an invalid telephone number never reaches the recipient contract', () => {
  const req = toPrepareRequest({ ...VALID_FORM, recipientPhone: '555' }, { giftType: 'flowers', product: {} });
  assert.equal('phone' in req.recipient, false, 'a refused number must not be sent at all');
});

test('the recipient contract keeps its existing shape — no second recipient model', () => {
  const req = toPrepareRequest(VALID_FORM, { giftType: 'flowers', product: { providerProductId: 'T18-1A' } });
  assert.deepEqual(Object.keys(req.recipient).sort(), ['firstName', 'lastName', 'phone', 'shippingAddress']);
  assert.deepEqual(
    Object.keys(req.recipient.shippingAddress).sort(),
    ['city', 'country', 'line1', 'state', 'zip'],
  );
});

test('the telephone number is NOT carried into the quote review', () => {
  const r = reviewQuote({ prepared: PREPARED, chosen: CHOSEN, form: { ...FORM, recipientPhone: '2015550123' } });
  const serialized = JSON.stringify(r);
  assert.equal(serialized.includes('2015550123'), false, 'the review must not carry the telephone number');
  assert.equal(serialized.includes('phone'), false);
  assert.equal(r.recipientCityState, 'Hoboken, NJ');
});

test('every required safe component is present in the review', () => {
  const r = reviewQuote({ prepared: PREPARED, chosen: CHOSEN, form: FORM });
  assert.equal(r.ok, true);
  assert.equal(r.canSubmit, true);
  assert.equal(r.productName, 'Sweet Devotion');
  assert.equal(r.productCode, 'T18-1A');
  assert.equal(r.deliveryDate, '2026-09-14');
  assert.equal(r.currency, 'USD');
  assert.deepEqual(r.lines.map((l) => [l.key, l.minor]), [['product', 5499], ['delivery', 1999], ['tax', 499]]);
  assert.equal(r.totalMinor, 7997);
});

test('currency formats correctly for both supported regions', () => {
  assert.equal(formatMinor(5499, 'USD'), '$54.99');
  assert.equal(formatMinor(5499, 'CAD'), 'CA$54.99');
  assert.equal(formatMinor(7997, 'USD'), '$79.97');
  // A malformed amount formats to nothing rather than to a misleading number.
  assert.equal(formatMinor(54.99, 'USD'), '');
  assert.equal(formatMinor(null, 'USD'), '');
});

test('the review carries CITY AND STATE only — never the street address or telephone', () => {
  const r = reviewQuote({ prepared: PREPARED, chosen: CHOSEN, form: FORM });
  assert.equal(r.recipientCityState, 'Hoboken, NJ');
  const serialized = JSON.stringify(r);
  for (const forbidden of ['123 Private St', 'Apt 4', '07030', '5551234567', 'address1', 'phone']) {
    assert.equal(serialized.includes(forbidden), false, `the review must not carry ${forbidden}`);
  }
});

test('a missing or malformed component FAILS CLOSED and forbids submission', () => {
  const cases = [
    ['quote_missing', { ...PREPARED, quote: undefined }],
    ['currency_missing', { ...PREPARED, quote: { ...QUOTE, currency: '' }, currency: undefined }],
    ['component_malformed:productMinor', { ...PREPARED, quote: { ...QUOTE, productMinor: undefined } }],
    ['component_malformed:shippingMinor', { ...PREPARED, quote: { ...QUOTE, shippingMinor: '19.99' } }],
    ['component_malformed:taxMinor', { ...PREPARED, quote: { ...QUOTE, taxMinor: 4.99 } }],
    ['component_malformed:taxMinor', { ...PREPARED, quote: { ...QUOTE, taxMinor: null } }],
    ['component_malformed:productMinor', { ...PREPARED, quote: { ...QUOTE, productMinor: -1 } }],
    ['total_malformed', { ...PREPARED, quote: { ...QUOTE, totalMinor: null }, orderTotalMinor: null }],
  ];
  for (const [reason, prepared] of cases) {
    const r = reviewQuote({ prepared, chosen: CHOSEN, form: FORM });
    assert.equal(r.ok, false, `${reason} must fail closed`);
    assert.equal(r.canSubmit, false, `${reason} must forbid submission`);
    assert.equal(r.reason, reason);
    assert.deepEqual(r.lines, []);
  }
});

test('components that do not add up to the total fail closed — no rounding, no tolerance', () => {
  const r = reviewQuote({
    prepared: { ...PREPARED, quote: { ...QUOTE, taxMinor: 500 } }, chosen: CHOSEN, form: FORM,
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'components_do_not_sum');
  assert.equal(r.canSubmit, false);
});

test('the displayed components add EXACTLY to the returned total', () => {
  const r = reviewQuote({ prepared: PREPARED, chosen: CHOSEN, form: FORM });
  assert.equal(r.lines.reduce((sum, l) => sum + l.minor, 0), r.totalMinor);
});

test('a catalog/quote price mismatch warns and BLOCKS submission until acknowledged', () => {
  const r = reviewQuote({
    prepared: PREPARED, chosen: { ...CHOSEN, priceMinor: 4999 }, form: FORM,
  });
  // The review still renders — the payer is entitled to see the real figure.
  assert.equal(r.ok, true);
  assert.equal(r.canSubmit, false, 'a changed price must block submission');
  assert.deepEqual(r.priceChanged, { catalogMinor: 4999, quotedMinor: 5499, currency: 'USD' });
  // And the QUOTED figure is what is displayed, never the stale catalog one.
  assert.equal(r.lines.find((l) => l.key === 'product').minor, 5499);
});

test('matching prices allow progression, with no warning', () => {
  const r = reviewQuote({ prepared: PREPARED, chosen: CHOSEN, form: FORM });
  assert.equal(r.priceChanged, null);
  assert.equal(r.canSubmit, true);
});

test('no money value is ever computed by the browser — only verified', () => {
  // Every displayed amount must be traceable to a value the backend sent.
  const r = reviewQuote({ prepared: PREPARED, chosen: CHOSEN, form: FORM });
  const fromBackend = new Set([QUOTE.productMinor, QUOTE.shippingMinor, QUOTE.taxMinor, QUOTE.totalMinor]);
  for (const line of r.lines) assert.ok(fromBackend.has(line.minor), `${line.key} was not a backend figure`);
  assert.ok(fromBackend.has(r.totalMinor));
});

test('the billing address maps to sender.billingAddress, never to the recipient', () => {
  const req = toPrepareRequest(VALID_FORM, { giftType: 'flowers', product: { providerProductId: 'T18-1A' } });
  assert.deepEqual(req.sender.billingAddress, {
    line1: '1 Sender St', line2: 'Apt 2', city: 'Hoboken', state: 'NJ', zip: '07030', country: 'US',
  });
  // The delivery address is a different address in a different place, and neither moved.
  assert.equal(req.recipient.shippingAddress.line1, '12 Elm St');
  assert.notEqual(req.sender.billingAddress.line1, req.recipient.shippingAddress.line1);
  assert.equal('billingAddress' in req.recipient, false, 'the recipient carries no billing address');
  assert.equal('shippingAddress' in req.sender, false, 'the sender carries no delivery address');
});

test('the customer telephone is normalized and is never the recipient’s', () => {
  const req = toPrepareRequest(VALID_FORM, { giftType: 'flowers', product: {} });
  assert.equal(req.sender.phone, '9735551111');
  assert.equal(req.recipient.phone, '2015550123');
  assert.notEqual(req.sender.phone, req.recipient.phone);
  // Formatting is accepted for the customer exactly as it is for the recipient.
  const formatted = toPrepareRequest({ ...VALID_FORM, customerPhone: '(973) 555-1111' }, { giftType: 'flowers', product: {} });
  assert.equal(formatted.sender.phone, '9735551111');
});

test('every required billing field is refused BEFORE prepare is called', () => {
  const cases = [
    ['billingLine1', '', /billing street/i],
    ['billingCity', '', /billing city/i],
    ['billingState', '', /2-letter/i],
    ['billingState', 'New Jersey', /2-letter/i],
    ['billingZip', '', /5-digit/i],
    ['billingZip', '073', /5-digit/i],
    ['customerPhone', '', /telephone/i],
    ['customerPhone', '973555111', /10-digit/i],
  ];
  for (const [field, value, message] of cases) {
    const errors = validateCheckoutForm({ ...VALID_FORM, [field]: value });
    assert.ok(errors[field], `${field}=${JSON.stringify(value)} must be refused`);
    assert.match(errors[field], message);
  }
  // Line 2 is genuinely optional.
  assert.equal(validateCheckoutForm({ ...VALID_FORM, billingLine2: '' }).billingLine2, undefined);
  assert.deepEqual(validateCheckoutForm(VALID_FORM), {});
});

test('an incomplete billing address never reaches the provider payload', () => {
  const req = toPrepareRequest({ ...VALID_FORM, customerPhone: '55' }, { giftType: 'flowers', product: {} });
  assert.equal('phone' in req.sender, false, 'a refused number must not be sent at all');
});

test('billing details are NOT carried into the quote review', () => {
  const r = reviewQuote({
    prepared: PREPARED, chosen: CHOSEN,
    form: { ...FORM, billingLine1: '1 Sender St', billingZip: '07030', customerPhone: '9735551111' },
  });
  const serialized = JSON.stringify(r);
  for (const forbidden of ['1 Sender St', '07030', '9735551111', 'billing', 'Billing']) {
    assert.equal(serialized.includes(forbidden), false, `the review must not carry ${forbidden}`);
  }
  assert.equal(r.recipientCityState, 'Hoboken, NJ');
});

test('the marketplace never hands its own product to a provider checkout', () => {
  // A Printful product in a florist order is an order nobody can fulfil. The entry point passes no
  // product at all, so the choice can only come from the provider's own live list.
  const merch = readFileSync(join(HERE, '../../pages/Merch.jsx'), 'utf8');
  const entry = merch.slice(merch.indexOf('<ProviderCheckoutEntry'), merch.indexOf('/>', merch.indexOf('<ProviderCheckoutEntry')));
  assert.ok(entry.length > 20, 'the entry point must be present in the marketplace');
  assert.match(entry, /product=\{null\}/);
  assert.equal(/visibleProducts|selectedProducts|products\[/.test(entry), false,
    'no marketplace product may be passed into a provider checkout');
});

test('the tokenizer address comes from the provider, never from this repository', () => {
  for (const file of ['acceptJsLoader.js', 'ProviderCheckoutModal.jsx', 'ProviderCheckoutEntry.jsx',
    'providerCheckoutModel.js', '../../api/providerCheckout.js']) {
    const text = read(file);
    assert.equal(/authorize\s*\.\s*net/i.test(text), false, `${file} must not hard-code a processor host`);
    assert.equal(/floristone\.com|florist\.one/i.test(text), false, `${file} must not hard-code a vendor host`);
  }
});
