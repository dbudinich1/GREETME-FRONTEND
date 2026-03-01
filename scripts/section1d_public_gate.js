/**
 * section1d_public_gate.js
 * Phase 5 / Section 1D — Playwright public-page gate
 *
 * Validates the public greeting card page across 5 viewports:
 *   A) No auth redirect
 *   B) Greeting loads (or "being prepared" only if not completed)
 *   C) Backend status cross-check
 *   D) Screenshot capture
 *   E) Gift QR text validation
 *   F) Landscape chrome visibility check
 *
 * Env vars:
 *   JOB_ID      (required) — a completed greeting jobId
 *   EXPECT_GIFT  (optional) — "true" or "false"
 *
 * Usage:
 *   JOB_ID=abc123 node scripts/section1d_public_gate.js
 *   JOB_ID=abc123 EXPECT_GIFT=false node scripts/section1d_public_gate.js
 */

import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import path from 'path';

const BASE_URL = process.env.BASE_URL || 'https://greet-me.com';
const API_BASE = process.env.API_BASE || 'https://greet-me-bzbkeqeeh2gecngt.canadacentral-01.azurewebsites.net';
const JOB_ID = process.env.JOB_ID;
const EXPECT_GIFT = process.env.EXPECT_GIFT; // "true" | "false" | undefined

if (!JOB_ID) {
  console.error('ERROR: JOB_ID env var is required.\nUsage: JOB_ID=<id> node scripts/section1d_public_gate.js');
  process.exit(1);
}

const PAGE_URL = `${BASE_URL}/#/g/${JOB_ID}`;
const STATUS_URL = `${API_BASE}/api/jobs/${JOB_ID}`;
const ARTIFACT_DIR = path.resolve('test-artifacts/section1d');

