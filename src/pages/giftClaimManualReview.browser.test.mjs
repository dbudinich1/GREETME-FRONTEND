// src/pages/giftClaimManualReview.browser.test.mjs
//
// THE RECIPIENT IS TOLD THE TRUTH WHEN A HUMAN WILL PAY THEM — mounted.
//
// At launch QR Cash payouts are reviewed and fulfilled by a person. The backend's Connect-completion
// endpoint therefore answers `{ ok: true, onboardingComplete: true, submitted: true, message: "Your QR
// Cash claim has been submitted for review." }` and deliberately omits `fulfilled`, because nobody has
// been paid yet.
//
// THE DEFECT THIS CLOSES. `handleConnectComplete` branched only on `fulfilled || alreadyFulfilled` and
// `onboardingComplete === false`. That response matched neither, so it fell through to a SILENT NO-OP:
// the spinner stopped, no screen changed, no error appeared, and the recipient was left staring at the
// page wondering whether anything had happened. It never falsely claimed payment — but it was a dead
// end.
//
// THE CORRECTION is one branch, reusing the EXISTING claimed screen, whose copy already reads "Your
// ... gift request has been submitted" and "You'll receive a confirmation once it's on the way". No new
// screen and no new wording.
//
// These are MOUNTED tests, not source scans. The real page runs in jsdom with its API client, auth and
// account-state hook stubbed, and the assertions read the rendered DOM — because "what does the
// recipient actually see" is exactly the question, and the previous behaviour was a rendering outcome
// that a source scan would not have caught.
//
// NO NETWORK, NO STRIPE, NO PAYOUT, NO RECIPIENT. `fetch` throws.
//
// Run (Node 20.x):
//   node --test src/pages/giftClaimManualReview.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gcmr.bundle.mjs");
const ENTRY = join(__dirname, ".__gcmr.entry.jsx");
const AUTH_STUB = join(__dirname, ".__gcmr.auth.js");
const API_STUB = join(__dirname, ".__gcmr.api.js");
const ACCT_STUB = join(__dirname, ".__gcmr.acct.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, ACCT_STUB];

let React, createRoot, act, GiftClaim, MemoryRouter, Routes, Route, window, apiMod;

const TOKEN = "claim-token-live";

/** The gift the page loads: a QR Cash gift mid-Connect, which is the only state that reaches complete. */
const CONNECT_PENDING_GIFT = Object.freeze({
  claimToken: TOKEN,
  giftType: "qrcash",
  status: "connect_pending",
  giftAmountCents: 5000,
  senderName: "Dan",
  recipientName: "Rea",
  sourceGreetingJobId: null,
});

before(async () => {
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => ({ user: null, isAuthenticated: false });\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");

  writeFileSync(ACCT_STUB,
    "export const useAccountState = () => ({ state: 'anonymous', loading: false });\n"
    + "export default { useAccountState };\n");

  // The API client. `connectComplete` returns whatever a test queues, and every call is recorded so a
  // test can prove the page did not, for instance, start a second onboarding.
  writeFileSync(API_STUB,
    "export const __calls = [];\n"
    + "export const __responses = { getGiftClaim: null, connectComplete: null, connectOnboard: null };\n"
    + "async function record(name, arg) { __calls.push({ name, arg }); }\n"
    + "const api = {\n"
    + "  async getGiftClaim(t) { await record('getGiftClaim', t); const r = __responses.getGiftClaim;\n"
    + "    if (r instanceof Error) throw r; return r; },\n"
    + "  async connectComplete(t) { await record('connectComplete', t); const r = __responses.connectComplete;\n"
    + "    if (r instanceof Error) throw r; return r; },\n"
    + "  async connectOnboard(t) { await record('connectOnboard', t); const r = __responses.connectOnboard;\n"
    + "    if (r instanceof Error) throw r; return r; },\n"
    + "  async claimGift() { await record('claimGift'); return { ok: true }; },\n"
    + "};\n"
    + "export default api;\n");

  writeFileSync(ENTRY,
    'export { default as GiftClaim } from "./GiftClaim.jsx";\n'
    + 'export { MemoryRouter, Routes, Route } from "react-router-dom";\n'
    + 'export { __calls, __responses } from "../api/api";\n');

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
    url: `http://localhost/gift/${TOKEN}`,
    pretendToBeVisual: true,
  });
  window = dom.window;
  global.window = window;
  global.document = window.document;
  global.navigator = window.navigator;
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
  ({ GiftClaim, MemoryRouter, Routes, Route } = await import(pathToFileURL(BUNDLE).href));
  apiMod = await import(pathToFileURL(BUNDLE).href);
});

