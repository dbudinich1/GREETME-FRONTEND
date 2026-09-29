// src/services/draftServiceMediaFields.test.mjs — Run: node --test src/services/draftServiceMediaFields.test.mjs
//
// WP-C Fix 4: SendGreeting.jsx's draft auto-save/restore now carries defaultPhoto, memoryPhotos,
// useMemoryPhotos, excludedMemoryPhotos, and contactAlbumPhotosToAdd through draftService, not just
// formData. draftService.js is a plain class with no DOM/React dependency beyond `localStorage`, so
// it is stubbed the same minimal way this codebase's other non-browser tests do (see
// merchGiftBinding.test.mjs) and exercised for real — no source-reading needed here.
//
// NOTE ON THE Set<->Array CONVERSION: SendGreeting.jsx converts `excludedMemoryPhotos` (a Set) to an
// array with Array.from(...) before calling saveDraft, and back to a Set with `new Set(...)` after
// getDraft — draftService.js itself does no Set/Array conversion of its own (confirmed by reading
// draftService.js: saveDraft/getDraft pass every field through untouched via {...draft} / drafts[id]).
// So what is tested here is exactly what draftService actually receives and returns: a plain array.
// The Set conversion is the caller's responsibility and is out of scope for this file.
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

// draftService.js imports '../models/greetingDraft' with no extension — fine for Vite, but plain
// Node ESM requires a fully-specified relative specifier. See extensionlessEsmResolverForTests.mjs
// for why this hook exists (production code is not touched by this test-writing pass).
register(new URL("./extensionlessEsmResolverForTests.mjs", import.meta.url));

// ---- minimal localStorage so draftService can be exercised for real (same pattern as
// src/pages/merchGiftBinding.test.mjs) ----
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  clear: () => store.clear(),
};

const { default: draftService } = await import("./draftService.js");

beforeEach(() => {
  store.clear();
});

const MEDIA_PAYLOAD = {
  contactId: "contact_123",
  occasionType: "birthday",
  formData: { customMessage: "Happy Birthday!", occasionType: "birthday", contactId: "contact_123" },
  defaultPhoto: "https://example.com/user-default.jpg",
  memoryPhotos: ["data:image/png;base64,AAA", "data:image/png;base64,BBB"],
  useMemoryPhotos: true,
  excludedMemoryPhotos: ["data:image/png;base64,BBB"], // caller has already done Array.from(Set)
  contactAlbumPhotosToAdd: ["data:image/png;base64,CCC"],
  status: "draft",
};

// ===========================================================================
// The round trip
// ===========================================================================

test("saveDraft persists all five media fields, and getDraft returns them unchanged", () => {
  draftService.saveDraft(MEDIA_PAYLOAD);
  const restored = draftService.getDraft("contact_123", "birthday");

  assert.ok(restored, "the draft must be found by contactId+occasionType");
  assert.equal(restored.defaultPhoto, MEDIA_PAYLOAD.defaultPhoto);
  assert.deepEqual(restored.memoryPhotos, MEDIA_PAYLOAD.memoryPhotos);
  assert.equal(restored.useMemoryPhotos, true);
  assert.deepEqual(restored.excludedMemoryPhotos, MEDIA_PAYLOAD.excludedMemoryPhotos);
  assert.deepEqual(restored.contactAlbumPhotosToAdd, MEDIA_PAYLOAD.contactAlbumPhotosToAdd);
  // formData itself must still round-trip too — the media fields are additive, not a replacement.
  assert.deepEqual(restored.formData, MEDIA_PAYLOAD.formData);
});

test("excludedMemoryPhotos round-trips as a plain array — draftService performs no Set conversion", () => {
  draftService.saveDraft(MEDIA_PAYLOAD);
  const restored = draftService.getDraft("contact_123", "birthday");
  assert.equal(Array.isArray(restored.excludedMemoryPhotos), true);
  assert.equal(restored.excludedMemoryPhotos instanceof Set, false);
  // The caller reconstructs the Set; draftService's own contract is array-in, array-out.
  const rebuiltSet = new Set(restored.excludedMemoryPhotos);
  assert.equal(rebuiltSet.has("data:image/png;base64,BBB"), true);
  assert.equal(rebuiltSet.size, 1);
});

test("the empty-media case round-trips too (no photos yet, nothing excluded)", () => {
  draftService.saveDraft({
    contactId: "contact_456",
    occasionType: "anniversary",
    formData: { occasionType: "anniversary", contactId: "contact_456" },
    defaultPhoto: null,
    memoryPhotos: [],
    useMemoryPhotos: true,
    excludedMemoryPhotos: [],
    contactAlbumPhotosToAdd: [],
    status: "draft",
  });
  const restored = draftService.getDraft("contact_456", "anniversary");
  assert.equal(restored.defaultPhoto, null);
  assert.deepEqual(restored.memoryPhotos, []);
  assert.deepEqual(restored.excludedMemoryPhotos, []);
  assert.deepEqual(restored.contactAlbumPhotosToAdd, []);
});

test("a second save for the SAME contact+occasion overwrites the media fields, not just formData", () => {
  draftService.saveDraft(MEDIA_PAYLOAD);
  draftService.saveDraft({
    ...MEDIA_PAYLOAD,
    memoryPhotos: ["data:image/png;base64,NEW"],
    contactAlbumPhotosToAdd: [],
  });
  const restored = draftService.getDraft("contact_123", "birthday");
  assert.deepEqual(restored.memoryPhotos, ["data:image/png;base64,NEW"]);
  assert.deepEqual(restored.contactAlbumPhotosToAdd, [], "cleared album-pending photos must actually clear, not merge with the old array");
});

test("a draft for a different contact or occasion is never conflated with this one's media", () => {
  draftService.saveDraft(MEDIA_PAYLOAD);
  draftService.saveDraft({
    contactId: "contact_123",
    occasionType: "anniversary", // same contact, different occasion
    formData: { occasionType: "anniversary", contactId: "contact_123" },
    defaultPhoto: null,
    memoryPhotos: [],
    useMemoryPhotos: false,
    excludedMemoryPhotos: [],
    contactAlbumPhotosToAdd: [],
    status: "draft",
  });

  const birthday = draftService.getDraft("contact_123", "birthday");
  const anniversary = draftService.getDraft("contact_123", "anniversary");
  assert.deepEqual(birthday.memoryPhotos, MEDIA_PAYLOAD.memoryPhotos);
  assert.deepEqual(anniversary.memoryPhotos, []);
  assert.notEqual(birthday.id, anniversary.id);
});

test("getDraft for a contact+occasion that was never saved returns null, not an empty media object", () => {
  assert.equal(draftService.getDraft("nobody", "nothing"), null);
});

// ===========================================================================
// The failure path SendGreeting.jsx's new toast reacts to
// ===========================================================================

test("saveDraft throws when the underlying storage write fails, instead of silently dropping the media", () => {
  const originalSetItem = globalThis.localStorage.setItem;
  globalThis.localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  try {
    assert.throws(() => draftService.saveDraft(MEDIA_PAYLOAD), /Failed to save draft/);
  } finally {
    globalThis.localStorage.setItem = originalSetItem;
  }
});
