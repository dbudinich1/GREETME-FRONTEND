// src/components/hub/hubW17Coverage.browser.test.mjs
//
// W17 / W16 RENDERED coverage that also runs on Node 20: the real Hub components are esbuild-bundled
// and mounted in jsdom. Unlike hubRedeemMarketplaceAnytimeCredits.browser.test.mjs (which fails on
// Node 20 because React reads a global `navigator` that jsdom setup never defines), this file defines
// `globalThis.navigator` from the jsdom window before React loads.
//
// Proves: Buy label, balance provenance, share rewards labeled "Not live yet", a reward the page
// cannot redeem never reads AVAILABLE, an unaffordable reward explains itself, locked tiles still
// have no button.
//
// Run (Node 20 or 25): node --test src/components/hub/hubW17Coverage.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ENTRY = join(__dirname, ".__hubw17.entry.jsx");
const BUNDLE = join(__dirname, ".__hubw17.bundle.mjs");
let React, createRoot, act, C;

const ICONS_STUB = `
const I = () => null;
export const Gift = I, ChevronDown = I, X = I, Heart = I, Sparkles = I;
export default {};
`;
const stubPlugin = () => ({ name: "stub", setup(b) {
  b.onResolve({ filter: /^lucide-react$/ }, (a) => ({ path: a.path, namespace: "icons" }));
  b.onLoad({ filter: /.*/, namespace: "icons" }, () => ({ contents: ICONS_STUB, loader: "js" }));
} });

before(async () => {
  writeFileSync(ENTRY, [
    `export { default as HubRedeemMarketplace } from "./HubRedeemMarketplace.jsx";`,
    `export { default as HubHeroHearts } from "./HubHeroHearts.jsx";`,
    `export { default as HubBalanceCard } from "./HubBalanceCard.jsx";`,
    `export { default as HubWaysToEarn } from "./HubWaysToEarn.jsx";`,
  ].join("\n"));
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser",
    jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime"],
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' },
    plugins: [stubPlugin()], logLevel: "silent",
  });
  rmSync(ENTRY, { force: true });

  const { window } = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  globalThis.window = window; globalThis.document = window.document;
  // The Node-20 fix: React reads `navigator`; Node < 21 has no such global.
  if (typeof globalThis.navigator === "undefined") {
    Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  }
  globalThis.HTMLElement = window.HTMLElement;
  globalThis.Event = window.Event; globalThis.CustomEvent = window.CustomEvent;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  C = await import(pathToFileURL(BUNDLE).href);
});
after(() => { try { rmSync(BUNDLE, { force: true }); } catch { /* ignore */ } });

async function mount(el) {
  const host = globalThis.document.createElement("div");
  globalThis.document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => { root.render(el); });
  return host;
}
const buttons = (host) => [...host.querySelectorAll("button")];
const CATALOG = [{ category: "Greet-Me", rewards: [
  { id: "anytime_greetme", title: "Anytime Greet-Me", hearts: 500, available: true, unlock: null },
  { id: "anytime_5", title: "5 Anytime Credits", hearts: 2000, available: true, unlock: null },
  { id: "free_gift", title: "Free Gift Thing", hearts: 100, available: true, unlock: null }, // available, NOT allowlisted
  { id: "holiday_bonus", title: "Holiday Bonus Send", hearts: 750, available: false, unlock: "Active subscription" },
] }];
const props = (o = {}) => ({
  catalog: CATALOG, balance: 600, redemptionPaused: false,
  redeemableRewardIds: { anytime_greetme: "free_greeting", anytime_5: "anytime_credits_5" },
  redeemOpen: false, redeemTargetId: null, redeemSubmitting: false, redeemOutcome: null,
  openRedeemIntent: () => {}, cancelRedeemIntent: () => {}, confirmRedeemIntent: () => {},
  marketplaceItems: [], mktConfirmId: null, mktRedeemingId: null, mktOutcome: {},
  handleMarketplaceRedeem: () => {}, setMktConfirmId: () => {}, ...o,
});
const card = (host, title) => [...host.querySelectorAll("div")].find((d) => d.children.length === 0 && d.textContent.trim() === title)?.parentElement;

test("W17: the Hub purchase buttons all say Buy Hero Hearts", async () => {
  const hero = await mount(React.createElement(C.HubHeroHearts, { setShowHeroHeartsModal: () => {} }));
  assert.ok(buttons(hero).some((b) => b.textContent.trim() === "Buy Hero Hearts"));
  assert.ok(!hero.textContent.includes("Open Hero Hearts"));
  const bal = await mount(React.createElement(C.HubBalanceCard, { balance: 120, setShowHeroHeartsModal: () => {}, onViewHistory: () => {} }));
  assert.ok(buttons(bal).some((b) => /Buy Hero Hearts/.test(b.textContent)));
});

