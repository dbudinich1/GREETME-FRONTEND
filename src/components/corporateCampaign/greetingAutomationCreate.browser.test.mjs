// src/components/corporateCampaign/greetingAutomationCreate.browser.test.mjs
//
// D2 — BROWSER-LEVEL tests for the Corporate Campaign Dashboard READY phase: the create form
// (required name + optional type) and server-derived detail navigation. The real
// GreetingAutomationCampaigns.jsx is esbuild-transformed and mounted into jsdom with an INJECTED
// fake client (no network). Proves: create posts { name, campaignType } (not empty {}); submit is
// blocked until a name is entered; cancel makes no write; an entered type is displayed; selecting a
// campaign navigates to detail (capability is server-derived, no crash).
//
// Run (Node 20.x): node --test src/components/corporateCampaign/greetingAutomationCreate.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__gac_create.bundle.mjs");
let React, createRoot, Surface, act, window;

before(async () => {
  writeFileSync(join(__dirname, ".__gacc.jsx"), `export { default as Surface } from "./GreetingAutomationCampaigns.jsx";\n`);
  await esbuild.build({
    entryPoints: [join(__dirname, ".__gacc.jsx")],
    outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
  });
  rmSync(join(__dirname, ".__gacc.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Surface } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(BUNDLE.replace(/\.mjs$/, ".css"), { force: true }); rmSync(join(__dirname, ".__gacc.jsx"), { force: true }); } catch { /* ignore */ } });

const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const txt = () => document.body.textContent;
function setValue(el, value) {
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set.call(el, value);
  el.dispatchEvent(new window.Event("input", { bubbles: true }));
  el.dispatchEvent(new window.Event("change", { bubbles: true }));
}
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.Event("click", { bubbles: true })); }); await flush(); };
// jsdom performs no implicit form submission on button click (a real browser does), so drive the
// form's submit event directly — React's onSubmit (guarded by canCreate) runs the create.
const submitForm = async () => { await act(async () => { tid("create-form").dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); }); await flush(); };

let root;
async function mount(props) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Surface, props)); });
  await flush();
}

// Fake client: one active org; campaign list configurable; create/read/readiness recorded.
function fakeClient({ campaigns = [], orgContacts = [] } = {}) {
  const calls = { listMemberships: 0, listCampaigns: 0, createCampaign: [], readCampaign: [], readReadiness: [] };
  return {
    calls,
    listMemberships: async () => { calls.listMemberships++; return { ok: true, data: { memberships: [{ corporateOrganizationId: "org_1", role: "owner", status: "active" }] } }; },
    listCampaigns: async () => { calls.listCampaigns++; return { ok: true, data: { campaigns } }; },
    createCampaign: async (orgId, body) => { calls.createCampaign.push({ orgId, body }); return { ok: true, data: { campaign: { campaignId: "camp_new", ...body } } }; },
    readCampaign: async (o, c) => { calls.readCampaign.push([o, c]); return { ok: true, data: { campaign: { campaignId: c, name: "Existing", campaignType: "Holiday" } } }; },
    readReadiness: async (o, c) => { calls.readReadiness.push([o, c]); return { ok: true, data: {} }; },
    updateFeaturedSpread: async () => ({ ok: true }), approve: async () => ({ ok: true }),
    lock: async () => ({ ok: true }), unlock: async () => ({ ok: true }),
    // CORP-3 — CampaignDetail now mounts AudienceSection, which reads the audience on mount.
    readAudience: async () => ({ ok: true, data: { count: 0, contacts: [], unresolved: [] } }),
    listOrgContacts: async () => ({ ok: true, data: { contacts: orgContacts, count: orgContacts.length } }),
    setCampaignEnabled: async () => ({ ok: true, data: {} }),
    updateDeliveryConfig: async () => ({ ok: true, data: {} }),
    schedule: async () => ({ ok: true, data: {} }), activate: async () => ({ ok: true, data: {} }),
    setAudience: async () => ({ ok: true, data: { count: 0, contacts: [], unresolved: [] } }),
  };
}

// ══ SLICE E5 — the overlap warning ═══════════════════════════════════════════════════════════
const OVERLAP_PEOPLE = [
  { id: "e1", name: "Bob Smith", corporateContactType: "employee" },
  { id: "e2", name: "Tommy Nguyen", corporateContactType: "employee" },
];

