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

test("renders the approved sections; held occasions are not rendered; Upcoming asks for 60 days", async () => {
  await mount();
  for (const id of ["gx-hero", "gx-modes", "gx-step-1", "gx-step-2", "gx-resolver", "gx-step-3", "gx-step-4", "gx-footbar", "gx-lower", "gx-install"]) {
    assert.ok($(`[data-testid=${id}]`), id);
  }
  const chips = $$("[data-testid=gx-occasion] .occ").map((e) => e.textContent.trim());
  assert.deepEqual(chips.slice(0, 7), ["Birthday", "Anniversary", "Thank You", "Congratulations", "Just Because", "Baby", "Wedding"]);
  await click($("[data-testid=gx-season]"));
  assert.deepEqual($$(".menu button").map((b) => b.textContent.trim()), ["Christmas", "Season's Greetings"]);
  for (const held of ["Engagement", "Sympathy", "Hanukkah"]) assert.equal(document.body.textContent.includes(held), false, `${held} is held`);
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
  await click(occ("Wedding"));
  await pickPerson("Theresa"); await pickPerson("Margaret");
  await click(occ("Baby"));
  const s = state();
  assert.deepEqual(s.occ, ["Wedding"]);
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
  const rows = $$("[data-testid=gx-group-row]");
  assert.equal(rows.length, 3);
  assert.equal(state().cont.disabled, true, "dates and gifts are needed for everyone");
  await setValue($("[data-testid=gx-group-default-gift]"), "none");
  await setValue($$("[data-testid=gx-group-row]")[1].querySelector("input"), "1960-02-11");
  await setValue($$("[data-testid=gx-group-row]")[2].querySelector("input"), "1985-09-30");
  assert.equal(state().cont.disabled, false);
  await click(state().cont);
  await settle();
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
  await click(state().cont);
  await settle();
  assert.equal(globalThis.__saves.length, 2, "Theresa (existing QR Cash Auto-Gift, no usable card) is not saved");
  assert.equal(globalThis.__saves.some((x) => x.id === "c1"), false);
  assert.match($("[data-testid=gx-fine]").textContent, /Saved 2 of 3.*1 needs their Occasion Scheduler/);
  assert.ok($$("[data-testid=gx-group-row-status]").some((e) => /Needs their scheduler/.test(e.textContent)));
});

test("Send Now: one person + one occasion hands off to the existing send flow, with words and photos carried once", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Baby"));
  await pickPerson("Margaret");
  await click($("[data-testid=gx-who-done]"));
  await setValue($("[data-testid=gx-words]"), "Welcome, little one");
  await click($("[data-testid=gx-add-gift]"));
  assert.equal(state().cont.disabled, false);
  await click(state().cont);
  const nav = globalThis.__nav.at(-1).to;
  assert.equal(nav, "/dashboard/send?contactId=c2&occasion=Baby&from=dashboard&gift=choose");
  const h = JSON.parse(window.sessionStorage.getItem("gm_dashboard_send_handoff_v1"));
  assert.equal(h.contactId, "c2"); assert.equal(h.occasion, "Baby"); assert.equal(h.words, "Welcome, little one");
  assert.equal(globalThis.__saves.length, 0, "the dashboard itself saves nothing");
});

test("Send Now with QR Cash attached uses the existing ?giftType=qrcash entry", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await pickPerson("Theresa");
  await click($("[data-testid=gx-who-done]"));
  // advance the carousel to the QR Cash slide
  await click($$(".dot").at(-1));
  await click($("[data-testid=gx-add-qr]"));
  await click(state().cont);
  assert.equal(globalThis.__nav.at(-1).to, "/dashboard/send?contactId=c1&occasion=Birthday&from=dashboard&giftType=qrcash");
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
  assert.equal(state().cont.disabled, true);
  await setValue(rows[1].querySelector("input"), "2026-06-20");
  assert.equal(state().cont.disabled, true, "a date alone does not complete a row");
  await setValue($$("[data-testid=gx-resolver-row]")[1].querySelector("select"), "none");
  assert.equal(state().cont.disabled, false);
  assert.match(state().cont.textContent, /Review and save schedules/);
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
  assert.match($("[data-testid=gx-fine]").textContent, /choose each occasion.s gift under Dates & gifts/);
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
  await click(occ("Christmas") || occ("Birthday"));
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
  assert.match(state().rule, /Thank You can.t be scheduled/);
});

