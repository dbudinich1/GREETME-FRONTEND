// scripts/gen-combined-fee-shapes.mjs
//
// Real fee-related response shapes from the COMBINED backend's own code (read only; nothing is edited):
//   - Smart Card tiles:  buildPrezzeeCardCatalogResponse()  (the function behind GET /api/gifts/prezzee-card/tiles)
//   - Gift-box quote:    the REAL quoteGiftBoxOrder + giftBoxQuoteBreakdown({providerQuotedTotalCents,
//                        providerProductCents, quantity}) + displayLines, with only the provider edge injected,
//                        assembled into the fields POST /api/gifts/gift-box/quote returns (incl. `display`)
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
// ---- Gift box (FOUNDER RULE 2026-10-02: the hidden 5% is on the PRODUCT price only; contract section 1A) ----------
// Everything below runs the backend's OWN code: the pure rule (giftBoxMarkup.js), giftBoxQuoteBreakdown with the NEW
// signature ({providerQuotedTotalCents, providerProductCents, quantity}), and the REAL quoteGiftBoxOrder /
// chargeGiftBox with only the provider edge injected. Figures are realistic provider estimates in cents.
const markup = await import(u('services/gifts/giftBoxMarkup.js'));
const rounding = [[1010, 1], [4500, 1], [999, 1], [1010, 2], [1010, 3]].map(([unit, qty]) => {
  const line = unit * qty;
  const b = gift.giftBoxQuoteBreakdown({ providerQuotedTotalCents: line + 1200, providerProductCents: line, quantity: qty });
  return { unitCents: unit, productLineCents: line, quantity: qty, feeCents: b.feeCents, quotedTotalCents: b.quotedTotalCents, providerQuotedTotalCents: b.providerQuotedTotalCents };
});
const goodyProduct = (unitCents) => ({
  providerProductId: 'BOX-1', priceCents: unitCents, restrictions: { restrictedStates: [], directShipCountries: ['US'] },
  variants: { options: [] }, capabilities: { directShip: {} },
});
// A provider estimate: pre-tax = product line + shipping + the provider's own fee; total = pre-tax + tax.
const estimateFor = ({ productLine, shipping, providerFee, tax }) => ({
  authoritative: true, recipients: 1, authoritativeTaxCents: tax,
  authoritativeTotalCents: productLine + shipping + providerFee + tax,
  perRecipient: { productCents: productLine, shippingCents: shipping, processingFeeCents: providerFee, preTaxCents: productLine + shipping + providerFee },
});
const nowIso = new Date().toISOString();
const quoteDeps = (unitCents, est) => ({
  now: () => Date.now(),
  resolveGiftBoxProduct: async () => ({ providerId: 'goody', product: goodyProduct(unitCents) }),
  resolveProviderQuote: async () => async () => est,
});
const SELECTION = (quantity) => ({ providerProductId: 'BOX-1', quantity, variants: [] });
const RECIPIENT = { firstName: 'Dana', address: { address1: '12 Elm St', city: 'Newark', state: 'NJ', postalCode: '07102', country: 'US' } };
// What POST /api/gifts/gift-box/quote returns for a scenario (the route's own field list).
async function quoteScenario(unitCents, quantity, figures) {
  const est = estimateFor(figures);
  const q = await gift.quoteGiftBoxOrder({ selection: SELECTION(quantity), recipient: RECIPIENT }, quoteDeps(unitCents, est));
  const b = gift.giftBoxQuoteBreakdown({ providerQuotedTotalCents: q.quotedTotalCents, providerProductCents: q.providerProductCents, quantity });
  const display = markup.displayLines({ quotedTotalCents: b.quotedTotalCents, providerProductCents: b.providerProductCents, feeCents: b.feeCents, taxCents: q.taxCents });
  return {
    q, est,
    body: { ok: true, providerQuotedTotalCents: b.providerQuotedTotalCents, feeCents: b.feeCents, quotedTotalCents: b.quotedTotalCents, display, currency: 'usd', quotedAt: q.quotedAt, quoteValidForMs: 120000 },
  };
}
// qty 1: $45.00 product, $7.00 shipping, $3.00 provider fee, $3.30 tax.   qty 2: 2 x $10.10, $8.00 ship, $3.00 fee, $1.87 tax.
const S1 = await quoteScenario(4500, 1, { productLine: 4500, shipping: 700, providerFee: 300, tax: 330 });
const S2 = await quoteScenario(1010, 2, { productLine: 2020, shipping: 800, providerFee: 300, tax: 187 });
// The provider's product price moved (4500 -> 5500) between the quote and the charge.
const S1after = await quoteScenario(5500, 1, { productLine: 5500, shipping: 700, providerFee: 300, tax: 396 });
const quoteBefore = S1.body;
const quoteAfter = S1after.body;

// Real chargeGiftBox: the customer saw quoteBefore, but the live quote is now S1after -> 409 with the fresh display.
const charge409 = await gift.chargeGiftBox({
  user: { id: 'u1', email: 'u1@example.com' },
  body: {
    providerProductId: 'BOX-1', quantity: 1, variants: [],
    recipient: RECIPIENT, paymentMethodId: 'pm_test_1', giftRequestId: 'req-1',
    quotedTotalCents: quoteBefore.quotedTotalCents, providerQuotedTotalCents: quoteBefore.providerQuotedTotalCents, quotedAt: nowIso,
  },
}, {
  now: () => Date.now(),
  quoteGiftBoxOrder: async (args, d) => gift.quoteGiftBoxOrder(args, { ...d, ...quoteDeps(5500, S1after.est) }),
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
  giftBox: { markupRate: markup.GIFT_BOX_MARKUP_RATE, markupBasis: markup.GIFT_BOX_MARKUP_BASIS.PRODUCT, rounding, quote: quoteBefore, quoteQty2: S2.body, quoteAfter, charge409 },
}, null, 2));
console.log(`wrote ${OUT}`);
process.exit(0);
