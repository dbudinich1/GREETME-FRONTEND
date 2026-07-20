// src/import/reviewModel.test.mjs — Run: node --test src/import/reviewModel.test.mjs
//
// DETERMINISTIC tests for the CONFIRMATION-FIRST review model. All state transitions are exercised
// directly (not source scans). A fixed todayIso is injected so the minor gate is deterministic.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as M from "./reviewModel.js";
import {
  buildReview, buildReviewPayload, freshReviewState, paginate, REVIEW_BUCKET,
  setName, setEmail, setBirthday, setGroup, setRelation,
  chooseAudience, categoryForRelation, relationsForGroup,
  markCommitted, setCommitErrors, addExistingEmails,
} from "./reviewModel.js";

const TODAY = "2026-07-18";
function row(i, { name = "Person " + i, email = `p${i}@x.co`, rel = "", type = "", bday } = {}) {
  const __raw = bday != null ? { B: bday } : {};
  const __map = bday != null ? { birthday: "B" } : {};
  return { contact: { fullName: name, email, relationship: rel, recipientType: type }, index: i, __raw, __map };
}
const ind = (extra = {}) => freshReviewState({ business: false, kind: null, todayIso: TODAY, ...extra });
const biz = (kind, extra = {}) => freshReviewState({ business: true, kind, todayIso: TODAY, ...extra });
const at = (rev, i) => rev.items.find((it) => it.index === i);

// 1 — a clean file is entirely Ready (confirmation, not a walkthrough).
test("clean file → every row Ready, import enabled, no blockers", () => {
  const rev = buildReview([row(0), row(1, { rel: "sister" })], ind());
  assert.equal(rev.counts.ready, 2);
  assert.equal(rev.counts.needsFix, 0);
  assert.equal(rev.importEnabled, true);
});

// 2/3 — unknown relationship is OPTIONAL and unguessed; the row is Ready (Morgan/bestie rule).
test("unknown relationship → Ready, not provided, never guessed, no blocker", () => {
  const rev = buildReview([row(0, { name: "Daniel", rel: "bestie" })], ind());
  const it = at(rev, 0);
  assert.equal(it.bucket, REVIEW_BUCKET.READY);
  assert.equal(it.relationProvided, false);
  assert.equal(it.relation, "");
  assert.equal(it.relationUnrecognizedRaw, true);
  assert.equal(rev.counts.needsFix, 0);
});

// Morgan Doe (no relationship at all) → Ready + relationProvided:false so the UI can be truthful.
test("Morgan Doe (blank relationship) is Ready and flagged not-provided (optional)", () => {
  const rev = buildReview([row(0, { name: "Morgan Doe", rel: "" })], ind());
  const it = at(rev, 0);
  assert.equal(it.bucket, REVIEW_BUCKET.READY);
  assert.equal(it.relationProvided, false);
  assert.equal(it.relationUnrecognizedRaw, false);   // nothing was typed → not an "unrecognized" case
});

// 4 — recognized relationship prepopulates group + relation.
test("recognized relationship prepopulates group and relation", () => {
  const it = at(buildReview([row(0, { rel: "colleague" })], ind()), 0);
  assert.equal(it.group, "professional");
  assert.equal(it.relation, "colleague");
  assert.equal(it.relationProvided, true);
});

// 5/6 — closeness only travels with a relationship; blank relationship → no structured fields.
test("blank relationship persists NO structured fields; recognized persists all", () => {
  const [blank] = buildReviewPayload([row(0, { name: "Morgan", rel: "" })], ind());
  for (const k of ["relationship", "relationshipCategory", "relationshipCloseness", "relationshipRaw", "relationshipContext"]) {
    assert.equal(k in blank, false, `blank relationship must omit ${k}`);
  }
  const [known] = buildReviewPayload([row(0, { rel: "sibling" })], ind());
  assert.equal(known.relationship, "sibling");
  assert.equal(known.relationshipCategory, "family");
  assert.equal(known.relationshipCloseness, "greetme_worthy");   // Greet-Me Worthy only WITH a relationship
});

// user-selected relationship → closeness rides along; Greet-Me Worthy preselected.
test("selecting a relationship attaches Greet-Me Worthy by default", () => {
  const s = setRelation(ind(), 0, "close_friend");
  const [p] = buildReviewPayload([row(0, { name: "X", rel: "bestie" })], s);
  assert.equal(p.relationship, "close_friend");
  assert.equal(p.relationshipCategory, "friend");
  assert.equal(p.relationshipCloseness, "greetme_worthy");
});

