// tests/t1bMerchGuard.spec.js
//
// Merch expected-price guard, fixture-backed BROWSER run. The 409/400 bodies are the REAL ones produced
// by the combined backend's own evaluateMerchPriceGuard (tests/fixtures/combined-backend-fee-shapes.generated.json,
// written by src/utils/merchPriceGuard.test.mjs). Every /api/** call is answered in memory and the Stripe
// redirect target is intercepted: no real charge, session or order. No rate is toggled anywhere.
// Run: npx playwright test --config=playwright.t1b.config.js --project=Desktop
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const API = 'http://127.0.0.1:8099';
const STRIPE = 'https://checkout.stripe.test';
const SHOTS = path.resolve('..', 'reports', 'closeout-sprint', 'render-review', 'assets-1b');
fs.mkdirSync(SHOTS, { recursive: true });
const SHAPES = path.resolve('tests', 'fixtures', 'combined-backend-fee-shapes.generated.json');
const USER = { id: 'fixture-user-1', name: 'Alex Fixture', email: 'alex.fixture@example.com', photoUrl: 'https://example.com/p.jpg', emailVerified: true, plan: 'free', tier: 'free', personalizationComplete: true };

function loadShapes() {
  test.skip(!fs.existsSync(SHAPES), 'run src/utils/merchPriceGuard.test.mjs first to generate the real backend shapes');
  return JSON.parse(fs.readFileSync(SHAPES, 'utf8'));
}

// A cart exactly as Merch.jsx builds it, priced before any rate change.
const cartFrom = (prices) => prices.map((p, i) => ({
  id: 100 + i, printfulSyncVariantId: p.syncVariantId, printfulSyncProductId: 1 + i, variantLabel: 'M',
  name: `Branded item ${i + 1}`, price: p.priceCents / 100, priceCents: p.priceCents, category: 'Merch',
}));

async function setup(page, cart) {
  const posts = [];
  const stripeHits = [];
  await page.addInitScript(([u, c]) => {
    localStorage.setItem('token', 'fixture-token');
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.setItem('greetme_cart', JSON.stringify(c));
  }, [USER, cart]);
  await page.route(`${API}/api/**`, (r) => r.fulfill({ json: { ok: true } }));
  await page.route(`${API}/api/profile`, (r) => r.fulfill({ json: { profile: { ...USER } } }));
  await page.route(`${API}/api/merch/shipping-rates`, (r) => r.fulfill({ json: { ok: true, shipping: { rateCents: 500, label: 'Standard Shipping' } } }));
  await page.route(`${STRIPE}/**`, (r) => { stripeHits.push(r.request().url()); return r.fulfill({ contentType: 'text/html', body: '<html><body>stripe fixture</body></html>' }); });
  return { posts, stripeHits };
}

/** Route create-checkout through `decide(callNumber, body)`; records every request body. */
async function routeCheckout(page, posts, decide) {
  await page.route(`${API}/api/payments/create-checkout`, (r) => {
    const body = r.request().postDataJSON();
    posts.push(body);
    return r.fulfill(decide(posts.length, body));
  });
}

async function fillShipping(page) {
  await page.getByPlaceholder('Who should we ship this to?').fill('Dana Recipient');
  await page.getByPlaceholder('123 Main Street').fill('12 Elm St');
  const inputs = page.locator('input[type="text"]');
  await page.locator('label:has-text("City") + input').fill('Newark');
  await page.locator('label:has-text("State") + select').selectOption('NJ');
  await page.locator('label:has-text("ZIP") + input').fill('07102');
  await expect(page.getByText('Shipping (Standard Shipping)')).toBeVisible({ timeout: 15000 });
  await expect(page.getByText('$5.00').first()).toBeVisible({ timeout: 15000 });
  void inputs;
}
const complete = (page) => page.getByRole('button', { name: /Complete Order/ });
const noFeeWords = /markup|mark-up|convenience|service fee|processing fee|platform fee|5%|at cost|no fees?\b/i;

