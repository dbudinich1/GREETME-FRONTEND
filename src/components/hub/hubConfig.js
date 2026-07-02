// src/components/hub/hubConfig.js
// UX-HUB-3 Batch 2 — shared Hearts Hub constants ("meaning"), extracted verbatim from
// Rewards.jsx during the behavior-preserving component extraction. Values are unchanged;
// this file only relocates them so the extracted Hub components can import their meaning
// from one place instead of receiving large constants as props. No logic, no state.

// H7: locked launch redemption — 500 Hearts → 1 Anytime Greet-Me (in-kind only).
// Canonical cost per Unified Hearts Alive Work Plan §2.3 (WS-3 reprice; backend
// FREE_GREETING_COST=500). This is display truth only — the server is authoritative on the
// charged amount; the redemption flow is unchanged.
export const REDEEM_COST = 500;

// ── Founder Canonical Catalog (Unified Hearts Alive Work Plan §2.3) ──────────────────────
// The complete, ordered Hearts reward catalog grouped by the canonical categories. This is
// the single frontend source for POPULATING the Hearts Marketplace: every canonical reward is
// displayed, in its canonical category, with a truthful AVAILABLE | LOCKED state — never
// "Coming Soon", never fabricated inventory, never hidden.
//
// `available`  = redeemable TODAY. Truth: only the Anytime Greet-Me (the live H7 Free
//                Greeting) is available now. As each reward's capability lands, flip its flag
//                here (and wire its redemption in a separately-authorized step) — future
//                expansion is a data edit, no redesign.
// `hearts`     = canonical Hearts cost (frozen §2.3). Anytime mirrors REDEEM_COST (single source).
// `unlock`     = the REAL, canon-defined requirement a LOCKED reward is gated behind, shown
//                truthfully. Only set where the canon defines the gate: subscriber-gated
//                (Subscription / Upgrade discounts) and Champion-gated (Champion tier + the
//                Champion-gated gift credits, §2.3). `null` = no canonical unlock rule is
//                defined yet — NOT invented here; it renders as a plain LOCKED badge and is
//                flagged for founder ratification (§8.3). No numeric thresholds are invented.
export const CANONICAL_CATALOG = Object.freeze([
  { category: 'Greet-Me', rewards: [
    { id: 'anytime_greetme', title: 'Anytime Greet-Me',            hearts: REDEEM_COST, available: true,  unlock: null },
    { id: 'anytime_3',       title: '3 Anytime Credits',           hearts: 1200,        available: false, unlock: null },
    { id: 'anytime_5',       title: '5 Anytime Credits',           hearts: 2000,        available: false, unlock: null },
    { id: 'holiday_bonus',   title: 'Holiday Bonus Send',          hearts: 750,         available: false, unlock: null },
  ] },
  { category: 'Subscription', rewards: [
    { id: 'renewal_10',      title: '10% Renewal Discount',        hearts: 750,         available: false, unlock: 'Active subscription' },
    { id: 'renewal_15',      title: '15% Renewal Discount',        hearts: 1200,        available: false, unlock: 'Active subscription' },
    { id: 'renewal_20',      title: '20% Renewal Discount',        hearts: 2000,        available: false, unlock: 'Active subscription' },
  ] },
  { category: 'Personalization', rewards: [
    { id: 'upgrade_discount', title: 'Upgrade Discount',           hearts: 1000,        available: false, unlock: 'Active subscription' },
  ] },
  { category: 'Champion', rewards: [
    { id: 'upgrade_credit',  title: 'Upgrade Credit',              hearts: 1500,        available: false, unlock: 'Heart Champion' },
  ] },
  { category: 'Convenience', rewards: [
    { id: 'premium_30',        title: '30-Day Premium Access',      hearts: 2500,        available: false, unlock: null },
    { id: 'hero_theme',        title: 'Hero Theme Collection',      hearts: 800,         available: false, unlock: null },
    { id: 'signature_effects', title: 'Signature Effects',          hearts: 900,         available: false, unlock: null },
    { id: 'celebration_effects', title: 'Celebration Effects',      hearts: 900,         available: false, unlock: null },
    { id: 'gift_5',            title: '$5 Greet-Me Gift Credit',    hearts: 2500,        available: false, unlock: 'Heart Champion' },
    { id: 'gift_10',           title: '$10 Greet-Me Gift Credit',   hearts: 5000,        available: false, unlock: 'Heart Champion' },
    { id: 'gift_25',           title: '$25 Greet-Me Gift Credit',   hearts: 10000,       available: false, unlock: 'Heart Champion' },
    { id: 'qr_fee_waiver',     title: 'QR Cash Fee Waiver',         hearts: 500,         available: false, unlock: null },
    { id: 'premium_theme',     title: 'Premium Theme Unlock',       hearts: 750,         available: false, unlock: null },
    { id: 'bonus_storage',     title: 'Bonus Media Storage',        hearts: 1500,        available: false, unlock: null },
    { id: 'album_capacity',    title: 'Extra Memory Album Capacity', hearts: 2000,       available: false, unlock: null },
  ] },
]);

