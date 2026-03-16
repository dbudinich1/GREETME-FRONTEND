// src/pages/GiftClaim.jsx
// Public claim page for QR Cash™ gifts
// Route: /gift/:claimToken

import { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import api from '../api/api';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function GiftClaim() {
  const { claimToken } = useParams();
  const location = useLocation();

  const [gift, setGift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Claim flow state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [claimed, setClaimed] = useState(false);
  const [fulfilled, setFulfilled] = useState(false);
  const [connectPending, setConnectPending] = useState(false);

  // Detect Stripe Connect return via URL params
  const searchParams = new URLSearchParams(location.search);
  const isConnectReturn = searchParams.get('connect_return') === '1';
  const isConnectRefresh = searchParams.get('connect_refresh') === '1';

  useEffect(() => {
    loadGift();
  }, [claimToken]);

  // After loading gift, handle connect return/refresh
  useEffect(() => {
    if (!gift || loading) return;

    if (isConnectReturn && gift.status !== 'fulfilled') {
      handleConnectComplete();
    } else if (isConnectRefresh) {
      // Onboarding link expired — restart
      handleConnectOnboard();
    }
  }, [gift, loading, isConnectReturn, isConnectRefresh]);

  const loadGift = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getGiftClaim(claimToken);
      if (res?.ok && res?.gift) {
        setGift(res.gift);
        if (res.gift.status === 'fulfilled') {
          setFulfilled(true);
        } else if (res.gift.status === 'claimed') {
          setClaimed(true);
        } else if (res.gift.status === 'connect_pending') {
          setConnectPending(true);
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

  const handleConnectOnboard = async () => {
    try {
      setSubmitting(true);
      setSubmitError(null);
      const res = await api.connectOnboard(claimToken);
      if (res?.ok && res?.onboardingUrl) {
        // Redirect to Stripe-hosted onboarding
        window.location.href = res.onboardingUrl;
      } else {
        setSubmitError('Failed to start payout setup. Please try again.');
      }
    } catch (err) {
      if (err?.code === 'GIFT_ALREADY_CLAIMED') {
        setClaimed(true);
      } else if (err?.code === 'GIFT_EXPIRED') {
        setGift((prev) => prev ? { ...prev, status: 'expired' } : prev);
      } else {
        setSubmitError(err?.message || 'Failed to start payout setup. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleConnectComplete = async () => {
    try {
      setSubmitting(true);
      setSubmitError(null);
      const res = await api.connectComplete(claimToken);
      if (res?.ok) {
        if (res.fulfilled || res.alreadyFulfilled) {
          setFulfilled(true);
        } else if (res.onboardingComplete === false) {
          // Onboarding not finished — let them restart
          setConnectPending(true);
          setSubmitError('Your account setup is not complete. Please try again to finish setting up your payout details.');
        }
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    } catch (err) {
      setSubmitError(err?.message || 'Failed to complete payout. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

  // ---- Loading ----
  if (loading || (submitting && (isConnectReturn || isConnectRefresh))) {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: 'center', color: '#92400e' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎁</div>
          <p style={{ fontSize: '1rem', fontFamily: FONT_STACK }}>
            {isConnectReturn ? 'Processing your payout...' : 'Loading your gift...'}
          </p>
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
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  // ---- Fulfilled (payout completed) ----
  if (fulfilled) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>&#10003;</div>
          <h1 style={styles.title}>Gift Received!</h1>
          <p style={{ ...styles.subtitle, marginBottom: '0.5rem' }}>
            Your {fmt(gift.giftAmountCents)} QR Cash&trade; gift has been sent to your account.
          </p>
          <p style={{ fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            Funds typically arrive within 1-2 business days to your bank account, or instantly to a debit card.
          </p>
          <a href="/" style={styles.secondaryLink}>Learn about Greet-Me&trade;</a>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  // ---- Already Claimed (legacy manual-fulfill path) ----
  if (claimed) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>&#10003;</div>
          <h1 style={styles.title}>Gift Claimed!</h1>
          <p style={{ ...styles.subtitle, marginBottom: '0.5rem' }}>
            Your {fmt(gift.giftAmountCents)} QR Cash&trade; gift has been claimed.
          </p>
          <p style={{ fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            You'll receive your funds via your selected payment method.
            Please allow up to 48 hours for processing.
          </p>
          <a href="/" style={styles.secondaryLink}>Learn about Greet-Me&trade;</a>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  // ---- Expired ----
  if (gift.status === 'expired') {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#9200;</div>
          <h1 style={styles.title}>Gift Expired</h1>
          <p style={styles.subtitle}>
            This QR Cash&trade; gift is no longer available. Gifts expire {gift.expiryDays || 30} days after delivery. Expired gifts are not automatically refunded &mdash; contact support for assistance.
          </p>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  // ---- Claim Form (Stripe Connect) ----
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
            <span style={{ fontWeight: 600 }}>Greet-Me&trade;</span>
            <span style={{ margin: '0 0.4rem', opacity: 0.4 }}>&middot;</span>
            <span style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>QR Cash&trade;</span>
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
            QR Cash&trade; Gift
          </p>
        </div>

        {/* Payout method */}
        <p style={{
          fontSize: '0.9375rem',
          fontWeight: 600,
          color: '#1f2937',
          margin: '0 0 0.5rem',
          textAlign: 'left',
        }}>
          {connectPending ? 'Finish setting up your payout' : 'How would you like to receive your gift?'}
        </p>

        <p style={{
          fontSize: '0.85rem',
          color: '#6b7280',
          margin: '0 0 1rem',
          textAlign: 'left',
          lineHeight: 1.5,
        }}>
          {connectPending
            ? 'You started setting up your payout details. Tap below to finish and receive your gift.'
            : 'Enter your debit card or bank account details securely via Stripe to receive your funds.'}
        </p>

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

        {/* CTA Button */}
        <button
          onClick={handleConnectOnboard}
          disabled={submitting}
          style={{
            width: '100%',
            padding: '0.875rem',
            background: submitting
              ? '#d1d5db'
              : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '0.5rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: submitting ? 'not-allowed' : 'pointer',
            fontFamily: FONT_STACK,
            boxShadow: submitting
              ? 'none'
              : '0 2px 6px rgba(245, 158, 11, 0.3)',
            marginBottom: '0.75rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
          }}
        >
          <span style={{ fontSize: '1.1rem' }}>🏦</span>
          {submitting ? 'Setting up...' : connectPending ? 'Finish Payout Setup' : `Claim ${fmt(gift.giftAmountCents)}`}
        </button>

        <p style={{
          fontSize: '0.8rem',
          color: '#9ca3af',
          margin: '0 0 0.75rem',
          lineHeight: 1.4,
        }}>
          Secure payout via Stripe &mdash; debit card or bank account
        </p>

        {/* Fine print */}
        <p style={{
          fontSize: '0.75rem',
          color: '#9ca3af',
          lineHeight: 1.5,
          margin: '0 0 0.5rem',
        }}>
          By claiming, you agree to receive funds via Stripe.
          QR Cash&trade; gifts expire {gift.expiryDays || 30} days after delivery.
        </p>

        <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
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
  successIcon: {
    width: '4rem',
    height: '4rem',
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '0 auto 1.25rem',
    fontSize: '2rem',
    color: '#fff',
  },
};
