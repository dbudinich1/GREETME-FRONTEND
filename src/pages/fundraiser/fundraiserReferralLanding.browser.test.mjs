// src/pages/fundraiser/fundraiserReferralLanding.browser.test.mjs
//
// BROWSER-LEVEL test for the public /#/f/:token referral landing. The real component is esbuild-
// transformed and mounted into jsdom with react-router-dom stubbed (useParams → token, useNavigate →
// recorder). Proves: a valid token is captured into sessionStorage (no decode), a malformed token is
// NOT captured (fail-safe), the CTA routes into the ordinary journey, and NO private API is called.
// Run: node --test src/pages/fundraiser/fundraiserReferralLanding.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { FUNDRAISER_ATTRIBUTION_KEY } from "./attributionCarrier.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__referral.bundle.mjs");
let React, createRoot, Landing, act;

// react-router-dom stub: useParams returns globalThis.__params; useNavigate records to globalThis.__nav.
const ROUTER_STUB = `export const useParams = () => (globalThis.__params || {});
export const useNavigate = () => ((p) => { globalThis.__nav = p; });`;

before(async () => {
  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /^react-router-dom$/ }, (a) => ({ path: a.path, namespace: "stub" }));
    b.onLoad({ filter: /.*/, namespace: "stub" }, () => ({ contents: ROUTER_STUB, loader: "js" }));
  } };
  writeFileSync(join(__dirname, ".__rl.jsx"), `export { default as Landing } from "./FundraiserReferralLanding.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__rl.jsx")], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [stub], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__rl.jsx"), { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.sessionStorage = window.sessionStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  // Trip-wire: any network call fails the "no private API" guarantee.
  globalThis.fetch = () => { globalThis.__fetched = true; return Promise.reject(new Error("no network in landing")); };
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Landing } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
async function mount(token) {
  delete globalThis.__nav; delete globalThis.__fetched;
  globalThis.__params = { token };
  try { window.sessionStorage.clear(); } catch { /* ignore */ }
  document.body.innerHTML = ""; const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Landing)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return root;
}

test("valid token is captured into sessionStorage (opaque, not decoded) + Continue CTA routes to /register", async () => {
  await mount("ftk_ABCdef012345_-");
  assert.equal(window.sessionStorage.getItem(FUNDRAISER_ATTRIBUTION_KEY), "ftk_ABCdef012345_-");
  assert.ok(tid("referral-welcome"));
  const cta = tid("referral-continue"); assert.ok(cta);
  await act(async () => { cta.dispatchEvent(new window.Event("click", { bubbles: true })); });
  assert.equal(globalThis.__nav, "/register");
});

test("malformed token is NOT captured (fail-safe) and shows the invalid state", async () => {
  await mount("not-a-token");
  assert.equal(window.sessionStorage.getItem(FUNDRAISER_ATTRIBUTION_KEY), null);
  assert.ok(tid("referral-invalid"));
  assert.equal(tid("referral-continue"), null);
});

test("landing calls NO network / private API and authenticates nobody", async () => {
  await mount("ftk_ABCdef012345_-");
  assert.equal(globalThis.__fetched, undefined);
  assert.ok(!/dashboard|login|token=|authorization/i.test(document.body.innerHTML));
});
