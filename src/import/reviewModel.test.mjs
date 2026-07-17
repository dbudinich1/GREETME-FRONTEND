// src/import/reviewModel.test.mjs — Run: node --test src/import/reviewModel.test.mjs
//
// DETERMINISTIC control-behavior tests for the plain-language Review model. These exercise the
// actual state transitions a dropdown/remove control performs — not source scans — so a regression
// in "selection updates the right row / survives rerender / counts update / import enables" fails
// here. Rerender is modeled as: apply a pure updater, then rebuild the review from the SAME state
// (the component reads control values straight from this state, so a rebuild == a rerender).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReview, buildReviewPayload, freshReviewState, chooseRelationship, chooseAudience,
  removeRow, setDescriptionDefault, categoryForRelation, REVIEW_STATUS,
} from "./reviewModel.js";

// Build a wizard-shaped row. `dup` marks an existing/same-file duplicate.
function row(i, { name = "Person " + i, email = `p${i}@x.co`, relationship = "", recipientType = "", birthday, dup = null } = {}) {
  const __raw = birthday != null ? { B: birthday } : {};
  const __map = birthday != null ? { birthday: "B" } : {};
  return { contact: { fullName: name, email, relationship, recipientType }, index: i, __raw, __map, duplicate: dup };
}
const individual = () => freshReviewState({ business: false, kind: null });
const business = (kind) => freshReviewState({ business: true, kind });
const statusOf = (rev, i) => rev.items.find((it) => it.index === i).status;

// 1 — the review IS the single surface reached after upload (no defaults intermediary in the model).
test("buildReview yields a review directly from rows — no decision/defaults stage in the model", () => {
  const rev = buildReview([row(0), row(1)], individual());
  assert.equal(rev.items.length, 2);
  assert.equal(rev.summary.ready, 2);
  assert.equal(rev.importEnabled, true);
});

// 2 — an Individual unknown relationship ("bestie") does NOT block import; it stays ready & blank.
test("Individual unrecognized relationship does not block import and is left blank (never guessed)", () => {
  const rev = buildReview([row(0, { relationship: "bestie" })], individual());
  const it = rev.items[0];
  assert.equal(it.status, REVIEW_STATUS.READY);
  assert.equal(it.unrecognizedRelationship, true);
  assert.equal(it.relation, "");                       // not guessed
  assert.equal(rev.importEnabled, true);
  // and it never appears as a required choice or a warning count
  assert.equal(rev.summary.needsChoice, 0);
  // payload keeps the raw, structured relationship blank
  const [p] = buildReviewPayload([row(0, { relationship: "bestie" })], individual());
  assert.equal(p.relationship, "");
  assert.equal(p.relationshipCategory, "");
  assert.equal(p.relationshipRaw, "bestie");           // approved raw contract preserved
});

// 3 — a missing name blocks ONLY that row.
test("missing name blocks only that row; other rows still import", () => {
  const rows = [row(0, { name: "" }), row(1), row(2)];
  const rev = buildReview(rows, individual());
  assert.equal(statusOf(rev, 0), REVIEW_STATUS.NEEDS_NAME);
  assert.equal(statusOf(rev, 1), REVIEW_STATUS.READY);
  assert.equal(rev.importCount, 2);                    // the two valid rows
  assert.equal(rev.importEnabled, true);               // one bad row does not block the button
  assert.equal(buildReviewPayload(rows, individual()).length, 2);
});

// 4 — an invalid/missing email blocks ONLY that row.
test("invalid or missing email blocks only that row", () => {
  const rows = [row(0, { email: "not-an-email" }), row(1, { email: "" }), row(2)];
  const rev = buildReview(rows, individual());
  assert.equal(statusOf(rev, 0), REVIEW_STATUS.NEEDS_EMAIL);
  assert.equal(statusOf(rev, 1), REVIEW_STATUS.NEEDS_EMAIL);
  assert.equal(statusOf(rev, 2), REVIEW_STATUS.READY);
  assert.equal(rev.importCount, 1);
});

