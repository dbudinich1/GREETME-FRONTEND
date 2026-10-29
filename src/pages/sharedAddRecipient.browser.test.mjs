// src/pages/sharedAddRecipient.browser.test.mjs
//
// Lane 1 (2026-10-28) — SHARED ADD RECIPIENT. Every entry point opens the ONE full "Add New Recipient" dialog
// (Contacts.jsx + the REAL ContactForm.jsx): Home's Add Recipient buttons, the send editor's "+ Add New" /
// "+ Add Recipient", and Celebrations' Add Recipient. The REAL DashboardHome, Contacts (with ContactForm) and
// SendGreeting are mounted together under one real MemoryRouter in jsdom, so each round trip is the one a sender
// makes. Only side-effecting edges are stubbed (auth, the api client with an in-memory recipient store, the
// provider transport, Stripe, QR rendering, mount-only panels). No network, no send, no charge, no order.
// Proves: each entry opens the same full dialog; the initiating flow's choices are kept; after Save during a
// composition the new recipient is back there selected; Cancel returns with nothing lost; an existing email adds
// no second contact; uploaded memory photos are saved on THAT recipient only.
//
// Run (Node 20.x): node --test src/pages/sharedAddRecipient.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__sar.${PID}.${n}`);
const ENTRY = f("entry.jsx"), BUNDLE = f("bundle.mjs");
let React, createRoot, act, M, window;

const AUTH_STUB = `
const user = { id: 'u1', name: 'Alex Rivera', email: 'sender@example.test', emailVerified: true, tier: 'close_circle',
  voiceId: 'v1', voiceUrl: 'https://example.test/v.mp3', photoUrl: 'https://example.test/me.jpg' };
export const useAuth = () => ({ user, loading: false, isAuthenticated: true, refreshUser: async () => user,
  refreshProfile: async () => user, updateUser: () => {}, logout: () => {}, getToken: () => null });
export const AuthContext = { Provider: ({ children }) => children };
export default { useAuth };`;
// An in-memory recipient store. createContact behaves like the server: 201 { ok, data } or a thrown 409 EMAIL_EXISTS.
const API_STUB = `
const S = () => globalThis.__store;
const known = {
  async request() { return {}; },
  async getContacts() { return { ok: true, data: JSON.parse(JSON.stringify(S().contacts)) }; },
  async createContact(body) {
    S().creates.push(JSON.parse(JSON.stringify(body)));
    const email = String(body.email || '').toLowerCase();
    if (S().contacts.some((c) => String(c.email).toLowerCase() === email)) {
      const e = new Error('A contact with this email already exists'); e.status = 409; e.code = 'EMAIL_EXISTS'; throw e;
    }
    const rec = { ...body, id: 'new-' + (S().contacts.length + 1) };
    S().contacts.push(rec);
    return { ok: true, data: rec };
  },
  async uploadContactMemoryPhoto(contactId, file) { S().uploads.push({ contactId, name: file.name }); return { ok: true, blobUrl: 'https://acct.blob.core.windows.net/memory/' + file.name, url: 'https://acct.blob.core.windows.net/memory/' + file.name + '?sig=x' }; },
  async getUpcomingOccasions() { return { ok: true, data: [] }; },
  async getSentGreetings() { return { ok: true, greetings: [] }; },
  async getSmartCardTiles() { return { ok: true, tiles: [] }; },
  async getHeartsBalance() { return { balance: 0 }; },
  async getSendEntitlementPreflight() { return { ok: true, canSendGreeting: true }; },
  async sendGreeting() { throw new Error('no test may send'); },
  async chargeGift() { throw new Error('no test may charge'); },
  async get() { return { data: {} }; },
};
export default new Proxy(known, { get: (t, k) => (k in t ? t[k] : (k === 'then' ? undefined : async () => ({}))) });`;
const PROVIDER_STUB = `export async function fetchCheckoutAvailability() { return { available: false }; }
export async function fetchProviderCatalog() { return { ok: true, products: [] }; }
export async function fetchProviderProducts() { return []; }
export async function fetchTokenizationConfig() { throw new Error('no'); }
export async function retryGiftLink() { throw new Error('no'); }
export async function prepareCheckout() { throw new Error('no'); }
export async function submitCheckout() { throw new Error('no'); }`;
const ACCT_STUB = `export const useAccountState = () => ({ isAuthenticated: true, isSubscribed: true, isOnboardingComplete: true });`;
const STRIPE_STUB = `export const stripePromise = Promise.resolve(null);`;
const QR_STUB = `export default { toDataURL: async () => "data:image/png;base64,AA==" };`;
const NULLCOMP = `const N = () => null; export default N;`;

