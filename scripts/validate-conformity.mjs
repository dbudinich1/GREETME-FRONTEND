import fs from "node:fs";
import path from "node:path";

function nowIso() {
  return new Date().toISOString();
}

function fail(code, details) {
  // Single, canonical log entry (machine + human readable)
  console.error(`[CSS_CONFORMITY_VIOLATION] ${nowIso()}`);
  console.error(`Code: ${code}`);
  console.error(details.trim());
  process.exit(1);
}

function readText(relPath) {
  const p = path.resolve(process.cwd(), relPath);
  if (!fs.existsSync(p)) {
    fail("MISSING_FILE", `Missing required file: ${relPath}`);
  }
  return fs.readFileSync(p, "utf8");
}

function mustMatch(text, regex, code, message) {
  if (!regex.test(text)) fail(code, message);
}

function mustNotMatch(text, regex, code, message) {
  if (regex.test(text)) fail(code, message);
}

// ---- Paths (FRONTEND repo) ----
const greetingCssPath = "src/components/GreetingCardProto/greetingCard.css";
const lockTokensPath  = "src/components/GreetingCardProto/lockTokens.css";

const greetingCss = readText(greetingCssPath);
const lockTokens  = readText(lockTokensPath);

// ---- Gate 1: Warm Wishes must not render on LEFT page ----
mustMatch(
  greetingCss,
  /\.gc-interior-spread\s+\.gc-page-left\s+\.gc-warm-wishes\s*\{\s*display\s*:\s*none\s*;\s*\}/m,
  "WARM_WISHES_LEFT_VISIBLE",
  `
Scope: Greeting Card Layout
Rule: Warm Wishes must appear ONLY on right page
Required CSS rule missing:

.gc-interior-spread .gc-page-left .gc-warm-wishes { display: none; }

File: ${greetingCssPath}
`
);

// ---- Gate 2: Locked token values must remain unchanged for locked viewports ----

// <=500px portrait: signature reserve 20px, poem font-size 17px (locked 390x844)
mustMatch(
  lockTokens,
  /@media\s*\(max-width:\s*500px\)\s*and\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?:root\s*\{[\s\S]*?--lock-signature-reserve:\s*20px;[\s\S]*?\}[\s\S]*?\}/m,
  "TOKEN_DRIFT_PORTRAIT_SIGNATURE_RESERVE",
  `
Scope: Locked Tokens (390x844 portrait)
Expected: --lock-signature-reserve: 20px
File: ${lockTokensPath}
`
);

mustMatch(
  lockTokens,
  /@media\s*\(max-width:\s*500px\)\s*and\s*\(orientation:\s*portrait\)\s*\{[\s\S]*?:root\s*\{[\s\S]*?--lock-poem-font-size:\s*17px;[\s\S]*?\}[\s\S]*?\}/m,
  "TOKEN_DRIFT_PORTRAIT_POEM_FONT",
  `
Scope: Locked Tokens (390x844 portrait)
Expected: --lock-poem-font-size: 17px
File: ${lockTokensPath}
`
);

// <=700px landscape: signature reserve 40px (locked 667x375)
mustMatch(
  lockTokens,
  /@media\s*\(max-width:\s*700px\)\s*and\s*\(orientation:\s*landscape\)\s*\{[\s\S]*?:root\s*\{[\s\S]*?--lock-signature-reserve:\s*40px;[\s\S]*?\}[\s\S]*?\}/m,
  "TOKEN_DRIFT_LANDSCAPE_SIGNATURE_RESERVE",
  `
Scope: Locked Tokens (667x375 landscape)
Expected: --lock-signature-reserve: 40px
File: ${lockTokensPath}
`
);

// ---- Gate 3: Forbidden regressions (hardcoded overrides you removed must not return) ----
// These checks are intentionally narrow: they only block the exact "ghost override" patterns from your audit.
// Patterns use [^}]* to stay within a single CSS rule block, avoiding false positives.

const forbidden = [
  // Match .gc-greeting-message with hardcoded margin-top:-8px in same rule block
  { re: /\.gc-greeting-message\s*\{[^}]*margin-top\s*:\s*-8px\s*;[^}]*\}/m,
    code: "REGRESSION_PORTRAIT_MESSAGE_MARGIN_HARDCODED",
    msg: `Hardcoded margin-top:-8px found for .gc-greeting-message. Use --lock-message-margin token.` },

  // Match .gc-greeting-occasion with hardcoded margin-top:4px in same rule block
  { re: /\.gc-greeting-occasion\s*\{[^}]*margin-top\s*:\s*4px\s*;[^}]*\}/m,
    code: "REGRESSION_PORTRAIT_OCCASION_MARGIN_HARDCODED",
    msg: `Hardcoded margin-top:4px found for .gc-greeting-occasion. Use --lock-occasion-margin token.` },

  // Match .gc-poem-content with hardcoded padding-top:0 or padding-bottom:0 in same rule block
  { re: /\.gc-poem-content\s*\{[^}]*padding-top\s*:\s*0\s*;[^}]*\}/m,
    code: "REGRESSION_PORTRAIT_POEM_PADDING_TOP_HARDCODED",
    msg: `Hardcoded padding-top:0 found for .gc-poem-content. Use --lock-poem-content-padding token.` },

  { re: /\.gc-poem-content\s*\{[^}]*padding-bottom\s*:\s*0\s*;[^}]*\}/m,
    code: "REGRESSION_PORTRAIT_POEM_PADDING_BOTTOM_HARDCODED",
    msg: `Hardcoded padding-bottom:0 found for .gc-poem-content. Use --lock-poem-content-padding token.` },

  // Landscape: hardcoded padding:0 on .gc-interior-spread .gc-poem-content
  { re: /\.gc-interior-spread\s+\.gc-poem-content\s*\{[^}]*padding\s*:\s*0\s*;[^}]*\}/m,
    code: "REGRESSION_LANDSCAPE_POEM_PADDING_CONFLICT",
    msg: `Hardcoded padding:0 found for .gc-interior-spread .gc-poem-content. Use tokens.` },

  // Landscape: hardcoded padding:0 12px on .gc-poem-content
  { re: /\.gc-poem-content\s*\{[^}]*padding\s*:\s*0\s+12px\s*;[^}]*\}/m,
    code: "REGRESSION_LANDSCAPE_POEM_PADDING_HARDCODED",
    msg: `Hardcoded padding:0 12px found for .gc-poem-content. Use --lock-poem-content-padding token.` },
];

for (const f of forbidden) {
  mustNotMatch(
    greetingCss,
    f.re,
    f.code,
    `
Scope: Greeting Card Layout
Rule: Token authority (no hardcoded token-owned overrides)
File: ${greetingCssPath}

${f.msg}
`
  );
}

// ---- Success ----
console.log(`[CSS_CONFORMITY_OK] ${nowIso()} - Conformity gate passed`);
