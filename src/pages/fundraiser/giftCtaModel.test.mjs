// giftCtaModel.test.mjs — TEAM D. Run: node --test src/pages/fundraiser/giftCtaModel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { isGiftableVariant, pickGiftVariant, giftCtaState } from "./giftCtaModel.js";

const TOKEN = "ftk_abcdef012345_v1";
const okVariant = { id: "gm-var-42546700517411", available: true, priceCents: 4495 };

test("isGiftableVariant accepts a valid variant and rejects malformed / unavailable / bad-id / bad-price", () => {
  assert.equal(isGiftableVariant(okVariant), true);
  assert.equal(isGiftableVariant({ ...okVariant, available: false }), false);
  assert.equal(isGiftableVariant({ ...okVariant, id: "gm-var-" }), false); // no numeric tail
  assert.equal(isGiftableVariant({ ...okVariant, id: "gid://shopify/ProductVariant/999" }), false); // raw GID never accepted
  assert.equal(isGiftableVariant({ ...okVariant, priceCents: null }), false);
  assert.equal(isGiftableVariant({ ...okVariant, priceCents: -1 }), false);
  assert.equal(isGiftableVariant(null), false);
});

test("pickGiftVariant returns the first giftable variant or null", () => {
  const item = { variants: [{ ...okVariant, available: false }, okVariant] };
  assert.equal(pickGiftVariant(item).id, okVariant.id);
  assert.equal(pickGiftVariant({ variants: [] }), null);
  assert.equal(pickGiftVariant({}), null);
  assert.equal(pickGiftVariant(null), null);
});

test("giftCtaState shows the CTA only with a valid token AND a giftable variant", () => {
  const item = { variants: [okVariant] };
  assert.deepEqual(giftCtaState({ token: TOKEN, item }), { showCta: true, variantId: okVariant.id });
  // no token ⇒ display-only (stays "Available soon")
  assert.deepEqual(giftCtaState({ token: null, item }), { showCta: false, variantId: null });
  // malformed token ⇒ no CTA
  assert.deepEqual(giftCtaState({ token: "not-a-token", item }), { showCta: false, variantId: null });
  // valid token but no giftable variant ⇒ no CTA
  assert.deepEqual(giftCtaState({ token: TOKEN, item: { variants: [] } }), { showCta: false, variantId: null });
});
