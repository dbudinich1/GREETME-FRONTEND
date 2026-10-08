// src/pages/sentGreetingsVideo.browser.test.mjs
//
// Release 2b: the sender's Sent Greetings modal. An older greeting's stored D-ID link stops working ~24h after it
// was made; when the <video> cannot load it, the modal shows a true line instead of an empty black player and hides
// the Download button that would lead nowhere. A link that loads is unchanged.
// The real page, bundled and mounted in jsdom; AuthContext and the api module are stubbed (no network).
//
// Run (Node 20.x): node --test src/pages/sentGreetingsVideo.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
// CLEAN_SCRATCH: scratch files carry this process id in their name, so concurrent suites cannot collide; all are removed on exit.
import { readdirSync as __scratchLs, rmSync as __scratchRm } from "node:fs";
process.on("exit", () => { try { for (const n of __scratchLs(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __scratchRm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const BUNDLE = join(__dirname, `.__sgv.${process.pid}.bundle.mjs`);
const ENTRY = join(__dirname, `.__sgv.${process.pid}.entry.jsx`);
const AUTH_STUB = join(__dirname, `.__sgv.${process.pid}.auth.js`);
const API_STUB = join(__dirname, `.__sgv.${process.pid}.api.js`);
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB];
let React, createRoot, act, Page, apiMod, window;

before(async () => {
  writeFileSync(AUTH_STUB, "export const useAuth = () => ({ user: { id: 'u1' }, isAuthenticated: true });\nexport default { useAuth };\n");
  writeFileSync(API_STUB,
    "export const __state = { greetings: [] };\n"
    + "const api = { async getSentGreetings() { return { greetings: __state.greetings }; } };\n"
    + "export default api;\n");
  writeFileSync(ENTRY, 'export { default as Page } from "./SentGreetings.jsx";\nexport { __state } from "../api/api";\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{
      name: "stub-edges",
      setup(build) {
        const STUBS = new Map([["../context/AuthContext", AUTH_STUB], ["../api/api", API_STUB]]);
        build.onResolve({ filter: /.*/ }, (a) => { const hit = STUBS.get(a.path); return hit ? { path: hit } : undefined; });
      },
    }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  try { globalThis.navigator = window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.HTMLElement = window.HTMLElement; globalThis.Node = window.Node;
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async () => { throw new Error("no test may make a network request"); };
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  apiMod = await import(pathToFileURL(BUNDLE).href);
  Page = apiMod.Page;
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const q = (sel) => document.querySelector(sel);
const fire = async (el, type) => { await act(async () => { el.dispatchEvent(new window.Event(type, { bubbles: type === "click" })); }); await flush(); };
let root;
async function openWith(greetings) {
  if (root) await act(async () => { root.unmount(); });
  document.body.innerHTML = "";
  apiMod.__state.greetings = greetings;
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Page)); });
  await flush();
  await fire(q(".card.cursor-pointer"), "click");
}
const G = (over) => ({ id: "g1", status: "completed", recipientName: "Ana", occasion: "birthday", createdAt: "2026-09-01T00:00:00Z", videoUrl: "https://did/old.mp4", photoUrl: "https://x/p.jpg", ...over });
const downloadLink = () => [...document.querySelectorAll("a")].find((a) => a.textContent.includes("Download Video"));

test("a link that loads: player and Download button as before", async () => {
  await openWith([G({})]);
  assert.equal(q("video").getAttribute("src"), "https://did/old.mp4");
  assert.ok(downloadLink());
  assert.equal(q('[data-testid="sent-video-unavailable"]'), null);
});

test("a dead link: a true line replaces the black player and the Download button is hidden", async () => {
  await openWith([G({})]);
  await fire(q("video"), "error");
  assert.equal(q("video"), null);
  assert.equal(q('[data-testid="sent-video-unavailable"]').textContent, "This video could not be loaded. It may no longer be available.");
  assert.equal(downloadLink(), undefined);
});

test("no video at all: unchanged (no video section, no message)", async () => {
  await openWith([G({ videoUrl: null })]);
  assert.equal(q("video"), null);
  assert.equal(q('[data-testid="sent-video-unavailable"]'), null);
  assert.equal(downloadLink(), undefined);
});
