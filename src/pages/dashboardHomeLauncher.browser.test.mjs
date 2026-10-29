// src/pages/dashboardHomeLauncher.browser.test.mjs
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
// Run (Node 20.x): node --test src/pages/dashboardHomeLauncher.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__dashlauncher.entry.jsx");
const BUNDLE = join(__dirname, ".__dashlauncher.bundle.mjs");
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
    React.createElement("button", { "data-testid": "auth-save", onClick: () => onSave([]) }, "save"),
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

test("renders the sections; occasions are the Recipients page's list and groups plus the send page's own; Quick Gift only in the welcome banner; Upcoming asks for 60 days", async () => {
  await mount();
  for (const id of ["gx-hero", "gx-modes", "gx-step-1", "gx-step-2", "gx-step-3", "gx-step-4", "gx-footbar", "gx-manager", "gx-schedule", "gx-install"]) {
    assert.ok($(`[data-testid=${id}]`), id);
  }
  assert.equal($("[data-testid=gx-resolver]"), null, "Dates & gifts is a modal, not part of the page");
  const chips = $$("[data-testid=gx-occasion] .occ").map((e) => e.textContent.trim());
  assert.deepEqual(chips, ["Birthday", "Anniversary", "Graduation", "Thank You", "Congratulations", "Just Because", "Holidays", "Faith holidays"]);
  await click($("[data-testid=gx-menu-holidays]"));
  assert.deepEqual($$(".menu .mgroup").map((e) => e.textContent), ["Secular holidays", "Any holiday"]);
  assert.deepEqual(menuItems(), ["New Year's Day", "Valentine's Day", "Mother's Day", "Father's Day", "Thanksgiving", "Season's Greetings"]);
  const holidays = menuItems();
  await click($("[data-testid=gx-menu-faith]"));
  assert.deepEqual($$(".menu .mgroup").map((e) => e.textContent), ["Christianity", "Judaism", "Islam"]);
  assert.deepEqual(menuItems(), ["Christmas", "Easter", "Rosh Hashanah", "Hanukkah", "Passover", "Eid al-Fitr", "Eid al-Adha", "Ramadan"]);
  const occasionChoices = [...chips, ...holidays, ...menuItems()];
  for (const absent of ["Engagement", "Sympathy", "Wedding", "Baby", "Get Well"]) assert.equal(occasionChoices.includes(absent), false, `${absent} is not on the Recipients list`);
  assert.ok($("[data-testid=gx-hero] [data-testid=gx-quick-hero]"), "Quick Gift is in the welcome banner (founder 2026-10-20)"); assert.equal($("[data-testid=gx-quick-banner]"), null, "never in the gift carousel");
  assert.equal($("[data-testid=gx-step-4]").textContent.includes("Quick Gift"), false, "Quick Gift is not in the gift carousel");
  // N-6 (founder 2026-10-18): a recorded voice is required for group sending; words and memory photos stay optional
  assert.equal($("[data-testid=gx-step-3]").textContent.includes("Personalize — optional"), false);
  const step3 = $("[data-testid=gx-step-3]").textContent;
  // Walkthrough 2026-10-24 (founder wording): the field titles changed; both stay optional (the Save row says so).
  assert.match(step3, /A few words from the heart/); assert.match(step3, /Make it extra special/);
  assert.match(step3, /Words and memory photos are optional\./);
  assert.deepEqual(globalThis.__calls.find((c) => c[0] === "upcoming"), ["upcoming", 60]);
  assert.equal(document.body.textContent.includes("SIMULATED"), false, "no preview simulation ships");
});

test("rule: one person may take several scheduler occasions; a second person is refused and nothing is dropped", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday")); await click(occ("Anniversary"));
  await pickPerson("Theresa");
  assert.deepEqual(state().occ, ["Birthday", "Anniversary"]);
  await pickPerson("Margaret");
  const s = state();
  assert.equal(s.picks.length, 1, "the second person is refused");
  assert.deepEqual(s.occ, ["Birthday", "Anniversary"], "the occasions stay");
  assert.match(s.rule, /Several occasions go to one person/);
  await click(byText(".track button", "Family"));
  assert.equal($(".track button[aria-pressed=true]").textContent.trim(), "Individuals", "a whole group is refused too");
});

test("rule: several people share one occasion; a second occasion is refused and nothing is dropped", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Congratulations"));
  await pickPerson("Theresa"); await pickPerson("Margaret");
  await click(occ("Thank You"));
  const s = state();
  assert.deepEqual(s.occ, ["Congratulations"]);
  assert.equal(s.picks.length, 2);
  assert.match(s.rule, /share one occasion/);
});

test("rule: an occasion the scheduler does not hold cannot be combined with another; the reason names it", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday")); await click(occ("Thank You"));
  assert.deepEqual(state().occ, ["Birthday"]);
  assert.match(state().rule, /Thank You is sent on its own with Send Now/);
});

const many = (n) => [...CONTACTS(), ...Array.from({ length: n - 3 }, (_, i) => ({ id: `x${i}`, name: `Extra Person${i}`, email: `x${i}@example.com`, relationshipCategory: "friend", relationship: "Friend", occasions: [] }))];

test("group Send Now: one review with each person's gift and cost and the total; nothing runs until Send", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  assert.match($("[data-testid=gx-fine]").textContent, /review each person.s gift and cost/);
  await click(state().cont);
  assert.ok($("[data-testid=gx-group-review]"), "the review opens");
  assert.equal($$("[data-testid=grv-row]").length, 3);
  await setValue($("[data-testid=grv-default-gift]"), "qrcash:25");
  assert.match($("[data-testid=grv-total]").textContent, /Total \$83\.22/, "3 x ($25 + $1.99 + 3%)");
  assert.match($("[data-testid=grv-total-details]").textContent, /QR Cash \$75\.00 \+ fees \$8\.22/, "the breakdown is expandable");
  assert.match($$("[data-testid=grv-cost]")[0].textContent, /\$25\.00 \+ \$2\.74 fee = \$27\.74/, "amount, fee and total, compactly");
  assert.match($("[data-testid=grv-total]").textContent, /saved/);
  // individual override: Margaret gets no gift
  await setValue(document.querySelector('[aria-label="Gift for Margaret Rivera"]'), "none");
  assert.match($("[data-testid=grv-total]").textContent, /Total \$55\.48/);
  assert.equal(globalThis.__sends.length, 0, "nothing sent at review");
  assert.equal(globalThis.__charges.length, 0, "nothing charged at review");
  assert.match($("[data-testid=grv-rules]").textContent, /20 left; this group uses 3/);
});

test("group Send Now: Send charges only the QR Cash people (saved card) and sends each person once with its own key", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  await setValue($("[data-testid=grv-default-gift]"), "qrcash:25");
  await setValue(document.querySelector('[aria-label="Gift for Margaret Rivera"]'), "none");
  await click($("[data-testid=grv-send]"));
  await settle();
  assert.equal(globalThis.__sends.length, 3);
  assert.equal(new Set(globalThis.__sends.map((p) => p.sendRequestId)).size, 3, "a separate stable key per person");
  assert.equal(globalThis.__charges.length, 2);
  assert.ok(globalThis.__charges.every((c) => c.useSavedPaymentMethod === true && !("paymentMethodId" in c)));
  const m = globalThis.__sends.find((p) => p.contactId === "c2");
  assert.equal(m.includeGift, false, "Margaret's override: no gift");
  assert.equal(globalThis.__sends.find((p) => p.contactId === "c1").gift.claimToken, "ct-t@example.com", "each charged gift goes to its own person");
  assert.ok(globalThis.__sends.every((p) => p.occasionType === "Birthday" && p.photos.length >= 0));
  assert.equal($$("[data-testid=grv-status]").filter((e) => e.textContent === "Accepted for sending").length, 3);
  assert.match($("#grv-title").textContent, /3 of 3 accepted for sending/, "header, tags and footer say the same thing");
});

test("group: the current rules decide — too few sends left blocks Send and says why", async () => {
  await mount({ preflight: { ok: true, canSendGreeting: true, remaining: 2, sendLimitUnlimited: false, aiDaily: { limit: 5, used: 0, remaining: 5 } } });
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  assert.equal($("[data-testid=grv-send]").disabled, true);
  assert.match($("[data-testid=grv-blockers]").textContent, /2 sends left; this group needs 3/);
  // leaving one person out at review brings it within the rules (never dropped silently)
  await click(document.querySelector('[aria-label="Leave out Daniel Okafor"]'));
  assert.equal($("[data-testid=grv-send]").disabled, false);
});

test("group: QR Cash needs a saved card; without one the review says so and does not charge", async () => {
  await mount({ card: null });
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  await setValue($("[data-testid=grv-default-gift]"), "qrcash:25");
  assert.equal($("[data-testid=grv-send]").disabled, true);
  assert.match($("[data-testid=grv-blockers]").textContent, /No saved card on file/);
});

test("group: a run-wide refusal stops the run, keeps the unsent people and offers to try the rest again", async () => {
  await mount({ sendFail: { c2: { status: 429, code: "AI_DAILY_LIMIT", message: "You've reached today's limit." } } });
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  await click($("[data-testid=grv-send]"));
  await settle();
  assert.ok($("[data-testid=grv-stopped]"));
  assert.deepEqual($$("[data-testid=grv-status]").map((e) => e.textContent), ["Accepted for sending", "Not sent", "Waiting"]);
  assert.ok($("[data-testid=grv-retry]"));
  assert.ok(JSON.parse(window.localStorage.getItem("gm_group_run_v1")), "the run is kept so it can be resumed");
});

test("group cap: an 11th person is refused with a reason; a category over 10 must be trimmed before continuing", async () => {
  await mount({ contacts: many(13) });
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  for (const c of many(13).slice(0, 10)) await pickPerson(c.name);
  assert.equal(state().picks.length, 10);
  await pickPerson("Extra Person8");
  assert.equal(state().picks.length, 10, "the 11th is refused");
  assert.match(state().rule, /A group is up to 10 people/);
  await click(byText(".track button", "Friends"));
  await click($("[data-testid=gx-who-done]"));
  assert.equal(state().cont.disabled, true, "11 friends: over the cap");
  assert.match(state().rule, /Leave out 1 more to continue/);
});