// 7/8 — importCore verdict is authoritative; under-13 is blocked + excluded.
test("under-13 birthday → Needs a fix, excluded from payload; adult imports", () => {
  const kid = row(0, { name: "Kid", email: "kid@x.co", bday: "2016-01-01" });   // age ~10
  const adult = row(1, { name: "Ada", email: "ada@x.co", bday: "1990-05-14" });
  const rev = buildReview([kid, adult], ind());
  assert.equal(at(rev, 0).bucket, REVIEW_BUCKET.NEEDS_FIX);
  assert.equal(at(rev, 0).blockerMessage, "This birthday indicates the recipient is under 13 and cannot be imported.");
  assert.equal(at(rev, 1).bucket, REVIEW_BUCKET.READY);
  const payload = buildReviewPayload([kid, adult], ind());
  assert.equal(payload.length, 1);
  assert.equal(payload[0].email, "ada@x.co");
});

test("age boundary: exactly 13 today imports; 12 is blocked", () => {
  const exactly13 = row(0, { email: "a@x.co", bday: "2013-07-18" });   // turns 13 today
  const twelve = row(1, { email: "b@x.co", bday: "2013-07-19" });      // 13 tomorrow → still 12
  const rev = buildReview([exactly13, twelve], ind());
  assert.equal(at(rev, 0).bucket, REVIEW_BUCKET.READY);
  assert.equal(at(rev, 1).bucket, REVIEW_BUCKET.NEEDS_FIX);
});

test("correcting an erroneous birthday re-runs validation (minor → ready)", () => {
  const rows = [row(0, { email: "a@x.co", bday: "2020-01-01" })];   // typo → looks under 13
  let rev = buildReview(rows, ind());
  assert.equal(at(rev, 0).bucket, REVIEW_BUCKET.NEEDS_FIX);
  const s = setBirthday(ind(), 0, "1990-01-01");                    // fix the year
  rev = buildReview(rows, s);
  assert.equal(at(rev, 0).bucket, REVIEW_BUCKET.READY);
  assert.equal(buildReviewPayload(rows, s)[0].birthday, "1990-01-01");
});

// name/email blockers are per-row, correctable, and don't stop the others.
test("missing name / invalid email → Needs a fix (plain message); valid rows still import", () => {
  const rows = [row(0, { name: "" }), row(1, { email: "nope" }), row(2)];
  const rev = buildReview(rows, ind());
  assert.equal(at(rev, 0).blockerMessage, "Add a name to include this contact.");
  assert.equal(at(rev, 1).blockerMessage, "This email looks incomplete—fix it to include this contact.");
  assert.equal(at(rev, 2).bucket, REVIEW_BUCKET.READY);
  assert.equal(rev.importEnabled, true);                // 11 — valid rows import while blockers remain
  assert.equal(rev.importCount, 1);
});

// 9 — buckets are mutually exclusive and sum to the file total.
test("every row is in exactly one bucket; counts sum to total", () => {
  const rows = [
    row(0),                                             // ready
    row(1, { rel: "bestie" }),                          // ready (optional unknown rel)
    row(2, { name: "" }),                               // needs fix
    row(3, { email: "adaX" }),                          // needs fix
    row(4, { bday: "2018-01-01" }),                     // needs fix (minor)
    row(5, { email: "p0@x.co" }),                       // already-in-list (same as row 0)
  ];
  const rev = buildReview(rows, ind());
  const { ready, needsFix, alreadyInList, willSkip, invalidExcluded } = rev.buckets;
  const all = [...ready, ...needsFix, ...alreadyInList, ...willSkip, ...invalidExcluded].map((i) => i.index).sort((a, b) => a - b);
  assert.deepEqual(all, [0, 1, 2, 3, 4, 5]);            // union = every row
  assert.equal(new Set(all).size, all.length);          // no index appears twice
  const c = rev.counts;
  assert.equal(c.ready + c.needsFix + c.alreadyInList + c.willSkip + c.invalidExcluded + c.added, c.total);
});

// fixing a blocker moves the row between buckets exactly once.
test("fixing a blocker moves the row from Needs-a-fix to Ready", () => {
  const rows = [row(0, { name: "" })];
  assert.equal(at(buildReview(rows, ind()), 0).bucket, REVIEW_BUCKET.NEEDS_FIX);
  const s = setName(ind(), 0, "Fixed Name");
  assert.equal(at(buildReview(rows, s), 0).bucket, REVIEW_BUCKET.READY);
});

