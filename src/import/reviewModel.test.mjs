// src/import/reviewModel.test.mjs — Run: node --test src/import/reviewModel.test.mjs
//
// DETERMINISTIC control-behavior tests for the LINEAR three-field Review model. These exercise the
// real state transitions the dropdowns/buttons perform — not source scans. Rerender is modeled as:
// apply a pure updater, then rebuild the review from the SAME state (the component reads control
// values straight from this state, so a rebuild == a rerender).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildReview, buildReviewPayload, freshReviewState, attentionOrder,
  setGroup, setRelation, setCloseness, setName, setEmail, leaveRelationshipBlank,
  chooseAudience, skipContact, removeRow, applyToAllMatching, bulkRelationshipGroups,
  nextCard, prevCard, categoryForRelation, relationsForGroup, REVIEW_STATUS,
  DEFAULT_CLOSENESS, CLOSENESS_OPTIONS,
} from "./reviewModel.js";
import { CLOSENESS_OPTIONS as FORM_CLOSENESS, RELATIONS_BY_CATEGORY } from "./completionModel.js";

function row(i, { name = "Person " + i, email = `p${i}@x.co`, relationship = "", recipientType = "", birthday, dup = null } = {}) {
  const __raw = birthday != null ? { B: birthday } : {};
  const __map = birthday != null ? { birthday: "B" } : {};
  return { contact: { fullName: name, email, relationship, recipientType }, index: i, __raw, __map, duplicate: dup };
}
const individual = () => freshReviewState({ business: false, kind: null });
const business = (kind) => freshReviewState({ business: true, kind });
const itemOf = (rev, i) => rev.items.find((it) => it.index === i);
const statusOf = (rev, i) => itemOf(rev, i).status;

// 1 — all three relationship controls are represented on a card (group + relation options + closeness).
test("a review card exposes all three relationship dimensions (group, relation, closeness)", () => {
  const it = itemOf(buildReview([row(0, { relationship: "sibling" })], individual()), 0);
  assert.equal(it.group, "family");
  assert.equal(it.relation, "sibling");
  assert.equal(it.closeness, DEFAULT_CLOSENESS);
  assert.ok(relationsForGroup("family").length > 0);   // relation options exist for the group
});

// 2 — Greet-Me Worthy is the preselected closeness for every row with no interaction.
test("Greet-Me Worthy is the preselected closeness by default", () => {
  const rev = buildReview([row(0), row(1, { relationship: "bestie" })], individual());
  assert.equal(itemOf(rev, 0).closeness, "greetme_worthy");
  assert.equal(itemOf(rev, 1).closeness, "greetme_worthy");
  assert.equal(buildReviewPayload([row(0)], individual())[0].relationshipCloseness, "greetme_worthy");
});

// 3 — the closeness vocabulary is EXACTLY ContactForm's (same object, same 3 canonical values).
test("closeness reuses ContactForm's exact vocabulary and values (no new taxonomy)", () => {
  assert.deepEqual(CLOSENESS_OPTIONS, FORM_CLOSENESS);
  assert.deepEqual(CLOSENESS_OPTIONS.map((o) => o.value), ["inner_circle", "greetme_worthy", "obligatory"]);
  assert.equal(CLOSENESS_OPTIONS.find((o) => o.value === "greetme_worthy").label, "Greet-Me Worthy");
});

// 4 — recognized relationships prepopulate BOTH group and relation.
test("recognized relationship prepopulates group and relation", () => {
  const it = itemOf(buildReview([row(0, { relationship: "colleague" })], individual()), 0);
  assert.equal(it.group, "professional");
  assert.equal(it.relation, "colleague");
  assert.equal(it.relationUnrecognizedRaw, false);
});

