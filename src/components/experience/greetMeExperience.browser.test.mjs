// src/components/experience/greetMeExperience.browser.test.mjs
//
// THE GREET-ME EXPERIENCE, MOUNTED with the real Landing, the real orchestrator and the real, unchanged card
// player (GreetingCardProto/*), in jsdom:
//   - the landing CTA reads "The Greet-Me Experience" and opens the guide at the invitation;
//   - the guide drives the card through its own controls in flow order (envelope, turn-over, open, Intro,
//     Featured Spread, finale, sample QR -> claim, return) and a video 'ended' moves it to the photos;
//   - the visitor's pointer / touch / key interaction pauses progression (visible Paused + Resume); the guide's
//     own controls and Tab do not;
//   - manual Back / Next, Replay, Sound on/off, Exit (button and Escape);
//   - back on the landing the intro video is started from 0:00 with sound; when play() is refused the Play
//     cover stays with a prompt and focus goes to Play;
//   - no fetch / XHR / beacon at all (so none to claim, payment or send endpoints), no /claim-credit/ link,
//     no greetme_ storage.
// jsdom has no media pipeline: play()/pause()/paused/muted/currentTime are stubbed on the element prototype.
// prefers-reduced-motion is reported as 'reduce' so page turns take the player's 150 ms path.
//
// Run (Node 20.x):  node --test src/components/experience/greetMeExperience.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGES = join(__dirname, "..", "..", "pages");
const ENTRY = join(PAGES, `.__gx.${process.pid}.entry.jsx`);
const OUT = join(PAGES, `.__gx.${process.pid}.bundle.mjs`);
const QR_STUB = join(PAGES, `.__gx.${process.pid}.qr.js`);
const SAMPLE_URL = "https://greetmedanny.blob.core.windows.net/public/greetme-sample-talking-photo-v1.mp4";

let React, createRoot, act, window, mod, root, host;
let net = [];          // every fetch / XHR / beacon attempt
let plays = [];        // play() calls: { el, t, muted }
let rejectIntro = false;

before(async () => {
  writeFileSync(ENTRY,
    'import { MemoryRouter, useLocation } from "react-router-dom";\n'
    + 'import Landing from "./Landing.jsx";\n'
    + 'function Loc() { const l = useLocation(); return (<span data-testid="router-path">{l.pathname}</span>); }\n'
    + 'export function App() { return (<MemoryRouter><Loc /><Landing /></MemoryRouter>); }\n');
  writeFileSync(QR_STUB, "export default { toDataURL: () => Promise.resolve('data:image/png;base64,AAAA') };\n");
  await esbuild.build({
    entryPoints: [ENTRY], outfile: OUT, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react", logLevel: "silent",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react-router-dom"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".jpeg": "dataurl", ".png": "dataurl", ".svg": "dataurl", ".wav": "dataurl", ".mp3": "dataurl" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "stubs", setup(b) {
      b.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: "auth", namespace: "stub" }));
      b.onLoad({ filter: /^auth$/, namespace: "stub" }, () => ({ contents: "export const useAuth = () => ({ isAuthenticated: false, loading: false });", loader: "js" }));
      b.onResolve({ filter: /^qrcode$/ }, () => ({ path: QR_STUB }));
    } }],
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/#/" });
  window = dom.window;
  global.window = window; global.document = window.document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true, writable: true });
  Object.assign(global, { HTMLElement: window.HTMLElement, Node: window.Node, getComputedStyle: window.getComputedStyle,
    MutationObserver: window.MutationObserver, localStorage: window.localStorage, sessionStorage: window.sessionStorage });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.__rm = true; // prefers-reduced-motion: reduce, unless a test turns it off
  window.matchMedia = (q) => ({ matches: window.__rm && /prefers-reduced-motion: reduce/.test(q), media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  global.ResizeObserver = window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.requestAnimationFrame = window.requestAnimationFrame;
  global.cancelAnimationFrame = window.cancelAnimationFrame;
  window.document.fonts = { ready: Promise.resolve() };
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  global.fetch = window.fetch = (u) => { net.push(`fetch ${u}`); return Promise.reject(new Error("no network in tests")); };
  const xo = window.XMLHttpRequest.prototype.open;
  window.XMLHttpRequest.prototype.open = function open(m, u, ...r) { net.push(`xhr ${m} ${u}`); return xo.call(this, m, u, ...r); };
  window.navigator.sendBeacon = (u) => { net.push(`beacon ${u}`); return true; };
  window.Audio = class { constructor() { this.muted = false; this.paused = true; } play() { this.paused = false; return Promise.resolve(); } pause() { this.paused = true; } };
  global.Audio = window.Audio;
  window.AudioContext = undefined;

  const proto = window.HTMLMediaElement.prototype;
  const st = new WeakMap();
  const s = (el) => { if (!st.has(el)) st.set(el, { paused: true, t: 0, muted: false, ended: false }); return st.get(el); };
  Object.defineProperty(proto, "paused", { configurable: true, get() { return s(this).paused; } });
  Object.defineProperty(proto, "ended", { configurable: true, get() { return s(this).ended; } });
  Object.defineProperty(proto, "currentTime", { configurable: true, get() { return s(this).t; }, set(v) { s(this).t = v; } });
  Object.defineProperty(proto, "muted", { configurable: true, get() { return s(this).muted; }, set(v) {
    s(this).muted = v;
    // A browser that refuses sound without a recent tap pauses a video that script unmutes.
    if (!v && window.__blockUnmute && this.matches("video.gc-video") && !s(this).paused) { s(this).paused = true; this.dispatchEvent(new window.Event("pause")); }
  } });
  Object.defineProperty(proto, "src", {
    configurable: true,
    get() { return this.getAttribute("src") || ""; },
    set(v) { this.setAttribute("src", v); if (v === SAMPLE_URL) Promise.resolve().then(() => this.dispatchEvent(new window.Event("loadedmetadata"))); },
  });
  proto.play = function play() {
    const isIntro = this.getAttribute("aria-label") === "Greet-Me intro video";
    plays.push({ el: this, isIntro, t: s(this).t, muted: s(this).muted });
    if (isIntro && rejectIntro) return Promise.reject(new window.DOMException("play() needs a user gesture", "NotAllowedError"));
    s(this).paused = false; s(this).ended = false;
    this.dispatchEvent(new window.Event("playing"));
    return Promise.resolve();
  };
  proto.pause = function pause() { if (!s(this).paused) { s(this).paused = true; this.dispatchEvent(new window.Event("pause")); } };
  proto.load = function load() {};
  window.__endMedia = (el) => { s(el).paused = true; s(el).ended = true; el.dispatchEvent(new window.Event("ended")); };

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  mod = await import(pathToFileURL(OUT).href);
});

