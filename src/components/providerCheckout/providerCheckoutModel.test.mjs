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
  CHECKOUT_STATUS, FORBIDDEN_CLAIMS, PAYMENT_MATERIAL_KEYS, assertNoPaymentMaterial, canRetry,
  categoryNoun, claimsDeliveryStatus, formatMinor, isTerminal, looksLikeCardNumber,
  providerDisplayName, redactPaymentMaterial, statusCopy, toPrepareRequest, validateCheckoutForm,
} from './providerCheckoutModel.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(HERE, rel), 'utf8');

const VALID_FORM = {
  deliveryDate: '2026-09-15', recipientFirstName: 'Dana', recipientLastName: 'Rivers',
  address1: '12 Elm St', city: 'Newark', state: 'NJ', postalCode: '07102',
  cardMessage: 'Thinking of you', customerFirstName: 'Sam', customerEmail: 'sam@example.com',
};

// ===========================================================================
// What the customer may be told
// ===========================================================================

test('acceptance is the furthest claim, and it names the provider', () => {
  const copy = statusCopy(CHECKOUT_STATUS.ACCEPTED, { provider: 'florist_one', giftType: 'flowers' });
  assert.equal(copy.body, 'Your flower order has been accepted by Florist One.');
  assert.match(copy.note, /does not publish delivery updates/);
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

test('the tokenizer address comes from the provider, never from this repository', () => {
  for (const file of ['acceptJsLoader.js', 'ProviderCheckoutModal.jsx', 'ProviderCheckoutEntry.jsx',
    'providerCheckoutModel.js', '../../api/providerCheckout.js']) {
    const text = read(file);
    assert.equal(/authorize\s*\.\s*net/i.test(text), false, `${file} must not hard-code a processor host`);
    assert.equal(/floristone\.com|florist\.one/i.test(text), false, `${file} must not hard-code a vendor host`);
  }
});
