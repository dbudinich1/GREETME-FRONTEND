// Founder decisions on Surface 6 (2026-10-02): pricing/checkout copy states the renewal and the one-time platform fee;
// the Hearts Marketplace category select is constrained to its container (appearance only).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUBSCRIPTION_RENEWAL_NOTICE, PLATFORM_FEE_ONE_TIME_NOTICE } from './subscriptionTerms.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const src = (rel) => fs.readFileSync(path.join(here, '..', rel), 'utf8');

test('the exact founder wording', () => {
  assert.equal(SUBSCRIPTION_RENEWAL_NOTICE, 'Subscription automatically renews until cancelled.');
  assert.match(PLATFORM_FEE_ONE_TIME_NOTICE, /platform fee is charged one time only, even if you later upgrade to a Business plan\.$/);
  assert.doesNotMatch(`${SUBSCRIPTION_RENEWAL_NOTICE} ${PLATFORM_FEE_ONE_TIME_NOTICE}`, /\$\d|markup|at cost/i, 'no amount (the fee amount comes from the server) and no markup wording');
});

test('Pricing, Cart and Checkout all render both notices from the single source', () => {
  for (const f of ['pages/Pricing.jsx', 'pages/Cart.jsx', 'pages/Checkout.jsx']) {
    const s = src(f);
    assert.match(s, /from '\.\.\/utils\/subscriptionTerms'/, f);
    assert.match(s, /\{SUBSCRIPTION_RENEWAL_NOTICE\} \{PLATFORM_FEE_ONE_TIME_NOTICE\}/, f);
  }
  assert.match(src('pages/Pricing.jsx'), /data-testid="pricing-subscription-terms"/);
  assert.match(src('pages/Pricing.jsx'), /data-testid="pricing-added-terms"/);
  assert.match(src('pages/Cart.jsx'), /cartItems\.some\(\(item\) => item\.type === 'subscription'\)[\s\S]{0,200}cart-subscription-terms/, 'only when a subscription is in the cart');
  assert.match(src('pages/Checkout.jsx'), /subscriptionItem && \([\s\S]{0,120}checkout-subscription-terms/);
});

test('the Hearts Marketplace category select is constrained inline (global select{width:100%} no longer fills the row)', () => {
  const s = src('components/hub/HubRedeemMarketplace.jsx');
  const block = s.slice(s.indexOf('aria-label="Filter marketplace by category"'), s.indexOf('</select>'));
  assert.match(block, /width: 'auto'/);
  assert.match(block, /maxWidth: '100%'/);
  assert.match(block, /minWidth: 0/);
  assert.doesNotMatch(block, /flexShrink: 0/);
  assert.match(s, /flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between'/);
  assert.match(block, /onChange=\{\(e\) => setCategoryKey\(e\.target\.value\)\}/, 'behavior unchanged');
});

test('Impact per-send consent: the founder-approved sentence, shown at checkout only for the Impact plan (business_scale)', async () => {
  const { IMPACT_PER_SEND_CONSENT_NOTICE } = await import('./subscriptionTerms.js');
  assert.equal(IMPACT_PER_SEND_CONSENT_NOTICE, 'Each Greet-Me you send on the Impact plan is charged $2.99 to the card on your subscription.');
  const s = src('pages/Checkout.jsx');
  assert.match(s, /import \{ SUBSCRIPTION_RENEWAL_NOTICE, PLATFORM_FEE_ONE_TIME_NOTICE, IMPACT_PER_SEND_CONSENT_NOTICE \} from '\.\.\/utils\/subscriptionTerms'/);
  assert.match(s, /subscriptionItem\?\.planTier === 'business_scale' && \([\s\S]{0,160}data-testid="checkout-impact-per-send-consent"[\s\S]{0,200}\{IMPACT_PER_SEND_CONSENT_NOTICE\}/);
  assert.equal(s.match(/IMPACT_PER_SEND_CONSENT_NOTICE/g).length, 2, 'imported once, rendered once');
});

test('Impact per-send consent is checkout-only (founder 2026-10-09): no other page renders it', () => {
  const pages = path.join(here, '..', 'pages');
  const hits = [];
  const walk = (d) => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p); else if (/\.jsx?$/.test(e.name) && !/\.test\./.test(e.name) && fs.readFileSync(p, 'utf8').includes('IMPACT_PER_SEND_CONSENT_NOTICE')) hits.push(path.relative(pages, p)); } };
  walk(pages);
  assert.deepEqual(hits, ['Checkout.jsx']);
});
