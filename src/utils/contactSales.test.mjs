// Contact Sales (W22), Hero -> For Business link (W23), bundle interim (W21): rules and source-level guarantees.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  validate, buildBody, interpretResponse, SOURCES, LIMITS, EMPTY_FORM, CONTACT_SALES_FALLBACK_ADDRESS,
  contactEntryForHeroCard, FOR_BUSINESS_ENTRY, PRICING_ENTERPRISE_ENTRY, GIFTED_BUNDLES_INTRO,
} from './contactSales.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (rel) => fs.readFileSync(path.join(here, '..', rel), 'utf8');
const GOOD = { name: 'Dana Lee', email: 'dana@example.com', organization: 'Acme', phone: '(555) 123-4567', message: 'We want gifts for 40 people.' };

test('validation mirrors the server rules', () => {
  assert.deepEqual(validate(GOOD), {});
  assert.deepEqual(Object.keys(validate(EMPTY_FORM)).sort(), ['email', 'message', 'name']);
  assert.ok(validate({ ...GOOD, email: 'nope' }).email);
  assert.ok(validate({ ...GOOD, message: 'hi' }).message);
  assert.ok(validate({ ...GOOD, message: 'x'.repeat(LIMITS.message + 1) }).message);
  assert.ok(validate({ ...GOOD, phone: 'call me' }).phone);
});

test('the request body is exactly the contract; honeypot empty for a person; an unknown source never leaves the page', () => {
  assert.deepEqual(buildBody({ form: GOOD, source: 'business', pageContext: 'For Business' }),
    { name: 'Dana Lee', email: 'dana@example.com', message: 'We want gifts for 40 people.', source: 'business', website: '', organization: 'Acme', phone: '(555) 123-4567', pageContext: 'For Business' });
  assert.deepEqual(Object.keys(buildBody({ form: { ...GOOD, organization: '', phone: '' }, source: 'corporate' })).sort(), ['email', 'message', 'name', 'source', 'website']);
  assert.equal(buildBody({ form: GOOD, source: 'bogus' }).source, 'general');
  assert.equal(buildBody({ form: GOOD, source: 'business', website: 'spam' }).website, 'spam');
  assert.doesNotMatch(buildBody({ form: { ...GOOD, name: 'Dana\r\nBcc: x@y.z' }, source: 'general' }).name, /[\r\n]/);
  assert.ok(!('employeeCount' in buildBody({ form: { ...GOOD, employeeCount: '51-200' }, source: 'general' })), 'Number of Employees is dropped');
});

test('success ONLY for a real 200 that says received; everything else is a visible failure or a field error', () => {
  assert.equal(interpretResponse({ status: 200, body: { ok: true, received: true } }).kind, 'success');
  assert.equal(interpretResponse({ status: 200, body: { ok: true, received: true, duplicate: true } }).kind, 'duplicate');
  for (const bad of [
    { status: 200, body: { ok: true } }, { status: 200, body: null }, { status: 200, body: { ok: false, received: true } },
    { status: 201, body: { ok: true, received: true } }, { status: 404, body: {} }, { status: 500, body: {} },
    { status: 502, body: { code: 'CONTACT_SALES_SEND_FAILED' } }, { status: 503, body: { code: 'CONTACT_SALES_UNAVAILABLE' } },
    { status: 429, body: {} }, { networkError: true }, null, undefined,
  ]) {
    const r = interpretResponse(bad);
    assert.notEqual(r.kind, 'success', JSON.stringify(bad));
    assert.notEqual(r.kind, 'duplicate', JSON.stringify(bad));
  }
  assert.deepEqual(interpretResponse({ status: 400, body: { ok: false, code: 'CONTACT_SALES_INVALID', field: 'email' } }), { kind: 'invalid', field: 'email' });
  for (const res of [{ status: 429, body: {} }, { status: 502, body: {} }, { status: 503, body: {} }, { networkError: true }, { status: 404, body: {} }]) {
    const r = interpretResponse(res);
    assert.equal(r.kind, 'retry');
    assert.ok(r.message.includes(CONTACT_SALES_FALLBACK_ADDRESS), 'failure text gives the other way in');
  }
  assert.match(interpretResponse({ status: 502, body: {} }).message, /Nothing was sent/);
});

