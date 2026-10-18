// src/components/setupRevisit.js
//
// Opener for GuidedSetupFlow's REVISIT mode (voice & photo only), used by the dashboard's "Re-record" and
// "Revisit setup · voice & photo". DashboardLayout owns the mount and listens for this event.
export const SETUP_REVISIT_EVENT = 'gm:open-setup-revisit';
export function openSetupRevisit() {
  window.dispatchEvent(new CustomEvent(SETUP_REVISIT_EVENT));
}
// The steps revisit mode may show: Voice (2) and Photo (3). Nothing after Photo is reachable.
export const REVISIT_FIRST_STEP = 2;
export const REVISIT_LAST_STEP = 3;