// J1 — frontend-owned Journey MEANING (labels + order only). TRUTH (the booleans)
// comes solely from J0 (GET /api/journey/progress); the frontend never computes,
// aggregates, or persists Journey state. Each step maps to exactly one J0 fact.
export const JOURNEY_STEPS = [
  { key: 'hasCompletedOnboarding', label: 'Set up your voice & photo' },
  { key: 'hasSentFirstGreeting', label: 'Send your first Greet-Me' },
  { key: 'hasEarnedFirstHeart', label: 'Earn your first Heart' },
  { key: 'hasSentGiftGreeting', label: 'Send a Greet-Me with a gift' },
];

// WS-5 (T5.2) — Journey chapter MEANING (labels + copy only). TRUTH (unlocked/complete
// per chapter) comes solely from the backend chapter/state model (GET /api/journey/progress
// → `chapters`); the frontend never computes chapter state — it only labels the keys the
// server returns. Keys mirror services/journeyService.js JOURNEY_CHAPTER_KEYS. An unknown
// future key still renders via humanize() with no redesign.
export const JOURNEY_CHAPTERS = Object.freeze({
  getting_started: {
    label: 'Getting Started',
    blurb: 'Master Greet-Me — send, schedule, gift, and reach your first people.',
    lockedBlurb: '',
  },
  social_circuit: {
    label: 'Social Circuit',
    blurb: 'Grow the Greet-Me community and bring others into the circle.',
    lockedBlurb: 'Opens once the Social Circuit is live.',
  },
  rewards_marketplace: {
    label: 'Rewards Marketplace',
    blurb: 'Put your Hearts to work on meaningful, Greet-Me-native rewards.',
    lockedBlurb: 'Opens when the Rewards Marketplace goes live.',
  },
  giving_back: {
    label: 'Giving Back',
    blurb: 'Lift others up — the most meaningful chapter of the journey.',
    lockedBlurb: 'Opens with Giving Back.',
  },
});

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

// SOCIAL-C — Post URL Verification Lite frontend kill-switch. DORMANT (default OFF): the
// "Paste your post link" intake renders NOTHING while false, matching the backend flag
// (LAUNCH_CONTROL.postVerificationEnabled). Manual human review only — no auto-verify.
// Flip true only after founder review AND the backend flag is on. Founder-controlled.
export const POST_VERIFICATION_ENABLED = false;

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
// DISPLAY COPY ONLY — these are presentation labels; the server behavior/key names are unchanged.
// The server currently excludes internal (test_send) from the earn list; share_act carries its
// founder-approved label here so it renders correctly if/when surfaced (no behavior change). A
// behavior the server adds later renders via humanize() until a label is added.
export const BEHAVIOR_LABELS = Object.freeze({
  registration_complete: 'Complete Registration',
  onboarding_complete: 'Complete Onboarding',
  chapter_1_complete: 'Chapter Completion',
  thank_you_sent: 'Send a Thank-You',
  first_independent_send: 'First Greet-Me',
  share_converted: 'Friend Joins Through Your Share',
  scheduled_occasion: 'Schedule an occasion',
  first_5_distinct: 'Reach 5 delivered recipients',
  real_send_with_gift: 'Send a Gift Greet-Me',
  first_10_distinct: 'Reach 10 delivered recipients',
  subscribe: 'Subscribe',
  repeat_occasion: 'Celebrate a repeat occasion',
  additional_gift: 'Add an additional gift',
  upgrade: 'Upgrade Your Plan',
  share_act: 'Share the Love',
  social_handle_connect: 'Social Media Connection',
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
