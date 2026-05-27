// scripts/verify-creditclaim-viral-loop-lock.mjs
//
// Locked Viral Loop + Verification Gate Regression Guard
// Files protected:
//   - src/pages/CreditClaim.jsx
//   - src/pages/ThankYouFlow.jsx
//   - src/pages/SendGreeting.jsx
//   - src/components/GuidedSetupFlow.jsx
//   - src/components/EmailVerificationModal.jsx
//
// Background:
//   On 2026-05-01, commit d056822c silently broke the new-recipient credit-claim →
//   thank-you handoff in TWO places:
//     (A) CreditClaim.jsx — added `!isAuthenticated` gates to thank-you CTAs.
//         New recipients become authenticated during inline claim, which hid
//         the CTAs and silently dropped ~25 days of new recipients from the loop.
//     (B) ThankYouFlow.jsx — added a useEffect that redirects ANY authenticated
//         user to /dashboard ("LI-039"). Same architectural mistake: assumes
//         authenticated == sender. New recipients are also authenticated by the
//         time they reach ThankYouFlow → they get bounced to dashboard.
//
// What this script asserts on CreditClaim.jsx:
//   (1) The LOCKED VIRAL LOOP comments are present (institutional memory marker).
//   (2) The pre-regression copy and CTA text are present in the authenticated
//       branch: "Say thank you, or continue when you're ready" + "Say Thank You".
//   (3) The isSenderViewingOwnCredit derived value is the proper sender discriminator
//       (already early-returns in the file at the time of writing).
//   (4) The regression pattern `&& !isAuthenticated && ... navigate('/thank-you'`
//       is NOT present.
//   (5) The regressed CTA label "Claim & Continue" is NOT present.
//
// What this script asserts on ThankYouFlow.jsx:
//   (6) The LOCKED VIRAL LOOP comment marker is present (institutional memory).
//   (7) No useEffect redirects authenticated users to /dashboard — the regression
//       pattern is: `if (user) { navigate('/dashboard'` (in any useEffect).
//
// If any check fails, the script exits with code 1 and prints the failure list,
// which fails the npm prebuild step and blocks `vite build` from running.
//
// To intentionally redesign these flows, update THIS guard script in the same
// commit that changes the protected files, with explicit founder approval.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ccPath = path.join(__dirname, "..", "src", "pages", "CreditClaim.jsx");
const tyfPath = path.join(__dirname, "..", "src", "pages", "ThankYouFlow.jsx");
const sgPath = path.join(__dirname, "..", "src", "pages", "SendGreeting.jsx");
const gsfPath = path.join(__dirname, "..", "src", "components", "GuidedSetupFlow.jsx");
const evmPath = path.join(__dirname, "..", "src", "components", "EmailVerificationModal.jsx");

function readOrDie(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (err) {
    console.error(`[viral-loop-lock] Cannot read ${p}: ${err.message}`);
    process.exit(1);
  }
}

const cc = readOrDie(ccPath);
const tyf = readOrDie(tyfPath);
const sg = readOrDie(sgPath);
const gsf = readOrDie(gsfPath);
const evm = readOrDie(evmPath);

