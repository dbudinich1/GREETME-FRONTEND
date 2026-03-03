/* scripts/tripwireDesktopGold.cjs */
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
 *  1) Desktop pointer:fine landscape block contains cement typography values
 *  2) NON-pointer:fine desktop landscape blocks do NOT override typography tokens
 *  3) NON-pointer:fine desktop landscape blocks may override ONLY insets (+ optional poem top gap)
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

function findMediaBlock(cssText, mustIncludeTerms) {
  // naive but deterministic: finds first @media (...) { ... } block whose condition includes all terms
  const re = /@media\s*([^{]+)\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(cssText)) !== null) {
    const cond = m[1];
    const body = m[2];
    const ok = mustIncludeTerms.every(t => cond.includes(t));
    if (ok) return { cond, body };
  }
  return null;
}

function assertTokenInBody(blockBody, varName, expected) {
  const re = new RegExp(`\\${varName}\\s*:\\s*${expected.replace('.', '\\.')}\\s*;`);
  if (!re.test(blockBody)) {
    die(`Desktop pointer:fine block missing ${varName}: ${expected}`);
  }
}

function findDesktopLandscapeBlocks(cssText) {
  // Find desktop landscape @media blocks of interest
  // (min-width: 901px) ... landscape
  const blocks = [];
  const re = /@media\s*([^{]+)\{([\s\S]*?)\n\}/g;
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
    // Skip pointer:fine blocks — those ARE allowed to set typography (Desktop Gold layer)
    if (b.cond.includes('(pointer: fine)')) continue;

    for (const v of forbidden) {
      if (b.body.includes(v)) {
        die(`Desktop landscape @media block overrides typography token ${v}. Condition: (${b.cond})`);
      }
    }
  }
}

function assertDesktopBlocksOnlyTouchInsetsAndOptionalPoemGap(blocks) {
  // Allowed overrides inside NON-pointer:fine desktop landscape blocks
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
    // Skip pointer:fine blocks — those have their own contract (Desktop Gold layer)
    if (b.cond.includes('(pointer: fine)')) continue;

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

  // --- Assert Desktop Gold typography exists in the pointer:fine block ---
  const desktopFine = findMediaBlock(css, [
    '(pointer: fine)',
    '(orientation: landscape)',
    'min-width: 901px'
  ]);

  if (!desktopFine) die('Could not find Desktop Gold @media block with (pointer: fine) + min-width: 901px + landscape');

  assertTokenInBody(desktopFine.body, '--lock-salutation-font-size', '48px');
  assertTokenInBody(desktopFine.body, '--lock-salutation-line-height', '1.4');
  assertTokenInBody(desktopFine.body, '--lock-occasion-font-size', '50px');
  assertTokenInBody(desktopFine.body, '--lock-occasion-line-height', '1.4');
  assertTokenInBody(desktopFine.body, '--lock-message-font-size', '50px');
  assertTokenInBody(desktopFine.body, '--lock-message-line-height', '1.2');
  assertTokenInBody(desktopFine.body, '--lock-poem-font-size', '36px');
  assertTokenInBody(desktopFine.body, '--lock-poem-line-height', '1.5');
  assertTokenInBody(desktopFine.body, '--lock-poem-content-margin-top', '140px');
  assertTokenInBody(desktopFine.body, '--lock-signature-right', '120px');

  // --- Guardrail: NON-pointer:fine desktop landscape blocks must NOT override typography ---
  const desktopBlocks = findDesktopLandscapeBlocks(css);
  assertNoTypographyOverridesInDesktopBlocks(desktopBlocks);
  assertDesktopBlocksOnlyTouchInsetsAndOptionalPoemGap(desktopBlocks);

  console.log('\nDESKTOP_TRIPWIRE_PASS: Desktop Gold token contract matches cement baseline (815ed01).\n');
})();
