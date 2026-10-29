// src/components/contactFormPersonalAddressPreserve.browser.test.mjs
//
// Founder 2026-10-29 (personal path): "Saved delivery names/address must be preserved even when their fields aren't visible."
// The REAL ContactForm in jsdom (api, router, auth, notify stubbed; no network). The form fills the address from the stored one
// over its defaults; an UNTOUCHED save must send the stored address EXACTLY as stored (a stored address without `country` must
// not gain "United States"); an edited address is sent as before; hidden delivery names are sent unchanged.
// Run (Node 20): node --test src/components/contactFormPersonalAddressPreserve.browser.test.mjs
// PERSONAL_BODIES_OUT=<file> also writes the captured PUT bodies (for the backend proof in reports/assets/148_t6_corrections).
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PID = process.pid;
const f = (n) => join(__dirname, `.__cfaddr.${PID}.${n}`);
const ENTRY = f("entry.jsx"), OUT = f("bundle.mjs"), API = f("api.js"), ROUTER = f("router.js"), AUTH = f("auth.js"), NOTIFY = f("notify.js");
const TEMP = [ENTRY, OUT, API, ROUTER, AUTH, NOTIFY];
let React, createRoot, act, M, window;
const BODIES = {};

before(async () => {
  writeFileSync(API, `export default new Proxy({}, { get: () => async () => { throw new Error("network is not available in this test"); } });\n`);
  writeFileSync(ROUTER, `export const useNavigate = () => (() => {});\n`);
  writeFileSync(AUTH, `export const useAuth = () => ({ user: { id: "u1" } });\n`);
  writeFileSync(NOTIFY, `export const showManualToast = () => {};\n`);
  writeFileSync(ENTRY, `export { default as ContactForm, storedAddressUntouched } from "./ContactForm.jsx";\n`);
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
        return undefined;
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
after(() => {
  for (const t of TEMP) { try { rmSync(t, { force: true }); } catch { /* ignore */ } }
  if (process.env.PERSONAL_BODIES_OUT) writeFileSync(process.env.PERSONAL_BODIES_OUT, JSON.stringify(BODIES, null, 2));
});

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
let submitted, root;
async function mount(contact) {
  submitted = [];
  try { window.sessionStorage.clear(); } catch { /* ignore */ }
  if (root) await act(async () => { root.unmount(); });
  document.body.innerHTML = "";
  const c = document.createElement("div"); document.body.appendChild(c);
  root = createRoot(c);
  await act(async () => { root.render(React.createElement(M.ContactForm, { contact, onSubmit: async (d) => { submitted.push(JSON.parse(JSON.stringify(d))); }, onCancel() {} })); });
  await flush();
}
const save = async () => { await act(async () => { document.querySelector('[data-testid="contact-form-footer"] button[type="submit"]').click(); }); await flush(); await flush(); };
// A personal record as the app stores it (no Auto-Gift, so the save goes straight to onSubmit).
const REC = (over) => ({ id: "c1", name: "Avery Fixture", email: "avery@example.test", gender: "", relationshipCategory: "friend", relationship: "close_friend",
  relationshipCloseness: "greetme_worthy", relationshipContext: "", relationshipProfile: null, occasions: [{ id: "o1", type: "birthday", date: "1990-11-14", autoSend: true }],
  occasionGiftSettings: {}, avatar: "", memoryPhotos: [], coverPhoto: "", culturalContext: { heritage: [], faith: null, preferCulturalGifts: false },
  giftPreferences: { enabled: false, budgetCap: "", giftingMode: "always" }, ...over });

test("untouched save: a stored address WITHOUT country is sent exactly as stored (no 'United States' added); hidden names unchanged", async () => {
  const stored = { line1: "1 Main St", city: "Town", state: "NJ", zip: "07000" };
  await mount(REC({ firstName: "Avery", lastName: "Fixture", shippingAddress: stored }));
  await save();
  assert.equal(submitted.length, 1);
  assert.deepEqual(submitted[0].shippingAddress, stored);
  assert.equal(JSON.stringify(submitted[0].shippingAddress), JSON.stringify(stored), "byte-identical, key order included");
  assert.equal(submitted[0].firstName, "Avery"); assert.equal(submitted[0].lastName, "Fixture");
  BODIES.noCountry = { stored: REC({ firstName: "Avery", lastName: "Fixture", shippingAddress: stored }), body: submitted[0] };
});

test("untouched save: an empty stored address {} stays {} (the form's defaults are not written into it)", async () => {
  await mount(REC({ shippingAddress: {} }));
  await save();
  assert.equal(JSON.stringify(submitted[0].shippingAddress), "{}");
  BODIES.emptyAddress = { stored: REC({ shippingAddress: {} }), body: submitted[0] };
});

test("untouched save: a complete stored address is sent as stored, which is what the form sent before (same keys, same order)", async () => {
  const stored = { line1: "12 Elm St", line2: "Apt 3", city: "Springfield", state: "NJ", zip: "07081", country: "United States" };
  await mount(REC({ shippingAddress: stored }));
  await save();
  assert.equal(JSON.stringify(submitted[0].shippingAddress), JSON.stringify(stored));
  // 4db330a sent { ...defaults, ...stored }: for a complete stored address that is the same JSON.
  assert.equal(JSON.stringify({ line1: "", line2: "", city: "", state: "", zip: "", country: "United States", ...stored }), JSON.stringify(stored));
  BODIES.complete = { stored: REC({ shippingAddress: stored }), body: submitted[0] };
});

test("no stored address: nothing is invented (the key stays absent, as before)", async () => {
  await mount(REC({}));
  await save();
  assert.equal("shippingAddress" in submitted[0], false);
  BODIES.noAddress = { stored: REC({}), body: submitted[0] };
});

test("storedAddressUntouched: true only for the exact fill; any edit (or a cleared field) is an edit and is sent as before", () => {
  const contact = { shippingAddress: { line1: "1 Main St", city: "Town", state: "NJ", zip: "07000" } };
  const filled = { line1: "1 Main St", line2: "", city: "Town", state: "NJ", zip: "07000", country: "United States" };
  assert.equal(M.storedAddressUntouched(contact, filled), true);
  assert.equal(M.storedAddressUntouched(contact, { ...filled, city: "Newtown" }), false);
  assert.equal(M.storedAddressUntouched(contact, { ...filled, country: "Canada" }), false);
  assert.equal(M.storedAddressUntouched(contact, { ...filled, line1: "" }), false);
  assert.equal(M.storedAddressUntouched({}, filled), false, "no stored address: the form's value is used");
  assert.equal(M.storedAddressUntouched(contact, undefined), false);
  BODIES.editedCity = { stored: REC({ firstName: "Avery", lastName: "Fixture", shippingAddress: contact.shippingAddress }), body: { ...BODIES.noCountry.body, shippingAddress: { ...filled, city: "Newtown" } } };
});
