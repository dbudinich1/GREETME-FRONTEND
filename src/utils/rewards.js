// src/utils/rewards.js
// Greet-Me Rewards™ — Hearts 1A / H5 cutover.
//
// Hearts balance + earning are now SERVER-authoritative (GET /api/hearts/balance).
// This module retains ONLY the legacy localStorage redemption path, kept INERT for
// H5 (redeem buttons are disabled by the server balance) and slated for removal in
// H6 alongside the issuance-enable cutover (LOCKED CUTOVER RULE).
//
// Removed in H5: all client-side earning (addRewards / awardGreetingHearts /
// initializeNewAccountRewards), the daily-cap helpers, self-attested social
// (DM+Tag / Instagram / TikTok / Campaign), the isHero placeholder, and the
// localStorage Hearts-history UI feed. No fake earning, no fake balance display.

export const REDEMPTION_OPTIONS = [
  { id: 'subscription_discount', label: '$5 off next subscription bill', cost: 50, description: 'Applied automatically at checkout' },
  { id: 'free_greeting', label: 'Free greeting credit', cost: 25, description: 'Send one greeting for free' },
  { id: 'qr_cash_waiver', label: 'QR Cash fee waiver', cost: 25, description: 'No fee on your next QR Cash gift' },
  { id: 'marketplace_discount', label: 'Marketplace gift discount', cost: 75, description: '10% off American Gift Place gifts' },
];

// Legacy localStorage keys — retained only so the inert redemption path compiles.
export const REWARDS_KEY = 'greetme_rewards_balance';
const REWARDS_HISTORY_KEY = 'greetme_rewards_history';

// Private: legacy localStorage balance. NOT used for display (display reads the
// server). Referenced only by the inert redeemRewards() below.
function getLocalRewardsBalance() {
  return Number(localStorage.getItem(REWARDS_KEY)) || 0;
}

// Private: legacy history writer, used only by the inert redeemRewards(). Not a UI
// surface (the history display was removed in H5).
function addToHistory(type, amount, reason) {
  let history = [];
  try { history = JSON.parse(localStorage.getItem(REWARDS_HISTORY_KEY)) || []; } catch { history = []; }
  history.unshift({ type, amount, reason, timestamp: new Date().toISOString() });
  if (history.length > 50) history.pop();
  localStorage.setItem(REWARDS_HISTORY_KEY, JSON.stringify(history));
}

/**
 * LEGACY redemption — retained INERT for H5. Unreachable in the UI: every redeem
 * button is disabled by the server-sourced balance (0 while issuance is OFF), so
 * the redeem modal never opens and this is never invoked. Removed in H6 with the
 * redemption cutover, in the same release that enables issuance.
 */
export function redeemRewards(amount, reason = '') {
  const current = getLocalRewardsBalance();
  if (current >= amount) {
    localStorage.setItem(REWARDS_KEY, (current - amount).toString());
    addToHistory('redeemed', amount, reason);
    return true;
  }
  return false;
}
