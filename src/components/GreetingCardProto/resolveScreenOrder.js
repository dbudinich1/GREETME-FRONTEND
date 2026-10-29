// src/components/GreetingCardProto/resolveScreenOrder.js
//
// TEAM C — Phase A3: content-derived screen order for the recipient card.
//
// PERSONAL greetings (and corporate greetings that HAVE a Featured Spread) use the exact
// existing 5-screen order — byte-for-byte unchanged. A CORPORATE greeting whose Featured
// Spread is omitted (all three controls disabled) drops the FEATURED screen, yielding:
//   Envelope → Cover → Interior → Finale
// Progress dots follow the existing convention: order.slice(1) (the envelope is excluded).
// Pure module (no React) so the navigation logic is unit-testable.

export const CARD_SCREENS = Object.freeze({
  ENVELOPE: "envelope",
  COVER: "cover",
  INTERIOR: "interior",
  FEATURED: "featured",
  FINALE: "finale",
});

// The canonical personal order — identical to the historical fixed SCREEN_ORDER.
export const PERSONAL_SCREEN_ORDER = Object.freeze([
  CARD_SCREENS.ENVELOPE,
  CARD_SCREENS.COVER,
  CARD_SCREENS.INTERIOR,
  CARD_SCREENS.FEATURED,
  CARD_SCREENS.FINALE,
]);

// A corporate greeting is one explicitly flagged corporate; only such a greeting can omit
// the Featured Spread. Any greeting without the corporate flag keeps the personal order.
export function isCorporateGreeting(greeting) {
  return !!greeting && greeting.corporate === true;
}

// Featured is present unless a corporate greeting explicitly declares it absent.
export function featuredSpreadPresent(greeting) {
  if (isCorporateGreeting(greeting)) return greeting.featuredSpreadPresent !== false;
  return true; // personal always has the featured spread
}

export function resolveScreenOrder(greeting) {
  if (isCorporateGreeting(greeting) && greeting.featuredSpreadPresent === false) {
    return [CARD_SCREENS.ENVELOPE, CARD_SCREENS.COVER, CARD_SCREENS.INTERIOR, CARD_SCREENS.FINALE];
  }
  // personal (and corporate-with-featured) → the exact existing order
  return PERSONAL_SCREEN_ORDER.slice();
}

// Progress dots = order minus the envelope (existing convention).
export function dotScreens(order) {
  return order.slice(1);
}
