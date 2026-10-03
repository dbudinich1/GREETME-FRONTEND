// Surface 9: the plain-words Draft Economics treatment labels are the founder-approved wording, exactly as written.
// Run: node --test src/pages/fundraiser/founderEconomicsTreatmentLabels.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const raw = fs.readFileSync(new URL("./FounderFundraisingDashboard.jsx", import.meta.url), "utf8");
const src = raw.split(String.fromCharCode(92) + "u2019").join(String.fromCharCode(0x2019)); // source spells the apostrophe as an escape
const APPROVED = [
  "Onboarding fee", "Veterans contribution", "Discounts", "Tax", "Payment processor fees",
  "Excluded from sharing; Greet-Me retains it", "Excluded from sharing; fee waived", "Excluded",
  "Contributed from Greet-Me" + String.fromCharCode(0x2019) + "s share only", "Not eligible for sharing", "Eligible, calculated on the net amount",
  "Eligible, calculated on the gross amount", "Excluded from the base", "Deducted before sharing (net of processor fees)",
  "Not deducted; Greet-Me absorbs them (gross)",
];
test("every approved treatment label appears verbatim in the label tables", () => {
  const block = src.slice(src.indexOf("const F1_TREATMENT_FIELD_LABELS"), src.indexOf("const f1ShareTypeLabel"));
  for (const label of APPROVED) assert.ok(block.includes(`"${label}"`), label);
});