after(() => { for (const f of [ENTRY, OUT, QR_STUB]) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

const wait = async (ms) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
async function mount() {
  plays = []; rejectIntro = false;
  window.history.replaceState(null, "", "/#/");
  if (root) { await act(async () => root.unmount()); host.remove(); }
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(mod.App)); });
  await wait(20);
}
const $ = (t) => document.querySelector(`[data-testid="${t}"]`);
const step = () => $("experience-overlay")?.getAttribute("data-step") ?? null;
const paused = () => $("experience-overlay")?.getAttribute("data-paused") === "true";
const click = async (el, settle = 30) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await wait(settle); };
const key = async (k, target = document.body, settle = 30) => {
  await act(async () => { target.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true })); }); await wait(settle);
};
const pointer = async (el) => { await act(async () => { el.dispatchEvent(new window.Event("pointerdown", { bubbles: true })); }); await wait(10); };
const cardVideo = () => document.querySelector("video.gc-video");
const introVideo = () => document.querySelector('video[aria-label="Greet-Me intro video"]');
async function openExperience() {
  await mount();
  const cta = $("landing-experience");
  assert.ok(cta, "the CTA is shown (sample video available)");
  await click(cta);
  await wait(30);
  assert.equal(step(), "invite");
}
// Next until `id`, letting the card's own animations finish between presses.
async function nextTo(id) {
  for (let i = 0; i < 12 && step() !== id; i++) await click($("experience-next"), 400);
  assert.equal(step(), id);
}

