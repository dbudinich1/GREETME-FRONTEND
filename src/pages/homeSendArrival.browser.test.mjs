// src/pages/homeSendArrival.browser.test.mjs
//
// Report 145 correction (founder 2026-10-28): the dashboard's Home Send click is the confirmation for a complete greeting
// with no gift. Drives the REAL Send page as the dashboard hands off — /dashboard/send?contactId=&occasion=&from=dashboard
// &intent=<nonce> with Home's one-time intent and words in sessionStorage — and checks:
//   complete + no gift → exactly ONE send through the existing send function (stable send key, Home's words, no gift);
//   no / wrong / used intent (an ordinary URL, a refresh, Back) → nothing is sent;
//   photo the send rule refuses → only the photo is asked for, nothing sent;
//   a gift (restored draft) → the existing review opens, nothing sent;
//   the server's missing-voice answer → the existing voice checkpoint, one attempt only.
// Harness copied from dashboardGiftPlaceHandoff.browser.test.mjs (no network, no provider, no Stripe, no order, no charge;
// the send is recorded by a stub — nothing real is sent).
//
// Run (Node 20.x): node --test src/pages/homeSendArrival.browser.test.mjs

import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const BUNDLE = join(__dirname, `.__hsa.${PID}.bundle.mjs`);
const ENTRY = join(__dirname, `.__hsa.${PID}.entry.jsx`);
const AUTH_STUB = join(__dirname, `.__hsa.${PID}.auth.js`);
const API_STUB = join(__dirname, `.__hsa.${PID}.api.js`);
const PROVIDER_STUB = join(__dirname, `.__hsa.${PID}.provider.js`);
const NOTIFY_STUB = join(__dirname, `.__hsa.${PID}.notify.js`);
const TEMP = [BUNDLE, ENTRY, AUTH_STUB, API_STUB, PROVIDER_STUB, NOTIFY_STUB];

let React, createRoot, act, mod, window;
const CONTACTS = [{ id: "c1", name: "Samantha Cole", email: "samantha@example.com" }, { id: "c2", name: "Jordan Lee", email: "jordan@example.com" }];

