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


// ══ SLICE D REFINEMENT — visible actions + scroll affordance ════════════════════════════════
test("R: the action rail sits between the header and Audience, and the actions MOVED there", async () => {
  const s = await mount(cardEl());
  const rail = s.tid("card-footer-cmp_1");
  assert.ok(rail, "the rail exists");
  const order = (el) => [...s.host.querySelectorAll("*")].indexOf(el);
  assert.ok(order(s.q("header.gcd-card-head")) < order(rail), "after the header");
  assert.ok(order(rail) < order(s.tid("c-cmp_1-audience")), "before Audience");
  // ...and before every other section, so it can never be scrolled past.
  for (const sec of ["gift", "spread", "schedule"]) {
    assert.ok(order(rail) < order(s.tid(`c-cmp_1-${sec}`)), `before ${sec}`);
  }
});

test("R: exactly six actions exist — moved, never duplicated", async () => {
  const s = await mount(cardEl());
  const buttons = s.qa("[data-testid^='act-']");
  assert.equal(buttons.length, 6, "six and only six");
  assert.deepEqual(buttons.map((b) => b.dataset.testid).sort(),
    ["act-activate-cmp_1", "act-approve-cmp_1", "act-lock-cmp_1", "act-save-cmp_1", "act-schedule-cmp_1", "act-unlock-cmp_1"]);
  // Every one lives INSIDE the rail — none left behind at the bottom of the card.
  const rail = s.tid("card-footer-cmp_1");
  for (const b of buttons) assert.ok(rail.contains(b), `${b.dataset.testid} must be in the rail`);
  assert.equal(s.qa(".gcd-actions").length, 1, "one rail per card");
  assert.equal(s.qa(".gcd-footer").length, 0, "the old bottom footer is gone, not duplicated");
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
  const block = css.slice(css.indexOf(".gcd-scroll {\n  background-color"), css.indexOf(".gcd-scroll::-webkit-scrollbar {"));
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
  }));
  const two = railText(b.tid("rail-context-cmp_2"));

  assert.equal(one, "Q4 Client Appreciation · Approved");
  assert.equal(two, "Team Birthdays · Active");
  assert.notEqual(one, two, "each rail identifies its OWN campaign");
  // The identity is keyed by campaign id, so one card can never render another's.
  assert.equal(a.tid("rail-context-cmp_2"), null);
  assert.equal(b.tid("rail-context-cmp_1"), null);
});

test("I: each rail's six actions invoke ONLY their own campaign", async () => {
  const locked = { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } };
  const a = await mount(cardEl(locked, { isOwner: true, canAuthorizeRun: true })); // E3: capability required
  const other = { ...campaign({ ...locked, name: "Team Birthdays" }), campaignId: "cmp_2" };
  const b = await mount(React.createElement(CampaignCard, {
    campaign: other, contacts: CONTACTS, orgId: "org1", client: fakeClient, isOwner: true, busy: false,
    canAuthorizeRun: true, // E3: capability required
    onOpenIndividualPicker: () => {}, onAfterMutate: async () => {},
  }));

  // Both cards are locked, owned and campaign_date, so Schedule is genuinely enabled on each —
  // the same action from two rails must reach two different campaigns.
  calls.length = 0;
  await click(a.tid("act-schedule-cmp_1"));
  const afterFirst = calls.filter((c) => c[0] === "schedule");
  assert.equal(afterFirst.length, 1, "one rail, one call");
  assert.deepEqual([afterFirst[0][1], afterFirst[0][2]], ["org1", "cmp_1"], "card one acts on cmp_1");

  await click(b.tid("act-schedule-cmp_2"));
  const both = calls.filter((c) => c[0] === "schedule");
  assert.equal(both.length, 2);
  assert.deepEqual([both[1][1], both[1][2]], ["org1", "cmp_2"], "card two acts on cmp_2");
  // Neither rail ever reached the other's campaign.
  assert.equal(both.filter((c) => c[2] === "cmp_1").length, 1);
  assert.equal(both.filter((c) => c[2] === "cmp_2").length, 1);
  // Locking from card one likewise stays on cmp_1.
  calls.length = 0;
  await click(a.tid("act-unlock-cmp_1"));
  const unlocked = calls.filter((c) => c[0] === "unlock");
  assert.equal(unlocked.length, 1);
  assert.equal(unlocked[0][2], "cmp_1");
});

test("I: still exactly six actions per card — the label is not a seventh", async () => {
  const s = await mount(cardEl());
  const rail = s.tid("card-footer-cmp_1");
  assert.equal(s.qa("[data-testid^='act-']").length, 6);
  assert.equal(rail.querySelectorAll("button").length, 6, "the identity is not a button");
  assert.equal(s.tid("rail-context-cmp_1").tagName, "SPAN");
  assert.equal(s.qa("[data-testid^='rail-context-']").length, 1, "one identity per rail");
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
  assert.match(css, /\.gcd-scroll \{[\s\S]*?max-height:\s*min\(42vh,\s*460px\)/);
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
  const s = await mount(cardEl(LOCKED_SCHEDULABLE, { isOwner: true, canAuthorizeRun: false }));
  await click(s.tid("act-schedule-cmp_1"));
  await click(s.tid("act-activate-cmp_1"));
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

test("E3: the rail still carries exactly six actions", async () => {
  for (const canAuthorizeRun of [true, false]) {
    const s = await mount(cardEl(LOCKED_SCHEDULABLE, { isOwner: true, canAuthorizeRun }));
    const rail = s.tid("card-footer-cmp_1");
    assert.equal(rail.querySelectorAll("button").length, 6, `cap=${canAuthorizeRun}`);
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
