// src/components/corporateCampaign/oneTimeSendModel.js
//
// SURFACE 8 (founder-decided 2026-10-03) - the pure model behind "Send a Greet-Me now" on the corporate
// dashboard. Rules encoded here, and only here:
//   * Corporate dashboard only; the OWNER only (the caller hides the entry for anyone else).
//   * Recipients are ONE category or ONE contact. There is no recipient cap.
//   * Each recipient uses one Greet-Me from the business plan. If the plan is short, NOTHING is sent and the
//     reader sees how many they are short, with top-up and upgrade links.
//   * No approve / lock step: the confirm button on the review screen is the approval, it says it is final,
//     and there is no cancel.
//   * A paid gift is charged at the moment of sending, with the saved card, at the total shown on the review.
//   * The send uses the owner's own photo and voice. "Exclude Featured Spread" is an owner option.
// The five-option Featured Spread spec is a POST-LAUNCH item and is deliberately not modelled here.
// No React, no DOM, no fetch.

const money = (cents) => `$${(cents / 100).toFixed(2)}`;

export { money };
export const TOP_UP_HREF = "#/dashboard/animations";
export const UPGRADE_HREF = "#/pricing";
export const OCCASIONS = Object.freeze([
  ["birthday", "Birthday"], ["anniversary", "Anniversary"], ["graduation", "Graduation"], ["getwell", "Get well"],
  ["new_year", "New Year"], ["valentines", "Valentine’s Day"], ["mothers_day", "Mother’s Day"], ["fathers_day", "Father’s Day"],
  ["thanksgiving", "Thanksgiving"], ["christmas", "Christmas"], ["easter", "Easter"], ["rosh_hashanah", "Rosh Hashanah"],
  ["hanukkah", "Hanukkah"], ["passover", "Passover"], ["eid_al_fitr", "Eid al-Fitr"], ["eid_al_adha", "Eid al-Adha"], ["ramadan", "Ramadan"],
].map(([value, label]) => Object.freeze({ value, label })));
export const isOccasion = (v) => OCCASIONS.some((o) => o.value === v);

/** In-app (HashRouter) href for a backend link { path, url }; falls back to the known route. */
export function linkHref(link, fallback) {
  const path = link && typeof link.path === "string" && link.path.startsWith("/") ? link.path : null;
  return path ? `#${path}` : fallback;
}

export const FINAL_BUTTON_LABEL = "Send now — this is final";
export const FINAL_NOTE = "This sends right away and cannot be cancelled once you confirm.";

/** The review request body. `gift`: null for no gift, else the canonical { type, maxSpendCents }. */
export function buildPreviewRequest({ who, category, contactId, occasionType, gift, excludeFeaturedSpread, skipNotReady }) {
  const recipients = who === "single" ? { contactId } : { category };
  return {
    recipients,
    occasionType,
    gift: gift || null,
    excludeFeaturedSpread: excludeFeaturedSpread === true,
    skipNotReady: skipNotReady === true,
  };
}

/** The send body: the review body plus what the owner actually saw, and the idempotency key. */
export function buildSendRequest(previewRequest, preview, idempotencyKey) {
  const body = {
    ...previewRequest,
    idempotencyKey,
    expectedRecipientCount: preview.recipients.count,
  };
  const total = preview.gift && Number.isSafeInteger(preview.gift.totalCents) ? preview.gift.totalCents : null;
  if (preview.gift && preview.gift.requiresPayment && total !== null) body.expectedTotalCents = total;
  return body;
}

export function newIdempotencyKey() {
  const rnd = (typeof crypto !== "undefined" && crypto.randomUUID) ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `onetime-${rnd}`.slice(0, 128);
}

/** "You are 2 short" wording for the plan line. */
export function planLine(plan) {
  if (!plan) return null;
  const n = plan.required;
  const uses = `This uses ${n} Greet-Me${n === 1 ? "" : "s"} from your plan (one per person). You have ${plan.available}.`;
  if (plan.shortfall > 0) return { text: `${uses} You are ${plan.shortfall} short, so nothing will be sent.`, short: true, shortfall: plan.shortfall };
  return { text: uses, short: false, shortfall: 0 };
}

