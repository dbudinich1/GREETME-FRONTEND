// LANE 3 — BROWSER-LEVEL proof of the shared personalization controls and Preview My Card.
// The real components (FeaturedMediaChooser, PhotoUpload, VoiceRecorder, VideoFilePicker,
// PreviewMyCard, and the EXISTING GreetingCard renderer) are esbuild-bundled and mounted in jsdom.
// Every network path (fetch, XMLHttpRequest, sendBeacon) is a counting trap: the preview must make
// no request at all.
// Run (Node 20.x): node --test src/components/personalization/personalization.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { emptySelection } from "./featuredMediaModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
// CLEAN_SCRATCH: scratch files carry this process id in their name; all are removed on exit.
import { readdirSync as __scratchLs, rmSync as __scratchRm } from "node:fs";
process.on("exit", () => { try { for (const n of __scratchLs(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __scratchRm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const ENTRY = join(__dirname, `.__pm.${process.pid}.entry.jsx`);
const BUNDLE = join(__dirname, `.__pm.${process.pid}.bundle.mjs`);

let React, createRoot, act, M, window;
const net = [];

before(async () => {
  writeFileSync(ENTRY, `
    export { default as FeaturedMediaChooser } from "./FeaturedMediaChooser.jsx";
    export { default as PreviewMyCard } from "./PreviewMyCard.jsx";
    export * from "./featuredMediaModel.js";
  `);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".js": "jsx", ".css": "empty", ".jpg": "dataurl", ".jpeg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  try { globalThis.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.KeyboardEvent = window.KeyboardEvent; globalThis.MouseEvent = window.MouseEvent;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.FileReader = window.FileReader; globalThis.File = window.File; globalThis.FormData = window.FormData;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.Audio = window.Audio = class { constructor() { this.volume = 1; this.currentTime = 0; } play() { return Promise.resolve(); } pause() {} load() {} };
  window.HTMLMediaElement.prototype.play = function () { return Promise.resolve(); };
  window.HTMLMediaElement.prototype.pause = function () {};
  window.HTMLMediaElement.prototype.load = function () {};
  // reduced motion → the card's own short transitions
  window.matchMedia = (q) => ({ matches: /reduce/.test(q), media: q, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {} });
  window.document.fonts = { ready: Promise.resolve() };
  let n = 0;
  globalThis.URL.createObjectURL = () => `blob:local/${++n}`;
  globalThis.URL.revokeObjectURL = () => {};
  // Network traps.
  const trap = (kind) => (...a) => { net.push([kind, ...a]); return Promise.reject(new Error("network disabled in test")); };
  globalThis.fetch = window.fetch = trap("fetch");
  window.XMLHttpRequest = globalThis.XMLHttpRequest = class { open(...a) { net.push(["xhr", ...a]); } send() {} setRequestHeader() {} };
  window.navigator.sendBeacon = (...a) => { net.push(["beacon", ...a]); return false; };
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

let root;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const flush = async (ms = 0) => { await act(async () => { await sleep(ms); }); };
const q = (sel) => document.querySelector(sel);
const qa = (sel) => [...document.querySelectorAll(sel)];
const tid = (t) => q(`[data-testid="${t}"]`);
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await flush(); };
const key = async (k) => { await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: k })); }); };
async function mount(element) {
  if (root) { await act(async () => { root.unmount(); }); }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(element); });
  await flush();
}

// A controlled host, exactly how a flow owns its own selection.
function Host({ initial, onSel, prefix = "t" }) {
  const [sel, setSel] = React.useState(initial || emptySelection());
  return React.createElement(M.FeaturedMediaChooser, {
    idPrefix: prefix, selection: sel, libraryPhotos: [], onChange: (s) => { setSel(s); onSel && onSel(s); },
  });
}
const pick = async (prefix, mode) => { await act(async () => { q(`#${prefix}-mode-${mode}`).click(); }); await flush(); };

test("each of the four choices reveals only its own controls", async () => {
  await mount(React.createElement(Host));
  assert.deepEqual(qa('input[type="radio"]').map((r) => r.value), ["animate", "static", "video", "none"]);
  assert.equal(tid("t-controls"), null, "No featured media starts with no media controls");

  await pick("t", "animate");
  assert.ok(tid("t-control-photo") && tid("t-control-voice"));
  assert.equal(tid("t-control-video"), null);
  assert.match(tid("t-control-voice").textContent, /Required/);

  await pick("t", "static");
  assert.ok(tid("t-control-photo") && tid("t-control-voice"));
  assert.match(tid("t-control-voice").textContent, /Optional/);
  assert.doesNotMatch(tid("t-control-voice").textContent, /Read this script/, "a voice message has no voice-sample script");

  await pick("t", "video");
  assert.ok(tid("t-control-video"));
  assert.equal(tid("t-control-photo"), null); assert.equal(tid("t-control-voice"), null);

  await pick("t", "none");
  assert.equal(tid("t-controls"), null);
  assert.ok(tid("t-control-message"), "the optional message is always available");
});

