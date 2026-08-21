// src/components/corporateCampaign/corporateDashboardModel.test.mjs
// SLICE D — the dashboard's decision layer. Run: node --test src/components/corporateCampaign/corporateDashboardModel.test.mjs
//
// Every claim the surface makes is decided here, so it can be proven without a DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CONTACT_CATEGORIES,
  CORPORATE_GIFT_OPTIONS,
  CURATED_TIERS_CENTS,
  SCHEDULE_MODES,
  GIFT_CAPABILITY_REASON,
  OWNER_ONLY_MESSAGE,
  bucketContactsByCategory,
  contactTotalsLabel,
  unclassifiedNotice,
  resolveAudienceRefs,
  selectedCountsByCategory,
  contactCategoryLabel,
  giftOptionState,
  deriveCampaignStatus,
  isCampaignEnabled,
  deriveAudienceSelection,
  contactCategoryAbbr,
  SEASONAL_SUGGESTION,
  suggestedSeasonalDateLocal,
  findAudienceOverlaps,
  overlapLine,
  describeCampaignPlan,
  formatLocalDay,
  buildCampaignDraft,
  draftFingerprint,
  deriveActions,
  buildDeliveryConfigBody,
  readViewerOwnerCapability,
  readExecutionCapability,
  EXECUTION_DORMANT_MESSAGE,
  centsToDisplay,
} from "./corporateDashboardModel.js";

const c = (id, type) => ({ id, name: id.toUpperCase(), corporateContactType: type });
const POOL = [
  c("e1", "employee"), c("e2", "employee"),
  c("cl1", "client"),
  c("v1", "vendor"),
  c("u1", null), c("u2", undefined),
];

// ══ categories come ONLY from the persisted field ═══════════════════════════════════════════
test("tile counts use corporateContactType and nothing else", () => {
  const b = bucketContactsByCategory(POOL);
  assert.deepEqual(b.counts, { employee: 2, client: 1, vendor: 1 });
  // A contact whose relationship/company text screams "employee" but whose persisted value is null
  // is still unclassified. Inference is what this asserts against.
  const misleading = [{ id: "x", name: "X", corporateContactType: null, relationship: "employee", company: "Acme Employees Inc" }];
  assert.deepEqual(bucketContactsByCategory(misleading).counts, { employee: 0, client: 0, vendor: 0 });
  assert.equal(bucketContactsByCategory(misleading).unclassifiedCount, 1);
});

test("null contacts contribute to NONE of the three tiles, and are never defaulted to Employee", () => {
  const b = bucketContactsByCategory(POOL);
  const inTiles = [...b.byCategory.employee, ...b.byCategory.client, ...b.byCategory.vendor].map((x) => x.id);
  assert.equal(inTiles.includes("u1"), false);
  assert.equal(inTiles.includes("u2"), false);
  assert.deepEqual(b.unclassified.map((x) => x.id), ["u1", "u2"]);
  // Not normalized, not trimmed, not coerced — anything that is not exactly one of the three.
  for (const odd of ["Employee", " employee ", "EMPLOYEE", "", 0, false, [], {}, "partner"]) {
    const one = bucketContactsByCategory([{ id: "z", name: "Z", corporateContactType: odd }]);
    assert.equal(one.unclassifiedCount, 1, JSON.stringify(odd));
    assert.equal(one.counts.employee, 0, JSON.stringify(odd));
  }
});

test("classified + unclassified always equals total", () => {
  for (const pool of [POOL, [], [c("e1", "employee")], [c("u", null)]]) {
    const b = bucketContactsByCategory(pool);
    assert.equal(b.classified + b.unclassifiedCount, b.total, JSON.stringify(pool.length));
    assert.equal(b.counts.employee + b.counts.client + b.counts.vendor, b.classified);
  }
  assert.equal(contactTotalsLabel(bucketContactsByCategory(POOL)), "4 classified · 2 unclassified · 6 total");
});

test("the unclassified notice appears ONLY when the count is above zero, and names the real action", () => {
  assert.equal(unclassifiedNotice(bucketContactsByCategory([c("e1", "employee")])), null);
  assert.equal(unclassifiedNotice(bucketContactsByCategory([])), null);

  const n = unclassifiedNotice(bucketContactsByCategory(POOL));
  assert.equal(n.count, 2);
  assert.equal(n.text, "2 existing contacts are unclassified. They remain available through Select Individual Contacts.");
  assert.match(n.text, /Select Individual Contacts/);
  // It must not promise a capability that does not exist.
  assert.equal(/fix|reclassif|import wizard|update|migrat/i.test(n.text), false);

  const one = unclassifiedNotice(bucketContactsByCategory([c("u", null)]));
  assert.equal(one.text, "1 existing contact is unclassified. They remain available through Select Individual Contacts.");
});

test("there are exactly three categories — no fourth tile exists", () => {
  assert.equal(CONTACT_CATEGORIES.length, 3);
  assert.deepEqual(CONTACT_CATEGORIES.map((x) => x.key), ["employee", "client", "vendor"]);
  assert.equal(CONTACT_CATEGORIES.some((x) => /unclassified/i.test(x.key + x.label)), false);
});

