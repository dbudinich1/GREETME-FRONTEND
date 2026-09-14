// src/components/providerCheckout/ProviderCheckoutEntry.jsx
//
// The provider-fulfilled catalogue, rendered INLINE wherever its category is selected.
//
// WHAT CHANGED AND WHY. This component used to render a single button — "Send a flower gift" —
// which opened a modal that only THEN loaded the catalogue. Selecting Flowers therefore showed no
// flowers: it showed a button, and the products were two clicks and one modal deep. Choosing a
// category is already the request to see what is in it, so the catalogue now loads on selection and
// renders in place. The button is gone; no navigation step replaces it.
//
// SILENT WHILE DORMANT. It still asks the backend whether the category is purchasable — a posture
// question that costs no vendor call and no storage read — and renders NOTHING unless the answer is
// yes. While a provider is dormant its category is byte-for-byte what it was: no catalogue, no
// payment library, no vendor call.
//
// TWO MODES, ONE CATALOGUE.
//   * ATTACH mode (`onSelect` given) — used inside the Send Greet-Me flow. Picking an arrangement
//     hands it to the caller and opens nothing. The flower order is an embedded step of a greeting
//     that has not been sent yet, so this surface must never be able to finish on its own.
//   * STANDALONE mode (no `onSelect`) — used on the marketplace. Picking an arrangement opens the
//     existing checkout already holding that product, so it starts at the details step.
// Both render the same list from the same loader. There is no second catalogue.
//
// The category the shopper selected is a MARKETPLACE selector id; the backend routes on gift types.
// The one translation between the two vocabularies lives here, and it is a lookup, not a guess.

import { useCallback, useEffect, useState } from 'react';
import { fetchCheckoutAvailability, fetchProviderCatalog } from '../../api/providerCheckout';
import ProviderCheckoutModal from './ProviderCheckoutModal';
import { categoryNoun, formatMinor, providerDisplayName } from './providerCheckoutModel';

/** Marketplace selector id -> the backend gift type. Exactly two categories are provider-backed. */
export const SELECTOR_TO_GIFT_TYPE = Object.freeze({
  flowers: 'flowers',
  gift_baskets: 'gift_boxes',
  gift_boxes: 'gift_boxes',
});

