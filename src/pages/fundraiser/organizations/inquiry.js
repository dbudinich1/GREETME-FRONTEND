// src/pages/fundraiser/organizations/inquiry.js
// The organization inquiry's request rules (founder handoff 2026-10-28). It uses the application's existing, authorized
// inquiry route — POST /api/contact-sales with the accepted source "fundraiser" — through utils/contactSales.js.
//   * The route has no organization-type field, so the type travels in pageContext ("Fundraising page: <type>") and at
//     the top of the message ("Organization type: <type>"); the route requires a message of 5+ characters, which that
//     line always provides when the person leaves the optional message empty.
import { buildBody, LIMITS } from '../../../utils/contactSales.js';

export const INQUIRY_SOURCE = 'fundraiser';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** The message the route receives: the organization type first, then the person's optional note. */
export function composeInquiryMessage(orgType, note) {
  const extra = String(note || '').trim();
  return `Organization type: ${orgType}${extra ? `\n\n${extra}` : ''}`;
}

/** The exact request body for POST /api/contact-sales. `honeypot` is '' from a person. */
export function buildInquiryBody(form, honeypot = '') {
  return buildBody({
    form: { name: form.name, email: form.email, organization: form.organization, message: composeInquiryMessage(form.orgType, form.message) },
    source: INQUIRY_SOURCE,
    pageContext: `Fundraising page: ${form.orgType}`,
    website: honeypot,
  });
}

/** Client checks that mirror the route's rules (name, organization and email are required here); { field: message }. */
export function validateInquiry(form) {
  const e = {};
  const name = String(form.name || '').trim(), org = String(form.organization || '').trim(), email = String(form.email || '').trim();
  if (!name) e.name = 'Please add your name.';
  else if (name.length > LIMITS.name) e.name = `Please use ${LIMITS.name} characters or fewer.`;
  if (!org) e.organization = 'Please add your organization.';
  else if (org.length > LIMITS.organization) e.organization = `Please use ${LIMITS.organization} characters or fewer.`;
  if (!email) e.email = 'Please add an email we can reply to.';
  else if (email.length > LIMITS.email || !EMAIL_RE.test(email)) e.email = 'Please enter a valid email address.';
  if (composeInquiryMessage(form.orgType, form.message).length > LIMITS.message) e.message = 'Please shorten your message a little.';
  return e;
}
