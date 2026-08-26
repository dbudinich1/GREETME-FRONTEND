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
after(() => { for (const f of [ENTRY, BUNDLE, BUNDLE.replace(/\.mjs$/, ".css")]) { try { rmSync(f); } catch { /* already gone */ } } });

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
test("E5: every tile offers Manage and Add - and NO separate Import", async () => {
  // Import ran the SAME handler to the SAME route with the same mode and category as Add. Two
  // controls for one capability is not a choice, it is a question the reader cannot answer, so
  // the duplicate is gone and Add is the single route into the wizard.
  const s = await mount(React.createElement(ContactTiles, { contacts: CONTACTS }));
  for (const k of ["employee", "client", "vendor"]) {
    assert.ok(s.tid(`tile-${k}-manage`), `${k} manage`);
    assert.ok(s.tid(`tile-${k}-add`), `${k} add`);
    assert.equal(s.tid(`tile-${k}-import`), null, `${k} has no separate Import button`);
  }
  // Belt and braces: no tile anywhere renders a control labelled exactly "Import".
  const labels = [...document.querySelectorAll(".gcd-tile-actions button")].map((b) => b.textContent.trim());
  assert.equal(labels.includes("Import"), false, `no Import label remains: ${JSON.stringify(labels)}`);
  assert.deepEqual(labels, ["Manage", "Add Employee", "Manage", "Add Client", "Manage", "Add Vendor"]);
});

test("E5: Manage reads Manage when closed and Hide when expanded, and says so to assistive tech", async () => {
  const s = await mount(React.createElement(ContactTiles, { contacts: CONTACTS }));
  const btn = () => s.tid("tile-employee-manage");
  assert.equal(btn().textContent.trim(), "Manage");
  assert.equal(btn().getAttribute("aria-expanded"), "false");
  assert.equal(btn().getAttribute("aria-controls"), "tile-employee-roster");

  await click(btn());
  assert.equal(btn().textContent.trim(), "Hide", "the label flips while the roster is open");
  assert.equal(btn().getAttribute("aria-expanded"), "true");
  assert.equal(btn().getAttribute("aria-controls"), "tile-employee-roster", "still points at its roster");

  await click(btn());
  assert.equal(btn().textContent.trim(), "Manage", "and back again");
  assert.equal(btn().getAttribute("aria-expanded"), "false");
});

