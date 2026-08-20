// src/components/corporateCampaign/corporateDashboardModel.js
//
// TEAM A — SLICE D: the pure decision layer behind the consolidated corporate dashboard.
//
// Everything the dashboard *claims* is derived here, from backend truth only, so the claims can be
// tested without a DOM. No component in this slice decides a count, a status, or a capability.
//
// THREE RULES THIS FILE EXISTS TO ENFORCE:
//
//  1. CATEGORY AUTHORITY IS `contact.corporateContactType`, and nothing else. Not relationship
//     text, not occasion type, not company name, not a label. The backend returns exactly
//     "employee" | "client" | "vendor" | null, already normalized (backend a125bde3), so the
//     frontend must not trim, lowercase, coerce, or default it. A null is a contact whose category
//     nobody ever chose, and guessing would put a real person in a real send under a guess.
//
//  2. STATUS COMES FROM PERSISTED BACKEND STATE. "Scheduled" and "Active" are never derived from
//     local intent — only from what the server says it stored.
//
//  3. A DISABLED CONTROL MUST SAY WHY. Every capability below carries its own truthful reason, so
//     the UI never shows a dead button with no explanation.

// ── categories ───────────────────────────────────────────────────────────────────────────────
// Exactly three. There is deliberately no fourth "unclassified" category: unclassified is the
// ABSENCE of a category, not another one, and inventing a tile for it would imply a classification
// that was never made.
export const CONTACT_CATEGORIES = Object.freeze([
  { key: "employee", label: "Employees", description: "Employees, personnel, departments, and workplace contacts." },
  { key: "client", label: "Clients", description: "Clients, customers, companies, and important customer contacts." },
  { key: "vendor", label: "Vendors", description: "Vendors, suppliers, service providers, and business partners." },
]);

const CATEGORY_KEYS = Object.freeze(CONTACT_CATEGORIES.map((c) => c.key));

/**
 * Bucket the organisation's contacts by their PERSISTED classification.
 *
 * A contact whose corporateContactType is null (or anything not one of the three) lands in
 * `unclassified` — never in a category, and never silently in Employees. The arithmetic is returned
 * whole (`classified + unclassified === total`) so the surface can show it truthfully rather than
 * quietly presenting three counts that do not add up.
 */
export function bucketContactsByCategory(contacts) {
  const list = Array.isArray(contacts) ? contacts : [];
  const byCategory = { employee: [], client: [], vendor: [] };
  const unclassified = [];
  for (const c of list) {
    if (!c || typeof c.id !== "string") continue;
    // Strict membership. No normalization: the backend already normalized, and a second,
    // different normalization here is exactly how two layers start disagreeing.
    if (CATEGORY_KEYS.includes(c.corporateContactType)) byCategory[c.corporateContactType].push(c);
    else unclassified.push(c);
  }
  const counts = { employee: byCategory.employee.length, client: byCategory.client.length, vendor: byCategory.vendor.length };
  const classified = counts.employee + counts.client + counts.vendor;
  return { byCategory, unclassified, counts, classified, unclassifiedCount: unclassified.length, total: list.length };
}

// The compact arithmetic line. Always shown, so the three tile counts are never the only number a
// reader sees.
export function contactTotalsLabel(bucket) {
  return `${bucket.classified} classified · ${bucket.unclassifiedCount} unclassified · ${bucket.total} total`;
}

/**
 * The unclassified notice — present ONLY when there is something to disclose.
 *
 * It states the fact and the one action that genuinely exists. It does NOT offer to fix the
 * classification, because no endpoint can: the import wizard classifies contacts it imports, it
 * cannot reclassify a contact that already exists.
 */
export function unclassifiedNotice(bucket) {
  if (!bucket || bucket.unclassifiedCount <= 0) return null;
  const n = bucket.unclassifiedCount;
  return {
    count: n,
    text: `${n} existing contact${n === 1 ? "" : "s"} ${n === 1 ? "is" : "are"} unclassified. They remain available through Select Individual Contacts.`,
  };
}

/**
 * Resolve a category multi-select into audienceRefs.
 *
 * Categories combine (union), individual picks add or remove on top, and the result is
 * deduplicated. An unclassified contact can only ever arrive through `individuallySelected` — no
 * category can capture it.
 */
