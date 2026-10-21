// src/pages/scheduledGiftBackupScheduler.browser.test.mjs
//
// Backup gift box (founder-approved, gift boxes only) in a recipient's Occasion Scheduler: the REAL Recipients page,
// ContactForm, picker and the scheduler's REAL final confirmation ("Almost done", SaveAuthorizationModal), with the
// feature switch ON only inside this test's bundle. Harness: scheduledGiftScheduler.browser.test.mjs, plus a stubbed
// gift-box catalogue and quote. Money-moving and network calls THROW. Proves:
//   * the backup list excludes the chosen box and boxes whose provider requires an option;
//   * the picker previews the founder-approved cap sentence (cap = lower of the quoted total and the maximum);
//   * the gift row shows "Backup: {name}";
//   * "Almost done" shows the backup sentence and wording sched-gift-v2; the save sends backup + approvedTotalCents
//     and consent v2;
//   * removing the backup returns to v1 exactly (no backup fields, consent v1); Branded Goods has no backup step.
//
// Run (Node 20.x): node --test src/pages/scheduledGiftBackupScheduler.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__sgbk.${PID}.${n}`);
const ENTRY = f("entry.jsx"), BUNDLE = f("bundle.mjs"), API = f("api.js"), AUTH = f("auth.js"), NOTIFY = f("notify.js"), SGFLAG = f("sgflag.js"), RSTRIPE = f("rstripe.jsx"), STRIPEPROV = f("stripeprov.js"), PROVIDER = f("provider.js");
const TEMP = [ENTRY, BUNDLE, API, AUTH, NOTIFY, SGFLAG, RSTRIPE, STRIPEPROV, PROVIDER];
let React, createRoot, act, M, window;

const ADDRESS = { line1: "9 Pine Rd", city: "Austin", state: "TX", zip: "73301", country: "United States" };
const CONTACTS = [
  { id: "c1", name: "Avery Fixture", firstName: "Avery", email: "avery@example.test", relationshipCategory: "friend", relationship: "close_friend", relationshipCloseness: "greetme_worthy",
    occasions: [{ type: "birthday", date: "2026-11-14", autoSend: true }, { type: "christmas", date: "2026-12-25", autoSend: true }],
    occasionGiftSettings: { birthday: { type: "qrcash", amount: 25, autoGift: false }, christmas: { type: "gift_boxes", autoGift: false } }, shippingAddress: ADDRESS, memoryPhotos: [] },
];
const BOXES = [
  { providerProductId: "box-cookie", name: "Cookie Box", priceMinor: 3699, currency: "USD" },
  { providerProductId: "box-tea", name: "Tea Sampler", priceMinor: 2999, currency: "USD" },
  { providerProductId: "box-speaker", name: "Speaker", priceMinor: 5999, currency: "USD", requiresOptions: true },
];

