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
 * The GreetingCard starts at ENVELOPE; we advance twice to reach INTERIOR.
 * Uses dispatchEvent because the wax seal is on the envelope back face
 * (3D rotated) and not actionable via normal Playwright .click().
 */
async function navigateToInterior(page) {
  // Step 1: Click wax seal to advance envelope → cover
  await page.waitForSelector('.gc-wax-seal', { timeout: 10000 });
  await page.evaluate(() => {
    const seal = document.querySelector('.gc-wax-seal');
    if (seal) seal.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000);

  // Step 2: Click cover to advance cover → interior
  await page.waitForSelector('.gc-cover', { timeout: 10000 });
  await page.evaluate(() => {
    const cover = document.querySelector('.gc-cover');
    if (cover) cover.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await page.waitForTimeout(1000);

  // Wait for interior spread to be visible and auto-fit to settle
  await expect(page.locator('.gc-interior-spread')).toBeVisible({ timeout: 15000 });
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
});
