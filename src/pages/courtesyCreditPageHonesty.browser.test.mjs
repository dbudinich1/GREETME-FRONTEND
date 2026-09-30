// src/pages/courtesyCreditPageHonesty.browser.test.mjs
//
// CREDIT CONTRACT INTEGRITY (2026-09-30, display-honesty correction) — MOUNTED proof that the
// legacy /courtesy-credit page can no longer create an apparent credit from a URL query
// parameter: it no longer parses `amount`, no longer displays a dollar figure derived from it,
// and no longer writes anything to `greetme_courtesy_credit` localStorage on any button click.
// Modeled on the same stub-edges esbuild pattern as checkoutCreditDisplay.browser.test.mjs — a
// NEW file, since it exercises a different page.
//
// NO NETWORK: `fetch` throws if anything ever reaches it — this page makes no API calls itself.
//
// Run (Node 20.x): node --test src/pages/courtesyCreditPageHonesty.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__ccph.bundle.mjs");
const ENTRY = join(__dirname, ".__ccph.entry.jsx");
const AUTH_STUB = join(__dirname, ".__ccph.auth.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB];

let React, createRoot, act, CourtesyCredit, MemoryRouter, Routes, Route, window;

before(async () => {
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => ({ user: null, isAuthenticated: false });\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");

  writeFileSync(ENTRY,
    'export { default as CourtesyCredit } from "./CourtesyCredit.jsx";\n'
    + 'export { MemoryRouter, Routes, Route } from "react-router-dom";\n');

  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{
      name: "stub-edges",
      setup(build) {
        const STUBS = new Map([
          ["../context/AuthContext", AUTH_STUB],
        ]);
        build.onResolve({ filter: /.*/ }, (a) => {
          const hit = STUBS.get(a.path);
          return hit ? { path: hit } : undefined;
        });
      },
    }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });

  const dom = new JSDOM('<!doctype html><html><body></body></html>', {
    url: "http://localhost/courtesy-credit",
    pretendToBeVisual: true,
  });
  window = dom.window;
  global.window = window;
  global.document = window.document;
  try { global.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  global.getComputedStyle = window.getComputedStyle;
  global.sessionStorage = window.sessionStorage;
  global.localStorage = window.localStorage;
  global.Event = window.Event;
  global.CustomEvent = window.CustomEvent;
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = async () => { throw new Error("no test may make a network request"); };
  window.fetch = global.fetch;
  window.matchMedia = window.matchMedia || ((q) => ({
    matches: false, media: q, addEventListener() {}, removeEventListener() {},
    addListener() {}, removeListener() {},
  }));

  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  ({ CourtesyCredit, MemoryRouter, Routes, Route } = await import(pathToFileURL(BUNDLE).href));
});
after(() => {
  for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
});

beforeEach(() => {
  window.localStorage.removeItem("greetme_courtesy_credit");
});

const text = (host) => (host.textContent || "").replace(/\s+/g, " ").trim();

async function mount(initialPath) {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: [initialPath] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/courtesy-credit", element: React.createElement(CourtesyCredit) })),
    ));
  });
  return { host, unmount: () => act(() => root.unmount()) };
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1 — A malicious/direct amount=999 visit displays no dollar figure and stores nothing.
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("1. visiting /courtesy-credit?amount=999 displays no $999 anywhere on the page", async () => {
  const m = await mount("/courtesy-credit?amount=999&source=finale");
  try {
    const body = text(m.host);
    assert.doesNotMatch(body, /\$999/, "the URL parameter must never surface as a displayed dollar amount");
    assert.equal(window.localStorage.getItem("greetme_courtesy_credit"), null, "nothing stored merely from visiting the page");
  } finally { await m.unmount(); }
});

test("2. clicking through from ?amount=999 still stores nothing in greetme_courtesy_credit", async () => {
  const m = await mount("/courtesy-credit?amount=999&source=finale");
  try {
    const btn = [...m.host.querySelectorAll("button")].find((b) => /Create Your Account/i.test(b.textContent || ""));
    assert.ok(btn, "the primary CTA must still be present and functional (no new flow invented)");
    await act(async () => { btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    assert.equal(window.localStorage.getItem("greetme_courtesy_credit"), null, "the primary CTA must not fabricate and store a credit from the URL");
  } finally { await m.unmount(); }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3 — A default, no-amount visit is equally honest — no implicit "$5" default is displayed either.
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("3. visiting /courtesy-credit with no amount param displays no dollar figure and stores nothing", async () => {
  const m = await mount("/courtesy-credit");
  try {
    const body = text(m.host);
    assert.doesNotMatch(body, /\$\d/, "no dollar amount of any kind is displayed absent a real, verified credit");
    assert.equal(window.localStorage.getItem("greetme_courtesy_credit"), null);
  } finally { await m.unmount(); }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 4 — The Thank-You entry point (an unrelated, real, unmodified flow) still works unchanged.
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("4. the 'Send a Thank You' CTA is still present and still carries a real jobId through untouched", async () => {
  const m = await mount("/courtesy-credit?jobId=job-abc-123");
  try {
    const btn = [...m.host.querySelectorAll("button")].find((b) => /Send a Thank You/i.test(b.textContent || ""));
    assert.ok(btn, "Thank-You entry point must remain — this correction does not touch Thank-You/Share behavior");
  } finally { await m.unmount(); }
});
