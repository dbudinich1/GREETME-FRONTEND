// src/pages/giftPlaceViewModel.test.mjs
//
// fromCuratedProduct — the projector for GET /api/gifts/catalog's canonical, founder-curated
// provider products (Founder-authorized 2026-09-25, "AUTHORIZED CANONICAL CUSTOMER CATALOG
// CORRECTION"). Plain-module unit tests, run directly — no DOM, no bundling.
//
// Run: node --test src/pages/giftPlaceViewModel.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { fromCuratedProduct, GIFT_SOURCES, projectGiftCards } from "./giftPlaceViewModel.js";

const GOODY_ITEM = (overrides = {}) => ({
  id: "gm-goody-charger-001",
  vendor: "goody",
  title: "Portable Charger",
  description: "A charger.",
  priceCents: 3500,
  currency: "USD",
  images: [{ url: "https://cdn.test/charger.jpg", alt: "" }],
  variants: [],
  greetMeCategories: ["tech"],
  source: "goody",
  providerProductId: "goody-charger-001",
  ...overrides,
});

test("projects the canonical catalog shape into the shared six-field card, plus routing-only extras", () => {
  const card = fromCuratedProduct(GOODY_ITEM());
  assert.equal(card.id, "gm-goody-charger-001");
  assert.equal(card.source, GIFT_SOURCES.CURATED);
  assert.equal(card.name, "Portable Charger");
  assert.equal(card.description, "A charger.");
  assert.equal(card.imageUrl, "https://cdn.test/charger.jpg");
  assert.equal(card.priceLabel, "$35");
  assert.equal(card.priceMinor, 3500);
});

test("carries providerProductId and vendorSource for checkout routing — never rendered, only for lookup", () => {
  const card = fromCuratedProduct(GOODY_ITEM());
  assert.equal(card.providerProductId, "goody-charger-001");
  assert.equal(card.vendorSource, "goody");
});

test("a missing providerProductId (should never happen server-side) yields null rather than a broken checkout key", () => {
  const card = fromCuratedProduct(GOODY_ITEM({ providerProductId: null }));
  assert.equal(card.providerProductId, null);
});

test("null/undefined input yields null, matching every other projector", () => {
  assert.equal(fromCuratedProduct(null), null);
  assert.equal(fromCuratedProduct(undefined), null);
});

test("a Prezzee-sourced record is EXCLUDED — the Smart Card / QR Cash experience stays separate", () => {
  assert.equal(fromCuratedProduct(GOODY_ITEM({ source: "prezzee", vendor: "prezzee" })), null,
    "even if the backend's own gate ever changes, this projector must never let a Prezzee record become an ordinary marketplace tile");
});

test("falls back to the first image with a usable url, skipping an empty one", () => {
  const card = fromCuratedProduct(GOODY_ITEM({ images: [{ url: "", alt: "" }, { url: "https://cdn.test/real.jpg", alt: "" }] }));
  assert.equal(card.imageUrl, "https://cdn.test/real.jpg");
});

test("no images at all yields null imageUrl, not a broken src", () => {
  const card = fromCuratedProduct(GOODY_ITEM({ images: [] }));
  assert.equal(card.imageUrl, null);
});

test("projectGiftCards drops a Prezzee item from a mixed list without dropping its neighbors", () => {
  const cards = projectGiftCards(
    [GOODY_ITEM({ id: "a" }), GOODY_ITEM({ id: "b", source: "prezzee" }), GOODY_ITEM({ id: "c" })],
    fromCuratedProduct
  );
  assert.deepEqual(cards.map((c) => c.id), ["a", "c"]);
});

// Gift boxes whose provider REQUIRES an option (BE 519928c sets requiresOptions: true only then). Strictly === true:
// a product that merely lists options carries no flag and stays selectable.
import { fromProviderProduct, requiresOptions, withOptionsNote, OPTIONS_UNAVAILABLE_NOTE } from "./giftPlaceViewModel.js";

test("requiresOptions is true only for the flag === true, never for an option list or a truthy non-boolean", () => {
  assert.equal(requiresOptions({ requiresOptions: true }), true);
  for (const p of [null, undefined, {}, { requiresOptions: false }, { requiresOptions: "true" }, { requiresOptions: 1 },
    { variants: [{ id: "blk" }, { id: "wht" }] }, { options: ["Black"] }]) assert.equal(requiresOptions(p), false, JSON.stringify(p));
});

test("fromProviderProduct: a flagged box carries the note; a listed-options box does not", () => {
  const req = fromProviderProduct({ providerProductId: "a", name: "Speaker", priceMinor: 5999, currency: "USD", requiresOptions: true });
  const listed = fromProviderProduct({ providerProductId: "b", name: "Charger", priceMinor: 4499, currency: "USD", variants: [{ id: "blk" }] });
  assert.equal(req.unavailableNote, OPTIONS_UNAVAILABLE_NOTE);
  assert.equal(OPTIONS_UNAVAILABLE_NOTE, "Options can't be chosen here yet");
  assert.equal("unavailableNote" in listed, false);
});

test("withOptionsNote marks only the curated cards whose provider product is flagged; unchanged input when none is", () => {
  const cards = [{ id: "c1", providerProductId: "a" }, { id: "c2", providerProductId: "b" }, { id: "c3" }];
  const out = withOptionsNote(cards, [{ providerProductId: "a", requiresOptions: true }, { providerProductId: "b", variants: [{ id: "x" }] }]);
  assert.equal(out[0].unavailableNote, OPTIONS_UNAVAILABLE_NOTE);
  assert.equal("unavailableNote" in out[1], false);
  assert.equal("unavailableNote" in out[2], false);
  const none = withOptionsNote(cards, [{ providerProductId: "b" }]);
  assert.equal(none, cards);
  assert.equal(withOptionsNote(cards, undefined), cards);
});
