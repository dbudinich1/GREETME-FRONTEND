// Founder 2026-10-28 - "Send a Greet-Me now" with a gift box: the campaign editor's catalog, product and option selection,
// the existing one-time-send request, and the review's per-person costs and full total. Real SendNowFlow in jsdom with
// INJECTED fake clients (no network, no charge, no order, no send).
// Run (Node 20.x): node --test src/components/corporateCampaign/sendNowGiftBox.browser.test.mjs
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
const ENTRY = join(__dirname, `.__snfgb.${process.pid}.entry.jsx`);
const BUNDLE = join(__dirname, `.__snfgb.${process.pid}.bundle.mjs`);

let React, createRoot, act, SendNowFlow, Dashboard, dom;

before(async () => {
  writeFileSync(ENTRY, `
    export { default as SendNowFlow } from "./SendNowFlow.jsx";
    export { default as Dashboard } from "./GreetingAutomationCampaigns.jsx";
  `);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
    define: { "import.meta.env": "{}" },
  });
  dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event; globalThis.MouseEvent = dom.window.MouseEvent;
  try { globalThis.navigator = dom.window.navigator; } catch { /* read-only global on Node 21+ */ }
  globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ SendNowFlow, Dashboard } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { for (const f of [ENTRY, BUNDLE]) { try { rmSync(f, { force: true }); } catch { /* gone */ } } });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); await new Promise((r) => setTimeout(r, 0)); }); };
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); await flush(); };
const choose = async (el, v) => { await act(async () => { Object.getOwnPropertyDescriptor(dom.window.HTMLSelectElement.prototype, "value").set.call(el, v); el.dispatchEvent(new dom.window.Event("change", { bubbles: true })); }); await flush(); };
const mounted = [];
afterEach(async () => { while (mounted.length) { const { root, host } = mounted.pop(); await act(async () => { root.unmount(); }); host.remove(); } });
async function mount(el) {
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host); mounted.push({ root, host });
  await act(async () => { root.render(el); }); await flush();
  return { host, tid: (t) => host.querySelector(`[data-testid="${t}"]`), qa: (s) => [...host.querySelectorAll(s)] };
}

const CONTACTS = [
  { id: "c1", name: "Dana Lee", corporateContactType: "client" },
  { id: "c2", name: "Marcus Hall", corporateContactType: "client" },
  { id: "e1", name: "Bob Smith", corporateContactType: "employee" },
];
const LINKS = { topUp: { path: "/dashboard/animations?openPacks=true", url: "https://x/#/dashboard/animations?openPacks=true" }, upgrade: { path: "/pricing?view=business", url: "https://x/#/pricing?view=business" } };
const PREVIEW = (over = {}) => ({
  recipients: { selector: { category: "client" }, count: 2, selected: 2, list: [{ contactId: "c1", name: "Dana Lee" }, { contactId: "c2", name: "Marcus Hall" }], blocked: [] },
  plan: { required: 2, available: 10, shortfall: 0, planTier: "small_business", sufficient: true, links: LINKS },
  gift: { type: "none", maxSpendCents: null, requiresPayment: false, totalCents: null, perRecipient: null, currency: "usd" },
  featuredSpread: { included: true }, sender: { senderName: "Jane Smith, Fixture Co.", photoReady: true, voiceReady: true },
  timing: { when: "immediately_on_confirm", scheduled: false, repeats: false }, canSend: true, blockers: [], ...over,
});
function fakeClient({ previews = [PREVIEW()], send = null } = {}) {
  const calls = { preview: [], send: [] };
  let i = 0;
  return {
    calls,
    preview: async (org, body) => { calls.preview.push([org, body]); const p = previews[Math.min(i++, previews.length - 1)]; return typeof p === "function" ? p(body) : { ok: true, preview: p }; },
    send: async (org, body) => { calls.send.push([org, body]); return send ? send(body, calls.send.length) : { ok: true, result: { sendId: "s1", stage: "scheduled", recipientCount: body.expectedRecipientCount, chargedTotalCents: 0 } }; },
  };
}
const BOXES = [
  { provider: "goody", providerProductId: "gb-1", title: "Gourmet Snack Box", priceCents: 4500, currency: "USD", variantNames: [] },
  { provider: "goody", providerProductId: "gb-2", title: "Cozy Tee Box", priceCents: 5200, currency: "USD", variantNames: ["Small", "Medium", "Large"] },
];
const catalog = (items = BOXES, ok = true) => {
  const calls = [];
  return { calls, listGiftCatalog: async (org, giftType) => { calls.push([org, giftType]); return ok ? { ok: true, data: { items } } : { ok: false, status: 503 }; } };
};
const BOX_GIFT = (over = {}) => ({
  type: "gift_boxes", maxSpendCents: 5000, requiresPayment: true, cardOnFile: true, currency: "usd",
  totalCents: 12346, perRecipient: { c1: { totalCents: 6173 }, c2: { totalCents: 6173 } }, ...over,
});
const flow = (client, props = {}) => React.createElement(SendNowFlow, { orgId: "org1", contacts: CONTACTS, client, ...props });
async function toWhat(s) { await click(s.tid("sendnow-open")); await click(s.tid("sendnow-next-1")); }
async function pickBox(s, id, options = []) {
  await click(s.host.querySelector("#sendnow-gift-gift_boxes"));
  await click(s.host.querySelector(`#sendnow-gb-${id}`));
  for (const o of options) await click(s.host.querySelector(`[data-testid="sendnow-giftbox-variants"] input[value="${o}"]`));
}
async function review(s) { await click(s.tid("sendnow-next-2")); await choose(s.tid("sendnow-occasion"), "birthday"); }