test("founder copy 2026-10-29: supporting text, three main choices, and No featured media as a quieter choice in the same group", async () => {
  await mount(React.createElement(Host));
  assert.equal(tid("t-intro").textContent, "Make it unmistakably yours. Bring your photo to life with your voice, share a favorite image or upload a personal video. Add cherished memories and a heartfelt message to make their Greet-Me even more meaningful.");
  const main = qa(".gcd-bubble").map((b) => [b.querySelector(".gcd-bubble-label").textContent, b.querySelector(".gcd-bubble-note").textContent]);
  assert.deepEqual(main, [["Greet-Me Animation", "Bring your photo to life with your voice."], ["Still Photo", "Let a meaningful image speak—or add your voice."], ["Personal Video", "Share a greeting recorded your way."]]);
  const quiet = q(".pm-quiet-choice");
  assert.ok(quiet, "No featured media is shown as the quieter option");
  assert.match(quiet.textContent, /No featured media/);
  const radios = qa('input[type="radio"]');
  assert.equal(new Set(radios.map((r) => r.name)).size, 1, "one radio group for all four");
  await pick("t", "none");
  assert.equal(q("#t-mode-none").checked, true);
});

test("animate requires a voice: the error shows until a voice is chosen", async () => {
  const photo = { url: "https://x/p.jpg", source: "upload" };
  await mount(React.createElement(Host, { initial: { ...emptySelection(), mode: "animate", photo } }));
  assert.equal(tid("t-error-photo"), null, "photo is satisfied");
  assert.match(tid("t-error-voice").textContent, /Record your voice/);
  await mount(React.createElement(Host, { initial: { ...emptySelection(), mode: "animate", photo, voice: { url: "blob:v", source: "recording" } } }));
  assert.equal(tid("t-error-voice"), null);
  // static: no voice is fine
  await mount(React.createElement(Host, { initial: { ...emptySelection(), mode: "static", photo } }));
  assert.equal(tid("t-error-voice"), null);
});

test("the photo is captured through the EXISTING PhotoUpload, kept local, with no upload request", async () => {
  let last = null;
  await mount(React.createElement(Host, { onSel: (s) => { last = s; }, initial: { ...emptySelection(), mode: "static" } }));
  const input = tid("t-control-photo").querySelector('input[type="file"]');
  const file = new window.File([new Uint8Array([137, 80, 78, 71])], "me.png", { type: "image/png" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new window.Event("change", { bubbles: true })); });
  await flush(30);
  const use = [...tid("t-control-photo").querySelectorAll("button")].find((b) => /Use this photo/.test(b.textContent));
  assert.ok(use, "PhotoUpload shows its confirm button with the shared label");
  await click(use);
  await flush(10);
  assert.equal(last.photo.source, "upload");
  assert.match(last.photo.url, /^blob:local\//);
  assert.ok(tid("t-chosen-photo"), "the chosen photo is shown");
  assert.equal(net.length, 0, "nothing was uploaded");
});

test("the video is chosen through VideoFilePicker and validated", async () => {
  let last = null;
  await mount(React.createElement(Host, { onSel: (s) => { last = s; }, initial: { ...emptySelection(), mode: "video" } }));
  const input = tid("t-video-input");
  const bad = new window.File(["x"], "doc.pdf", { type: "application/pdf" });
  Object.defineProperty(input, "files", { value: [bad], configurable: true });
  await act(async () => { input.dispatchEvent(new window.Event("change", { bubbles: true })); });
  assert.ok(tid("t-video-picker").querySelector('[role="alert"]'), "a non-video file is refused");
  const ok = new window.File(["x"], "hello.mp4", { type: "video/mp4" });
  Object.defineProperty(input, "files", { value: [ok], configurable: true });
  await act(async () => { input.dispatchEvent(new window.Event("change", { bubbles: true })); });
  await click(tid("t-video-use"));
  assert.equal(last.mode, "video"); assert.equal(last.video.name, "hello.mp4");
  assert.equal(net.length, 0);
});

test("an individual send and a campaign keep separate selections (same controls, separate contexts)", async () => {
  let indiv = null; let camp = null;
  await mount(React.createElement("div", null,
    React.createElement(Host, { prefix: "ind", onSel: (s) => { indiv = s; } }),
    React.createElement(Host, { prefix: "cmp", onSel: (s) => { camp = s; } })));
  await pick("ind", "video");
  assert.equal(indiv.mode, "video");
  assert.equal(camp, null, "the campaign's choice did not change");
  assert.equal(q("#cmp-mode-none").checked, true);
  await pick("cmp", "static");
  assert.equal(camp.mode, "static"); assert.equal(indiv.mode, "video");
});

