// src/utils/celebrationsModel.test.mjs — Report 135, Celebrations model (pure).
// Run (Node 20): node --test src/utils/celebrationsModel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  filterRecipients, segmentCounts, occasionDateKind, sharedDateFor, nextOccurrence, upcomingStatus, upcomingForContact,
  pastForContact, occasionRoster, launcherChoicesForOccasion, OCCASION_GROUPS, sendBelongsTo,
} from "./celebrationsModel.js";

const NOW = new Date(2026, 9, 22, 9, 0, 0); // Thu 22 Oct 2026
const PEOPLE = [
  { id: "a", name: "Ann Lee", email: "ann@x.test", relationshipCategory: "friend", relationship: "Friend" },
  { id: "b", name: "Bo Ray", email: "bo@x.test", relationshipCategory: "family", relationship: "Brother" },
  { id: "c", name: "Cy Moe", relationshipCategory: "professional", relationship: "Colleague" },
  { id: "d", name: "Di Fox", relationship: "" },
];

test("filter: Individuals lists everyone; categories use relationshipCategory; search narrows within", () => {
  assert.deepEqual(filterRecipients(PEOPLE, "individuals").map((p) => p.id), ["a", "b", "c", "d"]);
  assert.deepEqual(filterRecipients(PEOPLE, "friend").map((p) => p.id), ["a"]);
  assert.deepEqual(filterRecipients(PEOPLE, "family").map((p) => p.id), ["b"]);
  assert.deepEqual(filterRecipients(PEOPLE, "professional").map((p) => p.id), ["c"]);
  assert.deepEqual(filterRecipients(PEOPLE, "individuals", "colleague").map((p) => p.id), ["c"], "search covers the relationship");
  assert.deepEqual(filterRecipients(PEOPLE, "friend", "bo").map((p) => p.id), []);
  assert.deepEqual(segmentCounts(PEOPLE), { individuals: 4, friend: 1, family: 1, professional: 1 });
});

test("dates: shared calendar occasions vs each person's own; the scheduler's own pre-fill rules", () => {
  assert.equal(occasionDateKind("birthday"), "personal");
  assert.equal(occasionDateKind("anniversary"), "personal");
  assert.equal(occasionDateKind("christmas"), "shared");
  assert.equal(occasionDateKind("mothers_day"), "shared");
  assert.equal(sharedDateFor("christmas", 2026), "2026-12-25");
  assert.equal(sharedDateFor("mothers_day", 2027), "2027-05-09");
  assert.equal(sharedDateFor("hanukkah", 2026), "", "not calculated: entered per person");
  assert.equal(sharedDateFor("birthday", 2026), "");
  assert.deepEqual(OCCASION_GROUPS.map((g) => g.title), ["Personal occasions", "Holidays", "Christianity", "Judaism", "Islam"]);
  assert.equal(OCCASION_GROUPS[0].types.includes("getwell"), false);
});

test("next occurrence: yearly repeats on month/day (Feb 29 -> Feb 28); one-time only on its date", () => {
  assert.deepEqual(nextOccurrence({ type: "birthday", date: "1958-03-14" }, NOW), { date: "2027-03-14", daysUntil: 143 });
  assert.deepEqual(nextOccurrence({ type: "birthday", date: "1990-10-22" }, NOW), { date: "2026-10-22", daysUntil: 0 });
  assert.equal(nextOccurrence({ type: "birthday", date: "2000-02-29" }, NOW).date, "2027-02-28");
  assert.equal(nextOccurrence({ type: "graduation", date: "2026-10-01" }, NOW), null, "a passed one-time date is not upcoming");
  assert.equal(nextOccurrence({ type: "graduation", date: "2026-12-01" }, NOW).date, "2026-12-01");
  assert.equal(nextOccurrence({ type: "birthday", date: "" }, NOW), null);
});