before(async () => {
  writeFileSync(API, `
    export const __calls = [];
    const impl = { getContacts: async () => { __calls.push("getContacts"); return { ok: true, data: JSON.parse(JSON.stringify(globalThis.__contacts)) }; },
      updateContact: async (id, body) => { __calls.push("updateContact:" + id); (globalThis.__bodies = globalThis.__bodies || []).push(body);
        if (globalThis.__saveError) { const e = new Error(globalThis.__saveError.message); Object.assign(e, globalThis.__saveError); throw e; }
        return { ok: true, data: { id, ...body } }; },
      getQrCashCardStatus: async () => { __calls.push("cardStatus"); return { ok: true, card: globalThis.__card || null }; },
      quoteGiftBox: async (b) => { (globalThis.__quotes = globalThis.__quotes || []).push(b); return { ok: true, quotedTotalCents: 4599, providerQuotedTotalCents: 4299, feeCents: 300, quotedAt: "2026-10-18T12:00:00Z", quoteValidForMs: 120000, display: { productCents: 3699, shippingHandlingCents: 600, taxCents: 300, totalCents: 4599 } }; },
      request: async (path) => (path === "/api/merch/products" ? { ok: true, products: [{ syncProductId: 9101, name: "Mug", imageUrl: "", priceCentsMin: 1800, priceCentsMax: 1800, variantCount: 1, variants: [{ syncVariantId: 40011, label: "11 oz", priceCents: 1800 }] }] } : {}),
    };
    export default new Proxy(impl, { get: (t, k) => (k in t ? t[k] : async () => { throw new Error("network is not available in this test: " + String(k)); }) });
  `);
  writeFileSync(AUTH, `export const useAuth = () => ({ user: { id: "u1", photoUrl: "https://example.test/me.jpg" } });\n`);
  writeFileSync(NOTIFY, `export const showManualToast = (t, m) => { (globalThis.__toasts = globalThis.__toasts || []).push(m); };\n`);
  writeFileSync(SGFLAG, `export const SCHEDULED_PHYSICAL_GIFT_AVAILABLE = true; export const SCHEDULED_GIFT_WORDING_VERSION = "sched-gift-v1";\n`);
  writeFileSync(PROVIDER, `export const fetchCheckoutAvailability = async () => ({ available: true });
export const fetchProviderCatalog = async () => ({ ok: true, products: ${JSON.stringify(BOXES)} });
export default {};\n`);
  writeFileSync(RSTRIPE, `import React from "react";
export const Elements = ({ children }) => children;
export const CardElement = () => null;
export const useStripe = () => ({ confirmCardSetup: async () => { throw new Error("no Stripe in this test"); } });
export const useElements = () => ({ getElement: () => ({}) });
`);
  writeFileSync(STRIPEPROV, `export const stripePromise = Promise.resolve({});\n`);
  writeFileSync(ENTRY, `export { default as Contacts } from "./Contacts.jsx";\nexport { MemoryRouter, Routes, Route } from "react-router-dom";\nexport { __calls } from "../api/api";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
    plugins: [{ name: "stubs", setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => {
        if (/(^|\/)api\/api$/.test(a.path)) return { path: API };
        if (/(^|\/)api\/providerCheckout(\.js)?$/.test(a.path)) return { path: PROVIDER };
        if (/context\/AuthContext$/.test(a.path)) return { path: AUTH };
        if (/utils\/notify$/.test(a.path)) return { path: NOTIFY };
        if (/config\/scheduledPhysicalGift(\.js)?$/.test(a.path)) return { path: SGFLAG };
        if (a.path === "@stripe/react-stripe-js") return { path: RSTRIPE };
        if (/stripe\/stripeProvider$/.test(a.path)) return { path: STRIPEPROV };
        return undefined;
      });
    } }],
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/", pretendToBeVisual: true });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  for (const k of ["HTMLElement", "Event", "Node", "getComputedStyle", "localStorage", "sessionStorage", "CustomEvent"]) globalThis[k] = window[k];
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = function () {};
  window.scrollTo = () => {};
  window.matchMedia = window.matchMedia || ((q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }));
  globalThis.fetch = async () => { throw new Error("no network in this test"); }; window.fetch = globalThis.fetch;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
});
afterEach(async () => { if (root) { await act(async () => { root.unmount(); }); root = null; } });
after(() => { for (const t of TEMP) { try { rmSync(t, { force: true }); } catch { /* ignore */ } } });

const wait = async (ms = 0) => { await act(async () => { await new Promise((r) => setTimeout(r, ms)); }); };
let root = null;
async function open(url, contacts = CONTACTS) {
  globalThis.__contacts = contacts; globalThis.__bodies = []; globalThis.__toasts = []; globalThis.__quotes = [];
  globalThis.__card = { present: true, brand: "visa", last4: "4242", expMonth: 12, expYear: 2030 };
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  if (root) { await act(async () => { root.unmount(); }); root = null; }
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => {
    root.render(React.createElement(M.MemoryRouter, { initialEntries: [url] },
      React.createElement(M.Routes, null, React.createElement(M.Route, { path: "/dashboard/contacts", element: React.createElement(M.Contacts) }))));
  });
  for (let i = 0; i < 6; i += 1) await wait(0);
  await wait(150);
}
const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];
const setValue = async (el, value) => {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  await act(async () => { el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true })); });
  await wait(20);
};
const clickEl = async (el) => { assert.ok(el, "element exists"); await act(async () => { el.click(); }); await wait(30); };
const settle = async () => { for (let i = 0; i < 8; i += 1) await wait(20); };
const SAVE = () => document.querySelector('[data-testid="contact-form-footer"] button[type="submit"]');
const christmas = () => document.querySelector('[data-occasion="christmas"]');
const inStep = (step, id) => $(`[data-testid=${step}] [data-testid=gift-card-action-${id}]`);

async function chooseCookieBox() {
  await open("/dashboard/contacts?contactId=c1&occasion=christmas");
  await clickEl(christmas().querySelector("[data-testid=sg-choose]"));
  await settle();
  assert.ok($("[data-testid=sg-picker]"));
  await clickEl(inStep("sg-step-product", "box-cookie"));
  await clickEl($("[data-testid=sg-get-total]")); await settle();
  assert.match($("[data-testid=sg-quote]").textContent, /total \$45\.99/);
}
async function addTeaBackup() {
  await clickEl($("[data-testid=sg-backup-add]")); await settle();
  await clickEl(inStep("sg-step-backup", "box-tea"));
}

test("backup list: every other gift box, never the chosen box and never a box whose provider requires an option", async () => {
  await chooseCookieBox();
  assert.ok($("[data-testid=sg-step-backup]"), "the optional backup step is offered for a gift box");
  assert.equal($("[data-testid=sg-backup-list]"), null, "collapsed until asked for");
  await clickEl($("[data-testid=sg-backup-add]")); await settle();
  const ids = $$("[data-testid=sg-backup-list] [data-testid^=gift-card-action-]").map((b) => b.dataset.testid.replace("gift-card-action-", ""));
  assert.deepEqual(ids, ["box-tea"], "only the other selectable box");
});

test("backup chosen: the cap sentence is previewed, the row shows it, 'Almost done' adds the backup sentence (v2) and the save sends backup + approvedTotalCents + consent v2", async () => {
  await chooseCookieBox();
  await setValue($("[data-testid=sg-max]"), "50");
  await addTeaBackup();
  assert.match($("[data-testid=sg-backup-chosen]").textContent, /Backup: Tea Sampler/);
  assert.equal($("[data-testid=sg-backup-cap]").textContent, "If Cookie Box isn't available, we'll order your backup Tea Sampler instead, only if its full total is no more than $45.99.", "cap = the quoted total when it is below the maximum");
  await setValue($("[data-testid=sg-max]"), "40");
  assert.match($("[data-testid=sg-backup-cap]").textContent, /no more than \$40\.00\.$/, "cap = the maximum when it is lower");
  await setValue($("[data-testid=sg-max]"), "50");
  await clickEl($("[data-testid=sg-use]"));
  assert.equal($("[data-testid=sg-picker]"), null);
  assert.equal(christmas().querySelector("[data-testid=sg-entry-backup]").textContent, "Backup: Tea Sampler");

  await clickEl(SAVE()); await settle();
  assert.ok($("[data-testid=save-modal]"), "Almost done opens");
  assert.match($("[data-testid=save-modal]").textContent, /Almost done/);
  const text = $("[data-testid=sg-consent-text]").textContent;
  assert.equal(text, "Auto-Gift: on December 25, we'll check this gift is available and charge your saved card the full total (item, shipping and any fees) up to $50.00, then place the order. Delivery follows after the occasion date. If Cookie Box isn't available, we'll order your backup Tea Sampler instead, only if its full total is no more than $45.99. If Cookie Box costs more than your maximum, or neither gift can be ordered within your limit, nothing is charged and your greeting is sent without the gift.", "exactly the approved sched-gift-v2 text");
  assert.doesNotMatch(text, /If it's unavailable or costs more/, "no contradictory v1 sentence when a backup applies");
  assert.equal($("[data-testid=sg-consent-backup]").textContent, "If Cookie Box isn't available, we'll order your backup Tea Sampler instead, only if its full total is no more than $45.99.");
  assert.match($("[data-testid=sg-consent-block-christmas]").textContent, /Wording version sched-gift-v2/);
  await clickEl($("[data-testid=sg-consent-checkbox]"));
  await clickEl($("[data-testid=save-modal-save]")); await settle();
  const body = globalThis.__bodies.at(-1);
  assert.ok(body, "saved");
  const g = body.occasionGiftSettings.christmas;
  assert.equal(g.type, "gift_boxes"); assert.equal(g.autoGift, true);
  assert.deepEqual(g.scheduledGift.backup, { providerProductId: "box-tea", variants: [], quantity: 1, name: "Tea Sampler", imageUrl: "" });
  assert.equal(g.scheduledGift.approvedTotalCents, 4599);
  assert.equal(g.scheduledGift.providerProductId, "box-cookie");
  assert.equal("delivery" in g.scheduledGift.backup, false, "no separate address");
  assert.deepEqual(body.scheduledGiftConsents, { christmas: { accepted: true, wordingVersion: "sched-gift-v2" } });
});

test("removing the backup returns to v1 exactly: no backup fields, the v1 consent text and version", async () => {
  await chooseCookieBox();
  await addTeaBackup();
  await clickEl($("[data-testid=sg-backup-remove]"));
  assert.equal($("[data-testid=sg-backup-chosen]"), null);
  assert.ok($("[data-testid=sg-backup-add]"));
  await clickEl($("[data-testid=sg-use]"));
  assert.equal(christmas().querySelector("[data-testid=sg-entry-backup]"), null);
  await clickEl(SAVE()); await settle();
  assert.equal($("[data-testid=sg-consent-backup]"), null);
  assert.equal($("[data-testid=sg-consent-text]").textContent, "Auto-Gift: on December 25, we'll check this gift is available and charge your saved card the full total (item, shipping and any fees) up to $46.00, then place the order. Delivery follows after the occasion date. If it's unavailable or costs more, nothing is charged and your greeting is sent without the gift.", "the approved v1 text, unchanged");
  assert.match($("[data-testid=sg-consent-block-christmas]").textContent, /Wording version sched-gift-v1/);
  await clickEl($("[data-testid=sg-consent-checkbox]"));
  await clickEl($("[data-testid=save-modal-save]")); await settle();
  const body = globalThis.__bodies.at(-1);
  assert.equal(JSON.stringify(body.occasionGiftSettings.christmas),
    '{"type":"gift_boxes","autoGift":true,"scheduledGift":{"v":1,"vendor":"gift_boxes","name":"Cookie Box","imageUrl":"","maxTotalCents":4600,"delivery":{"firstName":"Avery","address1":"9 Pine Rd","city":"Austin","state":"TX","postalCode":"73301","country":"US"},"providerProductId":"box-cookie","variants":[],"quantity":1}}',
    "byte-identical to the v1 snapshot");
  assert.deepEqual(body.scheduledGiftConsents, { christmas: { accepted: true, wordingVersion: "sched-gift-v1" } });
});

test("a backup needs today's total: changing the quantity clears it and the picker asks for the total again", async () => {
  await chooseCookieBox();
  await addTeaBackup();
  await setValue($("[data-testid=sg-quantity]"), "2");
  assert.ok($("[data-testid=sg-get-total]"), "the total is cleared");
  await clickEl($("[data-testid=sg-use]"));
  assert.ok($("[data-testid=sg-picker]"), "not accepted without a quoted total for the backup cap");
  assert.match($("[data-testid=sg-problems]").textContent, /Get today’s total to keep the backup gift/);
  await clickEl($("[data-testid=sg-get-total]")); await settle();
  await clickEl($("[data-testid=sg-use]"));
  assert.equal($("[data-testid=sg-picker]"), null);
});

test("Branded Goods has no backup step", async () => {
  await open("/dashboard/contacts?contactId=c1&occasion=christmas");
  await clickEl(christmas().querySelector("[data-testid=sg-choose]")); await settle();
  await clickEl(inStep("sg-step-product", "box-cookie"));
  assert.ok($("[data-testid=sg-step-backup]"));
  await clickEl($("[data-testid=sg-tab-merch]")); await settle();
  assert.equal($("[data-testid=sg-step-backup]"), null);
});

test("existing schedule with a v1 consent: adding a backup asks for fresh consent (v2); an unchanged backup with a v2 consent is not asked again", async () => {
  const base = { v: 1, vendor: "gift_boxes", name: "Cookie Box", imageUrl: "", maxTotalCents: 4600,
    delivery: { firstName: "Avery", address1: "9 Pine Rd", city: "Austin", state: "TX", postalCode: "73301", country: "US" }, providerProductId: "box-cookie", variants: [], quantity: 1 };
  const v1 = JSON.parse(JSON.stringify(CONTACTS));
  v1[0].occasionGiftSettings.christmas = { type: "gift_boxes", autoGift: true, scheduledGift: base };
  v1[0].scheduledGiftConsents = { christmas: { contactId: "c1", occasionType: "christmas", vendor: "gift_boxes", wordingVersion: "sched-gift-v1", maxTotalCents: 4600, acceptedAt: "2026-10-19T00:00:00Z" } };
  await open("/dashboard/contacts?contactId=c1&occasion=christmas", v1);
  await clickEl(christmas().querySelector("[data-testid=sg-change]")); await settle();
  await clickEl($("[data-testid=sg-get-total]")); await settle();
  await addTeaBackup();
  await clickEl($("[data-testid=sg-use]"));
  await clickEl(SAVE()); await settle();
  assert.ok($("[data-testid=save-modal]"), "a v1 consent does not cover a backup");
  assert.ok($("[data-testid=sg-consent-backup]"));

  const v2 = JSON.parse(JSON.stringify(CONTACTS));
  v2[0].occasionGiftSettings.christmas = { type: "gift_boxes", autoGift: true, scheduledGift: { ...base, backup: { providerProductId: "box-tea", variants: [], quantity: 1, name: "Tea Sampler", imageUrl: "" }, approvedTotalCents: 4599 } };
  v2[0].scheduledGiftConsents = { christmas: { ...v1[0].scheduledGiftConsents.christmas, wordingVersion: "sched-gift-v2" } };
  await open("/dashboard/contacts?contactId=c1&occasion=christmas", v2);
  assert.equal(christmas().querySelector("[data-testid=sg-entry-backup]").textContent, "Backup: Tea Sampler");
  await clickEl(SAVE()); await settle();
  assert.equal($("[data-testid=save-modal]"), null, "unchanged backup + v2 consent: reused");
  assert.equal("scheduledGiftConsents" in globalThis.__bodies.at(-1), false);
  assert.equal(globalThis.__bodies.at(-1).occasionGiftSettings.christmas.scheduledGift.approvedTotalCents, 4599, "kept as stored");
});

test("the server refuses with approved_total_stale: a clear message, no confirmation, the selection kept; the picker then needs today's total again and the sender consents again", async () => {
  await chooseCookieBox();
  await setValue($("[data-testid=sg-max]"), "50");
  await addTeaBackup();
  await clickEl($("[data-testid=sg-use]"));
  globalThis.__saveError = { message: "the total changed", status: 409, code: "approved_total_stale", currentTotalCents: 4799 };
  try {
    await clickEl(SAVE()); await settle();
    await clickEl($("[data-testid=sg-consent-checkbox]"));
    await clickEl($("[data-testid=save-modal-save]")); await settle();
    assert.equal(globalThis.__bodies.length, 1, "one save attempt, no silent retry");
    assert.equal($("[data-testid=save-modal-submit-error]").textContent, "Today's total has changed. Get today's total again before saving.");
    assert.equal(globalThis.__toasts.length, 0, "never confirmed");
    assert.doesNotMatch(document.body.textContent, /Confirmed!|Recipient updated successfully/);
  } finally { globalThis.__saveError = null; }
  await clickEl($("[data-testid=save-modal-cancel]")); await settle();
  assert.equal(christmas().querySelector("[data-testid=sg-entry-backup]").textContent, "Backup: Tea Sampler", "the selection is kept");

  // Re-open: the old approved total is not reused; Use this gift asks for today's total first.
  await clickEl(christmas().querySelector("[data-testid=sg-change]")); await settle();
  assert.ok($("[data-testid=sg-get-total]"), "today's total must be fetched again");
  await clickEl($("[data-testid=sg-use]"));
  assert.ok($("[data-testid=sg-picker]"), "not accepted with the old total");
  assert.match($("[data-testid=sg-problems]").textContent, /Get today’s total to keep the backup gift/);
  await clickEl($("[data-testid=sg-get-total]")); await settle();
  assert.equal(globalThis.__quotes.length, 2, "a fresh server quote");
  await clickEl($("[data-testid=sg-use]"));
  assert.equal($("[data-testid=sg-picker]"), null);
  await clickEl(SAVE()); await settle();
  assert.ok($("[data-testid=sg-consent-checkbox]"), "consent is asked again before the save");
  await clickEl($("[data-testid=sg-consent-checkbox]"));
  await clickEl($("[data-testid=save-modal-save]")); await settle();
  assert.equal(globalThis.__bodies.length, 2);
  assert.deepEqual(globalThis.__bodies.at(-1).scheduledGiftConsents, { christmas: { accepted: true, wordingVersion: "sched-gift-v2" } });
  assert.match(globalThis.__toasts.at(-1), /^Confirmed! /);
});

test("approved_total_unverifiable (retryable) and approved_total_gift_unavailable: a clear message each, nothing confirmed", async () => {
  for (const [code, status, msg] of [
    ["approved_total_unverifiable", 503, "We couldn't check today's total just now. Get today's total again before saving."],
    ["approved_total_gift_unavailable", 409, "This gift box isn't available right now. Choose another gift box, or try again later."],
  ]) {
    await chooseCookieBox();
    await addTeaBackup();
    await clickEl($("[data-testid=sg-use]"));
    globalThis.__saveError = { message: "x", status, code };
    try {
      await clickEl(SAVE()); await settle();
      await clickEl($("[data-testid=sg-consent-checkbox]"));
      await clickEl($("[data-testid=save-modal-save]")); await settle();
      assert.equal($("[data-testid=save-modal-submit-error]").textContent, msg, code);
      assert.equal(globalThis.__toasts.length, 0);
    } finally { globalThis.__saveError = null; }
  }
});

test("an address change clears the approved total: the backup then needs today's total again", async () => {
  await chooseCookieBox();
  await addTeaBackup();
  assert.ok($("[data-testid=sg-quote]"));
  await setValue($("[data-testid=sg-delivery-address1]"), "10 Pine Rd");
  assert.equal($("[data-testid=sg-quote]"), null, "the old total is gone");
  assert.ok($("[data-testid=sg-get-total]"));
  await clickEl($("[data-testid=sg-use]"));
  assert.match($("[data-testid=sg-problems]").textContent, /Get today’s total to keep the backup gift/);
});