test("S3: Schedule the Love for a group saves the occasion to each person's own scheduler; their saved gift is kept, others get the gift for everyone", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  assert.ok($("[data-testid=gx-dates-modal]"), "Done opens Dates & gifts");
  const rows = $$("[data-testid=gx-group-row]");
  assert.equal(rows.length, 3);
  assert.equal(datesSave().disabled, true, "dates and gifts are needed for everyone");
  await setValue($("[data-testid=gx-group-default-gift]"), "none");
  await setValue($$("[data-testid=gx-group-row]")[1].querySelector("input"), "1960-02-11");
  await setValue($$("[data-testid=gx-group-row]")[2].querySelector("input"), "1985-09-30");
  assert.equal(datesSave().disabled, false);
  assert.equal(datesSave().textContent.trim(), "Save 3 schedules");
  await click(datesSave());
  await settle();
  assert.equal($("[data-testid=gx-dates-modal]"), null, "closes after a save that needs nothing more");
  assert.equal(globalThis.__saves.length, 3, "one save per person, through the existing endpoint");
  const t = globalThis.__saves.find((x) => x.id === "c1").body;
  assert.deepEqual(t.occasionGiftSettings.birthday, { type: "qrcash", autoGift: true, amount: 50 }, "Theresa's own saved gift is kept");
  assert.deepEqual(globalThis.__saves.find((x) => x.id === "c2").body.occasionGiftSettings.birthday, { type: "none", autoGift: false });
  assert.match($("[data-testid=gx-fine]").textContent, /Saved 3 of 3 scheduled Greet-Mes for Birthday/);
  assert.equal(globalThis.__sends.length, 0, "scheduling sends nothing now");
});

test("S3: a person whose save needs the scheduler's card/consent step is listed, not saved silently; the others are saved", async () => {
  await mount({ card: null });
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await setValue($("[data-testid=gx-group-default-gift]"), "none");
  await setValue($$("[data-testid=gx-group-row]")[1].querySelector("input"), "1960-02-11");
  await setValue($$("[data-testid=gx-group-row]")[2].querySelector("input"), "1985-09-30");
  await click(datesSave());
  await settle();
  assert.ok($("[data-testid=gx-dates-modal]"), "stays open: one person still needs their scheduler");
  assert.equal(globalThis.__saves.length, 2, "Theresa (existing QR Cash Auto-Gift, no usable card) is not saved");
  assert.equal(globalThis.__saves.some((x) => x.id === "c1"), false);
  assert.match($("[data-testid=gx-fine]").textContent, /Saved 2 of 3.*1 still needs details: see the row/);
  assert.ok($$("[data-testid=gx-group-row-status]").some((e) => /Needs their scheduler/.test(e.textContent)));
});

test("Send Now: one person + one occasion hands off to the existing send flow, with words and photos carried once", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Just Because"));
  await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  await setValue($("[data-testid=gx-words]"), "Welcome, little one");
  assert.equal(state().cont.disabled, false);
  await click(state().cont);
  const nav = globalThis.__nav.at(-1).to;
  assert.equal(nav, "/dashboard/send?contactId=c2&occasion=Just+Because&from=dashboard", "Send carries no gift request: it never reopens gift shopping (Report 135)");
  const h = JSON.parse(window.sessionStorage.getItem("gm_dashboard_send_handoff_v1"));
  assert.equal(new URLSearchParams(nav.split("?")[1]).get("occasion"), "Just Because", "the send page reads the occasion back exactly");
  assert.equal(h.contactId, "c2"); assert.equal(h.occasion, "Just Because"); assert.equal(h.words, "Welcome, little one");
  assert.equal(globalThis.__saves.length, 0, "the dashboard itself saves nothing");
});

test("Report 135 layout: no separate Add QR Cash on any slide; on the QR Cash slide the one gold Add a gift opens the gift selection (Gift Place) with the greeting kept; How it works stays", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  await setValue($("[data-testid=gx-words]"), "Happy birthday");
  for (let k = 0; k < $$(".dot").length; k++) { await click($$(".dot")[k]); assert.equal($("[data-testid=gx-add-qr]"), null, `slide ${k}: no Add QR Cash`); assert.equal($$("[data-testid=gx-carousel] .btn").length, 1, `slide ${k}: one button`); }
  // the QR Cash slide is the last one
  assert.ok(byText("[data-testid=gx-carousel] .link", "How it works"));
  await click($("[data-testid=gx-add-gift]"));
  assert.match(globalThis.__nav.at(-1).to, /^\/dashboard\/send\?contactId=c1&occasion=Birthday&from=dashboard&gift=choose&entry=/);
  assert.equal(JSON.parse(window.sessionStorage.getItem("gm_dashboard_send_handoff_v1")).words, "Happy birthday");
});

test("resolver: one person + several occasions -> prefilled rows, blocked until every row has a date and a gift choice, Send Now explained", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday")); await click(occ("Anniversary"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  const rows = $$("[data-testid=gx-resolver-row]");
  assert.equal(rows.length, 2);
  assert.equal(rows[0].querySelector("input").value, "1990-05-03", "saved date prefilled");
  assert.equal(rows[0].querySelector("select").value, "qrcash", "saved gift prefilled");
  assert.equal(rows[1].querySelector("select").value, "", "no saved gift: explicit choice required");
  assert.ok($("[data-testid=gx-resolver-sendnow]"), "Send Now is explained");
  assert.equal($(".mode[aria-pressed=true]").textContent.includes("Send Now"), true, "mode is not changed");
  assert.equal(datesSave().disabled, true);
  await setValue(rows[1].querySelector("input"), "2026-06-20");
  assert.equal(datesSave().disabled, true, "a date alone does not complete a row");
  await setValue($$("[data-testid=gx-resolver-row]")[1].querySelector("select"), "none");
  assert.equal(datesSave().disabled, false);
  assert.equal(datesSave().textContent.trim(), "Save schedules");
  assert.equal(state().cont.textContent.trim(), "Save", "Report 135: the final action reads Save for schedules");
});

test("resolver save: PUT /api/contacts/:id with the FULL record; other data untouched; success reported only after acceptance", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday")); await click(occ("Anniversary"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  const r = $$("[data-testid=gx-resolver-row]")[1];
  await setValue(r.querySelector("input"), "2026-06-20");
  await setValue($$("[data-testid=gx-resolver-row]")[1].querySelector("select"), "merch");
  await click(state().cont);
  assert.equal(globalThis.__saves.length, 1);
  const { id, body } = globalThis.__saves[0];
  assert.equal(id, "c1");
  assert.equal(body.name, "Theresa Morgan"); assert.equal(body.email, "t@example.com");
  assert.deepEqual(body.shippingAddress, CONTACTS()[0].shippingAddress, "the stored address is preserved");
  assert.deepEqual(body.occasions, [{ id: "o1", type: "birthday", date: "1990-05-03", autoSend: true }, { type: "anniversary", date: "2026-06-20", autoSend: true }]);
  assert.deepEqual(body.occasionGiftSettings.birthday, { type: "qrcash", autoGift: true, amount: 50 }, "the saved QR Cash setting is unchanged");
  assert.deepEqual(body.occasionGiftSettings.anniversary, { type: "merch", autoGift: false });
  assert.match($("[data-testid=gx-fine]").textContent, /Saved: 2 scheduled Greet-Mes for Theresa/);
  assert.equal($("[data-testid=gx-dates-modal]"), null, "Dates & gifts closes after the save");
  await click($("[data-testid=gx-who-done]"));
  assert.match($$("[data-testid=gx-resolver-row]")[0].textContent, /QR Cash \$50/, "the saved QR Cash amount is shown");
  assert.deepEqual(globalThis.__toasts, ["Saved ✓"]);
  assert.equal(globalThis.__nav.length, 0, "the screen stays put");
});

test("in scheduled mode the carousel gift does not pretend: each occasion's gift is set under Dates & gifts", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  await click($("[data-testid=gx-add-gift]"));
  assert.equal($("[data-testid=gx-add-gift]").getAttribute("aria-pressed"), "false", "not marked chosen");
  assert.doesNotMatch($("[data-testid=gx-summary]").textContent, /gift/);
  assert.ok($("[data-testid=sg-picker]"), "founder 2026-10-22: it opens the existing scheduled-gift picker directly, not an explanation");
  assert.doesNotMatch($("[data-testid=gx-fine]").textContent, /each gift is chosen in Dates & gifts/);
});

test("resolver save refused by the server: the error is shown and nothing claims success", async () => {
  await mount({ saveResult: { ok: false, error: "Occasion type 'getwell' is missing a required date" } });
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  assert.match($("[data-testid=gx-fine]").textContent, /missing a required date/);
  assert.equal(globalThis.__toasts.length, 0);
});

test("resolver: a shipped gift with no address uses the scheduler's own authorisation step before anything is saved", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  // Margaret has no saved occasions; Birthday needs a date
  const row = $$("[data-testid=gx-resolver-row]")[0];
  await setValue(row.querySelector("input"), "1960-02-11");
  await setValue($$("[data-testid=gx-resolver-row]")[0].querySelector("select"), "curated");
  await click(state().cont);
  assert.ok($("[data-testid=auth-modal]"), "authorisation modal shown");
  assert.equal(JSON.parse($("[data-testid=auth-modal]").dataset.need).address, true);
  assert.equal(globalThis.__saves.length, 0, "nothing saved yet");
  await click($("[data-testid=auth-save]"));
  assert.equal(globalThis.__saves.length, 1, "saved once the step completes");
});

