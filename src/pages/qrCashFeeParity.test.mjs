// src/pages/qrCashFeeParity.test.mjs
//
// PARITY TEST ONLY (Team 5 diff-review should-fix). SendGreeting.jsx (Team 1A's file) computes the QR Cash
// processing fee inline in FOUR places, and the Choose-a-Gift modal computes it for the custom amount. All of
// them are display-only (the real charge is server-computed by calcGiftFees at POST /api/gifts/charge-now),
// but nothing proved they agree with the backend. This test:
//   * extracts the four inline fee expressions from SendGreeting.jsx SOURCE and evaluates them;
//   * evaluates the modal's computation (src/utils/qrCashAmount.js qrCashQuote, which GiftSelectorModal uses);
//   * proves each equals the backend's own calcGiftFees for EVERY whole-dollar amount from $5 to $100, plus
//     Team 3's published reference vectors (T3-w07-scheduled-qr-cash.md: 500 -> 214/714, 2500 -> 274/2774,
//     10000 -> 499/10499);
//   * pins that there are exactly four inline copies, so a fifth cannot appear unnoticed.
// It does NOT edit or consolidate SendGreeting.jsx. The Hearts fee-waiver reward has no arithmetic in the
// frontend (qr_fee_waiver is a catalog entry only), so there is no waiver computation to compare; the
// backend's waiveFee:true case (fee 0, total = amount) is asserted for calcGiftFees itself and the
// referral-credit branch (isReferral -> 0) is asserted as the only fee-zero path the frontend has.
//
// Run (Node 20): node --test src/pages/qrCashFeeParity.test.mjs   (PAIR_BE_DIR default C:\1_GREET-ME\cs-be-combined)
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { qrCashQuote } from "../utils/qrCashAmount.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = fs.readFileSync(path.join(here, "SendGreeting.jsx"), "utf8").replace(/\r\n/g, "\n");
const BE = process.env.PAIR_BE_DIR || "C:/1_GREET-ME/cs-be-combined";
const feesPath = path.join(BE, "utils", "giftFees.js");
const haveBackend = fs.existsSync(feesPath);

// ---- the four inline expressions, extracted from source ----------------------------------------
const lines = SRC.split("\n");
const inline = lines
  .map((text, i) => ({ text: text.trim(), line: i + 1 }))
  .filter((l) => /\b199\b/.test(l.text) && /0\.03/.test(l.text) && !l.text.startsWith("//") && !l.text.startsWith("*"));

test("exactly four inline QR Cash fee computations exist in SendGreeting.jsx (a fifth copy would be unnoticed drift)", () => {
  assert.equal(inline.length, 4, `found: ${inline.map((l) => `${l.line}: ${l.text}`).join(" | ")}`);
});

function compile(l) {
  // "feeCents: isReferral ? 0 : 199 + ...," or "return 199 + ...;" -> the bare expression
  let expr = l.text.replace(/^feeCents:\s*/, "").replace(/^totalCents:\s*/, "").replace(/^return\s+/, "").replace(/[;,]\s*$/, "");
  return { ...l, expr, fn: new Function("amt", "amtCents", "isReferral", `return (${expr});`) };
}
const exprs = inline.map(compile);
const kind = (e) => (/^isReferral/.test(e.expr) ? (/amtCents \+ 199/.test(e.expr) ? "total" : "fee") : (/^amtCents \+ 199/.test(e.expr) ? "total" : "fee"));

test("the extracted expressions are the two fee forms and the two total forms", () => {
  assert.deepEqual(exprs.map(kind).sort(), ["fee", "fee", "total", "total"], exprs.map((e) => e.expr).join(" || "));
});

test("reference vectors (Team 3 contract): $5 -> 214 / 714, $25 -> 274 / 2774, $100 -> 499 / 10499", () => {
  for (const [dollars, fee, total] of [[5, 214, 714], [25, 274, 2774], [100, 499, 10499]]) {
    const cents = dollars * 100;
    for (const e of exprs) {
      const out = e.fn(dollars, cents, false);
      assert.equal(out, kind(e) === "fee" ? fee : total, `SendGreeting.jsx:${e.line} at $${dollars}`);
    }
    assert.deepEqual(qrCashQuote(dollars), { amountCents: cents, feeCents: fee, totalCents: total }, "Choose-a-Gift modal computation");
  }
});

test("every inline computation and the modal computation equal the backend calcGiftFees for all whole dollars $5..$100", { skip: haveBackend ? false : `backend not found at ${BE}` }, async () => {
  const { calcGiftFees } = await import(pathToFileURL(feesPath).href);
  for (let d = 5; d <= 100; d++) {
    const cents = Math.round(d * 100);
    const be = calcGiftFees(cents);
    for (const e of exprs) {
      const out = e.fn(d, cents, false);
      assert.equal(out, kind(e) === "fee" ? be.feeCents : be.totalCents, `SendGreeting.jsx:${e.line} (${kind(e)}) at $${d}`);
    }
    const q = qrCashQuote(d);
    assert.deepEqual(q, { amountCents: be.giftAmountCents, feeCents: be.feeCents, totalCents: be.totalCents }, `modal at $${d}`);
  }
});

test("Hearts fee waiver: backend waiveFee:true zeroes the fee only; the frontend has no waiver arithmetic of its own", { skip: haveBackend ? false : `backend not found at ${BE}` }, async () => {
  const { calcGiftFees } = await import(pathToFileURL(feesPath).href);
  assert.deepEqual(calcGiftFees(2500, { waiveFee: true }), { giftAmountCents: 2500, feeCents: 0, totalCents: 2500 });
  // No FE code computes a waived fee: nothing but the referral branch yields a zero fee in SendGreeting.
  assert.doesNotMatch(SRC, /waive/i);
  const gated = exprs.filter((e) => /^isReferral/.test(e.expr));
  assert.equal(gated.length, 2, "the referral gate exists on the two summary expressions (fee and total)");
  for (const e of gated) assert.equal(e.fn(25, 2500, true), 0, `SendGreeting.jsx:${e.line} referral branch is the only zero path`);
  // The other two expressions feed the payment confirmation, which a referral send never opens (it skips payment).
  assert.match(SRC, /QR Cash™ referral: skip payment/);
});

test("the modal's computation is the shared mirror, not a fifth inline copy", () => {
  const modal = fs.readFileSync(path.join(here, "..", "components", "GiftSelectorModal.jsx"), "utf8");
  assert.match(modal, /import \{[^}]*qrCashQuote[^}]*\} from '\.\.\/utils\/qrCashAmount'/);
  assert.doesNotMatch(modal.split("\n").filter((l) => !l.trim().startsWith("//") && !l.trim().startsWith("*")).join("\n"), /\b199\b/);
});
