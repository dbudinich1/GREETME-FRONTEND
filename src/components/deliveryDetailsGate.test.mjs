// src/components/deliveryDetailsGate.test.mjs — TEAM I.
//
// The delivery-details surface, asserted against ContactForm source.
//
// ContactForm.jsx is JSX and cannot be imported by the node test runner, so this pins the contract
// by reading the source — the same approach the backend provider-boundary suite uses for shared
// files. What matters is behavioural and checkable either way: which gift types show the delivery
// interface, that a first name is confirmed rather than derived, and that a surname is optional.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(HERE, "ContactForm.jsx"), "utf8");

test("physical gift types share ONE delivery-address gate", () => {
  assert.match(SRC, /export const DELIVERY_REQUIRED_GIFT_TYPES = \['curated', 'flowers', 'gift_boxes'\]/);
  assert.match(SRC, /export const requiresDeliveryAddress/);

  // Both render paths use the shared predicate — neither restates the list.
  const gates = SRC.match(/requiresDeliveryAddress\(giftSetting\.type\) && \(/g) || [];
  assert.equal(gates.length, 2, "both occasion render paths are gated by the predicate");

  // The old curated-only address gate is gone.
  assert.equal(
    /Shipping Address - only for curated gift option/.test(SRC), false,
    "the curated-only address gate must not survive");
});

test("existing non-provider gift behaviour is preserved", () => {
  // qrcash / merch / marketplace are NOT delivery-address types and must not appear in the list.
  const list = SRC.match(/DELIVERY_REQUIRED_GIFT_TYPES = \[([^\]]+)\]/)[1];
  for (const t of ["qrcash", "merch", "marketplace"]) {
    assert.equal(list.includes(t), false, `${t} must not require a delivery address`);
  }
  // curated keeps the address interface it already had.
  assert.equal(list.includes("curated"), true);
});

test("a first name is CONFIRMED, never derived from the free-text contact name", () => {
  assert.match(SRC, /placeholder="Recipient First Name \*"/);
  assert.match(SRC, /value=\{formData\.firstName \|\| ''\}/);
  // The copy tells the sender we do not guess.
  assert.match(SRC, /We never guess it from/);
  // No split of `name` anywhere in the component.
  assert.equal(/formData\.name\.split|name\.split\(['"\s]/.test(SRC), false,
    "the contact name must never be split");
});

test("a surname is offered but explicitly optional", () => {
  assert.match(SRC, /placeholder="Recipient Last Name \(optional\)"/);
  assert.equal(/Recipient Last Name \*/.test(SRC), false, "a surname must not be marked required");
});

test("confirmed names are initialised empty and loaded back, never back-filled from name", () => {
  // Initial state: empty means "not confirmed".
  assert.match(SRC, /firstName: '',\s*\n\s*lastName: '',/);
  // Loading an existing contact restores a previous confirmation only.
  assert.match(SRC, /firstName: contact\.firstName \|\| '',/);
  assert.match(SRC, /lastName: contact\.lastName \|\| '',/);
  assert.equal(/firstName: contact\.firstName \|\| contact\.name/.test(SRC), false,
    "a missing first name must never fall back to the full name");
});

test("both delivery blocks collect the full supported address, address2 optional", () => {
  for (const p of ["Address Line 1 \\*", "City \\*", "State \\*", "ZIP Code \\*", "Country \\*"]) {
    assert.ok(new RegExp(`placeholder="${p}"`).test(SRC), `${p} is collected`);
  }
  assert.match(SRC, /placeholder="Address Line 2"/, "address2 is offered and unstarred");
});
