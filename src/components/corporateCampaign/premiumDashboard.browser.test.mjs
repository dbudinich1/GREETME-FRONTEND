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
const click = async (el) => { await act(async () => { el.dispatchEvent(new dom.window.MouseEvent("click", { bubbles: true })); }); };

const campaign = (over = {}) => ({
  campaignId: "cmp_1", name: "Q4 Client Appreciation", approvalStatus: "draft", lockStatus: "unlocked",
  audienceRefs: [], deliveryConfig: { scheduleMode: null, status: "not_configured" }, ...over,
});

// ══ contact tiles ═══════════════════════════════════════════════════════════════════════════
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
  isOwner: false, busy: false, onOpenIndividualPicker: () => {}, onAfterMutate: async () => {}, ...props,
});

test("D: the card renders the same six sections in the same order at EVERY status", async () => {
  const states = [
    {}, { approvalStatus: "approved" }, { approvalStatus: "approved", lockStatus: "locked" },
    { lockStatus: "locked", deliveryConfig: { scheduleMode: "campaign_date", status: "scheduled" } },
    { lockStatus: "locked", deliveryConfig: { scheduleMode: "contact_saved_date", status: "active" } },
  ];
  for (const st of states) {
    const s = await mount(cardEl(st));
    const labels = s.qa(".gcd-section-label").map((n) => n.textContent);
    assert.deepEqual(labels, ["Audience", "Gift Option", "Featured Spread", "Schedule"], JSON.stringify(st));
    assert.ok(s.tid("card-status-cmp_1"), "header status");
    assert.ok(s.tid("card-footer-cmp_1"), "footer");
    // Every action stays present regardless of state.
    for (const a of ["save", "approve", "lock", "unlock", "schedule", "activate"]) {
      assert.ok(s.tid(`act-${a}-cmp_1`), `${a} must not disappear`);
    }
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
  for (const v of ["qrcash", "marketplace"]) {
    assert.equal(s.tid(`bubble-c-cmp_1-gift-${v}-reason`).textContent, "Individual funding required");
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
  await click(s.tid("act-save-cmp_1"));
  const [, , , body] = calls.find((c) => c[0] === "updateDeliveryConfig");
  assert.deepEqual(body.defaultGift, { type: "curated", maxSpendCents: 5000 });
  assert.equal(JSON.stringify(body).includes('"maxSpend"'), false);
  assert.equal(JSON.stringify(body).includes('"amount"'), false);
});

test("D: bubbles are real checkboxes/radios in circles — not pills", async () => {
  const s = await mount(cardEl());
  // Audience = multi-select checkboxes; gift/spread/schedule = single-select radios.
  for (const k of ["employee", "client", "vendor"]) assert.equal(s.q(`#c-cmp_1-aud-${k}`).type, "checkbox");
  for (const v of ["none", "curated"]) assert.equal(s.q(`#c-cmp_1-gift-${v}`).type, "radio");
  assert.equal(s.q("#c-cmp_1-mode-campaign_date").type, "radio");
  assert.equal(s.q("#c-cmp_1-spread-organization_default").type, "radio");
  // Radios in a group share one name → genuine single-select.
  assert.equal(s.q("#c-cmp_1-gift-none").name, s.q("#c-cmp_1-gift-curated").name);
  // The visual is a circle, and every control keeps a label + accessible description hook.
  assert.ok(s.qa(".gcd-dot").length >= 10);
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

  const owner = await mount(cardEl(locked, { isOwner: true }));
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
  await click(s.tid("act-save-cmp_1"));
  assert.ok(s.tid("card-msg-cmp_1"), "the failure is shown");
  assert.equal(s.tid("card-status-cmp_1").textContent, "Draft", "status did not advance on a failure");
});

test("D: category bubbles call setAudience with a deduplicated, unclassified-free ref list", async () => {
  const s = await mount(cardEl({ audienceRefs: ["e1"] }, { isOwner: true }));
  calls.length = 0;
  const box = s.q("#c-cmp_1-aud-employee");
  // A real click, so React's own value tracker sees the change exactly as a user would cause it.
  await act(async () => { box.click(); });
  await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
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

test("D: the campaign viewport is a fixed-height internal scroller", () => {
  const css = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  assert.match(css, /\.gcd-scroll\s*\{[\s\S]*?max-height:\s*\d+vh/, "a bounded height");
  assert.match(css, /\.gcd-scroll\s*\{[\s\S]*?overflow-y:\s*auto/, "scrolls internally");
  assert.match(css, /\.gcd-panel-head\s*\{[\s\S]*?position:\s*sticky/, "the header + Add CTA stay visible");
  assert.match(css, /\.gcd-scroll::-webkit-scrollbar-thumb/, "a visible premium scrollbar treatment");
  assert.match(css, /\.gcd-card \+ \.gcd-card\s*\{\s*margin-top:\s*28px/, "generous separation between cards");
  // Responsive: tiles collapse rather than clip, and actions stay reachable.
  assert.match(css, /@media \(max-width: 1024px\)[\s\S]*?\.gcd-tiles\s*\{\s*grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media \(max-width: 720px\)[\s\S]*?\.gcd-tiles\s*\{\s*grid-template-columns:\s*1fr/);
  assert.match(css, /\.gcd-tiles\s*\{\s*display:\s*grid;\s*grid-template-columns:\s*repeat\(3/, "three in one row on desktop");
});