/** Plain-language text for a blocker / refusal code (the server's stable codes). Unknown codes get a generic line. */
const BLOCKER_TEXT = Object.freeze({
  corporate_campaign_execution_disabled: "Sending isn’t switched on yet.",
  no_recipients: "There is nobody to send to.",
  recipients_not_ready: "Some people are missing details and can’t be included.",
  plan_shortfall: "Your plan doesn’t hold enough Greet-Mes for everyone.",
  capacity_unavailable: "We can’t check your plan right now. Please try again in a moment.",
  needs_default_photo: "Add your profile photo first: every Greet-Me includes your photo.",
  needs_authorized_voice: "Your voice needs to be set up first: every Greet-Me uses your voice.",
  idempotency_key_reused: "That send was already used for a different request. Please review again.",
  saved_card_required: "A saved card is needed for this gift. Add one below.",
  no_business_plan: "Your account doesn\u2019t have a business plan that can send.",
  corporate_plan_unmetered: "We can\u2019t count Greet-Mes on this plan, so it can\u2019t send from here yet.",
  needs_owner_name: "Add your name to your profile first: it appears in the sender line, for example “Jane Smith, Acme Co.”",
  needs_organization_name: "Add your organization\u2019s name first: it appears as the sender.",
  provider_quote_unavailable: "We can\u2019t get a price for that gift right now. Please try again shortly.",
  quote_not_authoritative: "We can\u2019t confirm the price for that gift right now. Nothing was charged.",
  quote_changed: "The price changed since you reviewed. Nothing was charged. Please review again.",
  send_in_progress: "Your earlier press is still being processed. Press again in a moment: it will not send twice.",
  funding_declined: "Your card was declined. Nothing was sent.",
  funding_authentication_required: "Your bank needs to confirm this card. Nothing was sent.",
  // Founder 2026-10-28: an incomplete or unrecorded charge may still have gone through, so the reader is told it is being
  // confirmed and is NOT invited to pay again (PAYMENT_UNCERTAIN_TEXT).
  funding_incomplete: "We\u2019re confirming your payment. Don\u2019t submit another payment yet.",
  funding_storage_failed: "We\u2019re confirming your payment. Don\u2019t submit another payment yet.",
  // The three refusals of a second payment attempt (corporateFundingEntry RETRY_REFUSAL), each saying what is true.
  replacement_card_required: "This card was already tried for this send and won\u2019t be charged again. If your card statement shows a charge for it, don\u2019t add a different card: contact support. If it shows no charge, add a different card, then review again.",
  prior_attempt_may_still_complete: "Your bank is still processing the earlier payment for this send. Don\u2019t submit another payment yet.",
  prior_attempt_state_unknown: "We can\u2019t yet confirm whether the earlier payment for this send went through. Don\u2019t submit another payment yet.",
  occasion_required: "Choose the occasion first.",
  invalid_occasion_type: "Choose one of the listed occasions.",
  contact_not_found: "That person is no longer in your contacts.",
  review_out_of_date: "Things changed since you reviewed. Please review again.",
  // Gift box (founder 2026-10-28): the existing campaign quote and catalog refusals, in plain words. Nothing is charged
  // while any of these stands.
  catalog_product_not_published: "That gift box is no longer available. Choose another one.",
  product_selection_missing: "Choose a gift box first.",
  variants_invalid: "Choose the options this gift box needs, then review again. Nothing was charged.",
  quote_request_failed: "We couldn’t get a price for that gift box. Check the chosen options and addresses, then try again. Nothing was charged.",
  quote_missing: "We couldn’t get a price for that gift box. Nothing was charged.",
  recipient_quote_missing: "We couldn’t get a price for everyone. Nothing was charged.",
  quote_recipient_mismatch: "We couldn’t confirm the price for that gift box. Nothing was charged.",
  quote_total_unsafe: "We couldn’t confirm the price for that gift box. Nothing was charged.",
  currency_unsupported: "That gift box can’t be paid for in US dollars. Nothing was charged.",
  recipient_address_invalid: "Someone’s mailing address is incomplete. Update it, then review again.",
  no_eligible_recipients: "Nobody selected has a mailing address for a gift box.",
});
/** Founder 2026-10-28 wording for a paid send whose payment outcome is not yet known. */
export const PAYMENT_UNCERTAIN_TEXT = "We\u2019re confirming your payment. Don\u2019t submit another payment yet.";
/** Server codes after which a charge may have happened: shown as PAYMENT_UNCERTAIN_TEXT, with the review's key kept. */
export const PAYMENT_UNCERTAIN_CODES = Object.freeze(["funding_incomplete", "funding_storage_failed"]);

