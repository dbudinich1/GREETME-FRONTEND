// src/components/corporateCampaign/corporateQrCash.browser.test.mjs - RELEASE 2: corporate QR Cash selection (DORMANT).
// BROWSER-LEVEL proof: the real CampaignCard and SendNowFlow bundled and mounted in jsdom with INJECTED fake clients (no network).
// The availability flag (src/config/scheduledQrCash.js, shipped false) is overridden to TRUE inside this test's own
// bundle only, so the "offered only while available" behavior is exercised without touching the shipped constant.
// Run (Node 20.x): node --test src/components/corporateCampaign/corporateQrCash.browser.test.mjs
import { test, before, after, afterEach } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
// CLEAN_SCRATCH: scratch files carry this process id in their name, so concurrent suites cannot collide; all are removed on exit.
import { readdirSync as __scratchLs, rmSync as __scratchRm } from "node:fs";
process.on("exit", () => { try { for (const n of __scratchLs(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) __scratchRm(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const ENTRY = join(__dirname, `.__qrc.${process.pid}.entry.jsx`);
const BUNDLE = join(__dirname, `.__qrc.${process.pid}.bundle.mjs`);

let React, createRoot, act, CampaignCard, SendNowFlow, dom;

const forceAvailable = {
  name: "force-scheduled-qrcash-available",
  setup(b) {
    b.onLoad({ filter: /config[\\/]scheduledQrCash\.js$/ }, () => ({
      contents: "export const SCHEDULED_QRCASH_AVAILABLE = true; export const SCHEDULED_QRCASH_UNAVAILABLE_COPY = '';",
      loader: "js",
    }));
  },
};

before(async () => {
  writeFileSync(ENTRY, `
    export { default as CampaignCard } from "./CampaignCard.jsx";
    export { default as SendNowFlow } from "./SendNowFlow.jsx";
  `);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
    define: { "import.meta.env": "{}" },
    plugins: [forceAvailable],
  });
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event; globalThis.MouseEvent = dom.window.MouseEvent;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ CampaignCard, SendNowFlow } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { for (const f of [ENTRY, BUNDLE, BUNDLE.replace(/\.mjs$/, ".css")]) { try { rmSync(f, { force: true }); } catch { /* gone */ } } });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); }); };
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); await flush(); };
const setValue = async (el, v) => { await act(async () => {
  const proto = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}); await flush(); };
const mounted = [];
afterEach(async () => { while (mounted.length) { const { root, host } = mounted.pop(); await act(async () => { root.unmount(); }); host.remove(); } });
async function mount(el) {
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); mounted.push({ root, host });
  await act(async () => { root.render(el); }); await flush();
  return { host, tid: (t) => host.querySelector(`[data-testid="${t}"]`), q: (s) => host.querySelector(s), qa: (s) => [...host.querySelectorAll(s)], text: () => host.textContent };
}

// ── the dashboard card ───────────────────────────────────────────────────────────────────────
const CONTACTS = [
  { id: "e1", name: "Ana Employee", corporateContactType: "employee" },
  { id: "e2", name: "Ben Employee", corporateContactType: "employee" },
];
const calls = [];
const ok = (name) => (...a) => { calls.push([name, ...a]); return Promise.resolve({ ok: true, data: {} }); };
const fakeClient = {
  updateDeliveryConfig: ok("updateDeliveryConfig"), setAudience: ok("setAudience"), schedule: ok("schedule"), activate: ok("activate"),
  approve: ok("approve"), lock: ok("lock"), unlock: ok("unlock"), setCampaignEnabled: ok("setCampaignEnabled"), renameCampaign: ok("renameCampaign"),
  readCampaign: () => Promise.resolve({ ok: true, data: {} }), updateFeaturedSpread: () => Promise.resolve({ ok: true, data: {} }),
  readReadiness: () => Promise.resolve({ ok: true, data: {} }),
  listGiftCatalog: () => Promise.resolve({ ok: true, data: { items: [] } }),
};
const campaign = (over = {}) => ({
  campaignId: "cmp_1", name: "Q4 Appreciation", approvalStatus: "draft", lockStatus: "unlocked",
  audienceRefs: ["e1", "e2"], deliveryConfig: { scheduleMode: "campaign_date", scheduledForUtc: "2030-12-15T14:00:00.000Z", status: "configured" }, ...over,
});
const cardEl = (over = {}, props = {}) => React.createElement(CampaignCard, {
  campaign: campaign(over), contacts: CONTACTS, orgId: "org1", client: fakeClient,
  isOwner: false, busy: false, onOpenIndividualPicker: () => {}, onAfterMutate: async () => {},
  expanded: true, onToggleExpanded: () => {}, ...props,
});

