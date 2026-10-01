// src/pages/t1bCommerceGrowth.test.mjs
// Closeout T1B — source-level regression locks for W16, W17, W19, W20, W23, W44.
// Run: node --test src/pages/t1bCommerceGrowth.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(here, "..", rel), "utf8").replace(/\r\n/g, "\n");

test("W19: empty cart has ONE primary American Gift Place CTA and a Back Home link, no merch split", () => {
  const src = read("pages/Cart.jsx");
  const start = src.indexOf("// Empty cart state");
  const end = src.indexOf("// Cart with items");
  const empty = src.slice(start, end);
  assert.match(empty, /Browse American Gift Place&#8482;/);
  assert.match(empty, /data-testid="cart-empty-browse-agp"/);
  assert.match(empty, /data-testid="cart-empty-back-home"/);
  assert.match(empty, /navigate\('\/dashboard'\)/);
  assert.equal((empty.match(/navigate\('\/dashboard\/gifts'\)/g) || []).length, 1, "exactly one browse CTA");
  assert.doesNotMatch(empty, /dashboard\/merch/, "no gifts/merch split");
  assert.doesNotMatch(empty, /Shop the American Gift Place|Browse Gifts/);
});

test("W44: RedeemQRCash is a pure redirect to the canonical /gift/:claimToken flow, with no storage or simulation", () => {
  const src = read("pages/RedeemQRCash.jsx");
  const code = src.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.match(code, /<Navigate to=\{`\/gift\/\$\{encodeURIComponent\(token\)\}`\} replace \/>/);
  assert.doesNotMatch(code, /localStorage|sessionStorage|setTimeout|qrcash_gifts|qrcash_balance|Cash Received/);
});

test("W44: route-wide — nothing outside DashboardHome's legacy read writes or mints greetme_qrcash_gifts/_balance", () => {
  const root = path.join(here, "..");
  const hits = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(jsx?|mjs)$/.test(e.name) && !e.name.includes(".test.") && e.name !== "QRCashGiftModal.jsx") {
        const t = fs.readFileSync(p, "utf8");
        if (/setItem\(\s*['"]greetme_qrcash_(gifts|balance)['"]/.test(t)) hits.push(path.relative(root, p));
      }
    }
  })(root);
  assert.deepEqual(hits, [], "no live code may write the simulated deposit records");
  assert.match(read("App.jsx"), /<Route path="\/redeem\/qr-cash\/:id" element=\{<RedeemQRCash \/>\} \/>/);
  assert.match(read("App.jsx"), /<Route path="\/gift\/:claimToken" element=\{<GiftClaim \/>\} \/>/);
});

test("W20/W23: Hero lower recognition & ranking area is dormant; upper participation stays live", () => {
  const src = read("pages/HeroProgram.jsx");
  assert.match(src, /const HERO_RECOGNITION_RANKING_LIVE = false;/);
  assert.match(src, /\{HERO_RECOGNITION_RANKING_LIVE && <LeaderboardSection \/>\}/);
  assert.match(src, /\{HERO_RECOGNITION_RANKING_LIVE && <StatusSection status=\{data\.status\} \/>\}/);
  assert.match(src, /HERO_RECOGNITION_RANKING_LIVE\s*\n\s*\? <RecognitionSection[^\n]*\n\s*: <RecognitionDormantNotice \/>/);
  assert.match(src, /<WaysToParticipateSection/, "upper participation area untouched");
  assert.match(src, /Contribute Hero Hearts/);
  // The only caller of the leaderboard API is the gated section.
  assert.equal((src.match(/api\.getHeroLeaderboard\(\)/g) || []).length, 1);
  assert.doesNotMatch(src, /branded merch/i);
});

test("W23: For Business no longer promises Hero Status/recognition, uses Branded Goods", () => {
  const src = read("pages/ForBusiness.jsx");
  assert.doesNotMatch(src, /Greet-Me™ Hero™ recognition\./);
  assert.match(src, /Hero participation is live; Hero Status and recognition are not live yet/);
  assert.doesNotMatch(src, />\s*Merch/);
});

test("W16: share Hearts rewards are labeled dormant (Ways to Earn + Share panel)", () => {
  const cfg = read("components/hub/hubConfig.js");
  assert.match(cfg, /export const SHARE_HEARTS_REWARD_LIVE = false;/);
  assert.match(cfg, /DORMANT_SHARE_EARN_BEHAVIORS = Object\.freeze\(\['share_act', 'share_converted'\]\)/);
  const earn = read("components/hub/HubWaysToEarn.jsx");
  assert.match(earn, /'Not live yet'/);
  const panel = read("components/ShareTheLovePanel.jsx");
  assert.match(panel, /data-testid="share-reward-dormant"/);
  assert.match(panel, /Sharing doesn’t earn Hearts yet/);
});

test("W17: Hub labels Buy consistently, shows balance provenance, and never badges a non-redeemable reward AVAILABLE", () => {
  assert.match(read("components/hub/HubHeroHearts.jsx"), /Buy Hero Hearts/);
  assert.doesNotMatch(read("components/hub/HubHeroHearts.jsx"), /Open Hero Hearts/);
  assert.match(read("components/hub/HubBalanceCard.jsx"), /data-testid="hub-balance-provenance"/);
  const mk = read("components/hub/HubRedeemMarketplace.jsx");
  assert.match(mk, /'Not redeemable yet'/);
  assert.match(mk, /label=\{redemptionPaused \? 'Paused' : \(insufficient \? 'Need more Hearts' : undefined\)\}/);
  assert.match(mk, /data-testid="reward-shortfall-detail"/);
  assert.match(mk, /<details data-testid="reward-why-not"/);
});