test("no Gift Box option without a published box: no catalog client, an empty catalog, or a refused read", async () => {
  for (const props of [{}, { catalogClient: catalog([]) }, { catalogClient: catalog(BOXES, false) }]) {
    const s = await mount(flow(fakeClient(), props));
    await toWhat(s);
    assert.equal(s.host.querySelector("#sendnow-gift-gift_boxes"), null);
    assert.ok(s.host.querySelector("#sendnow-gift-curated"), "the standing options are unchanged");
  }
});

test("the catalog is the campaign editor's own organization read, made once the flow is opened", async () => {
  const cat = catalog();
  const s = await mount(flow(fakeClient(), { catalogClient: cat }));
  assert.equal(cat.calls.length, 0, "nothing is read before the flow opens");
  await toWhat(s);
  assert.deepEqual(cat.calls[0], ["org1", "gift_boxes"]);
  assert.ok(s.host.querySelector("#sendnow-gift-gift_boxes"));
});

test("choosing a gift box: spend limit, one box, its published options; Review waits for a box and for an option when the box has options", async () => {
  const s = await mount(flow(fakeClient(), { catalogClient: catalog() }));
  await toWhat(s);
  await click(s.host.querySelector("#sendnow-gift-gift_boxes"));
  assert.ok(s.tid("sendnow-giftbox-tier"));
  assert.equal(s.tid("sendnow-next-2").disabled, true);
  assert.match(s.tid("sendnow-giftbox-note").textContent, /Choose a gift box/);
  await click(s.host.querySelector("#sendnow-gb-gb-2"));
  assert.equal(s.qa('[data-testid="sendnow-giftbox-variants"] input').length, 3);
  assert.equal(s.tid("sendnow-next-2").disabled, true, "this box publishes options, so one is needed");
  assert.match(s.tid("sendnow-giftbox-note").textContent, /Choose an option/);
  await click(s.host.querySelector('[data-testid="sendnow-giftbox-variants"] input[value="Medium"]'));
  assert.equal(s.tid("sendnow-next-2").disabled, false);
  await click(s.host.querySelector("#sendnow-gb-gb-1"));
  assert.equal(s.tid("sendnow-giftbox-variants"), null, "another box drops the first box's options");
  assert.equal(s.tid("sendnow-next-2").disabled, false, "a box without options needs none");
  assert.doesNotMatch(s.tid("sendnow-giftbox").textContent, /\$45|\$52|fee|markup/i, "no catalog price or fee wording before the server's quote");
});

test("the request is the backend's campaign gift shape: spend limit, the catalog item as returned, and the chosen options", async () => {
  const c = fakeClient({ previews: [PREVIEW({ gift: BOX_GIFT() })] });
  const s = await mount(flow(c, { catalogClient: catalog() }));
  await toWhat(s); await pickBox(s, "gb-2", ["Large"]); await review(s);
  const gift = c.calls.preview.at(-1)[1].gift;
  assert.deepEqual(gift, { type: "gift_boxes", maxSpendCents: 2500, product: BOXES[1], variants: ["Large"] });
});