test("upcoming status is truthful: the scheduler's status when it has one; otherwise only what the record says; never 'Sent' without the scheduler", () => {
  const occ = { type: "birthday", date: "1990-11-01", autoSend: true };
  const next = nextOccurrence(occ, NOW);
  assert.equal(upcomingStatus("a", occ, next, [{ contactId: "a", occasionType: "birthday", date: next.date, scheduleStatus: "scheduled" }]).label, "Ready to send");
  assert.deepEqual(upcomingStatus("a", occ, next, []), { key: "auto", label: "Auto-send on", tone: "plum", planned: true, source: "record" });
  assert.equal(upcomingStatus("a", { ...occ, autoSend: false }, next, []).label, "Not scheduled");
  assert.equal(upcomingStatus("a", occ, next, [{ contactId: "a", occasionType: "birthday", date: "2030-01-01", scheduleStatus: "delivered" }]).label, "Auto-send on", "another date's record is never borrowed");
  const ups = upcomingForContact({ id: "a", occasions: [occ, { type: "christmas", date: "", autoSend: true }] }, [], NOW);
  assert.equal(ups[0].type, "birthday");
  assert.deepEqual([ups[1].missingDate, ups[1].status.label], [true, "Date needed"]);
  assert.ok(ups.every((u) => u.status.label !== "Sent"));
});

test("past: real sends only, matched by email (else exact name); passed one-time occasions read 'No send recorded'", () => {
  const sent = [
    { id: "s1", recipientEmail: "ANN@x.test", recipientName: "Someone", occasionType: "birthday", status: "completed", createdAt: "2026-01-01T00:00:00Z", completedAt: "2026-01-01T01:00:00Z" },
    { id: "s2", recipientEmail: "", recipientName: "Cy Moe", occasionType: "thankyou", status: "failed", createdAt: "2026-02-01T00:00:00Z" },
    { id: "s3", recipientEmail: "other@x.test", recipientName: "Ann Lee", occasionType: "christmas", status: "completed", createdAt: "2026-03-01T00:00:00Z" },
  ];
  assert.equal(sendBelongsTo(sent[2], PEOPLE[0]), false, "a different email is someone else, even with the same name");
  assert.deepEqual(pastForContact(PEOPLE[0], sent, NOW).map((p) => [p.id, p.status.label]), [["s1", "Sent"]]);
  assert.deepEqual(pastForContact(PEOPLE[2], sent, NOW).map((p) => [p.label, p.status.label]), [["Thank You", "Not sent"]]);
  const grad = { id: "g", name: "G", email: "g@x.test", occasions: [{ type: "graduation", date: "2026-06-01" }, { type: "birthday", date: "1990-01-01" }] };
  assert.deepEqual(pastForContact(grad, sent, NOW).map((p) => [p.label, p.status.label]), [["Graduation", "No send recorded"]], "yearly past years are never inferred");
});

test("occasion roster: holders first with saved dates; others pre-filled with the shared date or marked missing", () => {
  const people = [
    { id: "a", name: "Ann", occasions: [{ type: "christmas", date: "2026-12-25", autoSend: true }], occasionGiftSettings: { christmas: { type: "qrcash", amount: 25 } } },
    { id: "b", name: "Bo", occasions: [] },
  ];
  const x = occasionRoster(people, "christmas", [], NOW);
  assert.equal(x.kind, "shared"); assert.equal(x.sharedDate, "2026-12-25");
  assert.deepEqual(x.rows.map((r) => [r.contact.id, r.held, r.dateSource]), [["a", true, "saved"], ["b", false, "shared"]]);
  assert.equal(x.rows[0].gift.type, "qrcash");
  const b = occasionRoster(people, "birthday", [], NOW);
  assert.equal(b.kind, "personal");
  assert.deepEqual(b.rows.map((r) => r.dateSource), ["missing", "missing"]);
  const md = occasionRoster(people, "mothers_day", [], NOW);
  assert.equal(md.sharedDate, "2027-05-09", "a shared date already past this year moves to next year");
});

test("several people from one occasion: the dashboard resolver's own launcher choices", () => {
  assert.deepEqual(launcherChoicesForOccasion("Christmas", ["a", 2]), { mode: "occasion", occasions: ["Christmas"], audience: "one", picks: ["a", "2"], excluded: [], whoDone: true, datesOpen: true });
});

