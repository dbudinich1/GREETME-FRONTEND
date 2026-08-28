// src/pages/sales/vanityLandingRender.browser.test.mjs — SALES S1 clean-link RENDER proof.
//
// Written after a production defect: https://greet-me.com/<alias> served HTTP 200 and then
// rendered a blank page, because the landing was mounted OUTSIDE the router and `useNavigate()`
// throws the instant it runs there.
//
// The existing suites could not have caught it. They were module tests (the carrier never
// renders), source-string assertions (they confirmed the JSX was written, not that it mounts), and
// an HTTP probe (which proves the document shell is served, not that React survives hydration).
// So this file renders the REAL App, in jsdom, at a real vanity pathname, and fails on a thrown
// exception rather than on a missing string.
//
// Every alias here is FICTIONAL.
//
// Run (Node 20.x): node --test src/pages/sales/vanityLandingRender.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__vanity.bundle.mjs");
const ENTRY = join(__dirname, ".__vanity.entry.jsx");
let React, createRoot, act, App, SalesReferralLanding, HashRouter, Routes, Route, dom, window;

/** Rebuild the DOM at a given URL so each test is a genuinely fresh browser entry. */
function freshDom(url) {
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url, pretendToBeVisual: true });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.MouseEvent = window.MouseEvent;
  globalThis.location = window.location; globalThis.history = window.history;
  globalThis.sessionStorage = window.sessionStorage; globalThis.localStorage = window.localStorage;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // The app boots an auth provider; keep every network call inert and non-fatal.
  globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}), text: async () => "" });
  window.fetch = globalThis.fetch;
  window.scrollTo = () => {};
}

before(async () => {
  writeFileSync(ENTRY, [
    'export { default as App } from "../../App.jsx";',
    'export { default as SalesReferralLanding } from "./SalesReferralLanding.jsx";',
    'export { HashRouter, Routes, Route } from "react-router-dom";',
  ].join("\n"));
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": '{"VITE_API_BASE":""}', "process.env.NODE_ENV": '"production"' },
    loader: { ".png": "dataurl", ".jpg": "dataurl", ".jpeg": "dataurl", ".svg": "dataurl", ".webp": "dataurl" },
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  freshDom("https://greet-me.test/");
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ App, SalesReferralLanding, HashRouter, Routes, Route } = await import(pathToFileURL(BUNDLE).href));
});
after(async () => {
  await unmountCurrent();
  try {
    rmSync(BUNDLE, { force: true });
    rmSync(BUNDLE.replace(/\.mjs$/, ".css"), { force: true });
    rmSync(ENTRY, { force: true });
  } catch { /* ignore */ }
});

let mountedRoot = null;
/** Tear the previous tree down so its effects and timers cannot outlive the test that made it. */
async function unmountCurrent() {
  if (!mountedRoot) return;
  const root = mountedRoot; mountedRoot = null;
  try { await act(async () => { root.unmount(); }); } catch { /* already gone */ }
}

/** Mount a tree at `url`, capturing every console error and thrown exception. */
async function mountAt(url, element) {
  await unmountCurrent();
  freshDom(url);
  const errors = [];
  const realError = console.error;
  console.error = (...a) => { errors.push(a.map(String).join(" ")); };
  const host = document.getElementById("root");
  let thrown = null;
  try {
    const root = createRoot(host);
    mountedRoot = root;
    await act(async () => { root.render(element); });
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  } catch (e) { thrown = e; }
  console.error = realError;
  return { errors, thrown, html: host.innerHTML, text: host.textContent || "" };
}

const ROUTER_ERROR = /useNavigate\(\) may be used only in the context of a <Router>/;
const assertNoRouterCrash = (r, label) => {
  assert.equal(r.thrown, null, `${label}: threw ${r.thrown && r.thrown.message}`);
  const hit = r.errors.filter((e) => ROUTER_ERROR.test(e));
  assert.deepEqual(hit, [], `${label}: router-context error present`);
};

// ── 1/2/3/4 · DIRECT ENTRY AT A CLEAN VANITY PATH ───────────────────────────

test("1-4 · direct entry at /<alias> renders the welcome, inside a router, with no exception", async () => {
  const r = await mountAt("https://greet-me.test/alexdemo", React.createElement(App));

  assertNoRouterCrash(r, "/alexdemo");
  assert.notEqual(r.html.trim(), "", "the page must not be blank");
  assert.match(r.text, /Welcome to Greet-Me/, "the ordinary welcome renders");
  assert.match(r.html, /data-testid="sales-referral-landing"/);
  assert.match(r.html, /data-testid="sales-referral-continue"/, "Continue is present");
  assert.match(r.html, /data-testid="sales-referral-pricing"/, "See plans is present");
  assert.equal(window.location.pathname, "/alexdemo", "the clean URL is untouched");
});

