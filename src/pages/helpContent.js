// src/pages/helpContent.js
// W41 / checklist #20 — Help & Quick Start copy (founder-approved 2026-10-10; source:
// reports/FOUNDER_REPORTS/26_W41_Help_QuickStart_DRAFT.md Parts 1-3, with the Report 60 §0B corrections).
// Pure data so it can be tested without a browser. `**text**` marks a product label rendered in bold.
// The plans table is DERIVED from config/plans.js (the same source Pricing.jsx renders), so it cannot drift.
import { personalPlans } from '../config/plans';
import { SUBSCRIPTION_RENEWAL_NOTICE } from '../utils/subscriptionTerms';

export const HELP_INTRO = {
  title: 'Welcome to Greet-Me',
  body: 'Forget Them Not. In a few minutes you can set up your voice, add the people who matter, and send your first Greet-Me.',
};

export const QUICK_START_STEPS = [
  {
    title: 'Make it yours',
    body: 'Add your photo and your voice. Every Greet-Me carries your photo, so the people you love know it is from you. You can add or change them any time from your profile. The first time you send, we will ask you to verify your email so we can tell you when things are on their way.',
  },
  {
    title: 'Add your people',
    body: 'Open **My People** and choose **Add Recipient**, or **Import Contacts** to bring a list in at once. Add a name and email, and a little about who they are to you. **Find someone...** helps you jump straight to a person later.',
  },
  {
    title: 'Give it a Moment',
    body: 'A Greet-Me is better with a face in it. Add images to a recipient, or choose photos for a single Greet-Me from your own saved photos and your Media Library. You can include up to eight extra photos on a card.',
  },
  {
    title: 'Send your first Greet-Me',
    body: 'Choose **Send Greet-Me**. Pick the person, the occasion (Birthday, Anniversary, Thank You, Congratulations or Just Because) and, if you like, a tone: Warm, Funny, Heartfelt, Professional or Casual. Add a personal sentiment of up to 280 characters, or leave it blank and Greet-Me will compose something warm for you. When you are ready, confirm and send. "Your Greet-Me has been sent" is the best sentence in the app.',
  },
  {
    title: 'Add a gift',
    body: 'Make it extra special with **Add a Gift (Optional)**. Send **QR Cash** your recipient can scan and spend (whole dollars from $5 to $100), or browse the **American Gift Place** for Branded Goods, Gift Baskets, Flowers, Americana, Faith & Inspiration and Tech. You see exactly what you will pay before you confirm, and nothing is charged until you do.',
  },
  {
    title: 'Schedule the love',
    body: 'Open a recipient and use the **Occasion Scheduler** to add the dates that matter: birthdays, anniversaries, holidays. Add dates and Greet-Me will take care of the rest. Everything you add appears under **Upcoming Occasions** on your home screen.',
  },
  {
    title: 'Earn Hearts, share the love',
    body: 'Every Greet-Me you send helps you earn Hearts, and your **Hearts Hub** shows your balance and what they can become. After you send, you can invite someone to view your Greet-Me with a name and an email. Add Greet-Me to your phone\'s home screen for one-tap access.',
  },
];

// The QR Cash payout methods, worded exactly as the Terms (src/Legal.jsx) list them.
export const QR_CASH_PAYOUT_METHODS = ['Venmo', 'PayPal', 'Zelle'];

