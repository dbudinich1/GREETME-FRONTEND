// tests/t1bCommerceFixtures.spec.js
//
// Closeout T1B (W16/W17/W19/W20/W23/W44) â€” fixture-backed render evidence. Every /api/** call is
// answered from memory; nothing reaches a real backend. No charge, order, post, claim or submission.
// Run: npx playwright test --config=playwright.t1b.config.js --project=Desktop
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const API = 'http://127.0.0.1:8099';
const SHOTS = path.resolve('..', 'reports', 'closeout-sprint', 'render-review', 'assets-1b');
fs.mkdirSync(SHOTS, { recursive: true });

const USER = {
  id: 'fixture-user-1', name: 'Alex Fixture', email: 'alex.fixture@example.com',
  photoUrl: 'https://example.com/fixture-photo.jpg', emailVerified: true,
  plan: 'free', tier: 'free', personalizationComplete: true,
};

async function setup(page, { balance = 100, leaderboardCounter = null, cart = null } = {}) {
  await page.addInitScript(([u, c]) => {
    localStorage.setItem('token', 'fixture-token');
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.removeItem('greetme_cart');
    if (c) localStorage.setItem('greetme_cart', JSON.stringify(c));
  }, [USER, cart]);
  await page.route(`${API}/api/**`, (r) => r.fulfill({ json: { ok: true } }));
  await page.route(`${API}/api/profile`, (r) => r.fulfill({ json: { profile: { ...USER } } }));
  await page.route(`${API}/api/hearts/balance`, (r) => r.fulfill({ json: { balance } }));
  await page.route(`${API}/api/hearts/amounts`, (r) => r.fulfill({ json: { amounts: [
    { behavior: 'first_independent_send', amount: 50 },
    { behavior: 'share_act', amount: 25 },
    { behavior: 'share_converted', amount: 100 },
  ] } }));
  await page.route(`${API}/api/hero/me`, (r) => r.fulfill({ json: { ok: true, hero: {
    status: { level: 'active', label: 'Hero Active', since: null, isLegacy: false },
    impact: { business: { totalActivities: 2, bySource: {}, firstActivityAt: null, lastActivityAt: null }, community: { totalActivities: 0, bySource: {} } },
    recentActivity: [], history: [], recognition: { earned: [{ key: 'x', label: 'Fixture Badge', earnedAt: null }], future: [] },
  } } }));
  await page.route(`${API}/api/hero/leaderboard`, (r) => {
    if (leaderboardCounter) leaderboardCounter.n += 1;
    return r.fulfill({ json: { ok: true, leaderboard: { entries: [{ rank: 1, displayName: 'Fixture Person', heroStatus: 'active', activityCount: 9 }], currentUser: null, totalParticipants: 1 } } });
  });
}

