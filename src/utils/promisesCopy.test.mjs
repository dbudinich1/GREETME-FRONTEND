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
  ["src/pages/Checkout.jsx", "Payments by Stripe"],
  ["src/pages/GiftClaim.jsx", "days after the gift is created."],
  ["src/pages/ForBusiness.jsx", "Add real cash to a gift with QR Cash on individual sends."],
  ["src/pages/Merch.jsx", "Send • Claim • Spend"],
  ["src/pages/DashboardHome.jsx", "Send • Claim • Spend"],
  ["src/pages/Landing.jsx", "New accounts include 5 free sends during your 7-day trial."],
  ["src/components/GuidedSetupFlow.jsx", "received 5 free sends to use in your first 7 days."],
  ["src/pages/DashboardHome.jsx", "Once redeemed, we review and send the cash to their chosen Venmo, PayPal or Zelle. Payouts are processed manually."],
  ["src/pages/Profile.jsx", "Voice: Record at least 10 seconds in a quiet environment."],
  ["src/pages/Profile.jsx", "AI will use relationship context to personalize your messages."],
  ["src/components/hub/hubConfig.js", "A good fit for regular gifters"],
  ["src/components/hub/hubConfig.js", "Maximum impact - the most Hearts per dollar"],
  ["src/pages/AnimationBank.jsx", "Redeem Hearts for Anytime Credits on the Rewards page."],
  ["src/pages/Support.jsx", "To change or cancel your subscription, or for refund and billing questions, email"],
  ["src/pages/Support.jsx", "We reply as quickly as we can."],
  ["src/pages/Checkout.jsx", "Secure checkout"],
];
for (const [file, text] of PINNED) {
  test(`pinned: ${file} says "${text.slice(0, 60)}"`, () => assert.ok(read(file).includes(text)));
}

