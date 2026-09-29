// src/pages/voiceMissingDraftSave.test.mjs — TEAM 1: gift/entitlement safety.
//
// PROVES the VoiceMissingModal draft-save bug fix, source-based like sendGreetingFlowersWiring.test.mjs:
// SendGreeting.jsx is too large and too wired-up to mount here, and the property under test — does
// this specific handler write a shape the restore effect actually reads, and navigate with the
// params that effect gates on — is structural, not visual.
//
// THE BUG: onSaveDraft previously called draftService.saveDraft({ contactId, occasionType,
// ...formData }) — spreading formData's fields flat onto the saved record instead of nesting them
// under a `formData` key. The restore effect (a few hundred lines up in the same file) reads
// `saved?.formData` and merges THAT into state; a flatly-spread record has no `formData` property,
// so the guard was always false and the draft — though genuinely saved — could never be restored.
// The handler also never navigated back with the `contactId`/`occasion` query params the restore
// effect itself requires to run at all, so even a shape-only fix could not have resumed the draft.
//
// Run: node --test src/pages/voiceMissingDraftSave.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, "SendGreeting.jsx"), "utf8");
const codeOnly = (s) => s.split("\n").map((l) => l.split("//")[0]).join("\n");
const CODE = codeOnly(SRC);

const block = (startNeedle, endNeedle, label) => {
  const a = SRC.indexOf(startNeedle);
  assert.ok(a > -1, `${label}: start not found`);
  const b = SRC.indexOf(endNeedle, a);
  assert.ok(b > -1, `${label}: end not found`);
  return SRC.slice(a, b);
};

test("the restore effect's contract: gated on contactId+occasion params, delegates to restoreDraftIntoState", () => {
  // Integration note (six-team merge, 2026-09-29): Team 3's WP-C composer-media-persistence
  // commit extracted the inline restore logic this test originally asserted on into a shared
  // restoreDraftIntoState(saved) helper, reused by both this URL-param effect and a second,
  // plain-revisit restore effect Team 3 added below it. The guard this test exists to protect
  // (only a record with a NESTED formData key is ever restored) still holds -- it just now lives
  // in the shared helper (asserted in the next test) rather than inlined here.
  const restore = block("// Restore draft if navigating to send with a contact+occasion pre-selected", "}, [location.search]);", "restore effect");
  assert.match(restore, /const contactId = params\.get\('contactId'\);/);
  assert.match(restore, /const occasion = params\.get\('occasion'\);/);
  assert.match(restore, /if \(!contactId \|\| !occasion\) return;/);
  assert.match(restore, /draftService\.getDraft\(contactId, occasion\)/);
  assert.match(restore, /restoreDraftIntoState\(saved\)/);
});

test("restoreDraftIntoState: THE GUARD THE BUG DEFEATED -- only a record with a nested formData key is ever merged", () => {
  const helper = block("const restoreDraftIntoState = (saved) => {", "\n  };", "restoreDraftIntoState helper");
  assert.match(helper, /if \(!saved\) return;/);
  assert.match(helper, /if \(saved\.formData\) \{/);
  assert.match(helper, /setFormData\(prev => \(\{ \.\.\.prev, \.\.\.saved\.formData \}\)\)/);
});

test("VoiceMissingModal's onSaveDraft writes a record the restore effect can actually read", () => {
  const handler = block("onSaveDraft={() => {", "\n      />", "onSaveDraft handler");
  // NESTED, not spread: `formData` as its own key, matching `saved?.formData` above —
  // NOT `...formData` spread flat onto the saved record (the original bug).
  assert.match(handler, /draftService\.saveDraft\(\{[\s\S]*?\bformData,?[\s\S]*?\}\)/);
  assert.equal(
    /\.\.\.formData/.test(handler),
    false,
    "must never spread formData's fields flat onto the saved record — that is the original bug",
  );
});

test("VoiceMissingModal's onSaveDraft navigates back with the exact params the restore effect requires", () => {
  const handler = block("onSaveDraft={() => {", "\n      />", "onSaveDraft handler");
  assert.match(
    handler,
    /navigate\(`\/dashboard\/send\?contactId=\$\{encodeURIComponent\(formData\.contactId\)\}&occasion=\$\{encodeURIComponent\(formData\.occasionType\)\}`\)/,
    "must navigate back with BOTH contactId and occasion query params, or the restore effect's own guard never fires",
  );
  // A save with no contact/occasion selected yet has nothing restorable — falls back to dashboard,
  // never to a query string the restore effect would misread as a real draft.
  assert.match(handler, /if \(formData\.contactId && formData\.occasionType\) \{/);
  assert.match(handler, /navigate\('\/dashboard'\);/);
});

test("the fix is isolated to the draft-save path: it never touches the checkpoint's own re-record success path", () => {
  const rerecord = block("onRerecordSuccess={async () => {", "        }}", "onRerecordSuccess handler");
  assert.match(rerecord, /refreshProfile\(\)/);
  assert.match(rerecord, /retryPendingSend\(\)/);
  assert.equal(/draftService\.saveDraft/.test(rerecord), false, "re-record success must not also save a draft");
});
