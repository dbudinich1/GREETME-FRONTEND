// SURFACE 8 - BROWSER-LEVEL proof of "Send a Greet-Me now": the real SendNowFlow (and the real dashboard's owner gate)
// bundled and mounted in jsdom with INJECTED fake clients (no network).
// Run (Node 20.x): node --test src/components/corporateCampaign/sendNowFlow.browser.test.mjs
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
const ENTRY = join(__dirname, `.__snf.${process.pid}.entry.jsx`);
const BUNDLE = join(__dirname, `.__snf.${process.pid}.bundle.mjs`);

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
const flow = (client, props = {}) => React.createElement(SendNowFlow, { orgId: "org1", contacts: CONTACTS, client, ...props });
async function toReview(s, { gift = "none", occasion = "birthday" } = {}) {
  await click(s.tid("sendnow-open"));
  await click(s.tid("sendnow-next-1"));
  if (gift !== "none") await click(s.host.querySelector(`#sendnow-gift-${gift}`));
  await click(s.tid("sendnow-next-2"));
  if (occasion) await choose(s.tid("sendnow-occasion"), occasion);
}

test("steps: who (category or one person), what (gift, Exclude Featured Spread), review - and QR Cash is not selectable", async () => {
  const s = await mount(flow(fakeClient()));
  await click(s.tid("sendnow-open"));
  assert.equal(s.tid("sendnow-count").textContent.includes("2"), true, "the default category (Clients) has 2 people");
  await click(s.tid("sendnow-who-single"));
  assert.equal(s.tid("sendnow-next-1").disabled, true, "a single person must be chosen first");
  await choose(s.tid("sendnow-contact"), "e1");
  assert.equal(s.tid("sendnow-next-1").disabled, false);
  await click(s.tid("sendnow-next-1"));
  assert.ok(s.tid("sendnow-what"));
  assert.equal(s.host.querySelector("#sendnow-gift-qrcash").disabled, true, "inactive QR Cash is not selectable");
  assert.equal(s.host.querySelector("#sendnow-gift-marketplace"), null, "no Greet-Me Gifts class");
  assert.ok(s.tid("sendnow-exclude-spread"), "the owner option exists");
  assert.equal(s.qa("input[type=radio][value='gift_boxes']").length, 0, "no all-gifts browser here");
});

test("review: the server's own answer, once and unscheduled, from the owner's photo and voice, with a FINAL button and no cancel", async () => {
  const c = fakeClient(); const s = await mount(flow(c));
  await toReview(s);
  assert.deepEqual(c.calls.preview[0][1], { recipients: { category: "client" }, occasionType: "birthday", gift: null, excludeFeaturedSpread: false, skipNotReady: false });
  assert.match(s.tid("sendnow-review-to").textContent, /2 people: Dana Lee, Marcus Hall/);
  assert.match(s.tid("sendnow-review-when").textContent, /Once, right after you confirm\. No schedule and no repeat\./);
  assert.match(s.tid("sendnow-review-sender").textContent, /^Jane Smith, Fixture Co\., with your own photo and voice/);
  assert.equal(s.tid("sendnow-review-spread").textContent, "Included");
  assert.match(s.tid("sendnow-plan").textContent, /uses 2 Greet-Mes from your plan \(one per person\)\. You have 10\./);
  assert.equal(s.tid("sendnow-confirm").textContent, "Send now — this is final");
  assert.match(s.tid("sendnow-final-note").textContent, /cannot be cancelled/);
  assert.doesNotMatch(s.tid("sendnow-review").textContent, /approve|lock|schedule it|recall/i);
  assert.equal(s.tid("sendnow-nopay").textContent.includes("Nothing to pay"), true);
});

test("Exclude Featured Spread is carried to the server and shown on the review", async () => {
  const c = fakeClient({ previews: [PREVIEW({ featuredSpread: { included: false } })] }); const s = await mount(flow(c));
  await click(s.tid("sendnow-open")); await click(s.tid("sendnow-next-1"));
  await click(s.tid("sendnow-exclude-spread")); await click(s.tid("sendnow-next-2"));
  await choose(s.tid("sendnow-occasion"), "christmas");
  assert.equal(c.calls.preview[0][1].excludeFeaturedSpread, true);
  assert.equal(s.tid("sendnow-review-spread").textContent, "Excluded");
});

test("a short plan: 'you are N short', top-up and upgrade links, the button is disabled and NOTHING is sent", async () => {
  const c = fakeClient({ previews: [PREVIEW({ plan: { required: 5, available: 3, shortfall: 2, planTier: "small_business", sufficient: false, links: LINKS }, canSend: false, blockers: ["plan_shortfall"] })] });
  const s = await mount(flow(c));
  await toReview(s);
  assert.equal(s.tid("sendnow-plan").dataset.short, "yes");
  assert.match(s.tid("sendnow-plan").textContent, /You are 2 short, so nothing will be sent\./);
  assert.equal(s.tid("sendnow-topup").getAttribute("href"), "#/dashboard/animations?openPacks=true");
  assert.equal(s.tid("sendnow-upgrade").getAttribute("href"), "#/pricing?view=business");
  assert.equal(s.tid("sendnow-confirm").disabled, true);
  await click(s.tid("sendnow-confirm"));
  assert.equal(c.calls.send.length, 0, "nothing was sent");
});

