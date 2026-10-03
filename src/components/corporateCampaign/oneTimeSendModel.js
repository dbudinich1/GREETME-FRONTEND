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
export const FINAL_BUTTON_LABEL = "Send now — this is final";
export const FINAL_NOTE = "This sends right away and cannot be cancelled once you confirm.";

/** The review request body. `gift`: null for no gift, else the canonical { type, maxSpendCents }. */
export function buildPreviewRequest({ who, category, contactId, gift, excludeFeaturedSpread, skipNotReady }) {
  const recipients = who === "single" ? { contactId } : { category };
  return {
    recipients,
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
  needs_organization_name: "Add your organization\u2019s name first: it appears as the sender.",
  provider_quote_unavailable: "We can\u2019t get a price for that gift right now. Please try again shortly.",
  quote_not_authoritative: "We can\u2019t confirm the price for that gift right now. Nothing was charged.",
  quote_changed: "The price changed since you reviewed. Nothing was charged. Please review again.",
  send_in_progress: "Your earlier press is still being processed. Press again in a moment: it will not send twice.",
  funding_declined: "Your card was declined. Nothing was sent.",
  funding_authentication_required: "Your bank needs to confirm this card. Nothing was sent.",
  funding_incomplete: "The payment didn\u2019t complete. Nothing was sent.",
  contact_not_found: "That person is no longer in your contacts.",
  review_out_of_date: "Things changed since you reviewed. Please review again.",
});
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

export function giftPayload(giftType, tierCents) {
  if (giftType === "curated") return { type: "curated", maxSpendCents: tierCents };
  return null; // "none" -> no gift
}

export function totalLine(gift) {
  if (!gift || !gift.requiresPayment) return null;
  if (!Number.isSafeInteger(gift.totalCents)) return null;
  return `${money(gift.totalCents)} will be charged to your saved card at the moment of sending.`;
}

/** Can the owner press the final button right now? */
export function canConfirm(preview, { busy }) {
  if (busy || !preview) return false;
  if (preview.canSend === true) return true;
  return false;
}
