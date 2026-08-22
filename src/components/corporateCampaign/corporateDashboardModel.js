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
  // SLICE E5 - `abbr` is the at-a-glance tag shown beside a name wherever a mixed roster appears.
  // Three letters, because two ("EM"/"CL"/"VE") read as truncation rather than as a code.
  { key: "employee", label: "Employees", abbr: "EMP", description: "Employees, personnel, departments, and workplace contacts." },
  { key: "client", label: "Clients", abbr: "CLI", description: "Clients, customers, companies, and important customer contacts." },
  { key: "vendor", label: "Vendors", abbr: "VND", description: "Vendors, suppliers, service providers, and business partners." },
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
// SLICE E5 - read a persisted audience BACK into the selection that would produce it.
//
// The card previously could not tell a category-derived recipient from an individually picked one,
// so it fed the whole persisted list back as "individually selected" - and unchecking a category
// then removed nobody, because everyone in it was also, apparently, an individual pick. Verified
// before the change: check Employees, save, uncheck, and both employees remain.
//
// A category counts as checked only when EVERY current member of it is in the audience. The
// non-empty guard matters: without it a category with no members is vacuously "all selected" and
// the surface shows a ticked box representing nobody.
export function deriveAudienceSelection(contacts, audienceRefs) {
  const bucket = bucketContactsByCategory(contacts);
  const refs = new Set((Array.isArray(audienceRefs) ? audienceRefs : []).filter((id) => typeof id === "string" && id));
  const categories = CATEGORY_KEYS.filter((key) => {
    const members = bucket.byCategory[key];
    return members.length > 0 && members.every((c) => refs.has(c.id));
  });
  // Whoever a checked category already accounts for is not ALSO an individual pick; the remainder
  // is, and must survive a category being unchecked.
  const covered = new Set();
  for (const key of categories) for (const c of bucket.byCategory[key]) covered.add(c.id);
  return { categories, individualRefs: [...refs].filter((id) => !covered.has(id)) };
}

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

// SLICE E5 - the same fact as contactCategoryLabel, compressed to a tag.
//
// An unclassified contact gets an em dash, NOT a three-letter code. Inventing "UNC" would make the
// absence of a category look like a fourth category, which is the one thing this surface has been
// careful never to imply. The full word still travels with it as a title/aria-label, so the tag is
// a convenience for the eye and never the only way to know what a row is.
export function contactCategoryAbbr(contact) {
  const found = CONTACT_CATEGORIES.find((c) => c.key === (contact && contact.corporateContactType));
  return found ? found.abbr : "\u2014";
}

// ── gift capability ──────────────────────────────────────────────────────────────────────────
// Sourced from the same vocabulary the personal selector uses. Gift Card is absent because it does
// not exist as a type anywhere in the system — it is not "disabled", it is simply not a thing.
//
// QR Cash and Greet-Me Gifts stay VISIBLE and non-selectable. The capability contract is
// unchanged and still comes from the backend: services/corporateCampaign/deliveryConfig.js holds
// CORPORATE_AUTOMATABLE_GIFT_TYPES = ["curated"] as the only type a campaign may execute on its own.
//
// FINAL POLISH — the surface no longer prints an explanatory sentence beneath the two that a
// campaign cannot run. The founder's direction is that the sentence goes and is NOT replaced by an
// equivalent one, so this returns no reason text at all. Nothing about the contract softened: the
// options keep their real names, keep their bubbles, and remain disabled, which the platform
// communicates through the radio's own `disabled` state rather than through prose.

