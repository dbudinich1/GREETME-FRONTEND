// src/components/contactFormQrCashAutoGift.browser.test.mjs
//
// TRACE (Team 3 request, W07 amount-required UI gap): what does the REAL ContactForm send for a QR Cash
// occasion gift that has Auto-Gift on? Mounted against the real component with a captured save payload.
//
// FINDINGS this file proves (the CHARACTERIZATION tests describe today's behavior; the `todo` tests state the
// behavior the founder-approved rule needs while scheduled QR Cash is unavailable and are reported as TODO,
// not failures, until Team 1A changes ContactForm.jsx):
//   1. GiftSelectorModal's recipient-context Auto-Gift UI (fixed in c7e337e) is NOT reachable from ContactForm:
//      `giftModalOpen` is never set true. The live Auto-Gift toggles are ContactForm's own inline ones.
//   2. Those inline toggles are enabled for QR Cash, show "Auto-Gift Enabled" and the false sentence
//      "Gift will be sent automatically on the occasion date.".
//   3. A contact with a stale {type:'qrcash', autoGift:true} entry (no amount) is re-sent UNCHANGED on save.
//   4. A fresh QR Cash gift with Auto-Gift ticked is sent as {type:'qrcash', autoGift:true} with NO amount,
//      although the inline amount control DISPLAYS $25 (the select's display default is never written to state).
//      The backend (e29c6c8) now answers 400 "QR Cash amount is required when Auto-Gift is enabled" for that.
//
// Run: node --test src/components/contactFormQrCashAutoGift.browser.test.mjs   (Node 20)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__cfqa.bundle.mjs");
const ENTRY = join(__dirname, ".__cfqa.entry.jsx");
let React, createRoot, ContactForm, act;

const ROUTER_STUB = `export const useNavigate = () => ((p) => { globalThis.__nav = p; });`;
const AUTH_STUB = `export const useAuth = () => ({ user: { id: "u1", photoUrl: "https://example.test/me.jpg" } });`;
const NOTIFY_STUB = `export const showManualToast = () => {};`;
const API_STUB = `export default new Proxy({}, { get: () => async () => { throw new Error("network is not available in this test"); } });`;

