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
import { writeFileSync, rmSync, readFileSync } from "node:fs";
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
    "export const useAccountState = () => ({ isSubscribed: false, userId: globalThis.__acctUserId ?? null });\n"
    + "export default { useAccountState };\n");

  // safeGet/safeSet read/write 'token' + 'user' for preAuthSnapshot — seeded so
  // isSenderViewingOwnCredit (senderUserId comparison) resolves to a DIFFERENT account than the
  // fixture's senderUserId, so these tests reach the claim button, not the self-claim screen.
  writeFileSync(STORAGE_STUB,
    "export const safeGet = (k) => ({ token: 'fake-token', user: JSON.stringify({ id: 'viewer-1' }) }[k] ?? null);\n"
    + "export const safeSet = (k, v) => { (globalThis.__stash ||= []).push([k, v]); };\n"
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
    // D9f Q3 (founder, 2026-10-10): the refusal leaves the credit unclaimed, so the copy says it
    // can't be added here and that this same link can be shared (first eligible claimer, once).
    assert.match(body, /This credit is for non-subscribers/i, "the restrained heading renders");
    assert.match(body, /can.{0,8}t be added to your account/i);
    assert.match(body, /share this credit link with someone who isn.{0,8}t subscribed/i);
    assert.match(body, /The first eligible person to claim it can use it once/i);
    assert.doesNotMatch(body, /is saved|reserved for|ready when your plan ends|cannot be applied right now/i, "no claim that the credit is held for this account");
    assert.doesNotMatch(body, /Something went wrong/i, "must NOT render through the generic error path");
  } finally { await m.unmount(); }
});

