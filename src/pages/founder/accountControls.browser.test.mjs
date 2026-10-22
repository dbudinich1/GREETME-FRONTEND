// src/pages/founder/accountControls.browser.test.mjs
//
// Founder salesperson management (2026-10-21): Active | Inactive views with search, Deactivate/Reactivate confirmations,
// and the Sending and recipients panel (effective access, one-time grant, unlimited on/off, recipient limit, audit).
// The real page, bundled and mounted in jsdom with an injected client. Run (Node 20.x): node --test <this file>
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readdirSync, rmSync as rm2 } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
process.on("exit", () => { try { for (const n of readdirSync(__dirname)) if (n.startsWith(".__") && n.includes(`.${process.pid}.`)) rm2(join(__dirname, n), { force: true }); } catch { /* ignore */ } });
const BUNDLE = join(__dirname, `.__acc.${process.pid}.bundle.mjs`);
const ENTRY = join(__dirname, `.__acc.${process.pid}.entry.jsx`);
let React, createRoot, act, Page, window;

before(async () => {
  writeFileSync(ENTRY, `export { default as Page } from "./SalespersonControlCenter.jsx";\n`);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  try { globalThis.navigator = window.navigator; } catch { /* read-only on Node 21+ */ }
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event; globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Page } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const FOUNDER = { userId: "u1", plan: "founder" };
const PEOPLE = [
  { salespersonId: "amir-yates", displayName: "Amir Yates", email: "amir@example.com", status: "active", linkedUserId: "u-amir" },
  { salespersonId: "sp-jesse", displayName: "Jesse", email: "jesse@example.com", status: "active", linkedUserId: "u-jesse" },
  { salespersonId: "sp-old", displayName: "Old Rep", email: "old@example.com", status: "inactive", linkedUserId: null },
];
const VIEW = (over = {}) => ({
  ok: true,
  account: { userId: "u-amir", name: "Amir Yates", email: "amir@example.com" },
  access: { canSend: true, reasonCode: "OK", remaining: 50, used: 0, limit: 50, period: "trial", trialActive: true },
  controls: { unlimitedSending: false, bonusGreetings: 45, recipientLimitOverride: null, effectiveRecipientLimit: 3, planRecipientLimit: 3, tier: "free", greetingsPeriod: "trial" },
  recipients: { count: 3, limit: 3, planLimit: 3, override: null },
  grants: [{ id: "founder-grant-amir-50-2026-10-20", sends: 50, kind: "one-time", grantedAt: "2026-10-21T03:29:00Z" }],
  grantAvailable: true, exemptions: [],
  ...over,
});

function api(over = {}) {
  const calls = [];
  const ok = (data) => ({ ok: true, status: 200, data });
  const base = {
    list: async () => { calls.push(["list"]); return ok({ ok: true, salespeople: PEOPLE }); },
    read: async (id) => { calls.push(["read", id]); return ok({ ok: true, salesperson: PEOPLE.find((p) => p.salespersonId === id) }); },
    setStatus: async (id, status) => { calls.push(["setStatus", id, status]); return ok({ ok: true, salesperson: { ...PEOPLE.find((p) => p.salespersonId === id), status } }); },
    accountControls: async (id) => { calls.push(["accountControls", id]); return ok(VIEW()); },
    accountAudit: async (id) => { calls.push(["accountAudit", id]); return ok({ ok: true, changes: [] }); },
    grantSends: async (id, sends, changeId) => { calls.push(["grantSends", id, sends, changeId]); return ok({ ...VIEW({ access: { ...VIEW().access, remaining: 60, limit: 60 } }), applied: true, duplicate: false }); },
    setUnlimitedSending: async (id, enabled, changeId) => { calls.push(["setUnlimitedSending", id, enabled, changeId]); return ok({ ...VIEW({ controls: { ...VIEW().controls, unlimitedSending: enabled }, grantAvailable: !enabled }), applied: true }); },
    setRecipientLimit: async (id, limit, changeId) => { calls.push(["setRecipientLimit", id, limit, changeId]); return ok({ ...VIEW({ recipients: { count: 3, limit: limit === "unlimited" ? null : limit ?? 3, planLimit: 3, override: limit } }), applied: true }); },
  };
  return { ...base, ...over, calls };
}

let root;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function mount(a) {
  if (root) await act(async () => { root.unmount(); }); // a real page change unmounts; effects (e.g. the scroll lock) clean up
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Page, { api: a, user: FOUNDER })); });
  await flush();
}
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
// Checkboxes and radios toggle only on a real click(); buttons take the same path.
const click = async (el) => { await act(async () => { el.click(); }); await flush(); };
const setVal = async (el, v) => {
  const proto = el.tagName === "TEXTAREA" ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  await act(async () => { el.dispatchEvent(new window.Event("input", { bubbles: true })); }); await flush();
};
const writes = (a) => a.calls.filter((c) => ["grantSends", "setUnlimitedSending", "setRecipientLimit", "setStatus"].includes(c[0]));

