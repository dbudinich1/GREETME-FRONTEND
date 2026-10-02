// src/pages/platformFeeBothTiers.contract.test.mjs
//
// REAL-BACKEND ACCEPTANCE for the one-platform-fee-per-account-ever policy (Team 2 commit 3819f18, branch
// team-2/billing-gifts-claims-gaps). scripts/gen-pair-backend-shapes.mjs runs that backend's OWN platform-fee-status handler with
// its real resolvePlatformFee service (only Cosmos/auth faked); these tests feed the answers to the FE fee logic.
//
// Run (Node 20):  node --test src/pages/platformFeeBothTiers.contract.test.mjs
// Backend dir:    TEAM2_BE_DIR (default C:\1_GREET-ME\gm-be-team2-billing). If it is missing, or does not yet contain the
//                 one-per-account policy, the tests are SKIPPED with a printed message (never a silent pass). The backend HEAD
//                 used is printed. Output goes to the OS temp dir, so no tracked fixture is modified.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { interpretPlatformFeeStatus, platformFeeFor, formatFeeAmount, FEE_STATE_UNKNOWN } from "../utils/platformFee.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const feRoot = path.resolve(here, "..", "..");
const BE = process.env.TEAM2_BE_DIR || "C:/1_GREET-ME/gm-be-team2-billing";
const OUT = path.join(os.tmpdir(), `platform-fee-both-tiers.${process.pid}.json`);

let shapes = null;
let skipReason = null;
const feeHistory = path.join(BE, "services", "checkout", "platformFeeHistory.js");
if (!fs.existsSync(feeHistory)) skipReason = `Team 2 backend not found at ${BE}`;
else if (!/PLATFORM_FEE_POLICY_IN_FORCE/.test(fs.readFileSync(feeHistory, "utf8"))) skipReason = `backend at ${BE} predates the one-fee-per-account policy (3819f18)`;
else {
  const env = { ...process.env, PAIR_BE_DIR: BE }; delete env.NODE_TEST_CONTEXT;
  const r = spawnSync(process.execPath, ["--experimental-test-module-mocks", path.join(feRoot, "scripts", "gen-pair-backend-shapes.mjs"), OUT], { encoding: "utf8", env, cwd: feRoot });
  if (r.status !== 0) throw new Error(`shape generator failed (exit ${r.status}):\n${r.stdout}\n${r.stderr}`);
  shapes = JSON.parse(fs.readFileSync(OUT, "utf8")).platformFee;
  const head = spawnSync("git", ["-C", BE, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  console.log(`platformFeeBothTiers validated against backend ${BE} @ ${head || "unknown"}`);
  try { fs.rmSync(OUT, { force: true }); } catch { /* ignore */ }
}
if (skipReason) console.warn(`SKIPPED platformFeeBothTiers: ${skipReason}. Set TEAM2_BE_DIR to a worktree containing 3819f18.`);
const t = (name, fn) => test(name, { skip: skipReason || false }, fn);

t("the real answer for a first-time account: both tiers apply, with the contract's fields", () => {
  const { status, body } = shapes.firstActivation;
  assert.equal(status, 200);
  assert.equal(body.policy, "one_per_account");
  assert.deepEqual(body.consumer, { feeCents: 499, applies: true, reason: "initial_activation", listFeeCents: 499 });
  assert.deepEqual(body.business, { feeCents: 1999, applies: true, reason: "initial_activation", listFeeCents: 1999 });
  const st = interpretPlatformFeeStatus(body, { authenticated: true });
  assert.equal(formatFeeAmount(platformFeeFor({}, false, st)), "$4.99");
  assert.equal(formatFeeAmount(platformFeeFor({}, true, st)), "$19.99");
});

t("the real answer for a returning account: BOTH tiers are waived, so the FE shows no fee line on either", () => {
  const { body } = shapes.returning;
  assert.deepEqual(body.consumer, { feeCents: 0, applies: false, reason: "already_authorized", listFeeCents: 499 });
  assert.deepEqual(body.business, { feeCents: 0, applies: false, reason: "already_authorized", listFeeCents: 1999 });
  const st = interpretPlatformFeeStatus(body, { authenticated: true });
  assert.equal(platformFeeFor({}, false, st), 0);
  assert.equal(platformFeeFor({}, true, st), 0, "a returning account buying Business pays no $19.99 and the page says so");
});

t("the real 503 FEE_HISTORY_UNAVAILABLE and 401 answers assert NO amount on either tier", () => {
  const down = shapes.historyUnavailable;
  assert.equal(down.status, 503);
  assert.equal(down.body.code, "FEE_HISTORY_UNAVAILABLE");
  assert.deepEqual(interpretPlatformFeeStatus(down.body, { authenticated: true }), FEE_STATE_UNKNOWN);
  assert.deepEqual(interpretPlatformFeeStatus(shapes.unauthenticated.body, { authenticated: true }), FEE_STATE_UNKNOWN);
  assert.equal(platformFeeFor({}, true, FEE_STATE_UNKNOWN), null);
});
