// src/components/GreetingCardProto/corporateDelivery.test.mjs
//
// TEAM C — Phase A5 frontend unit tests (pure logic; components are lint-checked separately).
// Run: node --test src/components/GreetingCardProto/corporateDelivery.test.mjs

import { test } from "node:test";
import assert from "node:assert/strict";

import { buildCorporateViewerFacts, assetUrlFor } from "./corporateDelivery.js";
import { resolveScreenOrder, dotScreens, PERSONAL_SCREEN_ORDER } from "./resolveScreenOrder.js";

const JOB = "job-uuid-123";
const API = "https://api.example";

// Projection factory mirroring publicGreetingCorporateView output.
function projection({ mode = "featured", messageSource = "animation", imageKeys = [], hasAnimation = false } = {}) {
  const featured = mode === "featured";
  return {
    corporate: true,
    featuredSpreadPresent: featured,
    presentationMode: mode,
    messageSource: featured ? messageSource : "none",
    screenOrder: featured
      ? ["envelope", "cover", "interior", "featured", "finale"]
      : ["envelope", "cover", "interior", "finale"],
    imageKeys: featured ? imageKeys : [],
    hasAnimation: featured ? hasAnimation : false,
  };
}
const facts = (o) => buildCorporateViewerFacts(projection(o), { jobId: JOB, apiBase: API });

// 16. Personal greeting: no corporate facts; screen order unchanged.
test("16. personal greeting → null facts + unchanged 5-screen order", () => {
  assert.equal(buildCorporateViewerFacts(undefined, { jobId: JOB }), null);
  assert.equal(buildCorporateViewerFacts({ corporate: false }, { jobId: JOB }), null);
  const personal = resolveScreenOrder({ recipientName: "Sam" });
  assert.deepEqual(personal, [...PERSONAL_SCREEN_ORDER]);
  assert.equal(personal.length, 5);
  assert.equal(dotScreens(personal).length, 4);
});

// Four rendering combinations.
test("C1. animation only", () => {
  const f = facts({ messageSource: "animation", imageKeys: [], hasAnimation: true });
  assert.equal(f.showAnimation, true);
  assert.equal(f.showImages, false);
  assert.deepEqual(f.imageUrls, []);
  assert.equal(f.animationUrl, assetUrlFor(JOB, "animation", API));
});

test("C2. images only", () => {
  const f = facts({ messageSource: "images", imageKeys: ["img-0"], hasAnimation: false });
  assert.equal(f.showAnimation, false);
  assert.equal(f.showImages, true);
  assert.equal(f.animationUrl, null);
  assert.deepEqual(f.imageUrls, [assetUrlFor(JOB, "img-0", API)]);
});

test("C3. animation + images", () => {
  const f = facts({ messageSource: "animation", imageKeys: ["img-0", "img-1"], hasAnimation: true });
  assert.equal(f.showAnimation, true);
  assert.equal(f.showImages, true);
  assert.equal(f.imageUrls.length, 2);
  assert.ok(f.animationUrl.endsWith("/assets/animation"));
  assert.ok(f.imageUrls[1].endsWith("/assets/img-1"));
});

// The corporate animation URL points ONLY at the scoped resolver — never a raw video URL.
test("animation source is the resolver, never a raw videoUrl", () => {
  const f = facts({ messageSource: "animation", imageKeys: [], hasAnimation: true });
  assert.ok(f.animationUrl.startsWith(`${API}/api/public/greetings/${JOB}/assets/animation`));
  assert.ok(!/d-id|\.mp4\?/.test(f.animationUrl));
  // If the server reports no animation artifact, we never fabricate one.
  const none = facts({ messageSource: "animation", imageKeys: [], hasAnimation: false });
  assert.equal(none.showAnimation, false);
  assert.equal(none.animationUrl, null);
});

// 17. Intro-and-Finale-Only when all Featured Spread elements disabled.
test("17. intro-and-finale-only: featured omitted, no images/animation", () => {
  const f = buildCorporateViewerFacts(projection({ mode: "intro_finale_only" }), { jobId: JOB, apiBase: API });
  assert.equal(f.featuredSpreadPresent, false);
  assert.equal(f.showAnimation, false);
  assert.equal(f.showImages, false);
  assert.equal(f.animationUrl, null);
  assert.deepEqual(f.imageUrls, []);
  const order = resolveScreenOrder({ corporate: true, featuredSpreadPresent: false });
  assert.deepEqual(order, ["envelope", "cover", "interior", "finale"]);
  assert.equal(order.length, 4);
  assert.equal(dotScreens(order).length, 3);
  assert.ok(!order.includes("featured"));
});

// Screen/dot parity: corporate WITH featured keeps 5 screens / 4 dots, envelope excluded.
test("Screen/dot: corporate-with-featured = 5 screens / 4 dots", () => {
  const order = resolveScreenOrder({ corporate: true, featuredSpreadPresent: true });
  assert.equal(order.length, 5);
  assert.ok(order.includes("featured"));
  const dots = dotScreens(order);
  assert.equal(dots.length, 4);
  assert.ok(!dots.includes("envelope"));
  assert.equal(order[order.length - 1], "finale");
});

// Asset URLs point ONLY at the scoped resolver endpoint.
test("asset URLs target the scoped resolver", () => {
  const f = facts({ messageSource: "images", imageKeys: ["img-0", "img-1"] });
  for (const u of f.imageUrls) {
    assert.ok(u.startsWith(`${API}/api/public/greetings/${JOB}/assets/img-`), u);
  }
});

// Corporate Video is never a rendering source.
test("corporate video never a source", () => {
  const f = facts({ messageSource: "animation", imageKeys: ["img-0"], hasAnimation: true });
  assert.ok(!("corporateVideoUrl" in f));
  assert.deepEqual(Object.keys(f).sort(), ["animationUrl", "corporate", "featuredSpreadPresent", "imageUrls", "messageSource", "presentationMode", "screenOrder", "showAnimation", "showImages"]);
});