// ══ Active | Inactive views ═════════════════════════════════════════════════════════════════════
test("list defaults to Active with counts; Inactive shows the inactive salesperson; search works within the view", async () => {
  const a = api(); await mount(a);
  assert.equal(tid("fcc-view-active").getAttribute("aria-selected"), "true");
  assert.match(tid("fcc-view-active").textContent, /Active \(2\)/);
  assert.match(tid("fcc-view-inactive").textContent, /Inactive \(1\)/);
  assert.ok(tid("fcc-row-amir-yates")); assert.ok(tid("fcc-row-sp-jesse")); assert.equal(tid("fcc-row-sp-old"), null);
  await setVal(tid("fcc-search"), "jesse@");
  assert.equal(tid("fcc-row-amir-yates"), null); assert.ok(tid("fcc-row-sp-jesse"), "search matches email");
  await setVal(tid("fcc-search"), "old");
  assert.match(tid("fcc-view-empty").textContent, /No active salespeople match “old”/, "an inactive match is not shown in Active");
  await click(tid("fcc-view-inactive"));
  assert.ok(tid("fcc-row-sp-old"));
  await setVal(tid("fcc-search"), "");
  assert.equal(tid("fcc-row-amir-yates"), null);
  assert.equal(writes(a).length, 0);
});

test("Deactivate needs confirmation, lists the verified effects, cancel writes nothing; Reactivate likewise", async () => {
  const a = api(); await mount(a);
  await click(tid("fcc-row-amir-yates"));
  assert.equal(tid("fcc-disable").textContent.trim(), "Deactivate");
  await click(tid("fcc-disable"));
  const body = tid("fcc-confirm-body").textContent;
  for (const re of [/referral links stop working/i, /not added later if you reactivate/i, /referrer’s override/i, /amounts owed \(still payable\)/i, /sending allowance are not changed/i]) assert.match(body, re);
  await click(tid("fcc-confirm-cancel"));
  assert.equal(writes(a).length, 0);
  await click(tid("fcc-disable")); await click(tid("fcc-confirm-go"));
  assert.deepEqual(a.calls.find((c) => c[0] === "setStatus"), ["setStatus", "amir-yates", "inactive"]);
  assert.equal(writes(a).filter((c) => c[0] !== "setStatus").length, 0, "deactivation never touches the account's sending");
  assert.ok(tid("fcc-reactivate"));
  await click(tid("fcc-reactivate"));
  assert.match(tid("fcc-confirm-body").textContent, /Nothing is added for the time they were inactive/);
});

// ══ Sending and recipients panel ═══════════════════════════════════════════════════════════════
async function openAmir(a) { await mount(a); await click(tid("fcc-row-amir-yates")); }

test("panel shows the linked name/email, effective access, remaining, grants and recipient use; summary in the closed row", async () => {
  const a = api(); await openAmir(a);
  assert.match(tid("fcc-section-access-summary").textContent, /Can send · 50 of 50 left · recipients 3 of 3/);
  assert.match(tid("acc-account").textContent, /Amir Yates.*amir@example\.com/);
  assert.equal(tid("acc-access-pill").textContent, "Can send");
  assert.match(tid("acc-access-remaining").textContent, /50 of 50 sends left/);
  assert.match(tid("acc-grants").textContent, /50 sends, one-time, 2026-10-21/);
  assert.match(tid("acc-recipients-current").textContent, /3 recipients of 3 \(plan limit\)/);
  // Founder 2026-10-21 final adjustments: no explanatory text under Unlimited sending or Grant sends; the controls stay.
  assert.equal(tid("acc-exemptions"), null);
  assert.equal(/also removes|Still applies|Adds a fixed number/.test(tid("fcc-access").textContent), false);
  assert.ok(tid("acc-unlimited-toggle")); assert.ok(tid("acc-unlimited-save"));
  assert.match(tid("acc-grant").textContent, /Grant sends \(one-time\)/);
});

