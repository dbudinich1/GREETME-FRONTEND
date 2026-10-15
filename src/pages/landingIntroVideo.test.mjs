// src/pages/landingIntroVideo.test.mjs
//
// INTRO VIDEO LOADING (Report 78). The landing page's intro video used to wait 2 s before asking to
// play, with preload="none", and pointed only at a 114 MB file whose playback index sits at its end.
// Behind storage that ignores open-ended ranges, that meant downloading the whole file first: about
// 23 s to the first frame on a 50 Mbps desktop, and not within 45 s on emulated phones.
//
// These checks pin the corrected loading so a later layout change (Team 3 rebases on this) cannot
// quietly bring the wait back or drop the fallback to the original file.
//
// Run (Node 20.x):  node --test src/pages/landingIntroVideo.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, "Landing.jsx"), "utf8");
// Comments removed (block comments, and whole lines that are // comments) so prose cannot satisfy a
// check. Line-end comments are left alone: splitting on "//" would cut the https:// addresses.
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, " ").split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n");

test("no artificial wait before the intro video is asked to play", () => {
  assert.doesNotMatch(CODE, /setTimeout\(/, "the 2 s autoplay timer must not come back");
  assert.match(CODE, /demoRef\.current\.muted = true;\s*demoRef\.current\.play\(\)\.catch\(\(\) => \{\}\);/,
    "muted play() is attempted as soon as the page mounts");
});

test("the fast-start file is tried first and the untouched original is the fallback", () => {
  const sources = [...CODE.matchAll(/<source src=\{(INTRO_VIDEO_[A-Z_]+)\}/g)].map((m) => m[1]);
  assert.deepEqual(sources, ["INTRO_VIDEO_FAST_START", "INTRO_VIDEO_ORIGINAL"]);
  assert.match(CODE, /INTRO_VIDEO_ORIGINAL = 'https:\/\/greetmedanny\.blob\.core\.windows\.net\/public\/greetme-demo\.mp4\.mp4'/,
    "the original keeps its exact address (rollback)");
  assert.match(CODE, /INTRO_VIDEO_FAST_START = 'https:\/\/greetmedanny\.blob\.core\.windows\.net\/public\/greetme-intro-v2\.mp4'/);
  // The load-failure card is driven by the LAST source, so it appears only when both fail.
  assert.match(CODE, /<source src=\{INTRO_VIDEO_ORIGINAL\} type="video\/mp4" onError=\{\(\) => setVideoStatus\('failed'\)\} \/>/);
  assert.doesNotMatch(CODE, /<video[^>]*\ssrc=/, "the <video> element itself carries no src");
  assert.match(CODE, /href=\{INTRO_VIDEO_ORIGINAL\}/, "the 'Watch the demo' fallback link still opens the original");
});

test("the video stays muted, inline and preloaded; a tap gives sound and starts a refused autoplay", () => {
  assert.match(CODE, /preload=\{INTRO_VIDEO_PRELOAD\}/);
  assert.match(CODE, /INTRO_VIDEO_PRELOAD = '(auto|metadata)'/);
  assert.match(CODE, /<video[\s\S]*?\bmuted\b[\s\S]*?\bplaysInline\b/);
  assert.match(CODE, /if \(v\.paused\) v\.play\(\)\.catch\(\(\) => \{\}\);/);
});
