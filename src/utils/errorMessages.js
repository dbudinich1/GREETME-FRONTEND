const ERROR_MESSAGES = {
  RATE_LIMIT_LOGIN: 'Too many login attempts. Please wait 15 minutes before trying again.',
  RATE_LIMIT_SIGNUP: 'Too many signup attempts. Please try again later.',
  RATE_LIMIT_RESET: 'Too many password reset requests. Please check your email or try again later.',
  RATE_LIMIT_CHECKOUT: 'Please wait a moment before trying again.',
  RATE_LIMIT_GREETING: "You're sending greetings too quickly. Please wait a moment.",
  RATE_LIMIT_UPLOAD: 'Upload limit reached. Please wait before uploading more files.',
  RATE_LIMIT_VOICE: 'Voice upload limit reached. Please try again later.',
  RATE_LIMIT_GENERAL: "You're moving too fast. Please wait a moment and try again.",
  RATE_LIMIT_PUBLIC: 'This greeting is temporarily unavailable. Please try again shortly.',
  GENERATION_CAP: "You've used all your greetings for this period. Upgrade your Greet-Me\u2122 plan for more.",
  PAYMENT_REQUIRED: 'A Greet-Me\u2122 subscription is required to send greetings.',
  PAYMENT_FAILED: 'Payment could not be processed. Please check your card details.',
  SUBSCRIPTION_EXPIRED: 'Your Greet-Me\u2122 subscription has expired. Renew to continue.',
  FORBIDDEN: "You don't have access to this feature.",
  SERVICE_UNAVAILABLE: 'Payments are temporarily unavailable. Please try again later.',
  SERVER_ERROR: 'Something went wrong on our end. Please try again in a moment.',
  DEFAULT: 'Something unexpected happened. Please try again or contact support@greet-me.com.',
};

export function getErrorMessage(error) {
  if (error?.code && ERROR_MESSAGES[error.code]) {
    return ERROR_MESSAGES[error.code];
  }
  if (error?.status === 429) return ERROR_MESSAGES.RATE_LIMIT_GENERAL;
  if (error?.status >= 500) return ERROR_MESSAGES.SERVER_ERROR;
  if (error?.message && !error.message.includes('HTTP')) return error.message;
  return ERROR_MESSAGES.DEFAULT;
}

export default ERROR_MESSAGES;
