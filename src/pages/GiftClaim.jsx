// src/pages/GiftClaim.jsx
// Public claim page for QR Cash™ gifts
// Route: /gift/:claimToken

import { useState, useEffect } from 'react';
import { useParams, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { useAccountState } from '../hooks/useAccountState';
import { isSenderViewingOwnGift } from '../utils/accountState';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Payout method definitions — simple preference capture
const PAYOUT_METHODS = [
  {
    id: 'zelle',
    label: 'Zelle',
    icon: '⚡',
    placeholder: 'Email or phone linked to Zelle',
    prefix: '',
  },
  {
    id: 'venmo',
    label: 'Venmo',
    icon: '💸',
    placeholder: '@yourname',
    prefix: '@',
  },
  {
    id: 'cashapp',
    label: 'Cash App',
    icon: '💵',
    placeholder: '$yourtag',
    prefix: '$',
  },
  {
    id: 'paypal',
    label: 'PayPal',
    icon: '🅿️',
    placeholder: 'you@example.com',
    prefix: '',
  },
];

export default function GiftClaim() {
  const { claimToken } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  // Phase 3D Batch D D6 frontend — owner-self-encounter detection. When the
  // authenticated viewer is the original sender of this gift (matched via
  // senderUserId from the backend), the entire payout-method picker is
  // suppressed and the early-return SenderOwnGiftView renders instead.
  // The existing recipient flow is untouched.
  const accountState = useAccountState();

  // Route helper: authenticated → direct, guest → register with returnTo
  const authRoute = (dest) => {
    if (isAuthenticated) return navigate(dest);
    navigate(`/register`, { state: { returnTo: dest } });
  };

  const [gift, setGift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Payout choice state
  const [selectedMethod, setSelectedMethod] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [inputError, setInputError] = useState(null);

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
      handleConnectOnboard();
    }
  }, [gift, loading, isConnectReturn, isConnectRefresh]);

  const loadGift = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getGiftClaim(claimToken);
      if (res?.ok && res?.gift) {
        console.log('[GiftClaim] gift loaded:', { sourceGreetingJobId: res.gift.sourceGreetingJobId, senderName: res.gift.senderName, status: res.gift.status });
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

  // Validate input before submit
  const validateInput = () => {
    if (!selectedMethod) return 'Please select how you\u2019d like to receive your gift';
    const val = inputValue.trim();
    if (!val) return 'Please enter your email, phone, or handle';
    return null;
  };

  const handleClaim = async () => {
    const validationErr = validateInput();
    if (validationErr) {
      setInputError(validationErr);
      return;
    }
    setInputError(null);
    setSubmitError(null);

    try {
      setSubmitting(true);
      const res = await api.submitGiftClaim(claimToken, {
        claimMethod: selectedMethod,
        claimDetails: { destination: inputValue.trim() },
      });

      if (res?.ok) {
        setClaimed(true);
      } else {
        setSubmitError('Something went wrong. Please try again.');
      }
    } catch (err) {
      if (err?.code === 'GIFT_ALREADY_CLAIMED') {
        setClaimed(true);
      } else if (err?.code === 'GIFT_EXPIRED') {
        setGift((prev) => prev ? { ...prev, status: 'expired' } : prev);
      } else {
        setSubmitError(err?.message || 'Failed to claim gift. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (cents) => `$${(cents / 100).toFixed(2)}`;

  const currentMethod = PAYOUT_METHODS.find((m) => m.id === selectedMethod);

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

  // ---- Sender viewing own gift (Phase 3D Batch D D6 frontend) ----
  // Intercepts BEFORE fulfilled/claimed/expired/connect_pending/form branches
  // so senders never see recipient-facing claim UX for their own gift.
  if (gift && isSenderViewingOwnGift({ gift, userId: accountState.userId })) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>&#10003;</div>
          <h1 style={styles.title}>This gift is for your recipient</h1>
          <p style={styles.subtitle}>
            Your {fmt(gift.giftAmountCents)} QR Cash&trade; gift was included with your greeting.
            They&rsquo;ll claim it from their end.
          </p>
          <button
            onClick={() => navigate('/dashboard/send')}
            style={{
              ...styles.ctaButton(false),
              marginBottom: '0.75rem',
            }}
          >
            Send another Greet-Me
          </button>
          <a href="/#/dashboard" style={styles.secondaryLink}>Go to Dashboard</a>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
          {trustLinks}
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
          {trustLinks}
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

          {/* Referral credit CTA */}
          {gift.referralCode && (
            <div style={{
              padding: '1.25rem',
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              borderRadius: '0.75rem',
              border: '1px solid #6ee7b7',
              marginBottom: '1.5rem',
              textAlign: 'center',
            }}>
              <p style={{ fontSize: '1.25rem', margin: '0 0 0.5rem', fontWeight: 700, color: '#065f46' }}>
                You've unlocked a $10 credit
              </p>
              <p style={{
                fontSize: '0.9rem',
                color: '#065f46',
                lineHeight: 1.5,
                margin: '0 0 1rem',
              }}>
                Apply your $10 credit toward a Greet-Me subscription.
                <br />
                <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>Valid toward Social Butterfly or higher plans. Terms apply.</span>
              </p>
              <a
                href={`/#/credit/${gift.referralCode}`}
                style={{
                  display: 'inline-block',
                  padding: '0.75rem 1.5rem',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: '#fff',
                  borderRadius: '0.5rem',
                  fontWeight: 600,
                  textDecoration: 'none',
                  fontSize: '0.9375rem',
                  fontFamily: FONT_STACK,
                  boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
                }}
              >
                Unlock Your $10 Credit
              </a>
            </div>
          )}

          <a href="/" style={styles.secondaryLink}>Learn about Greet-Me&trade;</a>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
          {trustLinks}
        </div>
      </div>
    );
  }

  // ---- Already Claimed ----
  if (claimed) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={styles.successIcon}>&#10003;</div>
          <h1 style={styles.title}>You&rsquo;re all set.</h1>
          <p style={{ ...styles.subtitle, marginBottom: '0.5rem' }}>
            Your {fmt(gift.giftAmountCents)} QR Cash&trade; gift request has been submitted.
          </p>
          <p style={{ fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            We&rsquo;ll send your gift using your selected method shortly.
            You&rsquo;ll receive a confirmation once it&rsquo;s on the way.
          </p>

          {/* Forward-motion CTAs — no dead ends */}
          {(() => {
            const rawFirst = (gift.senderName || '').split(' ')[0];
            const firstName = rawFirst ? rawFirst.charAt(0).toUpperCase() + rawFirst.slice(1).toLowerCase() : '';
            const thankYouDest = gift.sourceGreetingJobId
              ? `/thank-you?jobId=${gift.sourceGreetingJobId}`
              : null;
            return (
              <div style={{ marginTop: '0.5rem', marginBottom: '1.5rem', textAlign: 'center' }}>
                {/* Primary: Claim + Create Account */}
                <button
                  onClick={() => authRoute('/dashboard/send')}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '0.875rem',
                    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
                    color: '#fff',
                    borderRadius: '0.75rem',
                    fontWeight: 600,
                    fontSize: '1rem',
                    fontFamily: FONT_STACK,
                    border: 'none',
                    cursor: 'pointer',
                    marginBottom: '0.75rem',
                    boxShadow: '0 4px 14px rgba(99, 102, 241, 0.3)',
                  }}
                >
                  {isAuthenticated ? 'Send a Greet-Me' : 'Claim Your $5 \u2014 Create Your Account'}
                </button>

                {/* Smart loop: Thank You (only when sourceGreetingJobId exists) */}
                {thankYouDest && (
                  <button
                    onClick={() => navigate(thankYouDest)}
                    style={{
                      display: 'block',
                      width: '100%',
                      padding: '0.75rem',
                      background: '#4F2D7F',
                      color: '#fff',
                      borderRadius: '0.75rem',
                      fontWeight: 600,
                      fontSize: '0.9375rem',
                      fontFamily: FONT_STACK,
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    {firstName ? `Send a Thank You Greet-Me to ${firstName}` : 'Send a Thank You Greet-Me'}
                  </button>
                )}
              </div>
            );
          })()}

          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
          {trustLinks}
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
          {trustLinks}
        </div>
      </div>
    );
  }

  // ---- Connect Pending (resume onboarding) ----
  if (connectPending) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ marginBottom: '1.5rem' }}>
            <p style={styles.brandLine}>
              <span style={{ fontWeight: 600 }}>Greet-Me&trade;</span>
              <span style={{ margin: '0 0.4rem', opacity: 0.4 }}>&middot;</span>
              <span style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>QR Cash&trade;</span>
            </p>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🏦</div>
            <h1 style={{ ...styles.title, marginBottom: '0.25rem' }}>
              Finish Setting Up Your Payout
            </h1>
          </div>

          <p style={{ fontSize: '0.9375rem', color: '#6b7280', margin: '0 0 1rem', lineHeight: 1.5 }}>
            You started setting up your debit/bank payout. Tap below to finish and receive your {fmt(gift.giftAmountCents)} gift.
          </p>

          {submitError && (
            <div style={styles.errorBox}>
              <p style={styles.errorText}>{submitError}</p>
            </div>
          )}

          <button
            onClick={handleConnectOnboard}
            disabled={submitting}
            style={styles.ctaButton(submitting)}
          >
            <span style={{ fontSize: '1.1rem' }}>🏦</span>
            {submitting ? 'Setting up...' : 'Finish Payout Setup'}
          </button>

          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
          {trustLinks}
        </div>
      </div>
    );
  }

  // ---- Claim Form (Payout Method Choice) ----
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        {/* Header */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={styles.brandLine}>
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
        <div style={styles.amountBox}>
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

        {/* Payout Method Picker */}
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
          {PAYOUT_METHODS.map((method) => {
            const isSelected = selectedMethod === method.id;
            return (
              <button
                key={method.id}
                type="button"
                onClick={() => {
                  if (selectedMethod !== method.id) {
                    setSelectedMethod(method.id);
                    setInputValue(method.prefix || '');
                  }
                  setInputError(null);
                  setSubmitError(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  background: isSelected ? '#fffbeb' : '#fff',
                  border: isSelected ? '2px solid #f59e0b' : '1px solid #e5e7eb',
                  borderRadius: '0.625rem',
                  cursor: 'pointer',
                  fontFamily: FONT_STACK,
                  textAlign: 'left',
                  width: '100%',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
              >
                <span style={{ fontSize: '1.5rem', flexShrink: 0 }}>{method.icon}</span>
                <div style={{
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  color: isSelected ? '#92400e' : '#1f2937',
                }}>
                  {method.label}
                </div>
                {/* Selection indicator */}
                <div style={{
                  marginLeft: 'auto',
                  width: '1.25rem',
                  height: '1.25rem',
                  borderRadius: '50%',
                  border: isSelected ? '2px solid #f59e0b' : '2px solid #d1d5db',
                  background: isSelected ? '#f59e0b' : 'transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  {isSelected && (
                    <div style={{
                      width: '0.5rem',
                      height: '0.5rem',
                      borderRadius: '50%',
                      background: '#fff',
                    }} />
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Destination input */}
        {currentMethod && (
          <div style={{ marginBottom: '1rem', textAlign: 'left' }}>
            <label style={{
              display: 'block',
              fontSize: '0.875rem',
              fontWeight: 600,
              color: '#374151',
              marginBottom: '0.375rem',
            }}>
              Enter your email, phone, or handle
            </label>
            <input
              type="text"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setInputError(null);
              }}
              placeholder={currentMethod.placeholder}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: inputError ? '1px solid #dc2626' : '1px solid #d1d5db',
                borderRadius: '0.5rem',
                fontSize: '1rem',
                fontFamily: FONT_STACK,
                outline: 'none',
                boxSizing: 'border-box',
              }}
              disabled={submitting}
            />
            {inputError ? (
              <p style={{ fontSize: '0.8125rem', color: '#dc2626', margin: '0.375rem 0 0' }}>
                {inputError}
              </p>
            ) : (
              <p style={{ fontSize: '0.75rem', color: '#9ca3af', margin: '0.375rem 0 0' }}>
                Use the email, phone, or handle linked to your account. We&rsquo;ll follow up to complete delivery.
              </p>
            )}
          </div>
        )}

        {/* Legacy debit/bank explainer — kept for safety but hidden */}
        {false && selectedMethod === 'debit_bank' && (
          <p style={{
            fontSize: '0.8125rem',
            color: '#6b7280',
            margin: '0 0 1rem',
            textAlign: 'left',
            lineHeight: 1.5,
          }}>
            You'll be redirected to Stripe to securely enter your debit card or bank account details.
            Funds are sent automatically once setup is complete.
          </p>
        )}

        {/* Submit Error */}
        {submitError && (
          <div style={styles.errorBox}>
            <p style={styles.errorText}>{submitError}</p>
          </div>
        )}

        {/* CTA Button */}
        <button
          onClick={handleClaim}
          disabled={submitting || !selectedMethod}
          style={styles.ctaButton(submitting || !selectedMethod)}
        >
          {submitting ? (
            'Processing...'
          ) : !selectedMethod ? (
            'Select a payout method'
          ) : selectedMethod === 'debit_bank' ? (
            <>
              <span style={{ fontSize: '1.1rem' }}>🏦</span>
              Set Up Debit/Bank Payout
            </>
          ) : (
            <>
              <span style={{ fontSize: '1.1rem' }}>
                {currentMethod?.icon}
              </span>
              Claim {fmt(gift.giftAmountCents)} via {currentMethod?.label}
            </>
          )}
        </button>

        {/* Fine print */}
        <p style={{
          fontSize: '0.75rem',
          color: '#9ca3af',
          lineHeight: 1.5,
          margin: '0.75rem 0 0.5rem',
        }}>
          By claiming, you agree to receive funds via your selected method.
          QR Cash&trade; gifts expire {gift.expiryDays || 30} days after delivery.
        </p>

        <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
          {trustLinks}
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
  brandLine: {
    fontSize: '0.8rem',
    color: '#9ca3af',
    margin: '0 0 1rem',
    letterSpacing: '0.05em',
    fontFamily: FONT_STACK,
  },
  amountBox: {
    padding: '1.25rem',
    background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
    borderRadius: '0.75rem',
    border: '1px solid #fcd34d',
    marginBottom: '1.5rem',
  },
  errorBox: {
    padding: '0.75rem 1rem',
    background: '#fef2f2',
    borderRadius: '0.5rem',
    border: '1px solid #fecaca',
    marginBottom: '1rem',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#dc2626',
    margin: 0,
    lineHeight: 1.4,
  },
  ctaButton: (disabled) => ({
    width: '100%',
    padding: '0.875rem',
    background: disabled
      ? '#d1d5db'
      : 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
    color: '#fff',
    border: 'none',
    borderRadius: '0.5rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: disabled ? 'not-allowed' : 'pointer',
    fontFamily: FONT_STACK,
    boxShadow: disabled
      ? 'none'
      : '0 2px 6px rgba(245, 158, 11, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '0.5rem',
  }),
};

const trustLinks = (
  <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#b0b0b0', textAlign: 'center' }}>
    <a href="#/support" style={{ color: 'inherit', textDecoration: 'underline' }}>Support</a>
    {' · '}
    <a href="#/legal#privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy</a>
    {' · '}
    <a href="#/legal#terms" style={{ color: 'inherit', textDecoration: 'underline' }}>Terms</a>
  </p>
);
