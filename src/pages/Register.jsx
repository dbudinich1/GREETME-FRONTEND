// src/pages/Register.jsx
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getErrorMessage } from '../utils/errorMessages';
// lucide icons removed — QR/Smartphone section removed
import GreetMeLogo from '../components/GreetMeLogo';
import { useAccountState } from '../hooks/useAccountState';

// Fast mode: skip name fields when entering from a viral loop
function isFastMode() {
  if (new URLSearchParams(window.location.hash.split('?')[1] || '').get('fast') === '1') return true;
  return !!(
    localStorage.getItem('greetme_pending_credit') ||
    localStorage.getItem('greetme_g1g1_gift_code') ||
    localStorage.getItem('greetme_referral_code')
  );
}

export default function Register() {
  const [fastMode] = useState(isFastMode);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // Phase 3D Batch B — B.4: module-scope `isMobile = window.innerWidth <= 480;`
  // was frozen at module load and never updated on rotation/resize. Promoted
  // to component state with a resize listener — matches the pattern already
  // used in Login.jsx / DashboardLayout.jsx / Cart.jsx / Checkout.jsx etc.
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const { register } = useAuth();
  const navigate = useNavigate();
  // Phase 3D Batch D Slice 3 — suppress the registration form for users who
  // are already authenticated, BUT preserve the recipient-mode escape hatch:
  // a visitor with sessionStorage.greetme_session_mode === 'recipient' is
  // explicitly in a guest claim flow (set by CreditClaim.jsx for unauth
  // visitors) and must still see the form so inline recipient registration
  // can complete. The QR/credit/G1G1 claim ecosystem depends on this.
  const accountState = useAccountState();
  useEffect(() => {
    if (accountState.isAuthenticated && !accountState.isRecipientMode) {
      navigate('/dashboard', { replace: true });
    }
  }, [accountState.isAuthenticated, accountState.isRecipientMode, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
    const result = await register(fullName, email, password);

    if (result.success) {
      const wasRecipientMode = sessionStorage.getItem('greetme_session_mode') === 'recipient';
      sessionStorage.removeItem('greetme_session_mode');
      if (wasRecipientMode) {
        try { localStorage.setItem('greetme_origin_recipient', 'true'); } catch {}
      }
      const pendingG1G1 = localStorage.getItem('greetme_g1g1_gift_code');
      const pendingCredit = localStorage.getItem('greetme_pending_credit');
      const pendingReferral = localStorage.getItem('greetme_referral_code');
      const dest = pendingG1G1
        ? (localStorage.removeItem('greetme_g1g1_gift_code'), `/gift/g1g1/${pendingG1G1}`)
        : pendingCredit
        ? (localStorage.removeItem('greetme_pending_credit'), `/claim-credit/${pendingCredit}`)
        : pendingReferral
        ? (localStorage.removeItem('greetme_referral_code'), `/dashboard/send?referral=${pendingReferral}`)
        : '/dashboard';
      if (typeof window.gtag === 'function') {
        window.gtag('event', 'signup_success', {
          event_callback: function() {
            navigate(dest);
          }
        });
      } else {
        navigate(dest);
      }
    } else {
      setError(getErrorMessage(result));
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '1rem' : '2rem',
    }}>
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: isMobile ? '1.5rem' : '2rem',
        width: '100%',
        maxWidth: '380px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ marginBottom: '1rem' }}>
            <GreetMeLogo size="medium" clickable={false} />
          </div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.25rem',
          }}>
            Create Account
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: 'var(--text-secondary)',
          }}>
            {fastMode
              ? 'Create your account in seconds \u2014 you can add the rest later.'
              : 'Start sending personalized greetings'}
          </p>
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: '#fef2f2',
            border: '1px solid #fecaca',
            color: '#dc2626',
            padding: '0.75rem',
            borderRadius: 'var(--radius-md)',
            marginBottom: '1rem',
            fontSize: '0.875rem',
          }}>
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit}>
          {!fastMode && (
            <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1rem' }}>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.375rem',
                }}>
                  First Name
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="First"
                  required
                  autoComplete="given-name"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    background: 'var(--bg-primary)',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.375rem',
                }}>
                  Last Name
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Last"
                  required
                  autoComplete="family-name"
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '1rem',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    background: 'var(--bg-primary)',
                  }}
                />
              </div>
            </div>
          )}

          <div style={{ marginBottom: '1rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.375rem',
            }}>
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                background: 'var(--bg-primary)',
              }}
            />
          </div>

          <div style={{ marginBottom: '1.25rem' }}>
            <label style={{
              display: 'block',
              fontSize: '0.8125rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.375rem',
            }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Create a password"
              required
              minLength={8}
              autoComplete="new-password"
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontSize: '1rem',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                background: 'var(--bg-primary)',
              }}
            />
            <p style={{
              marginTop: '0.375rem',
              fontSize: '0.75rem',
              color: 'var(--text-tertiary)',
            }}>
              At least 8 characters
            </p>
          </div>

          <p style={{
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
            margin: '0 0 1rem',
            lineHeight: 1.5,
          }}>
            By signing up, you confirm you are at least 13 years old and agree to our{' '}
            <a href="/#/legal#terms" style={{ color: '#6366f1' }}>Terms</a> and{' '}
            <a href="/#/legal#privacy" style={{ color: '#6366f1' }}>Privacy Policy</a>.
          </p>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '0.875rem',
              background: loading ? 'var(--gray-300)' : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              minHeight: isMobile ? '48px' : '44px',
            }}
          >
            {loading ? 'Creating account...' : 'Sign Up'}
          </button>
        </form>

        {/* Sign in link */}
        <p style={{
          marginTop: '1.25rem',
          textAlign: 'center',
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
        }}>
          Already have an account?{' '}
          <Link
            to="/login"
            style={{
              color: '#6366f1',
              fontWeight: 600,
              textDecoration: 'none',
            }}
          >
            Sign in
          </Link>
        </p>

        {/* Mobile app section removed — not needed at registration */}
      </div>
    </div>
  );
}
