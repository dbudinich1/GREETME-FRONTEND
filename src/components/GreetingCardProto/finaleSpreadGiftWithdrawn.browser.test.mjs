// src/components/GreetingCardProto/finaleSpreadGiftWithdrawn.browser.test.mjs
//
// RELEASE 2b — the greeting card's gift page tells the truth about a withdrawn gift. Mounted against
// the REAL FinaleSpread (jsdom; no network). Founder (2026-10-07): what Greet-Me presents must be
// literally true. The public greeting endpoint sends giftAvailable === false ONLY when a stored fact
// withdrew the attached gift (e.g. its payment was fully refunded); then the card must not show the
// gift QR, the claim link, "A little something extra" or "Scan or tap to open your gift". Unknown
// (null/undefined) keeps today's rendering exactly.
//
// Run (Node 20.x): node --test src/components/GreetingCardProto/finaleSpreadGiftWithdrawn.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const P = (n) => join(__dirname, `.__fsgw.${n}`);
const BUNDLE = P("bundle.mjs"), ENTRY = P("entry.jsx"), QR_STUB = P("qr.js");
const TEMP = [BUNDLE, ENTRY, QR_STUB];
let React, createRoot, act, M, window;

before(async () => {
  writeFileSync(QR_STUB, "export default { toDataURL: async () => 'data:image/png;base64,AAAA' };\n");
  writeFileSync(ENTRY, 'export { default as FinaleSpread } from "./FinaleSpread.jsx";\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{ name: "stub-qr", setup(b) { b.onResolve({ filter: /^qrcode$/ }, () => ({ path: QR_STUB })); } }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/g/job-1", pretendToBeVisual: true });
  window = dom.window;
  Object.assign(global, { window, document: window.document, HTMLElement: window.HTMLElement, Node: window.Node, getComputedStyle: window.getComputedStyle, Event: window.Event });
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = async () => { throw new Error("no test may make a network request"); };
  // FinaleSpread re-runs auto-fit after web fonts load.
  window.document.fonts = { ready: Promise.resolve() };
  global.document.fonts = window.document.fonts;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

const GIFT = Object.freeze({ type: "qrcash", claimToken: "t1", claimUrl: "https://app.example/#/gift/t1", qrUrl: "https://blob.example/qr.png" });

async function mount(props) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(M.FinaleSpread, { finaleText: "With love.", occasionKey: "birthday", isOwner: false, ...props }));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return host;
}
const text = (h) => (h.textContent || "").replace(/\s+/g, " ");

test("giftAvailable === false: no gift QR, no claim link, none of the gift copy — only the literal truth", async () => {
  const h = await mount({ hasGift: true, gift: GIFT, giftAvailable: false, courtesyCreditCode: null });
  const t = text(h);
  assert.ok(h.querySelector('[data-testid="gift-withdrawn"]'), t);
  assert.match(t, /This gift is no longer available\./);
  for (const banned of ["A little something extra", "Scan or tap to open your gift", "A gift is included with this greeting", "Tap here to claim your gift", "A Gift From"]) {
    assert.equal(t.includes(banned), false, `must not show "${banned}"`);
  }
  assert.equal(h.querySelector(`a[href="${GIFT.claimUrl}"]`), null, "no claim link");
  assert.equal(h.querySelector("img[alt='Scan to open your gift']"), null, "no gift QR");
  assert.doesNotMatch(t, /refund|payment/i, "never says why");
});

test("a withdrawn gift is never replaced by a courtesy-credit offer", async () => {
  const h = await mount({ hasGift: true, gift: GIFT, giftAvailable: false, courtesyCreditCode: "CC-1" });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  assert.equal(h.querySelector('a[href*="/claim-credit/"]'), null);
  assert.match(text(h), /This gift is no longer available\./);
});

test("unknown availability (null / undefined) and true keep today's gift page exactly", async () => {
  for (const giftAvailable of [undefined, null, true]) {
    const h = await mount({ hasGift: true, gift: GIFT, giftAvailable, courtesyCreditCode: null });
    const t = text(h);
    assert.match(t, /A little something extra/, String(giftAvailable));
    assert.match(t, /Scan or tap to open your gift/);
    assert.ok(h.querySelector(`a[href="${GIFT.claimUrl}"]`));
    assert.equal(h.querySelector('[data-testid="gift-withdrawn"]'), null);
  }
});

test("a card with no gift is unaffected by a stray giftAvailable: false", async () => {
  const h = await mount({ hasGift: false, gift: null, giftAvailable: false, courtesyCreditCode: null });
  const t = text(h);
  assert.match(t, /A Gift From/);
  assert.equal(h.querySelector('[data-testid="gift-withdrawn"]'), null);
});

test("the public page passes only a definite false through, and both card mounts forward it", () => {
  const page = readFileSync(join(__dirname, "..", "..", "pages", "PublicGreetingCard.jsx"), "utf8");
  assert.match(page, /giftAvailable: g\.giftAvailable === false \? false : null,/);
  const card = readFileSync(join(__dirname, "GreetingCard.jsx"), "utf8");
  assert.equal((card.match(/giftAvailable=\{greeting\.giftAvailable\}/g) || []).length, 2);
});
