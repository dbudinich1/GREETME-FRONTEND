// src/components/experience/cardDriver.js
//
// Drives the UNCHANGED card player (GreetingCardProto/GreetingCard.jsx) from outside, using only what it already
// listens to and renders. No player file is edited or imported here:
//   - which screen is showing: the screen's own root class (envelope / cover / interior / featured / finale);
//     null while a page turn or the envelope exit is animating;
//   - next / back: the player's window keydown ArrowRight / ArrowLeft (GreetingCard.jsx keyboard navigation);
//   - envelope spin and turn-over: the envelope's own drag handlers (mousedown on .gc-envelope, mousemove on its
//     wrapper; 0.5 degree per pixel), fed synthetic, untrusted mouse events;
//   - open: a click on the wax seal (its existing button);
//   - the featured video: a click on its own frame (VideoPlayer's Play), started muted so the browser always
//     allows it, then unmuted when sound is on and the browser permits;
//   - the sample QR: a click on its anchor, whose existing onClick calls the sample's onCreditTap.
// Every event dispatched here runs inside asDriver(), so the orchestrator can tell its own actions from the
// visitor's (isDriving() is true only while one of them is being dispatched; dispatch is synchronous).

let driving = 0;
export const isDriving = () => driving > 0;
export function asDriver(fn) { driving += 1; try { return fn(); } finally { driving -= 1; } }

const SCREEN_CLASSES = [
  ['envelope', '.gc-envelope-wrapper'],
  ['cover', '.gc-cover-wrapper'],
  ['interior', '.gc-interior-spread'],
  ['featured', '.gc-featured-spread'],
  ['finale', '.gc-finale-spread'],
];
export const CARD_SCREEN_ORDER = SCREEN_CLASSES.map(([s]) => s);

export function readCardScreen(root) {
  if (!root) return null;
  if (root.querySelector('.gc-screen-stage, .gc-envelope-exit')) return null; // mid-animation
  for (const [screen, sel] of SCREEN_CLASSES) if (root.querySelector(sel)) return screen;
  return null;
}

export function pressCardKey(win, key) {
  asDriver(() => win.dispatchEvent(new win.KeyboardEvent('keydown', { key, bubbles: true })));
}

// One screen towards `target` (the player moves one screen per key). Returns what it did.
export function stepCardToward(root, win, target) {
  const cur = readCardScreen(root);
  if (!cur || cur === target) return 'none';
  if (target === 'envelope') return 'remount'; // the player never turns back to the envelope by itself
  if (cur === 'envelope') { clickSeal(root); return 'seal'; }
  const dir = CARD_SCREEN_ORDER.indexOf(target) > CARD_SCREEN_ORDER.indexOf(cur) ? 'ArrowRight' : 'ArrowLeft';
  pressCardKey(win, dir);
  return dir;
}

export function clickSeal(root) {
  const seal = root?.querySelector('.gc-wax-seal');
  if (seal) asDriver(() => seal.click());
  return !!seal;
}

// Spin the envelope a full turn and on round to its back (540 degrees = 1080 px of drag) over `durationMs`;
// with reduced motion, one move straight to the back. Returns cancel().
export function spinEnvelope(root, win, { durationMs = 2600, reducedMotion = false, onDone = () => {} } = {}) {
  const env = root?.querySelector('.gc-envelope');
  const wrap = root?.querySelector('.gc-envelope-wrapper');
  if (!env || !wrap) { onDone(false); return () => {}; }
  const mouse = (el, type, x) => asDriver(() => el.dispatchEvent(new win.MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: 0 })));
  const totalPx = reducedMotion ? 360 : 1080;
  const frames = reducedMotion ? 1 : Math.max(1, Math.round(durationMs / 33));
  let i = 0; let timer = null; let cancelled = false;
  const finish = (ok) => { if (!cancelled) { cancelled = true; try { mouse(wrap, 'mouseup', 0); } catch { /* gone */ } onDone(ok); } };
  mouse(env, 'mousedown', 0);
  const tick = () => {
    if (cancelled) return;
    if (!wrap.isConnected) { finish(false); return; }
    i += 1;
    // ease in-out so the turn starts and lands gently
    const t = i / frames; const eased = t < 0.5 ? 2 * t * t : 1 - ((-2 * t + 2) ** 2) / 2;
    mouse(wrap, 'mousemove', Math.round(totalPx * eased));
    if (i >= frames) finish(true); else timer = win.setTimeout(tick, Math.round(durationMs / frames));
  };
  timer = win.setTimeout(tick, 40); // let the player register the drag first
  return () => { if (timer) win.clearTimeout(timer); finish(false); };
}

export function findFeaturedVideo(root) { return root?.querySelector('video.gc-video') || null; }
export function videoUnavailable(root) { return !!root?.querySelector('.gc-featured-spread .gc-video-placeholder'); }

// Start the featured video through its own Play (the frame click). Muted first, so the browser never refuses it.
export function startFeaturedVideo(root) {
  const v = findFeaturedVideo(root);
  const frame = root?.querySelector('.gc-featured-spread .gc-video-frame');
  if (!v || !frame || !v.paused || v.ended || v.currentTime > 0) return false;
  v.muted = true;
  asDriver(() => frame.click());
  return true;
}

// Sound on/off for everything the player plays. Media elements in the card are muted directly; the photo album's
// music is not in the page, so its own mute button is pressed when it disagrees (aria-label 'Mute' = sound on).
// `allowVideoSound` is false while the browser has refused sound for the video (it then keeps playing muted).
export function applyCardSound(root, on, { allowVideoSound = true } = {}) {
  if (!root) return;
  root.querySelectorAll('video, audio').forEach((m) => {
    const want = !on || (m.matches('video.gc-video') && !allowVideoSound);
    if (m.muted !== want) m.muted = want;
  });
  const albumBtn = root.querySelector('.gc-album-mute-btn');
  if (albumBtn) {
    const albumOn = albumBtn.getAttribute('aria-label') === 'Mute';
    if (albumOn !== on) asDriver(() => albumBtn.click());
  }
}

// Try to give the playing video its sound. Resolves 'on' when it keeps playing unmuted; 'blocked' when the browser
// paused it for unmuting without a recent tap (it is then muted again and resumed, so the visitor still sees it).
export function tryVideoSound(root, win, { settleMs = 300 } = {}) {
  const v = findFeaturedVideo(root);
  if (!v) return Promise.resolve('none');
  v.muted = false;
  return new Promise((resolve) => {
    win.setTimeout(() => {
      if (!v.isConnected) { resolve('none'); return; }
      if (v.paused && !v.ended) {
        v.muted = true;
        Promise.resolve().then(() => v.play()).catch(() => {});
        resolve('blocked');
      } else resolve('on');
    }, settleMs);
  });
}

export function clickSampleQr(root) {
  const a = root?.querySelector('.gc-finale-spread a[href*="sample=credit"]');
  if (a) asDriver(() => a.click());
  return !!a;
}