test("grant: confirmation states the new remaining; one changeId; a failed confirm retries with the SAME changeId", async () => {
  let fail = true;
  const a = api({});
  const ok = a.grantSends;
  a.grantSends = async (...args) => { if (fail) { fail = false; a.calls.push(["grantSends", ...args]); return { ok: false, status: 0, networkError: true, data: null }; } return ok(...args); };
  await openAmir(a);
  assert.equal(tid("acc-grant-submit").disabled, true);
  await setVal(tid("acc-grant-input"), "10");
  await click(tid("acc-grant-submit"));
  assert.match(tid("acc-confirm-body").textContent, /Remaining becomes 60\. This allowance does not refill\./);
  assert.equal(writes(a).length, 0, "nothing before confirmation");
  await click(tid("acc-confirm-go"));
  assert.match(tid("acc-confirm-error").textContent, /Nothing is applied twice/);
  assert.equal(tid("acc-confirm-go").textContent, "Try again");
  await click(tid("acc-confirm-go"));
  const grants = a.calls.filter((c) => c[0] === "grantSends");
  assert.equal(grants.length, 2); assert.equal(grants[0][3], grants[1][3], "the retry reuses the first change id");
  assert.deepEqual(grants[1].slice(1, 3), ["amir-yates", 10]);
  assert.equal(tid("acc-confirm"), null);
  assert.match(tid("acc-notice").textContent, /Saved/);
  assert.match(tid("acc-access-remaining").textContent, /60 of 60/);
});

test("grant input validation and the server's duplicate answer", async () => {
  const a = api({ grantSends: async (id, s, c) => ({ ok: true, status: 200, data: { ...VIEW(), applied: false, duplicate: true } }) });
  await openAmir(a);
  await setVal(tid("acc-grant-input"), "1001");
  assert.ok(tid("acc-grant-invalid")); assert.equal(tid("acc-grant-submit").disabled, true);
  await setVal(tid("acc-grant-input"), "5");
  await click(tid("acc-grant-submit")); await click(tid("acc-confirm-go"));
  assert.match(tid("acc-notice").textContent, /Already applied/);
});

test("grant is unavailable (with the reason) on a monthly plan and while unlimited is on", async () => {
  await openAmir(api({ accountControls: async () => ({ ok: true, status: 200, data: VIEW({ grantAvailable: false, controls: { ...VIEW().controls, greetingsPeriod: "month", tier: "pro" } }) }) }));
  assert.match(tid("acc-grant-unavailable").textContent, /free-trial accounts only/);
  assert.equal(tid("acc-grant-input"), null);
  await openAmir(api({ accountControls: async () => ({ ok: true, status: 200, data: VIEW({ grantAvailable: false, controls: { ...VIEW().controls, unlimitedSending: true }, access: { ...VIEW().access, reasonCode: "UNLIMITED_OVERRIDE", remaining: null, limit: null }, recipients: { count: 3, limit: null, planLimit: 3, override: null } }) }) }));
  assert.match(tid("acc-grant-unavailable").textContent, /Not needed while unlimited sending is on/);
  assert.match(tid("acc-access-remaining").textContent, /Unlimited/);
  assert.match(tid("acc-recipients-current").textContent, /removed by unlimited sending/);
});

