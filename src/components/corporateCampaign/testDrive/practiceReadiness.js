// src/components/corporateCampaign/testDrive/practiceReadiness.js
//
// TEAM UX — Corporate Dashboard Test Drive. Pure, framework-free readiness check for a PRACTICE
// contact, reusing the EXISTING delivery-address rule from src/import/corporateAddressStatus.js
// (the same rule the Import Wizard's preview already applies to an uploaded row) rather than
// inventing a new one. No email/birthday/relationship-detail rule exists anywhere else in this
// codebase to reuse, so this file deliberately checks ONLY the mailing address a campaign with a
// physical (curated) gift type actually requires — see the audit this session that confirmed no
// broader per-contact readiness concept exists yet.

import { corporateAddressStatus, isPhysicalGiftEligible, ADDRESS_REQUIRED } from "../../../import/corporateAddressStatus.js";

const FIELD_LABEL = Object.freeze({
  line1: "street address", line2: "address line 2", city: "city",
  state: "state/province", zip: "postal/ZIP code", country: "country",
});

/**
 * Whether `campaign`'s configured gift actually requires a mailing address at all. Curated gifts are
 * physical (shipped); a giftless or "none" campaign has no delivery requirement to check.
 */
export function campaignRequiresAddress(campaign) {
  const gift = campaign && campaign.deliveryConfig && campaign.deliveryConfig.defaultGift;
  return !!gift && gift.type && gift.type !== "none";
}

/**
 * A practice contact's readiness for `campaign`, reusing corporateAddressStatus() verbatim.
 * Returns null when the contact is fully ready (or the campaign has no address requirement at all)
 * — callers show a warning only when this is non-null, so a ready contact renders no badge.
 */
export function practiceContactWarning(contact, campaign) {
  if (!campaignRequiresAddress(campaign)) return null;
  const result = corporateAddressStatus(contact && contact.shippingAddress);
  if (isPhysicalGiftEligible(result.status)) return null;   // ready — nothing to warn about
  const missing = result.missing && result.missing.length ? result.missing : ADDRESS_REQUIRED;
  const fields = missing.map((k) => FIELD_LABEL[k] || k);
  return {
    status: result.status,
    label: result.label,
    missingFields: fields,
    message: result.status === "absent"
      ? "Missing mailing address — required for this campaign's gift."
      : `Missing ${fields.join(", ")} — required for this campaign's gift.`,
  };
}

/** Recompute warnings for every contact against `campaign`; returns a Map keyed by contact.id. */
export function computeWarnings(contacts, campaign) {
  const out = new Map();
  for (const c of contacts || []) {
    const w = practiceContactWarning(c, campaign);
    if (w) out.set(c.id, w);
  }
  return out;
}
