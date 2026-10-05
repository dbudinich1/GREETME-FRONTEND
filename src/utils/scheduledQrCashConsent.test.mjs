// src/utils/scheduledQrCashConsent.test.mjs - the pure W07 authorization rules and their agreement with Team 3's backend.
// Run (Node 20): node --test src/utils/scheduledQrCashConsent.test.mjs
// The contract tests run the REAL backend module (services/scheduledQrCashConsent.js) in a child process. TEAM3_BE_DIR pins the
// backend worktree (default C:\1_GREET-ME\cs-be-w07consent, branch sprint/closeout-t3-w07-consent). If it is missing the contract
// tests are SKIPPED with a printed message (never a silent pass); the backend HEAD used is printed.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import {
  SCHED_QRCASH_WORDING_VERSION, CONSENT_TICK_LABEL, PAYMENT_INFO_TEXT, monthDay, DATE_FALLBACK, effectiveQrCashDollars, consentParagraphs,
  cardStateFor, addressMissing, planAuthorization, buildConsentPayload,
} from "./scheduledQrCashConsent.js";
import { qrCashQuote, centsToDollarString } from "./qrCashAmount.js";

const LABELS = { birthday: "Birthday", anniversary: "Anniversary", christmas: "Christmas", easter: "Easter" };
const labelFor = (k) => LABELS[k];
const requiresDelivery = (t) => ["curated", "flowers", "gift_boxes"].includes(t);
const OCC = [{ type: "birthday", date: "2026-11-14" }, { type: "anniversary", date: "2027-06-10" }, { type: "christmas", date: "2026-12-25" }, { type: "easter", date: "2027-03-28" }];
const GOOD = { present: true, expired: false, expMonth: 12, expYear: 2099 };
const plan = (over) => planAuthorization({ settings: {}, initialSettings: {}, occasions: OCC, card: GOOD, formData: { firstName: "A", shippingAddress: { line1: "1", city: "c", state: "s", zip: "z" } }, labelFor, requiresDelivery, ...over });
const qr = (amount, autoGift = true) => ({ type: "qrcash", amount, autoGift });

test("the version, tick label and info-triangle text are the approved ones", () => {
  assert.equal(SCHED_QRCASH_WORDING_VERSION, "w07-sched-qrcash-v1");
  assert.equal(CONSENT_TICK_LABEL, "I agree");
  assert.equal(PAYMENT_INFO_TEXT, "Auto-Gift requires a valid form of payment on file. You will be prompted when you click Save.");
});

test("dates and amounts are read the way the server reads them", () => {
  assert.equal(monthDay("2026-12-25"), "December 25");
  assert.equal(monthDay("2027-06-10T00:00:00Z"), "June 10");
  assert.equal(monthDay(""), null); assert.equal(monthDay("garbage"), null); assert.equal(monthDay("2026-13-01"), null);
  assert.equal(effectiveQrCashDollars({ amount: 50 }), 50);
  assert.equal(effectiveQrCashDollars({ amount: 0, customAmount: 35 }), 35);
  assert.equal(effectiveQrCashDollars({}), null); assert.equal(effectiveQrCashDollars({ amount: "x" }), null);
});

test("planAuthorization: unchanged occasions with a good card ask for nothing; Auto-Gift-off and shipped gifts never get a block", () => {
  const settings = { birthday: qr(25), christmas: qr(50), anniversary: qr(25, false), easter: { type: "curated", amount: 40, autoGift: true } };
  const p = plan({ settings, initialSettings: settings });
  assert.deepEqual(p.items, []);
  assert.deepEqual(p.need, { card: false, consent: false, address: false });
});