export function blockerText(code) {
  return BLOCKER_TEXT[code] || "This can’t be sent yet. Please check the details and try again.";
}

/** Why a recipient was left out (reason codes from the server). */
export function notReadyText(b) {
  if (!b) return "";
  if (b.reason === "missing_recipient_email") return "no email address";
  if (b.message) return String(b.message);
  return b.field ? `missing ${b.field}` : "missing details";
}

export function giftPayload(giftType, tierCents, qrCashAmountCents = null, product = null, variants = []) {
  if (giftType === "curated") return { type: "curated", maxSpendCents: tierCents };
  // Gift box (founder 2026-10-28): the campaign editor's own selection, in the backend's campaign shape - the spend
  // limit, the ONE catalog item exactly as the catalog returned it, and the chosen option labels. With no box chosen
  // it serializes NO gift rather than a half-made one.
  if (giftType === "gift_boxes") {
    const id = product && typeof product.providerProductId === "string" ? product.providerProductId.trim() : "";
    if (!id) return null;
    return { type: "gift_boxes", maxSpendCents: tierCents, product, variants: (Array.isArray(variants) ? variants : []).filter((v) => typeof v === "string" && v.trim() !== "") };
  }
  // RELEASE 2 - QR Cash (dormant: only reachable while the option is selectable). Whole dollars in CENTS under an
  // explicit-unit name; an invalid or missing amount serializes NO gift rather than a half-made one.
  if (giftType === "qrcash") {
    return Number.isSafeInteger(qrCashAmountCents) && qrCashAmountCents >= 500 && qrCashAmountCents <= 10000 && qrCashAmountCents % 100 === 0
      ? { type: "qrcash", qrCashAmountCents } : null;
  }
  return null; // "none" -> no gift
}

export function totalLine(gift) {
  if (!gift || !gift.requiresPayment) return null;
  if (!Number.isSafeInteger(gift.totalCents)) return null;
  return `${money(gift.totalCents)} will be charged to your saved card at the moment of sending.`;
}

/**
 * Each person's cost from the server's review, in the order the review lists them. Only amounts the server returned
 * are shown; a person with no returned amount is left out rather than shown at $0.
 */
export function perRecipientCosts(preview) {
  const per = preview && preview.gift && preview.gift.perRecipient;
  const list = preview && preview.recipients && Array.isArray(preview.recipients.list) ? preview.recipients.list : [];
  if (!per || typeof per !== "object") return [];
  return list
    .filter((r) => per[r.contactId] && Number.isSafeInteger(per[r.contactId].totalCents))
    .map((r) => ({ contactId: r.contactId, name: r.name || "Unnamed", totalCents: per[r.contactId].totalCents }));
}

/** Can the owner press the final button right now? */
export function canConfirm(preview, { busy }) {
  if (busy || !preview) return false;
  if (preview.canSend === true) return true;
  return false;
}

