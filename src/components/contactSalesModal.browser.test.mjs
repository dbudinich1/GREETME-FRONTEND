// Contact Sales modal and the Hero entries, in jsdom with the api edge stubbed (no network, nothing sent).
// Run (Node 20): node --test src/components/contactSalesModal.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const ENTRY = join(__dirname, `.__csm.${PID}.entry.jsx`);
const API_STUB = join(__dirname, `.__csm.${PID}.api.js`);
const BUNDLE = join(__dirname, `.__csm.${PID}.bundle.mjs`);
const TEMP = [ENTRY, API_STUB, BUNDLE];
let React, createRoot, act, M, window, T;

before(async () => {
  writeFileSync(API_STUB, `
    export const __calls = []; export const __responses = {};
    const call = (name) => async (body) => {
      __calls.push({ name, body });
      const r = __responses[name];
      const out = typeof r === "function" ? await r(body, __calls.filter((c) => c.name === name).length) : r;
      if (out instanceof Error) throw out;
      return out;
    };
    export default { contactSales: call("contactSales"), getHeroMe: call("getHeroMe"), getHeroLeaderboard: call("getHeroLeaderboard") };
  `);
  writeFileSync(ENTRY, [
    'export { default as Modal } from "./ContactSalesModal.jsx";',
    'export { default as Hero } from "../pages/HeroProgram.jsx";',
    'export { MemoryRouter, Routes, Route } from "react-router-dom";',
    'export { __calls, __responses } from "../api/api";',
  ].join("\n"));
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react-router-dom"],
    loader: { ".css": "empty", ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl" },
    plugins: [{ name: "stub-api", setup(b) { b.onResolve({ filter: /api\/api$/ }, () => ({ path: API_STUB })); } }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/dashboard/hero" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event; globalThis.MouseEvent = window.MouseEvent; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async () => { throw new Error("no test may make a network request"); };
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
  T = { calls: M.__calls, responses: M.__responses };
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });
beforeEach(() => { T.calls.length = 0; for (const k of Object.keys(T.responses)) delete T.responses[k]; });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function mount(el) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); }); await flush();
}
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const click = async (el) => { assert.ok(el, "control must exist"); await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); await flush(); await flush(); };
const setVal = (el, v) => { const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v); el.dispatchEvent(new window.Event("input", { bubbles: true })); };
const fill = async (over = {}) => {
  const f = { name: "Dana Lee", email: "dana@example.com", message: "We want gifts for forty people.", ...over };
  await act(async () => { setVal(tid("cs-name"), f.name); setVal(tid("cs-email"), f.email); setVal(tid("cs-message"), f.message); });
};
const modal = (props = {}) => mount(React.createElement(M.Modal, { isOpen: true, onClose() {}, source: "business", pageContext: "For Business", ...props }));
const posts = () => T.calls.filter((c) => c.name === "contactSales");

test("empty form: field errors, and no request is made", async () => {
  await modal();
  await click(tid("cs-submit"));
  for (const f of ["name", "email", "message"]) assert.ok(tid(`cs-error-${f}`), f);
  assert.equal(posts().length, 0);
});

test("a real 200 with received is the ONLY success; the body is the contract; nothing closes it on a timer", async () => {
  T.responses.contactSales = { status: 200, body: { ok: true, received: true } };
  let closed = 0;
  await modal({ onClose() { closed += 1; } });
  await fill();
  await act(async () => { setVal(tid("cs-organization"), "Acme"); });
  await click(tid("cs-submit"));
  assert.ok(tid("cs-success"));
  assert.deepEqual(posts()[0].body, { name: "Dana Lee", email: "dana@example.com", message: "We want gifts for forty people.", source: "business", website: "", organization: "Acme", pageContext: "For Business" });
  await new Promise((r) => setTimeout(r, 2300));
  assert.ok(tid("cs-success"), "still open after the old 2s auto-close");
  assert.equal(closed, 0);
  await click(tid("cs-done"));
  assert.equal(closed, 1);
});

