// src/components/corporateCampaign/reorderPointer.browser.test.mjs
//
// TEAM C — the POINTER path, proven behaviourally on the rendered dashboard.
//
// jsdom lays nothing out, so every rect would be zero and every midpoint identical. Each campaign
// tile is therefore given a deterministic 100px band derived from its CURRENT position in document
// order — position, not identity, which is what a real layout does after a row moves.
//
// Run (Node 20.x): node --test src/components/corporateCampaign/reorderPointer.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync, readFileSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__ptr.bundle.mjs");
const ENTRY = join(__dirname, ".__ptr.entry.jsx");
let React, createRoot, act, Surface, window;

const TILE_H = 100;

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
  globalThis.Event = window.Event; globalThis.MouseEvent = window.MouseEvent;
  globalThis.KeyboardEvent = window.KeyboardEvent;
  globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;

  // Deterministic layout: a tile's band follows its CURRENT index among the rendered tiles.
  window.Element.prototype.getBoundingClientRect = function rect() {
    const testid = this.getAttribute && this.getAttribute("data-testid");
    if (testid && testid.startsWith("campaign-card-")) {
      const tiles = [...document.querySelectorAll('[data-testid^="campaign-card-"]')];
      const i = tiles.indexOf(this);
      const top = i * TILE_H;
      return { top, bottom: top + TILE_H, height: TILE_H, left: 0, right: 400, width: 400, x: 0, y: top };
    }
    return { top: 0, bottom: 0, height: 0, left: 0, right: 0, width: 0, x: 0, y: 0 };
  };

  React = (await import("react")).default;
  act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ Surface } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); rmSync(BUNDLE.replace(/\.mjs$/, ".css"), { force: true }); rmSync(ENTRY, { force: true }); } catch { /* ignore */ } });

const ORG = "org_1";
const LIST_VERSION = "cord_4cf38037c47b08bf4cf38037c47b08bf";
const NAMES = ["Season’s Greetings", "Employee Milestones", "Vendor Appreciation", "Client Birthdays"];
const CAMPAIGNS = NAMES.map((name, i) => ({
  campaignId: `cmp_${i + 1}`, name, enabled: false,
  approvalStatus: "approved", lockStatus: "unlocked", audienceRefs: [],
  deliveryConfig: { scheduleMode: "campaign_date" },
}));

function harness() {
  const writes = [];
  const reorders = [];
  const client = {
    listMemberships: async () => ({ ok: true, data: { memberships: [{ corporateOrganizationId: ORG, role: "owner", status: "active" }] } }),
    listCampaigns: async () => ({ ok: true, data: { campaigns: CAMPAIGNS, viewerAuthorization: { isCurrentOrganizationOwner: true }, orderVersion: LIST_VERSION } }),
    listOrgContacts: async () => ({ ok: true, data: { contacts: [], count: 0 } }),
    readAudience: async () => ({ ok: true, data: { count: 0, contacts: [], unresolved: [] } }),
    readCampaign: async () => ({ ok: true, data: {} }),
    readReadiness: async () => ({ ok: true, data: {} }),
    createCampaign: async () => ({ ok: true, data: {} }),
    updateFeaturedSpread: async (...a) => { writes.push(["updateFeaturedSpread", ...a]); return { ok: true }; },
    approve: async (...a) => { writes.push(["approve", ...a]); return { ok: true }; },
    lock: async (...a) => { writes.push(["lock", ...a]); return { ok: true }; },
    unlock: async (...a) => { writes.push(["unlock", ...a]); return { ok: true }; },
    schedule: async (...a) => { writes.push(["schedule", ...a]); return { ok: true }; },
    activate: async (...a) => { writes.push(["activate", ...a]); return { ok: true }; },
    setCampaignEnabled: async (...a) => { writes.push(["setCampaignEnabled", ...a]); return { ok: true, data: {} }; },
    renameCampaign: async (...a) => { writes.push(["renameCampaign", ...a]); return { ok: true, data: {} }; },
    updateDeliveryConfig: async (...a) => { writes.push(["updateDeliveryConfig", ...a]); return { ok: true, data: {} }; },
    setAudience: async () => ({ ok: true, data: { count: 0, contacts: [], unresolved: [] } }),
    reorderCampaigns: async (args) => {
      reorders.push(args);
      return { ok: true, data: { campaigns: args.orderedCampaignIds.map((id) => ({ campaignId: id })), orderVersion: LIST_VERSION } };
    },
  };
  return { client, writes, reorders };
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
const order = () => [...document.querySelectorAll('[data-testid^="card-title-"]')].map((e) => e.textContent.trim());
const ids = () => [...document.querySelectorAll('[data-testid^="campaign-card-"]')]
  .map((e) => e.getAttribute("data-testid").replace("campaign-card-", ""));

/** A pointer gesture: press the handle, emit N moves at the given Ys, release. */
async function drag(campaignId, ys, { release = true } = {}) {
  const handle = tid(`card-drag-${campaignId}`);
  assert.ok(handle, `handle for ${campaignId}`);
  await act(async () => {
    handle.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientY: 0 }));
  });
  for (const y of ys) {
    await act(async () => {
      window.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientY: y }));
    });
  }
  if (release) {
    await act(async () => { window.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true })); });
  }
  await flush();
}

