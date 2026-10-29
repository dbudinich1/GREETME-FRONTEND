// src/components/experience/experienceFlow.js
//
// THE GREET-ME EXPERIENCE (landing entry CTA): a guided tour of the EXISTING sample Greet-Me on the EXISTING,
// unchanged card player. This file is the pure step model and timing controller (no React, no DOM) so the order,
// dwell, media-end advance, pause/resume, manual navigation and replay are unit-testable with fake timers.
// The orchestrator (GreetMeExperience.jsx) performs each step's card action through the player's existing
// events (seal click, arrow keys, the video frame's own Play, the sample QR's onCreditTap) and reports back which
// card screen is showing; it never changes the player.
//
// Demo only: the claim step is the existing inert sample reveal (SampleCreditReveal). Nothing is claimed, paid,
// sent or ordered.

export const EXPERIENCE_CHROME = {
  ctaLabel: 'The Greet-Me Experience',
  title: 'The Greet-Me Experience',
  pausedNote: 'Paused',
};

// Timings that are not a step's own dwell (all in ms).
export const EXPERIENCE_TIMING = {
  spinMs: 2600,          // the envelope's spin and turn-over animation (inside the 6 s 'reverse' step)
  videoStartDelayMs: 1200, // the Featured Spread fades its video in at 700 ms; start it once visible
  videoTailMs: 8000,     // after the video's real length, before the safety ceiling advances anyway
  noVideoDwellMs: 12000, // when the video cannot be shown, the Featured Spread still gets this long
  claimTapMs: 4000,      // on the claim step, the inert claim button is pressed for the visitor after this
  cardSyncGraceMs: 1500, // after the guide moves the card, ignore stale screen reports for this long
};

// Reading time for the Intro (written intro + poem): 300 ms a word, never under 12 s or over 30 s.
export function readingDwellMs(text, { perWordMs = 300, minMs = 12000, maxMs = 30000 } = {}) {
  const words = String(text || '').trim().split(/\s+/).filter(Boolean).length;
  return Math.max(minMs, Math.min(maxMs, words * perWordMs));
}

// `screen` is the card player's screen for card steps (null = the guide's own screen).
// `dwellMs` is a static step's viewing time; `media: true` steps advance when their media ends, with `safetyMs`
// only as a ceiling in case the media never reports an end.
export function buildSteps({ introText = '' } = {}) {
  return [
    { id: 'invite', label: 'Your invitation', screen: null, dwellMs: 8000 },
    { id: 'envelope', label: 'The envelope', screen: 'envelope', dwellMs: 4500 },
    { id: 'reverse', label: 'Spin and turn it over', screen: 'envelope', dwellMs: 6000 },
    { id: 'cover', label: 'The card opens', screen: 'cover', dwellMs: 5000 },
    { id: 'intro', label: 'Intro', screen: 'interior', dwellMs: readingDwellMs(introText) },
    { id: 'video', label: 'Featured Spread: video', screen: 'featured', media: true, safetyMs: 180000 },
    { id: 'photos', label: 'Featured Spread: photos and music', screen: 'featured', dwellMs: 30000 },
    { id: 'finale', label: 'Finale', screen: 'finale', dwellMs: 10000 },
    { id: 'claim', label: 'Scan the QR (demo)', screen: null, dwellMs: 10000 },
    { id: 'return', label: 'Back to Greet-Me', screen: null, dwellMs: 7000 },
  ];
}

export const STEP_IDS = buildSteps().map((s) => s.id);

// createExperienceGuide: one running timer at most. onChange(state) after every change; onStep(to, from, how)
// when the step changes (how: 'auto' | 'manual' | 'card' | 'media' | 'replay'); onFinish() when the last step's
// dwell ends or Next is pressed on it.
export function createExperienceGuide({ steps, onChange = () => {}, onStep = () => {}, onFinish = () => {},
  setTimer = setTimeout, clearTimer = clearTimeout, now = () => Date.now() } = {}) {
  let index = 0;
  let paused = false;
  let mediaEnded = false;
  let timer = null;
  let timerMs = null;      // full length of the current step's timer
  let remaining = null;    // ms left on it
  let armedAt = 0;
  let done = false;

  const byId = (id) => steps.findIndex((s) => s.id === id);
  const state = () => ({ index, step: steps[index], paused, mediaEnded, remainingMs: remaining, timerMs, total: steps.length, finished: done });
  const emit = () => onChange(state());

  const stop = () => { if (timer) { clearTimer(timer); timer = null; } };
  const run = () => {
    stop();
    if (paused || done || remaining == null) return;
    armedAt = now();
    timer = setTimer(() => { timer = null; remaining = 0; advance('auto'); }, remaining);
  };
  const armFor = (i) => {
    const s = steps[i];
    timerMs = s.media ? (s.safetyMs ?? null) : (s.dwellMs ?? null);
    remaining = timerMs;
    run();
  };

  function enter(i, how) {
    const from = steps[index];
    index = i;
    armFor(i);
    onStep(steps[i], from, how);
    emit();
  }

  // Where Next goes: from the video, past the photos (they unlock only once the video has ended).
  function nextIndex() {
    if (steps[index].id === 'video') return byId('finale');
    return index + 1;
  }
  // Where Back goes: the previous step, skipping the video's own photos half, and from the finale to the
  // Featured Spread half that is current (photos once the video has ended).
  function prevIndex() {
    const id = steps[index].id;
    if (id === 'photos') return byId('intro');
    if (id === 'finale') return byId(mediaEnded ? 'photos' : 'video');
    return index - 1;
  }

  function advance(how) {
    if (done) return;
    if (index >= steps.length - 1) { stop(); done = true; emit(); onFinish(how); return; }
    enter(nextIndex(), how);
  }

  return {
    state,
    start() { done = false; enter(0, 'auto'); },
    next() { advance('manual'); },
    back() { if (index > 0) enter(prevIndex(), 'manual'); },
    goTo(id, how = 'manual') { const i = byId(id); if (i >= 0 && i !== index) enter(i, how); },
    // The card moved by itself (the visitor tapped, swiped or used the arrow keys): follow it.
    // Only on card steps: on the guide's own screens (invitation, claim, end) the card is hidden or absent.
    syncScreen(screen) {
      if (done || !screen || !steps[index].screen || steps[index].screen === screen) return;
      let i = steps.findIndex((s) => s.screen === screen);
      if (screen === 'featured' && mediaEnded) i = byId('photos');
      if (i >= 0) enter(i, 'card');
    },
    // The featured video finished: move from the video to the photos and music.
    mediaEnd() {
      mediaEnded = true;
      if (steps[index].id === 'video') enter(byId('photos'), 'media');
      else emit();
    },
    // Replace the current step's timer (e.g. the real video length once known, or a dwell when there is no video).
    setStepTimer(ms) { timerMs = ms; remaining = ms; run(); emit(); },
    pause() {
      if (paused) return;
      if (timer) { remaining = Math.max(0, remaining - (now() - armedAt)); stop(); }
      paused = true; emit();
    },
    resume() { if (!paused) return; paused = false; run(); emit(); },
    interact() { this.pause(); },
    replay() { stop(); paused = false; mediaEnded = false; done = false; enter(0, 'replay'); },
    destroy() { stop(); done = true; },
  };
}
