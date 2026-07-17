// src/import/completionModel.test.mjs — TEAM A adaptive-import completion logic.
// Run: node --test src/import/completionModel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RELATIONS_BY_CATEGORY, CLOSENESS_OPTIONS, ROW_STATE,
  resolveRelationshipRaw, resolveRow, buildCompletionSummary, buildCompletedImportContacts,
  buildRelationshipProfile, deterministicStructuredForContact, isValidRelation, isValidCloseness,
} from "./completionModel.js";

const row = (i, relationship = "", { birthday } = {}) => ({
  index: i, valid: true,
  contact: { fullName: "N" + i, email: `n${i}@x.co`, relationship, phone: "", company: "", department: "", recipientType: "", consent: "", source: "", notes: "" },
  __raw: birthday ? { DOB: birthday } : {},
  __map: birthday ? { birthday: "DOB" } : {},
});

test("name + email alone (no relationship) can enter the flow → optional_missing, importable", () => {
  const s = buildCompletionSummary([row(0, "")]);
  assert.equal(s.counts.optional_missing, 1);
  assert.equal(s.counts.needs_choice, 0);
  assert.equal(s.unresolvedCount, 0);
  // and it still produces a valid payload (name+email only)
  const [p] = buildCompletedImportContacts([row(0, "")]);
  assert.equal(p.name, "N0"); assert.equal(p.email, "n0@x.co");
  assert.equal(p.relationship, ""); assert.equal(p.relationshipCategory, "");
});

test("recognized relationships map deterministically (colleague/coworker/co-worker + exact canon)", () => {
  for (const raw of ["colleague", "Colleague", "coworker", "Co-Worker", "co worker", "CO-WORKER"]) {
    const r = resolveRelationshipRaw(raw);
    assert.equal(r.deterministic, true, raw);
    assert.equal(r.category, "professional");
    assert.equal(r.relation, "colleague");
  }
  // other exact canonical value/label matches are deterministic too
  assert.deepEqual(pick(resolveRelationshipRaw("Best Friend")), { category: "friend", relation: "best_friend" });
  assert.deepEqual(pick(resolveRelationshipRaw("boss")), { category: "professional", relation: "boss" });
  assert.deepEqual(pick(resolveRelationshipRaw("Aunt/Uncle")), { category: "family", relation: "aunt_uncle" });
  // a non-canonical label is NOT deterministic (must be user-mapped)
  assert.equal(resolveRelationshipRaw("bestie").deterministic, false);
  assert.equal(resolveRelationshipRaw("work bud").deterministic, false);
});
function pick(r) { return { category: r.category, relation: r.relation }; }

test("unknown relationships require ONE bulk mapping per UNIQUE value (grouped)", () => {
  const rows = [row(0, "bestie"), row(1, "bestie"), row(2, "work bud")];
  const s0 = buildCompletionSummary(rows, { descriptionDefault: "inner_circle" });
  assert.equal(s0.uniqueUnmappedValues.length, 2);                       // bestie + work bud (not 3 questions)
  assert.equal(s0.uniqueUnmappedValues.find((u) => u.raw === "bestie").count, 2); // both "bestie" rows grouped
  assert.equal(s0.counts.needs_choice, 3);
  // map "bestie" ONCE → both bestie rows resolve
  const key = s0.uniqueUnmappedValues.find((u) => u.raw === "bestie").key;
  const s1 = buildCompletionSummary(rows, { descriptionDefault: "inner_circle", relationshipMappings: { [key]: { category: "friend", relation: "best_friend" } } });
  assert.ok(s1.rows.filter((r) => r.raw === "bestie").every((r) => r.state === ROW_STATE.READY));
  assert.equal(s1.uniqueUnmappedValues.length, 1);                       // only "work bud" remains
});

