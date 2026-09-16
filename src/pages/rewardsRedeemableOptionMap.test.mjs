// src/pages/rewardsRedeemableOptionMap.test.mjs
//
// Structural proof for the reward-id -> optionId mapping that gates which reward tiles the
// Hearts Hub's shared confirm/redeem flow can act on (Rewards.jsx). Source-text assertion, not a
// module import — Rewards.jsx is JSX and pulls in a large real dependency graph (router, cart
// service, API client, notify, and ~10 Hub sub-components), so mounting it just to read one
// frozen data literal would be fragile; this mirrors the structural-proof convention already
// used elsewhere in this codebase (e.g. BACKEND routes/giftsCheckpoint1.test.mjs) for exactly
// this kind of claim. The RENDERED behavior (tiles actually clickable/non-clickable, confirm
// copy) is proven separately in src/components/hub/hubRedeemMarketplaceAnytimeCredits.browser.test.mjs.
//
// Run: node --test src/pages/rewardsRedeemableOptionMap.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { CANONICAL_CATALOG } from "../components/hub/hubConfig.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(HERE, "Rewards.jsx"), "utf8");

// Extract the frozen object literal's body verbatim.
const match = SRC.match(/export const REDEEMABLE_OPTION_ID_BY_REWARD = Object\.freeze\(\{([\s\S]*?)\}\);/);

test("REDEEMABLE_OPTION_ID_BY_REWARD is exported, module-level, and frozen", () => {
  assert.ok(match, "the exact frozen, exported literal must be present in Rewards.jsx");
});

const CONNECTED_IDS = ["anytime_greetme", "anytime_3", "anytime_5", "renewal_10", "renewal_15", "renewal_20", "upgrade_discount"];

test("exactly the seven connected reward ids map to the exact canonical optionId strings", () => {
  const body = match[1];
  const pairs = Object.fromEntries(
    [...body.matchAll(/(\w+):\s*'([\w]+)'/g)].map((m) => [m[1], m[2]])
  );
  assert.deepEqual(pairs, {
    anytime_greetme: "free_greeting",
    anytime_3: "anytime_credits_3",
    anytime_5: "anytime_credits_5",
    renewal_10: "renewal_10",
    renewal_15: "renewal_15",
    renewal_20: "renewal_20",
    upgrade_discount: "upgrade_discount",
  });
});

test("every OTHER reward in the full 20-reward canonical catalog is absent from the map's source", () => {
  const body = match[1];
  const allIds = CANONICAL_CATALOG.flatMap((cat) => cat.rewards.map((r) => r.id));
  const otherIds = allIds.filter((id) => !CONNECTED_IDS.includes(id));
  assert.ok(otherIds.length >= 13, "sanity: the other 13 rewards exist in the catalog");
  for (const id of otherIds) {
    assert.doesNotMatch(body, new RegExp(`\\b${id}\\b`), `${id} must not appear in the redeemable map`);
  }
});

test("openRedeemIntent refuses any reward id not in the map (defense in depth, source-verified)", () => {
  assert.match(SRC, /const openRedeemIntent = \(rewardId\) => \{\s*\n\s*if \(!REDEEMABLE_OPTION_ID_BY_REWARD\[rewardId\]\) return;/);
});

test("confirmRedeemIntent sends the reward's mapped optionId, not a hardcoded string", () => {
  assert.match(SRC, /const optionId = REDEEMABLE_OPTION_ID_BY_REWARD\[redeemTargetId\];/);
  assert.match(SRC, /api\.redeemHearts\(optionId, reqId\)/);
  assert.doesNotMatch(
    SRC.replace(/anytime_greetme: 'free_greeting'/, ""), // the map's own entry is allowed
    /redeemHearts\('free_greeting'/,
    "the hardcoded 'free_greeting' call site must be gone — only the generalized call remains"
  );
});

test("the success message branches on the REAL server grant shape (Anytime count vs Stripe coupon), never assumes one kind", () => {
  assert.match(SRC, /Number\(res\.granted\?\.anytimeGreetMes\)/, "checks for an Anytime grant explicitly");
  assert.match(SRC, /res\.granted\?\.couponId/, "checks for a subscription-discount grant explicitly");
  assert.match(SRC, /findRewardTitle\(redeemTargetId\)/, "the discount branch names the actual reward, not a generic string");
});
