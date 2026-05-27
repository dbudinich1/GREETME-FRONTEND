// scripts/verify-creditclaim-viral-loop-lock.mjs
//
// Locked Viral Loop Regression Guard for src/pages/CreditClaim.jsx
//
// Background:
//   On 2026-05-01, commit d056822c silently broke the new-recipient credit-claim →
//   thank-you handoff by adding `!isAuthenticated` gates to the thank-you CTAs in
//   CreditClaim.jsx. New recipients who registered+claimed via the inline conversion
//   flow became authenticated, which hid the thank-you CTA — silently dropping
//   ~25 days of new recipients from the viral loop.
//
// What this script asserts:
//   (1) The LOCKED VIRAL LOOP comments are present (institutional memory marker).
//   (2) The pre-regression copy and CTA text are present in the authenticated
//       branch: "Say thank you, or continue when you're ready" + "Say Thank You".
//   (3) The isSenderViewingOwnCredit derived value is the proper sender discriminator
//       (already early-returns in the file at the time of writing — referenced here
//       to ensure the architectural distinction stays explicit).
//   (4) The regression pattern `&& !isAuthenticated && ... navigate('/thank-you'`
//       is NOT present in the file.
//   (5) The regressed CTA label "Claim & Continue" is NOT present.
//
// If any check fails, the script exits with code 1 and prints the failure list,
// which fails the npm prebuild step and blocks `vite build` from running.
//
// To regenerate the locked behavior after an intentional re-design, update
// THIS file in the same commit that changes CreditClaim.jsx, with explicit
// founder approval.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const targetPath = path.join(__dirname, "..", "src", "pages", "CreditClaim.jsx");

let src;
try {
  src = fs.readFileSync(targetPath, "utf8");
} catch (err) {
  console.error(`[viral-loop-lock] Cannot read ${targetPath}: ${err.message}`);
  process.exit(1);
}

const required = [
  {
    name: "LOCKED VIRAL LOOP comment marker",
    test: () => /LOCKED VIRAL LOOP/.test(src),
  },
  {
    name: "isSenderViewingOwnCredit sender discriminator",
    test: () => /isSenderViewingOwnCredit/.test(src),
  },
  {
    name: 'Authenticated-branch copy: "Say thank you, or continue when you\'re ready"',
    test: () => /Say thank you, or continue when you&rsquo;re ready/.test(src),
  },
  {
    name: 'Authenticated-branch button label: "Say Thank You"',
    test: () => /['"]Say Thank You['"]/.test(src),
  },
  {
    name: 'Thank-you CTA navigates to /thank-you with sourceJobId',
    test: () => /navigate\(\s*[`'"]\/thank-you\?jobId=\$\{credit\.sourceJobId\}/.test(src),
  },
];

const forbidden = [
  {
    name: "Regression: '&& !isAuthenticated &&' adjacent to a thank-you CTA navigate",
    test: () =>
      /&&\s*!isAuthenticated\s*&&[\s\S]{0,300}navigate\(\s*[`'"]\/thank-you/m.test(
        src,
      ),
  },
  {
    name: "Regression: '!isAuthenticated ?' adjacent to a thank-you CTA navigate",
    test: () =>
      /&&\s*!isAuthenticated\s*\?[\s\S]{0,300}navigate\(\s*[`'"]\/thank-you/m.test(
        src,
      ),
  },
  {
    name: "Regression: CTA label 'Claim & Continue' (was 'Say Thank You')",
    test: () => /Claim & Continue/.test(src),
  },
];

const failures = [];

for (const check of required) {
  if (!check.test()) {
    failures.push(`  ✗ MISSING required: ${check.name}`);
  } else {
    console.log(`  ✓ Present: ${check.name}`);
  }
}

for (const check of forbidden) {
  if (check.test()) {
    failures.push(`  ✗ DETECTED forbidden: ${check.name}`);
  } else {
    console.log(`  ✓ Not present: ${check.name}`);
  }
}

if (failures.length > 0) {
  console.error("");
  console.error("=========================================================");
  console.error("VIRAL LOOP LOCK GUARD FAILED");
  console.error("CreditClaim.jsx has drifted from the locked recipient flow.");
  console.error("");
  for (const f of failures) console.error(f);
  console.error("");
  console.error("If this is an intentional flow redesign, update");
  console.error("scripts/verify-creditclaim-viral-loop-lock.mjs in the same");
  console.error("commit with explicit founder approval.");
  console.error("=========================================================");
  process.exit(1);
}

console.log("");
console.log("[LOCKED_VIRAL_LOOP_OK] CreditClaim viral loop lock verified");
