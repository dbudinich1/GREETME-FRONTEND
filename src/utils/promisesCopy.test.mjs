// src/utils/promisesCopy.test.mjs
//
// PROMISES LEDGER (report 56, founder decisions 2026-10-06): every corrected customer-facing string is pinned
// and no removed claim may come back. Source scan only (no rendering): each entry names the file, the exact new
// text that must be present, and the old phrases that must be gone from the whole of src/ (non-test) and index.html.
// Run (Node 20.x): node --test src/utils/promisesCopy.test.mjs
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const ROOT = join(SRC, "..");
const read = (rel) => readFileSync(join(ROOT, rel), "utf8").replace(/\r\n/g, "\n");

function walk(dir, out = []) {
  for (const n of readdirSync(dir)) {
    if (n === "node_modules") continue;
    const p = join(dir, n);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(jsx?|mjs|html)$/.test(n) && !/\.test\./.test(n)) out.push(p);
  }
  return out;
}
const ALL = [...walk(SRC), join(ROOT, "index.html")].map((p) => ({ p, s: readFileSync(p, "utf8").replace(/\r\n/g, "\n") }));
const everywhere = (needle) => ALL.filter(({ s }) => (needle instanceof RegExp ? needle.test(s) : s.includes(needle))).map(({ p }) => p);

// New text that must be present, per file.
const PINNED = [
  ["src/pages/Landing.jsx", "New accounts include 5 free sends during your 7-day trial."],
  ["src/components/GuidedSetupFlow.jsx", "received 5 free sends to use in your first 7 days."],
  ["src/components/GuidedSetupFlow.jsx", "it won&rsquo;t count toward your 5 free sends."],
  ["src/components/GuidedSetupFlow.jsx", "does not count against your 5 free sends."],
  ["src/components/GuidedSetupFlow.jsx", "Enjoy automatic animated greetings, and add a gift to any occasion."],
  ["src/pages/LandingPage.jsx", "Start with 5 Free Sends"],
  ["src/pages/LandingPage.jsx", "Works on iPhone and Android. Add it to your home screen, no app store needed."],
  ["src/pages/LandingPage.jsx", "Scan the QR code to add Greet-Me™ to your phone&rsquo;s home screen."],
  ["src/pages/Login.jsx", "Sign up for 5 free sends"],
  ["src/pages/ThankYouFlow.jsx", "Free accounts include 5 sends during the first 7 days."],
  ["src/components/ContactForm.jsx", "Your greeting sends automatically each year and repeats."],
  ["src/components/ContactForm.jsx", "We\\'ll remind you 10 days before so you can confirm your gift."],
  ["src/components/ContactForm.jsx", "Gifts are optional and added only when you select one for an occasion."],
  ["src/components/GiftSelectorModal.jsx", "We\\'ll remind you 10 days before so you can confirm your gift."],
  ["src/pages/Settings.jsx", "Remind me 10 days before upcoming occasions"],
  ["src/pages/Settings.jsx", "Coming soon"],
  ["src/pages/ForBusiness.jsx", "supports veteran, law enforcement and EMS communities."],
  ["src/components/corporateCampaign/SavedCardPanel.jsx", "The total shown to you before you confirm is the total charged."],
  ["src/components/OnboardingTour.jsx", "or choose a gift yourself from the Gift Place."],
  ["src/config/plans.js", "Includes 1 gift subscription with your plan."],
  ["src/pages/CreditClaim.jsx", "Reserved for non-subscribers. It will be ready when your plan ends."],
  ["src/components/hub/HubRedeemMarketplace.jsx", "'Coming soon'"],
  ["src/pages/Checkout.jsx", "Payments by Stripe"],
  ["src/pages/DashboardHome.jsx", "we review and send the cash to their chosen Venmo, PayPal or Zelle."],
  ["src/pages/GiftClaim.jsx", "days after the gift is created."],
];
for (const [file, text] of PINNED) {
  test(`pinned: ${file} says "${text.slice(0, 60)}"`, () => assert.ok(read(file).includes(text)));
}

// Old claims that must not appear anywhere in shipped source.
const GONE = [
  "Guest accounts include 3 free sends",
  "your 3 sends",
  "your 3 free sends",
  "received 3 free sends",
  "Get Started Free",
  "Sign up for free",
  "Gift will be sent automatically on the occasion date.\n", // only allowed inside the QR-Cash-live ternary (checked below)
  "Your gift selection will automatically repeat annually until changed",
  "never auto-sent",
  "Remind me 7 days before",
  "automatic 10% contributions",
  "Available on iOS and Android",
  "Get the Mobile App",
  "download Greet-Me",
  "Scan to download",
  "Greet-Me adds nothing",
  "Applied to your account balance",
  "Privacy Guaranteed",
  "Unlocks with Heart Champion",
  "Get Notified When Invitations Launch",
  "Your rewards marketplace is growing",
  "Redemption is coming soon",
  "We add bonus animations for holidays",
  "double your rewards balance",
  "Most popular choice",
  "transferred to their preferred payment method",
  "thoughtful gift for every occasion that matters",
  "with thoughtful gifts they'll never forget",
  "curate one automatically",
  "each year.'", // plans.js "Includes 1 ... subscription each year."
  "Record 30-60 seconds",
  "20+ second",
  "included with full memberships",
  "Every subscription includes one for you",
  "Send • Spend • Gift",
  "Delivered automatically.</h1>",
];
for (const phrase of GONE) {
  if (phrase === "Gift will be sent automatically on the occasion date.\n") continue;
  test(`removed claim stays gone: "${phrase.trim().slice(0, 60)}"`, () => assert.deepEqual(everywhere(phrase), []));
}

test("'Gift will be sent automatically' appears ONLY behind the QR Cash scheduled-available condition", () => {
  for (const f of ["src/components/ContactForm.jsx", "src/components/GiftSelectorModal.jsx"]) {
    const src = read(f);
    const re = /(.{0,160})'Gift will be sent automatically on the occasion date\.'/g;
    let m, n = 0;
    while ((m = re.exec(src))) { n += 1; assert.match(m[1], /SCHEDULED_QRCASH_AVAILABLE/, `${f}: unconditional auto-send gift claim`); }
    assert.ok(n >= 1, f);
  }
});

test("free tier numbers: 5 sends / 7 days appear, and no '3 free' claim anywhere", () => {
  assert.deepEqual(everywhere(/\b3 free sends?\b|\bthree free sends?\b/i), []);
});

test("D-015 (FE side): the corporate card route the funding email should link to exists in App.jsx", () => {
  const app = read("src/App.jsx");
  assert.match(app, /<Route path="campaigns" element=\{<GreetingAutomationCampaigns/);
  assert.match(app, /path="\/dashboard"/);
});

test("round 2 (founder 2026-10-06): banner has no auto-selection claim; Landing has no paid-plan clause; C-043 names the real control", () => {
  assert.ok(read("src/components/ContactForm.jsx").includes("Complete the moment with a thoughtful gift from the Greet-Me Gift Place."));
  assert.deepEqual(everywhere("OR let Greet-Me select one"), []);
  assert.deepEqual(everywhere("paid plan after your free trial"), []);
  assert.deepEqual(everywhere("turn on Auto-Send"), []);
  assert.ok(read("src/pages/DashboardHome.jsx").includes("turn on Enable Auto-Gift."));
  assert.ok(read("src/pages/Landing.jsx").includes("and add a gift to any occasion."));
});
