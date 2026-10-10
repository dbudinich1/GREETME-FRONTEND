// src/pages/helpPage.browser.test.mjs
// W41 / checklist #20 — the customer Help & Quick Start page (/help), mounted in jsdom from the REAL Help.jsx,
// plus the founder's required corrections (Report 60 §0B) pinned against main's own sources.
// Run (Node 20): node --test src/pages/helpPage.browser.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { readFileSync, writeFileSync, rmSync } from "node:fs";
import { JSDOM } from "jsdom";
import esbuild from "esbuild";

const __dirname = dirname(fileURLToPath(import.meta.url));
const read = (rel) => readFileSync(join(__dirname, rel), "utf8");
const PID = process.pid;
const ENTRY = join(__dirname, `.__help.${PID}.entry.jsx`);
const BUNDLE = join(__dirname, `.__help.${PID}.bundle.mjs`);
let React, createRoot, act, M, window, pageText = "", doc;

before(async () => {
  writeFileSync(ENTRY, [
    'export { default as Help } from "./Help.jsx";',
    'export { default as Support } from "./Support.jsx";',
    'export * as C from "./helpContent.js";',
    'export { personalPlans } from "../config/plans.js";',
    'export { MemoryRouter, Routes, Route } from "react-router-dom";',
  ].join("\n"));
  await esbuild.build({
    entryPoints: [ENTRY], outfile: BUNDLE, bundle: true, format: "esm", platform: "browser", jsx: "automatic", jsxImportSource: "react",
    external: ["react", "react-dom", "react-dom/client", "react/jsx-runtime", "react-router-dom"],
    loader: { ".css": "empty", ".png": "dataurl", ".svg": "dataurl", ".jpg": "dataurl" },
    define: { "import.meta.env": "{}", "process.env.NODE_ENV": '"production"' }, logLevel: "silent",
  });
  const dom = new JSDOM("<!doctype html><html><body></body></html>", { url: "http://localhost/" });
  window = dom.window;
  globalThis.window = window; globalThis.document = window.document;
  if (typeof globalThis.navigator === "undefined") Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
  globalThis.HTMLElement = window.HTMLElement; globalThis.Event = window.Event; globalThis.getComputedStyle = window.getComputedStyle;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.fetch = async () => { throw new Error("no test may make a network request"); };
  React = (await import("react")).default; act = React.act;
  ({ createRoot } = await import("react-dom/client"));
  M = await import(pathToFileURL(BUNDLE).href);
  pageText = await renderAt("/help");
  doc = document;
});
after(() => { for (const f of [ENTRY, BUNDLE]) { try { rmSync(f, { force: true }); } catch { /* ignore */ } } });

async function renderAt(path) {
  document.body.innerHTML = "";
  const host = document.createElement("div"); document.body.appendChild(host);
  const root = createRoot(host);
  const h = React.createElement;
  await act(async () => {
    root.render(h(M.MemoryRouter, { initialEntries: [path] },
      h(M.Routes, null,
        h(M.Route, { path: "/help", element: h(M.Help) }),
        h(M.Route, { path: "/support", element: h(M.Support) }))));
  });
  return document.body.textContent;
}
const all = (t) => [...doc.querySelectorAll(`[data-testid="${t}"]`)];

test("App.jsx registers /help -> <Help />, and the vanity-alias list already reserves 'help'", () => {
  const app = read("../App.jsx");
  assert.match(app, /import Help from "\.\/pages\/Help";/);
  assert.match(app, /<Route path="\/help" element=\{<Help \/>\} \/>/);
  assert.match(read("sales/vanityAlias.js"), /"help"/);
});

test("the route renders the three parts: Quick Start (intro + 7 steps), FAQ, Plans at a glance", () => {
  for (const id of ["help-quick-start", "help-faq", "help-plans"]) assert.ok(doc.querySelector(`[data-testid="${id}"]`), id);
  assert.equal(all("help-step").length, 7);
  assert.equal(all("help-faq-item").length, M.C.FAQ.length);
  assert.ok(pageText.includes("Welcome to Greet-Me"));
  assert.ok(pageText.includes("Plans at a glance"));
  assert.ok(!pageText.includes("**"), "bold markers are rendered, never shown raw");
  assert.ok(!/APPENDIX|UNVERIFIED|Grounded in/i.test(pageText), "the draft's Appendix is stripped");
});

test("correction (a): no pre-send preview is described", () => {
  assert.ok(!pageText.includes("Review everything on the final screen"));
  assert.ok(!/preview/i.test(pageText));
});

test("correction (b): no 'Cancel anytime'", () => {
  assert.ok(!/cancel any ?time/i.test(pageText));
});

test("correction (c) + founder decision #7: Help and the Terms both list exactly the claim screen's payout methods", () => {
  // The claim screen's own list, in its order (GiftClaim.jsx PAYOUT_METHODS labels).
  const claimSrc = read("GiftClaim.jsx");
  const block = /const PAYOUT_METHODS = \[([\s\S]*?)\n\];/.exec(claimSrc);
  assert.ok(block, "GiftClaim.jsx still declares PAYOUT_METHODS");
  const claim = [...block[1].matchAll(/label: '([^']+)'/g)].map((x) => x[1]);
  assert.deepEqual(claim, ["Zelle", "Venmo", "Cash App", "PayPal"], "sanity: the claim screen's four methods");
  const spoken = `${claim.slice(0, -1).join(", ")} or ${claim.at(-1)}`;
  // Terms (Legal.jsx): the single payout sentence names the same four, same order.
  const legal = read("../Legal.jsx");
  assert.ok(legal.includes(`QR Cash payouts are reviewed and sent manually by our team, to the ${spoken} account the recipient provides.`));
  // Help: same list.
  assert.deepEqual(M.C.QR_CASH_PAYOUT_METHODS, claim);
  assert.ok(pageText.includes(`(${spoken})`));
  // The two other founder-approved Terms sentences are untouched.
  assert.ok(legal.includes("G1G1 gifts are not available when a Greet-Me Credit received with a QR Cash gift is applied."));
  assert.ok(legal.includes("Hero Hearts are non-refundable, have no cash value, and cannot be transferred or exchanged; Greet-Me may change Hearts costs and available rewards at any time."));
  // The claim window matches the Terms ("30 days after the gift is created").
  assert.match(legal, /Unclaimed gifts expire 30 days after the gift is created/);
  assert.ok(pageText.includes("30 days after the gift is created"));
});

