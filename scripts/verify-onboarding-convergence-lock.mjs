// scripts/verify-onboarding-convergence-lock.mjs
//
// Locked Onboarding → Dashboard Convergence Regression Guard
// Files protected:
//   - src/utils/accountState.js        (the onboarding-complete gate)
//   - src/context/AuthContext.jsx      (the user-state hydrator)
//   - src/pages/ThankYouFlow.jsx       (recipient-origin stamp site)
// Advisory check (best-effort):
//   - ../BACKEND/index.js              (/api/profile derivation site)
//
// Background:
//   On 2026-05-27 the founder hit a real-world failure where ThankYouFlow
//   inline-register + voice/photo uploads correctly persisted to Cosmos
//   (user.voiceId, user.voiceUrl, user.photoUrl) but the dashboard
//   re-presented cold-start onboarding because:
//     1. computeIsOnboardingComplete() didn't read those Cosmos fields —
//        it only read a 5-source localStorage stack + a dead Cosmos check
//        (entitlements.profileComplete was never written by any backend).
//     2. AuthContext.register() actively wiped greetme_setup_state on every
//        registration (intended cold-signup cleanup, harmful in TYF context).
//     3. ThankYouFlow never stamped greetme_origin_recipient, so the
//        recipient-suppression branch at accountState.js:121 didn't fire.
//
//   The convergence repair (Stage 3, 2026-05-27) added three additive moves:
//     Move 1 (backend): GET /api/profile derives personalizationComplete
//                       from (user.voiceId && user.photoUrl) and also writes
//                       entitlements.profileComplete in the same response.
//     Move 2 (frontend AuthContext): fetchAndHydrateProfile destructures
//                       personalizationComplete into the user object so the
//                       gate can read it.
//     Move 3 (frontend accountState): computeIsOnboardingComplete checks
//                       user.personalizationComplete as a new rank-2 positive
//                       branch — before the legacy localStorage stack.
//     Move 4 (frontend ThankYouFlow): handleInlineRegister stamps
//                       greetme_origin_recipient=true after successful
//                       register() inside the if (!user) block.
//
// This guard verifies all four moves are in place AND positioned correctly.
//
// If any check fails, the script exits with code 1 and prints the failure
// list, which fails the npm prebuild step and blocks `vite build` from
// running. To intentionally redesign convergence, update THIS guard script
// in the same commit that changes the protected files, with explicit
// founder approval.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const accountStatePath = path.join(__dirname, "..", "src", "utils", "accountState.js");
const authContextPath = path.join(__dirname, "..", "src", "context", "AuthContext.jsx");
const tyfPath = path.join(__dirname, "..", "src", "pages", "ThankYouFlow.jsx");
const dashboardHomePath = path.join(__dirname, "..", "src", "pages", "DashboardHome.jsx");
const warmReentryPath = path.join(__dirname, "..", "src", "components", "WarmReentryWelcome.jsx");
const backendIndexPath = path.join(__dirname, "..", "..", "BACKEND", "index.js");

function readOrDie(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch (err) {
    console.error(`[onboarding-convergence-lock] Cannot read ${p}: ${err.message}`);
    process.exit(1);
  }
}

function readOrAdvisory(p) {
  try {
    return fs.readFileSync(p, "utf8");
  } catch {
    return null;
  }
}

const accountStateSrc = readOrDie(accountStatePath);
const authContextSrc = readOrDie(authContextPath);
const tyfSrc = readOrDie(tyfPath);
const dashboardHomeSrc = readOrDie(dashboardHomePath);
const warmReentrySrc = readOrDie(warmReentryPath);
const backendIndexSrc = readOrAdvisory(backendIndexPath);

