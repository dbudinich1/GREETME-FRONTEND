// Release 2b: the recipient card reads the public greeting's `videoStatus`.
//   preparing   -> short true message + "Try again" that re-reads the greeting (only the video fields change)
//   unavailable -> short true message; the rest of the greeting stays usable (the photo album is not held behind it)
//   none / missing field / corporate null -> today's generic "Video greeting" placeholder, album behaviour unchanged
// The real FeaturedSpread + VideoPlayer + PhotoAlbum, bundled and mounted in jsdom.
//
// Run (Node 20.x): node --test src/components/GreetingCardProto/videoStatus.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
// CLEAN_SCRATCH: scratch files carry this process id in their name, so concurrent suites cannot collide; all are removed on exit.
import { readdirSync as __scratchLs, rmSync as __scratchRm } from "node:fs";
process.on("exit", () => { try { for (const n of __scratchLs(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __scratchRm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const BUNDLE = join(__dirname, `.__videostatus.${process.pid}.bundle.mjs`);
const ENTRY = join(__dirname, `.__videostatus.${process.pid}.entry.jsx`);
let React, createRoot, act, FeaturedSpread, VideoPlayer, TEXT, window;

before(async () => {
  writeFileSync(ENTRY, [
    `export { default as FeaturedSpread } from "./FeaturedSpread.jsx";`,
    `export { default as VideoPlayer, VIDEO_PREPARING_TEXT, VIDEO_UNAVAILABLE_TEXT } from "./VideoPlayer.jsx";`,
  ].join("\n"));
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  try { globalThis.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // PhotoAlbum preloads its page-turn sound; jsdom has no Audio.
  globalThis.Audio = window.Audio = class { constructor() { this.volume = 1; this.currentTime = 0; } play() { return Promise.resolve(); } pause() {} load() {} };
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  const mod = await import(pathToFileURL(BUNDLE).href);
  FeaturedSpread = mod.FeaturedSpread; VideoPlayer = mod.VideoPlayer;
  TEXT = { preparing: mod.VIDEO_PREPARING_TEXT, unavailable: mod.VIDEO_UNAVAILABLE_TEXT };
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

let root;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const q = (sel) => document.querySelector(sel);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); };
async function mount(element) {
  if (root) { await act(async () => { root.unmount(); }); }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(element); });
  await flush();
}
const PHOTOS = ["https://x/p1.jpg", "https://x/p2.jpg"];
const spread = (props) => React.createElement(FeaturedSpread, {
  photos: PHOTOS, onClick: () => {}, videoHasEnded: false, onVideoEnd: () => {}, posterUrl: null, ...props,
});
const albumDisabled = () => q(".gc-photo-album").classList.contains("gc-album-disabled");

test("the wording is short and literally true", () => {
  assert.equal(TEXT.preparing, "Your video is being prepared. Please try again shortly.");
  assert.equal(TEXT.unavailable, "The video for this greeting is no longer available. The rest of your greeting is still here.");
});

test("preparing: the message, a Try again button, no dead player, and the album is usable", async () => {
  let retries = 0;
  await mount(spread({ videoUrl: null, videoStatus: "preparing", onRetryVideo: async () => { retries++; } }));
  assert.equal(q('[data-testid="gc-video-status-text"]').textContent, TEXT.preparing);
  assert.equal(q("video"), null, "no player for a null link");
  assert.equal(document.body.textContent.includes("Video greeting"), false, "not the generic placeholder");
  assert.equal(albumDisabled(), false, "the album is not held behind a video that cannot play yet");
  await click(q('[data-testid="gc-video-retry"]'));
  assert.equal(retries, 1);
  assert.equal(q('[data-testid="gc-video-retry"]').textContent, "Try again", "button is ready again after the re-read");
});

test("preparing then Try again returns the video: the player appears in place", async () => {
  function Harness() {
    const [g, setG] = React.useState({ videoUrl: null, videoStatus: "preparing" });
    return spread({ ...g, onRetryVideo: async () => setG({ videoUrl: "https://blob/v.mp4?sig=1", videoStatus: "ready" }) });
  }
  await mount(React.createElement(Harness));
  await click(q('[data-testid="gc-video-retry"]'));
  assert.equal(q("video").getAttribute("src"), "https://blob/v.mp4?sig=1");
  assert.equal(q('[data-testid="gc-video-status-text"]'), null);
});

test("preparing with no retry handler: message only, no button", async () => {
  await mount(React.createElement(VideoPlayer, { videoUrl: null, videoStatus: "preparing" }));
  assert.equal(q('[data-testid="gc-video-status-text"]').textContent, TEXT.preparing);
  assert.equal(q('[data-testid="gc-video-retry"]'), null);
});

test("a failed re-read keeps the message and lets the person try again", async () => {
  await mount(spread({ videoUrl: null, videoStatus: "preparing", onRetryVideo: async () => { throw new Error("offline"); } }));
  await click(q('[data-testid="gc-video-retry"]'));
  assert.equal(q('[data-testid="gc-video-status-text"]').textContent, TEXT.preparing);
  assert.equal(q('[data-testid="gc-video-retry"]').disabled, false);
});

test("unavailable: the message, no retry, no player, and the album is usable", async () => {
  await mount(spread({ videoUrl: null, videoStatus: "unavailable", onRetryVideo: async () => {} }));
  assert.equal(q('[data-testid="gc-video-status-text"]').textContent, TEXT.unavailable);
  assert.equal(q('[data-testid="gc-video-retry"]'), null, "nothing to retry: the video is gone");
  assert.equal(q("video"), null);
  assert.equal(albumDisabled(), false);
  assert.equal(document.querySelectorAll(".gc-photo-album img").length > 0, true, "the photos still render");
});

test("backward compatible: none, a missing field and corporate null all keep today's placeholder and album lock", async () => {
  for (const videoStatus of ["none", undefined, null]) {
    await mount(spread({ videoUrl: null, videoStatus }));
    assert.equal(q(".gc-video-placeholder-text").textContent, "Video greeting", `videoStatus=${videoStatus}`);
    assert.equal(q('[data-testid="gc-video-status-text"]'), null);
    assert.equal(albumDisabled(), true, `videoStatus=${videoStatus}: album behaviour unchanged`);
  }
});

test("ready (and an older backend with a link but no status): the player renders the link", async () => {
  for (const videoStatus of ["ready", undefined]) {
    await mount(spread({ videoUrl: "https://did/v.mp4", videoStatus }));
    assert.equal(q("video").getAttribute("src"), "https://did/v.mp4");
    assert.equal(q('[data-testid="gc-video-status-text"]'), null);
    assert.equal(albumDisabled(), true, "album still unlocks when the video ends, as before");
  }
});

test("wiring: the public card maps videoStatus and re-reads only the video fields; GreetingCard passes both props", () => {
  const page = readFileSync(join(__dirname, "../../pages/PublicGreetingCard.jsx"), "utf8");
  assert.match(page, /videoStatus: g\.videoStatus \|\| null,/);
  assert.match(page, /onRetryVideo=\{refreshVideo\}/);
  assert.match(page, /\{ \.\.\.cur, videoUrl: g\.videoUrl \|\| null, videoStatus: g\.videoStatus \|\| null \}/);
  const card = readFileSync(join(__dirname, "GreetingCard.jsx"), "utf8");
  assert.equal((card.match(/videoStatus=\{greeting\.videoStatus \|\| null\}/g) || []).length, 2, "both FeaturedSpread call sites");
  assert.equal((card.match(/onRetryVideo=\{onRetryVideo\}/g) || []).length, 2);
});
