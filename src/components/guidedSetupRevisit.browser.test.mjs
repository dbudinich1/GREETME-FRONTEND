// src/components/guidedSetupRevisit.browser.test.mjs
//
// RENDERED coverage of GuidedSetupFlow's REVISIT mode (dashboard "Re-record" / "Revisit setup · voice & photo",
// Report 103). The REAL GuidedSetupFlow is bundled and mounted in jsdom; only router, auth and the api client are
// stubbed. Proves: revisit starts at Voice (no welcome), goes to Photo, and CLOSES after Photo — it never reaches the
// recipient step, the test send (isOnboardingTestSend), the success/Hearts screen or onboarding completion, and it
// never writes the first-run dismissed/completed flags. The first-run flow is unchanged (still starts at Welcome).
//
// Run (Node 20.x): node --test src/components/guidedSetupRevisit.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__revisit.entry.jsx");
const BUNDLE = join(__dirname, ".__revisit.bundle.mjs");
let React, createRoot, act, GuidedSetupFlow;

const ROUTER_STUB = `export const useNavigate = () => (to) => { (globalThis.__nav = globalThis.__nav || []).push(to); };`;
const AUTH_STUB = `export const useAuth = () => ({ user: globalThis.__user, refreshProfile: async () => {} });`;
const API_STUB = `
const c = (k) => { globalThis.__api[k] = (globalThis.__api[k] || 0) + 1; };
export default {
  uploadVoice: async () => { c('uploadVoice'); return { voiceUrl: 'v.webm' }; },
  uploadPhoto: async () => { c('uploadPhoto'); return { ok: true }; },
  sendGreeting: async () => { c('sendGreeting'); return { jobId: 'j1' }; },
  completeOnboarding: async () => { c('completeOnboarding'); return { ok: true }; },
  getPublicGreeting: async () => { c('getPublicGreeting'); return {}; },
};`;
function stubPlugin() {
  const map = [
    [/^react-router-dom$/, ROUTER_STUB, "rr"],
    [/context[\\/]AuthContext$/, AUTH_STUB, "auth"],
    [/api[\\/]api$/, API_STUB, "api"],
  ];
  return { name: "stub", setup(b) {
    for (const [filter, contents, ns] of map) {
      b.onResolve({ filter }, (a) => ({ path: a.path, namespace: ns }));
      b.onLoad({ filter: /.*/, namespace: ns }, () => ({ contents, loader: "js" }));
    }
  } };
}

before(async () => {
  writeFileSync(ENTRY, `export { default as GuidedSetupFlow } from "./GuidedSetupFlow.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "canvas-confetti"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stubPlugin()], logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.localStorage = window.localStorage; globalThis.sessionStorage = window.sessionStorage;
  globalThis.FileReader = window.FileReader; globalThis.File = window.File; globalThis.Blob = window.Blob;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ GuidedSetupFlow } = await import(pathToFileURL(BUNDLE).href));
});
let currentRoot = null;
after(async () => {
  if (currentRoot) await act(async () => { currentRoot.unmount(); });
  try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ }
});

const settle = async () => { for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const $ = (sel) => document.querySelector(sel);
const text = () => document.body.textContent;

async function mount(props, user = { name: "Alex", voiceId: "v1", voiceUrl: "v.webm", photoUrl: "p.jpg" }) {
  if (currentRoot) { const r = currentRoot; currentRoot = null; await act(async () => { r.unmount(); }); }
  globalThis.__user = user; globalThis.__api = {}; globalThis.__nav = [];
  window.localStorage.clear();
  document.body.innerHTML = "";
  const calls = { complete: 0, dismiss: 0 };
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); currentRoot = root;
  await act(async () => { root.render(React.createElement(GuidedSetupFlow, { ...props, onComplete: () => { calls.complete++; }, onDismiss: () => { calls.dismiss++; } })); });
  await settle();
  return calls;
}
const flags = () => JSON.parse(window.localStorage.getItem("greetme_setup_state") || "{}");

test("revisit opens at Voice — no welcome screen", async () => {
  await mount({ revisit: true });
  assert.match(text(), /Record your voice so your greetings sound like you\./);
  assert.equal(/Welcome/.test(text()) && /Let.s go/.test(text()), false);
});

test("revisit: keep voice -> Photo -> keep photo CLOSES; nothing after Photo is reached", async () => {
  const calls = await mount({ revisit: true });
  await act(async () => { $("[data-testid=revisit-keep-voice]").click(); }); await settle();
  assert.match(text(), /Upload a photo that is unmistakably you/);
  await act(async () => { $("[data-testid=revisit-keep-photo]").click(); }); await settle();
  assert.equal(calls.complete, 1, "closes after Photo");
  assert.equal(globalThis.__api.sendGreeting || 0, 0, "never the test send");
  assert.equal(globalThis.__api.completeOnboarding || 0, 0, "never onboarding completion");
  assert.equal(flags().onboardingCompleted, undefined);
  assert.equal(flags().firstGreetingSent, undefined);
});

test("revisit: a new photo upload closes the flow instead of advancing to the recipient/test-send steps", async () => {
  const calls = await mount({ revisit: true });
  await act(async () => { $("[data-testid=revisit-keep-voice]").click(); }); await settle();
  const input = document.querySelector('input[type=file]');
  const file = new window.File([new Uint8Array([137, 80, 78, 71])], "me.png", { type: "image/png" });
  Object.defineProperty(input, "files", { value: [file] });
  await act(async () => { input.dispatchEvent(new window.Event("change", { bubbles: true })); });
  await new Promise((r) => setTimeout(r, 50)); await settle();
  const save = [...document.querySelectorAll("button")].find((b) => /Save & Continue/.test(b.textContent));
  assert.ok(save, "the existing Save & Continue appears");
  await act(async () => { save.click(); }); await settle();
  assert.equal(globalThis.__api.uploadPhoto, 1, "the existing photo upload ran");
  assert.equal(calls.complete, 1, "and the flow closed");
  assert.equal(/Who would you like|test greeting|Send your first/i.test(text()), false);
  assert.equal(globalThis.__api.sendGreeting || 0, 0);
});

test("revisit: the close button dismisses without writing the first-run dismissed flag", async () => {
  const calls = await mount({ revisit: true });
  await act(async () => { document.querySelector("button[aria-label=Close]").click(); }); await settle();
  assert.equal(calls.dismiss, 1);
  assert.equal(flags().onboardingDismissed, undefined, "the first-run gate is untouched");
});

test("revisit with no saved voice or photo offers no 'keep' shortcuts", async () => {
  await mount({ revisit: true }, { name: "Alex" });
  assert.equal($("[data-testid=revisit-keep-voice]"), null);
});

test("the first-run flow is unchanged: it still starts at the Welcome step", async () => {
  await mount({});
  assert.equal(/Record your voice so your greetings sound like you\./.test(text()), false);
  assert.equal($("[data-testid=revisit-keep-voice]"), null);
});
