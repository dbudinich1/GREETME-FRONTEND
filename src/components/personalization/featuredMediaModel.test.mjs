// LANE 3 — pure model for the shared personalization controls.
// Run (Node 20.x): node --test src/components/personalization/featuredMediaModel.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MEDIA_MODES, MEDIA_CHOICES, controlsFor, emptySelection, setMode, setAsset, setMessage, validateSelection,
  hasFeaturedMedia, presentationFor, memoryPhotosForRecipient, introMessageFor, buildPreviewGreeting,
  activeAssets, MESSAGE_MAX, PRESENTATION_LAYOUTS, isDurableRef,
} from "./featuredMediaModel.js";
import { resolveScreenOrder, PERSONAL_SCREEN_ORDER } from "../GreetingCardProto/resolveScreenOrder.js";
import { senderLibraryPhotos } from "./libraryPhotos.js";

const photo = { url: "https://cdn.example/p.jpg", source: "upload" };
const voice = { url: "blob:voice", source: "recording" };
const video = { url: "blob:video", source: "upload" };
const sel = (mode, extra = {}) => ({ ...emptySelection(), mode, ...extra });

test("exactly four choices, in the founder's order and words", () => {
  assert.deepEqual(MEDIA_CHOICES.map((c) => c.value), ["animate", "static", "video", "none"]);
  assert.deepEqual(MEDIA_CHOICES.map((c) => c.label), ["Greet-Me Animation", "Still Photo", "Personal Video", "No featured media"]);
  // Founder copy 2026-10-29, verbatim (em dash in "speak\u2014or").
  assert.deepEqual(MEDIA_CHOICES.map((c) => c.note).slice(0, 3), ["Bring your photo to life with your voice.", "Let a meaningful image speak\u2014or add your voice.", "Share a greeting recorded your way."]);
  assert.deepEqual(MEDIA_CHOICES.filter((c) => c.quiet).map((c) => c.value), ["none"], "No featured media is the quieter option");
  for (const c of MEDIA_CHOICES) assert.ok(c.note.length > 0 && c.note.length <= 60, `short note for ${c.value}`);
});

test("each choice reveals only its own controls", () => {
  assert.deepEqual(controlsFor("animate"), [{ key: "photo", required: true }, { key: "voice", required: true }]);
  assert.deepEqual(controlsFor("static"), [{ key: "photo", required: true }, { key: "voice", required: false }]);
  assert.deepEqual(controlsFor("video"), [{ key: "video", required: true }]);
  assert.deepEqual(controlsFor("none"), []);
  assert.deepEqual(controlsFor("bogus"), [], "an unknown mode is No featured media");
});

test("validation: animate requires photo AND voice; static requires only the photo; video requires the video", () => {
  assert.deepEqual(validateSelection(sel("animate")).errors, ["photo_required", "voice_required"]);
  assert.deepEqual(validateSelection(sel("animate", { photo })).errors, ["voice_required"], "voice is required to animate");
  assert.equal(validateSelection(sel("animate", { photo, voice })).valid, true);
  assert.deepEqual(validateSelection(sel("static")).errors, ["photo_required"]);
  assert.equal(validateSelection(sel("static", { photo })).valid, true, "voice is optional over a static photo");
  assert.deepEqual(validateSelection(sel("video")).errors, ["video_required"]);
  assert.equal(validateSelection(sel("video", { video })).valid, true);
  assert.equal(validateSelection(sel("none")).valid, true);
});

test("the empty selection is No featured media: no default, nothing inherited", () => {
  const e = emptySelection();
  assert.equal(e.mode, MEDIA_MODES.NONE);
  assert.equal(e.photo, null); assert.equal(e.voice, null); assert.equal(e.video, null);
  assert.equal(hasFeaturedMedia(e), false);
});

test("switching choice keeps the draft's assets but only the current choice uses them", () => {
  let s = setAsset(setAsset(sel("animate"), "photo", photo), "voice", voice);
  s = setMode(s, "video");
  assert.equal(s.photo.url, photo.url, "kept in the draft");
  assert.deepEqual(activeAssets(s), { photo: null, voice: null, video: null }, "but not used by video");
  s = setMode(s, "animate");
  assert.equal(activeAssets(s).voice.url, voice.url);
});

test("message is capped at the composer's 280", () => {
  const s = setMessage(emptySelection(), "x".repeat(400));
  assert.equal(s.message.length, MESSAGE_MAX);
});

test("presentation rule 1: featured media + memory photos -> greeting first, then memories with music", () => {
  const p = presentationFor({ selection: sel("static", { photo }), memoryPhotos: ["m1", "m2"] });
  assert.equal(p.layout, PRESENTATION_LAYOUTS.MEDIA_THEN_MEMORIES);
  assert.equal(p.featuredPresent, true); assert.equal(p.music, true);
});

test("presentation rule 2: featured media alone -> full Featured Spread", () => {
  for (const s of [sel("animate", { photo, voice }), sel("static", { photo }), sel("video", { video })]) {
    const p = presentationFor({ selection: s, memoryPhotos: [] });
    assert.equal(p.layout, PRESENTATION_LAYOUTS.MEDIA_FULL, s.mode);
    assert.equal(p.music, false);
  }
});

