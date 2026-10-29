// src/components/sample/sampleEntry.browser.test.mjs
//
// The landing's sample entry (founder: required; Report 71 rev 2), MOUNTED with the real Landing, the real
// sample viewer and the real, unchanged card player. Since 2026-10-29 the entry button is "The Greet-Me
// Experience" (the guided sample, tested in experience/greetMeExperience.browser.test.mjs); it keeps the sample's
// gate and place. The free sample viewer stays reachable from a scanned sample QR's reveal (Back).
//   - as committed (SAMPLE_ENTRY_ENABLED = true): the video address is checked once and the button is shown;
//   - enabled, but the talking-photo video is missing or still being checked: no button and no placeholder;
//   - enabled and the video loads: the button sits beneath the supporting line and opens the guided sample; a
//     scanned sample QR (#/?sample=credit) shows the sample $5 reveal (inert claim, Back opens the sample viewer
//     at the envelope, Close returns focus to the button), also for a signed-in visitor;
//   - the sample never renders a /claim-credit/ link, never calls the network and never writes greetme_ storage.
// The finale QR -> reveal step needs the separately authorized player change; when that change is present this
// file also checks it (see the last test), otherwise it checks that the sample shows no claim link at all.
//
// jsdom has no media pipeline: play()/pause() are stubbed, and setting a <video> src to the sample address fires
// 'loadedmetadata' (video present) or 'error' (video missing) as each test chooses.
//
// Run (Node 20.x):  node --test src/components/sample/sampleEntry.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PAGES = join(__dirname, "..", "..", "pages");
const ENTRY = join(PAGES, `.__sample.${process.pid}.entry.jsx`);
const OUT = { committed: join(PAGES, `.__sample.${process.pid}.committed.mjs`), on: join(PAGES, `.__sample.${process.pid}.on.mjs`) };
const SAMPLE_URL = "https://greetmedanny.blob.core.windows.net/public/greetme-sample-talking-photo-v1.mp4";
const PLAYER_HAS_SAMPLE = /\bsample\b/.test(readFileSync(join(__dirname, "..", "GreetingCardProto", "FinaleSpread.jsx"), "utf8")
  .split("\n").filter((l) => !/^\s*\/\//.test(l)).join("\n"));

let React, createRoot, act, window, mods = {}, root, host, probes, fetches;
let media = "available"; // what the sample video does when requested: 'available' | 'missing' | 'silent'

const stubs = (enabled) => ({
  name: "stubs",
  setup(b) {
    b.onResolve({ filter: /context\/AuthContext$/ }, () => ({ path: "auth", namespace: "stub" }));
    b.onLoad({ filter: /^auth$/, namespace: "stub" }, () => ({ contents: "export const useAuth = () => globalThis.__auth;", loader: "js" }));
    // enabled === null: the committed sampleGreeting.js, unmodified.
    if (enabled !== null) b.onLoad({ filter: /sampleGreeting\.js$/ }, (a) => ({
      contents: readFileSync(a.path, "utf8").replace(/export const SAMPLE_ENTRY_ENABLED = (true|false);/, `export const SAMPLE_ENTRY_ENABLED = ${enabled};`),
      loader: "js",
    }));
  },
});

before(async () => {
  writeFileSync(ENTRY,
    'import { MemoryRouter, useLocation } from "react-router-dom";\n'
    + 'import Landing from "./Landing.jsx";\n'
    + 'function Loc() { const l = useLocation(); return (<span data-testid="router-path">{l.pathname}</span>); }\n'
    + 'export function App() { return (<MemoryRouter><Loc /><Landing /></MemoryRouter>); }\n');
  for (const [k, enabled] of [["committed", null], ["on", true]]) {
    await esbuild.build({
      entryPoints: [ENTRY], outfile: OUT[k], bundle: true, format: "esm", platform: "browser",
      jsx: "automatic", jsxImportSource: "react", plugins: [stubs(enabled)], logLevel: "silent",
      external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react-router-dom"],
      loader: { ".css": "empty", ".jpg": "dataurl", ".jpeg": "dataurl", ".png": "dataurl", ".svg": "dataurl", ".wav": "dataurl", ".mp3": "dataurl" },
      define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    });
  }
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { pretendToBeVisual: true, url: "http://localhost/#/" });
  window = dom.window;
  global.window = window; global.document = window.document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true, writable: true });
  global.HTMLElement = window.HTMLElement; global.Node = window.Node;
  global.localStorage = window.localStorage; global.sessionStorage = window.sessionStorage;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  global.ResizeObserver = window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
  global.requestAnimationFrame = window.requestAnimationFrame;
  global.cancelAnimationFrame = window.cancelAnimationFrame;
  fetches = [];
  global.fetch = window.fetch = (u) => { fetches.push(String(u)); return Promise.reject(new Error("no network in tests")); };

  const proto = window.HTMLMediaElement.prototype;
  const st = new WeakMap();
  const s = (el) => { if (!st.has(el)) st.set(el, { paused: true, t: 0, muted: false }); return st.get(el); };
  Object.defineProperty(proto, "paused", { configurable: true, get() { return s(this).paused; } });
  Object.defineProperty(proto, "currentTime", { configurable: true, get() { return s(this).t; }, set(v) { s(this).t = v; } });
  Object.defineProperty(proto, "muted", { configurable: true, get() { return s(this).muted; }, set(v) { s(this).muted = v; } });
  Object.defineProperty(proto, "src", {
    configurable: true,
    get() { return this.getAttribute("src") || ""; },
    set(v) {
      this.setAttribute("src", v);
      if (v !== SAMPLE_URL) return;
      probes.push(v);
      if (media === "silent") return;
      const ev = media === "available" ? "loadedmetadata" : "error";
      Promise.resolve().then(() => this.dispatchEvent(new window.Event(ev)));
    },
  });
  proto.play = function play() { s(this).paused = false; this.dispatchEvent(new window.Event("playing")); return Promise.resolve(); };
  proto.pause = function pause() { s(this).paused = true; this.dispatchEvent(new window.Event("pause")); };
  proto.load = function load() {};

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  mods.committed = await import(pathToFileURL(OUT.committed).href);
  mods.on = await import(pathToFileURL(OUT.on).href);
});