test("planAuthorization: ONE item per changed or newly enabled QR Cash Auto-Gift occasion, for 1, 2, 3 and 4+ occasions", () => {
  const init = { birthday: qr(25), christmas: qr(50), anniversary: qr(25, false), easter: qr(10, false) };
  const one = plan({ settings: { ...init, christmas: qr(100) }, initialSettings: init });
  assert.deepEqual(one.items.map((i) => i.key), ["christmas"]);
  assert.deepEqual(one.items[0], { key: "christmas", label: "Christmas", date: "2026-12-25", dateLabel: "December 25", amountCents: 10000 });
  const two = plan({ settings: { ...init, birthday: qr(50), anniversary: qr(25, true) }, initialSettings: init });
  assert.deepEqual(two.items.map((i) => i.key).sort(), ["anniversary", "birthday"]);
  const four = plan({ settings: { birthday: qr(50), christmas: qr(75), anniversary: qr(25, true), easter: qr(10, true) }, initialSettings: init });
  assert.equal(four.items.length, 4);
  assert.deepEqual(four.items.map((i) => i.amountCents).sort((a, b) => a - b), [1000, 2500, 5000, 7500]);
  assert.equal(four.items.find((i) => i.key === "easter").dateLabel, "March 28");
});

test("planAuthorization: with no usable card EVERY QR Cash Auto-Gift occasion gets a block and a card is needed", () => {
  const settings = { birthday: qr(25), christmas: qr(50), anniversary: qr(25, false) };
  for (const card of [null, { present: false }, { present: true, expired: true, expMonth: 1, expYear: 2020 }]) {
    const p = plan({ settings, initialSettings: settings, card });
    assert.deepEqual(p.items.map((i) => i.key).sort(), ["birthday", "christmas"]);
    assert.deepEqual(p.need, { card: true, consent: true, address: false });
  }
  const before = plan({ settings, initialSettings: settings, card: { present: true, expired: false, expMonth: 11, expYear: 2026 } });
  assert.equal(before.cardState, "expires-before", "a card expiring before an occasion date is not usable");
  assert.equal(before.need.card, true);
});

test("planAuthorization: a shipped gift never creates a consent item; it only creates the address need, once", () => {
  const settings = { easter: { type: "curated", amount: 40, autoGift: true }, birthday: qr(25, false) };
  const p = plan({ settings, initialSettings: settings, formData: {} });
  assert.deepEqual(p.items, []);
  assert.deepEqual(p.need, { card: false, consent: false, address: true });
  assert.equal(addressMissing({ firstName: "A", shippingAddress: { line1: "1", city: "c", state: "s", zip: "z" } }, settings, requiresDelivery), false);
  assert.equal(addressMissing({}, { birthday: qr(25) }, requiresDelivery), false, "no shipped gift: no address needed");
});

test("cardStateFor", () => {
  assert.equal(cardStateFor(null, ["2026-12-25"]), "none");
  assert.equal(cardStateFor({ present: false }, []), "none");
  assert.equal(cardStateFor({ present: true, expired: true }, []), "expired");
  assert.equal(cardStateFor(GOOD, ["2026-12-25"]), "ok");
  assert.equal(cardStateFor({ present: true, expired: false, expMonth: 12, expYear: 2026 }, ["2026-12-25"]), "ok", "valid through the end of December");
  assert.equal(cardStateFor({ present: true, expired: false, expMonth: 11, expYear: 2026 }, ["2026-12-25"]), "expires-before");
});

test("the consent text is the founder-approved wording, QR Cash only, with the fee and total stated plainly", () => {
  const p = consentParagraphs({ amountCents: 5000, label: "Christmas", dateLabel: "December 25" });
  assert.equal(p.length, 4);
  assert.equal(p[0], "I authorize Greet-Me to charge my card $53.49 on December 25 for Christmas: my $50.00 QR Cash gift plus a $3.49 fee. $53.49 is the most I will ever be charged for this gift.");
  assert.equal(p[1], "This repeats every year on December 25 until I stop it. Nothing is charged before that day. If I change the amount, I will be asked again.");
  assert.equal(p[2], "I can stop it any time before December 25 by turning Auto-Gift off for Christmas or removing it.");
  assert.equal(p[3], "If my card can't be charged, my Greet-Me still sends on time, the gift does not, and I'll be told by email.");
  assert.doesNotMatch(p.join(" "), /reward/i);
  assert.match(consentParagraphs({ amountCents: 2500, label: "X", dateLabel: DATE_FALLBACK })[0], /on the occasion date for X/);
});