function stubPlugin() {
  const map = [
    [/context[\\/]AuthContext$/, AUTH_STUB, "auth"],
    [/(^|[\\/])api[\\/]api$/, API_STUB, "api"],
    [/api[\\/]providerCheckout$/, PROVIDER_STUB, "provider"],
    [/hooks[\\/]useAccountState$/, ACCT_STUB, "acct"],
    [/stripe[\\/]stripeProvider$/, STRIPE_STUB, "stripe"],
    [/^qrcode$/, QR_STUB, "qr"],
    [/(OnboardingCoach|WarmReentryWelcome|BusinessGiftCreditsPanel)$/, NULLCOMP, "nullc"],
  ];
  return { name: "stub", setup(b) {
    for (const [filter, contents, ns] of map) {
      b.onResolve({ filter }, (a) => ({ path: a.path, namespace: ns }));
      b.onLoad({ filter: /.*/, namespace: ns }, () => ({ contents, loader: "js" }));
    }
  } };
}

before(async () => {
  writeFileSync(ENTRY, `
import { useLocation } from "react-router-dom";
export { default as DashboardHome } from "./DashboardHome.jsx";
export { default as Contacts } from "./Contacts.jsx";
export { default as SendGreeting } from "./SendGreeting.jsx";
export { MemoryRouter, Routes, Route } from "react-router-dom";
export function Probe() { const l = useLocation(); return <span data-testid="loc" hidden data-at={l.pathname + l.search} />; }
`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl", ".mp4": "dataurl", ".webp": "dataurl" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
    plugins: [stubPlugin()],
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true, writable: true });
  for (const k of ["HTMLElement", "Event", "Node", "getComputedStyle", "localStorage", "sessionStorage", "CustomEvent", "File"]) globalThis[k] = window[k];
  globalThis.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.scrollTo = () => {};
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  globalThis.fetch = async () => { throw new Error("no network in this test"); }; window.fetch = globalThis.fetch;
  globalThis.alert = () => {}; window.alert = globalThis.alert;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
let root = null;
afterEach(async () => { if (root) { const r = root; root = null; await act(async () => { r.unmount(); }); } });
after(() => { for (const t of [ENTRY, BUNDLE]) { try { rmSync(t, { force: true }); } catch { /* ignore */ } } });

const BASE = () => [
  { id: "c1", name: "Theresa Morgan", email: "t@example.test", relationshipCategory: "friend", relationship: "Friend", occasions: [], memoryPhotos: [{ url: "https://acct.blob.core.windows.net/memory/theresa.jpg" }] },
  { id: "c2", name: "Margaret Rivera", email: "m@example.test", relationshipCategory: "family", relationship: "Mother", occasions: [], memoryPhotos: [] },
];
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const txt = () => (document.body.textContent || "").replace(/\s+/g, " ");
const at = () => $("[data-testid=loc]")?.getAttribute("data-at");
const settle = async (n = 6) => { for (let i = 0; i < n; i += 1) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const wait = async (ms) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
const click = async (el) => { assert.ok(el, "element to click exists"); await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); }); await settle(); };
const byText = (sel, re) => $$(sel).find((e) => re.test((e.textContent || "").trim()));
const setValue = async (el, value) => {
  assert.ok(el, "field exists");
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
  await settle(2);
};