after(() => { for (const f of [ENTRY, OUT.committed, OUT.on]) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

const flush = async (n = 4) => { for (let i = 0; i < n; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function mount(build, { hash = "#/", signedIn = false, mediaMode = "available" } = {}) {
  probes = []; media = mediaMode;
  global.__auth = { isAuthenticated: signedIn, loading: false };
  window.history.replaceState(null, "", `/${hash}`);
  if (root) { await act(async () => root.unmount()); host.remove(); }
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(mods[build].App)); });
  await flush();
}
const $ = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await flush(); };
const PLACEHOLDER = /MISSING ASSET|pending|placeholder|coming soon|not available yet/i;
const greetmeKeys = () => [...Array(window.localStorage.length).keys()].map((i) => window.localStorage.key(i))
  .concat([...Array(window.sessionStorage.length).keys()].map((i) => window.sessionStorage.key(i))).filter((k) => /^greetme_/.test(k));

test("as committed (sample enabled): the video is checked once, the button shows, a scanned sample link shows the reveal", async () => {
  assert.match(readFileSync(join(__dirname, "sampleGreeting.js"), "utf8"), /export const SAMPLE_ENTRY_ENABLED = true;/);
  await mount("committed");
  assert.deepEqual(probes, [SAMPLE_URL], "the sample video address is checked once");
  assert.ok($("landing-experience"), "the button is shown");
  assert.equal($("landing-support").nextElementSibling, $("landing-experience"), "directly beneath the supporting line");
  await mount("committed", { hash: "#/?sample=credit" });
  assert.ok($("landing-scan-reveal"), "a scanned sample link shows the sample reveal");
  await mount("committed", { mediaMode: "missing" });
  assert.equal($("landing-experience"), null, "video missing: still no button");
});

test("enabled but the talking-photo video is missing or still checking: no button and no placeholder", async () => {
  for (const mediaMode of ["missing", "silent"]) {
    await mount("on", { mediaMode });
    assert.deepEqual(probes, [SAMPLE_URL], `${mediaMode}: the video address is checked once`);
    assert.equal($("landing-experience"), null, `${mediaMode}: no button`);
    assert.doesNotMatch(document.body.textContent, PLACEHOLDER, `${mediaMode}: no placeholder text`);
    assert.doesNotMatch(document.body.textContent, /View Sample Greet-Me|The Greet-Me Experience/);
    await mount("on", { mediaMode, hash: "#/?sample=credit" });
    assert.equal($("landing-scan-reveal"), null, `${mediaMode}: no reveal without the sample`);
  }
});

test("enabled and the video loads: the button sits beneath the supporting line and opens the guided sample; the sample viewer's Close returns focus", async () => {
  await mount("on");
  const btn = $("landing-experience");
  assert.ok(btn, "the button is shown");
  assert.equal($("landing-support").nextElementSibling, btn, "directly beneath the supporting line");
  assert.ok($("landing-headcard").contains(btn));
  assert.match(btn.textContent, /The Greet-Me Experience/);
  assert.equal(btn.nextElementSibling.textContent, "Open a real Greet-Me, start to finish.");
  await click(btn);
  assert.ok($("experience-overlay"), "the guided sample opens");
  await click($("experience-exit"));
  assert.equal($("experience-overlay"), null);

  // The free sample viewer, from a scanned sample QR's reveal.
  await mount("on", { hash: "#/?sample=credit" });
  await click($("sample-credit-back"));
  assert.ok($("sample-overlay"), "the sample viewer opens");
  assert.ok(document.querySelector('[aria-label="Break seal to open"]'), "it starts at the envelope");
  assert.doesNotMatch($("sample-overlay").textContent, PLACEHOLDER);
  assert.equal($("sample-overlay").querySelector('a[href*="claim-credit"]'), null, "no real claim link in the sample");

  await click($("sample-close"));
  assert.equal($("sample-overlay"), null);
  assert.equal(document.activeElement, $("landing-experience"), "focus returns to the entry button");
});

