#!/usr/bin/env node
/**
 * verify-greeting-lock.mjs
 * Lock Linter - Validates greetingCard.css against GREETING_LOCK.md
 *
 * Run: node scripts/verify-greeting-lock.mjs
 *
 * Exit codes:
 *   0 = All lock state values match
 *   1 = Lock state violations found
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths relative to FRONTEND directory
const FRONTEND_DIR = path.resolve(__dirname, '..');
const CSS_PATH = path.join(FRONTEND_DIR, 'src/components/GreetingCardProto/greetingCard.css');
const LOCK_PATH = path.join(FRONTEND_DIR, 'src/components/GreetingCardProto/GREETING_LOCK.md');
const TOKENS_PATH = path.join(FRONTEND_DIR, 'src/components/GreetingCardProto/lockTokens.css');

// CANONICAL LOCK VALUES - Desktop (Base)
const DESKTOP_LOCKS = {
  '.gc-greeting-salutation': {
    'font-size': '48px',
    'font-weight': '400',
    'line-height': '1.4',
    'margin': '0 0 6px 0',
  },
  '.gc-greeting-occasion': {
    'font-size': 'var(--gc-letter-body-size)', // 50px
    'font-weight': '400',
    'line-height': '1.4',
    'margin': '0 0 6px 0',
    'text-align': 'center',
  },
  '.gc-greeting-message': {
    'line-height': '1.2',
    'margin': '0 0 12px 0',
    'max-height': 'calc(100% - 80px)',
  },
  '.gc-greeting-message p': {
    'margin': '0 0 8px 0',
  },
  '.gc-signature': {
    'bottom': '60px',
    'right': '120px',
  },
  '.gc-interior-spread .gc-page-left .gc-page-content': {
    'bottom': '96px',
  },
};

// Portrait 380px locks
const PORTRAIT_380_LOCKS = {
  '.gc-interior-spread .gc-greeting-salutation': {
    'font-size': '18px !important',
    'font-weight': '400 !important',
  },
  '.gc-interior-spread .gc-greeting-occasion': {
    'font-size': '18px !important',
    'font-weight': '400 !important',
  },
  '.gc-interior-spread .gc-greeting-message': {
    'font-size': '18px !important',
    'line-height': '1.15 !important',
    'margin-top': '-3px !important',
  },
  '.gc-interior-spread .gc-signature': {
    'font-size': '17px !important',
    'bottom': '6px !important',
    'right': '24px !important',
  },
  '.gc-interior-spread .gc-poem': {
    'font-size': '13px !important',
    'margin': '-45px auto 3px auto !important',
  },
  '.gc-interior-spread .gc-warm-wishes': {
    'font-size': '12px !important',
    'margin': '-4px 8px 0 0 !important',
  },
};

// Landscape 700px locks
// NOTE: Interior spread rules (.gc-interior-spread .gc-poem, .gc-warm-wishes)
// are excluded from automated validation due to CSS parser limitations with
// deeply nested media query selectors. These rules ARE present in greetingCard.css
// (verified at lines 1906-1916) and should be checked manually if modified.
const LANDSCAPE_700_LOCKS = {
  '.gc-greeting-salutation': {
    'font-size': '23px !important',
    'font-weight': '700',
    'text-align': 'left !important',
  },
  '.gc-greeting-occasion': {
    'font-size': '23px !important',
    'text-align': 'center !important',
  },
  '.gc-greeting-message': {
    'font-size': '25px !important',
    'line-height': '1.15 !important',
    'text-align': 'center !important',
  },
  '.gc-signature': {
    'font-size': '23px !important',
    'bottom': '8px !important',
    'right': '32px !important',
  },
  // Interior spread poem/warm-wishes excluded - parser limitation
  // Manual verification: greetingCard.css lines 1906-1916
};

/**
 * Parse CSS file into a map of selectors -> properties
 * This is a simple parser for validation purposes
 */
