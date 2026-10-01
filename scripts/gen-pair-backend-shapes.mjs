// scripts/gen-pair-backend-shapes.mjs
//
// Generates REAL response shapes from the integrated backend's own code and writes them as JSON for
// FE consumer tests. Nothing here is a hand-written response: every body below is produced by the
// backend's real route handlers.
//   - GET /api/orders/history      : the real createOrdersRouter() / projection builders in
//                                    routes/ordersRoutes.js, fed FAKE Cosmos containers (raw rows only).
//   - GET /api/payments/platform-fee-status : the real routes/paymentRoutes.js router and its real
//                                    resolvePlatformFee service, with the payments ledger faked and
//                                    auth stubbed (same seams the backend's own route test uses).
// The backend is READ ONLY from here: nothing in it is edited. Run (Node 20, from the FE repo):
//   PAIR_BE_DIR=C:\1_GREET-ME\cs-be-pair node --experimental-test-module-mocks scripts/gen-pair-backend-shapes.mjs <out.json>
import { mock } from 'node:test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { execFileSync } from 'node:child_process';

const BE = path.resolve(process.env.PAIR_BE_DIR || 'C:/1_GREET-ME/cs-be-pair');
const OUT = path.resolve(process.argv[2] || 'tests/fixtures/pair-backend-shapes.generated.json');
const u = (rel) => pathToFileURL(path.join(BE, rel)).href;

process.env.FRONTEND_BASE_URL = 'https://greet-me.test';
process.env.STRIPE_SECRET_KEY = 'sk_test_fake';

// ---- payments ledger fake -------------------------------------------------------------------
let history = {};
let ledgerMode = 'ok';
const fakePayments = {
  items: {
    query: (_q, opts) => ({
      fetchAll: async () => {
        if (ledgerMode === 'fail') throw new Error('cosmos unavailable');
        return { resources: history[opts?.partitionKey] || [] };
      },
    }),
  },
};
const realCosmos = await import(u('utils/cosmosClient.js'));
mock.module(u('utils/cosmosClient.js'), {
  namedExports: { ...realCosmos, getPaymentsContainer: async () => fakePayments },
});
mock.module(u('middleware/requireAuth.js'), {
  defaultExport: (req, res, next) => {
    const userId = req.headers['x-test-user'];
    if (!userId) return res.status(401).json({ ok: false, error: 'Missing auth token' });
    req.user = { id: userId, email: `${userId}@example.com`, emailVerified: true };
    next();
  },
});

const { default: express } = await import(pathToFileURL(path.join(BE, 'node_modules/express/index.js')).href);
const { default: paymentRoutes } = await import(u('routes/paymentRoutes.js'));
const { createOrdersRouter } = await import(u('routes/ordersRoutes.js'));
const { GIFT_TYPES } = await import(u('routes/giftRoutes.js')); // real discriminator values, not literals

async function withServer(app, run) {
  const server = http.createServer(app);
  await new Promise((r) => server.listen(0, r));
  try { return await run(server.address().port); } finally { await new Promise((r) => server.close(r)); }
}
function get(port, p, user) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port, path: p, method: 'GET', headers: user ? { 'x-test-user': user } : {} }, (res) => {
      let raw = ''; res.on('data', (c) => { raw += c; });
      res.on('end', () => { let body = null; try { body = JSON.parse(raw); } catch { /* keep null */ } resolve({ status: res.statusCode, body }); });
    });
    req.on('error', reject); req.end();
  });
}

// ---- platform-fee-status ----------------------------------------------------------------------
const platformFee = {};
{
  const app = express(); app.use(express.json()); app.use('/api/payments', paymentRoutes);
  await withServer(app, async (port) => {
    history = { returning: [{ id: 'evt_prior' }] }; ledgerMode = 'ok';
    platformFee.firstActivation = await get(port, '/api/payments/platform-fee-status', 'brand-new');
    platformFee.returning = await get(port, '/api/payments/platform-fee-status', 'returning');
    platformFee.unauthenticated = await get(port, '/api/payments/platform-fee-status');
    ledgerMode = 'fail';
    platformFee.historyUnavailable = await get(port, '/api/payments/platform-fee-status', 'brand-new');
  });
}

// ---- orders/history -----------------------------------------------------------------------------
const NOW = Date.now();
const iso = (daysAgo) => new Date(NOW - daysAgo * 86400000).toISOString();
const TOK = (n) => `0000000${n}-aaaa-bbbb-cccc-eeeeeeeeeeee`;
const gift = (n, extra) => ({ id: TOK(n), userId: 'u1', claimUrl: 'https://x.test/c', createdAt: iso(n), recipientName: `R${n}`, totalCents: 1000 + n, ...extra });
const shipment = (extra) => ({ status: 'in_transit', carrier: 'UPS', trackingNumber: '1Z999', trackingAvailable: true, shippedAt: iso(2), ...extra });

