// src/components/corporateCampaign/contactManageModel.js
//
// SURFACE 8 (founder-approved 2026-10-03) - the pure model behind "Manage" on a corporate category tile:
// add ONE contact, edit it with the SAME field set, and archive ("Remove") it.
//
// Founder decisions encoded here, and nowhere else:
//   * READY = a name and a valid email. That is all. A birthday only matters for a birthday send and an
//     address only matters for a physical gift, so those are surfaced where they are needed (the address
//     as a quiet row note, never a gate).
//   * ADDRESS is optional everywhere. Nothing in this file ever produces an error for a missing address.
//   * Add and Edit share ONE field set (EMPTY_FORM / fromContact / toPayload), so they cannot drift.
//   * The category of an ADD is fixed by the tile it was opened from.
// No React, no DOM, no fetch.

import { campaignsContainingContact, deleteWarningLine } from "../../api/corporateContacts.js";

export const EMPTY_ADDRESS = Object.freeze({ line1: "", line2: "", city: "", state: "", zip: "", country: "United States" });
export const EMPTY_FORM = Object.freeze({
  name: "", firstName: "", lastName: "", email: "", phone: "", company: "", department: "", notes: "",
  birthday: "", anniversary: "", address: EMPTY_ADDRESS,
});

export const ADDRESS_ADVISORY =
  "An address is needed to send a physical gift to this person. You can add it now or later; nothing is blocked if you leave it empty.";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const OCCASION_FIELDS = Object.freeze({ birthday: "birthday", anniversary: "anniversary" });

const str = (v) => (typeof v === "string" ? v : "");
const trim = (v) => str(v).trim();

export const hasAddress = (c) => Boolean(c && c.shippingAddress && typeof c.shippingAddress === "object"
  && (trim(c.shippingAddress.line1) || trim(c.shippingAddress.city) || trim(c.shippingAddress.zip)));

/** READY means a name and a valid email. Nothing else counts. */
export function isContactReady(c) {
  if (!c) return false;
  // The server states readiness as a boolean on both reads (roster `ready`, management `readiness.ready`): trust it
  // when present, otherwise compute the same rule from the fields.
  if (typeof c.ready === "boolean") return c.ready;
  if (c.readiness && typeof c.readiness.ready === "boolean") return c.readiness.ready;
  return Boolean(trim(c.name) && EMAIL_RE.test(trim(c.email)));
}
export const readinessOf = (c) => (isContactReady(c)
  ? { ready: true, label: "Ready" }
  : { ready: false, label: "Needs a name and email" });

/** { ready, needs } over a list. */
export function readinessCounts(list) {
  const rows = Array.isArray(list) ? list : [];
  const ready = rows.filter(isContactReady).length;
  return { total: rows.length, ready, needs: rows.length - ready };
}

function occasionDate(contact, type) {
  const list = Array.isArray(contact && contact.occasions) ? contact.occasions : [];
  const found = list.find((o) => o && o.type === type && DATE_RE.test(str(o.date)));
  return found ? found.date : "";
}

/** A stored (full) contact -> the form's draft. */
export function fromContact(contact) {
  const c = contact || {};
  const a = (c.shippingAddress && typeof c.shippingAddress === "object") ? c.shippingAddress : {};
  return {
    name: str(c.name), firstName: str(c.firstName), lastName: str(c.lastName), email: str(c.email), phone: str(c.phone), company: str(c.company),
    department: str(c.department), notes: str(c.notes),
    birthday: occasionDate(c, OCCASION_FIELDS.birthday),
    anniversary: occasionDate(c, OCCASION_FIELDS.anniversary),
    address: {
      line1: str(a.line1), line2: str(a.line2), city: str(a.city), state: str(a.state), zip: str(a.zip),
      country: str(a.country) || EMPTY_ADDRESS.country,
    },
  };
}

