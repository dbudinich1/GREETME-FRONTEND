// src/components/experience/experienceFlow.test.mjs
//
// The Greet-Me Experience step model and timing controller (pure; a fake clock and fake timers are injected):
// step order, static dwell, media-end advance (with its safety ceiling), pause on interaction and resume with the
// remaining time, manual next/back (including the Featured Spread's two halves), replay, finish, following the
// card when the visitor moves it, and the CTA label.
//
// Run (Node 20.x):  node --test src/components/experience/experienceFlow.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSteps, createExperienceGuide, readingDwellMs, STEP_IDS, EXPERIENCE_CHROME, EXPERIENCE_TIMING } from "./experienceFlow.js";

// Fake clock: setTimer/clearTimer/now driven by tick(ms).
function fakeClock() {
  let t = 0; let id = 0; const timers = new Map();
  return {
    now: () => t,
    setTimer: (fn, ms) => { id += 1; timers.set(id, { fn, at: t + ms }); return id; },
    clearTimer: (i) => { timers.delete(i); },
    pending: () => timers.size,
    tick(ms) {
      const end = t + ms;
      for (;;) {
        let next = null;
        for (const [i, tm] of timers) if (tm.at <= end && (!next || tm.at < next[1].at)) next = [i, tm];
        if (!next) break;
        timers.delete(next[0]); t = next[1].at; next[1].fn();
      }
      t = end;
    },
  };
}

const INTRO = "word ".repeat(60); // 60 words -> 18 s
function setup() {
  const clock = fakeClock();
  const log = []; let finished = 0;
  const steps = buildSteps({ introText: INTRO });
  const g = createExperienceGuide({ steps, setTimer: clock.setTimer, clearTimer: clock.clearTimer, now: clock.now,
    onStep: (to, from, how) => log.push(`${from ? from.id : "-"}>${to.id}:${how}`), onFinish: () => { finished += 1; } });
  return { clock, g, log, steps, id: () => g.state().step.id, finished: () => finished };
}

test("step order: invitation, envelope, spin/turn, cover, Intro, video, photos+music, finale, QR claim, return", () => {
  assert.deepEqual(STEP_IDS, ["invite", "envelope", "reverse", "cover", "intro", "video", "photos", "finale", "claim", "return"]);
  const steps = buildSteps();
  assert.deepEqual(steps.map((s) => s.screen), [null, "envelope", "envelope", "cover", "interior", "featured", "featured", "finale", null, null]);
  assert.equal(steps.find((s) => s.id === "video").media, true, "the video step is media-driven");
  for (const s of steps) if (!s.media) assert.ok(s.dwellMs >= 4500, `${s.id}: generous dwell (${s.dwellMs} ms)`);
});

test("CTA label is 'The Greet-Me Experience'", () => {
  assert.equal(EXPERIENCE_CHROME.ctaLabel, "The Greet-Me Experience");
});

test("reading dwell for the Intro: 300 ms a word, between 12 s and 30 s", () => {
  assert.equal(readingDwellMs(""), 12000);
  assert.equal(readingDwellMs(INTRO), 18000);
  assert.equal(readingDwellMs("w ".repeat(500)), 30000);
});

test("dwell: each static step advances only after its full dwell (fake timers)", () => {
  const { clock, g, id, steps } = setup();
  g.start();
  const dwell = (sid) => steps.find((s) => s.id === sid).dwellMs;
  for (const [sid, nextId] of [["invite", "envelope"], ["envelope", "reverse"], ["reverse", "cover"], ["cover", "intro"], ["intro", "video"]]) {
    assert.equal(id(), sid);
    clock.tick(dwell(sid) - 1);
    assert.equal(id(), sid, `${sid}: still showing 1 ms before its dwell ends`);
    clock.tick(1);
    assert.equal(id(), nextId, `${sid} -> ${nextId} after ${dwell(sid)} ms`);
  }
  assert.equal(dwell("intro"), 18000);
});