// 5 — unknown relationships remain unguessed (blank group/relation), and never block import.
test("unknown relationship stays unguessed and does not block import", () => {
  const rev = buildReview([row(0, { relationship: "bestie" })], individual());
  const it = itemOf(rev, 0);
  assert.equal(it.group, "");
  assert.equal(it.relation, "");
  assert.equal(it.relationUnrecognizedRaw, true);
  assert.equal(it.status, REVIEW_STATUS.READY);         // importable with a blank relationship
  assert.equal(rev.importEnabled, true);
  const [p] = buildReviewPayload([row(0, { relationship: "bestie" })], individual());
  assert.equal(p.relationship, ""); assert.equal(p.relationshipCategory, ""); assert.equal(p.relationshipRaw, "bestie");
});

// 6 — changing the group clears ONLY an incompatible relationship; a compatible one is kept.
test("changing group clears only an incompatible relationship value", () => {
  // start recognized as family/sibling, switch group to friend → sibling is incompatible → cleared
  let s = setGroup(individual(), 0, "friend");
  let it = itemOf(buildReview([row(0, { relationship: "sibling" })], s), 0);
  assert.equal(it.group, "friend");
  assert.equal(it.relation, "");                        // sibling not valid under friend → cleared
  // now pick a friend relation, then re-affirm the SAME group → relation kept
  s = setRelation(s, 0, "close_friend");
  s = setGroup(s, 0, "friend");
  it = itemOf(buildReview([row(0, { relationship: "sibling" })], s), 0);
  assert.equal(it.relation, "close_friend");            // compatible → retained
});

// 7 — a selection updates the CORRECT row only.
test("a selection updates only the targeted row", () => {
  let s = setRelation(individual(), 1, "close_friend");
  const rev = buildReview([row(0), row(1)], s);
  assert.equal(itemOf(rev, 1).relation, "close_friend");
  assert.equal(itemOf(rev, 0).relation, "");            // sibling row untouched
  assert.equal(categoryForRelation("close_friend"), "friend");
});

// 8 — selections survive rerender (rebuild from the same state yields the same values).
test("group/relation/closeness selections survive rerender", () => {
  let s = individual();
  s = setGroup(s, 0, "friend");
  s = setRelation(s, 0, "neighbor");
  s = setCloseness(s, 0, "inner_circle");
  const a = itemOf(buildReview([row(0, { relationship: "bestie" })], s), 0);
  const b = itemOf(buildReview([row(0, { relationship: "bestie" })], s), 0);   // rerender
  assert.deepEqual([a.group, a.relation, a.closeness], ["friend", "neighbor", "inner_circle"]);
  assert.deepEqual([b.group, b.relation, b.closeness], ["friend", "neighbor", "inner_circle"]);
});

// 9 — a resolved row stays in the attention order (never unmounts because status became Ready).
test("resolving a card does NOT remove it from the attention order (stays mounted until Save & next)", () => {
  const rows = [row(0, { relationship: "bestie" }), row(1, { relationship: "sibling" })];
  const order0 = attentionOrder(rows, individual());
  assert.deepEqual(order0, [0]);                        // only the unrecognized row needs a card
  const s = setRelation(individual(), 0, "close_friend"); // resolve it
  assert.deepEqual(attentionOrder(rows, s), [0]);       // still in the frozen order
  assert.equal(itemOf(buildReview(rows, s), 0).status, REVIEW_STATUS.READY);
});

// 10 — Save & next advances exactly one card (pure nav helper).
test("Save & next advances exactly one card and clamps at the end", () => {
  assert.equal(nextCard(0, 5), 1);
  assert.equal(nextCard(4, 5), 5);
  assert.equal(nextCard(5, 5), 5);                      // clamp
});

// 11 — Back restores the previous card AND its saved selections (selections live in persistent state).
test("Back restores the previous card and its saved selections", () => {
  const rows = [row(0, { relationship: "bestie" }), row(1, { name: "" })];
  let s = individual();
  s = setRelation(s, 0, "acquaintance");               // edit card 0
  let nav = 0;
  nav = nextCard(nav, 2);                              // → card 1
  assert.equal(nav, 1);
  nav = prevCard(nav);                                 // Back → card 0
  assert.equal(nav, 0);
  assert.equal(itemOf(buildReview(rows, s), 0).relation, "acquaintance"); // selection preserved
});