test("Celebration Schedule: upcoming across everyone, soonest first; Past = real sends (unmatched kept under their own name) + passed one-time occasions; one search for name or occasion", async () => {
  const { scheduleUpcoming, schedulePast, scheduleMatches } = await import("./celebrationsModel.js");
  const people = [
    { id: "a", name: "Ann", email: "ann@x.test", occasions: [{ type: "birthday", date: "1990-11-01", autoSend: true }, { type: "christmas", date: "", autoSend: true }] },
    { id: "b", name: "Bo", email: "bo@x.test", occasions: [{ type: "birthday", date: "1990-10-25", autoSend: false }, { type: "graduation", date: "2026-05-01" }] },
  ];
  const up = scheduleUpcoming(people, [], NOW);
  assert.deepEqual(up.map((u) => `${u.contact.id}:${u.type}:${u.status.label}`), ["b:birthday:Not scheduled", "a:birthday:Auto-send on", "a:christmas:Date needed"]);
  const sent = [{ id: "s1", recipientEmail: "ann@x.test", recipientName: "Ann", occasionType: "birthday", status: "completed", createdAt: "2025-11-01T00:00:00Z" },
    { id: "s2", recipientEmail: "z@x.test", recipientName: "Zed", occasionType: "thankyou", status: "failed", createdAt: "2026-02-01T00:00:00Z" }];
  const past = schedulePast(people, sent, NOW);
  assert.deepEqual(past.map((p) => [p.contact ? p.contact.id : null, p.label, p.status.label]), [["b", "Graduation", "No send recorded"], [null, "Thank You", "Not sent"], ["a", "Birthday", "Sent"]], "newest first");
  assert.ok(past.some((p) => !p.contact && p.name === "Zed"), "unmatched send kept under its own name");
  assert.ok(past.some((p) => p.contact && p.contact.id === "b" && p.status.label === "No send recorded"));
  assert.ok(past.every((p) => p.status.label !== "Sent" || p.kind === "send"));
  assert.equal(scheduleMatches(up[0], "bo"), true); assert.equal(scheduleMatches(up[0], "birth"), true); assert.equal(scheduleMatches(up[0], "xmas"), false);
});

// ── Walkthrough revision 2026-10-24: the Business roster in the Celebrations design (display only) ──
test("businessCelebrationContacts: month-day yearly dates are placed on their next date with 'Date saved' only; one-time dates without a year are not scheduled", async () => {
  const { businessCelebrationContacts, heldOccasionTypes, RECIPIENT_SEGMENTS } = await import("./celebrationsModel.js");
  const [b] = businessCelebrationContacts([{ id: "b1", name: "Erin", corporateContactType: "employee", occasionDates: { birthday: "03-09", graduation: "06-01", bad: "x" } }]);
  assert.deepEqual(b.occasions, [{ type: "birthday", date: "2000-03-09", autoSend: false, monthDayOnly: true }]);
  assert.deepEqual(heldOccasionTypes(b), ["birthday", "graduation", "bad"]);
  const ups = upcomingForContact(b, [], NOW);
  assert.deepEqual(ups.map((u) => [u.type, u.date, u.status.key, u.status.label]), [["birthday", "2027-03-09", "saved", "Date saved"]]);
  assert.deepEqual(businessCelebrationContacts(null), []);
  assert.equal(RECIPIENT_SEGMENTS[0].key, "individuals"); assert.equal(RECIPIENT_SEGMENTS[0].label, "All");
});

test("heldOccasionTypes: a personal recipient's saved occasion types, once each", async () => {
  const { heldOccasionTypes } = await import("./celebrationsModel.js");
  assert.deepEqual(heldOccasionTypes({ occasions: [{ type: "birthday" }, { type: "christmas" }, { type: "birthday" }, "anniversary", null] }), ["birthday", "christmas", "anniversary"]);
  assert.deepEqual(heldOccasionTypes({}), []);
});
