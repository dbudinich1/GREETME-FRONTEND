// src/components/corporateCampaign/sendNowUnconfirmed.browser.test.mjs
//
// PAY-142 (Team 6, 2026-10-29) — the one-time status's new `unconfirmed` payment state (backend fix/t6-payment-recovery-1029
// @ 9f1458e, services/corporateCampaign/oneTimeSend.js:683: resolved:false, sameKeySendAllowed:true). The kept send may be
// SENT again with its SAME idempotency key (a replay of the original request), and Start over (a NEW key) is never offered.
// `unknown` / `processing` allow neither; `not_charged` keeps Start over after the 10-minute window. The real SendNowFlow in
// jsdom with injected fake clients (no network, nothing charged).
// Run (Node 20.x): node --test src/components/corporateCampaign/sendNowUnconfirmed.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, `.__snu.${process.pid}.entry.jsx`);
const BUNDLE = join(__dirname, `.__snu.${process.pid}.bundle.mjs`);
let React, createRoot, act, SendNowFlow, M, dom;

before(async () => {
  writeFileSync(ENTRY, `export { default as SendNowFlow } from "./SendNowFlow.jsx";\nexport * from "./oneTimeSendModel.js";\n`);
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
  M = await import(pathToFileURL(BUNDLE).href);
  ({ SendNowFlow } = M);
});
after(() => { for (const f of [ENTRY, BUNDLE]) { try { rmSync(f, { force: true }); } catch { /* gone */ } } });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); }); };
const click = async (el) => { assert.ok(el, "control must exist"); await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); await flush(); };
const choose = async (el, v) => { await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(el, v); el.dispatchEvent(new dom.window.Event("change", { bubbles: true })); }); await flush(); };
const mounted = [];
afterEach(async () => { while (mounted.length) { const { root, host } = mounted.pop(); await act(async () => { root.unmount(); }); host.remove(); } });
async function mount(el) {
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); mounted.push({ root, host });
  await act(async () => { root.render(el); }); await flush();
  return { host, tid: (t) => host.querySelector(`[data-testid="${t}"]`) };
}

const CONTACTS = [{ id: "c1", name: "Dana Lee", corporateContactType: "client" }, { id: "c2", name: "Marcus Hall", corporateContactType: "client" }];
const LINKS = { topUp: { path: "/x", url: "https://x/#/x" }, upgrade: { path: "/y", url: "https://x/#/y" } };
const PREVIEW = {
  recipients: { selector: { category: "client" }, count: 2, selected: 2, list: [{ contactId: "c1", name: "Dana Lee" }, { contactId: "c2", name: "Marcus Hall" }], blocked: [] },
  plan: { required: 2, available: 10, shortfall: 0, planTier: "small_business", sufficient: true, links: LINKS },
  gift: { type: "curated", maxSpendCents: 5000, requiresPayment: true, totalCents: 10950, perRecipient: { c1: { totalCents: 5475 }, c2: { totalCents: 5475 } }, currency: "usd", cardOnFile: true },
  featuredSpread: { included: true }, sender: { senderName: "Jane Smith", photoReady: true, voiceReady: true },
  timing: { when: "immediately_on_confirm", scheduled: false, repeats: false }, canSend: true, blockers: [],
};
// The FIRST send's answer was lost (the card may have been charged): the request and its key are kept, locked.
function client(statusAnswers, sendAfter = () => ({ ok: true, result: { sendId: "s1", stage: "scheduled", recipientCount: 2, chargedTotalCents: 10950 } })) {
  const calls = { preview: [], send: [], status: [] };
  let i = 0;
  return { calls,
    preview: async () => { calls.preview.push(1); return { ok: true, preview: PREVIEW }; },
    send: async (org, body) => { calls.send.push(JSON.parse(JSON.stringify(body))); return calls.send.length === 1 ? { ok: false, error: "funding_incomplete" } : sendAfter(body); },
    status: async (org, id) => { calls.status.push(id); return statusAnswers[Math.min(i++, statusAnswers.length - 1)]; },
  };
}
const payment = (state, extra = {}) => ({ ok: true, result: { stage: "created", payment: { state, resolved: ["confirmed", "not_charged", "not_required"].includes(state), ...extra } } });
function memStore() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m }; }
const flow = (c, store) => React.createElement(SendNowFlow, { orgId: "org1", contacts: CONTACTS, client: c, storage: store });
async function toPending(s) {
  await click(s.tid("sendnow-open")); await click(s.tid("sendnow-next-1")); await click(s.tid("sendnow-next-2"));
  await choose(s.tid("sendnow-occasion"), "birthday");
  await click(s.tid("sendnow-confirm"));
  assert.ok(s.tid("sendnow-pending"), "the send is kept, locked");
}
const ageKept = (store, minutes) => { const [k, v] = [...store.m.entries()][0]; store.m.set(k, JSON.stringify({ ...JSON.parse(v), at: new Date(Date.now() - minutes * 60 * 1000).toISOString() })); };
const UNCONFIRMED_TEXT = "We haven’t confirmed this payment yet. Press Send now to finish this send. It resends your original request, so you won’t be charged twice.";