after(() => {
  for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
});

beforeEach(() => {
  apiMod.__calls.length = 0;
  apiMod.__responses.getGiftClaim = { ok: true, gift: { ...CONNECT_PENDING_GIFT } };
  apiMod.__responses.connectComplete = null;
  apiMod.__responses.connectOnboard = null;
});

const text = (host) => (host.textContent || "").replace(/\s+/g, " ").trim();

/**
 * Mount the page as the Connect return, which is what auto-invokes handleConnectComplete.
 */
async function mountConnectReturn(search = "?connect_return=1") {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: [`/gift/${TOKEN}${search}`] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/gift/:claimToken", element: React.createElement(GiftClaim) })),
    ));
  });
  // Let the gift load, the effect fire, and the completion resolve.
  for (let i = 0; i < 4; i += 1) {
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  }
  return { host, unmount: () => act(() => root.unmount()) };
}

const calledComplete = () => apiMod.__calls.filter((c) => c.name === "connectComplete").length;

// ===========================================================================
// 1 + 2 — submitted opens the existing claimed screen, and claims no payment
// ===========================================================================

test("1. `submitted: true` opens the EXISTING claimed screen", async () => {
  apiMod.__responses.connectComplete = {
    ok: true, onboardingComplete: true, submitted: true, alreadySubmitted: false,
    message: "Your QR Cash claim has been submitted for review.",
  };
  const m = await mountConnectReturn();
  try {
    assert.equal(calledComplete(), 1, "the page completed the Connect return");
    const body = text(m.host);
    // The existing claimed screen, identified by its own existing copy.
    assert.match(body, /You.{0,3}re all set\./, "the claimed screen's heading renders");
    assert.match(body, /gift request has been submitted/i, "and its submitted wording");
    assert.match(body, /confirmation once it.{0,3}s on the way/i, "and its follow-up promise");
    // NOT a dead end any more: something actually rendered for the recipient.
    assert.ok(body.length > 40, "the recipient sees a real screen, not a silent no-op");
  } finally { await m.unmount(); }
});

test("2. it never tells the recipient they have been paid", async () => {
  apiMod.__responses.connectComplete = {
    ok: true, onboardingComplete: true, submitted: true,
    message: "Your QR Cash claim has been submitted for review.",
  };
  const m = await mountConnectReturn();
  try {
    const body = text(m.host);
    // The FULFILLED screen's exact claims must be absent — nobody has paid yet.
    assert.doesNotMatch(body, /Gift Received!/, "the paid heading must not appear");
    assert.doesNotMatch(body, /has been sent to your account/i,
      "it must not say the money has been sent");
    assert.doesNotMatch(body, /Funds typically arrive/i, "nor promise arrival times");
    assert.doesNotMatch(body, /instantly to a debit card/i, "nor a debit-card payout");
  } finally { await m.unmount(); }
});

test("2b. `alreadySubmitted` is treated the same way — a replay is still the truth", async () => {
  apiMod.__responses.connectComplete = {
    ok: true, onboardingComplete: true, submitted: true, alreadySubmitted: true,
    message: "Your QR Cash claim has been submitted for review.",
  };
  const m = await mountConnectReturn();
  try {
    const body = text(m.host);
    assert.match(body, /gift request has been submitted/i, "the same claimed screen");
    assert.doesNotMatch(body, /Gift Received!/, "and still no false payment claim");
  } finally { await m.unmount(); }
});