before(async () => {
  const stub = {
    name: "stub",
    setup(b) {
      b.onResolve({ filter: /(^react-router-dom$|\/api\/api$|\/utils\/notify$|\/context\/AuthContext$)/ }, (a) => ({ path: a.path, namespace: "stub" }));
      b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
        contents: /react-router-dom/.test(a.path) ? ROUTER_STUB : /notify/.test(a.path) ? NOTIFY_STUB : /AuthContext/.test(a.path) ? AUTH_STUB : API_STUB,
        loader: "js",
      }));
    },
  };
  writeFileSync(ENTRY, `export { default as ContactForm } from "./ContactForm.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stub], logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  globalThis.window = window; globalThis.document = window.document;
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.localStorage = window.localStorage; globalThis.sessionStorage = window.sessionStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ ContactForm } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const txt = () => (document.body.textContent || "").replace(/\s+/g, " ");
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const click = (el) => act(async () => { el.click(); });
const tick = async (id, on = true) => { const el = document.getElementById(id); if (el.checked !== on) await click(el); };
function setValue(el, value) {
  const proto = el.tagName === "SELECT" ? window.HTMLSelectElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, value);
  el.dispatchEvent(new window.Event(el.tagName === "SELECT" ? "change" : "input", { bubbles: true }));
}
async function mount(contact = null) {
  globalThis.__submitted = null;
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  document.body.innerHTML = "";
  const c = document.createElement("div"); document.body.appendChild(c);
  await act(async () => {
    createRoot(c).render(React.createElement(ContactForm, { contact, onSubmit: async (d) => { globalThis.__submitted = d; }, onCancel() {} }));
  });
  await flush();
}
const openScheduler = async () => { if (tid("special-occasions-toggle").getAttribute("aria-expanded") !== "true") await click(tid("special-occasions-toggle")); };
const submit = async () => { await click(document.querySelector('button[type="submit"]')); await flush(); };
const autoGiftCheckbox = () => [...document.querySelectorAll("label")].find((l) => /Enable Auto-Gift/.test(l.textContent))?.querySelector('input[type="checkbox"]');
const STALE = { type: "qrcash", autoGift: true };
const staleContact = () => ({ id: "c-stale", name: "Stale Entry", email: "stale@example.test", occasions: [{ type: "birthday", date: "2026-11-14", autoSend: true }], occasionGiftSettings: { birthday: { ...STALE } } });

// ------------------------------------------------------------------------- behavior (Team 1A fix, while scheduled QR Cash is unavailable)
const saveWithBasics = async () => {
  await act(async () => setValue(document.querySelector('input[name="name"]'), "Fresh Entry"));
  await act(async () => setValue(document.querySelector('input[name="email"]'), "fresh@example.test"));
  const d = document.querySelector('input[type="date"]'); if (d) await act(async () => setValue(d, "2026-11-14"));
  await submit();
};

test("GiftSelectorModal is still never opened from ContactForm, so the inline toggles are the live Auto-Gift UI", () => {
  const src = readFileSync(join(__dirname, "ContactForm.jsx"), "utf8");
  assert.doesNotMatch(src, /setGiftModalOpen\(true\)/);
  assert.match(src, /const \[giftModalOpen, setGiftModalOpen\] = useState\(false\);/);
});

test("A. a stale {qrcash, autoGift:true, no amount} entry saves with autoGift:false (and the displayed ${25} amount); the stale value is not re-sent", async () => {
  await mount(staleContact());
  await act(async () => setValue(document.querySelector('input[name="name"]'), "Stale Entry Renamed"));
  await submit();
  assert.ok(globalThis.__submitted, "the form submitted");
  assert.equal(globalThis.__submitted.name, "Stale Entry Renamed");
  assert.deepEqual(globalThis.__submitted.occasionGiftSettings.birthday, { type: "qrcash", autoGift: false, amount: 25 });
});

test("B. the inline toggle for QR Cash is disabled and off, reads Manual Selection, and never claims 'sent automatically'", async () => {
  await mount(staleContact());
  await openScheduler();
  const box = autoGiftCheckbox();
  assert.ok(box, "the toggle still renders (appearance unchanged)");
  assert.equal(box.disabled, true);
  assert.equal(box.checked, false, "a stale autoGift:true is not shown as on");
  assert.match(txt(), /Manual Selection/);
  assert.doesNotMatch(txt(), /Auto-Gift Enabled/);
  assert.doesNotMatch(txt(), /Gift will be sent automatically on the occasion date\./);
  assert.match(txt(), /QR Cash is sent when you send the Greet-Me\. Scheduled QR Cash is not available yet\./);
});

test("C. a fresh QR Cash selection writes the displayed ${25} and saves {qrcash, autoGift:false, amount:25}", async () => {
  await mount(); await openScheduler(); await tick("occasion-birthday");
  await click(tid("add-gift-birthday"));
  await act(async () => setValue(tid("gift-selector-birthday"), "qrcash"));
  const amountSelect = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "100") && [...s.options].some((o) => o.value === "0"));
  assert.equal(amountSelect.value, "25", "it displays ${25}");
  assert.equal(autoGiftCheckbox().disabled, true, "the user cannot turn Auto-Gift on for QR Cash");
  await saveWithBasics();
  assert.deepEqual(globalThis.__submitted.occasionGiftSettings.birthday, { type: "qrcash", autoGift: false, amount: 25 });
});

test("a chosen QR Cash amount other than the default is sent as chosen", async () => {
  await mount(); await openScheduler(); await tick("occasion-birthday");
  await click(tid("add-gift-birthday"));
  await act(async () => setValue(tid("gift-selector-birthday"), "qrcash"));
  const amountSelect = [...document.querySelectorAll("select")].find((s) => [...s.options].some((o) => o.value === "100") && [...s.options].some((o) => o.value === "0"));
  await act(async () => setValue(amountSelect, "50"));
  await saveWithBasics();
  assert.equal(globalThis.__submitted.occasionGiftSettings.birthday.amount, 50);
  assert.equal(globalThis.__submitted.occasionGiftSettings.birthday.autoGift, false);
});

test("other gift types are unchanged: Auto-Gift is enabled and saves autoGift:true when ticked, with the ordinary claim", async () => {
  await mount(); await openScheduler(); await tick("occasion-birthday");
  await click(tid("add-gift-birthday"));
  await act(async () => setValue(tid("gift-selector-birthday"), "marketplace"));
  const box = autoGiftCheckbox();
  assert.equal(box.disabled, false);
  await click(box);
  assert.match(txt(), /Auto-Gift Enabled/);
  assert.match(txt(), /Gift will be sent automatically on the occasion date\./);
  assert.doesNotMatch(txt(), /Scheduled QR Cash is not available yet/);
  await saveWithBasics();
  const entry = globalThis.__submitted.occasionGiftSettings.birthday;
  assert.equal(entry.type, "marketplace");
  assert.equal(entry.autoGift, true);
  assert.equal(entry.amount, undefined, "non-QR-Cash entries are not given an amount");
});

test("the availability constant is imported from the single module, not duplicated", () => {
  const src = readFileSync(join(__dirname, "ContactForm.jsx"), "utf8");
  assert.match(src, /import \{ SCHEDULED_QRCASH_AVAILABLE, SCHEDULED_QRCASH_UNAVAILABLE_COPY \} from '\.\.\/config\/scheduledQrCash';/);
  assert.doesNotMatch(src, /const SCHEDULED_QRCASH_AVAILABLE\s*=/);
});

test("annual-repeat sentence: absent for QR Cash while scheduled QR Cash is unavailable; present for marketplace and curated on a yearly occasion; absent on a one-time occasion", async () => {
  const SENTENCE = /Your gift selection will automatically repeat annually until changed\./;
  await mount(); await openScheduler(); await tick("occasion-birthday"); await tick("occasion-graduation");
  await click(tid("add-gift-birthday"));
  await act(async () => setValue(tid("gift-selector-birthday"), "qrcash"));
  assert.equal(tid("add-gift-repeat-birthday"), null, "QR Cash: no repeat claim");
  assert.doesNotMatch(txt(), SENTENCE);
  assert.match(txt(), /Scheduled QR Cash is not available yet\./);
  await act(async () => setValue(tid("gift-selector-birthday"), "marketplace"));
  assert.match(tid("add-gift-repeat-birthday").textContent, SENTENCE, "marketplace on a yearly occasion: present");
  await act(async () => setValue(tid("gift-selector-birthday"), "curated"));
  assert.match(tid("add-gift-repeat-birthday").textContent, SENTENCE, "curated on a yearly occasion: present");
  await act(async () => setValue(tid("gift-selector-birthday"), "qrcash"));
  assert.equal(tid("add-gift-repeat-birthday"), null, "switching back to QR Cash removes it again");
  // one-time occasion (Graduation): absent whatever the type
  await click(tid("add-gift-graduation"));
  await act(async () => setValue(tid("gift-selector-graduation"), "marketplace"));
  assert.equal(tid("add-gift-repeat-graduation"), null, "one-time occasion: absent");
});