// ── Founder 2026-10-28: an UNRESOLVED paid send survives closing, reopening and refresh ──────────────────────────────
// After a paid send whose payment outcome is unknown, the exact request (and so its idempotency key) is kept for the
// organisation in this browser, and the flow reopens on it, locked, until the payment is resolved. Pressing Send again
// can then only reach the SAME send and the SAME payment. A new send (a new key) is possible only once the payment is
// proven not taken, or the send went through.
export const PENDING_STORAGE_PREFIX = "gm_sendnow_pending_v1:";
/** Server codes after which the payment is not yet known: the send is kept as pending, Send stays disabled. */
export const UNRESOLVED_PAYMENT_CODES = Object.freeze([
  "funding_incomplete", "funding_storage_failed", "prior_attempt_may_still_complete", "prior_attempt_state_unknown",
]);
export const pendingKeyFor = (orgId) => `${PENDING_STORAGE_PREFIX}${orgId}`;

const isPendingRecord = (v, orgId) => Boolean(v) && v.v === 1 && v.orgId === orgId
  && typeof v.idempotencyKey === "string" && v.idempotencyKey !== ""
  && v.sendBody && typeof v.sendBody === "object" && v.sendBody.idempotencyKey === v.idempotencyKey;

export function buildPendingRecord({ orgId, sendBody, display, at }) {
  return { v: 1, orgId, idempotencyKey: sendBody.idempotencyKey, sendBody, display: display || {}, at: at || null };
}
export function loadPending(storage, orgId) {
  try {
    const raw = storage && storage.getItem(pendingKeyFor(orgId));
    const v = raw ? JSON.parse(raw) : null;
    return isPendingRecord(v, orgId) ? v : null;
  } catch { return null; }
}
export function savePending(storage, record) {
  try { if (storage) storage.setItem(pendingKeyFor(record.orgId), JSON.stringify(record)); return true; } catch { return false; }
}
export function clearPending(storage, orgId) {
  try { if (storage) storage.removeItem(pendingKeyFor(orgId)); } catch { /* nothing stored */ }
}

/** The send's id, exactly as the server derives it (oneTimeSend.js campaignIdFor). Null when hashing is unavailable. */
export async function oneTimeSendIdFor(orgId, idempotencyKey, subtle = (typeof globalThis !== "undefined" && globalThis.crypto && globalThis.crypto.subtle) || null) {
  if (!subtle || typeof subtle.digest !== "function") return null;
  const digest = await subtle.digest("SHA-256", new TextEncoder().encode(`one-time-send:${orgId}:${idempotencyKey}`));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return `campaign_ot_${hex.slice(0, 32)}`;
}

/**
 * How long the ORIGINAL request may still be running at the server after the screen lost its answer (Team 5 M4). Until
 * then "no such send yet" is not proof of no charge: the request may not have written its record yet.
 */
export const SEND_IN_FLIGHT_MS = 10 * 60 * 1000;

/** The read-only status answer, as one of: sent | confirmed | not_charged | processing | unknown | check_failed.
 *  `sinceMs`: how long ago the kept send was made (unknown -> treated as recent). */
export function paymentStateFromStatus(res, { sinceMs = null } = {}) {
  if (!res || res.ok !== true) return "check_failed";
  const r = res.result || {};
  if (r.notFound === true) return Number.isFinite(sinceMs) && sinceMs >= SEND_IN_FLIGHT_MS ? "not_charged" : "processing";
  if (r.stage === "scheduled") return "sent";
  const state = r.payment && typeof r.payment.state === "string" ? r.payment.state : null;
  if (state === "confirmed" || state === "not_charged" || state === "processing" || state === "unknown") return state;
  if (state === "not_required") return "not_charged";
  return "unknown";
}
/** Only these let the owner press Send again (with the same key). */
export const RESOLVED_FOR_SEND = Object.freeze(["confirmed", "not_charged"]);

export const PAYMENT_STATUS_TEXT = Object.freeze({
  sent: "This send went through.",
  confirmed: "Your payment is confirmed. Press Send now to finish sending this Greet-Me; you won\u2019t be charged again.",
  not_charged: "No payment was taken for this send. You can send it again (you may be asked for a different card), or start over.",
  processing: "Your bank is still processing this payment. Don\u2019t submit another payment yet.",
  unknown: "We can\u2019t confirm this payment yet. Don\u2019t submit another payment yet.",
  check_failed: "We couldn\u2019t check the payment right now. Try again in a moment.",
});
