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

test("scheduler occasions are the Recipients page's list (minus the one-time Graduation and Get Well the scheduler never auto-sends), with its own identifiers", () => {
  assert.deepEqual(R.SCHEDULER_OCCASION_TYPES, {
    Birthday: "birthday", Anniversary: "anniversary", "New Year's Day": "new_year", "Valentine's Day": "valentines", "Mother's Day": "mothers_day",
    "Father's Day": "fathers_day", Thanksgiving: "thanksgiving", Christmas: "christmas", Easter: "easter", "Rosh Hashanah": "rosh_hashanah",
    Hanukkah: "hanukkah", Passover: "passover", "Eid al-Fitr": "eid_al_fitr", "Eid al-Adha": "eid_al_adha", Ramadan: "ramadan",
  });
  for (const l of ["Thank You", "Congratulations", "Just Because", "Season's Greetings", "Graduation", "Get Well", "Baby", "Wedding", "Sympathy", "Engagement"]) {
    assert.equal(R.isSchedulerOccasion(l), false, l);
  }
});

test("prefill dates exactly as the scheduler adds an occasion: fixed date, else the calculated date, else empty", () => {
  const now = new Date("2026-10-19T12:00:00Z");
  assert.equal(R.prefillRow({}, "New Year's Day", now).date, "2026-01-01");
  assert.equal(R.prefillRow({}, "Mother's Day", now).date, "2026-05-10", "2nd Sunday in May");
  assert.equal(R.prefillRow({}, "Thanksgiving", now).date, "2026-11-26", "4th Thursday in November");
  assert.equal(R.prefillRow({}, "Hanukkah", now).date, "", "the sender sets it, as in the scheduler");
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
  assert.deepEqual(R.chooseGift({ gift: null }, "qrcash"), { type: "qrcash", autoGift: false, amount: 25 },
    "QR Cash saves the $25 the scheduler displays by default, exactly like ContactForm");
  assert.equal(R.resolverGiftAmount({ type: "qrcash", autoGift: true, amount: 50 }), 50, "a saved amount is shown as saved");
  assert.equal(R.resolverGiftAmount({ type: "merch" }), null);
  assert.equal(R.resolverGiftAmount({ type: "qrcash", autoGift: false, amount: 0, customAmount: 40 }), 40, "a Custom amount shows its custom figure");
  assert.equal(R.resolverGiftAmount({ type: "qrcash", autoGift: false, amount: 0 }), null, "Custom with no figure shows none");
  assert.equal(R.resolverGiftAmount({ type: "qrcash", autoGift: false }), null, "an older record with no amount saves none, so none is shown");
  assert.equal(R.resolverGiftAmount({ type: "qrcash", autoGift: true }), 25, "an Auto-Gift record is saved with the displayed $25, so it shows $25");
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
  const S = (g, a) => R.resolverGiftStatus(g, a).label;
  assert.equal(S(null), "");
  assert.equal(S({ type: "none" }), "No gift");
  assert.equal(S({ type: "qrcash", autoGift: true }), "Auto-Gift on", "only QR Cash on Auto-Gift is automatic");
  assert.equal(S({ type: "qrcash", autoGift: false }), "Reminder only \u2014 confirmation required");
  assert.equal(S({ type: "curated", autoGift: true }), "Reminder only \u2014 confirmation required", "other types on Auto-Gift still get the reminder");
  assert.equal(S({ type: "merch", autoGift: false }), "Reminder only \u2014 confirmation required");
  assert.match(R.resolverGiftStatus({ type: "merch" }).detail, /remind you 10 days before.*nothing is charged automatically/);
  assert.match(R.resolverGiftStatus({ type: "qrcash", autoGift: true }).detail, /charged to your saved card/);
  assert.equal(S({ type: "qrcash", autoGift: true }, false), "Reminder only \u2014 confirmation required", "follows the scheduler's switch exactly like ContactForm");
  assert.equal(R.resolverGiftStatus({ type: "qrcash", autoGift: true }, false).detail, "QR Cash is sent when you send the Greet-Me. Scheduled QR Cash is not available yet.");
});

test("Auto-Gift detail follows the approved consent rule: with a backup, no contradictory 'unavailable … nothing is charged' sentence (founder 2026-10-21, S6-S7)", () => {
  const plain = R.resolverGiftStatus({ type: "gift_boxes", autoGift: true, scheduledGift: { name: "Cookie Box" } }, true, true);
  assert.match(plain.detail, /If it is unavailable or costs more, nothing is charged/);
  const withBackup = R.resolverGiftStatus({ type: "gift_boxes", autoGift: true, scheduledGift: { name: "Cookie Box", backup: { name: "Tea" } } }, true, true);
  assert.doesNotMatch(withBackup.detail, /If it is unavailable or costs more/);
  assert.match(withBackup.detail, /your backup is ordered instead, only within your limit/);
  assert.match(withBackup.detail, /neither gift can be ordered within your limit, nothing is charged and the greeting is sent without the gift\./);
});