// ══ 1 ═══════════════════════════════════════════════════════════════════════════════════════
test("1: the first tile reaches FOURTH place in a single pointer event", async () => {
  const h = harness();
  await mount(h);
  assert.deepEqual(ids(), ["cmp_1", "cmp_2", "cmp_3", "cmp_4"]);
  // One move, past the fourth band's midpoint (350).
  await drag("cmp_1", [360]);
  assert.deepEqual(ids(), ["cmp_2", "cmp_3", "cmp_4", "cmp_1"], "one event was enough");
  assert.equal(h.reorders.length, 1);
  assert.deepEqual(h.reorders[0].orderedCampaignIds, ["cmp_2", "cmp_3", "cmp_4", "cmp_1"]);
});

// ══ 2 ═══════════════════════════════════════════════════════════════════════════════════════
test("2: the fourth tile reaches FIRST place in a single pointer event", async () => {
  const h = harness();
  await mount(h);
  await drag("cmp_4", [10]);                    // above the first band's midpoint (50)
  assert.deepEqual(ids(), ["cmp_4", "cmp_1", "cmp_2", "cmp_3"], "reverse jump in one event");
});

// ══ 3 ═══════════════════════════════════════════════════════════════════════════════════════
test("3: repeating the SAME pointer Y does not oscillate", async () => {
  const h = harness();
  await mount(h);
  await drag("cmp_1", [360, 360, 360, 360, 360]);
  assert.deepEqual(ids(), ["cmp_2", "cmp_3", "cmp_4", "cmp_1"], "settles and stays settled");
  // Repeated identical positions must not each produce a move announcement-driven write.
  assert.equal(h.reorders.length, 1, "one drop, one write");
});

// ══ 4 ═══════════════════════════════════════════════════════════════════════════════════════
test("4: a fast jump crosses every applicable midpoint, not one per event", async () => {
  const h = harness();
  await mount(h);
  // A single flick from the top to below the third midpoint (250) must land at index 2.
  await drag("cmp_1", [260]);
  assert.deepEqual(ids(), ["cmp_2", "cmp_3", "cmp_1", "cmp_4"]);
});

// ══ 5 + 6 ═══════════════════════════════════════════════════════════════════════════════════
test("5/6: no campaign duplicates and none disappears, across many gestures", async () => {
  const h = harness();
  await mount(h);
  for (const [id, ys] of [["cmp_1", [360]], ["cmp_4", [10]], ["cmp_3", [160]], ["cmp_2", [340]]]) {
    await drag(id, ys);
    const seen = ids();
    assert.equal(seen.length, 4, "still four");
    assert.equal(new Set(seen).size, 4, "all distinct");
    for (const c of ["cmp_1", "cmp_2", "cmp_3", "cmp_4"]) assert.ok(seen.includes(c), `${c} present`);
  }
});

