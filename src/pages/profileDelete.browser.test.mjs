// src/pages/profileDelete.browser.test.mjs
//
// CL-02 (Release 1 FE, 2026-10-06): Profile.jsx Delete buttons are wired to the REAL server delete
// (DELETE /api/profile/voice, DELETE /api/profile/photo; T3-profile-delete-contract.md) and never
// announce a delete the server did not confirm. Mounted proof (jsdom + esbuild stub-edges) plus a
// wire-level proof of the api client methods and source-scan guards.
//
// Run (Node 20.x): node --test src/pages/profileDelete.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__pd.bundle.mjs");
const ENTRY = join(__dirname, ".__pd.entry.jsx");
const AUTH_STUB = join(__dirname, ".__pd.auth.js");
const API_STUB = join(__dirname, ".__pd.api.js");
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB];

let React, createRoot, act, Profile, window, apiMod;

before(async () => {
  writeFileSync(AUTH_STUB,
    "export const __updates = [];\n"
    + "const updateUser = (u) => { __updates.push(u); };\n"
    + "export const useAuth = () => ({ user: { id: 'u1', email: 'u1@example.com' }, updateUser, isAuthenticated: true });\n"
    + "export default { useAuth };\n");
  writeFileSync(API_STUB,
    "export const __calls = [];\n"
    + "export const __r = { profile: null, voice: null, photo: null };\n"
    + "const out = (r) => { if (r instanceof Error) throw r; return r; };\n"
    + "const api = {\n"
    + "  async getProfile() { __calls.push('getProfile'); return out(__r.profile); },\n"
    + "  async deleteProfileVoice() { __calls.push('deleteProfileVoice'); return out(__r.voice); },\n"
    + "  async deleteProfilePhoto() { __calls.push('deleteProfilePhoto'); return out(__r.photo); },\n"
    + "};\n"
    + "export default api;\n");
  writeFileSync(ENTRY,
    'export { default as Profile } from "./Profile.jsx";\n'
    + 'export { __calls, __r } from "../api/api";\n'
    + 'export { __updates } from "../context/AuthContext";\n');

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

  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: "http://localhost/dashboard/profile", pretendToBeVisual: true });
  window = dom.window;
  global.window = window;
  global.document = window.document;
  try { global.navigator = window.navigator; } catch { /* read-only on Node 21+ */ }
  global.HTMLElement = window.HTMLElement;
  global.Node = window.Node;
  global.getComputedStyle = window.getComputedStyle;
  global.Event = window.Event;
  global.CustomEvent = window.CustomEvent;
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.confirm = () => true;
  window.confirm = () => true;

  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  ({ Profile } = await import(pathToFileURL(BUNDLE).href));
  apiMod = await import(pathToFileURL(BUNDLE).href);
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } } });

const PROFILE = { ok: true, profile: { voiceId: "v_abc", voiceUrl: "https://x/v.mp3", photoUrl: "https://x/p.jpg" } };
beforeEach(() => {
  apiMod.__calls.length = 0;
  apiMod.__updates.length = 0;
  apiMod.__r.profile = PROFILE;
  apiMod.__r.voice = null;
  apiMod.__r.photo = null;
});

const text = (host) => (host.textContent || "").replace(/\s+/g, " ").trim();
const tick = async () => { for (let i = 0; i < 4; i += 1) await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); }); };

async function mount() {
  const host = window.document.createElement("div");
  window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(Profile)); });
  await tick();
  return { host, unmount: () => act(() => root.unmount()) };
}
const deleteButtons = (host) => [...host.querySelectorAll("button")].filter((b) => /^\s*Delete\s*$/.test(b.textContent || ""));
async function click(el) { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await tick(); }

test("both Delete buttons are still rendered", async () => {
  const m = await mount();
  try { assert.equal(deleteButtons(m.host).length, 2); } finally { await m.unmount(); }
});

