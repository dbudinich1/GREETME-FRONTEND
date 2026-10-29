// src/utils/businessContactEdit.js
//
// BIZ-EDIT-1 (Team 6, 2026-10-29) — editing ONE business contact without losing what the owner did not touch.
//
// The Business roster on the Recipients page is the campaign-audience projection (id, name, category, month-day
// dates, readiness booleans): no email, no delivery names, no full dates. Opening Edit on it and saving sent the
// typed email, `occasions: []`, `firstName: ""` and `lastName: ""`, and PATCH /api/corporate-contacts/.../contacts/:id
// applies every field that is present (routes/corporateContactsRoutes.js handleUpdateCorporateContact), so the
// email was replaced, every occasion cleared and the confirmed delivery names blanked.
//
// So the editor is filled from the FULL stored record (the owner-only management read, listManaged), and the save
// sends ONLY the fields that differ from that record. A field the owner did not change is never in the request,
// so the server keeps its stored value. When the full record cannot be read, nothing is offered that could write.

import { formatPersonName } from './formatPersonName.js';

// The address fields the server stores (services/corporate/addressMeta.js ADDRESS_KEYS).
const ADDRESS_KEYS = ['line1', 'line2', 'city', 'state', 'zip', 'country'];
const str = (v) => (typeof v === 'string' ? v.trim() : '');

/**
 * Read the stored record for one business contact. Never throws.
 * @returns {Promise<{ok:true, record:object}|{ok:false, notFound?:boolean, unauthorized?:boolean}>}
 */
export async function loadBusinessContactForEdit(client, orgId, contactId) {
  if (!client || typeof client.listManaged !== 'function' || !orgId || !contactId) return { ok: false };
  let res;
  try { res = await client.listManaged(orgId); } catch { return { ok: false }; }
  // 401/403: this viewer may not manage the organization's contacts (said plainly, not "try again").
  if (res && res.unauthorized === true) return { ok: false, unauthorized: true };
  if (!res || res.ok !== true || !Array.isArray(res.contacts)) return { ok: false };
  const record = res.contacts.find((c) => c && String(c.id) === String(contactId));
  if (!record) return { ok: false, notFound: true };
  // The editor relies on these being what the server stored; a malformed row is not a safe base for a write.
  if (typeof record.name !== 'string' || typeof record.email !== 'string') return { ok: false };
  return { ok: true, record };
}

/** The stored record in the shape ContactForm fills itself from (the same fields the personal records use). */
export function businessRecordForForm(record) {
  const r = record || {};
  return {
    id: r.id,
    name: r.name || '',
    email: r.email || '',
    firstName: r.firstName || '',
    lastName: r.lastName || '',
    occasions: (Array.isArray(r.occasions) ? r.occasions : [])
      .filter((o) => o && typeof o.type === 'string' && typeof o.date === 'string')
      .map((o) => ({ ...(o.id ? { id: o.id } : {}), type: o.type, date: o.date, autoSend: o.autoSend === true })),
    ...(r.shippingAddress && typeof r.shippingAddress === 'object' && !Array.isArray(r.shippingAddress)
      ? { shippingAddress: { ...r.shippingAddress } } : {}),
  };
}

const occasionKey = (list) => JSON.stringify((Array.isArray(list) ? list : [])
  .filter(Boolean)
  .map((o) => [o.id || null, str(o.type), str(o.date), o.autoSend === true]));

const addressOf = (a) => {
  const src = a && typeof a === 'object' && !Array.isArray(a) ? a : {};
  const out = {};
  for (const k of ADDRESS_KEYS) out[k] = str(src[k]);
  return out;
};
// No street, city, state or zip: no address (a country on its own is the form's default, not an address).
const addressEmpty = (a) => ADDRESS_KEYS.filter((k) => k !== 'country').every((k) => !a[k]);
const sameAddress = (a, b) => (addressEmpty(a) && addressEmpty(b)) || ADDRESS_KEYS.every((k) => a[k] === b[k]);
// The defaults ContactForm puts into an address field the stored record does not have (getInitialFormData: country
// 'United States'). Founder 2026-10-29: such a default is never a change, so an untouched save never sends the address of a
// record stored without that key (it would replace the stored address and send a verified one back to review).
const FORM_ADDRESS_DEFAULTS = Object.freeze({ country: 'United States' });
const withoutFormDefaults = (stored, form) => {
  const src = stored && typeof stored === 'object' && !Array.isArray(stored) ? stored : {};
  const out = { ...form };
  for (const [k, v] of Object.entries(FORM_ADDRESS_DEFAULTS)) if (!str(src[k]) && form[k] === v) out[k] = '';
  return out;
};

/**
 * The PATCH body for a business-contact edit: only what the owner changed against the stored `record`.
 * Fields the business record does not hold (relationship, gifts, photos, ...) are never sent.
 * An empty object means nothing changed.
 */
export function businessContactPatch(record, formData, { nameTyped = true } = {}) {
  const r = record || {};
  const f = formData || {};
  const patch = {};

  // Any difference from the STORED name that the owner typed is sent, a capitalisation fix included (Team 5 S2). The one
  // difference the owner did not type is the form's own capitalisation on blur (`nameTyped` false): that alone is not sent (S1).
  const name = str(f.name);
  const onlyTidiedOnBlur = !nameTyped && name === formatPersonName(r.name || '');
  if (name !== str(r.name) && !onlyTidiedOnBlur) patch.name = name;
  if (str(f.email) !== str(r.email)) patch.email = str(f.email);
  if (str(f.firstName) !== str(r.firstName)) patch.firstName = str(f.firstName);
  if (str(f.lastName) !== str(r.lastName)) patch.lastName = str(f.lastName);

  if (occasionKey(f.occasions) !== occasionKey(r.occasions)) {
    patch.occasions = (Array.isArray(f.occasions) ? f.occasions : []).filter(Boolean)
      .map((o) => ({ ...(o.id ? { id: o.id } : {}), type: str(o.type), date: str(o.date), autoSend: o.autoSend === true }));
  }

  const before = addressOf(r.shippingAddress);
  const after = addressOf(f.shippingAddress);
  // Delivery names and address are sent ONLY when they differ from what is stored. They are often not on screen (they show
  // inside a shipped gift's delivery block), and a hidden or untouched field is never sent; neither is the delivery phone.
  if (!sameAddress(before, withoutFormDefaults(r.shippingAddress, after))) {
    // An emptied address is an explicit clear (null); a changed one replaces the stored one, keeping its delivery phone.
    patch.shippingAddress = addressEmpty(after) ? null : after;
    if (!addressEmpty(after) && str(r.deliveryPhone)) patch.deliveryPhone = str(r.deliveryPhone);
  }
  return patch;
}

// Loading, failed and not-found: PROPOSED copy, pending founder approval.
export const BUSINESS_EDIT_LOADING_TEXT = 'Loading this contact’s saved details…';
export const BUSINESS_EDIT_FAILED_TEXT = 'We couldn’t load this contact’s saved details, so it can’t be edited right now. Nothing was changed. Close this and try again.';
// Copy APPROVED by the founder 2026-10-29.
export const BUSINESS_EDIT_FORBIDDEN_TEXT = 'You don’t have access to edit this contact.';
export const BUSINESS_EDIT_NOT_FOUND_TEXT = 'This contact is no longer in your business contacts. Nothing was changed.';
