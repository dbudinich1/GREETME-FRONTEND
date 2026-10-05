// src/pages/referralCreditPage.browser.test.mjs
//
// REFERRAL CREDIT LANDING PAGE (/credit/:referralCode), mounted against the REAL ReferralCredit component.
// Founder rule: no referral credit above $5, for any reason; the page shows ONLY the effective redeemable
// value the server returns (GET /api/gifts/referral/:code -> referralCreditCents), never a literal, and no
// figure at all when the server gives no real amount.
//
// Run (Node 20.x): node --test src/pages/referralCreditPage.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const P = (n) => join(__dirname, `.__rcp.${n}`);
const BUNDLE = P("bundle.mjs"), ENTRY = P("entry.jsx"), AUTH_STUB = P("auth.js"), API_STUB = P("api.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB];
let React, createRoot, act, M, window;

before(async () => {
  writeFileSync(AUTH_STUB, "export const useAuth = () => ({ user: null, isAuthenticated: false });\nexport const AuthContext = { Provider: ({ children }) => children };\nexport default { useAuth };\n");
  writeFileSync(API_STUB,
    "export const __calls = [];\nexport const __responses = {};\n"
    + "export default { async getReferral(code) { __calls.push(code); const r = __responses.getReferral; const out = typeof r === 'function' ? await r(code) : r; if (out instanceof Error) throw out; return out; } };\n");
  writeFileSync(ENTRY,
    'export { default as ReferralCredit } from "./ReferralCredit.jsx";\n'
    + 'export { MemoryRouter, Routes, Route } from "react-router-dom";\n'
    + 'export { __calls, __responses } from "../api/api";\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty" },
    plugins: [{ name: "stub-edges", setup(b) {
      const STUBS = new Map([["../context/AuthContext", AUTH_STUB], ["../api/api", API_STUB]]);
      b.onResolve({ filter: /.*/ }, (a) => { const hit = STUBS.get(a.path); return hit ? { path: hit } : undefined; });
    } }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/credit/REF-1", pretendToBeVisual: true });
  window = dom.window;
  Object.assign(global, { window, document: window.document, HTMLElement: window.HTMLElement, Node: window.Node, getComputedStyle: window.getComputedStyle, sessionStorage: window.sessionStorage, localStorage: window.localStorage, Event: window.Event, CustomEvent: window.CustomEvent });
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  global.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });
beforeEach(() => { M.__calls.length = 0; for (const k of Object.keys(M.__responses)) delete M.__responses[k]; });

async function mount() {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(M.MemoryRouter, { initialEntries: ["/credit/REF-1"] },
      React.createElement(M.Routes, null, React.createElement(M.Route, { path: "/credit/:referralCode", element: React.createElement(M.ReferralCredit) }))));
  });
  for (let i = 0; i < 3; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return (host.textContent || "").replace(/\s+/g, " ");
}
const ok = (cents, extra = {}) => ({ ok: true, referralCreditCents: cents, referralCode: "REF-1", ...extra });

test("shows exactly the server amount: $5, $3, $2.50 (not rounded to $3), and a server-reported 1000 clamped to $5", async () => {
  for (const [cents, shown] of [[500, "$5"], [300, "$3"], [250, "$2.50"], [1000, "$5"]]) {
    M.__responses.getReferral = ok(cents);
    const t = await mount();
    assert.ok(t.includes(`You've unlocked a ${shown} credit`), `${shown}: ${t}`);
    assert.ok(t.includes(`Apply your ${shown} credit toward a Greet-Me subscription.`), shown);
  }
});

test("effective 5 while the stored value is 10: the page shows $5 and never $10", async () => {
  M.__responses.getReferral = ok(500, { referralGiftValueCents: 1000, storedReferralGiftValueCents: 1000 });
  const t = await mount();
  assert.ok(t.includes("You've unlocked a $5 credit"), t);
  assert.doesNotMatch(t, /\$10\b/);
});

test("missing or malformed amount: no figure anywhere, the credit is shown as unavailable (never a guessed $)", async () => {
  const bad = [
    ["missing", { ok: true, referralCode: "REF-1" }],
    ["null", ok(null)], ["zero", ok(0)], ["negative", ok(-500)], ["string", ok("500")], ["fractional", ok(12.5)],
    ["not ok", { ok: false }],
  ];
  for (const [name, resp] of bad) {
    M.__responses.getReferral = resp;
    const t = await mount();
    assert.match(t, /Credit Unavailable/, name);
    assert.match(t, /no longer valid/, name);
    assert.doesNotMatch(t, /\$\d/, `${name}: no dollar figure on the page`);
    assert.doesNotMatch(t, /unlocked a/, name);
  }
});

test("lookup errors keep their plain messages and show no figure", async () => {
  for (const [err, re] of [[Object.assign(new Error("used"), { code: "REFERRAL_ALREADY_USED", status: 409 }), /already been used/], [Object.assign(new Error("nf"), { status: 404 }), /not valid/]]) {
    M.__responses.getReferral = err;
    const t = await mount();
    assert.match(t, re);
    assert.doesNotMatch(t, /\$\d/);
  }
});

test("source guard: no literal credit amount remains in ReferralCredit.jsx", () => {
  const src = readFileSync(join(__dirname, "ReferralCredit.jsx"), "utf8").replace(/\r\n/g, "\n");
  const code = src.split("\n").filter((l) => !/^\s*(\/\/|\/\*|\*)/.test(l)).join("\n");
  assert.doesNotMatch(code, /'\$\d+'|"\$\d+"|\$10\b/, "no quoted or inline dollar literal");
});

test("cap note: shown only when referralCreditCapped is strictly true; amount is $5 and never $10", async () => {
  const NOTE = "Credits are worth up to $5 each.";
  M.__responses.getReferral = ok(1000, { referralCreditCapped: true });
  let t = await mount();
  assert.ok(t.includes("You've unlocked a $5 credit") && t.includes(NOTE), t);
  assert.doesNotMatch(t, /\$10\b/);
  for (const v of [false, undefined, "true", 1, null]) {
    M.__responses.getReferral = ok(500, v === undefined ? {} : { referralCreditCapped: v });
    t = await mount();
    assert.ok(t.includes("$5 credit") && !t.includes(NOTE), String(v));
  }
});
