// src/pages/sendGreetingComposerFixes.test.mjs — Run: node --test src/pages/sendGreetingComposerFixes.test.mjs
//
// WP-C fixes on SendGreeting.jsx that do not involve draftService (see
// draftServiceMediaFields.test.mjs) or errorMessages.js (see errorMessages.test.mjs):
//   Fix 1 — validate() moves focus to the first invalid field, in field order.
//   Fix 3 — the "add to memory album" tile (Option 1) and "Add Photo for This Occasion" (Option 2)
//           now write to two SEPARATE state arrays instead of colliding on one.
//   Fix 5 — the dead `isRecurring` field is gone.
//
// SendGreeting.jsx is a ~2,900-line page wired to auth/router/api/cart/draft context and is not
// mounted under `node --test` in this codebase (see sendGreetingFlowersWiring.test.mjs's header for
// why, and its `includeGift`/`isUrgent`-style technique, reused below): pure expressions are
// extracted from the real source and evaluated; structural claims are asserted by reading the code.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SRC = readFileSync(join(__dirname, "SendGreeting.jsx"), "utf8");
const codeOnly = (s) => s.split("\n").map((l) => l.split("//")[0]).join("\n");
const CODE = codeOnly(SRC);

const slice = (startNeedle, endNeedle, label) => {
  const a = SRC.indexOf(startNeedle);
  assert.ok(a > -1, `${label}: start not found`);
  const b = SRC.indexOf(endNeedle, a);
  assert.ok(b > a, `${label}: end not found`);
  return SRC.slice(a, b);
};

// ===========================================================================
// Fix 1 — focus priority: recipient, then occasion, then photo
// ===========================================================================

test("focusFirstInvalidField picks the target in field-render order: contactId, then occasionType, then photo", () => {
  const match = SRC.match(
    /const target = fieldErrors\.contactId\s*\r?\n\s*\? contactSelectRef\.current\s*\r?\n\s*: fieldErrors\.occasionType\s*\r?\n\s*\? occasionSelectRef\.current\s*\r?\n\s*: fieldErrors\.photo\s*\r?\n\s*\? photoErrorRef\.current\s*\r?\n\s*: null;/,
  );
  assert.ok(match, "the exact priority ternary must be findable in the page source");

  // Same technique sendGreetingFlowersWiring.test.mjs uses for includeGift: extract the real
  // expression and evaluate it, but with the three refs replaced by plain labels — the priority
  // ORDER is what's under test, not the DOM ref/focus/scroll mechanics (which this repo's convention
  // does not mount a DOM to exercise; see task notes).
  const body = match[0]
    .replace(/contactSelectRef\.current/, "'CONTACT'")
    .replace(/occasionSelectRef\.current/, "'OCCASION'")
    .replace(/photoErrorRef\.current/, "'PHOTO'");
  const decide = new Function("fieldErrors", `${body}\nreturn target;`);

  assert.equal(decide({ contactId: "err" }), "CONTACT");
  assert.equal(decide({ occasionType: "err" }), "OCCASION");
  assert.equal(decide({ photo: "err" }), "PHOTO");
  assert.equal(decide({}), null, "no errors means no target");
  // Priority: contactId beats everything else, occasionType beats photo.
  assert.equal(decide({ contactId: "err", occasionType: "err", photo: "err" }), "CONTACT");
  assert.equal(decide({ occasionType: "err", photo: "err" }), "OCCASION");
  assert.equal(decide({ contactId: "err", photo: "err" }), "CONTACT");
});

test("validate() calls focusFirstInvalidField only when there ARE errors, after setErrors", () => {
  const validateFn = slice("const validate = () => {", "\n  };", "validate");
  const setErrorsAt = validateFn.indexOf("setErrors(newErrors);");
  const guardAt = validateFn.indexOf("if (Object.keys(newErrors).length > 0) {");
  const callAt = validateFn.indexOf("focusFirstInvalidField(newErrors);");
  assert.ok(setErrorsAt > -1 && guardAt > setErrorsAt, "errors are set into state before focus is attempted");
  assert.ok(callAt > guardAt, "focusFirstInvalidField is called inside the non-empty guard, not unconditionally");
});