test.describe('merch expected-price guard (real backend shapes)', () => {
  test('stale cart: 409 MERCH_PRICE_CHANGED shows refreshed prices, needs a renewed click, creates no Stripe session', async ({ page }) => {
    const S = loadShapes();
    const { posts, stripeHits } = await setup(page, cartFrom(S.merch.pricesAtRate0));
    await routeCheckout(page, posts, (n, body) => (n === 1
      ? { status: 409, json: S.merch.heldAcrossRateChange.body }
      : { status: 200, json: { ok: true, url: `${STRIPE}/c/pay_1` } }));
    await page.goto('/#/dashboard/checkout', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Branded item 1').first()).toBeVisible({ timeout: 30000 });
    await expect(page.getByText('$29.00').first()).toBeVisible();
    await fillShipping(page);

    await complete(page).click();
    const notice = page.getByTestId('merch-price-notice');
    await expect(notice).toBeVisible({ timeout: 15000 });
    await expect(notice).toContainText('$43.00 to $45.15');
    await expect(notice).toContainText('Nothing has been charged');
    // Exactly ONE payment request, and it carried the stale subtotal the customer had seen.
    expect(posts).toHaveLength(1);
    expect(posts[0].purchaseType).toBe('merch');
    expect(posts[0].expectedSubtotalCents).toBe(4300);
    // Refreshed item prices and the new total (45.15 + 5.00 shipping) are on screen; no redirect happened.
    await expect(page.getByText('$30.45').first()).toBeVisible();
    await expect(page.getByText('$14.70').first()).toBeVisible();
    await expect(page.getByText('$50.15').first()).toBeVisible();
    await page.waitForTimeout(800);
    expect(stripeHits).toHaveLength(0);
    expect(page.url()).not.toContain('stripe.test');
    expect(posts).toHaveLength(1); // no automatic retry at the new price
    await expect(page.locator('body')).not.toContainText(noFeeWords);
    await page.screenshot({ path: path.join(SHOTS, 'merch-guard-price-changed.png'), fullPage: true });

    // Only the customer's own renewed confirmation resubmits, with the NEW expected subtotal.
    await complete(page).click();
    await expect.poll(() => posts.length, { timeout: 15000 }).toBe(2);
    expect(posts[1].expectedSubtotalCents).toBe(S.merch.heldAcrossRateChange.body.subtotalCents);
    await expect.poll(() => stripeHits.length, { timeout: 15000 }).toBe(1);
  });

  test('legacy client at an elevated rate: 409 MERCH_PRICE_CONFIRMATION_REQUIRED gets the same refresh-and-reconfirm recovery', async ({ page }) => {
    const S = loadShapes();
    const { posts, stripeHits } = await setup(page, cartFrom(S.merch.pricesAtRate0));
    await routeCheckout(page, posts, (n) => (n === 1
      ? { status: 409, json: S.merch.legacyAtElevatedRate.body }
      : { status: 200, json: { ok: true, url: `${STRIPE}/c/pay_2` } }));
    await page.goto('/#/dashboard/checkout', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Branded item 1').first()).toBeVisible({ timeout: 30000 });
    await fillShipping(page);
    await complete(page).click();
    const notice = page.getByTestId('merch-price-notice');
    await expect(notice).toContainText('refreshed the prices', { timeout: 15000 });
    await expect(notice).toContainText('$45.15');
    await expect(page.getByText('$30.45').first()).toBeVisible();
    expect(posts).toHaveLength(1);
    await page.waitForTimeout(800);
    expect(stripeHits).toHaveLength(0);
    await expect(page.locator('body')).not.toContainText(noFeeWords);
    await complete(page).click();
    await expect.poll(() => posts.length, { timeout: 15000 }).toBe(2);
    expect(posts[1].expectedSubtotalCents).toBe(S.merch.legacyAtElevatedRate.body.subtotalCents);
    await expect.poll(() => stripeHits.length, { timeout: 15000 }).toBe(1);
  });

  test('rate 0: the matching expected value proceeds on the first click, with one request and one redirect', async ({ page }) => {
    const S = loadShapes();
    expect(S.merch.productionRate).toBe(0);
    const { posts, stripeHits } = await setup(page, cartFrom(S.merch.pricesAtRate0));
    await routeCheckout(page, posts, () => ({ status: 200, json: { ok: true, url: `${STRIPE}/c/pay_3` } }));
    await page.goto('/#/dashboard/checkout', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Branded item 1').first()).toBeVisible({ timeout: 30000 });
    await fillShipping(page);
    await complete(page).click();
    await expect.poll(() => stripeHits.length, { timeout: 15000 }).toBe(1);
    expect(posts).toHaveLength(1);
    expect(posts[0].expectedSubtotalCents).toBe(4300);
    expect(S.merch.matchingAtRate0.action).toBe('proceed'); // what the real backend does with exactly this value
    expect(S.merch.legacyAtRate0.action).toBe('proceed'); // and with no value at all (the old flow, unchanged)
  });

  test('malformed 400 is an error message, never a price change; prices and disclosures stay as shown', async ({ page }) => {
    const S = loadShapes();
    const { posts, stripeHits } = await setup(page, cartFrom(S.merch.pricesAtRate0));
    await routeCheckout(page, posts, () => ({ status: 400, json: S.merch.malformedFraction.body }));
    await page.goto('/#/dashboard/checkout', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Branded item 1').first()).toBeVisible({ timeout: 30000 });
    await fillShipping(page);
    await complete(page).click();
    await expect.poll(() => posts.length, { timeout: 15000 }).toBe(1);
    await expect(page.getByTestId('merch-price-notice')).toHaveCount(0);
    await expect(page.getByText('$29.00').first()).toBeVisible(); // prices untouched
    await expect(page.getByText('$14.00').first()).toBeVisible();
    await expect(page.getByText('Shipping (Standard Shipping)')).toBeVisible();
    await expect(page.getByText('$48.00').first()).toBeVisible(); // 43.00 + 5.00 shipping, unchanged
    await page.waitForTimeout(800);
    expect(stripeHits).toHaveLength(0);
    expect(posts).toHaveLength(1);
    await expect(page.locator('body')).not.toContainText(noFeeWords);
  });

  test('an untrusted 409 body (does not add up) changes nothing and tells the customer nothing was charged', async ({ page }) => {
    const S = loadShapes();
    const { posts, stripeHits } = await setup(page, cartFrom(S.merch.pricesAtRate0));
    const bad = { ...S.merch.heldAcrossRateChange.body, subtotalCents: S.merch.heldAcrossRateChange.body.subtotalCents + 7 };
    await routeCheckout(page, posts, () => ({ status: 409, json: bad }));
    await page.goto('/#/dashboard/checkout', { waitUntil: 'domcontentloaded' });
    await expect(page.getByText('Branded item 1').first()).toBeVisible({ timeout: 30000 });
    await fillShipping(page);
    await complete(page).click();
    await expect(page.getByText(/Nothing was charged/)).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('merch-price-notice')).toHaveCount(0);
    await expect(page.getByText('$29.00').first()).toBeVisible();
    expect(posts).toHaveLength(1);
    expect(stripeHits).toHaveLength(0);
  });
});