// ── F1C ADDENDUM — the standing note about gifts and payment ────────────────────────
//
// One quiet, permanent line beneath the campaign list. It is NOT a warning: nothing here is wrong,
// nothing is blocked, and no acknowledgement is asked for. It exists so that a reader configuring a
// gift campaign learns the payment requirement while they are calm and have time to act, rather
// than at the moment a send is refused.
//
// It stands whether or not the campaigns on screen include a gift, because the fact it states is
// about the account, not about any one campaign, and because a note that appears and disappears as
// cards change reads as an alert.
//
// THE LINK IS VERIFIED, NOT ASSUMED. Trace, checked before it was written:
//   • src/App.jsx:170            — <Route path="settings" element={<Settings />} /> under /dashboard
//   • src/App.jsx:131            — the app mounts a HashRouter, so the href is "#/dashboard/settings"
//   • pages/Settings.jsx         — handleManageBilling POSTs /api/payments/portal-session and sends
//                                   the reader to the returned Stripe portal URL
//   • routes/paymentRoutes.js:753 — router.post("/portal-session", requireAuth, …) exists server-side
// One nuance recorded rather than hidden: the "Manage Billing" button inside Settings renders only
// when `hasBillingRelationship` is true. The ROUTE is real and is the right destination, but a
// reader with no billing relationship yet will land on a Settings page without that button. That is
// a gap in Settings, not a dead link here, and it is reported rather than papered over.
export const GIFT_PAYMENT_DISCLOSURE = Object.freeze({
  text:
    "A quick note about gifts: Campaigns with gifts require a valid payment method before they can "
    + "be enabled. We’ll remind you ahead of each scheduled send if your payment information "
    + "needs attention.",
  linkLabel: "Review payment information",
  linkHref: "#/dashboard/settings",
});

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
  // An unknown value is a different case entirely: it names nothing a reader can see, so it stays
  // non-selectable and keeps its own short label. It is not one of the two real gifts above.
  if (!opt) return { selectable: false, reason: "Not available for campaigns" };
  // Selectable or not, no reason text is published for a REAL gift option.
  return { selectable: Boolean(opt.automatable), reason: null };
}

// ── schedule modes ───────────────────────────────────────────────────────────────────────────
export const SCHEDULE_MODES = Object.freeze([
  { value: "campaign_date", label: "One Campaign Date", description: "Everyone receives it at the same moment." },
  { value: "contact_saved_date", label: "Each Contact’s Saved Date", description: "Sends on each person’s own occasion, every year." },
]);

// ── the seasonal suggestion ──────────────────────────────────────────────────────────────────
// December 15 covers Christmas and Hanukkah in the same send, and lands before the week most
// offices empty out. It is offered, never applied: pre-filling a date would make every
// unconfigured campaign look edited the moment it loaded, and Save would light up over a choice
// nobody made. The reader takes it with one click or types their own.
export const SEASONAL_SUGGESTION = Object.freeze({
  monthDay: "12-15",
  label: "December 15",
  why: "Covers Christmas and Hanukkah, and lands before offices empty out.",
});

/**
 * The next December 15 at 09:00, in the shape <input type="datetime-local"> round-trips.
 *
 * `todayIso` is required rather than read from the clock, so the suggestion is a pure function of
 * its input and a test can ask for any year without waiting for one.
 */
export function suggestedSeasonalDateLocal(todayIso) {
  const today = String(todayIso || "");
  const year = Number(today.slice(0, 4));
  if (!Number.isFinite(year) || year < 1970) return null;
  // Past the date this year, the useful suggestion is next year's - offering a date that has
  // already gone by is offering nothing.
  const md = today.slice(5, 10);
  const targetYear = md > SEASONAL_SUGGESTION.monthDay ? year + 1 : year;
  return `${targetYear}-${SEASONAL_SUGGESTION.monthDay}T09:00`;
}

// ── SLICE F1 — the three permanent selectors ─────────────────────────────────────────────────
//
// Audience, Gift Options and Featured Spread are shown as three SUMMARIES that stay on screen
// whatever is open beneath them. The summary answers "what is this set to right now" and the
// detail panel is where it gets changed — so a reader never loses sight of the other two while
// deciding about one. Schedule is deliberately NOT one of the three: it is a different kind of
// question (when, not who/what) and keeps its existing place below.
export const SELECTOR_KEYS = Object.freeze(["audience", "gift", "spread"]);

/**
 * The three summary rows, derived from the DRAFT so an unsaved edit is reflected immediately.
 *
 * `value` is the current selection in the reader's words; `hint` is one short supporting line.
 * Nothing here is written as prose — every line is computed, so a summary cannot drift out of
 * step with the control that sets it.
 */
