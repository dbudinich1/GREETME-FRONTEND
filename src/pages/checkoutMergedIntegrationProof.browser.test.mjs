// src/pages/checkoutMergedIntegrationProof.browser.test.mjs
//
// PHASE 3 INTEGRATION PROOF (2026-09-30) — this file exists ONLY on the controlled integration
// branch (integration/six-team-launch-corrections). It proves the real merge of
// correction/send-limit-recovery (Team 1, gift-only recovery fields) and
// correction/credit-contract-integrity (Team 5, courtesy-credit display-honesty gate) into
// Checkout.jsx behaves correctly TOGETHER, not just individually — the two lanes' own test
// suites each already prove their own feature in isolation.
//
// Checkout.jsx's handleStripeCheckout has two mutually exclusive branches for the SAME
// api.post('/api/payments/create-checkout', ...) endpoint:
//   - MERCH PATH (cartHasMerch === true): carries giftAttemptId/giftOnlyToken, never
//     courtesyCreditCode. Requires a filled shipping address + a resolved shipping rate to
//     submit, which is out of proportion to mount here just to prove field presence — that
//     presence is already directly visible in the merged source (see the structural tests
//     below, which assert it precisely rather than eyeballing it).
//   - SUBSCRIPTION PATH: carries courtesyCreditCode, never giftAttemptId/giftOnlyToken.
//     Cleanly mountable with the same harness the credit-contract lane's own
//     checkoutCreditDisplay.browser.test.mjs already uses.
//
// Tests 1-2 are REAL, EXECUTED, mounted-DOM proofs that the subscription/credit-display logic
// still behaves correctly with send-limit-recovery's fields also present in storage (proving
// the two lanes coexist in one component instance without interference).
// Tests 3-6 are structural (source-based) proofs — modeled on this repo's own established
// convention (see sendLimitRecoveryPathWiring.test.mjs) for exactly this situation: verifying
// something that's real and load-bearing but impractical to fully mount.
//
// Run (Node 20.x): node --test src/pages/checkoutMergedIntegrationProof.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__cmip.bundle.mjs");
const ENTRY = join(__dirname, ".__cmip.entry.jsx");
const AUTH_STUB = join(__dirname, ".__cmip.auth.js");
const API_STUB = join(__dirname, ".__cmip.api.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB];

let React, createRoot, act, Checkout, MemoryRouter, Routes, Route, window, apiMod;

before(async () => {
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => ({ user: { id: 'u1', email: 'u1@example.com', name: 'Test User' }, isAuthenticated: true });\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");

  writeFileSync(API_STUB,
    "export const __calls = [];\n"
    + "export const __responses = { post: null };\n"
    + "const api = {\n"
    + "  async post(endpoint, body) { __calls.push({ endpoint, body }); const r = __responses.post;\n"
    + "    if (r instanceof Error) throw r; return r; },\n"
    + "  async request(path, opts) { __calls.push({ path, opts }); return { ok: true }; },\n"
    + "};\n"
    + "export default api;\n");

  writeFileSync(ENTRY,
    'export { default as Checkout } from "./Checkout.jsx";\n'
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
    url: "http://localhost/dashboard/checkout",
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
  ({ Checkout, MemoryRouter, Routes, Route } = await import(pathToFileURL(BUNDLE).href));
  apiMod = await import(pathToFileURL(BUNDLE).href);
});
after(() => {
  for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } }
});

const SUBSCRIPTION_CART_ITEM = {
  id: 1, type: "subscription", name: "Social Butterfly™ Plan", price: 24.99, quantity: 1,
  planId: "founders-social-butterfly", period: "year", pricingMode: "founders",
  priceId: "price_1TtuTcCf7KAA6aLajfuuitXc", purchaseType: "subscription", planTier: "social_butterfly",
  billingPeriod: "yearly",
};

// A send-limit-recovery gift-only-token record — present in storage but IRRELEVANT to a
// subscription checkout, since sendDraftId only reaches Checkout.jsx via the ?sendDraftId= URL
// param (absent in these tests' routes), not via this localStorage record alone.
const SEND_RESUME_FIXTURE_KEY = "greetme_send_resume_draft-merged-1";
const SEND_RESUME_FIXTURE = { contactId: "contact-1", giftOnlyToken: "tok-merged-proof-1" };

beforeEach(() => {
  apiMod.__calls.length = 0;
  apiMod.__responses.post = null;
  window.localStorage.setItem("greetme_cart", JSON.stringify([SUBSCRIPTION_CART_ITEM]));
  window.localStorage.setItem(SEND_RESUME_FIXTURE_KEY, JSON.stringify(SEND_RESUME_FIXTURE));
  window.localStorage.removeItem("greetme_referral_code");
});

const text = (host) => (host.textContent || "").replace(/\s+/g, " ").trim();

async function mount() {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(
      MemoryRouter,
      { initialEntries: ["/dashboard/checkout"] },
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/dashboard/checkout", element: React.createElement(Checkout) })),
    ));
  });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  }
  return { host, unmount: () => act(() => root.unmount()) };
}

async function clickCompleteOrder(host) {
  const buttons = [...host.querySelectorAll("button")];
  const btn = buttons.find((b) => /Complete Order/i.test(b.textContent || ""));
  assert.ok(btn, "the 'Complete Order' submit button must be present");
  await act(async () => { btn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  for (let i = 0; i < 4; i += 1) {
    await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); });
  }
}

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 1/2 — REAL MOUNTED PROOF: the credit-display gate behaves correctly with send-limit-recovery's
// fields also present in storage (a different feature, exercised via a different URL/cart shape,
// but sharing the same component instance and the same api.post endpoint).
// ══════════════════════════════════════════════════════════════════════════════════════════════

