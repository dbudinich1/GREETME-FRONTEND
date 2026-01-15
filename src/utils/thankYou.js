// src/utils/thankYou.js
// Thank You greeting utility - text-only, cost-controlled

const THANK_YOU_SENT_KEY = 'greetme_thank_you_sent';

/**
 * Check if a thank you has been sent for a specific greeting
 * @param {string} greetingId - The greeting ID
 * @returns {boolean} Whether thank you was already sent
 */
export function hasThankYouBeenSent(greetingId) {
  try {
    const sent = JSON.parse(localStorage.getItem(THANK_YOU_SENT_KEY) || '{}');
    return !!sent[greetingId];
  } catch {
    return false;
  }
}

/**
 * Mark a thank you as sent for a greeting
 * @param {string} greetingId - The greeting ID
 */
export function markThankYouSent(greetingId) {
  try {
    const sent = JSON.parse(localStorage.getItem(THANK_YOU_SENT_KEY) || '{}');
    sent[greetingId] = {
      sentAt: new Date().toISOString(),
    };
    localStorage.setItem(THANK_YOU_SENT_KEY, JSON.stringify(sent));
  } catch (e) {
    console.error('Error saving thank you status:', e);
  }
}

/**
 * Generate a simple thank you message (V1: client-side templates)
 * No AI call - uses pre-written templates for cost control
 * @param {string} recipientName - Name of original sender
 * @param {string} context - Optional context (max 100 chars)
 * @returns {string} Generated thank you message (~280 chars max)
 */
export function generateThankYouMessage(recipientName, context = '') {
  const firstName = recipientName?.split(' ')[0] || 'Friend';
  const cleanContext = (context || '').trim().slice(0, 100);

  // Pre-written templates for cost control (no AI needed V1)
  const templates = [
    `Thank you so much for thinking of me, ${firstName}! Your greeting truly brightened my day and reminded me how lucky I am to have you in my life.`,
    `${firstName}, your thoughtful greeting meant the world to me! I'm so grateful for your kindness and the time you took to send such a warm message.`,
    `I can't thank you enough, ${firstName}! Receiving your greeting put the biggest smile on my face. You're amazing!`,
    `${firstName}, thank you for making my day so special! Your greeting was exactly what I needed. I really appreciate you.`,
    `What a wonderful surprise, ${firstName}! Thank you for your heartfelt greeting. It truly touched my heart.`,
  ];

  // Select template based on simple hash of greeting content
  const index = Math.abs((recipientName?.length || 0) + (cleanContext?.length || 0)) % templates.length;
  let message = templates[index];

  // Add context reference if provided
  if (cleanContext) {
    message = message.replace('!', ` — ${cleanContext}!`);
  }

  // Hard cap at 280 characters
  return message.slice(0, 280);
}

/**
 * Send thank you email (V1: localStorage simulation)
 * In production, this would call the backend API
 * @param {Object} params - Thank you parameters
 * @returns {Object} Result { success, message }
 */
export function sendThankYouEmail({ greetingId, senderEmail, senderName, recipientName, message }) {
  // Check if already sent
  if (hasThankYouBeenSent(greetingId)) {
    return { success: false, message: 'Thank you already sent for this greeting' };
  }

  // V1: Store in localStorage (simulates sending)
  // Production would POST to /api/thank-you endpoint
  try {
    const thankYouLog = JSON.parse(localStorage.getItem('greetme_thank_you_log') || '[]');
    thankYouLog.push({
      greetingId,
      to: senderEmail,
      toName: senderName,
      fromName: recipientName,
      subject: 'You received a Thank You!',
      body: message,
      sentAt: new Date().toISOString(),
    });
    localStorage.setItem('greetme_thank_you_log', JSON.stringify(thankYouLog));

    // Mark as sent
    markThankYouSent(greetingId);

    return { success: true, message: 'Thank you sent successfully!' };
  } catch (e) {
    console.error('Error sending thank you:', e);
    return { success: false, message: 'Failed to send thank you' };
  }
}
