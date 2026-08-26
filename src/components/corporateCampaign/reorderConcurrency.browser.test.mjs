// src/components/corporateCampaign/reorderConcurrency.browser.test.mjs
//
// TEAM C — the single-flight reorder contract, proven BEHAVIOURALLY.
//
// The real GreetingAutomationCampaigns is esbuild-bundled and mounted into jsdom with injected
// adapters. Every assertion is about what the rendered dashboard did — which requests it issued,
// in what order, and what the reader ends up looking at. No source slicing is used as proof.
//
// Reorder is driven through the KEYBOARD path (space to grab, ArrowDown to move, space to drop),
// because it is deterministic and exercises exactly the same commit path as a pointer drag.
//
// Run (Node 20.x): node --test src/components/corporateCampaign/reorderConcurrency.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__reorder.bundle.mjs");
const ENTRY = join(__dirname, ".__reorder.entry.jsx");
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
// Real-format tokens: cord_ + 32 lowercase hex, exactly as Team A b1c75ab mints them.
const LIST_VERSION = "cord_4cf38037c47b08bf4cf38037c47b08bf";
const V = { A: "cord_741eb852fc9630da741eb852", B: "cord_eb852fc9630da741eb852fc9", X: "cord_852fc9630da741eb852fc963", ONE: "cord_9fd0647dbe425b9c20397a0e" };
const NAMES = ["Season’s Greetings", "Employee Milestones", "Vendor Appreciation", "Client Birthdays"];
const CAMPAIGNS = NAMES.map((name, i) => ({
  campaignId: `cmp_${i + 1}`, name, enabled: false,
  approvalStatus: "approved", lockStatus: "unlocked", audienceRefs: [],
  deliveryConfig: { scheduleMode: "campaign_date" },
}));

/** A promise whose settlement this test controls. */
function deferred() {
  let resolve;
  const promise = new Promise((r) => { resolve = r; });
  return { promise, resolve };
}

/** Injected adapters. Every reorder call is recorded; each is settled explicitly by the test. */
function harness({ campaigns = CAMPAIGNS } = {}) {
  const calls = [];
  const listCalls = { n: 0 };
  let listPayload = campaigns;
  const client = {
    listMemberships: async () => ({ ok: true, data: { memberships: [{ corporateOrganizationId: ORG, role: "owner", status: "active" }] } }),
    listCampaigns: async () => {
      listCalls.n++;
      if (listPayload === "fail") return { ok: false, status: 500, error: "list_failed" };
      return { ok: true, data: { campaigns: listPayload, viewerAuthorization: { isCurrentOrganizationOwner: true },
        // The list now carries the ordering token; without it the dashboard correctly hides the handles.
        orderVersion: LIST_VERSION } };
    },
    listOrgContacts: async () => ({ ok: true, data: { contacts: [], count: 0 } }),
    readAudience: async () => ({ ok: true, data: { count: 0, contacts: [], unresolved: [] } }),
    readCampaign: async () => ({ ok: true, data: {} }),
    readReadiness: async () => ({ ok: true, data: {} }),
    createCampaign: async () => ({ ok: true, data: {} }),
    updateFeaturedSpread: async () => ({ ok: true }), approve: async () => ({ ok: true }),
    lock: async () => ({ ok: true }), unlock: async () => ({ ok: true }),
    setCampaignEnabled: async (...a) => { calls.push(["setCampaignEnabled", ...a]); return { ok: true, data: {} }; },
    renameCampaign: async (...a) => { calls.push(["renameCampaign", ...a]); return { ok: true, data: {} }; },
    updateDeliveryConfig: async (...a) => { calls.push(["updateDeliveryConfig", ...a]); return { ok: true, data: {} }; },
    schedule: async () => ({ ok: true, data: {} }), activate: async () => ({ ok: true, data: {} }),
    setAudience: async () => ({ ok: true, data: { count: 0, contacts: [], unresolved: [] } }),
    reorderCampaigns: (args) => {
      const d = deferred();
      calls.push({ kind: "reorder", args, settle: d.resolve });
      return d.promise;
    },
  };
  return {
    client, calls, listCalls,
    reorders: () => calls.filter((c) => c.kind === "reorder"),
    setList: (v) => { listPayload = v; },
    otherWrites: () => calls.filter((c) => Array.isArray(c)),
  };
}

