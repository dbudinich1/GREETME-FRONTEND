// src/utils/sendGreetingPayload.test.mjs
//
// G5 — the send flow's greeting payload, built in one place and used by both the send page and group sending.
// Run (Node 20.x): node --test src/utils/sendGreetingPayload.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, ".__sendGreetingPayload.bundle.mjs");
await esbuild.build({ entryPoints: [join(__dirname, "sendGreetingPayload.js")], outfile: OUT, bundle: true, format: "esm", platform: "node", logLevel: "silent" });
const P = await import(pathToFileURL(OUT).href);
rmSync(OUT, { force: true });

const USER = { id: "u1", email: "a@x.com", voiceId: "v1", photoUrl: "me.jpg" };
const CONTACT = { id: "c1", name: "Theresa Morgan", email: "t@x.com", relationship: "Friend", relationshipContext: "college",
  memoryPhotos: ["m1.jpg", { url: "m2.jpg" }, "m3.jpg"] };
const base = (over = {}) => P.buildGreetingPayload({ user: USER, contact: CONTACT, formData: { occasionType: "Birthday", customMessage: "Happy day", tone: "warm" }, maxPhotos: 8, ...over });

test("the recipient, sender, occasion and words fields", () => {
  const p = base();
  assert.equal(p.userId, "u1"); assert.equal(p.recipientName, "Theresa Morgan"); assert.equal(p.recipientEmail, "t@x.com");
  assert.equal(p.voiceId, "v1"); assert.equal(p.photoUrl, "me.jpg"); assert.equal(p.contactId, "c1");
  assert.equal(p.occasionType, "Birthday"); assert.equal(p.occasionKey, "birthday");
  assert.equal(p.personalSentiment, "Happy day"); assert.equal(p.greetingText, "Happy day");
  assert.equal(p.relationshipKey, "Friend"); assert.equal(p.relationshipNote, "college");
  assert.deepEqual(p.layoutBudget, { introMaxChars: 280 });
  assert.equal(p.includeGift, false, "no gift selection: no gift promised");
});

test("occasion keys: Recipients-list occasions use the scheduler identifier; Season's Greetings is 'holiday'; others normalise as before", () => {
  assert.equal(base({ formData: { occasionType: "Mother's Day" } }).occasionKey, "mothers_day");
  assert.equal(base({ formData: { occasionType: "Easter" } }).occasionKey, "easter");
  assert.equal(base({ formData: { occasionType: "Season's Greetings" } }).occasionKey, "holiday");
  assert.equal(base({ formData: { occasionType: "Thank You" } }).occasionKey, "thankyou");
});

test("photos: this occasion's photos first, then the recipient's own (minus deselected), de-duplicated, capped", () => {
  const p = base({ memoryPhotos: ["new.jpg", "m1.jpg"], excludedMemoryPhotos: new Set(["m3.jpg"]) });
  assert.deepEqual(p.photos, ["new.jpg", "m1.jpg", "m2.jpg"]);
  assert.deepEqual(base({ useMemoryPhotos: false }).photos, []);
  assert.equal(base({ memoryPhotos: Array.from({ length: 12 }, (_, i) => `n${i}`) }).photos.length, 8);
});

test("gift flag: a validated gift is promised only for gifts the backend can attach; curated carries only its tier", () => {
  assert.equal(base({ giftSettings: { type: "qrcash" } }).includeGift, true);
  assert.equal(base({ giftSettings: { type: "flowers" } }).includeGift, false);
  assert.equal(base({ giftSettings: { type: "gift_boxes" } }).includeGift, false);
  const c = base({ giftSettings: { type: "curated", maxSpend: 50 } });
  assert.deepEqual(c.gift, { type: "curated", maxSpendCents: 5000 });
});

test("a charged QR Cash order attaches the same gift object the send page attaches", () => {
  assert.deepEqual(P.qrCashGiftForPayload(25, { feeCents: 274, totalCents: 2774, claimToken: "ct", qrImageUrl: "q", qrBlobUrl: "b", claimUrl: "u" }),
    { type: "qrcash", amount: 25, feeAmount: 2.74, totalAmount: 27.74, status: "charged", claimToken: "ct", qrUrl: "q", qrBlobUrl: "b", claimUrl: "u" });
});
