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

let head = 'unknown';
try { head = execFileSync('git', ['-C', BE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* git unavailable */ }
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  generatedFrom: { backendDir: BE, backendHead: head, node: process.version },
  smartCard: { tiles, calcFor1000: catalog.calcPrezzeeCardFees(1000) },
  giftBox: { feeRate: gift.GIFT_BOX_GREET_ME_FEE_RATE, rounding, quote: quoteBefore, quoteAfter, charge409 },
}, null, 2));
console.log(`wrote ${OUT}`);
process.exit(0);