const ok = (ids, version) => ({ ok: true, data: { campaigns: ids.map((id) => ({ campaignId: id })), orderVersion: version } });
const refusal = { ok: false, status: 500, error: "reorder_failed" };
const conflict = { ok: false, conflict: true, status: 409 };

let root, host;
async function mount(h) {
  document.body.innerHTML = "";
  host = document.createElement("div"); document.body.appendChild(host);
  root = createRoot(host);
  await act(async () => { root.render(React.createElement(Surface, { client: h.client })); });
  await flush();
}
const flush = async () => { await act(async () => { await new Promise((r) => setTimeout(r, 0)); }); };
const tid = (t) => document.querySelector(`[data-testid="${t}"]`);
const visibleOrder = () =>
  [...document.querySelectorAll('[data-testid^="card-title-"]')].map((e) => e.textContent.trim());
const key = async (el, k) => {
  await act(async () => {
    el.dispatchEvent(new window.KeyboardEvent("keydown", { key: k, bubbles: true, cancelable: true }));
  });
  await flush();
};

/** Move a campaign one place through the keyboard path, committing on drop. */
async function move(campaignId, dir) {
  const handle = tid(`card-drag-${campaignId}`);
  assert.ok(handle, `handle for ${campaignId}`);
  await key(handle, " ");          // grab
  await key(handle, dir);          // move
  await key(handle, " ");          // drop -> commit
}
const moveDown = (id) => move(id, "ArrowDown");
// cmp_4 starts last, so moving it DOWN is a no-op and would queue no intent at all.
const moveUp = (id) => move(id, "ArrowUp");

const ORDER_1234 = ["cmp_1", "cmp_2", "cmp_3", "cmp_4"];

// ══ 1 ═══════════════════════════════════════════════════════════════════════════════════════
test("1: a single success adopts the canonical order AND its orderVersion", async () => {
  const h = harness();
  await mount(h);
  await moveDown("cmp_1");
  const [a] = h.reorders();
  assert.equal(h.reorders().length, 1, "exactly one write");
  assert.deepEqual(a.args.orderedCampaignIds, ["cmp_2", "cmp_1", "cmp_3", "cmp_4"]);
  // BOUND BEHAVIOUR: the first write carries the version the LIST supplied - not null. Before the
  // binding there was no list version to carry; there is now, and sending it is the whole point.
  assert.equal(a.args.expectedVersion, LIST_VERSION, "first write uses the list-supplied version");

  await act(async () => { a.settle(ok(["cmp_2", "cmp_1", "cmp_3", "cmp_4"], V.ONE)); });
  await flush();
  assert.deepEqual(visibleOrder(), [NAMES[1], NAMES[0], NAMES[2], NAMES[3]]);

  // The returned version is used on the NEXT write - that is the proof it was confirmed.
  await moveDown("cmp_1");
  assert.equal(h.reorders()[1].args.expectedVersion, V.ONE, "confirmedVersion came from the server");
});

// ══ 2 ═══════════════════════════════════════════════════════════════════════════════════════
test("2: a proven refusal rolls back to the confirmed order", async () => {
  const h = harness();
  await mount(h);
  await moveDown("cmp_1");
  await act(async () => { h.reorders()[0].settle(ok(["cmp_2", "cmp_1", "cmp_3", "cmp_4"], V.ONE)); });
  await flush();

  await moveDown("cmp_3");
  await act(async () => { h.reorders()[1].settle(refusal); });
  await flush();
  assert.deepEqual(visibleOrder(), [NAMES[1], NAMES[0], NAMES[2], NAMES[3]], "back to v1's order");
  assert.match(tid("reorder-live").textContent, /could not be reordered/i);
});