const checks = [
  // --- accountState.js ---
  {
    file: "accountState.js",
    required: true,
    name: "computeIsOnboardingComplete checks user.personalizationComplete",
    test: () => /personalizationComplete\s*===\s*true/.test(accountStateSrc),
  },
  {
    file: "accountState.js",
    required: true,
    name: "personalizationComplete check precedes legacy greetme_setup_state read",
    test: () => {
      const pIdx = accountStateSrc.search(/personalizationComplete\s*===\s*true/);
      const sIdx = accountStateSrc.search(/safeLocalGet\(['"]greetme_setup_state['"]\)/);
      return pIdx !== -1 && sIdx !== -1 && pIdx < sIdx;
    },
  },

  // --- AuthContext.jsx ---
  {
    file: "AuthContext.jsx",
    required: true,
    name: "fetchAndHydrateProfile destructures personalizationComplete from /api/profile response",
    test: () => /personalizationComplete\s*=\s*data\.profile\??\.?personalizationComplete/.test(authContextSrc),
  },
  {
    file: "AuthContext.jsx",
    required: true,
    name: "Merged user object includes personalizationComplete",
    test: () => /const\s+updatedUser\s*=[\s\S]{0,400}personalizationComplete/.test(authContextSrc),
  },

  // --- ThankYouFlow.jsx ---
  {
    file: "ThankYouFlow.jsx",
    required: true,
    name: "handleInlineRegister stamps greetme_origin_recipient after successful register()",
    test: () =>
      /handleInlineRegister[\s\S]{0,2000}localStorage\.setItem\(\s*['"]greetme_origin_recipient['"]\s*,\s*['"]true['"]\s*\)/.test(
        tyfSrc
      ),
  },

  // --- accountState.js — warm re-entry gate ---
  {
    file: "accountState.js",
    required: true,
    name: "Exports shouldShowWarmReentry function (Tier 2 warm dashboard re-entry)",
    test: () => /export\s+function\s+shouldShowWarmReentry\b/.test(accountStateSrc),
  },
  {
    file: "accountState.js",
    required: true,
    name: "shouldShowWarmReentry checks isOnboardingComplete + isRegisteredViaRecipientFlow + contactsCount",
    test: () => {
      const fnMatch = accountStateSrc.match(
        /export\s+function\s+shouldShowWarmReentry[\s\S]{0,1200}?\n\}/
      );
      if (!fnMatch) return false;
      const body = fnMatch[0];
      return (
        /isOnboardingComplete/.test(body) &&
        /isRegisteredViaRecipientFlow/.test(body) &&
        /contactsCount/.test(body)
      );
    },
  },

  // --- DashboardHome.jsx — warm re-entry mount ---
  {
    file: "DashboardHome.jsx",
    required: true,
    name: "Imports WarmReentryWelcome, calls shouldShowWarmReentry, mounts <WarmReentryWelcome />",
    test: () =>
      /import\s+WarmReentryWelcome\s+from\s+['"]\.\.\/components\/WarmReentryWelcome['"]/.test(
        dashboardHomeSrc
      ) &&
      /shouldShowWarmReentry\(/.test(dashboardHomeSrc) &&
      /<WarmReentryWelcome\b/.test(dashboardHomeSrc),
  },

  // --- WarmReentryWelcome.jsx — file exists with expected shape ---
  {
    file: "WarmReentryWelcome.jsx",
    required: true,
    name: "Default-exports a function component navigating to /dashboard/contacts on CTA",
    test: () =>
      /export\s+default\s+function\s+WarmReentryWelcome\b/.test(warmReentrySrc) &&
      /\/dashboard\/contacts/.test(warmReentrySrc),
  },

  // --- BACKEND/index.js (advisory) ---
  {
    file: "../BACKEND/index.js",
    required: true,
    advisory: true,
    name: "GET /api/profile derives personalizationComplete from voiceId && photoUrl (advisory)",
    test: () => {
      if (backendIndexSrc === null) return null; // skipped
      return (
        /personalizationComplete\s*=\s*!!\s*\(\s*user\.voiceId\s*&&\s*user\.photoUrl\s*\)/.test(
          backendIndexSrc
        )
      );
    },
  },
  {
    file: "../BACKEND/index.js",
    required: true,
    advisory: true,
    name: "GET /api/profile response includes personalizationComplete field (advisory)",
    test: () => {
      if (backendIndexSrc === null) return null;
      // Look for the field appearing in a profile/response object construction
      return /personalizationComplete\s*,?\s*\n/.test(backendIndexSrc);
    },
  },
];

const failures = [];

for (const c of checks) {
  const result = c.test();
  // Advisory checks return null when backend isn't co-located — log + skip
  if (c.advisory && result === null) {
    console.log(`  · [${c.file}] Skipped (advisory, backend not co-located): ${c.name}`);
    continue;
  }
  const present = !!result;
  const ok = c.required ? present : !present;
  const verb = c.required
    ? present
      ? "Present"
      : "MISSING required"
    : present
    ? "DETECTED forbidden"
    : "Not present";
  const mark = ok ? "✓" : "✗";
  const line = `  ${mark} [${c.file}] ${verb}: ${c.name}`;
  if (!ok) failures.push(line);
  console.log(line);
}

if (failures.length > 0) {
  console.error("");
  console.error("=========================================================");
  console.error("ONBOARDING CONVERGENCE LOCK GUARD FAILED");
  console.error("One or more files have drifted from the locked");
  console.error("ThankYouFlow → Dashboard convergence contract.");
  console.error("Users completing thank-you personalization will see the");
  console.error("dashboard re-present cold-start onboarding, breaking the");
  console.error("'first-class acquisition funnel' product direction.");
  console.error("");
  for (const f of failures) console.error(f);
  console.error("");
  console.error("If this is an intentional flow redesign, update");
  console.error("scripts/verify-onboarding-convergence-lock.mjs in the");
  console.error("same commit with explicit founder approval.");
  console.error("=========================================================");
  process.exit(1);
}

console.log("");
console.log("[LOCKED_ONBOARDING_CONVERGENCE_OK] FRONTEND onboarding convergence guard verified");
