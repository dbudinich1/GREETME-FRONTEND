// src/pages/mediaLibraryDeletePhoto.browser.test.mjs
//
// Release 1.1 frontend correction (2026-10-07): the Media Library default-photo card had only
// "Replace Photo" and no way to delete. It now shows a visible "Delete Photo" button beside Replace
// Photo that uses the SAME real server delete (DELETE /api/profile/photo) and the same confirm and
// result wording as the Profile page, and never announces a delete the server did not confirm.
// The Profile page Delete button is no longer hover-only.
//
// Run (Node 20.x): node --test src/pages/mediaLibraryDeletePhoto.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__mld.bundle.mjs");
const ENTRY = join(__dirname, ".__mld.entry.jsx");
const AUTH_STUB = join(__dirname, ".__mld.auth.js");
const API_STUB = join(__dirname, ".__mld.api.js");
const ROUTER_STUB = join(__dirname, ".__mld.router.js");
const QR_STUB = join(__dirname, ".__mld.qr.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, ROUTER_STUB, QR_STUB];

let React, createRoot, act, MediaLibrary, window, mod;

before(async () => {
  writeFileSync(AUTH_STUB,
    "import { useSyncExternalStore } from 'react';\n"
    + "const store = { user: null, subs: new Set() };\n"
    + "export const __setUser = (u) => { store.user = u; store.subs.forEach((f) => f()); };\n"
    + "export const __updates = [];\n"
    + "const updateUser = (u) => { __updates.push(u); store.user = { ...store.user, ...u }; store.subs.forEach((f) => f()); };\n"
    + "const sub = (f) => { store.subs.add(f); return () => store.subs.delete(f); };\n"
    + "export const useAuth = () => {\n"
    + "  const user = useSyncExternalStore(sub, () => store.user);\n"
    + "  return { user, updateUser, getToken: () => 'tok', isAuthenticated: true };\n"
    + "};\n");
  writeFileSync(API_STUB,
    "export const __calls = [];\n"
    + "export const __r = { photo: null };\n"
    + "const out = (r) => { if (r instanceof Error) throw r; return r; };\n"
    + "const api = {\n"
    + "  async getContacts() { return []; },\n"
    + "  async deleteProfilePhoto() { __calls.push('deleteProfilePhoto'); return out(__r.photo); },\n"
    + "};\n"
    + "export default api;\n");
  writeFileSync(ROUTER_STUB,
    "export const useNavigate = () => () => {};\n"
    + "export const useSearchParams = () => [new URLSearchParams('')];\n");
  writeFileSync(QR_STUB, "export default { toDataURL: async () => 'data:image/png;base64,AA==' };\n");
  writeFileSync(ENTRY,
    'export { default as MediaLibrary } from "./MediaLibrary.jsx";\n'
    + 'export { __setUser, __updates } from "../context/AuthContext";\n'
    + 'export { __calls, __r } from "../api/api";\n');

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
  try { global.navigator = window.navigator; } catch { /* read-only on Node 21+ */ }
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
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } } });

const alerts = [];
let confirmAnswer = true;
beforeEach(() => {
  mod.__calls.length = 0;
  mod.__updates.length = 0;
  mod.__r.photo = null;
  alerts.length = 0;
  confirmAnswer = true;
  global.alert = window.alert = (m) => { alerts.push(String(m)); };
  global.confirm = window.confirm = () => confirmAnswer;
  mod.__setUser({ id: "u1", photoUrl: "https://x/p.jpg" });
});

const tick = async () => { for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); }); };
async function mount() {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(MediaLibrary)); });
  await tick();
  return { host, unmount: () => act(() => root.unmount()) };
}
const btn = (host, re) => [...host.querySelectorAll("button")].find((b) => re.test((b.textContent || "").trim()));
async function click(el) { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await tick(); }

test("a saved photo shows Replace Photo AND a visible Delete Photo button", async () => {
  const m = await mount();
  try {
    assert.ok(btn(m.host, /^Replace Photo$/), "Replace Photo present");
    const del = btn(m.host, /^Delete Photo$/);
    assert.ok(del, "Delete Photo present");
    assert.equal(del.disabled, false);
    assert.equal(del.parentElement, btn(m.host, /^Replace Photo$/).parentElement, "sits beside Replace Photo");
  } finally { await m.unmount(); }
});

test("no saved photo: Upload Photo only, no Delete Photo", async () => {
  mod.__setUser({ id: "u1", photoUrl: null });
  const m = await mount();
  try {
    assert.ok(btn(m.host, /^Upload Photo$/));
    assert.equal(btn(m.host, /^Delete Photo$/), undefined);
  } finally { await m.unmount(); }
});

test("server ok -> real DELETE called once, photo cleared, honest message", async () => {
  mod.__r.photo = { ok: true, deleted: true, alreadyDeleted: false, asset: "photo", warnings: [] };
  const m = await mount();
  try {
    await click(btn(m.host, /^Delete Photo$/));
    assert.deepEqual(mod.__calls, ["deleteProfilePhoto"]);
    assert.deepEqual(mod.__updates, [{ photoUrl: null }]);
    assert.deepEqual(alerts, ["Your photo was deleted from your account."]);
    assert.ok(btn(m.host, /^Upload Photo$/));
    assert.equal(btn(m.host, /^Delete Photo$/), undefined);
  } finally { await m.unmount(); }
});