async function mount(url, { contacts = BASE(), state } = {}) {
  globalThis.__store = { contacts, creates: [], uploads: [] };
  window.sessionStorage.clear(); window.localStorage.clear();
  if (root) { const r = root; root = null; await act(async () => { r.unmount(); }); }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  const h = React.createElement;
  const [pathname, search = ""] = url.split("?");
  const page = (el) => h(React.Fragment, null, el, h(M.Probe));
  await act(async () => {
    root.render(h(M.MemoryRouter, { initialEntries: [{ pathname, search: search ? `?${search}` : "", state }] },
      h(M.Routes, null,
        h(M.Route, { path: "/dashboard", element: page(h(M.DashboardHome)) }),
        h(M.Route, { path: "/dashboard/contacts", element: page(h(M.Contacts)) }),
        h(M.Route, { path: "/dashboard/send", element: page(h(M.SendGreeting)) }))));
  });
  await settle(10);
}

// The ONE full dialog: its title, and the full form's sections (contact information, relationship context, memory
// photos, Occasion Scheduler) — not a name-and-email mini form.
function assertFullAddDialog(label) {
  assert.match(txt(), /Add New Recipient/, `${label}: the Add New Recipient dialog`);
  assert.ok($('input[name="name"]') && $('input[name="email"]'), `${label}: contact information`);
  assert.match(txt(), /Relationship Context/, `${label}: relationship context`);
  assert.ok($("[data-testid=moments-heading]"), `${label}: recipient memory photos (Moments)`);
  assert.ok($("[data-testid=special-occasions-toggle]"), `${label}: the Occasion Scheduler`);
  assert.equal(byText("button", /^Add & Continue$/), undefined, `${label}: no mini form`);
}
async function fillAndSave(name, email) {
  await setValue($('input[name="name"]'), name);
  await setValue($('input[name="email"]'), email);
  await click(byText("button", /^SAVE$/));
  await settle(10);
}
const homePicks = () => $$(".pchip").map((e) => e.textContent.trim());
const homeOccasions = () => $$("[data-testid=gx-occasion] .occ[aria-pressed=true]").map((e) => e.textContent.trim());
async function homeChooseBirthdayAndTheresa() {
  await click(byText("[data-testid=gx-occasion] .occ", /^Birthday$/));
  if (!$("[data-testid=gx-picker]")) await click($("[data-testid=gx-addsome]"));
  await click(byText(".prow", /Theresa Morgan/));
  assert.deepEqual(homeOccasions(), ["Birthday"]);
  assert.ok(homePicks().some((p) => /Theresa Morgan/.test(p)));
}

// ── Home ──────────────────────────────────────────────────────────────────────────────────────────────────────────
for (const [label, find] of [
  ["Home hero Add Recipient", () => $("[data-testid=gx-add-recipient]")],
  ["Home Celebration Manager Add Recipient", () => $("[data-testid=gx-mgr-add]")],
  ["Home picker 'Add a new recipient'", () => byText("button", /Add a new recipient/)],
]) {
  test(`${label}: opens the full dialog and keeps Home's choices; Save brings the sender back with the new person selected`, async () => {
    await mount("/dashboard");
    await homeChooseBirthdayAndTheresa();
    await click(find());
    await wait(150);
    assert.equal(at(), "/dashboard/contacts");
    assertFullAddDialog(label);
    const snap = JSON.parse(window.sessionStorage.getItem("gm_dashboard_launcher_v1"));
    assert.deepEqual(snap.occasions, ["Birthday"], "occasion kept");
    assert.deepEqual(snap.picks, ["c1"], "person kept");
    await fillAndSave("Nora Newcomb", "nora@example.test");
    assert.equal(globalThis.__store.creates.length, 1, "one create");
    assert.equal(at(), "/dashboard", "back on Home");
    assert.deepEqual(homeOccasions(), ["Birthday"], "the occasion is still chosen");
    const picks = homePicks();
    assert.ok(picks.some((p) => /Theresa Morgan/.test(p)), "the earlier pick is kept");
    assert.ok(picks.some((p) => /Nora Newcomb/.test(p)), "the new recipient is selected");
    assert.equal(window.sessionStorage.getItem("gm_dashboard_launcher_v1"), null, "the kept choices are used once");
  });
}