test("resolver: an existing QR Cash Auto-Gift with no usable card on file asks for the scheduler's card/consent step first", async () => {
  await mount({ card: null });
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  const need = JSON.parse($("[data-testid=auth-modal]").dataset.need);
  assert.equal(need.card, true); assert.equal(need.consent, true);
  assert.equal(globalThis.__saves.length, 0, "nothing saved while the step is open");
  await click($("[data-testid=auth-cancel]"));
  assert.equal($("[data-testid=auth-modal]"), null);
  assert.equal(globalThis.__saves.length, 0, "cancelling saves nothing");
});

test("Schedule the Love with an occasion the scheduler does not hold explains it and does not continue", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Thank You"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  assert.equal(state().cont.disabled, true);
  assert.match(state().rule, /Thank You isn.t an Occasion Scheduler occasion, so it can.t be scheduled/);
});

test("Upcoming: real statuses; no schedule -> 'Auto-send on' or 'Schedule the Love' (opens that person's scheduler)", async () => {
  await mount();
  await click($("[data-testid=gx-lower-occasions]"));
  await click(byText("[role=tab]", "Upcoming Occasions"));
  assert.ok($("[data-testid=gx-nudge]"));
  const rows = $$("[data-testid=gx-up-row]");
  assert.equal(rows[0].textContent.includes("Creating"), true);
  assert.ok(rows[1].querySelector("[data-testid=gx-up-schedule]"), "no schedule and auto-send off: the action");
  assert.ok(rows[2].querySelector("[data-testid=gx-up-auto]"), "no schedule yet, auto-send on");
  assert.equal(rows[3].textContent.includes("Cancelled"), true);
  const rowFor = (name, occ) => rows.find((r) => r.textContent.includes(name) && r.textContent.includes(occ));
  assert.equal(rowFor("Daniel", "Christmas").textContent.includes("Not sent"), true, "a permanent skip reads Not sent");
  assert.equal(rowFor("Theresa", "Anniversary").textContent.includes("Paused"), true);
  assert.equal(rowFor("Daniel", "Birthday").textContent.includes("Preparing"), true, "a transient skip is retried by the scheduler, so it is not 'Not sent'");
  await click(rows[1].querySelector("[data-testid=gx-up-schedule]"));
  assert.equal(globalThis.__nav.at(-1).to, "/dashboard/contacts?contactId=c2&occasion=mothers_day");
});

test("Past Occasions: dates from completedAt/createdAt; statuses Sent / Not sent", async () => {
  await mount();
  await click($("[data-testid=gx-lower-occasions]"));
  await click(byText("[role=tab]", "Past Occasions"));
  const rows = $$("[data-testid=gx-past-row]");
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /Oct 2/); assert.match(rows[0].textContent, /Sent/);
  assert.match(rows[1].textContent, /Oct 5/); assert.match(rows[1].textContent, /Not sent/);
  assert.match(rows[1].textContent, /Thank You/, "a stored key reads with the send flow's label");
});

test("Recipients: edit pencil opens that recipient's existing edit form and asks to come back here", async () => {
  await mount();
  await click($$("[data-testid=gx-edit-recipient]")[1]);
  assert.deepEqual(globalThis.__nav.at(-1), { to: "/dashboard/contacts", opts: { state: { openEditRecipientId: "c2", returnTo: "dashboard" } } });
  assert.ok(window.sessionStorage.getItem("gm_dashboard_launcher_v1"), "the in-progress choices are kept for the return");
});

test("Re-record / Revisit open setup re-entry", async () => {
  await mount();
  let opened = 0;
  window.addEventListener("gm:open-setup-revisit", () => { opened++; });
  await click($("[data-testid=gx-rerecord]"));
  await click($("[data-testid=gx-revisit]"));
  assert.equal(opened, 2);
});

test("Smart Card slide: 'Coming later' unless the server reports published cards; the gold Add a gift stays in place on every slide", async () => {
  await mount({ tiles: { ok: true, tiles: [] } });
  await click($$(".dot")[4]);
  assert.match($(".slide-l").textContent, /Coming later — not yet available/);
  assert.equal($("[data-testid=gx-add-gift]").style.visibility, "", "Report 135: Add a gift is never hidden");
  await mount({ tiles: { ok: true, tiles: [{ id: "t1" }] } });
  await click($$(".dot")[4]);
  assert.match($(".slide-l").textContent, /One card, spent at the brands they love/);
  assert.equal($("[data-testid=gx-add-gift]").style.visibility, "");
});

test("G7: a gift box for everyone — address per person (prefilled only from saved data), quotes for all before the one confirmation, then confirmed orders attached", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  await settle();
  await setValue($("[data-testid=grv-default-gift]"), "box:goody-1");
  assert.equal($$("[data-testid=grv-address]").length, 3, "an address for each gift-box recipient");
  assert.equal(document.querySelector('[aria-label="Theresa Morgan street address"]').value, "1 Main", "prefilled from the saved address");
  assert.equal(document.querySelector('[aria-label="Theresa Morgan first name"]').value, "", "a first name is never split from the full name");
  assert.equal($("[data-testid=grv-send]").disabled, true, "no price yet");
  // fill the names and the two missing addresses
  for (const [n, addr] of [["Theresa Morgan", null], ["Margaret Rivera", "2 Elm"], ["Daniel Okafor", "3 Oak"]]) {
    await setValue(document.querySelector(`[aria-label="${n} first name"]`), n.split(" ")[0]);
    if (addr) {
      await setValue(document.querySelector(`[aria-label="${n} street address"]`), addr);
      await setValue(document.querySelector(`[aria-label="${n} city"]`), "Town");
      await setValue(document.querySelector(`[aria-label="${n} state"]`), "NJ");
      await setValue(document.querySelector(`[aria-label="${n} ZIP"]`), "07000");
    }
  }
  await click($("[data-testid=grv-get-prices]"));
  await settle();
  assert.equal(globalThis.__quotes.length, 3, "every gift box quoted, together");
  assert.equal($$("[data-testid=grv-quote-lines]").length, 3);
  assert.match($$("[data-testid=grv-quote-lines]")[0].textContent, /Item \$36\.99 · S&H \$6\.00 · Tax \$3\.00 · Total \$45\.99/, "the four lines, expandable");
  assert.equal($$("[data-testid=grv-quote-lines]")[0].tagName, "DETAILS");
  assert.match($("[data-testid=grv-total]").textContent, /Total \$137\.97/);
  assert.equal(globalThis.__boxCharges.length, 0, "nothing charged at review");
  assert.equal($("[data-testid=grv-send]").disabled, false);
  await click($("[data-testid=grv-send]"));
  await settle();
  assert.equal(globalThis.__boxCharges.length, 3);
  assert.ok(globalThis.__boxCharges.every((b) => b.useSavedPaymentMethod === true && !("paymentMethodId" in b) && b.quotedTotalCents === 4599));
  assert.deepEqual(globalThis.__boxCharges.map((b) => b.contactId), ["c1", "c2", "c3"], "bound per recipient");
  assert.equal(new Set(globalThis.__boxCharges.map((b) => b.giftRequestId)).size, 3);
  assert.deepEqual(globalThis.__sends.find((p) => p.contactId === "c2").gift, { type: "gift_boxes", claimToken: "box-c2" });
  assert.equal($$("[data-testid=grv-status]").filter((e) => e.textContent === "Accepted for sending").length, 3);
});

test("G7: gift box for one person as an override, QR Cash for everyone else; an address that is incomplete is reported for that person", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  await settle();
  await setValue($("[data-testid=grv-default-gift]"), "qrcash:25");
  await setValue(document.querySelector('[aria-label="Gift for Margaret Rivera"]'), "box:goody-1");
  assert.equal($$("[data-testid=grv-address]").length, 1);
  await click($("[data-testid=grv-get-prices]"));
  await settle();
  assert.match($("[data-testid=grv-quote-error]").textContent, /first name/);
  assert.equal(globalThis.__quotes.length, 0, "nothing quoted for an incomplete address");
  assert.equal($("[data-testid=grv-send]").disabled, true);
});

test("group: an expired saved card is named as expired (charge-now would decline it) and paid gifts are blocked", async () => {
  await mount({ card: { present: true, expired: true, brand: "visa", last4: "4242" } });
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  await settle();
  await setValue($("[data-testid=grv-default-gift]"), "qrcash:25");
  assert.equal($("[data-testid=grv-send]").disabled, true);
  assert.match($("[data-testid=grv-blockers]").textContent, /saved card has expired/);
  await setValue($("[data-testid=grv-default-gift]"), "none");
  assert.equal($("[data-testid=grv-send]").disabled, false, "a group with no paid gift can still go");
});

test("H-1 (rendered): an unfinished group run from another account is never offered or resumed, and is discarded", async () => {
  window.localStorage.clear();
  const foreign = { runId: "r-a", userId: "userA", occasion: "Birthday", words: "", items: [
    { contactId: "c1", name: "Theresa Morgan", email: "t@example.com", gift: { type: "qrcash", amount: 25 }, sendRequestId: "s1", giftRequestId: "g1", status: "pending" },
    { contactId: "c2", name: "Margaret Rivera", email: "m@example.com", gift: { type: "qrcash", amount: 25 }, sendRequestId: "s2", giftRequestId: "g2", status: "pending" } ] };
  globalThis.__data = { contacts: CONTACTS(), upcoming: [], sent: [], tiles: { ok: true, tiles: [] }, card: VALID_CARD, preflight: PREFLIGHT, boxes: BOXES };
  // mount() clears storage, so plant the foreign run between the clear and the render
  if (currentRoot) { const r = currentRoot; currentRoot = null; await act(async () => { r.unmount(); }); }
  globalThis.__user = { id: "userB", name: "Bea", voiceId: "v", photoUrl: "p.jpg" };
  globalThis.__nav = []; globalThis.__saves = []; globalThis.__toasts = []; globalThis.__calls = []; globalThis.__sends = []; globalThis.__charges = [];
  window.localStorage.setItem("gm_group_run_v1", JSON.stringify(foreign));
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); currentRoot = root;
  await act(async () => { root.render(React.createElement(DashboardHome)); });
  await settle();
  assert.equal($("[data-testid=gx-group-resume]"), null, "no resume offer for another account's run");
  assert.equal(window.localStorage.getItem("gm_group_run_v1"), null, "the foreign run is discarded");
  assert.equal(document.body.textContent.includes("t@example.com"), false, "nothing of it is shown");
  assert.equal(globalThis.__charges.length, 0);
});