test("R2-FEB1 AVAILABLE: QR Cash is selectable on a fixed date, shows an amount input, and saves cents + sendOnce", async () => {
  calls.length = 0;
  const s = await mount(cardEl());
  const radio = s.q("#c-cmp_1-gift-qrcash");
  assert.equal(radio.disabled, false, "selectable while the availability flag is true");
  assert.equal(s.tid("card-qrcash-cmp_1"), null, "no amount input until QR Cash is chosen");
  assert.equal(s.tid("card-sched-summary-cmp_1").textContent, "Everyone receives it at the same moment, every year.");
  await click(radio);
  assert.equal(s.tid("card-sched-summary-cmp_1").textContent, "Everyone receives it at the same moment, once.", "schedule summary agrees with 'Sent once'");
  const input = s.tid("card-qrcash-amount-cmp_1");
  assert.ok(input, "the amount input appears");
  assert.equal(input.value, "", "no amount is pre-chosen for the administrator");
  assert.match(s.tid("card-qrcash-note-cmp_1").textContent, /Sent once, on the campaign date\. The standard QR Cash fee is added/);
  assert.match(s.tid("card-qrcash-blocked-cmp_1").textContent, /Enter a QR Cash amount from \$5 to \$100/, "the missing amount is named, not hidden");

  // a campaign with no valid amount is NOT saved
  await click(s.tid("act-save-cmp_1"));
  assert.equal(calls.filter((c) => c[0] === "updateDeliveryConfig").length, 0, "nothing is sent while the amount is missing");

  for (const bad of ["25.5", "4", "101", "abc"]) {
    await setValue(input, bad);
    assert.ok(s.tid("card-qrcash-blocked-cmp_1"), `blocked for ${bad}`);
  }
  await setValue(input, "25");
  assert.equal(s.tid("card-qrcash-blocked-cmp_1"), null, "valid amount clears the note");
  await click(s.tid("act-save-cmp_1"));
  const [, , , body] = calls.find((c) => c[0] === "updateDeliveryConfig");
  assert.deepEqual(body.defaultGift, { type: "qrcash", qrCashAmountCents: 2500 });
  assert.equal(body.sendOnce, true, "QR Cash is a one-off");
  assert.equal(body.scheduleMode, "campaign_date");
  assert.equal(JSON.stringify(body).includes('"amount"'), false);
  assert.equal(JSON.stringify(body).includes('"maxSpend'), false);
});

test("R2-FEB2 AVAILABLE: a per-contact saved-date campaign cannot take QR Cash (disabled), and a saved QR campaign reads back", async () => {
  const saved = await mount(cardEl({ deliveryConfig: { scheduleMode: "contact_saved_date", occasionType: "birthday", status: "configured" } }));
  assert.equal(saved.q("#c-cmp_1-gift-qrcash").disabled, true, "QR Cash is not offered for a recurring saved date");
  assert.equal(saved.q("#c-cmp_1-gift-curated").disabled, false, "the other gifts are unaffected");

  const read = await mount(cardEl({ deliveryConfig: { scheduleMode: "campaign_date", scheduledForUtc: "2030-12-15T14:00:00.000Z", defaultGift: { type: "qrcash", qrCashAmountCents: 4000 }, status: "configured" } }));
  assert.equal(read.q("#c-cmp_1-gift-qrcash").checked, true);
  assert.equal(read.tid("card-qrcash-amount-cmp_1").value, "40");
});

