/* scripts/tripwireDesktopGold.js */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Desktop Tripwire (Evidence-First)
 * Goal: Prevent silent drift from DESKTOP_GOLD (815ed01) contract.
 *
 * IMPORTANT: This is a guardrail only. It does not fix CSS.
 *
 * What we assert (static, deterministic):
 *  1) :root token baseline matches Desktop Gold canonical values
 *  2) Desktop landscape media blocks do NOT override typography tokens
 *  3) Desktop landscape media blocks may override ONLY insets (+ optional poem top gap in >1200)
 */

function die(msg) {
  console.error(`\nDESKTOP_TRIPWIRE_FAIL: ${msg}\n`);
  process.exit(1);
}

function readText(rel) {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) die(`Missing file: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function extractRootBlock(cssText) {
  // Take the first :root { ... } block in the file (assumes tokens are defined there)
  const m = cssText.match(/:root\s*\{([\s\S]*?)\}/);
  if (!m) die('Could not find :root { ... } block in lockTokens.css');
  return m[1];
}

function getVarValue(blockText, varName) {
  // matches: --var-name: value;
  const re = new RegExp(`\\${varName}\\s*:\\s*([^;]+);`);
  const m = blockText.match(re);
  return m ? m[1].trim() : null;
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    die(`${label} expected "${expected}" but got "${actual}"`);
  }
}

function findDesktopLandscapeBlocks(cssText) {
  // Find desktop landscape @media blocks of interest
  // (min-width: 901px) ... landscape
  const blocks = [];
  const re = /@media\s*\(([^)]*?)\)\s*\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(cssText)) !== null) {
    const cond = m[1];
    const body = m[2];
    const isLandscape = /orientation\s*:\s*landscape/i.test(cond);
    const has901 = /min-width\s*:\s*901px/i.test(cond) || /min-width\s*:\s*901/i.test(cond);
    const has1201 = /min-width\s*:\s*1201px/i.test(cond) || /min-width\s*:\s*1201/i.test(cond);
    if (isLandscape && (has901 || has1201)) {
      blocks.push({ cond, body });
    }
  }
  return blocks;
}

function assertNoTypographyOverridesInDesktopBlocks(blocks) {
  const forbidden = [
    '--lock-salutation-font-size',
    '--lock-salutation-line-height',
    '--lock-occasion-font-size',
    '--lock-occasion-line-height',
    '--lock-message-font-size',
    '--lock-message-line-height',
    '--lock-signature-font-size',
    '--lock-poem-font-size',
    '--lock-poem-line-height',
    '--lock-warm-wishes-font-size',
  ];

  for (const b of blocks) {
    for (const v of forbidden) {
      if (b.body.includes(v)) {
        die(`Desktop landscape @media block overrides typography token ${v}. Condition: (${b.cond})`);
      }
    }
  }
}

function assertDesktopBlocksOnlyTouchInsetsAndOptionalPoemGap(blocks) {
  // Allowed overrides inside desktop landscape blocks
  const allowed = new Set([
    '--lock-page-content-top',
    '--lock-page-content-left',
    '--lock-page-content-right',
    '--lock-page-content-bottom',
    '--lock-poem-content-margin-top', // allowed only if present (breakpoint handling)
  ]);

  // Collect all CSS variable assignments inside each block
  const assignRe = /(--[a-zA-Z0-9_-]+)\s*:/g;

  for (const b of blocks) {
    let m;
    while ((m = assignRe.exec(b.body)) !== null) {
      const varName = m[1];
      if (!allowed.has(varName)) {
        die(`Desktop landscape @media block sets disallowed token ${varName}. Condition: (${b.cond})`);
      }
    }
  }
}

// -------------------- MAIN --------------------
(function main() {
  const LOCKTOKENS_PATH = 'src/components/GreetingCardProto/lockTokens.css';

  const css = readText(LOCKTOKENS_PATH);
  const root = extractRootBlock(css);

  // DESKTOP_GOLD canonical (:root) values from cement commit 815ed01 (per your drift table)
  // If any of these fail, we STOP: desktop is not "mathematically locked."
  assertEq(getVarValue(root, '--lock-salutation-font-size'), '48px', '--lock-salutation-font-size');
  assertEq(getVarValue(root, '--lock-salutation-line-height'), '1.4', '--lock-salutation-line-height');
  assertEq(getVarValue(root, '--lock-occasion-line-height'), '1.4', '--lock-occasion-line-height');
  assertEq(getVarValue(root, '--lock-message-font-size'), '50px', '--lock-message-font-size');
  assertEq(getVarValue(root, '--lock-message-line-height'), '1.2', '--lock-message-line-height');
  assertEq(getVarValue(root, '--lock-poem-font-size'), '36px', '--lock-poem-font-size');
  assertEq(getVarValue(root, '--lock-poem-line-height'), '1.5', '--lock-poem-line-height');
  assertEq(getVarValue(root, '--lock-poem-content-margin-top'), '140px', '--lock-poem-content-margin-top');

  // NOTE: signature-right is a known drift point; assert it too as part of Desktop Gold
  assertEq(getVarValue(root, '--lock-signature-right'), '120px', '--lock-signature-right');

  // Guardrail: Desktop landscape blocks must NOT override typography (only insets + optional poem gap)
  const desktopBlocks = findDesktopLandscapeBlocks(css);
  assertNoTypographyOverridesInDesktopBlocks(desktopBlocks);
  assertDesktopBlocksOnlyTouchInsetsAndOptionalPoemGap(desktopBlocks);

  console.log('\nDESKTOP_TRIPWIRE_PASS: Desktop Gold token contract matches cement baseline (815ed01).\n');
})();
