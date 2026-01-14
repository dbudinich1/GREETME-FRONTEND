// src/utils/commsCatalog.js
// Greet-Me Communications Catalog - Single Source of Truth for all user-facing messages

/**
 * Communication Categories
 */
export const COMMS_CATEGORIES = {
  ACCOUNT: 'ACCOUNT',
  PROFILE: 'PROFILE',
  GREETING: 'GREETING',
  QRCASH: 'QRCASH',
  BILLING: 'BILLING',
  REWARDS: 'REWARDS',
  PROMO: 'PROMO',
  SYSTEM: 'SYSTEM',
};

/**
 * Canonical Event Names
 */
export const COMMS_EVENTS = {
  // Account
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  ACCOUNT_VERIFIED: 'ACCOUNT_VERIFIED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',

  // Profile / Presence
  VOICE_UPLOADED: 'VOICE_UPLOADED',
  VOICE_READY: 'VOICE_READY',
  PHOTO_UPLOADED: 'PHOTO_UPLOADED',
  PROFILE_COMPLETE: 'PROFILE_COMPLETE',

  // Greeting Lifecycle
  GREETING_DRAFT_SAVED: 'GREETING_DRAFT_SAVED',
  GREETING_SCHEDULED: 'GREETING_SCHEDULED',
  GREETING_SENT: 'GREETING_SENT',
  GREETING_DELIVERED: 'GREETING_DELIVERED',
  GREETING_VIEWED: 'GREETING_VIEWED',
  GREETING_REPLIED: 'GREETING_REPLIED',

  // QR Cash Lifecycle
  QRCASH_ADDED: 'QRCASH_ADDED',
  QRCASH_FUNDED: 'QRCASH_FUNDED',
  QRCASH_SENT: 'QRCASH_SENT',
  QRCASH_CLAIMED: 'QRCASH_CLAIMED',
  QRCASH_EXPIRED_WARNING: 'QRCASH_EXPIRED_WARNING',

  // Subscription / Billing
  SUBSCRIPTION_ACTIVE: 'SUBSCRIPTION_ACTIVE',
  SUBSCRIPTION_RENEWED: 'SUBSCRIPTION_RENEWED',
  SUBSCRIPTION_EXPIRING: 'SUBSCRIPTION_EXPIRING',
  PAYMENT_SUCCESS: 'PAYMENT_SUCCESS',
  PAYMENT_FAILED: 'PAYMENT_FAILED',

  // Rewards
  REWARDS_EARNED: 'REWARDS_EARNED',
  REWARDS_MILESTONE: 'REWARDS_MILESTONE',
  REWARDS_REDEEMED: 'REWARDS_REDEEMED',

  // Promo
  PROMO_ELIGIBLE: 'PROMO_ELIGIBLE',
  PROMO_CLAIMED: 'PROMO_CLAIMED',
  REFERRAL_SENT: 'REFERRAL_SENT',
  REFERRAL_CONVERTED: 'REFERRAL_CONVERTED',

  // System
  SYSTEM_NOTICE: 'SYSTEM_NOTICE',
  FEATURE_UPDATE: 'FEATURE_UPDATE',
  MAINTENANCE_SCHEDULED: 'MAINTENANCE_SCHEDULED',
};

/**
 * Message Registry - All user-facing communications
 *
 * Structure:
 * - id: unique identifier
 * - category: COMMS_CATEGORIES value
 * - channel: 'inapp' | 'email' | 'both'
 * - title: notification title
 * - body: notification body (supports {{placeholders}})
 * - ctaLabel: optional button text
 * - ctaHref: optional button link
 * - cooldownHours: minimum hours between same message
 * - dedupeKey: key for deduplication
 * - toast: show as toast notification
 * - enabled: toggle message on/off
 */