test("D9f Q3: subscriber screen shows this page's own credit link and copies it", async () => {
  apiMod.__state.claimBehavior = { throw: true, status: 403, code: "CREDIT_SUBSCRIBER_INELIGIBLE", message: "..." };
  const copied = [];
  const prevClipboard = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");
  Object.defineProperty(globalThis.navigator, "clipboard", { value: { writeText: async (t) => { copied.push(t); } }, configurable: true });
  const m = await mount();
  try {
    await clickSayThankYou(m.host);
    const shown = m.host.querySelector('[data-testid="credit-share-link"]');
    assert.ok(shown, "the credit link is shown");
    assert.equal(shown.textContent.trim(), `${window.location.origin}/#/claim-credit/${CODE}`, "reuses this page's own code; no new route");
    const btn = [...m.host.querySelectorAll("button")].find((b) => /Copy credit link/i.test(b.textContent || ""));
    assert.ok(btn, "copy control present");
    await act(async () => { btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
    assert.deepEqual(copied, [`${window.location.origin}/#/claim-credit/${CODE}`]);
    assert.match(text(m.host), /Link copied/);
    assert.ok([...m.host.querySelectorAll("button")].some((b) => /Go to Dashboard/i.test(b.textContent || "")), "dashboard exit kept");
  } finally {
    await m.unmount();
    if (prevClipboard) Object.defineProperty(globalThis.navigator, "clipboard", prevClipboard);
    else delete globalThis.navigator.clipboard;
  }
});

test("D9f Q3: the authenticated subscriber's terms line is truthful and short", () => {
  const src = readFileSync(new URL("./CreditClaim.jsx", import.meta.url), "utf8");
  assert.ok(src.includes("For non-subscribers only. You can share this link with someone who isn’t subscribed."));
  assert.equal(src.includes("It will be ready when your plan ends."), false);
  assert.equal(src.includes("Your Greet-Me Credit is saved"), false);
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

// ══════════════════════════════════════════════════════════════════════════════════════════════
// N1 (founder, 2026-10-10): the self-claim rule stays; the sender's own onboarding credit page tells
// the truth instead of "Your $5 credit is ready". S1: an onboarding code claimed by someone else is
// never saved to this browser's checkout stash.
// ══════════════════════════════════════════════════════════════════════════════════════════════
const onboardingCredit = (o = {}) => ({
  ok: true,
  credit: {
    amountCents: 500, claimed: false, claimedBy: null, consumed: false, source: "finale",
    sourceJobId: "job-1", isOnboardingTestSend: true, isLoopSend: false, senderUserId: "viewer-1", ...o,
  },
});
const stashedCodes = () => (globalThis.__stash || []).filter(([k]) => k === "greetme_courtesy_credit").map(([, v]) => JSON.parse(v).creditCode);

test("N1: sender's own onboarding credit (claim refused) shows the truthful message and share control, never 'ready'", async () => {
  globalThis.__acctUserId = "viewer-1"; globalThis.__stash = [];
  apiMod.__state.creditGet = onboardingCredit();
  apiMod.__state.claimBehavior = { throw: true, status: 403, code: "CREDIT_SELF_CLAIM_BLOCKED", message: "This credit is for your recipient" };
  const copied = [];
  const prev = Object.getOwnPropertyDescriptor(globalThis.navigator, "clipboard");
  Object.defineProperty(globalThis.navigator, "clipboard", { value: { writeText: async (t) => { copied.push(t); } }, configurable: true });
  const m = await mount();
  try {
    const body = text(m.host);
    assert.match(body, /This credit can.{0,8}t be added to your own account/i);
    assert.match(body, /share this credit link with a friend who isn.{0,8}t subscribed/i);
    assert.match(body, /The first eligible person to claim it can use it once/i);
    assert.doesNotMatch(body, /credit is ready|all set/i, "no claim that the credit is ready");
    const link = m.host.querySelector('[data-testid="credit-share-link"]');
    assert.equal(link?.textContent.trim(), `${window.location.origin}/#/claim-credit/${CODE}`);
    const btn = [...m.host.querySelectorAll("button")].find((b) => /Copy credit link/i.test(b.textContent || ""));
    await act(async () => { btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
    assert.deepEqual(copied, [`${window.location.origin}/#/claim-credit/${CODE}`]);
    assert.deepEqual(stashedCodes(), [], "a refused claim is never stashed for checkout");
  } finally {
    await m.unmount();
    if (prev) Object.defineProperty(globalThis.navigator, "clipboard", prev); else delete globalThis.navigator.clipboard;
    globalThis.__acctUserId = null;
  }
});

test("N1: sender's own onboarding credit already claimed by someone: says so, no share link", async () => {
  globalThis.__acctUserId = "viewer-1"; globalThis.__stash = [];
  apiMod.__state.creditGet = onboardingCredit({ claimed: true, claimedBy: "friend-9" });
  apiMod.__state.claimBehavior = { throw: true, status: 409, code: "CREDIT_ALREADY_CLAIMED", message: "already been claimed" };
  const m = await mount();
  try {
    const body = text(m.host);
    assert.match(body, /has already been claimed/i);
    assert.equal(m.host.querySelector('[data-testid="credit-share-link"]'), null);
    assert.doesNotMatch(body, /credit is ready/i);
    assert.deepEqual(stashedCodes(), [], "S1: claimed by someone else is never stashed");
  } finally { await m.unmount(); globalThis.__acctUserId = null; }
});

test("N1: normal onboarding success path unchanged (another account's credit): 'ready' screen and stash", async () => {
  globalThis.__acctUserId = "viewer-1"; globalThis.__stash = [];
  apiMod.__state.creditGet = onboardingCredit({ senderUserId: "sender-other-1" });
  apiMod.__state.claimBehavior = { resolve: { ok: true, claimed: true, amountCents: 500 } };
  const m = await mount();
  try {
    const body = text(m.host);
    assert.ok(body.includes("Your $5 credit is ready"), body);
    assert.match(body, /You.{0,8}re all set to start sending/);
    assert.equal(m.host.querySelector('[data-testid="credit-share-link"]'), null);
    assert.deepEqual(stashedCodes(), [CODE]);
  } finally { await m.unmount(); globalThis.__acctUserId = null; }
});

test("S1: an onboarding code already claimed by THIS user is stashed without a new claim; by another user it is not", async () => {
  for (const [claimedBy, expectStash] of [["viewer-1", true], ["friend-9", false]]) {
    globalThis.__acctUserId = "viewer-1"; globalThis.__stash = []; apiMod.__calls.length = 0;
    apiMod.__state.creditGet = onboardingCredit({ senderUserId: "sender-other-1", claimed: true, claimedBy });
    apiMod.__state.claimBehavior = { throw: true, status: 409, code: "CREDIT_ALREADY_CLAIMED", message: "already been claimed" };
    const m = await mount();
    try {
      assert.deepEqual(stashedCodes(), expectStash ? [CODE] : [], `claimedBy=${claimedBy}`);
      const posted = apiMod.__calls.some((c) => c.opts?.method === "POST");
      assert.equal(posted, !expectStash, "own claim: no new POST; another's: the claim is attempted and refused");
    } finally { await m.unmount(); globalThis.__acctUserId = null; }
  }
});
