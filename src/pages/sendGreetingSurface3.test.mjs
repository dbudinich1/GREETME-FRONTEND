// Run (Node 20): node --test src/pages/sendGreetingSurface3.test.mjs
// Milestone MILESTONE-claim-credit-cap-5 Addendum 1: two narrow SendGreeting.jsx edits.
// The rendered behavior is proven against the real page in tests/sendGreetingSurface3.spec.js (fixture
// Playwright); this file pins the source shape and evaluates the extracted display helper.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "SendGreeting.jsx"), "utf8").replace(/\r\n/g, "\n");
const CODE = SRC.split("\n").map((l) => l.replace(/(^|\s)\/\/.*$/, "")).join("\n");

test("no literal referral-credit amount remains in the composer", () => {
  assert.doesNotMatch(CODE, /Your \$10 credit/);
  assert.doesNotMatch(CODE, /\.toFixed\(0\)\} Greet-Me Credit Applied/);
  assert.match(CODE, /Your \$\{formatReferralCreditCents\(referralValue\)\} credit/);
});

test("formatReferralCreditCents shows the server amount exactly and nothing when unknown", () => {
  const fn = SRC.match(/function formatReferralCreditCents\(cents\) \{[\s\S]*?\n\}/)[0];
  const f = new Function(`${fn}; return formatReferralCreditCents;`)();
  assert.equal(f(500), "$5");
  assert.equal(f(1000), "$10");
  assert.equal(f(750), "$7.50");
  for (const bad of [0, -5, null, undefined, "500", 12.5, NaN]) assert.equal(f(bad), "", String(bad));
});

test("the banner still renders only with a referral code and a server value; heading uses the same helper", () => {
  assert.match(CODE, /\{referralCode && referralValue && \(/);
  assert.match(CODE, /formatReferralCreditCents\(referralValue\)[\s\S]{0,60}Greet-Me Credit Applied/);
});

test("QR Cash summary: pay line uses the single parity-tested quote, not a fifth inline fee formula", () => {
  assert.match(CODE, /import \{ qrCashQuote, centsToDollarString \} from '\.\.\/utils\/qrCashAmount';/);
  assert.match(CODE, /centsToDollarString\(qrCashQuote\(dollars\)\.totalCents\)/);
  assert.match(CODE, /Nothing is charged until you confirm\./);
  // the four inline expressions that qrCashFeeParity.test.mjs pins are still exactly four
  const inline = CODE.split("\n").filter((l) => /\b199\b/.test(l) && /0\.03/.test(l));
  assert.equal(inline.length, 4);
  // referral credit is not charged: no pay line
  assert.match(CODE, /if \(referralCode \|\| !\(dollars > 0\)\) return null;/);
});

test("AttachmentIndicator stays founder-locked to no totals; the summary lives in the SendGreeting row", () => {
  const AI = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "..", "components", "AttachmentIndicator.jsx"), "utf8");
  assert.doesNotMatch(AI, /qrCashQuote|totalCents|You pay/);
  assert.match(CODE, /data-testid="qrcash-summary-pay"/);
});
