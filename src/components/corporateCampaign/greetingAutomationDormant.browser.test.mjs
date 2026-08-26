// src/components/corporateCampaign/greetingAutomationDormant.browser.test.mjs
//
// D1 — BROWSER-LEVEL tests for the Corporate Campaign Dashboard DORMANT state.
// The real GreetingAutomationCampaigns.jsx is esbuild-transformed and mounted into jsdom with an
// INJECTED fake client (no network). Proves the Founder-approved read-only dormant state (F3 Draft B)
// renders instead of a blank page, shows the EXACT approved copy, performs no write, and issues no
// campaign/readiness request — only the pre-existing membership probe that discovers dormancy runs.
//
// ENFORCEABLE: jsdom + esbuild are devDependencies; imports are unconditional.
// Run (Node 20.x): node --test src/components/corporateCampaign/greetingAutomationDormant.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

// EXACT Founder-approved copy (F3 Draft B) — hard-coded here to independently pin the strings,
// so any drift in the component fails this test.
const APPROVED_HEADING = "Greet-Me for Business";
const APPROVED_BODY =
  "Corporate campaign management is available to enrolled organizations. Your account isn’t currently enrolled.";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gac.bundle.mjs");
let React, createRoot, Surface, act;

before(async () => {
  writeFileSync(join(__dirname, ".__gac.jsx"), `export { default as Surface } from "./GreetingAutomationCampaigns.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__gac.jsx")],
    outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(join(__dirname, ".__gac.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Surface } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(BUNDLE.replace(/\.mjs$/, ".css"), { force: true }); rmSync(join(__dirname, ".__gac.jsx"), { force: true }); } catch { /* ignore */ } });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const txt = () => document.body.textContent;

let root;
async function mount(props) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Surface, props)); });
  await flush();
}

// Fake client: every method records its call. A write or campaign/readiness read in the dormant
// path would show up in `calls`. listMemberships is the ONLY method the dormant path may touch.
function fakeClient(overrides = {}) {
  const calls = {
    listMemberships: 0, listCampaigns: [], readCampaign: [], readReadiness: [],
    createCampaign: [], updateFeaturedSpread: [], approve: [], lock: [], unlock: [],
  };
  const client = {
    calls,
    listMemberships: async () => { calls.listMemberships++; return overrides.memberships || { dormant: true }; },
    listCampaigns: async (orgId) => { calls.listCampaigns.push(orgId); return overrides.listCampaigns || { dormant: true }; },
    readCampaign: async (o, c) => { calls.readCampaign.push([o, c]); return { ok: false }; },
    readReadiness: async (o, c) => { calls.readReadiness.push([o, c]); return { ok: false }; },
    createCampaign: async (o, b) => { calls.createCampaign.push([o, b]); return { ok: false }; },
    updateFeaturedSpread: async (o, c, b) => { calls.updateFeaturedSpread.push([o, c, b]); return { ok: false }; },
    approve: async (o, c) => { calls.approve.push([o, c]); return { ok: false }; },
    lock: async (o, c, b) => { calls.lock.push([o, c, b]); return { ok: false }; },
    unlock: async (o, c) => { calls.unlock.push([o, c]); return { ok: false }; },
  };
  return client;
}

const writeCalls = (c) =>
  c.calls.createCampaign.length + c.calls.updateFeaturedSpread.length +
  c.calls.approve.length + c.calls.lock.length + c.calls.unlock.length;

test("dormant (membership 503) renders an intentional state, NOT a blank page", async () => {
  const c = fakeClient({ memberships: { dormant: true } });
  await mount({ client: c });
  assert.ok(tid("corporate-dormant"), "dormant container is rendered");
  assert.ok(txt().trim().length > 0, "content area is not blank");
});

test("exact Founder-approved heading and body copy appear", async () => {
  const c = fakeClient({ memberships: { dormant: true } });
  await mount({ client: c });
  const heading = document.querySelector('[data-testid="corporate-dormant"] h1');
  assert.equal(heading.textContent, APPROVED_HEADING, "heading is exact");
  assert.ok(txt().includes(APPROVED_BODY), "body copy is exact");
});

test("dormant state makes no promise of access, no date, no support/contact CTA", async () => {
  const c = fakeClient({ memberships: { dormant: true } });
  await mount({ client: c });
  const body = txt();
  // no interactive controls in the dormant state
  assert.equal(document.querySelector('[data-testid="corporate-dormant"] button'), null, "no buttons");
  assert.equal(document.querySelector('[data-testid="corporate-dormant"] a'), null, "no links");
  assert.equal(document.querySelector('[data-testid="corporate-dormant"] input'), null, "no inputs");
  // no access claim / date promise language
  for (const forbidden of ["you have access", "your campaigns", "coming soon", "contact ", "support", "email us"]) {
    assert.ok(!body.toLowerCase().includes(forbidden), `must not contain "${forbidden}"`);
  }
});

test("dormant state performs no write and issues no campaign/readiness request; only the pre-existing membership probe runs once", async () => {
  const c = fakeClient({ memberships: { dormant: true } });
  await mount({ client: c });
  assert.equal(c.calls.listMemberships, 1, "exactly one membership probe (pre-existing dormancy detection)");
  assert.equal(c.calls.listCampaigns.length, 0, "no campaign list request");
  assert.equal(c.calls.readCampaign.length, 0, "no campaign read");
  assert.equal(c.calls.readReadiness.length, 0, "no readiness read");
  assert.equal(writeCalls(c), 0, "zero writes attempted");
});

test("campaignDormant path (membership ok, campaign list 503) also renders the approved state", async () => {
  const c = fakeClient({
    memberships: { ok: true, data: { memberships: [{ corporateOrganizationId: "org_x", role: "owner", status: "active" }] } },
    listCampaigns: { dormant: true },
  });
  await mount({ client: c });
  assert.ok(tid("corporate-dormant"), "dormant container rendered for campaign-list dormancy");
  assert.ok(txt().includes(APPROVED_BODY), "approved body copy present");
  assert.equal(writeCalls(c), 0, "zero writes attempted");
});
