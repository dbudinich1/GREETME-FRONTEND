// src/pages/dashboardUpcomingOccasions.test.mjs — Run: node --test src/pages/dashboardUpcomingOccasions.test.mjs
//
// WP-A: DashboardHome.jsx's "Upcoming Occasions" card used to render a hardcoded placeholder no
// matter what api.getUpcomingOccasions() returned. It now branches on `upcomingOccasions.length`.
//
// DashboardHome.jsx is a large page wired to auth/router/api context and cannot be mounted under
// `node --test` (this codebase's convention — see sendGreetingFlowersWiring.test.mjs). The branching
// condition and the status/urgency logic ARE plain expressions inside the component body, so — same
// technique as that file's `includeGift` test — they are extracted from the real source and evaluated
// directly. This proves the SAME expression that ships is the one under test, without a DOM.

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, "DashboardHome.jsx"), "utf8");

// ===========================================================================
// The status-badge lookup table
// ===========================================================================

test("OCCASION_STATUS_LABELS covers every scheduleStatus GET /api/dashboard/upcoming can send, plus the null/unknown fallback", () => {
  const match = SRC.match(/const OCCASION_STATUS_LABELS = (\{[\s\S]*?\n\};)/);
  assert.ok(match, "OCCASION_STATUS_LABELS literal must be findable in the page source");

  const table = new Function(`return (${match[1].replace(/;$/, "")});`)();

  // Every entry has display text — a badge with no text would be a silent bug.
  for (const [key, entry] of Object.entries(table)) {
    assert.ok(entry.text && entry.text.length > 0, `status '${key}' must have display text`);
    assert.ok(entry.color, `status '${key}' must have a color`);
    assert.ok(entry.bg, `status '${key}' must have a background`);
  }

  assert.equal(table.scheduled.text, "Ready to send");
  assert.equal(table.delivered.text, "Sent");
  assert.equal(table.queued.text, "Creating");
  // failed and skipped intentionally read the same to the sender — neither implies action on their part.
  assert.equal(table.failed.text, table.skipped.text);
  assert.equal(table[null].text, "Preparing");
});

test("an occasion whose scheduleStatus the backend never sent falls back to the null/Preparing entry, not to nothing", () => {
  const match = SRC.match(/const OCCASION_STATUS_LABELS = (\{[\s\S]*?\n\};)/);
  const table = new Function(`return (${match[1].replace(/;$/, "")});`)();

  // Mirrors the exact lookup expression used in the render: `OCCASION_STATUS_LABELS[occasion.scheduleStatus] || OCCASION_STATUS_LABELS[null]`
  const lookup = (scheduleStatus) => table[scheduleStatus] || table[null];

  assert.equal(lookup(undefined), table[null]);
  assert.equal(lookup("some_future_status_this_client_has_never_seen"), table[null]);
  assert.equal(lookup("scheduled"), table.scheduled);
});

// ===========================================================================
// The empty-state vs. populated-state branch
// ===========================================================================

test("the card branches on upcomingOccasions.length, not on some other truthiness check", () => {
  assert.match(SRC, /\{upcomingOccasions\.length === 0 \? \(/,
    "the branch must be an exact-zero check against the real fetched array, matching the PR's intent");
});

test("the empty branch offers the 'Add Occasion' CTA via the existing openAddRecipient navigation pattern", () => {
  const start = SRC.indexOf("{upcomingOccasions.length === 0 ? (");
  assert.ok(start > -1);
  const emptyBranchEnd = SRC.indexOf(") : (", start);
  const emptyBranch = SRC.slice(start, emptyBranchEnd);

  assert.match(emptyBranch, /Upcoming occasions will appear here as you add recipients\./);
  assert.match(emptyBranch, /navigate\('\/dashboard\/contacts', \{ state: \{ openAddRecipient: true \} \}\)/);
  assert.match(emptyBranch, />\s*Add Occasion\s*</s);
});

test("the populated branch renders real occasion data, not the placeholder copy", () => {
  const start = SRC.indexOf("{upcomingOccasions.length === 0 ? (");
  const emptyBranchEnd = SRC.indexOf(") : (", start);
  const populatedStart = emptyBranchEnd + ") : (".length;
  // bounded to this card: ends before the next top-level sibling comment
  const populatedEnd = SRC.indexOf("{/* Mobile App QR Code", populatedStart);
  const populated = SRC.slice(populatedStart, populatedEnd);

  assert.match(populated, /upcomingOccasions\.map\(\(occasion\) => \{/, "it maps the real fetched array");
  assert.match(populated, /\{occasion\.contactName\}/);
  assert.match(populated, /getOccasionIcon\(occasion\.occasionType\)/);
  assert.match(populated, /OCCASION_STATUS_LABELS\[occasion\.scheduleStatus\] \|\| OCCASION_STATUS_LABELS\[null\]/);
  // the placeholder copy from the old dead branch must not leak into the populated branch
  assert.equal(/will appear here as you add recipients/.test(populated), false);
});

test("the edit-recipient action only appears when the occasion actually carries a contactId, and reuses openEditRecipientId", () => {
  const start = SRC.indexOf("{upcomingOccasions.length === 0 ? (");
  const populatedStart = SRC.indexOf(") : (", start) + ") : (".length;
  const populatedEnd = SRC.indexOf("{/* Mobile App QR Code", populatedStart);
  const populated = SRC.slice(populatedStart, populatedEnd);

  assert.match(populated, /\{occasion\.contactId && \(/);
  assert.match(populated, /navigate\('\/dashboard\/contacts', \{ state: \{ openEditRecipientId: occasion\.contactId \} \}\)/);
});

// ===========================================================================
// The urgency flag
// ===========================================================================

test("isUrgent is exactly daysUntil <= 3 for a numeric daysUntil, and false for anything else", () => {
  const match = SRC.match(/const isUrgent = (typeof occasion\.daysUntil === 'number' && occasion\.daysUntil <= 3);/);
  assert.ok(match, "the isUrgent expression must be findable in the page source");

  const decide = new Function("occasion", `return Boolean(${match[1]});`);
  assert.equal(decide({ daysUntil: 0 }), true, "today is urgent");
  assert.equal(decide({ daysUntil: 3 }), true, "the boundary is inclusive");
  assert.equal(decide({ daysUntil: 4 }), false);
  assert.equal(decide({ daysUntil: -1 }), true, "an overdue occasion still reads as urgent, not excluded by the check");
  assert.equal(decide({ daysUntil: null }), false, "a missing daysUntil is never flagged urgent");
  assert.equal(decide({ daysUntil: undefined }), false);
  assert.equal(decide({ daysUntil: "3" }), false, "a string is not a number — the typeof guard rejects it even though '3' <= 3 would coerce true");
  assert.equal(decide({}), false);
});
