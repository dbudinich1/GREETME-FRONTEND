// src/pages/contactsPracticeView.test.mjs — Run: node --test src/pages/contactsPracticeView.test.mjs
// Recipients (Contacts.jsx) Practice-View wiring + fail-closed entry + normal-view regression (source).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const C = readFileSync(new URL("./Contacts.jsx", import.meta.url), "utf8");

test("Practice View is gated on the explicit marker + a valid current-session workspace (fail closed)", () => {
  assert.match(C, /import RecipientsPracticeView from '\.\.\/components\/RecipientsPracticeView'/);
  assert.match(C, /import \{ readPracticeView, clearSampleWorkspace \} from '\.\.\/import\/sampleWorkspace\.js'/);
  assert.match(C, /const practiceMarker = new URLSearchParams\(location\.search[^)]*\)\.get\('practice'\) === '1'/);
  assert.match(C, /practiceMarker \? readPracticeView\(\) : \{ status: 'none', contacts: \[\] \}/);
  assert.match(C, /const practiceActive = practiceMarker && \(practiceView\.status === 'active' \|\| practiceView\.status === 'empty'\)/);
});
test("Practice View skips the production recipient fetch and renders in place of the normal page", () => {
  assert.match(C, /if \(practiceActive\) return;\s*\/\/ Practice View never fetches production recipients/);
  assert.match(C, /if \(practiceActive\) \{\s*\n\s*return <RecipientsPracticeView/);
  assert.match(C, /status=\{practiceView\.status\} contacts=\{practiceView\.contacts\} onExit=\{exitPractice\}/);
});
test("Exit clears the workspace + drops the marker + toasts; NEVER a production delete", () => {
  const fn = (C.match(/const exitPractice = \(\) => \{[\s\S]*?\};/) || [""])[0];
  assert.ok(fn.includes("clearSampleWorkspace()"), "clears the session workspace");
  assert.ok(/navigate\('\/dashboard\/contacts', \{ replace: true \}\)/.test(fn), "drops practice=1 (replace so Back can't restore)");
  assert.ok(/Test Drive ended\. Practice contacts were removed\. Your real recipients were not changed\./.test(fn), "exit toast copy");
  assert.ok(!/api\.deleteContact|api\.importContacts|api\.createContact|api\.updateContact/.test(fn), "exit calls no production API");
});
test("normal Recipients behavior is UNCHANGED when Practice View is absent (production actions preserved)", () => {
  // production mutation handlers still present for the ordinary view
  assert.match(C, /api\.getContacts\(\)/);
  assert.match(C, /api\.createContact\(/);
  assert.match(C, /api\.updateContact\(/);
  assert.match(C, /api\.deleteContact\(/);
  // ordinary action controls remain (Send / Edit / Delete)
  assert.match(C, /Send Greet-Me/);
  assert.match(C, /openEditModal/);
  assert.match(C, /setDeleteConfirm/);
  // return-to-wizard target
  assert.match(C, /navigate\('\/dashboard\/import-wizard'\)/);
});