test("R2-FEB3 AVAILABLE: a QR gift on a saved-date config (cannot be saved server-side) is blocked on the card with the reason", async () => {
  calls.length = 0;
  const s = await mount(cardEl({ deliveryConfig: { scheduleMode: "contact_saved_date", occasionType: "birthday", defaultGift: { type: "qrcash", qrCashAmountCents: 2500 }, status: "configured" } }));
  assert.match(s.tid("card-qrcash-blocked-cmp_1").textContent, /QR Cash is sent once, on one campaign date/);
  await setValue(s.tid("card-qrcash-amount-cmp_1"), "30");
  await click(s.tid("act-save-cmp_1"));
  assert.equal(calls.filter((c) => c[0] === "updateDeliveryConfig").length, 0, "never sent");
});

// ── "Send a Greet-Me now" ────────────────────────────────────────────────────────────────────
const LINKS = { topUp: { path: "/a", url: "https://x/#/a" }, upgrade: { path: "/b", url: "https://x/#/b" } };
const PREVIEW = (over = {}) => ({
  recipients: { selector: { category: "employee" }, count: 2, selected: 2, list: [{ contactId: "e1", name: "Ana Employee" }, { contactId: "e2", name: "Ben Employee" }], blocked: [] },
  plan: { required: 2, available: 10, shortfall: 0, planTier: "small_business", sufficient: true, links: LINKS },
  gift: { type: "qrcash", qrCashAmountCents: 2500, requiresPayment: true, totalCents: 5548, feeCents: 548, perRecipient: { e1: { totalCents: 2774 }, e2: { totalCents: 2774 } }, currency: "usd", cardOnFile: true },
  featuredSpread: { included: true }, sender: { senderName: "Jane Smith, Fixture Co.", photoReady: true, voiceReady: true },
  timing: { when: "immediately_on_confirm", scheduled: false, repeats: false }, canSend: true, blockers: [], ...over,
});
function fakeFlowClient({ preview = PREVIEW() } = {}) {
  const log = { preview: [], send: [] };
  return {
    log,
    preview: async (org, body) => { log.preview.push([org, body]); return { ok: true, preview }; },
    send: async (org, body) => { log.send.push([org, body]); return { ok: true, result: { sendId: "s1", stage: "scheduled", recipientCount: 2, chargedTotalCents: 5548 } }; },
  };
}
const flowEl = (client) => React.createElement(SendNowFlow, { orgId: "org1", contacts: [{ id: "e1", name: "Ana Employee", corporateContactType: "employee" }, { id: "e2", name: "Ben Employee", corporateContactType: "employee" }], client });

test("R2-FEB4 AVAILABLE: Send-now offers QR Cash with an amount; Review needs a valid amount; the exact reviewed total is what is confirmed", async () => {
  const c = fakeFlowClient(); const s = await mount(flowEl(c));
  await click(s.tid("sendnow-open"));
  await setValue(s.tid("sendnow-category"), "employee");
  await click(s.tid("sendnow-next-1"));
  const radio = s.q("#sendnow-gift-qrcash");
  assert.equal(radio.disabled, false);
  await click(radio);
  assert.equal(s.tid("sendnow-next-2").disabled, true, "no amount yet, so no review");
  const amount = s.tid("sendnow-qr-amount");
  await setValue(amount, "25.5");
  assert.equal(s.tid("sendnow-next-2").disabled, true);
  await setValue(amount, "25");
  assert.equal(s.tid("sendnow-next-2").disabled, false);
  await click(s.tid("sendnow-next-2"));
  await setValue(s.tid("sendnow-occasion"), "birthday");

  assert.deepEqual(c.log.preview.at(-1)[1].gift, { type: "qrcash", qrCashAmountCents: 2500 });
  assert.match(s.text(), /QR Cash™ \(\$25\.00 each\)/);
  assert.match(s.tid("sendnow-total").textContent, /\$55\.48 will be charged to your saved card at the moment of sending\./);
  await click(s.tid("sendnow-confirm"));
  const [, sent] = c.log.send[0];
  assert.deepEqual(sent.gift, { type: "qrcash", qrCashAmountCents: 2500 });
  assert.equal(sent.expectedTotalCents, 5548, "the owner confirms exactly the total the review showed");
  assert.equal(sent.expectedRecipientCount, 2);
});
