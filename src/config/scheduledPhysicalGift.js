// src/config/scheduledPhysicalGift.js
//
// SCHEDULED PHYSICAL GIFT (Report 117 rev 3, founder-authorised build 2026-10-19): a Goody gift box or a Printful
// Branded Goods item chosen while scheduling, charged and ordered on the occasion date. The backend side sits behind
// LAUNCH_CONTROL.scheduledPhysicalGiftsEnabled (default off, env marker + boot assertion). This single constant is the
// only place the frontend states availability: while it is false, the product picker, the maximum total and the
// consent step are not shown anywhere and every gift stays exactly as today (reminder only). It must be flipped to
// true only in a build that ships with the backend switch on, after the founder authorises activation.
export const SCHEDULED_PHYSICAL_GIFT_AVAILABLE = false;

// The consent wording's version, recorded by the server with each acceptance (contract v1).
export const SCHEDULED_GIFT_WORDING_VERSION = 'sched-gift-v1';
