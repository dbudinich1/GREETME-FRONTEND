// src/utils/merchPriceGuard.test.mjs
//
// Merch expected-price guard: FE consumers fed REAL backend shapes. scripts/gen-combined-fee-shapes.mjs
// runs the combined backend's own services/checkout/merchPriceGuard.js (evaluateMerchPriceGuard) and
// services/merchPricing.js (merchCustomerPriceCents) and records what the checkout route would answer.
// The production rate is READ from the backend and asserted to still be 0: nothing here toggles it.
//
// Run (Node 20): node --test src/utils/merchPriceGuard.test.mjs   (PAIR_BE_DIR default: C:\1_GREET-ME\cs-be-combined)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  expectedMerchSubtotalCents, applyMerchPriceChange, merchPriceNotice, isMerchPriceConfirmationCode,
  MERCH_PRICE_CHANGED, MERCH_PRICE_CONFIRMATION_REQUIRED, displayedItemCents,
} from "./merchPriceGuard.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const feRoot = path.resolve(here, "..", "..");
const BE = process.env.PAIR_BE_DIR || "C:/1_GREET-ME/cs-be-combined";
const OUT = path.join(feRoot, "tests", "fixtures", "combined-backend-fee-shapes.generated.json");
let S = null;
const skip = fs.existsSync(path.join(BE, "services", "checkout", "merchPriceGuard.js")) ? false : `combined backend with the merch guard not found at ${BE}`;
if (!skip) {
  const env = { ...process.env, PAIR_BE_DIR: BE }; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, [path.join(feRoot, "scripts", "gen-combined-fee-shapes.mjs"), OUT], { encoding: "utf8", env, cwd: feRoot });
  if (r.status !== 0) throw new Error(`generator failed (${r.status}):\n${r.stdout}\n${r.stderr}`);
  S = JSON.parse(fs.readFileSync(OUT, "utf8"));
}
const t = (name, fn) => test(name, { skip }, fn);

// A cart exactly as Merch.jsx builds it, priced BEFORE the rate change (base prices).
const cartAtRate0 = () => S.merch.pricesAtRate0.map((p, i) => ({
  id: 100 + i, printfulSyncVariantId: p.syncVariantId, priceCents: p.priceCents, price: p.priceCents / 100, name: `Item ${i}`,
}));

t("backend facts: production rate is still 0 and the 5% prices are the hand-computed ones", () => {
  assert.equal(S.merch.productionRate, 0, "activation is BLOCKED: the FE tests never need a nonzero production rate");
  assert.deepEqual(S.merch.pricesAt5.map((p) => p.priceCents), [3045, 1470]); // $29.00 -> $30.45, $14.00 -> $14.70
});

t("expected subtotal is the sum of the displayed ITEM prices only (merch lines, no shipping)", () => {
  const cart = cartAtRate0();
  assert.equal(expectedMerchSubtotalCents(cart), 4300);
  assert.equal(expectedMerchSubtotalCents([...cart, { id: 9, name: "Subscription", price: 9.99 }]), 4300, "non-merch lines are not part of it");
  assert.equal(displayedItemCents({ priceCents: 3045, price: 1 }), 3045);
  assert.equal(displayedItemCents({ price: 30.45 }), 3045, "dollar price rounds to whole cents");
  assert.equal(displayedItemCents({ price: 0.1 + 0.2 }), 30);
});

t("stale cart: a cart priced before the rate change gets the REAL 409 MERCH_PRICE_CHANGED and the FE applies the new prices", () => {
  const r = S.merch.heldAcrossRateChange;
  assert.equal(r.status, 409);
  assert.equal(r.body.code, MERCH_PRICE_CHANGED);
  assert.ok(isMerchPriceConfirmationCode(r.body.code));
  const cart = cartAtRate0();
  assert.equal(expectedMerchSubtotalCents(cart), 4300, "what the stale cart would send");
  const applied = applyMerchPriceChange(cart, r.body);
  assert.ok(applied, "trusted body is applied");
  assert.equal(applied.previousCents, 4300);
  assert.equal(applied.subtotalCents, 4515);
  assert.deepEqual(applied.items.map((i) => i.priceCents), [3045, 1470]);
  assert.deepEqual(applied.items.map((i) => i.price), [30.45, 14.7]);
  assert.equal(expectedMerchSubtotalCents(applied.items), r.body.subtotalCents, "the next click sends the server's own subtotal");
  const msg = merchPriceNotice({ code: r.body.code, previousCents: applied.previousCents, subtotalCents: applied.subtotalCents });
  assert.match(msg, /\$43\.00 to \$45\.15/);
  assert.match(msg, /Nothing has been charged/);
  assert.doesNotMatch(msg, /fee|markup|mark-up|percent|%|at cost|service|convenience/i, "no fee wording");
});

