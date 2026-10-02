// src/utils/qrCashAmount.test.mjs — the display/validation mirror equals the backend's constants and function.
// Run (Node 20): node --test src/utils/qrCashAmount.test.mjs   (PAIR_BE_DIR default C:\1_GREET-ME\cs-be-combined)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateQrCashDollars, qrCashQuote, QR_CASH_MIN_DOLLARS, QR_CASH_MAX_DOLLARS, centsToDollarString } from "./qrCashAmount.js";

const BE = process.env.PAIR_BE_DIR || "C:/1_GREET-ME/cs-be-combined";
const have = fs.existsSync(path.join(BE, "utils", "giftFees.js"));
const skip = have ? false : `backend not found at ${BE}`;

test("limits equal the backend MIN_GIFT_CENTS / MAX_GIFT_CENTS", { skip }, () => {
  const src = fs.readFileSync(path.join(BE, "routes", "giftRoutes.js"), "utf8");
  assert.match(src, /export const MIN_GIFT_CENTS = 500;/);
  assert.match(src, /export const MAX_GIFT_CENTS = 10000;/);
  assert.equal(QR_CASH_MIN_DOLLARS * 100, 500);
  assert.equal(QR_CASH_MAX_DOLLARS * 100, 10000);
});

test("qrCashQuote equals the backend calcGiftFees for every whole dollar $5..$100", { skip }, async () => {
  const { calcGiftFees } = await import(pathToFileURL(path.join(BE, "utils", "giftFees.js")).href);
  for (let d = QR_CASH_MIN_DOLLARS; d <= QR_CASH_MAX_DOLLARS; d++) {
    const be = calcGiftFees(d * 100);
    assert.deepEqual(qrCashQuote(d), { amountCents: be.giftAmountCents, feeCents: be.feeCents, totalCents: be.totalCents }, `$${d}`);
  }
});

test("validation accepts whole dollars 5..100 and explains every refusal", () => {
  for (const ok of ["5", "100", " 40 ", "10"]) assert.equal(validateQrCashDollars(ok).ok, true, ok);
  const refusals = { "": "empty", "4": "min", "0": "min", "101": "max", "12.5": "format", "-5": "format", "abc": "format", "1e2": "format" };
  for (const [bad, reason] of Object.entries(refusals)) {
    const r = validateQrCashDollars(bad);
    assert.equal(r.ok, false, bad);
    assert.equal(r.reason, reason, bad);
    assert.ok(r.message && /\$(5|100)\b/.test(r.message), `${bad}: message names the limit`);
  }
  assert.equal(centsToDollarString(1234), "$12.34");
});
