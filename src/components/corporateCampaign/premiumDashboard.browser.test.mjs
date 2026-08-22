// src/components/corporateCampaign/premiumDashboard.browser.test.mjs
//
// SLICE D — BROWSER-LEVEL proof of the consolidated dashboard. The real components are
// esbuild-bundled and mounted into jsdom with an INJECTED fake client (no network).
// Run (Node 20.x): node --test src/components/corporateCampaign/premiumDashboard.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__pd.entry.jsx");
const BUNDLE = join(__dirname, ".__pd.bundle.mjs");

let React, createRoot, act, ContactTiles, CampaignCard, IndividualContactPicker, dom;

const CONTACTS = [
  { id: "e1", name: "Ana Employee", corporateContactType: "employee" },
  { id: "e2", name: "Ben Employee", corporateContactType: "employee" },
  { id: "cl1", name: "Cara Client", corporateContactType: "client" },
  { id: "v1", name: "Vic Vendor", corporateContactType: "vendor" },
  { id: "u1", name: "Uma Unclassified", corporateContactType: null },
  { id: "u2", name: "Uri Unclassified", corporateContactType: undefined },
];

const calls = [];
const fakeClient = {
  updateDeliveryConfig: (...a) => { calls.push(["updateDeliveryConfig", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  schedule: (...a) => { calls.push(["schedule", ...a]); return Promise.resolve({ ok: true, data: { created: 1 } }); },
  activate: (...a) => { calls.push(["activate", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  setAudience: (...a) => { calls.push(["setAudience", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  approve: (...a) => { calls.push(["approve", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  lock: (...a) => { calls.push(["lock", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  unlock: (...a) => { calls.push(["unlock", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  setCampaignEnabled: (...a) => { calls.push(["setCampaignEnabled", ...a]); return Promise.resolve({ ok: true, data: {} }); },
  renameCampaign: (...a) => { calls.push(["renameCampaign", ...a]); return Promise.resolve({ ok: true, data: { name: a[2] } }); },
  readCampaign: () => Promise.resolve({ ok: true, data: {} }),
  updateFeaturedSpread: () => Promise.resolve({ ok: true, data: {} }),
  readReadiness: () => Promise.resolve({ ok: true, data: {} }),
};

before(async () => {
  writeFileSync(ENTRY, `
    export { default as ContactTiles } from "./ContactTiles.jsx";
    export { default as CampaignCard } from "./CampaignCard.jsx";
    export { default as IndividualContactPicker } from "./IndividualContactPicker.jsx";
  `);
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", loader: { ".js": "jsx", ".jsx": "jsx", ".css": "empty" },
    external: ["react", "react-dom", "react-dom/client", "react-router-dom"],
  });
  dom = new JSDOM("<!doctype html><html><body><div id='root'></div></body></html>", { url: "https://app.test/" });
  globalThis.window = dom.window; globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement; globalThis.Event = dom.window.Event;
  // Node 20 allows this; Node 21+ makes globalThis.navigator a getter, so assignment must not throw.
  try { globalThis.navigator = dom.window.navigator; } catch { /* already a read-only global */ }
  globalThis.MouseEvent = dom.window.MouseEvent; globalThis.getComputedStyle = dom.window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  const m = await import(pathToFileURL(BUNDLE).href);
  ContactTiles = m.ContactTiles; CampaignCard = m.CampaignCard; IndividualContactPicker = m.IndividualContactPicker;
});
after(() => { for (const f of [ENTRY, BUNDLE]) { try { rmSync(f); } catch { /* already gone */ } } });

async function mount(el) {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  return { host, root, q: (sel) => host.querySelector(sel), qa: (sel) => [...host.querySelectorAll(sel)],
    tid: (t) => host.querySelector(`[data-testid="${t}"]`), text: () => host.textContent };
}
// Set a controlled input the way React observes it, then fire change.
const setValue = async (el, v) => { await act(async () => {
  const proto = el.tagName === "SELECT" ? dom.window.HTMLSelectElement.prototype : dom.window.HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
  el.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
}); };
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); };

const campaign = (over = {}) => ({
  campaignId: "cmp_1", name: "Q4 Client Appreciation", approvalStatus: "draft", lockStatus: "unlocked",
  audienceRefs: [], deliveryConfig: { scheduleMode: null, status: "not_configured" }, ...over,
});

// ══ contact tiles ═══════════════════════════════════════════════════════════════════════════
// ══ SLICE E5 — the information panel ═════════════════════════════════════════════════════════
test("E5: the info control reveals what the campaign will do, and hides it again", async () => {
  const s = await mount(cardEl(
    { audienceRefs: ["e1", "e2"], deliveryConfig: { scheduleMode: "contact_saved_date", occasionType: "birthday" } },
    { isOwner: true },
  ));
  assert.equal(s.tid("card-info-panel-cmp_1"), null, "closed until asked for");

  await click(s.tid("card-info-cmp_1"));
  const panel = s.tid("card-info-panel-cmp_1");
  assert.ok(panel, "the panel opened");
  assert.equal(s.tid("card-info-cmp_1").getAttribute("aria-expanded"), "true");
  assert.match(panel.textContent, /every year/i, "the recurrence question is answered outright");
  assert.match(panel.textContent, /2 contacts/);

  await click(s.tid("card-info-cmp_1"));
  assert.equal(s.tid("card-info-panel-cmp_1"), null, "and closes again");
});

test("E5: the panel describes the DRAFT, so it answers what saving would do", async () => {
  const s = await mount(cardEl({ audienceRefs: [], deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true }));
  await openSel(s, "audience");
  await click(s.tid("card-info-cmp_1"));
  assert.match(s.tid("card-info-who-cmp_1").textContent, /nobody yet/i);

  // Tick a category — nothing is saved, but the summary must already reflect the intent.
  await act(async () => { s.q("#c-cmp_1-aud-employee").click(); });
  assert.match(s.tid("card-info-who-cmp_1").textContent, /2 contacts/, "it tracks the unsaved edit");
});

test("E5: the info control is a fixed circle the global button rule cannot inflate", async () => {
  // src/index.css sets padding on the `button` ELEMENT and a 48px min-height on mobile. A
  // fixed-size icon button has to override that inline or it becomes an oval, then a block.
  const s = await mount(cardEl());
  assert.equal(s.tid("card-info-cmp_1").style.padding, "0px", "padding is neutralised inline");
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf(".gcd-info-btn {"), css.indexOf("}", css.indexOf(".gcd-info-btn {")));
  assert.match(block, /width:\s*26px/);
  assert.match(block, /height:\s*26px/);
});

// ══ SLICE E5 — the seasonal nudge ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════════════
test("E5: an empty date field offers December 15, and applying it does not save", async () => {
  const s = await mount(cardEl({ deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true, todayIso: "2026-08-21" }));
  const apply = s.tid("card-suggest-apply-cmp_1");
  assert.ok(apply, "the nudge is offered while the field is empty");
  assert.match(s.tid("card-suggest-cmp_1").textContent, /christmas and hanukkah/i, "…and says why");

  calls.length = 0;
  await click(apply);
  assert.equal(s.tid("card-when-cmp_1").value, "2026-12-15T09:00", "it fills the field");
  assert.equal(calls.length, 0, "and writes nothing — it is a suggestion, not a save");
  assert.ok(s.tid("card-dirty-cmp_1"), "the change is unsaved like any other");
});

test("E5: the nudge disappears once a date exists, and never overwrites one", async () => {
  const s = await mount(cardEl(
    { deliveryConfig: { scheduleMode: "campaign_date", scheduledForUtc: "2026-11-01T10:00:00.000Z" } },
    { isOwner: true, todayIso: "2026-08-21" },
  ));
  assert.equal(s.tid("card-suggest-cmp_1"), null, "a chosen date is never second-guessed");
});

test("E5: an unconfigured campaign does not look edited just because a date was suggested", async () => {
  // The reason the suggestion is a button rather than a default: pre-filling would light up Save
  // on every campaign the moment it loaded, over a date nobody chose.
  const s = await mount(cardEl({ deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true, todayIso: "2026-08-21" }));
  assert.equal(s.tid("act-save-cmp_1").disabled, true);
  assert.equal(s.tid("card-dirty-cmp_1"), null);
});

// ══ SLICE E5 — three CTAs and the inline roster ═══════════════════════════════════════════════════════════════════════════════════════════
test("E5: every tile offers Manage, Import and Add", async () => {
  const s = await mount(React.createElement(ContactTiles, { contacts: CONTACTS }));
  for (const k of ["employee", "client", "vendor"]) {
    assert.ok(s.tid(`tile-${k}-manage`), `${k} manage`);
    assert.ok(s.tid(`tile-${k}-import`), `${k} import`);
    assert.ok(s.tid(`tile-${k}-add`), `${k} add`);
  }
});

test("E5: Manage opens that category's roster, and only that one", async () => {
  const s = await mount(React.createElement(ContactTiles, { contacts: CONTACTS }));
  assert.equal(s.tid("tile-employee-roster"), null, "closed until asked for");

  await click(s.tid("tile-employee-manage"));
  const roster = s.tid("tile-employee-roster");
  assert.ok(roster, "the roster opened");
  assert.equal(roster.querySelectorAll("li").length, 2, "both employees, and nobody else");
  assert.equal(s.tid("tile-client-roster"), null, "one category at a time");
  assert.equal(s.tid("tile-employee-manage").getAttribute("aria-expanded"), "true");

  await click(s.tid("tile-employee-manage"));
  assert.equal(s.tid("tile-employee-roster"), null, "and it closes again");
});

test("E5: each roster row carries its contact-type tag", async () => {
  const s = await mount(React.createElement(ContactTiles, { contacts: CONTACTS }));
  await click(s.tid("tile-employee-manage"));
  const tags = [...s.tid("tile-employee-roster").querySelectorAll(".gcd-abbr")];
  assert.equal(tags.length, 2);
  for (const t of tags) {
    assert.equal(t.textContent, "EMP");
    // Colour is never the only carrier: the full word travels with the tag.
    assert.equal(t.getAttribute("title"), "Employee");
  }
});

test("E5: an empty category says so rather than showing an empty box", async () => {
  const s = await mount(React.createElement(ContactTiles, { contacts: [{ id: "e1", name: "Ann", corporateContactType: "employee" }] }));
  await click(s.tid("tile-vendor-manage"));
  assert.match(s.tid("tile-vendor-roster").textContent, /nobody in this category yet/i);
});

test("E5: Manage does NOT navigate — the personal contacts page is a different roster", async () => {
  // /dashboard/contacts reads the PERSONAL partition; these contacts live under the organization
  // with contactScope "corporate". Sending a reader there would show them the wrong people.
  const raw = readFileSync(new URL("./GreetingAutomationCampaigns.jsx", import.meta.url), "utf8");
  // Strip comments first: the file EXPLAINS why it does not navigate there, and prose describing
  // the trap must not read as the trap itself.
  const src = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(/onManage=/.test(src), false, "the tile owns this interaction");
  assert.equal(/goTo\([^)]*dashboard\/contacts/.test(src), false, "nothing routes to the personal page");
  assert.equal(/pickerCategory/.test(src), false, "the dead state that made it a no-op is gone");
});

test("D: exactly three contact tiles, counted from the persisted classification", async () => {
  const s = await mount(React.createElement(ContactTiles, { contacts: CONTACTS }));
  assert.equal(s.qa("[data-testid^='tile-'][data-testid$='-count']").length, 3, "three tiles, no fourth");
  assert.equal(s.tid("tile-employee-count").textContent, "2");
  assert.equal(s.tid("tile-client-count").textContent, "1");
  assert.equal(s.tid("tile-vendor-count").textContent, "1");
  // No Unclassified tile exists.
  assert.equal(s.tid("tile-unclassified"), null);
  assert.equal(s.qa(".gcd-tile").length, 3);
});

test("D: the arithmetic is disclosed and the notice names Select Individual Contacts", async () => {
  const s = await mount(React.createElement(ContactTiles, { contacts: CONTACTS }));
  assert.equal(s.tid("contact-totals").textContent, "4 classified · 2 unclassified · 6 total");
  const notice = s.tid("unclassified-notice");
  assert.ok(notice, "the gap is disclosed, never hidden");
  assert.match(notice.textContent, /2 existing contacts are unclassified\. They remain available through Select Individual Contacts\./);
  assert.ok(s.tid("unclassified-select-individual"), "and offers the action that actually exists");
  // No fabricated remedy.
  assert.equal(/fix classification|reclassify|migrate/i.test(notice.textContent), false);
});

test("D: with everything classified, the notice is absent but the totals still show", async () => {
  const s = await mount(React.createElement(ContactTiles, { contacts: CONTACTS.filter((c) => c.corporateContactType) }));
  assert.equal(s.tid("unclassified-notice"), null);
  assert.equal(s.tid("contact-totals").textContent, "4 classified · 0 unclassified · 4 total");
});

test("D: each tile carries Manage and an Add CTA for its own category", async () => {
  const added = [];
  const s = await mount(React.createElement(ContactTiles, { contacts: CONTACTS, onAddCategory: (k) => added.push(k) }));
  for (const k of ["employee", "client", "vendor"]) {
    assert.ok(s.tid(`tile-${k}-manage`), `${k} manage`);
    assert.ok(s.tid(`tile-${k}-add`), `${k} add`);
  }
  assert.equal(s.tid("tile-employee-add").textContent, "Add Employee");
  assert.equal(s.tid("tile-client-add").textContent, "Add Client");
  assert.equal(s.tid("tile-vendor-add").textContent, "Add Vendor");
  await click(s.tid("tile-vendor-add"));
  assert.deepEqual(added, ["vendor"], "opens the existing wizard with THIS category");
});

// ══ campaign card ═══════════════════════════════════════════════════════════════════════════
const cardEl = (over = {}, props = {}) => React.createElement(CampaignCard, {
  campaign: campaign(over), contacts: CONTACTS, orgId: "org1", client: fakeClient,
  isOwner: false, busy: false, onOpenIndividualPicker: () => {}, onAfterMutate: async () => {},
  // SLICE F1 - a tile is COLLAPSED by default now and its configuration lives inside the three
  // selector panels. Existing tests assert that configuration, so the helper mounts EXPANDED;
  // tests specifically about collapsed behaviour pass `expanded: false` explicitly.
  expanded: true, onToggleExpanded: () => {}, ...props,
});

// Open one selector detail panel - audience | gift | spread.
const openSel = async (s, key, id = "cmp_1") => { await click(s.tid(`selector-${key}-cta-${id}`)); };

test("F1: an expanded card always shows the three selectors and the schedule, at EVERY status", async () => {
  // The old contract rendered four stacked sections always. The new one keeps the THREE selector
  // summaries permanently visible and moves their controls into one inline detail panel — so the
  // invariant is now "all three summaries, whatever the state", which is the thing that must not
  // regress.
  const states = [
    {}, { approvalStatus: "approved" }, { approvalStatus: "approved", lockStatus: "locked" },
    { lockStatus: "locked", deliveryConfig: { scheduleMode: "campaign_date", status: "scheduled" } },
    { lockStatus: "locked", deliveryConfig: { scheduleMode: "contact_saved_date", status: "active" } },
  ];
  for (const st of states) {
    const s = await mount(cardEl(st));
    for (const key of ["audience", "gift", "spread"]) {
      assert.ok(s.tid(`selector-${key}-cmp_1`), `${key} summary must be visible — ${JSON.stringify(st)}`);
    }
    assert.ok(s.tid("c-cmp_1-schedule"), "the schedule stays beneath the selectors");
    assert.ok(s.tid("card-status-cmp_1"), "header status");
    assert.ok(s.tid("card-footer-cmp_1"), "actions");
    // The editor's controls are always reachable; the lifecycle set is contextual by design.
    assert.ok(s.tid("act-save-cmp_1"), "Save is always present");
    assert.ok(s.tid("act-cancel-cmp_1"), "Cancel is always present");
  }
});

test("D: gift bubbles — Curated and No gift selectable; QR Cash and Greet-Me Gifts visibly disabled", async () => {
  const s = await mount(cardEl());
  await openSel(s, "gift");
  for (const v of ["none", "curated", "qrcash", "marketplace"]) {
    assert.ok(s.tid(`bubble-c-cmp_1-gift-${v}`), `${v} must be VISIBLE`);
  }
  const input = (v) => s.q(`#c-cmp_1-gift-${v}`);
  assert.equal(input("none").disabled, false);
  assert.equal(input("curated").disabled, false);
  assert.equal(input("qrcash").disabled, true);
  assert.equal(input("marketplace").disabled, true);
  for (const v of ["qrcash", "marketplace"]) {
    assert.equal(s.tid(`bubble-c-cmp_1-gift-${v}-reason`).textContent, "Individual funding required");
  }
  // Truthful wording, and no Gift Card anywhere.
  assert.equal(/unavailable|unsupported|not offered|coming soon/i.test(s.text()), false);
  assert.equal(/gift card/i.test(s.text()), false);
});

test("D: the Curated tier control persists CENTS and is described as private", async () => {
  const s = await mount(cardEl({ deliveryConfig: { scheduleMode: "campaign_date", defaultGift: { type: "curated", maxSpendCents: 5000 } } }));
  await openSel(s, "gift");
  const sel = s.tid("card-tier-cmp_1");
  assert.ok(sel, "the compact detail control appears for Curated");
  assert.deepEqual([...sel.options].map((o) => o.value), ["2500", "5000", "7500", "10000", "15000"]);
  assert.equal(sel.value, "5000");
  assert.match(s.text(), /private to you/i);
  calls.length = 0;

  // SLICE E5 - Save only fires when something changed, so the value is CHANGED and then saved.
  // That proves more than the old version did: the cents the reader picked are the cents sent.
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(sel.constructor.prototype, "value").set;
    setter.call(sel, "7500");
    sel.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  await click(s.tid("act-save-cmp_1"));
  const [, , , body] = calls.find((c) => c[0] === "updateDeliveryConfig");
  assert.deepEqual(body.defaultGift, { type: "curated", maxSpendCents: 7500 });
  assert.equal(JSON.stringify(body).includes('"maxSpend"'), false);
  assert.equal(JSON.stringify(body).includes('"amount"'), false);
});

test("D: bubbles are real checkboxes/radios in circles — not pills", async () => {
  const s = await mount(cardEl());
  // SLICE F1 - one detail panel opens at a time, so each control is checked inside its own.
  await openSel(s, "audience");
  for (const k of ["employee", "client", "vendor"]) assert.equal(s.q(`#c-cmp_1-aud-${k}`).type, "checkbox");
  assert.equal(s.q("#c-cmp_1-mode-campaign_date").type, "radio", "the schedule stays outside the panels");

  await openSel(s, "gift");
  for (const v of ["none", "curated"]) assert.equal(s.q(`#c-cmp_1-gift-${v}`).type, "radio");
  assert.equal(s.q("#c-cmp_1-gift-none").name, s.q("#c-cmp_1-gift-curated").name, "one group = single-select");

  await openSel(s, "spread");
  assert.equal(s.q("#c-cmp_1-spread-organization_default").type, "radio");
  // The visual is a circle, and every control keeps a label + accessible description hook.
  assert.ok(s.qa(".gcd-dot").length >= 3, "circles, not pills");
  for (const el of s.qa(".gcd-bubble input")) {
    assert.ok(s.q(`label[for="${el.id}"]`), `${el.id} must have a label`);
  }
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  assert.match(css, /\.gcd-dot\s*\{[^}]*border-radius:\s*50%/, "circles, not pills");
  assert.match(css, /\.gcd-bubble\s*\{[^}]*min-height:\s*44px/, "accessible hit area");
});

test("D: both schedule modes always render, and autoSend is never exposed", async () => {
  const s = await mount(cardEl());
  assert.ok(s.tid("bubble-c-cmp_1-mode-campaign_date"));
  assert.ok(s.tid("bubble-c-cmp_1-mode-contact_saved_date"));
  assert.ok(s.tid("card-when-cmp_1"), "campaign_date exposes a date/time control");
  assert.ok(s.tid("card-tz-cmp_1"), "and a timezone");
  assert.equal(/autosend|auto-send/i.test(s.text()), false);
});

test("D: the saved-date mode exposes an occasion type and a timezone", async () => {
  const s = await mount(cardEl({ deliveryConfig: { scheduleMode: "contact_saved_date", occasionType: "birthday" } }));
  assert.ok(s.tid("card-occasion-cmp_1"));
  assert.ok(s.tid("card-tz-cmp_1"));
  assert.equal(s.tid("card-when-cmp_1"), null, "no fixed date in saved-date mode");
});

test("D: the card renders NO per-recipient blocker list — no backend field carries one", async () => {
  // scheduleCampaignEndpoint returns blockers in its HTTP response body, but persists none on the
  // campaign. A list rendered from a field nothing writes could only ever be empty, so the card
  // shows nothing rather than reserving space for data that never arrives.
  const none = await mount(cardEl({ deliveryConfig: { scheduleMode: "contact_saved_date" } }));
  assert.equal(none.tid("card-blockers-cmp_1"), null);
  const fed = await mount(cardEl({ lastRunBlockers: [{ contactId: "e1", reason: "missing_occasion_date" }] }));
  assert.equal(fed.tid("card-blockers-cmp_1"), null, "even when fed, no such surface exists");
  assert.equal(/missing occasion date/i.test(fed.text()), false);
});

test("D: a non-owner sees the owner-only message and cannot fire a final action", async () => {
  const locked = { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } };
  const s = await mount(cardEl(locked, { isOwner: false }));
  assert.equal(s.tid("act-schedule-cmp_1").disabled, true);
  assert.equal(s.tid("card-owner-note-cmp_1").textContent, "Organization owner authorization required");
  calls.length = 0;
  await click(s.tid("act-schedule-cmp_1"));
  assert.equal(calls.some((c) => c[0] === "schedule"), false, "a disabled control calls nothing");

  const owner = await mount(cardEl(locked, { isOwner: true, canAuthorizeRun: true })); // E3: capability required
  assert.equal(owner.tid("act-schedule-cmp_1").disabled, false);
  assert.equal(owner.tid("card-owner-note-cmp_1"), null);
});

test("D: statuses read as human language, never as raw backend enums", async () => {
  const cases = [
    [{}, "Needs setup"],
    [{ approvalStatus: "approved", deliveryConfig: { scheduleMode: "campaign_date" } }, "Approved"],
    [{ lockStatus: "locked", deliveryConfig: { scheduleMode: "campaign_date", status: "scheduled" } }, "Scheduled"],
    [{ lockStatus: "locked", deliveryConfig: { scheduleMode: "contact_saved_date", status: "active" } }, "Active"],
  ];
  for (const [st, label] of cases) {
    const s = await mount(cardEl(st));
    assert.equal(s.tid("card-status-cmp_1").textContent, label, JSON.stringify(st));
    assert.equal(/ready to send|not_scheduled|proposed/i.test(s.text()), false);
  }
});

test("D: a failed call surfaces a message and never fakes success", async () => {
  const failing = { ...fakeClient, updateDeliveryConfig: () => Promise.resolve({ ok: false, status: 400, error: "delivery_config_invalid_date" }) };
  const s = await mount(cardEl({ deliveryConfig: { scheduleMode: "campaign_date" } }, { client: failing }));
  await openSel(s, "audience");
  // SLICE E5 - Save is dirty-gated, so there must be a change to save.
  await act(async () => { s.q("#c-cmp_1-aud-employee").click(); });
  await click(s.tid("act-save-cmp_1"));
  assert.ok(s.tid("card-msg-cmp_1"), "the failure is shown");
  assert.equal(s.tid("card-status-cmp_1").textContent, "Draft", "status did not advance on a failure");
});

test("D: category bubbles call setAudience with a deduplicated, unclassified-free ref list", async () => {
  const s = await mount(cardEl({ audienceRefs: ["e1"] }, { isOwner: true }));
  await openSel(s, "audience");
  calls.length = 0;
  const box = s.q("#c-cmp_1-aud-employee");
  // A real click, so React's own value tracker sees the change exactly as a user would cause it.
  await act(async () => { box.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });

  // SLICE E5 - ticking a box no longer writes to the server. This is the guarantee that makes
  // Cancel honest: if the audience were written here, Cancel could not take it back.
  assert.equal(calls.some((c) => c[0] === "setAudience"), false, "nothing is sent until Save");
  assert.ok(s.tid("card-dirty-cmp_1"), "…and the card says so");

  await click(s.tid("act-save-cmp_1"));
  const call = calls.find((c) => c[0] === "setAudience");
  assert.ok(call, "the EXISTING audience endpoint is used");
  const refs = call[3];
  assert.deepEqual([...refs].sort(), ["e1", "e2"]);
  assert.equal(new Set(refs).size, refs.length, "deduplicated");
  assert.equal(refs.includes("u1"), false, "a category never captures an unclassified contact");
});

// ══ individual picker ═══════════════════════════════════════════════════════════════════════
test("D: an unclassified contact is selectable individually and labelled neutrally", async () => {
  const s = await mount(React.createElement(IndividualContactPicker, {
    contacts: CONTACTS, orgId: "org1", campaign: campaign({ audienceRefs: ["e1"] }), client: fakeClient,
    onClose: () => {}, onSaved: async () => {},
  }));
  assert.ok(s.tid("pick-u1"), "unclassified contacts remain reachable");
  assert.equal(s.tid("pick-u1-category").textContent, "Unclassified");
  assert.equal(s.tid("pick-e1-category").textContent, "Employee");

  calls.length = 0;
  const box = s.q("#pick-u1");
  await act(async () => { box.click(); });
  await click(s.tid("picker-save"));
  const refs = calls.find((c) => c[0] === "setAudience")[3];
  assert.deepEqual([...refs].sort(), ["e1", "u1"]);
  assert.equal(new Set(refs).size, refs.length);
});


// ══ SLICE D CLOSEOUT — stale authority ══════════════════════════════════════════════════════
test("D-close: ownership is reset BEFORE the first request, and no failure can retain it", () => {
  const src = readFileSync(new URL("./GreetingAutomationCampaigns.jsx", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("const loadCampaigns = useCallback"), src.indexOf("useEffect(() => {", src.indexOf("const loadCampaigns")));

  const reset = fn.indexOf("setIsOwnerViewer(false);");
  const firstAwait = fn.indexOf("await ");
  const grant = fn.indexOf("setIsOwnerViewer(readViewerOwnerCapability(listRes))");
  assert.ok(reset > -1, "the reset must exist");
  assert.ok(firstAwait > -1 && grant > -1);
  // The window between organizations is unauthorized, not optimistically authorized.
  assert.ok(reset < firstAwait, "reset must precede the first awaited request");
  assert.ok(grant > firstAwait, "ownership can only be granted by a response");

  // Every non-ok branch returns BEFORE the grant, so it cannot be reached without a successful list.
  for (const guard of ["if (listRes.dormant)", "if (listRes.unauthorized)", "if (!listRes.ok)"]) {
    const at = fn.indexOf(guard);
    assert.ok(at > -1, `${guard} must exist`);
    assert.ok(at < grant, `${guard} must short-circuit before ownership is granted`);
  }

  // A thrown load also fails closed.
  const cat = fn.indexOf("} catch {");
  assert.ok(cat > -1, "a catch path must exist");
  assert.ok(fn.indexOf("setIsOwnerViewer(false);", cat) > cat, "the catch must clear ownership");

  // Exactly two writes: one clearing reset, one clearing catch, and one conditional grant.
  assert.equal((fn.match(/setIsOwnerViewer\(false\);/g) || []).length, 2);
  assert.equal((fn.match(/setIsOwnerViewer\(/g) || []).length, 3);
  // Initial state is false — nobody is an owner before a response.
  assert.match(src, /useState\(false\);\s*(\r?\n)?\s*(\/\/[^\n]*\n\s*)*const \[isOwnerViewer|const \[isOwnerViewer, setIsOwnerViewer\] = useState\(false\)/);
});

test("D-close: the membership-role approximation is gone from the surface", () => {
  const src = readFileSync(new URL("./GreetingAutomationCampaigns.jsx", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(src, /isOrganizationOwner/);
  assert.doesNotMatch(src, /role === "owner"/);
  assert.match(src, /readViewerOwnerCapability\(listRes\)/);
});


// ══ SLICE D REFINEMENT — visible actions + scroll affordance ════════════════════════════════
test("F1: the actions follow the configuration, and there is exactly one rail", async () => {
  // The rail moved BELOW the selectors and the schedule. With one campaign expanded at a time and
  // a banner naming it at the top, reading order now runs title → what it does → act, rather than
  // asking a reader to act before they have seen the settings.
  const s = await mount(cardEl());
  const rail = s.tid("card-footer-cmp_1");
  assert.ok(rail, "the rail exists");
  const order = (el) => [...s.host.querySelectorAll("*")].indexOf(el);
  assert.ok(order(s.q(".gcd-tile-head")) < order(rail), "after the header/banner");
  assert.ok(order(s.tid("card-selectors-cmp_1")) < order(rail), "after the three selectors");
  assert.ok(order(s.tid("c-cmp_1-schedule")) < order(rail), "after the schedule");
  assert.equal(s.qa(".gcd-actions").length, 1, "one rail per card");
  assert.equal(s.qa(".gcd-footer").length, 0, "no duplicate footer");
});

test("F1: the action set is CONTEXTUAL, and no capability is unreachable", async () => {
  // The old contract rendered all seven every time, including actions that could never apply.
  // The new one shows the editor's Save/Cancel plus the lifecycle step that is actually next —
  // but every capability must still be REACHABLE at the state where it is valid, which is what
  // this proves. Nothing was deleted; `deriveActions` still computes all seven.
  const s = await mount(cardEl());
  const rail = s.tid("card-footer-cmp_1");
  for (const b of s.qa("[data-testid^='act-']")) {
    assert.ok(rail.contains(b), `${b.dataset.testid} must be in the rail`);
  }
  // Each lifecycle action appears at the state where it is genuinely available.
  const REACHABLE = [
    ["approve", { audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true }],
    ["lock", { approvalStatus: "approved", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true }],
    ["schedule", LOCKED_SCHEDULABLE, { isOwner: true, canAuthorizeRun: true }],
    ["activate", LOCKED_ACTIVATABLE, { isOwner: true, canAuthorizeRun: true }],
    ["unlock", { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true }],
  ];
  for (const [key, over, props] of REACHABLE) {
    const c = await mount(cardEl(over, props));
    const btn = c.tid(`act-${key}-cmp_1`);
    assert.ok(btn, `${key} must be reachable where it is valid`);
    assert.equal(btn.disabled, false, `${key} enabled where valid`);
  }

  // The runtime switch is still not a rail action — it reports a standing state.
  const sw = s.tid("card-toggle-cmp_1");
  assert.ok(sw, "the switch exists");
  assert.equal(rail.contains(sw), false, "…and deliberately not in the rail");
});

test("R: enablement, disabled reasons and owner authorization are unchanged by the move", async () => {
  const locked = { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } };
  const notOwner = await mount(cardEl(locked, { isOwner: false }));
  assert.equal(notOwner.tid("act-schedule-cmp_1").disabled, true);
  assert.equal(notOwner.tid("card-owner-note-cmp_1").textContent, "Organization owner authorization required");
  calls.length = 0;
  await click(notOwner.tid("act-schedule-cmp_1"));
  assert.equal(calls.some((c) => c[0] === "schedule"), false, "a disabled control still calls nothing");

  const owner = await mount(cardEl(locked, { isOwner: true, canAuthorizeRun: true })); // E3: capability required
  assert.equal(owner.tid("act-schedule-cmp_1").disabled, false);
  calls.length = 0;
  await click(owner.tid("act-schedule-cmp_1"));
  assert.equal(calls.some((c) => c[0] === "schedule"), true, "and an enabled one still calls the API");
});

test("R: the rail is sticky within the campaign viewport", () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  const rail = css.slice(css.indexOf(".gcd-actions {"), css.indexOf("}", css.indexOf(".gcd-actions {")));
  assert.match(rail, /position:\s*sticky/, "it pins rather than scrolls away");
  assert.match(rail, /top:\s*0/);
  assert.match(rail, /z-index:\s*\d/, "it must sit above the settings it covers");
  // Opaque, not translucent: a see-through rail lets the settings scrolling beneath it bleed
  // through, and half-legible labels behind buttons read as a rendering fault.
  assert.match(rail, /background:\s*#ffffff/);
  assert.doesNotMatch(rail, /rgba\(255,\s*255,\s*255,\s*\.\d/, "no translucent ground");
  assert.match(rail, /box-shadow:/, "separation comes from a shadow instead");
  // Sticky is scoped by the card, so the rail belongs to the campaign in view — not the panel.
  assert.match(css, /\.gcd-card\s*\{[\s\S]*?border-radius/);
});

test("R: the scroll cue is CSS-only, appears while content remains, and vanishes at the bottom", () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  // The literal newline that used to be in this slice made the test line-ending dependent: the
  // repo stores LF, there is no .gitattributes, and core.autocrlf=true hands a Windows checkout
  // CRLF - so `.gcd-scroll {\n  background-color` matched nothing and the block silently came
  // back empty, passing an assertion against "" only by luck of which rules preceded it.
  const scrollAt = css.search(/\.gcd-scroll \{\r?\n\s*background-color/);
  assert.ok(scrollAt > -1, "the cue block exists");
  const block = css.slice(scrollAt, css.indexOf(".gcd-scroll::-webkit-scrollbar {"));
  // Two covers travel WITH the content; two cues stay pinned to the box. When content reaches an
  // edge its cover slides over that cue and hides it — no listener, nothing to fall out of sync.
  assert.match(block, /background-attachment:\s*local,\s*local,\s*scroll,\s*scroll/);
  assert.equal((block.match(/radial-gradient/g) || []).length, 2, "a cue at each edge");
  assert.equal((block.match(/linear-gradient/g) || []).length, 2, "a cover at each edge");
  assert.match(block, /background-color:\s*#fff/, "the covers need an opaque ground");
  // A slim, visible scrollbar — and scrolling stays native, so keyboard and touch are untouched.
  assert.match(css, /\.gcd-scroll::-webkit-scrollbar \{ width: 8px; \}/);
  assert.match(css, /\.gcd-scroll \{ scrollbar-width: thin;/);
  assert.match(css, /\.gcd-scroll\s*\{[\s\S]*?overflow-y:\s*auto/);
  // No permanent instructional clutter: the cue is background, not text.
  assert.equal(/scroll for more|swipe|↓/i.test(css), false);
});

test("R: no JavaScript scroll listener was introduced — the cue is pure CSS", () => {
  const src = readFileSync(new URL("./CampaignCard.jsx", import.meta.url), "utf8");
  for (const forbidden of [/addEventListener\(\s*["']scroll/, /onScroll/, /scrollTop/, /IntersectionObserver/]) {
    assert.doesNotMatch(src, forbidden, String(forbidden));
  }
});

test("R: mobile wraps the six actions compactly, with no horizontal scrolling strip", () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  const narrow = css.slice(css.indexOf("@media (max-width: 720px)"));
  assert.match(narrow, /\.gcd-actions \.gcd-btn \{ flex: 1 1 auto/, "buttons share the row and wrap");
  assert.match(css, /\.gcd-actions \{[\s\S]*?flex-wrap:\s*wrap/);
  // A horizontally scrolling rail would hide controls behind an unannounced gesture.
  const rail = css.slice(css.indexOf(".gcd-actions {"), css.indexOf("}", css.indexOf(".gcd-actions {")));
  assert.doesNotMatch(rail, /overflow-x:\s*(auto|scroll)/);
  assert.doesNotMatch(narrow.slice(narrow.indexOf(".gcd-actions")), /overflow-x:\s*(auto|scroll)/);
  // Contacts stay below the bounded campaign viewport — the tiles are never nested inside it.
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.gcd-tiles\s*\{\s*grid-template-columns:\s*1fr/);
});


// ══ SLICE D — sticky rail identity ══════════════════════════════════════════════════════════
test("I: the sticky rail visibly names its campaign and its human-readable status", async () => {
  const s = await mount(cardEl({ name: "Q4 Client Appreciation", approvalStatus: "approved", deliveryConfig: { scheduleMode: "campaign_date" } }));
  const ctx = s.tid("rail-context-cmp_1");
  assert.ok(ctx, "the rail carries an identity");
  // It lives INSIDE the rail, so it travels with the pinned actions.
  assert.ok(s.tid("card-footer-cmp_1").contains(ctx));
  assert.match(ctx.textContent, /Q4 Client Appreciation/);
  assert.match(ctx.textContent, /Approved/);
  // Name, separator and status are separate spans spaced by CSS, so textContent carries no
  // whitespace around "·". Normalise it — the visual gap is the stylesheet's job, and `title`
  // below is the properly spaced string.
  const railText = (el) => el.textContent.replace(/\s+/g, " ").replace(/\s*·\s*/, " · ").trim();
  assert.equal(railText(ctx), "Q4 Client Appreciation · Approved");
  // The full text stays available when the name is visually truncated.
  assert.equal(ctx.getAttribute("title"), "Q4 Client Appreciation · Approved");
  // ...and the whole rail announces itself to assistive tech.
  assert.match(s.tid("card-footer-cmp_1").getAttribute("aria-label"), /Q4 Client Appreciation — Approved/);
  assert.equal(s.tid("card-footer-cmp_1").getAttribute("role"), "group");
});

test("I: the rail status is the DISPLAY status — never a raw backend enum", async () => {
  const cases = [
    [{ deliveryConfig: { scheduleMode: null, status: "not_configured" } }, "Needs setup"],
    [{ approvalStatus: "approved", deliveryConfig: { scheduleMode: "campaign_date" } }, "Approved"],
    [{ approvalStatus: "approved", lockStatus: "locked", deliveryConfig: { scheduleMode: "campaign_date" } }, "Locked"],
    [{ lockStatus: "locked", deliveryConfig: { scheduleMode: "campaign_date", status: "scheduled" } }, "Scheduled"],
    [{ lockStatus: "locked", deliveryConfig: { scheduleMode: "contact_saved_date", status: "active" } }, "Active"],
  ];
  for (const [over, label] of cases) {
    const s = await mount(cardEl(over));
    const ctx = s.tid("rail-context-cmp_1");
    assert.match(ctx.textContent, new RegExp(label), JSON.stringify(over));
    // The rail agrees with the header chip — one derivation, never two.
    assert.equal(s.tid("card-status-cmp_1").textContent, label);
    // No enum, no snake_case, no internal vocabulary.
    for (const raw of ["not_configured", "campaign_date", "contact_saved_date", "approvalStatus", "lockStatus", "draft", "unlocked"]) {
      assert.equal(ctx.textContent.includes(raw), false, `${raw} must not surface`);
    }
    assert.doesNotMatch(ctx.textContent, /_/);
  }
});

test("I: two campaigns produce two DISTINCT rail identities", async () => {
  const a = await mount(cardEl({ name: "Q4 Client Appreciation", approvalStatus: "approved", deliveryConfig: { scheduleMode: "campaign_date" } }));
  const railText = (el) => el.textContent.replace(/\s+/g, " ").replace(/\s*·\s*/, " · ").trim();
  const one = railText(a.tid("rail-context-cmp_1"));

  // A different campaign id, name and state — its rail must say so, not inherit the first.
  const other = { ...campaign({ name: "Team Birthdays", lockStatus: "locked", deliveryConfig: { scheduleMode: "contact_saved_date", status: "active" } }), campaignId: "cmp_2" };
  const b = await mount(React.createElement(CampaignCard, {
    campaign: other, contacts: CONTACTS, orgId: "org1", client: fakeClient, isOwner: false, busy: false,
    onOpenIndividualPicker: () => {}, onAfterMutate: async () => {},
    expanded: true, onToggleExpanded: () => {},
  }));
  const two = railText(b.tid("rail-context-cmp_2"));

  assert.equal(one, "Q4 Client Appreciation · Approved");
  assert.equal(two, "Team Birthdays · Active");
  assert.notEqual(one, two, "each rail identifies its OWN campaign");
  // The identity is keyed by campaign id, so one card can never render another's.
  assert.equal(a.tid("rail-context-cmp_2"), null);
  assert.equal(b.tid("rail-context-cmp_1"), null);
});

test("F1: a rail's actions invoke ONLY their own campaign", async () => {
  const a = await mount(cardEl({ approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true }));
  calls.length = 0;
  await click(a.tid("act-unlock-cmp_1"));
  const unlocked = calls.filter((c) => c[0] === "unlock");
  assert.equal(unlocked.length, 1);
  assert.equal(unlocked[0][2], "cmp_1");
});

test("F1: the rail identity is not itself an action", async () => {
  const s = await mount(cardEl());
  const rail = s.tid("card-footer-cmp_1");
  const acts = s.qa("[data-testid^='act-']");
  assert.ok(acts.length >= 2, "at least Save and Cancel");
  assert.equal(rail.querySelectorAll("button").length, acts.length, "the identity is not a button");
  assert.equal(s.tid("rail-context-cmp_1").tagName, "SPAN");
  assert.equal(s.qa("[data-testid^='rail-context-']").length, 1, "one identity per rail");
  assert.equal(s.tid("card-toggle-cmp_1").tagName, "INPUT", "the switch is a checkbox, not a button");
});

// ══ SLICE E5 — the runtime switch ════════════════════════════════════════════════════════════
const READY = { audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } };

test("E5: the switch shows the SERVER's answer, not a local guess", async () => {
  const on = await mount(cardEl({ ...READY, enabled: true }, { isOwner: true }));
  assert.equal(on.tid("card-toggle-cmp_1").checked, true);
  assert.equal(on.tid("card-toggle-label-cmp_1").textContent, "On");

  const off = await mount(cardEl({ ...READY, enabled: false }, { isOwner: true }));
  assert.equal(off.tid("card-toggle-cmp_1").checked, false);
  assert.equal(off.tid("card-toggle-label-cmp_1").textContent, "Off");
  assert.equal(off.tid("card-status-cmp_1").textContent, "Off", "the chip agrees with the switch");

  // A campaign stored before the switch existed is RUNNING, and must not be shown as off.
  const legacy = await mount(cardEl(READY, { isOwner: true }));
  assert.equal(legacy.tid("card-toggle-cmp_1").checked, true, "absent enabled reads as on");
});

test("E5: working the switch calls the server with the NEW value", async () => {
  const s = await mount(cardEl({ ...READY, enabled: false }, { isOwner: true }));
  calls.length = 0;
  await click(s.tid("card-toggle-cmp_1"));
  const sent = calls.filter((c) => c[0] === "setCampaignEnabled");
  assert.equal(sent.length, 1, "exactly one call");
  assert.equal(sent[0][2], "cmp_1", "…for this campaign");
  assert.equal(sent[0][3], true, "…turning it on");
});

test("E5: a LOCKED running campaign can still be switched off in one click", async () => {
  // The case that justifies keeping the switch out of Save Changes: Save is gated on !locked, so
  // a campaign that is locked and sending would otherwise have no stop at all.
  const running = { ...READY, enabled: true, approvalStatus: "approved", lockStatus: "locked", deliveryConfig: { scheduleMode: "campaign_date", status: "scheduled" } };
  const s = await mount(cardEl(running, { isOwner: true }));
  assert.equal(s.tid("act-save-cmp_1").disabled, true, "Save is unavailable while locked…");
  assert.equal(s.tid("card-toggle-cmp_1").disabled, false, "…but the stop is not");
  calls.length = 0;
  await click(s.tid("card-toggle-cmp_1"));
  assert.equal(calls.filter((c) => c[0] === "setCampaignEnabled")[0][3], false, "switched off");
});

test("E5: a non-owner cannot work the switch, and a disabled switch calls nothing", async () => {
  const s = await mount(cardEl({ ...READY, enabled: true }, { isOwner: false }));
  const sw = s.tid("card-toggle-cmp_1");
  assert.equal(sw.disabled, true);

  // This proves the CARD's own guard, not the browser's. jsdom dispatches change on a disabled
  // checkbox when the click is synthetic (verified: disabled=true still fires change once), and
  // React suppresses onClick on disabled elements but not onChange. So without the explicit gate
  // in setEnabled this assertion would fail here while passing in a real browser - which is
  // exactly the direction of error worth defending against.
  calls.length = 0;
  await click(sw);
  assert.equal(calls.some((c) => c[0] === "setCampaignEnabled"), false);
});

test("E5: an unconfigured campaign cannot be switched ON, and says what is missing", async () => {
  const s = await mount(cardEl({ enabled: false }, { isOwner: true }));
  const sw = s.tid("card-toggle-cmp_1");
  assert.equal(sw.disabled, true, "nothing to send, and nobody to send it to");
  assert.match(sw.closest("label").getAttribute("title"), /who should receive/i, "the reason is on the control");
});

// ══ SLICE E5 — the edit buffer ═══════════════════════════════════════════════════════════════
const tick = async (s, id) => { await act(async () => { s.q(id).click(); }); };

test("E5: Save and Cancel are both inert until something has actually changed", async () => {
  const s = await mount(cardEl({ audienceRefs: ["e1"] }, { isOwner: true }));
  await openSel(s, "audience");
  assert.equal(s.tid("act-save-cmp_1").disabled, true, "nothing to save");
  assert.equal(s.tid("act-cancel-cmp_1").disabled, true, "nothing to discard");
  assert.equal(s.tid("card-dirty-cmp_1"), null, "and no unsaved-changes notice");

  await tick(s, "#c-cmp_1-aud-employee");
  assert.equal(s.tid("act-save-cmp_1").disabled, false);
  assert.equal(s.tid("act-cancel-cmp_1").disabled, false);
  assert.ok(s.tid("card-dirty-cmp_1"), "the card says there is something unsaved");
});

test("E5: Cancel restores every field at once and sends nothing", async () => {
  const s = await mount(cardEl({ audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date", timeZone: "UTC" } }, { isOwner: true }));
  await openSel(s, "audience");
  const before = s.tid("card-audience-total-cmp_1").textContent;
  calls.length = 0;

  await tick(s, "#c-cmp_1-aud-employee");
  assert.notEqual(s.tid("card-audience-total-cmp_1").textContent, before, "the edit is visible");

  await click(s.tid("act-cancel-cmp_1"));
  assert.equal(s.tid("card-audience-total-cmp_1").textContent, before, "…and fully undone");
  assert.equal(s.tid("act-save-cmp_1").disabled, true, "back to clean");
  assert.equal(s.tid("card-dirty-cmp_1"), null);
  // The whole point: a bail-out that never touched the server has nothing to roll back.
  assert.equal(calls.length, 0, "Cancel is a local operation");
});

test("E5: unchecking a category actually removes its members", async () => {
  // Before the edit buffer this silently did nothing: the card fed the whole persisted audience
  // back as "individually selected", so everyone a category had added stayed added forever.
  const s = await mount(cardEl({ audienceRefs: ["e1", "e2"] }, { isOwner: true }));
  await openSel(s, "audience");
  const box = s.q("#c-cmp_1-aud-employee");
  assert.equal(box.checked, true, "a fully-included category reads as checked");

  await tick(s, "#c-cmp_1-aud-employee");
  assert.equal(s.tid("card-audience-total-cmp_1").textContent.startsWith("0 contacts"), true, "both employees removed");

  calls.length = 0;
  await click(s.tid("act-save-cmp_1"));
  const call = calls.find((c) => c[0] === "setAudience");
  assert.deepEqual(call[3], [], "and the empty audience is what is saved");
});

test("E5: an individual pick survives a category being unchecked", async () => {
  // e1+e2 are the employees; c1 is a client, so it can only have come from an individual pick.
  const s = await mount(cardEl({ audienceRefs: ["e1", "e2", "c1"] }, { isOwner: true }));
  await openSel(s, "audience");
  await tick(s, "#c-cmp_1-aud-employee");
  calls.length = 0;
  await click(s.tid("act-save-cmp_1"));
  assert.deepEqual(calls.find((c) => c[0] === "setAudience")[3], ["c1"], "the individual pick is not collateral");
});

test("E5: working the switch does NOT discard unsaved edits", async () => {
  // The switch refetches, which hands the card a brand-new campaign object. Resyncing on object
  // identity would wipe the buffer here; resyncing on VALUE leaves it alone.
  const s = await mount(cardEl({ audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true }));
  await openSel(s, "audience");
  await tick(s, "#c-cmp_1-aud-employee");
  const edited = s.tid("card-audience-total-cmp_1").textContent;

  await click(s.tid("card-toggle-cmp_1"));
  assert.equal(s.tid("card-audience-total-cmp_1").textContent, edited, "the edit survived");
  assert.ok(s.tid("card-dirty-cmp_1"), "…and is still flagged unsaved");
});

test("E5: Save writes the audience BEFORE the delivery config", async () => {
  // If the second call fails the campaign is left addressed to fewer people rather than more,
  // which is the safer direction for a half-applied save.
  const s = await mount(cardEl({ audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true }));
  await openSel(s, "audience");
  await tick(s, "#c-cmp_1-aud-employee");
  calls.length = 0;
  await click(s.tid("act-save-cmp_1"));
  const names = calls.map((c) => c[0]).filter((n) => n === "setAudience" || n === "updateDeliveryConfig");
  assert.deepEqual(names, ["setAudience", "updateDeliveryConfig"]);
});

test("E5: a schedule-only change does not rewrite the audience", async () => {
  const s = await mount(cardEl({ audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date", timeZone: "UTC" } }, { isOwner: true }));
  await openSel(s, "audience");
  const tz = s.tid("card-tz-cmp_1");
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(tz.constructor.prototype, "value").set;
    setter.call(tz, "America/Denver");
    tz.dispatchEvent(new dom.window.Event("change", { bubbles: true }));
  });
  calls.length = 0;
  await click(s.tid("act-save-cmp_1"));
  assert.equal(calls.some((c) => c[0] === "setAudience"), false, "only what changed is sent");
  assert.equal(calls.filter((c) => c[0] === "updateDeliveryConfig").length, 1);
});

test("E5: No gift is the default and the first option offered", async () => {
  const s = await mount(cardEl({ deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true }));
  await openSel(s, "gift");
  const first = s.q("#c-cmp_1-gift-none");
  assert.ok(first, "No gift is present");
  assert.equal(first.checked, true, "…and selected when nothing is configured");
  assert.equal(s.tid("card-tier-cmp_1"), null, "no spend control until a gift is chosen");
});

test("I: a very long name truncates rather than overflowing, and stays readable on mobile", async () => {
  const long = "Q4 Global Client Appreciation and Partner Recognition Programme for the Americas Region";
  const s = await mount(cardEl({ name: long }));
  const ctx = s.tid("rail-context-cmp_1");
  assert.equal(ctx.getAttribute("title"), `${long} · Needs setup`, "the full name stays accessible");

  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  // Desktop/tablet: the name shrinks and ellipsises; the status never wraps or gets pushed out.
  const id = css.slice(css.indexOf(".gcd-actions-id {"), css.indexOf("}", css.indexOf(".gcd-actions-id {")));
  assert.match(id, /min-width:\s*0/, "it must be allowed to shrink");
  assert.match(id, /flex:\s*0 1 auto/, "…and shrink BEFORE the buttons do");
  assert.match(id, /max-width:\s*\d+%/);
  const name = css.slice(css.indexOf(".gcd-actions-id-name {"), css.indexOf("}", css.indexOf(".gcd-actions-id-name {")));
  assert.match(name, /text-overflow:\s*ellipsis/);
  assert.match(name, /white-space:\s*nowrap/);

  // Mobile: at most two lines, wrapping inside long words so nothing can exceed the viewport.
  const narrow = css.slice(css.indexOf("@media (max-width: 720px)"));
  const mobileName = narrow.slice(narrow.indexOf(".gcd-actions-id-name {"), narrow.indexOf("}", narrow.indexOf(".gcd-actions-id-name {")));
  assert.match(mobileName, /-webkit-line-clamp:\s*2/, "at most two lines");
  assert.match(mobileName, /overflow-wrap:\s*anywhere/, "an unbroken name cannot push the rail wide");
  assert.match(narrow.slice(narrow.indexOf(".gcd-actions-id {")), /flex-basis:\s*100%/, "it takes its own row");
});

test("I: the identity changed nothing about state, APIs, models, or scroll height", () => {
  const src = readFileSync(new URL("./CampaignCard.jsx", import.meta.url), "utf8");
  // The label reads the SAME derived status the header uses — no second derivation.
  assert.equal((src.match(/deriveCampaignStatus\(/g) || []).length, 1);
  assert.equal((src.match(/deriveActions\(/g) || []).length, 1);
  // It renders existing values; it sets nothing.
  const idBlock = src.slice(src.indexOf('className="gcd-actions-id"'), src.indexOf("</span>", src.indexOf('gcd-actions-id-status')));
  assert.doesNotMatch(idBlock, /useState|client\.|fetch\(|onClick/);
  // The campaign viewport height is untouched by this change.
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  // SLICE F1 - the cap is now expressed as four tiles plus their gaps rather than a round vh
  // figure, so the intent travels with the tile height if it changes.
  assert.match(css, /\.gcd-scroll \{[\s\S]*?max-height:\s*calc\(\(var\(--gcd-tile-h\) \* 4\)/);
});

test("D: the campaign viewport is a fixed-height internal scroller", () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  assert.match(css, /\.gcd-scroll\s*\{[\s\S]*?max-height:\s*\d+vh/, "a bounded height");
  assert.match(css, /\.gcd-scroll\s*\{[\s\S]*?overflow-y:\s*auto/, "scrolls internally");
  assert.match(css, /\.gcd-panel-head\s*\{[\s\S]*?position:\s*sticky/, "the header + Add CTA stay visible");
  assert.match(css, /\.gcd-scroll::-webkit-scrollbar-thumb/, "a visible premium scrollbar treatment");
  assert.match(css, /\.gcd-card \+ \.gcd-card\s*\{\s*margin-top:\s*28px/, "generous separation between cards");
  // Responsive: tiles collapse rather than clip, and actions stay reachable.
  // Three equal columns hold at 1024 — a 2 + 1 grid would read as a hierarchy that does not exist.
  const tabletBlock = css.slice(css.indexOf("@media (max-width: 1024px)"), css.indexOf("@media (max-width: 720px)"));
  assert.doesNotMatch(tabletBlock, /\.gcd-tiles/, "the tablet breakpoint must not re-grid the tiles");
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.gcd-tiles\s*\{\s*grid-template-columns:\s*1fr/, "stacking belongs to the narrow breakpoint");
  assert.match(css, /\.gcd-tiles\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(3/, "three in one row on desktop");
});


// ══ SLICE E3 — dormant execution disables the two owner-only actions BEFORE any click ════════
//
// Previously an owner with a locked campaign saw an enabled Schedule button whose only possible
// outcome was a 503. The capability now arrives on the campaign list and gates the control itself.

const LOCKED_SCHEDULABLE = { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"],
  deliveryConfig: { scheduleMode: "campaign_date", status: "locked" } };
const LOCKED_ACTIVATABLE = { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"],
  deliveryConfig: { scheduleMode: "contact_saved_date", status: "locked" } };

test("E3: with the capability FALSE, Schedule and Activate are disabled before any click", async () => {
  for (const [over, key] of [[LOCKED_SCHEDULABLE, "schedule"], [LOCKED_ACTIVATABLE, "activate"]]) {
    const s = await mount(cardEl(over, { isOwner: true, canAuthorizeRun: false }));
    const btn = s.tid(`act-${key}-cmp_1`);
    assert.ok(btn, `${key} button still renders — a control is disabled, never removed`);
    assert.equal(btn.disabled, true, key);
    assert.equal(btn.getAttribute("title"), "Campaign sending is not active yet.", key);
  }
});

test("E3: with the capability TRUE, the same card enables the action", async () => {
  for (const [over, key] of [[LOCKED_SCHEDULABLE, "schedule"], [LOCKED_ACTIVATABLE, "activate"]]) {
    const s = await mount(cardEl(over, { isOwner: true, canAuthorizeRun: true }));
    assert.equal(s.tid(`act-${key}-cmp_1`).disabled, false, key);
  }
});

test("E3: an OMITTED capability fails closed", async () => {
  // A caller that has not been wired yet must refuse, never offer.
  const s = await mount(cardEl(LOCKED_SCHEDULABLE, { isOwner: true }));
  assert.equal(s.tid("act-schedule-cmp_1").disabled, true);
  assert.equal(s.tid("act-schedule-cmp_1").getAttribute("title"), "Campaign sending is not active yet.");
});

test("E3: a disabled dormant control fires ZERO API calls when clicked", async () => {
  calls.length = 0;
  // Schedule and Activate are mutually exclusive by schedule mode, so each fixture renders only
  // its own final action; clicking the other would be testing a control that cannot exist.
  for (const [over, key] of [[LOCKED_SCHEDULABLE, "schedule"], [LOCKED_ACTIVATABLE, "activate"]]) {
    const s = await mount(cardEl(over, { isOwner: true, canAuthorizeRun: false }));
    const btn = s.tid(`act-${key}-cmp_1`);
    assert.ok(btn, `${key} still renders, disabled, so its reason is on screen`);
    assert.equal(btn.disabled, true, key);
    await click(btn);
  }
  assert.equal(calls.filter((c) => c[0] === "schedule" || c[0] === "activate").length, 0,
    "a disabled button reaches no endpoint at all");
});

test("E3: the dormant explanation is the approved wording, and none of the rejected ones", async () => {
  const s = await mount(cardEl(LOCKED_SCHEDULABLE, { isOwner: true, canAuthorizeRun: false }));
  const title = s.tid("act-schedule-cmp_1").getAttribute("title");
  assert.equal(title, "Campaign sending is not active yet.");
  for (const banned of [/unavailable/i, /unsupported/i, /not offered/i, /coming soon/i]) {
    assert.doesNotMatch(title, banned, String(banned));
  }
});

test("E3: a NON-OWNER still gets the ownership explanation, never the dormancy one", async () => {
  for (const canAuthorizeRun of [true, false]) {
    const s = await mount(cardEl(LOCKED_SCHEDULABLE, { isOwner: false, canAuthorizeRun }));
    const btn = s.tid("act-schedule-cmp_1");
    assert.equal(btn.disabled, true);
    assert.equal(btn.getAttribute("title"), "Organization owner authorization required", `cap=${canAuthorizeRun}`);
    // The visible note under the rail says the same thing.
    assert.match(s.tid("card-owner-note-cmp_1").textContent, /Organization owner authorization required/);
  }
});

test("E3: Save Changes stays usable while execution is dormant and the campaign is unlocked", async () => {
  calls.length = 0;
  const unlocked = { approvalStatus: "approved", lockStatus: "unlocked", audienceRefs: ["e1"],
    deliveryConfig: { scheduleMode: "campaign_date", status: "configured" } };
  const s = await mount(cardEl(unlocked, { isOwner: true, canAuthorizeRun: false }));
  await openSel(s, "audience");
  // SLICE E5 - Save is dirty-gated, so make a change first; the point of the test is that
  // dormancy does not disable it, not that it is clickable with nothing to save.
  await act(async () => { s.q("#c-cmp_1-aud-client").click(); });
  const save = s.tid("act-save-cmp_1");
  assert.equal(save.disabled, false, "configuration is not execution");
  await click(save);
  assert.equal(calls.filter((c) => c[0] === "updateDeliveryConfig").length, 1, "the config write really happens");
});

test("E3: a defensive execution 503 reports upward and never advances status", async () => {
  const refusing = { ...fakeClient,
    schedule: () => Promise.resolve({ ok: false, dormant: true, status: 503, reason: "corporate_campaign_execution_disabled" }) };
  let told = 0; let refreshed = 0;
  const s = await mount(cardEl(LOCKED_SCHEDULABLE, {
    isOwner: true, canAuthorizeRun: true, client: refusing,
    onExecutionDormant: () => { told++; },
    onAfterMutate: async () => { refreshed++; },
  }));
  const before = s.tid("card-status-cmp_1").textContent;
  await click(s.tid("act-schedule-cmp_1"));
  assert.equal(told, 1, "the dashboard is told, so every card can close");
  assert.equal(refreshed, 0, "a refusal is not a mutation — no refresh, no optimistic advance");
  assert.equal(s.tid("card-status-cmp_1").textContent, before, "status is unchanged");
  assert.equal(s.tid("card-msg-cmp_1").textContent, "Campaign sending is not active yet.");
});

test("E3: a MANAGEMENT dormancy 503 is reported differently and does not close execution", async () => {
  const refusing = { ...fakeClient,
    schedule: () => Promise.resolve({ ok: false, dormant: true, status: 503, reason: "campaign_featured_spread_disabled" }) };
  let told = 0;
  const s = await mount(cardEl(LOCKED_SCHEDULABLE, {
    isOwner: true, canAuthorizeRun: true, client: refusing, onExecutionDormant: () => { told++; },
  }));
  await click(s.tid("act-schedule-cmp_1"));
  assert.equal(told, 0, "the execution latch is keyed on the EXECUTION reason only");
  assert.equal(s.tid("card-msg-cmp_1").textContent, "This feature isn’t active yet.");
});

test("E3: the capability changes nothing about which controls exist", async () => {
  // Dormancy must not make the rail a different shape — only the final action's availability and
  // its reason change.
  for (const canAuthorizeRun of [true, false]) {
    const s = await mount(cardEl(LOCKED_SCHEDULABLE, { isOwner: true, canAuthorizeRun }));
    assert.ok(s.tid("act-save-cmp_1"), `save present cap=${canAuthorizeRun}`);
    assert.ok(s.tid("act-cancel-cmp_1"), `cancel present cap=${canAuthorizeRun}`);
    assert.ok(s.tid("act-schedule-cmp_1"), `schedule present cap=${canAuthorizeRun}`);
    assert.equal(s.tid("act-schedule-cmp_1").disabled, canAuthorizeRun === false, "availability follows the capability");
  }
});

// ── stale authority, proven at the source like the D-close ownership discipline ──
test("E3: the execution capability is reset BEFORE the first request, and no failure retains it", () => {
  const src = readFileSync(new URL("./GreetingAutomationCampaigns.jsx", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("const loadCampaigns = useCallback"), src.indexOf("useEffect(() => {", src.indexOf("const loadCampaigns")));

  const reset = fn.indexOf("setCanAuthorizeRun(false);");
  const firstAwait = fn.indexOf("await ");
  const grant = fn.indexOf("setCanAuthorizeRun(readExecutionCapability(listRes))");
  assert.ok(reset > -1 && firstAwait > -1 && grant > -1);
  assert.ok(reset < firstAwait, "a stale true cannot survive an organization switch");
  assert.ok(grant > firstAwait, "only a response can grant it");

  // Dormant / unauthorized / non-ok all return before the grant.
  for (const guard of ["if (listRes.dormant)", "if (listRes.unauthorized)", "if (!listRes.ok)"]) {
    assert.ok(fn.indexOf(guard) > -1 && fn.indexOf(guard) < grant, guard);
  }
  // A thrown load fails closed too.
  const cat = fn.indexOf("} catch {");
  assert.ok(cat > -1 && fn.indexOf("setCanAuthorizeRun(false);", cat) > cat, "the catch must clear it");
  // Exactly two clearing writes and one conditional grant — the same discipline as ownership.
  assert.equal((fn.match(/setCanAuthorizeRun\(false\);/g) || []).length, 2);
  assert.equal((fn.match(/setCanAuthorizeRun\(/g) || []).length, 3);
  // Initial state is false.
  assert.match(src, /const \[canAuthorizeRun, setCanAuthorizeRun\] = useState\(false\)/);
  // And it is handed to every card.
  assert.match(src, /canAuthorizeRun=\{canAuthorizeRun\}/);
  assert.match(src, /onExecutionDormant=\{\(\) => setCanAuthorizeRun\(false\)\}/);
});

test("E3: no raw backend flag name appears anywhere in the corporate surface", () => {
  for (const f of ["GreetingAutomationCampaigns.jsx", "CampaignCard.jsx", "corporateDashboardModel.js"]) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
    for (const flag of ["corporateCampaignExecutionEnabled", "corporateCampaignProducerEnabled",
                        "corporateCampaignDeliveryEnabled", "campaignFeaturedSpreadEnabled",
                        "LAUNCH_CONTROL", "launchControl"]) {
      assert.equal(src.includes(flag), false, `${f}: ${flag}`);
    }
  }
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// SLICE F1 — COLLAPSIBLE TILES, INLINE RENAME, PERMANENT SELECTOR ROW
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const collapsed = (over = {}, props = {}) => cardEl(over, { expanded: false, ...props });

test("F1: a collapsed tile shows the header facts and NONE of the configuration", async () => {
  const s = await mount(collapsed({ name: "Executive Birthdays", campaignType: "Birthday" }));
  assert.equal(s.tid("card-title-cmp_1").textContent, "Executive Birthdays");
  assert.equal(s.tid("card-type-cmp_1").textContent, "Birthday");
  assert.ok(s.tid("card-status-cmp_1"), "truthful persisted status");
  assert.ok(s.tid("card-next-cmp_1"), "concise next-step guidance");
  assert.ok(s.tid("card-rename-cmp_1"), "edit pencil beside the title");
  assert.ok(s.tid("card-expand-cmp_1"), "expansion control");
  // Collapsed means collapsed: no selectors, no schedule, no rail.
  assert.equal(s.tid("card-selectors-cmp_1"), null);
  assert.equal(s.tid("c-cmp_1-schedule"), null);
  assert.equal(s.tid("card-footer-cmp_1"), null);
});

test("F1: the title is a HEADING, not a link to another screen", async () => {
  const s = await mount(collapsed());
  const title = s.tid("card-title-cmp_1");
  assert.equal(title.tagName, "H3");
  assert.equal(title.querySelector("a, button"), null, "nothing inside it navigates");
  const src = readFileSync(new URL("./CampaignCard.jsx", import.meta.url), "utf8");
  const code = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.equal(/onOpenDetail/.test(code), false, "the CampaignDetail route is gone from this card");
});

test("F1: the expand control is accessible and names its campaign", async () => {
  const s = await mount(collapsed({ name: "Client Appreciation" }));
  const btn = s.tid("card-expand-cmp_1");
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  assert.equal(btn.getAttribute("aria-controls"), "c-cmp_1-body");
  assert.match(btn.getAttribute("aria-label"), /Expand Client Appreciation/);
  assert.equal(btn.tagName, "BUTTON", "keyboard-operable natively");
  assert.equal(btn.style.padding, "0px", "the global button padding is neutralised inline");
});

test("F1: expanding shows the banner and all three selector summaries", async () => {
  const s = await mount(cardEl({ name: "Vendor Thank You", campaignType: "Thanks" }));
  assert.ok(s.q(".gcd-tile-head--banner"), "the header becomes a full-width banner");
  assert.equal(s.tid("card-expand-cmp_1").getAttribute("aria-expanded"), "true");
  // The banner still carries every collapsed fact, and the pencil is not duplicated.
  assert.equal(s.tid("card-title-cmp_1").textContent, "Vendor Thank You");
  assert.ok(s.tid("card-status-cmp_1"));
  assert.ok(s.tid("card-next-cmp_1"));
  assert.equal(s.qa("[data-testid^='card-rename-cmp_1']").length, 1, "exactly one pencil");
  for (const k of ["audience", "gift", "spread"]) assert.ok(s.tid(`selector-${k}-cmp_1`), k);
});

test("F1: all three summaries stay visible while ANY one detail is open", async () => {
  for (const open of ["audience", "gift", "spread"]) {
    const s = await mount(cardEl());
    await openSel(s, open);
    assert.ok(s.tid(`detail-${open}-cmp_1`), `${open} detail opened`);
    for (const k of ["audience", "gift", "spread"]) {
      assert.ok(s.tid(`selector-${k}-cmp_1`), `${k} summary still visible while ${open} is open`);
      assert.ok(s.tid(`selector-${k}-value-cmp_1`), `${k} still shows its current value`);
    }
  }
});

test("F1: only ONE selector detail is open at a time, and it is inline", async () => {
  const s = await mount(cardEl());
  await openSel(s, "audience");
  assert.ok(s.tid("detail-audience-cmp_1"));
  await openSel(s, "gift");
  assert.equal(s.tid("detail-audience-cmp_1"), null, "the first closed");
  assert.ok(s.tid("detail-gift-cmp_1"), "the second opened");
  // Inline: inside the card, never a modal or a drawer.
  assert.ok(s.tid("campaign-card-cmp_1").contains(s.tid("detail-gift-cmp_1")));
  assert.equal(s.qa("[role='dialog']").length, 0, "no modal");
  // Toggling the open one closes it.
  await openSel(s, "gift");
  assert.equal(s.tid("detail-gift-cmp_1"), null);
});

test("F1: a selector CTA reports its own open state", async () => {
  const s = await mount(cardEl());
  const cta = s.tid("selector-audience-cta-cmp_1");
  assert.equal(cta.getAttribute("aria-expanded"), "false");
  assert.equal(cta.getAttribute("aria-controls"), "c-cmp_1-detail-audience");
  await openSel(s, "audience");
  assert.equal(s.tid("selector-audience-cta-cmp_1").getAttribute("aria-expanded"), "true");
});

test("F1: the summaries report the DRAFT, so an unsaved edit shows immediately", async () => {
  const s = await mount(cardEl({ audienceRefs: [] }, { isOwner: true }));
  assert.match(s.tid("selector-audience-value-cmp_1").textContent, /nobody yet/i);
  await openSel(s, "audience");
  await act(async () => { s.q("#c-cmp_1-aud-employee").click(); });
  assert.match(s.tid("selector-audience-value-cmp_1").textContent, /2 contacts/);
});

// ── inline rename ──────────────────────────────────────────────────────────────────────────────
test("F1: the pencil opens an inline editor seeded with the persisted name", async () => {
  const s = await mount(cardEl({ name: "Employee Milestones" }, { isOwner: true }));
  assert.equal(s.tid("card-rename-form-cmp_1"), null, "closed until asked for");
  await click(s.tid("card-rename-cmp_1"));
  const input = s.tid("card-rename-input-cmp_1");
  assert.ok(input, "an inline editor, in the same tile");
  assert.equal(input.value, "Employee Milestones");
  assert.equal(input.maxLength, 120, "mirrors the server's cap");
  assert.equal(s.qa("[role='dialog']").length, 0, "never a modal");
});

test("F1: Save Name calls the rename endpoint exactly once", async () => {
  const s = await mount(cardEl({ name: "Before" }, { isOwner: true }));
  await click(s.tid("card-rename-cmp_1"));
  await setValue(s.tid("card-rename-input-cmp_1"), "Executive Birthdays");
  calls.length = 0;
  await click(s.tid("card-rename-save-cmp_1"));
  const sent = calls.filter((c) => c[0] === "renameCampaign");
  assert.equal(sent.length, 1, "exactly one call");
  assert.equal(sent[0][2], "cmp_1");
  assert.equal(sent[0][3], "Executive Birthdays");
});

test("F1: Cancel restores the persisted name and calls nothing", async () => {
  const s = await mount(cardEl({ name: "Original" }, { isOwner: true }));
  await click(s.tid("card-rename-cmp_1"));
  await setValue(s.tid("card-rename-input-cmp_1"), "Discarded");
  calls.length = 0;
  await click(s.tid("card-rename-cancel-cmp_1"));
  assert.equal(calls.length, 0, "a local discard touches no endpoint");
  assert.equal(s.tid("card-rename-form-cmp_1"), null, "the editor closed");
  assert.equal(s.tid("card-title-cmp_1").textContent, "Original", "the persisted name is intact");
});

test("F1: an unchanged normalised name fires ZERO calls", async () => {
  const s = await mount(cardEl({ name: "Client Appreciation" }, { isOwner: true }));
  await click(s.tid("card-rename-cmp_1"));
  await setValue(s.tid("card-rename-input-cmp_1"), "   Client Appreciation   ");
  calls.length = 0;
  await click(s.tid("card-rename-save-cmp_1"));
  assert.equal(calls.filter((c) => c[0] === "renameCampaign").length, 0, "padding is not a change");
  assert.equal(s.tid("card-rename-form-cmp_1"), null, "and it simply closes");
});

test("F1: a FAILED rename preserves the persisted title and explains itself", async () => {
  const failing = { ...fakeClient, renameCampaign: () => Promise.resolve({ ok: false, status: 400, error: "name_too_long" }) };
  const s = await mount(cardEl({ name: "Safe Original" }, { isOwner: true, client: failing }));
  await click(s.tid("card-rename-cmp_1"));
  await setValue(s.tid("card-rename-input-cmp_1"), "x".repeat(200));
  await click(s.tid("card-rename-save-cmp_1"));
  assert.equal(s.tid("card-title-cmp_1").textContent, "Safe Original", "no optimistic title survives a failure");
  assert.match(s.tid("card-msg-cmp_1").textContent, /too long/i);
});

test("F1: rename fails closed for a non-owner and for a locked campaign", async () => {
  const notOwner = await mount(cardEl({ name: "Locked Out" }, { isOwner: false }));
  assert.equal(notOwner.tid("card-rename-cmp_1").disabled, true, "a non-owner cannot rename");

  const lockedCard = await mount(cardEl({ name: "Frozen", lockStatus: "locked" }, { isOwner: true }));
  const pencil = lockedCard.tid("card-rename-cmp_1");
  assert.equal(pencil.disabled, true, "a locked campaign cannot be renamed");
  assert.match(pencil.getAttribute("title"), /unlock/i, "…and says why");
  calls.length = 0;
  await click(pencil);
  assert.equal(lockedCard.tid("card-rename-form-cmp_1"), null, "no editor opens");
  assert.equal(calls.length, 0);
});

test("F1: the editor submits by keyboard and cancels on Escape", async () => {
  const s = await mount(cardEl({ name: "Before" }, { isOwner: true }));
  await click(s.tid("card-rename-cmp_1"));
  await setValue(s.tid("card-rename-input-cmp_1"), "Typed By Keyboard");
  calls.length = 0;
  // A form submit is what Enter does in a text input inside a form.
  await act(async () => { s.tid("card-rename-form-cmp_1").dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.equal(calls.filter((c) => c[0] === "renameCampaign").length, 1, "Enter saves");

  const s2 = await mount(cardEl({ name: "Before" }, { isOwner: true }));
  await click(s2.tid("card-rename-cmp_1"));
  await act(async () => {
    s2.tid("card-rename-input-cmp_1").dispatchEvent(new dom.window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  assert.equal(s2.tid("card-rename-form-cmp_1"), null, "Escape cancels");
});

// ── layout + accessibility ─────────────────────────────────────────────────────────────────────
test("F1: the viewport is sized for four collapsed tiles and scrolls only vertically", async () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  const block = css.slice(css.indexOf(".gcd-scroll {"), css.indexOf("}", css.indexOf(".gcd-scroll {")));
  assert.match(block, /max-height:\s*calc\(\(var\(--gcd-tile-h\) \* 4\)/, "four tiles plus their gaps");
  assert.match(block, /overflow-y:\s*auto/, "the list scrolls vertically");
  assert.match(block, /overflow-x:\s*hidden/, "and never sideways");
  // A tile must not carry its own scrollbar — only the list scrolls.
  const card = css.slice(css.indexOf(".gcd-card {"), css.indexOf("}", css.indexOf(".gcd-card {")));
  assert.equal(/overflow-y:\s*(auto|scroll)/.test(card), false, "no nested scrolling inside a tile");
});

test("F1: three selector columns on desktop, wrapping on tablet, stacked on mobile", async () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  const base = css.slice(css.indexOf(".gcd-selectors {"), css.indexOf("}", css.indexOf(".gcd-selectors {")));
  assert.match(base, /grid-template-columns:\s*repeat\(3,/, "desktop: three equal columns");

  const tablet = css.slice(css.indexOf("@media (max-width: 1024px)"));
  assert.match(tablet.slice(0, tablet.indexOf("}\n}")), /\.gcd-selectors \{ grid-template-columns: repeat\(2,/, "tablet: 2 + 1 wrap");

  const mobile = css.slice(css.lastIndexOf("@media (max-width: 720px)"));
  assert.match(mobile, /\.gcd-selectors \{ grid-template-columns: minmax\(0, 1fr\)/, "mobile: stacked");
  // Employees / Clients / Vendors sit side by side in the audience panel.
  assert.match(css, /\.gcd-detail--audience \.gcd-bubbles \{[\s\S]*?repeat\(3,/);
});

test("F1: focus is visible and motion is reducible", async () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  assert.match(css, /\.gcd-pencil:focus-visible[^{]*\{[\s\S]*?box-shadow/, "the pencil shows focus");
  assert.match(css, /\.gcd-expand:focus-visible|\.gcd-btn:focus-visible/, "buttons show focus");
  const rm = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert.match(rm, /transition:\s*none/, "motion is removable");
  assert.match(css, /\.gcd-chevron/, "the chevron is the expansion affordance");
});

test("F1: no invented merchandise concepts reach the user", async () => {
  const s = await mount(cardEl());
  const text = s.host.textContent;
  for (const banned of [/underlay surface/i, /overlay premium/i, /classic wood board/i, /personalize it/i]) {
    assert.equal(banned.test(text), false, String(banned));
  }
});
