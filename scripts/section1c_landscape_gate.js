/**
 * section1c_landscape_gate.js
 * Phase 5 / Section 1C — Playwright landscape compression gate
 *
 * Verifies that the Chrome landscape vertical compression fix (commit 4e001e5)
 * works correctly by:
 *   1. Opening a public greeting card URL
 *   2. Navigating through all 5 spreads at 4 viewports
 *      (390x844, 844x390, 1600x600, 1440x500)
 *   3. Taking screenshots of each spread
 *   4. Running DOM bounding-box checks for clipping/overflow
 *   5. Collecting console errors
 *
 * Usage:
 *   JOB_ID=<jobId> node scripts/section1c_landscape_gate.js
 *   BASE_URL=https://greet-me.com JOB_ID=abc123 node scripts/section1c_landscape_gate.js
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://greet-me.com';
const JOB_ID = process.env.JOB_ID;

if (!JOB_ID) {
  console.error('ERROR: JOB_ID env var is required.\nUsage: JOB_ID=<id> node scripts/section1c_landscape_gate.js');
  process.exit(1);
}

const URL = `${BASE_URL}/#/g/${JOB_ID}`;
const ARTIFACT_DIR = path.resolve('test-artifacts/section1c');

const VIEWPORTS = [
  { width: 390,  height: 844, name: '390x844' },
  { width: 844,  height: 390, name: '844x390' },
  { width: 1600, height: 600, name: '1600x600' },
  { width: 1440, height: 500, name: '1440x500' },
];

const SPREAD_NAMES = ['envelope', 'cover', 'interior', 'featured', 'finale'];

// Known benign console warnings to ignore
const BENIGN_PATTERNS = [
  /passive event listener/i,
  /third-party cookie/i,
  /DevTools/i,
  /Download the React DevTools/i,
  /Manifest/i,
  /favicon/i,
];

function isBenign(text) {
  return BENIGN_PATTERNS.some((re) => re.test(text));
}

// ── DOM bounding-box checks ──
async function runBoundingBoxChecks(page, spread) {
  const failures = [];
  const vpHeight = await page.evaluate(() => window.innerHeight);
  const vpWidth = await page.evaluate(() => window.innerWidth);

  // Check 1: .gc-container must not exceed viewport height
  // In landscape: overflow:hidden enforced, so container MUST fit in viewport.
  // In portrait: page scrolls (header/CTA visible), so container extending
  // beyond viewport is expected. Only enforce strict fit in landscape.
  const isLandscape = vpWidth > vpHeight;
  const containerBox = await page.evaluate(() => {
    const el = document.querySelector('.gc-container');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { top: r.top, bottom: r.bottom, height: r.height, left: r.left, right: r.right, width: r.width };
  });

  if (containerBox && isLandscape) {
    // Allow 2px tolerance for sub-pixel rendering
    if (containerBox.bottom > vpHeight + 2) {
      failures.push(`gc-container bottom (${containerBox.bottom.toFixed(1)}px) exceeds viewport height (${vpHeight}px) — clipping detected`);
    }
  }

  // Check 2: Cover title not cropped (only on cover spread)
  if (spread === 'cover') {
    const coverCheck = await page.evaluate(() => {
      const title = document.querySelector('.gc-cover-title');
      const cover = document.querySelector('.gc-cover');
      if (!title || !cover) return null;
      const tBox = title.getBoundingClientRect();
      const cBox = cover.getBoundingClientRect();
      return {
        titleRight: tBox.right,
        coverRight: cBox.right,
        titleBottom: tBox.bottom,
        coverBottom: cBox.bottom,
        titleLeft: tBox.left,
        coverLeft: cBox.left,
      };
    });

    if (coverCheck) {
      if (coverCheck.titleRight > coverCheck.coverRight + 2) {
        failures.push(`Cover title right edge (${coverCheck.titleRight.toFixed(1)}) exceeds cover right (${coverCheck.coverRight.toFixed(1)}) — title cropped`);
      }
      if (coverCheck.titleBottom > coverCheck.coverBottom + 2) {
        failures.push(`Cover title bottom (${coverCheck.titleBottom.toFixed(1)}) exceeds cover bottom (${coverCheck.coverBottom.toFixed(1)}) — title cropped`);
      }
    }
  }

  // Check 3: Left page content not exceeding its parent page (interior spread)
  if (spread === 'interior') {
    const interiorCheck = await page.evaluate(() => {
      const content = document.querySelector('.gc-page-content');
      const parentPage = content ? content.closest('.gc-page-left') || content.closest('.gc-page') : null;
      if (!content || !parentPage) return null;
      const cBox = content.getBoundingClientRect();
      const pBox = parentPage.getBoundingClientRect();
      return {
        contentBottom: cBox.bottom,
        pageBottom: pBox.bottom,
        contentRight: cBox.right,
        pageRight: pBox.right,
      };
    });

    if (interiorCheck) {
      // Tolerance of 30px: auto-fit content with absolute positioning may extend
      // slightly past page edge; parent overflow:hidden clips it visually
      if (interiorCheck.contentBottom > interiorCheck.pageBottom + 30) {
        failures.push(`Interior content bottom (${interiorCheck.contentBottom.toFixed(1)}) exceeds page-left bottom (${interiorCheck.pageBottom.toFixed(1)}) by >${30}px — content overflowing`);
      }
    }
  }

  // Check 4: Featured spread — video frame and album must not overflow page, tops should align
  if (spread === 'featured' && isLandscape) {
    const featuredCheck = await page.evaluate(() => {
      const vf = document.querySelector('.gc-video-frame');
      const as = document.querySelector('.gc-album-stack');
      const videoPage = document.querySelector('.gc-video-page');
      const albumPage = document.querySelector('.gc-album-page');
      if (!vf || !as || !videoPage || !albumPage) return null;
      const vfBox = vf.getBoundingClientRect();
      const asBox = as.getBoundingClientRect();
      const vpBox = videoPage.getBoundingClientRect();
      const apBox = albumPage.getBoundingClientRect();
      return {
        videoFrameTop: vfBox.top,
        videoFrameBottom: vfBox.bottom,
        videoFrameHeight: vfBox.height,
        videoPageTop: vpBox.top,
        videoPageBottom: vpBox.bottom,
        videoPageHeight: vpBox.height,
        albumStackTop: asBox.top,
        albumStackBottom: asBox.bottom,
        albumStackHeight: asBox.height,
        albumPageTop: apBox.top,
        albumPageBottom: apBox.bottom,
        albumPageHeight: apBox.height,
        topDiff: Math.abs(asBox.top - vfBox.top),
      };
    });

    if (featuredCheck) {
      // Video frame should not extend above its page
      if (featuredCheck.videoFrameTop < featuredCheck.videoPageTop - 2) {
        failures.push(`Video frame top (${featuredCheck.videoFrameTop.toFixed(1)}) above page top (${featuredCheck.videoPageTop.toFixed(1)}) — overflow`);
      }
      // Video frame should not extend below its page
      if (featuredCheck.videoFrameBottom > featuredCheck.videoPageBottom + 2) {
        failures.push(`Video frame bottom (${featuredCheck.videoFrameBottom.toFixed(1)}) below page bottom (${featuredCheck.videoPageBottom.toFixed(1)}) — overflow`);
      }
      // Album stack should not extend below its page
      if (featuredCheck.albumStackBottom > featuredCheck.albumPageBottom + 2) {
        failures.push(`Album stack bottom (${featuredCheck.albumStackBottom.toFixed(1)}) below page bottom (${featuredCheck.albumPageBottom.toFixed(1)}) — overflow`);
      }
      // Video and album top edges should be within 40px of each other
      // (album title above stack vs video caption below frame creates inherent offset)
      if (featuredCheck.topDiff > 40) {
        failures.push(`Video/album top misalignment: ${featuredCheck.topDiff.toFixed(1)}px (max 40px)`);
      }
    }
  }

  // Check 5: Finale spread — check vertical centering (should not be clipped at bottom)
  if (spread === 'finale') {
    const finaleCheck = await page.evaluate(() => {
      const spread = document.querySelector('.gc-finale-spread');
      if (!spread) return null;
      const r = spread.getBoundingClientRect();
      return { bottom: r.bottom, top: r.top, height: r.height };
    });

    if (finaleCheck && finaleCheck.bottom > vpHeight + 2) {
      failures.push(`Finale spread bottom (${finaleCheck.bottom.toFixed(1)}) exceeds viewport (${vpHeight}) — bottom clipping`);
    }
  }

  return failures;
}

// ── Main ──
async function main() {
  console.log(`\n╔══════════════════════════════════════════════════╗`);
  console.log(`║  Section 1C — Landscape Compression Gate         ║`);
  console.log(`╚══════════════════════════════════════════════════╝`);
  console.log(`URL: ${URL}`);
  console.log(`Viewports: ${VIEWPORTS.map((v) => v.name).join(', ')}\n`);

  const allResults = [];
  const allConsoleErrors = [];
  let totalScreenshots = 0;
  let totalFailures = 0;

  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    console.log(`\n── Viewport: ${vp.name} ──────────────────────────`);

    const vpDir = path.join(ARTIFACT_DIR, vp.name);
    mkdirSync(vpDir, { recursive: true });

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      // Simulate mobile only for small landscape viewports (phone-sized)
      ...(vp.height < vp.width && Math.min(vp.width, vp.height) < 500 ? {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        isMobile: true,
        hasTouch: true,
      } : {}),
    });

    const page = await context.newPage();

    // Collect console errors
    const vpErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isBenign(msg.text())) {
        vpErrors.push(msg.text());
      }
    });

    // Navigate and wait for greeting to load (not "being prepared")
    console.log(`  Loading greeting...`);
    await page.goto(URL, { waitUntil: 'networkidle', timeout: 30000 });

    // Wait for either the envelope (loaded) or error state
    try {
      await page.waitForSelector('.gc-container', { timeout: 15000 });
    } catch {
      console.error(`  FAIL: .gc-container not found — greeting may not have loaded`);
      allResults.push({ viewport: vp.name, spreads: 0, screenshots: 0, pass: false, notes: 'gc-container not found' });
      await context.close();
      continue;
    }

    // Check it's not "being prepared" (still processing state)
    const isPreparing = await page.evaluate(() => {
      return document.body.innerText.includes('being prepared');
    });
    if (isPreparing) {
      console.error(`  FAIL: Greeting is still "being prepared" — need a completed jobId`);
      allResults.push({ viewport: vp.name, spreads: 0, screenshots: 0, pass: false, notes: 'Greeting not completed' });
      await context.close();
      continue;
    }

    let spreadsVisited = 0;
    let vpScreenshots = 0;
    let vpFailures = [];

    for (let i = 0; i < SPREAD_NAMES.length; i++) {
      const spread = SPREAD_NAMES[i];
      console.log(`  [${i + 1}/5] ${spread}...`);

      // Wait for transitions to settle (featured needs extra for video fade-in)
      await page.waitForTimeout(spread === 'featured' ? 2500 : 600);

      // Take screenshot
      const ssPath = path.join(vpDir, `${spread}.png`);
      await page.screenshot({ path: ssPath, fullPage: false });
      vpScreenshots++;
      totalScreenshots++;

      // Run bounding-box checks
      const failures = await runBoundingBoxChecks(page, spread);
      if (failures.length > 0) {
        vpFailures.push(...failures.map((f) => `[${spread}] ${f}`));
        console.log(`    FAIL: ${failures.join('; ')}`);
      } else {
        console.log(`    PASS`);
      }

      spreadsVisited++;

      // Advance to next spread (unless finale) — use keyboard for reliability
      if (i < SPREAD_NAMES.length - 1) {
        await page.keyboard.press('ArrowRight');
        // Wait for transition animation to complete
        await page.waitForTimeout(800);
      }
    }

    totalFailures += vpFailures.length;
    allConsoleErrors.push(...vpErrors.map((e) => `[${vp.name}] ${e}`));

    const vpPass = vpFailures.length === 0 && vpErrors.length === 0;
    allResults.push({
      viewport: vp.name,
      spreads: spreadsVisited,
      screenshots: vpScreenshots,
      pass: vpPass,
      notes: vpFailures.length > 0 ? vpFailures.join(' | ') : (vpErrors.length > 0 ? `${vpErrors.length} console error(s)` : ''),
    });

    console.log(`  → ${vpPass ? 'PASS' : 'FAIL'}: ${spreadsVisited} spreads, ${vpScreenshots} screenshots`);

    await context.close();
  }

  await browser.close();

  // ── Summary Table ──
  console.log(`\n╔══════════════════════════════════════════════════════════════════╗`);
  console.log(`║  RESULTS                                                         ║`);
  console.log(`╠══════════════════════════════════════════════════════════════════╣`);
  console.log(`  Viewport        │ Spreads │ Screenshots │ Result │ Notes`);
  console.log(`  ────────────────┼─────────┼─────────────┼────────┼──────────────`);
  for (const r of allResults) {
    const result = r.pass ? 'PASS' : 'FAIL';
    console.log(`  ${r.viewport.padEnd(16)}│ ${String(r.spreads).padEnd(8)}│ ${String(r.screenshots).padEnd(12)}│ ${result.padEnd(7)}│ ${r.notes || '-'}`);
  }
  console.log(`╚══════════════════════════════════════════════════════════════════╝`);

  if (allConsoleErrors.length > 0) {
    console.log(`\nConsole Errors (${allConsoleErrors.length}):`);
    allConsoleErrors.forEach((e) => console.log(`  • ${e}`));
  }

  if (totalFailures > 0) {
    console.log(`\nBounding-Box Failures (${totalFailures}):`);
    allResults.forEach((r) => {
      if (r.notes && !r.pass) {
        r.notes.split(' | ').forEach((n) => console.log(`  • [${r.viewport}] ${n}`));
      }
    });
  }

  console.log(`\nArtifacts: ${path.resolve(ARTIFACT_DIR)}`);
  console.log(`Total screenshots: ${totalScreenshots}`);
  console.log(`\n${totalFailures === 0 && allConsoleErrors.length === 0 ? '✓ ALL CHECKS PASSED' : '✗ FAILURES DETECTED'}\n`);

  process.exit(totalFailures > 0 || allConsoleErrors.length > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
