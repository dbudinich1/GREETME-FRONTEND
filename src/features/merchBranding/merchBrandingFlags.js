// src/features/merchBranding/merchBrandingFlags.js
// REPORT 153 — the frontend switch for the Printful branded catalog. SWITCHED OFF.
//
// A hard-coded literal false with NO env override (an env var cannot wake it). While false:
//   * "Brand for My Company" keeps today's behaviour (the For Business contact form);
//   * no upload control, no branding controls and no branded card state render anywhere;
//   * the feature's API client is never called.
// The server has its own, independent switch (merch-be services/merchBranding/merchBrandingFlags.js);
// turning this one on alone would only reach a gate that answers 404.
//
// Code MUST NEVER self-toggle this — founder-controlled only.

const MERCH_BRANDING_ENABLED = false;

export function merchBrandingEnabled() {
  return MERCH_BRANDING_ENABLED === true;
}