export const COMMS_MESSAGES = {
  // ============================================
  // ACCOUNT MESSAGES
  // ============================================
  [COMMS_EVENTS.ACCOUNT_CREATED]: {
    id: 'account_created',
    category: COMMS_CATEGORIES.ACCOUNT,
    channel: 'both',
    title: 'Welcome to Greet-Me!',
    body: 'Your account is ready. Start by recording your voice and uploading a photo to personalize your greetings.',
    ctaLabel: 'Set Up Profile',
    ctaHref: '/dashboard',
    cooldownHours: 0,
    dedupeKey: 'account_created',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.ACCOUNT_VERIFIED]: {
    id: 'account_verified',
    category: COMMS_CATEGORIES.ACCOUNT,
    channel: 'inapp',
    title: 'Email Verified',
    body: 'Your email has been verified. You now have full access to all features.',
    cooldownHours: 0,
    dedupeKey: 'account_verified',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.PASSWORD_CHANGED]: {
    id: 'password_changed',
    category: COMMS_CATEGORIES.ACCOUNT,
    channel: 'both',
    title: 'Password Updated',
    body: 'Your password has been changed successfully. If you didn\'t make this change, please contact support.',
    cooldownHours: 0,
    dedupeKey: 'password_changed',
    toast: false,
    enabled: true,
  },

  // ============================================
  // PROFILE / PRESENCE MESSAGES
  // ============================================
  [COMMS_EVENTS.VOICE_UPLOADED]: {
    id: 'voice_uploaded',
    category: COMMS_CATEGORIES.PROFILE,
    channel: 'inapp',
    title: 'Voice Uploaded',
    body: 'Your voice recording has been saved. Your greetings will now include your personal voice.',
    cooldownHours: 0,
    dedupeKey: 'voice_uploaded',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.VOICE_READY]: {
    id: 'voice_ready',
    category: COMMS_CATEGORIES.PROFILE,
    channel: 'inapp',
    title: 'Voice Ready',
    body: 'Your voice is now ready to use in greetings. Recipients will hear your personal message!',
    cooldownHours: 0,
    dedupeKey: 'voice_ready',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.PHOTO_UPLOADED]: {
    id: 'photo_uploaded',
    category: COMMS_CATEGORIES.PROFILE,
    channel: 'inapp',
    title: 'Photo Uploaded',
    body: 'Your photo has been saved. It will appear in the greetings you send.',
    cooldownHours: 0,
    dedupeKey: 'photo_uploaded',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.PROFILE_COMPLETE]: {
    id: 'profile_complete',
    category: COMMS_CATEGORIES.PROFILE,
    channel: 'inapp',
    title: 'Profile Complete!',
    body: 'Great job! Your profile is all set up. You\'re ready to send personalized greetings.',
    ctaLabel: 'Send a Greeting',
    ctaHref: '/dashboard/send',
    cooldownHours: 0,
    dedupeKey: 'profile_complete',
    toast: true,
    enabled: true,
  },

  // ============================================
  // GREETING MESSAGES
  // ============================================
  [COMMS_EVENTS.GREETING_DRAFT_SAVED]: {
    id: 'greeting_draft_saved',
    category: COMMS_CATEGORIES.GREETING,
    channel: 'inapp',
    title: 'Draft Saved',
    body: 'Your greeting draft has been saved. You can finish it anytime.',
    ctaLabel: 'Continue Editing',
    ctaHref: '/dashboard/send',
    cooldownHours: 12,
    dedupeKey: 'greeting_draft_saved',
    toast: false,
    enabled: true,
  },

  [COMMS_EVENTS.GREETING_SCHEDULED]: {
    id: 'greeting_scheduled',
    category: COMMS_CATEGORIES.GREETING,
    channel: 'inapp',
    title: 'Greeting Scheduled',
    body: 'Your greeting to {{recipientName}} is scheduled for {{scheduleDate}}.',
    cooldownHours: 0,
    dedupeKey: 'greeting_scheduled_{{greetingId}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.GREETING_SENT]: {
    id: 'greeting_sent',
    category: COMMS_CATEGORIES.GREETING,
    channel: 'both',
    title: 'Greeting Sent!',
    body: 'Your greeting to {{recipientName}} is on its way.',
    ctaLabel: 'View Sent Greetings',
    ctaHref: '/dashboard/sent',
    cooldownHours: 0,
    dedupeKey: 'greeting_sent_{{greetingId}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.GREETING_DELIVERED]: {
    id: 'greeting_delivered',
    category: COMMS_CATEGORIES.GREETING,
    channel: 'inapp',
    title: 'Greeting Delivered',
    body: 'Your greeting to {{recipientName}} has been delivered.',
    cooldownHours: 0,
    dedupeKey: 'greeting_delivered_{{greetingId}}',
    toast: false,
    enabled: true,
  },

  [COMMS_EVENTS.GREETING_VIEWED]: {
    id: 'greeting_viewed',
    category: COMMS_CATEGORIES.GREETING,
    channel: 'inapp',
    title: '{{recipientName}} Opened Your Greeting!',
    body: 'Your greeting has been viewed. They loved it!',
    cooldownHours: 0,
    dedupeKey: 'greeting_viewed_{{greetingId}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.GREETING_REPLIED]: {
    id: 'greeting_replied',
    category: COMMS_CATEGORIES.GREETING,
    channel: 'both',
    title: '{{recipientName}} Replied!',
    body: 'You received a reply to your greeting.',
    ctaLabel: 'View Reply',
    ctaHref: '/dashboard/sent',
    cooldownHours: 0,
    dedupeKey: 'greeting_replied_{{greetingId}}',
    toast: true,
    enabled: true,
  },

  // ============================================
  // QR CASH MESSAGES
  // ============================================
  [COMMS_EVENTS.QRCASH_ADDED]: {
    id: 'qrcash_added',
    category: COMMS_CATEGORIES.QRCASH,
    channel: 'inapp',
    title: 'QR Cash Added',
    body: 'You added ${{amount}} QR Cash to your greeting for {{recipientName}}.',
    cooldownHours: 0,
    dedupeKey: 'qrcash_added_{{qrcashId}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.QRCASH_FUNDED]: {
    id: 'qrcash_funded',
    category: COMMS_CATEGORIES.QRCASH,
    channel: 'both',
    title: 'QR Cash Ready',
    body: 'Your ${{amount}} QR Cash gift is ready to send.',
    cooldownHours: 0,
    dedupeKey: 'qrcash_funded_{{qrcashId}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.QRCASH_SENT]: {
    id: 'qrcash_sent',
    category: COMMS_CATEGORIES.QRCASH,
    channel: 'inapp',
    title: 'QR Cash Sent',
    body: 'Your ${{amount}} QR Cash gift to {{recipientName}} is on its way.',
    cooldownHours: 0,
    dedupeKey: 'qrcash_sent_{{qrcashId}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.QRCASH_CLAIMED]: {
    id: 'qrcash_claimed',
    category: COMMS_CATEGORIES.QRCASH,
    channel: 'both',
    title: '{{recipientName}} Received Your Gift!',
    body: '{{recipientName}} has collected your ${{amount}} QR Cash gift.',
    cooldownHours: 0,
    dedupeKey: 'qrcash_claimed_{{qrcashId}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.QRCASH_EXPIRED_WARNING]: {
    id: 'qrcash_expired_warning',
    category: COMMS_CATEGORIES.QRCASH,
    channel: 'both',
    title: 'QR Cash Expiring Soon',
    body: 'Your ${{amount}} QR Cash to {{recipientName}} will expire in {{daysRemaining}} days. Remind them to collect it!',
    cooldownHours: 24,
    dedupeKey: 'qrcash_expiring_{{qrcashId}}',
    toast: false,
    enabled: true,
  },

  // ============================================
  // BILLING / SUBSCRIPTION MESSAGES
  // ============================================
  [COMMS_EVENTS.SUBSCRIPTION_ACTIVE]: {
    id: 'subscription_active',
    category: COMMS_CATEGORIES.BILLING,
    channel: 'both',
    title: 'Subscription Active!',
    body: 'Welcome to {{planName}}! You now have access to all premium features.',
    ctaLabel: 'Explore Features',
    ctaHref: '/dashboard/hero',
    cooldownHours: 0,
    dedupeKey: 'subscription_active',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.SUBSCRIPTION_RENEWED]: {
    id: 'subscription_renewed',
    category: COMMS_CATEGORIES.BILLING,
    channel: 'email',
    title: 'Subscription Renewed',
    body: 'Your {{planName}} subscription has been renewed. Thank you for being a Greet-Me member!',
    cooldownHours: 0,
    dedupeKey: 'subscription_renewed_{{periodEnd}}',
    toast: false,
    enabled: true,
  },

  [COMMS_EVENTS.SUBSCRIPTION_EXPIRING]: {
    id: 'subscription_expiring',
    category: COMMS_CATEGORIES.BILLING,
    channel: 'both',
    title: 'Subscription Expiring Soon',
    body: 'Your subscription expires in {{daysRemaining}} days. Renew now to keep your premium features.',
    ctaLabel: 'Renew Now',
    ctaHref: '/pricing',
    cooldownHours: 72,
    dedupeKey: 'subscription_expiring',
    toast: false,
    enabled: true,
  },

  [COMMS_EVENTS.PAYMENT_SUCCESS]: {
    id: 'payment_success',
    category: COMMS_CATEGORIES.BILLING,
    channel: 'inapp',
    title: 'Payment Successful',
    body: 'Your payment of ${{amount}} has been processed.',
    cooldownHours: 0,
    dedupeKey: 'payment_success_{{transactionId}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.PAYMENT_FAILED]: {
    id: 'payment_failed',
    category: COMMS_CATEGORIES.BILLING,
    channel: 'both',
    title: 'Payment Issue',
    body: 'We couldn\'t process your payment. Please update your payment method to continue.',
    ctaLabel: 'Update Payment',
    ctaHref: '/dashboard/settings',
    cooldownHours: 24,
    dedupeKey: 'payment_failed',
    toast: true,
    enabled: true,
  },

  // ============================================
  // REWARDS MESSAGES
  // ============================================
  [COMMS_EVENTS.REWARDS_EARNED]: {
    id: 'rewards_earned',
    category: COMMS_CATEGORIES.REWARDS,
    channel: 'inapp',
    title: 'Hearts Earned!',
    body: 'You earned {{amount}} Hearts for {{reason}}.',
    cooldownHours: 0,
    dedupeKey: 'rewards_earned_{{timestamp}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.REWARDS_MILESTONE]: {
    id: 'rewards_milestone',
    category: COMMS_CATEGORIES.REWARDS,
    channel: 'inapp',
    title: 'Milestone Reached!',
    body: 'Congratulations! You\'ve earned {{totalHearts}} Hearts total. Keep it up!',
    ctaLabel: 'View Rewards',
    ctaHref: '/dashboard/rewards',
    cooldownHours: 0,
    dedupeKey: 'rewards_milestone_{{milestone}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.REWARDS_REDEEMED]: {
    id: 'rewards_redeemed',
    category: COMMS_CATEGORIES.REWARDS,
    channel: 'inapp',
    title: 'Reward Redeemed',
    body: 'You redeemed {{cost}} Hearts for {{rewardName}}.',
    cooldownHours: 0,
    dedupeKey: 'rewards_redeemed_{{timestamp}}',
    toast: true,
    enabled: true,
  },

  // ============================================
  // PROMO MESSAGES
  // ============================================
  [COMMS_EVENTS.PROMO_ELIGIBLE]: {
    id: 'promo_eligible',
    category: COMMS_CATEGORIES.PROMO,
    channel: 'inapp',
    title: 'Special Offer Available!',
    body: '{{promoDescription}}',
    ctaLabel: 'Claim Offer',
    ctaHref: '/pricing',
    cooldownHours: 168, // 7 days
    dedupeKey: 'promo_eligible_{{promoId}}',
    toast: false,
    enabled: true,
  },

  [COMMS_EVENTS.PROMO_CLAIMED]: {
    id: 'promo_claimed',
    category: COMMS_CATEGORIES.PROMO,
    channel: 'inapp',
    title: 'Offer Applied!',
    body: 'Your promotional offer has been applied. Enjoy your savings!',
    cooldownHours: 0,
    dedupeKey: 'promo_claimed_{{promoId}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.REFERRAL_SENT]: {
    id: 'referral_sent',
    category: COMMS_CATEGORIES.PROMO,
    channel: 'inapp',
    title: 'Referral Sent',
    body: 'Your referral invitation to {{email}} has been sent.',
    cooldownHours: 0,
    dedupeKey: 'referral_sent_{{email}}',
    toast: true,
    enabled: true,
  },

  [COMMS_EVENTS.REFERRAL_CONVERTED]: {
    id: 'referral_converted',
    category: COMMS_CATEGORIES.PROMO,
    channel: 'both',
    title: 'Referral Bonus!',
    body: '{{referredName}} signed up! You\'ve earned {{bonus}} Hearts.',
    ctaLabel: 'View Rewards',
    ctaHref: '/dashboard/rewards',
    cooldownHours: 0,
    dedupeKey: 'referral_converted_{{referredEmail}}',
    toast: true,
    enabled: true,
  },

  // ============================================
  // SYSTEM MESSAGES
  // ============================================
  [COMMS_EVENTS.SYSTEM_NOTICE]: {
    id: 'system_notice',
    category: COMMS_CATEGORIES.SYSTEM,
    channel: 'inapp',
    title: 'System Notice',
    body: '{{message}}',
    cooldownHours: 0,
    dedupeKey: 'system_notice_{{noticeId}}',
    toast: false,
    enabled: true,
  },

  [COMMS_EVENTS.FEATURE_UPDATE]: {
    id: 'feature_update',
    category: COMMS_CATEGORIES.SYSTEM,
    channel: 'inapp',
    title: 'New Feature!',
    body: '{{featureDescription}}',
    ctaLabel: 'Learn More',
    ctaHref: '{{featureHref}}',
    cooldownHours: 0,
    dedupeKey: 'feature_update_{{featureId}}',
    toast: false,
    enabled: true,
  },

  [COMMS_EVENTS.MAINTENANCE_SCHEDULED]: {
    id: 'maintenance_scheduled',
    category: COMMS_CATEGORIES.SYSTEM,
    channel: 'both',
    title: 'Scheduled Maintenance',
    body: 'Greet-Me will be briefly unavailable on {{maintenanceDate}} for scheduled maintenance.',
    cooldownHours: 24,
    dedupeKey: 'maintenance_{{maintenanceDate}}',
    toast: false,
    enabled: true,
  },
};