test("the review shows the box name and options, each person's cost and the full total; confirm sends that exact total once", async () => {
  const c = fakeClient({ previews: [PREVIEW({ gift: BOX_GIFT() })], send: (b) => ({ ok: true, result: { sendId: "s1", stage: "scheduled", recipientCount: 2, chargedTotalCents: b.expectedTotalCents } }) });
  const s = await mount(flow(c, { catalogClient: catalog() }));
  await toWhat(s); await pickBox(s, "gb-2", ["Medium"]); await review(s);
  assert.equal(s.tid("sendnow-review-gift").textContent, "Gift box: Cozy Tee Box (Medium)");
  const rows = s.qa('[data-testid="sendnow-cost-row"]').map((r) => r.textContent);
  assert.deepEqual(rows, ["Dana Lee$61.73", "Marcus Hall$61.73"]);
  assert.match(s.tid("sendnow-total").textContent, /\$123\.46 will be charged to your saved card at the moment of sending\./);
  assert.doesNotMatch(s.tid("sendnow-review").textContent, /fee|markup|5%|at cost/i);
  await click(s.tid("sendnow-confirm"));
  assert.equal(c.calls.send.length, 1);
  assert.equal(c.calls.send[0][1].expectedTotalCents, 12346);
  assert.deepEqual(c.calls.send[0][1].gift.variants, ["Medium"]);
  assert.match(s.tid("sendnow-sent").textContent, /\$123\.46 was charged/);
});

test("price changed at send: nothing charged, plain message, a fresh review and a NEW key; the retry sends the new total", async () => {
  const p1 = PREVIEW({ gift: BOX_GIFT() });
  const p2 = PREVIEW({ gift: BOX_GIFT({ totalCents: 12500, perRecipient: { c1: { totalCents: 6250 }, c2: { totalCents: 6250 } } }) });
  const c = fakeClient({ previews: [p1, p2], send: (b, n) => (n === 1 ? { ok: false, error: "quote_changed" } : { ok: true, result: { sendId: "s2", recipientCount: 2, chargedTotalCents: b.expectedTotalCents } }) });
  const s = await mount(flow(c, { catalogClient: catalog() }));
  await toWhat(s); await pickBox(s, "gb-1"); await review(s);
  await click(s.tid("sendnow-confirm"));
  assert.match(s.tid("sendnow-error").textContent, /price changed.*Nothing was charged/);
  assert.match(s.tid("sendnow-total").textContent, /\$125\.00/);
  await click(s.tid("sendnow-confirm"));
  assert.equal(c.calls.send.length, 2);
  assert.notEqual(c.calls.send[0][1].idempotencyKey, c.calls.send[1][1].idempotencyKey);
  assert.equal(c.calls.send[1][1].expectedTotalCents, 12500);
});

test("a lost response on a paid gift: 'we're confirming your payment', no invitation to pay again; any later press reuses the SAME key", async () => {
  const c = fakeClient({ previews: [PREVIEW({ gift: BOX_GIFT() })], send: (b, n) => (n === 1 ? { ok: false, indeterminate: true } : { ok: true, replay: true, result: { sendId: "s1", recipientCount: 2, chargedTotalCents: 12346 } }) });
  const s = await mount(flow(c, { catalogClient: catalog() }));
  await toWhat(s); await pickBox(s, "gb-1"); await review(s);
  await click(s.tid("sendnow-confirm"));
  assert.equal(s.tid("sendnow-payment-uncertain").textContent, "We’re confirming your payment. Don’t submit another payment yet.");
  assert.equal(s.tid("sendnow-unsure"), null, "the 'press the button again' line is not shown for a paid send");
  await click(s.tid("sendnow-confirm"));
  assert.equal(c.calls.send[0][1].idempotencyKey, c.calls.send[1][1].idempotencyKey);
  assert.match(s.tid("sendnow-sent").textContent, /nothing was sent twice/);
});

test("quote refusals block the send in plain words: missing options, a failed quote, an incomplete address, a retired box", async () => {
  const cases = [
    ["variants_invalid", /Choose the options this gift box needs.*Nothing was charged/],
    ["quote_request_failed", /get a price for that gift box.*Nothing was charged/],
    ["recipient_address_invalid", /mailing address is incomplete/],
    ["catalog_product_not_published", /no longer available/],
  ];
  for (const [code, re] of cases) {
    const c = fakeClient({ previews: [PREVIEW({ gift: BOX_GIFT({ totalCents: null, perRecipient: null }), canSend: false, blockers: [code] })] });
    const s = await mount(flow(c, { catalogClient: catalog() }));
    await toWhat(s); await pickBox(s, "gb-1"); await review(s);
    assert.match(s.tid("sendnow-blockers").textContent, re, code);
    assert.equal(s.tid("sendnow-confirm").disabled, true, code);
    assert.equal(s.tid("sendnow-costs"), null, "no costs without a quote");
  }
});

