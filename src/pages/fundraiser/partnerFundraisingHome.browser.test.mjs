// src/pages/fundraiser/partnerFundraisingHome.browser.test.mjs
//
// BROWSER-LEVEL test for B3B partner organization discovery. The real PartnerFundraisingHome is
// esbuild-transformed and mounted into jsdom. react-router-dom is stubbed (useNavigate → recorder,
// Navigate → records its `to`), the fundraiser flag gate is runtime-controllable, and the REAL
// fundraiserApi client runs over a controllable global fetch. Proves: flag-off dormant with no
// network; loading; zero→empty; one→auto-open; many→chooser (no premature nav) then click navigates;
// failure→error+retry; retry re-runs discovery.
// Run: node --test src/pages/fundraiser/partnerFundraisingHome.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__home.bundle.mjs");
let React, createRoot, Home, act;

// react-router-dom stub: useNavigate records imperative nav; Navigate records declarative redirect.
const ROUTER_STUB = `export const useNavigate = () => ((p) => { globalThis.__nav = p; });
export const Navigate = ({ to }) => { globalThis.__redirect = to; return null; };`;
// Flag gate stub: runtime-controllable via globalThis.__flag.
const GATE_STUB = `export const isFundraiserUiEnabled = () => !!globalThis.__flag;`;

before(async () => {
  const stub = { name: "stub", setup(b) {
    b.onResolve({ filter: /^react-router-dom$/ }, (a) => ({ path: a.path, namespace: "rr" }));
    b.onLoad({ filter: /.*/, namespace: "rr" }, () => ({ contents: ROUTER_STUB, loader: "js" }));
    b.onResolve({ filter: /fundraiserGate\.js$/ }, (a) => ({ path: a.path, namespace: "gate" }));
    b.onLoad({ filter: /.*/, namespace: "gate" }, () => ({ contents: GATE_STUB, loader: "js" }));
  } };
  writeFileSync(join(__dirname, ".__home.jsx"), `export { default as Home } from "./PartnerFundraisingHome.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__home.jsx")], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react", external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, plugins: [stub], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__home.jsx"), { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.localStorage = window.localStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Home } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

let fetchCalls = 0;
// Controllable fetch: __nextResponse is { ok, status, data } | Error | "pending".
function installFetch() {
  fetchCalls = 0;
  globalThis.fetch = (url, opts = {}) => {
    fetchCalls++; globalThis.__lastUrl = url; globalThis.__lastOpts = opts;
    const r = globalThis.__nextResponse;
    if (r === "pending") return new Promise(() => {}); // never resolves ⇒ stays in loading
    if (r instanceof Error) return Promise.reject(r);
    return Promise.resolve({ ok: r.ok, status: r.status, json: async () => r.data });
  };
}

async function mount(flag, nextResponse) {
  installFetch();
  globalThis.__flag = flag; globalThis.__nextResponse = nextResponse;
  delete globalThis.__nav; delete globalThis.__redirect;
  document.body.innerHTML = ""; const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Home)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  return root;
}

test("flag OFF ⇒ dormant, and the backend is never called", async () => {
  await mount(false, { ok: true, status: 200, data: { organizations: [] } });
  assert.match(document.body.textContent, /not currently enabled/i);
  assert.equal(fetchCalls, 0);
  assert.equal(globalThis.__redirect, undefined);
});

test("loading state is rendered while discovery is pending", async () => {
  await mount(true, "pending");
  assert.match(document.body.textContent, /Loading/i);
  assert.equal(globalThis.__redirect, undefined);
  assert.equal(globalThis.__nav, undefined);
});

test("zero organizations ⇒ truthful empty state, no navigation", async () => {
  await mount(true, { ok: true, status: 200, data: { organizations: [] } });
  assert.match(document.body.textContent, /No approved fundraising organization/i);
  assert.equal(globalThis.__redirect, undefined);
  assert.equal(globalThis.__nav, undefined);
});

test("exactly one organization ⇒ auto-opens the existing org-scoped dashboard", async () => {
  await mount(true, { ok: true, status: 200, data: { organizations: [{ organizationId: "org_only", name: "Only", status: "approved" }] } });
  assert.equal(globalThis.__redirect, "/dashboard/fundraiser/partner/org_only");
});

test("multiple organizations ⇒ chooser, no premature navigation; selecting opens the right dashboard", async () => {
  await mount(true, { ok: true, status: 200, data: { organizations: [
    { organizationId: "org_a", name: "Alpha Boosters", status: "approved" },
    { organizationId: "org_b", name: "Beta League", status: "approved" },
  ] } });
  assert.equal(globalThis.__redirect, undefined); // nothing auto-selected
  assert.equal(globalThis.__nav, undefined);
  assert.match(document.body.textContent, /Alpha Boosters/);
  assert.match(document.body.textContent, /Beta League/);
  const buttons = [...document.querySelectorAll("button")].filter((b) => /open dashboard/i.test(b.textContent));
  assert.equal(buttons.length, 2);
  await act(async () => { buttons[0].dispatchEvent(new window.Event("click", { bubbles: true })); });
  assert.equal(globalThis.__nav, "/dashboard/fundraiser/partner/org_a");
});

test("API failure ⇒ truthful error state with retry; retry runs discovery again", async () => {
  const root = await mount(true, { ok: false, status: 500, data: null });
  assert.match(document.body.textContent, /went wrong/i);
  const retry = [...document.querySelectorAll("button")].find((b) => /retry/i.test(b.textContent));
  assert.ok(retry, "retry button present");
  const before = fetchCalls;
  globalThis.__nextResponse = { ok: true, status: 200, data: { organizations: [{ organizationId: "org_r", name: "Recovered", status: "approved" }] } };
  await act(async () => { retry.dispatchEvent(new window.Event("click", { bubbles: true })); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  assert.ok(fetchCalls > before, "retry issued another discovery request");
  assert.equal(globalThis.__redirect, "/dashboard/fundraiser/partner/org_r");
  root.unmount();
});

test("discovery hits the authenticated endpoint (no orgId in the request)", async () => {
  await mount(true, { ok: true, status: 200, data: { organizations: [] } });
  assert.equal(globalThis.__lastUrl, "/api/fundraiser/partner/orgs");
  assert.equal((globalThis.__lastOpts.method) || "GET", "GET");
});