before(async () => {
  // The signed-in sender is set per test through globalThis.__user (photo URL varies).
  writeFileSync(AUTH_STUB,
    "export const useAuth = () => { const user = globalThis.__user; return { user, loading: false, isAuthenticated: true,\n"
    + "  refreshUser: async () => user, refreshProfile: async () => user, updateUser: () => {}, logout: () => {}, getToken: () => null }; };\n"
    + "export const AuthContext = { Provider: ({ children }) => children };\n"
    + "export default { useAuth };\n");
  // Reads answer with fixtures. The send is RECORDED and answered as globalThis.__sendAnswer says (simulated).
  writeFileSync(API_STUB,
    "export const __sends = [];\n"
    + "const contacts = " + JSON.stringify(CONTACTS) + ";\n"
    + "const known = {\n"
    + "  async request() { return {}; },\n"
    + "  async getGiftCatalog() { return { ok: true, products: [] }; },\n"
    + "  async getSmartCardTiles() { return { ok: false }; },\n"
    + "  async getContacts() { return { contacts }; },\n"
    + "  async getHeartsBalance() { return { balance: 0 }; },\n"
    + "  async getSendEntitlementPreflight() { return { ok: true, canSendGreeting: true }; },\n"
    + "  async getJobStatus() { return { status: 'queued' }; },\n"
    + "  async sendGreeting(p) { __sends.push(p); const a = globalThis.__sendAnswer; if (a && a.error) throw Object.assign(new Error(a.error), { code: a.code }); return { ok: true, jobId: 'sim-job-' + __sends.length, status: 'queued' }; },\n"
    + "  async get() { return { data: {} }; },\n"
    + "};\n"
    + "export default new Proxy(known, { get: (t, k) => (k in t ? t[k] : (k === 'then' ? undefined : async () => ({}))) });\n");
  writeFileSync(PROVIDER_STUB,
    "export async function fetchCheckoutAvailability() { return { available: true, purchasable: true }; }\n"
    + "export async function fetchProviderCatalog() { return { ok: true, products: [] }; }\n"
    + "export async function fetchProviderProducts() { return []; }\n"
    + "export async function fetchTokenizationConfig() { throw new Error('no test may fetch tokenization'); }\n"
    + "export async function retryGiftLink() { throw new Error('no test may retry a gift link'); }\n"
    + "export async function prepareCheckout() { throw new Error('no test may prepare a checkout'); }\n"
    + "export async function submitCheckout() { throw new Error('no test may submit a checkout'); }\n");
  // Toasts are RECORDED (the real toast queue keeps module state across tests); every other export is a no-op.
  writeFileSync(NOTIFY_STUB,
    "export const showManualToast = (title, body) => { (globalThis.__toasts = globalThis.__toasts || []).push({ title, body }); };\n"
    + "export const pushInApp = () => {}; export const getNotifications = () => []; export const getUnreadCount = () => 0;\n"
    + "export const subscribeToNotifications = () => () => {}; export const markRead = () => {}; export const markAllRead = () => {};\n"
    + "export const clearAll = () => {}; export const deleteNotification = () => {};\n");
  writeFileSync(ENTRY,
    'export { default as SendGreeting } from "./SendGreeting.jsx";\n'
    + 'export { MemoryRouter, Routes, Route } from "react-router-dom";\n'
    + 'export { __sends } from "../api/api";\n'
    + 'export { writeHomeSendIntent, HOME_SEND_INTENT_KEY } from "../utils/dashboardSendHandoff.js";\n');
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".jpg": "dataurl", ".png": "dataurl", ".svg": "dataurl" },
    plugins: [{ name: "stub-side-effects", setup(build) {
      const STUBS = new Map([
        ["../context/AuthContext", AUTH_STUB], ["../../context/AuthContext", AUTH_STUB],
        ["../api/api", API_STUB], ["../../api/api", API_STUB],
        ["../api/providerCheckout", PROVIDER_STUB], ["../../api/providerCheckout", PROVIDER_STUB],
        ["../utils/notify", NOTIFY_STUB], ["../../utils/notify", NOTIFY_STUB],
      ]);
      build.onResolve({ filter: /.*/ }, (args) => { const hit = STUBS.get(args.path); return hit ? { path: hit } : undefined; });
    } }],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
  window = dom.window;
  global.window = window; global.document = window.document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true, writable: true });
  Object.assign(global, { HTMLElement: window.HTMLElement, Node: window.Node, getComputedStyle: window.getComputedStyle,
    sessionStorage: window.sessionStorage, localStorage: window.localStorage, Event: window.Event, CustomEvent: window.CustomEvent });
  global.requestAnimationFrame = (cb) => window.setTimeout(cb, 0);
  global.cancelAnimationFrame = (id) => window.clearTimeout(id);
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.fetch = async () => { throw new Error("no test may make a network request"); };
  window.fetch = global.fetch;
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = function scrollIntoView() {};
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  global.alert = () => { throw new Error("no path here may need an alert"); };
  window.alert = global.alert;
  React = await import("react");
  ({ createRoot } = await import("react-dom/client"));
  ({ act } = React);
  mod = await import(pathToFileURL(BUNDLE).href);
});
after(() => { for (const f of TEMP) { try { rmSync(f, { force: true }); } catch { /* best effort */ } } });

const SENDER = { id: "u1", email: "sender@example.com", name: "Alex Sender", emailVerified: true, tier: "close_circle", voiceId: "v-1", voiceUrl: "https://example.test/v.mp3" };
beforeEach(() => {
  window.sessionStorage.clear(); window.localStorage.clear();
  mod.__sends.length = 0; window.document.body.innerHTML = "";
  globalThis.__user = { ...SENDER, photoUrl: "https://example.test/sender.jpg" };
  globalThis.__sendAnswer = null;
  globalThis.__toasts = [];
});

