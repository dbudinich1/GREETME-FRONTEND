// src/utils/emailTemplates.js
// Greet-Me™ Email Template Registry (V1 = templates only, backend integration later)

import { COMMS_EVENTS, interpolate } from './commsCatalog';

/**
 * Email Template Registry
 * Each template includes:
 * - subject: Email subject line
 * - preheader: Preview text shown in email clients
 * - bodyText: Plain text version of the email body
 * - bodyHtml: HTML version (optional, for rich emails)
 * - ctaLabel: Call-to-action button text
 * - ctaHref: Call-to-action URL
 */
export const EMAIL_TEMPLATES = {
  // ============================================
  // ACCOUNT EMAILS
  // ============================================
  [COMMS_EVENTS.ACCOUNT_CREATED]: {
    subject: 'Welcome to Greet-Me™!',
    preheader: 'Your account is ready. Let\'s get started!',
    bodyText: `
Hi {{firstName}},

Welcome to Greet-Me™! We're excited to have you.

Your account is all set up and ready to go. Here's what you can do next:

1. Record your voice - Add a personal touch to every greeting
2. Upload your photo - Let recipients see your smiling face
3. Add your first recipient - Start sending heartfelt greetings

Get started now and make someone's day special!

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'Set Up Your Profile',
    ctaHref: '{{appUrl}}/dashboard',
  },

  [COMMS_EVENTS.PASSWORD_CHANGED]: {
    subject: 'Your Password Has Been Changed',
    preheader: 'Security notice from Greet-Me™',
    bodyText: `
Hi {{firstName}},

Your Greet-Me™ password was recently changed.

If you made this change, no action is needed.

If you didn't change your password, please contact us immediately at support@greet-me.com.

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'Contact Support',
    ctaHref: 'mailto:support@greet-me.com',
  },

  // ============================================
  // GREETING EMAILS
  // ============================================
  [COMMS_EVENTS.GREETING_SENT]: {
    subject: 'Your greeting to {{recipientName}} is on its way!',
    preheader: 'Your personalized greeting has been sent',
    bodyText: `
Hi {{firstName}},

Great news! Your greeting to {{recipientName}} has been sent successfully.

Greeting Details:
- Recipient: {{recipientName}}
- Occasion: {{occasion}}
- Sent: {{sentDate}}

You'll be notified when {{recipientName}} opens your greeting.

Thanks for spreading joy with Greet-Me™!

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'View Sent Greetings',
    ctaHref: '{{appUrl}}/dashboard/sent',
  },

  [COMMS_EVENTS.GREETING_VIEWED]: {
    subject: '{{recipientName}} opened your greeting!',
    preheader: 'Your greeting has been viewed',
    bodyText: `
Hi {{firstName}},

Wonderful news! {{recipientName}} just opened your greeting.

They've seen your message and heard your voice. We hope it made their day!

Want to send another greeting? It's easy - just log in and share the love.

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'Send Another Greeting',
    ctaHref: '{{appUrl}}/dashboard/send',
  },

  [COMMS_EVENTS.GREETING_REPLIED]: {
    subject: '{{recipientName}} replied to your greeting!',
    preheader: 'You have a new reply',
    bodyText: `
Hi {{firstName}},

Exciting news! {{recipientName}} has replied to your greeting.

Log in to see what they said and continue the conversation.

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'View Reply',
    ctaHref: '{{appUrl}}/dashboard/sent',
  },

  // ============================================
  // QR CASH EMAILS
  // ============================================
  [COMMS_EVENTS.QRCASH_FUNDED]: {
    subject: 'Your ${{amount}} QR Cash gift is ready!',
    preheader: 'Your cash gift has been funded',
    bodyText: `
Hi {{firstName}},

Your ${{amount}} QR Cash gift is ready to send!

The funds have been secured and your recipient can collect them anytime after they receive your greeting.

Gift Details:
- Amount: ${{amount}}
- Recipient: {{recipientName}}
- Status: Ready to send

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'Send Your Greeting',
    ctaHref: '{{appUrl}}/dashboard/send',
  },

  [COMMS_EVENTS.QRCASH_CLAIMED]: {
    subject: '{{recipientName}} received your ${{amount}} gift!',
    preheader: 'Your QR Cash gift has been collected',
    bodyText: `
Hi {{firstName}},

Great news! {{recipientName}} has collected your ${{amount}} QR Cash gift.

Thank you for sharing generosity through Greet-Me™. Your thoughtful gift made someone's day brighter!

Gift Details:
- Amount: ${{amount}}
- Recipient: {{recipientName}}
- Collected: {{claimedDate}}

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'Send Another Gift',
    ctaHref: '{{appUrl}}/dashboard',
  },

  [COMMS_EVENTS.QRCASH_EXPIRED_WARNING]: {
    subject: 'Reminder: Your QR Cash gift expires soon',
    preheader: 'Your gift to {{recipientName}} is expiring',
    bodyText: `
Hi {{firstName}},

Just a heads up - your ${{amount}} QR Cash gift to {{recipientName}} will expire in {{daysRemaining}} days.

If they haven't collected it yet, you might want to send them a friendly reminder.

Gift Details:
- Amount: ${{amount}}
- Recipient: {{recipientName}}
- Expires in: {{daysRemaining}} days

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'View Gift Status',
    ctaHref: '{{appUrl}}/dashboard',
  },

  // ============================================
  // BILLING EMAILS
  // ============================================
  [COMMS_EVENTS.SUBSCRIPTION_ACTIVE]: {
    subject: 'Welcome to {{planName}}!',
    preheader: 'Your subscription is now active',
    bodyText: `
Hi {{firstName}},

Thank you for subscribing to {{planName}}!

Your subscription is now active and you have full access to all premium features:

- Unlimited greetings
- Priority support
- Exclusive templates
- And much more!

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'Explore Features',
    ctaHref: '{{appUrl}}/dashboard/hero',
  },

  [COMMS_EVENTS.SUBSCRIPTION_RENEWED]: {
    subject: 'Your subscription has been renewed',
    preheader: 'Thank you for continuing with Greet-Me™',
    bodyText: `
Hi {{firstName}},

Your {{planName}} subscription has been renewed successfully.

Subscription Details:
- Plan: {{planName}}
- Amount: ${{amount}}
- Next billing date: {{nextBillingDate}}

Thank you for being a valued Greet-Me™ member!

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'View Account',
    ctaHref: '{{appUrl}}/dashboard/settings',
  },

  [COMMS_EVENTS.SUBSCRIPTION_EXPIRING]: {
    subject: 'Your subscription expires in {{daysRemaining}} days',
    preheader: 'Renew now to keep your premium features',
    bodyText: `
Hi {{firstName}},

Your {{planName}} subscription is expiring in {{daysRemaining}} days.

To continue enjoying all your premium features, please renew your subscription before it expires.

What you'll keep with renewal:
- Unlimited greetings
- Priority support
- Exclusive templates
- Your earned rewards

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'Renew Now',
    ctaHref: '{{appUrl}}/pricing',
  },

  [COMMS_EVENTS.PAYMENT_FAILED]: {
    subject: 'Action needed: Payment issue',
    preheader: 'Please update your payment method',
    bodyText: `
Hi {{firstName}},

We weren't able to process your recent payment for Greet-Me™.

To avoid any interruption to your service, please update your payment method as soon as possible.

You can update your payment details in your account settings.

If you have any questions, we're here to help!

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'Update Payment',
    ctaHref: '{{appUrl}}/dashboard/settings',
  },

  // ============================================
  // REWARDS EMAILS
  // ============================================
  [COMMS_EVENTS.REWARDS_MILESTONE]: {
    subject: 'Congratulations! You reached {{totalHearts}} Hearts!',
    preheader: 'You hit a rewards milestone',
    bodyText: `
Hi {{firstName}},

Congratulations! You've earned {{totalHearts}} Hearts total!

You're making great progress in the Greet-Me™ Rewards™ program. Keep sending greetings to earn even more Hearts.

Ready to redeem? Check out what rewards are available:
- $5 off your next subscription
- Free greeting credits
- QR Cash fee waivers
- And more!

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'View Rewards',
    ctaHref: '{{appUrl}}/dashboard/rewards',
  },

  // ============================================
  // PROMO EMAILS
  // ============================================
  [COMMS_EVENTS.REFERRAL_CONVERTED]: {
    subject: 'You earned {{bonus}} Hearts from a referral!',
    preheader: '{{referredName}} signed up thanks to you',
    bodyText: `
Hi {{firstName}},

Great news! {{referredName}} just signed up for Greet-Me™ using your referral.

As a thank you, we've added {{bonus}} Hearts to your rewards balance!

Keep sharing the love - you'll earn Hearts for every friend who joins.

Best,
The Greet-Me™ Team
    `.trim(),
    ctaLabel: 'Invite More Friends',
    ctaHref: '{{appUrl}}/dashboard/settings',
  },

  // ============================================
  // SYSTEM EMAILS
  // ============================================
  [COMMS_EVENTS.MAINTENANCE_SCHEDULED]: {
    subject: 'Scheduled maintenance notice',
    preheader: 'Brief downtime scheduled for {{maintenanceDate}}',
    bodyText: `
Hi {{firstName}},

We wanted to let you know that Greet-Me™ will be briefly unavailable for scheduled maintenance.

Maintenance Window:
- Date: {{maintenanceDate}}
- Duration: Approximately {{duration}}

During this time, you won't be able to access Greet-Me™. Don't worry - any scheduled greetings will still be sent!

Thank you for your patience.

Best,
The Greet-Me™ Team
    `.trim(),
  },
};

/**
 * Render an email template with payload data
 * @param {string} eventName - COMMS_EVENTS value
 * @param {object} payload - Data for placeholder replacement
 * @returns {object|null} Rendered email object or null if no template
 */
export function renderTemplate(eventName, payload = {}) {
  const template = EMAIL_TEMPLATES[eventName];
  if (!template) return null;

  // Add default values
  const data = {
    appUrl: window.location.origin,
    ...payload,
  };

  return {
    subject: interpolate(template.subject, data),
    preheader: template.preheader ? interpolate(template.preheader, data) : '',
    bodyText: interpolate(template.bodyText, data),
    ctaLabel: template.ctaLabel ? interpolate(template.ctaLabel, data) : null,
    ctaHref: template.ctaHref ? interpolate(template.ctaHref, data) : null,
  };
}

/**
 * Get all available email template event names
 * @returns {string[]} Array of event names with email templates
 */
export function getAvailableTemplates() {
  return Object.keys(EMAIL_TEMPLATES);
}

/**
 * Check if an event has an email template
 * @param {string} eventName - COMMS_EVENTS value
 * @returns {boolean} True if template exists
 */
export function hasEmailTemplate(eventName) {
  return Boolean(EMAIL_TEMPLATES[eventName]);
}
