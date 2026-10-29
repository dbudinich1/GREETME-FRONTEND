// src/pages/landingLayout.browser.test.mjs
//
// The revised landing layout (Team 3; founder-approved rendering, Report 75 rev 3), MOUNTED:
//   - settled copy and labels, the italic supporting line, one grouping panel with three cards;
//   - the sample entry ("The Greet-Me Experience", formerly "View Sample Greet-Me") kept OFF (SHOW_SAMPLE_ENTRY = false) here;
//   - intro-video controls call Team 2's useIntroVideo only: nothing plays before a tap, the cover's
//     Play starts from 0:00 with sound, Pause/Resume, Replay, the after-end Replay cover, the error card;
//   - keyboard focus moves to the bar (Resume, then Pause) when the cover's Play goes away (Team 5 N2).
// jsdom has no media pipeline, so play()/pause() are stubbed on the element prototype (as in
// useIntroVideo.browser.test.mjs); Landing, the hook and React are the real ones. Auth is stubbed signed out.
//
// Run (Node 20.x):  node --test src/pages/landingLayout.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, `.__landing.${process.pid}.entry.jsx`);
const BUNDLE = join(__dirname, `.__landing.${process.pid}.bundle.mjs`);
let React, createRoot, act, mod, window, calls, root, host;

const authStub = {
  name: "auth-stub",
  setup(b) {
    b.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: "auth-stub", namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({
      contents: "export const useAuth = () => ({ isAuthenticated: false, loading: false });", loader: "js",
    }));
  },
};

before(async () => {
  writeFileSync(ENTRY,
    'import { MemoryRouter } from "react-router-dom";\n'
    + 'import Landing from "./Landing.jsx";\n'
    + 'export function App() { return (<MemoryRouter><Landing /></MemoryRouter>); }\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react", plugins: [authStub],
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react-router-dom"], logLevel: "silent",
    // The lazily loaded sample viewer brings the card player; its styles/images are not needed here.
    loader: { ".css": "empty", ".jpg": "dataurl", ".jpeg": "dataurl", ".png": "dataurl", ".svg": "dataurl", ".wav": "dataurl", ".mp3": "dataurl" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
  });
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true, url: "http://localhost/" });
  window = dom.window;
  global.window = window; global.document = window.document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true, writable: true });
  global.HTMLElement = window.HTMLElement; global.Node = window.Node;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  const proto = window.HTMLMediaElement.prototype;
  const state = new WeakMap();
  const st = (el) => { if (!state.has(el)) state.set(el, { paused: true, t: 0, muted: false }); return state.get(el); };
  Object.defineProperty(proto, "paused", { configurable: true, get() { return st(this).paused; } });
  Object.defineProperty(proto, "currentTime", { configurable: true, get() { return st(this).t; }, set(v) { st(this).t = v; calls.push(["seek", v]); } });
  Object.defineProperty(proto, "muted", { configurable: true, get() { return st(this).muted; }, set(v) { st(this).muted = v; } });
  proto.play = function play() {
    calls.push(["play", { t: st(this).t, muted: st(this).muted }]);
    st(this).paused = false;
    this.dispatchEvent(new window.Event("playing"));
    return Promise.resolve();
  };
  proto.pause = function pause() { calls.push(["pause"]); st(this).paused = true; this.dispatchEvent(new window.Event("pause")); };
  proto.load = function load() {};

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  mod = await import(pathToFileURL(BUNDLE).href);
});

after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

async function mount() {
  calls = [];
  if (root) { await act(async () => root.unmount()); host.remove(); }
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(mod.App)); });
}
const $ = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); };
const fire = async (name) => { await act(async () => { document.querySelector("video").dispatchEvent(new window.Event(name)); }); };

test("settled copy and structure; the sample entry stays off", async () => {
  await mount();
  const text = document.body.textContent;
  assert.ok($("landing-panel"), "one grouping panel");
  for (const id of ["landing-headcard", "landing-videocard", "landing-tile"]) assert.ok($("landing-panel").contains($(id)), `${id} sits inside the panel`);
  assert.match(text, /Greetings and gifts that keep on giving\./);
  assert.equal($("landing-support").textContent, "Personalized, automatic moments. Truly unforgettable!");
  // Sign in / Create account live in the top-right menu (founder-approved hamburger, Report 108): closed on arrival.
  const menuBtn = $("landing-menu-btn-page");
  assert.ok(menuBtn, "menu button in the page corner");
  assert.ok($("landing-menu-btn-card"), "menu button for narrow screens (inside the first card)");
  assert.equal(menuBtn.getAttribute("aria-expanded"), "false");
  assert.equal($("landing-register-top"), null, "menu items are not rendered while the menu is closed");
  await click(menuBtn);
  assert.equal(menuBtn.getAttribute("aria-expanded"), "true");
  assert.equal($("landing-register-top").textContent, "Create your free account");
  assert.equal($("landing-menu-play").textContent.trim(), "▶ Play demo");
  assert.ok($("landing-menu-play"), "the open menu is rendered (so the next check is not vacuous)");
  assert.equal($("landing-menu-experience"), null, "the menu's Greet-Me Experience item follows the same gate as the main button");
  assert.equal($("landing-register-tile").textContent.trim(), "Create your free account");
  assert.match(text, /New accounts include 5 free sends during your 7-day trial\./);
  assert.match(text, /Your first test Greet-Me is free and doesn’t count against your five trial sends\./);
  assert.equal($("landing-signin").getAttribute("href"), "/login");
  assert.equal($("landing-register-top").getAttribute("href"), "/register");
  assert.equal($("landing-experience"), null, "The Greet-Me Experience is not rendered while SHOW_SAMPLE_ENTRY is false");
  assert.doesNotMatch(text, /View Sample Greet-Me|The Greet-Me Experience|Tap for sound|Test a Greet-Me|onboarding test|Loading demo/);
});