const checks = [
  // --- CreditClaim.jsx ---
  { file: "CreditClaim.jsx", required: true,
    name: "LOCKED VIRAL LOOP comment marker",
    test: () => /LOCKED VIRAL LOOP/.test(cc) },
  { file: "CreditClaim.jsx", required: true,
    name: "isSenderViewingOwnCredit sender discriminator",
    test: () => /isSenderViewingOwnCredit/.test(cc) },
  { file: "CreditClaim.jsx", required: true,
    name: 'Authenticated-branch copy: "Say thank you, or continue when you\'re ready"',
    test: () => /Say thank you, or continue when you&rsquo;re ready/.test(cc) },
  { file: "CreditClaim.jsx", required: true,
    name: 'Authenticated-branch button label: "Say Thank You"',
    test: () => /['"]Say Thank You['"]/.test(cc) },
  { file: "CreditClaim.jsx", required: true,
    name: 'Thank-you CTA navigates to /thank-you with sourceJobId',
    test: () => /navigate\(\s*[`'"]\/thank-you\?jobId=\$\{credit\.sourceJobId\}/.test(cc) },
  { file: "CreditClaim.jsx", required: false,
    name: "Regression: '&& !isAuthenticated &&' adjacent to a thank-you CTA navigate",
    test: () => /&&\s*!isAuthenticated\s*&&[\s\S]{0,300}navigate\(\s*[`'"]\/thank-you/m.test(cc) },
  { file: "CreditClaim.jsx", required: false,
    name: "Regression: '!isAuthenticated ?' adjacent to a thank-you CTA navigate",
    test: () => /&&\s*!isAuthenticated\s*\?[\s\S]{0,300}navigate\(\s*[`'"]\/thank-you/m.test(cc) },
  { file: "CreditClaim.jsx", required: false,
    name: "Regression: CTA label 'Claim & Continue' (was 'Say Thank You')",
    test: () => /Claim & Continue/.test(cc) },

  // --- ThankYouFlow.jsx ---
  { file: "ThankYouFlow.jsx", required: true,
    name: "LOCKED VIRAL LOOP comment marker",
    test: () => /LOCKED VIRAL LOOP/.test(tyf) },
  { file: "ThankYouFlow.jsx", required: false,
    name: "Regression: useEffect redirects authenticated user to /dashboard",
    test: () => /if\s*\(\s*user\s*\)\s*\{[\s\S]{0,200}navigate\(\s*['"`]\/dashboard/m.test(tyf) },

  // --- SendGreeting.jsx ---
  { file: "SendGreeting.jsx", required: true,
    name: "PROTECTED SUBSYSTEM governance marker",
    test: () => /PROTECTED SUBSYSTEM/.test(sg) },
  { file: "SendGreeting.jsx", required: true,
    name: "Imports EmailVerificationModal",
    test: () => /import\s+EmailVerificationModal\s+from\s+['"`][^'"`]*EmailVerificationModal['"`]/.test(sg) },
  { file: "SendGreeting.jsx", required: true,
    name: "Renders <EmailVerificationModal",
    test: () => /<EmailVerificationModal\b/.test(sg) },
  { file: "SendGreeting.jsx", required: true,
    name: "Handles EMAIL_NOT_VERIFIED code on send catch",
    test: () => /error\?\.code\s*===\s*['"`]EMAIL_NOT_VERIFIED['"`]/.test(sg) },
  { file: "SendGreeting.jsx", required: true,
    name: "Preserves payload via setPendingSendPayload",
    test: () => /setPendingSendPayload\(/.test(sg) },

  // --- GuidedSetupFlow.jsx ---
  { file: "GuidedSetupFlow.jsx", required: true,
    name: "PROTECTED SUBSYSTEM governance marker",
    test: () => /PROTECTED SUBSYSTEM/.test(gsf) },
  { file: "GuidedSetupFlow.jsx", required: true,
    name: "Onboarding test send flagged isOnboardingTestSend: true",
    test: () => /isOnboardingTestSend\s*:\s*true/.test(gsf) },

  // --- EmailVerificationModal.jsx ---
  { file: "EmailVerificationModal.jsx", required: true,
    name: "PROTECTED SUBSYSTEM governance marker",
    test: () => /PROTECTED SUBSYSTEM/.test(evm) },
  { file: "EmailVerificationModal.jsx", required: true,
    name: "Warm heading copy: 'Before your Greet-Me is delivered'",
    test: () => /Before your Greet-Me is delivered/.test(evm) },
  { file: "EmailVerificationModal.jsx", required: false,
    name: "Regression: corporate/security copy ('protect' / 'secure your account' / 'verify your identity')",
    test: () => /\b(protect your delivery|secure your account|verify your identity|for your safety)\b/i.test(evm) },
];

const failures = [];

for (const c of checks) {
  const present = c.test();
  const ok = c.required ? present : !present;
  const verb = c.required ? (present ? "Present" : "MISSING required") : (present ? "DETECTED forbidden" : "Not present");
  const mark = ok ? "✓" : "✗";
  const line = `  ${mark} [${c.file}] ${verb}: ${c.name}`;
  if (!ok) failures.push(line);
  console.log(line);
}

if (failures.length > 0) {
  console.error("");
  console.error("=========================================================");
  console.error("VIRAL LOOP + VERIFICATION GATE LOCK GUARD FAILED");
  console.error("One or more Protected Subsystem files have drifted from");
  console.error("the locked new-recipient flow or verification checkpoint.");
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
console.log("[LOCKED_VIRAL_LOOP_OK] CreditClaim + ThankYouFlow viral loop lock verified");