/**
 * Get message template by event name
 * @param {string} eventName - COMMS_EVENTS value
 * @returns {object|null} Message template or null if not found/disabled
 */
export function getMessageTemplate(eventName) {
  const template = COMMS_MESSAGES[eventName];
  if (!template || !template.enabled) return null;
  return template;
}

/**
 * Replace placeholders in a string with payload values
 * @param {string} text - Text with {{placeholder}} format
 * @param {object} payload - Key-value pairs for replacement
 * @returns {string} Text with placeholders replaced
 */
export function interpolate(text, payload = {}) {
  if (!text) return '';
  return text.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return payload[key] !== undefined ? payload[key] : match;
  });
}

/**
 * Build a complete message from template and payload
 * @param {string} eventName - COMMS_EVENTS value
 * @param {object} payload - Data for placeholder replacement
 * @returns {object|null} Complete message object or null
 */
export function buildMessage(eventName, payload = {}) {
  const template = getMessageTemplate(eventName);
  if (!template) return null;

  return {
    ...template,
    title: interpolate(template.title, payload),
    body: interpolate(template.body, payload),
    ctaHref: template.ctaHref ? interpolate(template.ctaHref, payload) : null,
    dedupeKey: interpolate(template.dedupeKey, payload),
    meta: payload,
  };
}
