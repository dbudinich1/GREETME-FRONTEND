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