test("server ok with scheduled-send warning reports the affected sends", async () => {
  mod.__r.photo = { ok: true, deleted: true, alreadyDeleted: false, asset: "photo", warnings: ["SCHEDULED_SENDS_WILL_BE_SKIPPED"], scheduledSendsAffected: 2 };
  const m = await mount();
  try {
    await click(btn(m.host, /^Delete Photo$/));
    assert.match(alerts[0], /Your photo was deleted from your account\./);
    assert.match(alerts[0], /2 scheduled sends will be skipped until you add a new photo\./);
  } finally { await m.unmount(); }
});

test("already deleted is reported honestly", async () => {
  mod.__r.photo = { ok: true, deleted: false, alreadyDeleted: true, asset: "photo", warnings: [] };
  const m = await mount();
  try {
    await click(btn(m.host, /^Delete Photo$/));
    assert.deepEqual(alerts, ["There was no saved photo to delete."]);
  } finally { await m.unmount(); }
});

test("cancelling the confirmation sends nothing", async () => {
  confirmAnswer = false;
  const m = await mount();
  try {
    await click(btn(m.host, /^Delete Photo$/));
    assert.deepEqual(mod.__calls, []);
    assert.deepEqual(mod.__updates, []);
    assert.deepEqual(alerts, []);
    assert.ok(btn(m.host, /^Delete Photo$/));
  } finally { await m.unmount(); }
});

test("server refusal / failure keeps the photo and never says deleted", async () => {
  const err = new Error("A Greet-Me or campaign still needs this. Try again after it has been sent, or cancel it first.");
  err.status = 409;
  for (const r of [err, { ok: false, status: 404 }, { ok: false, status: 0, networkError: true }]) {
    mod.__setUser({ id: "u1", photoUrl: "https://x/p.jpg" });
    mod.__updates.length = 0; alerts.length = 0;
    mod.__r.photo = r;
    const m = await mount();
    try {
      await click(btn(m.host, /^Delete Photo$/));
      assert.deepEqual(mod.__updates, [], "photo not cleared");
      assert.equal(alerts.length, 1);
      assert.doesNotMatch(alerts[0], /was deleted from your account/);
      if (r instanceof Error) assert.equal(alerts[0], r.message, "shows the server's own text");
      assert.ok(btn(m.host, /^Delete Photo$/), "photo still present");
    } finally { await m.unmount(); }
  }
});

test("while the delete is in flight: Deleting..., both buttons disabled and look disabled, a double click sends one request", async () => {
  let resolve;
  mod.__r.photo = new Promise((r) => { resolve = r; });
  let confirms = 0;
  global.confirm = window.confirm = () => { confirms += 1; return true; };
  const m = await mount();
  try {
    const del = btn(m.host, /^Delete Photo$/);
    // a real double click: two clicks on the same button, each its own browser task, while the
    // server has not answered
    await act(async () => {
      del.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
      await new Promise((r) => window.setTimeout(r, 0));
      del.dispatchEvent(new window.MouseEvent("click", { bubbles: true }));
    });
    await tick();
    const busy = btn(m.host, /^Deleting\.\.\.$/);
    assert.ok(busy, "button reads Deleting...");
    assert.equal(busy.disabled, true);
    const replace = btn(m.host, /^Replace Photo$/);
    assert.equal(replace.disabled, true, "Replace Photo disabled during the delete");
    assert.equal(replace.style.cursor, "not-allowed", "Replace Photo does not look clickable");
    assert.notEqual(replace.style.color, "white");
    await click(busy);
    assert.deepEqual(mod.__calls, ["deleteProfilePhoto"], "exactly one request");
    assert.equal(confirms, 1, "one confirmation");
    assert.deepEqual(mod.__updates, [], "nothing cleared before the server answers");
    await act(async () => { resolve({ ok: true, deleted: true, alreadyDeleted: false, asset: "photo", warnings: [] }); });
    await tick();
    assert.deepEqual(mod.__updates, [{ photoUrl: null }]);
    const upload = btn(m.host, /^Upload Photo$/);
    assert.equal(upload.disabled, false, "re-enabled after the delete");
    assert.equal(upload.style.cursor, "pointer");
  } finally { await m.unmount(); }
});

test("source scan: Profile Delete is no longer hover-only; Media Library uses the real delete", () => {
  const profile = readFileSync(join(__dirname, "Profile.jsx"), "utf8");
  const i = profile.indexOf("onClick={() => deletePhoto(photo.id)}");
  assert.ok(i > 0);
  const wrapper = profile.slice(Math.max(0, i - 700), i);
  assert.equal(/group-hover:opacity-100|opacity-0/.test(wrapper), false, "photo actions must not be hover-gated");
  const media = readFileSync(join(__dirname, "MediaLibrary.jsx"), "utf8");
  assert.ok(media.includes("api.deleteProfilePhoto()"));
  assert.ok(media.includes("Delete Photo"));
});