// ══ 7 ═══════════════════════════════════════════════════════════════════════════════════════
test("7: the expanded campaign stays attached to its ID, not its position", async () => {
  const h = harness();
  await mount(h);
  await act(async () => { tid("card-expand-cmp_1").dispatchEvent(new window.Event("click", { bubbles: true })); });
  await flush();
  assert.ok(document.querySelector('[data-testid="campaign-card-cmp_1"].gcd-card--expanded'), "cmp_1 expanded");

  await drag("cmp_1", [360]);                    // move the EXPANDED campaign to last
  assert.deepEqual(ids(), ["cmp_2", "cmp_3", "cmp_4", "cmp_1"]);
  assert.ok(document.querySelector('[data-testid="campaign-card-cmp_1"].gcd-card--expanded'),
    "still cmp_1 - never whichever campaign now sits at the old index");
  assert.equal(document.querySelectorAll(".gcd-card--expanded").length, 1, "exactly one expanded");
});

// ══ 8 ═══════════════════════════════════════════════════════════════════════════════════════
test("8: a pointer drag issues ZERO other writes", async () => {
  const h = harness();
  await mount(h);
  await drag("cmp_1", [160, 260, 360]);
  assert.deepEqual(h.writes, [],
    "no rename, toggle, spread, delivery-config or lifecycle call was made by dragging");
  assert.equal(h.reorders.length, 1, "only the reorder itself");
});

// ══ 9 ═══════════════════════════════════════════════════════════════════════════════════════
test("9: touch uses the SAME path - pointer events carry both", async () => {
  const h = harness();
  await mount(h);
  const handle = tid("card-drag-cmp_1");
  await act(async () => {
    handle.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientY: 0, pointerType: "touch" }));
  });
  await act(async () => { window.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientY: 360 })); });
  await act(async () => { window.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true })); });
  await flush();
  assert.deepEqual(ids(), ["cmp_2", "cmp_3", "cmp_4", "cmp_1"], "a touch gesture reorders identically");
});

// ══ 10 + 11 ═════════════════════════════════════════════════════════════════════════════════
test("10/11: touch-action:none is confined to the handle; tiles and viewport still scroll", () => {
  const raw = readFileSync(new URL("./premiumDashboard.css", import.meta.url), "utf8");
  // Comments are stripped first: an explanatory comment mentioning touch-action would otherwise be
  // swallowed into the selector capture and make this assertion meaningless.
  const css = raw.replace(/\/\*[\s\S]*?\*\//g, "");
  const hits = [...css.matchAll(/([^{}]+)\{[^}]*touch-action:\s*none[^}]*\}/g)]
        .map((m) => m[1].trim().split(/\s+/).pop());
  assert.deepEqual(hits, [".gcd-drag"], "exactly one rule, on the drag handle");
  assert.equal((css.match(/touch-action/g) || []).length, 1, "one declaration in the whole stylesheet");
  // The scroller keeps its own overflow behaviour.
  const scroll = css.slice(css.indexOf(".gcd-scroll {"));
  assert.match(scroll.slice(0, scroll.indexOf("}")), /overflow-y:\s*auto/);
  assert.equal(/\.gcd-card\s*\{[^}]*touch-action/.test(css), false, "the tile itself is untouched");
});

// ══ 12 ══════════════════════════════════════════════════════════════════════════════════════
test("12: announcements truthfully report pickup, movement, drop and cancellation", async () => {
  const h = harness();
  await mount(h);
  const live = () => tid("reorder-live").textContent;

  const handle = tid("card-drag-cmp_1");
  await act(async () => { handle.dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientY: 0 })); });
  await flush();
  assert.match(live(), /grabbed/i, "pickup announced");
  assert.match(live(), /position 1 of 4/i, "with its position");

  await act(async () => { window.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientY: 360 })); });
  await flush();
  assert.match(live(), /moved to position 4 of 4/i, "movement announced truthfully");

  await act(async () => { window.dispatchEvent(new window.MouseEvent("pointerup", { bubbles: true })); });
  await flush();
  assert.match(live(), /dropped at position 4 of 4/i, "drop announced");

  // Cancellation via pointercancel returns the row and says so.
  await act(async () => { tid("card-drag-cmp_4").dispatchEvent(new window.MouseEvent("pointerdown", { bubbles: true, clientY: 0 })); });
  await act(async () => { window.dispatchEvent(new window.MouseEvent("pointermove", { bubbles: true, clientY: 10 })); });
  await act(async () => { window.dispatchEvent(new window.MouseEvent("pointercancel", { bubbles: true })); });
  await flush();
  assert.match(live(), /cancelled/i, "cancellation announced");
});