test("unlimited on/off goes through confirmation with its own wording", async () => {
  const a = api(); await openAmir(a);
  assert.equal(tid("acc-unlimited-save").disabled, true, "unchanged → nothing to save");
  await click(tid("acc-unlimited-toggle"));
  await click(tid("acc-unlimited-save"));
  assert.match(tid("acc-confirm-body").textContent, /recipient limit and the per-account daily AI limit stop applying/);
  await click(tid("acc-confirm-go"));
  const c = a.calls.find((x) => x[0] === "setUnlimitedSending");
  assert.deepEqual(c.slice(1, 3), ["amir-yates", true]); assert.match(c[3], /^[A-Za-z0-9_-]{8,64}$/);
});

test("recipient limit: custom number, no limit, back to plan; invalid input refused before any request", async () => {
  const a = api(); await openAmir(a);
  assert.equal(tid("acc-limit-save").disabled, true);
  await click(tid("acc-limit-number"));
  await setVal(tid("acc-limit-input"), "");
  assert.equal(tid("acc-limit-save").disabled, true); assert.ok(tid("acc-limit-invalid"));
  await setVal(tid("acc-limit-input"), "10");
  await click(tid("acc-limit-save"));
  assert.match(tid("acc-confirm-body").textContent, /Limit 10\. Contacts are never deleted/);
  await click(tid("acc-confirm-go"));
  assert.deepEqual(a.calls.find((x) => x[0] === "setRecipientLimit").slice(1, 3), ["amir-yates", 10]);
  await click(tid("acc-limit-plan")); await click(tid("acc-limit-save"));
  assert.match(tid("acc-confirm-body").textContent, /Back to the plan limit \(3\)/);
  await click(tid("acc-confirm-go"));
  assert.deepEqual(a.calls.filter((x) => x[0] === "setRecipientLimit")[1].slice(1, 3), ["amir-yates", null]);
});

test("server refusal is shown in plain words inside the dialog; the value on screen is unchanged", async () => {
  const a = api({ setRecipientLimit: async () => ({ ok: false, status: 409, data: { ok: false, code: "ACCOUNT_CHANGED" } }) });
  await openAmir(a);
  await click(tid("acc-limit-unlimited")); await click(tid("acc-limit-save")); await click(tid("acc-confirm-go"));
  assert.match(tid("acc-confirm-error").textContent, /account changed while saving/);
  assert.equal(/ACCOUNT_CHANGED/.test(document.body.textContent), false, "no machine code shown");
  await click(tid("acc-confirm-cancel"));
  assert.match(tid("acc-recipients-current").textContent, /of 3 \(plan limit\)/);
});

test("unlinked salesperson: no account request, plain message; load failure: message and Try again", async () => {
  const a = api();
  await mount(a); await click(tid("fcc-view-inactive")); await click(tid("fcc-row-sp-old"));
  assert.match(tid("acc-unlinked").textContent, /No Greet-Me account is linked/);
  assert.equal(a.calls.some((c) => c[0] === "accountControls"), false);
  let n = 0;
  const b = api({ accountControls: async () => (++n === 1 ? { ok: false, status: 500, data: null } : { ok: true, status: 200, data: VIEW() }) });
  await openAmir(b);
  assert.ok(tid("acc-load-error"));
  await click(tid("acc-load-error").querySelector("button"));
  assert.ok(tid("acc-access"));
});

test("audit rows read in plain words with before → after", async () => {
  const a = api({ accountAudit: async () => ({ ok: true, status: 200, data: { ok: true, changes: [
    { id: "x1", kind: "recipient_limit", at: "2026-10-21T16:00:00Z", actorId: "founder-abc123", before: { recipientLimitOverride: null, planRecipientLimit: 3 }, after: { recipientLimitOverride: 10, planRecipientLimit: 3 } },
    { id: "x2", kind: "grant", at: "2026-10-21T15:00:00Z", actorId: "founder-abc123", before: { bonusGreetings: 45 }, after: { bonusGreetings: 55 }, result: { sends: 10 } },
  ] } }) });
  await openAmir(a);
  const rows = [...document.querySelectorAll('[data-testid="acc-audit-row"]')].map((r) => r.textContent);
  assert.match(rows[0], /Oct 21, 2026.*Recipient limit plan \(3\) → 10 · by founder account …abc123/);
  assert.match(rows[1], /Granted 10 one-time sends \(one-time sends total 45 → 55\)/);
});

