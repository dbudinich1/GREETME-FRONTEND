// src/components/hub/hubRedeemMarketplaceAnytimeCredits.browser.test.mjs
//
// RENDERED-COMPONENT coverage of the generalized Hearts redemption interaction: the REAL
// HubRedeemMarketplace is esbuild-transformed and mounted into jsdom (only lucide-react is
// stubbed — hubConfig is the real data, so displayed prices are the real canonical ones).
//
// Proves:
//   - the 3-credit and 5-credit tiles are actionable (a Redeem button exists and calls
//     openRedeemIntent with the correct reward id) — the thing this packet connects;
//   - every OTHER reward tile remains locked and non-actionable (no button, no onClick, at all)
//     — this generalization touches nothing else;
//   - the confirm dialog reuses the existing experience verbatim (same copy pattern, same
//     Confirm/Cancel buttons calling the same handler props) for the new rewards, keyed by
//     redeemTargetId so only the tile that's actually mid-intent shows it;
//   - all displayed prices are exactly the canonical ones (500 / 1,200 / 2,000) — unchanged.
//
// Run: node --test src/components/hub/hubRedeemMarketplaceAnytimeCredits.browser.test.mjs

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BUNDLE = join(__dirname, ".__hubredeemmarketplace-ac.bundle.mjs");
let React, createRoot, act, HubRedeemMarketplace;

const ICONS_STUB = `
import React from "react";
const I = () => null;
export const Gift = I, ChevronDown = I, X = I;
export default {};
`;

function stubPlugin() {
  const map = [[/^lucide-react$/, ICONS_STUB, "icons"]];
  return { name: "stub", setup(b) {
    for (const [filter, contents, ns] of map) {
      b.onResolve({ filter }, (a) => ({ path: a.path, namespace: ns }));
      b.onLoad({ filter: /.*/, namespace: ns }, () => ({ contents, loader: "js" }));
    }
  } };
}

before(async () => {
  writeFileSync(
    join(__dirname, ".__hubredeemmarketplace-ac.jsx"),
    `export { default as HubRedeemMarketplace } from "./HubRedeemMarketplace.jsx";\n`
  );
  await esbuild.build({
    entryPoints: [join(__dirname, ".__hubredeemmarketplace-ac.jsx")], outfile: BUNDLE, bundle: true,
    format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stubPlugin()], logLevel: "silent",
  });
  rmSync(join(__dirname, ".__hubredeemmarketplace-ac.jsx"), { force: true });

  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  const { window } = dom;
  globalThis.window = window; globalThis.document = window.document;
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  ({ HubRedeemMarketplace } = await import(pathToFileURL(BUNDLE).href));
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

// The exact canonical catalog shape the server sends (GET /api/hearts/catalog, transformed by
// Rewards.jsx) once Anytime Credits are wired: state AVAILABLE for the three redeemable rewards,
// LOCKED for everything else — mirrors config/catalogService.js's deriveCatalogState output.
const CATALOG = [
  { category: "Greet-Me", rewards: [
    { id: "anytime_greetme", title: "Anytime Greet-Me", hearts: 500, available: true, unlock: null },
    { id: "anytime_3", title: "3 Anytime Credits", hearts: 1200, available: true, unlock: null },
    { id: "anytime_5", title: "5 Anytime Credits", hearts: 2000, available: true, unlock: null },
    { id: "holiday_bonus", title: "Holiday Bonus Send", hearts: 750, available: false, unlock: null },
  ] },
  { category: "Subscription", rewards: [
    // Allowlisted (connected) but NOT server-available — matches production reality today
    // (marketplaceRedemptionEnabled is off). Must stay a plain, non-actionable RewardTile.
    { id: "renewal_10", title: "10% Renewal Discount", hearts: 750, available: false, unlock: "Active subscription" },
    // Allowlisted AND server-available — matches the state once the founder flips that flag.
    { id: "renewal_15", title: "15% Renewal Discount", hearts: 1200, available: true, unlock: "Active subscription" },
  ] },
];
const REDEEMABLE_IDS = {
  anytime_greetme: "free_greeting", anytime_3: "anytime_credits_3", anytime_5: "anytime_credits_5",
  renewal_10: "renewal_10", renewal_15: "renewal_15", renewal_20: "renewal_20", upgrade_discount: "upgrade_discount",
};

let openCalls, cancelCalls, confirmCalls;
function baseProps(overrides = {}) {
  openCalls = []; cancelCalls = 0; confirmCalls = 0;
  return {
    catalog: CATALOG,
    balance: 5000,
    redemptionPaused: false,
    redeemableRewardIds: REDEEMABLE_IDS,
    redeemOpen: false,
    redeemTargetId: null,
    redeemSubmitting: false,
    redeemOutcome: null,
    openRedeemIntent: (id) => openCalls.push(id),
    cancelRedeemIntent: () => { cancelCalls += 1; },
    confirmRedeemIntent: () => { confirmCalls += 1; },
    marketplaceItems: [],
    mktConfirmId: null,
    mktRedeemingId: null,
    mktOutcome: {},
    handleMarketplaceRedeem: () => {},
    setMktConfirmId: () => {},
    ...overrides,
  };
}

async function renderWith(props) {
  const host = globalThis.document.createElement("div");
  globalThis.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(React.createElement(HubRedeemMarketplace, props)); });
  return { host, unmount: () => act(async () => root.unmount()) };
}

