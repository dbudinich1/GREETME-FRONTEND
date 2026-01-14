// src/utils/rewards.js
// Greet-Me Rewards™ - V1 Frontend Implementation (localStorage-based)

// Note: Notifications are triggered by calling code to avoid circular imports
// Use pushInApp(COMMS_EVENTS.REWARDS_EARNED, { amount, reason }) after addRewards()

export const REWARD_ACTIONS = {
  ACCOUNT_CREATED: 10,
  GREETING_SENT: 5,
  QR_CASH_INCLUDED: 5,
  SUBSCRIBED: 25,
  UPGRADE_UNLIMITED: 50,
  REFERRAL_CONVERTED: 50,
  GREETING_RECEIVED: 10,
  SPECIAL_OCCASION: 10,
};

/**
 * DM + Tag Social Rewards
 * One reward per platform per user, capped at 50 Hearts total
 */
export const DM_TAG_ACTIONS = {
  INSTAGRAM_DM_TAG: {
    id: 'instagram_dm_tag',
    hearts: 40,
    platform: 'Instagram',
    icon: '📸',
    dmLink: 'https://ig.me/m/greetmeapp',
    prefillMessage: 'Hey Greet-Me! I just tagged someone I care about: @',
    description: 'Message us on Instagram and tag someone you care about',
  },
  TIKTOK_DM_TAG: {
    id: 'tiktok_dm_tag',
    hearts: 40,
    platform: 'TikTok',
    icon: '🎵',
    dmLink: 'https://www.tiktok.com/@greetmeapp',
    prefillMessage: 'Hey Greet-Me! I just tagged someone I care about: @',
    description: 'Message us on TikTok and tag someone you care about',
  },
  VALENTINES_DM_TAG: {
    id: 'valentines_dm_tag',
    hearts: 50,
    platform: 'Campaign',
    icon: '💕',
    dmLink: 'https://ig.me/m/greetmeapp',
    prefillMessage: 'Spreading love this Valentine\'s! I tagged someone special: @',
    description: 'Valentine\'s Special: Share the love and tag someone special',
    campaign: true,
    expiresAt: '2025-02-28', // Campaign expiration
  },
};

// Storage keys for DM+Tag tracking
const DM_TAG_CLAIMS_KEY = 'greetme_dm_tag_claims';
const DM_TAG_TOTAL_CAP = 50; // Max Hearts from all DM+Tag actions

export const REDEMPTION_OPTIONS = [
  { id: 'subscription_discount', label: '$5 off next subscription bill', cost: 50, description: 'Applied automatically at checkout' },
  { id: 'free_greeting', label: 'Free greeting credit', cost: 25, description: 'Send one greeting for free' },
  { id: 'qr_cash_waiver', label: 'QR Cash fee waiver', cost: 25, description: 'No fee on your next QR Cash gift' },
  { id: 'marketplace_discount', label: 'Marketplace gift discount', cost: 75, description: '10% off American Marketplace gifts' },
];

export const REWARDS_KEY = 'greetme_rewards_balance';
export const REWARDS_HISTORY_KEY = 'greetme_rewards_history';
const DAILY_GREETING_CAP = 25; // Max hearts from greetings per day
const DAILY_GREETING_KEY = 'greetme_daily_greeting_hearts';

/**
 * Get current rewards balance
 */
export function getRewardsBalance() {
  return Number(localStorage.getItem(REWARDS_KEY)) || 0;
}

/**
 * Add rewards to balance
 * @param {number} amount - Hearts to add
 * @param {string} reason - Reason for earning (for history)
 * @returns {number} New balance
 */
export function addRewards(amount, reason = '') {
  const current = getRewardsBalance();
  const newBalance = current + amount;
  localStorage.setItem(REWARDS_KEY, newBalance.toString());

  // Add to history
  addToHistory('earned', amount, reason);

  return newBalance;
}

/**
 * Redeem rewards from balance
 * @param {number} amount - Hearts to redeem
 * @param {string} reason - Reason for redeeming (for history)
 * @returns {boolean} Success status
 */
export function redeemRewards(amount, reason = '') {
  const current = getRewardsBalance();
  if (current >= amount) {
    localStorage.setItem(REWARDS_KEY, (current - amount).toString());
    addToHistory('redeemed', amount, reason);
    return true;
  }
  return false;
}

