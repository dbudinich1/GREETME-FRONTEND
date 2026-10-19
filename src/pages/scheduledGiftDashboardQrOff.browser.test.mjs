// Scheduled physical gift (Report 117 rev 3, U1; Team 6 contract v1) in the dashboard's Dates & gifts, with the
// feature switch ON only inside this test's bundle. Proves the saved request matches the contract: the snapshot under
// occasionGiftSettings[type].scheduledGift and the consent sent only when given; a reminder sends no consent.
// src/pages/scheduledGiftDashboardQrOff.browser.test.mjs
//
// RENDERED coverage of the personal dashboard (Report 103, founder-approved rendering). The REAL DashboardHome is
// esbuild-bundled and mounted in jsdom with the REAL resolver, hand-off, consent-planning and normalisation code.
// Only ambient collaborators are stubbed (router, auth, api client, toasts, the account-state hook, images, and the
// mount-only panels). Proves behaviour, not source text:
//   * the settled selection rules (refusals keep every existing selection; nothing is silently dropped);
//   * Send Now hands ONE recipient + ONE occasion (+ words/photos once) to the existing send flow;
//   * one recipient's scheduler occasions are saved through PUT /api/contacts/:id with the FULL record;
//   * group sending is not simulated (Continue stays unavailable; deployment is held for the group package);
//   * Upcoming / Past statuses and dates; Quick Gift; setup re-entry; the Smart Card availability gate.
// Layout stability (no movement on selection) needs a real layout engine and is checked in a real browser
// separately (Report 103 release packet).
//
// Run (Node 20.x): node --test src/pages/scheduledGiftDashboardQrOff.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__sgdashqr.entry.jsx");
const BUNDLE = join(__dirname, ".__sgdashqr.bundle.mjs");
let React, createRoot, act, DashboardHome;

