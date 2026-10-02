// tests/closeout1d.spec.js â€” Team 1D (Settings / Media / Catalog) fixture specs.
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
    // W39: only a demonstrated defect is fixed â€” record the facts.
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

// W39 pixel-sampled contrast: render the banner with text hidden, then sample the REAL gradient
// pixels under the subtitle's text extent (Range rect) and under its whole box; contrast is white
// text vs the lightest sampled pixel (worst case for white text).
test.describe('W39 sampled gradient contrast', () => {
  for (const [name, vp] of [['desktop', DESKTOP], ['mobile', MOBILE]]) {
    test(`media subtitle sampled contrast ${name}`, async ({ page }) => {
      await page.setViewportSize(vp);
      await setup(page);
      await page.goto('/#/dashboard/media');
      const h1 = page.getByRole('heading', { name: 'Media Library' });
      await expect(h1).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(500);
      const info = await page.evaluate(() => {
        const h = document.querySelector('h1'); const sub = h.nextElementSibling; const banner = h.parentElement;
        const r = document.createRange(); r.selectNodeContents(sub);
        const rect = (x) => ({ x: x.x, y: x.y, w: x.width, h: x.height });
        const cs = getComputedStyle(sub);
        return { banner: rect(banner.getBoundingClientRect()), subBox: rect(sub.getBoundingClientRect()), subText: rect(r.getBoundingClientRect()),
          color: cs.color, px: parseFloat(cs.fontSize), weight: parseInt(cs.fontWeight, 10), h1color: getComputedStyle(h).color };
      });
      await page.addStyleTag({ content: 'h1, h1 + p { color: transparent !important; }' });
      const bn = info.banner;
      const buf = await page.screenshot({ clip: { x: bn.x, y: bn.y, width: bn.w, height: bn.h } });
      const res = await page.evaluate(async ({ b64, info }) => {
        const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
        const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const sc = img.width / info.banner.w;
        const lum = (r, gg, b) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(gg) + 0.0722 * f(b); };
        const scan = (box) => {
          const x0 = Math.floor((box.x - info.banner.x) * sc), y0 = Math.floor((box.y - info.banner.y) * sc);
          const w = Math.max(1, Math.floor(box.w * sc)), h = Math.max(1, Math.floor(box.h * sc));
          const d = g.getImageData(Math.max(0, x0), Math.max(0, y0), w, h).data;
          let lo = 2, hi = -1, loPx, hiPx;
          for (let i = 0; i < d.length; i += 4) { const L = lum(d[i], d[i + 1], d[i + 2]); if (L < lo) { lo = L; loPx = [d[i], d[i + 1], d[i + 2]]; } if (L > hi) { hi = L; hiPx = [d[i], d[i + 1], d[i + 2]]; } }
          // white text (L=1): ratio = 1.05/(L+0.05); worst = lightest pixel
          return { lightest: hiPx, darkest: loPx, whiteVsLightest: 1.05 / (hi + 0.05), whiteVsDarkest: 1.05 / (lo + 0.05) };
        };
        return { subText: scan(info.subText), subBox: scan(info.subBox), banner: scan({ ...info.banner }) };
      }, { b64: buf.toString('base64'), info });
      console.log(`SAMPLED ${LABEL} ${name} textColor=${info.color} ${JSON.stringify(res)}`);
      expect(info.color).toBe('rgb(255, 255, 255)');
      const bar = info.px >= 24 || (info.weight >= 700 && info.px >= 18.66) ? 3 : 4.5;
      expect(bar).toBe(3);
      expect(res.subText.whiteVsLightest).toBeGreaterThanOrEqual(bar);
      expect(res.subBox.whiteVsLightest).toBeGreaterThanOrEqual(bar);
    });
  }
});
