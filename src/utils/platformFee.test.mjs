// src/utils/platformFee.test.mjs — W18 display rules + W42/Prezzee source locks.
// Run: node --test src/utils/platformFee.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  interpretPlatformFeeStatus, platformFeeFor, formatFeeAmount, FEE_STATE_PENDING, FEE_STATE_UNKNOWN,
} from "./platformFee.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel) => fs.readFileSync(path.join(here, "..", rel), "utf8").replace(/\r\n/g, "\n");

const NEW = { ok: true, policy: "one_per_account", consumer: { feeCents: 499, applies: true, reason: "initial_activation", listFeeCents: 499 }, business: { feeCents: 1999, applies: true, reason: "initial_activation", listFeeCents: 1999 } };
const RETURNING = { ok: true, policy: "one_per_account", consumer: { feeCents: 0, applies: false, reason: "already_authorized", listFeeCents: 499 }, business: { feeCents: 0, applies: false, reason: "already_authorized", listFeeCents: 1999 } };

test("one fee per account: a first-time account sees $4.99 (Personal) and $19.99 (Business), both from the server", () => {
  const st = interpretPlatformFeeStatus(NEW, { authenticated: true });
  assert.deepEqual(st, { status: "known", consumerFee: 4.99, applies: true, businessFee: 19.99, businessApplies: true });
  assert.equal(formatFeeAmount(platformFeeFor({}, false, st)), "$4.99");
  assert.equal(formatFeeAmount(platformFeeFor({}, true, st)), "$19.99");
});

test("one fee per account: a returning account has fee 0 on BOTH tiers (no fee line, plan-only total), including Personal then Business", () => {
  const st = interpretPlatformFeeStatus(RETURNING, { authenticated: true });
  assert.equal(platformFeeFor({}, false, st), 0);
  assert.equal(platformFeeFor({}, true, st), 0, "Business is waived too: never a fixed $19.99");
});

test("the Business amount is the server's, not a constant: a different feeCents flows through untouched", () => {
  const st = interpretPlatformFeeStatus({ ok: true, consumer: { feeCents: 499, applies: true }, business: { feeCents: 2500, applies: true } }, { authenticated: true });
  assert.equal(platformFeeFor({ platformFee: 19.99 }, true, st), 25, "plan.platformFee is ignored");
});

test("an older backend answer (business without policy fields) still reads; a missing/invalid tier asserts nothing for that tier only", () => {
  const old = interpretPlatformFeeStatus({ ok: true, consumer: { feeCents: 0, applies: false, reason: "already_authorized" }, business: { feeCents: 1999, applies: true } }, { authenticated: true });
  assert.equal(platformFeeFor({}, false, old), 0);
  assert.equal(platformFeeFor({}, true, old), 19.99);
  const noBiz = interpretPlatformFeeStatus({ ok: true, consumer: { feeCents: 499, applies: true } }, { authenticated: true });
  assert.equal(platformFeeFor({}, false, noBiz), 4.99);
  assert.equal(platformFeeFor({}, true, noBiz), null, "no business answer: no amount");
  const applyZero = interpretPlatformFeeStatus({ ok: true, consumer: { feeCents: 499, applies: true }, business: { feeCents: 0, applies: true } }, { authenticated: true });
  assert.equal(platformFeeFor({}, true, applyZero), null, "applies:true with no amount is malformed");
});

test("503 / network error / malformed response asserts NO amount on either tier", () => {
  for (const res of [null, undefined, { ok: false, status: 0, networkError: true }, { ok: false, code: "FEE_HISTORY_UNAVAILABLE" }, { ok: true }, { ok: true, consumer: { applies: "yes" }, business: { applies: "yes" } }]) {
    const st = interpretPlatformFeeStatus(res, { authenticated: true });
    assert.equal(st.status, "unknown");
    assert.equal(platformFeeFor({}, false, st), null);
    assert.equal(platformFeeFor({}, true, st), null, "Business too: never a stale fixed figure");
  }
  assert.equal(formatFeeAmount(null), "Calculated at checkout");
  for (const pending of [FEE_STATE_PENDING, FEE_STATE_UNKNOWN]) {
    assert.equal(platformFeeFor({}, false, pending), null);
    assert.equal(platformFeeFor({}, true, pending), null);
  }
});

test("guests are shown as a new account on both tiers (re-decided at authenticated checkout)", () => {
  const g = interpretPlatformFeeStatus(null, { authenticated: false });
  assert.equal(platformFeeFor({}, false, g), 4.99);
  assert.equal(platformFeeFor({}, true, g), 19.99);
});

test("W18: Cart, Checkout and Pricing no longer hard-code a 4.99 fallback", () => {
  for (const f of ["pages/Cart.jsx", "pages/Checkout.jsx", "pages/Pricing.jsx"]) {
    const src = read(f);
    assert.doesNotMatch(src, /platformFee \?\? 4\.99|\? 19\.99 : 4\.99/, `${f} must not assume $4.99`);
    assert.match(src, /usePlatformFeeStatus/);
  }
  assert.match(read("api/api.js"), /getPlatformFeeStatus\(\) \{\s*return this\.request\("\/api\/payments\/platform-fee-status"\);/);
});

test("Prezzee: GiftClaim wires the voucher panel; secrets are never logged, stored or put in the URL", () => {
  const panel = read("components/GiftCardVoucherPanel.jsx");
  const claim = read("pages/GiftClaim.jsx");
  assert.match(claim, /<GiftCardVoucherPanel gift=\{gift\} onRefresh=\{refreshGift\} \/>/);
  const code = (s) => s.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*") && !l.trim().startsWith("/*")).join("\n");
  assert.doesNotMatch(code(panel), /console\.|localStorage|sessionStorage|history\.|location\.(href|search|hash)\s*=|analytics|track\(/);
  assert.doesNotMatch(claim, /console\.[a-z]+\([^)]*(voucherUrl|giftPin)/);
  assert.match(panel, /rel="noopener noreferrer"/);
  assert.match(panel, /target="_blank"/);
  assert.match(panel, /protocol === 'https:' \|\| u\.protocol === 'http:'/);
  assert.match(claim, /status === 410 \|\| err\?\.code === 'GIFT_EXPIRED'/);
});

test("W42: Your Orders reads the combined history and falls back to the two older reads (merch, flowers) only when it is unavailable", () => {
  const src = read("utils/myOrders.js");
  assert.match(src, /api\.getMerchOrders\(\)/);
  assert.match(src, /api\.getFlowerOrders\(\)/);
  assert.match(src, /api\.getOrderHistory\(\)/);
  assert.match(read("pages/MerchOrders.jsx"), /loadMyOrders\(api\)/);
  assert.match(read("api/api.js"), /getOrderHistory\(\) \{\s*return this\.request\("\/api\/orders\/history"\);/);
  assert.doesNotMatch(read("api/api.js"), /getMerchOrders\(\)[^}]*orders\/history/);
});
