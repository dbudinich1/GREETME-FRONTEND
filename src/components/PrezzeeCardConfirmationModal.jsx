// src/components/PrezzeeCardConfirmationModal.jsx — Greet-Me Smart Card (powered by Prezzee)
// charge confirmation with Stripe Elements.
//
// PREZZEE DORMANT FRONTEND COMPLETION (2026-09-17). Mirrors src/components/
// GiftConfirmationModal.jsx (QR Cash's own confirmation modal) exactly — same Modal/Elements/
// CardElement wiring, same createPaymentMethod -> onConfirm(paymentMethod.id, stripe) contract —
// relabeled for the Smart Card product. GiftConfirmationModal.jsx itself is untouched; this is a
// separate component so QR Cash's copy, styling and behavior stay byte-identical.
import { useState, useCallback, useRef, useEffect } from 'react';
import Modal from './Modal';
import { AlertCircle, Loader, CreditCard, Gift } from 'lucide-react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '../stripe/stripeProvider';

const CARD_ELEMENT_OPTIONS = {
  hidePostalCode: true,
  style: {
    base: {
      fontSize: '16px',
      color: '#1f2937',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      '::placeholder': { color: '#9ca3af' },
    },
    invalid: { color: '#dc2626' },
  },
};

// Inner form that uses Stripe hooks (must be inside <Elements>)
function PrezzeeCardConfirmForm({
  onClose,
  onConfirm,
  displayAmount,
  giftAmountCents,
  feeCents,
  totalCents,
  charging,
  chargeError,
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [cardError, setCardError] = useState(null);
  const [cardComplete, setCardComplete] = useState(false);

  // DUPLICATE-SUBMIT FIX (2026-09-23, founder-authorized). `charging` is a prop owned by the
  // parent and only becomes true AFTER stripe.createPaymentMethod() below resolves — a real
  // network round trip. A second click, Enter, or a repeated handler invocation landing during
  // that window was not blocked by `charging` alone; this is what let two POST /prezzee-card
  // requests race the backend's one-shot slot claim for what was reported as a single click.
  // `submitLockRef` is a ref, not state, so checking it is the FIRST statement in handleConfirm
  // takes effect synchronously, before React has any chance to re-render — closing that window
  // regardless of trigger source or parent state. `localSubmitting` only mirrors it to drive the
  // button's own immediate visual `disabled` state.
  const submitLockRef = useRef(false);
  const [localSubmitting, setLocalSubmitting] = useState(false);

  // Once the parent's own charge cycle (which only starts after this component already handed
  // off a real PaymentMethod via onConfirm) finishes — success, a definitively-not-charged retry,
  // or an outcome-unknown refusal — `charging` returns to false and this releases the lock so a
  // legitimate next attempt (e.g. after a declined card) is never permanently stuck.
  useEffect(() => {
    if (!charging && submitLockRef.current) {
      submitLockRef.current = false;
      setLocalSubmitting(false);
    }
  }, [charging]);

  const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

  const isDisabled = charging || localSubmitting || !stripe || !elements || !cardComplete;

  const handleConfirm = useCallback(async () => {
    // Synchronous one-shot guard — must be the very first check, before any await. A second call
    // arriving in the same tick (double-click, Enter firing alongside a click, a duplicated event
    // handler invocation) reads this ref as already `true` and returns immediately, before ever
    // calling stripe.createPaymentMethod() a second time.
    if (submitLockRef.current) return;
    if (charging || !stripe || !elements || !cardComplete) return;
    submitLockRef.current = true;
    setLocalSubmitting(true);

    setCardError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      // Nothing was ever submitted — safe to unlock immediately.
      submitLockRef.current = false;
      setLocalSubmitting(false);
      return;
    }

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (error) {
      // A client-side card validation/decline before any server call — legitimate to retry with a
      // corrected or different card.
      setCardError(error.message);
      submitLockRef.current = false;
      setLocalSubmitting(false);
      return;
    }

    // A real PaymentMethod now exists. From here on the parent's own `charging` state (and the
    // effect above) governs the lock for the remainder of this attempt.
    onConfirm(paymentMethod.id, stripe);
  }, [charging, stripe, elements, cardComplete, onConfirm]);

  const handleCardChange = useCallback((event) => {
    setCardComplete(event.complete);
    if (event.error) {
      setCardError(event.error.message);
    } else {
      setCardError(null);
    }
  }, []);

  const displayError = chargeError || cardError;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* Amount Breakdown — server-authoritative values, never client-computed for the actual charge */}
      <div style={{
        padding: '1.25rem',
        background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
        borderRadius: '0.75rem',
        border: '1px solid #6ee7b7',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
          <span style={{ fontSize: '0.9375rem', color: '#065f46' }}>Smart Card value ({displayAmount})</span>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#065f46' }}>{fmt(giftAmountCents)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#047857' }}>Processing fee</span>
          <span style={{ fontSize: '0.875rem', color: '#047857' }}>{fmt(feeCents)}</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: '0.75rem',
          borderTop: '1px solid #6ee7b7',
        }}>
          <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#064e3b' }}>Total charge</span>
          <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#064e3b' }}>{fmt(totalCents)}</span>
        </div>
      </div>

      {/* Card Input */}
      <div>
        <label style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.375rem',
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#374151',
          marginBottom: '0.5rem',
        }}>
          <CreditCard size={14} />
          Payment method
        </label>
        <div style={{
          padding: '0.75rem',
          border: '1px solid #d1d5db',
          borderRadius: '0.5rem',
          background: '#fff',
        }}>
          <CardElement options={CARD_ELEMENT_OPTIONS} onChange={handleCardChange} />
        </div>
      </div>

      <p style={{
        fontSize: '0.8125rem',
        color: 'var(--text-secondary, #6b7280)',
        lineHeight: 1.6,
        margin: 0,
      }}>
        By confirming, you authorize Greet-Me to charge the total amount shown for this Greet-Me
        Smart Card, powered by Prezzee.
      </p>

      {displayError && (
        <div style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.5rem',
          padding: '0.75rem 1rem',
          background: '#fef2f2',
          borderRadius: '0.5rem',
          border: '1px solid #fecaca',
        }}>
          <AlertCircle size={16} style={{ color: '#dc2626', flexShrink: 0, marginTop: '0.125rem' }} />
          <span style={{ fontSize: '0.875rem', color: '#dc2626', lineHeight: 1.4 }}>
            {displayError}
          </span>
        </div>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', paddingTop: '0.5rem' }}>
        <button
          type="button"
          onClick={onClose}
          disabled={charging || localSubmitting}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            background: 'transparent',
            color: 'var(--text-secondary, #6b7280)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: '0.5rem',
            fontSize: '0.9375rem',
            fontWeight: 500,
            cursor: (charging || localSubmitting) ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: (charging || localSubmitting) ? 0.5 : 1,
          }}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleConfirm}
          disabled={isDisabled}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            background: isDisabled
              ? '#9ca3af'
              : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '0.9375rem',
            fontWeight: 600,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            boxShadow: isDisabled ? 'none' : '0 2px 4px rgba(16, 185, 129, 0.3)',
          }}
        >
          {(charging || localSubmitting) ? (
            <>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Charging...
            </>
          ) : (
            <>
              <Gift size={16} />
              Confirm & Charge {fmt(totalCents)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Outer wrapper provides Stripe Elements context
export default function PrezzeeCardConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  displayAmount,
  giftAmountCents,
  feeCents,
  totalCents,
  charging = false,
  chargeError = null,
}) {
  if (isOpen && !stripePromise) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Confirm Smart Card Purchase" size="sm">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', padding: '1rem 0' }}>
          <AlertCircle size={32} style={{ color: '#d97706' }} />
          <p style={{ fontSize: '0.9375rem', color: '#92400e', textAlign: 'center', margin: 0 }}>
            Payment is not configured. Please contact support.
          </p>
          <button type="button" onClick={onClose} style={{
            padding: '0.5rem 1.5rem', background: '#e5e7eb', border: 'none',
            borderRadius: '0.5rem', cursor: 'pointer', fontFamily: 'inherit',
          }}>Close</button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm Smart Card Purchase" size="sm">
      {isOpen && stripePromise && (
        <Elements stripe={stripePromise}>
          <PrezzeeCardConfirmForm
            onClose={onClose}
            onConfirm={onConfirm}
            displayAmount={displayAmount}
            giftAmountCents={giftAmountCents}
            feeCents={feeCents}
            totalCents={totalCents}
            charging={charging}
            chargeError={chargeError}
          />
        </Elements>
      )}
    </Modal>
  );
}
