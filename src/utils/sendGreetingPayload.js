// src/utils/sendGreetingPayload.js
//
// The send flow's greeting payload, built in ONE place (G5, Report 103 §0k). Moved out of SendGreeting.jsx
// unchanged so the dashboard's group sending (one existing POST /api/jobs/send-greeting per recipient) sends
// exactly what the send page sends. The backend re-validates every pointer; nothing here grants anything.
import { normalizeOccasionKey } from './normalizeOccasionKey';
import { SEND_OCCASION_KEY_OVERRIDES } from './dashboardSendHandoff';

/**
 * @param {object} p
 * @param {object} p.user              the signed-in sender (useAuth().user)
 * @param {object} p.contact           the recipient record
 * @param {object} p.formData          { occasionType, customMessage, tone }
 * @param {string[]} p.memoryPhotos    photos added for this occasion only
 * @param {boolean} p.useMemoryPhotos  include the recipient's own saved memory photos
 * @param {Set<string>} p.excludedMemoryPhotos  the recipient's photos the sender deselected
 * @param {object} p.giftSettings      the composer's gift selection ({ type, maxSpend, ... })
 * @param {number} p.maxPhotos         the send flow's memory-photo limit
 */
export function buildGreetingPayload({ user, contact, formData, memoryPhotos = [], useMemoryPhotos = true, excludedMemoryPhotos = new Set(), giftSettings = null, maxPhotos }) {
    const effectivePhotoUrl = user?.photoUrl || '';
    const MAX_MEMORY_PHOTOS = maxPhotos;
    return {
      userId: user?.id || user?.email || '',
      recipientName: contact.name,
      recipientEmail: contact.email,
      greetingText: formData.customMessage || '',
      voiceId: user?.voiceId || '',
      photoUrl: effectivePhotoUrl,
      occasionKey: SEND_OCCASION_KEY_OVERRIDES[formData.occasionType] || normalizeOccasionKey(formData.occasionType) || formData.occasionType,
      occasionType: formData.occasionType,
      relationshipKey: contact.relationship || 'friend',
      relationshipNote: contact.relationshipContext || '',
      personalSentiment: formData.customMessage || '',
      tone: formData.tone || 'warm',
      photos: [...new Set([
        ...memoryPhotos,
        ...(useMemoryPhotos
          ? (contact.memoryPhotos || [])
              .map(p => typeof p === 'string' ? p : p?.url)
              .filter(Boolean)
              .filter(url => !excludedMemoryPhotos.has(url))
          : []),
      ])].slice(0, MAX_MEMORY_PHOTOS),
      layoutBudget: { introMaxChars: 280 },
      // GIFTING-INTEGRITY: recipient pointer. The backend re-validates it
      // against the sender's own records before any gift is attached; it grants
      // nothing on its own.
      contactId: contact.id,
      // GIFTING-INTEGRITY: `includeGift` is a promise that a VALIDATED Greet-Me gift record will be
      // attached, and the backend resolver refuses the whole send when it cannot build one. Flowers
      // never can: the arrangement is dispatched to the recipient's street address by the provider,
      // who is the merchant of record, so there is no claim token, no QR and nothing to reveal at
      // /gift/:claimToken. Setting the flag for it would have sent every flower Greet-Me into
      // SEND_GIFT_ERRORS.MALFORMED — "Please re-select your gift" — for a selection that was
      // perfectly valid. The flower order is confirmed to the SENDER, beside the send itself.
      // A gift box is the same: its gift record exists only once it has been paid for, and
      // dispatchGiftBoxGreeting sets the flag then, with the server's own claim token.
      includeGift: Boolean(
        giftSettings?.type && giftSettings.type !== 'none' && giftSettings.type !== 'flowers'
          && giftSettings.type !== 'gift_boxes',
      ),
      // Curated is founder-fulfilled out of band — there is no payment to
      // wait on, so the selected spend tier IS the evidence that a gift was
      // chosen. GIFTING-INTEGRITY: the backend validates that tier, mints the
      // claim token at the send endpoint, and builds the stored gift object
      // itself; the tier never reaches the recipient-facing payload.
      ...(giftSettings?.type === 'curated' && {
        gift: {
          type: 'curated',
          maxSpendCents: (giftSettings.maxSpend || 0) * 100,
        },
      }),
    };
}

/** The gift object a charged QR Cash order attaches to the greeting payload (moved from SendGreeting unchanged). */
export function qrCashGiftForPayload(giftAmountDollars, giftObj) {
  return {
    type: 'qrcash',
    amount: giftAmountDollars,
    feeAmount: giftObj.feeCents / 100,
    totalAmount: giftObj.totalCents / 100,
    status: 'charged',
    claimToken: giftObj.claimToken,
    qrUrl: giftObj.qrImageUrl,
    qrBlobUrl: giftObj.qrBlobUrl,
    claimUrl: giftObj.claimUrl,
  };
}