export function selectorSummaries({ draft, recipientCount = 0, spreadLabel } = {}) {
  const d = draft || {};
  const gift = CORPORATE_GIFT_OPTIONS.find((o) => o.value === d.giftType);
  return [
    {
      key: "audience",
      title: "Audience",
      icon: "\u{1F465}",
      value: recipientCount === 0 ? "Nobody yet" : `${recipientCount} ${recipientCount === 1 ? "contact" : "contacts"}`,
      hint: recipientCount === 0 ? "Choose who should receive this." : "Employees, clients, vendors or individuals.",
      complete: recipientCount > 0,
    },
    {
      key: "gift",
      title: "Gift Options",
      icon: "\u{1F381}",
      value: d.giftType === "curated" ? `Greet-Me\u2122 selects, up to ${centsToDisplay(d.tierCents)}` : "No gift",
      hint: d.giftType === "curated" ? "A thoughtful gift within your limit." : "The greeting on its own.",
      complete: true,               // "No gift" is a complete, deliberate answer
    },
    {
      key: "spread",
      title: "Featured Spread",
      icon: "\u{1F3A8}",
      value: spreadLabel || "Organization Default",
      hint: "How the card looks inside.",
      complete: true,
    },
  ];
}

// ── SLICE F1 — which lifecycle action to lead with ───────────────────────────────────────────
//
// Every capability stays reachable; only their PROMINENCE changes. Showing Approve, Lock, Unlock,
// Schedule and Activate as five equal buttons asks a reader to know the lifecycle before they can
// act. So the one valid next step leads, the other currently-valid ones stay available in a
// quieter row, and actions that are not valid yet are not rendered at all — an action that cannot
// be taken teaches nothing by being visible, and a disabled row of five reads as a broken screen.
//
// NOTHING is removed: `deriveActions` still computes all seven, and every enabled one is placed.
export function rankActions(actions, { scheduleMode } = {}) {
  const a = actions || {};

  // Schedule and Activate are MUTUALLY EXCLUSIVE by schedule mode — a campaign has one final
  // action, never both. Rendering the other has always been noise: it can never apply, and its
  // disabled reason ("Activation applies to each contact's saved date") explains a rule the
  // reader is not breaking.
  const finalKey = scheduleMode === "contact_saved_date" ? "activate" : "schedule";

  // The path a campaign actually walks. Unlock is NOT in it: unlocking is a way back, not a way
  // forward, so it can never be the thing to do next.
  // Save and Cancel are NOT in this list. They are the editor's commit and discard — always
  // present, enabled by whether there are unsaved changes — whereas this ranks the LIFECYCLE.
  // Mixing them made Save disappear on a locked campaign, which reads as the button being broken
  // rather than the campaign being frozen.
  const PATH = ["approve", "lock", finalKey];
  const primary = PATH.find((k) => a[k] && a[k].enabled === true) || null;

  // The step the reader is waiting on, rendered DISABLED so its reason is on screen. This is not
  // "exposing a future invalid action": a locked, owner-held campaign whose Schedule is refused by
  // the execution interlock IS the next step, and hiding it would imply that scheduling does not
  // exist rather than that it is not switched on yet.
  //
  // It is surfaced even when something else is enabled, because for a locked campaign the only
  // enabled action is Unlock — and leading with Unlock would tell a reader waiting to send that
  // the way forward is to undo.
  const blocked = PATH.filter((k) => k !== primary && a[k] && a[k].enabled === false && a[k].reason);
  const blockedNext = blocked.length ? blocked[blocked.length - 1] : null;

  // Everything else that is genuinely available, in a quieter row. Nothing is dropped.
  const secondary = ["approve", "lock", finalKey, "unlock"]
    .filter((k) => k !== primary && a[k] && a[k].enabled === true);

  return { primary, secondary, blockedNext, finalKey };
}

// ── what this campaign will actually do ──────────────────────────────────────────────────────
/**
 * A plain-language account of a campaign, DERIVED from the draft in front of the reader.
 *
 * Every line is computed from state, never written as prose, so the panel cannot drift out of
 * step with the settings it sits beside. It reads the DRAFT rather than the saved campaign, so
 * while there are unsaved changes it describes what saving them would do — which is the question
 * a reader actually has at that moment.
 *
 * It answers the recurrence question explicitly. Both schedule shapes now repeat annually, and
 * "every year" is the single fact most likely to be assumed wrongly in either direction.
 */
