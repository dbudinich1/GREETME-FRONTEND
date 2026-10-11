// Founder-required subscription terms (2026-10-02). ONE place for the exact wording, shown wherever a subscription is priced
// or paid for: Pricing, Cart, Checkout. No amounts here (the platform fee amount always comes from the server).
export const SUBSCRIPTION_RENEWAL_NOTICE = 'Subscription automatically renews until cancelled.';
export const PLATFORM_FEE_ONE_TIME_NOTICE = 'The platform fee is charged one time only, even if you later upgrade to a Business plan.';
// Impact per-greeting charge consent (decision 3, CL-04). Exact wording APPROVED by the founder 2026-10-09: Impact checkout
// ONLY (not Legal, not Pricing). Shown at checkout only when the plan being bought is Impact
// (planTier business_scale), the tier the backend charges per send (services/billing/impactPerSendCharge.js, 299 cents).
export const IMPACT_PER_SEND_CONSENT_NOTICE = 'Each Greet-Me you send on the Impact plan is charged $2.99 to the card on your subscription.';