test("CTA: 'The Greet-Me Experience' on the landing and in the menu; it opens the guide at the invitation email", async () => {
  await mount();
  const cta = $("landing-experience");
  assert.match(cta.textContent, /^✉ The Greet-Me Experience$/);
  assert.equal($("landing-support").nextElementSibling, cta, "same place as the sample entry it replaces");
  assert.doesNotMatch(document.body.textContent, /View Sample Greet-Me/);
  await click($("landing-menu-btn-page"));
  assert.match($("landing-menu-experience").textContent, /The Greet-Me Experience/);
  await click($("landing-menu-btn-page"));
  await click(cta);
  assert.ok($("experience-overlay"));
  assert.equal(step(), "invite");
  assert.match($("experience-invite").textContent, /Claire sent you a Greet-Me/);
  assert.match($("experience-step-label").textContent, /^1 of 10 · Your invitation$/);
  assert.equal(document.querySelector(".gc-container"), null, "the card is not mounted yet");
  await click($("experience-open-invite"));
  assert.equal(step(), "envelope");
  assert.ok(document.querySelector(".gc-envelope-wrapper"), "the real card opens at its envelope");
  assert.equal(paused(), false, "opening the invitation is not an interruption");
});

test("step order: the guide drives the unchanged card through its own controls; a video end moves to the photos", async () => {
  await openExperience();
  const order = [step()];
  await click($("experience-next"), 200); order.push(step());          // envelope
  await click($("experience-next"), 300); order.push(step());          // reverse: the spin runs (reduced motion: one move)
  const env = document.querySelector(".gc-envelope");
  assert.match(env.style.transform, /rotateY\(180deg\)/, "turned over to the back (the seal side) by the envelope's own drag handler");
  await click($("experience-next"), 500); order.push(step());          // cover: the seal was pressed
  assert.ok(document.querySelector(".gc-cover-wrapper"), "the card opened at its cover");
  await click($("experience-next"), 500); order.push(step());          // intro
  assert.ok(document.querySelector(".gc-interior-spread"));
  await click($("experience-next"), 500); order.push(step());          // video
  assert.ok(document.querySelector(".gc-featured-spread"));
  await wait(1700);                                                     // start delay + sound check
  const v = cardVideo();
  const started = plays.filter((p) => p.el === v);
  assert.equal(started.length, 1, "the guide pressed the video's own Play once");
  assert.equal(started[0].muted, true, "started muted, which every browser allows");
  assert.equal(v.muted, false, "then given its sound (sound is on and the browser allowed it)");
  await act(async () => { window.__endMedia(v); }); await wait(50);
  order.push(step());                                                   // photos: the video ended
  assert.ok(document.querySelector(".gc-photo-album:not(.gc-album-disabled)"), "the album unlocked by the player itself");
  await wait(700);                                                      // past the Next guard that follows the video's end
  await click($("experience-next"), 500); order.push(step());          // finale
  assert.ok(document.querySelector(".gc-finale-spread"));
  await wait(50);
  const qr = document.querySelector('.gc-finale-spread a[href*="sample=credit"]');
  assert.ok(qr, "the finale shows the sample QR");
  await click($("experience-next"), 100); order.push(step());          // claim: the sample QR was pressed
  assert.ok($("sample-credit-reveal"), "the existing sample reveal");
  assert.match($("sample-ribbon").textContent, /Sample — for demonstration only\. This credit can't be claimed\./);
  await click($("experience-next"), 50); order.push(step());           // return
  assert.ok($("experience-end"));
  assert.deepEqual(order, ["invite", "envelope", "reverse", "cover", "intro", "video", "photos", "finale", "claim", "return"]);
  assert.equal(document.querySelector('a[href*="claim-credit"]'), null, "never a real claim link");
});

test("pause on interaction (pointer, touch, key) with a visible Paused state; Resume; controls and Tab do not pause", async () => {
  await openExperience();
  await click($("experience-open-invite"), 100);
  await click($("experience-next"), 100);
  assert.equal(paused(), false, "the guide's own Next is not an interruption");
  await key("Tab"); assert.equal(paused(), false, "Tab (reaching the controls) is not an interruption");
  await pointer(document.querySelector(".gc-envelope"));
  assert.equal(paused(), true, "a pointer on the card pauses");
  assert.match($("experience-paused").textContent, /^Paused▶ Resume$/);
  assert.ok($("experience-resume"), "Resume replaces Pause");
  assert.equal($("experience-pause"), null);
  await click($("experience-resume"));
  assert.equal(paused(), false); assert.equal($("experience-paused"), null);
  await act(async () => { document.querySelector(".gc-envelope").dispatchEvent(new window.Event("touchstart", { bubbles: true })); }); await wait(10);
  assert.equal(paused(), true, "a touch pauses");
  await click($("experience-resume-pill"));
  assert.equal(paused(), false, "the pill's Resume works too");
  await key("a"); assert.equal(paused(), true, "a key pauses");
  await click($("experience-resume"));
  await click($("experience-pause")); assert.equal(paused(), true, "Pause button");
  await click($("experience-next"), 400);
  assert.equal(paused(), true, "manual navigation keeps the visitor's pause");
});

test("the visitor's own card navigation is followed (tap the cover, arrow keys)", async () => {
  await openExperience();
  await click($("experience-open-invite"), 100);
  await click($("experience-next"), 400);                      // reverse
  await click(document.querySelector(".gc-wax-seal"), 500);    // the visitor opens the seal
  assert.equal(step(), "cover");
  await key("ArrowRight", document.body, 500);                 // the player's own keyboard navigation
  assert.equal(step(), "intro"); assert.equal(paused(), true, "and their key paused the tour");
  await key("ArrowLeft", document.body, 500);
  assert.equal(step(), "cover");
});

test("manual Back: card screens turn back; the cover goes back to a fresh envelope; then to the invitation", async () => {
  await openExperience();
  await nextTo("intro");
  await wait(300);
  await click($("experience-back"), 500);
  assert.equal(step(), "cover"); assert.ok(document.querySelector(".gc-cover-wrapper"));
  await click($("experience-back"), 200);
  assert.equal(step(), "reverse");
  assert.ok(document.querySelector(".gc-envelope-wrapper"), "a fresh envelope (the player never turns back to it itself)");
  await click($("experience-back"), 200);
  assert.equal(step(), "envelope");
  await click($("experience-back"), 100);
  assert.equal(step(), "invite"); assert.equal(document.querySelector(".gc-container"), null);
  assert.equal($("experience-back").disabled, true, "nothing before the invitation");
});

test("sound toggle mutes and unmutes everything the card plays, including the album music's own control", async () => {
  await openExperience();
  await nextTo("video");
  await wait(1700);
  const v = cardVideo();
  await act(async () => { window.__endMedia(v); }); await wait(50);
  assert.equal(step(), "photos");
  const albumBtn = () => document.querySelector(".gc-album-mute-btn");
  assert.equal(albumBtn().getAttribute("aria-label"), "Mute", "album music on");
  const snd = $("experience-sound");
  assert.equal(snd.getAttribute("aria-pressed"), "true");
  await click(snd);
  assert.equal(snd.getAttribute("aria-pressed"), "false");
  assert.match(snd.getAttribute("aria-label"), /Sound is off/);
  const media = [...document.querySelectorAll(".gc-container video, .gc-container audio")];
  assert.ok(media.length >= 3, "video + the card's two cue sounds");
  assert.ok(media.every((m) => m.muted), "all muted");
  assert.equal(albumBtn().getAttribute("aria-label"), "Unmute", "album music muted through its own button");
  assert.equal(paused(), false, "Sound is not an interruption");
  await click(snd);
  assert.ok(media.every((m) => !m.muted), "all unmuted");
  assert.equal(albumBtn().getAttribute("aria-label"), "Mute");
});

test("browser refuses the video's sound: it keeps playing muted, a note says so, and Sound on (a tap) gives it sound", async () => {
  await openExperience();
  window.__blockUnmute = true;
  await nextTo("video");
  await wait(1700);
  const v = cardVideo();
  assert.equal(v.paused, false, "still playing");
  assert.equal(v.muted, true, "muted again after the browser paused it for unmuting");
  assert.match($("experience-note").textContent, /started the video without sound\. Press Sound on to hear it\./);
  const snd = $("experience-sound");
  assert.equal(snd.getAttribute("aria-pressed"), "false", "the control shows the sound that is actually off");
  window.__blockUnmute = false; // the visitor's press is the tap the browser needs
  await click(snd);
  assert.equal(v.muted, false, "sound on");
  assert.equal(snd.getAttribute("aria-pressed"), "true");
  assert.equal($("experience-note"), null);
  assert.equal(paused(), false, "Sound is not an interruption");
});

test("replay: back to the start of the experience, running", async () => {
  await openExperience();
  await nextTo("cover");
  await click($("experience-pause"));
  await click($("experience-replay"), 100);
  assert.equal(step(), "invite");
  assert.equal(paused(), false);
  assert.equal(document.querySelector(".gc-container"), null);
  await click($("experience-open-invite"), 100);
  assert.ok(document.querySelector(".gc-envelope-wrapper"), "a fresh card from its envelope");
});

test("exit button: back to the landing; the intro video is started from 0:00 with sound", async () => {
  await openExperience();
  await nextTo("cover");
  const iv = introVideo(); iv.currentTime = 7;
  plays = [];
  await click($("experience-exit"), 60);
  assert.equal($("experience-overlay"), null, "the guide is closed");
  assert.ok($("landing-page"));
  const p = plays.filter((x) => x.isIntro);
  assert.equal(p.length, 1, "play attempted once");
  assert.equal(p[0].t, 0, "from the beginning"); assert.equal(p[0].muted, false, "with sound");
  assert.ok($("landing-pause"), "it is playing: the bar offers Pause");
  assert.equal($("landing-video-cover"), null);
  assert.equal($("landing-autoplay-blocked"), null);
  assert.equal(document.body.style.overflow, "", "page scroll restored");
});

test("Escape exits; when the browser refuses play(), the Play cover stays with a prompt and focus goes to Play", async () => {
  await openExperience();
  await nextTo("intro");
  rejectIntro = true; plays = [];
  await key("Escape", document.body, 60);
  assert.equal($("experience-overlay"), null, "Escape exits");
  assert.equal(plays.filter((x) => x.isIntro).length, 1, "play was attempted");
  assert.ok($("landing-video-cover"), "the Play cover is shown again");
  assert.match($("landing-autoplay-blocked").textContent, /Press Play to start the intro video\./);
  assert.equal(document.activeElement, $("landing-big-play"), "keyboard focus on Play");
  assert.equal($("landing-big-play").getAttribute("aria-label"), "Play intro video");
  // The visitor's own tap then plays it.
  rejectIntro = false;
  await click($("landing-big-play"));
  assert.ok($("landing-pause")); assert.equal($("landing-autoplay-blocked"), null);
});

test("the end screen's Back to Greet-Me returns to the landing too", async () => {
  await openExperience();
  await nextTo("return");
  plays = [];
  await click($("experience-back-to-landing"), 60);
  assert.equal($("experience-overlay"), null);
  assert.equal(plays.filter((x) => x.isIntro).length, 1);
});

test("M1 focus: on open focus is inside the dialog (Open); Enter there opens the card without pausing; then Next", async () => {
  await mount();
  const cta = $("landing-experience");
  cta.focus();
  await click(cta, 60); // a keyboard Enter on a button activates it with a click
  const open = $("experience-open-invite");
  assert.equal(document.activeElement, open, "focus moved into the dialog, on the invitation's Open");
  assert.ok($("experience-overlay").contains(document.activeElement));
  // Enter on the focused control: the guide's own control, so no pause; and the CTA behind is not re-fired.
  await key("Enter", document.activeElement, 10);
  await click(document.activeElement, 60);
  assert.equal(step(), "envelope");
  assert.equal(paused(), false, "Enter on the dialog's own button is not an interruption");
  assert.equal(document.activeElement, $("experience-next"), "Open unmounted: focus went to Next, not to the page");
});

test("M1 focus trap: the landing is inert and hidden; Tab from the last control wraps to the first, Shift+Tab back; outside focus returns", async () => {
  await openExperience();
  const overlay = $("experience-overlay");
  const landingParts = [...overlay.parentElement.children].filter((el) => el !== overlay && el.tagName !== "STYLE");
  assert.ok(landingParts.length >= 3, "menu, panel and footer behind the dialog");
  assert.ok(landingParts.every((el) => el.hasAttribute("inert") && el.getAttribute("aria-hidden") === "true"), "the landing behind is inert and aria-hidden");
  await click($("experience-open-invite"), 60);
  const replay = $("experience-replay"); // the last control in the dialog
  replay.focus();
  await key("Tab", replay, 10);
  const first = document.activeElement;
  assert.ok(overlay.contains(first), "Tab from the last control stays in the dialog");
  assert.notEqual(first, replay);
  await act(async () => { first.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true })); }); await wait(10);
  assert.equal(document.activeElement, replay, "Shift+Tab from the first control goes to the last");
  assert.equal(paused(), false, "Tab and Shift+Tab are not interruptions");
  // Focus escaping to the landing (e.g. a script or an old browser without inert) is pulled back in.
  await act(async () => { $("landing-register-tile").focus(); }); await wait(10);
  assert.ok(overlay.contains(document.activeElement), "focus outside the dialog comes back");
  // Exit: the landing is live again and the existing return focus (the bar's Pause) applies.
  await click($("experience-exit"), 60);
  assert.ok(landingParts.every((el) => !el.hasAttribute("inert") && !el.hasAttribute("aria-hidden")), "landing restored");
  assert.equal(document.activeElement, $("landing-pause"), "focus returns to the intro's Pause");
});

