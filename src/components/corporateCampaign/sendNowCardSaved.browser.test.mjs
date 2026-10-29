// src/components/corporateCampaign/sendNowCardSaved.browser.test.mjs
//
// LIVE-5 (Team 6, 2026-10-29) — "Send a Greet-Me now": a card saved from the REVIEW's card panel reloads the server's review, so
// "A saved card is needed" goes and Confirm follows the new answer without Back, then Review. The real SendNowFlow and the real
// SavedCardPanel, bundled and mounted in jsdom with injected fake clients and a fake Stripe (no network, nothing charged).
// Run (Node 20.x): node --test src/components/corporateCampaign/sendNowCardSaved.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, `.__sncs.${process.pid}.entry.jsx`);
const BUNDLE = join(__dirname, `.__sncs.${process.pid}.bundle.mjs`);
let React, createRoot, act, SendNowFlow, dom;

before(async () => {
  writeFileSync(ENTRY, `export { default as SendNowFlow } from "./SendNowFlow.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
    define: { "import.meta.env": "{}" }, logLevel: "silent",
  });
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event; globalThis.MouseEvent = dom.window.MouseEvent;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ SendNowFlow } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { for (const f of [ENTRY, BUNDLE]) { try { rmSync(f, { force: true }); } catch { /* gone */ } } });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); }); };
const click = async (el) => { assert.ok(el, "control must exist"); await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); await flush(); };
const choose = async (el, v) => { await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(el, v); el.dispatchEvent(new dom.window.Event("change", { bubbles: true })); }); await flush(); };
const submit = async (form) => { await act(async () => { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); }); await flush(); await flush(); };
const mounted = [];
afterEach(async () => { while (mounted.length) { const { root, host } = mounted.pop(); await act(async () => { root.unmount(); }); host.remove(); } });
async function mount(el) {
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); mounted.push({ root, host });
  await act(async () => { root.render(el); }); await flush();
  return { host, tid: (t) => host.querySelector(`[data-testid="${t}"]`) };
}

// A fake Stripe whose card element reports itself complete when the test says so (the element's own "change" event).
function fakeStripe() {
  const handlers = {};
  const element = () => ({ mount() {}, unmount() {}, destroy() {}, update() {}, blur() {}, focus() {}, clear() {}, once() {},
    on(ev, cb) { (handlers[ev] = handlers[ev] || []).push(cb); }, off(ev, cb) { handlers[ev] = (handlers[ev] || []).filter((h) => h !== cb); } });
  return {
    stripe: { elements: () => ({ create: () => element(), getElement: () => element(), update: () => {} }), confirmCardSetup: async () => ({ setupIntent: { id: "seti_1", status: "succeeded" } }),
      createToken: async () => ({}), createPaymentMethod: async () => ({}), confirmCardPayment: async () => ({}) },
    complete: async () => { await act(async () => { for (const h of handlers.change || []) h({ complete: true, empty: false }); }); await flush(); },
  };
}
function cardClient({ completeOk = true } = {}) {
  const calls = [];
  return { calls,
    getPaymentMethod: async () => { calls.push("get"); return { ok: true, paymentMethod: { ready: false } }; },
    createSetupIntent: async () => { calls.push("setup"); return { ok: true, status: 201, data: { clientSecret: "seti_1_secret_x" } }; },
    replacePaymentMethod: async () => { calls.push("replace"); return { ok: true, status: 201, data: { clientSecret: "seti_2_secret_x" } }; },
    completeSetupIntent: async () => { calls.push("complete"); return completeOk ? { ok: true, paymentMethod: { ready: true, brand: "visa", last4: "4242" } } : { ok: false, status: 500 }; },
  };
}

const CONTACTS = [{ id: "c1", name: "Dana Lee", corporateContactType: "client" }, { id: "c2", name: "Marcus Hall", corporateContactType: "client" }];
const LINKS = { topUp: { path: "/x", url: "https://x/#/x" }, upgrade: { path: "/y", url: "https://x/#/y" } };
const GIFT = (cardOnFile) => ({ type: "curated", maxSpendCents: 5000, requiresPayment: true, totalCents: 10950, perRecipient: { c1: { totalCents: 5475 }, c2: { totalCents: 5475 } }, currency: "usd", cardOnFile });
const PREVIEW = (cardOnFile) => ({
  recipients: { selector: { category: "client" }, count: 2, selected: 2, list: [{ contactId: "c1", name: "Dana Lee" }, { contactId: "c2", name: "Marcus Hall" }], blocked: [] },
  plan: { required: 2, available: 10, shortfall: 0, planTier: "small_business", sufficient: true, links: LINKS },
  gift: GIFT(cardOnFile), featuredSpread: { included: true }, sender: { senderName: "Jane Smith", photoReady: true, voiceReady: true },
  timing: { when: "immediately_on_confirm", scheduled: false, repeats: false },
  canSend: cardOnFile, blockers: cardOnFile ? [] : ["saved_card_required"],
});
function sendClient(previews) {
  const calls = { preview: [], send: [] };
  let i = 0;
  return { calls,
    preview: async (org, body) => { calls.preview.push(JSON.parse(JSON.stringify(body))); return { ok: true, preview: previews[Math.min(i++, previews.length - 1)] }; },
    send: async (org, body) => { calls.send.push(body); return { ok: true, result: { sendId: "s1", stage: "scheduled", recipientCount: body.expectedRecipientCount, chargedTotalCents: 10950 } }; },
  };
}
function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; }
async function toReview(s) {
  await click(s.tid("sendnow-open")); await click(s.tid("sendnow-next-1")); await click(s.tid("sendnow-next-2"));
  await choose(s.tid("sendnow-occasion"), "birthday");
}

test("LIVE-5: saving a card in the review reloads it - 'A saved card is needed' goes and Confirm is enabled, without Back then Review", async () => {
  const c = sendClient([PREVIEW(false), PREVIEW(true)]); const st = fakeStripe(); const cards = cardClient();
  const s = await mount(React.createElement(SendNowFlow, { orgId: "org1", contacts: CONTACTS, client: c, cardClient: cards, stripeOverride: st.stripe, storage: memStore() }));
  await toReview(s);
  assert.equal(c.calls.preview.length, 1);
  assert.match(s.tid("sendnow-blockers").textContent, /A saved card is needed/);
  assert.equal(s.tid("sendnow-confirm").disabled, true);
  assert.ok(s.tid("saved-card-panel"), "the review offers the card panel");
  await st.complete();
  await submit(s.tid("saved-card-form"));
  assert.deepEqual(cards.calls, ["get", "setup", "complete"]);
  assert.equal(c.calls.preview.length, 2, "the review was asked for again");
  assert.deepEqual(c.calls.preview[1], c.calls.preview[0], "the SAME review request: nothing about the send changed");
  assert.equal(s.tid("sendnow-blockers"), null, "'A saved card is needed' is gone");
  assert.equal(s.tid("saved-card-panel"), null, "the card is on file now");
  assert.equal(s.tid("sendnow-confirm").disabled, false, "Confirm follows the new answer");
  assert.equal(c.calls.send.length, 0, "reloading the review never sends");
  await click(s.tid("sendnow-confirm"));
  assert.equal(c.calls.send.length, 1, "and the owner's own press sends once");
});

test("LIVE-5: a card save that does not complete leaves the review as it was (no reload, Confirm stays off)", async () => {
  const c = sendClient([PREVIEW(false), PREVIEW(true)]); const st = fakeStripe(); const cards = cardClient({ completeOk: false });
  const s = await mount(React.createElement(SendNowFlow, { orgId: "org1", contacts: CONTACTS, client: c, cardClient: cards, stripeOverride: st.stripe, storage: memStore() }));
  await toReview(s);
  await st.complete();
  await submit(s.tid("saved-card-form"));
  assert.ok(s.tid("saved-card-error"), "the panel says the card wasn't saved");
  assert.equal(c.calls.preview.length, 1, "no reload");
  assert.equal(s.tid("sendnow-confirm").disabled, true);
});

test("source: only the REVIEW's card panel reloads; the kept (pending) send's card panel is unchanged (Report 142 rules)", () => {
  const src = readFileSync(join(__dirname, "SendNowFlow.jsx"), "utf8");
  const panels = src.match(/<SavedCardPanel [^>]*\/>/g) || [];
  assert.equal(panels.length, 2);
  assert.equal(panels.filter((p) => p.includes("onSaved={reloadAfterCardSaved}")).length, 1);
  assert.equal(panels.filter((p) => !p.includes("onSaved")).length, 1, "the pending view's panel has no onSaved");
  assert.match(src, /const reloadAfterCardSaved = \(\) => \{\s*if \(!open \|\| step !== 3 \|\| !isOccasion\(occasionType\) \|\| sendingRef\.current \|\| loadPending\(store, orgId\)\) return;/);
});
