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

// D9f Q1 (founder, 2026-10-10): an unclaimed gift withdrawn after delivery gets the card's $5 Greet-Me
// Credit. The server returns courtesyCreditCode for such a card only once that credit exists; the card
// keeps the literal truth and shows the EXISTING credit QR beneath it. (Supersedes the Release 2b
// expectation "a withdrawn gift is never replaced by a courtesy-credit offer".)
test("withdrawn gift WITH a server credit: the truth line, then the existing $5 credit QR beneath it", async () => {
  const h = await mount({ hasGift: true, gift: GIFT, giftAvailable: false, courtesyCreditCode: "CC-1" });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const t = text(h);
  const truth = h.querySelector('[data-testid="gift-withdrawn"]');
  assert.ok(truth, t);
  assert.match(t, /This gift is no longer available\./);
  const link = h.querySelector('a[href$="/#/claim-credit/CC-1"]');
  assert.ok(link, "the existing credit QR link");
  assert.equal(link.getAttribute("aria-label"), "Claim your $5 Greet-Me credit");
  assert.ok(h.querySelector("img[alt='Scan to claim your $5 Greet-Me credit']"), "the existing credit QR image");
  assert.ok(truth.compareDocumentPosition(link) & window.Node.DOCUMENT_POSITION_FOLLOWING, "credit renders beneath the truth line");
  assert.match(t, /Scan or tap to claim your \$5 Greet-Me Credit/);
  for (const banned of ["A little something extra", "Scan or tap to open your gift", "A Gift From", "Sent especially for you", "Scan or tap to claim your gift"]) {
    assert.equal(t.includes(banned), false, `must not show "${banned}"`);
  }
  assert.equal(h.querySelector(`a[href="${GIFT.claimUrl}"]`), null, "the withdrawn gift stays unclaimable");
  assert.doesNotMatch(t, /refund|payment/i, "never says why");
});

test("withdrawn gift WITHOUT a credit: only the truth line (no credit, no 'Sent especially for you')", async () => {
  const h = await mount({ hasGift: true, gift: GIFT, giftAvailable: false, courtesyCreditCode: null });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const t = text(h);
  assert.match(t, /This gift is no longer available\./);
  assert.equal(h.querySelector('a[href*="/claim-credit/"]'), null);
  assert.equal(t.includes("Sent especially for you"), false);
});

test("sender viewing a withdrawn gift's credit sees the owner caption", async () => {
  const h = await mount({ hasGift: true, gift: GIFT, giftAvailable: false, courtesyCreditCode: "CC-1", isOwner: true });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  assert.match(text(h), /Included with your greeting/);
});

test("gift-free card keeps today's credit caption; no credit keeps 'Sent especially for you'", async () => {
  const a = await mount({ hasGift: false, gift: null, courtesyCreditCode: "CC-2" });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  assert.match(text(a), /Scan or tap to claim your gift/);
  assert.equal(a.querySelector('[data-testid="gift-withdrawn"]'), null);
  const b = await mount({ hasGift: false, gift: null, courtesyCreditCode: null });
  assert.match(text(b), /Sent especially for you\./);
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