for (const [label, res] of [
  ["502", { status: 502, body: { ok: false, code: "CONTACT_SALES_SEND_FAILED" } }],
  ["503", { status: 503, body: { ok: false, code: "CONTACT_SALES_UNAVAILABLE" } }],
  ["429", { status: 429, body: { ok: false } }],
  ["network", { networkError: true }],
  ["an odd 200 without received", { status: 200, body: { ok: true } }],
  ["a 404 (route not deployed)", { status: 404, body: null }],
]) {
  test(`${label}: visible failure, no success, typed text kept, Try again then succeeds`, async () => {
    T.responses.contactSales = (_b, n) => (n === 1 ? res : { status: 200, body: { ok: true, received: true } });
    await modal();
    await fill();
    await click(tid("cs-submit"));
    assert.ok(tid("cs-failure"), "failure shown");
    assert.match(tid("cs-failure").textContent, /info@greet-me\.com/);
    assert.equal(tid("cs-success"), null);
    assert.equal(tid("cs-name").value, "Dana Lee");
    assert.equal(tid("cs-submit").textContent, "Try again");
    await click(tid("cs-submit"));
    assert.ok(tid("cs-success"));
    assert.equal(posts().length, 2);
  });
}

test("400 marks the named field; a duplicate is told it was already received", async () => {
  T.responses.contactSales = { status: 400, body: { ok: false, code: "CONTACT_SALES_INVALID", field: "email" } };
  await modal();
  await fill();
  await click(tid("cs-submit"));
  assert.ok(tid("cs-error-email"));
  assert.equal(tid("cs-success"), null);
  T.responses.contactSales = { status: 200, body: { ok: true, received: true, duplicate: true } };
  await click(tid("cs-submit"));
  assert.match(tid("cs-duplicate").textContent, /already have this message/);
  assert.equal(tid("cs-success"), null);
});

test("a filled honeypot is sent as filled (the server drops it); a person's is empty", async () => {
  T.responses.contactSales = { status: 200, body: { ok: true, received: true } };
  await modal();
  await fill();
  await act(async () => { setVal(tid("cs-website"), "http://spam.example"); });
  await click(tid("cs-submit"));
  assert.equal(posts()[0].body.website, "http://spam.example");
});

// ------------------------------------------------------------------------------------- Hero entries
const HERO = { ok: true, hero: { status: { level: "gold", label: "Gold Hero" }, impact: { business: { totalActivities: 1, bySource: {} }, community: { totalActivities: 1, bySource: {} } }, recentActivity: [], history: [], recognition: { earned: [{ key: "x", label: "Founding Hero Badge" }], future: [] } } };
async function mountHero() {
  T.responses.getHeroMe = HERO;
  window.localStorage.clear();
  await mount(React.createElement(M.MemoryRouter, { initialEntries: ["/dashboard/hero"] }, React.createElement(M.Routes, null,
    React.createElement(M.Route, { path: "/dashboard/hero", element: React.createElement(M.Hero) }),
    React.createElement(M.Route, { path: "/business", element: React.createElement("div", { "data-testid": "business-page" }, "For Business page") }),
  )));
  for (let i = 0; i < 5 && !document.body.textContent.includes("Ways to Participate"); i += 1) await flush();
}
const learnMore = (title) => {
  const h3 = [...document.querySelectorAll("h3")].find((h) => h.textContent === title);
  assert.ok(h3, `card ${title}`);
  return [...h3.parentElement.parentElement.querySelectorAll("button")].find((b) => /Learn More/.test(b.textContent));
};

test("Hero: Marketplace Partner Programs sends source partner; the bundle card sends corporate with the interim wording and no price", async () => {
  T.responses.contactSales = { status: 200, body: { ok: true, received: true } };
  await mountHero();
  await click(learnMore("Marketplace Partner Programs"));
  await fill();
  await click(tid("cs-submit"));
  assert.equal(posts()[0].body.source, "partner");
  assert.equal(posts()[0].body.pageContext, "Hero: Marketplace Partner Programs");
  await click(tid("cs-done"));
  await click(learnMore("Gifted Subscription Bundles"));
  assert.match(tid("cs-intro").textContent, /not a purchase/);
  assert.doesNotMatch(tid("cs-modal").textContent, /\$\s?\d/);
  await fill();
  await click(tid("cs-submit"));
  assert.equal(posts()[1].body.source, "corporate");
  assert.equal(posts()[1].body.pageContext, "Hero: Gifted Subscription Bundles");
});

test("Hero: one link to For Business works; the lower recognition/ranking area stays dormant (no leaderboard request, no status, no badge)", async () => {
  await mountHero();
  assert.equal(T.calls.filter((c) => c.name === "getHeroLeaderboard").length, 0);
  const t = document.body.textContent;
  assert.ok(!t.includes("Gold Hero") && !t.includes("Founding Hero Badge") && !t.includes("Community Hero Leaderboard"));
  assert.ok(tid("hero-recognition-dormant"));
  assert.ok(!/merch/i.test(t), "no customer-visible Merch");
  await click(tid("hero-for-business-link").querySelector("button"));
  assert.ok(tid("business-page"));
});
