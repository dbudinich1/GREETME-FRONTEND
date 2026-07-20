// src/import/safeDefaults.test.mjs — Run: node --test src/import/safeDefaults.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MATRIX, defaultForPath, recommendedDefaults,
  applyDefaultsForPath, applyRecommendedDefaults, undoRecommendedDefaults,
} from "./safeDefaults.js";
import { freshReviewState, buildReview, buildReviewPayload, setRelation, leaveRelationshipBlank } from "./reviewModel.js";
import { isValidRelation, isValidCloseness } from "./completionModel.js";

const TODAY = "2026-07-20";
// row with a raw relationship string (blank by default) — personal unless a business kind is set.
const row = (i, { name = "N" + i, email = `p${i}@x.co`, rel = "", type = "" } = {}) =>
  ({ contact: { fullName: name, email, relationship: rel, recipientType: type }, index: i, __raw: {}, __map: {} });
const ind = (extra = {}) => freshReviewState({ business: false, kind: null, todayIso: TODAY, ...extra });
const biz = (kind, extra = {}) => freshReviewState({ business: true, kind, todayIso: TODAY, ...extra });

// ---- matrix + taxonomy ----
test("EVERY default value is canonical (nothing invented; no pending/held entries remain)", () => {
  for (const [path, d] of Object.entries(DEFAULT_MATRIX)) {
    assert.ok(!d.pending, `${path} has no held/pending marker`);
    assert.ok(isValidRelation(d.relationshipCategory, d.relationship), `${path} relation canonical`);
    assert.ok(isValidCloseness(d.relationshipCloseness), `${path} closeness canonical`);
  }
});
test("Family default is the canonical family_member — loved_one is never used or substituted", () => {
  assert.deepEqual(defaultForPath("family"), { relationshipCategory: "family", relationship: "family_member", relationshipCloseness: "greetme_worthy" });
  assert.equal(DEFAULT_MATRIX.family.relationship, "family_member");
  assert.equal(DEFAULT_MATRIX.family.label, "Family Member");
  // loved_one appears nowhere in the matrix, and no spouse/partner/sibling/cousin substitution
  const dump = JSON.stringify(DEFAULT_MATRIX);
  assert.ok(!/loved_one/.test(dump), "loved_one absent from the default matrix");
  for (const bad of ["spouse", "partner", "sibling", "cousin"]) assert.ok(!dump.includes(`"${bad}"`), `no ${bad} substitution`);
});
test("Friend/Professional/Employee/Client/Vendor defaults expose the exact canonical values", () => {
  assert.deepEqual(defaultForPath("friend"), { relationshipCategory: "friend", relationship: "acquaintance", relationshipCloseness: "greetme_worthy" });
  assert.deepEqual(defaultForPath("professional"), { relationshipCategory: "professional", relationship: "colleague", relationshipCloseness: "greetme_worthy" });
  assert.deepEqual(defaultForPath("employee"), { relationshipCategory: "professional", relationship: "employee", relationshipCloseness: "greetme_worthy" });
  assert.deepEqual(defaultForPath("client"), { relationshipCategory: "professional", relationship: "client", relationshipCloseness: "greetme_worthy" });
  assert.deepEqual(defaultForPath("vendor"), { relationshipCategory: "professional", relationship: "vendor", relationshipCloseness: "greetme_worthy" });
});

// ---- 1: never applied without an explicit action ----
test("recommendedDefaults is read-only; state is unchanged until applyDefaultsForPath", () => {
  const rows = [row(0), row(1)];
  const s = ind();
  const info = recommendedDefaults(rows, s, "friend");
  assert.equal(info.available, true);
  assert.equal(info.count, 2);
  assert.deepEqual(s.edits, {});                                // recommendedDefaults mutated nothing
  assert.equal(buildReview(rows, s).items.every((it) => !it.hasRelation), true);
});

// ---- 2/3/4: applies only to blank fields per personal path ----
for (const [path, cat, rel] of [["friend", "friend", "acquaintance"], ["professional", "professional", "colleague"]]) {
  test(`${path} default applies only to blank-relationship rows`, () => {
    const rows = [row(0), row(1, { rel: "sibling" })];         // row1 has a canonical CSV relationship
    const { state, appliedCount } = applyDefaultsForPath(rows, ind(), path);
    assert.equal(appliedCount, 1);                             // only the blank row
    const items = buildReview(rows, state).items;
    assert.equal(items[0].group, cat); assert.equal(items[0].relation, rel); assert.equal(items[0].closeness, "greetme_worthy");
    assert.equal(items[1].relation, "sibling");               // CSV value untouched
  });
}
test("Family default applies family_member/greetme_worthy to blank rows only", () => {
  const rows = [row(0), row(1, { rel: "sibling" })];              // row1 has a canonical CSV relationship
  const { appliedCount, state } = applyDefaultsForPath(rows, ind(), "family");
  assert.equal(appliedCount, 1);                                  // only the blank row
  const items = buildReview(rows, state).items;
  assert.equal(items[0].group, "family"); assert.equal(items[0].relation, "family_member"); assert.equal(items[0].closeness, "greetme_worthy");
  assert.equal(items[1].relation, "sibling");                     // CSV value untouched
});

