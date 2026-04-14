// src/pages/G1G1Claim.jsx
// Public claim page for G1G1 (Greet One, Give One) gifted memberships
// Route: /gift/g1g1/:giftCode

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import GreetMeLogo from '../components/GreetMeLogo';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const G1G1_STORAGE_KEY = 'greetme_g1g1_gift_code';

export default function G1G1Claim() {
  const { giftCode } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [gift, setGift] = useState(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState(null);
  const [claimed, setClaimed] = useState(false);

  // Fetch gift details on mount
  useEffect(() => {
    if (!giftCode) {
      setError('No gift code provided');
      setLoading(false);
      return;
    }

    api.getG1G1Gift(giftCode)
      .then((res) => {
        if (res?.ok && res.gift) {
          setGift(res.gift);
          if (res.gift.status === 'claimed') {
            setClaimed(true);
          }
        } else {
          setError(res?.error || 'Gift not found');
        }
      })
      .catch(() => setError('Unable to load gift details'))
      .finally(() => setLoading(false));
  }, [giftCode]);

  // Auto-claim: if user just registered/logged in and returned here
  useEffect(() => {
    if (isAuthenticated && gift && gift.status !== 'claimed' && !claiming && !claimed) {
      // User is authenticated and gift is available — they can claim via button
      // Clear the stashed code since they're already on the claim page
      localStorage.removeItem(G1G1_STORAGE_KEY);
    }
  }, [isAuthenticated, gift, claiming, claimed]);

  const handleAuthRedirect = () => {
    // Stash gift code so Register/Login can redirect back here
    localStorage.setItem(G1G1_STORAGE_KEY, giftCode);
    navigate('/register');
  };

  const handleClaim = async () => {
    setClaiming(true);
    setError(null);

    try {
      const res = await api.claimG1G1Gift(giftCode);
      if (res?.ok) {
        setClaimed(true);
        try { sessionStorage.setItem('greetme_g1g1_claimed', '1'); } catch {}
      } else {
        setError(res?.error || 'Failed to claim gift');
      }
    } catch (err) {
      if (err?.status === 403) {
        setError('This gift was sent by your account \u2014 you cannot claim your own gift. Share the link with the person you want to receive it.');
      } else if (err?.status === 409) {
        setError('This gift has already been claimed.');
        setClaimed(true);
      } else {
        setError(err?.message || 'Something went wrong. Please try again.');
      }
    } finally {
      setClaiming(false);
    }
  };

  // --- Render ---

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <GreetMeLogo size="medium" clickable={false} />
          <p style={styles.loadingText}>Loading your gift...</p>
        </div>
      </div>
    );
  }

  if (error && !gift) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <GreetMeLogo size="medium" clickable={false} />
          <h1 style={styles.title}>Gift Not Found</h1>
          <p style={styles.subtitle}>{error}</p>
          <button onClick={() => navigate('/')} style={styles.secondaryBtn}>
            Go to Greet-Me
          </button>
        </div>
      </div>
    );
  }

  // Already claimed — celebratory success state
  if (claimed) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <GreetMeLogo size="medium" clickable={false} />
          <div style={styles.celebrationEmoji}>🎉</div>
          <h1 style={styles.title}>You're in. Your Greet-Me is ready.</h1>
          <p style={styles.successSubhead}>
            Someone did this for you. Now send one of your own — it takes less than a minute.
          </p>
          <button onClick={() => {
            console.log('EXPLOSION_LAYER_CLAIM_SEND_CLICK');
            navigate('/dashboard/send?occasion=just_because');
          }} style={styles.primaryBtn}>
            Send My First Greet-Me
          </button>
          <p style={styles.successNoPressure}>
            Fast, personal, unforgettable.
          </p>
        </div>
      </div>
    );
  }

  // Gift available — show claim page
  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <GreetMeLogo size="medium" clickable={false} />

        <div style={styles.giftBadge}>FREE MEMBERSHIP</div>

        <h1 style={styles.title}>
          {gift.senderName} gifted you a Greet-Me!
        </h1>

        <p style={styles.subtitle}>
          You've received a free <strong>{gift.planName}</strong> membership.
          Send AI-animated video greetings with your own voice and photo
          to the people who matter most.
        </p>

        <div style={styles.planBox}>
          <div style={styles.planLabel}>{gift.planName}</div>
          <div style={styles.planPeriod}>{gift.billingPeriod === 'yearly' ? '1 Year' : gift.billingPeriod} — Free</div>
        </div>

        {error && (
          <div style={styles.errorBox}>{error}</div>
        )}

        {isAuthenticated ? (
          <button
            onClick={handleClaim}
            disabled={claiming}
            style={{
              ...styles.primaryBtn,
              ...(claiming ? styles.disabledBtn : {}),
            }}
          >
            {claiming ? 'Activating...' : 'Activate My Membership'}
          </button>
        ) : (
          <>
            <button onClick={handleAuthRedirect} style={styles.primaryBtn}>
              Create Account & Claim Gift
            </button>
            <p style={styles.loginHint}>
              Already have an account?{' '}
              <span
                onClick={() => {
                  localStorage.setItem(G1G1_STORAGE_KEY, giftCode);
                  navigate('/login');
                }}
                style={styles.loginLink}
              >
                Sign in
              </span>
            </p>
          </>
        )}

        <p style={styles.footer}>Greet One, Give One&trade; — included with full memberships.</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    fontFamily: FONT_STACK,
  },
  card: {
    background: 'white',
    borderRadius: '16px',
    padding: '2rem',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    textAlign: 'center',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1f2937',
    margin: '0.75rem 0 0.5rem',
    lineHeight: 1.3,
  },
  subtitle: {
    fontSize: '0.9375rem',
    color: '#4b5563',
    lineHeight: 1.6,
    margin: '0 0 1.25rem',
  },
  giftBadge: {
    display: 'inline-block',
    marginTop: '1rem',
    padding: '4px 14px',
    background: '#f0fdf4',
    color: '#16a34a',
    borderRadius: '20px',
    fontSize: '0.75rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
  },
  planBox: {
    background: '#f9fafb',
    border: '1px solid #e5e7eb',
    borderRadius: '12px',
    padding: '1rem',
    marginBottom: '1.25rem',
  },
  planLabel: {
    fontSize: '1.125rem',
    fontWeight: 700,
    color: '#1f2937',
  },
  planPeriod: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  },
  primaryBtn: {
    width: '100%',
    padding: '0.875rem',
    background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT_STACK,
    minHeight: '48px',
  },
  disabledBtn: {
    background: '#d1d5db',
    cursor: 'not-allowed',
  },
  secondaryBtn: {
    width: '100%',
    padding: '0.875rem',
    background: 'transparent',
    color: '#6366f1',
    border: '2px solid #6366f1',
    borderRadius: '12px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT_STACK,
    marginTop: '0.75rem',
  },
  celebrationEmoji: {
    fontSize: '3rem',
    margin: '1rem 0 0',
    lineHeight: 1,
  },
  successSubhead: {
    fontSize: '1.0625rem',
    color: '#4b5563',
    fontWeight: 500,
    margin: '0 0 1rem',
    lineHeight: 1.5,
  },
  successBody: {
    fontSize: '0.9375rem',
    color: '#4b5563',
    lineHeight: 1.6,
    margin: '0 0 0.75rem',
  },
  successSupport: {
    fontSize: '0.875rem',
    color: '#6b7280',
    lineHeight: 1.6,
    margin: '0 0 1.5rem',
    fontStyle: 'italic',
  },
  successExtra: {
    fontSize: '0.8125rem',
    color: '#6b7280',
    margin: '1.25rem 0 0.5rem',
    lineHeight: 1.5,
  },
  successNoPressure: {
    fontSize: '0.8125rem',
    color: '#9ca3af',
    margin: '0',
  },
  errorBox: {
    background: '#fef2f2',
    border: '1px solid #fecaca',
    color: '#dc2626',
    padding: '0.75rem',
    borderRadius: '8px',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  },
  loginHint: {
    marginTop: '1rem',
    fontSize: '0.875rem',
    color: '#6b7280',
  },
  loginLink: {
    color: '#6366f1',
    fontWeight: 600,
    cursor: 'pointer',
    textDecoration: 'none',
  },
  loadingText: {
    fontSize: '1rem',
    color: '#6b7280',
    marginTop: '1rem',
  },
  footer: {
    marginTop: '1.5rem',
    fontSize: '0.8125rem',
    color: '#9ca3af',
  },
};