test("group: a sender without a recorded voice is stopped at review, before any charge", async () => {
  await mount({ user: { id: "u1", name: "Alex Rivera", photoUrl: "p.jpg" } });
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  await settle();
  assert.equal($("[data-testid=grv-send]").disabled, true);
  assert.match($("[data-testid=grv-blockers]").textContent, /recorded voice/);
});

test("pricing wording: 'From $X + S&H' with the actual starting price; 'Total pending' and 'Get total' before quoting", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  await settle();
  const opt = [...$("[data-testid=grv-default-gift]").options].find((o) => o.value === "box:goody-1");
  assert.equal(opt.textContent, "Gift box: Cookie Box \u00b7 From $36.99 + S&H");
  await setValue($("[data-testid=grv-default-gift]"), "box:goody-1");
  assert.match($("[data-testid=grv-default-gift]").parentElement.querySelector(".sub").textContent, /^From \$36\.99 \+ S&H\./, "the starting price stays readable where a phone clips the selector");
  assert.equal($("[data-testid=grv-total]").textContent.startsWith("Total pending"), true);
  assert.equal(document.body.textContent.includes("$0.00"), false, "never 'Total $0.00'");
  assert.equal($("[data-testid=grv-get-prices]").textContent, "Get total");
  assert.match($$("[data-testid=grv-cost]")[0].textContent, /Total pending/);
});

test("info icon: opens on hover, keyboard focus and tap; closes on Escape and leaving; text is the shipping-and-tax note", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  await settle();
  const btn = $("[data-testid=grv-box-info]");
  const text = () => $("[data-testid=grv-box-info-text]");
  assert.equal(text(), null);
  // Team 5 P-1: the dropdown keeps its accessible name; the info button is not the label's control
  const sel = $("[data-testid=grv-default-gift]");
  assert.equal([...sel.labels].map((l) => l.textContent).join("|"), "Gift for everyone", "the select is named by its label");
  assert.equal(btn.closest("label"), null, "the info button sits outside any <label>");
  assert.equal(btn.getAttribute("aria-label"), "About gift box prices");
  await click(sel.labels[0]);
  assert.equal(text(), null, "clicking the label text does not open the tip");
  await act(async () => { btn.parentElement.dispatchEvent(new window.MouseEvent("mouseover", { bubbles: true })); }); await settle();
  assert.equal(text().textContent, "Shipping and tax depend on the delivery address. Your total is shown before you pay.", "hover");
  await act(async () => { btn.parentElement.dispatchEvent(new window.MouseEvent("mouseout", { bubbles: true })); }); await settle();
  assert.equal(text(), null, "leaving closes it");
  await act(async () => { btn.focus(); }); await settle();
  assert.ok(text(), "keyboard focus");
  assert.equal(btn.getAttribute("aria-describedby"), text().id);
  await act(async () => { btn.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); }); await settle();
  assert.equal(text(), null, "Escape closes it");
  await act(async () => { btn.focus(); btn.click(); }); await settle();
  assert.ok(text(), "a real tap (focus, then click) leaves it open");
  // QR Cash: the fee formula sits behind the icon
  await setValue($("[data-testid=grv-default-gift]"), "qrcash:25");
  await click($("[data-testid=grv-fee-info]"));
  assert.match($("[data-testid=grv-fee-info-text]").textContent, /\$1\.99 \+ 3% of the gift amount/);
});

test("scheduled gifts: one short status — 'Auto-Gift on' or 'Reminder only — confirmation required' — with the detail behind the icon", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday")); await click(occ("Anniversary"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  await setValue($$("[data-testid=gx-resolver-row]")[1].querySelector("select"), "qrcash");
  const st = $$("[data-testid=gx-sched-status]").map((e) => e.textContent);
  assert.deepEqual(st, ["Auto-Gift on", "Reminder only \u2014 confirmation required"], "saved QR Cash Auto-Gift vs a gift chosen here");
  assert.match($$("[data-testid=gx-resolver-row]")[0].textContent, /QR Cash \$50\.00 \+ \$3\.49 fee = \$53\.49/);
  await click($$("[data-testid=gx-sched-info]")[1]);
  assert.match($("[data-testid=gx-sched-info-text]").textContent, /remind you 10 days before.*nothing is charged automatically.*\$1\.99 \+ 3%/);
});

test("N-6: with no recorded voice, Personalize says the voice is required for group sending; words and memory photos stay optional", async () => {
  await mount({ user: { id: "u1", name: "Alex Rivera", photoUrl: "p.jpg" } });
  const step3 = $("[data-testid=gx-step-3]").textContent;
  assert.match($("[data-testid=gx-voice-tile]").textContent, /Record your voice.*Required for group sending — about 15 seconds is plenty\./);
  assert.equal(/Personalize — optional|Optional — about 15|Nothing here is required/.test(step3), false);
  assert.match(step3, /Words and memory photos are optional\./);
  assert.match(step3, /A few words from the heart/); assert.match(step3, /Make it extra special/); // walkthrough 2026-10-24 wording
});

test("Step 2 Save: one clear action — inside the people box, the picker's Done completes the step too; for a send it opens nothing", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  assert.equal($("[data-testid=gx-who-done]").disabled, true, "nobody chosen yet");
  await pickPerson("Theresa");
  const step2 = $("[data-testid=gx-step-2]");
  assert.ok($("[data-testid=gx-whobox]").contains($("[data-testid=gx-who-donerow]")), "Save sits inside 'Who is it for?', beneath the people");
  assert.equal($("[data-testid=gx-who-done]").textContent.trim(), "Save");
  assert.match($("[data-testid=gx-who-donerow] .hint").textContent, /^1 selected · nothing is sent yet$/, "it never says anything was sent or scheduled");
  await click($("[data-testid=gx-picker-done]"));
  assert.equal($("[data-testid=gx-picker]"), null, "the picker closes");
  assert.ok(step2.querySelector(".step-label .num.done"), "Step 2 is complete");
  assert.equal($("[data-testid=gx-dates-modal]"), null, "a send has no dates to set");
  assert.equal($("[data-testid=gx-dates-open]"), null);
});

test("Dates & gifts modal: Close keeps every choice; Escape closes; Save schedules saves; it steps aside for the scheduler's authorisation step", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday")); await click(occ("Anniversary"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  assert.ok($("[data-testid=gx-dates-modal]"));
  assert.equal($("[data-testid=gx-dates-modal]").getAttribute("role"), "dialog");
  await setValue($$("[data-testid=gx-resolver-row]")[1].querySelector("input"), "2026-06-20");
  await setValue($$("[data-testid=gx-resolver-row]")[1].querySelector("select"), "none");
  await click($("[data-testid=gx-dates-close]"));
  assert.equal($("[data-testid=gx-dates-modal]"), null, "Close closes");
  assert.equal(globalThis.__saves.length, 0, "Close saves nothing");
  await click($("[data-testid=gx-who-done]"));
  const r = $$("[data-testid=gx-resolver-row]")[1];
  assert.equal(r.querySelector("input").value, "2026-06-20", "the date is kept");
  assert.equal(r.querySelector("select").value, "none", "the gift choice is kept");
  await act(async () => { $("[data-testid=gx-dates-modal]").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); }); await settle();
  assert.equal($("[data-testid=gx-dates-modal]"), null, "Escape closes");
  await click(state().cont);
  assert.equal(globalThis.__saves.length, 1, "with every row set, Save schedules saves");
});

test("Faith and secular holidays schedule with the scheduler's own identifiers and dates; Season's Greetings is Send Now only", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await menuOcc("faith", "Christmas");
  assert.equal($("[data-testid=gx-menu-faith]").textContent.trim(), "Christmas", "the chosen holiday is named on its menu");
  await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  const row = $$("[data-testid=gx-resolver-row]")[0];
  assert.match(row.textContent, /Christmas/);
  assert.match(row.querySelector("input").value, /^\d{4}-12-25$/, "the scheduler's fixed date");
  await setValue(row.querySelector("select"), "none");
  await click(datesSave());
  assert.deepEqual(globalThis.__saves[0].body.occasions.map((o) => o.type), ["christmas"], "saved under the scheduler's own identifier");
  // Season's Greetings is not an Occasion Scheduler occasion
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await menuOcc("holidays", "Season's Greetings");
  assert.match(state().rule, /Season.s Greetings isn.t an Occasion Scheduler occasion/);
  await mount();
  await click(byText(".mode", "Send Now"));
  await menuOcc("holidays", "Season's Greetings");
  await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  assert.equal(new URLSearchParams(globalThis.__nav.at(-1).to.split("?")[1]).get("occasion"), "Season's Greetings", "handed to the send flow as Season's Greetings, never Christmas");
});