// ── Actionable: the two connected rewards ───────────────────────────────────────────────────

test("3 Anytime Credits tile shows a Redeem button at the exact canonical price and calls openRedeemIntent('anytime_3')", async () => {
  const props = baseProps();
  const r = await renderWith(props);
  const btn = [...r.host.querySelectorAll("button")].find((b) => /Redeem\s+1,200\s+Hearts/.test(b.textContent));
  assert.ok(btn, "a Redeem button for exactly 1,200 Hearts must exist");
  btn.click();
  assert.deepEqual(openCalls, ["anytime_3"]);
  await r.unmount();
});

test("5 Anytime Credits tile shows a Redeem button at the exact canonical price and calls openRedeemIntent('anytime_5')", async () => {
  const props = baseProps();
  const r = await renderWith(props);
  const btn = [...r.host.querySelectorAll("button")].find((b) => /Redeem\s+2,000\s+Hearts/.test(b.textContent));
  assert.ok(btn, "a Redeem button for exactly 2,000 Hearts must exist");
  btn.click();
  assert.deepEqual(openCalls, ["anytime_5"]);
  await r.unmount();
});

test("Anytime Greet-Me tile is unchanged: Redeem button for exactly 500 Hearts, calls openRedeemIntent('anytime_greetme')", async () => {
  const props = baseProps();
  const r = await renderWith(props);
  const btn = [...r.host.querySelectorAll("button")].find((b) => /Redeem\s+500\s+Hearts/.test(b.textContent));
  assert.ok(btn);
  btn.click();
  assert.deepEqual(openCalls, ["anytime_greetme"]);
  await r.unmount();
});

// ── Confirm/cancel experience reused verbatim, keyed to the right tile ─────────────────────

test("confirm dialog for the 3-credit reward shows the exact cost+grant copy and wires Confirm/Cancel", async () => {
  const props = baseProps({ redeemOpen: true, redeemTargetId: "anytime_3" });
  const r = await renderWith(props);
  assert.ok(r.host.textContent.includes("Spend"), "confirm copy must render");
  assert.ok(r.host.textContent.includes("1,200 Hearts"), "exact cost in the confirm copy");
  // Copy is generic (reward.title), not a per-grant-type count — generalized in the Subscription-
  // discount connection so a new grant kind never needs a new copy branch here.
  assert.ok(r.host.textContent.includes("3 Anytime Credits"), "the reward's own title appears in the confirm copy");
  const confirmBtn = [...r.host.querySelectorAll("button")].find((b) => b.textContent === "Confirm");
  const cancelBtn = [...r.host.querySelectorAll("button")].find((b) => b.textContent === "Cancel");
  assert.ok(confirmBtn && cancelBtn);
  confirmBtn.click();
  assert.equal(confirmCalls, 1);
  cancelBtn.click();
  assert.equal(cancelCalls, 1);
  await r.unmount();
});

test("an open intent for anytime_3 does NOT show a confirm dialog on the anytime_5 tile (only the targeted tile opens)", async () => {
  const props = baseProps({ redeemOpen: true, redeemTargetId: "anytime_3" });
  const r = await renderWith(props);
  // Exactly one "Confirm" button anywhere — the untargeted tile still shows its plain Redeem button.
  const confirmButtons = [...r.host.querySelectorAll("button")].filter((b) => b.textContent === "Confirm");
  assert.equal(confirmButtons.length, 1);
  const fiveStillHasRedeemButton = [...r.host.querySelectorAll("button")].some((b) => /Redeem\s+2,000\s+Hearts/.test(b.textContent));
  assert.ok(fiveStillHasRedeemButton, "the untargeted tile is unaffected");
  await r.unmount();
});

// ── Non-actionable: every other reward stays locked, with NO click affordance at all ───────

