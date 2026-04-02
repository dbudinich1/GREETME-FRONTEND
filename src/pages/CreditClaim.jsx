// src/pages/CreditClaim.jsx
// Public landing page for tracked courtesy credit
// Route: /credit/:creditCode (replaces ReferralCredit for courtesy credits)

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function CreditClaim() {
  const { creditCode } = useParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [credit, setCredit] = useState(null);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);

  useEffect(() => {
    if (!creditCode) {
      setError('Invalid credit link.');
      setLoading(false);
      return;
    }
    api.request(`/api/credits/${creditCode}`)
      .then((data) => {
        if (data?.ok && data.credit) {
          setCredit(data.credit);
          if (data.credit.claimed) setClaimed(true);
        } else {
          setError('This credit is no longer valid.');
        }
      })
      .catch(() => setError('Could not load credit.'))
      .finally(() => setLoading(false));
  }, [creditCode]);

  const handleClaim = async () => {
    if (!isAuthenticated) {
      // Stash credit code and redirect to login
      localStorage.setItem('greetme_pending_credit', creditCode);
      navigate('/login');
      return;
    }
    setClaiming(true);
    try {
      const result = await api.request(`/api/credits/${creditCode}/claim`, {
        method: 'POST',
      });
      if (result?.ok) {
        setClaimed(true);
        // Stash for checkout
        localStorage.setItem('greetme_courtesy_credit', JSON.stringify({
          creditCode,
          amount: (result.amountCents || credit?.amountCents || 500) / 100,
          source: 'courtesy',
          claimedAt: new Date().toISOString(),
        }));
      } else {
        setError(result?.error || 'Could not claim credit.');
      }
    } catch (err) {
      setError(err?.message || 'Claim failed.');
    } finally {
      setClaiming(false);
    }
  };

  const displayAmount = credit ? `$${(credit.amountCents / 100).toFixed(0)}` : '$5';

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: FONT_STACK }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: 'center', maxWidth: '400px' }}>
          <h2 style={{ color: '#fff', marginBottom: '1rem', fontFamily: 'Georgia, serif' }}>Oops</h2>
          <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>{error}</p>
          <a href="/#/pricing" style={{ color: '#10b981', textDecoration: 'underline' }}>View plans</a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
        <div style={styles.icon}>🎁</div>

        <p style={styles.eyebrow}>A gift from Greet-Me</p>

        {claimed ? (
          <>
            <h1 style={styles.headline}>Credit applied</h1>
            <p style={styles.body}>
              Your {displayAmount} credit has been saved to your account.
            </p>

            {/* Primary: Use credit now */}
            <button onClick={() => {
              if (isAuthenticated) { navigate('/dashboard/send'); }
              else { navigate('/register', { state: { returnTo: '/dashboard/send' } }); }
            }} style={{ ...styles.cta, marginBottom: '0.75rem' }}>
              Use {displayAmount} Now &mdash; Send a Greet-Me
            </button>

            {/* Secondary: Explore plans */}
            <button onClick={() => navigate('/pricing')} style={{
              ...styles.cta,
              background: 'transparent',
              color: '#fff',
              border: '1px solid rgba(255,255,255,0.3)',
              marginBottom: '0.75rem',
            }}>
              Explore Plans
            </button>

            {/* Tertiary: Save for later */}
            <div
              onClick={() => isAuthenticated ? navigate('/dashboard') : navigate('/')}
              style={{
                fontSize: '0.8125rem',
                color: 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                textAlign: 'center',
              }}
            >
              {isAuthenticated ? 'Save for later' : 'Maybe later'}
            </div>
          </>
        ) : (
          <>
            <h1 style={styles.headline}>
              You&rsquo;ve received {displayAmount} toward your first Greet-Me subscription.
            </h1>
            <p style={styles.body}>
              Apply your credit and start sending unforgettable greetings to the people who matter most.
            </p>
            <button onClick={handleClaim} disabled={claiming} style={{
              ...styles.cta,
              opacity: claiming ? 0.7 : 1,
              cursor: claiming ? 'default' : 'pointer',
            }}>
              {claiming ? 'Applying...' : `Apply My ${displayAmount} Credit`}
            </button>
            <p style={styles.terms}>
              Valid toward Social Butterfly or higher plans. Terms apply.
            </p>
          </>
        )}

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
    background: 'linear-gradient(160deg, #1B2A4A 0%, #2d1b4e 40%, #1B2A4A 100%)',
    padding: '2rem 1.5rem',
    fontFamily: FONT_STACK,
  },
  icon: {
    width: '4.5rem', height: '4.5rem', borderRadius: '50%',
    background: 'rgba(16, 185, 129, 0.15)', border: '2px solid rgba(16, 185, 129, 0.4)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    margin: '0 auto 2rem', fontSize: '2rem',
  },
  eyebrow: {
    fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)',
    letterSpacing: '0.15em', textTransform: 'uppercase', margin: '0 0 0.75rem',
  },
  headline: {
    fontSize: '1.75rem', fontWeight: 500, color: '#fff',
    lineHeight: 1.4, margin: '0 0 1rem', fontFamily: 'Georgia, serif',
  },
  body: {
    fontSize: '0.9375rem', color: 'rgba(255,255,255,0.6)',
    lineHeight: 1.6, margin: '0 0 2.5rem',
  },
  cta: {
    display: 'inline-block', padding: '0.875rem 2.5rem',
    background: '#fff', color: '#1B2A4A', border: 'none', borderRadius: '2rem',
    fontSize: '1.0625rem', fontWeight: 600, fontFamily: 'Georgia, serif',
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(255,255,255,0.15)',
  },
  terms: {
    fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)',
    margin: '2rem 0 0', lineHeight: 1.5,
  },
  footer: {
    fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', margin: '2rem 0 0',
  },
};