test("a scanned sample QR shows the sample $5 reveal: inert claim, Back opens the sample (also signed in)", async () => {
  for (const signedIn of [false, true]) {
    await mount("on", { hash: "#/?sample=credit", signedIn });
    assert.ok($("landing-scan-reveal"), `signedIn=${signedIn}: the reveal is shown`);
    assert.match($("sample-ribbon").textContent, /Sample — for demonstration only\. This credit can't be claimed\./);
    assert.match($("sample-credit-reveal").textContent, /A \$5 Greet-Me Credit is waiting/);
    await click($("sample-claim-inert"));
    assert.equal($("sample-inert-note").textContent, "In a real Greet-Me, this is where the recipient claims their $5 credit.");
    assert.equal(window.location.hash, "#/?sample=credit", "the inert claim does not navigate");
    await click($("sample-credit-back"));
    assert.ok($("sample-overlay"), "Back opens the full sample");
    assert.equal($("landing-scan-reveal"), null);
  }
});

test("signed in + scanned sample QR: reveal only when the sample is shown; video missing -> usual redirect (Team 5 C2)", async () => {
  // Video missing: the exemption does not apply, so the visitor goes to the dashboard as usual.
  await mount("on", { hash: "#/?sample=credit", signedIn: true, mediaMode: "missing" });
  assert.equal($("landing-page"), null, "no plain landing for a signed-in visitor");
  assert.equal($("landing-scan-reveal"), null);
  assert.equal($("router-path").textContent, "/dashboard", "redirected to the dashboard");
  // Still checking: nothing is shown and no redirect happens yet.
  await mount("on", { hash: "#/?sample=credit", signedIn: true, mediaMode: "silent" });
  assert.equal($("landing-page"), null);
  assert.equal($("router-path").textContent, "/", "no redirect while the video is being checked");
  // Video available: the reveal is shown and the visitor stays.
  await mount("on", { hash: "#/?sample=credit", signedIn: true, mediaMode: "available" });
  assert.ok($("landing-scan-reveal"));
  assert.equal($("router-path").textContent, "/");
  // Signed out with the video missing: the ordinary landing, no reveal.
  await mount("on", { hash: "#/?sample=credit", signedIn: false, mediaMode: "missing" });
  assert.ok($("landing-page"));
  assert.equal($("landing-scan-reveal"), null);
});

test("the sample makes no network call and writes no greetme_ storage", async () => {
  window.localStorage.clear(); window.sessionStorage.clear(); fetches.length = 0;
  await mount("on", { hash: "#/?sample=credit" });
  await click($("sample-credit-back"));
  await click(document.querySelector('[aria-label="Break seal to open"]'));
  await flush(8);
  assert.deepEqual(fetches, [], "no fetch");
  assert.deepEqual(greetmeKeys(), [], "no greetme_ storage keys");
});

test("sample data follows the package rules: no job, credit code, gift or claim URL", async () => {
  const src = readFileSync(join(__dirname, "sampleGreeting.js"), "utf8");
  const data = src.slice(src.indexOf("export const SAMPLE_GREETING"), src.indexOf("export const SAMPLE_CHROME"));
  assert.doesNotMatch(data, /\b(jobId|courtesyCreditCode|gift|claimUrl)\s*:/);
  assert.match(data, /hasGift: false/);
  assert.match(src, /SAMPLE_QR_PATH = '\/#\/\?sample=credit'/);
  assert.doesNotMatch(src.replace(/\/\/.*$/gm, ""), /claim-credit/);
});

test("finale QR -> sample reveal needs the authorized player change, which the enabled sample requires", (t) => {
  if (PLAYER_HAS_SAMPLE) {
    t.skip("player change present: the finale QR/reveal step is tested by its own test, finaleSpreadSample.browser.test.mjs");
    return;
  }
  // Player unchanged: its QR needs a real credit code, which the sample never has, so the sample cannot reach
  // its QR/reveal step. The sample is now enabled, so the player change must be present.
  assert.fail("SAMPLE_ENTRY_ENABLED is true but FinaleSpread.jsx lacks the sample QR/reveal change");
});