// ══ Founder 2026-10-21: details open in a closable pop-up; the list scrolls inside a fixed-height card ════════════
test("selected salesperson opens in a pop-up that closes with ×, Escape and a click outside", async () => {
  const a = api(); await mount(a);
  assert.equal(tid("fcc-detail-modal"), null, "nothing open until a salesperson is chosen");
  assert.ok(tid("fcc-list-scroll"), "rows sit in their own scrolling list");
  assert.equal(tid("fcc-list-scroll").style.overflowY, "auto");
  await click(tid("fcc-row-amir-yates"));
  const modal = tid("fcc-detail-modal");
  assert.ok(modal); assert.equal(modal.getAttribute("role"), "dialog");
  assert.ok(modal.contains(tid("fcc-detail")), "the details are inside the pop-up");
  assert.match(tid("fcc-detail").querySelector("h2").textContent, /Amir Yates/);
  assert.equal(document.body.style.overflow, "hidden", "the page behind does not scroll");
  await click(tid("fcc-detail-close"));
  assert.equal(tid("fcc-detail-modal"), null, "× closes");
  assert.equal(document.body.style.overflow, "");
  await click(tid("fcc-row-amir-yates"));
  await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" })); }); await flush();
  assert.equal(tid("fcc-detail-modal"), null, "Escape closes");
  await click(tid("fcc-row-amir-yates"));
  await act(async () => { tid("fcc-detail-modal").dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })); }); await flush();
  assert.equal(tid("fcc-detail-modal"), null, "a click outside closes");
  assert.equal(writes(a).length, 0, "closing saves nothing");
});

const esc = async () => { await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true })); }); await flush(); await act(async () => { await new Promise((r) => setTimeout(r, 5)); }); };

test("Escape layering: Escape cancels ONLY the open confirmation (nothing confirmed), the pop-up stays; Escape again closes it", async () => {
  const a = api(); await mount(a);
  await click(tid("fcc-row-amir-yates"));
  await click(tid("fcc-disable"));
  assert.ok(tid("fcc-confirm"));
  await esc();
  assert.equal(tid("fcc-confirm"), null, "the confirmation is cancelled");
  assert.ok(tid("fcc-detail-modal"), "the pop-up stays");
  assert.equal(writes(a).length, 0, "the confirmed action never ran");
  assert.ok(tid("fcc-detail-modal").contains(document.activeElement), "focus is back inside the pop-up");
  await esc();
  assert.equal(tid("fcc-detail-modal"), null, "with no confirmation open, Escape closes the pop-up");
});

test("Escape layering for the Sending and recipients confirmation: grant not made, pop-up stays", async () => {
  const a = api(); await mount(a);
  await click(tid("fcc-row-amir-yates"));
  await setVal(tid("acc-grant-input"), "10");
  await click(tid("acc-grant-submit"));
  assert.ok(tid("acc-confirm"));
  await esc();
  assert.equal(tid("acc-confirm"), null);
  assert.ok(tid("fcc-detail-modal"));
  assert.equal(a.calls.some((c) => c[0] === "grantSends"), false, "no grant was made");
});

test("outside click: ignored while there are unsaved edits, closes when clean; × always closes", async () => {
  const backdrop = async () => { await act(async () => { tid("fcc-detail-modal").dispatchEvent(new window.MouseEvent("mousedown", { bubbles: true })); }); await flush(); };
  const a = api(); await mount(a);
  // Own edit: an unsaved vanity URL.
  await click(tid("fcc-row-amir-yates"));
  await setVal(tid("fcc-slug-input"), "amir-new");
  await backdrop();
  assert.ok(tid("fcc-detail-modal"), "unsaved vanity URL: outside click ignored");
  assert.equal(tid("fcc-slug-input").value, "amir-new", "the edit is kept");
  await click(tid("fcc-detail-close"));
  assert.equal(tid("fcc-detail-modal"), null, "× still closes");
  // Child edit: a typed grant in Sending and recipients.
  await click(tid("fcc-row-amir-yates"));
  await setVal(tid("acc-grant-input"), "5");
  await backdrop();
  assert.ok(tid("fcc-detail-modal"), "unsaved grant entry: outside click ignored");
  await setVal(tid("acc-grant-input"), "");
  await backdrop();
  assert.equal(tid("fcc-detail-modal"), null, "clean again: outside click closes");
  assert.equal(writes(a).length, 0);
});