// 5 — optional blank relationships are NOT counted as errors or warnings.
test("blank relationships never appear as error/warning counts", () => {
  const rev = buildReview([row(0, { relationship: "" }), row(1, { relationship: "" })], individual());
  assert.equal(rev.summary.ready, 2);
  assert.equal(rev.summary.needsChoice, 0);
  assert.equal(rev.summary.needsFix, 0);
  assert.ok(!("optional" in rev.summary) && !("warnings" in rev.summary));
});

// 6 — Employees/Clients/Vendors are NOT asked to classify audience again.
test("single-type business paths auto-apply audience — never a required choice", () => {
  for (const kind of ["employee", "client", "vendor"]) {
    const rev = buildReview([row(0, { recipientType: "" }), row(1, { recipientType: "" })], business(kind));
    assert.equal(rev.summary.needsChoice, 0, `${kind} must not ask again`);
    assert.equal(rev.items[0].audience, kind);
    assert.equal(rev.importEnabled, true);
  }
});

// 7 — a Universal-List row with a genuinely unknown audience gets ONE clear required choice.
test("Universal unknown audience → exactly one required choice; recognized rows auto-normalize", () => {
  const rows = [
    row(0, { recipientType: "Employee" }),   // recognized synonym
    row(1, { recipientType: "customer" }),   // recognized → client
    row(2, { recipientType: "contractor" }), // genuinely unknown → needs choice
  ];
  const rev = buildReview(rows, business("mixed"));
  assert.equal(rev.items[0].audience, "employee");
  assert.equal(rev.items[1].audience, "client");
  assert.equal(statusOf(rev, 2), REVIEW_STATUS.NEEDS_AUDIENCE);
  assert.equal(rev.summary.needsChoice, 1);
  assert.equal(rev.importEnabled, false);              // blocked until row 2 is resolved or skipped
});

// 8 — every dropdown changes AND retains its value across a rebuild (== rerender).
test("relationship + audience selections change the right row and SURVIVE rerender", () => {
  // relationship control (Individual)
  let s = individual();
  s = chooseRelationship(s, 1, "close_friend");
  let rev = buildReview([row(0), row(1)], s);
  assert.equal(rev.items[1].relation, "close_friend");   // right row updated
  assert.equal(rev.items[0].relation, "");               // sibling row untouched
  // rebuild again from the SAME state — value must NOT be overwritten by derived state
  rev = buildReview([row(0), row(1)], s);
  assert.equal(rev.items[1].relation, "close_friend");
  assert.equal(categoryForRelation("close_friend"), "friend");

  // audience control (Universal)
  let b = business("mixed");
  b = chooseAudience(b, 0, "vendor");
  const brev = buildReview([row(0, { recipientType: "contractor" })], b);
  assert.equal(brev.items[0].audience, "vendor");
  assert.equal(brev.items[0].status, REVIEW_STATUS.READY);
  // and choosing "Leave blank" on a recognized row wins over the auto-detected value
  let c = chooseRelationship(individual(), 0, "");
  assert.equal(buildReview([row(0, { relationship: "sibling" })], c).items[0].relation, "");
});

// 9 — counts update immediately after a selection.
test("required-choice and ready counts update the instant a choice is made", () => {
  const rows = [row(0, { recipientType: "contractor" }), row(1, { recipientType: "Employee" })];
  let s = business("mixed");
  let rev = buildReview(rows, s);
  assert.equal(rev.summary.needsChoice, 1);
  assert.equal(rev.summary.ready, 1);
  s = chooseAudience(s, 0, "client");
  rev = buildReview(rows, s);
  assert.equal(rev.summary.needsChoice, 0);
  assert.equal(rev.summary.ready, 2);
});

