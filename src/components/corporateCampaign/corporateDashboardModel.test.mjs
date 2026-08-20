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