// ---- 5/6: business defaults; canonical values ----
test("Employee/Client/Vendor defaults set professional + canonical relation on blank rows", () => {
  for (const [kind, rel] of [["employee", "employee"], ["client", "client"], ["vendor", "vendor"]]) {
    const rows = [row(0, { type: kind })];
    const { state, appliedCount } = applyDefaultsForPath(rows, biz(kind), kind);
    assert.equal(appliedCount, 1);
    const it = buildReview(rows, state).items[0];
    assert.equal(it.group, "professional"); assert.equal(it.relation, rel); assert.equal(it.closeness, "greetme_worthy");
    assert.equal(it.audience, kind);                           // recipientType still auto from the path
  }
});

// ---- 6: existing CSV values win ----
test("a recognized CSV relationship is never overwritten by a default", () => {
  const rows = [row(0, { rel: "colleague" })];
  const info = recommendedDefaults(rows, ind(), "friend");
  assert.equal(info.count, 0);                                 // not eligible
  const { appliedCount } = applyDefaultsForPath(rows, ind(), "friend");
  assert.equal(appliedCount, 0);
});
test("an UNRECOGNIZED CSV relationship is not auto-defaulted (needs user review)", () => {
  const rows = [row(0, { rel: "work bud" })];
  assert.equal(recommendedDefaults(rows, ind(), "professional").count, 0);
});

// ---- 7: individual edits win ----
test("a user edit or explicit blank excludes the row from defaults", () => {
  const rows = [row(0), row(1)];
  let s = setRelation(ind(), 0, "close_friend");               // user edit on row 0
  s = leaveRelationshipBlank(s, 1);                            // explicit blank on row 1
  assert.equal(recommendedDefaults(rows, s, "friend").count, 0);
});

// ---- 8: undo restores the exact prior state ----
test("undo restores the exact pre-application edits (absence preserved)", () => {
  const rows = [row(0), row(1)];
  const before = setRelation(ind(), 0, "close_friend");        // row0 pre-edited (ineligible), row1 blank
  const beforeSnap = JSON.parse(JSON.stringify(before.edits));
  const { state: after, undo, appliedCount } = applyDefaultsForPath(rows, before, "friend");
  assert.equal(appliedCount, 1);
  assert.ok(after.edits[1].relation === "acquaintance");
  const restored = undoRecommendedDefaults(after, undo);
  assert.deepEqual(restored.edits, beforeSnap);                // exact restore, row1 edit key gone
  assert.equal(restored.edits[1], undefined);
});

// ---- 9/10: mixed set changes only eligible; truthful count ----
test("a mixed set changes only eligible contacts and reports a truthful count", () => {
  const rows = [row(0), row(1, { rel: "sibling" }), row(2), row(3, { rel: "work bud" })];
  const info = recommendedDefaults(rows, ind(), "friend");
  assert.deepEqual(info.indices, [0, 2]);                      // only truly-blank rows
  assert.equal(info.count, 2);
  const { appliedCount } = applyDefaultsForPath(rows, ind(), "friend");
  assert.equal(appliedCount, 2);
});

// ---- 11: idempotent ----
test("re-applying defaults is idempotent (no double application)", () => {
  const rows = [row(0), row(1)];
  const first = applyDefaultsForPath(rows, ind(), "professional");
  assert.equal(first.appliedCount, 2);
  const second = applyDefaultsForPath(rows, first.state, "professional");
  assert.equal(second.appliedCount, 0);                        // already applied → nothing eligible
  assert.deepEqual(buildReview(rows, first.state).items.map((i) => i.relation), buildReview(rows, second.state).items.map((i) => i.relation));
});

// ---- 12: payload uses the manual-recipient-compatible structure ----
test("defaulted rows produce a manual-compatible payload (relationship + category + closeness)", () => {
  const rows = [row(0)];
  const { state } = applyDefaultsForPath(rows, ind(), "professional");
  const [p] = buildReviewPayload(rows, state);
  assert.equal(p.relationship, "colleague");
  assert.equal(p.relationshipCategory, "professional");
  assert.equal(p.relationshipCloseness, "greetme_worthy");
  assert.equal(p.recipientType, "");                           // personal → no business type
  assert.equal("relationshipRaw" in p, true);
});

// ---- 13/17: personal boundary + no dangling closeness ----
test("Personal Professional path strips business recipientType even after defaults", () => {
  const rows = [row(0, { type: "vendor" })];                   // stray business type on a personal import
  const { state } = applyDefaultsForPath(rows, ind(), "professional");
  assert.equal(buildReviewPayload(rows, state)[0].recipientType, "");
});
test("declining defaults leaves blank relationships valid with no dangling closeness/profile", () => {
  const rows = [row(0), row(1)];
  const s = ind();                                             // defaults NOT applied
  const payload = buildReviewPayload(rows, s);
  for (const p of payload) {
    assert.equal("relationship" in p, false);
    assert.equal("relationshipCloseness" in p, false);         // no closeness without a relationship (F4)
  }
});