test("m1: a Next pressed during the envelope exit is not lost and the step does not bounce back", async () => {
  await openExperience();
  await click($("experience-open-invite"), 100);
  await click($("experience-next"), 300); // reverse
  const seen = [];
  const mo = new window.MutationObserver(() => { const s = step(); if (seen.at(-1) !== s) seen.push(s); });
  mo.observe($("experience-overlay"), { attributes: true, attributeFilter: ["data-step"] });
  await click($("experience-next"), 0);  // seal: the envelope exit animates
  await click($("experience-next"), 0);  // pressed during that animation
  await wait(1200);
  mo.disconnect();
  assert.deepEqual(seen, ["cover", "intro"], "cover then intro, never back to cover");
  assert.ok(document.querySelector(".gc-interior-spread"), "and the card got there");
});

test("m1 (real motion): two Next presses 50 ms apart from the turned-over envelope go cover then intro, no bounce", async () => {
  window.__rm = false;
  try {
    await openExperience();
    await click($("experience-open-invite"), 100);
    await click($("experience-next"), 50);
    await click($("experience-pause"), 10); // hold the dwell while jsdom renders the spin; Next still works while paused
    for (let i = 0; i < 100 && $("experience-spin-shield"); i++) await wait(100);
    const seen = [];
    const mo = new window.MutationObserver(() => { const s = step(); if (seen.at(-1) !== s) seen.push(s); });
    mo.observe($("experience-overlay"), { attributes: true, attributeFilter: ["data-step"] });
    await click($("experience-next"), 50);
    await click($("experience-next"), 0);
    for (let i = 0; i < 40 && !document.querySelector(".gc-interior-spread"); i++) await wait(100);
    await wait(1600);
    mo.disconnect();
    assert.deepEqual(seen, ["cover", "intro"]);
    assert.equal(step(), "intro");
    assert.ok(document.querySelector(".gc-interior-spread"), "the card is on the Intro");
  } finally { window.__rm = true; }
});

