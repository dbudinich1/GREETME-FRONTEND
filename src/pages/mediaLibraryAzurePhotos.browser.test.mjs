// src/pages/mediaLibraryAzurePhotos.browser.test.mjs
//
// Photo privacy R2/R3: browser-stored Media Library entries that point at Azure Blob Storage are
// raw (unreadable once the photos container is private) or carry an expiring signature. They are
// no longer auto-added, and existing ones are hidden, because the same recipient photos are shown
// signed from GET /api/contacts. Non-Azure entries keep working. Media Library picks handed to
// SendGreeting (sessionStorage 'selectedMediaLibraryPhotos', rendered as <img src> previews) can
// therefore never be a raw Azure URL.
//
// Run (Node 20.x): node --test src/pages/mediaLibraryAzurePhotos.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__mlaz.bundle.mjs");
const ENTRY = join(__dirname, ".__mlaz.entry.jsx");
const AUTH_STUB = join(__dirname, ".__mlaz.auth.js");
const API_STUB = join(__dirname, ".__mlaz.api.js");
const ROUTER_STUB = join(__dirname, ".__mlaz.router.js");
const QR_STUB = join(__dirname, ".__mlaz.qr.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, ROUTER_STUB, QR_STUB];

const KEY = "greetme_media_library";
const RAW = "https://acct.blob.core.windows.net/photos/raw-1.jpg";
const OLD_SAS = "https://acct.blob.core.windows.net/photos/old-2.jpg?sv=2024&se=2026-01-01&sp=r&sig=old";
const VOICE = "https://acct.blob.core.windows.net/voices/v.webm";
const OTHER = "https://cdn.example.test/stock/flower.jpg";
const CONTACT_RAW = "https://acct.blob.core.windows.net/photos/contact-3.jpg";
const CONTACT_SIGNED = CONTACT_RAW + "?sv=2024&se=2026-10-07T13%3A00%3A00Z&sp=r&sig=fresh";

let React, createRoot, act, MediaLibrary, window, mod, lib;

before(async () => {
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => ({ user: { id: 'u1', photoUrl: null }, updateUser: () => {}, getToken: () => 'tok', isAuthenticated: true });\n");
  writeFileSync(API_STUB,
    "export const __contacts = { list: [] };\n"
    + "const api = { async getContacts() { if (__contacts.list === 'throw') throw new Error('down'); return __contacts.list; } };\n"
    + "export default api;\n");
  writeFileSync(ROUTER_STUB,
    "export const __nav = [];\n"
    + "export const useNavigate = () => (p) => { __nav.push(p); };\n"
    + "export const useSearchParams = () => [new URLSearchParams(globalThis.__search || '')];\n");
  writeFileSync(QR_STUB, "export default { toDataURL: async () => 'data:image/png;base64,AA==' };\n");
  writeFileSync(ENTRY,
    'export { default as MediaLibrary } from "./MediaLibrary.jsx";\n'
    + 'export { __contacts } from "../api/api";\n'
    + 'export { __nav } from "react-router-dom";\n');

  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{
      name: "stub-edges",
      setup(build) {
        const STUBS = new Map([
          ["../context/AuthContext", AUTH_STUB], ["../api/api", API_STUB],
          ["react-router-dom", ROUTER_STUB], ["qrcode", QR_STUB],
        ]);
        build.onResolve({ filter: /.*/ }, (a) => { const hit = STUBS.get(a.path); return hit ? { path: hit } : undefined; });
      },
    }],
    define: { "import.meta.env": '{"VITE_API_BASE":"http://api.test"}', "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });

  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: "http://localhost/dashboard/media", pretendToBeVisual: true });
  window = dom.window;
  global.window = window;
  global.document = window.document;
  try { Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true }); } catch { /* ignore */ }
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  global.getComputedStyle = window.getComputedStyle;
  global.Event = window.Event;
  global.CustomEvent = window.CustomEvent;
  global.URLSearchParams = window.URLSearchParams;
  try { global.localStorage = window.localStorage; } catch { /* ignore */ }
  try { global.sessionStorage = window.sessionStorage; } catch { /* ignore */ }
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;

  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  mod = await import(pathToFileURL(BUNDLE).href);
  ({ MediaLibrary } = mod);
  lib = await import(pathToFileURL(join(__dirname, "..", "utils", "mediaLibrary.js")).href);
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } } });

const seed = () => [
  { id: "m1", url: RAW, type: "photo", source: "recipient-memory", addedAt: "2026-01-01" },
  { id: "m2", url: OLD_SAS, type: "photo", source: "recipient-avatar", addedAt: "2026-01-01" },
  { id: "m3", url: VOICE, type: "photo", source: "user-voice", addedAt: "2026-01-01" },
  { id: "m4", url: OTHER, type: "photo", source: "recipient-memory", addedAt: "2026-01-01" },
];
const origLog = console.log;
beforeEach(() => {
  window.localStorage.clear(); window.sessionStorage.clear();
  mod.__nav.length = 0;
  mod.__contacts.list = [{ id: "c1", name: "Avery", memoryPhotos: [CONTACT_SIGNED] }];
  globalThis.__search = "";
  console.log = () => {};
});
after(() => { console.log = origLog; });

const tick = async () => { for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); }); };
async function mount() {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(MediaLibrary)); });
  await tick();
  return { host, unmount: () => act(() => root.unmount()) };
}
const tiles = (host) => [...host.querySelectorAll('img[alt="Recipient photo"]')];
async function click(el) { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await tick(); }

test("autoAddRecipientPhotosToLibrary skips Azure Blob avatar and memory photos, keeps other URLs", () => {
  lib.autoAddRecipientPhotosToLibrary({
    avatar: RAW,
    memoryPhotos: [{ url: CONTACT_RAW, sasUrl: CONTACT_SIGNED }, CONTACT_SIGNED, { url: OTHER }],
  });
  assert.deepEqual(lib.getMediaLibraryItems().map((i) => i.url), [OTHER]);
  lib.autoAddRecipientPhotosToLibrary({ avatar: "https://cdn.example.test/a.jpg" });
  assert.deepEqual(lib.getMediaLibraryItems().map((i) => i.url), [OTHER, "https://cdn.example.test/a.jpg"]);
  assert.equal(lib.isAzureBlobUrl(RAW), true);
  assert.equal(lib.isAzureBlobUrl(OTHER), false);
  assert.equal(lib.isAzureBlobUrl(null), false);
});

test("Media Library hides stored Azure entries (raw, old SAS, voice) and shows the signed contact photo plus non-Azure entries", async () => {
  window.localStorage.setItem(KEY, JSON.stringify(seed()));
  const m = await mount();
  try {
    const srcs = tiles(m.host).map((i) => i.getAttribute("src"));
    assert.deepEqual(srcs, [OTHER, CONTACT_SIGNED]);
    assert.ok(!srcs.some((s) => s.includes(".blob.core.windows.net") && !/[?&]sig=/.test(s)), "no unsigned Azure tile");
    assert.ok(!srcs.includes(OLD_SAS), "no stale-signature tile");
  } finally { await m.unmount(); }
});

test("selection mode: picks handed to SendGreeting are never a raw Azure URL", async () => {
  window.localStorage.setItem(KEY, JSON.stringify(seed()));
  globalThis.__search = "select=photo&returnTo=send";
  const m = await mount();
  try {
    const cards = tiles(m.host).map((i) => i.parentElement);
    assert.equal(cards.length, 2);
    for (const c of cards) await click(c);
    const done = [...m.host.querySelectorAll("button")].find((b) => /Done \(2\)/.test(b.textContent));
    assert.ok(done, "Done (2) enabled");
    await click(done);
    const picked = JSON.parse(window.sessionStorage.getItem("selectedMediaLibraryPhotos"));
    assert.deepEqual(picked.sort(), [CONTACT_SIGNED, OTHER].sort());
    assert.ok(picked.every((u) => !u.includes(".blob.core.windows.net") || /[?&]sig=/.test(u)));
    assert.deepEqual(mod.__nav, ["/dashboard/send?returnTo=send&fromMediaLibrary=true"]);
  } finally { await m.unmount(); }
});

test("contacts unavailable: fallback still hides Azure entries and keeps non-Azure ones", async () => {
  window.localStorage.setItem(KEY, JSON.stringify(seed()));
  mod.__contacts.list = "throw";
  const origErr = console.error; console.error = () => {};
  const m = await mount();
  try {
    assert.deepEqual(tiles(m.host).map((i) => i.getAttribute("src")), [OTHER]);
  } finally { console.error = origErr; await m.unmount(); }
});