export default function ProviderCheckoutEntry({
  selectedCategory, product, customer,
  // ATTACH mode. Given, this surface reports a choice and never opens a checkout of its own.
  onSelect = null,
  // The currently attached arrangement's id, so the selection is owned by the CALLER's state rather
  // than by a copy kept here. Two sources of truth for one choice is how a greeting ends up
  // carrying an arrangement the shopper can no longer see selected.
  selectedProductId = null,
}) {
  const giftType = SELECTOR_TO_GIFT_TYPE[selectedCategory] || null;
  // The ANSWER is stored as the gift type it was given for, not as a bare boolean. Switching
  // category therefore stops matching immediately, with no state to reset and no window in which a
  // previous category's "yes" could sell the new one.
  const [availableFor, setAvailableFor] = useState(null);
  const [products, setProducts] = useState([]);
  // 'idle' | 'loading' | 'ready' | 'failed' — the catalogue's PROVEN state. A failure is its own
  // state rather than an empty list, because "nothing is available" and "we could not look" are
  // different sentences and only one of them is true at a time.
  const [catalogue, setCatalogue] = useState('idle');
  // Bumped by Try again. A counter rather than a boolean, so a second failure re-runs the effect.
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState(null);

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

  // THE CATALOGUE LOADS ON SELECTION, not on a click. It is gated on the posture answer for THIS
  // gift type, so a dormant provider is never asked for products.
  useEffect(() => {
    if (!giftType || availableFor !== giftType) return undefined;
    let cancelled = false;
    setCatalogue('loading');
    (async () => {
      try {
        // `ok` is read, not inferred from the array being empty. The shared client answers a dead
        // network and a 404 with a sentinel rather than a throw, so an empty array on its own would
        // have made every failure read as "nothing is available" — a false claim about the stock.
        const { ok, products: live } = await fetchProviderCatalog(giftType);
        if (cancelled) return;
        setProducts(live);
        setCatalogue(ok ? 'ready' : 'failed');
      } catch {
        if (cancelled) return;
        setProducts([]);
        setCatalogue('failed');
      }
    })();
    return () => { cancelled = true; };
  }, [giftType, availableFor, attempt]);

  const pick = useCallback((p) => {
    if (onSelect) { onSelect(p); return; }
    // Standalone: straight into the existing checkout, holding the product. No extra step.
    setChosen(p);
    setOpen(true);
  }, [onSelect]);

  if (!giftType || availableFor !== giftType) return null;

  const noun = categoryNoun(giftType);

  return (
    <div data-testid="provider-checkout-entry" style={{ margin: '1rem 0' }}>
      {catalogue === 'loading' && (
        <p data-testid="provider-catalogue-loading" style={{ margin: 0, color: 'var(--text-secondary, #64748b)' }}>
          Loading the live selection&hellip;
        </p>
      )}

      {catalogue === 'failed' && (
        <div data-testid="provider-catalogue-error" role="alert" style={{ display: 'grid', gap: '0.6rem', justifyItems: 'start' }}>
          <p style={{ margin: 0, color: '#991b1b' }}>
            We could not load the {noun} selection just now.
          </p>
          <button
            type="button"
            data-testid="provider-catalogue-retry"
            onClick={() => setAttempt((n) => n + 1)}
            style={{
              padding: '0.55rem 0.9rem', borderRadius: 10, fontWeight: 600, cursor: 'pointer',
              border: '1px solid var(--border, #cbd5e1)', background: 'transparent',
            }}
          >
            Try again
          </button>
        </div>
      )}

      {catalogue === 'ready' && products.length === 0 && (
        <p data-testid="provider-catalogue-empty" style={{ margin: 0, color: 'var(--text-secondary, #64748b)' }}>
          No {noun} arrangements are available right now.
        </p>
      )}

      {catalogue === 'ready' && products.length > 0 && (
        <div data-testid="provider-catalogue" style={{ display: 'grid', gap: '0.75rem' }}>
          {products.map((p) => {
            const selected = selectedProductId != null && selectedProductId === p.providerProductId;
            return (
              <button
                key={p.providerProductId}
                type="button"
                data-testid={`provider-product-${p.providerProductId}`}
                aria-pressed={onSelect ? selected : undefined}
                onClick={() => pick(p)}
                style={{
                  display: 'grid', gridTemplateColumns: p.imageUrl ? '72px 1fr auto' : '1fr auto',
                  gap: '0.75rem', alignItems: 'center', textAlign: 'left', cursor: 'pointer',
                  padding: '0.6rem', borderRadius: 10, background: 'var(--bg-primary, #fff)',
                  border: selected ? '2px solid #4F2D7F' : '1px solid var(--border, #e2e8f0)',
                }}
              >
                {p.imageUrl && <img src={p.imageUrl} alt="" width="72" height="72" style={{ borderRadius: 8, objectFit: 'cover' }} />}
                <span>
                  <strong style={{ display: 'block' }}>{p.name}</strong>
                  <small style={{ color: 'var(--text-secondary, #64748b)' }}>{p.providerProductId}</small>
                </span>
                {/* The provider's own price, displayed exactly as received. It is never an input:
                    the amount charged comes from the provider's quote at checkout. */}
                <span data-testid={`provider-price-${p.providerProductId}`} style={{ fontWeight: 700 }}>
                  {formatMinor(p.priceMinor, p.currency)}
                </span>
              </button>
            );
          })}
        </div>
      )}

      <small style={{ display: 'block', marginTop: '0.6rem', color: 'var(--text-secondary, #64748b)' }}>
        Fulfilled by {providerDisplayName(product?.provider)} &mdash; you complete everything here on Greet-Me.
      </small>

      {/* ATTACH mode never mounts a checkout. The greeting owns that step.
          MOUNTED ONLY ONCE OPEN, and that is load-bearing rather than tidiness: the checkout decides
          its opening step from the `product` it is given AT MOUNT TIME. Mounted closed and empty, as
          this was, it would latch onto the picker step and then show the catalogue a SECOND time
          inside itself — reinstating the extra step this component exists to remove. */}
      {!onSelect && open && chosen && (
        <ProviderCheckoutModal
          isOpen
          onClose={() => { setOpen(false); setChosen(null); }}
          giftType={giftType}
          product={chosen}
          customer={customer}
        />
      )}
    </div>
  );
}