test("W17: balance card explains where the number comes from", async () => {
  const bal = await mount(React.createElement(C.HubBalanceCard, { balance: 120, setShowHeroHeartsModal: () => {}, onViewHistory: () => {} }));
  const note = bal.querySelector('[data-testid="hub-balance-provenance"]');
  assert.ok(note, "provenance note present");
  assert.match(note.textContent, /ledger/i);
  assert.match(note.textContent, /Heart History/);
});

test("W16: share rewards say Not live yet and never show a Hearts amount; real earn rows keep theirs", async () => {
  const host = await mount(React.createElement(C.HubWaysToEarn, { amounts: [
    { behavior: "first_independent_send", amount: 50 },
    { behavior: "share_act", amount: 25 },
    { behavior: "share_converted", amount: 100 },
  ] }));
  assert.equal((host.textContent.match(/Not live yet/g) || []).length, 2);
  assert.ok(host.textContent.includes("50"));
  assert.ok(!host.textContent.includes("25 ❤️") && !host.textContent.includes("100 ❤️"));
});

test("W17: an available reward this page cannot redeem reads 'Not redeemable yet', never AVAILABLE", async () => {
  const host = await mount(React.createElement(C.HubRedeemMarketplace, props()));
  const tile = card(host, "Free Gift Thing");
  assert.ok(tile, "tile renders");
  assert.match(tile.textContent, /Not redeemable yet/);
  assert.ok(!/Available/i.test(tile.textContent.replace(/Not redeemable yet/, "")), "no AVAILABLE badge");
  assert.ok(tile.querySelector('[data-testid="reward-why-not"]'), "explanatory disclosure present");
  assert.equal(tile.querySelectorAll("button").length, 0, "still no redeem button");
});

test("W17: a redeemable reward is AVAILABLE only when affordable; unaffordable says so and explains on click", async () => {
  const host = await mount(React.createElement(C.HubRedeemMarketplace, props({ balance: 600 })));
  const ok = card(host, "Anytime Greet-Me");
  assert.match(ok.textContent, /Available/i);
  const poor = card(host, "5 Anytime Credits");
  assert.match(poor.textContent, /Need more Hearts/);
  assert.ok(!/Available/i.test(poor.textContent));
  const btn = [...poor.querySelectorAll("button")].find((b) => /more Hearts/.test(b.textContent));
  assert.ok(btn && !btn.disabled, "shortfall button is clickable");
  await act(async () => { btn.click(); });
  const detail = poor.querySelector('[data-testid="reward-shortfall-detail"]');
  assert.ok(detail);
  assert.match(detail.textContent, /2,000 Hearts/);
  assert.match(detail.textContent, /1,400 more/);
});

test("W17: a locked reward keeps no button and shows its unlock reason", async () => {
  const host = await mount(React.createElement(C.HubRedeemMarketplace, props()));
  const tile = card(host, "Holiday Bonus Send");
  assert.equal(tile.querySelectorAll("button").length, 0);
  assert.match(tile.textContent, /Unlocks with Active subscription/);
  assert.match(tile.textContent, /Locked/);
});

test("Hearts closeout: a clickable subscriber-only reward shows its requirement; provenance note is truthful", async () => {
  const catalog = [{ category: "Subscription", rewards: [
    { id: "renewal_10", title: "10% Renewal Discount", hearts: 750, available: true, unlock: "Active subscription" },
  ] }];
  const host = await mount(React.createElement(C.HubRedeemMarketplace, props({ catalog, balance: 1000, redeemableRewardIds: { renewal_10: "renewal_10" } })));
  const tile = card(host, "10% Renewal Discount");
  assert.ok(tile.querySelectorAll("button").length > 0, "tile stays clickable");
  assert.match(tile.querySelector('[data-testid="reward-requirement"]').textContent, /Requires: Active subscription/);
  const bal = await mount(React.createElement(C.HubBalanceCard, { balance: 120, setShowHeroHeartsModal: () => {}, onViewHistory: () => {} }));
  const note = bal.querySelector('[data-testid="hub-balance-provenance"]').textContent;
  assert.ok(!note.includes("Each entry is listed"));
  assert.match(note, /Heart History lists the Hearts you’ve earned/);
});
