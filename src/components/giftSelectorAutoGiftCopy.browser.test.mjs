// src/components/giftSelectorAutoGiftCopy.browser.test.mjs
//
// AUTO-GIFT COPY HONESTY, mounted against the REAL GiftSelectorModal (jsdom).
//
// Scheduled QR Cash (W07 Option B) is approved but not live: there is no automatic QR Cash send, so the
// generic "Gift will be sent automatically on the occasion date." must not appear for a QR Cash gift.
// It stays for gift types that really auto-send. The availability is ONE constant
// (src/config/scheduledQrCash.js, not wired to the backend flag); a second bundle with that constant
// flipped to true proves the QR Cash case then falls back to the ordinary Auto-Gift behavior.
//
// Run (Node 20.x): node --test src/components/giftSelectorAutoGiftCopy.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__gsag.entry.jsx");
const OFF = join(__dirname, ".__gsag.off.mjs");
const ON = join(__dirname, ".__gsag.on.mjs");
const FLAG_ON_STUB = join(__dirname, ".__gsag.flagon.js");
const FLAG_OFF_STUB = join(__dirname, ".__gsag.flagoff.js");
const TEMP = [ENTRY, OFF, ON, FLAG_ON_STUB, FLAG_OFF_STUB];
const HONEST = "QR Cash is sent when you send the Greet-Me. Scheduled QR Cash is not available yet.";
const CLAIM = "Gift will be sent automatically on the occasion date.";
const REMIND = "We'll remind you 10 days before so you can confirm your gift.";
const REMINDER = "You'll receive a reminder 10 days before to confirm.";
let React, createRoot, act, SelectorOff, SelectorOn;

async function bundle(outfile, flagOn) {
  await esbuild.build({
    entryPoints: [ENTRY], outfile, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty" },
    // Release 2 activation: the shipped constant is TRUE, so the OFF bundle forces the unavailable state through its own stub.
    plugins: [{ name: flagOn ? "flag-on" : "flag-off", setup(b) { b.onResolve({ filter: /config\/scheduledQrCash$/ }, () => ({ path: flagOn ? FLAG_ON_STUB : FLAG_OFF_STUB })); } }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
}

before(async () => {
  writeFileSync(ENTRY, 'export { default as Selector } from "./GiftSelectorModal.jsx";\n');
  writeFileSync(FLAG_ON_STUB, `export const SCHEDULED_QRCASH_AVAILABLE = true;\nexport const SCHEDULED_QRCASH_UNAVAILABLE_COPY = ${JSON.stringify(HONEST)};\n`);
  writeFileSync(FLAG_OFF_STUB, `export const SCHEDULED_QRCASH_AVAILABLE = false;\nexport const SCHEDULED_QRCASH_UNAVAILABLE_COPY = ${JSON.stringify(HONEST)};\n`);
  await bundle(OFF, false);
  await bundle(ON, true);
  const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  Object.assign(global, { window, document: window.document, HTMLElement: window.HTMLElement, Node: window.Node, Event: window.Event, CustomEvent: window.CustomEvent, getComputedStyle: window.getComputedStyle });
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Selector: SelectorOff } = await import(pathToFileURL(OFF).href));
  ({ Selector: SelectorOn } = await import(pathToFileURL(ON).href));
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

const q = (id) => document.querySelector(`[data-testid="${id}"]`);
const bodyText = () => (document.body.textContent || "").replace(/\s+/g, " ");

async function mount(Selector, setting, context = "recipient") {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(Selector, {
      isOpen: true, onClose() {}, occasions: [{ type: "birthday", date: "2026-11-14" }],
      occasionGiftSettings: { birthday: setting }, onGiftChange() {},
      getOccasionLabel: () => "Birthday", getOccasionEmoji: () => "x", context, onBrowse() {},
    }));
  });
}
const checkbox = () => document.querySelector('[data-testid="auto-gift-block"] input[type="checkbox"]');

test("QR Cash: no automatic-send claim, honest copy, Auto-Gift cannot be turned on (even for a previously stored autoGift:true)", async () => {
  for (const autoGift of [true, false]) {
    await mount(SelectorOff, { type: "qrcash", amount: 25, autoGift });
    assert.equal(q("auto-gift-copy").textContent, HONEST, `autoGift=${autoGift}`);
    assert.doesNotMatch(bodyText(), /sent automatically/i, "the false claim is not reachable for QR Cash");
    assert.equal(checkbox().disabled, true);
    assert.equal(checkbox().checked, false, "shown off even if a stale autoGift:true is stored");
    assert.match(q("auto-gift-block").textContent, /Manual/);
    assert.doesNotMatch(q("auto-gift-block").textContent, /\bAuto\b(?!-)/, "the badge reads Manual, never Auto");
  }
});

test("curated and marketplace gifts are never claimed as sent automatically: the 10-day confirm reminder shows instead, with a working toggle", async () => {
  for (const type of ["curated", "marketplace"]) {
    await mount(SelectorOff, { type, maxSpend: 50, autoGift: true });
    assert.equal(q("auto-gift-copy").textContent, REMIND, type);
    assert.equal(checkbox().disabled, false, type);
    assert.equal(checkbox().checked, true, type);
    assert.match(q("auto-gift-block").textContent, /Auto/);
    await mount(SelectorOff, { type, maxSpend: 50, autoGift: false });
    assert.equal(q("auto-gift-copy").textContent, REMINDER, type);
    assert.equal(checkbox().checked, false, type);
  }
});

test("no gift selected: no Auto-Gift block at all", async () => {
  await mount(SelectorOff, { type: "none" });
  assert.equal(q("auto-gift-block"), null);
});

test("immediate-send (oneoff) context never shows Auto-Gift, for any gift type", async () => {
  for (const type of ["qrcash", "curated", "marketplace"]) {
    await mount(SelectorOff, { type, amount: 25, maxSpend: 50, autoGift: true }, "oneoff");
    assert.equal(q("auto-gift-block"), null, type);
    assert.doesNotMatch(bodyText(), /sent automatically/i, type);
  }
});

test("when the single availability constant is flipped to true, QR Cash falls back to the ordinary Auto-Gift behavior", async () => {
  await mount(SelectorOn, { type: "qrcash", amount: 25, autoGift: true });
  assert.equal(q("auto-gift-copy").textContent, CLAIM);
  assert.equal(checkbox().disabled, false);
  assert.equal(checkbox().checked, true);
  await mount(SelectorOn, { type: "qrcash", amount: 25, autoGift: false });
  assert.equal(q("auto-gift-copy").textContent, REMINDER);
});

test("the availability is one constant, shipped ON by the Release 2 activation (founder decision #7), not wired to anything", () => {
  const cfg = readFileSync(join(__dirname, "..", "config", "scheduledQrCash.js"), "utf8");
  assert.match(cfg, /export const SCHEDULED_QRCASH_AVAILABLE = true;/);
  assert.equal((cfg.match(/export const /g) || []).length, 2, "the flag and its copy, nothing else");
  assert.doesNotMatch(cfg.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n"), /import |process\.env|import\.meta|fetch\(|api\./, "no wiring to env or the backend");
});