// 10 — inline edits revalidate AND re-deduplicate.
test("editing an email to an existing recipient → Already in your list", () => {
  const rows = [row(0, { email: "new@x.co" })];
  const s = setEmail(ind({ existingEmails: ["ada@x.co"] }), 0, "ada@x.co");
  assert.equal(at(buildReview(rows, s), 0).bucket, REVIEW_BUCKET.ALREADY_IN_LIST);
  assert.equal(buildReviewPayload(rows, s).length, 0);
});
test("editing two rows to the same email → in-file duplicate detected", () => {
  const rows = [row(0, { email: "a@x.co" }), row(1, { email: "b@x.co" })];
  const s = setEmail(ind(), 1, "a@x.co");
  const rev = buildReview(rows, s);
  assert.equal(at(rev, 0).bucket, REVIEW_BUCKET.READY);
  assert.equal(at(rev, 1).bucket, REVIEW_BUCKET.ALREADY_IN_LIST);   // second occurrence
});
test("editing away from a collision restores eligibility", () => {
  const rows = [row(0, { email: "dup@x.co" })];
  let s = setEmail(ind({ existingEmails: ["dup@x.co"] }), 0, "dup@x.co");
  assert.equal(at(buildReview(rows, s), 0).bucket, REVIEW_BUCKET.ALREADY_IN_LIST);
  s = setEmail(s, 0, "fresh@x.co");
  assert.equal(at(buildReview(rows, s), 0).bucket, REVIEW_BUCKET.READY);
});

// 12/13 — business audience.
test("Employees/Clients/Vendors keep an automatic audience — never a blocker", () => {
  for (const k of ["employee", "client", "vendor"]) {
    const rev = buildReview([row(0, { type: "" })], biz(k));
    assert.equal(at(rev, 0).bucket, REVIEW_BUCKET.READY);
    assert.equal(at(rev, 0).audience, k);
    assert.equal(rev.counts.needsFix, 0);
  }
});
test("Universal unknown audience is a required fix; choosing resolves; 'Don't add' skips", () => {
  const rows = [row(0, { type: "contractor" }), row(1, { type: "Employee" })];
  const rev = buildReview(rows, biz("mixed"));
  assert.equal(at(rev, 0).bucket, REVIEW_BUCKET.NEEDS_FIX);
  assert.equal(at(rev, 0).blockerMessage, "We couldn't tell whether this business contact is an employee, client, or vendor.");
  assert.equal(at(rev, 1).audience, "employee");                    // recognized synonym normalized
  let s = chooseAudience(biz("mixed"), 0, "client");
  assert.equal(at(buildReview(rows, s), 0).bucket, REVIEW_BUCKET.READY);
  s = chooseAudience(biz("mixed"), 0, "skip");
  assert.equal(at(buildReview(rows, s), 0).bucket, REVIEW_BUCKET.WILL_SKIP);
});

// Individual/business boundary.
test("Individual strips a business recipientType; Business assigns it", () => {
  const r = row(0, { type: "vendor" });
  assert.equal(buildReviewPayload([r], ind())[0].recipientType, "");
  assert.equal(buildReviewPayload([r], biz("vendor"))[0].recipientType, "vendor");
});

// §9 — per-row Recipient Type override on a single-type business path.
test("single-type path: an explicit valid Recipient Type cell overrides the path default (flagged)", () => {
  // Employees list, but a row is explicitly a vendor → override applied + flagged, never silently kept as employee
  const rev = buildReview([row(0, { type: "vendor" }), row(1, { type: "" })], biz("employee"));
  assert.equal(at(rev, 0).audience, "vendor");
  assert.equal(at(rev, 0).audienceState, "override_cell");           // designation differs from the list type
  assert.equal(at(rev, 0).bucket, REVIEW_BUCKET.READY);
  assert.equal(at(rev, 1).audience, "employee");                     // blank cell → path default
  assert.equal(at(rev, 1).audienceState, "auto");
  assert.equal(buildReviewPayload([row(0, { type: "vendor" })], biz("employee"))[0].recipientType, "vendor");
});
test("single-type path: a recognized synonym cell normalizes; an UNKNOWN cell requires review", () => {
  const rev = buildReview([row(0, { type: "supplier" }), row(1, { type: "contractor" })], biz("client"));
  assert.equal(at(rev, 0).audience, "vendor");                       // supplier → vendor (override, canonical)
  assert.equal(at(rev, 1).bucket, REVIEW_BUCKET.NEEDS_FIX);          // contractor unknown → review, never guessed
  assert.equal(at(rev, 1).blockerCode, "needs_audience");
});
test("single-type override restricted to canonical values; a user review edit still wins", () => {
  let s = biz("vendor");
  s = chooseAudience(s, 0, "client");                                // user edit overrides everything
  assert.equal(at(buildReview([row(0, { type: "vendor" })], s), 0).audience, "client");
});

