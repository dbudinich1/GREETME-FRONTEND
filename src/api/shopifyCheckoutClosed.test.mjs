// src/api/shopifyCheckoutClosed.test.mjs
//
// THE LEGACY SHOPIFY CHECKOUT CANNOT BE REACHED FROM THIS CLIENT.
//
// Greet-Me takes payment through Stripe. The server refuses POST /api/gifts/checkout before it
// builds a cart permalink; this proves the browser cannot even ask, and that no shipped page
// tries to.
//
// Run: node --test src/api/shopifyCheckoutClosed.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_SRC = fs.readFileSync(path.join(SRC_DIR, 'api/api.js'), 'utf8');

/** Every shipped source file — tests excluded, because a test naming a thing is not a caller. */
function shippedFiles(dir = SRC_DIR, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) { shippedFiles(full, out); continue; }
    if (!/\.(js|jsx)$/.test(entry.name)) continue;
    if (/\.test\.(js|jsx|mjs)$/.test(entry.name)) continue;
    out.push(full);
  }
  return out;
}

test('the client method refuses locally, without issuing a request', async () => {
  // Imported for its shape only: constructing the real client would pull in import.meta.env.
  const body = API_SRC.slice(API_SRC.indexOf('startGiftCheckout()'));
  const method = body.slice(0, body.indexOf('\n  }') + 4);
  assert.ok(/throw new Error/.test(method), 'it must refuse rather than return a promise');
  assert.ok(!/this\.post|this\.request|fetch\(/.test(method), 'and refuse WITHOUT a network call');
  assert.ok(/Stripe-based/.test(method), 'saying what to use instead');
});

test('no shipped page or component calls it', () => {
  const callers = shippedFiles()
    .filter((f) => !f.endsWith(path.join('api', 'api.js')))
    .filter((f) => /startGiftCheckout/.test(fs.readFileSync(f, 'utf8')));
  assert.deepEqual(callers, [], `nothing may call the closed checkout: ${callers.join(', ')}`);
});

test('no shipped file builds or navigates to a Shopify cart permalink', () => {
  const offenders = [];
  for (const file of shippedFiles()) {
    const src = fs.readFileSync(file, 'utf8');
    if (/myshopify\.com|\/cart\/\$\{|buildCartPermalink|checkoutUrl/.test(src)) offenders.push(file);
  }
  assert.deepEqual(offenders, [], `no shipped file may reach a Shopify checkout: ${offenders.join(', ')}`);
});
