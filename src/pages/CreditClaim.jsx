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
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [credit, setCredit] = useState(null);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [showNudge, setShowNudge] = useState(false);

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

            {/* Primary CTA: Thank You */}
            {credit?.sourceJobId && (
              <button onClick={() => {
                if (isAuthenticated) {
                  navigate(`/thank-you?jobId=${credit.sourceJobId}`);
                } else {
                  localStorage.setItem('greetme_pending_thankyou', credit.sourceJobId);
                  navigate('/register');
                }
              }} style={{ ...styles.cta, marginBottom: '0.75rem' }}>
                Say Thanks with a Greet-Me
              </button>
            )}

            {/* Secondary CTA: Apply credit */}
            <button onClick={() => {
              if (isAuthenticated) { navigate('/dashboard/send'); }
              else { navigate('/register', { state: { returnTo: '/dashboard/send' } }); }
            }} style={{
              ...styles.cta,
              ...(credit?.sourceJobId ? styles.ctaSecondary : {}),
            }}>
              {isAuthenticated
                ? `Apply Your ${displayAmount} Credit`
                : `Claim Your ${displayAmount} \u2014 Create Your Account`}
            </button>
          </>
        ) : (
          <>
            <h1 style={styles.headline}>
              You&rsquo;ve received {displayAmount} toward your first Greet-Me subscription.
            </h1>
            <p style={styles.body}>
              Someone sent you something meaningful. You can say thanks, or apply your credit toward a subscription.
            </p>

            {/* Primary CTA: Thank You (pre-claim) */}
            {credit?.sourceJobId && (
              <button onClick={async () => {
                if (!isAuthenticated) {
                  localStorage.setItem('greetme_pending_thankyou', credit.sourceJobId);
                  localStorage.setItem('greetme_pending_credit', creditCode);
                  navigate('/register');
                  return;
                }
                await handleClaim();
                navigate(`/thank-you?jobId=${credit.sourceJobId}`);
              }} style={{ ...styles.cta, marginBottom: '0.75rem' }}>
                Say Thanks with a Greet-Me
              </button>
            )}

            {/* Secondary CTA: Apply credit (with nudge if sourceJobId exists) */}
            <button onClick={() => {
              if (credit?.sourceJobId && !showNudge) {
                setShowNudge(true);
                return;
              }
              handleClaim();
            }} disabled={claiming} style={{
              ...styles.cta,
              ...(credit?.sourceJobId ? styles.ctaSecondary : {}),
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

        {/* Thank-you nudge modal */}
        {showNudge && (
          <div style={styles.nudgeOverlay} onClick={() => setShowNudge(false)}>
            <div style={styles.nudgeCard} onClick={(e) => e.stopPropagation()}>
              <h2 style={styles.nudgeHeadline}>
                Before you go &mdash; want to send a quick thank-you?
              </h2>
              <p style={styles.nudgeBody}>
                You can thank the sender with a Greet-Me now, or skip and apply your {displayAmount} subscription credit.
              </p>
              <button onClick={async () => {
                setShowNudge(false);
                if (!isAuthenticated) {
                  localStorage.setItem('greetme_pending_thankyou', credit.sourceJobId);
                  localStorage.setItem('greetme_pending_credit', creditCode);
                  navigate('/register');
                  return;
                }
                await handleClaim();
                navigate(`/thank-you?jobId=${credit.sourceJobId}`);
              }} style={{ ...styles.cta, marginBottom: '0.75rem', width: '100%' }}>
                Say Thanks with a Greet-Me
              </button>
              <button onClick={() => {
                setShowNudge(false);
                handleClaim();
              }} style={{ ...styles.cta, ...styles.ctaSecondary, width: '100%' }}>
                Skip for now
              </button>
            </div>
          </div>
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
  ctaSecondary: {
    background: 'transparent', color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.3)',
    boxShadow: 'none', fontSize: '0.9375rem',
  },
  terms: {
    fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)',
    margin: '2rem 0 0', lineHeight: 1.5,
  },
  footer: {
    fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', margin: '2rem 0 0',
  },
  nudgeOverlay: {
    position: 'fixed', inset: 0,
    background: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 1000, padding: '1.5rem',
  },
  nudgeCard: {
    background: '#fff', borderRadius: '16px',
    padding: '2rem', maxWidth: '400px', width: '100%',
    textAlign: 'center',
    boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  nudgeHeadline: {
    fontSize: '1.25rem', fontWeight: 600, color: '#1B2A4A',
    margin: '0 0 0.75rem', fontFamily: 'Georgia, serif',
    lineHeight: 1.4,
  },
  nudgeBody: {
    fontSize: '0.9375rem', color: '#555',
    lineHeight: 1.6, margin: '0 0 1.5rem',
  },
};
