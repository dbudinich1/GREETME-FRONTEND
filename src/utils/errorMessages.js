import { recipientLimitMessage } from './sendGating.js';

const ERROR_MESSAGES = {
  RATE_LIMIT_LOGIN: 'Too many login attempts. Please wait 15 minutes before trying again.',
  RATE_LIMIT_SIGNUP: 'Too many signup attempts. Please try again later.',
  RATE_LIMIT_RESET: 'Too many password reset requests. Please check your email or try again later.',
  RATE_LIMIT_CHECKOUT: 'Please wait a moment before trying again.',
  RATE_LIMIT_GREETING: "You're sending greetings too quickly. Please wait a moment.",
  RATE_LIMIT_UPLOAD: 'Upload limit reached. Please wait before uploading more files.',
  RATE_LIMIT_VOICE: 'Voice upload limit reached. Please try again later.',
  RATE_LIMIT_GENERAL: "You're moving quickly. Please give it just a moment and try again.",
  RATE_LIMIT_PUBLIC: 'This greeting is temporarily unavailable. Please try again shortly.',
  GENERATION_CAP: "You've reached your current Greet-Me limit. You can continue tomorrow \u2014 or upgrade anytime to keep the celebrations flowing.",
  RECIPIENT_LIMIT_REACHED: "You've reached your plan's recipient limit. Upgrade your plan to add more recipients.",
  // LANE E2 (2026-10-10) — plain, true reason for an expired free trial (backend send-cap code).
  TRIAL_EXPIRED: 'Your free trial has ended — upgrade to send.',
  // Backend lane E1: Animation Bank pack purchase by an account without an active paid plan.
  ANYTIME_REQUIRES_SUBSCRIPTION: 'Anytime Greet-Me packs are available with an active Greet-Me plan.',
  // LANE E3 (2026-10-10) — 409 from /api/gifts/charge-now while a 3DS step is outstanding.
  PAYMENT_ALREADY_IN_PROGRESS: "This payment is already in progress. Please finish your bank's verification step, or close and start the gift again.",
  PAYMENT_REQUIRED: 'A Greet-Me\u2122 subscription is required to send greetings.',
  PAYMENT_FAILED: "Your payment didn't go through. You can update your method and continue whenever you're ready.",
  SUBSCRIPTION_EXPIRED: 'Your Greet-Me\u2122 subscription has expired. Renew to continue.',
  INVALID_CREDENTIALS: 'The email or password you entered is incorrect. Please try again.',
  EMAIL_EXISTS: 'This email already has an account. Try logging in instead.',
  EMAIL_NOT_VERIFIED: 'Please verify your email before delivering your greeting.',
  VOICE_CLONE_MISSING: 'Your voice needs a fresh recording before this can be delivered.',
  VOICE_SERVICE_UNAVAILABLE: 'Voice service is briefly unavailable. Please try again in a minute.',
  FORBIDDEN: "You don't have access to this feature.",
  SERVICE_UNAVAILABLE: 'Payments are temporarily unavailable. Please try again later.',
  SERVER_ERROR: "Something unexpected occurred. We're already on it \u2014 please try again shortly.",
  DEFAULT: "Something unexpected occurred. We're already on it \u2014 please try again shortly.",
};

export function getErrorMessage(error) {
  // LANE E2 (2026-10-10) — state the actual cap when the server sent it (RECIPIENT_LIMIT_REACHED
  // carries { limit, current }); otherwise the generic line above.
  if (error?.code === 'RECIPIENT_LIMIT_REACHED') {
    const limit = Number(error?.data?.limit ?? error?.limit);
    if (Number.isInteger(limit) && limit > 0) return recipientLimitMessage(limit);
  }
  if (error?.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }
  if (error?.status === 429) return ERROR_MESSAGES.RATE_LIMIT_GENERAL;
  if (error?.status >= 500) return ERROR_MESSAGES.SERVER_ERROR;
  // Fix 2 (Team 3 WP-C): nothing in the known-code/status map matched. Before
  // falling back to the fully generic copy, surface a server- or
  // caller-provided message when one is actually present and looks like real
  // prose — e.g. api.js's `throw new Error(data?.error || ...)` sites pass
  // through the backend's own text here when it sent one, which is more
  // actionable than the generic default. Deliberately excludes the
  // `HTTP ${status}` text those same call sites fall back to when the
  // backend sent nothing, since that string is our own placeholder, not a
  // real explanation.
  const specific =
    (typeof error?.message === 'string' && error.message.trim()) ||
    (typeof error?.details === 'string' && error.details.trim()) ||
    '';
  const looksGeneric = !specific || /^HTTP \d+$/.test(specific) || specific.length > 300;
  if (!looksGeneric) {
    return specific;
  }
  return ERROR_MESSAGES.DEFAULT;
}

export default ERROR_MESSAGES;