t("a decreased price is also a 409 and is applied the same way", () => {
  const r = S.merch.priceDecreased;
  assert.equal(r.status, 409); assert.equal(r.body.code, MERCH_PRICE_CHANGED);
  const cart = S.merch.pricesAt5.map((p, i) => ({ id: i, printfulSyncVariantId: p.syncVariantId, priceCents: p.priceCents, price: p.priceCents / 100 }));
  const applied = applyMerchPriceChange(cart, r.body);
  assert.equal(applied.subtotalCents, 4300);
  assert.match(merchPriceNotice({ code: r.body.code, previousCents: applied.previousCents, subtotalCents: applied.subtotalCents }), /\$45\.15 to \$43\.00/);
});

t("legacy client at the elevated rate: REAL 409 MERCH_PRICE_CONFIRMATION_REQUIRED, handled as refresh-and-reconfirm", () => {
  for (const r of [S.merch.legacyAtElevatedRate, S.merch.legacyAtElevatedRateNull]) {
    assert.equal(r.status, 409);
    assert.equal(r.body.code, MERCH_PRICE_CONFIRMATION_REQUIRED);
    assert.ok(isMerchPriceConfirmationCode(r.body.code));
    const applied = applyMerchPriceChange(cartAtRate0(), r.body);
    assert.ok(applied);
    const msg = merchPriceNotice({ code: r.body.code, previousCents: applied.previousCents, subtotalCents: applied.subtotalCents });
    assert.match(msg, /refreshed the prices/);
    assert.match(msg, /\$45\.15/);
    assert.doesNotMatch(msg, /fee|markup|mark-up|percent|%|at cost/i);
  }
});

t("rate-0 compatibility: no expected value proceeds as legacy; a matching value proceeds; neither is a 409", () => {
  assert.deepEqual({ action: S.merch.legacyAtRate0.action, legacy: S.merch.legacyAtRate0.legacy }, { action: "proceed", legacy: true });
  assert.deepEqual({ action: S.merch.matchingAtRate0.action, legacy: S.merch.matchingAtRate0.legacy }, { action: "proceed", legacy: false });
  assert.equal(S.merch.matchingAtElevatedRate.action, "proceed");
  // and the FE's own value is exactly the one the backend treats as matching at rate 0
  assert.equal(expectedMerchSubtotalCents(cartAtRate0()), 4300);
});

t("malformed value: REAL 400 INVALID_REQUEST is NOT a price change (FE applies nothing, shows a plain error)", () => {
  for (const r of [S.merch.malformedFraction, S.merch.malformedString, S.merch.malformedNegative]) {
    assert.equal(r.status, 400);
    assert.equal(r.body.code, "INVALID_REQUEST");
    assert.equal(isMerchPriceConfirmationCode(r.body.code), false);
    assert.equal(applyMerchPriceChange(cartAtRate0(), r.body), null);
  }
});

t("untrusted 409 bodies are never applied: missing lines, wrong sum, bad numbers", () => {
  const good = S.merch.heldAcrossRateChange.body;
  const cart = cartAtRate0();
  assert.equal(applyMerchPriceChange(cart, { ...good, subtotalCents: good.subtotalCents + 1 }), null, "sum must match");
  assert.equal(applyMerchPriceChange(cart, { ...good, items: good.items.slice(0, 1) }), null, "every merch line must be covered");
  assert.equal(applyMerchPriceChange(cart, { ...good, items: [{ syncVariantId: 5298288788, priceCents: 30.5 }, good.items[1]] }), null);
  assert.equal(applyMerchPriceChange(cart, null), null);
  assert.equal(applyMerchPriceChange(cart, { subtotalCents: "4515", items: good.items }), null);
});

t("Checkout sends expectedSubtotalCents on the merch call, and api.js exposes the 409 body", () => {
  const co = fs.readFileSync(path.join(feRoot, "src", "pages", "Checkout.jsx"), "utf8").replace(/\r\n/g, "\n");
  assert.match(co, /purchaseType: 'merch',\n\s+items,\n[\s\S]{0,260}expectedSubtotalCents: expectedMerchSubtotalCents\(cartItems\),/);
  assert.equal((co.match(/purchaseType: 'merch'/g) || []).length >= 1, true);
  const api = fs.readFileSync(path.join(feRoot, "src", "api", "api.js"), "utf8");
  assert.match(api, /error\.data = data;/);
  // No auto-retry: the handler for the guard codes returns without calling create-checkout again.
  const handler = co.slice(co.indexOf("if (isMerchPriceConfirmationCode(error?.code))"), co.indexOf("console.error('Stripe merch checkout error:'"));
  assert.doesNotMatch(handler, /api\.post|handleStripeCheckout|window\.location/);
  assert.match(handler, /setIsProcessing\(false\);\s*\n\s*return;/);
  // No fee wording was introduced into the guard module or the Checkout notice.
  const guardSrc = fs.readFileSync(path.join(feRoot, "src", "utils", "merchPriceGuard.js"), "utf8");
  assert.doesNotMatch(guardSrc.split("\n").filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join("\n"), /markup|convenience|service fee|processing fee/i);
});