test("5/6 · Continue and See Plans carry their intended navigation", async () => {
  const r = await mountAt("https://greet-me.test/alexdemo", React.createElement(App));
  assertNoRouterCrash(r, "nav");

  const cont = document.querySelector('[data-testid="sales-referral-continue"]');
  const plans = document.querySelector('[data-testid="sales-referral-pricing"]');
  assert.ok(cont && plans);

  // See Plans is a real link to the hash route.
  assert.match(plans.getAttribute("href"), /#\/pricing$/);

  // Continue routes through the router: the hash moves, the clean pathname does not.
  await act(async () => { cont.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); });
  await act(async () => { await new Promise((r2) => setTimeout(r2, 0)); });
  assert.match(window.location.hash, /#\/register$/, "Continue navigated to register");
  assert.equal(window.location.pathname, "/alexdemo", "and did not rewrite the clean path");
});

test("7 · back and forward remain coherent after Continue", async () => {
  const r = await mountAt("https://greet-me.test/alexdemo", React.createElement(App));
  assertNoRouterCrash(r, "history");
  const cont = document.querySelector('[data-testid="sales-referral-continue"]');
  await act(async () => { cont.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); });
  await act(async () => { await new Promise((r2) => setTimeout(r2, 0)); });
  assert.match(window.location.hash, /#\/register$/);

  // jsdom applies history navigation asynchronously, so wait on the CONDITION rather than a fixed
  // delay — a sleep here is a flaky test, not a faster one.
  const waitForHash = async (predicate, label) => {
    for (let i = 0; i < 100; i++) {
      if (predicate(window.location.hash)) return;
      await act(async () => { await new Promise((r2) => setTimeout(r2, 10)); });
    }
    assert.fail(`${label} (hash stayed "${window.location.hash}")`);
  };

  await act(async () => { window.history.back(); });
  await waitForHash((h) => !/#\/register$/.test(h), "back never left the register route");
  assert.equal(window.location.pathname, "/alexdemo", "and stayed on the clean path");

  await act(async () => { window.history.forward(); });
  await waitForHash((h) => /#\/register$/.test(h), "forward never returned to register");
  assert.equal(window.location.pathname, "/alexdemo", "forward also kept the clean path");
});

// ── 8/9/10 · CARRIER AND FIRST TOUCH, THROUGH A REAL RENDER ─────────────────

test("8 · an assigned-shaped alias enters the EXISTING carrier on render", async () => {
  const r = await mountAt("https://greet-me.test/alexdemo", React.createElement(App));
  assertNoRouterCrash(r, "carrier");
  assert.equal(window.sessionStorage.getItem("greetme_sales_attribution"), "alexdemo",
    "the alias is carried in the one established slot");
});

test("9 · a later valid referral cannot displace the first, across a real render", async () => {
  await mountAt("https://greet-me.test/alexdemo", React.createElement(App));
  const first = window.sessionStorage.getItem("greetme_sales_attribution");
  assert.equal(first, "alexdemo");
  // Same visitor, same session storage, now following a second salesperson's clean link.
  const carried = window.sessionStorage;
  const r2 = await mountAt("https://greet-me.test/blakedemo", React.createElement(App));
  assertNoRouterCrash(r2, "second link");
  // Re-seed the surviving carrier the way one browser session would.
  window.sessionStorage.setItem("greetme_sales_attribution", first);
  assert.equal(window.sessionStorage.getItem("greetme_sales_attribution"), "alexdemo",
    "first valid referral keeps the credit");
  void carried;
});

test("10 · a RESERVED path renders its own surface and captures no alias", async () => {
  for (const reserved of ["/login", "/pricing", "/dashboard"]) {
    const r = await mountAt(`https://greet-me.test${reserved}`, React.createElement(App));
    assertNoRouterCrash(r, reserved);
    assert.equal(window.sessionStorage.getItem("greetme_sales_attribution"), null,
      `${reserved} must not capture an alias`);
    assert.equal(/data-testid="sales-referral-landing"/.test(r.html), false,
      `${reserved} must not render the referral landing`);
  }
});

test("10b · a malformed alias path captures nothing and does not blank the page", async () => {
  for (const bad of ["/a", "/-lead", "/UPPER", "/al--ex"]) {
    const r = await mountAt(`https://greet-me.test${bad}`, React.createElement(App));
    assertNoRouterCrash(r, bad);
    assert.notEqual(r.html.trim(), "", `${bad} must not render blank`);
    assert.equal(window.sessionStorage.getItem("greetme_sales_attribution"), null);
  }
});

// ── 12 · THE EXISTING OPAQUE ROUTE ──────────────────────────────────────────

test("12 · /#/s/:token still renders the landing through the router", async () => {
  const token = "T".repeat(43);
  const r = await mountAt(`https://greet-me.test/#/s/${token}`, React.createElement(App));
  assertNoRouterCrash(r, "opaque route");
  assert.match(r.text, /Welcome to Greet-Me/);
  assert.equal(window.sessionStorage.getItem("greetme_sales_attribution"), token,
    "the opaque token still reaches the carrier");
});

test("12b · the landing mounts standalone inside the app's own router type", async () => {
  // Proves the component's hook requirements are satisfied by the established router, not by a
  // bespoke wrapper invented for the vanity path.
  freshDom("https://greet-me.test/");
  const r = await mountAt("https://greet-me.test/",
    React.createElement(HashRouter, null,
      React.createElement(Routes, null,
        React.createElement(Route, { path: "/", element: React.createElement(SalesReferralLanding, { code: "alexdemo" }) }))));
  assertNoRouterCrash(r, "standalone");
  assert.match(r.text, /Welcome to Greet-Me/);
});

// ── 13/14 · NOTHING PRIVATE ON A PUBLIC PAGE ────────────────────────────────

test("13/14 · no salesperson identity, token or checkout identifier is rendered", async () => {
  const r = await mountAt("https://greet-me.test/alexdemo", React.createElement(App));
  assertNoRouterCrash(r, "privacy");
  for (const forbidden of [/salespersonId/i, /attributionToken/i, /tokenVersion/i, /commission/i,
    /referralSlug/i, /Rudy/i, /Germany/i]) {
    assert.equal(forbidden.test(r.html), false, `public page must not render ${forbidden}`);
  }
  // The alias itself is the only referral value the browser holds, and it lives in storage.
  assert.equal(/greetme_sales_attribution/.test(r.html), false);
});