test("m2: the spin is shielded from the real pointer and completes even when a real mouseout ends the drag", async () => {
  window.__rm = false; // real motion: the 2.6 s spin
  try {
    await openExperience();
    await click($("experience-open-invite"), 100);
    await click($("experience-next"), 400);
    assert.equal(step(), "reverse");
    // jsdom renders every spin frame, which can outlast the 6 s dwell; Pause holds the dwell (the spin carries on).
    await click($("experience-pause"), 10);
    assert.ok($("experience-spin-shield"), "a transparent shield covers the card during the spin");
    const wrap = document.querySelector(".gc-envelope-wrapper");
    // A real hover straight onto the envelope (in a browser the shield stops it; here it is dispatched directly):
    await act(async () => { wrap.dispatchEvent(new window.MouseEvent("mousemove", { bubbles: true, clientX: 640, clientY: 400, buttons: 0 })); });
    await wait(30);
    await act(async () => { wrap.dispatchEvent(new window.MouseEvent("mouseout", { bubbles: true, relatedTarget: document.body })); }); // the visitor's cursor leaves
    for (let i = 0; i < 100 && $("experience-spin-shield"); i++) await wait(100); // jsdom renders each frame: slower than 2.6 s
    const deg = parseFloat(/rotateY\((-?[\d.]+)deg\)/.exec(document.querySelector(".gc-envelope").style.transform)[1]);
    assert.ok(Math.abs(deg - 540) <= 0.5, `the spin still lands on the back (540 degrees, got ${deg})`);
    assert.equal($("experience-spin-shield"), null, "the shield goes when the spin is done");
  } finally { window.__rm = true; }
});