test('sources per button: Hero cards corporate (partners = partner), For Business and Pricing = business', () => {
  assert.ok(SOURCES.includes('corporate') && SOURCES.includes('partner') && SOURCES.includes('business'));
  assert.deepEqual(contactEntryForHeroCard({ key: 'gifted_bundles', title: 'Gifted Subscription Bundles' }), { source: 'corporate', pageContext: 'Hero: Gifted Subscription Bundles' });
  assert.equal(contactEntryForHeroCard({ key: 'white_label', title: 'White Label Services' }).source, 'corporate');
  assert.equal(contactEntryForHeroCard({ key: 'marketplace_partners', title: 'Marketplace Partner Programs' }).source, 'partner');
  assert.deepEqual({ ...FOR_BUSINESS_ENTRY }, { source: 'business', pageContext: 'For Business' });
  assert.deepEqual({ ...PRICING_ENTERPRISE_ENTRY }, { source: 'business', pageContext: 'Pricing: Enterprise' });
  assert.match(GIFTED_BUNDLES_INTRO, /not a purchase/);
  assert.doesNotMatch(GIFTED_BUNDLES_INTRO, /\$\d/, 'no price');
});

test('the sales address lives in ONE constant and nowhere else in the app source', () => {
  assert.equal(CONTACT_SALES_FALLBACK_ADDRESS, 'info@greet-me.com');
  const hits = [];
  const walk = (d) => { for (const n of fs.readdirSync(d, { withFileTypes: true })) {
    const f = path.join(d, n.name);
    if (n.isDirectory()) { if (n.name !== 'node_modules') walk(f); }
    else if (/\.(jsx?|mjs)$/.test(n.name) && !/\.test\.mjs$/.test(n.name) && fs.readFileSync(f, 'utf8').includes('info@greet-me')) hits.push(path.relative(path.join(here, '..'), f).replace(/\\/g, '/'));
  } };
  walk(path.join(here, '..'));
  assert.deepEqual(hits, ['utils/contactSales.js']);
});

test('no fake success is left: no Thank You stub, no 24-hour promise, no alert, no auto-close timer, no Number of Employees', () => {
  for (const f of ['components/ContactSalesModal.jsx', 'pages/HeroProgram.jsx', 'pages/ForBusiness.jsx', 'pages/Pricing.jsx']) {
    const s = src(f);
    assert.doesNotMatch(s, /within 24 hours/i, f);
    assert.doesNotMatch(s, /Thank You!/, f);
    assert.doesNotMatch(s, /Number of Employees/i, f);
    assert.doesNotMatch(s, /enterpriseFormData|handleEnterpriseSubmit/, f);
  }
  const modal = src('components/ContactSalesModal.jsx');
  assert.doesNotMatch(modal, /setTimeout/);
  assert.doesNotMatch(modal, /console\.log\(/);
  assert.match(modal, /api\.contactSales\(/);
  assert.doesNotMatch(src('pages/Pricing.jsx'), /alert\('Thank you! Our sales team/);
});

test('every Contact Sales entry passes its source: Hero card, For Business, Pricing Enterprise, bundles interim', () => {
  const hero = src('pages/HeroProgram.jsx');
  assert.match(hero, /\{\.\.\.contactEntryForHeroCard\(contactCard\)\}/);
  assert.match(hero, /intro=\{contactCard\?\.key === 'gifted_bundles' \? GIFTED_BUNDLES_INTRO : null\}/);
  assert.match(hero, /onOpenContact\(item\)/);
  assert.match(src('pages/ForBusiness.jsx'), /\{\.\.\.FOR_BUSINESS_ENTRY\}/);
  assert.match(src('pages/Pricing.jsx'), /\{\.\.\.PRICING_ENTERPRISE_ENTRY\}/);
  assert.match(src('pages/Pricing.jsx'), /<ContactSalesModal[\s\S]{0,80}isOpen=\{showEnterpriseForm\}/);
});

test('W23: one link from Hero to For Business; "Merch" is never customer-visible on Hero, For Business or the form; W20 flag unchanged', () => {
  const hero = src('pages/HeroProgram.jsx');
  assert.match(hero, /data-testid="hero-for-business-link"/);
  assert.match(hero, /navigate\('\/business'\)/);
  assert.match(hero, /See how For Business works with Hero/);
  assert.match(hero, /const HERO_RECOGNITION_RANKING_LIVE = false;/);
  for (const f of ['pages/HeroProgram.jsx', 'pages/ForBusiness.jsx', 'components/ContactSalesModal.jsx']) {
    const lines = src(f).split('\n').filter((l) => /\bmerch/i.test(l) && !/^\s*(\/\/|\*|\{\/\*)/.test(l));
    assert.deepEqual(lines, [], `${f} shows "Merch"`);
  }
});