test("Add a gift (Report 135): one person + one occasion opens the Gift Place at once with recipient, occasion, timing and words kept; Send never asks for a gift again; incomplete choices are named, nothing is marked", async () => {
  await mount();
  await click($("[data-testid=gx-add-gift]"));
  assert.equal(globalThis.__nav.length, 0, "nothing chosen yet: it stays");
  assert.match($("[data-testid=gx-fine]").textContent, /Choose Send Now or Schedule the Love first/);
  assert.equal($("[data-testid=gx-add-gift]").getAttribute("aria-pressed"), "false", "nothing is marked");
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click($("[data-testid=gx-add-gift]"));
  assert.match($("[data-testid=gx-fine]").textContent, /Choose who it’s for first/);
  assert.equal(globalThis.__nav.length, 0);
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  await setValue($("[data-testid=gx-words]"), "Thinking of you");
  await click($("[data-testid=gx-add-gift]"));
  assert.match(globalThis.__nav.at(-1).to, /^\/dashboard\/send\?contactId=c1&occasion=Birthday&from=dashboard&gift=choose&entry=[0-9a-z]+$/, "the send flow keeps the greeting and opens the Gift Place, marked for this one press");
  assert.equal(JSON.parse(window.sessionStorage.getItem("gm_dashboard_send_handoff_v1")).words, "Thinking of you");
  await click(state().cont);
  assert.equal(globalThis.__nav.at(-1).to, "/dashboard/send?contactId=c1&occasion=Birthday&from=dashboard", "Send carries no gift request");
});

// Founder 2026-10-23 ("please unify"): the QR Cash slide's How it works button runs the slide's own Add a gift step.
const openQrHowItWorks = async () => {
  await click($$(".dot").at(-1)); // the QR Cash slide is the last one
  await click(byText("[data-testid=gx-carousel] .link", "How it works"));
  const cta = $("[data-testid=qr-howitworks-cta]");
  assert.ok(cta, "the How it works button");
  assert.equal(cta.textContent.trim(), "Add QR Cash", "the founder's label (2026-10-23)");
  return cta;
};

test("QR Cash How it works, nothing chosen: no page opens; the slide's own note says what is missing; the modal closes", async () => {
  await mount();
  await click(await openQrHowItWorks());
  assert.equal(globalThis.__nav.length, 0, "never the send page");
  assert.match($("[data-testid=gx-fine]").textContent, /Choose Send Now or Schedule the Love first/);
  assert.equal($("[data-testid=qr-howitworks-cta]"), null, "modal closed");
});

test("QR Cash How it works, Send Now for one person: the Gift Place's QR Cash tab with the greeting kept (as the slide's Add a gift)", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  await setValue($("[data-testid=gx-words]"), "Happy birthday");
  await click(await openQrHowItWorks());
  const to = globalThis.__nav.at(-1).to;
  assert.match(to, /^\/dashboard\/send\?contactId=c1&occasion=Birthday&from=dashboard&gift=choose&entry=[0-9a-z]+$/, "the greeting is kept and the Gift Place opens");
  assert.doesNotMatch(to, /giftType=qrcash/, "not the send page's old QR Cash chooser");
  const marker = JSON.parse(window.sessionStorage.getItem("gm_giftplace_tab_v1"));
  assert.equal(marker.tab, "qrcash", "the Gift Place opens on its QR Cash tab");
  assert.equal(marker.entry, new URLSearchParams(to.split("?")[1]).get("entry"), "only for this press");
  assert.equal(JSON.parse(window.sessionStorage.getItem("gm_dashboard_send_handoff_v1")).words, "Happy birthday");
});

// Report 137 (founder 2026-10-23): under Schedule the Love both QR Cash buttons open Dates & gifts with QR Cash selected.
const rowGiftSelect = (i = 0) => $$("[data-testid=gx-resolver-row]")[i].querySelector("select");
const qrSlideAddGift = async () => { await click($$(".dot").at(-1)); await click($("[data-testid=gx-add-gift]")); };

test("QR Cash How it works, Schedule the Love: stays scheduled — Dates & gifts with QR Cash selected and the saved amount kept; no Send Now; the card/consent step still applies at Save", async () => {
  await mount({ card: null });
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  await click(await openQrHowItWorks());
  assert.equal(globalThis.__nav.length, 0, "never the send page (Send Now)");
  assert.equal(window.sessionStorage.getItem("gm_giftplace_tab_v1"), null, "no Send Now Gift Place entry");
  assert.ok($("[data-testid=gx-dates-modal]"), "Dates & gifts is open");
  assert.equal($("[data-testid=sg-picker]"), null, "not the gift-box picker");
  assert.equal(rowGiftSelect().value, "qrcash", "QR Cash selected for Birthday");
  assert.match($$("[data-testid=gx-resolver-row]")[0].textContent, /QR Cash \$50\.00/, "her saved $50 is kept");
  assert.equal($("[data-testid=gx-qr-amount]"), null, "no amount to choose: one is already set");
  assert.equal($(".mode[aria-pressed=true]").textContent.includes("Schedule the Love"), true, "mode unchanged");
  await click(datesSave());
  const need = JSON.parse($("[data-testid=auth-modal]").dataset.need);
  assert.equal(need.card, true); assert.equal(need.consent, true);
  assert.equal(globalThis.__saves.length, 0, "nothing saved before the scheduler's own card/consent step");
});

test("QR Cash slide Add a gift, Schedule the Love, nothing saved yet: QR Cash selected with NO amount; Save waits for an explicit amount; the chosen amount is what is saved", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  await setValue($$("[data-testid=gx-resolver-row]")[0].querySelector("input"), "1960-02-11");
  await qrSlideAddGift();
  assert.equal(globalThis.__nav.length, 0, "never Send Now");
  assert.equal($("[data-testid=sg-picker]"), null, "not the gift-box picker");
  assert.equal(rowGiftSelect().value, "qrcash", "QR Cash selected");
  assert.match($$("[data-testid=gx-resolver-row]")[0].querySelector(".rline").textContent, /^QR Cash · /, "no amount shown");
  assert.doesNotMatch($$("[data-testid=gx-resolver-row]")[0].querySelector(".rline").textContent, /\$/, "no automatic $25 (no figure at all)");
  assert.ok($("[data-testid=gx-qr-amount]"), "an amount is asked for");
  assert.equal(datesSave().disabled, true, "Save waits for the amount");
  await setValue($("[data-testid=gx-qr-amount-select]"), "custom");
  await setValue($("[data-testid=gx-qr-amount-custom]"), "3");
  assert.equal($("[data-testid=gx-qr-amount-use]").disabled, true, "$3 is refused");
  await setValue($("[data-testid=gx-qr-amount-select]"), "50");
  assert.equal($("[data-testid=gx-qr-amount]"), null, "amount chosen");
  assert.match($$("[data-testid=gx-resolver-row]")[0].textContent, /QR Cash \$50\.00/);
  assert.equal(datesSave().disabled, false);
  await click(datesSave());
  assert.equal(globalThis.__saves.length, 1);
  assert.deepEqual(globalThis.__saves[0].body.occasionGiftSettings.birthday, { type: "qrcash", autoGift: false, amount: 50 }, "exactly the chosen amount, no leftover marker");
});

test("QR Cash in Dates & gifts: a custom amount is saved as the scheduler's Custom (amount 0 + customAmount)", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  await setValue($$("[data-testid=gx-resolver-row]")[0].querySelector("input"), "1960-02-11");
  await setValue(rowGiftSelect(), "qrcash"); // the row's own dropdown follows the same rule
  assert.ok($("[data-testid=gx-qr-amount]"), "a new QR Cash choice from the dropdown asks for an amount too");
  assert.equal(datesSave().disabled, true);
  await setValue($("[data-testid=gx-qr-amount-select]"), "custom");
  await setValue($("[data-testid=gx-qr-amount-custom]"), "40");
  await click($("[data-testid=gx-qr-amount-use]"));
  await click(datesSave());
  assert.deepEqual(globalThis.__saves[0].body.occasionGiftSettings.birthday, { type: "qrcash", autoGift: false, amount: 0, customAmount: 40 });
});

test("QR Cash slide Add a gift, scheduled group: Dates & gifts with QR Cash for everyone and no amount until chosen; a person's saved gift is kept", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Theresa"); await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  await qrSlideAddGift();
  assert.equal(globalThis.__nav.length, 0, "never Send Now");
  assert.equal($("[data-testid=gx-group-default-gift]").value, "qrcash", "QR Cash for everyone");
  assert.ok($("[data-testid=gx-qr-amount]"), "the amount is asked for");
  assert.equal(datesSave().disabled, true);
  assert.match($$("[data-testid=gx-group-row]")[0].textContent, /Keep their saved gift \(QR Cash™\)/, "Theresa's saved gift stays");
  await setValue($("[data-testid=gx-qr-amount-select]"), "25");
  assert.equal($("[data-testid=gx-qr-amount]"), null);
});

test("QR Cash How it works, Send Now for a group: marked for everyone with the group note; nothing opens", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await pickPerson("Theresa"); await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  await click(await openQrHowItWorks());
  assert.equal(globalThis.__nav.length, 0);
  assert.match($("[data-testid=gx-fine]").textContent, /For a group, choose a gift box \(or QR Cash\) for each person at review/);
});

test("Add a gift for a group (Send Now): marked for everyone, a second tap never removes it, Remove does; each person's gift is set at the group review", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await pickPerson("Theresa"); await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  await click($("[data-testid=gx-add-gift]"));
  await click($("[data-testid=gx-add-gift]"));
  assert.equal($("[data-testid=gx-add-gift]").getAttribute("aria-pressed"), "true", "still added after a second tap");
  assert.equal(globalThis.__nav.length, 0, "a group never leaves for the Gift Place");
  assert.match($("[data-testid=gx-summary]").textContent, /gift for everyone/);
  assert.match($("[data-testid=gx-fine]").textContent, /for each person at review/);
  await click($("[data-testid=gx-gift-remove]"));
  assert.equal($("[data-testid=gx-add-gift]").getAttribute("aria-pressed"), "false");
  assert.doesNotMatch($("[data-testid=gx-summary]").textContent, /gift/);
});