const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
const settle = async (n = 10) => { for (let i = 0; i < n; i += 1) await act(async () => { await new Promise((r) => window.setTimeout(r, 0)); }); };
async function mountAt(url) {
  const { MemoryRouter, Routes, Route, SendGreeting } = mod;
  const h = React.createElement;
  const host = window.document.createElement("div"); window.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(h(MemoryRouter, { initialEntries: [url] }, h(Routes, null,
      h(Route, { path: "/dashboard", element: h("div", { "data-testid": "dash-home" }, "dashboard") }),
      h(Route, { path: "/dashboard/send", element: h(SendGreeting) }))));
  });
  await settle(14);
  return { host, unmount: () => act(() => root.unmount()) };
}
/** Exactly what Home's Send click leaves behind (DashboardHome goSendFlow with sendNow). */
function homeSend({ words = "Thank you for everything, Sam.", contactId = "c1" } = {}) {
  window.sessionStorage.setItem("gm_dashboard_send_handoff_v1", JSON.stringify({ contactId, occasion: "Thank You", words, memoryPhotos: [], at: Date.now() }));
  const nonce = mod.writeHomeSendIntent(window.sessionStorage, { contactId, occasion: "Thank You" });
  return `/dashboard/send?contactId=${contactId}&occasion=Thank+You&from=dashboard&intent=${nonce}`;
}

test("complete, no gift: the Home Send click sends exactly once through the existing send, with Home's words, a send key and no gift or address", async () => {
  const url = homeSend();
  const m = await mountAt(url);
  try {
    assert.equal(mod.__sends.length, 1, "one send");
    const p = mod.__sends[0];
    assert.equal(p.recipientEmail, "samantha@example.com");
    assert.equal(p.recipientName, "Samantha Cole");
    assert.equal(p.occasionKey, "thankyou");
    assert.match(String(p.customMessage || p.personalMessage || p.message || JSON.stringify(p)), /Thank you for everything, Sam\./, "Home's words are sent");
    assert.ok(p.sendRequestId, "the existing duplicate-protection key is attached");
    assert.notEqual(p.includeGift, true, "no gift");
    assert.equal(p.shippingAddress ?? p.address ?? null, null, "no postal address");
    assert.equal(window.sessionStorage.getItem(mod.HOME_SEND_INTENT_KEY), null, "the intent is used up");
    assert.equal(m.host.querySelector('[data-testid="review-occasion"]'), null, "no second confirmation");
  } finally { await m.unmount(); }
  // Refresh / Back to the same URL: the intent is gone, nothing more is sent.
  const again = await mountAt(url);
  try { assert.equal(mod.__sends.length, 1, "a refresh of the same URL sends nothing"); } finally { await again.unmount(); }
});

test("an ordinary URL (no intent), a wrong nonce, or a stale intent never sends", async () => {
  let m = await mountAt("/dashboard/send?contactId=c1&occasion=Thank+You&from=dashboard");
  try { assert.equal(mod.__sends.length, 0, "no intent → nothing"); } finally { await m.unmount(); }
  mod.writeHomeSendIntent(window.sessionStorage, { contactId: "c1", occasion: "Thank You" });
  m = await mountAt("/dashboard/send?contactId=c1&occasion=Thank+You&from=dashboard&intent=not-the-nonce");
  try { assert.equal(mod.__sends.length, 0, "wrong nonce → nothing"); } finally { await m.unmount(); }
  const nonce = mod.writeHomeSendIntent(window.sessionStorage, { contactId: "c1", occasion: "Thank You" }, Date.now() - 3 * 60 * 1000);
  m = await mountAt(`/dashboard/send?contactId=c1&occasion=Thank+You&from=dashboard&intent=${nonce}`);
  try { assert.equal(mod.__sends.length, 0, "an intent older than two minutes → nothing"); } finally { await m.unmount(); }
});

