/**
 * viewport-metrics.mjs — READ-ONLY instrumentation script
 * Captures computed typography + layout metrics per viewport per job
 * Uses Playwright to render greeting cards and measure computed styles
 */
import { chromium } from '@playwright/test';
import fs from 'node:fs';
import { requireReadOnlyTarget } from '../safety/apiTarget.mjs';

const VIEWPORTS = [
  { name: '390x844 portrait', w: 390, h: 844 },
  { name: '844x390 landscape', w: 844, h: 390 },
  { name: '667x375 landscape', w: 667, h: 375 },
  { name: '1440x900 desktop', w: 1440, h: 900 },
];

const JOBS = [
  { id: 'cdf469f6-8a58-4748-b4fa-11afc972948c', label: 'R4-Amy (birthday)' },
  { id: 'cae1bce7-7c7b-426a-b82e-464d6fcc82e6', label: 'R4-Ben (thank_you)' },
  { id: '22e9453a-2ddb-428a-b6c9-dfb78e5997fd', label: 'R4-Catherine (congratulations)' },
  { id: '62a98e40-01b9-427f-8dcc-695154fb5c2c', label: 'R4-Grandma Rose (just_because)' },
  { id: 'a67378b2-6a65-4e63-a19d-ac75b9924906', label: 'R4-Alexander Christopher (birthday)' },
];

const BASE_URL = 'http://localhost:5174';
// READ-ONLY diagnostic — fail-closed (Team F). Explicit API_BASE required; a
// production target additionally requires READ_ONLY_PRODUCTION_AUDIT=true and is
// GET/HEAD only. Resolves at module top-level so any rejection throws before I/O.
//   READ_ONLY_PRODUCTION_AUDIT=true API_BASE=https://<prod-host> node scripts/viewport-metrics.mjs
const READONLY = requireReadOnlyTarget({ target: process.env.API_BASE, context: 'viewport-metrics.mjs' });
const API_BASE = READONLY.apiBase;
const SCREENSHOT_DIR = 'viewport-report-screenshots';

async function captureMetrics(page) {
  return page.evaluate(() => {
    const results = {};
    const root = document.documentElement;
    const cs = getComputedStyle(root);

    // Active token values
    results.tokens = {};
    const tokenNames = [
      '--lock-signature-reserve', '--lock-salutation-font-size',
      '--lock-occasion-font-size', '--lock-message-font-size',
      '--lock-message-line-height', '--lock-signature-font-size',
      '--lock-signature-bottom', '--lock-signature-right',
      '--lock-poem-font-size', '--lock-poem-top-gap',
      '--lock-warm-wishes-font-size', '--lock-salutation-margin',
      '--lock-occasion-margin', '--lock-message-margin',
      '--lock-poem-margin', '--lock-poem-content-padding',
      '--lock-poem-line-height', '--lock-poem-max-width',
      '--lock-page-content-top', '--lock-page-content-left',
      '--lock-page-content-right', '--lock-page-content-bottom',
      '--lock-letter-frame', '--lock-right-page-content-padding',
      '--lock-poem-content-margin-top', '--lock-warm-wishes-margin-top',
    ];
    for (const t of tokenNames) {
      results.tokens[t] = cs.getPropertyValue(t).trim() || '(not set)';
    }

    // Helper to get computed style + bounding box for a selector
    function measure(selector) {
      const el = document.querySelector(selector);
      if (!el) return { found: false };
      const s = getComputedStyle(el);
      const rect = el.getBoundingClientRect();
      return {
        found: true,
        fontSize: s.fontSize,
        lineHeight: s.lineHeight,
        margin: s.margin,
        padding: s.padding,
        width: Math.round(rect.width),
        height: Math.round(rect.height),
        top: Math.round(rect.top),
        bottom: Math.round(rect.bottom),
        left: Math.round(rect.left),
        right: Math.round(rect.right),
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        clipped: el.scrollHeight > el.clientHeight + 2,
        overflow: s.overflow,
        overflowY: s.overflowY,
      };
    }

    // Left page elements
    results.salutation = measure('.gc-interior-spread .gc-page-left .gc-greeting-salutation');
    results.occasion = measure('.gc-interior-spread .gc-page-left .gc-greeting-occasion');
    results.message = measure('.gc-interior-spread .gc-page-left .gc-greeting-message');
    results.messageP = measure('.gc-interior-spread .gc-page-left .gc-greeting-message p');
    results.signature = measure('.gc-interior-spread .gc-page-left .gc-signature');

    // Right page elements
    results.poem = measure('.gc-interior-spread .gc-page-right .gc-poem');
    results.poemContent = measure('.gc-interior-spread .gc-page-right .gc-poem-content');
    results.warmWishes = measure('.gc-interior-spread .gc-page-right .gc-warm-wishes');

    // Page containers
    results.pageLeft = measure('.gc-interior-spread .gc-page-left');
    results.pageRight = measure('.gc-interior-spread .gc-page-right');
    results.spread = measure('.gc-interior-spread');
    results.container = measure('.gc-container');

    // Warm Wishes visibility check
    const wwLeft = document.querySelector('.gc-interior-spread .gc-page-left .gc-warm-wishes');
    results.warmWishesLeftVisible = wwLeft ? getComputedStyle(wwLeft).display !== 'none' : 'N/A (not in DOM)';

    // Collision detection: message bottom vs signature top
    if (results.message.found && results.signature.found) {
      results.messageSignatureGap = results.signature.top - results.message.bottom;
      results.messageSignatureCollision = results.signature.top < results.message.bottom;
    }

    // Poem last line visibility
    if (results.poem.found && results.poemContent.found) {
      const poemLines = document.querySelectorAll('.gc-interior-spread .gc-page-right .gc-poem .gc-poem-line');
      if (poemLines.length > 0) {
        const lastLine = poemLines[poemLines.length - 1];
        const lastRect = lastLine.getBoundingClientRect();
        const containerRect = results.poemContent;
        results.poemLastLineBottom = Math.round(lastRect.bottom);
        results.poemContainerBottom = containerRect.bottom;
        results.poemLastLineVisible = lastRect.bottom <= containerRect.bottom + 2;
      }
    }

    return results;
  });
}