test("occasionGiftConsents entries have exactly the backend contract's fields, one per item, QR Cash only", () => {
  const items = plan({ settings: { birthday: qr(25), christmas: qr(50) }, initialSettings: {}, card: null }).items;
  const out = buildConsentPayload(items);
  assert.equal(out.length, 2);
  for (const e of out) {
    assert.deepEqual(Object.keys(e).sort(), ["accepted", "amountCents", "giftType", "occasionDate", "occasionType", "recurrence", "wordingVersion"]);
    assert.equal(e.giftType, "qrcash"); assert.equal(e.recurrence, "yearly"); assert.equal(e.accepted, true); assert.equal(e.wordingVersion, "w07-sched-qrcash-v1");
    assert.ok(Number.isSafeInteger(e.amountCents)); assert.match(e.occasionDate, /^\d{4}-\d{2}-\d{2}$/);
  }
  assert.deepEqual(buildConsentPayload([{ key: "birthday", date: "", amountCents: 2500 }])[0].occasionDate, undefined, "no date: the optional field is omitted");
});

// ------------------------------------------------------------------------------------------------ the real backend
const BE = process.env.TEAM3_BE_DIR || "C:/1_GREET-ME/cs-be-w07consent";
const beModule = path.join(BE, "services", "scheduledQrCashConsent.js");
const skip = fs.existsSync(beModule) ? false : `Team 3 consent backend not found at ${BE}`;
if (skip) console.warn(`SKIPPED scheduledQrCashConsent contract tests: ${skip}. Set TEAM3_BE_DIR to a worktree of sprint/closeout-t3-w07-consent.`);
else {
  const head = spawnSync("git", ["-C", BE, "rev-parse", "HEAD"], { encoding: "utf8" }).stdout.trim();
  console.log(`scheduledQrCashConsent contract validated against backend ${BE} @ ${head || "unknown"}`);
}
function backend(job) {
  const script = `
    const m = await import(${JSON.stringify(pathToFileURL(beModule).href)});
    const job = JSON.parse(process.env.JOB);
    let out;
    if (job.op === "wording") out = m.getScheduledQrCashConsentWording(job.version);
    else {
      try { out = { ok: true, snapshots: m.reconcileScheduledQrCashConsents({ ...job.args, now: () => 1760000000000, enforce: true, ip: "203.0.113.9" }) }; }
      catch (e) { out = { ok: false, reason: e.reason, occasionType: e.occasionType, name: e.name }; }
    }
    process.stdout.write("\\n@@" + JSON.stringify(out) + "@@\\n");
    process.exit(0);`;
  const r = spawnSync(process.execPath, ["--input-type=module", "-e", script], { encoding: "utf8", env: { ...process.env, JOB: JSON.stringify(job) } });
  const m = /@@(.*)@@/s.exec(r.stdout || "");
  if (!m) throw new Error(`backend probe failed:\n${r.stdout}\n${r.stderr}`);
  return JSON.parse(m[1]);
}
const t = (name, fn) => test(name, { skip }, fn);

t("the UI wording equals the backend's held text for w07-sched-qrcash-v1 (placeholders filled), and the version and tick label agree", () => {
  const w = backend({ op: "wording", version: SCHED_QRCASH_WORDING_VERSION });
  assert.ok(w, "the backend knows the version");
  assert.equal(w.checkboxLabel, CONSENT_TICK_LABEL);
  for (const [amountCents, label, dateLabel] of [[5000, "Christmas", "December 25"], [2500, "Birthday", "November 14"], [10000, "Anniversary", "June 10"]]) {
    const q = qrCashQuote(amountCents / 100);
    const fill = (s) => s.replaceAll("{total}", centsToDollarString(q.totalCents)).replaceAll("{amount}", centsToDollarString(q.amountCents)).replaceAll("{fee}", centsToDollarString(q.feeCents)).replaceAll("{date}", dateLabel).replaceAll("{occasion}", label);
    assert.deepEqual(consentParagraphs({ amountCents, label, dateLabel }), w.full.map(fill));
  }
});