test("missing: a photo the send rule refuses (data: URL) → only the photo is asked for; nothing is sent; the words stay", async () => {
  globalThis.__user = { ...SENDER, photoUrl: "data:image/png;base64,AAAA" };
  const m = await mountAt(homeSend());
  try {
    assert.equal(mod.__sends.length, 0);
    assert.match(text(m.host), /Add a profile photo to send/, "the existing photo requirement is shown");
    assert.equal(m.host.querySelector('[data-testid="review-occasion"]'), null, "no review");
    assert.equal(m.host.querySelector('textarea[name="customMessage"]').value, "Thank you for everything, Sam.");
  } finally { await m.unmount(); }
});

test("a gift (a restored QR Cash draft): the existing review opens, nothing is sent until it is confirmed there", async () => {
  window.localStorage.setItem("greetme_drafts", JSON.stringify({ "draft_c1_Thank You": { id: "draft_c1_Thank You", contactId: "c1", occasionType: "Thank You", status: "draft",
    formData: { contactId: "c1", occasionType: "Thank You" }, giftChoice: { type: "qrcash", amount: 25 } } }));
  const m = await mountAt(homeSend());
  try {
    assert.equal(mod.__sends.length, 0, "nothing sent");
    assert.ok(m.host.querySelector('[data-testid="review-occasion"]'), "the existing review is open (quote, payment and consent follow from it)");
  } finally { await m.unmount(); }
});

test("missing voice (server answer): the existing voice checkpoint opens, one attempt only, greeting kept", async () => {
  globalThis.__sendAnswer = { error: "Your voice needs a fresh recording before this can be delivered.", code: "VOICE_CLONE_MISSING" };
  const m = await mountAt(homeSend());
  try {
    assert.equal(mod.__sends.length, 1, "one attempt, no automatic retry");
    assert.match(text(m.host), /voice/i, "the voice checkpoint is shown");
    assert.equal(m.host.querySelector('textarea[name="customMessage"]').value, "Thank you for everything, Sam.");
  } finally { await m.unmount(); }
});

// ── Team 5 F2 / F6 (Report 146) ─────────────────────────────────────────────────────────────────────────────────────
const bodyText = () => (globalThis.__toasts || []).map((t) => `${t.title} ${t.body}`).join(" | ");

test("F6: an intent seen again (refresh/Back after the Home Send) sends nothing and says it was already opened", async () => {
  const url = homeSend();
  let m = await mountAt(url);
  await m.unmount();
  assert.equal(mod.__sends.length, 1);
  m = await mountAt(url);
  try {
    assert.equal(mod.__sends.length, 1, "no second send");
    assert.match(bodyText(), /Check your send status/);
    assert.match(bodyText(), /This greeting was previously opened from Home\. Check Sent to see whether it was delivered before trying again\./);
  } finally { await m.unmount(); }
});

test("F6: an intent that never arrived (or expired) sends nothing and says so", async () => {
  const m = await mountAt("/dashboard/send?contactId=c1&occasion=Thank+You&from=dashboard&intent=never-stored");
  try {
    assert.equal(mod.__sends.length, 0);
    assert.match(bodyText(), /Ready for your review/);
    assert.match(bodyText(), /Nothing was sent\. Review your greeting, then select Done & Send\./);
  } finally { await m.unmount(); }
});

test("F2: back-to-back Home Sends to DIFFERENT people (first still in flight) get their own send keys; the same greeting again keeps its key", async () => {
  let m = await mountAt(homeSend({ contactId: "c1" }));
  await m.unmount();
  m = await mountAt(homeSend({ contactId: "c2", words: "Thanks, Jordan." }));
  await m.unmount();
  m = await mountAt(homeSend({ contactId: "c2", words: "Thanks, Jordan." }));
  await m.unmount();
  assert.equal(mod.__sends.length, 3);
  const [a, b, c] = mod.__sends;
  assert.equal(a.recipientEmail, "samantha@example.com"); assert.equal(b.recipientEmail, "jordan@example.com");
  assert.notEqual(b.sendRequestId, a.sendRequestId, "a different person gets a fresh key (no 409)");
  assert.equal(c.sendRequestId, b.sendRequestId, "the same greeting again keeps its key (server converges on one send)");
});
