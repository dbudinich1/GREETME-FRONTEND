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

async function setup(page, { balance = 100, leaderboardCounter = null } = {}) {
  await page.addInitScript((u) => {
    localStorage.setItem('token', 'fixture-token');
    localStorage.setItem('user', JSON.stringify(u));
    localStorage.removeItem('greetme_cart');
  }, USER);
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
