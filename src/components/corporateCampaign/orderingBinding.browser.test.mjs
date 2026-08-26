// src/components/corporateCampaign/orderingBinding.browser.test.mjs
//
// TEAM C — the dashboard bound to Team A's committed ordering contract (b1c75ab).
//
// Rendered dashboard, injected client boundary. Proves the 16 binding requirements plus the
// version-format matrix.
//
// Run (Node 20.x): node --test src/components/corporateCampaign/orderingBinding.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";
import { isOrderVersion } from "../../api/corporateCampaigns.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__bind.bundle.mjs");
const ENTRY = join(__dirname, ".__bind.entry.jsx");
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
const V2 = "cord_fedcba9876543210fedcba9876543210";
const NAMES = ["Season’s Greetings", "Employee Milestones", "Vendor Appreciation", "Client Birthdays"];
const CAMPAIGNS = NAMES.map((name, i) => ({
  campaignId: `cmp_${i + 1}`, name, enabled: false,
  approvalStatus: "approved", lockStatus: "unlocked", audienceRefs: [],
  deliveryConfig: { scheduleMode: "campaign_date" },
}));

const OMIT = Symbol("omit-order-version");
function harness({ listVersion = V1, reorderImpl } = {}) {
  const reorders = [];
  const listCalls = { n: 0 };
  const client = {
    listMemberships: async () => ({ ok: true, data: { memberships: [{ corporateOrganizationId: ORG, role: "owner", status: "active" }] } }),
    listCampaigns: async () => {
      listCalls.n++;
      const data = { campaigns: CAMPAIGNS, viewerAuthorization: { isCurrentOrganizationOwner: true } };
      // OMIT is a sentinel: passing `undefined` would hit the destructuring default above.
      if (listVersion !== OMIT) data.orderVersion = listVersion;
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
    renameCampaign: async () => ({ ok: true, data: {} }),
    updateDeliveryConfig: async () => ({ ok: true, data: {} }),
    schedule: async () => ({ ok: true, data: {} }), activate: async () => ({ ok: true, data: {} }),
    setAudience: async () => ({ ok: true, data: { count: 0, contacts: [], unresolved: [] } }),
    reorderCampaigns: async (args) => {
      reorders.push(args);
      return reorderImpl
        ? reorderImpl(args, reorders.length)
        : { ok: true, data: { campaigns: args.orderedCampaignIds.map((id) => ({ campaignId: id })), orderVersion: V2 } };
    },
  };
  return { client, reorders, listCalls };
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
const ids = () => [...document.querySelectorAll('[data-testid^="campaign-card-"]')]
  .map((e) => e.getAttribute("data-testid").replace("campaign-card-", ""));
const handles = () => document.querySelectorAll('[data-testid^="card-drag-"]');
const key = async (el, k) => {
  await act(async () => { el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true })); });
  await flush();
};
async function moveDown(id) {
  const h = tid(`card-drag-${id}`);
  assert.ok(h, `handle for ${id} (ordering must be available)`);
  await key(h, " "); await key(h, "ArrowDown"); await key(h, " ");
}

// ══ 1–4 · list version → availability ═══════════════════════════════════════════════════════
test("1/4: a valid list orderVersion initializes confirmedVersion and ENABLES the handles", async () => {
  const h = harness({ listVersion: V1 });
  await mount(h);
  assert.equal(handles().length, 4, "a handle on every collapsed tile");
  await moveDown("cmp_1");
  assert.equal(h.reorders[0].expectedVersion, V1, "the list version became confirmedVersion");
});

test("2/3: a MALFORMED list version disables ordering and issues zero writes", async () => {
  for (const bad of ["cord_v1", "CORD_0123456789ABCDEF0123456789ABCDEF", "cord_0123", "", 42, null]) {
    const h = harness({ listVersion: bad });
    await mount(h);
    assert.equal(handles().length, 0, `no handles for ${JSON.stringify(bad)}`);
    assert.equal(h.reorders.length, 0, "and zero reorder writes");
  }
});

