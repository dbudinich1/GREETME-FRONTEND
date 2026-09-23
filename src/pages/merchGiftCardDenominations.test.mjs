// src/pages/merchGiftCardDenominations.test.mjs
//
// DIRECT DENOMINATION DISPLAY (Team C, 2026-09-23, Phase 3 of the catalog/Smart-Card redesign).
// STRUCTURAL proof against Merch.jsx's own source — matching the established pattern this repo
// already uses for exactly this file (see merchCheckpoint1.test.mjs, merchSmartCardNavigation.
// test.mjs): the eight-tile grid replaces the old single "View Smart Card options" button/panel.
//
// Run: node --test src/pages/merchGiftCardDenominations.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(path.join(DIR, "Merch.jsx"), "utf8");

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}
const CODE = stripComments(SRC);

// ── 15/16. Immediate display, no intermediate step ──────────────────────────────────────────

test("selecting Gift Cards immediately renders a grid mapped over the server's own tile list — no separate picker step", () => {
  assert.match(CODE, /giftCardTiles\.map\(/, "the available branch must render one card per server-reported tile");
});

test("the OLD 'View Smart Card options' intermediate button no longer exists", () => {
  assert.doesNotMatch(CODE, /View Smart Card options/, "the intermediate button text must be fully removed");
});

test("the page no longer tracks a plain boolean gift-card-available flag — it tracks the real tile list", () => {
  assert.doesNotMatch(CODE, /giftCardAvailable/, "the boolean flag this replaced must not remain anywhere in the file");
});

// ── 17. Every denomination uses the approved artwork, used as-is ────────────────────────────

test("the approved production artwork asset exists on disk and is imported (vendor-neutral import name)", () => {
  const assetPath = path.join(DIR, "..", "assets", "gifts", "smart-egift-card.png");
  assert.ok(existsSync(assetPath), "the approved artwork file must exist at src/assets/gifts/smart-egift-card.png");
  assert.match(SRC, /import\s+\w+\s+from\s+['"]\.\.\/assets\/gifts\/smart-egift-card\.png['"]/, "Merch.jsx must import the approved artwork file directly");
});

test("every denomination tile renders an <img> using the imported artwork, never an emoji or a different image", () => {
  const start = CODE.indexOf("giftCardTiles.map(");
  const end = CODE.indexOf('data-testid="gift-cards-coming-later"', start);
  const block = CODE.slice(start, end);
  assert.match(block, /<img[^>]*src=\{smartEGiftCardArt\}/, "each tile must render the imported artwork");
  assert.doesNotMatch(block, /&#127873;|🎁/, "no emoji substitute may appear in the live denomination grid");
});

test("the artwork's own natural aspect ratio is preserved — no forced/cropping dimensions on the <img>", () => {
  const start = CODE.indexOf("giftCardTiles.map(");
  const end = CODE.indexOf('data-testid="gift-cards-coming-later"', start);
  const block = CODE.slice(start, end);
  const imgTagMatch = /<img[^>]*src=\{smartEGiftCardArt\}[^>]*\/>/.exec(block);
  assert.ok(imgTagMatch, "the artwork <img> tag must exist in the tile block");
  assert.match(imgTagMatch[0], /width:\s*['"]100%['"]/, "width must be relative, not a fixed pixel crop");
  assert.match(imgTagMatch[0], /height:\s*['"]auto['"]/, "height must be 'auto' so the source aspect ratio is preserved, never stretched");
  assert.doesNotMatch(imgTagMatch[0], /objectFit:\s*['"]cover['"]/, "objectFit:cover would crop the artwork — forbidden");
});

test("no vendor name appears in Merch.jsx's executable code (this page must stay vendor-neutral)", () => {
  assert.doesNotMatch(CODE, /prezzee/i, "no Prezzee identifier may appear in executable page code");
});

// ── 18. Selecting a denomination preselects the correct amount ──────────────────────────────

test("each tile's click handler navigates to the Smart Card page passing this exact tile's id as router state", () => {
  const start = CODE.indexOf("giftCardTiles.map(");
  const end = CODE.indexOf('data-testid="gift-cards-coming-later"', start);
  const block = CODE.slice(start, end);
  assert.match(
    block,
    /navigate\(['"]\/dashboard\/gifts\/smart-card['"],\s*\{\s*state:\s*\{\s*presetTileId:\s*tile\.id\s*\}\s*\}\)/,
    "each tile's onClick must pass ITS OWN tile.id as presetTileId — never a hand-typed literal, never a different tile's id",
  );
});

test("the amount is displayed clearly on each tile without obscuring the artwork", () => {
  const start = CODE.indexOf("giftCardTiles.map(");
  const end = CODE.indexOf('data-testid="gift-cards-coming-later"', start);
  const block = CODE.slice(start, end);
  assert.match(block, /tile\.displayAmount/, "the server's own display amount must be shown on the tile");
});
