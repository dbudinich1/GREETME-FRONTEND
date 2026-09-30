// src/components/corporateCampaign/savedCardDashboardMount.test.mjs — TEAM I (CONNECTION D),
// relocated by TEAM 5 (2026-09-29).
//
// Proof that the saved-card panel lives inside the campaign's own Schedule & Payment experience
// rather than on a detached surface of its own, and that mounting it there changed nothing else.
//
// TEAM 5 relocation: the panel used to mount directly in GreetingAutomationCampaigns.jsx, above
// Campaigns, as its own detached account-level panel. Founder-approved layout rule #8/#9 calls
// for payment management to live INSIDE the campaign's Schedule & Payment tab instead, and for
// there to be no such detached panel — so it now mounts in CampaignCard.jsx, and
// GreetingAutomationCampaigns.jsx only threads `cardClient`/`stripeOverride` one level further
// down to it (same two props it always passed, just handed to a child instead of used directly).
// W1/W2 below now assert the NEW mount point; W3-W7 test the panel's OWN source and are
// unaffected by where it is mounted, so they are unchanged.
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
const CARD = readFileSync(join(HERE, "CampaignCard.jsx"), "utf8");
const PANEL = readFileSync(join(HERE, "SavedCardPanel.jsx"), "utf8");

test("W1 · the panel is mounted inside the campaign's own Schedule & Payment tab, not on a detached surface", () => {
  assert.match(CARD, /import SavedCardPanel from "\.\/SavedCardPanel\.jsx";/);
  assert.match(CARD, /<SavedCardPanel/);
  // Inside the Schedule & Payment tab specifically, not floating loose in the card.
  const mountIdx = CARD.indexOf("<SavedCardPanel");
  const scheduleTabIdx = CARD.indexOf('data-testid={`tab-schedule-${campaign.campaignId}`}');
  assert.ok(scheduleTabIdx > -1 && mountIdx > scheduleTabIdx, "the panel is inside the Schedule & Payment tab");
  // And it is NOT mounted directly in the dashboard surface any more — no detached panel.
  assert.doesNotMatch(DASH, /<SavedCardPanel/, "no detached account-level mount remains on the dashboard");
  assert.doesNotMatch(DASH, /import SavedCardPanel/, "and the dashboard no longer imports it directly");
});

test("W2 · the panel receives the SERVER-derived organization id, never a user id", () => {
  const mount = CARD.slice(CARD.indexOf("<SavedCardPanel"), CARD.indexOf("/>", CARD.indexOf("<SavedCardPanel")));
  assert.match(mount, /orgId=\{orgId\}/);
  assert.doesNotMatch(mount, /user/i);
  // CampaignCard's own `orgId` prop is, in turn, always the dashboard's server-derived
  // effectiveOrgId — confirmed at the one place CampaignCard is mounted (a single self-closing
  // JSX tag, so the next "/>" after it marks the end of its prop list).
  const cardMountIdx = DASH.indexOf("<CampaignCard");
  assert.ok(cardMountIdx > -1, "CampaignCard is mounted somewhere in the dashboard");
  const cardMountBlock = DASH.slice(cardMountIdx, DASH.indexOf("/>", cardMountIdx) + 2);
  assert.match(cardMountBlock, /orgId=\{effectiveOrgId\}/);
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
    'data-testid="campaigns-panel"', 'data-testid="create-form"', 'data-testid="campaign-viewport"',
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
