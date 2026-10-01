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

test("W18: first activation shows $4.99", () => {
  const st = interpretPlatformFeeStatus({ ok: true, consumer: { feeCents: 499, applies: true, reason: "initial_activation" }, business: { feeCents: 1999, applies: true } }, { authenticated: true });
  assert.deepEqual(st, { status: "known", consumerFee: 4.99, applies: true });
  assert.equal(formatFeeAmount(platformFeeFor({}, false, st)), "$4.99");
});

test("W18: returning subscriber has fee 0 so the row is omitted and the total is plan-only", () => {
  const st = interpretPlatformFeeStatus({ ok: true, consumer: { feeCents: 0, applies: false, reason: "already_authorized" } }, { authenticated: true });
  assert.equal(platformFeeFor({}, false, st), 0);
});

test("W18: 503 / network error / malformed response asserts NO amount", () => {
  for (const res of [null, undefined, { ok: false, status: 0, networkError: true }, { ok: false, code: "FEE_HISTORY_UNAVAILABLE" }, { ok: true }, { ok: true, consumer: { applies: "yes" } }]) {
    const st = interpretPlatformFeeStatus(res, { authenticated: true });
    assert.equal(st.status, "unknown");
    assert.equal(platformFeeFor({}, false, st), null);
  }
  assert.equal(formatFeeAmount(null), "Calculated at checkout");
  assert.equal(platformFeeFor({}, false, FEE_STATE_PENDING), null, "no amount while the read is in flight");
  assert.equal(platformFeeFor({}, false, FEE_STATE_UNKNOWN), null);
});

test("W18: guests are shown as a new account; business keeps $19.99 regardless of consumer state", () => {
  assert.equal(platformFeeFor({}, false, interpretPlatformFeeStatus(null, { authenticated: false })), 4.99);
  assert.equal(platformFeeFor({}, true, FEE_STATE_UNKNOWN), 19.99);
  assert.equal(platformFeeFor({}, true, { status: "known", consumerFee: 0, applies: false }), 19.99);
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

test("W42: MerchOrders keeps merch + flower reads and adds the combined history read for gift rows only", () => {
  const src = read("pages/MerchOrders.jsx");
  assert.match(src, /api\.getMerchOrders\(\)/);
  assert.match(src, /api\.getFlowerOrders\(\)/);
  assert.match(src, /api\.getOrderHistory\(\)/);
  assert.match(src, /o\.source === "gift"/);
  assert.match(read("api/api.js"), /getOrderHistory\(\) \{\s*return this\.request\("\/api\/orders\/history"\);/);
  assert.doesNotMatch(read("api/api.js"), /getMerchOrders\(\)[^}]*orders\/history/);
});