test("model: 'unconfirmed' maps to its own state ONLY with sameKeySendAllowed === true; otherwise it is 'unknown'", () => {
  assert.equal(M.paymentStateFromStatus(payment("unconfirmed", { sameKeySendAllowed: true })), "unconfirmed");
  for (const extra of [{}, { sameKeySendAllowed: false }, { sameKeySendAllowed: "true" }, { sameKeySendAllowed: 1 }]) {
    assert.equal(M.paymentStateFromStatus(payment("unconfirmed", extra)), "unknown", JSON.stringify(extra));
  }
  assert.ok(M.RESOLVED_FOR_SEND.includes("unconfirmed"), "Send (same key) is allowed");
  for (const s of ["unknown", "processing", "check_failed"]) assert.equal(M.RESOLVED_FOR_SEND.includes(s), false, s);
  assert.equal(M.PAYMENT_STATUS_TEXT.unconfirmed, UNCONFIRMED_TEXT);
  // The other states map as before.
  for (const s of ["confirmed", "not_charged", "processing", "unknown"]) assert.equal(M.paymentStateFromStatus(payment(s)), s);
  assert.equal(M.paymentStateFromStatus(payment("not_required")), "not_charged");
});

test("UNCONFIRMED: Send is enabled, Start over is NEVER shown (not even after 10 minutes), and Send replays the SAME key", async () => {
  const store = memStore();
  const c = client([payment("unconfirmed", { sameKeySendAllowed: true })]);
  const s = await mount(flow(c, store));
  await toPending(s);
  assert.equal(s.tid("sendnow-confirm").disabled, true, "locked until a status check");
  ageKept(store, 11); // well past the in-flight window: Start over must still not appear
  const s2 = await mount(flow(c, store));
  await click(s2.tid("sendnow-open"));
  await click(s2.tid("sendnow-check-status"));
  assert.equal(s2.tid("sendnow-payment-status").textContent, UNCONFIRMED_TEXT);
  assert.equal(s2.tid("sendnow-payment-uncertain"), null, "no contradictory 'don't submit another payment' warning beside an enabled Send");
  assert.equal(s2.tid("sendnow-start-over"), null, "no Start over on unconfirmed");
  assert.equal(s2.tid("sendnow-confirm").disabled, false, "Send is enabled");
  await click(s2.tid("sendnow-confirm"));
  assert.equal(c.calls.send.length, 2);
  assert.equal(c.calls.send[1].idempotencyKey, c.calls.send[0].idempotencyKey, "the SAME idempotency key");
  assert.deepEqual(c.calls.send[1], c.calls.send[0], "the KEPT request, unchanged");
  assert.ok(s2.tid("sendnow-sent"), "the replay's answer is shown");
  assert.equal(store.m.size, 0, "the kept send is cleared once it went through");
});

