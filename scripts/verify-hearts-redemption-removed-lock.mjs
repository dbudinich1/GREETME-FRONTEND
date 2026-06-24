// scripts/verify-hearts-redemption-removed-lock.mjs
//
// Hearts 1A — H6a LOCKED CUTOVER guard (frontend mechanical coupling).
//
// The legacy localStorage Hearts redemption + fake-earning path was removed in H6a.
// It must STAY removed: real server Hearts must never coexist with the known-broken
// redemption path (LOCKED CUTOVER RULE). This guard fails the build if active
// frontend source re-introduces it.
//
// FAILS if any src/**/*.{js,jsx} file contains:
//   - the identifiers `redeemRewards` or `REDEMPTION_OPTIONS` (anywhere), OR
//   - any legacy Hearts localStorage key USED outside a one-time `removeItem(...)`
//     cleanup call (i.e. a getItem/setItem/active reference).
//
// The keys ARE allowed inside `localStorage.removeItem('<key>')` cleanup calls, since
// the H6a cleanup must reference them to delete them.
//
// To intentionally change this (e.g. when real redemption ships in H7), update THIS
// guard in the same commit, with explicit founder approval.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..", "src");

const FORBIDDEN_IDENTIFIERS = ["redeemRewards", "REDEMPTION_OPTIONS"];
const LEGACY_KEYS = [
  "greetme_rewards_balance",
  "greetme_rewards_history",
  "greetme_daily_greeting_hearts",
  "greetme_dm_tag_claims",
  "greetme_hero_member",
];

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p));
    else if (/\.(js|jsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const failures = [];

for (const file of walk(SRC)) {
  const rel = path.relative(path.join(__dirname, ".."), file);
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/);
  lines.forEach((line, i) => {
    const ln = i + 1;
    for (const id of FORBIDDEN_IDENTIFIERS) {
      if (line.includes(id)) failures.push(`${rel}:${ln} — forbidden identifier '${id}'`);
    }
    for (const key of LEGACY_KEYS) {
      // Allowed ONLY as a removeItem cleanup argument; any other use fails.
      if (line.includes(key) && !/removeItem\s*\(/.test(line)) {
        failures.push(`${rel}:${ln} — legacy key '${key}' used outside removeItem() cleanup`);
      }
    }
  });
}

if (failures.length > 0) {
  console.error("=========================================================");
  console.error("HEARTS REDEMPTION-REMOVED GUARD FAILED (H6a LOCKED CUTOVER)");
  console.error("Legacy Hearts redemption/earning re-introduced in frontend src:");
  console.error("");
  for (const f of failures) console.error("  ✗ " + f);
  console.error("");
  console.error("Real server Hearts must never coexist with the broken redemption path.");
  console.error("Keys may appear ONLY inside localStorage.removeItem() cleanup.");
  console.error("=========================================================");
  process.exit(1);
}

console.log("[HEARTS_REDEMPTION_REMOVED_OK] no active legacy Hearts redemption/earning in frontend src");
