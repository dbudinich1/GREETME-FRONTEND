// src/utils/scheduledQrCashLegacyConsent.test.mjs
//
// LIVE-3 (Team 6, 2026-10-29): the save plan asks for consent for an UNCHANGED Auto-Gift QR Cash setting that has no stored
// consent covering its amount, when the caller passes the record's stored consents. A caller that does not pass them is planned
// exactly as before, and the group save (occasionResolver.saveGroupSchedules) still routes any consent need to the person's
// Occasion Scheduler rather than saving it. Run (Node 20): node --test src/utils/scheduledQrCashLegacyConsent.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { planAuthorization, consentCovers, SCHED_QRCASH_WORDING_VERSION } from "./scheduledQrCashConsent.js";
import esbuild from "esbuild";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, join } from "node:path";
import { rmSync } from "node:fs";

// occasionResolver.js imports extension-less modules, so it is bundled first (as occasionResolver.test.mjs does).
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, `.__live3Resolver.${process.pid}.bundle.mjs`);
await esbuild.build({ entryPoints: [join(__dirname, "occasionResolver.js")], outfile: OUT, bundle: true, format: "esm", platform: "node", define: { "import.meta.env": "{}" }, logLevel: "silent" });
const { saveGroupSchedules } = await import(pathToFileURL(OUT).href);
rmSync(OUT, { force: true });

const LEGACY = { birthday: { type: "qrcash", amount: 25, autoGift: true } };
const CARD = { present: true, expired: false, expMonth: 12, expYear: 2099 };
const OCC = [{ type: "birthday", date: "2026-11-14" }];
const snap = (amountCents, wordingVersion = SCHED_QRCASH_WORDING_VERSION) => ({ occasionType: "birthday", amountCents, wordingVersion, acceptedAt: "2026-10-01T00:00:00.000Z" });
const plan = (over) => planAuthorization({ settings: LEGACY, initialSettings: LEGACY, occasions: OCC, card: CARD, formData: {}, labelFor: (k) => k, requiresDelivery: () => false, ...over });

test("consentCovers: the stored snapshot, this build's wording, at least this amount; anything else is no consent", () => {
  assert.equal(consentCovers(snap(2500), 2500), true);
  assert.equal(consentCovers(snap(3000), 2500), true, "a lowered amount stays within what was agreed (the server shrinks the snapshot)");
  assert.equal(consentCovers(snap(2000), 2500), false);
  assert.equal(consentCovers(snap(2500, "w07-sched-qrcash-v0"), 2500), false);
  assert.equal(consentCovers({ amountCents: "2500", wordingVersion: SCHED_QRCASH_WORDING_VERSION }, 2500), false);
  for (const v of [undefined, null, [], "yes", true, {}]) assert.equal(consentCovers(v, 2500), false);
});

test("the Report 147 reproduction, fixed: an unchanged legacy entry with NO stored consent and a usable card now needs consent", () => {
  const p = plan({ storedQrCashConsents: {} });
  assert.equal(p.need.consent, true);
  assert.equal(p.need.card, false);
  assert.deepEqual(p.items, [{ key: "birthday", label: "birthday", date: "2026-11-14", dateLabel: "November 14", amountCents: 2500 }]);
});

test("an unchanged entry whose stored consent covers it needs nothing; one that does not cover it needs consent", () => {
  assert.equal(plan({ storedQrCashConsents: { birthday: snap(2500) } }).need.consent, false);
  assert.equal(plan({ storedQrCashConsents: { birthday: snap(2000) } }).need.consent, true);
  assert.equal(plan({ storedQrCashConsents: { christmas: snap(2500) } }).need.consent, true, "another occasion's consent is not this one's");
  assert.equal(plan({ storedQrCashConsents: null }).need.consent, true, "null from a caller that read the record: no consent");
});

test("a caller that does not pass stored consents is planned exactly as before (Report 147: need.consent false; amount change true)", () => {
  assert.deepEqual(plan({}).need, { card: false, consent: false, scheduledGiftConsent: false, address: false });
  assert.equal(plan({ settings: { birthday: { ...LEGACY.birthday, amount: 30 } } }).need.consent, true);
});

test("Auto-Gift off, a manual QR Cash or a non-QR-Cash gift never asks for a QR Cash consent, stored consents or not", () => {
  for (const settings of [{ birthday: { type: "qrcash", amount: 25, autoGift: false } }, { birthday: { type: "curated", amount: 40, autoGift: false } }]) {
    assert.equal(plan({ settings, initialSettings: settings, storedQrCashConsents: {} }).need.consent, false);
  }
});

test("only unconsented occasions get a block; a consented one beside it stays silent", () => {
  const settings = { birthday: LEGACY.birthday, christmas: { type: "qrcash", amount: 50, autoGift: true } };
  const p = planAuthorization({ settings, initialSettings: settings, occasions: [...OCC, { type: "christmas", date: "2026-12-25" }], card: CARD, formData: {}, labelFor: (k) => k, requiresDelivery: () => false,
    storedQrCashConsents: { christmas: { amountCents: 5000, wordingVersion: SCHED_QRCASH_WORDING_VERSION } } });
  assert.deepEqual(p.items.map((i) => i.key), ["birthday"]);
});

test("the other caller (saveGroupSchedules): a plan that needs consent is NOT saved there - routed to the person's Occasion Scheduler", async () => {
  const person = { id: "p1", name: "Avery", email: "a@x.test", occasions: [{ type: "birthday", date: "2026-11-14" }], occasionGiftSettings: LEGACY, scheduledQrCashConsents: {} };
  const puts = [];
  const api = { updateContact: async (id, body) => { puts.push({ id, body }); return { ok: true }; } };
  const rowFor = () => ({ type: "birthday", date: "2026-11-14", gift: { type: "qrcash", amount: 25, autoGift: true } });
  const planWith = (stored) => async (p, toSave) => planAuthorization({ settings: toSave.occasionGiftSettings, initialSettings: p.occasionGiftSettings, occasions: toSave.occasions, card: CARD, formData: toSave,
    labelFor: (k) => k, requiresDelivery: () => false, ...(stored ? { storedQrCashConsents: p.scheduledQrCashConsents || {} } : {}) }).need;
  const withConsents = await saveGroupSchedules({ people: [person], rowFor, api, sanitize: (x) => x, plan: planWith(true) });
  assert.equal(withConsents[0].status, "needs_scheduler");
  assert.equal(withConsents[0].need.consent, true);
  assert.equal(puts.length, 0, "nothing is saved and nothing is consented in the group save");
  // Today's Dashboard caller does not pass stored consents: unchanged result for it.
  const today = await saveGroupSchedules({ people: [person], rowFor, api, sanitize: (x) => x, plan: planWith(false) });
  assert.equal(today[0].status, "saved");
  assert.ok(!("occasionGiftConsents" in puts[0].body), "no consent is ever sent from the group save");
});