export const FAQ = [
  {
    q: 'Do I need a photo to send?',
    a: 'Yes. Every Greet-Me includes your photo so it is unmistakably from you. Add one in your profile and your draft waits for you.',
  },
  {
    q: 'Can I use my own voice?',
    a: 'Yes. Your saved voice speaks your Greet-Me. If it ever needs refreshing, you can record it again or save your draft and come back.',
  },
  {
    q: 'How long can my message be?',
    a: 'Up to 280 characters. Shorter notes feel the most natural. Leave it empty and Greet-Me will compose a warm, personal greeting.',
  },
  {
    q: 'What does "One-time send" mean?',
    a: 'That Greet-Me goes out once, when you send it. For dates that come around every year, add them to a recipient\'s Occasion Scheduler.',
  },
  {
    q: 'How does QR Cash work?',
    a: `Choose an amount, send your Greet-Me, and your recipient opens it to find their gift. They then tell us where they would like to receive it (${QR_CASH_PAYOUT_METHODS[0]}, ${QR_CASH_PAYOUT_METHODS[1]} or ${QR_CASH_PAYOUT_METHODS[2]}) and we email them when it has been sent. They have 30 days after the gift is created to claim it.`,
  },
  {
    q: 'Will I be charged before I confirm?',
    a: 'Never. You will see "You pay..." and nothing is charged until you confirm on the next step.',
  },
  {
    q: 'How do I follow a gift?',
    a: 'Open **Your Orders**. Each order shows where it is: Processing, Shipped or Delivered, with a tracking link when one is available.',
  },
  {
    q: 'What are Hearts?',
    a: 'A thank-you for being thoughtful. In the Hearts Hub you can see your balance and exchange 500 Hearts for an Anytime Greet-Me (once a day).',
  },
  {
    q: 'I have reached my limit. What now?',
    a: 'You can continue tomorrow, or upgrade any time to keep the celebrations flowing.',
  },
  {
    q: 'How many people can I add?',
    a: 'It depends on your plan: up to 5 on Close Circle, up to 15 on Social Butterfly, unlimited on Legend.',
  },
  {
    q: 'Can I add Greet-Me to my phone?',
    a: 'Yes. No app store needed. On iPhone, open Greet-Me in Safari, tap Share, then "Add to Home Screen". On Android, open it in Chrome, tap the menu at the top right, then "Add to Home screen". The "Add Greet-Me to Your Home Screen" card on your dashboard has a QR code to open the page.',
  },
  {
    q: 'Where do I get help?',
    a: 'Open **Support**. To change or cancel your plan, for billing, a bug or anything else, email support@greet-me.com with your account email.',
  },
];

// The exact sentence Pricing.jsx already shows under the Founders Offer (pinned equal by test).
export const FOUNDERS_PRICING_NOTE = 'Founders pricing is early-access pricing, locked for the lifetime of your subscription.';

export const PLANS_INTRO = `All plans are yearly and include Greet One, Give One™. ${SUBSCRIPTION_RENEWAL_NOTICE}`;

const featuresOf = (plan) => (plan?.featureGroups || []).flatMap((g) => g.features || []);
const pick = (features, re, fmt) => {
  for (const f of features) { const m = re.exec(f); if (m) return fmt(m); }
  return null;
};
const formatPrice = (price) => (typeof price === 'number' ? `$${price.toFixed(2)}` : null);

/** One row per personal plan, read from config/plans.js — never hand-typed. A value the config no
 *  longer states in the expected words comes back null (the tests fail on any null). */
export function helpPlanRows(plans = personalPlans) {
  return (plans.standard || []).map((std) => {
    const founders = (plans.founders || []).find((p) => p.planTier === std.planTier) || null;
    const f = featuresOf(std);
    return {
      planTier: std.planTier,
      name: std.name,
      foundersPrice: founders ? formatPrice(founders.price) : null,
      standardPrice: formatPrice(std.price),
      recipients: pick(f, /^(Up to \d+|Unlimited) recipients$/i, (m) => m[1]),
      monthly: pick(f, /^(\d+) Greet-Mes? included each month$/i, (m) => m[1]),
      anytime: pick(f, /^(\d+) Anytime Greet-Mes? included$/i, (m) => m[1]),
      bank: pick(f, /^Bank up to (\d+) unused Greet-Mes?$/i, (m) => `Up to ${m[1]}`) || '-',
    };
  });
}

export const PLAN_COLUMNS = [
  ['name', 'Plan'],
  ['foundersPrice', 'Founders pricing (per year)'],
  ['standardPrice', 'Standard (per year)'],
  ['recipients', 'Recipients'],
  ['monthly', 'Greet-Mes each month'],
  ['anytime', 'Anytime Greet-Mes'],
  ['bank', 'Bank unused'],
];