test("voice: server ok -> item removed and message reflects the server result (incl. warning)", async () => {
  apiMod.__r.voice = { ok: true, deleted: true, alreadyDeleted: false, asset: "voice", remoteVoiceDeleted: true, warnings: ["SCHEDULED_SENDS_WILL_BE_SKIPPED"], scheduledSendsAffected: 2 };
  const m = await mount();
  try {
    const voiceBtn = m.host.querySelector("table button.text-red-600") || deleteButtons(m.host)[0];
    assert.match(text(m.host), /My Voice/);
    await click(voiceBtn);
    assert.deepEqual(apiMod.__calls.filter((c) => c.startsWith("delete")), ["deleteProfileVoice"]);
    const body = text(m.host);
    assert.doesNotMatch(body, /My Voice/);
    assert.match(body, /No voice recordings/);
    assert.match(body, /Your voice recording was deleted from your account\./);
    assert.match(body, /cloned voice was also removed/);
    assert.match(body, /2 scheduled sends will be skipped/);
  } finally { await m.unmount(); }
});

test("voice: already deleted is reported honestly, not as a fresh delete", async () => {
  apiMod.__r.voice = { ok: true, deleted: false, alreadyDeleted: true, asset: "voice", remoteVoiceDeleted: false, warnings: [] };
  const m = await mount();
  try {
    await click(m.host.querySelector("table button.text-red-600") || deleteButtons(m.host)[0]);
    assert.match(text(m.host), /There was no saved voice recording to delete\./);
  } finally { await m.unmount(); }
});

test("voice: 409 refusal shows the server error and KEEPS the item (no optimistic delete)", async () => {
  const err = new Error("A Greet-Me or campaign still needs this. Try again after it has been sent, or cancel it first.");
  err.status = 409; err.code = "PROFILE_ASSET_IN_USE";
  apiMod.__r.voice = err;
  const m = await mount();
  try {
    await click(m.host.querySelector("table button.text-red-600") || deleteButtons(m.host)[0]);
    const body = text(m.host);
    assert.match(body, /A Greet-Me or campaign still needs this\./);
    assert.match(body, /My Voice/);
    assert.doesNotMatch(body, /was deleted/);
  } finally { await m.unmount(); }
});

test("voice: 502 / 503 server errors surface the server text and keep the item", async () => {
  for (const [status, code, msg] of [[502, "PROFILE_DELETE_FAILED", "We could not delete this. Nothing was changed."], [503, "VOICE_SERVICE_UNAVAILABLE", "Voice service down, nothing changed."]]) {
    const err = new Error(msg); err.status = status; err.code = code;
    apiMod.__r.voice = err;
    const m = await mount();
    try {
      await click(m.host.querySelector("table button.text-red-600") || deleteButtons(m.host)[0]);
      const body = text(m.host);
      assert.ok(body.includes(msg), `shows server text for ${status}`);
      assert.match(body, /My Voice/);
    } finally { await m.unmount(); }
  }
});

