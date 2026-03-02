import { test, expect } from '@playwright/test';

// HashRouter route to the dev-only debug fixture
const ROUTE = '/#/__debug/greeting-fixture';

async function getBox(page, selector) {
  const el = page.locator(selector).first();
  await expect(el).toBeVisible({ timeout: 15000 });
  const box = await el.boundingBox();
  if (!box) return null;
  return { ...box, top: box.y, bottom: box.y + box.height, left: box.x, right: box.x + box.width };
}

/**
 * Navigate from envelope → cover → interior spread.
 * Disables animations for reliable clicking through 3D transforms.
 */
async function navigateToInterior(page) {
  // Disable animations so 3D transforms don't block pointer events
  await page.addStyleTag({ content: '*, *::before, *::after { transition: none !important; animation: none !important; }' });

  // Step 1: Click wax seal to advance envelope → cover
  const seal = page.locator('.gc-wax-seal');
  await expect(seal).toBeVisible({ timeout: 10000 });
  await seal.click({ force: true });
  await page.waitForTimeout(1000);

  // Step 2: Click cover to advance cover → interior
  const cover = page.locator('.gc-cover');
  await expect(cover).toBeVisible({ timeout: 10000 });
  await cover.click({ force: true });
  await page.waitForTimeout(1000);

  // Verify we actually reached the interior spread
  const interior = page.locator('.gc-interior-spread');
  const reached = await interior.isVisible({ timeout: 5000 }).catch(() => false);
  if (!reached) {
    throw new Error('BLOCKED (envelope only) — could not navigate to interior spread');
  }
  await page.waitForTimeout(500);
}

/**
 * Navigate from interior → featured → finale spread.
 * Assumes we are already on the interior spread.
 */
async function navigateFromInteriorToFinale(page) {
  // Step 1: Interior → Featured
  const interior = page.locator('.gc-interior-spread');
  await interior.click({ force: true });
  await page.waitForTimeout(1000);

  // Step 2: Featured → Finale
  const featured = page.locator('.gc-featured-spread');
  const featuredVisible = await featured.isVisible({ timeout: 5000 }).catch(() => false);
  if (!featuredVisible) {
    throw new Error('BLOCKED — could not navigate to featured spread');
  }
  await featured.click({ force: true });
  await page.waitForTimeout(1000);

  // Verify we reached the finale
  const finale = page.locator('.gc-finale-spread');
  const reached = await finale.isVisible({ timeout: 5000 }).catch(() => false);
  if (!reached) {
    throw new Error('BLOCKED — could not navigate to finale spread');
  }
  await page.waitForTimeout(500);
}

test.describe('LAYOUT_LOCK invariants', () => {
  test('no clipping + warm wishes right-only + no poem overlap', async ({ page, baseURL }) => {
    const url = (baseURL ? baseURL.replace(/\/$/, '') : 'http://localhost:5173') + ROUTE;

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Navigate through envelope → cover → interior
    await navigateToInterior(page);

    // --- No clipping: intro message ---
    const msg = page.locator('.gc-greeting-message').first();
    await expect(msg).toBeVisible();
    const msgMetrics = await msg.evaluate((el) => ({
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
    }));
    expect(msgMetrics.scrollH).toBeLessThanOrEqual(msgMetrics.clientH);

    // --- No clipping: poem ---
    const poem = page.locator('.gc-poem').first();
    await expect(poem).toBeVisible();
    const poemMetrics = await poem.evaluate((el) => ({
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
    }));
    expect(poemMetrics.scrollH).toBeLessThanOrEqual(poemMetrics.clientH);

    // --- Warm wishes: hidden on left, visible on right ---
    const wwLeft = page.locator('.gc-page-left .gc-warm-wishes').first();
    const wwRight = page.locator('.gc-page-right .gc-warm-wishes').first();

    // Left can be absent or hidden; treat "not found" as pass.
    const leftCount = await wwLeft.count();
    if (leftCount > 0) {
      const leftDisplay = await wwLeft.evaluate((el) => getComputedStyle(el).display);
      const leftVis = await wwLeft.evaluate((el) => getComputedStyle(el).visibility);
      const leftBox = await wwLeft.boundingBox();
      expect(
        leftDisplay === 'none' || leftVis === 'hidden' || !leftBox || leftBox.height === 0
      ).toBeTruthy();
    }

    // Right must be visible
    await expect(wwRight).toBeVisible();
    const rightDisplay = await wwRight.evaluate((el) => getComputedStyle(el).display);
    expect(rightDisplay).not.toBe('none');

    // --- Poem must not intrude into warm wishes area (right page) ---
    const poemBox = await getBox(page, '.gc-page-right .gc-poem');
    const wwBox = await getBox(page, '.gc-page-right .gc-warm-wishes');

    // allow 0–1px due to rounding
    expect(poemBox.bottom).toBeLessThanOrEqual(wwBox.top + 1);

    // --- Desktop only: uniform line-height across all intro elements ---
    if (test.info().project.name === 'Desktop') {
      const lineHeights = await page.evaluate(() => {
        const selectors = [
          '.gc-greeting-salutation',
          '.gc-greeting-occasion',
          '.gc-greeting-message',
          '.gc-signature',
        ];
        return selectors.map((s) => {
          const el = document.querySelector(s);
          return el ? parseFloat(getComputedStyle(el).lineHeight) : null;
        });
      });
      const valid = lineHeights.filter((lh) => lh !== null);
      for (const lh of valid) {
        expect(lh).toBeCloseTo(valid[0], 0);
      }
    }
  });

  test('no clipping on finale closing message', async ({ page, baseURL }) => {
    const url = (baseURL ? baseURL.replace(/\/$/, '') : 'http://localhost:5173') + ROUTE;

    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Navigate envelope → cover → interior → featured → finale
    await navigateToInterior(page);
    await navigateFromInteriorToFinale(page);

    // --- No clipping: finale closing message ---
    const closingMsg = page.locator('.gc-closing-message').first();
    await expect(closingMsg).toBeVisible();
    const metrics = await closingMsg.evaluate((el) => ({
      scrollH: el.scrollHeight,
      clientH: el.clientHeight,
    }));
    expect(metrics.scrollH).toBeLessThanOrEqual(metrics.clientH);
  });
});
