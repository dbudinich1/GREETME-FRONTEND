// src/components/corporateCampaign/renameBinding.browser.test.mjs
//
// TEAM C — the campaign-title pencil bound to Team A's committed rename contract (15aec92).
//
// Two layers, because the matrix spans two boundaries:
//
//   LAYER A — TRANSPORT. The REAL client from src/api/corporateCampaigns.js against a fake fetch,
//             proving the exact method, path and body Team A's route accepts, and proving each of
//             the server's documented refusals arrives in a shape the card can read.
//   LAYER B — SURFACE. The rendered dashboard against an injected client boundary, proving what a
//             reader can actually do and what they are told when the server refuses.
//
// Nothing here asserts a behaviour the backend does not have. Every status/code pair below is
// taken from routes/corporateCampaignRoutes.test.mjs and corporateCampaignService.js at 15aec92:
//   200 renamed (trimmed) · 200 no-op on an unchanged normalised name · 400 name_must_be_a_string
//   400 name_required · 400 name_too_long (>120) · 403 owner_only · 404 campaign_not_found
//   409 campaign_locked (a scheduled/active campaign is necessarily locked, so it lands here too)
//
// Run (Node 20.x): node --test src/components/corporateCampaign/renameBinding.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { createCorporateCampaignsClient } from "../../api/corporateCampaigns.js";
import { OWNER_ONLY_MESSAGE } from "./corporateDashboardModel.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__rename.bundle.mjs");
const ENTRY = join(__dirname, ".__rename.entry.jsx");
let React, createRoot, act, Surface, window;