// ===========================================================================
// 3 — the onboarding branch is unchanged, and cannot swallow a submission
// ===========================================================================

test("3. `onboardingComplete: false` still follows its existing path", async () => {
  apiMod.__responses.connectComplete = {
    ok: true, onboardingComplete: false,
    message: "Your account setup is not complete. Please finish onboarding to receive your gift.",
  };
  const m = await mountConnectReturn();
  try {
    const body = text(m.host);
    assert.match(body, /account setup is not complete/i, "the existing onboarding error still shows");
    assert.doesNotMatch(body, /Gift Received!/, "and no payment is claimed");
    assert.doesNotMatch(body, /gift request has been submitted/i,
      "nor is an unsubmitted claim reported as submitted");
  } finally { await m.unmount(); }
});

test("3b. the submitted branch is checked BEFORE the onboarding branch, so it cannot be bypassed",
  async () => {
    // A contradictory response — which the server never sends — proves the ordering rather than
    // relying on the server's shape to protect the client.
    apiMod.__responses.connectComplete = {
      ok: true, submitted: true, onboardingComplete: false,
    };
    const m = await mountConnectReturn();
    try {
      const body = text(m.host);
      assert.match(body, /gift request has been submitted/i,
        "a submitted claim is honoured even alongside an onboarding flag");
      assert.doesNotMatch(body, /Gift Received!/);
    } finally { await m.unmount(); }
  });

// ===========================================================================
// 4 — the paid paths are untouched
// ===========================================================================

test("4. `fulfilled` and `alreadyFulfilled` still show the paid screen, unchanged", async () => {
  for (const res of [
    { ok: true, fulfilled: true, onboardingComplete: true },
    { ok: true, alreadyFulfilled: true },
  ]) {
    apiMod.__responses.connectComplete = res;
    const m = await mountConnectReturn();
    try {
      const body = text(m.host);
      assert.match(body, /Gift Received!/, `the paid screen still renders for ${JSON.stringify(res)}`);
      assert.match(body, /has been sent to your account/i, "with its existing copy");
      assert.doesNotMatch(body, /gift request has been submitted/i,
        "and a paid gift is not reported as merely submitted");
    } finally { await m.unmount(); }
  }
});

// ===========================================================================
// 5 — failures stay failures
// ===========================================================================

test("5. a refusal or a thrown error never renders success", async () => {
  // A non-ok response.
  apiMod.__responses.connectComplete = { ok: false, error: "nope" };
  let m = await mountConnectReturn();
  try {
    const body = text(m.host);
    assert.match(body, /Something went wrong/i, "the existing generic error shows");
    assert.doesNotMatch(body, /Gift Received!/);
    assert.doesNotMatch(body, /gift request has been submitted/i);
  } finally { await m.unmount(); }

  // A thrown error.
  apiMod.__responses.connectComplete = new Error("network exploded");
  m = await mountConnectReturn();
  try {
    const body = text(m.host);
    assert.match(body, /network exploded|Failed to complete payout/i, "the error surfaces");
    assert.doesNotMatch(body, /Gift Received!/);
    assert.doesNotMatch(body, /gift request has been submitted/i);
  } finally { await m.unmount(); }
});

test("5b. the page completes the return exactly once and starts no onboarding of its own", async () => {
  apiMod.__responses.connectComplete = { ok: true, submitted: true, onboardingComplete: true };
  const m = await mountConnectReturn();
  try {
    assert.equal(calledComplete(), 1, "exactly one completion call");
    assert.equal(apiMod.__calls.filter((c) => c.name === "connectOnboard").length, 0,
      "and no onboarding was started");
    // It passed the token from the route, not something invented.
    assert.equal(apiMod.__calls.find((c) => c.name === "connectComplete").arg, TOKEN);
  } finally { await m.unmount(); }
});
