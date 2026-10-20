// src/components/G1G1Badge.browser.test.mjs
//
// The compact G1G1 control (founder 2026-10-20): it replaces the gold seal, which had no action; its only action is
// the explanation — on hover, keyboard focus and tap. Also pins the dashboard shell: no "Welcome back" line, no seal.
//
// Run (Node 20.x): node --test src/components/G1G1Badge.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__g1g1.entry.jsx");
const BUNDLE = join(__dirname, ".__g1g1.bundle.mjs");
let React, act, createRoot, M, window;

before(async () => {
  writeFileSync(ENTRY, 'export { default as G1G1Badge, G1G1_EXPLANATION } from "./G1G1Badge.jsx";\n');
  await esbuild.build({ entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"], logLevel: "silent" });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  for (const k of ["HTMLElement", "Event", "Node", "getComputedStyle", "KeyboardEvent"]) globalThis[k] = window[k];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
after(() => { for (const f of [ENTRY, BUNDLE]) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

async function mount(props = {}) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(M.G1G1Badge, props)); });
  return root;
}
const tip = () => document.querySelector("[data-testid=g1g1-tip]");
const btn = () => document.querySelector("[data-testid=g1g1-badge]");
const shown = () => tip().style.visibility === "visible";

test("the explanation is the founder's exact sentence, linked to the control", async () => {
  const root = await mount();
  assert.equal(M.G1G1_EXPLANATION, "Every Greet-Me subscription comes with one of equal value to share with a friend or loved one.");
  assert.equal(tip().textContent, M.G1G1_EXPLANATION);
  assert.equal(tip().getAttribute("role"), "tooltip");
  assert.equal(btn().getAttribute("aria-describedby"), tip().id);
  assert.match(btn().textContent, /G1G1™/);
  assert.equal(shown(), false, "hidden until asked");
  await act(async () => { root.unmount(); });
});

test("a tap shows it, a second tap hides it; Escape and a tap elsewhere close it", async () => {
  const root = await mount({ compact: true });
  await act(async () => { btn().click(); });
  assert.equal(shown(), true); assert.equal(btn().getAttribute("aria-expanded"), "true");
  await act(async () => { btn().click(); });
  assert.equal(shown(), false);
  await act(async () => { btn().click(); });
  await act(async () => { document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); });
  assert.equal(shown(), false, "Escape closes");
  await act(async () => { btn().click(); });
  await act(async () => { document.body.dispatchEvent(new window.Event("pointerdown", { bubbles: true })); });
  assert.equal(shown(), false, "a tap elsewhere closes");
  await act(async () => { root.unmount(); });
});

test("dashboard shell: no 'Welcome back' line, no gold seal; the control is in the header and (phones) the welcome card", () => {
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/\{\s*\/\*[\s\S]*?\*\/\s*\}/g, " ").split("\n").map((l) => l.split("//")[0]).join("\n");
  const layout = strip(readFileSync(join(__dirname, "DashboardLayout.jsx"), "utf8"));
  assert.equal(/Welcome back/.test(layout), false);
  assert.equal(/repeating-conic-gradient|Greet One<\/div>/.test(layout), false, "the seal is gone");
  assert.match(layout, /<G1G1Badge \/>/);
  const home = strip(readFileSync(join(__dirname, "..", "pages", "DashboardHome.jsx"), "utf8"));
  assert.match(home, /<span className="g1g1-phone"><G1G1Badge compact \/><\/span>/);
});
