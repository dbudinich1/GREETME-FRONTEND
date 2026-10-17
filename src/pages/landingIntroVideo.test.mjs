// src/pages/landingIntroVideo.test.mjs
//
// INTRO VIDEO (Report 78). Founder decision, 2026-10-15: TAP TO PLAY, NO AUTOPLAY. The first Play starts
// from the beginning WITH SOUND (the opening welcome is heard); Pause/Resume and Replay remain.
//
// These checks pin that decision, plus the loading corrections that stay: no artificial wait, the
// fast-start file first with the untouched original as the fallback, and error handling for both a
// source that cannot be fetched and one that loads but cannot be played (Team 5 N2).
//
// Run (Node 20.x):  node --test src/pages/landingIntroVideo.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
// Comments removed (block comments, and whole lines that are // comments) so prose cannot satisfy a
// check. Line-end comments are left alone: splitting on "//" would cut the https:// addresses.
const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");
const CODE = strip(readFileSync(join(__dirname, "Landing.jsx"), "utf8"));
const HOOK = strip(readFileSync(join(__dirname, "..", "hooks", "useIntroVideo.js"), "utf8"));

test("no autoplay and no artificial wait: nothing plays until the visitor taps", () => {
  assert.doesNotMatch(CODE, /setTimeout\(/, "the old 2 s timer must not come back");
  assert.doesNotMatch(CODE, /\.play\(/, "the page itself never calls play(); only the tap handlers do");
  assert.doesNotMatch(CODE, /\bautoPlay\b/, "no autoplay attribute");
  assert.doesNotMatch(CODE, /<video[\s\S]*?\bmuted\b[\s\S]*?>/, "the video is not muted: the first Play has sound");
  assert.match(CODE, /onClick=\{intro\.tap\}/, "the video area is the tap target");
});

test("the first Play starts from the beginning with sound; then Pause/Resume; Replay from the start", () => {
  const playFromStart = HOOK.slice(HOOK.indexOf("const playFromStart"), HOOK.indexOf("const pause"));
  assert.match(playFromStart, /v\.muted = false;/);
  assert.match(playFromStart, /v\.currentTime = 0;/);
  assert.match(playFromStart, /v\.play\(\)/);
  assert.match(HOOK, /const replay = playFromStart;/);
  const tap = HOOK.slice(HOOK.indexOf("const tap"), HOOK.indexOf("const videoEvents"));
  assert.match(tap, /if \(!started \|\| ended\) \{ playFromStart\(\); return; \}/);
  assert.match(tap, /if \(v\.paused\) resume\(\); else pause\(\);/);
  assert.match(HOOK, /return \{[^}]*\bpause\b[^}]*\bresume\b[^}]*\breplay\b[^}]*\btap\b/, "the handlers are exposed for the layout's controls");
});

test("the fast-start file is tried first and the untouched original is the fallback", () => {
  const sources = [...CODE.matchAll(/<source src=\{(INTRO_VIDEO_[A-Z_]+)\}/g)].map((m) => m[1]);
  assert.deepEqual(sources, ["INTRO_VIDEO_FAST_START", "INTRO_VIDEO_ORIGINAL"]);
  assert.match(CODE, /INTRO_VIDEO_ORIGINAL = 'https:\/\/greetmedanny\.blob\.core\.windows\.net\/public\/greetme-demo\.mp4\.mp4'/,
    "the original keeps its exact address (rollback)");
  assert.match(CODE, /INTRO_VIDEO_FAST_START = 'https:\/\/greetmedanny\.blob\.core\.windows\.net\/public\/greetme-intro-v2\.mp4'/);
  assert.doesNotMatch(CODE, /<video[^>]*\ssrc=/, "the <video> element itself carries no src");
  assert.match(CODE, /href=\{INTRO_VIDEO_ORIGINAL\}/, "the 'Watch the demo' fallback link still opens the original");
});

test("both failure paths reach the failure card (Team 5 N2)", () => {
  assert.match(CODE, /<source src=\{INTRO_VIDEO_ORIGINAL\} type="video\/mp4" onError=\{intro\.lastSourceError\} \/>/,
    "the LAST source's fetch error means nothing works");
  assert.match(CODE, /\{\.\.\.intro\.videoEvents\}/, "the <video> receives the hook's media events");
  assert.match(HOOK, /onError: \(\) => setStatus\('failed'\)/, "a source that loads but cannot play errors on the <video>");
  assert.match(HOOK, /const lastSourceError = \(\) => setStatus\('failed'\);/);
});

test("preload is a single, stated setting", () => {
  assert.match(CODE, /INTRO_VIDEO_PRELOAD = '(auto|metadata|none)'/);
  assert.match(CODE, /preload=\{INTRO_VIDEO_PRELOAD\}/);
  assert.match(CODE, /playsInline/);
});