const VIEWPORTS = [
  { width: 390,  height: 844, name: '390x844' },
  { width: 844,  height: 390, name: '844x390' },
  { width: 1280, height: 720, name: '1280x720' },
  { width: 667,  height: 375, name: '667x375' },
  { width: 1024, height: 768, name: '1024x768' },
];

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

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Section 1D — Public Page Gate`);
  console.log(`${'='.repeat(60)}`);
  console.log(`URL:         ${PAGE_URL}`);
  console.log(`Status API:  ${STATUS_URL}`);
  console.log(`EXPECT_GIFT: ${EXPECT_GIFT ?? '(not set — skip gift check)'}`);
  console.log(`Viewports:   ${VIEWPORTS.map((v) => v.name).join(', ')}\n`);

  // ── Step C: Pre-flight — fetch backend job status ──
  let backendStatus = null;
  try {
    const resp = await fetch(STATUS_URL);
    if (resp.ok) {
      const data = await resp.json();
      backendStatus = data.status || null;
      console.log(`Backend status: ${backendStatus}\n`);
    } else {
      console.log(`Backend status: HTTP ${resp.status} (could not fetch)\n`);
    }
  } catch (err) {
    console.log(`Backend status: fetch error — ${err.message}\n`);
  }

  const isCompleted = backendStatus === 'done' || backendStatus === 'completed';

  const allResults = [];
  const allConsoleErrors = [];
  let totalScreenshots = 0;

  const browser = await chromium.launch({ headless: true });

  for (const vp of VIEWPORTS) {
    console.log(`── ${vp.name} ──────────────────────────────────`);

    const vpDir = path.join(ARTIFACT_DIR, vp.name);
    mkdirSync(vpDir, { recursive: true });

    const isLandscape = vp.width > vp.height;
    const isMobile = Math.min(vp.width, vp.height) < 500;

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
      ...(isMobile ? {
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)',
        isMobile: true,
        hasTouch: true,
      } : {}),
    });

    const page = await context.newPage();
    const vpErrors = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error' && !isBenign(msg.text())) {
        vpErrors.push(msg.text());
      }
    });

    const failures = [];

    // ── A) Open URL, check no auth redirect ──
    await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(1000);

    const currentUrl = page.url();
    if (currentUrl.includes('/login') || currentUrl.includes('sign-in')) {
      failures.push('Redirected to login page');
    }

    const bodyText = await page.evaluate(() => document.body.innerText.toLowerCase());
    if (bodyText.includes('sign in') && !bodyText.includes('greeting')) {
      failures.push('Page shows "sign in" instead of greeting');
    }

    // ── B) Wait for greeting card or "being prepared" ──
    const hasContainer = await page.locator('.gc-container').count() > 0;
    const hasPreparing = bodyText.includes('being prepared');
    const hasExpired = bodyText.includes('expired') || bodyText.includes('unavailable');

    if (!hasContainer && !hasPreparing && !hasExpired) {
      // Wait a bit more, then re-check
      await page.waitForTimeout(3000);
      const retryHasContainer = await page.locator('.gc-container').count() > 0;
      if (!retryHasContainer) {
        failures.push('No .gc-container, no "being prepared", no error state found');
      }
    }

    // ── C) Cross-check with backend status ──
    if (isCompleted && hasPreparing) {
      // Wait 5s and recheck — backend says done but page says "being prepared"
      await page.waitForTimeout(5000);
      const stillPreparing = await page.evaluate(() =>
        document.body.innerText.toLowerCase().includes('being prepared')
      );
      if (stillPreparing) {
        failures.push('Backend status=completed but page still shows "being prepared" after 5s');
      }
    }

    // ── D) Screenshot ──
    const ssPath = path.join(vpDir, '01_loaded.png');
    await page.screenshot({ path: ssPath, fullPage: false });
    totalScreenshots++;

    // ── E) Gift QR text check (only on finale spread — need to navigate there) ──
    if (EXPECT_GIFT !== undefined && hasContainer && !hasPreparing && !hasExpired) {
      // Navigate to finale using ArrowRight (4 presses: envelope→cover→interior→featured→finale)
      // Keyboard nav is reliable; click-based nav requires envelope drag-flip first.
      for (let nav = 0; nav < 4; nav++) {
        await page.keyboard.press('ArrowRight');
        await page.waitForTimeout(800);
      }

      // Now on finale — check gift text
      const finaleText = await page.evaluate(() => {
        const el = document.querySelector('.gc-finale-spread');
        return el ? el.innerText : '';
      });

      if (EXPECT_GIFT === 'true') {
        if (!finaleText.includes('A little something extra')) {
          failures.push('EXPECT_GIFT=true but "A little something extra" not found on finale');
        }
      } else if (EXPECT_GIFT === 'false') {
        if (!finaleText.includes('A Gift From Greet-Me')) {
          failures.push('EXPECT_GIFT=false but "A Gift From Greet-Me" (platform $5 QR) not found on finale');
        }
      }

      // Take finale screenshot too
      const finaleSsPath = path.join(vpDir, '02_finale.png');
      await page.screenshot({ path: finaleSsPath, fullPage: false });
      totalScreenshots++;
    }

    // ── F) Orientation chrome visibility check ──
    if (hasContainer && !hasPreparing && !hasExpired) {
      // Navigate back to loaded state for this check — reload
      await page.goto(PAGE_URL, { waitUntil: 'networkidle', timeout: 30000 });
      await page.waitForTimeout(1500);

      const chromeVisible = await page.evaluate(() => {
        const els = document.querySelectorAll('.gc-public-chrome');
        if (els.length === 0) return null; // no chrome elements found
        // Check if ANY chrome element is visible (display !== none, visibility !== hidden)
        for (const el of els) {
          const style = window.getComputedStyle(el);
          if (style.display !== 'none' && style.visibility !== 'hidden') {
            return true;
          }
        }
        return false;
      });

      if (chromeVisible === null) {
        // No .gc-public-chrome elements — only fails if we're on the actual card page
        const onCardPage = await page.locator('.gc-container').count() > 0;
        if (onCardPage) {
          failures.push('.gc-public-chrome elements not found on card page');
        }
      } else if (isLandscape && chromeVisible) {
        failures.push('Landscape: .gc-public-chrome should be hidden but is visible');
      } else if (!isLandscape && !chromeVisible) {
        failures.push('Portrait: .gc-public-chrome should be visible but is hidden');
      }
    }

    // Collect console errors
    allConsoleErrors.push(...vpErrors.map((e) => `[${vp.name}] ${e}`));

    const pass = failures.length === 0 && vpErrors.length === 0;
    allResults.push({
      viewport: vp.name,
      pass,
      screenshots: EXPECT_GIFT !== undefined && hasContainer && !hasPreparing && !hasExpired ? 2 : 1,
      notes: failures.length > 0
        ? failures.join(' | ')
        : (vpErrors.length > 0 ? `${vpErrors.length} console error(s)` : ''),
    });

    console.log(`  ${pass ? 'PASS' : 'FAIL'}${failures.length > 0 ? ': ' + failures.join('; ') : ''}`);

    await context.close();
  }

  await browser.close();

  // ── Summary Table ──
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  RESULTS`);
  console.log(`${'='.repeat(70)}`);
  console.log(`  Viewport        │ Screenshots │ Result │ Notes`);
  console.log(`  ────────────────┼─────────────┼────────┼──────────────────────────`);
  for (const r of allResults) {
    const result = r.pass ? 'PASS' : 'FAIL';
    console.log(`  ${r.viewport.padEnd(16)}│ ${String(r.screenshots).padEnd(12)}│ ${result.padEnd(7)}│ ${r.notes || '-'}`);
  }
  console.log(`${'='.repeat(70)}`);

  if (allConsoleErrors.length > 0) {
    console.log(`\nConsole Errors (${allConsoleErrors.length}):`);
    allConsoleErrors.forEach((e) => console.log(`  * ${e}`));
  }

  const totalFails = allResults.filter((r) => !r.pass).length;
  console.log(`\nBackend status: ${backendStatus || 'unknown'}`);
  console.log(`Artifacts: ${path.resolve(ARTIFACT_DIR)}`);
  console.log(`Total screenshots: ${totalScreenshots}`);
  console.log(`\n${totalFails === 0 ? 'ALL CHECKS PASSED' : `${totalFails} VIEWPORT(S) FAILED`}\n`);

  process.exit(totalFails > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(2);
});