const merchRows = [
  { id: 'merch-pre', state: 'pending_fulfillment', totalCents: 900, items: [{ label: 'Tee' }], paidAt: iso(1) },
  { id: 'merch-prod', state: 'fulfillment_placed', printfulStatus: 'inprocess', totalCents: 900, items: [{ label: 'Mug' }], paidAt: iso(2) },
  { id: 'merch-ship', state: 'shipped', totalCents: 900, items: [{ label: 'Cap' }], paidAt: iso(3), packages: [{ carrier: 'UPS', trackingNumber: '1Z', trackingUrl: 'https://t.example/1Z', shippedAt: iso(3) }] },
  { id: 'merch-bad', state: 'fulfillment_failed', totalCents: 900, items: [{ label: 'Hat' }], paidAt: iso(4) },
  { id: 'merch-can', state: 'canceled', totalCents: 900, items: [{ label: 'Bag' }], paidAt: iso(5) },
  { id: 'merch-ref', state: 'refunded', totalCents: 900, items: [{ label: 'Pen' }], paidAt: iso(6) },
  { id: 'merch-odd', state: 'mystery_state', totalCents: 900, items: [{ label: 'Odd' }], paidAt: iso(7) },
];
const flowerRows = [{ id: 'flower-1', createdAt: iso(1), deliveryDate: '2026-10-05', orderTotalMinor: 5500, currency: 'usd', orderReference: '559781630', recipientFirstName: 'A', recipientLastName: 'B' }];
const giftRows = [
  gift(1, { giftType: GIFT_TYPES.QRCASH, status: 'unclaimed', createdAt: iso(1) }),
  gift(2, { giftType: GIFT_TYPES.QRCASH, status: 'unclaimed', createdAt: iso(60) }),
  gift(3, { giftType: GIFT_TYPES.QRCASH, status: 'claimed' }),
  gift(4, { giftType: GIFT_TYPES.QRCASH, status: 'fulfilled' }),
  gift(5, { giftType: GIFT_TYPES.GIFT_CARDS }),
  gift(6, { giftType: GIFT_TYPES.GIFT_CARDS, redemptionSecretCiphertext: 'CIPHERTEXT-SECRET' }),
  gift(7, { giftType: GIFT_TYPES.CURATED }),
  gift(8, { giftType: GIFT_TYPES.GIFT_BOX, stripePaymentIntentId: 'pi_confirmed', itemSummary: 'Box confirmed' }),
  gift(9, { giftType: GIFT_TYPES.GIFT_BOX, providerFulfillment: { provider: 'goody', providerOrderId: 'g1', status: 'shipped', shipments: [shipment()], shipmentSummary: { count: 1, anyInTransit: true, trackingAvailable: true } } }),
  gift(10, { giftType: GIFT_TYPES.GIFT_BOX, providerFulfillment: { provider: 'goody', providerOrderId: 'g2', status: 'delivered', shipments: [shipment({ status: 'delivered', deliveredAt: iso(1) })], shipmentSummary: { count: 1, allDelivered: true, trackingAvailable: true } } }),
  gift(11, { giftType: GIFT_TYPES.GIFT_BOX, providerFulfillment: { provider: 'goody', providerOrderId: 'g3', status: 'delivered', shipments: [shipment({ status: 'delivered' })], shipmentSummary: { count: 1, allDelivered: true, trackingAvailable: true } } }),
  gift(12, { giftType: GIFT_TYPES.GIFT_BOX, providerFulfillment: { provider: 'goody', providerOrderId: 'g4', status: 'canceled', canceled: true } }),
  gift(13, { giftType: GIFT_TYPES.GIFT_BOX, providerFulfillment: { provider: 'goody', providerOrderId: 'g5', status: 'refunded', refunded: true } }),
  gift(14, { giftType: GIFT_TYPES.GIFT_BOX, providerFulfillment: { provider: 'goody', providerOrderId: 'g6', status: 'placed', requiresHumanResolution: true } }),
  gift(15, { giftType: GIFT_TYPES.GIFT_BOX, providerFulfillment: { provider: 'goody', providerOrderId: 'g7', status: 'placed' } }),
  gift(16, { giftType: 'weird_type' }),
  gift(17, { giftType: GIFT_TYPES.QRCASH, status: 'mystery_status' }),
];

const seen = [];
const run = (q) => {
  seen.push(q.parameters[0].value);
  const s = q.query;
  let resources;
  if (s.includes('c.printfulStatus')) resources = merchRows;
  else if (s.includes('providerCheckout.providerOrderId AS')) resources = flowerRows;
  else resources = giftRows;
  return { fetchAll: async () => ({ resources }) };
};
const container = { items: { query: run } };
const dispositions = { 'pi_confirmed': 'confirmed' };
const ordersApp = express();
ordersApp.use('/api/orders', createOrdersRouter({
  getMerchOrdersContainer: async () => container,
  getGiftOrdersContainer: async () => container,
  giftBoxDisposition: async (g) => dispositions[g.stripePaymentIntentId] || 'pending',
  requireAuth: (req, _res, next) => { req.user = { id: 'u1' }; next(); },
}));
const orders = await withServer(ordersApp, (port) => get(port, '/api/orders/history'));

let head = 'unknown';
try { head = execFileSync('git', ['-C', BE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(); } catch { /* git unavailable */ }

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify({
  generatedFrom: { backendDir: BE, backendHead: head, node: process.version },
  rowKeys: { merch: merchRows.map((r) => r.id), giftTokens: giftRows.map((r) => r.id), queryUsers: [...new Set(seen)] },
  platformFee,
  orders,
}, null, 2));
console.log(`wrote ${OUT}`);
process.exit(0);
