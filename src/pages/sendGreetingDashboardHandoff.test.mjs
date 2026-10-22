// src/pages/sendGreetingDashboardHandoff.test.mjs
//
// SendGreeting.jsx (PROTECTED SUBSYSTEM) — the dashboard hand-off additions only (Report 103, 2026-10-18).
// Source scan: the page is wired to router/auth/payment context and cannot be mounted cheaply; the hand-off's own
// logic (matching, one-shot read, limits) is unit-tested in src/utils/dashboardSendHandoff.test.mjs.
// Run (Node 20.x): node --test src/pages/sendGreetingDashboardHandoff.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "SendGreeting.jsx"), "utf8").replace(/\r\n/g, "\n");

test("the occasion list renders the shared options (existing five + the four approved)", () => {
  assert.match(SRC, /\{SEND_OCCASION_OPTIONS\.map\(\(o\) => <option key=\{o\} value=\{o\}>\{o\}<\/option>\)\}/);
  assert.doesNotMatch(SRC, /<option value="(Hanukkah|Sympathy|Engagement)"/);
});

test("?occasion= with ?contactId= is honoured only when it is one of the page's own options; without a contact, unchanged", () => {
  const start = SRC.indexOf("// Prefill occasion from query param");
  const block = SRC.slice(start, SRC.indexOf("// Dashboard hand-off", start));
  assert.match(block, /if \(params\.get\('contactId'\)\) \{\s*const option = matchSendOccasion\(occasion\);\s*if \(option\) setFormData/);
  assert.match(block, /setFormData\(prev => \(\{ \.\.\.prev, occasionType: occasion \}\)\);\n  \}, \[location\.search\]\);/, "the no-contact path is the original one");
});

test("the words/photos hand-off is read once, only from=dashboard, AFTER the draft restore, and never replaces photos", () => {
  const handoff = SRC.indexOf("// Dashboard hand-off: the sender's optional words");
  assert.ok(handoff > SRC.indexOf("// Restore draft if navigating to send with a contact+occasion pre-selected"), "after the URL draft restore");
  const block = SRC.slice(handoff, SRC.indexOf("}, [location.search]);", handoff));
  assert.match(block, /params\.get\('from'\) !== 'dashboard'/);
  assert.match(block, /takeDashboardHandoff\(window\.sessionStorage, \{ contactId, occasion \}\)/);
  assert.match(block, /setMemoryPhotos\(prev => \[\.\.\.prev, \.\.\.handoff\.memoryPhotos\.filter\(\(ph\) => !prev\.includes\(ph\)\)\]\.slice\(0, MAX_MEMORY_PHOTOS\)\)/);
});

test("Baby and Season's Greetings reach the backend as its existing keys; everything else is normalised as before", () => {
  const PAYLOAD = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "utils", "sendGreetingPayload.js"), "utf8");
  assert.match(PAYLOAD, /occasionKey: SEND_OCCASION_KEY_OVERRIDES\[formData\.occasionType\] \|\| normalizeOccasionKey\(formData\.occasionType\) \|\| formData\.occasionType,/);
  assert.match(SRC, /const payload = buildGreetingPayload\(\{/);
});

test("'Add a gift' from the dashboard opens the Gift Place with this greeting kept (Report 135); without a recipient and occasion, the chooser as before", () => {
  const start = SRC.indexOf("The dashboard's \"Add a gift\" (gift carousel, ?gift=choose)");
  assert.ok(start > -1);
  const block = SRC.slice(start, SRC.indexOf("}, [location.search]);", start));
  assert.match(block, /const dashboardChooseEntry = params\.get\('gift'\) === 'choose' && !params\.get\('giftType'\);/);
  assert.match(block, /const want = dashboardGiftPlaceEntry\(params\);\s*if \(want\) \{ giftPlaceEntryRef\.current = want; return; \}/, "a recipient + occasion entry does not open the chooser");
  assert.match(block, /if \(qrCashEntry\) setGiftSettings\(prev => \(\{ \.\.\.prev, type: 'qrcash' \}\)\);/, "only the QR Cash entry pre-sets a gift");
  assert.match(SRC, /navigate\('\/dashboard\/gifts\?returnTo=send&giftType=marketplace'\);/, "the one Gift Place destination with the return-to-greeting contract");
  assert.equal((SRC.match(/navigate\('\/dashboard\/gifts\?returnTo=send/g) || []).length, 1, "one shared opener for the chooser's Gift Place option and the dashboard entry");
  assert.equal((SRC.match(/setIsGiftModalOpen\(true\)/g) || []).length, 3, "still exactly three chooser open paths");
});

test("the banner names this greeting's occasion, never a fixed 'Just Because' (Report 135)", () => {
  assert.match(SRC, /data-testid="send-banner-occasion">\{[^}]*\}\{formData\.occasionType \|\| 'Just Because'\}<\/p>/);
  assert.doesNotMatch(SRC, /\}\}>Just Because<\/p>/, "no fixed banner text");
});

test("protected-subsystem header records this change and its affected locked milestones", () => {
  assert.match(SRC, /2026-10-18 \(dashboard package, Report 103\)/);
  assert.match(SRC, /2026-10-22 \(Report 135, preview, not released\)/);
  for (const sha of ["4c29ace8", "01d93f5f", "1c43a750", "f98ffdb5"]) assert.ok(SRC.includes(sha), sha);
});