// 12 — "Leave relationship blank" is valid for Individual (explicit blank, importable).
test("Leave relationship blank is a valid Individual choice", () => {
  // even a recognized row can be explicitly blanked
  const s = leaveRelationshipBlank(individual(), 0);
  const it = itemOf(buildReview([row(0, { relationship: "sibling" })], s), 0);
  assert.equal(it.group, ""); assert.equal(it.relation, "");
  assert.equal(it.status, REVIEW_STATUS.READY);
  assert.equal(buildReviewPayload([row(0, { relationship: "sibling" })], s)[0].relationship, "");
});

// 13 — name/email can be corrected inline and the row becomes importable.
test("name and email are correctable inline", () => {
  const rows = [row(0, { name: "" }), row(1, { email: "nope" })];
  let rev = buildReview(rows, individual());
  assert.equal(statusOf(rev, 0), REVIEW_STATUS.NEEDS_NAME);
  assert.equal(statusOf(rev, 1), REVIEW_STATUS.NEEDS_EMAIL);
  let s = setName(individual(), 0, "Fixed Name");
  s = setEmail(s, 1, "fixed@x.co");
  rev = buildReview(rows, s);
  assert.equal(statusOf(rev, 0), REVIEW_STATUS.READY);
  assert.equal(statusOf(rev, 1), REVIEW_STATUS.READY);
  const payload = buildReviewPayload(rows, s);
  assert.ok(payload.some((p) => p.name === "Fixed Name"));
  assert.ok(payload.some((p) => p.email === "fixed@x.co"));
});

// 14 — Skip removes only that row from the payload; others still import.
test("Skip removes only that row from the import payload", () => {
  const rows = [row(0), row(1), row(2)];
  const s = skipContact(individual(), 1);
  const rev = buildReview(rows, s);
  assert.equal(statusOf(rev, 1), REVIEW_STATUS.SKIPPED);
  assert.equal(rev.summary.willSkip, 1);
  const payload = buildReviewPayload(rows, s);
  assert.equal(payload.length, 2);
  assert.ok(!payload.some((p) => p.email === "p1@x.co"));
});

// 15 — apply-to-all affects only rows with the EXACT matching normalized raw value.
test("apply-to-all touches only matching raw values", () => {
  const rows = [
    row(0, { relationship: "bestie" }),
    row(1, { relationship: "Bestie" }),   // same normalized value
    row(2, { relationship: "amigo" }),    // different unknown
  ];
  const s = applyToAllMatching(individual(), rows, "bestie", { group: "friend", relation: "close_friend" });
  const rev = buildReview(rows, s);
  assert.equal(itemOf(rev, 0).relation, "close_friend");
  assert.equal(itemOf(rev, 1).relation, "close_friend");   // normalized match
  assert.equal(itemOf(rev, 2).relation, "");               // untouched
  // and it only surfaces as a bulk option when 2+ share the value
  assert.deepEqual(bulkRelationshipGroups(rows).map((g) => g.key), ["bestie"]);
});

// 16 — individual overrides remain possible after apply-to-all; apply-to-all won't clobber a prior
// individual change without force.
test("apply-to-all respects prior individual edits; individual override still works afterward", () => {
  const rows = [row(0, { relationship: "bestie" }), row(1, { relationship: "bestie" })];
  let s = setRelation(individual(), 0, "neighbor");                       // individual edit on row 0
  s = applyToAllMatching(s, rows, "bestie", { group: "friend", relation: "close_friend" }); // no force
  let rev = buildReview(rows, s);
  assert.equal(itemOf(rev, 0).relation, "neighbor");                     // NOT clobbered
  assert.equal(itemOf(rev, 1).relation, "close_friend");                 // applied
  // an individual override AFTER apply-to-all still wins
  s = setRelation(s, 1, "teammate");
  rev = buildReview(rows, s);
  assert.equal(itemOf(rev, 1).relation, "teammate");
  // force=true (explicit confirmation) does overwrite the individually-changed row
  const forced = applyToAllMatching(s, rows, "bestie", { group: "friend", relation: "friend" }, { force: true });
  assert.equal(itemOf(buildReview(rows, forced), 0).relation, "friend");
});

