// src/corporateCampaign/screenOrder.js
//
// Content-derived recipient-card screen order (frontend mirror). Pure logic. UNMOUNTED —
// NOT integrated into GreetingCard.jsx in Phase A1. Mirrors the verified existing
// GreetingCard conventions (dots = order.slice(1); envelope excluded; back floors at
// index 1; entry opens on the envelope) so future integration is drop-in parity.

export const SCREENS = Object.freeze({
  ENVELOPE: "envelope",
  COVER: "cover",
  INTRO: "intro",
  FEATURED: "featured",
  FINALE: "finale",
});

export function deriveScreenOrder({ featuredPresent } = {}) {
  const order = [
    SCREENS.ENVELOPE,
    SCREENS.COVER,
    SCREENS.INTRO,
    ...(featuredPresent ? [SCREENS.FEATURED] : []),
    SCREENS.FINALE,
  ];
  const dotScreens = order.slice(1);
  return {
    order,
    screenCount: order.length,
    dotScreens,
    dotCount: dotScreens.length,
    envelopeInDots: false,
    firstScreen: SCREENS.ENVELOPE,
    indexOf: (screen) => order.indexOf(screen),
    canGoBack: (screen) => order.indexOf(screen) > 1,
    canGoForward: (screen) => {
      const i = order.indexOf(screen);
      return i >= 0 && i < order.length - 1;
    },
    next: (screen) => {
      const i = order.indexOf(screen);
      return i >= 0 && i < order.length - 1 ? order[i + 1] : null;
    },
    prev: (screen) => {
      const i = order.indexOf(screen);
      return i > 1 ? order[i - 1] : null;
    },
    pageOf: (screen) => {
      if (screen === SCREENS.ENVELOPE) return { onEnvelope: true, index: null, total: dotScreens.length, label: null };
      const idx = dotScreens.indexOf(screen);
      if (idx < 0) return { onEnvelope: false, index: null, total: dotScreens.length, label: null };
      return { onEnvelope: false, index: idx + 1, total: dotScreens.length, label: `Page ${idx + 1} of ${dotScreens.length}` };
    },
  };
}