test("Upcoming: real statuses; no schedule -> 'Auto-send on' or 'Schedule the Love' (opens that person's scheduler)", async () => {
  await mount();
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
  await click(byText("[role=tab]", "Past Occasions"));
  const rows = $$("[data-testid=gx-past-row]");
  assert.equal(rows.length, 2);
  assert.match(rows[0].textContent, /Oct 2/); assert.match(rows[0].textContent, /Sent/);
  assert.match(rows[1].textContent, /Oct 5/); assert.match(rows[1].textContent, /Not sent/);
  assert.match(rows[1].textContent, /Thank You/, "a stored key reads with the send flow's label");
});

test("Recipients: edit pencil opens that recipient's existing edit form", async () => {
  await mount();
  await click($$("[data-testid=gx-edit-recipient]")[1]);
  assert.deepEqual(globalThis.__nav.at(-1), { to: "/dashboard/contacts", opts: { state: { openEditRecipientId: "c2" } } });
});

test("Quick Gift in BOTH places opens the Gift Place; Re-record / Revisit open setup re-entry", async () => {
  await mount();
  await click($("[data-testid=gx-quick-hero]"));
  await click($("[data-testid=gx-quick-banner]"));
  assert.deepEqual(globalThis.__nav.map((n) => n.to), ["/dashboard/gifts", "/dashboard/gifts"]);
  let opened = 0;
  window.addEventListener("gm:open-setup-revisit", () => { opened++; });
  await click($("[data-testid=gx-rerecord]"));
  await click($("[data-testid=gx-revisit]"));
  assert.equal(opened, 2);
});

test("Smart Card slide: 'Coming later' and no add action unless the server reports published cards", async () => {
  await mount({ tiles: { ok: true, tiles: [] } });
  await click($$(".dot")[4]);
  assert.match($(".slide-l").textContent, /Coming later — not yet available/);
  assert.equal($("[data-testid=gx-add-gift]").style.visibility, "hidden");
  await mount({ tiles: { ok: true, tiles: [{ id: "t1" }] } });
  await click($$(".dot")[4]);
  assert.match($(".slide-l").textContent, /One card, spent at the brands they love/);
  assert.equal($("[data-testid=gx-add-gift]").style.visibility, "visible");
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
  assert.match($$("[data-testid=grv-quote-lines]")[0].textContent, /Item \$36\.99 · Shipping \$6\.00 · Tax \$3\.00 · Total \$45\.99/, "the four lines, expandable");
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

test("pricing wording: 'From $X + shipping & tax' with the actual starting price; 'Total pending' and 'Get total' before quoting", async () => {
  await mount();
  await click(byText(".mode", "Send Now"));
  await click(occ("Birthday"));
  await click(byText(".track button", "Everyone"));
  await click($("[data-testid=gx-who-done]"));
  await click(state().cont);
  await settle();
  const opt = [...$("[data-testid=grv-default-gift]").options].find((o) => o.value === "box:goody-1");
  assert.equal(opt.textContent, "Gift box: Cookie Box \u00b7 From $36.99 + shipping & tax");
  await setValue($("[data-testid=grv-default-gift]"), "box:goody-1");
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
  await act(async () => { btn.parentElement.dispatchEvent(new window.MouseEvent("mouseover", { bubbles: true })); }); await settle();
  assert.equal(text().textContent, "Shipping and tax depend on the delivery address. Your total is shown before you pay.", "hover");
  await act(async () => { btn.parentElement.dispatchEvent(new window.MouseEvent("mouseout", { bubbles: true })); }); await settle();
  assert.equal(text(), null, "leaving closes it");
  await act(async () => { btn.focus(); }); await settle();
  assert.ok(text(), "keyboard focus");
  assert.equal(btn.getAttribute("aria-describedby"), text().id);
  await act(async () => { btn.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); }); await settle();
  assert.equal(text(), null, "Escape closes it");
  await click(btn);
  assert.ok(text(), "tap");
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
