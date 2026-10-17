// src/components/GreetingCardProto/finaleSpreadSample.browser.test.mjs
//
// LANDING SAMPLE GREET-ME — the finale's optional `sample` input (founder-authorized player change). Mounted
// against the REAL FinaleSpread (jsdom; no network):
//   - with `sample` and no credit code: the QR and the fallback link point to sample.qrTarget (never
//     /claim-credit/), and a tap calls sample.onCreditTap without navigating;
//   - without `sample`: the courtesy-credit QR and link are exactly today's (/claim-credit/<code>, no click
//     handler), and with no credit code nothing claimable is shown.
//
// Run (Node 20.x): node --test src/components/GreetingCardProto/finaleSpreadSample.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const P = (n) => join(__dirname, `.__fssample.${process.pid}.${n}`);
const BUNDLE = P("bundle.mjs"), ENTRY = P("entry.jsx"), QR_STUB = P("qr.js");
const TEMP = [BUNDLE, ENTRY, QR_STUB];
let React, createRoot, act, M, window;

before(async () => {
  // The QR stub can be held (never resolves) to show the link the finale renders while the QR is drawing.
  writeFileSync(QR_STUB, "export default { toDataURL: (url) => { globalThis.__qrUrls.push(url); return globalThis.__qrHold ? new Promise(() => {}) : Promise.resolve('data:image/png;base64,AAAA'); } };\n");
  writeFileSync(ENTRY, 'export { default as FinaleSpread } from "./FinaleSpread.jsx";\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{ name: "stub-qr", setup(b) { b.onResolve({ filter: /^qrcode$/ }, () => ({ path: QR_STUB })); } }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/#/", pretendToBeVisual: true });
  window = dom.window;
  Object.assign(global, { window, document: window.document, HTMLElement: window.HTMLElement, Node: window.Node, getComputedStyle: window.getComputedStyle, Event: window.Event });
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = async () => { throw new Error("no test may make a network request"); };
  window.document.fonts = { ready: Promise.resolve() };
  global.document.fonts = window.document.fonts;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

const TARGET = "http://localhost/#/?sample=credit";
async function mount(props, { hold = false } = {}) {
  globalThis.__qrUrls = []; globalThis.__qrHold = hold;
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(M.FinaleSpread, { finaleText: "Forget them not.", occasionKey: "just_because", isOwner: false, hasGift: false, ...props }));
  });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return host;
}
const click = async (el) => {
  const ev = new window.MouseEvent("click", { bubbles: true, cancelable: true });
  await act(async () => { el.dispatchEvent(ev); });
  return ev;
};

test("with `sample`: the QR encodes and links to the sample target, and a tap opens the sample reveal", async () => {
  let taps = 0;
  const h = await mount({ courtesyCreditCode: null, sample: { qrTarget: TARGET, onCreditTap: () => { taps += 1; } } });
  assert.deepEqual(globalThis.__qrUrls, [TARGET], "the QR image encodes the sample target");
  const a = h.querySelector('a[aria-label="Claim your $5 Greet-Me credit"]');
  assert.ok(a, "the QR is shown");
  assert.equal(a.getAttribute("href"), TARGET);
  assert.equal(h.querySelector('a[href*="claim-credit"]'), null, "never a /claim-credit/ link");
  const ev = await click(a);
  assert.equal(taps, 1, "the tap opens the sample reveal");
  assert.equal(ev.defaultPrevented, true, "and does not navigate");
});

test("with `sample`, while the QR is still drawing: the text link also opens the sample reveal", async () => {
  let taps = 0;
  const h = await mount({ courtesyCreditCode: null, sample: { qrTarget: TARGET, onCreditTap: () => { taps += 1; } } }, { hold: true });
  const link = [...h.querySelectorAll("a")].find((x) => x.getAttribute("href") === TARGET);
  assert.ok(link, "the fallback link points to the sample target");
  const ev = await click(link);
  assert.equal(taps, 1);
  assert.equal(ev.defaultPrevented, true);
});

test("without `sample`: today's courtesy-credit QR and link, unchanged", async () => {
  const h = await mount({ courtesyCreditCode: "ABC123" });
  assert.deepEqual(globalThis.__qrUrls, ["http://localhost/#/claim-credit/ABC123"]);
  const a = h.querySelector('a[aria-label="Claim your $5 Greet-Me credit"]');
  assert.equal(a.getAttribute("href"), "http://localhost/#/claim-credit/ABC123");
  assert.equal(a.getAttribute("target"), "_blank");
  const ev = await click(a);
  assert.equal(ev.defaultPrevented, false, "a real credit link still navigates");

  const held = await mount({ courtesyCreditCode: "ABC123" }, { hold: true });
  assert.ok(held.querySelector('a[href="/#/claim-credit/ABC123"]'), "the fallback link is today's");
});

test("without `sample` and without a credit code: nothing claimable, as today", async () => {
  const h = await mount({ courtesyCreditCode: null });
  assert.deepEqual(globalThis.__qrUrls, []);
  assert.equal(h.querySelector('a[aria-label="Claim your $5 Greet-Me credit"]'), null);
  assert.match(h.textContent, /Sent especially for you\./);
});
