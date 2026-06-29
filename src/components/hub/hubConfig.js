// src/components/hub/hubConfig.js
// UX-HUB-3 Batch 2 — shared Hearts Hub constants ("meaning"), extracted verbatim from
// Rewards.jsx during the behavior-preserving component extraction. Values are unchanged;
// this file only relocates them so the extracted Hub components can import their meaning
// from one place instead of receiving large constants as props. No logic, no state.

// H7: locked launch redemption — 40 Hearts → 1 Anytime Greet-Me (in-kind only).
export const REDEEM_COST = 40;

// J1 — frontend-owned Journey MEANING (labels + order only). TRUTH (the booleans)
// comes solely from J0 (GET /api/journey/progress); the frontend never computes,
// aggregates, or persists Journey state. Each step maps to exactly one J0 fact.
export const JOURNEY_STEPS = [
  { key: 'hasCompletedOnboarding', label: 'Set up your voice & photo' },
  { key: 'hasSentFirstGreeting', label: 'Send your first Greet-Me' },
  { key: 'hasEarnedFirstHeart', label: 'Earn your first Heart' },
  { key: 'hasSentGiftGreeting', label: 'Send a Greet-Me with a gift' },
];

// SC2 — Social Circuit (introduction / handoff only). Frontend kill-switch. The
// Social Circuit is the THIRD Journey state: once Product Mastery is fully reached
// (all four J0 facts true), the Journey card widens IN PLACE from the warm
// acknowledgment into a gentle, outward invitation — "grow the Greet-Me community."
// This is the canon "Social Circuit Handoff" (introduction) ONLY: no social/advocacy
// server fact exists yet, so there is NO progress, NO milestone/completion, NO
// economy value, and NO new API call. The single CTA routes to the EXISTING /send
// flow (the live entry into sharing). Earning/attribution/completion (S2/S3/S5) are
// deferred to separately-gated backend stages. Flip false to instantly hide.
// Dormant-first deployment: ships OFF; flip true after founder review.
export const SOCIAL_CIRCUIT_ENABLED = false;

// Hero Hearts Bundles - price tiers with bonus hearts
export const HERO_HEARTS_BUNDLES = [
  {
    id: 'bundle-100',
    name: 'Starter Bundle',
    price: 100,
    hearts: 1000,
    bonusHearts: 200,
    totalHearts: 1200,
    perDollar: 12,
    popular: false,
    description: 'Perfect for getting started with Hero Hearts',
    priceId: 'price_1T4eJxCf7KAA6aLaHqH2clKw',
    purchaseType: 'hero_hearts',
  },
  {
    id: 'bundle-250',
    name: 'Growth Bundle',
    price: 250,
    hearts: 2500,
    bonusHearts: 750,
    totalHearts: 3250,
    perDollar: 13,
    popular: true,
    description: 'Most popular choice - best value for regular gifters',
    priceId: 'price_1T4eJyCf7KAA6aLaJjJLgVTK',
    purchaseType: 'hero_hearts',
  },
  {
    id: 'bundle-500',
    name: 'Hero Bundle',
    price: 500,
    hearts: 5000,
    bonusHearts: 2000,
    totalHearts: 7000,
    perDollar: 14,
    popular: false,
    bestValue: true,
    description: 'Maximum impact - double your rewards balance',
    priceId: 'price_1T4eJzCf7KAA6aLagx468kzk',
    purchaseType: 'hero_hearts',
  }
];

// UX-HUB-3 Batch 3 — frontend "meaning" for the real-data cards. These maps translate
// machine keys from the deployed read endpoints into human display copy. TRUTH (which
// behaviors/facts/amounts exist) comes solely from the server; the frontend never invents
// rows — it only labels the rows the server returns, and an unknown future key still renders
// via humanize() with no redesign.

// Behavior key (GET /api/hearts/amounts, GET /api/hearts/history) → founder-approved label.
// The server already excludes retired (share_act) and internal (test_send); they are not
// listed here. A behavior the server adds later renders via humanize() until a label is added.
export const BEHAVIOR_LABELS = Object.freeze({
  thank_you_sent: 'Send a Thank-You Greet-Me',
  first_independent_send: 'Send your first independent Greet-Me',
  share_converted: 'Earn when your shared friend joins',
  scheduled_occasion: 'Schedule an occasion',
  first_5_distinct: 'Reach 5 delivered recipients',
  real_send_with_gift: 'Send a Greet-Me with a gift',
  first_10_distinct: 'Reach 10 delivered recipients',
  subscribe: 'Subscribe',
  repeat_occasion: 'Celebrate a repeat occasion',
  additional_gift: 'Add an additional gift',
  upgrade: 'Upgrade your plan',
});

// Social Circuit fact key (GET /api/social/circuit) → human label. Boolean facts only —
// no score, no count, no popularity. A future fact key renders via humanize() with no redesign.
export const SOCIAL_FACT_LABELS = Object.freeze({
  hasConfirmedReach: 'Your Greet-Me reached someone',
  hasReciprocatedConnection: 'Someone opened your Greet-Me',
});

// Fallback label for an unknown machine key: strip a leading "has", split on _ / camelCase,
// and Title-Case the words (e.g. "hasNewMilestone" → "New Milestone", "foo_bar" → "Foo Bar").
export function humanize(key) {
  if (!key || typeof key !== 'string') return '';
  return key
    .replace(/^has(?=[A-Z])/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(' ');
}