test.describe('T1B fixtures', () => {
  test('W19 empty cart: one primary CTA + Back Home link', async ({ page }) => {
    await setup(page);
    await page.goto('/#/dashboard/cart', { waitUntil: 'domcontentloaded' });
    const cta = page.getByTestId('cart-empty-browse-agp');
    await expect(cta).toBeVisible({ timeout: 15000 });
    await expect(cta).toContainText('Browse American Gift Place');
    await expect(page.getByTestId('cart-empty-back-home')).toBeVisible();
    await expect(page.getByRole('button', { name: /Browse Gifts|Shop the American Gift Place/ })).toHaveCount(0);
    await page.screenshot({ path: path.join(SHOTS, 'w19-empty-cart.png') });
    await cta.click();
    await expect(page).toHaveURL(/#\/dashboard\/gifts/);
  });

  test('W19 Back Home goes to the dashboard', async ({ page }) => {
    await setup(page);
    await page.goto('/#/dashboard/cart', { waitUntil: 'domcontentloaded' });
    await page.getByTestId('cart-empty-back-home').click();
    await expect(page).toHaveURL(/#\/dashboard\/?$/);
  });

  test('W20/W23 Hero: lower recognition area dormant, no leaderboard request, upper participation live', async ({ page }) => {
    const counter = { n: 0 };
    await setup(page, { leaderboardCounter: counter });
    await page.goto('/#/dashboard/hero', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Ways to Participate').first()).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('hero-recognition-dormant')).toBeVisible();
    await expect(page.getByText('Community Hero Leaderboard')).toHaveCount(0);
    await expect(page.getByText('Fixture Person')).toHaveCount(0);
    await expect(page.getByText('Fixture Badge')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Hero Status', exact: true })).toHaveCount(0);
    await expect(page.getByText('Business Subscriptions').first()).toBeVisible();
    await expect(page.getByText('Branded Goods').first()).toBeVisible();
    expect(counter.n).toBe(0);
    await page.screenshot({ path: path.join(SHOTS, 'w20-hero-dormant.png'), fullPage: true });
  });

  test('W44 legacy deposit route forwards to the canonical claim page and reads no localStorage gift', async ({ page }) => {
    await setup(page);
    await page.addInitScript(() => {
      localStorage.setItem('greetme_qrcash_gifts', JSON.stringify([{ id: 'abc123', amount: 50, redeemed: false }]));
    });
    await page.goto('/#/redeem/qr-cash/abc123', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/#\/gift\/abc123/, { timeout: 15000 });
    await expect(page.getByText('Cash Received')).toHaveCount(0);
    await expect(page.getByText('Scan to deposit your cash')).toHaveCount(0);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('greetme_qrcash_gifts')));
    expect(stored[0].redeemed).toBe(false);
    expect(await page.evaluate(() => localStorage.getItem('greetme_qrcash_balance'))).toBeNull();
  });

  test('W16/W17 Hearts hub: provenance, dormant share reward, honest reward states', async ({ page }) => {
    await setup(page, { balance: 100 });
    await page.goto('/#/dashboard/rewards', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('hub-balance-provenance')).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: /Buy Hero Hearts/ }).first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Open Hero Hearts' })).toHaveCount(0);
    // Share rewards show "Not live yet", never a Hearts amount.
    const earn = page.getByText('Share the Love').first();
    await expect(earn).toBeVisible();
    await expect(page.getByText('Not live yet').first()).toBeVisible();
    await expect(page.getByText('25 â¤ï¸')).toHaveCount(0);
    // Insufficient balance: no AVAILABLE badge on a reward the user cannot redeem; click explains.
    const need = page.getByRole('button', { name: /Need .* more Hearts/ }).first();
    await expect(need).toBeVisible();
    await need.click();
    await expect(page.getByTestId('reward-shortfall-detail').first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, 'w17-hearts-hub.png'), fullPage: true });
  });

  test('W16 Share the Love panel states sharing does not earn Hearts yet', async ({ page }) => {
    await setup(page);
    await page.goto('/#/dashboard/rewards', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: /Share the Love/ }).first().click();
    await expect(page.getByTestId('share-reward-dormant')).toBeVisible({ timeout: 10000 });
    await page.screenshot({ path: path.join(SHOTS, 'w16-share-panel.png') });
  });
});

// ---------------------------------------------------------------------------------------------
// Dependent tasks (contracts T2-prezzee-claim-response, T2-w18-fee-once, T2-w42-combined-orders).
// Built against the contracts with fixtures only; the live backend endpoints are not exercised.
// ---------------------------------------------------------------------------------------------
const PIN = '4829-1177';
const VOUCHER = 'https://vouchers.example.com/redeem/abc123';
const giftCardGift = (extra = {}) => ({
  giftType: 'gift_cards', itemSummary: 'Fixture Gift Card', recipientName: 'Jamie', senderName: 'Alex',
  senderUserId: 'someone-else', sourceGreetingJobId: 'job-1', createdAt: '2026-10-01T00:00:00Z',
  status: 'redeemable', statusMessage: 'Your gift card is ready to redeem.', voucherUrl: VOUCHER, giftPin: PIN, ...extra,
});