export function describeCampaignPlan({ draft, recipientCount = 0, orgName, enabled = true } = {}) {
  const d = draft || {};
  const rows = [];

  rows.push({
    key: "who",
    label: "Who",
    value: recipientCount === 0
      ? "Nobody yet — choose an audience."
      : `${recipientCount} ${recipientCount === 1 ? "contact" : "contacts"}`,
  });

  if (d.scheduleMode === "contact_saved_date") {
    const occasion = String(d.occasionType || "").replace(/-/g, " ") || "occasion";
    rows.push({ key: "when", label: "When", value: `On each contact's ${occasion} — every year.` });
  } else if (d.scheduledForLocal) {
    rows.push({ key: "when", label: "When", value: `${formatLocalDay(d.scheduledForLocal)} — every year.` });
  } else {
    rows.push({ key: "when", label: "When", value: "No date chosen yet." });
  }

  rows.push({
    key: "gift",
    label: "Gift",
    value: d.giftType === "curated"
      ? `Let Greet-Me\u2122 select, up to ${centsToDisplay(d.tierCents)} per person.`
      : "No gift — the greeting on its own.",
  });

  // The organization signs it, not the person who happened to set it up. Named here because it is
  // the detail most often assumed wrongly, and it is not visible anywhere else on the card.
  rows.push({ key: "from", label: "From", value: orgName ? `${orgName}` : "Your organization" });

  rows.push({
    key: "state",
    label: "Status",
    value: enabled
      ? "Switched on. It will keep sending until you switch it off."
      : "Switched off. Nothing will send.",
  });

  return rows;
}

/** "15 December" from the datetime-local shape, without importing a date library. */
export function formatLocalDay(local) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(local || ""));
  if (!m) return "No date chosen yet.";
  const MONTHS = ["January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"];
  const month = MONTHS[Number(m[2]) - 1];
  if (!month) return "No date chosen yet.";
  return `${Number(m[3])} ${month}`;
}

// ── overlapping audiences ────────────────────────────────────────────────────────────────────
/**
 * Contacts who would receive more than one campaign.
 *
 * A WARNING, never a block. Someone may genuinely belong in two campaigns, and the organization
 * is better placed than this surface to know whether that is a mistake. So it names names and the
 * campaigns involved, and then gets out of the way.
 *
 * Campaigns that are switched off are excluded: an overlap that cannot send is not an overlap.
 */
export function findAudienceOverlaps(campaigns, contacts) {
  const byId = new Map((Array.isArray(contacts) ? contacts : []).map((c) => [c && c.id, c]));
  const seen = new Map();
  for (const c of Array.isArray(campaigns) ? campaigns : []) {
    if (!c || isCampaignEnabled(c) === false) continue;
    const name = c.name || "Untitled campaign";
    for (const id of Array.isArray(c.audienceRefs) ? c.audienceRefs : []) {
      if (typeof id !== "string" || !id) continue;
      if (!seen.has(id)) seen.set(id, []);
      const list = seen.get(id);
      if (!list.includes(name)) list.push(name);
    }
  }
  const out = [];
  for (const [id, names] of seen) {
    if (names.length < 2) continue;
    const contact = byId.get(id);
    out.push({ contactId: id, name: (contact && contact.name) || "Unknown contact", campaigns: names });
  }
  // Most-overlapping first: if the list is long, the worst cases are the ones worth reading.
  return out.sort((a, b) => b.campaigns.length - a.campaigns.length || a.name.localeCompare(b.name));
}

/** One reader-facing line per overlapping contact: "Bob Smith — VIP and Birthdays". */
export function overlapLine(entry) {
  const names = entry.campaigns;
  const joined = names.length === 2
    ? `${names[0]} and ${names[1]}`
    : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
  return `${entry.name} \u2014 ${joined}`;
}

// ── SLICE F1C — which schedule shape a campaign actually uses ────────────────────────────────
//
// A campaign's schedule shape follows from WHAT IT IS, not from a question put to the reader.
// Season's Greetings happens on one date the organization picks; Employee Milestones and Client
// Birthdays happen on each contact's own saved date. Asking someone to choose between the two
// invited them to pick the mode that cannot work for their campaign, and then wonder why nobody
// was reachable.
//
// The persisted `deliveryConfig.scheduleMode` remains the AUTHORITY — this reads it and does not
// invent new backend semantics. Absent, a campaign falls to a single shared date, which is the
// mode that needs no per-contact data and therefore can never silently reach nobody.
export const SCHEDULE_SHAPES = Object.freeze({
  SHARED_DATE: "campaign_date",
  CONTACT_DATE: "contact_saved_date",
});