test("media: the video step waits for the video to end, then photos+music get their dwell; safety ceiling", () => {
  const { clock, g, id, log } = setup();
  g.start(); g.goTo("video");
  clock.tick(60000);
  assert.equal(id(), "video", "no dwell advance while the video plays");
  g.mediaEnd();
  assert.equal(id(), "photos", "advances when the video ends");
  assert.match(log.at(-1), /video>photos:media/);
  clock.tick(29999); assert.equal(id(), "photos");
  clock.tick(1); assert.equal(id(), "finale");

  // The orchestrator replaces the ceiling with the video's real length (+ tail) once it is known.
  const b = setup(); b.g.start(); b.g.goTo("video");
  b.g.setStepTimer(21600 + EXPERIENCE_TIMING.videoTailMs);
  b.clock.tick(21600 + EXPERIENCE_TIMING.videoTailMs - 1); assert.equal(b.id(), "video");
  b.clock.tick(1);
  assert.equal(b.id(), "finale", "the ceiling advances if the end is never reported (past the photos, which the card keeps locked until the video ends)");

  // Default ceiling when nothing else is known.
  const c = setup(); c.g.start(); c.g.goTo("video");
  c.clock.tick(179999); assert.equal(c.id(), "video");
  c.clock.tick(1); assert.equal(c.id(), "finale");
});

test("pause on interaction freezes progression; Resume continues with the remaining time", () => {
  const { clock, g, id } = setup();
  g.start();
  clock.tick(5000);
  g.interact();
  assert.equal(g.state().paused, true, "interaction pauses");
  assert.equal(g.state().remainingMs, 3000);
  clock.tick(600000);
  assert.equal(id(), "invite", "nothing advances while paused");
  g.interact(); assert.equal(g.state().paused, true, "a second interaction keeps it paused");
  g.resume();
  assert.equal(g.state().paused, false);
  clock.tick(2999); assert.equal(id(), "invite");
  clock.tick(1); assert.equal(id(), "envelope", "resumes with exactly the remaining 3 s");
  // Manual navigation while paused stays paused (the visitor is driving).
  clock.tick(EXPERIENCE_TIMING.autoNextGuardMs);
  g.pause(); g.next();
  assert.equal(id(), "reverse"); assert.equal(g.state().paused, true);
  clock.tick(60000); assert.equal(id(), "reverse");
});

test("media end while paused: nothing moves until Resume, then the photos (with their full dwell)", () => {
  const { clock, g, id, log } = setup();
  g.start(); g.goTo("video");
  g.pause();
  g.mediaEnd();
  assert.equal(id(), "video", "paused: the step does not change when the video ends");
  assert.equal(g.state().mediaEnded, true);
  clock.tick(600000); assert.equal(id(), "video");
  g.resume();
  assert.equal(id(), "photos", "Resume moves on to the photos");
  assert.match(log.at(-1), /video>photos:resume/, "on the visitor's own Resume");
  assert.equal(g.state().paused, false);
  clock.tick(29999); assert.equal(id(), "photos");
  clock.tick(1); assert.equal(id(), "finale");
  // A paused media end does not linger: leaving the video step manually drops it.
  const b = setup(); b.g.start(); b.g.goTo("video"); b.g.pause(); b.g.mediaEnd(); b.g.back(); b.g.resume();
  assert.equal(b.id(), "intro");
});

test("Next just after an AUTO-advance is absorbed (the visitor meant the step that just appeared); later presses work", () => {
  const { clock, g, id } = setup();
  g.start();
  clock.tick(8000);
  assert.equal(id(), "envelope", "auto-advanced");
  clock.tick(400);
  assert.equal(g.next(), false, "a press 400 ms after the auto-advance is absorbed");
  assert.equal(id(), "envelope", "the step that just appeared stays");
  clock.tick(EXPERIENCE_TIMING.autoNextGuardMs - 400 - 1);
  assert.equal(g.next(), false, "still inside the guard at 699 ms");
  clock.tick(1);
  assert.equal(g.next(), true, "at 700 ms a press is a deliberate Next");
  assert.equal(id(), "reverse");
  assert.equal(g.next(), true, "manual presses are never guarded against each other");
  assert.equal(id(), "cover");
  assert.equal(EXPERIENCE_TIMING.autoNextGuardMs, 700);
  // The claim step: an auto-advance from the finale followed by a stray press keeps the $5 reveal on screen.
  const c = setup(); c.g.start(); c.g.goTo("finale");
  c.clock.tick(10000); assert.equal(c.id(), "claim");
  c.clock.tick(200); c.g.next(); assert.equal(c.id(), "claim");
});