test.describe('T1B dependent tasks', () => {
  test('Prezzee: PIN masked, reveal, copy, open; secret never logged; works URL-only', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const logs = [];
    page.on('console', (m) => logs.push(m.text()));
    await setup(page);
    await page.route(`${API}/api/gifts/claim/tok1`, (r) => r.fulfill({ json: { ok: true, gift: giftCardGift() } }));
    await page.goto('/#/gift/tok1', { waitUntil: 'domcontentloaded' });
    const pin = page.getByTestId('giftcard-pin');
    await expect(pin).toBeVisible({ timeout: 20000 });
    await expect(pin).not.toContainText(PIN);
    await page.getByTestId('giftcard-reveal').click();
    await expect(pin).toContainText(PIN);
    await page.getByTestId('giftcard-copy').click();
    await expect(page.getByText('PIN copied.')).toBeVisible();
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(PIN);
    const open = page.getByTestId('giftcard-open');
    await expect(open).toHaveAttribute('href', VOUCHER);
    await expect(open).toHaveAttribute('target', '_blank');
    await expect(open).toHaveAttribute('rel', /noopener/);
    await page.screenshot({ path: path.join(SHOTS, 'prezzee-redeemable.png') });
    expect(logs.join('\n')).not.toContain(PIN);
    expect(logs.join('\n')).not.toContain(VOUCHER);
    expect(await page.evaluate(() => JSON.stringify({ ...localStorage }))).not.toContain(PIN);
    expect(page.url()).not.toContain(PIN);
  });

  test('Prezzee: URL-only voucher shows Open and no PIN controls; unsafe URL is not linked', async ({ page }) => {
    await setup(page);
    await page.route(`${API}/api/gifts/claim/tok2`, (r) => r.fulfill({ json: { ok: true, gift: giftCardGift({ giftPin: undefined }) } }));
    await page.goto('/#/gift/tok2', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('giftcard-open')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('giftcard-reveal')).toHaveCount(0);
    await page.route(`${API}/api/gifts/claim/tok3`, (r) => r.fulfill({ json: { ok: true, gift: giftCardGift({ voucherUrl: 'javascript:alert(1)', giftPin: undefined }) } }));
    await page.goto('/#/gift/tok3', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('giftcard-preparing')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('giftcard-open')).toHaveCount(0);
  });

  test('Prezzee: being_prepared shows no secret and Check again reaches redeemable; 410 shows expired', async ({ page }) => {
    await setup(page);
    let ready = false;
    await page.route(`${API}/api/gifts/claim/tok4`, (r) => {
      const gift = !ready
        ? { giftType: 'gift_cards', itemSummary: 'Fixture Gift Card', recipientName: 'Jamie', senderName: 'Alex', senderUserId: 'x', status: 'being_prepared', statusMessage: 'Your gift is being prepared.' }
        : giftCardGift();
      return r.fulfill({ json: { ok: true, gift } });
    });
    await page.goto('/#/gift/tok4', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Your gift is being prepared.')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('giftcard-pin')).toHaveCount(0);
    await page.screenshot({ path: path.join(SHOTS, 'prezzee-preparing.png') });
    ready = true;
    await page.getByTestId('giftcard-check-again').click();
    await expect(page.getByTestId('giftcard-pin')).toBeVisible();
    await page.route(`${API}/api/gifts/claim/tok5`, (r) => r.fulfill({ status: 410, json: { ok: false, code: 'GIFT_EXPIRED', error: 'expired' } }));
    await page.goto('/#/gift/tok5', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Gift Expired' })).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('giftcard-pin')).toHaveCount(0);
  });

  const subCart = [{ id: 's1', type: 'subscription', name: 'Social Butterfly', price: 9.99, planTier: 'social_butterfly', period: 'month' }];
  for (const [name, route, expectFee] of [
    ['first activation shows $4.99', { json: { ok: true, consumer: { feeCents: 499, applies: true, reason: 'initial_activation' }, business: { feeCents: 1999, applies: true } } }, '$4.99'],
    ['returning subscriber omits the fee row', { json: { ok: true, consumer: { feeCents: 0, applies: false, reason: 'already_authorized' }, business: { feeCents: 1999, applies: true } } }, null],
    ['503 asserts no amount', { status: 503, json: { ok: false, code: 'FEE_HISTORY_UNAVAILABLE', error: 'x' } }, 'Calculated at checkout'],
  ]) {
    test(`W18 Cart: ${name}`, async ({ page }) => {
      await setup(page, { cart: subCart });
      await page.route(`${API}/api/payments/platform-fee-status`, (r) => r.fulfill(route));
      await page.goto('/#/dashboard/cart', { waitUntil: 'domcontentloaded' });
      const row = page.getByTestId('cart-platform-fee');
      if (expectFee === null) {
        await expect(page.getByText('Social Butterfly').first()).toBeVisible({ timeout: 20000 });
        await page.waitForTimeout(1500);
        await expect(row).toHaveCount(0);
        await expect(page.getByText('$9.99').last()).toBeVisible();
        await page.screenshot({ path: path.join(SHOTS, 'w18-cart-returning.png') });
      } else {
        await expect(row).toContainText(expectFee, { timeout: 20000 });
        if (expectFee.startsWith('Calc')) await expect(page.getByTestId('cart-total-fee-note')).toBeVisible();
        else await expect(page.getByTestId('cart-total-fee-note')).toHaveCount(0);
      }
    });
  }

  test('W42 Orders: gift rows from combined history; delivered only with backend proof; merch + flowers unchanged', async ({ page }) => {
    await setup(page);
    await page.route(`${API}/api/orders/history`, (r) => r.fulfill({ json: { ok: true, count: 5, truncated: false, orders: [
      { orderRef: 'ord_aaaaaaaa11111111', source: 'gift', category: 'qrcash', createdAt: '2026-09-30T00:00:00Z', itemSummary: 'QR Cash gift', recipientName: 'Jamie', amountCents: 2500, status: { kind: 'awaiting_recipient', label: 'Waiting for recipient to claim' }, tracking: { available: false }, requestedDeliveryDate: null, providerReference: null, support: false },
      { orderRef: 'ord_bbbbbbbb22222222', source: 'gift', category: 'gift_box', createdAt: '2026-09-29T00:00:00Z', itemSummary: 'Snack gift box', recipientName: 'Sam', amountCents: 4500, status: { kind: 'processing', label: 'Delivered to doorstep' }, tracking: { available: true, carrier: 'UPS', trackingNumber: '1Z999', trackingUrl: 'https://track.example.com/1Z999' }, requestedDeliveryDate: null, providerReference: null, support: true },
      { orderRef: 'ord_cccccccc33333333', source: 'gift', category: 'gift_box', createdAt: '2026-09-28T00:00:00Z', itemSummary: 'Tea gift box', recipientName: 'Pat', amountCents: 3000, status: { kind: 'delivered', label: 'Delivered' }, tracking: { available: true, carrier: 'UPS', trackingNumber: '1Z111', trackingUrl: 'http://insecure.example.com/x' }, requestedDeliveryDate: null, providerReference: null, support: true },
      { orderRef: 'ord_dddddddd44444444', source: 'merch', category: 'merch', createdAt: '2026-09-27T00:00:00Z', itemSummary: 'Merch duplicate', recipientName: '', amountCents: 1999, status: { kind: 'processing', label: 'Processing' }, tracking: { available: false }, support: false },
      { orderRef: 'ord_eeeeeeee55555555', source: 'flowers', category: 'flowers', createdAt: '2026-09-26T00:00:00Z', itemSummary: 'Flower duplicate', recipientName: '', amountCents: 5000, status: { kind: 'submitted', label: 'Flower order submitted' }, tracking: { available: false }, support: true },
    ] } }));
    await page.route(`${API}/api/merch/orders`, (r) => r.fulfill({ json: { ok: true, orders: [{ id: 'merch-order-12345678', statusKind: 'processing', statusLabel: 'Processing', itemSummary: 'Fixture mug', totalCents: 1999, paidAt: '2026-09-27T00:00:00Z', packages: [] }] } }));
    await page.goto('/#/dashboard/merch/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('gift-orders-section')).toBeVisible({ timeout: 20000 });
    await expect(page.getByTestId('gift-order-row')).toHaveCount(3);
    const statuses = await page.getByTestId('gift-order-status').allTextContents();
    expect(statuses.filter((t) => /deliver/i.test(t))).toEqual(['Delivered']);
    expect(statuses).toContain('Processing');
    await expect(page.getByText('Fixture mug')).toBeVisible();
    await expect(page.getByText('Merch duplicate')).toHaveCount(0);
    await expect(page.getByText('Flower duplicate')).toHaveCount(0);
    await expect(page.locator('a[href="https://track.example.com/1Z999"]')).toHaveCount(1);
    await expect(page.locator('a[href^="http://insecure"]')).toHaveCount(0);
    await page.screenshot({ path: path.join(SHOTS, 'w42-orders.png'), fullPage: true });
  });

  test('W42 Orders: history failure leaves merch list intact', async ({ page }) => {
    await setup(page);
    await page.route(`${API}/api/orders/history`, (r) => r.fulfill({ status: 500, json: { ok: false, error: 'Could not load orders' } }));
    await page.route(`${API}/api/merch/orders`, (r) => r.fulfill({ json: { ok: true, orders: [{ id: 'merch-order-12345678', statusKind: 'processing', statusLabel: 'Processing', itemSummary: 'Fixture mug', totalCents: 1999, paidAt: '2026-09-27T00:00:00Z', packages: [] }] } }));
    await page.goto('/#/dashboard/merch/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Fixture mug')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(/couldn.t load your gift orders/)).toBeVisible();
  });

  test('W42 Orders: renders REAL backend response shapes (generated from the pair backend code)', async ({ page }) => {
    const shapesPath = path.resolve('tests', 'fixtures', 'pair-backend-shapes.generated.json');
    test.skip(!fs.existsSync(shapesPath), 'run src/pages/pairBackendContract.test.mjs first to generate the shapes');
    const shapes = JSON.parse(fs.readFileSync(shapesPath, 'utf8'));
    await setup(page);
    await page.route(`${API}/api/orders/history`, (r) => r.fulfill({ status: shapes.orders.status, json: shapes.orders.body }));
    await page.goto('/#/dashboard/merch/orders', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('gift-orders-section')).toBeVisible({ timeout: 20000 });
    const gift = shapes.orders.body.orders.filter((o) => o.source === 'gift');
    await expect(page.getByTestId('gift-order-row')).toHaveCount(gift.length);
    const statuses = await page.getByTestId('gift-order-status').allTextContents();
    expect(statuses.sort()).toEqual(gift.map((o) => o.status.label).sort());
    expect(statuses.filter((t) => /^delivered$/i.test(t.trim()))).toHaveLength(gift.filter((o) => o.status.kind === 'delivered').length);
    await expect(page.getByText('Status unavailable - contact support').first()).toBeVisible();
    await page.screenshot({ path: path.join(SHOTS, 'w42-orders-real-shapes.png'), fullPage: true });
  });
});