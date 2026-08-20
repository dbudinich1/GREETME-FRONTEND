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
  deriveActions,
  buildDeliveryConfigBody,
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
    [{ corporateBlocker: "owner_reauthorization_required" }, "Paused — owner authorization required"],
    [{ approvalStatus: "changed", deliveryConfig: { scheduleMode: "campaign_date" } }, "Attention required"],
  ];
  for (const [campaign, label] of cases) {
    assert.equal(deriveCampaignStatus(campaign).label, label, JSON.stringify(campaign));
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
  assert.deepEqual(Object.keys(actions).sort(), ["activate", "approve", "lock", "save", "schedule", "unlock"]);
  for (const a of Object.values(actions)) {
    assert.equal(typeof a.label, "string");
    if (!a.enabled) assert.ok(a.reason && a.reason.length > 0, `${a.key} must explain itself`);
  }
});

test("final actions are owner-only, with the exact required message", () => {
  const locked = { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "campaign_date" } };
  const notOwner = deriveActions(locked, { isOwner: false });
  assert.equal(notOwner.schedule.enabled, false);
  assert.equal(notOwner.schedule.reason, "Organization owner authorization required");
  assert.equal(notOwner.schedule.reason, OWNER_ONLY_MESSAGE);
  assert.equal(notOwner.activate.reason, OWNER_ONLY_MESSAGE);

  const owner = deriveActions(locked, { isOwner: true });
  assert.equal(owner.schedule.enabled, true);
  assert.equal(owner.activate.enabled, false, "activate belongs to the saved-date mode");
  assert.match(owner.activate.reason, /each contact’s saved date/i);
});

test("Schedule belongs to campaign_date and Activate to contact_saved_date", () => {
  const saved = { approvalStatus: "approved", lockStatus: "locked", audienceRefs: ["e1"], deliveryConfig: { scheduleMode: "contact_saved_date" } };
  const a = deriveActions(saved, { isOwner: true });
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
