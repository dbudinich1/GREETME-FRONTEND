// src/components/w07AuthFlow.browser.test.mjs
//
// W07 authorization flow on the REAL ContactForm (SAVE opens the card + authorization modal; one consent block per new or changed
// QR Cash Auto-Gift occasion; mailing address once for a shipped gift lacking one), mounted in jsdom with the api and Stripe edges
// stubbed. TWO bundles of the same component are built:
//   * ON  - src/config/scheduledQrCash.js aliased to SCHEDULED_QRCASH_AVAILABLE = true (what activation will look like);
//   * OFF - the REAL config (false, as shipped): the whole flow must be unreachable and make no request.
// No network, no real Stripe, nothing charged. Run (Node 20): node --test src/components/w07AuthFlow.browser.test.mjs
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__w07.${PID}.${n}`);
const ENTRY = f("entry.jsx"), ON = f("on.mjs"), OFF = f("off.mjs"), API = f("api.js"), CFG_ON = f("cfg.js"), STRIPE = f("stripe.jsx"), PROV = f("prov.js"), ROUTER = f("router.js"), AUTH = f("auth.js"), NOTIFY = f("notify.js");
const TEMP = [ENTRY, ON, OFF, API, CFG_ON, STRIPE, PROV, ROUTER, AUTH, NOTIFY];
let React, createRoot, act, FormOn, FormOff, window;

before(async () => {
  writeFileSync(API, `
    // every api call is recorded; only the three W07 card calls and nothing else answer
    export const __calls = []; export const __cfg = { status: { ok: true, card: { present: false } }, statusError: false, setupError: false, completeError: false };
    const impl = {
      getQrCashCardStatus: async () => { __calls.push("status"); if (__cfg.statusError) throw Object.assign(new Error("down"), { status: 503 }); return __cfg.status; },
      setupQrCashCard: async () => { __calls.push("setup"); if (__cfg.setupError) throw new Error("setup"); return { ok: true, clientSecret: "cs_1", setupIntentId: "seti_1", consentWordingVersion: "w07-card-v1" }; },
      completeQrCashCard: async (b) => { __calls.push("complete:" + JSON.stringify(b)); if (__cfg.completeError) throw new Error("complete"); return { ok: true, card: { present: true } }; },
    };
    export default new Proxy(impl, { get: (t, k) => (k in t ? t[k] : async () => { __calls.push("OTHER:" + String(k)); throw new Error("network is not available in this test"); }) });
  `);
  writeFileSync(CFG_ON, `export const SCHEDULED_QRCASH_AVAILABLE = true;\nexport const SCHEDULED_QRCASH_UNAVAILABLE_COPY = "";\n`);
  writeFileSync(STRIPE, `
    import React from "react";
    export const Elements = ({ children }) => children;
    export const CardElement = ({ onChange }) => React.createElement("button", { type: "button", "data-testid": "fake-card-complete", onClick: () => onChange({ complete: true }) }, "card");
    export const useStripe = () => ({ confirmCardSetup: async () => globalThis.__stripeResult });
    export const useElements = () => ({ getElement: () => ({ fakeCard: true }) });
  `);
  writeFileSync(PROV, `export const stripePromise = { fake: true };\n`);
  writeFileSync(ROUTER, `export const useNavigate = () => (() => {});\n`);
  writeFileSync(AUTH, `export const useAuth = () => ({ user: { id: "u1", photoUrl: "https://example.test/me.jpg" } });\n`);
  writeFileSync(NOTIFY, `export const showManualToast = () => {};\n`);
  writeFileSync(ENTRY, `export { default as ContactForm } from "./ContactForm.jsx";\nexport { __calls, __cfg } from "../api/api";\n`);
  const build = (outfile, withOnConfig) => esbuild.build({
    entryPoints: [ENTRY], outfile, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
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
        if (withOnConfig && /config\/scheduledQrCash$/.test(a.path)) return { path: CFG_ON };
        return undefined;
      });
    } }],
  });
  await build(ON, true);
  await build(OFF, false);
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
  const on = await import(pathToFileURL(ON).href), off = await import(pathToFileURL(OFF).href);
  FormOn = on; FormOff = off;
});
after(() => { for (const t of TEMP) { try { rmSync(t, { force: true }); } catch { /* ignore */ } } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const all = (t) => [...document.querySelectorAll(`[data-testid="${t}"]`)];
const txt = () => (document.body.textContent || "").replace(/\s+/g, " ");
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const click = async (el) => { assert.ok(el, "control must exist"); await act(async () => { el.click(); }); await flush(); await flush(); };
function setValue(el, value) {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}
let submitted, submitBehavior;
async function mount(M, contact) {
  submitted = []; submitBehavior = null;
  M.__calls.length = 0; M.__cfg.statusError = false; M.__cfg.setupError = false; M.__cfg.completeError = false;
  M.__cfg.status = { ok: true, card: { present: false } };
  globalThis.__stripeResult = { setupIntent: { id: "seti_1", status: "succeeded" } };
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  document.body.innerHTML = "";
  const c = document.createElement("div"); document.body.appendChild(c);
  await act(async () => {
    createRoot(c).render(React.createElement(M.ContactForm, { contact, onSubmit: async (d) => { if (submitBehavior) await submitBehavior(d); submitted.push(JSON.parse(JSON.stringify(d))); }, onCancel() {} }));
  });
  await flush();
  if (tid("special-occasions-toggle").getAttribute("aria-expanded") !== "true") await click(tid("special-occasions-toggle"));
}
const GOOD = { id: "c-w07", name: "Avery Fixture", email: "avery@example.test", relationshipCategory: "friend", relationship: "close_friend", relationshipCloseness: "greetme_worthy", memoryPhotos: [], culturalContext: { heritage: [], faith: null, preferCulturalGifts: false } };
const OCC = [{ type: "birthday", date: "2026-11-14", autoSend: true }, { type: "anniversary", date: "2027-06-10", autoSend: true }, { type: "christmas", date: "2026-12-25", autoSend: true }, { type: "easter", date: "2027-03-28", autoSend: true }];
const contactWith = (settings, occasions = OCC) => ({ ...GOOD, occasions: occasions.map((o) => ({ ...o })), occasionGiftSettings: JSON.parse(JSON.stringify(settings)) });
const THREE = { birthday: { type: "qrcash", amount: 25, autoGift: true }, christmas: { type: "qrcash", amount: 50, autoGift: true }, anniversary: { type: "qrcash", amount: 25, autoGift: false } };
const GOOD_CARD = { ok: true, card: { present: true, brand: "Visa", last4: "4242", expMonth: 12, expYear: 2099, expired: false } };
const submitBtn = () => document.querySelector('[data-testid="contact-form-footer"] button[type="submit"]');
const save = async () => { await click(submitBtn()); await flush(); };
const LABELS = { birthday: "Birthday", anniversary: "Anniversary", christmas: "Christmas", easter: "Easter" };
// the occasion card = the smallest element holding both the occasion's name and its Enable Auto-Gift control
function cardOf(name) {
  const hits = [...document.querySelectorAll("div")].filter((d) => d.textContent.includes(LABELS[name]) && d.textContent.includes("Enable Auto-Gift"));
  return hits.find((d) => !hits.some((o) => o !== d && d.contains(o)));
}
const autoBox = (name) => [...cardOf(name).querySelectorAll("label")].find((l) => /Enable Auto-Gift/.test(l.textContent)).querySelector("input");
const amountSel = (name) => [...cardOf(name).querySelectorAll("select")].pop();
const setAmount = (name, v) => act(async () => setValue(amountSel(name), String(v)));

// ================================================================================================ flag ON (activation simulated)
test("ON: nothing changed and a valid card on file - SAVE saves straight away, no modal, no consents; card status read once, no setup", async () => {
  await mount(FormOn, contactWith(THREE)); FormOn.__cfg.status = GOOD_CARD;
  await save();
  assert.equal(tid("save-modal"), null);
  assert.equal(submitted.length, 1);
  assert.ok(!("occasionGiftConsents" in submitted[0]));
  assert.deepEqual(FormOn.__calls, ["status"]);
});

test("ON: the Manual/Card-needed pill is gone, 'Auto-Gift Enabled' shows only when on, the sentence and the info triangle sit under Enable Auto-Gift", async () => {
  await mount(FormOn, contactWith(THREE));
  assert.doesNotMatch(txt(), /Manual Selection|Card needed/);
  assert.match(cardOf("birthday").textContent, /Auto-Gift Enabled/);
  assert.doesNotMatch(cardOf("anniversary").textContent, /Auto-Gift Enabled/);
  const note = cardOf("birthday").querySelector('[data-testid="add-gift-repeat-birthday"]');
  assert.ok(note, "note under the control");
  assert.match(note.textContent, /Your greeting sends automatically each year and repeats./);
  const tri = note.querySelector('[data-testid="payment-info-triangle"]');
  assert.ok(tri);
  assert.equal(tri.getAttribute("aria-label"), "Auto-Gift requires a valid form of payment on file. You will be prompted when you click Save.");
  assert.equal(cardOf("anniversary").querySelector('[data-testid="add-gift-repeat-anniversary"]'), null, "Auto-Gift off: no sentence");
  assert.equal(submitBtn().textContent, "SAVE");
});

test("ON: change ONLY Christmas (50 -> 100) with a valid card: ONE block for Christmas with its own date, amount, fee and total; payload per the backend contract", async () => {
  await mount(FormOn, contactWith(THREE)); FormOn.__cfg.status = GOOD_CARD;
  await setAmount("christmas", 100);
  await save();
  assert.ok(tid("save-modal"));
  assert.equal(all("consent-block-christmas").length, 1);
  assert.equal(all("consent-text").length, 1);
  const t = all("consent-text")[0].textContent.replace(/\s+/g, " ");
  assert.match(t, /charge my card \$104\.99 on December 25 for Christmas: my \$100\.00 QR Cash gift plus a \$4\.99 fee\. \$104\.99 is the most I will ever be charged for this gift\./);
  assert.match(t, /This repeats every year on December 25 until I stop it\. Nothing is charged before that day\. If I change the amount, I will be asked again\./);
  assert.match(t, /I can stop it any time before December 25 by turning Auto-Gift off for Christmas or removing it\./);
  assert.match(t, /If my card can't be charged, my Greet-Me still sends on time, the gift does not, and I'll be told by email\./);
  assert.doesNotMatch(t, /reward/i, "the reward phrase was dropped");
  assert.equal(tid("card-on-file") !== null, true);
  assert.equal(tid("card-element"), null, "no card entry when a good card is on file");
  assert.equal(submitted.length, 0, "nothing is saved before the modal's SAVE");
  await click(tid("consent-checkbox"));
  await click(tid("save-modal-save"));
  assert.equal(tid("save-modal"), null);
  assert.equal(submitted.length, 1);
  assert.deepEqual(submitted[0].occasionGiftConsents, [{ occasionType: "christmas", occasionDate: "2026-12-25", giftType: "qrcash", amountCents: 10000, recurrence: "yearly", wordingVersion: "w07-sched-qrcash-v1", accepted: true }]);
  assert.equal(submitted[0].occasionGiftSettings.christmas.amount, 100);
  assert.deepEqual(submitted[0].occasionGiftSettings.birthday, { type: "qrcash", amount: 25, autoGift: true }, "the unchanged occasion is untouched");
  assert.deepEqual(FormOn.__calls, ["status"], "a good card means no setup and no complete");
});

test("ON: no card, FOUR Auto-Gift occasions: ONE card field, ONE block per QR Cash occasion, every one must be ticked; card setup then complete, then the save carries every consent", async () => {
  const FOUR = { ...THREE, anniversary: { type: "qrcash", amount: 75, autoGift: true }, easter: { type: "curated", amount: 40, autoGift: true } };
  await mount(FormOn, contactWith(FOUR));
  await act(async () => setValue(document.querySelector('input[name="name"]'), "Avery Renamed"));
  await save();
  assert.equal(all("card-element").length, 1);
  const blocks = ["birthday", "anniversary", "christmas"].map((k) => all(`consent-block-${k}`).length);
  assert.deepEqual(blocks, [1, 1, 1]);
  assert.equal(all("consent-block-easter").length, 0, "a shipped gift never gets a QR Cash consent block (the server refuses it)");
  assert.equal(all("consent-checkbox").length, 3);
  const by = (k) => tid(`consent-block-${k}`).textContent.replace(/\s+/g, " ");
  assert.match(by("birthday"), /\$27\.74 on November 14 for Birthday/);
  assert.match(by("anniversary"), /\$79\.24 on June 10 for Anniversary: my \$75\.00 QR Cash gift plus a \$4\.24 fee/);
  assert.match(by("christmas"), /\$53\.49 on December 25 for Christmas/);
  // tick two of three: the third shows its own error and nothing is requested yet
  await click(tid("consent-block-birthday").querySelector('[data-testid="consent-checkbox"]'));
  await click(tid("consent-block-christmas").querySelector('[data-testid="consent-checkbox"]'));
  await click(tid("save-modal-save"));
  assert.equal(all("auth-error").length, 1);
  assert.ok(tid("consent-block-anniversary").querySelector('[data-testid="auth-error"]'));
  assert.deepEqual(FormOn.__calls, ["status"]);
  await click(tid("consent-block-anniversary").querySelector('[data-testid="consent-checkbox"]'));
  await click(tid("save-modal-save")); // card not entered yet
  assert.equal(all("auth-error").length, 1);
  assert.match(tid("auth-error").textContent, /Please enter your card details\./);
  await click(tid("fake-card-complete"));
  await click(tid("save-modal-save")); // the shipped Easter gift still has no address: asked for ONCE, in this same modal
  assert.ok(tid("save-modal-error-line1"));
  assert.deepEqual(FormOn.__calls, ["status"], "nothing is set up while the modal is incomplete");
  for (const [k, v] of [["firstName", "Avery"], ["line1", "12 Elm St"], ["city", "Newark"], ["state", "NJ"], ["zip", "07102"]]) await act(async () => setValue(tid(`save-modal-${k}`), v));
  await click(tid("save-modal-save"));
  assert.deepEqual(FormOn.__calls, ["status", "setup", `complete:${JSON.stringify({ setupIntentId: "seti_1", consentAccepted: true, consentWordingVersion: "w07-card-v1" })}`]);
  assert.equal(tid("save-modal"), null);
  assert.equal(submitted.length, 1);
  assert.deepEqual(submitted[0].occasionGiftConsents.map((c) => [c.occasionType, c.occasionDate, c.amountCents]).sort(), [["anniversary", "2027-06-10", 7500], ["birthday", "2026-11-14", 2500], ["christmas", "2026-12-25", 5000]]);
  for (const c of submitted[0].occasionGiftConsents) assert.deepEqual(Object.keys(c).sort(), ["accepted", "amountCents", "giftType", "occasionDate", "occasionType", "recurrence", "wordingVersion"]);
  assert.equal(submitted[0].name, "Avery Renamed");
});

test("ON: Cancel saves nothing and sets nothing up", async () => {
  await mount(FormOn, contactWith(THREE));
  await save();
  assert.ok(tid("save-modal"));
  await click(tid("save-modal-cancel"));
  assert.equal(tid("save-modal"), null);
  assert.equal(submitted.length, 0);
  assert.deepEqual(FormOn.__calls, ["status"]);
});

test("ON: a bank that does not confirm the card shows the plain message and saves nothing; a retry then succeeds", async () => {
  await mount(FormOn, contactWith({ birthday: { type: "qrcash", amount: 25, autoGift: true } }));
  await save();
  await click(tid("consent-checkbox")); await click(tid("fake-card-complete"));
  globalThis.__stripeResult = { error: { message: "declined" } };
  await click(tid("save-modal-save"));
  assert.match(tid("auth-error").textContent, /Your bank didn't confirm this card\./);
  assert.equal(submitted.length, 0);
  globalThis.__stripeResult = { setupIntent: { id: "seti_1", status: "succeeded" } };
  await click(tid("save-modal-save"));
  assert.equal(submitted.length, 1);
});

test("ON: setup or complete failing shows 'couldn't save your card' and saves nothing; a failed card status check blocks the save with a message", async () => {
  await mount(FormOn, contactWith({ birthday: { type: "qrcash", amount: 25, autoGift: true } }));
  FormOn.__cfg.setupError = true;
  await save();
  await click(tid("consent-checkbox")); await click(tid("fake-card-complete")); await click(tid("save-modal-save"));
  assert.match(tid("auth-error").textContent, /We couldn't save your card just now\./);
  assert.equal(submitted.length, 0);
  await mount(FormOn, contactWith({ birthday: { type: "qrcash", amount: 25, autoGift: true } }));
  FormOn.__cfg.statusError = true;
  await save();
  assert.equal(tid("save-modal"), null);
  assert.equal(submitted.length, 0);
  assert.match(txt(), /couldn’t check the card on file just now/);
});

test("ON: a card that expires before the occasion date is described and a new card is asked for", async () => {
  await mount(FormOn, contactWith({ birthday: { type: "qrcash", amount: 25, autoGift: true } }));
  FormOn.__cfg.status = { ok: true, card: { present: true, brand: "Visa", last4: "4242", expMonth: 10, expYear: 2026, expired: false } };
  await save();
  assert.match(tid("card-problem").textContent, /expires before the occasion date/);
  assert.ok(tid("card-element"));
});

test("ON: a refused save (CONSENT_REQUIRED) is shown in the modal, which stays open; nothing is cleared or stored locally", async () => {
  await mount(FormOn, contactWith(THREE)); FormOn.__cfg.status = GOOD_CARD;
  await setAmount("birthday", 50);
  submitBehavior = async () => { throw Object.assign(new Error("Auto-Gift QR Cash requires the sender's consent"), { code: "CONSENT_REQUIRED", status: 400 }); };
  await save();
  await click(tid("consent-checkbox")); await click(tid("save-modal-save"));
  assert.ok(tid("save-modal"), "still open");
  assert.ok(tid("save-modal-submit-error"));
  assert.equal(submitted.length, 0);
});

test("ON: a shipped gift lacking an address - the SAME modal asks for it once; Delivery Details are no longer in the form body; no consent block for the shipped gift", async () => {
  await mount(FormOn, contactWith({ easter: { type: "curated", amount: 40, autoGift: true } }));
  assert.doesNotMatch(txt(), /Delivery Details/);
  await save();
  assert.ok(tid("save-modal-address"));
  assert.equal(all("save-modal-address").length, 1);
  assert.equal(tid("qrcash-authorization"), null, "no consent or card for a shipped gift");
  assert.deepEqual(FormOn.__calls, [], "no QR Cash Auto-Gift: not even a card status read");
  await click(tid("save-modal-save"));
  for (const k of ["firstName", "line1", "city", "state", "zip"]) assert.ok(tid(`save-modal-error-${k}`), k);
  assert.equal(submitted.length, 0);
  for (const [k, v] of [["firstName", "Avery"], ["line1", "12 Elm St"], ["city", "Newark"], ["state", "NJ"], ["zip", "07102"]]) await act(async () => setValue(tid(`save-modal-${k}`), v));
  await click(tid("save-modal-save"));
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].shippingAddress.line1, "12 Elm St");
  assert.ok(!("occasionGiftConsents" in submitted[0]));
});

test("ON: a new QR Cash Auto-Gift on a previously manual occasion asks for consent even with a good card; lowering/unchanged elsewhere stays silent", async () => {
  await mount(FormOn, contactWith({ ...THREE })); FormOn.__cfg.status = GOOD_CARD;
  await click(autoBox("anniversary"));
  await save();
  assert.equal(all("consent-block-anniversary").length, 1);
  assert.equal(all("consent-text").length, 1);
  assert.match(tid("consent-text").textContent, /for Anniversary/);
});

// ================================================================================================ flag OFF (as shipped)
test("OFF (as shipped): the whole flow is unreachable - no modal, no triangle, no consent text, no card or status request - even with a shipped gift lacking an address", async () => {
  await mount(FormOff, contactWith({ birthday: { type: "qrcash", amount: 25, autoGift: true }, easter: { type: "curated", amount: 40, autoGift: false } }));
  assert.match(txt(), /Delivery Details/, "today's inline Delivery Details are still there");
  assert.equal(tid("payment-info-triangle"), null);
  assert.equal(autoBox("birthday").disabled, true, "QR Cash Auto-Gift cannot be turned on");
  assert.match(txt(), /Scheduled QR Cash is not available yet\./);
  assert.doesNotMatch(txt(), /Manual Selection|Card needed/);
  await save();
  assert.equal(tid("save-modal"), null);
  assert.equal(tid("qrcash-authorization"), null);
  assert.equal(submitted.length, 1, "SAVE just saves, as before");
  assert.deepEqual(submitted[0].occasionGiftSettings.birthday, { type: "qrcash", amount: 25, autoGift: false }, "QR Cash is still forced to Manual while the flag is off");
  assert.ok(!("occasionGiftConsents" in submitted[0]));
  assert.deepEqual(FormOff.__calls, [], "no request of any kind");
  assert.doesNotMatch(txt(), /w07-sched-qrcash-v1|authorize Greet-Me to charge my card/);
  assert.equal(submitBtn().textContent, "SAVE");
});

test("source: every W07 use in ContactForm is behind SCHEDULED_QRCASH_AVAILABLE", () => {
  const src = readFileSync(join(__dirname, "ContactForm.jsx"), "utf8");
  assert.match(src, /import \{ SCHEDULED_QRCASH_AVAILABLE, SCHEDULED_QRCASH_UNAVAILABLE_COPY \} from '\.\.\/config\/scheduledQrCash';/);
  assert.doesNotMatch(src, /const SCHEDULED_QRCASH_AVAILABLE\s*=/);
  assert.equal((src.match(/api\.getQrCashCardStatus\(/g) || []).length, 1);
  const call = src.indexOf("api.getQrCashCardStatus(");
  assert.ok(src.lastIndexOf("if (SCHEDULED_QRCASH_AVAILABLE) {", call) > src.lastIndexOf("const handleSubmit", call), "the status read is inside the flag guard of handleSubmit");
  assert.match(src, /\{SCHEDULED_QRCASH_AVAILABLE && authModal && \(/);
  assert.match(src, /SCHEDULED_QRCASH_AVAILABLE && giftSetting\.type === 'qrcash' && <PaymentInfoTriangle \/>/);
  assert.equal((src.match(/\{!SCHEDULED_QRCASH_AVAILABLE && requiresDeliveryAddress\(giftSetting\.type\) && \(/g) || []).length, 3);
  assert.doesNotMatch(src, /Update Recipient/);
  const cfg = readFileSync(join(__dirname, "..", "config", "scheduledQrCash.js"), "utf8");
  assert.match(cfg, /export const SCHEDULED_QRCASH_AVAILABLE = false;/, "the shipped constant is still false");
});
