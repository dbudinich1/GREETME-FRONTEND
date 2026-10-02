// Contact Sales client rules, written against Team 2's route design (POST /api/contact-sales):
//   body   { name, email, message, source, organization?, phone?, pageContext?, website (hidden honeypot, '' from a person) }
//   200    { ok:true, received:true } | { ok:true, received:true, duplicate:true }
//   400    { ok:false, code:'CONTACT_SALES_INVALID', field }
//   429 limiter | 503 CONTACT_SALES_UNAVAILABLE | 502 CONTACT_SALES_SEND_FAILED
// RULE: a success state is shown ONLY for a real 200 whose body says ok:true AND received:true. Everything else is a
// visible failure that keeps what the person typed and lets them try again.

export const CONTACT_SALES_PATH = '/api/contact-sales';
export const SOURCES = ['business', 'corporate', 'fundraiser', 'partner', 'general'];
// The ONE place the sales address lives in the UI. It appears only inside failure messages (founder 2026-10-02; the
// founder wrote "info@greet-me", .com assumed and still to be confirmed).
export const CONTACT_SALES_FALLBACK_ADDRESS = 'info@greet-me.com';

export const LIMITS = { name: 100, email: 254, message: 2000, messageMin: 5, organization: 150, phone: 40, pageContext: 100 };

/** Source for each Hero "Learn More" card. Marketplace Partner Programs = partner, every other Hero card = corporate. */
export function contactEntryForHeroCard(card) {
  const key = card && card.key;
  return {
    source: key === 'marketplace_partners' ? 'partner' : 'corporate',
    pageContext: `Hero: ${(card && card.title) || 'Hero'}`,
  };
}
export const FOR_BUSINESS_ENTRY = Object.freeze({ source: 'business', pageContext: 'For Business' });
export const PRICING_ENTERPRISE_ENTRY = Object.freeze({ source: 'business', pageContext: 'Pricing: Enterprise' });
/** Interim Gifted Subscription Bundles entry (W21): an honest request to talk to sales, not a purchase, no price. */
export const GIFTED_BUNDLES_INTRO = 'This is a request to talk with our team. It is not a purchase: no price is shown and nothing is charged.';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[0-9+()\-. ]*$/;
const clean = (v) => String(v ?? '').replace(/[\u0000-\u001f\u007f]+/g, ' ').trim();

export const EMPTY_FORM = { name: '', email: '', organization: '', phone: '', message: '' };

/** Client-side checks that mirror the server's rules. Returns {field: message}. */
export function validate(form) {
  const f = form || {};
  const errors = {};
  const name = clean(f.name), email = clean(f.email), org = clean(f.organization), phone = String(f.phone ?? '').trim();
  const message = String(f.message ?? '').trim();
  if (!name) errors.name = 'Please enter your name.';
  else if (name.length > LIMITS.name) errors.name = `Please use ${LIMITS.name} characters or fewer.`;
  if (!email) errors.email = 'Please enter your email address.';
  else if (email.length > LIMITS.email || !EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.';
  if (message.length < LIMITS.messageMin) errors.message = 'Please tell us a little about what you need.';
  else if (message.length > LIMITS.message) errors.message = `Please keep your message under ${LIMITS.message} characters.`;
  if (org.length > LIMITS.organization) errors.organization = `Please use ${LIMITS.organization} characters or fewer.`;
  if (phone && (phone.length > LIMITS.phone || !PHONE_RE.test(phone))) errors.phone = 'Please use digits and + ( ) - . only.';
  return errors;
}

/** The exact request body. `website` is the honeypot: '' from a real person (the field is invisible). */
export function buildBody({ form, source, pageContext, website = '' }) {
  const body = {
    name: clean(form.name), email: clean(form.email), message: String(form.message ?? '').trim(),
    source: SOURCES.includes(source) ? source : 'general',
    website: String(website ?? ''), // filled only by a bot; the server drops those
  };
  const org = clean(form.organization), phone = String(form.phone ?? '').trim(), ctx = clean(pageContext).slice(0, LIMITS.pageContext);
  if (org) body.organization = org;
  if (phone) body.phone = phone;
  if (ctx) body.pageContext = ctx;
  return body;
}

const RETRY = (message) => ({ kind: 'retry', message });
/**
 * Turn what actually came back into ONE outcome. `res` is {status, body} or {networkError:true}.
 *   success   a real 200 with ok:true and received:true
 *   duplicate a real 200 with duplicate:true (it WAS received earlier; nothing was sent again)
 *   invalid   400 CONTACT_SALES_INVALID (field named when the server names it)
 *   retry     429 / 502 / 503 / network / anything unexpected: visible failure, retry allowed
 */
export function interpretResponse(res) {
  const addr = CONTACT_SALES_FALLBACK_ADDRESS;
  if (!res || res.networkError) return RETRY(`We could not reach Greet-Me. Please check your connection and try again, or email ${addr}.`);
  const { status, body } = res;
  if (status === 200 && body && body.ok === true && body.received === true) {
    return body.duplicate === true ? { kind: 'duplicate' } : { kind: 'success' };
  }
  if (status === 400 && body && body.code === 'CONTACT_SALES_INVALID') {
    return { kind: 'invalid', field: typeof body.field === 'string' ? body.field : null };
  }
  if (status === 429) return RETRY(`You have sent several requests recently. Please wait a while and try again, or email ${addr}.`);
  if (status === 502 || (body && body.code === 'CONTACT_SALES_SEND_FAILED')) return RETRY(`We could not send your message just now. Nothing was sent. Please try again, or email ${addr}.`);
  if (status === 503 || (body && body.code === 'CONTACT_SALES_UNAVAILABLE')) return RETRY(`Our contact form is unavailable right now. Please try again later, or email ${addr}.`);
  // 200 without received:true, a 5xx, a 404 (route not deployed), a malformed body: never treated as success.
  return RETRY(`We could not confirm that your message was received. Please try again, or email ${addr}.`);
}

export const FIELD_MESSAGES = {
  name: 'Please check your name.', email: 'Please check your email address.', message: 'Please check your message.',
  organization: 'Please check your organization.', phone: 'Please check your phone number.', source: 'Something went wrong with this form. Please try again.', pageContext: 'Something went wrong with this form. Please try again.',
};