test("manual next/back at all times, including the Featured Spread halves", () => {
  const { clock, g, id } = setup();
  g.start();
  g.back(); assert.equal(id(), "invite", "no step before the first");
  const seen = [id()];
  for (let i = 0; i < 4; i++) { g.next(); seen.push(id()); }
  assert.deepEqual(seen, ["invite", "envelope", "reverse", "cover", "intro"]);
  g.next(); assert.equal(id(), "video");
  g.next(); assert.equal(id(), "finale", "Next from the video goes past the (still locked) photos");
  g.back(); assert.equal(id(), "video", "Back from the finale: the video half while it has not ended");
  g.mediaEnd(); assert.equal(id(), "photos");
  clock.tick(EXPERIENCE_TIMING.autoNextGuardMs); // past the guard that follows the video's end
  g.next(); g.back(); assert.equal(id(), "photos", "after the video ended, Back from the finale returns to the photos");
  g.back(); assert.equal(id(), "intro", "Back from the photos goes to the Intro");
  g.goTo("claim"); g.back(); assert.equal(id(), "finale");
  g.goTo("return"); g.back(); assert.equal(id(), "claim");
});

test("Next just after the video's END (a media advance) is absorbed too; after a paused end, Resume is the visitor's own press", () => {
  const { clock, g, id } = setup();
  g.start(); g.goTo("video");
  clock.tick(5000);
  g.mediaEnd();
  assert.equal(id(), "photos");
  assert.equal(g.next(), false, "0 ms after the video's end: absorbed");
  clock.tick(400); assert.equal(g.next(), false, "400 ms: absorbed");
  assert.equal(id(), "photos", "photos and music are not skipped");
  clock.tick(300); assert.equal(g.next(), true, "700 ms: a deliberate Next");
  assert.equal(id(), "finale");
  const b = setup(); b.g.start(); b.g.goTo("video"); b.clock.tick(5000);
  b.g.pause(); b.g.mediaEnd(); b.g.resume();
  assert.equal(b.id(), "photos");
  assert.equal(b.g.next(), true, "after the visitor's own Resume, Next is not guarded");
});

test("finish: the last step's dwell, or Next on it, ends the experience once", () => {
  const a = setup(); a.g.start(); a.g.goTo("return");
  a.clock.tick(6999); assert.equal(a.finished(), 0);
  a.clock.tick(1); assert.equal(a.finished(), 1);
  a.clock.tick(60000); assert.equal(a.finished(), 1);
  const b = setup(); b.g.start(); b.g.goTo("return"); b.g.next();
  assert.equal(b.finished(), 1); b.g.next(); assert.equal(b.finished(), 1);
});

test("replay: back to the first step, running, video state cleared", () => {
  const { clock, g, id, log } = setup();
  g.start(); g.goTo("video"); g.mediaEnd(); g.pause();
  g.replay();
  assert.equal(id(), "invite");
  assert.equal(g.state().paused, false);
  assert.equal(g.state().mediaEnded, false);
  assert.match(log.at(-1), /photos>invite:replay/);
  clock.tick(8000); assert.equal(id(), "envelope", "and it runs again");
});

test("following the card: a visitor's own tap/swipe moves the guide; the guide's own screens ignore the card", () => {
  const { g, id, log } = setup();
  g.start(); g.goTo("envelope");
  g.syncScreen("envelope"); assert.equal(id(), "envelope", "same screen: no change");
  g.syncScreen("cover"); assert.equal(id(), "cover"); assert.match(log.at(-1), /envelope>cover:card/);
  g.syncScreen("featured"); assert.equal(id(), "video");
  g.mediaEnd(); g.syncScreen("finale"); g.syncScreen("featured");
  assert.equal(id(), "photos", "back on the Featured Spread after its video ended: the photos half");
  g.syncScreen(null); assert.equal(id(), "photos", "mid-animation reports are ignored");
  g.goTo("claim"); g.syncScreen("finale");
  assert.equal(id(), "claim", "the claim screen covers the card; its finale underneath does not pull the guide back");
  g.goTo("invite"); g.syncScreen("envelope"); assert.equal(id(), "invite");
});

test("only one timer runs at a time, and destroy clears it", () => {
  const { clock, g } = setup();
  g.start(); g.next(); g.next(); g.back();
  assert.equal(clock.pending(), 1);
  g.destroy();
  assert.equal(clock.pending(), 0);
});