test("After editing a recipient, the dashboard comes back with the in-progress choices; another account's are never restored", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday")); await click(occ("Anniversary"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  await setValue($$("[data-testid=gx-resolver-row]")[1].querySelector("input"), "2026-06-20");
  await setValue($("[data-testid=gx-words]"), "Thinking of you");
  // "Gift details in their Occasion Scheduler" opens the recipient's scheduler and asks to come back
  await click(byText("[data-testid=gx-resolver-row] .link", "Gift details"));
  const nav = globalThis.__nav.at(-1);
  assert.equal(nav.to, "/dashboard/contacts?contactId=c1&occasion=birthday");
  assert.deepEqual(nav.opts, { state: { returnTo: "dashboard" } });
  const kept = window.sessionStorage.getItem("gm_dashboard_launcher_v1");
  // ...the Recipients page returns here: the dashboard mounts again with the same tab's storage
  await mountKeeping(kept);
  assert.equal($(".mode[aria-pressed=true]").textContent.includes("Schedule the Love"), true, "mode kept");
  assert.deepEqual(state().occ, ["Birthday", "Anniversary"], "occasions kept");
  assert.deepEqual(state().picks, ["TMTheresa Morgan"], "people kept (avatar initials + name)");
  assert.equal($("[data-testid=gx-words]").value, "Thinking of you", "words kept");
  assert.ok($("[data-testid=gx-dates-modal]"), "Dates & gifts reopens where it was");
  assert.equal($$("[data-testid=gx-resolver-row]")[1].querySelector("input").value, "2026-06-20", "the date set before leaving is kept");
  assert.equal(window.sessionStorage.getItem("gm_dashboard_launcher_v1"), null, "used once, then cleared");
  // another account never receives it
  await mountKeeping(kept, { id: "someone-else", name: "Bea", voiceId: "v", photoUrl: "p.jpg" });
  assert.equal($(".mode[aria-pressed=true]"), null, "nothing restored for another account");
});

test("relationship started but incomplete: the dashboard refuses the save (as the scheduler does) instead of clearing stored closeness", async () => {
  const contacts = CONTACTS();
  contacts[1] = { ...contacts[1], relationshipCategory: "family", relationship: "", relationshipCloseness: "very_close", relationshipProfile: { a: 1 } };
  await mount({ contacts });
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  await setValue($$("[data-testid=gx-resolver-row]")[0].querySelector("input"), "1960-02-11");
  await setValue($$("[data-testid=gx-resolver-row]")[0].querySelector("select"), "none");
  await click(datesSave());
  assert.equal(globalThis.__saves.length, 0, "nothing saved: the stored closeness and profile are not cleared");
  assert.match($("[data-testid=gx-dates-fine]").textContent, /relationship details are incomplete/);
});

test("scheduled group, physical gift with a missing address: the others save; 'Add missing details' opens the scheduler's own step for that person, asks only for the address (no payment consent), then saves them", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday"));
  await pickPerson("Theresa"); await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  const rowOf = (n) => $$("[data-testid=gx-group-row]").find((r) => r.textContent.includes(n));
  await setValue(rowOf("Margaret").querySelector("input"), "1960-02-11");
  await setValue(rowOf("Margaret").querySelector("select"), "curated");
  await click(datesSave());
  assert.deepEqual(globalThis.__saves.map((x) => x.id), ["c1"], "Theresa (nothing missing) is saved; Margaret is not saved without an address");
  assert.match(rowOf("Margaret").textContent, /Their delivery address is needed/);
  assert.match(rowOf("Margaret").textContent, /Reminder only/, "a physical gift is reminder-only, never ordered automatically");
  await click(rowOf("Margaret").querySelector("[data-testid=gx-group-finish]"));
  const need = JSON.parse($("[data-testid=auth-modal]").dataset.need);
  assert.equal(need.address, true, "the missing address is requested");
  assert.equal(need.consent, false, "no payment consent: nothing is charged automatically");
  assert.equal(need.card, false);
  assert.equal($("[data-testid=gx-dates-modal]"), null, "Dates & gifts steps aside while the step is open");
  await click($("[data-testid=auth-save]"));
  assert.deepEqual(globalThis.__saves.map((x) => x.id), ["c1", "c2"], "Margaret is saved once the step completes");
  const m = globalThis.__saves[1].body;
  assert.deepEqual(m.occasions.map((o) => [o.type, o.date]), [["birthday", "1960-02-11"]]);
  assert.deepEqual(m.occasionGiftSettings.birthday, { type: "curated", autoGift: false });
  assert.match($("[data-testid=gx-fine]").textContent, /Saved 2 of 2 scheduled Greet-Mes for Birthday/);
  assert.equal($("[data-testid=gx-dates-modal]"), null, "everyone saved: Dates & gifts closes, as after any complete save");
  await click($("[data-testid=gx-who-done]"));
  assert.match(rowOf("Margaret").querySelector("[data-testid=gx-group-row-status]").textContent, /Saved/);
});

test("F-C2: restored choices are kept only when this page offers them (a hand-edited tab can't inject an occasion, mode, audience or gift)", async () => {
  const snap = JSON.stringify({ v: 1, userId: "u1", savedAt: Date.now(), mode: "bogus", occasions: ["Wedding", "Birthday", "Baby"], audience: "strangers", picks: [], gift: "evil", whoDone: false });
  await mountKeeping(snap);
  assert.equal($(".mode[aria-pressed=true]"), null, "an unknown mode is dropped");
  assert.deepEqual(state().occ, ["Birthday"], "only offered occasions are restored");
  assert.equal($(".track button[aria-pressed=true]").textContent.trim(), "Individuals", "an unknown audience falls back");
  assert.doesNotMatch($("[data-testid=gx-summary]").textContent, /gift/, "an unknown gift is dropped");
});

// ---- Revision 2026-10-20 (founder) ----

test("Save in 'Who is it for?': for schedules it opens Dates & gifts with every choice kept; no other Dates & gifts control in the composer", async () => {
  await mount();
  await click(byText(".mode", "Schedule the Love"));
  await click(occ("Birthday")); await click(occ("Anniversary"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-picker-done]"));
  await click($("[data-testid=gx-dates-close]"));
  assert.equal($("[data-testid=gx-dates-modal]"), null);
  assert.match($("[data-testid=gx-who-donerow] .hint").textContent, /^1 selected · next, dates & gifts$/);
  assert.equal($$("[data-testid=gx-flow] button").filter((b) => /Dates/.test(b.textContent)).length, 0, "no inline Dates & gifts control");
  assert.equal($("[data-testid=gx-resolver]"), null, "no inline Dates & gifts section");
  await click($("[data-testid=gx-who-done]"));
  assert.ok($("[data-testid=gx-dates-modal]"), "Save opens the pop-up");
  assert.equal($$("[data-testid=gx-resolver-row]").length, 2, "both occasions are still there");
  assert.deepEqual(state().picks, ["TMTheresa Morgan"], "the selection is kept");
  assert.equal(globalThis.__saves.length, 0, "Save in Step 2 saves no schedule");
});

test("Lower area (Report 135 layout): Celebration Manager (Recipients | Occasions, filters above its own search) and Celebration Schedule (Upcoming | Past, own search) are separate; switching or searching in one leaves the other untouched; the composer never changes", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await pickPerson("Margaret");
  await click($("[data-testid=gx-picker-done]"));
  const mgr = $("[data-testid=gx-manager]"), sch = $("[data-testid=gx-schedule]");
  assert.ok(mgr && sch && mgr !== sch);
  assert.match(mgr.textContent, /Celebration Manager/); assert.match(sch.textContent, /Celebration Schedule/);
  // Walkthrough 2026-10-24 (founder): Recipients reads People and Individuals reads All. The schedule tabs keep their
  // full names in the text; phones hide " Occasions" (CSS) so they read Upcoming | Past.
  assert.deepEqual($$("[aria-label='Your people and occasions'] [role=tab]").map((b) => b.textContent), ["People", "Occasions"]);
  assert.deepEqual($$("[data-testid=gx-when] [role=tab]").map((b) => b.textContent), ["Upcoming Occasions", "Past Occasions"]);
  assert.deepEqual($$("[data-testid=gx-when] [role=tab] .lbl-long").map((b) => b.textContent), [" Occasions", " Occasions"]);
  const names = () => $$("[data-testid=gx-manager-recipients] .row .name").map((e) => e.textContent);
  const seg = $("[data-testid=gx-recip-segments]");
  assert.deepEqual([...seg.querySelectorAll("button")].map((b) => b.textContent), ["All", "Friends", "Family", "Professional"]);
  assert.ok(seg.compareDocumentPosition($("[data-testid=gx-manager-recipients] input")) & window.Node.DOCUMENT_POSITION_FOLLOWING, "the filter row is above the search");
  assert.deepEqual(names(), ["Theresa Morgan", "Margaret Rivera", "Daniel Okafor"], "All by default");
  await click($("[data-testid=gx-recip-filter-friend]")); assert.deepEqual(names(), ["Theresa Morgan"]);
  await click($("[data-testid=gx-recip-filter-professional]")); assert.deepEqual(names(), ["Daniel Okafor"]);
  await setValue($("[data-testid=gx-manager-recipients] input"), "zz");
  assert.deepEqual(names(), []);
  assert.match($("[data-testid=gx-recip-filter-empty]").textContent, /No professional contacts match that name/);
  await setValue($("[data-testid=gx-manager-recipients] input"), "");
  await click($("[data-testid=gx-recip-filter-family]")); assert.deepEqual(names(), ["Margaret Rivera"]);
  // the Schedule: set its own state, then work the Manager hard; the Schedule must not change
  await click(byText("[data-testid=gx-when] button", "Past Occasions"));
  await setValue($("[data-testid=gx-sched-search]"), "priya");
  const schedBody = $("[data-testid=gx-schedbody]"); const schedHtml = schedBody.innerHTML;
  assert.equal($$("[data-testid=gx-past-row]").length, 1, "the schedule's own search");
  await click($("[data-testid=gx-lower-occasions]"));
  assert.ok($$("[data-testid=gx-occ-row]").length > 10, "the occasion list");
  await setValue($("[data-testid=gx-occ-search]"), "christ");
  assert.deepEqual($$("[data-testid=gx-occ-row]").map((r) => r.dataset.type), ["christmas"]);
  await click($("[data-testid=gx-lower-recipients]"));
  assert.equal($("[data-testid=gx-schedbody]"), schedBody, "the Schedule's viewport was never replaced");
  assert.equal(schedBody.innerHTML, schedHtml, "and its content is unchanged");
  assert.equal(byText("[data-testid=gx-when] button", "Past Occasions").getAttribute("aria-selected"), "true");
  assert.equal($("[data-testid=gx-sched-search]").value, "priya");
  // the Manager kept its own state (both views mounted) and the Schedule's switch leaves it untouched
  assert.equal($("[data-testid=gx-recip-filter-family]").getAttribute("aria-selected"), "true");
  assert.equal($("[data-testid=gx-occ-search]").value, "christ");
  const mgrBody = $("[data-testid=gx-tabbody]"); const mgrHtml = mgrBody.innerHTML;
  await click(byText("[data-testid=gx-when] button", "Upcoming Occasions")); await setValue($("[data-testid=gx-sched-search]"), "");
  assert.equal($("[data-testid=gx-tabbody]"), mgrBody); assert.equal(mgrBody.innerHTML, mgrHtml);
  // Occasions -> the Celebrations page's Occasions path at that occasion
  await click($("[data-testid=gx-lower-occasions]"));
  await click($$("[data-testid=gx-occ-row]")[0].querySelector("[data-testid=gx-occ-open]"));
  assert.deepEqual(globalThis.__nav.at(-1), { to: "/dashboard/contacts", opts: { state: { celebrations: { path: "occasions", occasion: "christmas" } } } });
  assert.deepEqual(state().picks, ["MRMargaret Rivera"], "the composer's choice is unchanged by the lower area");
  // Founder 2026-10-24: the occasion list never says "Each person's own date"; counts and the next date stay.
  await setValue($("[data-testid=gx-occ-search]"), "");
  const metas = $$("[data-testid=gx-occ-row] .ometa").map((m) => m.textContent);
  assert.ok(metas.length > 1);
  assert.ok(metas.every((t) => !/own date/.test(t) && /\d+ (person|people)/.test(t)), metas.join(" | "));
  assert.ok(metas.some((t) => /Next [A-Z][a-z]{2} \d{1,2}/.test(t)));
});

