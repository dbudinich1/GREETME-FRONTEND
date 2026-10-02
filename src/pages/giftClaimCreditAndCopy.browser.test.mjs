// src/pages/giftClaimCreditAndCopy.browser.test.mjs
//
// FOUNDER-APPROVED SURFACE 3 CLAIM-PAGE BEHAVIOR, mounted against the REAL GiftClaim page (jsdom; API
// client, auth and account-state stubbed; no network, no payout).
//
//  1. The credit toward a Greet-Me subscription shown after a payout is the amount the SERVER issued
//     (referralGiftValueCents on the claim response), never a literal; with no real amount, no credit
//     block is shown at all ("cap new, honor old": new mints are up to $5, older credits up to $10).
//  2. Manual payout is described honestly: no automated-payout language, no stated window.
//
// Run (Node 20.x): node --test src/pages/giftClaimCreditAndCopy.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const P = (n) => join(__dirname, `.__gccc.${n}`);
const BUNDLE = P("bundle.mjs"), ENTRY = P("entry.jsx"), AUTH_STUB = P("auth.js"), API_STUB = P("api.js"), ACCT_STUB = P("acct.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, ACCT_STUB];
let React, createRoot, act, M, window;
const TOKEN = "claim-token-1";

const gift = (o) => ({ claimToken: TOKEN, giftType: "qrcash", status: "unclaimed", giftAmountCents: 2500, senderName: "Dan", recipientName: "Rea", sourceGreetingJobId: null, ...o });

before(async () => {
  writeFileSync(AUTH_STUB, "export const useAuth = () => ({ user: null, isAuthenticated: false });\nexport const AuthContext = { Provider: ({ children }) => children };\nexport default { useAuth };\n");
  writeFileSync(ACCT_STUB, "export const useAccountState = () => ({ state: 'anonymous', loading: false });\nexport default { useAccountState };\n");
  writeFileSync(API_STUB,
    "export const __calls = [];\nexport const __responses = {};\n"
    + "const call = (name) => async (arg) => { __calls.push({ name, arg }); const r = __responses[name]; const out = typeof r === 'function' ? await r(arg) : r; if (out instanceof Error) throw out; return out; };\n"
    + "export default { getGiftClaim: call('getGiftClaim'), getReferral: call('getReferral'), connectComplete: call('connectComplete'), connectOnboard: call('connectOnboard'), submitGiftClaim: call('submitGiftClaim') };\n");
  writeFileSync(ENTRY,
    'export { default as GiftClaim } from "./GiftClaim.jsx";\n'
    + 'export { MemoryRouter, Routes, Route } from "react-router-dom";\n'
    + 'export { __calls, __responses } from "../api/api";\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{ name: "stub-edges", setup(b) {
      const STUBS = new Map([["../context/AuthContext", AUTH_STUB], ["../api/api", API_STUB], ["../hooks/useAccountState", ACCT_STUB]]);
      b.onResolve({ filter: /.*/ }, (a) => { const hit = STUBS.get(a.path); return hit ? { path: hit } : undefined; });
    } }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: `http://localhost/gift/${TOKEN}`, pretendToBeVisual: true });
  window = dom.window;
  Object.assign(global, { window, document: window.document, HTMLElement: window.HTMLElement, Node: window.Node, getComputedStyle: window.getComputedStyle, sessionStorage: window.sessionStorage, localStorage: window.localStorage, Event: window.Event, CustomEvent: window.CustomEvent });
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = async () => { throw new Error("no test may make a network request"); };
  window.fetch = global.fetch;
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });
beforeEach(() => { M.__calls.length = 0; for (const k of Object.keys(M.__responses)) delete M.__responses[k]; });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function mount() {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(M.MemoryRouter, { initialEntries: [`/gift/${TOKEN}`] },
      React.createElement(M.Routes, null, React.createElement(M.Route, { path: "/gift/:claimToken", element: React.createElement(M.GiftClaim) }))));
  });
  await flush(); await flush(); await flush();
  return host;
}
const text = (h) => (h.textContent || "").replace(/\s+/g, " ");
const referralCalls = () => M.__calls.filter((c) => c.name === "getReferral");