export function scheduleShapeOf(campaign) {
  const mode = campaign && campaign.deliveryConfig && campaign.deliveryConfig.scheduleMode;
  return mode === SCHEDULE_SHAPES.CONTACT_DATE ? SCHEDULE_SHAPES.CONTACT_DATE : SCHEDULE_SHAPES.SHARED_DATE;
}

/** How to describe the schedule to a reader, in the campaign's own terms. */
export function describeSchedule(campaign, draft) {
  const shape = scheduleShapeOf(campaign);
  if (shape === SCHEDULE_SHAPES.CONTACT_DATE) {
    const occasion = String((draft && draft.occasionType) || "occasion").replace(/-/g, " ");
    return {
      shape,
      heading: "What should Greet-Me do, and when?",
      summary: `Sends on each contact's ${occasion} \u2014 every year.`,
      showSharedDate: false,
      showOccasion: true,
    };
  }
  return {
    shape,
    heading: "What should Greet-Me do, and when?",
    summary: "Everyone receives it at the same moment, every year.",
    showSharedDate: true,
    showOccasion: false,
  };
}

// ── status ───────────────────────────────────────────────────────────────────────────────────
// Backend truth → concise human language. Scheduled and Active are read from the PERSISTED
// deliveryConfig.status; they are never inferred from a click. No raw enum, no "Ready to send",
// no "not_scheduled", no "proposed" ever reaches a reader.
// SLICE E5 - is the runtime switch on?
//
// ABSENT READS AS ON, matching the server exactly (`enabled: c.enabled !== false` in the list
// projection, `enabled === false` in the scheduler guard). A campaign stored before the switch
// existed kept running, so the surface must say it is running. This is the one place the default
// direction is decided; everything else asks this function.
export function isCampaignEnabled(campaign) {
  return (campaign || {}).enabled !== false;
}

export function deriveCampaignStatus(campaign) {
  const c = campaign || {};
  const delivery = c.deliveryConfig || {};

  // A campaign switched off says so before anything else. It is not a failure and not a warning -
  // it is a deliberate choice by the organization, and the reader needs to see it above whatever
  // approval state sits underneath, because that state is inert while the switch is off.
  if (!isCampaignEnabled(c)) {
    return { key: "off", label: "Off", tone: "muted", next: "Switched off. Turn it on to resume sending." };
  }

  // There is deliberately no "Paused" state here. A pause IS recorded by the backend — but on the
  // SCHEDULE document (scheduler.js writes schedule.corporateBlocker), never on the campaign. A
  // campaign-level pause would therefore have to be a rollup the backend does not compute, and a
  // status derived from a field nothing writes is a label that can only ever be wrong or absent.
  // When a rollup exists, it belongs here; until then the surface says nothing rather than guessing.
  if (delivery.status === "scheduled") return { key: "scheduled", label: "Scheduled", tone: "good", next: "Switched on. Sends are scheduled." };
  if (delivery.status === "active") return { key: "active", label: "Active", tone: "good", next: "Switched on. Running on each contact’s saved date." };
  if (c.lockStatus === "locked") return { key: "locked", label: "Locked", tone: "good", next: "Ready to switch on." };
  if (c.approvalStatus === "approved") return { key: "approved", label: "Approved", tone: "info", next: "Ready to switch on." };
  if (!delivery.scheduleMode || delivery.status === "not_configured") {
    return { key: "needs_setup", label: "Needs setup", tone: "warn", next: "Choose an audience and when it should send." };
  }
  if (c.approvalStatus === "changed") return { key: "attention", label: "Attention required", tone: "warn", next: "Changed since it was last switched on. Save to apply." };
  return { key: "draft", label: "Draft", tone: "info", next: "Set it up, then switch it on." };
}

// ── action footer ────────────────────────────────────────────────────────────────────────────
// Every action is always PRESENT. Enablement and the reason travel together, so a disabled control
// can always explain the missing prerequisite rather than sitting there inert.
export const OWNER_ONLY_MESSAGE = "Organization owner authorization required";