// 17 — Universal audience is required or may be skipped; single-type kinds are never re-asked.
test("Universal unknown audience is required or skippable; Employees/Clients/Vendors auto-apply", () => {
  const uni = [row(0, { recipientType: "contractor" }), row(1, { recipientType: "Employee" })];
  let s = business("mixed");
  assert.equal(buildReview(uni, s).importEnabled, false);            // blocked by the unknown
  assert.equal(statusOf(buildReview(uni, s), 0), REVIEW_STATUS.NEEDS_AUDIENCE);
  s = chooseAudience(s, 0, "skip");
  assert.equal(buildReview(uni, s).importEnabled, true);            // resolved via skip
  // single-type path never asks
  for (const k of ["employee", "client", "vendor"]) {
    const rev = buildReview([row(0, { recipientType: "" })], business(k));
    assert.equal(rev.summary.needsChoice, 0);
    assert.equal(itemOf(rev, 0).audience, k);
    assert.equal(attentionOrder([row(0, { recipientType: "" })], business(k)).length, 0);
  }
});

// 18 — ready contacts carry the same three values and can be edited (they're normal items).
test("ready contacts expose editable group/relation/closeness values", () => {
  const rows = [row(0, { relationship: "sibling" })];               // recognized → ready, not a card
  assert.equal(attentionOrder(rows, individual()).length, 0);
  const it = itemOf(buildReview(rows, individual()), 0);
  assert.equal(it.status, REVIEW_STATUS.READY);
  assert.deepEqual([it.group, it.relation, it.closeness], ["family", "sibling", "greetme_worthy"]);
  const s = setCloseness(individual(), 0, "inner_circle");          // edit a ready row
  assert.equal(itemOf(buildReview(rows, s), 0).closeness, "inner_circle");
});

// 19 — payload/model are pure and side-effect free (used to prove sample paths never mutate).
test("buildReview/buildReviewPayload are pure (no mutation, idempotent)", () => {
  const rows = [row(0, { relationship: "bestie" })];
  const s = setRelation(individual(), 0, "close_friend");
  const snap = JSON.stringify(s);
  const a = buildReview(rows, s); const b = buildReview(rows, s);
  assert.equal(JSON.stringify(s), snap);
  assert.deepEqual(a, b);
  assert.deepEqual(buildReviewPayload(rows, s), buildReviewPayload(rows, s));
});

// Boundary + dedup still hold.
test("Individual strips business type; Business assigns it; duplicates never import", () => {
  const r = row(0, { recipientType: "vendor" });
  assert.equal(buildReviewPayload([r], individual())[0].recipientType, "");
  assert.equal(buildReviewPayload([r], business("vendor"))[0].recipientType, "vendor");
  const dupRows = [row(0, { dup: "existing_record" }), row(1)];
  assert.equal(statusOf(buildReview(dupRows, individual()), 0), REVIEW_STATUS.DUPLICATE);
  assert.equal(buildReviewPayload(dupRows, individual()).length, 1);
});

// Top summary shape ("need your attention" + the breakdown lines).
test("top summary carries needAttention + ready/skip/duplicate/needsChoice", () => {
  const rows = [
    row(0, { relationship: "bestie" }),          // attention (unrecognized), still ready
    row(1, { recipientType: "contractor" }),     // attention (unknown audience) — but individual, so recognized? no rel → ready
    row(2, { dup: "existing_record" }),          // already present
    row(3, { name: "" }),                        // needs a name
  ];
  const rev = buildReview(rows, individual());   // individual: recipientType ignored
  assert.equal(rev.summary.duplicate, 1);
  assert.equal(rev.summary.needsFix, 1);
  assert.ok(rev.summary.needAttention >= 2);     // bestie row + missing-name row
  assert.equal(typeof rev.summary.ready, "number");
});