test("UNCONFIRMED without the flag is treated as UNKNOWN: neither Send nor Start over", async () => {
  const store = memStore();
  const c = client([payment("unconfirmed")]);
  const s = await mount(flow(c, store));
  await toPending(s);
  ageKept(store, 11);
  const s2 = await mount(flow(c, store));
  await click(s2.tid("sendnow-open"));
  await click(s2.tid("sendnow-check-status"));
  assert.match(s2.tid("sendnow-payment-status").textContent, /We can’t confirm this payment yet/);
  assert.equal(s2.tid("sendnow-confirm").disabled, true);
  assert.equal(s2.tid("sendnow-start-over"), null);
});

test("UNKNOWN and PROCESSING: Send and Start over both unavailable (as before), even after 10 minutes", async () => {
  for (const state of ["unknown", "processing"]) {
    const store = memStore();
    const c = client([payment(state)]);
    const s = await mount(flow(c, store));
    await toPending(s);
    ageKept(store, 11);
    const s2 = await mount(flow(c, store));
    await click(s2.tid("sendnow-open"));
    await click(s2.tid("sendnow-check-status"));
    assert.equal(s2.tid("sendnow-confirm").disabled, true, state);
    assert.equal(s2.tid("sendnow-start-over"), null, state);
    await click(s2.tid("sendnow-confirm"));
    assert.equal(c.calls.send.length, 1, `${state}: nothing re-sent`);
  }
});

test("NOT CHARGED: Start over only after the 10-minute window, as before", async () => {
  const store = memStore();
  const c = client([payment("not_charged")]);
  const s = await mount(flow(c, store));
  await toPending(s);
  await click(s.tid("sendnow-check-status"));
  assert.equal(s.tid("sendnow-confirm").disabled, false);
  assert.equal(s.tid("sendnow-start-over"), null, "inside the window");
  ageKept(store, 11);
  const s2 = await mount(flow(c, store));
  await click(s2.tid("sendnow-open"));
  await click(s2.tid("sendnow-check-status"));
  assert.ok(s2.tid("sendnow-start-over"), "after the window");
});

test("UNCONFIRMED whose details changed: a message that claims nothing about the original charge; Send off, no Start over; processing/unknown likewise", async () => {
  const UNCONFIRMED_CHANGED = "We haven’t confirmed this payment yet, and this send can’t be completed because its details changed. You won’t be charged again. Contact support.";
  const OTHER_CHANGED = "We can’t confirm this payment yet, and this send can’t be completed because its details changed. You won’t be charged again. Contact support.";
  const store = memStore();
  const c = client([payment("unconfirmed", { sameKeySendAllowed: true }), payment("processing"), payment("unknown")], () => ({ ok: false, error: "quote_changed" }));
  const s = await mount(flow(c, store));
  await toPending(s);
  await click(s.tid("sendnow-check-status"));
  await click(s.tid("sendnow-confirm"));                       // the same-key replay is refused: the details changed
  assert.equal(c.calls.send.length, 2);
  assert.equal(c.calls.send[1].idempotencyKey, c.calls.send[0].idempotencyKey);
  assert.equal(s.tid("sendnow-changed").textContent, UNCONFIRMED_CHANGED);
  assert.doesNotMatch(s.tid("sendnow-changed").textContent, /Nothing more was charged/);
  assert.equal(s.tid("sendnow-confirm").disabled, true, "Send stays off once the details changed");
  assert.equal(s.tid("sendnow-start-over"), null);
  for (const _ of ["processing", "unknown"]) {
    await click(s.tid("sendnow-check-status"));
    assert.equal(s.tid("sendnow-changed").textContent, OTHER_CHANGED);
    assert.equal(s.tid("sendnow-confirm").disabled, true);
    assert.equal(s.tid("sendnow-start-over"), null);
  }
  await click(s.tid("sendnow-confirm"));
  assert.equal(c.calls.send.length, 2, "nothing re-sent after the details changed");
});
