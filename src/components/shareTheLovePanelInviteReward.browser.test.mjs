// src/components/shareTheLovePanelInviteReward.browser.test.mjs
//
// 2026-10-08 — RENDERED proof that the "earn 50 Hearts per invite" line is shown ONLY when the
// panel's jobId is the viewer's own greeting (inviteRewardEligible). The backend
// /api/events/share-invite returns 403 unless greeting.userId === caller, so a recipient must never
// be promised invite Hearts. Also source-pins every caller's wiring (PublicGreetingCard: invite tab +
// reward line only for the sender; protected callers untouched → default, no reward line).
//
// Same Node-20-safe jsdom/esbuild harness as hub/hubW17Coverage.browser.test.mjs.
// Run (Node 20 or 25): node --test src/components/shareTheLovePanelInviteReward.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__stlp.entry.jsx");
const BUNDLE = join(__dirname, ".__stlp.bundle.mjs");
let React, createRoot, act, C;

const REWARD = "Invite friends by email to earn 50 Hearts per invite, up to 3 invites a week.";
const SOCIAL = "Sharing on social media doesn’t earn Hearts.";
const CONFIRMED = "We’ll only show “Viewed” or “Referral earned” once Greet-Me has confirmed it.";

const stubPlugin = () => ({ name: "stub", setup(b) {
  b.onResolve({ filter: /\/api\/api$/ }, (a) => ({ path: a.path, namespace: "apistub" }));
  b.onLoad({ filter: /.*/, namespace: "apistub" }, () => ({
    contents: "export default { request: async () => ({ ok: false }), createShareLink: async () => ({ ok: true, disabled: true }) };",
    loader: "js",
  }));
} });

before(async () => {
  writeFileSync(ENTRY, `export { default as ShareTheLovePanel } from "./ShareTheLovePanel.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    loader: { ".css": "empty" },
    plugins: [stubPlugin()], logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });

  const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  globalThis.window = window; globalThis.document = window.document;
  if (typeof globalThis.navigator === "undefined") {
    Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  }
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  C = await import(pathToFileURL(BUNDLE).href);
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(join(__dirname, ".__stlp.bundle.css"), { force: true }); } catch { /* ignore */ } });

async function mount(props) {
  const host = globalThis.document.createElement("div");
  globalThis.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(C.ShareTheLovePanel, { shareUrl: "http://x/#/g/j1", ...props })); });
  return host;
}
const note = (host) => host.querySelector('[data-testid="share-reward-dormant"]')?.textContent || "";
const tabs = (host) => [...host.querySelectorAll('[role="tab"]')].map((t) => t.textContent.trim());

test("default (no inviteRewardEligible): a jobId alone never shows the 50-Hearts invite promise", async () => {
  const host = await mount({ jobId: "j1", defaultMode: "invite" });
  assert.ok(!note(host).includes("50 Hearts"), note(host));
  assert.ok(note(host).includes(SOCIAL));
  assert.ok(note(host).includes(CONFIRMED));
});

test("recipient-style surface (no jobId): no invite tab and no reward promise", async () => {
  const host = await mount({ defaultMode: "broadcast", inviteRewardEligible: false });
  assert.deepEqual(tabs(host), []);
  assert.ok(!host.textContent.includes("50 Hearts"));
  assert.ok(note(host).includes(SOCIAL));
});

test("inviteRewardEligible without a jobId still shows no reward line (no invite is possible)", async () => {
  const host = await mount({ inviteRewardEligible: true });
  assert.ok(!host.textContent.includes("50 Hearts"));
});

test("sender-owned surface (jobId + inviteRewardEligible): reward line + invite tab are shown", async () => {
  const host = await mount({ jobId: "j1", defaultMode: "invite", inviteRewardEligible: true });
  assert.ok(note(host).includes(REWARD), note(host));
  assert.ok(note(host).includes(SOCIAL));
  assert.ok(note(host).includes(CONFIRMED));
  assert.deepEqual(tabs(host), ["Invite by email", "Share to platforms"]);
});

const src = (rel) => readFileSync(join(__dirname, "..", rel), "utf8");
const panelCall = (s) => s.slice(s.indexOf("<ShareTheLovePanel"), s.indexOf("/>", s.indexOf("<ShareTheLovePanel")));

test("PublicGreetingCard: invite (jobId) + reward line only when the viewer is the sender", () => {
  const call = panelCall(src("pages/PublicGreetingCard.jsx"));
  assert.match(call, /jobId=\{isViewerTheSender \? greeting\.jobId : undefined\}/);
  assert.match(call, /defaultMode=\{isViewerTheSender \? 'invite' : 'broadcast'\}/);
  assert.match(call, /inviteRewardEligible=\{isViewerTheSender\}/);
  assert.doesNotMatch(call, /accountState\.isAuthenticated/);
});

test("RecipientThankYouWizard: the viewer's own just-sent thank-you is reward-eligible", () => {
  const call = panelCall(src("pages/RecipientThankYouWizard.jsx"));
  assert.match(call, /jobId=\{sentJobId\}/);
  assert.match(call, /inviteRewardEligible=\{!!sentJobId\}/);
});

test("protected callers (SendGreeting, ThankYouFlow) and Rewards do not pass inviteRewardEligible → default false", () => {
  for (const f of ["pages/SendGreeting.jsx", "pages/ThankYouFlow.jsx", "pages/Rewards.jsx"]) {
    assert.doesNotMatch(panelCall(src(f)), /inviteRewardEligible/, f);
  }
});
