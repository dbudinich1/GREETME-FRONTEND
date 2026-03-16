// src/pages/GiftClaim.jsx
// Public claim page for QR Cash™ gifts
// Route: /gift/:claimToken

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/api';

const CLAIM_METHODS = [
  { id: 'venmo', label: 'Venmo', placeholder: '@username', icon: '💸' },
  { id: 'paypal', label: 'PayPal', placeholder: 'email@example.com', icon: '🅿️' },
  { id: 'cashapp', label: 'Cash App', placeholder: '$cashtag', icon: '💵' },
];

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function GiftClaim() {
  const { claimToken } = useParams();

  const [gift, setGift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Claim form state
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [claimHandle, setClaimHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    loadGift();
  }, [claimToken]);

  const loadGift = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getGiftClaim(claimToken);
      if (res?.ok && res?.gift) {
        setGift(res.gift);
        // If already claimed, show that state
        if (res.gift.status === 'claimed' || res.gift.status === 'fulfilled') {
          setClaimed(true);
        }
      } else {
        setError('not_found');
      }
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 404) {
        setError('not_found');
      } else {
        setError(err?.message || 'Failed to load gift');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMethod || !claimHandle.trim()) return;

    try {
      setSubmitting(true);
      setSubmitError(null);

      await api.submitGiftClaim(claimToken, {
        claimMethod: selectedMethod,
        claimDetails: { handle: claimHandle.trim() },
      });

      setClaimed(true);
    } catch (err) {
      const code = err?.code;
      if (code === 'GIFT_ALREADY_CLAIMED') {
        setClaimed(true);
      } else if (code === 'GIFT_EXPIRED') {
        setGift((prev) => prev ? { ...prev, status: 'expired' } : prev);
      } else {
        setSubmitError(err?.message || 'Failed to submit claim. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

  // ---- Loading ----
  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: 'center', color: '#92400e' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎁</div>
          <p style={{ fontSize: '1rem', fontFamily: FONT_STACK }}>Loading your gift...</p>
        </div>
      </div>
    );
  }

  // ---- Error / Not Found ----
  if (error || !gift) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎁</div>
          <h1 style={styles.title}>
            {error === 'not_found' ? 'Gift Not Found' : 'Something Went Wrong'}
          </h1>
          <p style={styles.subtitle}>
            {error === 'not_found'
              ? 'This gift link may be invalid or has already expired.'
              : typeof error === 'string' ? error : 'Please try again later.'}
          </p>
          <p style={styles.footer}>© 2026 Greet-Me™ · Forget Them Not!™</p>
        </div>
      </div>
    );
  }

  // ---- Already Claimed ----
  if (claimed) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.25rem',
            fontSize: '2rem',
          }}>
            ✓
          </div>
          <h1 style={styles.title}>Gift Claimed!</h1>
          <p style={{ ...styles.subtitle, marginBottom: '0.5rem' }}>
            Your {fmt(gift.giftAmountCents)} QR Cash™ gift has been claimed.
          </p>
          <p style={{ fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            You'll receive your funds via your selected payment method.
            Please allow up to 48 hours for processing.
          </p>
          <a href="/" style={styles.secondaryLink}>
            Learn about Greet-Me™
          </a>
          <p style={styles.footer}>© 2026 Greet-Me™ · Forget Them Not!™</p>
        </div>
      </div>
    );
  }

  // ---- Expired ----
  if (gift.status === 'expired') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⏰</div>
          <h1 style={styles.title}>Gift Expired</h1>
          <p style={styles.subtitle}>
            This QR Cash™ gift is no longer available. Gifts expire {gift.expiryDays || 30} days after delivery. Expired gifts are not automatically refunded — contact support for assistance.
          </p>
          <p style={styles.footer}>© 2026 Greet-Me™ · Forget Them Not!™</p>
        </div>
      </div>
    );
  }

  // ---- Claim Form ----
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{
            fontSize: '0.8rem',
            color: '#9ca3af',
            margin: '0 0 1rem',
            letterSpacing: '0.05em',
            fontFamily: FONT_STACK,
          }}>
            <span style={{ fontWeight: 600 }}>Greet-Me™</span>
            <span style={{ margin: '0 0.4rem', opacity: 0.4 }}>·</span>
            <span style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>QR Cash™</span>
          </p>

          <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🎁</div>

          <h1 style={{ ...styles.title, marginBottom: '0.25rem' }}>
            You've received a gift!
          </h1>

          {gift.recipientName && (
            <p style={{ fontSize: '0.95rem', color: '#6b7280', margin: '0 0 0.75rem' }}>
              Hi {gift.recipientName}!
            </p>
          )}
        </div>

        {/* Amount Display */}
        <div style={{
          padding: '1.25rem',
          background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
          borderRadius: '0.75rem',
          border: '1px solid #fcd34d',
          marginBottom: '1.5rem',
        }}>
          <div style={{
            fontSize: '2.5rem',
            fontWeight: 700,
            color: '#92400e',
            lineHeight: 1,
          }}>
            {fmt(gift.giftAmountCents)}
          </div>
          <p style={{
            fontSize: '0.85rem',
            color: '#b45309',
            margin: '0.5rem 0 0',
          }}>
            QR Cash™ Gift
          </p>
        </div>

        {/* Claim Method Selection */}
        <form onSubmit={handleSubmit}>
          <p style={{
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: '#1f2937',
            margin: '0 0 0.75rem',
            textAlign: 'left',
          }}>
            How would you like to receive your gift?
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1rem' }}>
            {CLAIM_METHODS.map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => { setSelectedMethod(method.id); setSubmitError(null); }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: selectedMethod === method.id ? '#fffbeb' : '#fff',
                  border: selectedMethod === method.id
                    ? '2px solid #f59e0b'
                    : '1px solid #e5e7eb',
                  borderRadius: '0.5rem',
                  cursor: 'pointer',
                  fontFamily: FONT_STACK,
                  fontSize: '0.9375rem',
                  fontWeight: selectedMethod === method.id ? 600 : 400,
                  color: '#1f2937',
                  textAlign: 'left',
                  transition: 'border-color 0.15s',
                }}
              >
                <span style={{ fontSize: '1.25rem' }}>{method.icon}</span>
                {method.label}
              </button>
            ))}
          </div>

          {/* Claim Handle Input */}
          {selectedMethod && (
            <div style={{ marginBottom: '1rem' }}>
              <label style={{
                display: 'block',
                fontSize: '0.875rem',
                fontWeight: 500,
                color: '#374151',
                marginBottom: '0.375rem',
                textAlign: 'left',
              }}>
                Your {CLAIM_METHODS.find(m => m.id === selectedMethod)?.label} handle
              </label>
              <input
                type="text"
                value={claimHandle}
                onChange={(e) => { setClaimHandle(e.target.value); setSubmitError(null); }}
                placeholder={CLAIM_METHODS.find(m => m.id === selectedMethod)?.placeholder}
                required
                style={{
                  width: '100%',
                  padding: '0.75rem 1rem',
                  border: '1px solid #d1d5db',
                  borderRadius: '0.5rem',
                  fontSize: '1rem',
                  fontFamily: FONT_STACK,
                  color: '#1f2937',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
                onFocus={(e) => { e.target.style.borderColor = '#f59e0b'; }}
                onBlur={(e) => { e.target.style.borderColor = '#d1d5db'; }}
              />
            </div>
          )}

          {/* Submit Error */}
          {submitError && (
            <div style={{
              padding: '0.75rem 1rem',
              background: '#fef2f2',
              borderRadius: '0.5rem',
              border: '1px solid #fecaca',
              marginBottom: '1rem',
            }}>
              <p style={{ fontSize: '0.875rem', color: '#dc2626', margin: 0, lineHeight: 1.4 }}>
                {submitError}
              </p>
            </div>
          )}

          {/* Submit Button */}
          {selectedMethod && (
            <button
              type="submit"
              disabled={submitting || !claimHandle.trim()}
              style={{
                width: '100%',
                padding: '0.875rem',
                background: submitting || !claimHandle.trim()
                  ? '#d1d5db'
                  : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: submitting || !claimHandle.trim() ? 'not-allowed' : 'pointer',
                fontFamily: FONT_STACK,
                boxShadow: submitting || !claimHandle.trim()
                  ? 'none'
                  : '0 2px 6px rgba(245, 158, 11, 0.3)',
                marginBottom: '1rem',
              }}
            >
              {submitting ? 'Claiming...' : `Claim ${fmt(gift.giftAmountCents)}`}
            </button>
          )}
        </form>

        {/* Fine print */}
        <p style={{
          fontSize: '0.75rem',
          color: '#9ca3af',
          lineHeight: 1.5,
          margin: '0 0 0.5rem',
        }}>
          By claiming, you agree to receive funds via your selected method.
          QR Cash™ gifts expire {gift.expiryDays || 30} days after delivery.
        </p>

        <p style={styles.footer}>© 2026 Greet-Me™ · Forget Them Not!™</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fff7ed 100%)',
    padding: '1.5rem',
    fontFamily: FONT_STACK,
  },
  card: {
    maxWidth: '440px',
    width: '100%',
    background: '#fff',
    borderRadius: '1rem',
    padding: '2rem',
    textAlign: 'center',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1f2937',
    margin: '0 0 0.5rem',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#6b7280',
    lineHeight: 1.6,
    margin: '0 0 1.5rem',
  },
  footer: {
    fontSize: '0.75rem',
    color: '#b0b0b0',
    margin: '1.5rem 0 0',
  },
  secondaryLink: {
    display: 'inline-block',
    padding: '0.625rem 1.5rem',
    background: '#3A7BD5',
    color: '#fff',
    borderRadius: '0.5rem',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '0.9375rem',
    fontFamily: FONT_STACK,
  },
};
