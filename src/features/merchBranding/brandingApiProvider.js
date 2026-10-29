// src/features/merchBranding/brandingApiProvider.js
// REPORT 153 — which API the feature talks to. Production: Greet-Me's own server. The local preview
// (reports/assets/153_merch_branding/preview) replaces THIS module with the in-memory double via a
// preview-only Vite alias; nothing in the shipped bundle can select the double.
import { createHttpBrandingApi } from './brandingApi.js';

let api = null;
export function getBrandingApi() {
  if (!api) api = createHttpBrandingApi();
  return api;
}
