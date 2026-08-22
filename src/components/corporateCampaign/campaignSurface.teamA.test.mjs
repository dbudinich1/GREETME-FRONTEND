// src/components/corporateCampaign/campaignSurface.teamA.test.mjs — Team A membership-scoped
// surface model + invariants. Run: node --test src/components/corporateCampaign/campaignSurface.teamA.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  activeMemberships, resolveOrganizationContext,
  interpretCapability, writeResultMessage, deriveCampaignSummary, CORPORATE_VIDEO, TERMS,
} from "./campaignSurfaceModel.js";
import { FEATURED_SPREAD_READINESS as R } from "../../corporateCampaign/constants.js";

const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");
const SURFACE = read("./GreetingAutomationCampaigns.jsx");
const DETAIL = read("./CampaignDetail.jsx");
const MODEL = read("./campaignSurfaceModel.js");
const ALL = SURFACE + DETAIL + MODEL;

const memb = (arr) => ({ ok: true, data: { memberships: arr } });
const A = (id, role = "admin") => ({ corporateOrganizationId: id, role, status: "active" });

// (1) user.id is NEVER used as an organization id.
test("user.id is never used as corporateOrganizationId (source)", () => {
  assert.ok(!/user\??\.id/.test(SURFACE), "surface must not read user.id");
  assert.ok(!/useAuth/.test(SURFACE), "surface must not derive org from useAuth");
  assert.ok(!/corporateOrganizationId\s*\|\|/.test(ALL), "no '|| fallback' for org id");
});

// (2) Dormant (capability off / not enrolled) → Founder-approved read-only state (F3 Draft B):
// never a blank page, never a fabricated organization, zero writes.
test("dormant renders the approved read-only state and never fabricates an organization", () => {
  const c = resolveOrganizationContext({ dormant: true });
  assert.equal(c.phase, "dormant");
  assert.equal(c.selectedOrgId, null);
  // The dormant guard still short-circuits at the same decision point (before any org campaign work)…
  assert.match(SURFACE, /if \(ctx\.phase === "dormant" \|\| campaignDormant\)/);
  // …and now renders the Founder-approved read-only dormant state instead of returning null (blank).
  assert.match(SURFACE, /data-testid="corporate-dormant"/);
  assert.match(SURFACE, /Greet-Me for Business/);
  assert.match(SURFACE, /available to enrolled organizations/);
  assert.doesNotMatch(SURFACE, /"dormant" \|\| campaignDormant\) return null/);
  assert.equal(interpretCapability({ ok: false, dormant: true }).available, false);
});

// (3) Zero memberships → safe empty state; no org campaign request.
test("zero active memberships → no_org, no selection, no campaign load", () => {
  const c = resolveOrganizationContext(memb([]));
  assert.equal(c.phase, "no_org");
  assert.equal(c.selectedOrgId, null);
  assert.match(SURFACE, /phase === "no_org"/);
  assert.match(SURFACE, /No corporate organization yet/);
});

test("inactive memberships are filtered out", () => {
  const r = activeMemberships({ ok: true, data: { memberships: [A("o1"), { corporateOrganizationId: "o2", status: "suspended" }, { status: "active" }] } });
  assert.deepEqual(r.map((m) => m.corporateOrganizationId), ["o1"]);
});

// (4) Exactly one active membership → auto-select.
test("exactly one active membership auto-selects its org", () => {
  const c = resolveOrganizationContext(memb([A("corp_org_1")]));
  assert.equal(c.phase, "ready");
  assert.equal(c.selectedOrgId, "corp_org_1");
});

