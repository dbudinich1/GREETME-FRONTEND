// tests/closeout1d.spec.js — Team 1D (Settings / Media / Catalog) fixture specs.
// Fully isolated: every /api/** call is answered from fixtures. No real DSAR, deletion, upload,
// password-reset email or catalog mutation is ever sent.
//
// Run (proposed): npx playwright test -c playwright.closeout1d.config.js
// Run (baseline renders): BASE_URL=http://127.0.0.1:5221 LABEL=current npx playwright test -c playwright.closeout1d.config.js -g "render"
import { test, expect } from '@playwright/test';

const OUT = 'C:/1_GREET-ME/reports/closeout-sprint/render-review/assets-1d';
const LABEL = process.env.LABEL || 'proposed';
const API = 'http://127.0.0.1:8099';
const DESKTOP = { width: 1440, height: 900 };
const MOBILE = { width: 390, height: 844 };

const USER = { id: 'u1', name: 'Alex Fixture', email: 'alex.fixture@example.com', emailVerified: true,
  plan: 'free', tier: 'free', personalizationComplete: true };
const FOUNDER = { ...USER, plan: 'founder', tier: 'founder' };

const PROVIDERS = [
  { providerId: 'florist_one', label: 'Florist One', enabled: true, browseAvailable: true },
  { providerId: 'goody', label: 'Goody', enabled: false, reason: 'Not yet activated', launchBlockerIds: ['approval_missing'] },
  { providerId: 'prezzee', label: 'Prezzee', enabled: true, browseAvailable: false, reason: 'no_browsable_catalog' },
];

async function setup(page, user = USER, { auth = true } = {}) {
  if (auth) {
    await page.addInitScript((u) => {
      localStorage.setItem('token', 'fixture-token');
      localStorage.setItem('user', JSON.stringify(u));
    }, user);
  }
  // Keep the run hermetic: block third-party analytics.
  await page.route(/google-analytics|googletagmanager|doubleclick/, (r) => r.abort());
  await page.route(`${API}/api/**`, (r) => r.fulfill({ json: { ok: true } }));
  await page.route(`${API}/api/profile`, (r) => r.fulfill({ json: { profile: user } }));
  await page.route(`${API}/api/wallet`, (r) => r.fulfill({ json: { ok: true, wallet: {
    unmetered: false, totalSpendableNow: 2, monthly: { remaining: 2, cap: 3 }, anytime: { available: 0, includedCap: 0 },
    banked: { available: 0, cap: 0 }, purchased: { animationCredits: 0, spendable: true } } } }));
  await page.route(`${API}/api/founder/catalog/providers`, (r) => r.fulfill({ json: { ok: true, providers: PROVIDERS } }));
  await page.route(`${API}/api/founder/catalog/items**`, (r) => r.fulfill({ json: { ok: true, items: [] } }));
  await page.route(`${API}/api/founder/catalog/merch`, (r) => r.fulfill({ json: { ok: true, items: [] } }));
}

const overflowX = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

for (const [name, vp] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
  test(`render media library ${name}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await setup(page);
    await page.goto('/#/dashboard/media');
    await expect(page.getByRole('heading', { name: 'Media Library' })).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/${LABEL}-media-${name}.png`, fullPage: true });
    // W39: only a demonstrated defect is fixed — record the facts.
    expect(await overflowX(page)).toBeLessThanOrEqual(0);
    if (LABEL === 'proposed') {
      // W40
      await expect(page.getByRole('button', { name: /Add Recipient/ })).toHaveCount(0);
      // W41 partial
      await expect(page.getByText(/coming soon/i)).toHaveCount(0);
      await expect(page.getByText('Add Greet-Me™ to Your Home Screen')).toBeVisible();
      await expect(page.getByText(/No app store needed/)).toBeVisible();
      await expect(page.getByText(/Download Greet-Me/)).toHaveCount(0);
    }
  });

  test(`render settings ${name}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await setup(page);
    await page.goto('/#/dashboard/settings');
    await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/${LABEL}-settings-${name}.png`, fullPage: true });
    if (LABEL === 'proposed') {
      await page.getByTestId('privacy-export-button').click();
      await page.getByTestId('privacy-request-panel').scrollIntoViewIfNeeded();
      await page.screenshot({ path: `${OUT}/${LABEL}-settings-privacy-open-${name}.png`, fullPage: true });
      expect(await overflowX(page)).toBeLessThanOrEqual(0);
    }
  });

  test(`render catalog providers ${name}`, async ({ page }) => {
    await page.setViewportSize(vp);
    await setup(page, FOUNDER);
    await page.goto('/#/dashboard/gifts');
    await page.getByRole('button', { name: /Manage Catalog/ }).click();
    await expect(page.getByTestId('providers-status-list')).toBeVisible({ timeout: 15000 });
    await page.screenshot({ path: `${OUT}/${LABEL}-catalog-providers-${name}.png` });
    if (LABEL === 'proposed') {
      for (const id of ['florist_one', 'goody', 'prezzee', 'printful']) {
        const t = (await page.getByTestId(`provider-status-badge-${id}`).textContent()) + (await page.getByTestId(`provider-catalog-caption-${id}`).textContent());
        expect(t).not.toMatch(/Active|Dormant/);
      }
      await expect(page.getByTestId('provider-status-badge-florist_one')).toHaveText('Integration enabled');
      await expect(page.getByTestId('provider-status-badge-goody')).toHaveText('Integration off');
      await expect(page.getByTestId('provider-catalog-caption-prezzee')).toContainText('No browsable catalog');
    }
  });
}