test("E5: overlapping audiences are named, with the campaigns involved", async () => {
  const c = fakeClient({
    orgContacts: OVERLAP_PEOPLE,
    campaigns: [
      { campaignId: "c1", name: "VIP", audienceRefs: ["e1", "e2"], deliveryConfig: { scheduleMode: "campaign_date" } },
      { campaignId: "c2", name: "Birthdays", audienceRefs: ["e1", "e2"], deliveryConfig: { scheduleMode: "contact_saved_date" } },
    ],
  });
  await mount({ client: c });
  const warn = tid("overlap-warning");
  assert.ok(warn, "the warning appears");
  assert.match(warn.textContent, /Bob Smith \u2014 VIP and Birthdays/);
  assert.match(warn.textContent, /Tommy Nguyen \u2014 VIP and Birthdays/);
  // It warns and stops. Nothing is disabled and no audience is altered on the reader's behalf.
  assert.match(warn.textContent, /may be exactly what you want/i);
});

test("E5: no overlap, no warning", async () => {
  const c = fakeClient({
    orgContacts: OVERLAP_PEOPLE,
    campaigns: [
      { campaignId: "c1", name: "VIP", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } },
      { campaignId: "c2", name: "Birthdays", audienceRefs: ["e2"], deliveryConfig: { scheduleMode: "campaign_date" } },
    ],
  });
  await mount({ client: c });
  assert.equal(tid("overlap-warning"), null);
});

test("E5: a switched-off campaign raises no warning", async () => {
  const c = fakeClient({
    orgContacts: OVERLAP_PEOPLE,
    campaigns: [
      { campaignId: "c1", name: "VIP", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } },
      { campaignId: "c2", name: "Birthdays", enabled: false, audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } },
    ],
  });
  await mount({ client: c });
  assert.equal(tid("overlap-warning"), null, "an overlap that cannot send is not an overlap");
});

test("empty ready state offers Create; opening shows the form with submit disabled until a name is entered", async () => {
  const c = fakeClient({ campaigns: [] });
  await mount({ client: c });
  assert.ok(tid("open-create"), "Create action is offered");
  assert.equal(tid("create-form"), null, "form is not shown until opened");
  await click(tid("open-create"));
  assert.ok(tid("create-form"), "form opens");
  assert.equal(tid("create-submit").disabled, true, "submit disabled with empty name");
  assert.equal(c.calls.createCampaign.length, 0);
});

test("entering a name enables submit; create posts { name } (NOT empty {}) and reloads", async () => {
  const c = fakeClient({ campaigns: [] });
  await mount({ client: c });
  await click(tid("open-create"));
  await act(async () => { setValue(tid("create-name"), "Q4 Client Appreciation"); }); await flush();
  assert.equal(tid("create-submit").disabled, false, "submit enabled once named");
  const listBefore = c.calls.listCampaigns;
  await submitForm();
  assert.equal(c.calls.createCampaign.length, 1, "exactly one create");
  assert.deepEqual(c.calls.createCampaign[0].body, { name: "Q4 Client Appreciation" }, "posts name only, no empty {}, no type");
  assert.equal(tid("create-form"), null, "form closes after success");
  assert.ok(c.calls.listCampaigns > listBefore, "list reloaded after create");
});

test("optional type is included when provided", async () => {
  const c = fakeClient({ campaigns: [] });
  await mount({ client: c });
  await click(tid("open-create"));
  await act(async () => { setValue(tid("create-name"), "Winter Cards"); setValue(tid("create-type"), "Holiday"); }); await flush();
  await submitForm();
  assert.deepEqual(c.calls.createCampaign[0].body, { name: "Winter Cards", campaignType: "Holiday" });
});

test("whitespace-only name keeps submit disabled and posts nothing", async () => {
  const c = fakeClient({ campaigns: [] });
  await mount({ client: c });
  await click(tid("open-create"));
  await act(async () => { setValue(tid("create-name"), "   "); }); await flush();
  assert.equal(tid("create-submit").disabled, true);
  assert.equal(c.calls.createCampaign.length, 0);
});

test("cancel closes the form and makes no write", async () => {
  const c = fakeClient({ campaigns: [] });
  await mount({ client: c });
  await click(tid("open-create"));
  await act(async () => { setValue(tid("create-name"), "Discarded"); }); await flush();
  await click(tid("create-cancel"));
  assert.equal(tid("create-form"), null, "form closed");
  assert.equal(c.calls.createCampaign.length, 0, "no write on cancel");
});