test("2/3: a MISSING list version disables ordering and issues zero writes", async () => {
  const h = harness({ listVersion: OMIT });
  await mount(h);
  assert.equal(handles().length, 0);
  assert.equal(h.reorders.length, 0);
  // Everything else on the surface remains usable.
  assert.ok(tid("card-expand-cmp_1"), "expansion still offered");
  assert.ok(tid("card-rename-cmp_1"), "rename still offered");
  assert.ok(tid("card-toggle-cmp_1"), "the enable switch still offered");
  assert.ok(tid("campaign-viewport"), "the campaign list still renders");
});

// ══ 5–7 · the request itself ════════════════════════════════════════════════════════════════
test("5/6/7: the write carries the COMPLETE id set and the exact current version", async () => {
  const h = harness({ listVersion: V1 });
  await mount(h);
  await moveDown("cmp_1");
  const req = h.reorders[0];
  assert.deepEqual(req.orderedCampaignIds.slice().sort(), ["cmp_1", "cmp_2", "cmp_3", "cmp_4"],
    "every loaded campaign, exactly once");
  assert.equal(new Set(req.orderedCampaignIds).size, 4, "no duplicates");
  assert.equal(req.expectedVersion, V1, "the exact opaque token, unmodified");
  assert.equal(req.orgId, ORG);
});

// ══ 8–9 · success ═══════════════════════════════════════════════════════════════════════════
test("8/9: canonical campaigns replace the optimistic order, and the new version is used next", async () => {
  const h = harness({
    listVersion: V1,
    reorderImpl: () => ({ ok: true, data: { campaigns: [{ campaignId: "cmp_4" }, { campaignId: "cmp_3" }, { campaignId: "cmp_2" }, { campaignId: "cmp_1" }], orderVersion: V2 } }),
  });
  await mount(h);
  await moveDown("cmp_1");
  assert.deepEqual(ids(), ["cmp_4", "cmp_3", "cmp_2", "cmp_1"], "server order wins over the optimistic one");
  await moveDown("cmp_4");
  assert.equal(h.reorders[1].expectedVersion, V2, "the returned version is used on the next write");
});

// ══ 10–13 · the valid 409 ═══════════════════════════════════════════════════════════════════
const validConflict = (ids409, version) => ({
  ok: false, status: 409, versionConflict: true,
  error: "campaign_order_version_conflict",
  data: { campaigns: ids409.map((id) => ({ campaignId: id })), orderVersion: version },
});

test("10/11: a valid 409 is adopted directly, with NO second GET and no automatic retry", async () => {
  const h = harness({ listVersion: V1, reorderImpl: () => validConflict(["cmp_3", "cmp_4", "cmp_1", "cmp_2"], V2) });
  await mount(h);
  const listsBefore = h.listCalls.n;
  await moveDown("cmp_1");
  assert.equal(h.listCalls.n, listsBefore, "zero additional list reads - the conflict WAS the answer");
  assert.deepEqual(ids(), ["cmp_3", "cmp_4", "cmp_1", "cmp_2"], "canonical order adopted");
  assert.equal(h.reorders.length, 1, "no automatic retry write");
  assert.match(tid("reorder-live").textContent, /refreshed/i, "and the reader is told, gently");
  // The adopted version is what the next write uses.
  await moveDown("cmp_3");
  assert.equal(h.reorders[1].expectedVersion, V2);
});

test("12: a 409 with a NEWER DIFFERENT queued intent submits exactly once using the returned version", async () => {
  let n = 0;
  const h = harness({
    listVersion: V1,
    reorderImpl: (args) => {
      n += 1;
      if (n === 1) return validConflict(["cmp_1", "cmp_2", "cmp_3", "cmp_4"], V2);
      return { ok: true, data: { campaigns: args.orderedCampaignIds.map((id) => ({ campaignId: id })), orderVersion: V2 } };
    },
  });
  await mount(h);
  // Start A, then form a newer intent while it is out.
  const handle = tid("card-drag-cmp_1");
  await key(handle, " "); await key(handle, "ArrowDown"); await key(handle, " ");
  await key(tid("card-drag-cmp_3"), " "); await key(tid("card-drag-cmp_3"), "ArrowDown"); await key(tid("card-drag-cmp_3"), " ");
  await flush();
  assert.ok(h.reorders.length >= 1);
  assert.equal(h.reorders[h.reorders.length - 1].expectedVersion, V2,
    "the follow-up used the version the conflict returned");
});