// SLICE E3 — what a viewer is told when the backend interlock is closed. Says the plain thing:
// sending is not switched on YET. Not "unavailable" (implies breakage), not "unsupported" or
// "not offered" (implies never), not "coming soon" (a promise this surface cannot make).
export const EXECUTION_DORMANT_MESSAGE = "Campaign sending is not active yet.";

export function deriveActions(campaign, { isOwner = false, canAuthorizeRun = false } = {}) {
  const c = campaign || {};
  const delivery = c.deliveryConfig || {};
  const status = deriveCampaignStatus(c);
  const locked = c.lockStatus === "locked";
  const approved = c.approvalStatus === "approved";
  const configured = Boolean(delivery.scheduleMode);
  const hasAudience = Array.isArray(c.audienceRefs) && c.audienceRefs.length > 0;
  const mode = delivery.scheduleMode;
  const settled = status.key === "scheduled" || status.key === "active";
  const enabled = isCampaignEnabled(c);

  const gate = (enabled, reason) => ({ enabled, reason: enabled ? null : reason });

  return {
    save: { key: "save", label: "Save Changes", ...gate(!locked, "Unlock the campaign to make changes.") },
    // SLICE E5 - ONE switch, and the two directions are NOT symmetric.
    //
    // Turning ON commits the organization to real sends against real money, so it demands the
    // prerequisites: an owner, an audience, and a configured schedule. Turning OFF demands only
    // ownership. That asymmetry is the whole point - a stop must never be blocked by the state of
    // the thing being stopped, or a misconfigured campaign becomes one that cannot be called back.
    //
    // Deliberately NOT gated on canAuthorizeRun. `enabled` records INTENT and sends nothing by
    // itself; the execution interlock is a separate line the server still holds. Gating intent on
    // execution would leave an organization unable to switch a campaign off during dormancy.
    toggle: {
      key: "toggle",
      label: enabled ? "On" : "Off",
      on: enabled,
      // What the NEXT click would do - which is what a reader is deciding about.
      nextLabel: enabled ? "Turn off" : "Turn on",
      ...(enabled
        ? gate(isOwner, OWNER_ONLY_MESSAGE)
        : gate(isOwner && configured && hasAudience,
          !isOwner ? OWNER_ONLY_MESSAGE
            : !hasAudience ? "Choose who should receive this campaign."
            : "Choose when this campaign should send.")),
    },
    approve: { key: "approve", label: "Approve", ...gate(!locked && configured && hasAudience && !approved,
      locked ? "Unlock the campaign to make changes."
        : approved ? "This campaign is already approved."
        : !hasAudience ? "Choose who should receive this campaign."
        : "Choose when this campaign should send.") },
    lock: { key: "lock", label: "Lock Campaign", ...gate(approved && !locked,
      locked ? "This campaign is already locked." : "Approve the campaign before locking it.") },
    unlock: { key: "unlock", label: "Unlock", ...gate(locked && !settled,
      settled ? "Sends are already authorized for this campaign." : "This campaign isn’t locked yet.") },
    // SLICE E3 — the two owner-only actions now ALSO require the server's execution capability.
    // Ordering of the reasons is deliberate: ownership is checked first and is never displaced by
    // dormancy, because "you are not the owner" stays true whatever the interlock says, and a
    // non-owner must not be told the interlock is the thing standing in their way.
    schedule: {
      key: "schedule", label: "Schedule",
      ...gate(canAuthorizeRun && locked && mode === "campaign_date" && isOwner && !settled,
        !isOwner ? OWNER_ONLY_MESSAGE
          : !canAuthorizeRun ? EXECUTION_DORMANT_MESSAGE
          : mode !== "campaign_date" ? "Scheduling applies to a single campaign date."
          : !locked ? "Lock the campaign before scheduling it."
          : "This campaign is already scheduled."),
    },
    activate: {
      key: "activate", label: "Activate",
      ...gate(canAuthorizeRun && locked && mode === "contact_saved_date" && isOwner && !settled,
        !isOwner ? OWNER_ONLY_MESSAGE
          : !canAuthorizeRun ? EXECUTION_DORMANT_MESSAGE
          : mode !== "contact_saved_date" ? "Activation applies to each contact’s saved date."
          : !locked ? "Lock the campaign before activating it."
          : "This campaign is already active."),
    },
  };
}

