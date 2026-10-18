// src/utils/occasionResolver.test.mjs
//
// The dashboard's inline date-and-gift resolver saves through the recipient's EXISTING Occasion Scheduler record
// (PUT /api/contacts/:id). That endpoint REPLACES the whole occasions array and blanks most absent fields, so the
// payload must carry the full record with only the resolver's occasions changed.
// Run (Node 20.x): node --test src/utils/occasionResolver.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { rmSync } from "node:fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, ".__occasionResolver.bundle.mjs");
await esbuild.build({
  entryPoints: [join(__dirname, "occasionResolver.js")], outfile: OUT, bundle: true, format: "esm", platform: "node",
  define: { "import.meta.env": "{}" }, logLevel: "silent",
});
const R = await import(pathToFileURL(OUT).href);
rmSync(OUT, { force: true });

const CONTACT = {
  id: "c1", userId: "u1", name: "Theresa Morgan", email: "t@example.com", firstName: "Theresa", lastName: "Morgan",
  gender: "female", relationshipCategory: "friend", relationship: "Friend", relationshipCloseness: "close",
  relationshipContext: "college", relationshipProfile: { v: 1 }, avatar: "a.jpg", memoryPhotos: ["m1.jpg"], coverPhoto: "",
  culturalContext: { heritage: ["x"], faith: null, preferCulturalGifts: false },
  giftPreferences: { enabled: true, budgetCap: "50", giftingMode: "always" },
  shippingAddress: { line1: "1 Main", city: "Town", state: "NJ", zip: "07000", country: "United States" },
  occasions: [
    { id: "o1", type: "birthday", date: "1990-05-03", autoSend: false },
    { id: "o2", type: "mothers_day", date: "2026-05-10", autoSend: true },
  ],
  occasionGiftSettings: {
    birthday: { type: "qrcash", autoGift: true, amount: 50 },
    mothers_day: { type: "curated", autoGift: false, maxSpend: 75 },
  },
};

test("only Birthday, Anniversary and Christmas are scheduler occasions; held and send-only occasions are not", () => {
  for (const l of ["Birthday", "Anniversary", "Christmas"]) assert.equal(R.isSchedulerOccasion(l), true, l);
  for (const l of ["Thank You", "Congratulations", "Just Because", "Baby", "Wedding", "Season's Greetings", "Hanukkah", "Sympathy", "Engagement"]) {
    assert.equal(R.isSchedulerOccasion(l), false, l);
  }
});

test("prefill: a saved occasion and gift are prefilled; an unsaved one starts without a gift choice", () => {
  const b = R.prefillRow(CONTACT, "Birthday");
  assert.deepEqual(b, { type: "birthday", date: "1990-05-03", gift: CONTACT.occasionGiftSettings.birthday, prefilled: true });
  const a = R.prefillRow(CONTACT, "Anniversary");
  assert.deepEqual(a, { type: "anniversary", date: "", gift: null, prefilled: false });
  assert.equal(R.rowComplete(a), false, "no date and no gift: incomplete");
});

test("prefill: Christmas without a saved date takes the scheduler's fixed date for the current year", () => {
  const x = R.prefillRow(CONTACT, "Christmas", new Date("2026-10-18T12:00:00Z"));
  assert.equal(x.date, "2026-12-25");
  assert.equal(x.gift, null);
});

test("a gift choice is explicit; re-choosing the saved type keeps the saved setting byte-identical", () => {
  const b = R.prefillRow(CONTACT, "Birthday");
  assert.equal(R.chooseGift(b, "qrcash"), CONTACT.occasionGiftSettings.birthday, "same object: amount/autoGift untouched");
  assert.deepEqual(R.chooseGift(b, "none"), { type: "none", autoGift: false });
  assert.deepEqual(R.chooseGift({ gift: null }, "merch"), { type: "merch", autoGift: false });
  assert.equal(R.rowComplete({ date: "2026-12-25", gift: { type: "none", autoGift: false } }), true, "'No gift' is a complete choice");
  assert.equal(R.rowComplete({ date: "2026-12-25", gift: null }), false, "a date alone is not complete");
});

test("save payload: the FULL record, every other occasion and gift setting unchanged, address preserved", () => {
  const rows = [
    { type: "birthday", date: "1990-05-03", gift: CONTACT.occasionGiftSettings.birthday },
    { type: "anniversary", date: "2026-06-20", gift: { type: "none", autoGift: false } },
  ];
  const body = R.buildResolverContact(CONTACT, rows);
  for (const k of ["name", "email", "firstName", "lastName", "gender", "relationshipCategory", "relationship", "relationshipCloseness",
    "relationshipContext", "relationshipProfile", "avatar", "memoryPhotos", "culturalContext", "giftPreferences", "shippingAddress"]) {
    assert.deepEqual(body[k], CONTACT[k], `${k} carried unchanged`);
  }
  assert.equal(body.occasions.length, 3, "the existing two plus the new one: nothing dropped");
  assert.deepEqual(body.occasions.find((o) => o.type === "mothers_day"), CONTACT.occasions[1], "an untouched occasion is byte-identical");
  assert.deepEqual(body.occasions.find((o) => o.type === "birthday"), { id: "o1", type: "birthday", date: "1990-05-03", autoSend: true },
    "an existing occasion keeps its id and is (re)enabled for auto-send");
  assert.deepEqual(body.occasions.find((o) => o.type === "anniversary"), { type: "anniversary", date: "2026-06-20", autoSend: true });
  assert.deepEqual(body.occasionGiftSettings.mothers_day, CONTACT.occasionGiftSettings.mothers_day, "untouched gift setting unchanged");
  assert.deepEqual(body.occasionGiftSettings.anniversary, { type: "none", autoGift: false });
  assert.equal(body.occasionGiftSettings.birthday, CONTACT.occasionGiftSettings.birthday);
  assert.equal("userId" in body || "id" in body, false, "server-owned fields are not sent");
  assert.notEqual(body.occasions, CONTACT.occasions, "the contact's own array is not mutated");
  assert.equal(CONTACT.occasions[0].autoSend, false, "the source record is untouched");
});

test("finalize: gift settings normalised exactly like ContactForm's commitSave; consents attached only when present", () => {
  const toSave = R.buildResolverContact(CONTACT, [{ type: "christmas", date: "2026-12-25", gift: { type: "qrcash", autoGift: true } }]);
  const out = R.finalizeResolverSave(toSave);
  assert.equal(out.occasionGiftSettings.christmas.amount, 25, "an Auto-Gift QR Cash entry is never saved without the amount the scheduler shows");
  assert.equal("occasionGiftConsents" in out, false);
  const withC = R.finalizeResolverSave(toSave, [{ occasionType: "christmas", accepted: true }]);
  assert.deepEqual(withC.occasionGiftConsents, [{ occasionType: "christmas", accepted: true }]);
});

test("gift wording is the scheduler's own", () => {
  assert.equal(R.resolverGiftLine(null), "");
  assert.equal(R.resolverGiftLine({ type: "none" }), "The greeting is scheduled with no gift.");
  assert.equal(R.resolverGiftLine({ type: "merch", autoGift: false }), "You’ll receive a reminder 10 days before to confirm.");
  assert.equal(R.resolverGiftLine({ type: "qrcash", autoGift: true }), "Gift will be sent automatically on the occasion date.");
  assert.equal(R.resolverGiftLine({ type: "curated", autoGift: true }), "We’ll remind you 10 days before so you can confirm your gift.");
});