test("composer heading is centred; the compact presentation keeps body text at its approved sizes", async () => {
  const { DASHBOARD_HOME_CSS } = await import(pathToFileURL(join(__dirname, "dashboardHomeStyles.js")).href);
  assert.match(DASHBOARD_HOME_CSS, /\.gx \.flow-head \{ flex-direction:column; align-items:center; text-align:center;/);
  assert.equal(/font(-size)?:[^;]*\b(9|10|11)px/.test(DASHBOARD_HOME_CSS.slice(DASHBOARD_HOME_CSS.indexOf("Revision 2026-10-20"))), false, "the revision sets no text below 11.5px");
});

test("adjustments: no gold 'Send a Greet-Me' label; Quick Gift in the welcome headline goes to the Gift Place; Add a gift is gold, last in the gift card", async () => {
  await mount();
  assert.equal($("[data-testid=gx-flow] .flow-head .eyebrow"), null);
  assert.equal(/Send a Greet-Me/i.test($("[data-testid=gx-flow] .flow-head").textContent), false);
  const q = $("[data-testid=gx-hero] h1 [data-testid=gx-quick-hero]");
  assert.ok(q, "inside the welcome headline, where it was");
  assert.match(q.textContent, /Quick Gift/);
  await click(q);
  assert.deepEqual(globalThis.__nav.at(-1), { to: "/dashboard/gifts", opts: undefined });
  assert.equal($("[data-testid=gx-carousel] [data-testid=gx-quick-banner]"), null);
  const add = $("[data-testid=gx-add-gift]");
  assert.ok(add.classList.contains("btn-gold"), "gold");
  assert.equal(add.parentElement.lastElementChild, add, "the last control in the card's action column (lower right)");
});

test("Report 135: the gold Add a gift stays on every carousel slide; the final labels are Send (Send Now) and Save (Schedule the Love); the gift card and Step 5 are contained cards", async () => {
  await mount();
  for (let k = 0; k < $$(".dot").length; k++) {
    await click($$(".dot")[k]);
    const add = $("[data-testid=gx-add-gift]");
    assert.ok(add && add.classList.contains("btn-gold"), `slide ${k}: the gold Add a gift is present`);
    assert.equal(add.style.visibility, "", `slide ${k}: never hidden`);
    assert.equal(add.parentElement.lastElementChild, add, `slide ${k}: it keeps its place, last in the action column`);
  }
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  assert.equal(state().cont.textContent.trim(), "Send");
  assert.match($("[data-testid=gx-footbar] .step-label").textContent, /Send/);
  await click(byText(".mode", "Schedule the Love"));
  assert.equal(state().cont.textContent.trim(), "Save");
  assert.match($("[data-testid=gx-footbar] .step-label").textContent, /Save/);
  const { DASHBOARD_HOME_CSS } = await import(pathToFileURL(join(__dirname, "dashboardHomeStyles.js")).href);
  const tail = DASHBOARD_HOME_CSS.slice(DASHBOARD_HOME_CSS.indexOf("Report 135"));
  assert.match(tail, /\.gx \.giftband \{ margin:8px 0 0;[^}]*border-radius:22px;[^}]*overflow:hidden;/, "the gold stays inside a rounded card, no bleed");
  assert.match(tail, /\.gx \.footbar \{ margin:14px 0 22px;[^}]*border-radius:22px;/, "Step 5 is its own rounded card");
  assert.match(tail, /\.gx \.footbar \.sum \{ white-space:normal;/, "the summary wraps instead of being cut off");
});

test("Report 135: Celebrations' Occasions path hands several people to THIS Dates & gifts: it opens with them and the occasion, shared dates filled in, and each save keeps the person's other occasions", async () => {
  const snap = JSON.stringify({ v: 1, userId: "u1", savedAt: Date.now(), mode: "occasion", occasions: ["Christmas"], audience: "one", picks: ["c1", "c2"], excluded: [], whoDone: true, datesOpen: true });
  await mountKeeping(snap);
  assert.ok($("[data-testid=gx-dates-modal]"), "Dates & gifts is open");
  const rows = $$("[data-testid=gx-group-row]");
  assert.deepEqual(rows.map((r) => r.querySelector(".rname").textContent.replace(/saved|Saved/g, "").trim()), ["Theresa Morgan", "Margaret Rivera"]);
  for (const r of rows) assert.ok(r.querySelector("input[type=date]").value.endsWith("-12-25"), "the shared calendar date is filled in");
  await setValue($("[data-testid=gx-group-default-gift]"), "none");
  await click(datesSave());
  const t = globalThis.__saves.find((x) => x.id === "c1");
  assert.ok(t, "Theresa saved");
  assert.deepEqual(t.body.occasions.map((o) => o.type), ["birthday", "christmas"], "her birthday is kept");
  assert.deepEqual(t.body.occasionGiftSettings.birthday, { type: "qrcash", autoGift: true, amount: 50 }, "and its gift");
  assert.ok(t.body.occasions.find((o) => o.type === "christmas").date.endsWith("-12-25"));
});

test("Celebration Schedule search filters the real fetched upcoming occasions (by name and by occasion), with an honest empty state", async () => {
  await mount();
  await click(byText("[data-testid=gx-when] button", "Upcoming Occasions"));
  const names = () => $$("[data-testid=gx-up-row]").map((r) => r.querySelector(".name").textContent);
  assert.equal(names().length, UPCOMING().length, "no search: every fetched upcoming occasion is listed");
  await setValue($("[data-testid=gx-sched-search]"), "margaret");
  assert.deepEqual(names(), ["Margaret Rivera", "Margaret Rivera"], "a name search narrows to that person's real occasions");
  await setValue($("[data-testid=gx-sched-search]"), "christmas");
  assert.deepEqual(names(), ["Daniel Okafor"], "an occasion search matches by its label");
  await setValue($("[data-testid=gx-sched-search]"), "zz");
  assert.equal(names().length, 0);
  assert.match($("[data-testid=gx-sched-empty]").textContent, /Nothing upcoming matches that search\./);
  await setValue($("[data-testid=gx-sched-search]"), "");
  assert.equal(names().length, UPCOMING().length, "clearing the search restores the full real list");
});

test("Report 136: Add a gift on the QR Cash slide opens the Gift Place on its QR Cash tab (one-time marker tied to this press); other slides do not", async () => {
  const qrDot = () => $$("[data-testid=gx-carousel] .dot").find((d) => d.getAttribute("aria-label") === "QR Cash™");
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await pickPerson("Theresa"); await click($("[data-testid=gx-picker-done]"));
  window.sessionStorage.removeItem("gm_giftplace_tab_v1");
  await click(qrDot());
  assert.match($("[data-testid=gx-carousel] .slide-l").textContent, /Send • Claim • Spend — choose the amount in the Gift Place’s QR Cash™ tab/);
  await click($("[data-testid=gx-add-gift]"));
  const to = globalThis.__nav.at(-1).to;
  assert.match(to, /^\/dashboard\/send\?/);
  const entry = new URLSearchParams(to.split("?")[1]).get("entry");
  assert.ok(entry && new URLSearchParams(to.split("?")[1]).get("gift") === "choose", "the same Gift Place entry as any Add a gift");
  assert.deepEqual((({ entry: e, tab }) => ({ entry: e, tab }))(JSON.parse(window.sessionStorage.getItem("gm_giftplace_tab_v1"))), { entry, tab: "qrcash" });
  // another slide: no marker
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await pickPerson("Theresa"); await click($("[data-testid=gx-picker-done]"));
  window.sessionStorage.removeItem("gm_giftplace_tab_v1");
  await click($$("[data-testid=gx-carousel] .dot")[0]);
  await click($("[data-testid=gx-add-gift]"));
  assert.equal(window.sessionStorage.getItem("gm_giftplace_tab_v1"), null);
});

// ── Walkthrough revision 2026-10-24 (founder) ──────────────────────────────────────────────────────────────────────
const saved = (id) => $(`[data-testid=${id}]`).dataset.saved === "true";
const bubbleDone = (step) => Boolean($(`[data-testid=gx-step-${step}] .step-label .num.done`));

test("walkthrough: the welcome banner has no name chips and no 'Tap a face'; the composer heading stands alone", async () => {
  await mount();
  const hero = $("[data-testid=gx-hero]");
  assert.equal(hero.querySelector(".people, .pick, .people-label"), null, "no Your People chips");
  assert.equal(/Your people|Tap a face/i.test(hero.textContent), false);
  assert.ok(hero.querySelector("[data-testid=gx-quick-hero]"), "Quick Gift is kept");
  const head = $("[data-testid=gx-flow] .flow-head");
  assert.equal(head.querySelector("h2").textContent, "Greet-Me now or right on time?");
  assert.equal(head.querySelector("p"), null, "no subtitle and no payment line beneath it");
  // Recipient selection stays in the composer.
  await pickPerson("Theresa");
  assert.deepEqual(state().picks, ["TMTheresa Morgan"]);
});

test("walkthrough: the founder's section wording", async () => {
  await mount({ user: { id: "u1", name: "Alex Rivera", voiceId: "v1", voiceUrl: "v.mp3", photoUrl: "p.jpg" } }); // a saved voice URL shows Play
  const t = (n) => $(`[data-testid=gx-step-${n}]`).textContent;
  assert.match(t(2), /Who is it for\?Make everyone on your list feel remembered\./);
  assert.match(t(3), /PersonalizeBring your Greet-Me to life\./);
  assert.match(t(3), /Your voice, your words, your memories—make this moment unmistakably yours\./);
  assert.match(t(3), /A few words from the heartTell them what makes this moment special\./);
  assert.match(t(3), /Make it extra specialAdd the moments that matter most\./);
  assert.ok($("[data-testid=gx-voice-pair]").contains($("[data-testid=gx-play-voice]")) && $("[data-testid=gx-voice-pair]").contains($("[data-testid=gx-rerecord]")), "Play and Re-record share one row");
  const { DASHBOARD_HOME_CSS } = await import(pathToFileURL(join(__dirname, "dashboardHomeStyles.js")).href);
  assert.match(DASHBOARD_HOME_CSS, /\.gx \.pairrow \{ display:inline-flex; flex-wrap:nowrap;/);
});

test("walkthrough: occasion Save turns the button and bubble green only after a valid Save; an edit clears it until saved again", async () => {
  await mount();
  assert.equal($("[data-testid=gx-occ-save]").disabled, true, "nothing chosen: Save is not available");
  await click(byText(".mode", "Send Now"));
  assert.equal($("[data-testid=gx-occ-save]").disabled, true, "no occasion yet");
  await click(occ("Birthday"));
  assert.equal(saved("gx-occ-save"), false); assert.equal(bubbleDone(1), false, "choosing alone does not turn it green");
  await click($("[data-testid=gx-occ-save]"));
  assert.equal(saved("gx-occ-save"), true); assert.equal(bubbleDone(1), true);
  assert.equal($("[data-testid=gx-occ-save]").textContent.trim(), "Saved");
  await click(occ("Anniversary"));
  assert.equal(saved("gx-occ-save"), false, "an edit clears the confirmation"); assert.equal(bubbleDone(1), false);
  await click(occ("Anniversary"));
  assert.equal(saved("gx-occ-save"), false, "undoing the edit does not restore it without a Save");
  await click($("[data-testid=gx-occ-save]"));
  assert.equal(saved("gx-occ-save"), true);
  await click(byText(".mode", "Schedule the Love"));
  assert.equal(saved("gx-occ-save"), false, "changing the timing is an edit too");
});

test("walkthrough: Who and Personalize Saves behave the same; Personalize's floating Done is replaced by the anchored Save", async () => {
  await mount();
  await click(byText(".mode", "Send Now")); await click(occ("Birthday"));
  await pickPerson("Theresa");
  assert.equal(bubbleDone(2), false);
  await click($("[data-testid=gx-who-done]"));
  assert.equal(saved("gx-who-done"), true); assert.equal(bubbleDone(2), true);
  await pickPerson("Margaret");
  assert.equal(saved("gx-who-done"), false); assert.equal(bubbleDone(2), false);
  await click($("[data-testid=gx-who-done]"));
  assert.equal(saved("gx-who-done"), true);
  // Personalize
  const row = $("[data-testid=gx-pers-donerow]");
  assert.ok(row && row.classList.contains("secsave") && row.contains($("[data-testid=gx-pers-done]")));
  assert.equal($("[data-testid=gx-pers-done]").textContent.trim(), "Save");
  assert.equal(bubbleDone(3), false);
  await click($("[data-testid=gx-pers-done]"));
  assert.equal(saved("gx-pers-done"), true); assert.equal(bubbleDone(3), true);
  await setValue($("[data-testid=gx-words]"), "Happy birthday!");
  assert.equal(saved("gx-pers-done"), false, "new words clear it"); assert.equal(bubbleDone(3), false);
  // Every section uses the same anchored row and control.
  for (const id of ["gx-occ-donerow", "gx-who-donerow", "gx-pers-donerow"]) assert.ok($(`[data-testid=${id}]`).classList.contains("secsave"), id);
  for (const id of ["gx-occ-save", "gx-who-done", "gx-pers-done"]) assert.ok($(`[data-testid=${id}]`).classList.contains("secsave-btn"), id);
});

test("walkthrough: section Saves confirm only; the final Send is enabled and runs exactly as before, and a section Save sends, saves or charges nothing", async () => {
  await mount();
  await click(byText(".mode", "Send Now")); await click(occ("Birthday"));
  await click($("[data-testid=gx-occ-save]"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-pers-done]"));
  assert.equal(globalThis.__nav.length, 0); assert.equal(globalThis.__saves.length, 0); assert.equal(globalThis.__sends.length, 0); assert.equal(globalThis.__charges.length, 0);
  assert.equal(state().cont.disabled, true, "Send still needs Who's Save, exactly as before");
  await click($("[data-testid=gx-who-done]"));
  assert.equal(state().cont.disabled, false);
  await pickPerson("Margaret"); await pickPerson("Margaret"); // an edit clears the green mark only
  assert.equal(saved("gx-who-done"), false);
  assert.equal(state().cont.disabled, false, "the green mark never gates Send (its gating is unchanged)");
  await click(state().cont);
  assert.match(globalThis.__nav.at(-1).to, /^\/dashboard\/send\?contactId=/, "Send goes to the send flow's own review");
});

test("walkthrough: the occasion rule no longer says 'Several people share one occasion' and the rule still holds; phones hide the default footer line", async () => {
  await mount();
  await click(byText(".mode", "Send Now")); await click(occ("Congratulations"));
  await pickPerson("Theresa"); await pickPerson("Margaret");
  assert.equal(/Several people share one occasion/.test(state().rule), false);
  await click(occ("Thank You"));
  assert.deepEqual(state().occ, ["Congratulations"], "a second occasion for several people is still refused");
  const { DASHBOARD_HOME_CSS } = await import(pathToFileURL(join(__dirname, "dashboardHomeStyles.js")).href);
  assert.match(DASHBOARD_HOME_CSS, /\.gx \.rule\.is-default \{ display:none; \}/);
  await mount();
  assert.ok($("[data-testid=gx-rule]").classList.contains("is-default"));
  assert.equal($("[data-testid=gx-rule]").textContent.trim(), "One person: choose one or more occasions.", "the default line carries no several-people note");
  assert.match($("[data-testid=gx-step-1] .step-label").textContent, /^1Choose your moment: what are we celebrating\?\.$/);
  assert.equal($("[data-testid=gx-step-1] .step-label .lbl-short").textContent, ".", "phones read 'Choose your moment.'");
});

test("walkthrough: the displayed first name starts with a capital, the rest as typed", async () => {
  await mount({ user: { id: "u1", name: "mcKenna rivera", voiceId: "v1", photoUrl: "p.jpg" } });
  assert.match($("[data-testid=gx-hero] h1").textContent, /^McKenna, who would you like to celebrate today\?/);
});

test("walkthrough: Celebration Manager card: centred title, Import Wizard and Add Recipient at the top right (icon on phones, same label)", async () => {
  await mount();
  assert.ok($("[data-testid=gx-manager] .mgrhead"));
  await click($("[data-testid=gx-mgr-import]"));
  assert.deepEqual(globalThis.__nav.at(-1), { to: "/dashboard/import-wizard", opts: undefined });
  const add = $("[data-testid=gx-mgr-add]");
  assert.equal(add.getAttribute("aria-label"), "Add Recipient");
  await click(add);
  assert.deepEqual(globalThis.__nav.at(-1), { to: "/dashboard/contacts", opts: { state: { openAddRecipient: true } } });
});

test("§6 Home: on the QR Cash slide 'How it works' sits beside the title and opens the shared approved explanation, with its Add QR Cash action", async () => {
  await mount();
  await click($$(".dot").at(-1));
  const link = $("[data-testid=gx-qr-howitworks]");
  assert.ok(link, "the link");
  assert.ok(link.closest(".slide-t"), "inside the slide's title, beside 'QR Cash™'");
  assert.match(link.closest(".slide-t").textContent, /^QR Cash™/);
  await click(link);
  const d = $("[data-testid=qrcash-howitworks]");
  assert.ok(d);
  assert.match(d.textContent, /Add a little extra love/);
  assert.match(d.textContent, /\(Zelle, Venmo, Cash App or PayPal\)/);
  assert.doesNotMatch(d.textContent, /print|automatically|Track Your Gifts|spend anywhere/i, "the old modal's claims are gone");
  assert.equal($("[data-testid=qr-howitworks-cta]").textContent.trim(), "Add QR Cash");
});