test("Home: Cancel in the dialog returns to Home with every choice kept and nothing created", async () => {
  await mount("/dashboard");
  await homeChooseBirthdayAndTheresa();
  await click($("[data-testid=gx-add-recipient]"));
  await wait(150);
  assertFullAddDialog("Home cancel");
  await click(byText("button", /^Cancel$/));
  await settle(10);
  assert.equal(at(), "/dashboard");
  assert.equal(globalThis.__store.creates.length, 0);
  assert.deepEqual(homeOccasions(), ["Birthday"]);
  assert.deepEqual(homePicks().length, 1);
  assert.ok(/Theresa Morgan/.test(homePicks()[0]));
});

test("Home with no recipients: the empty list's Add Recipient opens the same dialog; the first recipient comes back selected", async () => {
  await mount("/dashboard", { contacts: [] });
  await click(byText("[data-testid=gx-recipients-empty] button", /Add Recipient/));
  await wait(150);
  assertFullAddDialog("Home empty list");
  await fillAndSave("First Person", "first@example.test");
  assert.equal(at(), "/dashboard");
  assert.deepEqual(homePicks().map((p) => /First Person/.test(p)), [true]);
});

// ── Send editor ───────────────────────────────────────────────────────────────────────────────────────────────────
async function sendComposeForTheresa() {
  await setValue($('select[name="contactId"]'), "c1");
  const message = $('textarea[name="customMessage"]');
  assert.ok(message, "the message box");
  await setValue(message, "Thinking of you this week.");
}
test("Send editor '+ Add New': opens the full dialog; Save returns to the greeting with the new recipient selected and the words kept", async () => {
  await mount("/dashboard/send");
  await sendComposeForTheresa();
  await click($("[data-testid=send-add-new-recipient]"));
  await wait(150);
  assert.equal(at(), "/dashboard/contacts");
  assertFullAddDialog("Send + Add New");
  const kept = JSON.parse(window.sessionStorage.getItem("sendGreetingState"));
  assert.equal(kept.formData.customMessage, "Thinking of you this week.", "the greeting is kept");
  await fillAndSave("Nora Newcomb", "nora@example.test");
  await wait(200);
  assert.equal(globalThis.__store.creates.length, 1, "one create");
  assert.match(at(), /^\/dashboard\/send/, "back on the send editor");
  const sel = $('select[name="contactId"]');
  assert.equal(sel.value, "new-3", "the new recipient is selected");
  assert.equal(sel.selectedOptions[0].textContent, "Nora Newcomb");
  assert.equal($('textarea[name="customMessage"]').value, "Thinking of you this week.", "the words are kept");
  assert.equal([...sel.options].filter((o) => o.textContent === "Nora Newcomb").length, 1, "listed once");
});

test("Send editor: Cancel in the dialog returns to the greeting unchanged (same recipient, same words), nothing created", async () => {
  await mount("/dashboard/send");
  await sendComposeForTheresa();
  await click($("[data-testid=send-add-new-recipient]"));
  await wait(150);
  await click(byText("button", /^Cancel$/));
  await settle(10); await wait(200);
  assert.match(at(), /^\/dashboard\/send/);
  assert.equal(globalThis.__store.creates.length, 0);
  assert.equal($('select[name="contactId"]').value, "c1");
  assert.equal($('textarea[name="customMessage"]').value, "Thinking of you this week.");
});

test("Send editor with no recipients: '+ Add Recipient' opens the same full dialog (no mini form) and the first recipient comes back selected", async () => {
  await mount("/dashboard/send", { contacts: [] });
  assert.equal(byText("button", /^Add & Continue$/), undefined);
  await click($("[data-testid=send-add-recipient]"));
  await wait(150);
  assertFullAddDialog("Send + Add Recipient");
  await fillAndSave("First Person", "first@example.test");
  await wait(200);
  assert.match(at(), /^\/dashboard\/send/);
  assert.equal($('select[name="contactId"]').value, "new-1");
});

