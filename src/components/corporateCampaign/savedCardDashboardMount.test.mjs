// src/components/corporateCampaign/savedCardDashboardMount.test.mjs — TEAM I (CONNECTION D).
//
// Proof that the saved-card panel lives in the EXISTING corporate dashboard rather than on a new
// surface of its own, and that mounting it changed nothing else about that dashboard.
//
// This is a source assertion deliberately: the full dashboard needs memberships, campaigns,
// contacts, readiness and ordering to render, and its behaviour is already covered by the browser
// suites beside this file. What is NOT covered by any of those — and is exactly what this slice
// added — is WHERE the panel sits and what it is given.
//
// Run (Node 20.x): node --test src/components/corporateCampaign/savedCardDashboardMount.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const DASH = readFileSync(join(HERE, "GreetingAutomationCampaigns.jsx"), "utf8");
const PANEL = readFileSync(join(HERE, "SavedCardPanel.jsx"), "utf8");

test("W1 · the panel is mounted inside the existing dashboard, not on a new surface", () => {
  assert.match(DASH, /import SavedCardPanel from "\.\/SavedCardPanel\.jsx";/);
  assert.match(DASH, /<SavedCardPanel/);
  // Inside the SAME shell as the campaigns panel — one dashboard, one layout.
  const mountIdx = DASH.indexOf("<SavedCardPanel");
  const campaignsIdx = DASH.indexOf('data-testid="campaigns-panel"');
  const shellIdx = DASH.indexOf('data-testid="corporate-dashboard"');
  assert.ok(shellIdx > -1 && mountIdx > shellIdx, "the panel is inside the dashboard shell");
  assert.ok(mountIdx < campaignsIdx, "and above Campaigns, where the requirement is met first");
});

test("W2 · the panel receives the SERVER-derived organization id, never a user id", () => {
  const mount = DASH.slice(DASH.indexOf("<SavedCardPanel"), DASH.indexOf("/>", DASH.indexOf("<SavedCardPanel")));
  assert.match(mount, /orgId=\{effectiveOrgId\}/);
  assert.doesNotMatch(mount, /user/i);
});

test("W3 · the PANEL owns the payments client, so the dashboard stays free of payment imports", () => {
  // The surface is under an existing conformity lock (campaignSurface.teamA.test.mjs) forbidding a
  // payment-, gift- or fundraising-shaped import. Mounting the panel must not have weakened it, so
  // the same rule is re-applied here line by line.
  const importLines = DASH.split(/\r?\n/).filter((l) => /^\s*import\b/.test(l) || /\bfrom "/.test(l));
  assert.ok(importLines.length > 0, "the surface does have imports to check");
  for (const line of importLines) {
    assert.doesNotMatch(line, /(gift|fundrais|payment|stripe|merch|GreetingCardProto|worker)/i,
      `the surface must not import: ${line.trim()}`);
  }
  // The client lives behind the panel instead, still injectable for tests.
  assert.match(PANEL, /import \{ createCorporatePaymentsClient \} from "\.\.\/\.\.\/api\/corporatePayments\.js";/);
  assert.match(PANEL, /client \|\| createCorporatePaymentsClient\(\)/);
  // The campaigns client is untouched — the two surfaces do not share or override one another.
  assert.match(DASH, /injectedClient \|\| createCorporateCampaignsClient\(\)/);
});

test("W4 · the dashboard's own campaign behaviour is unchanged by the mount", () => {
  // The existing panels, controls and testids the other suites rely on are all still present.
  for (const marker of [
    'data-testid="campaigns-panel"', 'data-testid="open-create"', 'data-testid="campaign-viewport"',
    'data-testid="corporate-dormant"', 'data-testid="overlap-warning"', 'data-testid="reorder-live"',
  ]) {
    assert.ok(DASH.includes(marker), `${marker} must still exist`);
  }
});

test("W5 · the panel reaches ONLY the corporate payments client — no campaign write from here", () => {
  for (const forbidden of [
    "createCampaign", "updateDeliveryConfig", "schedule(", "activate(", "lock(", "unlock(",
    "setAudience", "reorderCampaigns",
  ]) {
    assert.ok(!PANEL.includes(forbidden), `the card panel must not call ${forbidden}`);
  }
});

test("W6 · the panel uses the repository's EXISTING Stripe client pattern, and adds no second one", () => {
  assert.match(PANEL, /from "@stripe\/react-stripe-js"/);
  assert.match(PANEL, /from "\.\.\/\.\.\/stripe\/stripeProvider"/);
  // No second loadStripe call and no second publishable key are introduced.
  assert.doesNotMatch(PANEL, /loadStripe/);
  assert.doesNotMatch(PANEL, /VITE_STRIPE_PUBLISHABLE_KEY/);
});

test("W7 · the panel holds no card field of its own, and never stores the client secret", () => {
  // Comments are stripped first: the file DESCRIBES the card fields it deliberately does not own,
  // and a prose mention of "CVC" is the opposite of a violation. What matters is the CODE.
  const code = PANEL.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  for (const forbidden of [/type="?tel"?/, /cardNumber/, /\bcvc\b/i, /expiry/i, /exp_month/, /exp_year/]) {
    assert.doesNotMatch(code, forbidden, `the panel must not carry ${forbidden}`);
  }
  // The client secret is read into a local const and used once — never into state or a ref.
  assert.match(PANEL, /const clientSecret = begin\.data && begin\.data\.clientSecret;/);
  assert.doesNotMatch(PANEL, /setClientSecret|clientSecretRef|useState\([^)]*clientSecret/);
});