// 10 — import enables once required choices are resolved OR skipped.
test("import enables after the required choice is resolved, and also when it is skipped", () => {
  const rows = [row(0, { recipientType: "contractor" }), row(1, { recipientType: "Employee" })];
  // resolve
  let s = chooseAudience(business("mixed"), 0, "vendor");
  let rev = buildReview(rows, s);
  assert.equal(rev.importEnabled, true);
  assert.equal(rev.importCount, 2);
  // skip
  s = chooseAudience(business("mixed"), 0, "skip");
  rev = buildReview(rows, s);
  assert.equal(statusOf(rev, 0), REVIEW_STATUS.SKIPPED);
  assert.equal(rev.summary.willSkip, 1);
  assert.equal(rev.importEnabled, true);               // the remaining ready row can import
  assert.equal(rev.importCount, 1);
  assert.equal(buildReviewPayload(rows, s).length, 1); // skipped row excluded from the payload
});

// 11 — Greet-Me Worthy is applied to every row with zero normal-path friction.
test("Greet-Me Worthy default is applied without any user interaction", () => {
  const p = buildReviewPayload([row(0), row(1, { relationship: "sibling" })], individual());
  assert.equal(p.length, 2);
  for (const c of p) assert.equal(c.relationshipCloseness, "greetme_worthy");
  // advanced override still works
  const s = setDescriptionDefault(individual(), "inner_circle");
  assert.equal(buildReviewPayload([row(0)], s)[0].relationshipCloseness, "inner_circle");
});

// 12 — buildReview is pure: it never mutates state and is idempotent (no derived-state overwrite).
test("buildReview never mutates state and is idempotent", () => {
  const s = chooseAudience(business("mixed"), 0, "vendor");
  const snapshot = JSON.stringify(s);
  const a = buildReview([row(0, { recipientType: "contractor" })], s);
  const b = buildReview([row(0, { recipientType: "contractor" })], s);
  assert.equal(JSON.stringify(s), snapshot);           // state untouched
  assert.deepEqual(a, b);                              // same input → same output
});

// Root-cause regression: a resolved row STAYS in the list (old UI dropped it, so controls "vanished").
test("resolving a row keeps it visible with a flipped status (control never disappears mid-edit)", () => {
  const rows = [row(0, { recipientType: "contractor" })];
  let s = business("mixed");
  assert.equal(buildReview(rows, s).items.length, 1);
  s = chooseAudience(s, 0, "employee");
  const rev = buildReview(rows, s);
  assert.equal(rev.items.length, 1);                   // still present — did not vanish
  assert.equal(rev.items[0].status, REVIEW_STATUS.READY);
});

// removeRow drops a row from the list and the payload.
test("removeRow takes a row out of the list and the import", () => {
  const rows = [row(0), row(1)];
  const s = removeRow(individual(), 0);
  const rev = buildReview(rows, s);
  assert.equal(rev.items.length, 1);
  assert.equal(rev.items[0].index, 1);
  assert.equal(buildReviewPayload(rows, s).length, 1);
});

// Individual/business boundary: an Individual row never carries a business recipientType.
test("Individual strips a business recipientType from the payload; Business assigns it", () => {
  const r = row(0, { recipientType: "vendor" });
  assert.equal(buildReviewPayload([r], individual())[0].recipientType, "");     // stripped
  assert.equal(buildReviewPayload([r], business("vendor"))[0].recipientType, "vendor");
});

// Duplicates preserved: an existing-record row is shown as already-present and excluded from import.
test("duplicate rows are surfaced as already-present and never imported", () => {
  const rows = [row(0, { dup: "existing_record" }), row(1)];
  const rev = buildReview(rows, individual());
  assert.equal(statusOf(rev, 0), REVIEW_STATUS.DUPLICATE);
  assert.equal(rev.summary.duplicate, 1);
  assert.equal(rev.importCount, 1);
  assert.equal(buildReviewPayload(rows, individual()).length, 1);
});