test("correction (d): 'lifetime' appears only in the exact Founders sentence Pricing.jsx already shows", () => {
  const pricing = read("Pricing.jsx");
  assert.ok(pricing.includes(M.C.FOUNDERS_PRICING_NOTE), "Pricing.jsx already promises this exact sentence");
  const hits = pageText.match(/lifetime/gi) || [];
  assert.equal(hits.length, 1);
  assert.ok(pageText.includes(M.C.FOUNDERS_PRICING_NOTE));
  // Founders pricing is still offered on Pricing (default view), so the Founders column is kept.
  assert.match(pricing, /useState\('founders'\)/);
});

test("founder decision #8: the Hearts wording is exactly the approved sentence, with no award numbers", () => {
  const H = "You can earn Hearts from your welcome greeting, your first send and other eligible activities, then spend them in the Hearts Hub.";
  assert.equal(M.C.HEARTS_LINE, H);
  assert.ok(pageText.includes(H));
  const heartsText = [...M.C.QUICK_START_STEPS.map((s) => s.body), ...M.C.FAQ.map((f) => f.a)].filter((t) => /Hearts/.test(t));
  for (const t of heartsText) {
    assert.ok(t.includes(H), "every Hearts mention carries the approved sentence");
    assert.ok(!/\d/.test(t.replace(H, "")), "no award numbers beside it");
  }
  assert.ok(!/500 Hearts|once a day|what they can become/.test(pageText));
});

test("Greet-Me Credit terminology: no 'referral credit' (and no credit claims at all)", () => {
  assert.ok(!/referral/i.test(pageText));
  assert.ok(!/credit/i.test(pageText));
});

test("no vendor / payment-processor names, fee internals or dormant features", () => {
  const banned = [
    "Stripe", "Goody", "Florist One", "Printful", "Prezzee", "Shopify", "SendGrid", "ElevenLabs", "D-ID", "OpenAI", "Azure",
    "Scheduled QR Cash", "Auto-Gift", "Impact", "corporate", "Corporate", "Business plan", "Hero", "fundraiser", "Fundraiser",
    "Smart Card", "Gift Cards", "social", "Coming soon", "coming soon", "Top Up", "Top up",
  ];
  for (const b of banned) assert.ok(!pageText.includes(b), `must not mention "${b}"`);
  assert.ok(!/\bfees?\b/i.test(pageText), "no fee wording");
});

test("plans table equals config/plans.js (the source Pricing.jsx renders)", () => {
  const P = M.personalPlans;
  const rows = all("help-plan-row").map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent));
  assert.equal(rows.length, P.standard.length);
  P.standard.forEach((std, i) => {
    const fdr = P.founders.find((p) => p.planTier === std.planTier);
    const feats = std.featureGroups.flatMap((g) => g.features);
    const [name, founders, standard, recipients, monthly, anytime, bank] = rows[i];
    assert.equal(name, std.name);
    assert.equal(founders, `$${fdr.price.toFixed(2)}`);
    assert.equal(standard, `$${std.price.toFixed(2)}`);
    assert.ok(feats.includes(`${recipients} recipients`), `${std.name} recipients`);
    assert.ok(feats.some((f) => f.startsWith(`${monthly} Greet-Me`) && f.endsWith("included each month")), `${std.name} monthly`);
    assert.ok(feats.some((f) => f.startsWith(`${anytime} Anytime Greet-Me`)), `${std.name} anytime`);
    if (bank === "-") assert.ok(!feats.some((f) => /^Bank up to/.test(f)), `${std.name} bank`);
    else assert.ok(feats.includes(`Bank up to ${bank.replace("Up to ", "")} unused Greet-Mes`), `${std.name} bank`);
    assert.equal(std.period, "year"); assert.equal(fdr.period, "year");
    assert.ok(feats.includes("Greet One, Give One™ included"));
  });
  for (const r of M.C.helpPlanRows()) for (const [k, v] of Object.entries(r)) assert.notEqual(v, null, `${r.name}.${k} parsed from config`);
  // The FAQ's recipient answer agrees with the same config.
  const faq = M.C.FAQ.find((f) => f.q === "How many people can I add?").a;
  const byTier = Object.fromEntries(M.C.helpPlanRows().map((r) => [r.planTier, r.recipients.toLowerCase()]));
  assert.ok(faq.includes(`${byTier.close_circle} on Close Circle`));
  assert.ok(faq.includes(`${byTier.social_butterfly} on Social Butterfly`));
  assert.ok(faq.includes(`${byTier.unforgettable} on Legend`));
  // Renewal sentence is the shared subscription-terms constant.
  assert.ok(pageText.includes("Subscription automatically renews until cancelled."));
});

test("the Support page links to /help (one link)", async () => {
  await renderAt("/support");
  const links = [...document.querySelectorAll('a[href="#/help"]')];
  assert.equal(links.length, 1);
  assert.equal(links[0].textContent, "Help & Quick Start");
});