export function resolveAudienceRefs({ contacts, selectedCategories = [], individuallySelected = [], individuallyRemoved = [] } = {}) {
  const bucket = bucketContactsByCategory(contacts);
  const refs = new Set();
  for (const key of selectedCategories) {
    if (!CATEGORY_KEYS.includes(key)) continue;      // an unknown key selects nobody
    for (const c of bucket.byCategory[key]) refs.add(c.id);
  }
  for (const id of individuallySelected) if (typeof id === "string" && id) refs.add(id);
  for (const id of individuallyRemoved) refs.delete(id);
  return [...refs];
}

// Per-category selected counts, for the bubble labels.
export function selectedCountsByCategory(contacts, audienceRefs) {
  const bucket = bucketContactsByCategory(contacts);
  const chosen = new Set(Array.isArray(audienceRefs) ? audienceRefs : []);
  const out = {};
  for (const key of CATEGORY_KEYS) out[key] = bucket.byCategory[key].filter((c) => chosen.has(c.id)).length;
  out.unclassified = bucket.unclassified.filter((c) => chosen.has(c.id)).length;
  return out;
}

// The neutral descriptor shown beside a contact in the individual selector. Never "Employee" for a
// contact that has no classification.
export function contactCategoryLabel(contact) {
  const found = CONTACT_CATEGORIES.find((c) => c.key === (contact && contact.corporateContactType));
  return found ? found.label.replace(/s$/, "") : "Unclassified";
}

// ── gift capability ──────────────────────────────────────────────────────────────────────────
// Sourced from the same vocabulary the personal selector uses. Gift Card is absent because it does
// not exist as a type anywhere in the system — it is not "disabled", it is simply not a thing.
//
// QR Cash and Greet-Me Gifts stay VISIBLE and non-selectable: both are real, fully purchasable
// gifts that a person can buy today. What does not exist is a way for a campaign to fund one
// unattended — so the honest words are "Individual funding required", never "unavailable",
// "unsupported", "not offered", or "coming soon", each of which would be false.
export const GIFT_CAPABILITY_REASON = "Individual funding required";

export const CORPORATE_GIFT_OPTIONS = Object.freeze([
  { value: "none", label: "No gift", description: "A greeting on its own.", automatable: true },
  { value: "curated", label: "Let Greet-Me™ Select", description: "We choose something thoughtful within your limit.", automatable: true },
  { value: "qrcash", label: "QR Cash™", description: "Cash they can scan and spend.", automatable: false },
  { value: "marketplace", label: "Greet-Me Gifts", description: "Made-in-USA gifts.", automatable: false },
]);

// The existing approved Curated tiers, in CENTS. The frontend never handles dollars for this: a
// bare `maxSpend`/`amount` is the exact shape that turns $25 into $2,500.
export const CURATED_TIERS_CENTS = Object.freeze([2500, 5000, 7500, 10000, 15000]);

export const centsToDisplay = (cents) => `$${Math.round(Number(cents) || 0) / 100}`;

export function giftOptionState(value) {
  const opt = CORPORATE_GIFT_OPTIONS.find((o) => o.value === value);
  if (!opt) return { selectable: false, reason: "Not available for campaigns" };
  return opt.automatable ? { selectable: true, reason: null } : { selectable: false, reason: GIFT_CAPABILITY_REASON };
}

// ── schedule modes ───────────────────────────────────────────────────────────────────────────
export const SCHEDULE_MODES = Object.freeze([
  { value: "campaign_date", label: "One Campaign Date", description: "Everyone receives it at the same moment." },
  { value: "contact_saved_date", label: "Each Contact’s Saved Date", description: "Sends on each person’s own occasion, every year." },
]);

// ── status ───────────────────────────────────────────────────────────────────────────────────
// Backend truth → concise human language. Scheduled and Active are read from the PERSISTED
// deliveryConfig.status; they are never inferred from a click. No raw enum, no "Ready to send",
// no "not_scheduled", no "proposed" ever reaches a reader.
export function deriveCampaignStatus(campaign) {
  const c = campaign || {};
  const delivery = c.deliveryConfig || {};
  const paused = c.corporateBlocker === "owner_reauthorization_required"
    || (c.corporateActivation && c.corporateActivation.pausedReason === "owner_reauthorization_required");

  if (paused) return { key: "paused", label: "Paused — owner authorization required", tone: "warn", next: "The organization owner must authorize this campaign again." };
  if (delivery.status === "scheduled") return { key: "scheduled", label: "Scheduled", tone: "good", next: "Sends are scheduled. Nothing further is needed." };
  if (delivery.status === "active") return { key: "active", label: "Active", tone: "good", next: "Running on each contact’s saved date." };
  if (c.lockStatus === "locked") return { key: "locked", label: "Locked", tone: "good", next: "Ready for the organization owner to authorize." };
  if (c.approvalStatus === "approved") return { key: "approved", label: "Approved", tone: "info", next: "Lock the campaign to freeze what will be sent." };
  if (!delivery.scheduleMode || delivery.status === "not_configured") {
    return { key: "needs_setup", label: "Needs setup", tone: "warn", next: "Choose an audience, a gift option, and when it should send." };
  }
  if (c.approvalStatus === "changed") return { key: "attention", label: "Attention required", tone: "warn", next: "This campaign changed after approval. Review and approve it again." };
  return { key: "draft", label: "Draft", tone: "info", next: "Review the details, then approve." };
}