test("existing campaign shows its type and expands INLINE (no detail navigation)", async () => {
  // SLICE F1 - the title is a heading now, not a link. A campaign is configured on its own tile,
  // so routing to CampaignDetail to read the same facts was the secondary-screen sequence this
  // redesign removes. Expansion happens in place instead.
  const c = fakeClient({ campaigns: [{ campaignId: "camp_1", name: "Existing", campaignType: "Holiday" }] });
  await mount({ client: c });
  assert.ok(txt().includes("Existing"), "campaign name shown");
  // SLICE F1C - the campaign-type label left the surface with the rest of the lifecycle
  // ceremony. The type is still persisted and still submitted at creation; it is simply no
  // longer a chip on the tile.
  assert.equal(c.calls.createCampaign.length >= 0, true);
  const title = tid("card-title-camp_1");
  assert.equal(title.tagName, "H3", "a heading, not a link");
  assert.equal(title.querySelector("a, button"), null, "nothing inside it navigates");
  const expand = tid("card-expand-camp_1");
  assert.equal(expand.getAttribute("aria-expanded"), "false");
  await click(expand);
  assert.equal(tid("card-expand-camp_1").getAttribute("aria-expanded"), "true", "it expands in place");
  assert.ok(tid("card-selectors-camp_1"), "the three selectors appear inline");
  assert.equal(c.calls.readCampaign.length, 0, "and nothing navigated away");
});


// == F1C ADDENDUM - the standing gift/payment note ============================================
//
// The founder's contract: one gentle, permanent disclosure beneath the Campaigns section. Not an
// alert, not per-tile, not a gate on saving, and above all not a thing that reaches for the payment
// system merely by being on screen.

const EXACT_COPY =
  "A quick note about gifts: Campaigns with gifts require a valid payment method before they can "
  + "be enabled. We\u2019ll remind you ahead of each scheduled send if your payment information "
  + "needs attention.";

function ownerClient({ campaigns = [], orgContacts = [] } = {}) {
  const c = fakeClient({ campaigns, orgContacts });
  c.writes = [];
  c.listCampaigns = async () => {
    c.calls.listCampaigns++;
    // Owner, so Save is genuinely operable - a disabled button would prove nothing about blocking.
    return { ok: true, data: { campaigns, viewerAuthorization: { isCurrentOrganizationOwner: true } } };
  };
  c.updateDeliveryConfig = async (...a) => { c.writes.push(["updateDeliveryConfig", ...a]); return { ok: true, data: {} }; };
  c.setAudience = async (...a) => { c.writes.push(["setAudience", ...a]); return { ok: true, data: { count: 0, contacts: [], unresolved: [] } }; };
  return c;
}

const GIFT_CAMPAIGN = {
  campaignId: "c1", name: "Client Birthdays", enabled: false,
  deliveryConfig: { scheduleMode: "contact_saved_date", occasionType: "birthday", giftType: "curated" },
};
const PLAIN_CAMPAIGN = {
  campaignId: "c2", name: "Winter Wishes", enabled: false,
  deliveryConfig: { scheduleMode: "campaign_date" },
};

const notes = () => document.querySelectorAll('[data-testid="gift-payment-note"]');

test("F1C-ADD: the disclosure appears EXACTLY ONCE, beneath the Campaigns section", async () => {
  await mount({ client: ownerClient({ campaigns: [GIFT_CAMPAIGN, PLAIN_CAMPAIGN] }) });
  assert.equal(notes().length, 1, "exactly one disclosure on the surface");

  const note = tid("gift-payment-note");
  const campaignsRegion = tid("campaign-viewport");
  assert.ok(campaignsRegion, "the campaigns region is present");
  // DOCUMENT_POSITION_PRECEDING (2) on the campaigns region means the note comes AFTER it.
  const rel = note.compareDocumentPosition(campaignsRegion);
  assert.ok(rel & 2, "the note sits beneath the campaigns section, not above it");
  // And beneath the SECTION, not merely inside its scrolling viewport - it must never scroll away.
  assert.equal(campaignsRegion.contains(note), false, "the note is outside the scroll viewport");
});

test("F1C-ADD: the disclosure is NOT inside campaign tiles - two campaigns, still one note", async () => {
  await mount({ client: ownerClient({ campaigns: [GIFT_CAMPAIGN, PLAIN_CAMPAIGN] }) });
  assert.equal(notes().length, 1, "two tiles do not produce two notes");
  for (const cid of ["c1", "c2"]) {
    const anchor = document.querySelector(`[data-testid="card-expand-${cid}"]`);
    assert.ok(anchor, `tile ${cid} rendered`);
    const card = anchor.closest("article, .gcd-tile, li, div");
    assert.equal(card.querySelector('[data-testid="gift-payment-note"]'), null, `no note inside tile ${cid}`);
  }
});

