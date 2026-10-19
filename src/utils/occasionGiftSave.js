// src/utils/occasionGiftSave.js
//
// The Occasion Scheduler's save-path normalisation, shared by ContactForm (the per-recipient scheduler) and the
// dashboard's inline date-and-gift resolver so both save gift settings exactly the same way. Moved out of
// ContactForm.jsx unchanged.
import { SCHEDULED_QRCASH_AVAILABLE } from '../config/scheduledQrCash';

// The amount <select> DISPLAYS $25 when no amount is stored; write that default so the form never shows a
// figure it does not send.
export const QRCASH_DEFAULT_DOLLARS = 25;

// Save-path normalisation: every qrcash entry saves with autoGift:false while scheduled QR Cash is unavailable,
// and with the amount the form displays. Other gift types are passed through untouched.
export function normalizeGiftSettingsForSave(settings, scheduledQrCashAvailable = SCHEDULED_QRCASH_AVAILABLE) {
  if (!settings || typeof settings !== 'object') return settings;
  const out = {};
  for (const [key, gs] of Object.entries(settings)) {
    if (gs && gs.type === 'qrcash' && !scheduledQrCashAvailable) {
      out[key] = { ...gs, autoGift: false, amount: gs.amount === undefined || gs.amount === null ? QRCASH_DEFAULT_DOLLARS : gs.amount };
    } else if (gs && gs.type === 'qrcash' && gs.autoGift === true && (gs.amount === undefined || gs.amount === null)) {
      out[key] = { ...gs, amount: QRCASH_DEFAULT_DOLLARS }; // an Auto-Gift QR Cash entry is never sent without the amount it shows
    } else {
      out[key] = gs;
    }
  }
  return out;
}