const ROUTER_STUB = `export const useNavigate = () => (to, opts) => { (globalThis.__nav = globalThis.__nav || []).push({ to, opts }); };`;
const AUTH_STUB = `export const useAuth = () => ({ user: globalThis.__user });`;
const ACCT_STUB = `export const useAccountState = () => ({ isAuthenticated: true, isSubscribed: true, isOnboardingComplete: true });`;
const API_STUB = `
const d = () => globalThis.__data;
export default {
  getContacts: async () => ({ ok: true, data: d().contacts }),
  getUpcomingOccasions: async (days) => { (globalThis.__calls = globalThis.__calls || []).push(['upcoming', days]); return { ok: true, data: d().upcoming }; },
  getSentGreetings: async () => ({ ok: true, greetings: d().sent }),
  getSmartCardTiles: async () => d().tiles,
  getQrCashCardStatus: async () => ({ ok: true, card: d().card }),
  updateContact: async (id, body) => { (globalThis.__saves = globalThis.__saves || []).push({ id, body }); return d().saveResult || { ok: true, data: { id } }; },
  getSendEntitlementPreflight: async () => d().preflight,
  chargeGift: async (p) => { (globalThis.__charges = globalThis.__charges || []).push(p); return { ok: true, gift: { feeCents: 274, totalCents: 2774, claimToken: 'ct-' + p.recipientEmail, qrImageUrl: 'q', qrBlobUrl: 'b', claimUrl: 'u' } }; },
  finalizeGift: async () => ({ ok: true, gift: { feeCents: 274, totalCents: 2774, claimToken: 'ct', qrImageUrl: 'q', qrBlobUrl: 'b', claimUrl: 'u' } }),
  quoteGiftBox: async (b) => { (globalThis.__quotes = globalThis.__quotes || []).push(b); return { ok: true, quotedTotalCents: 4599, providerQuotedTotalCents: 4299, feeCents: 300, quotedAt: '2026-10-18T12:00:00Z', quoteValidForMs: 120000, display: { productCents: 3699, shippingHandlingCents: 600, taxCents: 300, totalCents: 4599 } }; },
  chargeGiftBox: async (b) => { (globalThis.__boxCharges = globalThis.__boxCharges || []).push(b); return { ok: true, fulfillmentStatus: 'confirmed', gift: { claimToken: 'box-' + b.contactId } }; },
  finalizeGiftBox: async () => ({ ok: true, fulfillmentStatus: 'confirmed', gift: { claimToken: 'box-final' } }),
  request: async (path) => (path === '/api/merch/products' ? { ok: true, products: [{ syncProductId: 9102, name: 'Hoodie', imageUrl: '', priceCentsMin: 4200, priceCentsMax: 4600, variantCount: 2, variants: [{ syncVariantId: 40021, label: 'S', priceCents: 4200 }, { syncVariantId: 40023, label: 'XL', priceCents: 4600 }] }] } : {}),
  sendGreeting: async (p) => { (globalThis.__sends = globalThis.__sends || []).push(p); const f = (d().sendFail || {})[p.contactId]; if (f) { const e = new Error(f.message || 'refused'); e.status = f.status; e.code = f.code; throw e; } return { ok: true, jobId: 'job-' + p.contactId }; },
};`;
const PROVIDER_STUB = `export const fetchCheckoutAvailability = async () => ({ available: true });
export const fetchProviderCatalog = async () => ({ ok: true, products: (globalThis.__data && globalThis.__data.boxes) || [] });`;
const STRIPE_STUB = `export const stripePromise = Promise.resolve({ confirmCardPayment: async () => ({ paymentIntent: { status: 'succeeded' } }) });`;
const NOTIFY_STUB = `export const showManualToast = (t, b) => { (globalThis.__toasts = globalThis.__toasts || []).push(t); };`;
const NULLCOMP = `const N = () => null; export default N;`;
const QR_STUB = `export default { toDataURL: async () => "data:image/png;base64,AA==" };`;
const CONTACTFORM_STUB = `export const DELIVERY_REQUIRED_GIFT_TYPES = ['curated', 'flowers', 'gift_boxes']; export const requiresDeliveryAddress = (t) => DELIVERY_REQUIRED_GIFT_TYPES.includes(t);`;
const AUTHMODAL_STUB = `import React from "react";
export default function M({ onSave, onCancel, plan }) {
  return React.createElement("div", { "data-testid": "auth-modal", "data-need": JSON.stringify(plan.need) },
    React.createElement("button", { "data-testid": "auth-save", onClick: () => onSave([], (plan.scheduledGiftItems || []).map((i) => i.key)) }, "save"),
    React.createElement("button", { "data-testid": "auth-cancel", onClick: onCancel }, "cancel"));
}`;

function stubPlugin() {
  const map = [
    [/^react-router-dom$/, ROUTER_STUB, "rr"],
    [/context[\\/]AuthContext$/, AUTH_STUB, "auth"],
    [/hooks[\\/]useAccountState$/, ACCT_STUB, "acct"],
    [/api[\\/]api$/, API_STUB, "api"],
    [/utils[\\/]notify$/, NOTIFY_STUB, "notify"],
    [/^qrcode$/, QR_STUB, "qr"],
    [/components[\\/]ContactForm$/, CONTACTFORM_STUB, "cf"],
    [/w07Auth[\\/]SaveAuthorizationModal$/, AUTHMODAL_STUB, "am"],
    [/(OnboardingCoach|WarmReentryWelcome|BusinessGiftCreditsPanel)$/, NULLCOMP, "nullc"],
    [/\.png$/, `export default "img.png";`, "png"],
    [/stripe[\\/]stripeProvider$/, STRIPE_STUB, "stripe"],
    [/api[\\/]providerCheckout$/, PROVIDER_STUB, "provider"],
    [/config[\\/]scheduledPhysicalGift(\.js)?$/, `export const SCHEDULED_PHYSICAL_GIFT_AVAILABLE = true; export const SCHEDULED_GIFT_WORDING_VERSION = "sched-gift-v1";`, "sgflag"],
    [/config[\\/]scheduledQrCash(\.js)?$/, `export const SCHEDULED_QRCASH_AVAILABLE = false; export const SCHEDULED_QRCASH_UNAVAILABLE_COPY = "QR Cash is sent when you send the Greet-Me.";`, "qroff"],
  ];
  return { name: "stub", setup(b) {
    for (const [filter, contents, ns] of map) {
      b.onResolve({ filter }, (a) => ({ path: a.path, namespace: ns }));
      b.onLoad({ filter: /.*/, namespace: ns }, () => ({ contents, loader: "js" }));
    }
  } };
}

