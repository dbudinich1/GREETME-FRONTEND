// scripts/gen-combined-fee-shapes.mjs
//
// Real fee-related response shapes from the COMBINED backend's own code (read only; nothing is edited):
//   - Smart Card tiles:  buildPrezzeeCardCatalogResponse()  (the function behind GET /api/gifts/prezzee-card/tiles)
//   - Gift-box quote:    giftBoxQuoteBreakdown(provider cents) assembled with exactly the fields
//                        POST /api/gifts/gift-box/quote returns (the route itself calls the live provider,
//                        so the breakdown function it uses is run directly)
//   - Gift-box 409:      the REAL chargeGiftBox() handler with an injected provider quote, driven with a
//                        stale client total, which returns the gift_box_quote_changed body
// Run (Node 20): PAIR_BE_DIR=C:\1_GREET-ME\cs-be-combined node scripts/gen-combined-fee-shapes.mjs <out.json>
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const BE = path.resolve(process.env.PAIR_BE_DIR || 'C:/1_GREET-ME/cs-be-combined');
const OUT = path.resolve(process.argv[2] || 'tests/fixtures/combined-backend-fee-shapes.generated.json');
const u = (rel) => pathToFileURL(path.join(BE, rel)).href;
process.env.FRONTEND_BASE_URL = 'https://greet-me.test';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';

const gift = await import(u('routes/giftRoutes.js'));
const catalog = await import(u('services/giftCatalog.js'));
const merchPricing = await import(u('services/merchPricing.js'));
const merchGuard = await import(u('services/checkout/merchPriceGuard.js'));

const tiles = gift.buildPrezzeeCardCatalogResponse();
const rounding = [1, 3333, 4599, 12999].map((p) => {
  const b = gift.giftBoxQuoteBreakdown(p);
  return { providerQuotedTotalCents: b.providerQuotedTotalCents, feeCents: b.feeCents, quotedTotalCents: b.quotedTotalCents };
});
const quoteFor = (providerCents) => {
  const b = gift.giftBoxQuoteBreakdown(providerCents);
  return { ok: true, providerQuotedTotalCents: b.providerQuotedTotalCents, feeCents: b.feeCents, quotedTotalCents: b.quotedTotalCents, currency: 'usd', quotedAt: new Date().toISOString(), quoteValidForMs: 120000 };
};
const quoteBefore = quoteFor(5310);
const quoteAfter = quoteFor(6286); // what a re-quote returns once the provider price moved

// Real chargeGiftBox: the customer saw 5310 -> 5576 total, but the provider's price moved to 6286.
const nowIso = new Date().toISOString();
const charge409 = await gift.chargeGiftBox({
  user: { id: 'u1', email: 'u1@example.com' },
  body: {
    providerProductId: 'BOX-1', quantity: 1, variants: [],
    recipient: { firstName: 'Dana', address: { address1: '12 Elm St', city: 'Newark', state: 'NJ', postalCode: '07102', country: 'US' } },
    paymentMethodId: 'pm_test_1', giftRequestId: 'req-1',
    quotedTotalCents: quoteBefore.quotedTotalCents, providerQuotedTotalCents: quoteBefore.providerQuotedTotalCents, quotedAt: nowIso,
  },
}, {
  now: () => Date.now(),
  quoteGiftBoxOrder: async () => ({ quotedTotalCents: 6286, quotedAt: nowIso, item: { product: { id: 'BOX-1' }, quantity: 1, variants: [] } }),
});

// ---- merch expected-price guard: the REAL evaluateMerchPriceGuard + merchCustomerPriceCents -------
const BASE = [{ syncVariantId: 5298288788, base: 2900 }, { syncVariantId: 5298250656, base: 1400 }];
const priced = (rate) => BASE.map((b) => ({ syncVariantId: b.syncVariantId, priceCents: merchPricing.merchCustomerPriceCents(b.base, rate) }));
const sum = (items) => items.reduce((a, i) => a + i.priceCents, 0);
const at0 = priced(0), at5 = priced(0.05);
const guard = (expected, items, rate) => merchGuard.evaluateMerchPriceGuard({ expectedSubtotalCents: expected, serverSubtotalCents: sum(items), items, markupRate: rate });
const merch = {
  productionRate: merchPricing.merchMarkupRate(),
  pricesAtRate0: at0, pricesAt5: at5,
  // cart priced at rate 0 (what the customer saw), submitted after the rate became 5%
  heldAcrossRateChange: guard(sum(at0), at5, 0.05),
  // price went DOWN since the customer saw it
  priceDecreased: guard(sum(at5), at0, 0),
  // legacy client (no expected value) at the elevated rate / at rate 0
  legacyAtElevatedRate: guard(undefined, at5, 0.05),
  legacyAtElevatedRateNull: guard(null, at5, 0.05),
  legacyAtRate0: guard(undefined, at0, 0),
  // field sent at rate 0 with a matching value
  matchingAtRate0: guard(sum(at0), at0, 0),
  matchingAtElevatedRate: guard(sum(at5), at5, 0.05),
  malformedFraction: guard(30.45, at5, 0.05),
  malformedString: guard("4545", at5, 0.05),
  malformedNegative: guard(-1, at5, 0.05),
};

let head = 'unknown';
try { head = execFileSync('git', ['-C', BE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* git unavailable */ }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  generatedFrom: { backendDir: BE, backendHead: head, node: process.version },
  smartCard: { tiles, calcFor1000: catalog.calcPrezzeeCardFees(1000) },
  merch,
  giftBox: { feeRate: gift.GIFT_BOX_GREET_ME_FEE_RATE, rounding, quote: quoteBefore, quoteAfter, charge409 },
}, null, 2));
console.log(`wrote ${OUT}`);
process.exit(0);