test("voice: non-throwing failure results (401/404 -> {ok:false}, network error) keep the item and never say deleted", async () => {
  for (const r of [{ ok: false, status: 404 }, { ok: false, status: 401 }, { ok: false, status: 0, networkError: true }]) {
    apiMod.__r.voice = r;
    const m = await mount();
    try {
      await click(m.host.querySelector("table button.text-red-600") || deleteButtons(m.host)[0]);
      const body = text(m.host);
      assert.match(body, /My Voice/);
      assert.match(body, /Nothing was deleted|couldn't delete/i);
      assert.doesNotMatch(body, /was deleted from your account/);
    } finally { await m.unmount(); }
  }
});

test("photo: server ok -> photo removed with server-based message", async () => {
  apiMod.__r.photo = { ok: true, deleted: true, alreadyDeleted: false, asset: "photo", remoteVoiceDeleted: false, warnings: [] };
  const m = await mount();
  try {
    assert.equal(m.host.querySelectorAll("img").length, 1);
    await click(deleteButtons(m.host).at(-1));
    assert.deepEqual(apiMod.__calls.filter((c) => c.startsWith("delete")), ["deleteProfilePhoto"]);
    assert.equal(m.host.querySelectorAll("img").length, 0);
    assert.match(text(m.host), /Your photo was deleted from your account\./);
    assert.deepEqual(apiMod.__updates, [{ photoUrl: null }], "signed-in user's photo cleared too (not left stale)");
  } finally { await m.unmount(); }
});

test("photo: failure never clears the signed-in user's photo; a voice delete never touches it", async () => {
  for (const r of [{ ok: false, status: 404 }, { ok: false, status: 0, networkError: true }, Object.assign(new Error("In use."), { status: 409 })]) {
    apiMod.__updates.length = 0;
    apiMod.__r.photo = r;
    const m = await mount();
    try {
      await click(deleteButtons(m.host).at(-1));
      assert.deepEqual(apiMod.__updates, []);
      assert.equal(m.host.querySelectorAll("img").length, 1);
    } finally { await m.unmount(); }
  }
  apiMod.__r.voice = { ok: true, deleted: true, alreadyDeleted: false, asset: "voice", remoteVoiceDeleted: false, warnings: [] };
  const m = await mount();
  try {
    await click(m.host.querySelector("table button.text-red-600") || deleteButtons(m.host)[0]);
    assert.deepEqual(apiMod.__updates, []);
  } finally { await m.unmount(); }
});

test("photo: a bare 'HTTP <status>' error shows the friendly fallback, not the placeholder", async () => {
  apiMod.__r.photo = Object.assign(new Error("HTTP 400"), { status: 400 });
  const m = await mount();
  try {
    await click(deleteButtons(m.host).at(-1));
    const body = text(m.host);
    assert.doesNotMatch(body, /HTTP 400/);
    assert.match(body, /Something unexpected occurred/);
    assert.equal(m.host.querySelectorAll("img").length, 1);
  } finally { await m.unmount(); }
});

test("photo: 403/409/429 refusal keeps the photo and shows the server error", async () => {
  for (const [status, code, msg] of [[409, "PROFILE_ASSET_IN_USE", "In use. Cancel it first."], [429, "RATE_LIMIT_PROFILE_DELETE", "Too many deletes, slow down."], [403, "PROFILE_FORBIDDEN", "Not your profile."]]) {
    const err = new Error(msg); err.status = status; err.code = code;
    apiMod.__r.photo = err;
    const m = await mount();
    try {
      await click(deleteButtons(m.host).at(-1));
      assert.ok(text(m.host).includes(msg), `shows server text for ${status}`);
      assert.equal(m.host.querySelectorAll("img").length, 1);
    } finally { await m.unmount(); }
  }
});

test("Release 2b: a 409 naming a queued send says which greeting and when; the photo is kept", async () => {
  const err = new Error("A Greet-Me or campaign still needs this. Try again after it has been sent, or cancel it first.");
  err.status = 409; err.code = "PROFILE_ASSET_IN_USE";
  err.data = { inUseBy: "queued_send", blockers: [{ kind: "queued_send", scheduledForUtc: "2026-10-08T13:00:00.000Z", occasionType: "birthday" }] };
  apiMod.__r.photo = err;
  const m = await mount();
  try {
    await click(deleteButtons(m.host).at(-1));
    const body = text(m.host);
    assert.match(body, /A birthday greeting scheduled for October 8, 2026/);
    assert.match(body, /is about to send with this photo\./);
    assert.equal(m.host.querySelectorAll("img").length, 1);
  } finally { await m.unmount(); }
});

test("wire level: api client sends DELETE with no body to the two contract routes", async () => {
  const calls = [];
  const saved = global.fetch;
  global.fetch = async (url, options) => { calls.push({ url, options }); return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ ok: true, deleted: true }) }; };
  try {
    const { default: realApi } = await import("../api/api.js");
    await realApi.deleteProfileVoice();
    await realApi.deleteProfilePhoto();
  } finally { global.fetch = saved; }
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.endsWith("/api/profile/voice") && calls[0].options.method === "DELETE" && calls[0].options.body === undefined);
  assert.ok(calls[1].url.endsWith("/api/profile/photo") && calls[1].options.method === "DELETE" && calls[1].options.body === undefined);
});

test("source scan: Profile.jsx no longer fakes a delete and the protected banner is intact", () => {
  const src = readFileSync(join(__dirname, "Profile.jsx"), "utf8");
  assert.equal(src.includes("showAlert('success', 'Voice recording deleted')"), false);
  assert.equal(src.includes("showAlert('success', 'Photo deleted')"), false);
  assert.ok(src.includes("api.deleteProfileVoice()") && src.includes("api.deleteProfilePhoto()"));
  assert.ok(src.includes("voiceIdStaleAt"));
});