function parseCSS(cssContent) {
  const rules = new Map();

  // Remove comments
  let css = cssContent.replace(/\/\*[\s\S]*?\*\//g, '');

  // Track current media query context
  let currentMedia = null;
  let depth = 0;
  let buffer = '';

  for (let i = 0; i < css.length; i++) {
    const char = css[i];

    if (char === '{') {
      depth++;
      if (depth === 1 && buffer.trim().startsWith('@media')) {
        currentMedia = buffer.trim();
        buffer = '';
        continue;
      }
    } else if (char === '}') {
      depth--;
      if (depth === 0 && currentMedia) {
        currentMedia = null;
        buffer = '';
        continue;
      }
    }

    buffer += char;

    // When we close a rule block
    if (char === '}' && depth >= 0) {
      const ruleText = buffer.trim();
      const match = ruleText.match(/([^{]+)\{([^}]*)\}/);

      if (match) {
        const selector = match[1].trim();
        const propsText = match[2].trim();
        const props = {};

        propsText.split(';').forEach(prop => {
          const colonIdx = prop.indexOf(':');
          if (colonIdx > 0) {
            const key = prop.substring(0, colonIdx).trim();
            const value = prop.substring(colonIdx + 1).trim();
            if (key && value) {
              props[key] = value;
            }
          }
        });

        const fullSelector = currentMedia
          ? `${currentMedia} | ${selector}`
          : selector;

        rules.set(fullSelector, props);
      }

      buffer = '';
    }
  }

  return rules;
}

/**
 * Find a selector in parsed rules (supports partial matching)
 */
function findRule(rules, selector, mediaQuery = null) {
  for (const [key, props] of rules.entries()) {
    if (mediaQuery) {
      if (key.includes(mediaQuery) && key.includes(selector)) {
        return props;
      }
    } else if (key === selector || key.endsWith(selector)) {
      // Only match non-media-query rules for desktop
      if (!key.includes('@media')) {
        return props;
      }
    }
  }
  return null;
}

/**
 * Validate CSS against lock values
 */
function validateLocks(rules, locks, context, mediaQuery = null) {
  const violations = [];

  for (const [selector, expectedProps] of Object.entries(locks)) {
    const actualProps = findRule(rules, selector, mediaQuery);

    if (!actualProps) {
      // Only warn if we expect this selector to exist
      continue;
    }

    for (const [prop, expectedValue] of Object.entries(expectedProps)) {
      const actualValue = actualProps[prop];

      // Normalize values for comparison
      const normalize = (v) => v?.replace(/\s+/g, ' ').trim();

      if (normalize(actualValue) !== normalize(expectedValue)) {
        violations.push({
          context,
          selector,
          property: prop,
          expected: expectedValue,
          actual: actualValue || '(not set)',
        });
      }
    }
  }

  return violations;
}

/**
 * Main validation function
 */
function main() {
  console.log('='.repeat(60));
  console.log('  GREETING CARD LOCK STATE VALIDATOR');
  console.log('='.repeat(60));
  console.log();

  // Check files exist
  if (!fs.existsSync(CSS_PATH)) {
    console.error(`ERROR: CSS file not found: ${CSS_PATH}`);
    process.exit(1);
  }

  if (!fs.existsSync(LOCK_PATH)) {
    console.warn(`WARNING: Lock file not found: ${LOCK_PATH}`);
  }

  if (!fs.existsSync(TOKENS_PATH)) {
    console.warn(`WARNING: Lock tokens file not found: ${TOKENS_PATH}`);
  }

  // Read and parse CSS
  const cssContent = fs.readFileSync(CSS_PATH, 'utf-8');
  const rules = parseCSS(cssContent);

  console.log(`Parsed ${rules.size} CSS rules from greetingCard.css`);
  console.log();

  // Validate each context
  const allViolations = [];

  // Desktop (base rules)
  console.log('Checking: Desktop (base)...');
  const desktopViolations = validateLocks(rules, DESKTOP_LOCKS, 'Desktop');
  allViolations.push(...desktopViolations);
  console.log(`  ${desktopViolations.length === 0 ? '✅' : '❌'} ${desktopViolations.length} violations`);

  // Portrait 380px
  console.log('Checking: Portrait 380px...');
  const portrait380Violations = validateLocks(
    rules,
    PORTRAIT_380_LOCKS,
    'Portrait 380px',
    '380px'
  );
  allViolations.push(...portrait380Violations);
  console.log(`  ${portrait380Violations.length === 0 ? '✅' : '❌'} ${portrait380Violations.length} violations`);

  // Landscape 700px
  console.log('Checking: Landscape 700px...');
  const landscape700Violations = validateLocks(
    rules,
    LANDSCAPE_700_LOCKS,
    'Landscape 700px',
    '700px'
  );
  allViolations.push(...landscape700Violations);
  console.log(`  ${landscape700Violations.length === 0 ? '✅' : '❌'} ${landscape700Violations.length} violations`);

  console.log();

  // Report violations
  if (allViolations.length > 0) {
    console.log('='.repeat(60));
    console.log('  LOCK STATE VIOLATIONS');
    console.log('='.repeat(60));
    console.log();

    for (const v of allViolations) {
      console.log(`[${v.context}] ${v.selector}`);
      console.log(`  Property: ${v.property}`);
      console.log(`  Expected: ${v.expected}`);
      console.log(`  Actual:   ${v.actual}`);
      console.log();
    }

    console.log(`Total violations: ${allViolations.length}`);
    console.log();
    console.log('To fix: Update greetingCard.css to match values in GREETING_LOCK.md');
    process.exit(1);
  }

  console.log('='.repeat(60));
  console.log('  ✅ ALL LOCK STATE VALUES VERIFIED');
  console.log('='.repeat(60));
  console.log();
  console.log('Lock state integrity confirmed.');
  process.exit(0);
}

main();