/**
 * Check if daily greeting cap has been reached
 */
function getDailyGreetingHearts() {
  const stored = localStorage.getItem(DAILY_GREETING_KEY);
  if (!stored) return { date: '', count: 0 };

  try {
    return JSON.parse(stored);
  } catch {
    return { date: '', count: 0 };
  }
}

/**
 * Award hearts for sending a greeting (respects daily cap)
 * @returns {number} Hearts awarded (0 if cap reached)
 */
export function awardGreetingHearts() {
  const today = new Date().toISOString().split('T')[0];
  const daily = getDailyGreetingHearts();

  // Reset if new day
  if (daily.date !== today) {
    localStorage.setItem(DAILY_GREETING_KEY, JSON.stringify({ date: today, count: 0 }));
  }

  const currentDaily = daily.date === today ? daily.count : 0;

  if (currentDaily >= DAILY_GREETING_CAP) {
    return 0; // Cap reached
  }

  // Award hearts
  const heartsToAward = REWARD_ACTIONS.GREETING_SENT;
  addRewards(heartsToAward, 'Sent a greeting');

  // Update daily count
  localStorage.setItem(DAILY_GREETING_KEY, JSON.stringify({
    date: today,
    count: currentDaily + heartsToAward
  }));

  return heartsToAward;
}

/**
 * Get remaining hearts available from greetings today
 */
export function getRemainingDailyHearts() {
  const today = new Date().toISOString().split('T')[0];
  const daily = getDailyGreetingHearts();

  if (daily.date !== today) return DAILY_GREETING_CAP;
  return Math.max(0, DAILY_GREETING_CAP - daily.count);
}

/**
 * Add entry to rewards history
 */
function addToHistory(type, amount, reason) {
  const history = getRewardsHistory();
  history.unshift({
    type,
    amount,
    reason,
    timestamp: new Date().toISOString()
  });

  // Keep only last 50 entries
  if (history.length > 50) history.pop();

  localStorage.setItem(REWARDS_HISTORY_KEY, JSON.stringify(history));
}

/**
 * Get rewards history
 */