// ══ audience ════════════════════════════════════════════════════════════════════════════════
test("categories multi-select, combine, and deduplicate", () => {
  assert.deepEqual(resolveAudienceRefs({ contacts: POOL, selectedCategories: ["employee"] }).sort(), ["e1", "e2"]);
  assert.deepEqual(resolveAudienceRefs({ contacts: POOL, selectedCategories: ["employee", "client"] }).sort(), ["cl1", "e1", "e2"]);
  // Repeats and an already-selected individual cannot produce a duplicate ref.
  const refs = resolveAudienceRefs({ contacts: POOL, selectedCategories: ["employee", "employee"], individuallySelected: ["e1", "e1"] });
  assert.equal(new Set(refs).size, refs.length);
  assert.deepEqual(refs.sort(), ["e1", "e2"]);
});

test("category selection NEVER captures an unclassified contact", () => {
  const all = resolveAudienceRefs({ contacts: POOL, selectedCategories: ["employee", "client", "vendor"] });
  assert.equal(all.includes("u1"), false);
  assert.equal(all.includes("u2"), false);
  assert.equal(all.length, 4, "only the classified four");
  // An unknown category key selects nobody rather than everybody.
  assert.deepEqual(resolveAudienceRefs({ contacts: POOL, selectedCategories: ["unclassified"] }), []);
});

test("an unclassified contact CAN be selected individually, and individual picks add or remove", () => {
  const withU = resolveAudienceRefs({ contacts: POOL, selectedCategories: ["employee"], individuallySelected: ["u1"] });
  assert.deepEqual(withU.sort(), ["e1", "e2", "u1"]);
  const removed = resolveAudienceRefs({ contacts: POOL, selectedCategories: ["employee"], individuallyRemoved: ["e2"] });
  assert.deepEqual(removed, ["e1"]);
});

test("selected counts are reported per category, with unclassified counted separately", () => {
  const counts = selectedCountsByCategory(POOL, ["e1", "cl1", "u1"]);
  assert.deepEqual(counts, { employee: 1, client: 1, vendor: 0, unclassified: 1 });
});

test("the individual selector labels an unclassified contact neutrally", () => {
  assert.equal(contactCategoryLabel(c("e1", "employee")), "Employee");
  assert.equal(contactCategoryLabel(c("cl1", "client")), "Client");
  assert.equal(contactCategoryLabel(c("v1", "vendor")), "Vendor");
  for (const odd of [null, undefined, "Employee", "partner"]) {
    assert.equal(contactCategoryLabel({ id: "z", corporateContactType: odd }), "Unclassified", String(odd));
  }
});

