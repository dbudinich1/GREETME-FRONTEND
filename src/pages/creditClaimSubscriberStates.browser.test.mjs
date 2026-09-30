// src/pages/creditClaimSubscriberStates.browser.test.mjs
//
// CREDIT CONTRACT INTEGRITY (2026-09-29, required follow-up) — MOUNTED proof that
// CreditClaim.jsx renders its own restrained, honest copy for the two expected-not-broken claim
// outcomes (CREDIT_SUBSCRIBER_INELIGIBLE, CREDIT_STATUS_UNVERIFIABLE), instead of falling through
// to the generic "Something went wrong" error screen. Modeled directly on the existing
// giftClaimManualReview.browser.test.mjs harness (same stub-edges esbuild plugin, same stubbed
// AuthContext/api/useAccountState edges) — a NEW file, since it exercises a different page.
//
// NO NETWORK: `fetch` throws if anything ever reaches it; every response here is a fixture the
// fake api module returns directly, matching api.js's real error-throwing shape (403/503 throw an
// Error with .code set) so this proves the actual component logic, not a hand-simplified stand-in.
//
// Run (Node 20.x): node --test src/pages/creditClaimSubscriberStates.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__ccss.bundle.mjs");
const ENTRY = join(__dirname, ".__ccss.entry.jsx");
const AUTH_STUB = join(__dirname, ".__ccss.auth.js");
const API_STUB = join(__dirname, ".__ccss.api.js");
const ACCT_STUB = join(__dirname, ".__ccss.acct.js");
const STORAGE_STUB = join(__dirname, ".__ccss.storage.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, ACCT_STUB, STORAGE_STUB];

let React, createRoot, act, CreditClaim, MemoryRouter, Routes, Route, window, apiMod;

const CODE = "code-sub-states-1";

before(async () => {
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => ({ isAuthenticated: true, register: async () => ({ success: false }), login: async () => ({ success: false }) });\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");

  writeFileSync(ACCT_STUB,
    "export const useAccountState = () => ({ isSubscribed: false });\n"
    + "export default { useAccountState };\n");

  // safeGet/safeSet read/write 'token' + 'user' for preAuthSnapshot — seeded so
  // isSenderViewingOwnCredit (senderUserId comparison) resolves to a DIFFERENT account than the
  // fixture's senderUserId, so these tests reach the claim button, not the self-claim screen.
  writeFileSync(STORAGE_STUB,
    "export const safeGet = (k) => ({ token: 'fake-token', user: JSON.stringify({ id: 'viewer-1' }) }[k] ?? null);\n"
    + "export const safeSet = () => {};\n"
    + "export const safeSessionSet = () => {};\n"
    + "export const safeSessionRemove = () => {};\n");

  // The api module — CreditClaim.jsx calls the single generic `api.request(path, opts)`. This
  // fake inspects the path/method and returns exactly what the real backend route would for each
  // fixture, throwing 403/503 the same shape api.js's real request() does (Error with .code/.status).
  writeFileSync(API_STUB,
    "export const __calls = [];\n"
    + "export const __state = { creditGet: null, claimBehavior: null };\n"
    + "function makeErr(status, message, code) { const e = new Error(message); e.status = status; e.code = code; return e; }\n"
    + "const api = {\n"
    + "  async request(path, opts) {\n"
    + "    __calls.push({ path, opts });\n"
    + "    const method = opts?.method || 'GET';\n"
    + "    if (method === 'GET' && path.includes('/claim') === false) return __state.creditGet;\n"
    + "    if (method === 'POST' && path.endsWith('/claim')) {\n"
    + "      const b = __state.claimBehavior;\n"
    + "      if (b?.throw) throw makeErr(b.status, b.message, b.code);\n"
    + "      return b?.resolve;\n"
    + "    }\n"
    + "    throw new Error('unexpected request in test: ' + path);\n"
    + "  },\n"
    + "};\n"
    + "export default api;\n");

  writeFileSync(ENTRY,
    'export { default as CreditClaim } from "./CreditClaim.jsx";\n'
    + 'export { MemoryRouter, Routes, Route } from "react-router-dom";\n'
    + 'export { __calls, __state } from "../api/api";\n');

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
          ["../api/api", API_STUB],
          ["../hooks/useAccountState", ACCT_STUB],
          ["../utils/safeStorage", STORAGE_STUB],
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
    url: `http://localhost/claim-credit/${CODE}`,
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
  ({ CreditClaim, MemoryRouter, Routes, Route } = await import(pathToFileURL(BUNDLE).href));
  apiMod = await import(pathToFileURL(BUNDLE).href);
});
after(() => {
  for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
});

beforeEach(() => {
  apiMod.__calls.length = 0;
  apiMod.__state.creditGet = {
    ok: true,
    credit: {
      amountCents: 500, claimed: false, claimedBy: null, consumed: false,
      source: "finale", sourceJobId: "job-1", isOnboardingTestSend: false, isLoopSend: false,
      senderUserId: "sender-other-1", // different from preAuthSnapshot's 'viewer-1' — reaches the claim button
    },
  };
  apiMod.__state.claimBehavior = null;
});

const text = (host) => (host.textContent || "").replace(/\s+/g, " ").trim();

async function mount() {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: [`/claim-credit/${CODE}`] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/claim-credit/:creditCode", element: React.createElement(CreditClaim) })),
    ));
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  }
  return { host, unmount: () => act(() => root.unmount()) };
}