export function getRewardsHistory() {
  const stored = localStorage.getItem(REWARDS_HISTORY_KEY);
  if (!stored) return [];

  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

/**
 * Initialize rewards for new account (call on signup)
 */
export function initializeNewAccountRewards() {
  const current = getRewardsBalance();
  if (current === 0) {
    addRewards(REWARD_ACTIONS.ACCOUNT_CREATED, 'Welcome bonus for creating account');
    return REWARD_ACTIONS.ACCOUNT_CREATED;
  }
  return 0;
}

/**
 * Check if user is a Hero member (for 10% bonus)
 * Placeholder - would integrate with actual Hero membership check
 */
export function isHeroMember() {
  return localStorage.getItem('greetme_hero_member') === 'true';
}

/**
 * Calculate hearts with Hero bonus if applicable
 */
export function calculateHeartsWithBonus(baseAmount) {
  if (isHeroMember()) {
    return Math.floor(baseAmount * 1.1); // 10% bonus
  }
  return baseAmount;
}

// ============================================
// DM + TAG SOCIAL REWARDS
// ============================================

/**
 * Get all DM+Tag claims from localStorage
 * @returns {Object} Map of actionId -> claim status
 */
export function getDmTagClaims() {
  try {
    const stored = localStorage.getItem(DM_TAG_CLAIMS_KEY);
    if (!stored) return {};
    return JSON.parse(stored);
  } catch {
    return {};
  }
}

/**
 * Get total Hearts earned from DM+Tag actions
 * @returns {number} Total hearts from DM+Tag
 */
export function getDmTagTotalHearts() {
  const claims = getDmTagClaims();
  return Object.values(claims).reduce((sum, claim) => {
    if (claim.status === 'claimed') {
      return sum + (claim.hearts || 0);
    }
    return sum;
  }, 0);
}

/**
 * Get remaining Hearts available from DM+Tag actions
 * @returns {number} Hearts remaining before cap
 */
export function getDmTagRemainingHearts() {
  return Math.max(0, DM_TAG_TOTAL_CAP - getDmTagTotalHearts());
}

/**
 * Check if a DM+Tag action can be claimed
 * @param {string} actionId - The action ID (e.g., 'instagram_dm_tag')
 * @returns {Object} { canClaim, reason }
 */
export function canClaimDmTag(actionId) {
  const claims = getDmTagClaims();
  const action = Object.values(DM_TAG_ACTIONS).find(a => a.id === actionId);

  if (!action) {
    return { canClaim: false, reason: 'Invalid action' };
  }

  // Check if already claimed
  if (claims[actionId]?.status === 'claimed') {
    return { canClaim: false, reason: 'Already claimed' };
  }

  // Check if pending
  if (claims[actionId]?.status === 'pending') {
    return { canClaim: false, reason: 'Pending confirmation' };
  }

  // Check campaign expiration
  if (action.campaign && action.expiresAt) {
    const now = new Date();
    const expires = new Date(action.expiresAt);
    if (now > expires) {
      return { canClaim: false, reason: 'Campaign ended' };
    }
  }

  // Check total cap
  const totalEarned = getDmTagTotalHearts();
  if (totalEarned >= DM_TAG_TOTAL_CAP) {
    return { canClaim: false, reason: 'Maximum Hearts reached' };
  }

  // Check if hearts would exceed cap (award partial if needed)
  const remaining = DM_TAG_TOTAL_CAP - totalEarned;
  const heartsToAward = Math.min(action.hearts, remaining);

  return { canClaim: true, heartsToAward };
}

/**
 * Mark a DM+Tag action as started (user clicked to open DM)
 * @param {string} actionId - The action ID
 */
export function startDmTagClaim(actionId) {
  const claims = getDmTagClaims();

  if (!claims[actionId]) {
    claims[actionId] = {
      status: 'started',
      startedAt: new Date().toISOString(),
    };
    localStorage.setItem(DM_TAG_CLAIMS_KEY, JSON.stringify(claims));
  }
}

/**
 * Get the status of a DM+Tag action
 * @param {string} actionId - The action ID
 * @returns {string|null} Status: 'started', 'pending', 'claimed', or null
 */
export function getDmTagStatus(actionId) {
  const claims = getDmTagClaims();
  return claims[actionId]?.status || null;
}

/**
 * Claim a DM+Tag reward (V1: auto-grant on user confirmation)
 * @param {string} actionId - The action ID
 * @returns {Object} { success, hearts, message }
 */
export function claimDmTagReward(actionId) {
  const { canClaim, heartsToAward, reason } = canClaimDmTag(actionId);

  if (!canClaim) {
    return { success: false, hearts: 0, message: reason };
  }

  const action = Object.values(DM_TAG_ACTIONS).find(a => a.id === actionId);
  const claims = getDmTagClaims();

  // Award the hearts
  addRewards(heartsToAward, `Shared on ${action.platform}`);

  // Update claim status
  claims[actionId] = {
    status: 'claimed',
    hearts: heartsToAward,
    claimedAt: new Date().toISOString(),
    platform: action.platform,
  };
  localStorage.setItem(DM_TAG_CLAIMS_KEY, JSON.stringify(claims));

  return {
    success: true,
    hearts: heartsToAward,
    message: 'Thanks for spreading a meaningful moment ❤️',
  };
}

/**
 * Get available DM+Tag actions (not yet claimed, not expired)
 * @returns {Array} Array of available actions with claim status
 */
export function getAvailableDmTagActions() {
  const claims = getDmTagClaims();
  const now = new Date();

  return Object.entries(DM_TAG_ACTIONS).map(([key, action]) => {
    const claim = claims[action.id];
    const status = claim?.status || 'available';

    // Check expiration for campaigns
    let expired = false;
    if (action.campaign && action.expiresAt) {
      expired = now > new Date(action.expiresAt);
    }

    // Check if cap reached
    const { canClaim, heartsToAward } = canClaimDmTag(action.id);

    return {
      ...action,
      key,
      status,
      expired,
      canClaim: canClaim && !expired,
      heartsToAward: heartsToAward || action.hearts,
      claimedHearts: claim?.hearts || 0,
    };
  });
}