/**
 * SLICE D CLOSEOUT — read the AUTHORITATIVE owner capability from the campaign-list response.
 *
 * The backend compares the caller against organization.currentOwnerUserId and publishes the answer
 * as `viewerAuthorization.isCurrentOrganizationOwner`. This reads that and nothing else — it does
 * not fall back to a membership role, which is a different fact and was only ever an approximation.
 *
 * STRICT `=== true`, so it FAILS CLOSED: an absent envelope, an old server that does not send the
 * field, a dormant/unauthorized response, or any truthy-but-not-true value all yield false. A
 * surface that wrongly believes you are the owner enables an action the server will refuse; one
 * that wrongly believes you are not shows a truthful message and costs a click.
 */
export function readViewerOwnerCapability(listRes) {
  return listRes?.data?.viewerAuthorization?.isCurrentOrganizationOwner === true;
}

/**
 * SLICE E3 — read the AUTHORITATIVE execution capability from the same campaign-list response.
 *
 * The backend derives this from the one shared reader that gates POST /schedule and POST /activate
 * and publishes it as the envelope sibling `executionAvailability.canAuthorizeRun`. This reads that
 * and nothing else. It does not infer, remember, or reconstruct the answer, and it never consults a
 * flag name — the server owns the fact.
 *
 * STRICT `=== true`, so it FAILS CLOSED on every degraded shape: an older server that omits the
 * envelope, a dormant/unauthorized/failed/thrown response, a truthy-but-not-true value, or a
 * malformed body. A surface that wrongly believes it may authorize a run offers a button that can
 * only fail; one that wrongly believes it may not costs a support question. Only one of those is
 * recoverable by the reader.
 */
export function readExecutionCapability(listRes) {
  return listRes?.data?.executionAvailability?.canAuthorizeRun === true;
}

// ── delivery-config request body ─────────────────────────────────────────────────────────────
// Built here so exactly one place decides the wire shape. maxSpendCents only — a bare maxSpend or
// amount is never produced, and the budget never travels anywhere it could be shown to a recipient.
// SLICE E5 - THE EDIT BUFFER.
//
// Everything a reader can change on a card, gathered into one value. Two reasons it is one object
// rather than seven pieces of component state: "has anything changed?" becomes a single
// comparison, and Cancel becomes a single assignment instead of seven that could drift apart.
//
// Audience is INCLUDED. It used to be saved the instant a box was ticked, which would have made
// Cancel a lie - it would restore the schedule and the gift while leaving the audience already
// changed on the server. A bail-out has to undo everything the reader did, or it undoes nothing
// they can rely on.
export function buildCampaignDraft(campaign, contacts) {
  const c = campaign || {};
  const d = c.deliveryConfig || {};
  const { categories, individualRefs } = deriveAudienceSelection(contacts, c.audienceRefs);
  return {
    categories,
    individualRefs,
    giftType: d.defaultGift ? d.defaultGift.type : "none",
    tierCents: d.defaultGift && d.defaultGift.maxSpendCents ? d.defaultGift.maxSpendCents : CURATED_TIERS_CENTS[0],
    scheduleMode: d.scheduleMode || "campaign_date",
    // The <input type="datetime-local"> shape, which is what the field round-trips.
    scheduledForLocal: d.scheduledForUtc ? String(d.scheduledForUtc).slice(0, 16) : "",
    occasionType: d.occasionType || "birthday",
    timeZone: d.timeZone || "America/New_York",
  };
}

// A stable, order-independent identity for a draft. Sorted, because two audiences holding the same
// people in a different order are the same audience - and a Save button that lights up because a
// list came back re-ordered teaches a reader to ignore it.
export function draftFingerprint(draft) {
  const d = draft || {};
  return JSON.stringify([
    [...(d.categories || [])].sort(),
    [...(d.individualRefs || [])].sort(),
    d.giftType, d.giftType === "curated" ? d.tierCents : null,
    d.scheduleMode,
    d.scheduleMode === "campaign_date" ? d.scheduledForLocal : null,
    d.scheduleMode === "contact_saved_date" ? d.occasionType : null,
    d.timeZone,
  ]);
}

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