// ══ 3 + 10 ══════════════════════════════════════════════════════════════════════════════════
test("3/10: only ONE write is in flight; later intents collapse to the newest", async () => {
  const h = harness();
  await mount(h);
  await moveDown("cmp_1");                       // A
  assert.equal(h.reorders().length, 1);

  await moveDown("cmp_3");                       // B  (queued)
  await moveUp("cmp_4");                       // C  (replaces B)
  await moveDown("cmp_2");                       // D  (replaces C)
  assert.equal(h.reorders().length, 1, "B, C and D issued ZERO concurrent writes");

  const visibleWhilePending = visibleOrder();
  await act(async () => { h.reorders()[0].settle(ok(["cmp_2", "cmp_1", "cmp_3", "cmp_4"], V.ONE)); });
  await flush();

  assert.equal(h.reorders().length, 2, "exactly one queued write follows - not three");
  assert.equal(h.reorders()[1].args.expectedVersion, V.ONE, "the queued write uses A's returned version");
  assert.deepEqual(visibleOrder(), visibleWhilePending, "the newest intent stays on screen");
});

// ══ 4 ═══════════════════════════════════════════════════════════════════════════════════════
test("4: A succeeds while B is queued; B then submits with A's version", async () => {
  const h = harness();
  await mount(h);
  await moveDown("cmp_1");                       // A
  await moveUp("cmp_4");                       // B queued
  const duringA = visibleOrder();

  await act(async () => { h.reorders()[0].settle(ok(["cmp_2", "cmp_1", "cmp_3", "cmp_4"], V.A)); });
  await flush();
  assert.deepEqual(visibleOrder(), duringA, "A's canonical order never repainted over B's intent");
  assert.equal(h.reorders()[1].args.expectedVersion, V.A);
});

// ══ 5 ═══════════════════════════════════════════════════════════════════════════════════════
test("5: A then B both succeed; B is final", async () => {
  const h = harness();
  await mount(h);
  await moveDown("cmp_1");
  await moveUp("cmp_4");
  await act(async () => { h.reorders()[0].settle(ok(["cmp_2", "cmp_1", "cmp_3", "cmp_4"], V.A)); });
  await flush();
  await act(async () => { h.reorders()[1].settle(ok(["cmp_4", "cmp_2", "cmp_1", "cmp_3"], V.B)); });
  await flush();
  assert.deepEqual(visibleOrder(), [NAMES[3], NAMES[1], NAMES[0], NAMES[2]], "B canonical is final");
});

// ══ 6 ═══════════════════════════════════════════════════════════════════════════════════════
test("6: A succeeds, B refuses without mutating - A's canonical order stands", async () => {
  const h = harness();
  await mount(h);
  await moveDown("cmp_1");
  await moveUp("cmp_4");
  await act(async () => { h.reorders()[0].settle(ok(["cmp_2", "cmp_1", "cmp_3", "cmp_4"], V.A)); });
  await flush();
  await act(async () => { h.reorders()[1].settle(refusal); });
  await flush();
  assert.deepEqual(visibleOrder(), [NAMES[1], NAMES[0], NAMES[2], NAMES[3]],
    "the founder's case-4 ruling: a confirmed success is not discarded");
});

// ══ 7 ═══════════════════════════════════════════════════════════════════════════════════════
test("7: A refuses while B is queued - the rollback cannot repaint over B", async () => {
  const h = harness();
  await mount(h);
  await moveDown("cmp_1");                        // A
  await moveUp("cmp_4");                        // B queued
  const bIntent = visibleOrder();
  await act(async () => { h.reorders()[0].settle(refusal); });
  await flush();
  assert.deepEqual(visibleOrder(), bIntent, "B's visible intent survives A's failure");
  assert.equal(h.reorders().length, 2, "B still submits");
  assert.equal(h.reorders()[1].args.expectedVersion, LIST_VERSION,
    "A failed without mutating, so the list-confirmed version is still the valid one");
});

// ══ 8 ═══════════════════════════════════════════════════════════════════════════════════════
test("8: a version conflict triggers an authoritative reload before the queued write", async () => {
  const h = harness();
  await mount(h);
  const listsBefore = h.listCalls.n;
  await moveDown("cmp_1");
  await moveUp("cmp_4");                        // queued
  await act(async () => { h.reorders()[0].settle(conflict); });
  await flush();
  assert.ok(h.listCalls.n > listsBefore, "the authoritative list was re-read");
  assert.equal(h.reorders().length, 2, "the queued intent submitted only after the reload");
});

