// src/hooks/useIntroVideo.browser.test.mjs
//
// The intro video's tap behaviour, MOUNTED (founder decision 2026-10-15: tap to play, no autoplay):
//   first tap  -> plays from 0:00, unmuted
//   next tap   -> pauses; next -> resumes (still unmuted, from where it was)
//   after end  -> tap replays from 0:00
// and nothing plays before a tap. jsdom has no media pipeline, so play()/pause() and the paused
// flag are stubbed on the element prototype; the hook and React wiring are the real ones.
//
// Run (Node 20.x):  node --test src/hooks/useIntroVideo.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__uiv.entry.jsx");
const BUNDLE = join(__dirname, ".__uiv.bundle.mjs");
let React, createRoot, act, mod, window, calls;

before(async () => {
  writeFileSync(ENTRY,
    'import useIntroVideo from "./useIntroVideo.js";\n'
    + 'export function Harness() {\n'
    + '  const intro = useIntroVideo();\n'
    + '  return (<div>\n'
    + '    <div data-testid="area" onClick={intro.tap}><video ref={intro.videoRef} {...intro.videoEvents} /></div>\n'
    + '    <button data-testid="replay" onClick={intro.replay}>Replay</button>\n'
    + '    <span data-testid="state">{JSON.stringify({ status: intro.status, started: intro.started, playing: intro.playing, ended: intro.ended })}</span>\n'
    + '  </div>);\n'
    + '}\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"], logLevel: "silent",
  });
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { pretendToBeVisual: true });
  window = dom.window;
  global.window = window; global.document = window.document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true, writable: true });
  global.HTMLElement = window.HTMLElement; global.Node = window.Node;
  global.IS_REACT_ACT_ENVIRONMENT = true;

  // A minimal media element: play()/pause() record calls and flip `paused`, and fire the events the
  // real element fires, so the hook's state follows them exactly as in a browser.
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

  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  mod = await import(pathToFileURL(BUNDLE).href);
});

after(() => { for (const f of [ENTRY, BUNDLE]) { try { rmSync(f, { force: true }); } catch { /* best effort */ } } });

const q = (host, id) => host.querySelector(`[data-testid="${id}"]`);
const state = (host) => JSON.parse(q(host, "state").textContent);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); };

test("nothing plays before a tap; first tap plays from the start with sound; then pause, resume, end, replay", async () => {
  calls = [];
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(mod.Harness)); });
  const video = host.querySelector("video");

  assert.deepEqual(calls.filter((c) => c[0] === "play"), [], "no play() before the visitor taps");
  assert.equal(state(host).started, false);

  // Simulate the browser having buffered a little and moved the position (e.g. preload) before the tap.
  video.currentTime = 4.2; calls = [];
  await click(q(host, "area"));
  assert.deepEqual(calls[0], ["seek", 0], "the first Play rewinds to 0:00 so the opening welcome is heard");
  assert.deepEqual(calls[1], ["play", { t: 0, muted: false }], "and plays with sound");
  assert.equal(state(host).playing, true);

  video.currentTime = 12; calls = [];
  await click(q(host, "area"));
  assert.deepEqual(calls, [["pause"]], "the next tap pauses");
  assert.equal(state(host).playing, false);

  calls = [];
  await click(q(host, "area"));
  assert.deepEqual(calls, [["play", { t: 12, muted: false }]], "the next tap resumes where it was, with sound");

  // The video reaches its end.
  await act(async () => { video.dispatchEvent(new window.Event("pause")); video.dispatchEvent(new window.Event("ended")); });
  assert.equal(state(host).ended, true);
  calls = [];
  await click(q(host, "area"));
  assert.deepEqual(calls[0], ["seek", 0], "after the end, a tap replays from the start");
  assert.deepEqual(calls[1], ["play", { t: 0, muted: false }]);

  // The explicit Replay handler (for the layout's Replay control) does the same at any point.
  video.currentTime = 30; calls = [];
  await click(q(host, "replay"));
  assert.deepEqual(calls[0], ["seek", 0]);
  assert.deepEqual(calls[1], ["play", { t: 0, muted: false }]);

  await act(async () => root.unmount());
});

test("a media error on the <video> and readiness both drive the status", async () => {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(mod.Harness)); });
  const video = host.querySelector("video");
  assert.equal(state(host).status, "loading");
  await act(async () => { video.dispatchEvent(new window.Event("loadeddata")); });
  assert.equal(state(host).status, "ready");
  await act(async () => { video.dispatchEvent(new window.Event("error")); });
  assert.equal(state(host).status, "failed", "a decode/media error shows the failure card");
  await act(async () => root.unmount());
});