test("confirming sends exactly what was reviewed, once, under one idempotency key; a same-tick double press sends ONE", async () => {
  const c = fakeClient(); const s = await mount(flow(c));
  await toReview(s);
  await act(async () => { const b = s.tid("sendnow-confirm"); b.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); b.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); });
  await flush();
  assert.equal(c.calls.send.length, 1, "one request");
  const body = c.calls.send[0][1];
  assert.equal(body.expectedRecipientCount, 2);
  assert.match(body.idempotencyKey, /^onetime-/);
  assert.deepEqual(body.recipients, { category: "client" });
  assert.ok(s.tid("sendnow-sent"));
  assert.match(s.tid("sendnow-sent").textContent, /Sent to 2 people/);
});

test("a paid gift shows the quoted total and that it is charged to the saved card at the moment of sending; that exact total is sent", async () => {
  const paid = PREVIEW({ gift: { type: "gift_boxes", requiresPayment: true, totalCents: 10950, cardOnFile: true, maxSpendCents: 5000, currency: "usd" } });
  const c = fakeClient({ previews: [paid] }); const s = await mount(flow(c));
  await toReview(s);
  assert.match(s.tid("sendnow-total").textContent, /\$109\.50 will be charged to your saved card at the moment of sending\./);
  await click(s.tid("sendnow-confirm"));
  assert.equal(c.calls.send[0][1].expectedTotalCents, 10950);
});

test("people who are not ready are named; 'Send to the ready ones only' asks the server again with skipNotReady", async () => {
  const blocked = PREVIEW({
    recipients: { selector: { category: "client" }, count: 1, selected: 2, list: [{ contactId: "c1", name: "Dana Lee" }], blocked: [{ contactId: "c2", name: "Marcus Hall", reason: "missing_recipient_email", field: "email" }] },
    canSend: false, blockers: ["recipients_not_ready"],
  });
  const skipped = PREVIEW({ recipients: { selector: { category: "client" }, count: 1, selected: 2, list: [{ contactId: "c1", name: "Dana Lee" }], blocked: [{ contactId: "c2", name: "Marcus Hall", reason: "missing_recipient_email" }] }, canSend: true, blockers: [] });
  const c = fakeClient({ previews: [(b) => ({ ok: true, preview: b.skipNotReady ? skipped : blocked })] }); const s = await mount(flow(c));
  await toReview(s);
  assert.match(s.tid("sendnow-notready").textContent, /Marcus Hall \(no email address\)/);
  assert.equal(s.tid("sendnow-confirm").disabled, true);
  await click(s.tid("sendnow-skip-notready"));
  assert.equal(c.calls.preview.at(-1)[1].skipNotReady, true);
  assert.equal(s.tid("sendnow-confirm").disabled, false);
});

test("a lost response is 'unsure', and pressing again reuses the SAME key so it cannot send twice", async () => {
  const c = fakeClient({ send: (body, n) => (n === 1 ? { ok: false, indeterminate: true } : { ok: true, replay: true, result: { sendId: "s1", recipientCount: 2, chargedTotalCents: 0 } }) });
  const s = await mount(flow(c));
  await toReview(s);
  await click(s.tid("sendnow-confirm"));
  assert.ok(s.tid("sendnow-unsure"));
  await click(s.tid("sendnow-confirm"));
  assert.equal(c.calls.send.length, 2);
  assert.equal(c.calls.send[1][1].idempotencyKey, c.calls.send[0][1].idempotencyKey);
  assert.match(s.tid("sendnow-sent").textContent, /nothing was sent twice/);
});

test("a server-side shortfall at send time is shown as 'you are N short' and the review refreshes", async () => {
  const c = fakeClient({ send: () => ({ ok: false, status: 409, error: "plan_shortfall", details: { required: 2, available: 1, shortfall: 1, links: LINKS } }) });
  const s = await mount(flow(c));
  await toReview(s);
  await click(s.tid("sendnow-confirm"));
  assert.match(s.tid("sendnow-short").textContent, /You are 1 short, so nothing was sent\./);
  assert.ok(c.calls.preview.length >= 2, "the review was refreshed");
});

test("if the quote changed after the review, nothing is charged, the message says so and a fresh review (and key) is needed", async () => {
  const c = fakeClient({ send: () => ({ ok: false, status: 409, error: "quote_changed", details: { expectedTotalCents: 100, currentTotalCents: 200 } }) });
  const s = await mount(flow(c));
  await toReview(s);
  await click(s.tid("sendnow-confirm"));
  assert.match(s.tid("sendnow-error").textContent, /price changed since you reviewed\. Nothing was charged/);
  assert.ok(c.calls.preview.length >= 2, "the review was refreshed");
});