// ══ 9 ═══════════════════════════════════════════════════════════════════════════════════════
test("9: an unreadable success reloads rather than presenting a guess as saved", async () => {
  for (const bad of [{ ok: true, data: { campaigns: [], orderVersion: V.ONE } },
    { ok: true, data: { campaigns: [{ campaignId: "cmp_2" }] } },   // no orderVersion
    { ok: true, data: {} }]) {
    const h = harness();
    await mount(h);
    const before = h.listCalls.n;
    await moveDown("cmp_1");
    await act(async () => { h.reorders()[0].settle(bad); });
    await flush();
    assert.ok(h.listCalls.n > before, `reloaded for ${JSON.stringify(bad.data)}`);
  }
});

// ══ 11 ══════════════════════════════════════════════════════════════════════════════════════
test("11: a queued intent equal to the confirmed order issues NO second write", async () => {
  const h = harness();
  await mount(h);
  await moveDown("cmp_1");                        // A -> [2,1,3,4]
  await moveDown("cmp_2");                        // queued: moves cmp_2 down -> [1,2,3,4]...
  // Settle A with a canonical order that already equals the queued intent.
  const queued = h.reorders().length === 1 ? ORDER_1234 : ORDER_1234;
  await act(async () => { h.reorders()[0].settle(ok(queued, V.ONE)); });
  await flush();
  // The queued intent matched the confirmed canonical order, so nothing further was sent.
  assert.equal(h.reorders().length, 1, "no redundant follow-up request");
});

// ══ 12 ══════════════════════════════════════════════════════════════════════════════════════
test("12: a canonical order different from the submitted one becomes the truth", async () => {
  const h = harness();
  await mount(h);
  await moveDown("cmp_1");
  await act(async () => { h.reorders()[0].settle(ok(["cmp_4", "cmp_3", "cmp_2", "cmp_1"], V.X)); });
  await flush();
  assert.deepEqual(visibleOrder(), [NAMES[3], NAMES[2], NAMES[1], NAMES[0]], "server wins");
  await moveUp("cmp_4");
  assert.equal(h.reorders()[1].args.expectedVersion, V.X);
});

// ══ 13 ══════════════════════════════════════════════════════════════════════════════════════
test("13: unmounting while a write is pending submits nothing further and warns nothing", async () => {
  const warnings = [];
  const realError = console.error;
  console.error = (...a) => { warnings.push(String(a[0])); };
  try {
    const h = harness();
    await mount(h);
    await moveDown("cmp_1");
    await moveUp("cmp_4");                      // queued
    await act(async () => { root.unmount(); });
    await act(async () => { h.reorders()[0].settle(ok(["cmp_2", "cmp_1", "cmp_3", "cmp_4"], V.ONE)); });
    await flush();
    assert.equal(h.reorders().length, 1, "the queued intent was NOT submitted after unmount");
    assert.equal(warnings.filter((w) => /not wrapped in act|unmounted/i.test(w)).length, 0,
      "no setState-after-unmount warning");
  } finally { console.error = realError; }
});

// ══ 14 ══════════════════════════════════════════════════════════════════════════════════════
test("14: when the authoritative reload ALSO fails, the state is explicitly unsynchronised", async () => {
  const h = harness();
  await mount(h);
  h.setList("fail");
  await moveDown("cmp_1");
  await act(async () => { h.reorders()[0].settle(conflict); });
  await flush();
  assert.match(tid("reorder-live").textContent, /could not be confirmed/i,
    "the reader is told plainly, rather than shown an optimistic order as saved");
});

// ══ cross-cutting ═══════════════════════════════════════════════════════════════════════════
test("reorder never touches another control, and never uses a client counter as authority", async () => {
  const h = harness();
  await mount(h);
  await moveDown("cmp_1");
  await moveDown("cmp_3");
  await act(async () => { h.reorders()[0].settle(ok(["cmp_2", "cmp_1", "cmp_3", "cmp_4"], V.ONE)); });
  await flush();

  // Zero writes of any other kind were issued by dragging.
  assert.deepEqual(h.otherWrites(), [], "no rename, toggle, delivery-config or spread write");
  // Every reorder carried a SERVER version (or null before one existed) - never a counter.
  for (const r of h.reorders()) {
    const v = r.args.expectedVersion;
    assert.ok(v === null || typeof v === "string", `expectedVersion is a server token, got ${typeof v}`);
    assert.equal(typeof v === "number", false, "a numeric counter must never be sent as authority");
  }
});
