// src/config/scheduledQrCash.js
//
// SCHEDULED QR CASH (W07 Option B) is approved but the scheduled charge is still being built behind a
// dormant backend flag (SCHEDULED_QRCASH_ENABLED, default off). Until it is live there is NO automatic QR Cash
// send, so the generic Auto-Gift claim ("Gift will be sent automatically on the occasion date.") is false for
// QR Cash. This single constant is the only place the frontend states that availability. It is deliberately
// NOT wired to the backend flag: when the scheduled charge is live (and its authorization step has had a
// founder render), flip this to true and the QR Cash case falls back to the ordinary Auto-Gift behavior.
export const SCHEDULED_QRCASH_AVAILABLE = false;

export const SCHEDULED_QRCASH_UNAVAILABLE_COPY =
  'QR Cash is sent when you send the Greet-Me. Scheduled QR Cash is not available yet.';