// ── Preview My Card ─────────────────────────────────────────────────────────────────────────
const ANA = { id: "ana", name: "Ana", memoryPhotos: ["https://x/ana1.jpg", { url: "https://x/ana2.jpg" }] };
const BEN = { id: "ben", name: "Ben", memoryPhotos: [] };
const CARA = { id: "cara", name: "Cara", memoryPhotos: ["https://x/cara1.jpg"] };
const VIDEO = { ...emptySelection(), mode: "video", video: { url: "blob:local/video", source: "upload" } };
const NONE = emptySelection();

async function openPreview(selection, recipients) {
  await mount(React.createElement(M.PreviewMyCard, { idPrefix: "pv", selection, recipients, senderName: "Acme" }));
  await click(tid("pv-preview-open"));
  assert.ok(tid("pv-preview"), "the preview opens");
  // Leave the envelope (the card's own keyboard navigation).
  await key("ArrowRight"); await flush(250);
}
const dots = () => qa(".gc-page-dot").length;
async function toFeaturedOrFinale() { await key("ArrowRight"); await flush(250); await key("ArrowRight"); await flush(250); }

test("preview rule 1: featured media + memory photos -> media first, then that recipient's memories", async () => {
  net.length = 0;
  await openPreview(VIDEO, [ANA]);
  assert.match(tid("pv-preview-notice").textContent, /Nothing is sent, charged or ordered/);
  assert.equal(dots(), 4, "Cover, Intro, Featured, Final");
  await toFeaturedOrFinale();
  assert.equal(tid("pfs").dataset.layout, "media_then_memories");
  assert.ok(tid("pfs-video"));
  assert.ok(tid("pfs-memories"));
  const srcs = qa('[data-testid="pfs-memories"] img').map((i) => i.getAttribute("src"));
  assert.ok(srcs.every((s) => s.startsWith("https://x/ana")), JSON.stringify(srcs));
  assert.equal(net.length, 0, "no request");
});

test("preview rule 2: featured media alone -> the full Featured Spread", async () => {
  await openPreview(VIDEO, [BEN]);
  assert.equal(dots(), 4);
  await toFeaturedOrFinale();
  assert.equal(tid("pfs").dataset.layout, "media_full");
  assert.equal(tid("pfs-memories"), null);
});

test("preview rule 3: memory photos alone -> full-spread memories (with music)", async () => {
  await openPreview(NONE, [CARA]);
  assert.equal(dots(), 4);
  await toFeaturedOrFinale();
  assert.equal(tid("pfs").dataset.layout, "memories_full");
  assert.equal(q(".gc-photo-album").classList.contains("gc-album-disabled"), false, "album (and its music) plays at once");
});

test("preview rule 4: neither -> no Featured Spread; Intro and Final remain", async () => {
  await openPreview(NONE, [BEN]);
  assert.equal(dots(), 3, "Cover, Intro, Final");
  await toFeaturedOrFinale();
  assert.equal(tid("pfs"), null);
  assert.ok(q(".gc-finale-spread"), "the Final spread follows the Intro");
});

test("preview uses the UNSAVED selection, switches recipients without mixing their photos, and makes no request", async () => {
  net.length = 0;
  const unsaved = { ...emptySelection(), mode: "static", photo: { url: "blob:local/unsaved", source: "upload" }, message: "From all of us" };
  await openPreview(unsaved, [ANA, CARA]);
  assert.equal(tid("pv-preview").querySelector(".pm-preview-stage").dataset.memoryCount, "2");
  // Intro page carries the message (no animation).
  await key("ArrowRight"); await flush(250);
  assert.match(q(".gc-interior-spread").textContent, /From all of us/);
  await key("ArrowRight"); await flush(250);
  assert.equal(q(".gc-pfs-photo").getAttribute("src"), "blob:local/unsaved", "the draft photo, never a saved one");
  // switch recipient
  const sel = tid("pv-preview-recipient");
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set.call(sel, "cara");
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await flush();
  assert.equal(tid("pv-preview").querySelector(".pm-preview-stage").dataset.memoryCount, "1");
  await key("ArrowRight"); await flush(250); await toFeaturedOrFinale(); await flush(50);
  const srcs = qa('[data-testid="pfs-memories"] img').map((i) => i.getAttribute("src"));
  assert.ok(srcs.length > 0 && srcs.every((s) => s === "https://x/cara1.jpg"), JSON.stringify(srcs));
  await click(tid("pv-preview-close"));
  assert.equal(tid("pv-preview"), null);
  assert.equal(net.length, 0, "no fetch, XHR or beacon");
});

test("with animation the message stays off the Intro page (existing spoken behavior)", async () => {
  const anim = { ...emptySelection(), mode: "animate", photo: { url: "blob:local/p" }, voice: { url: "blob:local/v" }, message: "Shaping words" };
  await openPreview(anim, [BEN]);
  await key("ArrowRight"); await flush(250);
  assert.doesNotMatch(q(".gc-interior-spread").textContent, /Shaping words/);
  await key("ArrowRight"); await flush(250);
  assert.ok(tid("pfs-animate"), "the photo shows with the animation note; no animation is requested");
  assert.equal(net.length, 0);
});