// group→relation dependency, clearing counts as an edit (F6).
test("changing group clears only an incompatible relation; explicit clear counts as an edit", () => {
  let s = setGroup(ind(), 0, "friend");                             // family/sibling → cleared under friend
  assert.equal(at(buildReview([row(0, { rel: "sibling" })], s), 0).relation, "");
  s = setRelation(s, 0, "close_friend"); s = setGroup(s, 0, "friend");
  assert.equal(at(buildReview([row(0, { rel: "sibling" })], s), 0).relation, "close_friend");
  const cleared = setGroup(ind(), 0, "");
  assert.equal(at(buildReview([row(0, { rel: "sister" })], cleared), 0).edited, true);   // clearing IS an edit
  assert.equal(categoryForRelation("close_friend"), "friend");
  assert.ok(relationsForGroup("friend").some((r) => r.value === "close_friend"));
});

// 15/16 — pagination is bounded; 5,000-row model stays viable.
test("pagination returns bounded slices and the 5,000-row model is viable", () => {
  const big = Array.from({ length: 5000 }, (_, i) => row(i, { rel: i % 2 ? "sister" : "bestie" }));
  const rev = buildReview(big, ind());
  assert.equal(rev.counts.total, 5000);
  assert.equal(rev.counts.ready, 5000);                             // all importable (unknown rel optional)
  const pg = paginate(rev.buckets.ready, 0, 25);
  assert.equal(pg.slice.length, 25);
  assert.equal(pg.pages, 200);
  assert.equal(paginate(rev.buckets.ready, 199, 25).slice.length, 25);
  assert.equal(paginate(rev.buckets.ready, 999, 25).page, 199);     // clamps past the end
});

// F6 — removeRow is gone.
test("removeRow export is removed", () => {
  assert.equal(M.removeRow, undefined);
});

// purity.
test("buildReview is pure (no mutation, idempotent)", () => {
  const rows = [row(0, { rel: "bestie" })];
  const s = setRelation(ind(), 0, "close_friend");
  const snap = JSON.stringify(s);
  assert.deepEqual(buildReview(rows, s), buildReview(rows, s));
  assert.equal(JSON.stringify(s), snap);
});

// ---- partial real-import handling (ADDED bucket, no double-submit) ----
test("committed emails move to ADDED, are excluded from the payload, and can't be re-submitted", () => {
  const rows = [row(0, { email: "a@x.co" }), row(1, { email: "b@x.co" })];
  const s = markCommitted(ind(), ["a@x.co"]);
  const rev = buildReview(rows, s);
  assert.equal(at(rev, 0).bucket, REVIEW_BUCKET.ADDED);
  assert.equal(rev.counts.added, 1);
  assert.equal(rev.importCount, 1);                        // only the un-added row is importable
  const payload = buildReviewPayload(rows, s);
  assert.equal(payload.length, 1);
  assert.equal(payload[0].email, "b@x.co");               // the added row is NOT re-sent
});
test("a backend failure leaves the row Ready with a plain retry note (retryable)", () => {
  const rows = [row(0, { email: "a@x.co" })];
  const s = setCommitErrors(ind(), { "a@x.co": "This contact couldn't be added. You can try again." });
  const it = at(buildReview(rows, s), 0);
  assert.equal(it.bucket, REVIEW_BUCKET.READY);           // still importable → a retry re-sends it
  assert.equal(it.retryNote, "This contact couldn't be added. You can try again.");
  assert.equal(buildReviewPayload(rows, s).length, 1);
});
test("an 'already exists' partial failure folds into already-in-list (excluded)", () => {
  const rows = [row(0, { email: "dup@x.co" })];
  const s = addExistingEmails(ind(), ["dup@x.co"]);
  assert.equal(at(buildReview(rows, s), 0).bucket, REVIEW_BUCKET.ALREADY_IN_LIST);
  assert.equal(buildReviewPayload(rows, s).length, 0);
});
test("bucket sum still holds with ADDED present", () => {
  const rows = [row(0), row(1), row(2, { name: "" })];
  const s = markCommitted(ind(), ["p0@x.co"]);
  const c = buildReview(rows, s).counts;
  assert.equal(c.ready + c.needsFix + c.alreadyInList + c.willSkip + c.invalidExcluded + c.added, c.total);
  assert.equal(c.added, 1);
});