before(async () => {
  writeFileSync(ENTRY, `export { default as Surface } from "./GreetingAutomationCampaigns.jsx";\n`);
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
  globalThis.navigator = window.navigator; globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Surface } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(BUNDLE.replace(/\.mjs$/, ".css"), { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const ORG = "org_1";
const V1 = "cord_0123456789abcdef0123456789abcdef";
const NAME_MAX = 120;

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LAYER A — TRANSPORT
// ═══════════════════════════════════════════════════════════════════════════════════════════════

/** The real client, wired to a scripted fetch. Records every request it makes. */
function transport(respond) {
  const calls = [];
  const client = createCorporateCampaignsClient({
    apiBase: "",
    getToken: () => "t0ken",
    fetchImpl: async (url, init) => {
      calls.push({ url, method: init.method, body: init.body ? JSON.parse(init.body) : null, headers: init.headers });
      const r = respond(calls.length);
      return {
        status: r.status, ok: r.status >= 200 && r.status < 300,
        json: async () => { if (r.body === undefined) throw new Error("no body"); return r.body; },
      };
    },
  });
  return { client, calls };
}

test("A1 transport: rename is PATCH .../campaigns/:id/name with a body of exactly { name }", async () => {
  const { client, calls } = transport(() => ({ status: 200, body: { campaignId: "cmp_1", name: "Employee Milestones" } }));
  const res = await client.renameCampaign(ORG, "cmp_1", "Employee Milestones");

  assert.equal(calls.length, 1, "exactly one request");
  assert.equal(calls[0].method, "PATCH");
  assert.equal(calls[0].url, "/api/corporate-campaigns/organizations/org_1/campaigns/cmp_1/name",
    "the path Team A mounted at 15aec92 — not a general campaign patch");
  assert.deepEqual(Object.keys(calls[0].body), ["name"], "ONLY name is sent");
  assert.equal(calls[0].body.name, "Employee Milestones");
  assert.equal(calls[0].headers.Authorization, "Bearer t0ken");
  assert.equal(res.ok, true);
  assert.equal(res.data.name, "Employee Milestones", "the server's projection is what comes back");
});

test("A2 transport: ids are encoded, so a campaign id can never escape its path segment", async () => {
  const { client, calls } = transport(() => ({ status: 200, body: {} }));
  await client.renameCampaign("org/../x", "cmp/../../evil", "N");
  assert.equal(calls[0].url, "/api/corporate-campaigns/organizations/org%2F..%2Fx/campaigns/cmp%2F..%2F..%2Fevil/name");
});

test("A3 transport: there is exactly ONE rename method and no second title endpoint", async () => {
  const { client } = transport(() => ({ status: 200, body: {} }));
  const namers = Object.keys(client).filter((k) => /name|title|rename/i.test(k));
  assert.deepEqual(namers, ["renameCampaign"], "one method, one contract");
  // And no general patch that could carry a name past the rename rules.
  for (const k of Object.keys(client)) {
    assert.ok(!/^(patchCampaign|updateCampaign|saveCampaign)$/.test(k), `no permissive patch: ${k}`);
  }
});

test("A4 transport: every documented refusal arrives readable, and none is a success", async () => {
  const cases = [
    { status: 400, body: { error: "name_must_be_a_string" }, expect: (r) => r.error === "name_must_be_a_string" },
    { status: 400, body: { error: "name_required" }, expect: (r) => r.error === "name_required" },
    { status: 400, body: { error: "name_too_long" }, expect: (r) => r.error === "name_too_long" },
    { status: 403, body: { error: "owner_only" }, expect: (r) => r.unauthorized === true && r.status === 403 },
    { status: 404, body: { error: "campaign_not_found" }, expect: (r) => r.error === "campaign_not_found" },
    { status: 409, body: { error: "campaign_locked" }, expect: (r) => r.conflict === true && r.error === "campaign_locked" },
    { status: 503, body: { reason: "campaign_featured_spread_disabled" }, expect: (r) => r.dormant === true },
    { status: 401, body: {}, expect: (r) => r.unauthorized === true },
  ];
  for (const c of cases) {
    const { client } = transport(() => c);
    const r = await client.renameCampaign(ORG, "cmp_1", "N");
    assert.equal(r.ok, false, `${c.status} is never ok`);
    assert.ok(c.expect(r), `${c.status} ${JSON.stringify(c.body)} -> ${JSON.stringify(r)}`);
  }
});

test("A5 transport: a network failure is a refusal, never a silent success", async () => {
  const client = createCorporateCampaignsClient({
    apiBase: "", getToken: () => null,
    fetchImpl: async () => { throw new Error("offline"); },
  });
  const r = await client.renameCampaign(ORG, "cmp_1", "N");
  assert.equal(r.ok, false);
  assert.equal(r.networkError, true);
});

// ═══════════════════════════════════════════════════════════════════════════════════════════════
// LAYER B — SURFACE
// ═══════════════════════════════════════════════════════════════════════════════════════════════

const campaignsOf = (names, over = {}) => names.map((name, i) => ({
  campaignId: `cmp_${i + 1}`, name, enabled: false,
  approvalStatus: "approved", lockStatus: "unlocked", audienceRefs: [],
  deliveryConfig: { scheduleMode: "campaign_date" }, ...over,
}));

const BASE_NAMES = ["Season’s Greetings", "Employee Milestones", "Vendor Appreciation", "Client Birthdays"];

/**
 * A dashboard harness whose campaign list is MUTABLE, so a rename that the fake server accepts is
 * visible on the next authoritative load — exactly as the real surface refetches after a mutation.
 */
function harness({
  names = BASE_NAMES, isOwner = true, listVersion = V1, over = {},
  rename = async (orgId, campaignId, name) => ({ ok: true, data: { campaignId, name } }),
} = {}) {
  const state = { campaigns: campaignsOf(names, over) };
  const renames = [];
  const listCalls = { n: 0 };
  const client = {
    listMemberships: async () => ({ ok: true, data: { memberships: [{ corporateOrganizationId: ORG, role: isOwner ? "owner" : "campaign_manager", status: "active" }] } }),
    listCampaigns: async () => {
      listCalls.n++;
      const data = { campaigns: state.campaigns.map((c) => ({ ...c })), viewerAuthorization: { isCurrentOrganizationOwner: isOwner } };
      if (listVersion) data.orderVersion = listVersion;
      return { ok: true, data };
    },
    listOrgContacts: async () => ({ ok: true, data: { contacts: [], count: 0 } }),
    readAudience: async () => ({ ok: true, data: { count: 0, contacts: [], unresolved: [] } }),
    readCampaign: async () => ({ ok: true, data: {} }),
    readReadiness: async () => ({ ok: true, data: {} }),
    createCampaign: async () => ({ ok: true, data: {} }),
    updateFeaturedSpread: async () => ({ ok: true }), approve: async () => ({ ok: true }),
    lock: async () => ({ ok: true }), unlock: async () => ({ ok: true }),
    setCampaignEnabled: async () => ({ ok: true, data: {} }),
    updateDeliveryConfig: async () => ({ ok: true, data: {} }),
    schedule: async () => ({ ok: true, data: {} }), activate: async () => ({ ok: true, data: {} }),
    setAudience: async () => ({ ok: true, data: { count: 0, contacts: [], unresolved: [] } }),
    reorderCampaigns: async () => ({ ok: false, status: 404, unavailable: true, error: "campaign_ordering_unavailable" }),
    renameCampaign: async (orgId, campaignId, name) => {
      renames.push({ orgId, campaignId, name });
      const res = await rename(orgId, campaignId, name);
      // A fake server that accepted the rename persists it, so the refetch is authoritative.
      if (res && res.ok === true) {
        const row = state.campaigns.find((c) => c.campaignId === campaignId);
        if (row) row.name = (res.data && res.data.name) || name;
      }
      return res;
    },
  };
  return { client, renames, listCalls, state };
}

let root;
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
async function mount(h) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Surface, { client: h.client })); });
  await flush();
}
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const titleOf = (id) => tid(`card-title-${id}`).textContent;
const click = async (el) => { await act(async () => { el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true })); }); await flush(); };
const typeInto = async (el, value) => {
  await act(async () => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
    setter.call(el, value);
    el.dispatchEvent(new window.Event("input", { bubbles: true }));
  });
  await flush();
};