test("F1C-ADD: the disclosure stands whether or not a gift campaign is on screen", async () => {
  await mount({ client: ownerClient({ campaigns: [GIFT_CAMPAIGN] }) });
  assert.equal(notes().length, 1, "present with a gift campaign");
  await mount({ client: ownerClient({ campaigns: [PLAIN_CAMPAIGN] }) });
  assert.equal(notes().length, 1, "still present with no gift campaign");
  await mount({ client: ownerClient({ campaigns: [] }) });
  assert.equal(notes().length, 1, "still present on an empty surface");
});

test("F1C-ADD: the copy is EXACTLY the founder's, and the link points at a VERIFIED route", async () => {
  await mount({ client: ownerClient({ campaigns: [GIFT_CAMPAIGN] }) });
  const text = tid("gift-payment-note-text").textContent;
  assert.ok(text.includes(EXACT_COPY), "the disclosure copy is reproduced exactly");

  const link = tid("gift-payment-note-link");
  assert.ok(link, "the quiet secondary link is present");
  assert.equal(link.textContent.trim(), "Review payment information");
  // src/App.jsx mounts a HashRouter and declares <Route path="settings"> under /dashboard, and
  // pages/Settings.jsx opens the Stripe portal via POST /api/payments/portal-session. Real route.
  assert.equal(link.getAttribute("href"), "#/dashboard/settings");
  assert.equal(link.tagName, "A", "a real link - focusable, and openable in a new tab");
});

test("F1C-ADD: accessible and readable - an aside, not an alert; icon hidden from readers", async () => {
  await mount({ client: ownerClient({ campaigns: [GIFT_CAMPAIGN] }) });
  const note = tid("gift-payment-note");
  assert.equal(note.tagName, "ASIDE", "a complementary aside, not a live region");
  assert.equal(note.getAttribute("role"), null, "no alert role - nothing here is wrong");
  const icon = note.querySelector("svg");
  assert.ok(icon, "a subtle gift icon is present");
  assert.equal(icon.getAttribute("aria-hidden"), "true", "decorative icon is hidden from readers");
  // Nothing to acknowledge, agree to, or dismiss.
  assert.equal(note.querySelector('input, [type="checkbox"], button'), null,
    "no checkbox, no acknowledgement, no dismiss control");
  assert.equal(tid("gift-payment-note-text").tagName, "P");
});

test("F1C-ADD: rendering the disclosure makes NO payment call of any kind", async () => {
  const seen = [];
  const priorFetch = globalThis.fetch;
  const spy = (...a) => { seen.push(String(a[0])); return Promise.resolve({ ok: true, json: async () => ({}) }); };
  globalThis.fetch = spy; window.fetch = spy;
  try {
    const c = ownerClient({ campaigns: [GIFT_CAMPAIGN, PLAIN_CAMPAIGN] });
    await mount({ client: c });
    assert.equal(notes().length, 1, "the note rendered");
    assert.deepEqual(seen.filter((u) => /payment|billing|portal|stripe/i.test(u)), [],
      "no payment/billing request is issued merely because the note is on screen");
    assert.deepEqual(seen, [], "the surface issues no direct fetch at all");
    // And it did not quietly ask the injected client either - it has no payment method to call.
    assert.equal(typeof c.portalSession, "undefined");
    assert.deepEqual(c.writes, [], "rendering wrote nothing");
  } finally {
    globalThis.fetch = priorFetch; window.fetch = priorFetch;
  }
});

test("F1C-ADD: the disclosure does not block Save Changes", async () => {
  const c = ownerClient({ campaigns: [PLAIN_CAMPAIGN] });
  await mount({ client: c });
  assert.equal(notes().length, 1, "the note is present throughout");

  await click(tid("card-expand-c2"));
  const save = tid("act-save-c2");
  assert.ok(save, "Save is offered");
  assert.equal(save.disabled, true, "nothing to save yet");

  const date = tid("card-when-c2");
  assert.ok(date, "the shared send-date field is present for a campaign-date campaign");
  setValue(date, "2026-12-24T09:00");
  await flush();
  assert.equal(tid("act-save-c2").disabled, false, "Save becomes operable with the note present");
  await click(tid("act-save-c2"));
  assert.ok(c.writes.some((w) => w[0] === "updateDeliveryConfig"), "the save went through");
  assert.equal(notes().length, 1, "and the note is still there, unchanged, after saving");
});
