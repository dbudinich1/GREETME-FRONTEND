/**
 * validateIntroSpread.js
 * Automated Phase 5 Validation - Interior Spread Layout
 *
 * AUTHORITATIVE BEHAVIOR:
 * - Navigates to greeting card URL
 * - Captures diagnostic state (screenshot + DOM)
 * - Waits ONLY for .gc-interior-spread
 * - Validates layout if spread appears
 * - Exits with actionable diagnostics on failure
 *
 * USAGE:
 *   $env:BASE_URL="http://localhost:5174"
 *   $env:GREET_JOB_ID="your-job-id"
 *   node scripts/validateIntroSpread.js
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ═══════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════

// JOB_ID is optional - if not provided, uses dev-only fixture route
const JOB_ID = process.env.GREET_JOB_ID || null;
const BASE_URL = process.env.BASE_URL || 'http://localhost:5173';
const SCREENSHOT_DIR = path.join(__dirname, '..', 'validation-screenshots');

// No longer required - fixture route available for dev testing

const VIEWPORTS = [
  { width: 375, height: 667 },
  { width: 390, height: 844 },
  { width: 667, height: 375 },
  { width: 844, height: 390 },
  { width: 768, height: 1024 },
  { width: 1024, height: 768 },
];

// ═══════════════════════════════════════════════════════════════════
// VALIDATION LOGIC (injected into page)
// ═══════════════════════════════════════════════════════════════════

const VALIDATION_FN = `(() => {
  const msg = document.querySelector('.gc-greeting-message');
  const sig = document.querySelector('.gc-signature');
  const poem = document.querySelector('.gc-poem');
  const wishes = document.querySelector('.gc-warm-wishes');

  const missing = [];
  if (!msg) missing.push('.gc-greeting-message');
  if (!sig) missing.push('.gc-signature');
  if (!poem) missing.push('.gc-poem');
  if (!wishes) missing.push('.gc-warm-wishes');

  if (missing.length > 0) {
    return { error: 'MISSING_ELEMENTS', missing };
  }

  const msgRect = msg.getBoundingClientRect();
  const sigRect = sig.getBoundingClientRect();
  const poemRect = poem.getBoundingClientRect();
  const wishesRect = wishes.getBoundingClientRect();

  const scrollHeight = document.documentElement.scrollHeight;
  const innerHeight = window.innerHeight;

  const leftPagePass = msgRect.bottom < sigRect.top;
  const rightPagePass = poemRect.bottom < wishesRect.top;
  const noScrollPass = scrollHeight <= innerHeight;

  return {
    msgBottom: msgRect.bottom,
    sigTop: sigRect.top,
    poemBottom: poemRect.bottom,
    wishesTop: wishesRect.top,
    scrollHeight,
    innerHeight,
    leftPagePass,
    rightPagePass,
    noScrollPass,
    allPass: leftPagePass && rightPagePass && noScrollPass
  };
})()`;

// ═══════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════

async function main() {
  // IMPORTANT: App uses HashRouter, so URLs must include hash
  // If JOB_ID provided: use real greeting route
  // If no JOB_ID: use dev-only fixture route (deterministic test data)
  const URL = JOB_ID
    ? `${BASE_URL}/#/g/${JOB_ID}?test=1`
    : `${BASE_URL}/#/__debug/greeting-fixture`;

  console.log('════════════════════════════════════════════════════════════════════');
  console.log('GREETME INTERIOR SPREAD VALIDATION — PHASE 5');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log(`JOB_ID:       ${JOB_ID || '(using fixture route)'}`);
  console.log(`URL:          ${URL}`);
  console.log(`SCREENSHOTS:  ${SCREENSHOT_DIR}`);
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('');

  // Ensure screenshot directory
  if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
  }

  const browser = await chromium.launch({ headless: true });
  const results = [];
  let failures = 0;

  for (const vp of VIEWPORTS) {
    const label = `${vp.width}x${vp.height}`;
    console.log(`[${label}] Starting...`);

    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    try {
      // ─────────────────────────────────────────────────────────────
      // STEP 1: Navigate to URL
      // ─────────────────────────────────────────────────────────────
      await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 30000 });

      // ─────────────────────────────────────────────────────────────
      // STEP 1.5: Login detection assertion (fail-fast if HashRouter misrouted)
      // ─────────────────────────────────────────────────────────────
      const pageText = await page.textContent('body');
      const hasWelcomeBack = pageText && pageText.includes('Welcome Back');
      const hasPasswordInput = await page.$('input[type="password"]');

      if (hasWelcomeBack || hasPasswordInput) {
        console.log(`[${label}] ✗ FATAL — AUTH_BYPASS_FAILED: Login screen rendered`);
        console.log(`[${label}]   HashRouter may not have matched. Check URL format: /#/g/:jobId`);
        results.push({
          viewport: label,
          error: 'AUTH_BYPASS_FAILED',
          diagnostics: { message: 'Login screen rendered - HashRouter route mismatch' }
        });
        failures++;
        await context.close();
        continue;
      }

      // ─────────────────────────────────────────────────────────────
      // STEP 2: Capture diagnostic state
      // ─────────────────────────────────────────────────────────────
      console.log(`[${label}] PAGE URL: ${page.url()}`);
      console.log(`[${label}] PAGE TITLE: ${await page.title()}`);

      // Screenshot initial state
      const initialScreenshot = path.join(SCREENSHOT_DIR, `initial-${label}.png`);
      await page.screenshot({ path: initialScreenshot });

      // DOM snapshot for selector discovery
      const html = await page.content();
      const domFile = path.join(SCREENSHOT_DIR, `dom-${label}.html`);
      fs.writeFileSync(domFile, html.slice(0, 50000));

      console.log(`[${label}] Initial screenshot: initial-${label}.png`);
      console.log(`[${label}] DOM snapshot: dom-${label}.html`);

      // ─────────────────────────────────────────────────────────────
      // STEP 3: DETERMINISTIC NAVIGATION — Envelope → Cover → Interior
      // ─────────────────────────────────────────────────────────────
      // State-based navigation: detect current screen, click to advance,
      // verify each transition. Uses DOM-attach + bounding box (not visibility).

      // Helper: wait until ANY selector is attached to the DOM (not necessarily "visible")
      async function waitForAnyAttached(selectors, timeout = 10000) {
        const promises = selectors.map(sel =>
          page
            .waitForSelector(sel, { timeout, state: 'attached' })
            .then(() => sel)
            .catch(() => null)
        );
        return Promise.race(promises);
      }

      // Helper: treat element as "usable" if it has a bounding box (not display:none)
      async function isBoxPresent(selector) {
        const loc = page.locator(selector).first();
        const box = await loc.boundingBox().catch(() => null);
        return !!box;
      }

      // Step 3a: Determine current screen (MUST be one of these)
      const SCREENS = ['.gc-envelope', '.gc-wax-seal', '.gc-cover', '.gc-interior-spread'];

      const firstAttached = await waitForAnyAttached(SCREENS, 15000);
      if (!firstAttached) {
        // PROOF DIAGNOSTICS (no guessing)
        const bodyText = (await page.textContent('body').catch(() => '')) || '';
        console.log(`[${label}] BODY_TEXT_HEAD: ${bodyText.replace(/\s+/g,' ').slice(0, 400)}`);
        const gcClasses = await page.evaluate(() => {
          const nodes = Array.from(document.querySelectorAll('[class*="gc-"]'));
          return nodes.map(n => n.className).filter(Boolean).slice(0, 80);
        }).catch(() => []);
        console.log(`[${label}] GC_CLASS_SAMPLE:`, gcClasses);
        throw new Error('NAVIGATION_FAILED: No known greeting screen attached to DOM');
      }

      // Prefer the first selector that actually has a bounding box
      let firstScreen = null;
      for (const sel of SCREENS) {
        if (await isBoxPresent(sel)) {
          firstScreen = sel;
          break;
        }
      }
      if (!firstScreen) {
        // PROOF DIAGNOSTICS (no guessing)
        const bodyText = (await page.textContent('body').catch(() => '')) || '';
        console.log(`[${label}] BODY_TEXT_HEAD: ${bodyText.replace(/\s+/g,' ').slice(0, 400)}`);
        const gcClasses = await page.evaluate(() => {
          const nodes = Array.from(document.querySelectorAll('[class*="gc-"]'));
          return nodes.map(n => n.className).filter(Boolean).slice(0, 80);
        }).catch(() => []);
        console.log(`[${label}] GC_CLASS_SAMPLE:`, gcClasses);
        throw new Error('NAVIGATION_FAILED: Greeting screen attached but none have bounding boxes');
      }

      console.log(`[${label}] Detected screen: ${firstScreen}`);

      // Step 3b: Envelope → Cover (click wax seal to open)
      if (firstScreen === '.gc-envelope' || firstScreen === '.gc-wax-seal') {
        // The wax seal is on the backface of a 3D-transformed envelope (hidden initially).
        // Regular clicks may not fire React handlers. Use dispatchEvent to trigger directly.
        console.log(`[${label}] Dispatching click to .gc-wax-seal to open envelope...`);
        await page.evaluate(() => {
          const seal = document.querySelector('.gc-wax-seal');
          if (seal) {
            seal.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
          }
        });

        // Wait for React state update and re-render
        const coverVisible = await page
          .waitForSelector('.gc-cover', { timeout: 10000, state: 'attached' })
          .catch(() => null);

        if (!coverVisible) {
          throw new Error('NAVIGATION_FAILED: Envelope click did not reach cover');
        }
        console.log(`[${label}] Cover visible after envelope click`);
      }

      // Step 3c: Cover → Interior (click + verify)
      // Re-check which screen has a bounding box now
      let secondScreen = null;
      for (const sel of ['.gc-cover', '.gc-interior-spread']) {
        if (await isBoxPresent(sel)) {
          secondScreen = sel;
          break;
        }
      }

      if (secondScreen === '.gc-cover') {
        console.log(`[${label}] Clicking .gc-cover to open card...`);
        await page.locator('.gc-cover').first().click({ force: true });
      }

      const interiorVisible = await page
        .waitForSelector('.gc-interior-spread', { timeout: 10000, state: 'attached' })
        .catch(() => null);

      if (!interiorVisible || !(await isBoxPresent('.gc-interior-spread'))) {
        throw new Error('NAVIGATION_FAILED: Cover click did not reach interior spread');
      }

      console.log(`[${label}] Interior spread visible`);

      // === PHASE 3: INSET TOKEN PROOF (AUTOMATED) ===
      const insetProof = await page.evaluate(() => {
        // Normalize CSS values: "0" -> "0px", "18px" -> "18px"
        const normalize = (v) => {
          const trimmed = v.trim();
          // If it's a pure number (no unit), append 'px'
          if (/^-?\d+(\.\d+)?$/.test(trimmed)) return trimmed + 'px';
          return trimmed;
        };
        const root = document.documentElement;
        const tok = {
          top: normalize(getComputedStyle(root).getPropertyValue('--lock-page-content-top')),
          left: normalize(getComputedStyle(root).getPropertyValue('--lock-page-content-left')),
          right: normalize(getComputedStyle(root).getPropertyValue('--lock-page-content-right')),
          bottom: normalize(getComputedStyle(root).getPropertyValue('--lock-page-content-bottom')),
        };
        const el = document.querySelector('.gc-interior-spread .gc-page-left .gc-page-content');
        if (!el) return { ok: false, error: 'LEFT_PAGE_CONTENT_NOT_FOUND', tok, comp: null };
        const cs = getComputedStyle(el);
        const comp = { top: cs.top, left: cs.left, right: cs.right, bottom: cs.bottom };
        const ok = tok.top === comp.top && tok.left === comp.left && tok.right === comp.right && tok.bottom === comp.bottom;
        return { ok, tok, comp };
      });
      console.log(`[${label}] INSET_TOKEN_PROOF:`, insetProof);
      if (!insetProof.ok) {
        throw new Error(`INSET_TOKEN_PROOF_FAILED tok=${JSON.stringify(insetProof.tok)} comp=${JSON.stringify(insetProof.comp)}`);
      }

      // Allow animations to settle
      await page.waitForTimeout(300);

      // ─────────────────────────────────────────────────────────────
      // STEP 4: Run validation
      // ─────────────────────────────────────────────────────────────
      const result = await page.evaluate(VALIDATION_FN);

      if (!result) {
        throw new Error('VALIDATION_FAILED: evaluate returned null/undefined');
      }

      if (result.error === 'MISSING_ELEMENTS') {
        console.log(`[${label}] ✗ FAIL — Missing: ${result.missing.join(', ')}`);
        results.push({ viewport: label, error: result.error, missing: result.missing });
        failures++;
      } else {
        const status = result.allPass ? '✓ PASS' : '✗ FAIL';
        console.log(`[${label}] ${status}`);
        console.log(`[${label}]   LEFT:   msg=${result.msgBottom.toFixed(1)} < sig=${result.sigTop.toFixed(1)} → ${result.leftPagePass}`);
        console.log(`[${label}]   RIGHT:  poem=${result.poemBottom.toFixed(1)} < wishes=${result.wishesTop.toFixed(1)} → ${result.rightPagePass}`);
        console.log(`[${label}]   SCROLL: ${result.scrollHeight} <= ${result.innerHeight} → ${result.noScrollPass}`);
        results.push({ viewport: label, ...result });
        if (!result.allPass) failures++;
      }

      // ─────────────────────────────────────────────────────────────
      // STEP 5: Final screenshot (validation state)
      // ─────────────────────────────────────────────────────────────
      const finalScreenshot = path.join(SCREENSHOT_DIR, `${label}.png`);
      await page.screenshot({ path: finalScreenshot, fullPage: false });
      console.log(`[${label}] Final screenshot: ${label}.png`);

    } catch (err) {
      console.log(`[${label}] ✗ ERROR — ${err.message}`);
      results.push({ viewport: label, error: err.message });
      failures++;
    }

    await context.close();
    console.log('');
  }

  await browser.close();

  // ═══════════════════════════════════════════════════════════════════
  // RESULTS TABLE
  // ═══════════════════════════════════════════════════════════════════

  console.log('════════════════════════════════════════════════════════════════════');
  console.log('VALIDATION RESULTS');
  console.log('════════════════════════════════════════════════════════════════════');
  console.log('');
  console.log('┌────────────┬───────────┬─────────┬────────────┬───────────┬────────┬────────┬──────┬───────┬────────┬─────────┐');
  console.log('│ Viewport   │ msgBottom │ sigTop  │ poemBottom │ wishesTop │ scroll │ inner  │ LEFT │ RIGHT │ SCROLL │ OVERALL │');
  console.log('├────────────┼───────────┼─────────┼────────────┼───────────┼────────┼────────┼──────┼───────┼────────┼─────────┤');

  for (const r of results) {
    if (r.error) {
      const errMsg = r.error + (r.missing ? ` [${r.missing.join(',')}]` : '');
      console.log(`│ ${r.viewport.padEnd(10)} │ ERROR: ${errMsg.substring(0, 55).padEnd(66)} │`);
    } else {
      const left = r.leftPagePass ? '✓' : '✗';
      const right = r.rightPagePass ? '✓' : '✗';
      const scroll = r.noScrollPass ? '✓' : '✗';
      const overall = r.allPass ? '✓' : '✗';
      console.log(`│ ${r.viewport.padEnd(10)} │ ${r.msgBottom.toFixed(1).padStart(9)} │ ${r.sigTop.toFixed(1).padStart(7)} │ ${r.poemBottom.toFixed(1).padStart(10)} │ ${r.wishesTop.toFixed(1).padStart(9)} │ ${String(r.scrollHeight).padStart(6)} │ ${String(r.innerHeight).padStart(6)} │ ${left.padStart(4)} │ ${right.padStart(5)} │ ${scroll.padStart(6)} │ ${overall.padStart(7)} │`);
    }
  }

  console.log('└────────────┴───────────┴─────────┴────────────┴───────────┴────────┴────────┴──────┴───────┴────────┴─────────┘');
  console.log('');

  // ═══════════════════════════════════════════════════════════════════
  // EXIT
  // ═══════════════════════════════════════════════════════════════════

  if (failures > 0) {
    console.log(`RESULT: ✗ FAIL — ${failures} viewport(s) failed`);
    console.log('');
    console.log('DIAGNOSTICS:');
    console.log(`  Screenshots: ${SCREENSHOT_DIR}`);
    console.log('  - initial-*.png = page state at load');
    console.log('  - dom-*.html = DOM snapshot for selector analysis');
    console.log('  - *.png = final validation state (if reached)');
    console.log('════════════════════════════════════════════════════════════════════');
    process.exit(1);
  } else {
    console.log('RESULT: ✓ PASS — All viewports passed');
    console.log('════════════════════════════════════════════════════════════════════');
    process.exit(0);
  }
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