async function main() {
  // Create screenshot directory
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const allResults = {};

  for (const job of JOBS) {
    allResults[job.id] = { label: job.label, viewports: {} };

    for (const vp of VIEWPORTS) {
      const context = await browser.newContext({
        viewport: { width: vp.w, height: vp.h },
      });
      const page = await context.newPage();

      // Intercept API call to override status from "failed" to "done"
      await page.route(`${API_BASE}/api/public/greetings/${job.id}`, async (route) => {
        READONLY.assertMethod(route.request().method()); // GET/HEAD only — fail-closed
        const response = await route.fetch();
        const json = await response.json();
        if (json?.greeting) {
          json.greeting.status = 'done';
        }
        await route.fulfill({ json });
      });

      try {
        await page.goto(`${BASE_URL}/#/g/${job.id}`, { waitUntil: 'networkidle', timeout: 15000 });

        // Wait for card to render
        await page.waitForSelector('.gc-container', { timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);

        // Navigate to interior spread using dispatchEvent (bypasses pointer interception)
        // ENVELOPE → COVER → INTERIOR = 2 advances
        for (let adv = 0; adv < 2; adv++) {
          const spread = await page.$('.gc-interior-spread');
          if (spread) break;
          // Use evaluate to directly dispatch click on the seal or trigger React state
          await page.evaluate(() => {
            const seal = document.querySelector('.gc-wax-seal');
            if (seal) { seal.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
            const cover = document.querySelector('.gc-cover');
            if (cover) { cover.dispatchEvent(new MouseEvent('click', { bubbles: true })); return; }
          });
          await page.waitForTimeout(1500);
        }

        // Final wait for spread to be visible
        await page.waitForSelector('.gc-interior-spread', { timeout: 5000 }).catch(() => {});
        await page.waitForTimeout(500);

        // Capture screenshot
        const screenshotName = `${job.id.slice(0, 8)}_${vp.name.replace(/\s+/g, '_')}.png`;
        await page.screenshot({ path: `${SCREENSHOT_DIR}/${screenshotName}`, fullPage: false });

        // Capture metrics
        const metrics = await captureMetrics(page);
        allResults[job.id].viewports[vp.name] = {
          metrics,
          screenshot: screenshotName,
        };

        console.log(`  OK: ${job.label.slice(0, 30)} @ ${vp.name}`);
      } catch (err) {
        console.error(`  FAIL: ${job.label.slice(0, 30)} @ ${vp.name}: ${err.message}`);
        allResults[job.id].viewports[vp.name] = { error: err.message };
      }

      await context.close();
    }
  }

  await browser.close();

  // Write raw JSON results
  fs.writeFileSync('viewport-metrics-raw.json', JSON.stringify(allResults, null, 2));
  console.log('\nResults written to viewport-metrics-raw.json');
  console.log(`Screenshots in ${SCREENSHOT_DIR}/`);
}

main().catch(console.error);
