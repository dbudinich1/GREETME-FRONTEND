// src/components/contactFormGiftCtas.test.mjs — Run: node --test src/components/contactFormGiftCtas.test.mjs
//
// WP-B: three founder-approved corrections to ContactForm.jsx's per-occasion gift setup —
//   1. the gift reminder banner loses its competing "Add Gift" button and becomes informational-only,
//   2. the inline "Choose Item" button now also fires for a 'marketplace' gift setting,
//   3. Faith-Based occasions (Christian/Jewish/Muslim) get the same Gift Add-On/Auto-Gift/Choose Item
//      card Personal and Secular occasions already have.
//
// ContactForm.jsx is a large, deeply-wired component (~3,100 lines) that this codebase's tests do not
// mount (see taxonomyLock.test.mjs, contactFormValidation.test.mjs's wiring section — both read the
// real JSX and assert structurally rather than rendering it). This file follows the same convention.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { getOccasionsByCategory } from "../utils/helpers.js";

const CF = readFileSync(new URL("./ContactForm.jsx", import.meta.url), "utf8").replace(/\r\n/g, "\n");

/** Comments explain history ("a button used to sit here"); guards must read the code, not the prose. */
const codeOnly = (s) => s.split("\n").map((l) => l.split("//")[0]).join("\n").replace(/\/\*[\s\S]*?\*\//g, "");

const slice = (startNeedle, endNeedle, label) => {
  const a = CF.indexOf(startNeedle);
  assert.ok(a > -1, `${label}: start not found`);
  const b = CF.indexOf(endNeedle, a);
  assert.ok(b > a, `${label}: end not found`);
  return CF.slice(a, b);
};

// ===========================================================================
// 1. The gift reminder banner: informational only, no competing CTA
// ===========================================================================

// FOUNDER round 3 (Surface 2 proposal): the banner moved BELOW the Occasion Scheduler card, so its slice now
// ends at the footer ("{/* Actions */}") instead of the start of the Occasions card. The "no button / no
// Add Gift / no modal" assertions below are unchanged and still run against the real banner markup.
const BANNER = slice(
  "{/* Gift Reminder Banner",
  "{/* Actions */}",
  "gift reminder banner",
);

test("the banner no longer opens GiftSelectorModal or any 'Add Gift' button", () => {
  const bannerCode = codeOnly(BANNER); // strip the explanatory comment, which itself mentions "Add Gift"
  assert.equal(/setGiftModalOpen\(true\)/.test(bannerCode), false,
    "the banner must not open the gift modal — that duplicated the per-occasion picker");
  assert.equal(/<GiftSelectorModal/.test(bannerCode), false, "no modal instantiated inside the banner itself");
  assert.equal(/Add Gift/i.test(bannerCode), false, "no 'Add Gift' label anywhere in the banner's rendered output");
  assert.equal(/<button/i.test(bannerCode), false, "the banner renders no button at all — purely informational");
});

test("the banner's copy is informational and points at the real gift routes (Gift Place or Greet-Me select)", () => {
  // Copy replaced by the founder (2026-10-01). Intent kept: informational, and it must point at controls that exist.
  assert.match(BANNER, /Remember to Include a gift/);
  assert.match(BANNER, /Greet-Me Gift Place/, "names the Gift Place route (per-occasion Choose Item -> /dashboard/gifts)");
  assert.doesNotMatch(BANNER, /select one for you|within your budget/, "auto-selection claim removed until it works (founder 2026-10-06)");
  assert.match(CF, /<option value="curated">Let Greet-Me select a gift<\/option>/, "the control the copy refers to exists");
});
test("the banner now sits after the Occasions card and before the footer", () => {
  assert.ok(CF.indexOf("{/* Gift Reminder Banner") > CF.indexOf("{/* Occasions */}"));
  assert.ok(CF.indexOf("{/* Gift Reminder Banner") < CF.indexOf("{/* Actions */}"));
});

test("giftModalOpen state and the GiftSelectorModal instantiation still exist elsewhere (not deleted, just disconnected from the banner)", () => {
  assert.match(CF, /const \[giftModalOpen, setGiftModalOpen\] = useState\(false\)/);
  assert.match(CF, /<GiftSelectorModal\r?\n\s*isOpen=\{giftModalOpen\}/);
});

// ===========================================================================
// 2. Choose Item gating now includes 'marketplace'
// ===========================================================================

const CHOOSE_ITEM_CONDITION =
  "(giftSetting.type === 'merch' || giftSetting.type === 'marketplace' || giftSetting.type === 'subscription')";

test("the Choose Item button's gate includes marketplace alongside merch and subscription, everywhere it appears", () => {
  const occurrences = CF.split(CHOOSE_ITEM_CONDITION).length - 1;
  // Personal occasions, Secular occasions, and the new Faith-Based block — three occurrences.
  assert.equal(occurrences, 3, "expected the marketplace-inclusive gate in Personal, Secular, and Faith blocks");
});

test("selecting marketplace routes through the same /dashboard/merch navigation merch itself uses", () => {
  const navExpr = "navigate((giftSetting.type === 'merch' || giftSetting.type === 'marketplace') ? `/dashboard/merch?category=merch${returnParam}` : `/dashboard/gifts?category=${giftSetting.type}${returnParam}`)";
  const occurrences = CF.split(navExpr).length - 1;
  assert.equal(occurrences, 3, "marketplace must route to /dashboard/merch (same as merch), not /dashboard/gifts?category=marketplace");
});

test("GiftSelectorModal's onBrowse is wired to the same marketplace navigation (previously unset)", () => {
  const modalMount = slice("<GiftSelectorModal", "/>", "GiftSelectorModal mount");
  assert.match(modalMount, /onBrowse=\{\(\) => \{/, "onBrowse must be a real handler, not left unset");
  const onBrowseBody = slice("onBrowse={() => {", "}}", "onBrowse body");
  assert.match(onBrowseBody, /navigate\(`\/dashboard\/merch\?category=merch/);
});

// ===========================================================================
// 3. Faith-Based occasions get the same gift-configuration card
// ===========================================================================

test("a 'Gifts for Faith-Based Holidays' block exists, gated on at least one selected faith occasion", () => {
  assert.match(CF, /Gifts for Faith-Based Holidays/);
  const gate = "formData.occasions?.some(occ => {\n          const occasion = [...occasionCategories.christian, ...occasionCategories.jewish, ...occasionCategories.muslim].find(o => o.value === occ.type);\n          return occasion && ['christian', 'jewish', 'muslim'].includes(occasion.category);\n        })";
  assert.ok(CF.includes(gate), "the block's visibility gate must check formData.occasions against the christian/jewish/muslim categories");
});

test("the faith gift block reuses getOccasionGiftSetting/handleOccasionGiftChange unmodified, keyed by occ.type", () => {
  // Bounded region: from the heading to the GiftSelectorModal mount further down the file.
  const start = CF.indexOf("Gifts for Faith-Based Holidays");
  const end = CF.indexOf("<GiftSelectorModal", start);
  assert.ok(start > -1 && end > start, "faith gift block region must be findable");
  const region = CF.slice(start, end);

  assert.match(region, /getOccasionGiftSetting\(occ\.type\)/);
  assert.match(region, /handleOccasionGiftChange\(occ\.type, 'type', e\.target\.value\)/);
  assert.match(region, /handleOccasionGiftChange\(occ\.type, 'autoGift', e\.target\.checked\)/);
  // No parallel/forked implementation — same helpers, same signatures as Personal/Secular use.
  assert.equal(/getOccasionGiftSetting\s*=/.test(region), false, "must not redeclare the helper locally");
  assert.equal(/const handleOccasionGiftChange/.test(region), false);
});

test("the faith gift block does not touch religious labels, dates, or the faith-selection mechanism", () => {
  const start = CF.indexOf("Gifts for Faith-Based Holidays");
  const end = CF.indexOf("<GiftSelectorModal", start);
  const region = CF.slice(start, end);
  for (const forbidden of ["handleFaithSelectionChange", "handleFaithDateChange", "FaithBasedOccasionSelector"]) {
    assert.equal(region.includes(forbidden), false, `faith gift block must not call ${forbidden}`);
  }
});

// ===========================================================================
// 4. Faith occasion types are plain string keys — same shape as Personal/Secular
// ===========================================================================
//
// getOccasionGiftSetting/handleOccasionGiftChange do formData.occasionGiftSettings?.[occasionValue] —
// a plain string-keyed lookup with no allowlist. This is only safe for Faith occasions if their
// `.value` (what becomes occ.type in formData.occasions) is an ordinary string exactly like a
// Personal/Secular occasion's, which is what getOccasionsByCategory() in helpers.js is checked for.

test("christian/jewish/muslim occasion values are plain non-empty strings, same shape as personal/secular", () => {
  const categories = getOccasionsByCategory();
  for (const cat of ["personal", "christian", "jewish", "muslim", "secular"]) {
    assert.ok(Array.isArray(categories[cat]) && categories[cat].length > 0, `${cat} must be a non-empty array`);
    for (const occasion of categories[cat]) {
      assert.equal(typeof occasion.value, "string", `${cat}: ${JSON.stringify(occasion)} has a non-string value`);
      assert.ok(occasion.value.length > 0, `${cat}: value must not be empty`);
    }
  }
});

test("occasion values are unique across ALL categories — a faith value can never collide with a personal/secular one in occasionGiftSettings", () => {
  const categories = getOccasionsByCategory();
  const allValues = Object.values(categories).flat().map((o) => o.value);
  assert.equal(new Set(allValues).size, allValues.length, "every occasion value must be globally unique");
});

test("getOccasionGiftSetting/handleOccasionGiftChange contain no category allowlist that would silently exclude a faith type", () => {
  const fns = slice("const getOccasionGiftSetting = ", "const handleFaithSelectionChange", "gift-setting helpers");
  for (const term of ["christian", "jewish", "muslim", "personal", "secular", "category"]) {
    assert.equal(new RegExp(term, "i").test(fns), false,
      `the helpers must be pure string-keyed lookups — must not reference '${term}'`);
  }
  // Confirms the actual lookup shape: a plain bracket-keyed read/write, nothing more.
  assert.match(fns, /formData\.occasionGiftSettings\?\.\[occasionValue\]/);
  // QR Cash fix (Team 1A): the handler now builds `next` (to write the displayed $25 default when the type becomes qrcash)
  // and assigns it at the same bracket key; the lookup shape is otherwise unchanged.
  assert.match(fns, /occasionGiftSettings: \{[\s\S]*?\[occasionValue\]: next/);
});

// ===========================================================================
// FOUNDER round 4 (Surface 2 proposal): per-card "Add gift" checkbox replaces the None dropdown. It is the
// card's OWN gift control - it must not become a second "Add Gift" button.
// ===========================================================================
test("the per-card 'Add gift' control is a checkbox, not a button; still no Add Gift CTA anywhere", () => {
  const code = codeOnly(CF);
  const row = code.slice(code.indexOf("const renderAddGiftRow"), code.indexOf("const handleOccasionGiftChange"));
  assert.match(row, /type="checkbox"/);
  assert.equal(/<button/i.test(row), false, "no button inside the Add gift row");
  assert.equal(/>\s*Add Gift\s*</.test(code), false, "no Add Gift button label anywhere");
  assert.equal(/setGiftModalOpen\(true\)/.test(code), false, "GiftSelectorModal still never opened from a CTA");
});