/**
 * Validation shared by Add and Edit. The address is OPTIONAL: no rule here ever refers to it.
 * `selfId` excludes the contact being edited from the duplicate check.
 */
export function validateContact(draft, contacts, selfId = null) {
  const d = draft || {};
  const errors = {};
  if (!trim(d.name)) errors.name = "A name is required.";
  if (!EMAIL_RE.test(trim(d.email))) errors.email = "That email doesn’t look right.";
  for (const k of Object.keys(OCCASION_FIELDS)) {
    if (trim(d[k]) && !DATE_RE.test(trim(d[k]))) errors[k] = "Use a full date, for example 1988-06-12.";
  }
  if (!errors.email) {
    const wanted = trim(d.email).toLowerCase();
    const clash = (Array.isArray(contacts) ? contacts : []).find((c) => c && c.id !== selfId && trim(c.email).toLowerCase() === wanted);
    if (clash) errors.email = "Someone with that email is already here.";
  }
  return errors;
}

function normalizedAddress(address) {
  const a = address || {};
  const out = {
    line1: trim(a.line1), line2: trim(a.line2), city: trim(a.city), state: trim(a.state), zip: trim(a.zip),
    country: trim(a.country) || EMPTY_ADDRESS.country,
  };
  return (out.line1 || out.line2 || out.city || out.state || out.zip) ? out : null;
}

/**
 * The request body for POST (add) and PATCH (edit). `existing` is the stored contact when editing: its other
 * occasions are kept (the server REPLACES the whole list on PATCH), only birthday and anniversary are set from
 * the form. An empty address is sent as null so a previously stored one can be cleared.
 */
export function toPayload(draft, { category, existing = null } = {}) {
  const d = draft || {};
  const kept = (existing && Array.isArray(existing.occasions) ? existing.occasions : [])
    .filter((o) => o && !Object.values(OCCASION_FIELDS).includes(o.type));
  const occasions = [...kept];
  for (const [field, type] of Object.entries(OCCASION_FIELDS)) {
    if (trim(d[field])) occasions.push({ type, date: trim(d[field]) });
  }
  const body = {
    name: trim(d.name), firstName: trim(d.firstName), lastName: trim(d.lastName), email: trim(d.email), phone: trim(d.phone), company: trim(d.company),
    department: trim(d.department), notes: trim(d.notes), occasions,
    shippingAddress: normalizedAddress(d.address),
  };
  if (category) body.corporateContactType = category;
  return body;
}

/** The archive confirmation copy: what Remove does, plus the campaigns that currently include the contact. */
export function archiveCopy(contact, campaigns) {
  const names = campaignsContainingContact(campaigns, contact && contact.id);
  return {
    question: `Remove ${contact && contact.name ? contact.name : "this contact"}?`,
    detail: "This archives the contact: they are taken out of your lists and will not receive future sends.",
    warning: deleteWarningLine(contact && contact.name, names),
    scheduledWarning: names.length > 0
      ? "They will be left out of those campaigns from now on."
      : null,
  };
}

/** Plain-language message for a failed contact write. */
export function writeFailureMessage(res) {
  if (res && res.notFound) return "That contact no longer exists. The list has been refreshed.";
  if (res && res.error === "invalid_shipping_address") return "That address doesn\u2019t look right. Check it and try again.";
  if (res && res.error === "shipping_address_field_too_long") return "One of the address lines is too long.";
  if (res && res.error === "invalid_contact_type") return "That category isn\u2019t valid.";
  if (res && res.conflict && res.error === "email_archived") return "A contact you removed earlier has that email. You can restore them instead.";
  if (res && res.conflict) return "Someone with that email is already here.";
  if (res && res.dormant) return "Business contacts aren’t available yet.";
  if (res && res.unauthorized) return "You don’t have access to change business contacts.";
  if (res && res.error === "valid_email_required") return "That email doesn’t look right.";
  if (res && res.error === "name_required") return "A name is required.";
  return "That didn’t go through. Please try again.";
}
