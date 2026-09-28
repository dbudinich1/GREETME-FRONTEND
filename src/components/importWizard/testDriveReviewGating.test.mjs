// src/components/importWizard/testDriveReviewGating.test.mjs — Run: node --test src/components/importWizard/testDriveReviewGating.test.mjs
//
// Source-slicing structural tests, same technique already used by wizard.test.mjs (WIZ.match(...)) —
// this project's established way to pin a specific code shape without a full DOM render, which the
// existing *.browser.test.mjs harness cannot currently do in this environment (Node 25 breaks its
// jsdom/esbuild bootstrap — see project memory; confirmed pre-existing and unrelated to this change
// by reproducing the same failure on an untouched browser test file). These tests fail loudly if the
// gating structure is ever accidentally reverted or reworded.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const WIZ = readFileSync(new URL("./ContactImportWizard.jsx", import.meta.url), "utf8");

test("Recommended settings notice (both 'available' and 'applied' states) is gated behind !isSample", () => {
  const block = WIZ.slice(WIZ.indexOf('data-testid="defaults-applied"') - 400, WIZ.indexOf('data-testid="defaults-notice"') + 600);
  assert.match(block, /\{!isSample &&/, "the whole Recommended-settings block must be wrapped in !isSample");
});

test("'Add relationship details first' is gated behind !isSample (never shown in Test Drive)", () => {
  const line = (WIZ.match(/.*details-cta.*Add relationship details first.*/) || [""])[0];
  assert.match(line, /!isSample && counts\.ready > 0/);
});

test("Recommended defaults are applied AUTOMATICALLY, once, for Test Drive — no panel exposed", () => {
  const fn = (WIZ.match(/const autoDfltRan = useRef\(false\);[\s\S]*?\}, \[isSample\]\);/) || [""])[0];
  assert.match(fn, /if \(!isSample \|\| autoDfltRan\.current\) return;/);
  assert.match(fn, /applyDefaults\(\);/);
});

test("business Test Drive's primary CTA uses the founder-approved wording and its own handler", () => {
  const block = WIZ.slice(WIZ.indexOf("isSample && business"), WIZ.indexOf("isSample && business") + 700);
  assert.match(block, /View and Manage Your Practice Contacts in the Corporate Dashboard/);
  assert.match(block, /See exactly where these contacts will appear and how you.ll manage them after import\./);
  assert.match(block, /onClick=\{onViewPracticeCorporate\}/);
});

test("personal Test Drive's CTA is UNCHANGED — still the original wording and onViewPractice handler", () => {
  const block = WIZ.slice(WIZ.indexOf("isSample && !business"), WIZ.indexOf("isSample && !business") + 700);
  assert.match(block, /View Practice Contacts in Recipients/);
  assert.match(block, /onClick=\{onViewPractice\}/);
});

test("viewPracticeInCorporateDashboard persists via the SAME saveSampleWorkspace primitive and navigates to the new route", () => {
  const fn = (WIZ.match(/const viewPracticeInCorporateDashboard = \(\) => \{[\s\S]*?\n  \};/) || [""])[0];
  assert.ok(fn, "handler must exist");
  assert.match(fn, /saveSampleWorkspace\(/, "reuses the existing session-scoped practice primitive");
  assert.match(fn, /navigate\("\/dashboard\/campaigns\/test-drive"\)/);
  assert.doesNotMatch(fn, /api\.|fetch\(/, "never a backend call");
});

test("Real Business imports keep the relationship-completion pathway, constrained to Professional", () => {
  const fn = (WIZ.match(/function RelationshipControls\(\{ it, on, business \}\) \{[\s\S]*?\n\}/) || [""])[0];
  assert.ok(fn, "RelationshipControls must accept a business prop");
  assert.match(fn, /business \? RELATIONSHIP_CATEGORIES\.filter/, "options are narrowed, not the taxonomy itself");
  assert.match(fn, /c\.value === "professional"/);
});

test("business prop threads DetailsView -> DetailRow -> RelationshipControls", () => {
  assert.match(WIZ, /function DetailsView\(\{ editable, page, setPage, on, business, onDone, onStartOver \}\)/);
  assert.match(WIZ, /<DetailRow key=\{it\.index\} it=\{it\} on=\{on\} business=\{business\} \/>/);
  assert.match(WIZ, /function DetailRow\(\{ it, on, business \}\)/);
  assert.match(WIZ, /<RelationshipControls it=\{it\} on=\{on\} business=\{business\} \/>/);
});

test("completionModel.js taxonomy itself is never edited by this feature (no RELATIONSHIP_CATEGORIES mutation)", () => {
  assert.doesNotMatch(WIZ, /RELATIONSHIP_CATEGORIES\s*=\s*\[/, "the wizard only ever narrows rendered options, never reassigns the taxonomy");
});

test("founder-approved review-summary labels (2026-09-27): 'Ready to Import' / 'Needs Import Info'", () => {
  assert.match(WIZ, /<b>\{importCount\}<\/b><span>Ready to Import<\/span>/);
  assert.match(WIZ, /<b>\{blockers\.length\}<\/b><span>Needs Import Info<\/span>/);
  // Total label and the underlying counts themselves are unchanged.
  assert.match(WIZ, /<b>\{counts\.total\}<\/b><span>Total<\/span>/);
});