// ── Celebrations (Recipients page) ───────────────────────────────────────────────────────────────────────────────
test("Celebrations Add Recipient: the same full dialog; Save stays on Recipients and lists the person once", async () => {
  await mount("/dashboard/contacts");
  await click($("[data-testid=add-recipient]"));
  await wait(150);
  assertFullAddDialog("Celebrations");
  await fillAndSave("Nora Newcomb", "nora@example.test");
  assert.equal(at(), "/dashboard/contacts", "no navigation away");
  assert.equal(globalThis.__store.creates.length, 1);
  assert.doesNotMatch(txt(), /Add New Recipient/, "dialog closed");
  assert.match(txt(), /Nora Newcomb/);
});

// ── No duplicates ────────────────────────────────────────────────────────────────────────────────────────────────
test("an email already in the recipients adds no second contact (not even a local copy); the dialog stays open and says why; no return", async () => {
  await mount("/dashboard/send");
  await sendComposeForTheresa();
  await click($("[data-testid=send-add-new-recipient]"));
  await wait(150);
  await fillAndSave("Theresa Again", "T@example.test");
  assert.equal(at(), "/dashboard/contacts", "stays in the dialog");
  assert.match(txt(), /already in your recipients/);
  assert.match(txt(), /Add New Recipient/);
  assert.equal(globalThis.__store.contacts.length, 2, "server store unchanged");
  const local = JSON.parse(window.localStorage.getItem("greetme_recipients") || "[]");
  assert.equal(local.some((c) => c.name === "Theresa Again"), false, "no local-only duplicate");
  assert.ok(window.sessionStorage.getItem("sendGreetingState"), "the greeting is still kept for the return");
});

test("double-pressing SAVE creates one recipient", async () => {
  await mount("/dashboard/contacts");
  await click($("[data-testid=add-recipient]"));
  await wait(150);
  await setValue($('input[name="name"]'), "Nora Newcomb");
  await setValue($('input[name="email"]'), "nora@example.test");
  const save = byText("button", /^SAVE$/);
  await act(async () => { save.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); save.dispatchEvent(new window.MouseEvent("click", { bubbles: true })); });
  await settle(10);
  assert.equal(globalThis.__store.contacts.filter((c) => c.email === "nora@example.test").length, 1);
});

// ── Recipient photos ─────────────────────────────────────────────────────────────────────────────────────────────
test("memory photos uploaded in the dialog are saved on THAT recipient only; other recipients' photos are untouched", async () => {
  await mount("/dashboard/send");
  await sendComposeForTheresa();
  await click($("[data-testid=send-add-new-recipient]"));
  await wait(150);
  await setValue($('input[name="name"]'), "Nora Newcomb");
  await setValue($('input[name="email"]'), "nora@example.test");
  if (!$('input[type=file][multiple]')) await click($("[data-testid=moments-heading]").closest("button"));
  const input = $('input[type=file][multiple]');
  assert.ok(input, "the memory-photo picker");
  Object.defineProperty(input, "files", { value: [new window.File(["x"], "nora-1.jpg", { type: "image/jpeg" })], configurable: true });
  await act(async () => { input.dispatchEvent(new window.Event("change", { bubbles: true })); });
  await settle(10);
  await click(byText("button", /^SAVE$/));
  await settle(10); await wait(200);
  const created = globalThis.__store.creates[0];
  assert.deepEqual(created.memoryPhotos.map((p) => p.url), ["https://acct.blob.core.windows.net/memory/nora-1.jpg"], "on the new recipient");
  const theresa = globalThis.__store.contacts.find((c) => c.id === "c1");
  assert.deepEqual(theresa.memoryPhotos.map((p) => p.url), ["https://acct.blob.core.windows.net/memory/theresa.jpg"], "Theresa's photos unchanged");
  assert.equal($('select[name="contactId"]').value, "new-3");
});
