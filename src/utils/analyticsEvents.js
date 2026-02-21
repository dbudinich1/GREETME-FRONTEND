export const EVENTS = {
  SIGNUP_START: 'signup_start',
  SIGNUP_COMPLETE: 'signup_complete',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  GREETING_START: 'greeting_start',
  GREETING_SUBMITTED: 'greeting_submitted',
  GREETING_DELIVERED: 'greeting_delivered',
  GREETING_OPENED: 'greeting_opened',
  CHECKOUT_START: 'checkout_start',
  CHECKOUT_COMPLETE: 'checkout_complete',
  CHECKOUT_CANCELED: 'checkout_canceled',
  CONTACT_ADDED: 'contact_added',
  RATE_LIMIT_HIT: 'rate_limit_hit',
  ERROR_SHOWN: 'error_shown',
};

export function trackEvent(eventName, params = {}) {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, params);
  }
  if (import.meta.env.DEV) {
    console.log('[Analytics]', eventName, params);
  }
}
