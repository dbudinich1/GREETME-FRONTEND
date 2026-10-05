// src/utils/creditCap.test.mjs - defence-in-depth clamp + "no $10 wording for non-Hearts credits" source guard.
// Run (Node 20.x): node --test src/utils/creditCap.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { clampCreditCents, clampCreditDollars, MAX_CREDIT_CENTS } from "./creditCap.js";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");

test("clamp: 1000 cents renders $5.00; at or below $5 unchanged; junk is 0", () => {
  assert.equal(MAX_CREDIT_CENTS, 500);
  assert.equal((clampCreditCents(1000) / 100).toFixed(2), "5.00");
  assert.equal(clampCreditCents(300), 300);
  assert.equal(clampCreditCents(500), 500);
  for (const bad of [undefined, null, "x", NaN, {}, -0]) assert.equal(clampCreditCents(bad), 0);
  assert.equal(clampCreditCents("1000"), 500);
  assert.equal(clampCreditDollars(10).toFixed(2), "5.00");
  assert.equal(clampCreditDollars(2.5), 2.5);
  assert.equal(clampCreditDollars(undefined), 0);
});

test("courtesy credit render sites are all clamped", () => {
  const read = (f) => readFileSync(join(SRC, "pages", f), "utf8");
  for (const f of ["Cart.jsx", "Checkout.jsx", "Pricing.jsx"]) assert.match(read(f), /clampCreditDollars\(/, f);
  assert.doesNotMatch(read("CreditClaim.jsx"), /\(credit\.amountCents \/ 100\)/, "CreditClaim display unclamped");
  for (const f of ["CreditClaim.jsx", "ThankYouFlow.jsx"]) {
    const src = read(f);
    assert.match(src, /clampCreditCents\(/, f);
    assert.doesNotMatch(src, /amount: \((?:result|claimResult|credit)[^)]*\) \/ 100/, `${f}: stored courtesy amount must be clamped`);
  }
});

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(jsx?|mjs)$/.test(n) && !/\.test\./.test(n)) out.push(p);
  }
  return out;
}
test("no customer-visible '$10 credit' / 'up to $10' wording remains outside the Hearts gift credit", () => {
  const re = /\$10 (?:credit|referral|expires)|up to \$10|Your \$10\b|\$10 QR Cash match/i;
  const hits = [];
  for (const f of walk(SRC)) {
    if (/SendGreeting\.jsx$/.test(f)) continue; // protected viral-loop file: comment-only occurrence reported separately
    const lines = readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((l, i) => { if (re.test(l) && !/gift[_ ]?(credit|10)|Greet-Me Gift Credit|hearts/i.test(l)) hits.push(`${f}:${i + 1}: ${l.trim()}`); });
  }
  assert.deepEqual(hits, []);
});

test("clamp floor: negatives and junk are 0, never negative; Infinity is the max; non-integer cents kept as-is", () => {
  for (const v of [-5, -0, "-5", -Infinity, NaN, -499.9]) {
    assert.ok(Object.is(clampCreditCents(v), 0), `cents ${String(v)} -> 0, got ${clampCreditCents(v)}`);
    assert.ok(Object.is(clampCreditDollars(v), 0), `dollars ${String(v)} -> 0, got ${clampCreditDollars(v)}`);
  }
  assert.equal(clampCreditCents(Infinity), 500);
  assert.equal(clampCreditDollars(Infinity), 5);
  assert.equal(clampCreditCents("1000"), 500);
  assert.equal(clampCreditCents(1000), 500);
  assert.equal(clampCreditCents(499.9), 499.9, "existing contract: no rounding of non-integer cents");
  assert.equal(clampCreditDollars(4.999), 5, "existing contract: dollars are rounded to whole cents");
  assert.equal(clampCreditDollars(-5), 0);
});