/** Open the pencil on a campaign, type a name, submit. Returns the message element, if any. */
async function renameTo(id, value) {
  await click(tid(`card-rename-${id}`));
  const input = tid(`card-rename-input-${id}`);
  assert.ok(input, `rename editor opened for ${id}`);
  await typeInto(input, value);
  await click(tid(`card-rename-save-${id}`));
  return tid(`card-msg-${id}`);
}

test("B1 an authorized owner can rename, and the SERVER's answer becomes the title", async () => {
  // The fake server answers with its own normalised value; the card must show that, not the draft.
  const h = harness({ rename: async (o, id, name) => ({ ok: true, data: { campaignId: id, name: `${name}` } }) });
  await mount(h);
  assert.equal(titleOf("cmp_2"), "Employee Milestones");
  await renameTo("cmp_2", "Team Milestones");
  assert.deepEqual(h.renames, [{ orgId: ORG, campaignId: "cmp_2", name: "Team Milestones" }]);
  assert.equal(titleOf("cmp_2"), "Team Milestones", "the renamed title is on screen");
  assert.equal(tid("card-rename-form-cmp_2"), null, "the editor closed");
  assert.equal(tid("card-msg-cmp_2"), null, "no failure message");
});

test("B2 surrounding whitespace is trimmed BEFORE the request — the server never sees padding", async () => {
  const h = harness();
  await mount(h);
  await renameTo("cmp_3", "   Vendor Thank You   ");
  assert.equal(h.renames[0].name, "Vendor Thank You", "trimmed on the wire");
  assert.equal(titleOf("cmp_3"), "Vendor Thank You");
});

test("B3 an empty or whitespace-only name is refused WITHOUT a request", async () => {
  for (const bad of ["", "   ", "\t\n "]) {
    const h = harness();
    await mount(h);
    const msg = await renameTo("cmp_1", bad);
    assert.equal(h.renames.length, 0, `no request for ${JSON.stringify(bad)}`);
    assert.ok(msg && /cannot be empty/i.test(msg.textContent), "told why");
    assert.equal(titleOf("cmp_1"), "Season’s Greetings", "the confirmed title is untouched");
    assert.ok(tid("card-rename-form-cmp_1"), "the editor stays open to be corrected");
  }
});

test("B4 a non-string name is unreachable from the editor, and refused by the server if it ever arrived", async () => {
  // The editor is a text input, so its value is a string by construction — asserted rather than
  // assumed, because that IS the frontend half of "a non-string is rejected".
  const h = harness({
    rename: async () => ({ ok: false, status: 400, error: "name_must_be_a_string" }),
  });
  await mount(h);
  await click(tid("card-rename-cmp_1"));
  const input = tid("card-rename-input-cmp_1");
  assert.equal(input.tagName, "INPUT");
  assert.equal(input.getAttribute("type"), "text");
  assert.equal(typeof input.value, "string");
  // And the server's refusal, if the transport were ever fed one, reads as an empty-name problem.
  await typeInto(input, "X");
  await click(tid("card-rename-save-cmp_1"));
  const msg = tid("card-msg-cmp_1");
  assert.ok(msg && /cannot be empty/i.test(msg.textContent));
  assert.equal(titleOf("cmp_1"), "Season’s Greetings");
});

test("B5 duplicate campaign names remain ALLOWED — the surface adds no uniqueness rule", async () => {
  const h = harness();
  await mount(h);
  await renameTo("cmp_4", "Employee Milestones");   // already cmp_2's exact name
  assert.equal(h.renames.length, 1, "the request was sent, not blocked client-side");
  assert.equal(titleOf("cmp_4"), "Employee Milestones");
  assert.equal(titleOf("cmp_2"), "Employee Milestones");
  assert.equal(tid("card-msg-cmp_4"), null, "no invented duplicate-name warning");
});