test.describe('W08 privacy requests (no real request)', () => {
  for (const [kind, subject] of [['export', 'Data Export Request'], ['delete', 'Account Deletion Request']]) {
    test(`${kind}: no blank tab, visible address, copy fallback, honest pending state, cancel`, async ({ page, context }) => {
      await setup(page);
      let popups = 0; context.on('page', () => { popups += 1; });
      const apiPosts = []; page.on('request', (q) => { if (q.method() !== 'GET' && q.url().includes('/api/')) apiPosts.push(q.url()); });
      // Simulate no clipboard API at all (fallback path).
      await page.addInitScript(() => { Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true }); });
      await page.goto('/#/dashboard/settings');
      const url0 = page.url();
      await page.getByTestId(`privacy-${kind}-button`).click();
      await expect(page.getByTestId('privacy-support-address')).toHaveText('support@greet-me.com');
      await expect(page.getByTestId('privacy-subject')).toHaveText(subject);
      await expect(page.getByTestId('privacy-pending-note')).toContainText('Nothing has been submitted yet');
      await expect(page.getByTestId('privacy-mailto-link')).toHaveAttribute('href', new RegExp(`^mailto:support@greet-me.com\\?subject=${encodeURIComponent(subject).replace(/%/g, '%')}`));
      await page.getByTestId('privacy-copy-button').click();
      await expect(page.getByTestId('privacy-copy-status')).toContainText("Couldn't copy automatically");
      // keyboard: panel buttons reachable, Close dismisses
      await page.getByTestId('privacy-close-button').focus();
      await page.keyboard.press('Enter');
      await expect(page.getByTestId('privacy-request-panel')).toHaveCount(0);
      expect(page.url()).toBe(url0);
      expect(popups).toBe(0);
      expect(apiPosts).toEqual([]);
    });
  }

  test('copy succeeds when clipboard is available', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await setup(page);
    await page.goto('/#/dashboard/settings');
    await page.getByTestId('privacy-export-button').click();
    await page.getByTestId('privacy-copy-button').click();
    await expect(page.getByTestId('privacy-copy-status')).toContainText('copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('support@greet-me.com');
  });
});

test.describe('W09 reset password', () => {
  test('signed-in: honest wording and email prefilled; no reset email sent', async ({ page }) => {
    await setup(page);
    const posts = []; page.on('request', (q) => { if (q.method() === 'POST' && q.url().includes('/api/')) posts.push(q.url()); });
    await page.goto('/#/dashboard/settings');
    await expect(page.getByText('Reset password', { exact: true })).toBeVisible();
    await expect(page.getByTestId('reset-password-help')).toContainText('password reset link to alex.fixture@example.com');
    await page.getByTestId('reset-password-button').click();
    await expect(page).toHaveURL(/#\/forgot-password/);
    await expect(page.locator('input[type="email"]')).toHaveValue('alex.fixture@example.com');
    expect(posts).toEqual([]);
  });

  test('guest arrival at /forgot-password is unchanged (empty field)', async ({ page }) => {
    await setup(page, USER, { auth: false });
    await page.goto('/#/forgot-password');
    await expect(page.locator('input[type="email"]')).toHaveValue('');
  });
});

// W39 banner contrast (Media Library). Worst case = min over the gradient's colour stops.
test.describe('W39 banner contrast', () => {
  for (const [name, vp] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
    test(`media banner text contrast ${name}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await setup(page);
      await page.goto('/#/dashboard/media');
      const h1 = page.getByRole('heading', { name: 'Media Library' });
      await expect(h1).toBeVisible({ timeout: 15000 });
      const m = await page.evaluate(() => {
        const parse = (s) => (s.match(/rgba?\([^)]*\)/g) || []).map((c) => c.match(/[\d.]+/g).map(Number));
        const lum = ([r, g, b]) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
        const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
        const h = document.querySelector('h1');
        const banner = h.parentElement;
        const stops = parse(getComputedStyle(banner).backgroundImage);
        const out = {};
        for (const [k, el] of [['h1', h], ['sub', h.nextElementSibling]]) {
          const cs = getComputedStyle(el);
          const [r, g, b, a = 1] = parse(cs.color)[0];
          const eff = Math.min(1, a * parseFloat(cs.opacity));
          const px = parseFloat(cs.fontSize); const bold = parseInt(cs.fontWeight, 10) >= 700;
          const large = px >= 24 || (bold && px >= 18.66);
          const ratios = stops.map((s) => ratio([r * eff + s[0] * (1 - eff), g * eff + s[1] * (1 - eff), b * eff + s[2] * (1 - eff)], s));
          out[k] = { color: cs.color, opacity: cs.opacity, px, large, min: Math.min(...ratios), ratios };
        }
        return out;
      });
      console.log(`CONTRAST ${LABEL} ${name} ${JSON.stringify(m)}`);
      await page.screenshot({ path: `${OUT}/${LABEL}-media-banner-${name}.png`, clip: { x: 0, y: 0, width: vp.width, height: Math.min(vp.height, 520) } });
      expect(m.h1.min).toBeGreaterThanOrEqual(m.h1.large ? 3 : 4.5);
      expect(m.sub.min).toBeGreaterThanOrEqual(m.sub.large ? 3 : 4.5);
    });
  }
});