test("pop-up order: Links, then Commissions, then Sending and recipients; gift sales only inside Commission activity", async () => {
  const a = api({
    summary: async () => ({ ok: true, status: 200, data: { ok: true, summary: { salespersonId: "amir-yates", status: "active" } } }),
    attributionHealth: async () => ({ ok: true, status: 200, data: { ok: true, attributionHealth: {}, controls: {} } }),
    ledger: async () => ({ ok: true, status: 200, data: { ok: true, entries: [] } }),
    giftSales: async () => ({ ok: false, status: 503, data: null }),
  });
  await mount(a); await click(tid("fcc-row-amir-yates"));
  const order = ["fcc-links", "fcc-commissions", "fcc-access"].map((t) => tid(t));
  assert.ok(order.every(Boolean), "all three sections render");
  const follows = (x, y) => Boolean(x.compareDocumentPosition(y) & window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(follows(order[0], order[1]) && follows(order[1], order[2]), "Links → Commissions → Sending and recipients");
  const additions = document.querySelectorAll('[data-testid="cc-profile-additions"]');
  assert.equal(additions.length, 1, "gift sales appear once");
  assert.ok(tid("fcc-commission-activity").contains(additions[0]), "inside Commission activity and attribution");
});

test("Team 5: focus moves into the pop-up, Tab stays inside, focus returns to the row on close", async () => {
  const a = api(); await mount(a);
  const row = tid("fcc-row-amir-yates");
  row.focus();
  await click(row);
  assert.equal(document.activeElement, tid("fcc-detail-close"), "focus starts on ×");
  const modal = tid("fcc-detail-modal");
  const items = [...modal.querySelectorAll("button, [href], input, select, textarea, summary")].filter((el) => !el.disabled);
  items[items.length - 1].focus();
  await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Tab" })); }); await flush();
  assert.ok(modal.contains(document.activeElement), "Tab from the last control stays in the pop-up");
  await click(tid("fcc-detail-close"));
  assert.equal(document.activeElement, tid("fcc-row-amir-yates"), "focus returns to the row");
});

test("Team 5: Escape during the gift-commission confirmation does not close the pop-up", async () => {
  const a = api(); await mount(a); await click(tid("fcc-row-amir-yates"));
  const fake = document.createElement("div"); fake.setAttribute("role", "alertdialog"); fake.setAttribute("data-testid", "cc-giftcomm-confirm");
  tid("fcc-detail").appendChild(fake);
  await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" })); }); await flush();
  assert.ok(tid("fcc-detail-modal"), "the pop-up stays while that confirmation is open");
  fake.remove();
  await act(async () => { window.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape" })); }); await flush();
  assert.equal(tid("fcc-detail-modal"), null, "Escape closes it once the confirmation is gone");
});

test("founder 2026-10-21: the pop-up sits on the page body above the site header, with × pinned and a Close button", async () => {
  const a = api(); await mount(a);
  await click(tid("fcc-row-amir-yates"));
  const modal = tid("fcc-detail-modal");
  assert.equal(modal.parentElement, document.body, "rendered on document.body, outside any page layer");
  assert.ok(Number(modal.style.zIndex) > 60, `above the site header (layers 50-60): ${modal.style.zIndex}`);
  assert.equal(tid("fcc-detail-titlebar").style.position, "sticky", "the title row with × stays visible while scrolling");
  assert.ok(tid("fcc-detail-titlebar").contains(tid("fcc-detail-close")));
  await click(tid("fcc-disable"));
  assert.equal(tid("fcc-confirm").parentElement, document.body);
  assert.ok(Number(tid("fcc-confirm").style.zIndex) > Number(modal.style.zIndex), "the confirmation is above the pop-up");
  await click(tid("fcc-confirm-cancel"));
  await click(tid("fcc-detail-close-bottom"));
  assert.equal(tid("fcc-detail-modal"), null, "the Close button at the bottom closes the pop-up");
  assert.equal(writes(a).length, 0);
});