async function clickSayThankYou(host) {
  const buttons = [...host.querySelectorAll("button")];
  const btn = buttons.find((b) => /Say Thank You/i.test(b.textContent || ""));
  assert.ok(btn, "the claim button ('Say Thank You') must be present to drive the claim");
  await act(async () => { btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CREDIT_SUBSCRIBER_INELIGIBLE
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("subscriber refusal renders the restrained expected-state copy, not the generic error screen", async () => {
  apiMod.__state.claimBehavior = { throw: true, status: 403, code: "CREDIT_SUBSCRIBER_INELIGIBLE", message: "This $5 Greet-Me Credit is for non-subscribers..." };
  const m = await mount();
  try {
    await clickSayThankYou(m.host);
    const body = text(m.host);
    assert.match(body, /Your Greet-Me Credit is saved/i, "the restrained heading renders");
    assert.match(body, /reserved for non-subscribers/i);
    assert.match(body, /your Greet-Me subscription is currently active/i);
    assert.doesNotMatch(body, /Something went wrong/i, "must NOT render through the generic error path");
  } finally { await m.unmount(); }
});

test("subscriber refusal never calls it a system failure", async () => {
  apiMod.__state.claimBehavior = { throw: true, status: 403, code: "CREDIT_SUBSCRIBER_INELIGIBLE", message: "..." };
  const m = await mount();
  try {
    await clickSayThankYou(m.host);
    const body = text(m.host);
    assert.doesNotMatch(body, /error/i);
    assert.doesNotMatch(body, /fail/i);
    assert.doesNotMatch(body, /wrong/i);
  } finally { await m.unmount(); }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// CREDIT_STATUS_UNVERIFIABLE
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("status-unverifiable refusal renders its own honest, temporary-state copy, not the generic error screen", async () => {
  apiMod.__state.claimBehavior = { throw: true, status: 503, code: "CREDIT_STATUS_UNVERIFIABLE", message: "We couldn't confirm your account status..." };
  const m = await mount();
  try {
    await clickSayThankYou(m.host);
    const body = text(m.host);
    assert.match(body, /We couldn.{0,3}t verify your eligibility/i);
    assert.match(body, /Your credit has not been used/i);
    assert.match(body, /Please try again shortly/i);
    assert.doesNotMatch(body, /Something went wrong/i, "must NOT render through the generic error path");
  } finally { await m.unmount(); }
});

test("status-unverifiable refusal offers a real retry, and a successful retry claims normally (credit code was never discarded)", async () => {
  apiMod.__state.claimBehavior = { throw: true, status: 503, code: "CREDIT_STATUS_UNVERIFIABLE", message: "..." };
  const m = await mount();
  try {
    await clickSayThankYou(m.host);
    assert.match(text(m.host), /Try Again/i, "a retry action is offered, not a dead end");

    // The account becomes verifiable; the SAME credit code is retried without ever re-navigating.
    apiMod.__state.claimBehavior = { throw: false, resolve: { ok: true, claimed: true, amountCents: 500 } };
    const retryBtn = [...m.host.querySelectorAll("button")].find((b) => /Try Again/i.test(b.textContent || ""));
    assert.ok(retryBtn);
    await act(async () => { retryBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    for (let i = 0; i < 4; i += 1) {
      await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
    }
    const claimCalls = apiMod.__calls.filter((c) => c.path.endsWith("/claim"));
    assert.equal(claimCalls.length, 2, "both the original attempt and the retry actually called claim");
    assert.ok(claimCalls.every((c) => c.path.includes(CODE)), "the retry used the SAME credit code — nothing was discarded");
  } finally { await m.unmount(); }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// Generic unexpected-error handling — proven UNCHANGED
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("regression: an unrelated/unrecognized error code still renders the EXISTING generic error screen unchanged", async () => {
  apiMod.__state.claimBehavior = { throw: true, status: 500, code: "SOME_OTHER_ERROR", message: "Internal error" };
  const m = await mount();
  try {
    await clickSayThankYou(m.host);
    const body = text(m.host);
    assert.match(body, /Something went wrong/i, "the generic error path must still exist and still fire for unrelated errors");
    assert.match(body, /Internal error/i);
  } finally { await m.unmount(); }
});