// ---------------------------------------------------------------- credit
// Real response shape: GET /api/gifts/claim/:token adds referralCode + referralGiftValueCents ONLY when the
// gift is fulfilled and the code unused (routes/giftRoutes.js 2306-2310). "Cap new, honor old": the value
// can be 500 (new mint), 300 (a smaller gift) or, for credits issued earlier, up to 1000.
test("credit: the displayed amount is exactly what the server issued, never a literal", async () => {
  for (const [serverCents, shown] of [[500, "$5"], [300, "$3"], [250, "$2.50"], [1000, "$10"]]) {
    M.__calls.length = 0;
    M.__responses.getGiftClaim = { ok: true, gift: gift({ status: "fulfilled", referralCode: "REF-1", referralGiftValueCents: serverCents }) };
    const h = await mount();
    const t = text(h);
    assert.ok(h.querySelector('[data-testid="claim-credit-block"]'), `credit block for ${serverCents}`);
    const credits = [...t.matchAll(/(?:unlocked a|Apply your|Unlock Your) (\$[\d.,]+) [Cc]redit/g)].map((m) => m[1]);
    assert.equal(credits.length, 3, "headline, body and button each name the credit");
    assert.ok(credits.every((c) => c === shown), `every credit figure is ${shown}, got ${credits}`);
    assert.ok(t.includes(`Apply your ${shown} credit toward a Greet-Me subscription.`));
    assert.equal(M.__calls.filter((c) => c.name === "getReferral").length, 0, "no extra lookup: the claim response carries the amount");
  }
});

test("credit: nothing is shown when no real amount exists (no code, missing, zero, malformed, fractional)", async () => {
  const cases = [
    ["no referral code", { status: "fulfilled", referralGiftValueCents: 500 }],
    ["code but no amount", { status: "fulfilled", referralCode: "R" }],
    ["null amount", { status: "fulfilled", referralCode: "R", referralGiftValueCents: null }],
    ["zero", { status: "fulfilled", referralCode: "R", referralGiftValueCents: 0 }],
    ["negative", { status: "fulfilled", referralCode: "R", referralGiftValueCents: -500 }],
    ["string", { status: "fulfilled", referralCode: "R", referralGiftValueCents: "500" }],
    ["fractional", { status: "fulfilled", referralCode: "R", referralGiftValueCents: 12.5 }],
  ];
  for (const [name, o] of cases) {
    M.__responses.getGiftClaim = { ok: true, gift: gift(o) };
    const h = await mount();
    const t = text(h);
    assert.equal(h.querySelector('[data-testid="claim-credit-block"]'), null, `${name}: no credit block`);
    assert.doesNotMatch(t, /credit/i, `${name}: no credit wording at all`);
    assert.match(t, /Gift Received!/, `${name}: the paid screen itself still renders`);
  }
});

test("credit: no other screen of the claim page shows a credit, and none shows a literal $10", async () => {
  for (const status of ["unclaimed", "claimed", "connect_pending", "expired"]) {
    M.__responses.getGiftClaim = { ok: true, gift: gift({ status, referralCode: "R", referralGiftValueCents: 500 }) };
    const t = text(await mount());
    assert.doesNotMatch(t, /unlocked a|Apply your|Unlock Your/, status);
    assert.doesNotMatch(t, /$10/, status);
  }
});

// ---------------------------------------------------------------- manual payout wording
test("payout wording: fulfilled screen is honest about a person paying out; no automated-payout language", async () => {
  M.__responses.getGiftClaim = { ok: true, gift: gift({ status: "fulfilled" }) };
  const t = text(await mount());
  assert.match(t, /Your \$25\.00 QR Cash.{0,3} gift has been paid out by the Greet-Me team using the method you chose\./);
  assert.match(t, /It arrives on that service.{0,3}s usual timing\./);
  assert.doesNotMatch(t, /business days|debit card|bank account|instantly|automatically|sent to your account/i);
});

test("payout wording: claimed screen says a person sends it by hand, with no stated window", async () => {
  M.__responses.getGiftClaim = { ok: true, gift: gift({ status: "claimed" }) };
  const t = text(await mount());
  assert.match(t, /gift request has been submitted/i);
  assert.match(t, /A person at Greet-Me sends this by hand using the method you chose\./);
  assert.match(t, /We will email you when it has been sent\./);
  assert.doesNotMatch(t, /shortly|within|business days|hours|\bdays?\b.*(send|payout)|on the way|instantly|automatically/i);
});