test("m3: while paused, the video's end does not advance or scroll; Resume moves on to the photos", async () => {
  await openExperience();
  await nextTo("video");
  await wait(1700);
  await click($("experience-pause"));
  const stage = document.querySelector(".gx-stage");
  let scrolls = 0; const realInto = window.HTMLElement.prototype.scrollIntoView;
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() { scrolls += 1; };
  try {
    await act(async () => { window.__endMedia(cardVideo()); }); await wait(80);
    assert.equal(step(), "video", "paused: no advance");
    assert.equal(scrolls, 0, "paused: no scroll");
    assert.ok(stage);
    await click($("experience-resume"), 80);
    assert.equal(step(), "photos", "Resume moves on");
  } finally { window.HTMLElement.prototype.scrollIntoView = realInto; }
});

test("m4: when the browser blocks sound, everything the card plays is muted (one state); the note clears after the video step", async () => {
  await openExperience();
  window.__blockUnmute = true;
  try {
    await nextTo("video");
    await wait(1700);
    assert.ok($("experience-note"), "the note on the video step");
    const v = cardVideo();
    await act(async () => { window.__endMedia(v); }); await wait(80);
    assert.equal(step(), "photos");
    assert.equal($("experience-note"), null, "the note is gone after the video step");
    assert.equal($("experience-sound").getAttribute("aria-pressed"), "false");
    const media = [...document.querySelectorAll(".gc-container video, .gc-container audio")];
    assert.ok(media.every((m) => m.muted), "card video and cue sounds muted");
    assert.equal(document.querySelector(".gc-album-mute-btn").getAttribute("aria-label"), "Unmute", "album music muted too");
  } finally { window.__blockUnmute = false; }
  await click($("experience-sound"));
  assert.equal(document.querySelector(".gc-album-mute-btn").getAttribute("aria-label"), "Mute", "Sound on turns it all on");
});