test("presentation rule 3: memory photos alone -> full-spread photos with music", () => {
  const p = presentationFor({ selection: sel("none"), memoryPhotos: ["m1"] });
  assert.equal(p.layout, PRESENTATION_LAYOUTS.MEMORIES_FULL);
  assert.equal(p.music, true);
});

test("presentation rule 4: neither -> Featured Spread omitted, Intro and Final kept", () => {
  const p = presentationFor({ selection: sel("none"), memoryPhotos: [] });
  assert.equal(p.featuredPresent, false); assert.equal(p.layout, null);
  // An incomplete choice is not featured media either (animate without voice).
  assert.equal(presentationFor({ selection: sel("animate", { photo }), memoryPhotos: [] }).featuredPresent, false);
});

test("screen order follows the rules through the EXISTING resolveScreenOrder", () => {
  const order = (selection, memoryPhotos) => resolveScreenOrder(buildPreviewGreeting({ selection, memoryPhotos }));
  const FULL = ["envelope", "cover", "interior", "featured", "finale"];
  const NO_FEATURED = ["envelope", "cover", "interior", "finale"];
  assert.deepEqual(order(sel("video", { video }), ["m1"]), FULL);
  assert.deepEqual(order(sel("video", { video }), []), FULL);
  assert.deepEqual(order(sel("none"), ["m1"]), FULL);
  assert.deepEqual(order(sel("none"), []), NO_FEATURED);
  // Existing greetings (no personalization field) are untouched.
  assert.deepEqual(resolveScreenOrder({ recipientName: "A" }), PERSONAL_SCREEN_ORDER.slice());
  assert.deepEqual(resolveScreenOrder({ corporate: true, featuredSpreadPresent: false }), NO_FEATURED);
});

test("memory photos are the selected recipient's own, normalized and de-duplicated", () => {
  const ana = { id: "a", memoryPhotos: ["https://x/a1.jpg", { url: "https://x/a2.jpg" }, "https://x/a1.jpg", null] };
  const ben = { id: "b", memoryPhotos: ["https://x/b1.jpg"] };
  assert.deepEqual(memoryPhotosForRecipient(ana), ["https://x/a1.jpg", "https://x/a2.jpg"]);
  assert.deepEqual(memoryPhotosForRecipient(ben), ["https://x/b1.jpg"]);
  assert.deepEqual(memoryPhotosForRecipient(ana, { excluded: ["https://x/a2.jpg"] }), ["https://x/a1.jpg"]);
  assert.deepEqual(memoryPhotosForRecipient({ id: "c" }), []);
  const g = buildPreviewGreeting({ selection: sel("none"), recipient: ben });
  assert.deepEqual(g.photos, ["https://x/b1.jpg"]);
  assert.equal(g.photos.includes("https://x/a1.jpg"), false, "another recipient's photos never appear");
});

test("personal message: kept off the Intro page with animation, added after the greeting without it", () => {
  assert.equal(introMessageFor({ writtenIntroText: "Hello.", message: "Love, Al", mode: "animate" }), "Hello.");
  assert.equal(introMessageFor({ writtenIntroText: "Hello.", message: "Love, Al", mode: "static" }), "Hello.\n\nLove, Al");
  assert.equal(introMessageFor({ writtenIntroText: "Hello.", message: "  ", mode: "none" }), "Hello.");
  assert.equal(introMessageFor({ writtenIntroText: "", message: "Love", mode: "video" }), "Love");
});

test("the preview greeting addresses no real greeting and carries no gift", () => {
  const g = buildPreviewGreeting({ selection: sel("video", { video }), recipient: { id: "r", name: "Rae" } });
  assert.equal(g.jobId, null); assert.equal(g.hasGift, false); assert.equal(g.gift, null);
  assert.equal(g.preview, true); assert.equal(g.recipientName, "Rae");
  assert.equal(g.personalization.media.videoUrl, "blob:video");
  assert.equal(g.personalization.media.animationUrl, null, "a preview never requests an animation");
});

test("durable refs exclude local captures and signed URLs", () => {
  assert.equal(isDurableRef("https://acct.blob.core.windows.net/c/p.jpg"), true);
  assert.equal(isDurableRef("https://acct.blob.core.windows.net/c/p.jpg?sv=1&sig=abc"), false);
  assert.equal(isDurableRef("blob:http://x/1"), false);
  assert.equal(isDurableRef("data:image/png;base64,AA"), false);
});

test("the Media Library offers only the sender's own photos, never a recipient's", () => {
  const items = [
    { id: "1", url: "https://x/me.jpg", type: "photo", source: "user-default" },
    { id: "2", url: "https://x/ana.jpg", type: "photo", source: "recipient-memory" },
    { id: "3", url: "https://x/ava.jpg", type: "photo", source: "recipient-avatar" },
    { id: "4", url: "https://x/v.webm", type: "voice", source: "user-default" },
  ];
  assert.deepEqual(senderLibraryPhotos(items).map((p) => p.id), ["1"]);
  assert.equal(items.length, 4, "the library itself is not changed");
});