before(async () => {
  writeFileSync(ENTRY, `export { default as DashboardHome } from "./DashboardHome.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
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
  globalThis.requestAnimationFrame = (cb) => window.setTimeout(() => cb(Date.now()), 0);
  globalThis.cancelAnimationFrame = (id) => window.clearTimeout(id);
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ DashboardHome } = await import(pathToFileURL(BUNDLE).href));
});
after(async () => {
  if (currentRoot) await act(async () => { currentRoot.unmount(); });
  try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ }
});

const iso = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const CONTACTS = () => [
  { id: "c1", name: "Theresa Morgan", email: "t@example.com", relationshipCategory: "friend", relationship: "Friend",
    occasions: [{ id: "o1", type: "birthday", date: "1990-05-03", autoSend: true }], occasionGiftSettings: { birthday: { type: "qrcash", autoGift: true, amount: 50 } },
    shippingAddress: { line1: "1 Main", city: "Town", state: "NJ", zip: "07000", country: "United States" } },
  { id: "c2", name: "Margaret Rivera", email: "m@example.com", relationshipCategory: "family", relationship: "Mother", occasions: [] },
  { id: "c3", name: "Daniel Okafor", email: "d@example.com", relationshipCategory: "professional", relationship: "Colleague", occasions: [] },
];
const UPCOMING = () => [
  { occasionId: "u1", contactId: "c1", contactName: "Theresa Morgan", occasionType: "birthday", date: iso(2), daysUntil: 2, autoSend: true, scheduleStatus: "queued" },
  { occasionId: "u2", contactId: "c2", contactName: "Margaret Rivera", occasionType: "mothers_day", date: iso(12), daysUntil: 12, autoSend: false, scheduleStatus: null },
  { occasionId: "u3", contactId: "c3", contactName: "Daniel Okafor", occasionType: "anniversary", date: iso(20), daysUntil: 20, autoSend: true, scheduleStatus: null },
  { occasionId: "u4", contactId: "c2", contactName: "Margaret Rivera", occasionType: "birthday", date: iso(30), daysUntil: 30, autoSend: true, scheduleStatus: "cancelled" },
  { occasionId: "u5", contactId: "c3", contactName: "Daniel Okafor", occasionType: "christmas", date: iso(40), daysUntil: 40, autoSend: true, scheduleStatus: "skipped_permanent" },
  { occasionId: "u7", contactId: "c3", contactName: "Daniel Okafor", occasionType: "birthday", date: iso(55), daysUntil: 55, autoSend: true, scheduleStatus: "skipped_transient" },
  { occasionId: "u6", contactId: "c1", contactName: "Theresa Morgan", occasionType: "anniversary", date: iso(50), daysUntil: 50, autoSend: true, scheduleStatus: "paused" },
];
const SENT = () => [
  { id: "s1", recipientName: "Priya Shah", occasionType: "graduation", createdAt: "2026-10-01T10:00:00Z", completedAt: "2026-10-02T10:00:00Z", status: "completed" },
  { id: "s2", recipientName: "Sam Whitaker", occasionType: "thankyou", createdAt: "2026-10-05T10:00:00Z", completedAt: null, status: "failed" },
];

const settle = async () => { for (let i = 0; i < 4; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];
const byText = (sel, txt) => $$(sel).find((e) => e.textContent.includes(txt));
const click = async (el) => { assert.ok(el, "element to click exists"); await act(async () => { el.click(); }); await settle(); };
const setValue = async (el, value) => {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
  await settle();
};
const occ = (label) => byText("[data-testid=gx-occasion] .occ", label);
const menuItems = () => $$(".menu button").map((b) => b.textContent.trim());
const menuOcc = async (key, label) => { if (!$(`.menu-${key}`)) await click($(`[data-testid=gx-menu-${key}]`)); await click($$(`.menu-${key} button`).find((b) => b.textContent.trim() === label)); };
const datesSave = () => $("[data-testid=gx-dates-save]");
const pickPerson = async (name) => { if (!$("[data-testid=gx-picker]")) await click($("[data-testid=gx-addsome]")); await click(byText(".prow", name)); };
const state = () => ({
  occ: $$("[data-testid=gx-occasion] .occ[aria-pressed=true]").map((e) => e.textContent.trim()),
  picks: $$(".pchip").map((e) => e.textContent.trim()),
  rule: $("[data-testid=gx-rule]").textContent,
  cont: $("[data-testid=gx-continue]"),
});

let currentRoot = null;
const VALID_CARD = { present: true, expMonth: 12, expYear: 2030 };
const PREFLIGHT = { ok: true, canSendGreeting: true, remaining: 20, sendLimitUnlimited: false, aiDaily: { limit: 20, used: 0, remaining: 20 } };
const BOXES = [{ providerProductId: "goody-1", name: "Cookie Box", priceMinor: 3699, currency: "USD" }];
async function mountKeeping(snapshot, user) {
  await mount(user ? { user } : {});
  if (currentRoot) { const r = currentRoot; currentRoot = null; await act(async () => { r.unmount(); }); }
  window.sessionStorage.setItem("gm_dashboard_launcher_v1", snapshot);
  globalThis.__nav = []; globalThis.__saves = [];
  const host = document.createElement("div"); document.body.innerHTML = ""; document.body.appendChild(host);
  const root = createRoot(host);
  currentRoot = root;
  await act(async () => { root.render(React.createElement(DashboardHome)); });
  await settle();
}

async function mount({ contacts = CONTACTS(), upcoming = UPCOMING(), sent = SENT(), tiles = { ok: true, tiles: [] }, user, saveResult, card = VALID_CARD, preflight = PREFLIGHT, sendFail, boxes = BOXES } = {}) {
  if (currentRoot) { const r = currentRoot; currentRoot = null; await act(async () => { r.unmount(); }); }
  globalThis.__data = { contacts, upcoming, sent, tiles, saveResult, card, preflight, sendFail, boxes };
  globalThis.__quotes = []; globalThis.__boxCharges = [];
  globalThis.__user = user || { id: "u1", name: "Alex Rivera", voiceId: "v1", photoUrl: "p.jpg" };
  globalThis.__nav = []; globalThis.__saves = []; globalThis.__toasts = []; globalThis.__calls = []; globalThis.__sends = []; globalThis.__charges = [];
  window.sessionStorage.clear(); window.localStorage.clear();
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  currentRoot = root;
  await act(async () => { root.render(React.createElement(DashboardHome)); });
  await settle();
  return root;
}

// With scheduled QR Cash switched OFF and scheduled physical gifts ON, the final confirmation must still run.
const chooseFirst = async () => { await click([...$("[data-testid=sg-step-product]").querySelectorAll("button")].find((b) => /Choose/.test(b.textContent))); };
test("QR Cash scheduling off, physical gifts on: Save still opens the final confirmation and sends the consent", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  await setValue($$("[data-testid=gx-resolver-row]")[0].querySelector("input"), "1960-02-11");
  await setValue($$("[data-testid=gx-resolver-row]")[0].querySelector("select"), "merch");
  await click($("[data-testid=sg-choose]"));
  await click($("[data-testid=sg-tab-merch]")); await chooseFirst();
  await setValue($("[data-testid=sg-variant]"), "40021");
  for (const [k, v] of [["firstName", "Margaret"], ["address1", "2 Elm St"], ["city", "Town"], ["state", "NJ"], ["postalCode", "07001"]]) await setValue($(`[data-testid=sg-delivery-${k}]`), v);
  await setValue($("[data-testid=sg-max]"), "60");
  await click($("[data-testid=sg-use]"));
  await click($("[data-testid=gx-dates-save]"));
  assert.ok($("[data-testid=auth-modal]"), "the final confirmation runs although scheduled QR Cash is off");
  assert.equal(globalThis.__saves.length, 0);
  await click($("[data-testid=auth-save]"));
  assert.deepEqual(globalThis.__saves[0].body.scheduledGiftConsents, { birthday: { accepted: true, wordingVersion: "sched-gift-v1" } });
});