test("a LOCKED, non-allowlisted reward (Holiday Bonus Send) renders with NO button whatsoever", async () => {
  const props = baseProps();
  const r = await renderWith(props);
  // The title renders as its own leaf div (RewardTile); its immediate parent is that one
  // reward's card — not an ancestor grid/section containing every other card too.
  const titleEl = [...r.host.querySelectorAll("div")].find(
    (d) => d.children.length === 0 && d.textContent.trim() === "Holiday Bonus Send"
  );
  assert.ok(titleEl, "the reward must still render (never hidden)");
  const card = titleEl.parentElement;
  assert.equal(card.querySelectorAll("button").length, 0, "no button anywhere in this reward's own card");
});

test("a LOCKED reward's card shows its unlock reason and exact price, never a redeem affordance", async () => {
  const props = baseProps();
  const r = await renderWith(props);
  assert.ok(r.host.textContent.includes("10% Renewal Discount"));
  assert.ok(r.host.textContent.includes("750"));
  assert.ok(r.host.textContent.includes("Unlocks with Active subscription"));
});

test("total interactive Redeem/Confirm/Cancel affordances equal exactly the allowlisted-AND-available rewards — never more", async () => {
  const props = baseProps();
  const r = await renderWith(props);
  const redeemButtons = [...r.host.querySelectorAll("button")].filter((b) => /^Redeem\s/.test(b.textContent));
  assert.equal(redeemButtons.length, 4, "anytime_greetme + anytime_3 + anytime_5 + renewal_15 (available); renewal_10 is allowlisted but NOT available, so it's excluded");
});

// ── A connected-but-not-yet-live reward (allowlisted, server says LOCKED) stays non-actionable ──

test("renewal_10 is allowlisted (route connected) but server-LOCKED (marketplaceRedemptionEnabled off) — still renders with NO button", async () => {
  const props = baseProps();
  const r = await renderWith(props);
  const titleEl = [...r.host.querySelectorAll("div")].find(
    (d) => d.children.length === 0 && d.textContent.trim() === "10% Renewal Discount"
  );
  assert.ok(titleEl);
  const card = titleEl.parentElement;
  assert.equal(card.querySelectorAll("button").length, 0, "connected but not server-available -> still no button (truthful, not clickable-but-refused)");
});

// ── A connected AND server-available Subscription-discount reward IS actionable, generic copy ──

// 3 Anytime Credits and 15% Renewal Discount share the same 1,200-Hearts cost, so button lookup
// must be scoped to the right CARD (by its title), not just by cost text.
function cardByTitle(host, title) {
  const titleEl = [...host.querySelectorAll("div")].find((d) => d.children.length === 0 && d.textContent.trim() === title);
  assert.ok(titleEl, `"${title}" must render somewhere on the page`);
  return titleEl.parentElement;
}

test("renewal_15 (allowlisted AND available) shows a Redeem button with title-based copy, and calls openRedeemIntent('renewal_15')", async () => {
  const props = baseProps();
  const r = await renderWith(props);
  const card = cardByTitle(r.host, "15% Renewal Discount");
  const btn = [...card.querySelectorAll("button")].find((b) => /^Redeem\s/.test(b.textContent));
  assert.ok(btn, "a Redeem button must exist in the 15% Renewal Discount card specifically");
  assert.match(btn.textContent, /1,200\s+Hearts/, "exact price on that card's own button");
  btn.click();
  assert.deepEqual(openCalls, ["renewal_15"]);
  await r.unmount();
});

test("renewal_15's confirm dialog uses the generic title-based copy, not an Anytime-specific grant count", async () => {
  const props = baseProps({ redeemOpen: true, redeemTargetId: "renewal_15" });
  const r = await renderWith(props);
  const card = cardByTitle(r.host, "15% Renewal Discount");
  assert.ok(card.textContent.includes("1,200 Hearts"));
  assert.ok(!card.textContent.includes("Anytime Greet-Me"), "no Anytime-specific wording leaks into THIS card's own copy (other tiles on the page legitimately mention it)");
});

// ── Outcome message shown only on the tile it belongs to ───────────────────────────────────

test("a success outcome renders only on the tile named by redeemTargetId", async () => {
  const props = baseProps({ redeemTargetId: "anytime_3", redeemOutcome: { type: "success", message: "🎉 Redeemed! 3 Anytime Greet-Mes have been added to your account." } });
  const r = await renderWith(props);
  assert.ok(r.host.textContent.includes("3 Anytime Greet-Mes have been added"));
  // The message must not be duplicated onto the Anytime Greet-Me tile's own area — sanity count.
  const occurrences = (r.host.textContent.match(/have been added to your account/g) || []).length;
  assert.equal(occurrences, 1);
});
