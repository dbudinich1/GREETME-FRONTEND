// src/components/GiftConfirmationModal.jsx — QR Cash™ charge confirmation with Stripe Elements
import { useState, useCallback } from 'react';
import Modal from './Modal';
import { DollarSign, AlertCircle, Loader, CreditCard } from 'lucide-react';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { stripePromise } from '../stripe/stripeProvider';

// CardElement styling to match the warm gift palette
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
function GiftConfirmForm({
  onClose,
  onConfirm,
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

  const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

  const isDisabled = charging || !stripe || !elements || !cardComplete;

  const handleConfirm = useCallback(async () => {
    if (isDisabled) return;

    setCardError(null);

    const cardElement = elements.getElement(CardElement);
    if (!cardElement) return;

    const { error, paymentMethod } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });

    if (error) {
      setCardError(error.message);
      return;
    }

    // Pass both paymentMethod ID and stripe instance for potential 3DS handling
    onConfirm(paymentMethod.id, stripe);
  }, [isDisabled, stripe, elements, onConfirm]);

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
      {/* Amount Breakdown */}
      <div style={{
        padding: '1.25rem',
        background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
        borderRadius: '0.75rem',
        border: '1px solid #fcd34d',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.625rem' }}>
          <span style={{ fontSize: '0.9375rem', color: '#92400e' }}>QR Cash&#8482; Gift</span>
          <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#92400e' }}>{fmt(giftAmountCents)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <span style={{ fontSize: '0.875rem', color: '#b45309' }}>Processing fee</span>
          <span style={{ fontSize: '0.875rem', color: '#b45309' }}>{fmt(feeCents)}</span>
        </div>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: '0.75rem',
          borderTop: '1px solid #fbbf24',
        }}>
          <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#78350f' }}>Total charge</span>
          <span style={{ fontSize: '1.0625rem', fontWeight: 700, color: '#78350f' }}>{fmt(totalCents)}</span>
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

      {/* Authorization Copy */}
      <p style={{
        fontSize: '0.8125rem',
        color: 'var(--text-secondary, #6b7280)',
        lineHeight: 1.6,
        margin: 0,
      }}>
        By confirming, you authorize Greet-Me to charge the total amount shown for this
        QR Cash&#8482; gift. QR Cash&#8482; gifts are available to claim for 30 days after delivery.
      </p>
      <p style={{
        fontSize: '0.75rem',
        color: 'var(--text-tertiary, #9ca3af)',
        lineHeight: 1.5,
        margin: 0,
      }}>
        Once your greeting is delivered, the QR Cash&#8482; charge is final.
      </p>

      {/* Error Display */}
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

      {/* Actions */}
      <div style={{
        display: 'flex',
        gap: '0.75rem',
        paddingTop: '0.5rem',
      }}>
        <button
          type="button"
          onClick={onClose}
          disabled={charging}
          style={{
            flex: 1,
            padding: '0.75rem 1rem',
            background: 'transparent',
            color: 'var(--text-secondary, #6b7280)',
            border: '1px solid var(--border, #e5e7eb)',
            borderRadius: '0.5rem',
            fontSize: '0.9375rem',
            fontWeight: 500,
            cursor: charging ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
            opacity: charging ? 0.5 : 1,
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
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
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
            boxShadow: isDisabled ? 'none' : '0 2px 4px rgba(245, 158, 11, 0.3)',
          }}
        >
          {charging ? (
            <>
              <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
              Charging...
            </>
          ) : (
            <>
              <DollarSign size={16} />
              Confirm & Charge {fmt(totalCents)}
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// Outer wrapper provides Stripe Elements context
export default function GiftConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  giftAmountCents,
  feeCents,
  totalCents,
  charging = false,
  chargeError = null,
}) {
  // If Stripe is not configured, show a clear message
  if (isOpen && !stripePromise) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Confirm QR Cash\u2122 Gift" size="sm">
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
    <Modal isOpen={isOpen} onClose={onClose} title="Confirm QR Cash\u2122 Gift" size="sm">
      {isOpen && stripePromise && (
        <Elements stripe={stripePromise}>
          <GiftConfirmForm
            onClose={onClose}
            onConfirm={onConfirm}
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
