// src/components/contactFormMemoryPhotoSigned.browser.test.mjs
//
// Photo privacy R1: a memory photo just uploaded in the contact form must DISPLAY from the signed
// link (result.url) while the SAVE payload still stores the raw blobUrl. Real ContactForm, bundled
// with esbuild and mounted into jsdom (same technique as contactFormSurface2.browser.test.mjs).
// Only side-effect modules are stubbed (router, api, auth context, toasts). The save-payload half
// runs the REAL src/api/api.js sanitizer with a stubbed fetch. No network, no backend.
//
// Run: node --test src/components/contactFormMemoryPhotoSigned.browser.test.mjs   (Node 20)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__contactform-r1.bundle.mjs");
const ENTRY = join(__dirname, ".__contactform-r1.entry.jsx");
let React, createRoot, ContactForm, act;

const RAW = "https://acct.blob.core.windows.net/photos/memory-1.jpg";
const SIGNED = RAW + "?sv=2024-01-01&se=2026-10-07T12%3A00%3A00Z&sp=r&sig=abc";

const ROUTER_STUB = `export const useNavigate = () => ((p) => { globalThis.__nav = p; });`;
const AUTH_STUB = `export const useAuth = () => ({ user: { id: "u1" } });`;
const NOTIFY_STUB = `export const showManualToast = (...a) => { (globalThis.__toasts || (globalThis.__toasts = [])).push(a); };`;
const API_STUB = `export default new Proxy({}, { get: (_t, k) => k === "uploadContactMemoryPhoto"
  ? async () => ({ ok: true, url: ${JSON.stringify(SIGNED)}, blobUrl: ${JSON.stringify(RAW)} })
  : async () => { throw new Error("network is not available in this test"); } });`;

before(async () => {
  const stub = {
    name: "stub",
    setup(b) {
      b.onResolve({ filter: /(^react-router-dom$|\/api\/api$|\/utils\/notify$|\/context\/AuthContext$)/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
        contents: /react-router-dom/.test(a.path) ? ROUTER_STUB : /notify/.test(a.path) ? NOTIFY_STUB : /AuthContext/.test(a.path) ? AUTH_STUB : API_STUB,
        loader: "js",
      }));
    },
  };
  writeFileSync(ENTRY, `export { default as ContactForm } from "./ContactForm.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stub], logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.localStorage = window.localStorage; globalThis.sessionStorage = window.sessionStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.open = (u) => { (globalThis.__opened || (globalThis.__opened = [])).push(u); };

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ ContactForm } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const click = (el) => act(async () => { el.click(); });

async function mountAndUpload() {
  globalThis.__submitted = null; globalThis.__opened = [];
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  document.body.innerHTML = "";
  const c = document.createElement("div"); document.body.appendChild(c);
  await act(async () => {
    createRoot(c).render(React.createElement(ContactForm, {
      contact: null, onSubmit: async (d) => { globalThis.__submitted = d; }, onCancel: () => {},
    }));
  });
  await flush();
  await click(tid("moments-heading"));
  const input = document.querySelector('input[type="file"][multiple]');
  assert.ok(input, "memory-photo file input is rendered");
  const file = new window.File(["x"], "m.jpg", { type: "image/jpeg" });
  Object.defineProperty(input, "files", { value: [file], configurable: true });
  await act(async () => { input.dispatchEvent(new window.Event("change", { bubbles: true })); });
  await flush();
}
const memoryImg = () => document.querySelector('img[alt="Memory 1"]');

test("R1: a just-uploaded memory photo renders and enlarges from the signed link, never the raw blobUrl", async () => {
  await mountAndUpload();
  const img = memoryImg();
  assert.ok(img, "thumbnail rendered");
  assert.equal(img.getAttribute("src"), SIGNED);
  await click(img);
  assert.deepEqual(globalThis.__opened, [SIGNED]);
  assert.ok(![...document.querySelectorAll("img")].some((i) => i.getAttribute("src") === RAW), "no <img> uses the raw blob URL");
});

test("R1: Set Default moves the photo to the Profile slot, which renders and enlarges from the signed link", async () => {
  await mountAndUpload();
  const setDefault = [...document.querySelectorAll("button")].find((b) => b.textContent.trim() === "Set Default");
  assert.ok(setDefault, "Set Default offered");
  await click(setDefault);
  const avatar = document.querySelector('img[alt="Profile Photo"]');
  assert.ok(avatar, "default tile rendered");
  assert.equal(avatar.getAttribute("src"), SIGNED);
  globalThis.__opened = [];
  await click(avatar);
  assert.deepEqual(globalThis.__opened, [SIGNED]);
  assert.equal(memoryImg(), null, "moved out of the memory list");
});

test("R1: the save payload stores the raw blobUrl; the real api sanitizer drops sasUrl", async () => {
  await mountAndUpload();
  const setValue = (el, value) => {
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  };
  await act(async () => setValue(document.querySelector('input[name="name"]'), "Avery Fixture"));
  await act(async () => setValue(document.querySelector('input[name="email"]'), "avery@example.test"));
  await click(document.querySelector('button[type="submit"]'));
  await flush();
  assert.ok(globalThis.__submitted, "form submitted");
  const photos = globalThis.__submitted.memoryPhotos;
  assert.equal(photos.length, 1);
  assert.equal(photos[0].url, RAW, "stored value is the raw blobUrl");

  // The real API module (not the stub above): what actually goes over the wire on create.
  const sent = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (u, opts) => { sent.push({ u, body: opts && opts.body }); return { status: 200, ok: true, json: async () => ({ ok: true, id: "c1" }) }; };
  const origErr = console.error; console.error = () => {};
  try {
    const { default: api } = await import(pathToFileURL(join(__dirname, "..", "api", "api.js")).href);
    await api.createContact(globalThis.__submitted);
  } finally { globalThis.fetch = realFetch; console.error = origErr; }
  assert.equal(sent.length, 1);
  const body = JSON.parse(sent[0].body);
  assert.deepEqual(body.memoryPhotos, [{ url: RAW }], "payload holds the raw URL only, no SAS");
  assert.ok(!sent[0].body.includes("sig="), "no signed link anywhere in the payload");
});