test("someone without a mailing address is named and left out; a declined card sends nothing", async () => {
  const blocked = [{ contactId: "c2", name: "Marcus Hall", reason: "missing_recipient_address", field: "address", message: "no mailing address" }];
  const c = fakeClient({
    previews: [PREVIEW({ gift: BOX_GIFT({ totalCents: 6173, perRecipient: { c1: { totalCents: 6173 } } }), recipients: { selector: { category: "client" }, count: 1, selected: 2, list: [{ contactId: "c1", name: "Dana Lee" }], blocked }, canSend: true })],
    send: () => ({ ok: false, error: "funding_declined" }),
  });
  const s = await mount(flow(c, { catalogClient: catalog() }));
  await toWhat(s); await pickBox(s, "gb-1"); await review(s);
  assert.match(s.tid("sendnow-notready").textContent, /Marcus Hall \(no mailing address\)/);
  assert.deepEqual(s.qa('[data-testid="sendnow-cost-row"]').map((r) => r.textContent), ["Dana Lee$61.73"]);
  await click(s.tid("sendnow-confirm"));
  assert.match(s.tid("sendnow-error").textContent, /declined\. Nothing was sent/);
});

test("the dashboard hands Send now the campaigns client for the catalog", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(join(__dirname, "GreetingAutomationCampaigns.jsx"), "utf8");
  assert.match(src, /<SendNowFlow\s+orgId=\{effectiveOrgId\} contacts=\{managedContacts \|\| contacts\} client=\{oneTimeClient\} catalogClient=\{client\}/);
});

test("an incomplete or unrecorded charge says the payment is being confirmed, never 'nothing was sent' or 'try again', and keeps the key", async () => {
  for (const code of ["funding_incomplete", "funding_storage_failed"]) {
    const c = fakeClient({ previews: [PREVIEW({ gift: BOX_GIFT() })], send: () => ({ ok: false, error: code }) });
    const s = await mount(flow(c, { catalogClient: catalog() }));
    await toWhat(s); await pickBox(s, "gb-1"); await review(s);
    await click(s.tid("sendnow-confirm"));
    const text = s.tid("sendnow-payment-uncertain").textContent;
    assert.equal(text, "We’re confirming your payment. Don’t submit another payment yet.", code);
    assert.doesNotMatch(s.tid("sendnow-review").textContent, /Nothing was sent|try again|press the button again/i, code);
    await click(s.tid("sendnow-confirm"));
    assert.equal(c.calls.send[0][1].idempotencyKey, c.calls.send[1][1].idempotencyKey, `${code}: the same review keeps its key`);
  }
});

test("the three refusals of a second payment attempt each say what is true", async () => {
  const cases = [
    ["replacement_card_required", /already tried for this send and won.t be charged again.*shows a charge.*don.t add a different card.*contact support.*shows no charge, add a different card/],
    ["prior_attempt_may_still_complete", /bank is still processing the earlier payment.*Don.t submit another payment yet\./],
    ["prior_attempt_state_unknown", /can.t yet confirm whether the earlier payment.*went through\. Don.t submit another payment yet\./],
  ];
  for (const [code, re] of cases) {
    const c = fakeClient({ previews: [PREVIEW({ gift: BOX_GIFT() })], send: () => ({ ok: false, error: code }) });
    const s = await mount(flow(c, { catalogClient: catalog() }));
    await toWhat(s); await pickBox(s, "gb-1"); await review(s);
    await click(s.tid("sendnow-confirm"));
    assert.match(s.tid("sendnow-error").textContent, re, code);
  }
});

test("checkboxes sit beside their labels in a 44px row (the global input width rule is overridden)", async () => {
  const blocked = [{ contactId: "c2", name: "Marcus Hall", reason: "missing_recipient_address", field: "address", message: "no mailing address" }];
  const c = fakeClient({ previews: [PREVIEW({ gift: BOX_GIFT({ totalCents: 6173, perRecipient: { c1: { totalCents: 6173 } } }), recipients: { selector: { category: "client" }, count: 1, selected: 2, list: [{ contactId: "c1", name: "Dana Lee" }], blocked } })] });
  const s = await mount(flow(c, { catalogClient: catalog() }));
  const check = (el) => {
    assert.equal(el.style.width, "auto");
    assert.equal(el.parentElement.style.display, "flex");
    assert.equal(el.parentElement.style.minHeight, "44px");
  };
  await toWhat(s); await pickBox(s, "gb-2", ["Small"]);
  s.qa('[data-testid="sendnow-giftbox-variants"] input').forEach(check);
  check(s.tid("sendnow-exclude-spread"));
  await review(s);
  check(s.tid("sendnow-skip-notready"));
});

test("source: every Send now checkbox uses the shared row and box styles", async () => {
  const { readFileSync } = await import("node:fs");
  const src = readFileSync(join(__dirname, "SendNowFlow.jsx"), "utf8");
  assert.equal((src.match(/<input type="checkbox"/g) || []).length, 3);
  assert.equal((src.match(/<input type="checkbox" style=\{CHECK_BOX\}/g) || []).length, 3);
});