test("nothing plays before a tap; the cover's Play starts from 0:00 with sound", async () => {
  await mount();
  await fire("loadeddata");
  assert.deepEqual(calls.filter((c) => c[0] === "play"), [], "no autoplay");
  assert.ok($("landing-video-cover"), "a cover with Play hides the not-yet-playing frame");
  await click($("landing-big-play"));
  const plays = calls.filter((c) => c[0] === "play");
  assert.equal(plays.length, 1);
  assert.deepEqual(plays[0][1], { t: 0, muted: false }, "from the start, with sound");
  assert.equal($("landing-video-cover"), null, "the cover goes away while playing");
  assert.ok($("landing-pause"), "Pause is offered while playing");
});

test("Pause, then Resume continues from where it was; Replay starts over", async () => {
  await mount();
  await fire("loadeddata");
  await click($("landing-big-play"));
  await click($("landing-pause"));
  assert.equal(calls.at(-1)[0], "pause");
  assert.match($("landing-play").textContent, /Resume/);
  assert.equal($("landing-video-cover"), null, "a paused video shows its frame, not the cover");
  const seeksBefore = calls.filter((c) => c[0] === "seek").length;
  await click($("landing-play"));
  assert.equal(calls.at(-1)[0], "play");
  assert.equal(calls.filter((c) => c[0] === "seek").length, seeksBefore, "Resume does not seek");
  await click($("landing-replay"));
  assert.deepEqual(calls.slice(-2), [["seek", 0], ["play", { t: 0, muted: false }]], "Replay starts from 0:00 with sound");
});

test("after the end the cover offers Replay, which starts over", async () => {
  await mount();
  await fire("loadeddata");
  await click($("landing-big-play"));
  await fire("ended");
  assert.ok($("landing-video-cover"));
  assert.equal($("landing-big-play").getAttribute("aria-label"), "Replay intro video from the start");
  await click($("landing-big-play"));
  assert.deepEqual(calls.slice(-2), [["seek", 0], ["play", { t: 0, muted: false }]]);
});

test("keyboard focus stays in the control bar when the cover's Play disappears (Team 5 N2)", async () => {
  await mount();
  await fire("loadeddata");
  $("landing-big-play").focus();
  await click($("landing-big-play"));
  assert.equal(document.activeElement, $("landing-pause"), "first Play from the cover: focus moves to Pause");

  await fire("pause"); await fire("ended");
  $("landing-big-play").focus();
  await click($("landing-big-play"));
  assert.equal(document.activeElement, $("landing-pause"), "Replay from the after-end cover: focus moves to Pause");

  // The browser has not started playing yet when the cover goes away: focus waits on Resume, then Pause.
  const proto = window.HTMLMediaElement.prototype;
  const realPlay = proto.play;
  proto.play = function play() { calls.push(["play", { t: this.currentTime, muted: this.muted }]); return Promise.resolve(); };
  try {
    await mount();
    await fire("loadeddata");
    $("landing-big-play").focus();
    await click($("landing-big-play"));
    assert.equal(document.activeElement, $("landing-play"), "before playback starts, focus is on the bar's Resume, not the page");
    await fire("playing");
    assert.equal(document.activeElement, $("landing-pause"), "once playing, focus is on Pause");
  } finally { proto.play = realPlay; }
});

test("when no source works, the branded card links to the original and the controls are disabled", async () => {
  await mount();
  await fire("error");
  assert.ok($("landing-video-failed"));
  assert.equal($("landing-video-failed").querySelector("a").getAttribute("href"), "https://greetmedanny.blob.core.windows.net/public/greetme-demo.mp4.mp4");
  assert.equal($("landing-play").disabled, true);
  assert.equal($("landing-replay").disabled, true);
  assert.equal($("landing-video-cover"), null);
});

test("source: the layout calls useIntroVideo only; the sample entry is gated on enablement AND available media", () => {
  const src = readFileSync(join(__dirname, "Landing.jsx"), "utf8");
  assert.match(src, /const SHOW_SAMPLE_ENTRY = SAMPLE_ENTRY_ENABLED && sampleMedia === 'available';/);
  assert.match(readFileSync(join(__dirname, "..", "components", "sample", "sampleGreeting.js"), "utf8"), /export const SAMPLE_ENTRY_ENABLED = true;/,
    "the sample is enabled (founder-authorized now that its talking-photo video is live)");
  assert.match(src, /onClick=\{intro\.pause\}/);
  assert.match(src, /onClick=\{intro\.replay\}/);
  assert.match(src, /intro\.tap\(\)/);
  assert.doesNotMatch(src, /GreetingCardProto|FinaleSpread/, "the landing never imports the card player directly");
  assert.match(src, /lazy\(\(\) => import\('..\/components\/sample\/SampleGreetingOverlay\.jsx'\)\)/, "the viewer loads only when opened");
});
