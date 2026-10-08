// src/pages/giftClaimUnavailable.browser.test.mjs
//
// RELEASE 2b — TRUTHFUL RECIPIENT MESSAGES, mounted against the REAL GiftClaim page (jsdom; API client,
// auth and account-state stubbed; no network, no payout). Founder (2026-10-07): what Greet-Me presents
// must be literally true. A gift the server reports as "unavailable" (its payment was fully refunded
// before it was paid out, or it can no longer be fulfilled) must never show a claim form, an amount to
// claim, "submitted", a voucher, or a "Check again" that implies a wait — and must never say why.
//
// Run (Node 20.x): node --test src/pages/giftClaimUnavailable.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const P = (n) => join(__dirname, `.__gcun.${n}`);
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


const UNAVAILABLE_ERR = () => Object.assign(new Error("This gift is no longer available."), { code: "GIFT_UNAVAILABLE", status: 410 });
const NO_LEAK = /refund|payment was|stripe|snag|failed|printful|prezzee/i;

test("QR Cash 'unavailable': no claim form, no amount to claim, no payout methods, nothing about why", async () => {
  M.__responses.getGiftClaim = { ok: true, gift: gift({ status: "unavailable", sourceGreetingJobId: "job-1" }) };
  const h = await mount();
  const t = text(h);
  assert.ok(h.querySelector('[data-testid="gift-unavailable"]'), t);
  assert.match(t, /This gift is no longer available/);
  assert.doesNotMatch(t, /How would you like to receive|Claim \$|\$25\.00|Venmo|Zelle|submitted|You've received a gift/);
  assert.doesNotMatch(t, NO_LEAK);
  assert.ok(h.querySelector('a[href="/#/g/job-1"]'), "the recipient can still open their Greet-Me");
  assert.equal(M.__calls.filter((c) => c.name !== "getGiftClaim").length, 0, "no claim/payout call is made");
});

test("QR Cash 'unavailable' wins over the sender view too (nobody is told 'they'll claim it')", async () => {
  M.__responses.getGiftClaim = { ok: true, gift: gift({ status: "unavailable", senderUserId: "u-sender" }) };
  const t = text(await mount());
  assert.match(t, /This gift is no longer available/);
  assert.doesNotMatch(t, /They.ll claim it/);
});

test("a claim refused by the server as GIFT_UNAVAILABLE switches to the unavailable screen, never 'submitted'", async () => {
  M.__responses.getGiftClaim = { ok: true, gift: gift({ status: "unclaimed" }) };
  M.__responses.submitGiftClaim = UNAVAILABLE_ERR();
  const h = await mount();
  const venmo = [...h.querySelectorAll("button")].find((b) => /Venmo/.test(b.textContent));
  await act(async () => { venmo.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  const input = h.querySelector("input");
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
  await act(async () => { setter.call(input, "@rea"); input.dispatchEvent(new window.Event("input", { bubbles: true })); });
  const claimBtn = [...h.querySelectorAll("button")].find((b) => /Claim \$25\.00 via Venmo/.test(b.textContent));
  assert.ok(claimBtn, text(h));
  await act(async () => { claimBtn.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  await flush();
  const t = text(h);
  assert.equal(M.__calls.filter((c) => c.name === "submitGiftClaim").length, 1);
  assert.match(t, /This gift is no longer available/);
  assert.doesNotMatch(t, /all set|submitted|Claim \$/);
});

test("gift card 'unavailable': the server's message, no voucher controls and no 'Check again'", async () => {
  M.__responses.getGiftClaim = { ok: true, gift: { giftType: "gift_cards", status: "unavailable", statusMessage: "This gift is no longer available.", recipientName: "Rea", senderName: "Dan" } };
  const h = await mount();
  assert.ok(h.querySelector('[data-testid="giftcard-unavailable"]'));
  assert.equal(h.querySelector('[data-testid="giftcard-check-again"]'), null);
  assert.equal(h.querySelector('[data-testid="giftcard-open"]'), null);
  assert.equal(h.querySelector('[data-testid="giftcard-pin"]'), null);
  assert.match(text(h), /This gift is no longer available\./);
});

test("gift card still being prepared keeps its 'Check again' (unchanged)", async () => {
  M.__responses.getGiftClaim = { ok: true, gift: { giftType: "gift_cards", status: "being_prepared", statusMessage: "Your gift is being prepared.", recipientName: "Rea" } };
  const h = await mount();
  assert.ok(h.querySelector('[data-testid="giftcard-check-again"]'));
});

test("merchandise shows the server's truthful status verbatim (paid, not sent yet is never 'on its way')", async () => {
  for (const [status, msg] of [
    ["not_sent_yet", "Your gift has been ordered but hasn't been sent yet."],
    ["unavailable", "This gift is no longer available."],
    ["status_unknown", "We can't show this gift's status right now. Please check back later."],
  ]) {
    M.__responses.getGiftClaim = { ok: true, gift: { giftType: "merch", itemSummary: "Mug", status, statusMessage: msg, recipientName: "Rea" } };
    const t = text(await mount());
    assert.ok(t.includes(msg), `${status}: ${t}`);
    assert.doesNotMatch(t, /on its way/);
  }
});
