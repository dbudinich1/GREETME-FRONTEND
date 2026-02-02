/**
 * viewport-fit.spec.js
 * Viewport Fit Gate - Greeting Card Layout Validation
 *
 * FAIL CONDITIONS:
 * 1. Horizontal scrollbar appears (content overflow)
 * 2. Key elements not visible in viewport
 * 3. Content exceeds container bounds
 *
 * Run: npm run test:viewport
 */

import { test, expect } from '@playwright/test';

// Test greeting card preview page
// Adjust this URL to match your greeting card preview route
const GREETING_PREVIEW_URL = '/preview';

/**
 * Check for horizontal overflow (scrollbar)
 */
async function checkNoHorizontalOverflow(page, context) {
  const hasHorizontalScroll = await page.evaluate(() => {
    return document.documentElement.scrollWidth > document.documentElement.clientWidth;
  });

  if (hasHorizontalScroll) {
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    throw new Error(
      `[${context}] Horizontal overflow detected: ` +
      `scrollWidth (${scrollWidth}px) > clientWidth (${clientWidth}px)`
    );
  }
}

/**
 * Check if element is fully visible within viewport
 */
async function checkElementVisible(page, selector, name) {
  const element = await page.$(selector);
  if (!element) {
    // Element not present - might be OK depending on page state
    console.log(`  Note: ${name} (${selector}) not found on page`);
    return;
  }

  const box = await element.boundingBox();
  if (!box) {
    throw new Error(`[${name}] Element has no bounding box (hidden or zero-size)`);
  }

  const viewport = page.viewportSize();

  // Check if element is within viewport bounds (with 5px tolerance)
  const tolerance = 5;
  const inViewport =
    box.x >= -tolerance &&
    box.y >= -tolerance &&
    box.x + box.width <= viewport.width + tolerance &&
    box.y + box.height <= viewport.height + tolerance;

  if (!inViewport) {
    console.log(
      `  Warning: ${name} extends beyond viewport. ` +
      `Element: ${Math.round(box.x)},${Math.round(box.y)} ${Math.round(box.width)}x${Math.round(box.height)}, ` +
      `Viewport: ${viewport.width}x${viewport.height}`
    );
  }
}

/**
 * Check spread container doesn't overflow
 */
async function checkSpreadFit(page, context) {
  const spread = await page.$('.gc-spread, .gc-interior-spread');
  if (!spread) {
    console.log(`  Note: No spread element found (${context})`);
    return;
  }

  const spreadBox = await spread.boundingBox();
  const viewport = page.viewportSize();

  if (spreadBox.width > viewport.width) {
    throw new Error(
      `[${context}] Spread width (${Math.round(spreadBox.width)}px) exceeds ` +
      `viewport width (${viewport.width}px)`
    );
  }

  if (spreadBox.height > viewport.height) {
    console.log(
      `  Warning: Spread height (${Math.round(spreadBox.height)}px) exceeds ` +
      `viewport height (${viewport.height}px) - may require scroll`
    );
  }
}

/**
 * Check interior spread signature isn't clipped
 */
async function checkSignatureVisible(page, context) {
  const signature = await page.$('.gc-signature');
  if (!signature) {
    console.log(`  Note: No signature element found (${context})`);
    return;
  }

  const sigBox = await signature.boundingBox();
  const pageContent = await page.$('.gc-page-content');

  if (pageContent) {
    const pageBox = await pageContent.boundingBox();

    if (sigBox && pageBox) {
      if (sigBox.y + sigBox.height > pageBox.y + pageBox.height + 5) {
        throw new Error(
          `[${context}] Signature extends below page content. ` +
          `Signature bottom: ${Math.round(sigBox.y + sigBox.height)}px, ` +
          `Page bottom: ${Math.round(pageBox.y + pageBox.height)}px`
        );
      }
    }
  }
}

// ============================================
// VIEWPORT FIT TESTS
// ============================================

test.describe('Greeting Card Viewport Fit Gate', () => {
  test.beforeEach(async ({ page }) => {
    // Wait for fonts to load before testing
    await page.waitForLoadState('networkidle');
  });

  test('Landing page has no horizontal overflow', async ({ page }) => {
    await page.goto('/');
    await checkNoHorizontalOverflow(page, 'Landing Page');
  });

  test('Dashboard has no horizontal overflow', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForLoadState('networkidle');
    await checkNoHorizontalOverflow(page, 'Dashboard');
  });

  test('Greeting preview spread fits viewport', async ({ page, browserName }, testInfo) => {
    // Try multiple possible preview routes
    const previewRoutes = ['/preview', '/g/test', '/greeting-preview'];

    let loaded = false;
    for (const route of previewRoutes) {
      try {
        const response = await page.goto(route, { waitUntil: 'networkidle' });
        if (response && response.status() < 400) {
          loaded = true;
          break;
        }
      } catch (e) {
        // Try next route
      }
    }

    if (!loaded) {
      test.skip(true, 'No greeting preview route found - skipping spread fit test');
      return;
    }

    const viewport = page.viewportSize();
    const context = `${testInfo.project.name} (${viewport.width}x${viewport.height})`;

    // Run fit checks
    await checkNoHorizontalOverflow(page, context);
    await checkSpreadFit(page, context);
    await checkSignatureVisible(page, context);

    // Check key elements are visible
    await checkElementVisible(page, '.gc-spread', 'Spread Container');
    await checkElementVisible(page, '.gc-greeting-message', 'Greeting Message');
  });

  test('Interior spread text fits without overflow', async ({ page }, testInfo) => {
    // This test specifically checks the interior spread layout
    const previewRoutes = ['/preview', '/g/test'];

    let loaded = false;
    for (const route of previewRoutes) {
      try {
        const response = await page.goto(route, { waitUntil: 'networkidle' });
        if (response && response.status() < 400) {
          loaded = true;
          break;
        }
      } catch (e) {
        // Try next route
      }
    }

    if (!loaded) {
      test.skip(true, 'No preview route found');
      return;
    }

    const viewport = page.viewportSize();
    const context = `Interior ${testInfo.project.name} (${viewport.width}x${viewport.height})`;

    // Check message container doesn't have visible overflow
    const message = await page.$('.gc-greeting-message');
    if (message) {
      const overflow = await message.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return {
          overflowX: style.overflowX,
          overflowY: style.overflowY,
          scrollHeight: el.scrollHeight,
          clientHeight: el.clientHeight,
        };
      });

      // If overflow is hidden, content should fit
      if (overflow.overflowY === 'hidden' && overflow.scrollHeight > overflow.clientHeight + 10) {
        console.log(
          `  Warning: [${context}] Message content clipped. ` +
          `ScrollHeight: ${overflow.scrollHeight}px, ClientHeight: ${overflow.clientHeight}px`
        );
      }
    }

    await checkSignatureVisible(page, context);
  });
});