test("the three refs are actually attached to the fields focusFirstInvalidField expects", () => {
  // contactId select
  const contactSelect = slice('name="contactId"', "</select>", "contact select");
  assert.match(contactSelect, /ref=\{contactSelectRef\}/);
  // occasionType select
  const occasionSelect = slice('name="occasionType"', "</select>", "occasion select");
  assert.match(occasionSelect, /ref=\{occasionSelectRef\}/);
  // photo error region wraps the Alert, carrying the ref and a tabIndex so it is focusable
  assert.match(CODE, /\{errors\.photo && \(\s*<div ref=\{photoErrorRef\} tabIndex=\{-1\}/);
});

// ===========================================================================
// Fix 3 — contactAlbumPhotosToAdd and memoryPhotos are genuinely separate state
// ===========================================================================

test("handleAddToContactAlbum and handleMemoryPhotoAdd are two distinct handlers with two distinct setters", () => {
  const albumHandler = slice("const handleAddToContactAlbum = (e) => {", "\n  };", "album handler");
  const occasionHandler = slice("const handleMemoryPhotoAdd = (e) => {", "\n  };", "occasion-photo handler");

  assert.match(albumHandler, /setContactAlbumPhotosToAdd\(/);
  assert.equal(/setMemoryPhotos\(/.test(albumHandler), false,
    "the album tile's handler must never write into memoryPhotos — that was the reported bug");

  assert.match(occasionHandler, /setMemoryPhotos\(/);
  assert.equal(/setContactAlbumPhotosToAdd\(/.test(occasionHandler), false,
    "the per-occasion handler must never write into contactAlbumPhotosToAdd");
});

test("the two states have independent remove handlers too", () => {
  const removeAlbum = slice("const handleRemoveContactAlbumPhoto = (index) => {", "\n  };", "remove album photo");
  const removeOccasion = slice("const handleRemoveMemoryPhoto = (index) => {", "\n  };", "remove occasion photo");
  assert.match(removeAlbum, /setContactAlbumPhotosToAdd\(/);
  assert.match(removeOccasion, /setMemoryPhotos\(/);
  assert.notEqual(removeAlbum, removeOccasion);
});

test("the two file inputs are wired to their own handler, not sharing one onChange", () => {
  // Option 1's hidden input (add to contact album)
  const albumInput = slice('ref={addToMemoryInputRef}', "/>", "album file input");
  assert.match(albumInput, /onChange=\{handleAddToContactAlbum\}/);
  // Option 2's hidden input (add photo for this occasion)
  const occasionInput = slice('ref={memoryPhotoInputRef}', "/>", "occasion file input");
  assert.match(occasionInput, /onChange=\{handleMemoryPhotoAdd\}/);
  assert.notEqual(albumInput, occasionInput);
});

test("both states are declared independently with useState, and both feed the draft-save effect (Fix 4)", () => {
  assert.match(CODE, /const \[memoryPhotos, setMemoryPhotos\] = useState\(\[\]\)/);
  assert.match(CODE, /const \[contactAlbumPhotosToAdd, setContactAlbumPhotosToAdd\] = useState\(\[\]\)/);
  // Sanity: the draft auto-save effect's dependency array carries both, confirming they are tracked
  // as genuinely separate pieces of state rather than one derived from the other.
  const effectDeps = slice("}, [formData, defaultPhoto, memoryPhotos, useMemoryPhotos, excludedMemoryPhotos, contactAlbumPhotosToAdd]);", "\n", "draft-save effect deps");
  assert.ok(effectDeps.includes("memoryPhotos") && effectDeps.includes("contactAlbumPhotosToAdd"));
});

// ===========================================================================
// Fix 5 — isRecurring is genuinely gone
// ===========================================================================

test("isRecurring no longer appears anywhere in SendGreeting.jsx", () => {
  // A plain grep-style lock test, consistent with this repo's other "must not reappear" assertions
  // (e.g. contactScopeView.test.mjs's subscription/tier/billing check).
  assert.equal(/isRecurring/.test(SRC), false, "isRecurring must have zero remaining references");
});