test("Description/closeness is NEVER guessed from the raw label", () => {
  const r = resolveRow(row(0, "colleague"), {});                        // deterministic Type/Relation, NO description
  assert.equal(r.category, "professional");
  assert.equal(r.relation, "colleague");
  assert.equal(r.closeness, "");                                        // not inferred
  assert.equal(r.state, ROW_STATE.NEEDS_CHOICE);                        // description is a required choice
});

test("bulk description default + per-row overrides both work; override wins", () => {
  const rows = [row(0, "colleague"), row(1, "colleague")];
  let s = buildCompletionSummary(rows, { descriptionDefault: "greetme_worthy" });
  assert.equal(s.rows[0].closeness, "greetme_worthy");
  assert.equal(s.rows[0].state, ROW_STATE.READY);
  s = buildCompletionSummary(rows, { descriptionDefault: "greetme_worthy", rowOverrides: { 1: { closeness: "inner_circle" } } });
  assert.equal(s.rows[0].closeness, "greetme_worthy");
  assert.equal(s.rows[1].closeness, "inner_circle");                    // row override wins
  // relation override resolves an unknown row
  const s2 = buildCompletionSummary([row(0, "bestie")], { rowOverrides: { 0: { category: "friend", relation: "close_friend", closeness: "inner_circle" } } });
  assert.equal(s2.rows[0].state, ROW_STATE.READY);
  assert.equal(s2.rows[0].relation, "close_friend");
  // skip relationship → optional (import without a relationship)
  const s3 = buildCompletionSummary([row(0, "bestie")], { rowOverrides: { 0: { skipRelationship: true } } });
  assert.equal(s3.rows[0].state, ROW_STATE.OPTIONAL_MISSING);
});

test("final payload matches the manual recipient structure (+ full-date birthday, raw retained)", () => {
  const rows = [row(0, "Co-Worker", { birthday: "1990-11-01" })];
  const [p] = buildCompletedImportContacts(rows, { descriptionDefault: "greetme_worthy" });
  assert.equal(p.relationship, "colleague");            // canonical relation value
  assert.equal(p.relationshipCategory, "professional");
  assert.equal(p.relationshipCloseness, "greetme_worthy");
  assert.equal(p.relationshipContext, "");
  assert.equal(p.relationshipRaw, "Co-Worker");         // original raw retained (audit)
  assert.equal(p.birthday, "1990-11-01");               // full date preserved (autoSend applied server-side on confirm)
});

test("buildRelationshipProfile matches ContactForm's derivation (roleLabel === role value)", () => {
  assert.deepEqual(buildRelationshipProfile("professional", "colleague", "greetme_worthy"),
    { group: "professional", role: "colleague", roleLabel: "colleague", closeness: "greetme_worthy" });
  assert.equal(buildRelationshipProfile("", "", ""), null);
});

test("existing-contact compatibility: deterministic display only; non-deterministic stays user-confirmed; no rewrite", () => {
  assert.deepEqual(deterministicStructuredForContact({ relationship: "colleague", relationshipCategory: "" }),
    { relationshipCategory: "professional", relationship: "colleague" });
  assert.equal(deterministicStructuredForContact({ relationship: "bestie", relationshipCategory: "" }), null);       // non-deterministic → confirm
  assert.equal(deterministicStructuredForContact({ relationship: "colleague", relationshipCategory: "professional" }), null); // already structured → no rewrite
  assert.equal(deterministicStructuredForContact({ relationship: "", relationshipCategory: "" }), null);
});

test("option model integrity (guards for mapping/override validity)", () => {
  assert.ok(isValidRelation("professional", "colleague"));
  assert.ok(!isValidRelation("family", "colleague"));      // relation must belong to its category
  assert.ok(isValidCloseness("inner_circle"));
  assert.ok(!isValidCloseness("made_up"));
  assert.equal(CLOSENESS_OPTIONS.length, 3);
  assert.equal(RELATIONS_BY_CATEGORY.professional[0].value, "colleague");
});
