// src/utils/creditTerminology.test.mjs
//
// RELEASE 2b (2026-10-07, founder decision 6 follow-up): the $5 credit a QR Cash RECIPIENT receives is called
// "referral credit" only INSIDE the code (referralCode, ?referral=, greetme_referral_code, REFERRAL_ALREADY_USED).
// It is not a reward for referring anyone, and customers already see it as "Greet-Me Credit" (claim page, credit
// emails, the send banner). This pins the customer-facing wording and keeps "referral credit" out of any text a
// customer can see. Identifiers, routes and error codes are intentionally NOT renamed (stored data, live links).
// Source scan only. Run (Node 20.x): node --test src/utils/creditTerminology.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

// Lines a customer can never see: line comments, block-comment bodies and JSX comments.
const visibleLines = (src) =>
  src.split("\n").filter((l) => !/^\s*(\/\/|\*|\/\*|\{\/\*)/.test(l));

const CUSTOMER_FILES = {
  "src/pages/ReferralCredit.jsx": [
    "setError('Invalid Greet-Me Credit link.');",
    "setError('This Greet-Me Credit is no longer valid.');",
    "setError('This Greet-Me Credit has already been used.');",
    "setError('This Greet-Me Credit is not valid.');",
  ],
  "src/pages/SendGreeting.jsx": [
    "setReferralError('This Greet-Me Credit is no longer valid.');",
    "setReferralError('This Greet-Me Credit has already been used.');",
    "setReferralError('This Greet-Me Credit is not valid.');",
    "'Greet-Me Credit redemption failed'",
    "'Failed to apply Greet-Me Credit.'",
    "Greet-Me Credit Applied",
  ],
  "src/components/PreSendReviewModal.jsx": ["' — Greet-Me Credit'"],
  "src/components/AttachmentIndicator.jsx": ["secondary = 'Applied as a Greet-Me Credit';"],
  "src/pages/Cart.jsx": [
    "Not included with a Greet-Me Credit from a QR Cash gift",
    "It is not included when a Greet-Me Credit from a QR Cash gift is applied.",
  ],
  "src/Legal.jsx": [
    "Credits ($5 courtesy credits, $5 Greet-Me Credits received with a QR Cash gift) are promotional",
    "G1G1 gifts are not available when a Greet-Me Credit received with a QR Cash gift is applied.",
  ],
  "src/pages/Checkout.jsx": [],
  "src/pages/Pricing.jsx": [],
  "src/pages/GiftClaim.jsx": [],
};

for (const [file, required] of Object.entries(CUSTOMER_FILES)) {
  test(`${file}: customer-facing text calls the QR Cash recipient credit "Greet-Me Credit", never "referral"`, () => {
    const src = read(file);
    for (const t of required) assert.ok(src.includes(t), `${file} missing: ${t}`);
    const offending = visibleLines(src).filter((l) =>
      /referral credit|referral link|Referral redemption|referral has already/i.test(l));
    assert.deepEqual(offending, [], `${file} still shows "referral" wording to customers`);
  });
}

test("internal identifiers are deliberately unchanged (stored data, live links and error codes depend on them)", () => {
  const rc = read("src/pages/ReferralCredit.jsx");
  assert.ok(rc.includes("localStorage.setItem('greetme_referral_code', referralCode);"));
  assert.ok(rc.includes("err?.code === 'REFERRAL_ALREADY_USED'"));
  assert.ok(rc.includes("navigate(`/dashboard/send?referral=${referralCode}`"));
  const api = read("src/api/api.js");
  assert.ok(api.includes("/api/gifts/referral/${referralCode}"));
});
