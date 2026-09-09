// src/components/providerCheckout/ProviderCheckoutEntry.jsx
//
// The marketplace's one link to the provider checkout.
//
// SILENT WHILE DORMANT. It asks the backend whether the category is purchasable — a posture
// question that costs no vendor call and no storage read — and renders NOTHING unless the answer is
// yes. While the provider is dormant the marketplace is byte-for-byte what it was: no button, no
// payment library, no network call to a vendor.
//
// The category the shopper selected is a MARKETPLACE selector id; the backend routes on gift types.
// The one translation between the two vocabularies lives here, and it is a lookup, not a guess.

import { useEffect, useState } from 'react';
import { fetchCheckoutAvailability } from '../../api/providerCheckout';
import ProviderCheckoutModal from './ProviderCheckoutModal';
import { categoryNoun, providerDisplayName } from './providerCheckoutModel';

/** Marketplace selector id -> the backend gift type. Exactly two categories are provider-backed. */
export const SELECTOR_TO_GIFT_TYPE = Object.freeze({
  flowers: 'flowers',
  gift_baskets: 'gift_boxes',
  gift_boxes: 'gift_boxes',
});

export default function ProviderCheckoutEntry({ selectedCategory, product, customer }) {
  const giftType = SELECTOR_TO_GIFT_TYPE[selectedCategory] || null;
  // The ANSWER is stored as the gift type it was given for, not as a bare boolean. Switching
  // category therefore stops matching immediately, with no state to reset and no window in which a
  // previous category's "yes" could sell the new one.
  const [availableFor, setAvailableFor] = useState(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!giftType) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const posture = await fetchCheckoutAvailability(giftType);
        if (!cancelled && posture.available === true) setAvailableFor(giftType);
      } catch {
        // Fail closed: an unanswered posture question is not an invitation to sell something.
      }
    })();
    return () => { cancelled = true; };
  }, [giftType]);

  if (!giftType || availableFor !== giftType) return null;

  return (
    <div data-testid="provider-checkout-entry" style={{ margin: '1rem 0' }}>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          padding: '0.7rem 1.1rem', borderRadius: 10, border: 'none',
          background: '#4F2D7F', color: '#fff', fontWeight: 700, cursor: 'pointer',
        }}
      >
        {`Send a ${categoryNoun(giftType)} gift`}
      </button>
      <small style={{ display: 'block', marginTop: '0.4rem', color: 'var(--text-secondary, #64748b)' }}>
        Fulfilled by {providerDisplayName(product?.provider)} — you complete everything here on Greet-Me.
      </small>

      <ProviderCheckoutModal
        isOpen={open}
        onClose={() => setOpen(false)}
        giftType={giftType}
        product={product}
        customer={customer}
      />
    </div>
  );
}
