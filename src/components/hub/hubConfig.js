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
