// src/pages/scheduledGiftBackupDashboard.browser.test.mjs
//
// Backup gift box (founder-approved, gift boxes only) in the dashboard's Dates & gifts, with the feature switch ON only
// inside this test's bundle. Harness: scheduledGiftDashboard.browser.test.mjs (REAL DashboardHome, resolver, picker,
// consent planning; the scheduler's confirmation modal stubbed to "agree"). Proves: the Dates & gifts row shows
// "Backup: {name}"; the save sends backup + approvedTotalCents with consent sched-gift-v2; without a backup the request
// body is byte-identical to the v1 one with consent sched-gift-v1.
//
// Run (Node 20.x): node --test src/pages/scheduledGiftBackupDashboard.browser.test.mjs
//
// Run (Node 20.x): node --test src/pages/scheduledGiftDashboard.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__sgbkdash.entry.jsx");
const BUNDLE = join(__dirname, ".__sgbkdash.bundle.mjs");
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
const BOXES = [{ providerProductId: "box-cookie", name: "Cookie Box", priceMinor: 3699, currency: "USD" }, { providerProductId: "box-tea", name: "Tea Sampler", priceMinor: 2999, currency: "USD" }, { providerProductId: "box-speaker", name: "Speaker", priceMinor: 5999, currency: "USD", requiresOptions: true }];
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

const pickTab = async (k) => { await click($(`[data-testid=sg-tab-${k}]`)); };
const chooseFirst = async () => { await click([...$("[data-testid=sg-step-product]").querySelectorAll("button")].find((b) => /Choose/.test(b.textContent))); };
const fill = async (k, v) => setValue($(`[data-testid=sg-delivery-${k}]`), v);
const authNeed = () => JSON.parse($("[data-testid=auth-modal]").dataset.need);
async function toPicker(opts) {
  await mount(opts);
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  const row = $$("[data-testid=gx-resolver-row]")[0];
  await setValue(row.querySelector("input"), "1960-02-11");
  await setValue($$("[data-testid=gx-resolver-row]")[0].querySelector("select"), "merch");
  await click($("[data-testid=sg-choose]"));
}
async function chooseBox() {
  await chooseFirst();
  for (const [k, v] of [["firstName", "Margaret"], ["lastName", "Rivera"], ["address1", "2 Elm St"], ["city", "Town"], ["state", "nj"], ["postalCode", "07001"]]) await fill(k, v);
  await click($("[data-testid=sg-get-total]"));
}


const inStep = (step, id) => $(`[data-testid=${step}] [data-testid=gift-card-action-${id}]`);
async function chooseCookie() {
  await toPicker();
  await click(inStep("sg-step-product", "box-cookie"));
  for (const [k, v] of [["firstName", "Margaret"], ["lastName", "Rivera"], ["address1", "2 Elm St"], ["city", "Town"], ["state", "nj"], ["postalCode", "07001"]]) await fill(k, v);
  await click($("[data-testid=sg-get-total]"));
}

test("Dates & gifts: a backup gift box shows on the row; the save sends backup + approvedTotalCents and consent sched-gift-v2", async () => {
  await chooseCookie();
  await click($("[data-testid=sg-backup-add]"));
  const ids = $$("[data-testid=sg-backup-list] [data-testid^=gift-card-action-]").map((b) => b.dataset.testid.replace("gift-card-action-", ""));
  assert.deepEqual(ids, ["box-tea"], "the chosen box and the required-option box are not offered");
  await click(inStep("sg-step-backup", "box-tea"));
  assert.equal($("[data-testid=sg-backup-cap]").textContent, "If Cookie Box isn't available, we'll order your backup Tea Sampler instead, only if its full total is no more than $45.99.");
  await click($("[data-testid=sg-use]"));
  assert.equal($("[data-testid=sg-entry-backup]").textContent, "Backup: Tea Sampler");
  await click($("[data-testid=gx-dates-save]"));
  assert.equal(authNeed().scheduledGiftConsent, true);
  await click($("[data-testid=auth-save]"));
  const body = globalThis.__saves[0].body;
  assert.deepEqual(body.occasionGiftSettings.birthday.scheduledGift.backup, { providerProductId: "box-tea", variants: [], quantity: 1, name: "Tea Sampler", imageUrl: "" });
  assert.equal(body.occasionGiftSettings.birthday.scheduledGift.approvedTotalCents, 4599);
  assert.deepEqual(body.scheduledGiftConsents, { birthday: { accepted: true, wordingVersion: "sched-gift-v2" } });
});

test("Dates & gifts without a backup: the request body is byte-identical to v1 and the consent is sched-gift-v1", async () => {
  await chooseCookie();
  await click($("[data-testid=sg-backup-add]"));
  await click(inStep("sg-step-backup", "box-tea"));
  await click($("[data-testid=sg-backup-remove]"));
  await click($("[data-testid=sg-use]"));
  assert.equal($("[data-testid=sg-entry-backup]"), null);
  await click($("[data-testid=gx-dates-save]"));
  await click($("[data-testid=auth-save]"));
  const body = globalThis.__saves[0].body;
  assert.equal(JSON.stringify(body.occasionGiftSettings.birthday),
    '{"type":"gift_boxes","autoGift":true,"scheduledGift":{"v":1,"vendor":"gift_boxes","name":"Cookie Box","imageUrl":"","maxTotalCents":4600,"delivery":{"firstName":"Margaret","lastName":"Rivera","address1":"2 Elm St","city":"Town","state":"NJ","postalCode":"07001","country":"US"},"providerProductId":"box-cookie","variants":[],"quantity":1}}');
  assert.equal(JSON.stringify(body.scheduledGiftConsents), '{"birthday":{"accepted":true,"wordingVersion":"sched-gift-v1"}}');
});
