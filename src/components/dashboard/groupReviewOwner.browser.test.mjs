// src/components/dashboard/groupReviewOwner.browser.test.mjs
//
// Team 5 N-7 (Report 112): the defence-in-depth "belongs to a different account" view of the REAL GroupReview shows
// none of the other account's data — no names, emails, gifts, amounts or counts — only the block message and a
// disabled Continue. (The dashboard cannot reach this state: loadRun discards another account's run.)
// Run (Node 20.x): node --test src/components/dashboard/groupReviewOwner.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__grvowner.entry.jsx");
const BUNDLE = join(__dirname, ".__grvowner.bundle.mjs");
let React, createRoot, act, GroupReview;

const API_STUB = `export default { getSendEntitlementPreflight: async () => ({ ok: true, canSendGreeting: true, remaining: 10 }), getQrCashCardStatus: async () => ({ ok: true, card: null }),
  chargeGift: async () => { globalThis.__calls++; return {}; }, sendGreeting: async () => { globalThis.__calls++; return {}; } };`;
const PROVIDER_STUB = `export const fetchCheckoutAvailability = async () => ({ available: false }); export const fetchProviderCatalog = async () => ({ ok: true, products: [] });`;
const STRIPE_STUB = `export const stripePromise = null;`;

before(async () => {
  writeFileSync(ENTRY, `export { default as GroupReview } from "./GroupReview.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [{ name: "stub", setup(b) {
      for (const [filter, contents, ns] of [[/api[\\/]api$/, API_STUB, "api"], [/api[\\/]providerCheckout$/, PROVIDER_STUB, "pc"], [/stripe[\\/]stripeProvider$/, STRIPE_STUB, "st"]]) {
        b.onResolve({ filter }, (a) => ({ path: a.path, namespace: ns }));
        b.onLoad({ filter: /.*/, namespace: ns }, () => ({ contents, loader: "js" }));
      }
    } }], logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  Object.assign(globalThis, { window: dom.window, document: dom.window.document, navigator: dom.window.navigator, HTMLElement: dom.window.HTMLElement, localStorage: dom.window.localStorage, IS_REACT_ACT_ENVIRONMENT: true });
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ GroupReview } = await import(pathToFileURL(BUNDLE).href));
});
let root;
after(async () => { if (root) await act(async () => { root.unmount(); }); rmSync(BUNDLE, { force: true }); });

test("another account's run: only the block message and a disabled Continue — none of its data", async () => {
  globalThis.__calls = 0;
  const RUN = { runId: "r", userId: "account-A", occasion: "Birthday", words: "", items: [
    { contactId: "c1", name: "Theresa Morgan", email: "theresa@example.com", gift: { type: "qrcash", amount: 50 }, sendRequestId: "s1", giftRequestId: "g1", status: "sent" },
    { contactId: "c2", name: "Margaret Rivera", email: "margaret@example.com", gift: { type: "qrcash", amount: 25 }, sendRequestId: "s2", giftRequestId: "g2", status: "pending" } ] };
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(GroupReview, {
    recipients: RUN.items.map((i) => ({ id: i.contactId, name: i.name, email: i.email })), occasion: "Birthday", words: "",
    defaultGiftChoice: null, buildPayload: () => null, userId: "account-B", initialRun: RUN, onClose: () => {} })); });
  for (let i = 0; i < 3; i++) await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
  const text = document.body.textContent;
  assert.match(text, /belongs to a different account/);
  for (const leak of ["Theresa", "Margaret", "theresa@example.com", "margaret@example.com", "QR Cash", "$50", "$25", "1 of 2", "accepted for sending"]) {
    assert.equal(text.includes(leak), false, `must not show: ${leak}`);
  }
  assert.equal(document.querySelectorAll("[data-testid=grv-result]").length, 0);
  assert.equal(document.querySelector("[data-testid=grv-retry]").disabled, true);
  assert.equal(globalThis.__calls, 0, "nothing is charged or sent");
});
