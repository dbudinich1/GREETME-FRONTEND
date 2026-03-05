/* scripts/tripwireMobileGold.cjs */
'use strict';

const fs = require('fs');
const path = require('path');

/**
 * Mobile Gold Tripwire (Evidence-First)
 * Goal: Prevent silent removal of mobile safeguard structure from commit 1daaa93.
 *
 * IMPORTANT: This is a guardrail only. It does not fix CSS.
 *
 * What we assert (static, deterministic):
 *  1) greetingCard.css contains iOS Safari @supports blocks (B11-B15 + fine-tune)
 *  2) greetingCard.css contains mobile landscape @media blocks (max-width/max-height guards)
 *  3) lockTokens.css contains mobile token override blocks (portrait + landscape phone/tablet)
 */

function die(msg) {
  console.error(`\nMOBILE_TRIPWIRE_FAIL: ${msg}\n`);
  process.exit(1);
}

function readText(rel) {
  const abs = path.resolve(process.cwd(), rel);
  if (!fs.existsSync(abs)) die(`Missing file: ${rel}`);
  return fs.readFileSync(abs, 'utf8');
}

function countOccurrences(text, searchStr) {
  let count = 0;
  let pos = 0;
  while ((pos = text.indexOf(searchStr, pos)) !== -1) {
    count++;
    pos += searchStr.length;
  }
  return count;
}

function assertContains(text, searchStr, label) {
  if (!text.includes(searchStr)) {
    die(`${label}: expected to find "${searchStr}" but it is missing`);
  }
}

function assertMinOccurrences(text, searchStr, min, label) {
  const count = countOccurrences(text, searchStr);
  if (count < min) {
    die(`${label}: expected at least ${min} occurrences of "${searchStr}" but found ${count}`);
  }
}

function assertMediaBlockExists(text, conditionTerms, label) {
  // Check that at least one @media block contains ALL the given condition terms
  const re = /@media\s*([^{]+)\{/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const cond = m[1];
    const allMatch = conditionTerms.every(t => cond.includes(t));
    if (allMatch) return; // found
  }
  die(`${label}: no @media block found matching all conditions: ${conditionTerms.join(' + ')}`);
}

function assertLockTokenBlock(text, conditionTerms, requiredToken, label) {
  // Find @media block matching all condition terms, then check it contains the required token
  const re = /@media\s*([^{]+)\{([\s\S]*?)\n\}/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const cond = m[1];
    const body = m[2];
    const allMatch = conditionTerms.every(t => cond.includes(t));
    if (allMatch && body.includes(requiredToken)) return; // found
  }
  die(`${label}: no @media block matching [${conditionTerms.join(' + ')}] contains token ${requiredToken}`);
}

// -------------------- MAIN --------------------
(function main() {
  const GREETING_CSS_PATH = 'src/components/GreetingCardProto/greetingCard.css';
  const LOCKTOKENS_PATH = 'src/components/GreetingCardProto/lockTokens.css';

  const gcss = readText(GREETING_CSS_PATH);
  const ltcss = readText(LOCKTOKENS_PATH);

  // === 1) iOS Safari @supports blocks must exist in greetingCard.css ===

  // At least 5 @supports (-webkit-touch-callout: none) blocks (B11, B12, B13, B15, fine-tune)
  assertMinOccurrences(
    gcss,
    '@supports (-webkit-touch-callout: none)',
    5,
    'Safari @supports guard count'
  );

  // B11/B12/B13: Safari portrait blocks targeting max-width: 430px
  // Must have at least one @supports block containing portrait poem-content rules
  assertContains(
    gcss,
    '.gc-page.gc-page-right .gc-page-content.gc-poem-content',
    'Safari portrait poem-content selector (B11/B12)'
  );

  // B15: Safari landscape block — poem margin-top override
  assertContains(
    gcss,
    'margin-top: 0 !important',
    'Safari landscape poem margin-top reset (B15)'
  );

  /*
   MOBILE GOLD INVARIANT — SAFARI LANDSCAPE POEM NUDGE

   Verified against main branch baseline.
   Location: greetingCard.css (pointer: coarse / touch-only Safari landscape block)

   This rule intentionally checks for:
     transform: translateY(16px)

   Purpose:
   Safari landscape needs a small vertical nudge so the poem stack clears
   the ribbon and remains visually centered.

   IMPORTANT:
   The earlier 1daaa93 branch used translateY(4px), but that rule never
   existed on main. The tripwire now reflects the canonical rule present
   on main.

   If this assertion fails in the future:
   1) Verify the Safari landscape rule still exists in greetingCard.css
   2) Update the tripwire ONLY if the canonical CSS baseline changes.
  */
  assertContains(
    gcss,
    'translateY(16px)',
    'Safari landscape poem nudge translateY (main baseline)'
  );

  // === 2) Mobile landscape @media blocks must exist in greetingCard.css ===

  // B14: max-height landscape block
  assertMediaBlockExists(
    gcss,
    ['max-height: 430px', 'landscape'],
    'B14 mobile landscape max-height block'
  );

  // Phone landscape block (max-width: 900px)
  assertMediaBlockExists(
    gcss,
    ['max-width: 900px', 'landscape'],
    'Phone landscape block (max-width: 900px)'
  );

  // === 3) lockTokens.css must contain mobile token override blocks ===

  // Portrait small phones (380px)
  assertLockTokenBlock(
    ltcss,
    ['max-width: 380px', 'portrait'],
    '--lock-salutation-font-size',
    'lockTokens portrait small phone (380px)'
  );

  // Portrait large phones (500px)
  assertLockTokenBlock(
    ltcss,
    ['max-width: 500px', 'portrait'],
    '--lock-message-font-size',
    'lockTokens portrait large phone (500px)'
  );

  // Landscape phone (700px)
  assertLockTokenBlock(
    ltcss,
    ['max-width: 700px', 'landscape'],
    '--lock-message-font-size',
    'lockTokens landscape phone (700px)'
  );

  // Landscape tablet (701-1024px)
  assertLockTokenBlock(
    ltcss,
    ['min-width: 701px', 'landscape'],
    '--lock-message-font-size',
    'lockTokens landscape tablet (701-1024px)'
  );

  // Landscape small phone (550px)
  assertLockTokenBlock(
    ltcss,
    ['max-width: 550px', 'landscape'],
    '--lock-message-font-size',
    'lockTokens landscape small phone (550px)'
  );

  console.log('\nMOBILE_TRIPWIRE_PASS: Mobile Gold guardrails present.\n');
})();
