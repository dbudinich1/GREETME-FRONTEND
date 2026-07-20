// src/import/taxonomyLock.test.mjs — Run: node --test src/import/taxonomyLock.test.mjs
//
// TAXONOMY LOCK. The Import Wizard's relationship + closeness vocabulary (completionModel.js, which
// the reviewModel and ReviewScreen consume) MUST stay identical to the manual-recipient ContactForm.
// This test parses the REAL <option> arrays out of ContactForm.jsx and asserts value-for-value and
// label-for-label equality with completionModel's RELATIONS_BY_CATEGORY + CLOSENESS_OPTIONS. If
// ContactForm ever adds/removes/relabels a relationship or closeness value, this fails — so the two
// vocabularies can never silently diverge without a deliberate, coordinated change.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { RELATIONS_BY_CATEGORY, CLOSENESS_OPTIONS, RELATIONSHIP_CATEGORIES } from "./completionModel.js";

const FORM = readFileSync(new URL("../components/ContactForm.jsx", import.meta.url), "utf8");

// Pull every <option value="x">Label</option> inside the block that follows a `=== '<cat>'` guard,
// bounded to that block only (ends at the next category guard or the closeness anchor).
function optionsForCategory(cat) {
  const start = FORM.indexOf(`relationshipCategory === '${cat}'`);
  assert.ok(start >= 0, `ContactForm must render a ${cat} relationship block`);
  const bounds = ["relationshipCategory === '", 'value="inner_circle"']
    .map((s) => FORM.indexOf(s, start + 30)).filter((x) => x > start);
  const end = bounds.length ? Math.min(...bounds) : start + 1200;
  const region = FORM.slice(start, end);
  const out = [];
  const re = /<option value="([^"]+)">([^<]+)<\/option>/g;
  let m;
  while ((m = re.exec(region)) && m[1] !== "") out.push({ value: m[1], label: m[2].trim() });
  return out;
}
function closenessFromForm() {
  const anchor = FORM.indexOf('value="inner_circle"');
  assert.ok(anchor >= 0, "ContactForm must render the closeness options");
  const region = FORM.slice(anchor - 60, anchor + 260);
  const out = [];
  const re = /<option value="(inner_circle|greetme_worthy|obligatory)">([^<]+)<\/option>/g;
  let m;
  while ((m = re.exec(region))) out.push({ value: m[1], label: m[2].trim() });
  return out;
}

test("relationship-group taxonomy is identical to ContactForm (family/friend/professional)", () => {
  // ContactForm's category <select> — bounded to its own </select> so relation values don't leak in
  const cStart = FORM.indexOf('name="relationshipCategory"');
  const catBlock = FORM.slice(cStart, FORM.indexOf("</select>", cStart));
  const cats = [...catBlock.matchAll(/<option value="(family|friend|professional)">([^<]+)<\/option>/g)].map((m) => ({ value: m[1], label: m[2] }));
  assert.deepEqual(cats, RELATIONSHIP_CATEGORIES.map((c) => ({ value: c.value, label: c.label })));
});

for (const cat of ["family", "friend", "professional"]) {
  test(`relationship vocabulary for '${cat}' matches ContactForm exactly (value + label + order)`, () => {
    const fromForm = optionsForCategory(cat);
    const fromModel = RELATIONS_BY_CATEGORY[cat].map((r) => ({ value: r.value, label: r.label }));
    assert.deepEqual(fromForm, fromModel, `${cat} relationship options diverged from ContactForm`);
  });
}

test("'close_friend' (\"Close Friend\") is a genuine ContactForm value — kept, not invented", () => {
  const friend = optionsForCategory("friend");
  assert.ok(friend.some((o) => o.value === "close_friend" && o.label === "Close Friend"), "Close Friend must exist in ContactForm");
  // and the Import Wizard uses the same value
  assert.ok(RELATIONS_BY_CATEGORY.friend.some((r) => r.value === "close_friend" && r.label === "Close Friend"));
});

test("closeness taxonomy is identical to ContactForm (values + exact labels)", () => {
  const fromForm = closenessFromForm();
  const fromModel = CLOSENESS_OPTIONS.map((o) => ({ value: o.value, label: o.label }));
  assert.deepEqual(fromForm, fromModel);
  // the three canonical values, in order
  assert.deepEqual(fromModel.map((o) => o.value), ["inner_circle", "greetme_worthy", "obligatory"]);
  // exact canonical labels (ContactForm uses "…What Ya Gotta Do")
  assert.deepEqual(fromModel.map((o) => o.label), ["Inner Circle", "Greet-Me Worthy", "You Gotta Do What Ya Gotta Do"]);
});

test("family_member is canonical under Family (Wizard + ContactForm); loved_one is absent everywhere", () => {
  // present in the Import Wizard relationship model
  assert.ok(RELATIONS_BY_CATEGORY.family.some((r) => r.value === "family_member" && r.label === "Family Member"), "Wizard Family has family_member");
  // present in ContactForm's Family dropdown (parsed from the real JSX)
  const fam = optionsForCategory("family");
  assert.ok(fam.some((o) => o.value === "family_member" && o.label === "Family Member"), "ContactForm Family has Family Member");
  // it exists ONLY under Family (relation values are unique across categories)
  for (const cat of ["friend", "professional"]) assert.ok(!optionsForCategory(cat).some((o) => o.value === "family_member"), `family_member not under ${cat}`);
  // loved_one is absent from the taxonomy AND ContactForm
  const modelValues = Object.values(RELATIONS_BY_CATEGORY).flat().map((r) => r.value);
  assert.ok(!modelValues.includes("loved_one"), "loved_one not in canonical taxonomy");
  assert.ok(!FORM.includes("loved_one"), "loved_one not in ContactForm");
});
test("no extra relationship values exist in the Import Wizard beyond ContactForm's", () => {
  const modelValues = Object.values(RELATIONS_BY_CATEGORY).flat().map((r) => r.value).sort();
  const formValues = ["family", "friend", "professional"].flatMap((c) => optionsForCategory(c).map((o) => o.value)).sort();
  assert.deepEqual(modelValues, formValues, "Import Wizard relationship values must be exactly ContactForm's set");
});