test("the model performs no mutation and infers no classification", () => {
  const src = readFileSync(new URL("./corporateDashboardModel.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  // No writing back, no local persistence, no inference from other fields.
  for (const forbidden of [/localStorage/, /sessionStorage/, /corporateContactType\s*=/, /\.relationship/, /\.company/, /occasionType\s*===/]) {
    assert.doesNotMatch(src, forbidden, String(forbidden));
  }
  // Frozen inputs are never mutated.
  const pool = [c("e1", "employee")];
  const snapshot = JSON.stringify(pool);
  bucketContactsByCategory(pool); resolveAudienceRefs({ contacts: pool, selectedCategories: ["employee"] });
  assert.equal(JSON.stringify(pool), snapshot);
});


// ══ SLICE D CLOSEOUT — the authoritative owner capability ═══════════════════════════════════
test("D-close: the owner capability is read ONLY from viewerAuthorization, strictly", () => {
  assert.equal(readViewerOwnerCapability({ ok: true, data: { campaigns: [], viewerAuthorization: { isCurrentOrganizationOwner: true } } }), true);
  assert.equal(readViewerOwnerCapability({ ok: true, data: { campaigns: [], viewerAuthorization: { isCurrentOrganizationOwner: false } } }), false);
});

test("D-close: it FAILS CLOSED on anything that is not exactly true", () => {
  const cases = [
    ["absent response", undefined],
    ["null", null],
    ["no data", { ok: true }],
    ["no envelope field", { ok: true, data: { campaigns: [] } }],
    ["empty envelope", { ok: true, data: { viewerAuthorization: {} } }],
    ["older server omits it", { ok: true, data: { campaigns: [{ campaignId: "c1" }] } }],
    ["dormant", { ok: false, dormant: true, status: 503 }],
    ["unauthorized", { ok: false, unauthorized: true, status: 403 }],
    ["network error", { ok: false, networkError: true, status: 0 }],
  ];
  for (const [label, res] of cases) {
    assert.equal(readViewerOwnerCapability(res), false, label);
  }
  // Truthy-but-not-true must never be promoted to ownership.
  for (const truthy of ["true", 1, "yes", {}, [], "owner"]) {
    assert.equal(readViewerOwnerCapability({ data: { viewerAuthorization: { isCurrentOrganizationOwner: truthy } } }), false, JSON.stringify(truthy));
  }
});

test("D-close: a membership ROLE can no longer confer ownership", () => {
  // The role lives on the membership response, not here. Even a payload that carries an owner role
  // yields false unless the authoritative field says true — that separation IS the fix.
  const withRole = { ok: true, data: { campaigns: [], memberships: [{ role: "owner", status: "active" }] } };
  assert.equal(readViewerOwnerCapability(withRole), false);
  const src = readFileSync(new URL("./corporateDashboardModel.js", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export function readViewerOwnerCapability"));
  assert.doesNotMatch(fn.slice(0, 300), /role/, "the capability reader must not consult a role");
});

test("D-close: the capability drives the owner-only actions end to end", () => {
  const locked = { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } };
  const asOwner = readViewerOwnerCapability({ data: { viewerAuthorization: { isCurrentOrganizationOwner: true } } });
  const asOther = readViewerOwnerCapability({ data: { viewerAuthorization: { isCurrentOrganizationOwner: false } } });
  // SLICE E3 — the enabled path now also requires the server's execution capability.
  assert.equal(deriveActions(locked, { isOwner: asOwner, canAuthorizeRun: true }).schedule.enabled, true);
  const denied = deriveActions(locked, { isOwner: asOther, canAuthorizeRun: true }).schedule;
  assert.equal(denied.enabled, false);
  assert.equal(denied.reason, "Organization owner authorization required");
});

// ══ gift capability ═════════════════════════════════════════════════════════════════════════
test("No gift and Let Greet-Me Select are selectable; QR Cash and Greet-Me Gifts are visible but not", () => {
  assert.deepEqual(CORPORATE_GIFT_OPTIONS.map((o) => o.value), ["none", "curated", "qrcash", "marketplace"]);
  assert.equal(giftOptionState("none").selectable, true);
  assert.equal(giftOptionState("curated").selectable, true);
  for (const v of ["qrcash", "marketplace"]) {
    const s = giftOptionState(v);
    assert.equal(s.selectable, false, v);
    assert.equal(s.reason, "Individual funding required", v);
    assert.equal(s.reason, GIFT_CAPABILITY_REASON);
  }
});

test("the disabled wording is truthful — never unavailable, unsupported, not offered, or coming soon", () => {
  const words = /unavailable|unsupported|not offered|not supported|coming soon/i;
  assert.equal(words.test(GIFT_CAPABILITY_REASON), false);
  for (const o of CORPORATE_GIFT_OPTIONS) {
    assert.equal(words.test(o.label + " " + o.description), false, o.value);
  }
});

test("Gift Card is not rendered at all — it is absent, not disabled", () => {
  assert.equal(CORPORATE_GIFT_OPTIONS.some((o) => /gift ?card/i.test(o.label) || o.value === "giftcard"), false);
});

test("Curated tiers are CENTS, and the request body never carries a bare amount", () => {
  assert.deepEqual([...CURATED_TIERS_CENTS], [2500, 5000, 7500, 10000, 15000]);
  assert.equal(centsToDisplay(2500), "$25");
  const body = buildDeliveryConfigBody({ scheduleMode: "campaign_date", scheduledForUtc: "2026-12-24T14:00:00.000Z", giftType: "curated", curatedTierCents: 2500 });
  assert.deepEqual(body.defaultGift, { type: "curated", maxSpendCents: 2500 });
  const json = JSON.stringify(body);
  for (const bare of ['"maxSpend"', '"amount"', '"amountCents"', '"fee"', '"total"']) {
    assert.equal(json.includes(bare), false, bare);
  }
  // No gift → an explicit null, never an omitted field that a server might default.
  assert.equal(buildDeliveryConfigBody({ scheduleMode: "campaign_date", giftType: "none" }).defaultGift, null);
});

test("recipient exceptions are singular: inherit, remove, or replace with one Curated tier", () => {
  const body = buildDeliveryConfigBody({
    scheduleMode: "campaign_date", giftType: "curated", curatedTierCents: 5000,
    overrides: [{ contactId: "e1", action: "remove" }, { contactId: "cl1", action: "replace", maxSpendCents: 15000 }],
  });
  assert.deepEqual(body.recipientGiftOverrides, [
    { contactId: "e1", action: "remove" },
    { contactId: "cl1", action: "replace", gift: { type: "curated", maxSpendCents: 15000 } },
  ]);
  // One gift object per override — never an array of primaries.
  for (const o of body.recipientGiftOverrides) assert.equal(Array.isArray(o.gift), false);
  assert.equal("gifts" in body, false);
});

// ══ scheduling ══════════════════════════════════════════════════════════════════════════════
test("both schedule modes exist and map to the backend vocabulary", () => {
  assert.deepEqual(SCHEDULE_MODES.map((m) => m.value), ["campaign_date", "contact_saved_date"]);
  assert.equal(buildDeliveryConfigBody({ scheduleMode: "campaign_date", scheduledForUtc: "2026-12-24T14:00:00.000Z", timeZone: "UTC", giftType: "none" }).scheduledForUtc, "2026-12-24T14:00:00.000Z");
  const saved = buildDeliveryConfigBody({ scheduleMode: "contact_saved_date", occasionType: "birthday", timeZone: "UTC", giftType: "none" });
  assert.equal(saved.occasionType, "birthday");
  assert.equal("scheduledForUtc" in saved, false);
  assert.equal(saved.timeZone, "UTC");
  // autoSend is never part of the contract.
  assert.equal(JSON.stringify(saved).includes("autoSend"), false);
});

// ══ status ══════════════════════════════════════════════════════════════════════════════════
test("statuses are concise human language derived from PERSISTED backend state", () => {
  const cases = [
    [{}, "Needs setup"],
    [{ deliveryConfig: { scheduleMode: "campaign_date" } }, "Draft"],
    [{ approvalStatus: "approved", deliveryConfig: { scheduleMode: "campaign_date" } }, "Approved"],
    [{ approvalStatus: "approved", lockStatus: "locked", deliveryConfig: { scheduleMode: "campaign_date" } }, "Locked"],
    [{ lockStatus: "locked", deliveryConfig: { scheduleMode: "campaign_date", status: "scheduled" } }, "Scheduled"],
    [{ lockStatus: "locked", deliveryConfig: { scheduleMode: "contact_saved_date", status: "active" } }, "Active"],
    [{ approvalStatus: "changed", deliveryConfig: { scheduleMode: "campaign_date" } }, "Attention required"],
  ];
  for (const [campaign, label] of cases) {
    assert.equal(deriveCampaignStatus(campaign).label, label, JSON.stringify(campaign));
  }
});

test("no Paused status is derived — the backend records pauses on schedules, not campaigns", () => {
  // Fields nothing writes must not produce a label. Feeding every shape the old readers looked for
  // yields an ordinary status, never a fabricated pause.
  for (const shape of [
    { corporateBlocker: "owner_reauthorization_required" },
    { corporateActivation: { pausedReason: "owner_reauthorization_required" } },
    { lastRunBlockers: [{ contactId: "e1", reason: "missing_occasion_date" }] },
  ]) {
    const st = deriveCampaignStatus(shape);
    assert.notEqual(st.key, "paused", JSON.stringify(shape));
    assert.equal(/paused/i.test(st.label), false, JSON.stringify(shape));
  }
  // ...and the readers are gone from the source, not merely unreachable.
  const src = readFileSync(new URL("./corporateDashboardModel.js", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  for (const gone of [/corporateBlocker/, /pausedReason/, /lastRunBlockers/, /isOrganizationOwner/]) {
    assert.doesNotMatch(src, gone, String(gone));
  }
});

test("no raw enum, 'Ready to send', 'not_scheduled', or 'proposed' ever reaches a reader", () => {
  const banned = /ready to send|not_scheduled|proposed/i;
  const samples = [{}, { approvalStatus: "approved" }, { lockStatus: "locked" }, { deliveryConfig: { status: "not_configured" } }];
  for (const s of samples) {
    const st = deriveCampaignStatus(s);
    assert.equal(banned.test(st.label + " " + st.next), false, JSON.stringify(s));
    assert.equal(/_/.test(st.label), false, `raw enum leaked: ${st.label}`);
  }
});

test("Scheduled and Active are NEVER derived locally — only from persisted status", () => {
  // Everything else true, but the backend has not stored a status: still not Scheduled.
  const optimistic = { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date", scheduledForUtc: "2026-12-24T14:00:00.000Z" } };
  assert.equal(deriveCampaignStatus(optimistic).label, "Locked");
  assert.notEqual(deriveCampaignStatus(optimistic).label, "Scheduled");
});

// ══ action footer ═══════════════════════════════════════════════════════════════════════════
test("every action is always present, and a disabled one always explains why", () => {
  const actions = deriveActions({}, { isOwner: false });
  // SLICE E5 added `toggle`. Still an exact list, not a subset: the point of the assertion is
  // that a new action cannot appear on the card without someone deciding it should.
  assert.deepEqual(Object.keys(actions).sort(), ["activate", "approve", "lock", "save", "schedule", "toggle", "unlock"]);
  for (const a of Object.values(actions)) {
    assert.equal(typeof a.label, "string");
    if (!a.enabled) assert.ok(a.reason && a.reason.length > 0, `${a.key} must explain itself`);
  }
});

// ══ SLICE E5 — what this campaign will do ════════════════════════════════════════════════════
const planOf = (draft, over = {}) => {
  const rows = describeCampaignPlan({ draft, recipientCount: 3, enabled: true, ...over });
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
};

test("E5: a per-contact campaign says every year, in plain words", () => {
  // The single fact most likely to be assumed wrongly in either direction — so it is stated
  // outright rather than left to be inferred from the schedule controls.
  const p = planOf({ scheduleMode: "contact_saved_date", occasionType: "work-anniversary", giftType: "none" });
  assert.match(p.when, /each contact's work anniversary/i);
  assert.match(p.when, /every year/i);
});

test("E5: a shared-date campaign names the day and says every year", () => {
  const p = planOf({ scheduleMode: "campaign_date", scheduledForLocal: "2026-12-15T09:00", giftType: "none" });
  assert.match(p.when, /15 December/);
  assert.match(p.when, /every year/i);
});

test("E5: an unset date is admitted, never invented", () => {
  const p = planOf({ scheduleMode: "campaign_date", scheduledForLocal: "", giftType: "none" });
  assert.match(p.when, /no date chosen/i);
});

test("E5: the gift line states the ceiling in dollars, from cents", () => {
  assert.match(planOf({ scheduleMode: "campaign_date", giftType: "curated", tierCents: 7500 }).gift, /\$75/);
  assert.match(planOf({ scheduleMode: "campaign_date", giftType: "none" }).gift, /no gift/i);
});

test("E5: an empty audience says so rather than claiming nobody is a plan", () => {
  assert.match(planOf({ scheduleMode: "campaign_date" }, { recipientCount: 0 }).who, /nobody yet/i);
  assert.equal(planOf({ scheduleMode: "campaign_date" }, { recipientCount: 1 }).who, "1 contact");
  assert.equal(planOf({ scheduleMode: "campaign_date" }, { recipientCount: 3 }).who, "3 contacts");
});

test("E5: the status line reflects the switch", () => {
  assert.match(planOf({ scheduleMode: "campaign_date" }, { enabled: true }).state, /switched on/i);
  assert.match(planOf({ scheduleMode: "campaign_date" }, { enabled: false }).state, /nothing will send/i);
});

test("E5: a day is formatted, and nonsense is never formatted into a date", () => {
  assert.equal(formatLocalDay("2026-12-15T09:00"), "15 December");
  assert.equal(formatLocalDay("2026-01-05T09:00"), "5 January");
  for (const bad of ["", null, "not-a-date", "2026-13-01T09:00"]) {
    assert.match(formatLocalDay(bad), /no date chosen/i, JSON.stringify(bad));
  }
});

// ══ SLICE E5 — the seasonal suggestion ═══════════════════════════════════════════════════════
test("E5: the suggestion is December 15 at a civilised hour", () => {
  assert.equal(SEASONAL_SUGGESTION.monthDay, "12-15");
  assert.equal(suggestedSeasonalDateLocal("2026-08-21"), "2026-12-15T09:00");
});

test("E5: once the date has passed, the suggestion moves to next year", () => {
  // Offering a date that has already gone by is offering nothing.
  assert.equal(suggestedSeasonalDateLocal("2026-12-16"), "2027-12-15T09:00");
  assert.equal(suggestedSeasonalDateLocal("2026-12-15"), "2026-12-15T09:00", "on the day, today still counts");
});

test("E5: a nonsense date suggests nothing rather than guessing", () => {
  for (const bad of ["", null, undefined, "not-a-date", "0001-01-01"]) {
    assert.equal(suggestedSeasonalDateLocal(bad), null, JSON.stringify(bad));
  }
});

// ══ SLICE E5 — overlapping audiences ═════════════════════════════════════════════════════════
const PEOPLE = [{ id: "e1", name: "Bob Smith" }, { id: "e2", name: "Tommy Nguyen" }, { id: "e3", name: "Ada Ito" }];
const camp = (name, refs, over = {}) => ({ campaignId: name, name, audienceRefs: refs, ...over });

test("E5: a contact in two campaigns is named, with both campaigns", () => {
  const out = findAudienceOverlaps([camp("VIP", ["e1", "e2"]), camp("Birthdays", ["e1", "e2", "e3"])], PEOPLE);
  assert.equal(out.length, 2, "only the two who appear twice");
  assert.equal(overlapLine(out.find((o) => o.contactId === "e1")), "Bob Smith \u2014 VIP and Birthdays");
  assert.equal(out.some((o) => o.contactId === "e3"), false, "one campaign is not an overlap");
});

test("E5: a switched-off campaign cannot create an overlap", () => {
  // An overlap that cannot send is not an overlap — warning about it would be noise.
  const out = findAudienceOverlaps([camp("VIP", ["e1"]), camp("Birthdays", ["e1"], { enabled: false })], PEOPLE);
  assert.deepEqual(out, []);
});

test("E5: three campaigns read as a list, not a run-on", () => {
  const out = findAudienceOverlaps([camp("VIP", ["e1"]), camp("Birthdays", ["e1"]), camp("Holidays", ["e1"])], PEOPLE);
  assert.equal(overlapLine(out[0]), "Bob Smith \u2014 VIP, Birthdays and Holidays");
});

test("E5: the worst overlaps are listed first", () => {
  const out = findAudienceOverlaps([
    camp("VIP", ["e1", "e2"]), camp("Birthdays", ["e1", "e2"]), camp("Holidays", ["e1"]),
  ], PEOPLE);
  assert.equal(out[0].contactId, "e1", "in three campaigns");
  assert.equal(out[0].campaigns.length, 3);
});

test("E5: the same campaign listed twice is not an overlap with itself", () => {
  const out = findAudienceOverlaps([camp("VIP", ["e1", "e1"])], PEOPLE);
  assert.deepEqual(out, [], "a duplicated ref within one audience is still one campaign");
});

test("E5: an unknown contact is still reported rather than silently dropped", () => {
  const out = findAudienceOverlaps([camp("VIP", ["ghost"]), camp("Birthdays", ["ghost"])], PEOPLE);
  assert.equal(out.length, 1);
  assert.equal(out[0].name, "Unknown contact", "a missing name must not hide a real overlap");
});

// ══ SLICE E5 — contact-type tags ═════════════════════════════════════════════════════════════
test("E5: each category has a distinct three-letter tag", () => {
  const abbrs = CONTACT_CATEGORIES.map((c) => c.abbr);
  assert.deepEqual(abbrs, ["EMP", "CLI", "VND"]);
  assert.equal(new Set(abbrs).size, 3, "a tag that repeats distinguishes nothing");
  for (const a of abbrs) assert.equal(a.length, 3, "two letters read as truncation, not a code");
});

test("E5: an unclassified contact gets a dash, never a fourth code", () => {
  // "UNC" would make the ABSENCE of a category look like another category — the one thing this
  // surface has been careful never to imply.
  assert.equal(contactCategoryAbbr({ corporateContactType: null }), "\u2014");
  assert.equal(contactCategoryAbbr({}), "\u2014");
  assert.equal(contactCategoryAbbr(null), "\u2014");
  assert.equal(contactCategoryAbbr({ corporateContactType: "partner" }), "\u2014", "an unknown type is not guessed at");
});

test("E5: the tag and the full label always describe the same contact", () => {
  for (const cat of CONTACT_CATEGORIES) {
    const c = { corporateContactType: cat.key };
    assert.equal(contactCategoryAbbr(c), cat.abbr);
    assert.equal(contactCategoryLabel(c), cat.label.replace(/s$/, ""));
  }
});

// ══ SLICE E5 — reading a persisted audience back into a selection ════════════════════════════
const ROSTER = [
  { id: "e1", corporateContactType: "employee" },
  { id: "e2", corporateContactType: "employee" },
  { id: "c1", corporateContactType: "client" },
  // A SECOND client, deliberately. With only one, including it completes the whole client
  // category - so there would be no way to express "an individual pick that no category explains",
  // which is precisely the case the selection logic exists to preserve.
  { id: "c2", corporateContactType: "client" },
  { id: "v1", corporateContactType: "vendor" },
];

test("E5: a category is checked only when EVERY member of it is included", () => {
  assert.deepEqual(deriveAudienceSelection(ROSTER, ["e1", "e2"]).categories, ["employee"]);
  // One employee missing means the category is not selected — showing it ticked would claim the
  // campaign reaches someone it does not.
  assert.deepEqual(deriveAudienceSelection(ROSTER, ["e1"]).categories, []);
  assert.deepEqual(deriveAudienceSelection(ROSTER, ["e1"]).individualRefs, ["e1"]);
});

test("E5: an empty category is never vacuously checked", () => {
  // `[].every(...)` is true, so without the non-empty guard a category with no members reads as
  // fully selected and the surface shows a ticked box representing nobody.
  const noVendors = ROSTER.filter((c) => c.corporateContactType !== "vendor");
  assert.equal(deriveAudienceSelection(noVendors, []).categories.includes("vendor"), false);
});

test("E5: whoever a checked category covers is not also an individual pick", () => {
  const sel = deriveAudienceSelection(ROSTER, ["e1", "e2", "c1"]);
  assert.deepEqual(sel.categories, ["employee"]);
  assert.deepEqual(sel.individualRefs, ["c1"], "only the one a category cannot explain");
});

test("E5: the selection round-trips through resolveAudienceRefs", () => {
  // The property that makes the buffer trustworthy: reading an audience and immediately writing
  // it back must produce the same audience, or opening a card would quietly alter it.
  for (const refs of [[], ["e1"], ["e1", "e2"], ["e1", "e2", "c1"], ["c1", "v1"]]) {
    const { categories, individualRefs } = deriveAudienceSelection(ROSTER, refs);
    const back = resolveAudienceRefs({ contacts: ROSTER, selectedCategories: categories, individuallySelected: individualRefs });
    assert.deepEqual([...back].sort(), [...refs].sort(), `round-trip ${JSON.stringify(refs)}`);
  }
});

// ══ SLICE E5 — the draft and its fingerprint ═════════════════════════════════════════════════
test("E5: a fresh draft of an unconfigured campaign offers No gift and a campaign date", () => {
  const d = buildCampaignDraft({}, ROSTER);
  assert.equal(d.giftType, "none", "No gift is the default");
  assert.equal(d.scheduleMode, "campaign_date");
  assert.deepEqual(d.categories, []);
  assert.deepEqual(d.individualRefs, []);
});

test("E5: a draft reads the persisted delivery config back exactly", () => {
  const campaign = {
    audienceRefs: ["e1", "e2"],
    deliveryConfig: {
      scheduleMode: "contact_saved_date", occasionType: "work-anniversary",
      timeZone: "UTC", defaultGift: { type: "curated", maxSpendCents: 7500 },
    },
  };
  const d = buildCampaignDraft(campaign, ROSTER);
  assert.deepEqual(d.categories, ["employee"]);
  assert.equal(d.occasionType, "work-anniversary");
  assert.equal(d.timeZone, "UTC");
  assert.equal(d.giftType, "curated");
  assert.equal(d.tierCents, 7500);
});

test("E5: the fingerprint ignores ordering, so a re-ordered list is not a change", () => {
  const a = { categories: ["employee", "client"], individualRefs: ["v1", "c1"], giftType: "none", scheduleMode: "campaign_date", scheduledForLocal: "", timeZone: "UTC" };
  const b = { ...a, categories: ["client", "employee"], individualRefs: ["c1", "v1"] };
  assert.equal(draftFingerprint(a), draftFingerprint(b), "same audience, different order");
});

test("E5: the fingerprint ignores fields the current mode would not send", () => {
  // Switching mode away and back must return to clean, or Save stays lit over an identical
  // campaign and the reader learns to ignore it.
  const base = buildCampaignDraft({ deliveryConfig: { scheduleMode: "campaign_date" } }, ROSTER);
  assert.equal(draftFingerprint({ ...base, occasionType: "birthday" }), draftFingerprint({ ...base, occasionType: "holiday" }),
    "the occasion is irrelevant while a single campaign date is in force");

  const saved = { ...base, scheduleMode: "contact_saved_date" };
  assert.equal(draftFingerprint({ ...saved, scheduledForLocal: "2026-12-15T10:00" }), draftFingerprint({ ...saved, scheduledForLocal: "" }),
    "…and the date is irrelevant on a per-contact schedule");
});

test("E5: a real change DOES move the fingerprint", () => {
  const base = buildCampaignDraft({ deliveryConfig: { scheduleMode: "campaign_date" } }, ROSTER);
  for (const patch of [
    { categories: ["employee"] }, { individualRefs: ["c1"] }, { giftType: "curated" },
    { scheduleMode: "contact_saved_date" }, { scheduledForLocal: "2026-12-15T10:00" }, { timeZone: "UTC" },
  ]) {
    assert.notEqual(draftFingerprint({ ...base, ...patch }), draftFingerprint(base), JSON.stringify(patch));
  }
});

// ══ SLICE E5 — the runtime switch ════════════════════════════════════════════════════════════
test("E5: absent enabled reads as ON, matching the scheduler's own guard", () => {
  // The server projects `enabled: c.enabled !== false` and the runner blocks on `=== false`. A
  // campaign stored before the switch existed therefore RUNS, and the surface must agree — saying
  // "Off" about a campaign that is sending is the worst answer available here.
  assert.equal(isCampaignEnabled({}), true);
  assert.equal(isCampaignEnabled({ enabled: undefined }), true);
  assert.equal(isCampaignEnabled({ enabled: true }), true);
  assert.equal(isCampaignEnabled({ enabled: false }), false);
  assert.equal(isCampaignEnabled(null), true);
});

test("E5: a switched-off campaign says Off before any other state", () => {
  // Off outranks the approval states beneath it because those are inert while the switch is off.
  const off = { enabled: false, approvalStatus: "approved", lockStatus: "locked", deliveryConfig: { scheduleMode: "campaign_date", status: "scheduled" } };
  const status = deriveCampaignStatus(off);
  assert.equal(status.label, "Off");
  assert.equal(status.tone, "muted", "a deliberate choice is not a warning");
  assert.match(status.next, /turn it on/i);
});

test("E5: turning OFF is never blocked by the state of the thing being stopped", () => {
  // The asymmetry that matters. A misconfigured, unapproved, audience-less campaign that is
  // somehow ON must still be stoppable in one click, or it cannot be called back at all.
  const on = deriveActions({ enabled: true }, { isOwner: true });
  assert.equal(on.toggle.on, true);
  assert.equal(on.toggle.enabled, true, "an owner can always switch a campaign off");
  assert.equal(on.toggle.nextLabel, "Turn off");

  // ...and dormancy must not block it either: the switch records intent, it does not send.
  const dormant = deriveActions({ enabled: true }, { isOwner: true, canAuthorizeRun: false });
  assert.equal(dormant.toggle.enabled, true, "a stop must not depend on the execution interlock");
});

test("E5: turning ON demands an audience and a schedule, and says which is missing", () => {
  const bare = deriveActions({ enabled: false }, { isOwner: true });
  assert.equal(bare.toggle.enabled, false);
  assert.match(bare.toggle.reason, /who should receive/i);

  const noSchedule = deriveActions({ enabled: false, audienceRefs: ["e1"] }, { isOwner: true });
  assert.equal(noSchedule.toggle.enabled, false);
  assert.match(noSchedule.toggle.reason, /when this campaign should send/i);

  const ready = deriveActions({ enabled: false, audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true });
  assert.equal(ready.toggle.enabled, true);
  assert.equal(ready.toggle.nextLabel, "Turn on");
});

test("E5: only the owner works the switch, in either direction", () => {
  const ready = { enabled: false, audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } };
  assert.equal(deriveActions(ready, { isOwner: false }).toggle.reason, OWNER_ONLY_MESSAGE);
  assert.equal(deriveActions({ enabled: true }, { isOwner: false }).toggle.reason, OWNER_ONLY_MESSAGE);
});

test("final actions are owner-only, with the exact required message", () => {
  const locked = { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } };
  const notOwner = deriveActions(locked, { isOwner: false });
  assert.equal(notOwner.schedule.enabled, false);
  assert.equal(notOwner.schedule.reason, "Organization owner authorization required");
  assert.equal(notOwner.schedule.reason, OWNER_ONLY_MESSAGE);
  assert.equal(notOwner.activate.reason, OWNER_ONLY_MESSAGE);

  // SLICE E3 — execution capability granted, so ownership is the only remaining variable.
  const owner = deriveActions(locked, { isOwner: true, canAuthorizeRun: true });
  assert.equal(owner.schedule.enabled, true);
  assert.equal(owner.activate.enabled, false, "activate belongs to the saved-date mode");
  assert.match(owner.activate.reason, /each contact’s saved date/i);
});

test("Schedule belongs to campaign_date and Activate to contact_saved_date", () => {
  const saved = { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "contact_saved_date" } };
  const a = deriveActions(saved, { isOwner: true, canAuthorizeRun: true });
  assert.equal(a.activate.enabled, true);
  assert.equal(a.schedule.enabled, false);
  assert.match(a.schedule.reason, /single campaign date/i);
});

test("prerequisites are named precisely rather than generically", () => {
  const noAudience = deriveActions({ deliveryConfig: { scheduleMode: "campaign_date" }, audienceRefs: [] }, { isOwner: true });
  assert.match(noAudience.approve.reason, /who should receive/i);
  const noSchedule = deriveActions({ audienceRefs: ["e1"] }, { isOwner: true });
  assert.match(noSchedule.approve.reason, /when this campaign should send/i);
  const notApproved = deriveActions({ audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } }, { isOwner: true });
  assert.match(notApproved.lock.reason, /approve the campaign/i);
});

// ══ SLICE E3 — the authoritative execution capability ════════════════════════════════════════
//
// The dashboard used to enable Schedule/Activate on owner + lock state alone, so an owner could
// press a button whose only possible outcome was a 503. The capability now comes from the server,
// on the campaign list, derived from the same reader that gates the endpoints.

test("E3: only a literal true grants the capability", () => {
  assert.equal(readExecutionCapability({ ok: true, data: { executionAvailability: { canAuthorizeRun: true, reason: null } } }), true);
  assert.equal(readExecutionCapability({ ok: true, data: { executionAvailability: { canAuthorizeRun: false, reason: "corporate_campaign_execution_disabled" } } }), false);
});

test("E3: every truthy impostor fails closed", () => {
  for (const truthy of ["true", 1, "yes", {}, [], "TRUE", -1, Infinity]) {
    assert.equal(readExecutionCapability({ data: { executionAvailability: { canAuthorizeRun: truthy } } }), false, JSON.stringify(truthy));
  }
});

test("E3: an OLDER server that omits the envelope fails closed", () => {
  // The exact shape shipped before this slice: campaigns + viewerAuthorization, nothing else.
  assert.equal(readExecutionCapability({ ok: true, data: { campaigns: [], viewerAuthorization: { isCurrentOrganizationOwner: true } } }), false);
  assert.equal(readExecutionCapability({ ok: true, data: {} }), false);
  assert.equal(readExecutionCapability({ ok: true }), false);
});

test("E3: degraded responses cannot confer the capability", () => {
  for (const res of [null, undefined, {}, { ok: false }, { dormant: true }, { unauthorized: true },
                     { ok: false, status: 500 }, { data: null }, { data: { executionAvailability: null } }]) {
    assert.equal(readExecutionCapability(res), false, JSON.stringify(res));
  }
});

test("E3: the capability and ownership are INDEPENDENT facts, read separately", () => {
  const res = { ok: true, data: {
    viewerAuthorization: { isCurrentOrganizationOwner: false },
    executionAvailability: { canAuthorizeRun: true, reason: null },
  } };
  assert.equal(readExecutionCapability(res), true, "the door is open");
  assert.equal(readViewerOwnerCapability(res), false, "this viewer still is not the owner");
});

test("E3: Schedule and Activate require the capability, and say so in the approved words", () => {
  const base = { lockStatus: "locked", approvalStatus: "approved" };
  const sched = { ...base, deliveryConfig: { scheduleMode: "campaign_date" } };
  const activ = { ...base, deliveryConfig: { scheduleMode: "contact_saved_date" } };

  // Owner + locked + right mode, but the interlock is closed → disabled with the exact text.
  for (const [c, key] of [[sched, "schedule"], [activ, "activate"]]) {
    const off = deriveActions(c, { isOwner: true, canAuthorizeRun: false })[key];
    assert.equal(off.enabled, false, key);
    assert.equal(off.reason, "Campaign sending is not active yet.", key);
    assert.equal(off.reason, EXECUTION_DORMANT_MESSAGE, key);
    // …and the SAME campaign with the capability granted is enabled.
    assert.equal(deriveActions(c, { isOwner: true, canAuthorizeRun: true })[key].enabled, true, key);
  }
});

test("E3: an omitted capability fails closed — a caller that forgets refuses, never offers", () => {
  const c = { lockStatus: "locked", approvalStatus: "approved", deliveryConfig: { scheduleMode: "campaign_date" } };
  const a = deriveActions(c, { isOwner: true }); // no canAuthorizeRun at all
  assert.equal(a.schedule.enabled, false);
  assert.equal(a.schedule.reason, EXECUTION_DORMANT_MESSAGE);
  assert.equal(deriveActions(c, {}).schedule.enabled, false);
  assert.equal(deriveActions(c).schedule.enabled, false);
});

test("E3: dormancy NEVER displaces owner authorization", () => {
  const c = { lockStatus: "locked", approvalStatus: "approved", deliveryConfig: { scheduleMode: "campaign_date" } };
  // A non-owner is told the truth about ownership whatever the interlock says — being told the
  // feature is off would send them to the wrong person with the wrong question.
  for (const canAuthorizeRun of [true, false]) {
    const a = deriveActions(c, { isOwner: false, canAuthorizeRun });
    assert.equal(a.schedule.enabled, false);
    assert.equal(a.schedule.reason, OWNER_ONLY_MESSAGE, `canAuthorizeRun=${canAuthorizeRun}`);
    assert.equal(a.activate.reason, OWNER_ONLY_MESSAGE);
  }
  // And the capability never rescues a non-owner.
  assert.equal(deriveActions(c, { isOwner: false, canAuthorizeRun: true }).schedule.enabled, false);
});

test("E3: the capability governs ONLY the two owner-only actions", () => {
  const unlocked = { lockStatus: "unlocked", approvalStatus: "approved", audienceRefs: ["c1"],
                     deliveryConfig: { scheduleMode: "campaign_date" } };
  const off = deriveActions(unlocked, { isOwner: true, canAuthorizeRun: false });
  const on = deriveActions(unlocked, { isOwner: true, canAuthorizeRun: true });
  // Save/approve/lock/unlock are configuration and governance, not execution — untouched.
  for (const key of ["save", "approve", "lock", "unlock"]) {
    assert.deepEqual(off[key], on[key], key);
  }
  assert.equal(off.save.enabled, true, "configuration stays usable while sending is dormant");
});

test("E3: the approved wording is used, and the rejected wordings are not", () => {
  assert.equal(EXECUTION_DORMANT_MESSAGE, "Campaign sending is not active yet.");
  for (const banned of [/unavailable/i, /unsupported/i, /not offered/i, /coming soon/i]) {
    assert.doesNotMatch(EXECUTION_DORMANT_MESSAGE, banned, String(banned));
  }
});

test("E3: no raw backend flag name appears in the dashboard model", () => {
  const src = readFileSync(new URL("./corporateDashboardModel.js", import.meta.url), "utf8");
  for (const flag of ["corporateCampaignExecutionEnabled", "corporateCampaignProducerEnabled",
                      "corporateCampaignDeliveryEnabled", "campaignFeaturedSpreadEnabled",
                      "LAUNCH_CONTROL", "launchControl"]) {
    assert.equal(src.includes(flag), false, flag);
  }
});