test("B6 an unchanged normalised name is a NO-OP: zero requests, zero reloads", async () => {
  const h = harness();
  await mount(h);
  const loadsBefore = h.listCalls.n;
  await renameTo("cmp_2", "   Employee Milestones   ");  // same value, different padding
  assert.equal(h.renames.length, 0, "no rename request");
  assert.equal(h.listCalls.n, loadsBefore, "no authoritative reload either");
  assert.equal(tid("card-rename-form-cmp_2"), null, "the editor simply closes");
  assert.equal(titleOf("cmp_2"), "Employee Milestones");
});

test("B7 a LOCKED campaign refuses rename: the pencil is disabled and says why", async () => {
  const h = harness({ over: { lockStatus: "locked", lockedPresentationSnapshotRef: "snap_x" } });
  await mount(h);
  const pencil = tid("card-rename-cmp_1");
  assert.equal(pencil.disabled, true);
  assert.match(pencil.getAttribute("title"), /Unlock the campaign to rename it/);
  await click(pencil);
  assert.equal(tid("card-rename-form-cmp_1"), null, "no editor opens");
  assert.equal(h.renames.length, 0, "and nothing is sent");
});

test("B8 a SETTLED (scheduled/active) campaign refuses too — it is locked, per the backend", async () => {
  // routes/corporateCampaignRoutes.test.mjs at 15aec92: "a SCHEDULED / ACTIVE campaign is rejected
  // too ... a settled campaign is necessarily locked". So the lock guard IS the settled guard, and
  // the surface must not invent a separate one.
  for (const status of ["scheduled", "active"]) {
    const h = harness({ over: { lockStatus: "locked", lockedPresentationSnapshotRef: "snap_x", deliveryConfig: { scheduleMode: "campaign_date", status } } });
    await mount(h);
    assert.equal(tid("card-rename-cmp_1").disabled, true, status);
    assert.equal(h.renames.length, 0, status);
  }
});

test("B9 a server 409 campaign_locked is reported in the reader's words, title preserved", async () => {
  const h = harness({ rename: async () => ({ ok: false, conflict: true, status: 409, error: "campaign_locked" }) });
  await mount(h);
  const msg = await renameTo("cmp_1", "Too Late");
  assert.ok(msg && /Unlock the campaign to rename it/i.test(msg.textContent));
  assert.equal(titleOf("cmp_1"), "Season’s Greetings", "the LAST CONFIRMED title survives");
});

test("B10 every other server refusal preserves the last confirmed title and says something true", async () => {
  const cases = [
    { res: { ok: false, status: 400, error: "name_too_long" }, re: /too long/i },
    { res: { ok: false, status: 400, error: "name_required" }, re: /cannot be empty/i },
    { res: { ok: false, unauthorized: true, status: 403 }, re: new RegExp(OWNER_ONLY_MESSAGE, "i") },
    { res: { ok: false, status: 404, error: "campaign_not_found" }, re: /no longer exists/i },
    { res: { ok: false, dormant: true, status: 503, reason: "campaign_featured_spread_disabled" }, re: /isn.t active yet/i },
    { res: { ok: false, networkError: true, status: 0 }, re: /didn.t go through/i },
  ];
  for (const c of cases) {
    const h = harness({ rename: async () => c.res });
    await mount(h);
    const msg = await renameTo("cmp_2", "Attempted Name");
    assert.ok(msg, `a message for ${JSON.stringify(c.res)}`);
    assert.match(msg.textContent, c.re);
    assert.equal(titleOf("cmp_2"), "Employee Milestones", "no optimistic title left behind");
    assert.ok(tid("card-rename-form-cmp_2"), "the editor stays open so the edit is not lost");
  }
});

test("B11 a successful rename triggers an authoritative reload, and the title survives it", async () => {
  const h = harness();
  await mount(h);
  const loadsBefore = h.listCalls.n;
  await renameTo("cmp_3", "Supplier Appreciation");
  assert.ok(h.listCalls.n > loadsBefore, "the list was refetched");
  assert.equal(titleOf("cmp_3"), "Supplier Appreciation");

  // Remount from scratch: nothing but the server's state is available to a fresh page.
  await mount(h);
  assert.equal(titleOf("cmp_3"), "Supplier Appreciation", "reload preserves the renamed title");
});