test("a declined card says nothing was sent", async () => {
  const c = fakeClient({ send: () => ({ ok: false, status: 402, error: "funding_declined" }) });
  const s = await mount(flow(c));
  await toReview(s);
  await click(s.tid("sendnow-confirm"));
  assert.match(s.tid("sendnow-error").textContent, /card was declined\. Nothing was sent\./);
});

test("not switched on / not available yet: the review says so instead of offering a send", async () => {
  const c = { preview: async () => ({ ok: false, dormant: true }), send: async () => { throw new Error("must not send"); } };
  const s = await mount(flow(c));
  await toReview(s);
  assert.match(s.tid("sendnow-review-error").textContent, /isn’t switched on/);
  assert.equal(s.tid("sendnow-confirm").disabled, true);
});

test("owner only: the dashboard shows the entry to the owner and hides it from anyone else", async () => {
  const mk = (isOwner) => ({
    listMemberships: async () => ({ ok: true, data: { memberships: [{ corporateOrganizationId: "org1", role: isOwner ? "owner" : "member", status: "active" }] } }),
    listCampaigns: async () => ({ ok: true, data: { campaigns: [], viewerAuthorization: { isCurrentOrganizationOwner: isOwner } } }),
    listOrgContacts: async () => ({ ok: true, data: { contacts: CONTACTS } }),
    readAudience: async () => ({ ok: true, data: {} }),
  });
  const one = fakeClient();
  const owner = await mount(React.createElement(Dashboard, { client: mk(true), oneTimeClient: one, navigate: () => {} }));
  assert.ok(owner.tid("sendnow-panel"), "the owner sees it");
  const other = await mount(React.createElement(Dashboard, { client: mk(false), oneTimeClient: one, navigate: () => {} }));
  assert.equal(other.tid("sendnow-panel"), null, "a non-owner does not");
});

test("the occasion is required: no review is requested until one is chosen, and it is sent with the preview and the send", async () => {
  const c = fakeClient(); const s = await mount(flow(c));
  await toReview(s, { occasion: null });
  assert.equal(c.calls.preview.length, 0, "no preview without an occasion");
  assert.ok(s.tid("sendnow-need-occasion"));
  assert.equal(s.tid("sendnow-confirm").disabled, true);
  assert.equal(s.tid("sendnow-occasion").querySelectorAll("option").length, 18, "17 occasions plus the prompt");
  await choose(s.tid("sendnow-occasion"), "graduation");
  assert.equal(c.calls.preview[0][1].occasionType, "graduation");
  await click(s.tid("sendnow-confirm"));
  assert.equal(c.calls.send[0][1].occasionType, "graduation");
});

test("needs_owner_name blocks the review with a plain message", async () => {
  const c = fakeClient({ previews: [PREVIEW({ canSend: false, blockers: ["needs_owner_name"], sender: { senderName: null, photoReady: true, voiceReady: true, blocker: "needs_owner_name" } })] });
  const s = await mount(flow(c));
  await toReview(s);
  assert.match(s.tid("sendnow-blockers").textContent, /Add your name to your profile first/);
  assert.equal(s.tid("sendnow-confirm").disabled, true);
});

test("a server-side recipients_not_ready names who is missing and points to the explicit opt-in; nothing sent", async () => {
  const c = fakeClient({ send: () => ({ ok: false, status: 409, error: "recipients_not_ready", details: { blocked: [{ contactId: "c2", name: "Marcus Hall", reason: "missing_recipient_email" }] } }) });
  const s = await mount(flow(c));
  await toReview(s);
  await click(s.tid("sendnow-confirm"));
  assert.match(s.tid("sendnow-notready-refused").textContent, /Marcus Hall: no email address/);
  assert.match(s.tid("sendnow-notready-refused").textContent, /Send to the ready ones only/);
  assert.equal(c.calls.send.length, 1);
  assert.ok(c.calls.preview.length >= 2);
});

test("a paid review shows only the returned total, with no fee wording", async () => {
  const c = fakeClient({ previews: [PREVIEW({ gift: { type: "curated", maxSpendCents: 5000, requiresPayment: true, totalCents: 10950, perRecipient: { c1: { totalCents: 5475 }, c2: { totalCents: 5475 } }, currency: "usd", cardOnFile: true } })] });
  const s = await mount(flow(c));
  await toReview(s, { gift: "curated" });
  assert.doesNotMatch(s.tid("sendnow-review").textContent, /fee|markup|service charge/i);
  await click(s.tid("sendnow-confirm"));
  assert.equal(c.calls.send[0][1].expectedTotalCents, 10950);
});