// (5) + (6) Multiple → explicit selection required; no campaigns loaded yet.
test("multiple active memberships require explicit selection (no guess, no campaigns)", () => {
  const c = resolveOrganizationContext(memb([A("corp_org_1", "owner"), A("corp_org_2", "viewer")]));
  assert.equal(c.phase, "select_org");
  assert.equal(c.selectedOrgId, null);
  // campaigns load ONLY when an org is resolved (effectiveOrgId truthy)
  assert.match(SURFACE, /if \(effectiveOrgId\) \{[\s\S]*?loadCampaigns\(effectiveOrgId\)/);
});

// (7) Selection changes load only the selected org.
test("a valid prior selection is preserved (loads only that org)", () => {
  const two = memb([A("corp_org_1"), A("corp_org_2")]);
  assert.equal(resolveOrganizationContext(two, "corp_org_2").selectedOrgId, "corp_org_2");
  assert.equal(resolveOrganizationContext(two, "corp_org_2").phase, "ready");
});

// (8) Inactive/disappearing selection is cleared.
test("a selection that vanished/became inactive is cleared", () => {
  const two = memb([A("corp_org_1"), A("corp_org_2")]);
  assert.equal(resolveOrganizationContext(two, "corp_org_GONE").phase, "select_org"); // cleared → re-select
  assert.equal(resolveOrganizationContext(two, "corp_org_GONE").selectedOrgId, null);
  // on a single-membership list a stale selection resolves to the remaining active org
  assert.equal(resolveOrganizationContext(memb([A("corp_org_1")]), "corp_org_GONE").selectedOrgId, "corp_org_1");
  assert.match(SURFACE, /prev && active\.includes\(prev\) \? prev : null/); // container clears stale selection
});

// (9) 401/403 clears protected data.
test("unauthorized clears protected data (model + detail)", () => {
  assert.equal(resolveOrganizationContext({ unauthorized: true }).phase, "unauthorized");
  assert.match(DETAIL, /unauthorized[\s\S]*?setCampaign\(null\); setReadiness\(\{\}\)/);
  assert.match(writeResultMessage({ unauthorized: true }), /access/i);
});

// (10) 409 re-fetches and does NOT auto-repeat the mutation.
test("409 conflict: detail re-fetches, shows notice, never auto-repeats", () => {
  const branch = DETAIL.match(/if \(res && res\.conflict\) \{([\s\S]*?)\}/);
  assert.ok(branch, "conflict branch present");
  assert.match(branch[1], /await refresh\(\)/);
  assert.ok(!/op\(\)/.test(branch[1]), "must not auto-repeat the mutation");
  assert.match(writeResultMessage({ conflict: true }), /refresh/i);
});

// (11) Team C's real editor is mounted.
test("Team C editor is imported and mounted with server-derived capability", () => {
  assert.match(DETAIL, /import CampaignFeaturedSpreadEditor from ["'][./]*corporateCampaign\/CampaignFeaturedSpreadEditor\.jsx["']/);
  assert.match(DETAIL, /<CampaignFeaturedSpreadEditor/);
  assert.match(DETAIL, /capabilityEnabled=\{capability\.available\}/);
  assert.equal(TERMS.CUSTOMIZE, "Customize Featured Spread");
  assert.match(DETAIL, /setShowEditor\(false\)/); // Return to Campaign
});

// (11b) D2 — CampaignDetail capability is SERVER-derived (interpretCapability on the campaign-list
// result), never the hard-coded { available: true } literal.
test("detail capability is server-derived via interpretCapability, not hard-coded", () => {
  assert.match(SURFACE, /capability=\{interpretCapability\(capabilityResult\)\}/);
  assert.doesNotMatch(SURFACE, /capability=\{\{\s*available:\s*true\s*\}\}/);
  // interpretCapability maps server results honestly (already covered below; sanity here).
  assert.equal(interpretCapability({ ok: true }).available, true);
  assert.equal(interpretCapability({ dormant: true }).available, false);
  assert.equal(interpretCapability({ unauthorized: true }).available, false);
  assert.equal(interpretCapability(null).available, false); // fail-closed before first load
});

// (12) Intro-and-Finale-Only correctness + readiness states.
test("readiness derives correctly incl. Intro and Finale Only", () => {
  const ready = deriveCampaignSummary({}, { featuredSpreadReadiness: R.READY_ORG_DEFAULT, featuredSpreadPresent: true, approvalStatus: "approved", lockStatus: "unlocked" });
  assert.equal(ready.featuredSpreadStatus, "Ready — Organization Default");
  assert.equal(ready.ready, true);
  const photo = deriveCampaignSummary({}, { featuredSpreadReadiness: R.NEEDS_DEFAULT_PHOTO, featuredSpreadPresent: true });
  assert.equal(photo.featuredSpreadKind, "blocker");
  const introFinale = deriveCampaignSummary({}, { featuredSpreadReadiness: R.READY_INTRO_FINALE_ONLY, featuredSpreadPresent: false });
  assert.equal(introFinale.introFinaleOnly, true);
  assert.equal(introFinale.ready, true);
  assert.equal(introFinale.featuredSpreadStatus, "Ready — Intro and Finale Only");
  assert.match(DETAIL, /Gifts remain independent/); // approved all-disabled statement
});

// (12b) D2 — the entered campaignType is reflected in the displayed "Type" (fallback chain).
test("deriveCampaignSummary shows campaignType when no occasionType/type present", () => {
  assert.equal(deriveCampaignSummary({ campaignType: "Holiday" }, {}).occasionType, "Holiday");
  // explicit occasionType/type still win; absent everything → em dash
  assert.equal(deriveCampaignSummary({ occasionType: "Milestone", campaignType: "Holiday" }, {}).occasionType, "Milestone");
  assert.equal(deriveCampaignSummary({}, {}).occasionType, "—");
});

test("actions gate on server-derived approval/lock/readiness", () => {
  const readyDraft = deriveCampaignSummary({}, { featuredSpreadReadiness: R.READY_ORG_DEFAULT, approvalStatus: "draft", lockStatus: "unlocked", featuredSpreadPresent: true });
  assert.equal(readyDraft.actions.canApprove, true);
  const locked = deriveCampaignSummary({}, { featuredSpreadReadiness: R.READY_ORG_DEFAULT, approvalStatus: "approved", lockStatus: "locked", featuredSpreadPresent: true });
  assert.equal(locked.actions.canUnlock, true);
  assert.equal(locked.actions.canEdit, false);
});

// (13) Corporate video unavailable; terminology; no gift/recipient/personal coupling.
test("corporate video unavailable; approved terminology only; no forbidden imports", () => {
  assert.equal(CORPORATE_VIDEO.available, false);
  // SLICE E5 - founder-approved rename. Still an EXACT assertion: the value of this lock is
  // that the surface cannot be renamed by accident, not that it can never be renamed.
  assert.equal(TERMS.SURFACE, "Automated Greet-Me Campaigns");
  assert.equal(TERMS.CREATE, "Create Greet-Me Automated Campaign");
  const forbidden = [/Greeting Studio/i, /Gift Wizard/i, /Organization Campaigns/i, /Recipient Featured Spread/i, /Fundraising Campaign/i];
  for (const f of forbidden) assert.ok(!f.test(ALL), `forbidden term: ${f}`);
  assert.ok(!/gift[a-z]*\s+(is|are)\s+required/i.test(ALL), "gifts never required");
  for (const src of [SURFACE, DETAIL, MODEL]) {
    assert.ok(!/\b(import|from)\b[^\n]*(gift|fundrais|payment|stripe|merch|GreetingCardProto|worker)/i.test(src));
  }
});