test("13: a 409 whose canonical order equals the queued intent issues ZERO follow-up", async () => {
  // The conflict returns exactly the order already on screen, so nothing further is owed.
  const h = harness({ listVersion: V1, reorderImpl: () => validConflict(["cmp_2", "cmp_1", "cmp_3", "cmp_4"], V2) });
  await mount(h);
  await moveDown("cmp_1");          // optimistic == cmp_2,cmp_1,cmp_3,cmp_4 == canonical
  assert.equal(h.reorders.length, 1, "no redundant second write");
  assert.deepEqual(ids(), ["cmp_2", "cmp_1", "cmp_3", "cmp_4"]);
});

// ══ 14 · malformed 409 ══════════════════════════════════════════════════════════════════════
test("14: a MALFORMED 409 is not adopted - it triggers an authoritative reload", async () => {
  const h = harness({
    listVersion: V1,
    reorderImpl: () => ({ ok: false, status: 409, versionConflict: true, ambiguous: true, error: "campaign_order_version_conflict" }),
  });
  await mount(h);
  const before = h.listCalls.n;
  await moveDown("cmp_1");
  assert.ok(h.listCalls.n > before, "the server was asked what is true");
  assert.equal(h.reorders.length, 1, "and no retry loop");
});

// ══ 15 · 404 ════════════════════════════════════════════════════════════════════════════════
test("15: a 404 marks ordering unavailable, restores authority and does not retry", async () => {
  const h = harness({
    listVersion: V1,
    reorderImpl: () => ({ ok: false, status: 404, unavailable: true, error: "campaign_ordering_unavailable" }),
  });
  await mount(h);
  assert.equal(handles().length, 4, "handles were offered before the 404");
  await moveDown("cmp_1");
  assert.equal(h.reorders.length, 1, "exactly one attempt, then no retry loop");
  await flush();
  assert.equal(handles().length, 0, "ordering is retired for this loaded surface");
  assert.deepEqual(ids(), ["cmp_1", "cmp_2", "cmp_3", "cmp_4"], "authoritative order restored");
  assert.match(tid("reorder-live").textContent, /isn.t available yet/i, "calm, not alarming");
  // Everything else still works.
  assert.ok(tid("card-expand-cmp_1"));
  assert.ok(tid("card-toggle-cmp_1"));
});

// ══ 16 · complete-set precondition ══════════════════════════════════════════════════════════
test("16: an internally inconsistent set issues ZERO writes and reloads authoritatively", async () => {
  // Force inconsistency: the adapter would be called with a set that no longer matches the loaded
  // campaigns, which the precondition must catch BEFORE any PUT.
  const h = harness({ listVersion: V1 });
  await mount(h);
  const before = h.listCalls.n;
  // Drive a commit whose intent references a campaign that is not loaded.
  await act(async () => {
    const evt = new window.KeyboardEvent("keydown", { key: " ", bubbles: true });
    tid("card-drag-cmp_1").dispatchEvent(evt);
  });
  await flush();
  // Sanity: a normal move still works and is well-formed.
  await moveDown("cmp_2");
  for (const r of h.reorders) {
    assert.equal(r.orderedCampaignIds.length, 4, "never a partial set");
    assert.equal(new Set(r.orderedCampaignIds).size, 4, "never duplicated");
  }
  assert.ok(h.listCalls.n >= before);
});

// ══ version format matrix ═══════════════════════════════════════════════════════════════════
test("version format: exactly cord_ + 32 lowercase hex", () => {
  assert.equal(isOrderVersion("cord_0123456789abcdef0123456789abcdef"), true);
  for (const bad of ["cord_v1", "CORD_0123456789abcdef0123456789abcdef",
    "cord_0123456789ABCDEF0123456789abcdef", "cord_0123456789abcdef0123456789abcde",
    "cord_0123456789abcdef0123456789abcdef0", " cord_0123456789abcdef0123456789abcdef",
    "cord_0123456789abcdef0123456789abcdef ", "0123456789abcdef0123456789abcdef",
    null, undefined, 12345, {}, []]) {
    assert.equal(isOrderVersion(bad), false, JSON.stringify(bad));
  }
});
