// src/components/contactFormValidation.test.mjs — Run: node --test src/components/contactFormValidation.test.mjs
//
// DETERMINISTIC tests for the guarded, OPTIONAL relationship validation and the ContactForm wiring.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { relationshipErrors, hasCompleteRelationship, sanitizeRelationshipForSave } from "./contactFormValidation.js";

const CF = readFileSync(new URL("./ContactForm.jsx", import.meta.url), "utf8");
const blank = { relationshipCategory: "", relationship: "", relationshipCloseness: "" };
const complete = { relationshipCategory: "family", relationship: "sibling", relationshipCloseness: "greetme_worthy" };

// A fully blank relationship is VALID — the compatibility fix.
test("fully blank relationship is valid (no errors for an untouched section)", () => {
  assert.deepEqual(relationshipErrors(blank), {});
  assert.deepEqual(relationshipErrors({}), {});
});

// An imported blank-relationship contact can save unrelated edits (name / occasions don't add rel errors).
test("blank relationship does not block an unrelated name or occasion edit", () => {
  const nameEdit = { ...blank, name: "Corrected Name" };
  const occasionEdit = { ...blank, occasions: [{ type: "birthday", date: "1990-05-14" }] };
  assert.deepEqual(relationshipErrors(nameEdit), {});
  assert.deepEqual(relationshipErrors(occasionEdit), {});
});

// After save, a fully blank relationship stays STRUCTURALLY blank (no dangling closeness/profile).
test("saving a blank relationship keeps it structurally blank (no dangling closeness/profile)", () => {
  const out = sanitizeRelationshipForSave({ ...blank, name: "X", relationshipProfile: null });
  assert.equal(out.relationshipCategory, "");
  assert.equal(out.relationship, "");
  assert.equal(out.relationshipCloseness, "");
  assert.equal(out.relationshipProfile, null);
});

// Closeness alone is never persisted (stripped on save) and is not an error.
test("closeness alone → valid, and is stripped on save (never dangling)", () => {
  const cAlone = { relationshipCategory: "", relationship: "", relationshipCloseness: "greetme_worthy", relationshipProfile: { group: "x" } };
  assert.deepEqual(relationshipErrors(cAlone), {});                 // not an error
  const out = sanitizeRelationshipForSave(cAlone);
  assert.equal(out.relationshipCloseness, "");                      // cleared
  assert.equal(out.relationshipProfile, null);                     // no dangling profile
});

// Partial relationships FAIL clearly, in plain language.
test("group selected without a specific relationship fails validation", () => {
  const e = relationshipErrors({ relationshipCategory: "friend", relationship: "", relationshipCloseness: "" });
  assert.equal(e.relationship, "Choose the specific relationship.");
  assert.equal(e.relationshipCloseness, "Choose how close you are.");
});
test("relationship selected without closeness fails validation", () => {
  const e = relationshipErrors({ relationshipCategory: "family", relationship: "sibling", relationshipCloseness: "" });
  assert.equal(e.relationshipCloseness, "Choose how close you are.");
  assert.equal("relationship" in e, false);
});
test("a specific relationship without a group asks for a group", () => {
  const e = relationshipErrors({ relationshipCategory: "", relationship: "sibling", relationshipCloseness: "greetme_worthy" });
  assert.equal(e.relationship, "Choose a relationship group.");
});

// A complete relationship is valid and untouched on save (unchanged behavior).
test("complete relationship is valid and preserved on save", () => {
  assert.deepEqual(relationshipErrors(complete), {});
  assert.equal(hasCompleteRelationship(complete), true);
  const profile = { group: "family", role: "sibling", roleLabel: "sibling", closeness: "greetme_worthy" };
  const out = sanitizeRelationshipForSave({ ...complete, relationshipProfile: profile });
  assert.equal(out.relationshipCloseness, "greetme_worthy");        // preserved
  assert.deepEqual(out.relationshipProfile, profile);               // preserved
});

test("hasCompleteRelationship requires both group and specific relationship", () => {
  assert.equal(hasCompleteRelationship(blank), false);
  assert.equal(hasCompleteRelationship({ relationshipCategory: "family", relationship: "" }), false);
  assert.equal(hasCompleteRelationship(complete), true);
});

// ---- ContactForm wiring (ties the pure logic to the component; canonical taxonomy untouched) ----
test("ContactForm delegates to the guarded validator and sanitizes on save", () => {
  assert.match(CF, /import \{ relationshipErrors, sanitizeRelationshipForSave \} from '\.\/contactFormValidation\.js'/);
  assert.match(CF, /Object\.assign\(newErrors, relationshipErrors\(formData\)\)/);
  assert.match(CF, /await onSubmit\(sanitizeRelationshipForSave\(formData\)\)/);
  // the old hard-coded "always required" relationship errors are gone
  assert.ok(!/Please select a relationship category/.test(CF));
  assert.ok(!/Please select relationship closeness/.test(CF));
  // ALIGNMENT FIX (§4): the Type "(optional)" tag + helper line are removed so Type/Relation/Description
  // labels are single-line and their controls align on the same baseline; no required asterisks added.
  assert.ok(!/Optional — add this to help Greet-Me personalize greetings\./.test(CF), "Type helper line removed");
  assert.ok(!/Type <span[^>]*>\(optional\)<\/span>/.test(CF), "Type (optional) tag removed");
  assert.ok(!/Relation <span style=\{\{ color: '#ef4444' \}\}>\*<\/span>/.test(CF), "no required asterisk on Relation");
  // the three labels are the exact plain words, aligned in the 3-column grid
  assert.match(CF, /gridTemplateColumns: isWideForm \? '1fr 1fr 1fr' : '1fr'/);   // desktop 3-up, mobile stacked
  assert.match(CF, />\s*Type\s*<\/label>/);
  assert.match(CF, />\s*Relation\s*<\/label>/);
  assert.match(CF, />\s*Description\s*<\/label>/);
  // canonical taxonomy/options untouched
  assert.match(CF, /<option value="family">Family<\/option>/);
  assert.match(CF, /<option value="greetme_worthy">Greet-Me Worthy<\/option>/);
});
