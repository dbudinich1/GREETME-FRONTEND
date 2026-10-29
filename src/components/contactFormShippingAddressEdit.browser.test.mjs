// src/components/contactFormShippingAddressEdit.browser.test.mjs
//
// Address-loss fix (Team 6, 2026-10-19): editing an existing recipient must load the saved
// shippingAddress into the form, so the save payload carries it instead of a blank address.
// Real ContactForm bundled with esbuild into jsdom (harness copied from
// contactFormMemoryPhotoSigned.browser.test.mjs). No network, no backend.
//
// Run: node --test src/components/contactFormShippingAddressEdit.browser.test.mjs   (Node 20)
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__contactform-addr.bundle.mjs");
const ENTRY = join(__dirname, ".__contactform-addr.entry.jsx");
let React, createRoot, ContactForm, act;

const RAW = "https://acct.blob.core.windows.net/photos/memory-1.jpg";
const SIGNED = RAW + "?sv=2024-01-01&se=2026-10-07T12%3A00%3A00Z&sp=r&sig=abc";

const ROUTER_STUB = `export const useNavigate = () => ((p) => { globalThis.__nav = p; });`;
const AUTH_STUB = `export const useAuth = () => ({ user: { id: "u1" } });`;
const NOTIFY_STUB = `export const showManualToast = (...a) => { (globalThis.__toasts || (globalThis.__toasts = [])).push(a); };`;
const API_STUB = `export default new Proxy({}, { get: (_t, k) => k === "uploadContactMemoryPhoto"
  ? async () => ({ ok: true, url: ${JSON.stringify(SIGNED)}, blobUrl: ${JSON.stringify(RAW)} })
  : async () => { throw new Error("network is not available in this test"); } });`;

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

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.localStorage = window.localStorage; globalThis.sessionStorage = window.sessionStorage;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.open = (u) => { (globalThis.__opened || (globalThis.__opened = [])).push(u); };

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ ContactForm } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const click = (el) => act(async () => { el.click(); });

const STORED = { line1: "12 Elm St", line2: "Apt 3", city: "Springfield", state: "NJ", zip: "07081", country: "United States" };

async function mountEdit(contact) {
  globalThis.__submitted = null;
  try { window.sessionStorage.clear(); window.localStorage.clear(); } catch { /* ignore */ }
  document.body.innerHTML = "";
  const c = document.createElement("div"); document.body.appendChild(c);
  await act(async () => {
    createRoot(c).render(React.createElement(ContactForm, {
      contact, onSubmit: async (d) => { globalThis.__submitted = d; }, onCancel: () => {},
    }));
  });
  await flush();
}

const baseContact = (over = {}) => ({
  id: "c_addr1", name: "Ada Lovelace", firstName: "Ada", lastName: "Lovelace", email: "ada@example.test",
  relationshipCategory: "", relationship: "", occasions: [], occasionGiftSettings: {}, ...over,
});

test("editing a recipient with a saved address submits that address unchanged", async () => {
  await mountEdit(baseContact({ shippingAddress: STORED }));
  await click(document.querySelector('button[type="submit"]'));
  await flush();
  assert.ok(globalThis.__submitted, "form submitted");
  assert.deepEqual(globalThis.__submitted.shippingAddress, STORED);
});

test("editing a recipient with a partial saved address keeps it and fills only the defaults", async () => {
  await mountEdit(baseContact({ shippingAddress: { line1: "9 Oak Ave", city: "Newark", state: "NJ", zip: "07102" } }));
  await click(document.querySelector('button[type="submit"]'));
  await flush();
  assert.deepEqual(globalThis.__submitted.shippingAddress,
    { line1: "9 Oak Ave", line2: "", city: "Newark", state: "NJ", zip: "07102", country: "United States" });
});

test("editing a record that carries no address submits no address field (T5 M1: Business contacts keep their stored address)", async () => {
  await mountEdit(baseContact());
  await click(document.querySelector('button[type="submit"]'));
  await flush();
  assert.ok(globalThis.__submitted, "form submitted");
  assert.equal("shippingAddress" in globalThis.__submitted && globalThis.__submitted.shippingAddress !== undefined, false,
    "no address is sent, so neither the personal PUT nor the corporate PATCH overwrites a stored one");
});