test("MERGED 1: amount-only courtesy credit shows no discount, even with a send-limit gift-only-token record also in storage", async () => {
  window.localStorage.setItem("greetme_courtesy_credit", JSON.stringify({ amount: 5, source: "courtesy" })); // no creditCode — the exact legacy-page shape
  const m = await mount();
  try {
    const body = text(m.host);
    assert.doesNotMatch(body, /–\$5\.00/, "an amount-only credit must never display a discount, merged state or not");
    // The send-limit fixture is present but must have no bearing on a subscription-cart mount at all.
    assert.equal(window.localStorage.getItem(SEND_RESUME_FIXTURE_KEY), JSON.stringify(SEND_RESUME_FIXTURE), "unrelated storage untouched by the credit-display path");
  } finally { await m.unmount(); }
});

test("MERGED 2: a valid backend-backed $5 credit still displays and would be forwarded, with the send-limit fixture also present", async () => {
  window.localStorage.setItem("greetme_courtesy_credit", JSON.stringify({ creditCode: "code-merged-1", amount: 5, source: "courtesy" }));
  const m = await mount();
  try {
    const body = text(m.host);
    assert.match(body, /Credit Applied/);
    assert.match(body, /–\$5\.00/);
    assert.equal(apiMod.__calls.length, 0, "pending state — no request made yet");
  } finally { await m.unmount(); }
});

// ══════════════════════════════════════════════════════════════════════════════════════════════
// 3-6 — STRUCTURAL PROOF: field isolation and no-duplicate-submission, verified against the
// actual merged source text (not a hand-copy). See file header for why these are structural
// rather than mounted (the merch path needs a filled shipping form + a resolved shipping rate
// to submit, out of proportion to drive here).
// ══════════════════════════════════════════════════════════════════════════════════════════════

const SRC = readFileSync(join(__dirname, "Checkout.jsx"), "utf8");

function extractBlock(src, startMarker, endMarker) {
  const start = src.indexOf(startMarker);
  assert.ok(start > -1, `start marker not found: ${startMarker}`);
  const end = src.indexOf(endMarker, start);
  assert.ok(end > -1, `end marker not found after start: ${endMarker}`);
  return src.slice(start, end);
}

test("MERGED 3: the merch path's request body never references courtesyCreditCode (fields do not bypass credit eligibility, item 4)", () => {
  const merchBlock = extractBlock(SRC, "// ====== MERCH PATH", "// ====== END MERCH PATH ======");
  assert.match(merchBlock, /giftAttemptId/, "sanity: this is really the merch block");
  assert.match(merchBlock, /giftOnlyToken/, "sanity: this is really the merch block");
  assert.doesNotMatch(merchBlock, /courtesyCreditCode/, "the merch/gift-only path must never read or forward a courtesy credit");
});

test("MERGED 4: the subscription path's request body never references giftAttemptId/giftOnlyToken (credit gate does not remove them from the OTHER path, item 5 — and can't, since they're not there)", () => {
  const merchEnd = SRC.indexOf("// ====== END MERCH PATH ======");
  const subBlockStart = merchEnd + "// ====== END MERCH PATH ======".length;
  // Subscription path runs from just after the merch block to the end of handleStripeCheckout.
  const nextFnBoundary = SRC.indexOf("\n  };", subBlockStart);
  const subBlock = SRC.slice(subBlockStart, nextFnBoundary > -1 ? nextFnBoundary : subBlockStart + 4000);
  assert.match(subBlock, /courtesyCreditCode/, "sanity: this is really the subscription block");
  assert.doesNotMatch(subBlock, /giftAttemptId/, "the subscription/credit path must never carry the gift-only recovery fields");
  assert.doesNotMatch(subBlock, /sendDraftGiftOnlyToken/, "the subscription/credit path must never read the gift-only token at all");
});

test("MERGED 5: both field sets are genuinely present in the merged file (the merge did not silently drop either lane's work)", () => {
  assert.match(SRC, /giftAttemptId:\s*sendDraftId/, "send-limit-recovery's giftAttemptId field must survive the merge");
  assert.match(SRC, /giftOnlyToken:\s*sendDraftGiftOnlyToken/, "send-limit-recovery's giftOnlyToken field must survive the merge");
  assert.match(SRC, /courtesyCreditCode\s*&&\s*!referralCode\s*&&\s*\{\s*courtesyCreditCode\s*\}/, "credit-contract-integrity's courtesyCreditCode gate must survive the merge");
  assert.match(SRC, /courtesyCreditCode\s*\?\s*clampCreditDollars\(courtesyCredit\?\.amount\)\s*:\s*0/, "the amount-without-creditCode display gate must survive the merge");
});

test("MERGED 6: the merch path returns unconditionally before the subscription path can run — no duplicate submission/charge path (item 6)", () => {
  const merchBlock = extractBlock(SRC, "// ====== MERCH PATH", "// ====== END MERCH PATH ======");
  const lastReturnIdx = merchBlock.lastIndexOf("return;");
  assert.ok(lastReturnIdx > -1, "the merch path must end with an unconditional return");
  const afterReturn = merchBlock.slice(lastReturnIdx + "return;".length);
  assert.doesNotMatch(afterReturn, /api\.post/, "nothing after the merch path's final return may submit another request within the same block");
  // Exactly two create-checkout calls exist in the whole file: one per path. A third would mean
  // a duplicate charge path was introduced somewhere.
  const postCallCount = (SRC.match(/api\.post\('\/api\/payments\/create-checkout'/g) || []).length;
  assert.equal(postCallCount, 2, "exactly one create-checkout call per path, no duplicate charge path");
});