// ── action footer ────────────────────────────────────────────────────────────────────────────
// Every action is always PRESENT. Enablement and the reason travel together, so a disabled control
// can always explain the missing prerequisite rather than sitting there inert.
export const OWNER_ONLY_MESSAGE = "Organization owner authorization required";

export function deriveActions(campaign, { isOwner = false } = {}) {
  const c = campaign || {};
  const delivery = c.deliveryConfig || {};
  const status = deriveCampaignStatus(c);
  const locked = c.lockStatus === "locked";
  const approved = c.approvalStatus === "approved";
  const configured = Boolean(delivery.scheduleMode);
  const hasAudience = Array.isArray(c.audienceRefs) && c.audienceRefs.length > 0;
  const mode = delivery.scheduleMode;
  const settled = status.key === "scheduled" || status.key === "active";

  const gate = (enabled, reason) => ({ enabled, reason: enabled ? null : reason });

  return {
    save: { key: "save", label: "Save Changes", ...gate(!locked, "Unlock the campaign to make changes.") },
    approve: { key: "approve", label: "Approve", ...gate(!locked && configured && hasAudience && !approved,
      locked ? "Unlock the campaign to make changes."
        : approved ? "This campaign is already approved."
        : !hasAudience ? "Choose who should receive this campaign."
        : "Choose when this campaign should send.") },
    lock: { key: "lock", label: "Lock Campaign", ...gate(approved && !locked,
      locked ? "This campaign is already locked." : "Approve the campaign before locking it.") },
    unlock: { key: "unlock", label: "Unlock", ...gate(locked && !settled,
      settled ? "Sends are already authorized for this campaign." : "This campaign isn’t locked yet.") },
    schedule: {
      key: "schedule", label: "Schedule",
      ...gate(locked && mode === "campaign_date" && isOwner && !settled,
        !isOwner ? OWNER_ONLY_MESSAGE
          : mode !== "campaign_date" ? "Scheduling applies to a single campaign date."
          : !locked ? "Lock the campaign before scheduling it."
          : "This campaign is already scheduled."),
    },
    activate: {
      key: "activate", label: "Activate",
      ...gate(locked && mode === "contact_saved_date" && isOwner && !settled,
        !isOwner ? OWNER_ONLY_MESSAGE
          : mode !== "contact_saved_date" ? "Activation applies to each contact’s saved date."
          : !locked ? "Lock the campaign before activating it."
          : "This campaign is already active."),
    },
  };
}

// The current member is the owner only when the SERVER says so. An absent field is not ownership.
export function isOrganizationOwner(orgContext, userId) {
  return Boolean(orgContext && userId && orgContext.currentOwnerUserId === userId);
}

// ── delivery-config request body ─────────────────────────────────────────────────────────────
// Built here so exactly one place decides the wire shape. maxSpendCents only — a bare maxSpend or
// amount is never produced, and the budget never travels anywhere it could be shown to a recipient.
export function buildDeliveryConfigBody({ scheduleMode, scheduledForUtc, occasionType, timeZone, giftType, curatedTierCents, overrides = [] } = {}) {
  const body = { scheduleMode };
  if (scheduleMode === "campaign_date") body.scheduledForUtc = scheduledForUtc || null;
  if (scheduleMode === "contact_saved_date") body.occasionType = occasionType || null;
  if (timeZone) body.timeZone = timeZone;
  body.defaultGift = giftType === "curated" ? { type: "curated", maxSpendCents: curatedTierCents } : null;
  body.recipientGiftOverrides = (Array.isArray(overrides) ? overrides : [])
    .map((o) => (o && o.action === "replace"
      ? { contactId: o.contactId, action: "replace", gift: { type: "curated", maxSpendCents: o.maxSpendCents } }
      : { contactId: o && o.contactId, action: "remove" }))
    .filter((o) => typeof o.contactId === "string" && o.contactId.length > 0);
  return body;
}