test("E5: each Add routes to the import wizard with its OWN category, and nothing else fires", async () => {
  // The exact contract the surface supplies: mode=corporate plus this tile's category key.
  const routed = [];
  const s = await mount(React.createElement(ContactTiles, {
    contacts: CONTACTS,
    onAddCategory: (key) => routed.push(`/dashboard/import-wizard?mode=corporate&category=${encodeURIComponent(key)}`),
  }));
  for (const k of ["employee", "client", "vendor"]) await click(s.tid(`tile-${k}-add`));
  assert.deepEqual(routed, [
    "/dashboard/import-wizard?mode=corporate&category=employee",
    "/dashboard/import-wizard?mode=corporate&category=client",
    "/dashboard/import-wizard?mode=corporate&category=vendor",
  ]);
  // Removing Import must not have quietly turned Manage into a second router.
  const manageRouted = [];
  const s2 = await mount(React.createElement(ContactTiles, {
    contacts: CONTACTS, onAddCategory: (k) => manageRouted.push(k),
  }));
  await click(s2.tid("tile-employee-manage"));
  assert.deepEqual(manageRouted, [], "Manage routes nowhere - it opens the inline roster");
  assert.ok(s2.tid("tile-employee-roster"), "and the roster is what it opened");
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


test("F1C: an expanded card shows three complete cards and its schedule, at every state", async () => {
  const states = [
    {}, { approvalStatus: "approved" }, { approvalStatus: "approved", lockStatus: "locked" },
    { lockStatus: "locked", deliveryConfig: { scheduleMode: "campaign_date", status: "scheduled" } },
    { lockStatus: "locked", deliveryConfig: { scheduleMode: "contact_saved_date", status: "active" } },
  ];
  for (const st of states) {
    const s = await mount(cardEl(st));
    for (const key of ["audience", "gift", "spread"]) {
      assert.ok(s.tid(`selector-${key}-cmp_1`), `${key} card must be visible — ${JSON.stringify(st)}`);
    }
    assert.ok(s.tid("c-cmp_1-schedule"), "the schedule stays beneath the cards");
    assert.ok(s.tid(`card-sched-summary-cmp_1`), "and states what the campaign will do");
    assert.ok(s.tid("act-save-cmp_1"), "Save is always present");
    assert.ok(s.tid("act-cancel-cmp_1"), "Cancel is always present");
  }
});

test("D: gift bubbles — Curated and No gift selectable; QR Cash and Greet-Me Gifts visibly disabled", async () => {
  const s = await mount(cardEl());
  for (const v of ["none", "curated", "qrcash", "marketplace"]) {
    assert.ok(s.tid(`bubble-c-cmp_1-gift-${v}`), `${v} must be VISIBLE`);
  }
  const input = (v) => s.q(`#c-cmp_1-gift-${v}`);
  assert.equal(input("none").disabled, false);
  assert.equal(input("curated").disabled, false);
  assert.equal(input("qrcash").disabled, true);
  assert.equal(input("marketplace").disabled, true);
  // FINAL POLISH - the two keep their bubbles and their disabled state, and carry NO reason text.
  for (const v of ["qrcash", "marketplace"]) {
    assert.equal(s.tid(`bubble-c-cmp_1-gift-${v}-reason`), null, `${v} prints no explanation`);
    assert.ok(s.tid(`bubble-c-cmp_1-gift-${v}`), `${v} is still on screen`);
  }
  // Truthful wording, and no Gift Card anywhere.
  assert.equal(/unavailable|unsupported|not offered|coming soon/i.test(s.text()), false);
  assert.equal(/gift card/i.test(s.text()), false);
});

test("D: the Curated tier control persists CENTS and is described as private", async () => {
  const s = await mount(cardEl({ deliveryConfig: { scheduleMode: "campaign_date", defaultGift: { type: "curated", maxSpendCents: 5000 } } }));
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

test("F1C: every choice is a real checkbox or radio behind a substantial circle", async () => {
  const s = await mount(cardEl());
  for (const k of ["employee", "client", "vendor"]) assert.equal(s.q(`#c-cmp_1-aud-${k}`).type, "checkbox");
  for (const v of ["none", "curated", "qrcash", "marketplace"]) assert.equal(s.q(`#c-cmp_1-gift-${v}`).type, "radio");
  for (const v of ["organization_default", "saved_spread", "customize"]) assert.equal(s.q(`#c-cmp_1-spread-${v}`).type, "radio");
  // Radios in a group share one name → genuine single-select.
  assert.equal(s.q("#c-cmp_1-gift-none").name, s.q("#c-cmp_1-gift-curated").name);
  // The visual is a circle, and every control keeps its label.
  assert.ok(s.qa(".gcd-wcard .gcd-dot").length >= 10, "a circle per choice");
  for (const el of s.qa(".gcd-wcard .gcd-bubble input")) {
    assert.ok(s.q(`label[for="${el.id}"]`), `${el.id} must have a label`);
  }
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



test("F1C: a failed save surfaces a message and never fakes success", async () => {
  const failing = { ...fakeClient, updateDeliveryConfig: () => Promise.resolve({ ok: false, status: 400, error: "delivery_config_invalid_date" }) };
  const s = await mount(cardEl({ deliveryConfig: { scheduleMode: "campaign_date" } }, { client: failing }));
  await act(async () => { s.q("#c-cmp_1-aud-employee").click(); });
  await click(s.tid("act-save-cmp_1"));
  assert.ok(s.tid("card-msg-cmp_1"), "the failure is shown");
});

test("D: category bubbles call setAudience with a deduplicated, unclassified-free ref list", async () => {
  const s = await mount(cardEl({ audienceRefs: ["e1"] }, { isOwner: true }));
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
test("F1C: the rail names its campaign, and no longer prints a lifecycle word", async () => {
  const s = await mount(cardEl({ name: "Season’s Greetings", approvalStatus: "approved" }));
  const ctx = s.tid("rail-context-cmp_1");
  assert.equal(ctx.textContent.replace(/\s+/g, " ").trim(), "Season’s Greetings");
  assert.equal(ctx.getAttribute("title"), "Season’s Greetings");
  assert.equal(/Approved|Locked|Scheduled/.test(ctx.textContent), false, "no lifecycle word");
});


test("F1C: two campaigns produce two DISTINCT rail identities", async () => {
  const a = await mount(cardEl({ name: "Season’s Greetings" }));
  assert.equal(a.tid("rail-context-cmp_1").textContent.trim(), "Season’s Greetings");
  const other = { ...campaign({ name: "Client Birthdays" }), campaignId: "cmp_2" };
  const b = await mount(React.createElement(CampaignCard, {
    campaign: other, contacts: CONTACTS, orgId: "org1", client: fakeClient, isOwner: false, busy: false,
    onOpenIndividualPicker: () => {}, onAfterMutate: async () => {}, expanded: true, onToggleExpanded: () => {},
  }));
  assert.equal(b.tid("rail-context-cmp_2").textContent.trim(), "Client Birthdays");
  assert.equal(a.tid("rail-context-cmp_2"), null, "keyed by campaign id");
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

test("F1C: the switch shows the SERVER's answer and carries an accessible label", async () => {
  const on = await mount(cardEl({ ...READY, enabled: true }, { isOwner: true }));
  assert.equal(on.tid("card-toggle-cmp_1").checked, true);
  assert.match(on.tid("card-toggle-cmp_1").getAttribute("aria-label"), /^Disable .* campaign$/);

  const off = await mount(cardEl({ ...READY, enabled: false }, { isOwner: true }));
  assert.equal(off.tid("card-toggle-cmp_1").checked, false);
  assert.match(off.tid("card-toggle-cmp_1").getAttribute("aria-label"), /^Enable .* campaign$/);

  // A campaign stored before the switch existed is RUNNING, and must not be shown as off.
  const legacy = await mount(cardEl(READY, { isOwner: true }));
  assert.equal(legacy.tid("card-toggle-cmp_1").checked, true, "absent enabled reads as on");
  // The visible On/Off word is gone; the accessible name carries the meaning.
  assert.equal(legacy.tid("card-toggle-label-cmp_1"), null);
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
  await tick(s, "#c-cmp_1-aud-employee");
  calls.length = 0;
  await click(s.tid("act-save-cmp_1"));
  assert.deepEqual(calls.find((c) => c[0] === "setAudience")[3], ["c1"], "the individual pick is not collateral");
});

test("E5: working the switch does NOT discard unsaved edits", async () => {
  // The switch refetches, which hands the card a brand-new campaign object. Resyncing on object
  // identity would wipe the buffer here; resyncing on VALUE leaves it alone.
  const s = await mount(cardEl({ audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true }));
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
  await tick(s, "#c-cmp_1-aud-employee");
  calls.length = 0;
  await click(s.tid("act-save-cmp_1"));
  const names = calls.map((c) => c[0]).filter((n) => n === "setAudience" || n === "updateDeliveryConfig");
  assert.deepEqual(names, ["setAudience", "updateDeliveryConfig"]);
});

test("E5: a schedule-only change does not rewrite the audience", async () => {
  const s = await mount(cardEl({ audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date", timeZone: "UTC" } }, { isOwner: true }));
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
  const first = s.q("#c-cmp_1-gift-none");
  assert.ok(first, "No gift is present");
  assert.equal(first.checked, true, "…and selected when nothing is configured");
  assert.equal(s.tid("card-tier-cmp_1"), null, "no spend control until a gift is chosen");
});

test("F1C: a very long name truncates rather than overflowing", async () => {
  const long = "Q4 Global Client Appreciation and Partner Recognition Programme for the Americas Region";
  const s = await mount(cardEl({ name: long }));
  assert.equal(s.tid("rail-context-cmp_1").getAttribute("title"), long, "the full name stays accessible");
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  const name = css.slice(css.indexOf(".gcd-actions-id-name {"), css.indexOf("}", css.indexOf(".gcd-actions-id-name {")));
  assert.match(name, /text-overflow:\s*ellipsis/);
  assert.match(name, /white-space:\s*nowrap/);
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





test("F1C: dormant execution still explains itself, in the approved wording", async () => {
  // The Schedule and Activate BUTTONS are gone from the surface, but dormancy must still be
  // visible and must still be the server's own reason — not a cheerful silence.
  const s = await mount(cardEl(LOCKED_SCHEDULABLE, { isOwner: true, canAuthorizeRun: false }));
  const blocked = s.tid("card-blocked-cmp_1");
  assert.ok(blocked, "the blocked next step still explains itself");
  assert.equal(blocked.textContent, "Campaign sending is not active yet.");
  for (const rejected of [/unavailable/i, /not offered/i, /unsupported/i, /coming soon/i]) {
    assert.equal(rejected.test(s.host.textContent), false, String(rejected));
  }
});


test("E3: Save Changes stays usable while execution is dormant and the campaign is unlocked", async () => {
  calls.length = 0;
  const unlocked = { approvalStatus: "approved", lockStatus: "unlocked", audienceRefs: ["e1"],
    deliveryConfig: { scheduleMode: "campaign_date", status: "configured" } };
  const s = await mount(cardEl(unlocked, { isOwner: true, canAuthorizeRun: false }));
  // SLICE E5 - Save is dirty-gated, so make a change first; the point of the test is that
  // dormancy does not disable it, not that it is clickable with nothing to save.
  await act(async () => { s.q("#c-cmp_1-aud-client").click(); });
  const save = s.tid("act-save-cmp_1");
  assert.equal(save.disabled, false, "configuration is not execution");
  await click(save);
  assert.equal(calls.filter((c) => c[0] === "updateDeliveryConfig").length, 1, "the config write really happens");
});

test("F1C: an execution 503 from any call reports upward and advances nothing", async () => {
  let told = false;
  const dormantClient = { ...fakeClient, setCampaignEnabled: () => Promise.resolve({ ok: false, dormant: true, status: 503, reason: "corporate_campaign_execution_disabled" }) };
  const s = await mount(cardEl({ ...READY, enabled: false, approvalStatus: "approved", lockStatus: "locked" },
    { isOwner: true, client: dormantClient, onExecutionDormant: () => { told = true; } }));
  await click(s.tid("card-toggle-cmp_1"));
  assert.equal(told, true, "the dashboard is told the interlock closed");
  assert.equal(s.tid("card-toggle-cmp_1").checked, false, "and nothing was optimistically switched on");
});

test("F1C: a MANAGEMENT dormancy 503 is reported differently and does not close execution", async () => {
  let told = false;
  const mgmtDormant = { ...fakeClient, updateDeliveryConfig: () => Promise.resolve({ ok: false, dormant: true, status: 503, reason: "campaign_featured_spread_disabled" }) };
  const s = await mount(cardEl({ deliveryConfig: { scheduleMode: "campaign_date" } },
    { isOwner: true, client: mgmtDormant, onExecutionDormant: () => { told = true; } }));
  await act(async () => { s.q("#c-cmp_1-aud-employee").click(); });
  await click(s.tid("act-save-cmp_1"));
  assert.equal(told, false, "a management 503 must not be mistaken for the execution interlock");
  assert.ok(s.tid("card-msg-cmp_1"));
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

test("F1C: a collapsed tile shows its title and controls, and none of the configuration", async () => {
  const s = await mount(collapsed({ name: "Season\u2019s Greetings", campaignType: "Seasonal" }));
  assert.equal(s.tid("card-title-cmp_1").textContent, "Season\u2019s Greetings");
  assert.ok(s.tid("card-next-cmp_1"), "concise next-step guidance");
  assert.ok(s.tid("card-rename-cmp_1"), "edit pencil beside the title");
  assert.ok(s.tid("card-expand-cmp_1"), "expansion control");
  assert.ok(s.tid("card-toggle-cmp_1"), "one enable toggle");
  // SLICE F1C — the lifecycle ceremony is no longer on the surface.
  assert.equal(s.tid("card-status-cmp_1"), null, "no Approved chip");
  assert.equal(s.tid("card-type-cmp_1"), null, "no campaign-type label");
  assert.equal(s.tid("card-toggle-label-cmp_1"), null, "no visible On/Off text");
  // Collapsed means collapsed.
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

test("F1C: expanding shows the banner and three complete cards", async () => {
  const s = await mount(cardEl({ name: "Vendor Appreciation" }));
  assert.ok(s.q(".gcd-tile-head--banner"), "the header becomes a full-width banner");
  assert.equal(s.tid("card-expand-cmp_1").getAttribute("aria-expanded"), "true");
  assert.equal(s.tid("card-title-cmp_1").textContent, "Vendor Appreciation");
  assert.equal(s.qa("[data-testid^='card-rename-cmp_1']").length, 1, "exactly one pencil");
  for (const k of ["audience", "gift", "spread"]) assert.ok(s.tid(`selector-${k}-cmp_1`), k);
  // No lifecycle ceremony anywhere on the expanded surface either.
  for (const gone of ["act-approve-cmp_1", "act-lock-cmp_1", "act-unlock-cmp_1", "act-schedule-cmp_1", "act-activate-cmp_1"]) {
    assert.equal(s.tid(gone), null, `${gone} must not be a button`);
  }
});

test("F1B: all three configuration cards are COMPLETE and visible at once", async () => {
  // The correction: no summary/detail step. Every primary option is on screen immediately, and
  // all three cards are usable at the same time — so "who gets this" can be compared against
  // "what do they get" without closing one to see the other.
  const s = await mount(cardEl());
  for (const k of ["audience", "gift", "spread"]) assert.ok(s.tid(`selector-${k}-cmp_1`), `${k} card`);

  // Audience: all three categories, immediately.
  for (const k of ["employee", "client", "vendor"]) {
    assert.ok(s.q(`#c-cmp_1-aud-${k}`), `${k} bubble visible without another click`);
  }
  // Gift: all four, immediately — including the two that are disabled.
  for (const v of ["none", "curated", "qrcash", "marketplace"]) {
    assert.ok(s.q(`#c-cmp_1-gift-${v}`), `${v} bubble visible without another click`);
  }
  // Featured Spread: all three, immediately.
  for (const v of ["organization_default", "saved_spread", "customize"]) {
    assert.ok(s.q(`#c-cmp_1-spread-${v}`), `${v} bubble visible without another click`);
  }
});

test("F1B: no Change/Choose/Done CTA stands between a reader and a primary option", async () => {
  const s = await mount(cardEl());
  // The disclosure controls are gone entirely.
  for (const k of ["audience", "gift", "spread"]) {
    assert.equal(s.tid(`selector-${k}-cta-cmp_1`), null, `${k} has no reveal CTA`);
    assert.equal(s.tid(`detail-${k}-cmp_1`), null, `${k} has no hidden detail panel`);
  }
  // And no button inside the workspace merely reveals options.
  const ws = s.tid("card-selectors-cmp_1");
  const labels = [...ws.querySelectorAll("button")].map((b) => b.textContent.trim());
  for (const l of labels) {
    assert.equal(/^(Change|Choose|Open|Configure|Done)$/i.test(l), false, `"${l}" must not gate options`);
  }
  // The one button that remains opens the contact ROSTER, which is a list of people and cannot
  // sit in a bubble — its availability and count stay on the card.
  assert.ok(s.tid("card-individual-cmp_1"), "Select Individual Contacts stays reachable");
  assert.ok(s.tid("card-audience-total-cmp_1"), "…with a truthful count beside it");
});

test("F1B: a disabled gift choice stays VISIBLE and disabled, with its reason", async () => {
  // Removing an unavailable option would hide information a reader needs to understand the offer.
  const s = await mount(cardEl());
  for (const v of ["qrcash", "marketplace"]) {
    const el = s.q(`#c-cmp_1-gift-${v}`);
    assert.ok(el, `${v} is rendered`);
    assert.equal(el.disabled, true, `${v} is disabled`);
  }
  // The names stay. Only the explanatory sentence went.
  assert.match(s.tid("selector-gift-cmp_1").textContent, /QR Cash/);
  assert.match(s.tid("selector-gift-cmp_1").textContent, /Greet-Me Gifts/);
  for (const v of ["none", "curated"]) {
    assert.equal(s.q(`#c-cmp_1-gift-${v}`).disabled, false, `${v} is selectable`);
  }
});

test("F1B: the spread editor opens inline WITHOUT hiding the three spread choices", async () => {
  // The only secondary tools that still open on demand are the ones that cannot fit in a bubble.
  const s = await mount(cardEl({}, { isOwner: true }));
  assert.equal(s.tid("card-spread-editor-cmp_1"), null, "closed until Customize is chosen");

  await act(async () => { s.q("#c-cmp_1-spread-customize").click(); });
  assert.ok(s.tid("card-spread-editor-cmp_1"), "the existing editor opens inline");
  // …and the three principal choices are still on screen.
  for (const v of ["organization_default", "saved_spread", "customize"]) {
    assert.ok(s.q(`#c-cmp_1-spread-${v}`), `${v} still visible while the editor is in use`);
  }
  assert.equal(s.qa("[role='dialog']").length, 0, "no modal");
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

test("F1B: three complete cards on desktop, 2+1 on tablet, stacked on mobile", async () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  const base = css.slice(css.indexOf(".gcd-workspace {"), css.indexOf("}", css.indexOf(".gcd-workspace {")));
  assert.match(base, /grid-template-columns:\s*repeat\(3,/, "desktop: three side by side");
  assert.match(base, /align-items:\s*stretch/, "equal height");

  const tablet = css.slice(css.indexOf("@media (max-width: 1024px)"));
  assert.match(tablet, /\.gcd-workspace \{ grid-template-columns: repeat\(2,/, "tablet: two up");
  assert.match(tablet, /nth-child\(3\) \{ grid-column: 1 \/ -1/, "…with the third full width beneath");

  const mobile = css.slice(css.lastIndexOf("@media (max-width: 720px)"));
  assert.match(mobile, /\.gcd-workspace \{ grid-template-columns: minmax\(0, 1fr\)/, "mobile: stacked");

  // A configuration card must never grow its own scrollbar — every option is meant to be seen.
  const wcard = css.slice(css.indexOf(".gcd-wcard {"), css.indexOf("}", css.indexOf(".gcd-wcard {")));
  assert.equal(/overflow-y:\s*(auto|scroll)/.test(wcard), false, "no nested scrolling in a card");
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


// ══ SLICE F1C — founder contract: Save configures, the switch runs it ════════════════════════
test("FINAL POLISH: no purchase-completion typography is rendered, in any permutation", async () => {
  // The founder's instruction was to remove the sentence outright and NOT replace it with another
  // carrying the same message. So this asserts absence across every permutation given, over the
  // whole rendered card - not just the gift section.
  const s = await mount(cardEl());
  const banned = /needs a person|complete the purchase|person required|individual purchase|manual purchase|interactive funding|individual funding|requires someone|purchase separately|completed by a person/i;
  assert.equal(banned.test(s.host.textContent), false, "no purchase-completion wording is rendered");
  // The two gifts are still named and still on screen - removal of the sentence removed nothing else.
  assert.match(s.tid("selector-gift-cmp_1").textContent, /QR Cash/);
  assert.match(s.tid("selector-gift-cmp_1").textContent, /Greet-Me Gifts/);
  for (const v of ["qrcash", "marketplace"]) {
    assert.equal(s.q(`#c-cmp_1-gift-${v}`).disabled, true, `${v} still truthfully unavailable`);
    assert.ok(s.q(`#c-cmp_1-gift-${v}`), `${v} still visible`);
  }
});

test("F1C: a shared-date campaign never offers the contact-saved-date mode", async () => {
  // Season's Greetings sends on one date. Offering the per-contact mode invited a reader to pick
  // the one that cannot work for their campaign.
  const s = await mount(cardEl({ name: "Season\u2019s Greetings", deliveryConfig: { scheduleMode: "campaign_date" } }));
  assert.equal(s.q("#c-cmp_1-mode-contact_saved_date"), null, "no per-contact option");
  assert.equal(s.q("#c-cmp_1-mode-campaign_date"), null, "and no mode question at all");
  assert.match(s.tid("card-sched-summary-cmp_1").textContent, /same moment/i);
  assert.ok(s.tid("card-when-cmp_1"), "a date field");
  assert.ok(s.tid("card-tz-cmp_1"), "and a time zone");
});

test("F1C: a contact-driven campaign shows its saved-date behaviour directly", async () => {
  const s = await mount(cardEl({ name: "Client Birthdays", deliveryConfig: { scheduleMode: "contact_saved_date", occasionType: "birthday" } }));
  assert.match(s.tid("card-sched-summary-cmp_1").textContent, /each contact's birthday/i);
  assert.match(s.tid("card-sched-summary-cmp_1").textContent, /every year/i);
  assert.equal(s.tid("card-when-cmp_1"), null, "no shared date is asked for");
  assert.ok(s.tid("card-occasion-cmp_1"), "the occasion is shown");
});

test("F1C: the lifecycle chain is gone from the surface but intact in the model", async () => {
  const s = await mount(cardEl(LOCKED_SCHEDULABLE, { isOwner: true, canAuthorizeRun: true }));
  for (const gone of ["act-approve-cmp_1", "act-lock-cmp_1", "act-unlock-cmp_1", "act-schedule-cmp_1", "act-activate-cmp_1"]) {
    assert.equal(s.tid(gone), null, `${gone} is not a button`);
  }
  assert.ok(s.tid("act-save-cmp_1"), "Save remains");
  assert.ok(s.tid("act-cancel-cmp_1"), "Cancel remains");
  // Nothing was deleted from the model — deriveActions still computes all seven.
  const src = readFileSync(new URL("./corporateDashboardModel.js", import.meta.url), "utf8");
  for (const k of ["approve", "lock", "unlock", "schedule", "activate"]) {
    assert.match(src, new RegExp(`\\b${k}:\\s*\\{`), `${k} still computed`);
  }
});

test("F1C: no raw Unicode escape sequence renders anywhere on the card", async () => {
  const s = await mount(cardEl({ audienceRefs: [] }, { isOwner: true }));
  await act(async () => { s.q("#c-cmp_1-aud-employee").click(); });
  assert.ok(s.tid("card-dirty-cmp_1"), "the unsaved notice is showing");
  assert.equal(/\\u[0-9a-fA-F]{4}/.test(s.host.textContent), false, "no literal escape sequence");
  assert.match(s.tid("card-dirty-cmp_1").textContent, /Unsaved changes - nothing is sent until you save\./);
});


// == FINAL POLISH - the three founder corrections ==============================================

test("FINAL POLISH 1: the campaign viewport is rounded at the bottom and clips its content", () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  const scroll = css.slice(css.indexOf(".gcd-scroll {"));
  const rule = scroll.slice(0, scroll.indexOf("}"));

  // ROOT CAUSE of the sharp edge: .gcd-panel was rounded but never clipped, so .gcd-scroll's
  // opaque white background painted square corners proud of the panel's curve.
  assert.match(rule, /border-bottom-left-radius:\s*calc\(var\(--gcd-radius\)/, "bottom-left is rounded");
  assert.match(rule, /border-bottom-right-radius:\s*calc\(var\(--gcd-radius\)/, "bottom-right is rounded");
  // The radius only clips when overflow is non-visible - that is what keeps tiles and the
  // scrollbar inside the curve rather than protruding through it.
  assert.match(rule, /overflow-y:\s*auto/, "still a scroll container, so the radius clips");
  assert.match(rule, /overflow-x:\s*hidden/);

  // The panel itself is rounder than before, so the two agree.
  assert.match(css, /--gcd-radius:\s*22px/, "panel radius raised to 22px");

  // The scrollbar track is held clear of the corners so its square end cannot square them off.
  assert.match(css, /scrollbar-track\s*\{[^}]*margin:\s*8px 0 16px/, "track inset from the bottom curve");

  // Height and scrolling behaviour are untouched by this correction.
  assert.match(rule, /max-height:\s*calc\(\(var\(--gcd-tile-h\) \* 4\)/, "four-tile height unchanged");
  assert.match(rule, /overscroll-behavior:\s*contain/);
});

test("FINAL POLISH 2: colour is strengthened, never lightened", () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  const root = css.slice(css.indexOf(".gcd-root {"), css.indexOf("/* The dimensional underlay"));

  // Each pale original is GONE and a stronger value stands in its place. Because every change moves
  // toward more contrast, no ratio measured before this polish can have regressed.
  const strengthened = [
    [/--gcd-ink:\s*#141024/, /#1b1830/, "body ink"],
    [/--gcd-faint:\s*#635e7d/, /--gcd-faint:\s*#928ea8/, "section headings"],
    [/--gcd-purple:\s*#5b48ea/, /--gcd-purple:\s*#6d5cf0/, "Greet-Me purple"],
    [/--gcd-line:\s*rgba\(24, 21, 44, 0\.16\)/, /rgba\(27, 24, 48, 0\.10\)/, "card boundaries"],
    [/--gcd-line-strong:\s*rgba\(24, 21, 44, 0\.24\)/, /rgba\(27, 24, 48, 0\.16\)/, "strong boundaries"],
  ];
  for (const [present, absent, label] of strengthened) {
    assert.match(root, present, `${label} strengthened`);
    assert.equal(absent.test(root), false, `${label}: pale original removed`);
  }

  // The selected bubble is unmistakable: deeper fill AND a firmer border.
  const checked = css.slice(css.indexOf(".gcd-wcard .gcd-bubble:has(input:checked)"));
  assert.match(checked.slice(0, checked.indexOf("}")), /background:\s*rgba\(91, 72, 234, \.15\)/);
  assert.match(checked.slice(0, checked.indexOf("}")), /border-color:\s*rgba\(91, 72, 234, \.48\)/);

  // Cards read as raised because the page ground beneath them went deeper, not because the cards
  // went brighter - white is already the ceiling.
  assert.match(css, /linear-gradient\(180deg, #f6f3fe 0%, #eee9fb 100%\)/, "deeper page ground");
  assert.equal(/linear-gradient\(180deg, #fbfaff 0%, #f6f4fd 100%\)/.test(css), false, "washed-out ground gone");

  // The campaign viewport now has a visible boundary of its own.
  const scrollRule = css.slice(css.indexOf(".gcd-scroll {"));
  assert.match(scrollRule.slice(0, scrollRule.indexOf("}")), /border-top:\s*1px solid var\(--gcd-line\)/);
});

test("FINAL POLISH 2: strengthening did not disturb the vertical bubble layout", () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  const group = css.slice(css.indexOf(".gcd-wcard .gcd-bubbles,"));
  assert.match(group.slice(0, group.indexOf("}")), /flex-direction:\s*column/, "choices still stack vertically");
  // And the targets are still substantial.
  assert.match(css, /\.gcd-wcard \.gcd-dot \{[^}]*width:\s*44px/);
});

test("FINAL POLISH 3: no purchase-completion wording survives anywhere in the changed surface", () => {
  const banned = /needs a person|complete the purchase|person required|individual purchase|manual purchase|interactive funding|individual funding|requires someone|purchase separately|completed by a person/i;
  for (const f of ["corporateDashboardModel.js", "CampaignCard.jsx", "premiumDashboard.css",
    "GreetingAutomationCampaigns.jsx", "campaignSurfaceModel.js"]) {
    const src = readFileSync(new URL(`./${f}`, import.meta.url), "utf8");
    assert.equal(banned.test(src), false, `${f} carries no purchase-completion wording, even in comments`);
  }
});

test("FINAL POLISH 3: the two non-automatable gifts keep name, bubble and accessible disabled state", async () => {
  const s = await mount(cardEl());
  for (const v of ["qrcash", "marketplace"]) {
    const input = s.q(`#c-cmp_1-gift-${v}`);
    assert.ok(input, `${v} bubble is present`);
    assert.equal(input.disabled, true, `${v} is truthfully non-operable`);
    // Disabled state comes from the platform, so assistive technology announces it without prose.
    assert.equal(input.getAttribute("aria-describedby"), null, `${v} describes nothing - the sentence is gone`);
    assert.equal(s.tid(`bubble-c-cmp_1-gift-${v}-reason`), null, `${v} renders no reason text`);
  }
  // Their real names remain on screen.
  assert.match(s.host.textContent, /QR Cash/);
  assert.match(s.host.textContent, /Greet-Me Gifts/);
  // And the selectable pair is genuinely operable, so nothing was disabled by accident.
  for (const v of ["none", "curated"]) {
    assert.equal(s.q(`#c-cmp_1-gift-${v}`).disabled, false, `${v} remains selectable`);
  }
});