t("the payload the form builds is accepted by the real backend for 1, 2 and 4 occasions and snapshots each occasion at its own maximum", () => {
  for (const n of [1, 2, 4]) {
    const keys = ["birthday", "anniversary", "christmas", "easter"].slice(0, n);
    const amounts = { birthday: 25, anniversary: 75, christmas: 50, easter: 10 };
    const settings = Object.fromEntries(keys.map((k) => [k, qr(amounts[k])]));
    const items = planAuthorization({ settings, initialSettings: {}, occasions: OCC, card: null, formData: {}, labelFor, requiresDelivery }).items;
    const res = backend({ op: "reconcile", args: { settings, existingSettings: {}, existingConsents: {}, payloadConsents: buildConsentPayload(items), contactId: "c1" } });
    assert.equal(res.ok, true, JSON.stringify(res));
    assert.deepEqual(Object.keys(res.snapshots).sort(), [...keys].sort());
    for (const k of keys) {
      const q = qrCashQuote(amounts[k]);
      assert.equal(res.snapshots[k].maxTotalCents, q.totalCents, `${k}: the server's maximum is the total the sender saw`);
      assert.equal(res.snapshots[k].amountCents, q.amountCents);
      assert.equal(res.snapshots[k].wordingVersion, "w07-sched-qrcash-v1");
      assert.equal(res.snapshots[k].occasionDate, OCC.find((o) => o.type === k).date);
    }
  }
});

t("the server refuses what the form must never send: a changed occasion with no consent, and a consent for a shipped gift", () => {
  const settings = { christmas: qr(100) };
  const none = backend({ op: "reconcile", args: { settings, existingSettings: { christmas: qr(50) }, existingConsents: {}, payloadConsents: [], contactId: "c1" } });
  assert.deepEqual([none.ok, none.reason], [false, "consent_required"]);
  const shipped = backend({ op: "reconcile", args: { settings: { easter: { type: "curated", amount: 40, autoGift: true } }, existingSettings: {}, existingConsents: {}, payloadConsents: [{ occasionType: "easter", giftType: "curated", amountCents: 4000, recurrence: "yearly", wordingVersion: "w07-sched-qrcash-v1", accepted: true }], contactId: "c1" } });
  assert.equal(shipped.ok, false);
  // and the form's plan never builds either situation
  const p = planAuthorization({ settings: { easter: { type: "curated", amount: 40, autoGift: true } }, initialSettings: {}, occasions: OCC, card: null, formData: {}, labelFor, requiresDelivery });
  assert.deepEqual(buildConsentPayload(p.items), []);
});

t("an unchanged occasion needs no entry: the server keeps it (the form omits it)", () => {
  const settings = { birthday: qr(25), christmas: qr(100) };
  const existing = { birthday: qr(25), christmas: qr(50) };
  const consents = { birthday: { amountCents: 2500, wordingVersion: "w07-sched-qrcash-v1", acceptedAt: "2026-01-01T00:00:00.000Z" } };
  const items = planAuthorization({ settings, initialSettings: existing, occasions: OCC, card: GOOD, formData: {}, labelFor, requiresDelivery }).items;
  assert.deepEqual(items.map((i) => i.key), ["christmas"]);
  const res = backend({ op: "reconcile", args: { settings, existingSettings: existing, existingConsents: consents, payloadConsents: buildConsentPayload(items), contactId: "c1" } });
  assert.equal(res.ok, true, JSON.stringify(res));
  assert.deepEqual(Object.keys(res.snapshots).sort(), ["birthday", "christmas"]);
  assert.equal(res.snapshots.birthday.acceptedAt, "2026-01-01T00:00:00.000Z", "the earlier consent is untouched");
});