// Old claims that must not appear anywhere in shipped source.
const GONE = [
  "your 3 sends",
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
  "thoughtful gift for every occasion that matters",
  "with thoughtful gifts they'll never forget",
  "curate one automatically",
  "each year.'", // plans.js "Includes 1 ... subscription each year."
  "Delivered automatically.</h1>",
  "Holiday Bonus Send", // 2026-10-08: no longer a customer-redeemable Hearts reward
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

test("founder colour-coding 2026-10-06: items not approved are back to their daab7e5 wording", () => {
  // Reverted (undecided / red / yellow): the original text must still be present and the proposed text absent.
  const back = [
    ["src/pages/Invitations.jsx", "Get Notified When Invitations Launch", "Invitations are coming soon"],
    ["src/components/hub/HubMarketplace.jsx", "Your rewards marketplace is growing.", "The Hearts Marketplace is not open yet."],
    ["src/components/hub/HubWaysToSpend.jsx", "Redemption is coming soon", "Redemption is temporarily unavailable"],
    ["src/components/hub/HubRedeemMarketplace.jsx", "Unlocks with {unlock}", "r.unlock === 'Heart Champion'"],
    ["src/pages/HeroProgram.jsx", "name: 'Growth', price: 250, hearts: 3250, popular: true,", "popular: false, description"], // ribbon stays (founder)
    ["src/components/corporateCampaign/corporateDashboardModel.js", "Cash they can scan and spend.", "Not available in campaigns yet."],
    ["src/pages/G1G1Send.jsx", "included with full memberships.", "included when you subscribe at full price."],
    ["src/pages/DashboardHome.jsx", "Every subscription includes one for you", "Every full-price individual subscription"],
  ];
  for (const [file, original, proposed] of back) {
    const s = read(file);
    assert.ok(s.includes(original), `${file}: original missing: ${original}`);
    if (!original.includes(proposed) && proposed !== "balance figure removed") assert.ok(!s.includes(proposed), `${file}: unapproved text present: ${proposed}`);
  }
  assert.ok(!read("src/pages/ForBusiness.jsx").includes("scheduled campaigns yet"));
});

test("B-029: /invitations is founder-only; customers are redirected to the dashboard; no nav link", () => {
  const app = read("src/App.jsx");
  assert.ok(app.includes(`<Route path="invitations" element={<FounderOnlyInvitations />} />`));
  assert.ok(app.includes(`isFounder(user) ? <Invitations /> : <Navigate to="/dashboard" replace />`));
  assert.deepEqual(everywhere("dashboard/invitations"), []);
});

test("C-060: photo upload limit text and pre-checks match the backend multer limit (10MB)", () => {
  assert.ok(read("src/components/PhotoUpload.jsx").includes("10MB"));
  assert.ok(read("src/components/ContactForm.jsx").includes("Max 10MB each"));
  assert.ok(read("src/components/GuidedSetupFlow.jsx").includes("PNG, JPG up to 10MB"));
  assert.ok(read("src/pages/Profile.jsx").includes("Image size must be less than 10MB"));
});

test("G1G1 exclusion copy 2026-10-06: only referral credit excludes the gift; old wording gone", () => {
  assert.ok(read("src/pages/G1G1Claim.jsx").includes("Greet One, Give One&trade; — included with individual subscriptions."));
  const cart = read("src/pages/Cart.jsx");
  assert.ok(cart.includes("Greet One, Give One&trade; is awarded with individual memberships. It is not included when a referral credit is applied."));
  assert.ok(cart.includes("Not included with referral credit"));
  assert.deepEqual(everywhere("included when you subscribe at full price").filter((p) => p !== "src/pages/G1G1Send.jsx"), []);
  assert.equal(read("src/pages/G1G1Claim.jsx").includes("included when you subscribe at full price"), false);
  assert.equal(cart.includes("is awarded with full memberships and is not included with discounted purchases"), false);
  assert.equal(cart.includes("Not included with discounted purchases"), false);
});

test("Legal 2026-10-06: retention, processors, QR Cash and G1G1 wording are truthful", () => {
  const legal = read("src/Legal.jsx");
  for (const t of [
    "Greeting media is available to recipients for 30 days after it is delivered. Gift and credit records are kept as described.",
    "<strong>Deleting contacts.</strong>",
    "Stripe (payment and subscription handling)",
    "<strong>AI text generation:</strong> OpenAI",
    "Google Analytics",
    "Goody, Florist One or Printful",
    "Unclaimed gifts expire 30 days after the gift is created.",
    "QR Cash payouts are reviewed and sent manually by our team, to the Venmo, PayPal or Zelle account the recipient provides.",
    "G1G1 gifts are not available when a referral credit is applied.",
  ]) assert.ok(legal.includes(t), `Legal.jsx missing: ${t}`);
  for (const t of ["limited period afterward", "payout handling", "48 hours", "48-hour", "Unclaimed gifts expire after 30 days"]) {
    assert.equal(legal.includes(t), false, `Legal.jsx still has: ${t}`);
  }
});

test("Hero Hearts purchase terms 2026-10-08 (founder-approved): verbatim in Terms and the purchase modal", () => {
  assert.ok(read("src/Legal.jsx").includes(
    "Hero Hearts are non-refundable, have no cash value, and cannot be transferred or exchanged; Greet-Me may change Hearts costs and available rewards at any time."));
  const modal = read("src/components/hub/HubHeroHeartsModal.jsx");
  assert.ok(modal.includes("Hero Hearts are non-refundable, have no cash value, and can't be transferred. Costs and rewards may change."));
  assert.ok(modal.includes("25% of proceeds from Hero Hearts™ support U.S. Veterans and their families."), "veterans line untouched");
});

test("Email-invite Hearts copy 2026-10-08: invite reward stated truthfully; social sharing still earns nothing", () => {
  const panel = read("src/components/ShareTheLovePanel.jsx");
  assert.ok(panel.includes("Invite friends by email to earn 50 Hearts per invite, up to 3 invites a week."));
  assert.ok(panel.includes("Sharing on social media doesn’t earn Hearts."));
  assert.deepEqual(everywhere("Sharing doesn’t earn Hearts yet"), []);
});

test("Impact plan (founder rule: no promise removed without approval): the original Flat-Fee Appreciation bullet is present in both Impact lists", () => {
  const plans = read("src/config/plans.js");
  const bullet = "'Flat-Fee Appreciation™ — $2.99 per Greet-Me sent'";
  assert.equal(plans.split(bullet).length - 1, 2);
  const lines = plans.split("\n").map((l) => l.trim());
  lines.forEach((l, i) => {
    if (l === bullet + ",") {
      assert.equal(lines[i - 1], "'Branded Gift Options',");
      assert.equal(lines[i + 1], "'Greet-Me Gifts™ & QR Cash™',");
    }
  });
});

test("A-054 / C-056 (2026-10-06): dead Gifts modal no longer promises instant cash; delete-recipient dialog discloses kept order records", () => {
  assert.equal(read("src/pages/Gifts.jsx").includes("instantly available to spend anywhere"), false);
  assert.ok(read("src/pages/Gifts.jsx").includes("Payouts are processed manually."));
  assert.ok(read("src/pages/Contacts.jsx").includes("This action cannot be undone. Records of gifts and orders already placed are kept."));
});