test("N1: the visitor's own album mute is respected when the card changes", async () => {
  await openExperience();
  await nextTo("video");
  await wait(1700);
  await act(async () => { window.__endMedia(cardVideo()); }); await wait(80);
  const albumBtn = () => document.querySelector(".gc-album-mute-btn");
  await click(albumBtn(), 30); // the visitor mutes the album music
  assert.equal(albumBtn().getAttribute("aria-label"), "Unmute");
  await click(document.querySelector(".gc-album-next"), 400); // a card DOM change (next photo)
  await act(async () => { $("experience-card").appendChild(document.createElement("span")); }); await wait(30);
  assert.equal(albumBtn().getAttribute("aria-label"), "Unmute", "still muted: the guide did not undo it");
  assert.equal($("experience-sound").getAttribute("aria-pressed"), "true", "the guide's own sound state is unchanged");
});

test("D2: a Next 0 ms after the video's end does not skip the photos and music", async () => {
  await openExperience();
  await nextTo("video");
  await wait(1700);
  await act(async () => { window.__endMedia(cardVideo()); });
  await click($("experience-next"), 0);
  await wait(600);
  assert.equal(step(), "photos", "absorbed: the photos and music stay");
  assert.ok(document.querySelector(".gc-album-mute-btn"), "the album is playing");
});

test("D1: when the intro video has failed, exit focus returns to the entry button once the landing is live", async () => {
  await mount();
  await act(async () => { introVideo().dispatchEvent(new window.Event("error")); }); await wait(20);
  assert.ok($("landing-video-failed"), "the intro video has failed");
  await click($("landing-experience"), 60);
  assert.ok($("experience-overlay"));
  await key("Escape", document.body, 60);
  assert.equal($("experience-overlay"), null);
  assert.equal(document.querySelectorAll("[inert]").length, 0, "the landing is live again");
  assert.equal(document.activeElement, $("landing-experience"), "focus is on The Greet-Me Experience, not lost to the page");
  assert.equal(plays.filter((x) => x.isIntro).length, 0, "no play attempted for a failed video");
});

test("no network: no fetch, XHR or beacon (so nothing to claim, payment or send endpoints); no greetme_ storage", async () => {
  window.localStorage.clear(); window.sessionStorage.clear(); net = [];
  await openExperience();
  await nextTo("video");
  await wait(1700);
  await act(async () => { window.__endMedia(cardVideo()); }); await wait(50);
  await nextTo("claim");
  await click($("sample-claim-inert"));
  assert.equal($("sample-inert-note").textContent, "In a real Greet-Me, this is where the recipient claims their $5 credit.");
  await nextTo("return");
  await click($("experience-back-to-landing"), 60);
  assert.deepEqual(net, [], "no network request of any kind");
  assert.equal(window.location.hash, "#/", "the inert claim and the sample QR never navigated");
  const keys = [...Array(window.localStorage.length).keys()].map((i) => window.localStorage.key(i))
    .concat([...Array(window.sessionStorage.length).keys()].map((i) => window.sessionStorage.key(i)));
  assert.deepEqual(keys.filter((k) => /^greetme_/.test(k)), []);
});
