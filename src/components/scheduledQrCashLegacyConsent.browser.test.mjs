// src/components/scheduledQrCashLegacyConsent.browser.test.mjs
//
// LIVE-3 (Team 6, 2026-10-29) — an older Auto-Gift QR Cash setting saved BEFORE consent existed (no scheduledQrCashConsents on
// the record, as GET /api/contacts returns it) is asked for consent on SAVE, through the existing W07 consent step, even when
// nothing changed and a good card is on file. Consent is sent ONLY when the sender ticks it; Cancel sends nothing. A setting whose
// stored consent covers its amount saves straight away as before. The REAL ContactForm with the SHIPPED config, in jsdom; the api
// and Stripe edges are stubbed. No network, nothing charged. Run (Node 20): node --test src/components/scheduledQrCashLegacyConsent.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__live3.${PID}.${n}`);
const ENTRY = f("entry.jsx"), OUT = f("bundle.mjs"), API = f("api.js"), STRIPE = f("stripe.jsx"), PROV = f("prov.js"), ROUTER = f("router.js"), AUTH = f("auth.js"), NOTIFY = f("notify.js");
const TEMP = [ENTRY, OUT, API, STRIPE, PROV, ROUTER, AUTH, NOTIFY];
let React, createRoot, act, M, window;

before(async () => {
  writeFileSync(API, `
    export const __calls = []; export const __cfg = { status: { ok: true, card: { present: false } } };
    const impl = {
      getQrCashCardStatus: async () => { __calls.push("status"); return __cfg.status; },
      setupQrCashCard: async () => { __calls.push("setup"); return { ok: true, clientSecret: "cs_1", setupIntentId: "seti_1", consentWordingVersion: "w07-card-v1" }; },
      completeQrCashCard: async () => { __calls.push("complete"); return { ok: true, card: { present: true } }; },
    };
    export default new Proxy(impl, { get: (t, k) => (k in t ? t[k] : async () => { __calls.push("OTHER:" + String(k)); throw new Error("network is not available in this test"); }) });
  `);
  writeFileSync(STRIPE, `
    import React from "react";
    export const Elements = ({ children }) => children;
    export const CardElement = ({ onChange }) => React.createElement("button", { type: "button", "data-testid": "fake-card-complete", onClick: () => onChange({ complete: true }) }, "card");
    export const useStripe = () => ({ confirmCardSetup: async () => ({ setupIntent: { id: "seti_1", status: "succeeded" } }) });
    export const useElements = () => ({ getElement: () => ({ fakeCard: true }) });
  `);
  writeFileSync(PROV, `export const stripePromise = { fake: true };\n`);
  writeFileSync(ROUTER, `export const useNavigate = () => (() => {});\n`);
  writeFileSync(AUTH, `export const useAuth = () => ({ user: { id: "u1" } });\n`);
  writeFileSync(NOTIFY, `export const showManualToast = () => {};\n`);
  writeFileSync(ENTRY, `export { default as ContactForm } from "./ContactForm.jsx";\nexport { __calls, __cfg } from "../api/api";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: OUT, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    loader: { ".css": "empty", ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
    plugins: [{ name: "stubs", setup(b) {
      b.onResolve({ filter: /.*/ }, (a) => {
        if (/(^|\/)api\/api$/.test(a.path)) return { path: API };
        if (a.path === "react-router-dom") return { path: ROUTER };
        if (/context\/AuthContext$/.test(a.path)) return { path: AUTH };
        if (/utils\/notify$/.test(a.path)) return { path: NOTIFY };
        if (a.path === "@stripe/react-stripe-js") return { path: STRIPE };
        if (/stripe\/stripeProvider$/.test(a.path)) return { path: PROV };
        return undefined; // src/config/scheduledQrCash.js is the SHIPPED one
      });
    } }],
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.localStorage = window.localStorage; globalThis.sessionStorage = window.sessionStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(OUT).href);
});
after(() => { for (const t of TEMP) { try { rmSync(t, { force: true }); } catch { /* ignore */ } } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const all = (t) => [...document.querySelectorAll(`[data-testid="${t}"]`)];
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const click = async (el) => { assert.ok(el, "control must exist"); await act(async () => { el.click(); }); await flush(); await flush(); };
let submitted;
async function mount(contact) {
  submitted = [];
  M.__calls.length = 0; M.__cfg.status = GOOD_CARD;
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  document.body.innerHTML = "";
  const c = document.createElement("div"); document.body.appendChild(c);
  await act(async () => { createRoot(c).render(React.createElement(M.ContactForm, { contact, onSubmit: async (d) => { submitted.push(JSON.parse(JSON.stringify(d))); }, onCancel() {} })); });
  await flush();
}
const GOOD_CARD = { ok: true, card: { present: true, brand: "Visa", last4: "4242", expMonth: 12, expYear: 2099, expired: false } };
const BASE = { id: "c-legacy", name: "Avery Fixture", email: "avery@example.test", relationshipCategory: "friend", relationship: "close_friend", relationshipCloseness: "greetme_worthy", memoryPhotos: [], culturalContext: { heritage: [], faith: null, preferCulturalGifts: false },
  occasions: [{ id: "o1", type: "birthday", date: "2026-11-14", autoSend: true }, { id: "o2", type: "christmas", date: "2026-12-25", autoSend: true }] };
const LEGACY = { birthday: { type: "qrcash", amount: 25, autoGift: true } };                                 // saved before consent existed
const snap = (type, amountCents, wordingVersion = "w07-sched-qrcash-v1") => ({ contactId: "c-legacy", occasionType: type, amountCents, feeCents: 274, totalCents: amountCents + 274, maxTotalCents: amountCents + 274, recurrence: "yearly", wordingVersion, acceptedAt: "2026-10-01T00:00:00.000Z" });
const contactWith = (settings, consents) => ({ ...BASE, occasionGiftSettings: JSON.parse(JSON.stringify(settings)), ...(consents ? { scheduledQrCashConsents: consents } : {}) });
const save = async () => { await click(document.querySelector('[data-testid="contact-form-footer"] button[type="submit"]')); await flush(); };

test("LIVE-3: an unchanged legacy Auto-Gift QR Cash with NO stored consent and a good card - SAVE opens the existing consent step for it", async () => {
  await mount(contactWith(LEGACY));
  await save();
  assert.ok(tid("save-modal"), "the existing W07 consent step opens");
  assert.equal(all("consent-block-birthday").length, 1);
  assert.equal(all("consent-checkbox").length, 1, "one block, for the unconsented occasion only");
  assert.equal(tid("card-element"), null, "a good card is on file: no card entry");
  assert.match(tid("consent-block-birthday").textContent.replace(/\s+/g, " "), /charge my card \$27\.74 on November 14 for Birthday: my \$25\.00 QR Cash gift/);
  assert.equal(tid("first-consent-note-birthday").textContent, "This Auto-Gift was set up before we started asking for payment authorization, so we need your OK before it can send automatically.", "the one explanatory line (PROPOSED copy)");
  assert.equal(all("consent-text").length, 1, "the consent wording itself is unchanged and separate");
  assert.equal(submitted.length, 0, "nothing saved yet");
});

test("LIVE-3: consent is sent ONLY after the sender ticks it - unticked SAVE is refused in the modal; ticked SAVE sends one consent per the backend contract", async () => {
  await mount(contactWith(LEGACY));
  await save();
  await click(tid("save-modal-save"));
  assert.ok(tid("auth-error"), "an unticked consent is asked for, never assumed");
  assert.equal(submitted.length, 0);
  await click(tid("consent-checkbox"));
  await click(tid("save-modal-save"));
  assert.equal(tid("save-modal"), null);
  assert.equal(submitted.length, 1);
  assert.deepEqual(submitted[0].occasionGiftConsents, [{ occasionType: "birthday", occasionDate: "2026-11-14", giftType: "qrcash", amountCents: 2500, recurrence: "yearly", wordingVersion: "w07-sched-qrcash-v1", accepted: true }]);
  assert.deepEqual(submitted[0].occasionGiftSettings.birthday, { type: "qrcash", amount: 25, autoGift: true }, "the setting itself is sent unchanged");
  assert.ok(!("scheduledQrCashConsents" in submitted[0]), "no snapshot is sent: the server derives it from the ticked consent");
  assert.deepEqual(M.__calls, ["status"], "no card setup with a good card");
});

test("LIVE-3: Cancel sends nothing and records nothing", async () => {
  await mount(contactWith(LEGACY));
  await save();
  await click(tid("save-modal-cancel"));
  assert.equal(tid("save-modal"), null);
  assert.equal(submitted.length, 0);
});

test("a stored consent covering the amount: SAVE saves straight away, no modal, no consent sent (unchanged behaviour)", async () => {
  await mount(contactWith(LEGACY, { birthday: snap("birthday", 2500) }));
  await save();
  assert.equal(tid("save-modal"), null);
  assert.equal(submitted.length, 1);
  assert.ok(!("occasionGiftConsents" in submitted[0]));
});

test("a stored consent that does NOT cover the amount (lower amount, unknown wording, other occasion) is asked for again", async () => {
  for (const consents of [{ birthday: snap("birthday", 2000) }, { birthday: snap("birthday", 2500, "w07-sched-qrcash-v0") }, { christmas: snap("christmas", 2500) }, {}]) {
    await mount(contactWith(LEGACY, consents));
    await save();
    assert.ok(tid("save-modal"), `asked for ${JSON.stringify(Object.keys(consents))}`);
    assert.equal(all("consent-block-birthday").length, 1);
    assert.equal(submitted.length, 0);
  }
});

test("a CHANGED setting (new amount) gets the consent block WITHOUT the explanatory line", async () => {
  await mount(contactWith(LEGACY));
  if (tid("special-occasions-toggle").getAttribute("aria-expanded") !== "true") await click(tid("special-occasions-toggle"));
  await act(async () => {
    const hits = [...document.querySelectorAll("div")].filter((d) => d.textContent.includes("Birthday") && d.textContent.includes("Enable Auto-Gift"));
    const card = hits.find((d) => !hits.some((o) => o !== d && d.contains(o)));
    const sel = [...card.querySelectorAll("select")].pop();
    Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, "value").set.call(sel, "50");
    sel.dispatchEvent(new window.Event("change", { bubbles: true }));
  });
  await flush();
  await save();
  assert.ok(tid("consent-block-birthday"));
  assert.equal(document.querySelector('[data-testid^="first-consent-note-"]'), null);
});

test("Auto-Gift off or a manual QR Cash gift: nothing to consent to, no modal (unchanged behaviour)", async () => {
  await mount(contactWith({ birthday: { type: "qrcash", amount: 25, autoGift: false } }));
  await save();
  assert.equal(tid("save-modal"), null);
  assert.equal(submitted.length, 1);
  assert.ok(!("occasionGiftConsents" in submitted[0]));
});