test("B12 there is NO local-only persistence: a rename the server rejected does not survive a reload", async () => {
  const before = { local: window.localStorage.length, session: window.sessionStorage.length };
  const h = harness({ rename: async () => ({ ok: false, status: 409, conflict: true, error: "campaign_locked" }) });
  await mount(h);
  await renameTo("cmp_1", "Never Persisted");
  assert.equal(window.localStorage.length, before.local, "nothing written to localStorage");
  assert.equal(window.sessionStorage.length, before.session, "nothing written to sessionStorage");
  await mount(h);
  assert.equal(titleOf("cmp_1"), "Season’s Greetings", "the rejected name is gone entirely");
});

test("B13 Cancel and Escape abandon the edit locally, sending nothing", async () => {
  const h = harness();
  await mount(h);
  await click(tid("card-rename-cmp_1"));
  await typeInto(tid("card-rename-input-cmp_1"), "Abandoned");
  await click(tid("card-rename-cancel-cmp_1"));
  assert.equal(tid("card-rename-form-cmp_1"), null);
  assert.equal(h.renames.length, 0);

  await click(tid("card-rename-cmp_1"));
  await typeInto(tid("card-rename-input-cmp_1"), "Also Abandoned");
  await act(async () => {
    tid("card-rename-input-cmp_1").dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
  });
  await flush();
  assert.equal(tid("card-rename-form-cmp_1"), null, "Escape closes the editor");
  assert.equal(h.renames.length, 0);
  assert.equal(titleOf("cmp_1"), "Season’s Greetings");
});

test("B14 a NON-OWNER is offered no rename at all", async () => {
  const h = harness({ isOwner: false });
  await mount(h);
  const pencil = tid("card-rename-cmp_1");
  assert.equal(pencil.disabled, true);
  assert.match(pencil.getAttribute("title"), new RegExp(OWNER_ONLY_MESSAGE, "i"));
  await click(pencil);
  assert.equal(tid("card-rename-form-cmp_1"), null);
  assert.equal(h.renames.length, 0);
});

test("B15 the editor caps input at the server's 120-character ceiling", async () => {
  const h = harness();
  await mount(h);
  await click(tid("card-rename-cmp_1"));
  const input = tid("card-rename-input-cmp_1");
  assert.equal(Number(input.getAttribute("maxlength")), NAME_MAX, "mirrors the founder-ratified cap");
  // 120 exactly is allowed by the backend, so the surface must send it rather than pre-refuse.
  await typeInto(input, "y".repeat(NAME_MAX));
  await click(tid("card-rename-save-cmp_1"));
  assert.equal(h.renames.length, 1);
  assert.equal(h.renames[0].name.length, NAME_MAX);
});

test("B16 rename stays fully usable when ordering is UNAVAILABLE", async () => {
  // No orderVersion on the list → no drag handles at all. Renaming must be untouched by that.
  const h = harness({ listVersion: null });
  await mount(h);
  assert.equal(document.querySelectorAll('[data-testid^="card-drag-"]').length, 0, "ordering retired");
  assert.equal(tid("card-rename-cmp_2").disabled, false, "the pencil is still offered");
  await renameTo("cmp_2", "Still Renameable");
  assert.equal(h.renames.length, 1);
  assert.equal(titleOf("cmp_2"), "Still Renameable");
});

test("B17 the title is a HEADING, and renaming never navigates to CampaignDetail", async () => {
  const h = harness();
  await mount(h);
  const title = tid("card-title-cmp_1");
  assert.equal(title.tagName, "H3", "a heading, not a link");
  assert.equal(title.closest("a"), null, "and not wrapped in one");
  const before = window.location.href;
  await renameTo("cmp_1", "Renamed In Place");
  assert.equal(window.location.href, before, "no navigation occurred");
  assert.equal(document.querySelectorAll('a[href*="campaign"]').length, 0, "no campaign detail link exists on the surface");
  assert.ok(tid("campaign-card-cmp_1"), "still on the dashboard");
});

test("B18 renaming touches NOTHING else: no lifecycle, audience, gift, schedule or toggle call", async () => {
  const forbidden = [];
  const h = harness();
  for (const k of ["approve", "lock", "unlock", "schedule", "activate", "setCampaignEnabled", "setAudience", "updateDeliveryConfig", "updateFeaturedSpread", "createCampaign", "reorderCampaigns"]) {
    const original = h.client[k];
    h.client[k] = async (...a) => { forbidden.push(k); return original(...a); };
  }
  await mount(h);
  await renameTo("cmp_2", "Quietly Renamed");
  assert.deepEqual(forbidden, [], "a rename calls exactly one endpoint and no other");
});
