// src/components/GreetingCardProto/corporateDelivery.js
//
// TEAM C — Phase A5: pure adapter turning the sanitized public corporate projection
// (returned by GET /api/public/greetings/:jobId as `corporatePresentation`) into the facts
// the viewer renders. No React → unit-testable.
//
// The projection carries only presence/mode/order + opaque image keys. Actual image bytes
// are fetched through the scoped resolver GET /api/public/greetings/:jobId/assets/:assetKey,
// which mints a fresh short-lived read-only SAS server-side. The animated-message OUTPUT is
// the greeting's existing videoUrl (the unchanged personal animation path) — never resolved
// through the corporate asset endpoint.
//
// Four supported outcomes (derived, never hard-coded):
//   • Animation only        messageSource "animation", no image keys
//   • Images only           messageSource "images",    image keys present
//   • Animation + images     messageSource "animation", image keys present
//   • Intro & Finale Only    featuredSpreadPresent false  → FEATURED screen omitted upstream

export function assetUrlFor(jobId, assetKey, apiBase = "") {
  return `${apiBase}/api/public/greetings/${encodeURIComponent(jobId)}/assets/${encodeURIComponent(assetKey)}`;
}

export function buildCorporateViewerFacts(corporatePresentation, { jobId, apiBase = "" } = {}) {
  if (!corporatePresentation || corporatePresentation.corporate !== true) return null;

  const featuredSpreadPresent = corporatePresentation.featuredSpreadPresent === true;
  const messageSource = corporatePresentation.messageSource || "none";
  const imageKeys = Array.isArray(corporatePresentation.imageKeys) ? corporatePresentation.imageKeys : [];
  const imageUrls = featuredSpreadPresent ? imageKeys.map((k) => assetUrlFor(jobId, k, apiBase)) : [];

  // The completed animation is a durable corporate artifact fetched through the SAME scoped
  // resolver (assetKey "animation") — NEVER the raw videoUrl. hasAnimation is a server flag.
  const hasAnimation = featuredSpreadPresent && messageSource === "animation" && corporatePresentation.hasAnimation === true;
  const animationUrl = hasAnimation ? assetUrlFor(jobId, "animation", apiBase) : null;

  return {
    corporate: true,
    featuredSpreadPresent,
    presentationMode: corporatePresentation.presentationMode || (featuredSpreadPresent ? "featured" : "intro_finale_only"),
    messageSource,
    screenOrder: Array.isArray(corporatePresentation.screenOrder) ? corporatePresentation.screenOrder.slice() : [],
    imageUrls,
    animationUrl, // resolver URL for the completed animation (null if none) — never a D-ID URL
    // Corporate Video is never a rendering source.
    showAnimation: hasAnimation,
    showImages: featuredSpreadPresent && imageUrls.length > 0,
  };
}