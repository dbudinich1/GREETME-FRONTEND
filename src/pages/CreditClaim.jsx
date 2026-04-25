// src/pages/CreditClaim.jsx
// Public landing page for tracked courtesy credit
// Route: /claim-credit/:creditCode

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function CreditClaim() {
  const { creditCode } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, register, login } = useAuth();

  // Identity snapshot: capture current auth BEFORE any clearing decision.
  // Clearing is deferred to after credit fetch — conditional on credit state + visitor identity.
  const [preAuthSnapshot] = useState(() => {
    try {
      const token = localStorage.getItem('token');
      const userData = localStorage.getItem('user');
      if (token && userData && userData !== 'undefined') {
        return { userId: JSON.parse(userData).id || null, token };
      }
    } catch {}
    return { userId: null, token: null };
  });

  const [loading, setLoading] = useState(true);
  const [credit, setCredit] = useState(null);
  const [error, setError] = useState(null);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const [autoClaimed, setAutoClaimed] = useState(null);

  // Recipient conversion flow state
  const [recipientPrefill, setRecipientPrefill] = useState(null);
  const [prefillLoading, setPrefillLoading] = useState(false);
  const [regPassword, setRegPassword] = useState('');
  const [registering, setRegistering] = useState(false);
  const [regError, setRegError] = useState(null);
  const [chosenAction, setChosenAction] = useState(null);
  const [isLoginMode, setIsLoginMode] = useState(false);
  const [loginPassword, setLoginPassword] = useState('');
  const [isReturningUser, setIsReturningUser] = useState(false);
  const [claimInProgress, setClaimInProgress] = useState(false);
  const [claimedByOther, setClaimedByOther] = useState(false);

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
          if (data.credit.claimed) {
            setClaimed(true);
            // Q3 detection: claimed by someone other than the current visitor
            if (data.credit.claimedBy && data.credit.claimedBy !== preAuthSnapshot.userId) {
              setClaimedByOther(true);
            }
          }
          // Conditional session clearing: only for unclaimed credits with no existing auth
          const shouldClearSession = !data.credit.claimed && !preAuthSnapshot.userId;
          if (shouldClearSession) {
            try {
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              localStorage.removeItem('greetme_voice_file');
            } catch {}
            sessionStorage.setItem('greetme_session_mode', 'recipient');
          }
        } else {
          setError('This credit is no longer valid.');
        }
      })
      .catch(() => setError('Could not load credit.'))
      .finally(() => setLoading(false));
  }, [creditCode]);

  const handleClaim = async () => {
    if (!isAuthenticated) {
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
        localStorage.setItem('greetme_courtesy_credit', JSON.stringify({
          creditCode,
          amount: (result.amountCents || credit?.amountCents || 500) / 100,
          source: 'courtesy',
          claimedAt: new Date().toISOString(),
        }));
      } else if (result?.code === 'CREDIT_ALREADY_CLAIMED') {
        setClaimed(true);
      } else if (result?.status === 401) {
        setError('Your session has expired. Please refresh and try again.');
      } else {
        setError(result?.error || 'Could not claim credit.');
      }
    } catch (err) {
      if (err?.code === 'CREDIT_ALREADY_CLAIMED' || err?.message?.includes('already been claimed')) {
        setClaimedByOther(true);
      } else {
        setError(err?.message || 'Claim failed.');
      }
    } finally {
      setClaiming(false);
    }
  };

  // Recipient conversion: register → claim → route (deterministic chaining)
  const handleRecipientConversion = async (action) => {
    const name = recipientPrefill?.name || '';
    const email = recipientPrefill?.email || '';

    if (!email || !regPassword) {
      setRegError('Email and password are required.');
      return;
    }

    if (regPassword.length < 8) {
      setRegError('Password must be at least 8 characters.');
      return;
    }

    setClaimInProgress(true);

    setRegistering(true);
    setRegError(null);
    setChosenAction(action);

    // STEP 1 — REGISTER
    const regResult = await register(name, email, regPassword);

    if (!regResult?.success) {
      if (regResult?.code === 'EMAIL_EXISTS') {
        setIsLoginMode(true);
        setRegError('Welcome back \u2014 enter your password to continue.');
      } else {
        setRegError(regResult?.error || 'Registration failed. Please try again.');
      }
      setRegistering(false);
      setClaimInProgress(false);
      return;
    }

    // STEP 2 — CLAIM (after auth exists)
    let creditApplied = false;

    try {
      const claimResult = await api.request(`/api/credits/${creditCode}/claim`, { method: 'POST' });

      if (claimResult?.ok) {
        creditApplied = true;

        localStorage.setItem('greetme_courtesy_credit', JSON.stringify({
          creditCode,
          amount: (claimResult.amountCents || credit?.amountCents || 500) / 100,
          source: 'courtesy',
          claimedAt: new Date().toISOString(),
        }));
      }
    } catch (claimErr) {
      if (claimErr?.code === 'CREDIT_ALREADY_CLAIMED' || claimErr?.message?.includes('already been claimed')) {
        setClaimedByOther(true);
        setRegistering(false);
        setClaimInProgress(false);
        return;
      }
    }

    // STEP 3 — ROUTE (only if credit was applied)
    sessionStorage.removeItem('greetme_session_mode');

    if (!creditApplied) {
      setRegError('Your account was created, but the credit could not be applied. You can claim it later from your dashboard.');
      setRegistering(false);
      setClaimInProgress(false);
      return;
    }

    setClaimInProgress(false);
    if (action === 'thankyou' && credit?.sourceJobId) {
      navigate(`/recipient-thankyou?jobId=${credit.sourceJobId}`);
    } else {
      navigate('/pricing');
    }
  };

  // Returning-user login: login → claim → loop-closure
  const handleReturningLogin = async () => {
    setClaimInProgress(true);
    const email = recipientPrefill?.email || '';

    if (!email || !loginPassword) {
      setRegError('Email and password are required.');
      setClaimInProgress(false);
      return;
    }

    setRegistering(true);
    setRegError(null);

    // STEP 1 — LOGIN
    const loginResult = await login(email, loginPassword);

    if (!loginResult?.success) {
      setRegError(loginResult?.error || 'Login failed. Please try again.');
      setRegistering(false);
      setClaimInProgress(false);
      return;
    }

    // STEP 2 — CLAIM (now authenticated)
    let loginClaimSuccess = false;
    try {
      const claimResult = await api.request(`/api/credits/${creditCode}/claim`, { method: 'POST' });
      if (claimResult?.ok) {
        loginClaimSuccess = true;
        localStorage.setItem('greetme_courtesy_credit', JSON.stringify({
          creditCode,
          amount: (claimResult.amountCents || credit?.amountCents || 500) / 100,
          source: 'courtesy',
          claimedAt: new Date().toISOString(),
        }));
      }
    } catch (claimErr) {
      if (claimErr?.code === 'CREDIT_ALREADY_CLAIMED' || claimErr?.message?.includes('already been claimed')) {
        setClaimedByOther(true);
        setRegistering(false);
        setClaimInProgress(false);
        return;
      }
    }

    if (!loginClaimSuccess) {
      setRegError('Credit could not be applied. You can claim it later from your dashboard.');
      setRegistering(false);
      setClaimInProgress(false);
      return;
    }

    // STEP 3 — SHOW LOOP-CLOSURE (only on success)
    sessionStorage.removeItem('greetme_session_mode');
    setIsLoginMode(false);
    setLoginPassword('');
    setRegistering(false);
    setClaimInProgress(false);
    setIsReturningUser(true);
  };

  // Auto-claim onboarding test-send credits silently
  useEffect(() => {
    if (!credit?.isOnboardingTestSend || !isAuthenticated) return;
    let cancelled = false;
    (async () => {
      // Already claimed in Cosmos — just ensure localStorage stash exists
      if (credit.claimed) {
        localStorage.setItem('greetme_courtesy_credit', JSON.stringify({
          creditCode,
          amount: (credit.amountCents || 500) / 100,
          source: 'courtesy',
          claimedAt: new Date().toISOString(),
        }));
        setAutoClaimed(true);
        return;
      }
      // Not yet claimed — claim now
      try {
        const result = await api.request(`/api/credits/${creditCode}/claim`, { method: 'POST' });
        if (cancelled) return;
        if (result?.ok) {
          localStorage.setItem('greetme_courtesy_credit', JSON.stringify({
            creditCode,
            amount: (result.amountCents || credit.amountCents || 500) / 100,
            source: 'courtesy',
            claimedAt: new Date().toISOString(),
          }));
          setAutoClaimed(true);
        } else {
          setAutoClaimed(false);
        }
      } catch {
        if (!cancelled) setAutoClaimed(false);
      }
    })();
    return () => { cancelled = true; };
  }, [credit, isAuthenticated, creditCode]);

  // Fetch recipient prefill for inline registration (unregistered recipients only)
  useEffect(() => {
    if (isAuthenticated || !credit?.sourceJobId || credit?.isOnboardingTestSend) return;
    setPrefillLoading(true);
    api.getThankyouPrefill(credit.sourceJobId)
      .then((data) => {
        if (data?.ok && data.prefill) {
          setRecipientPrefill({
            name: data.prefill.senderRecipientName || '',
            email: data.prefill.senderRecipientEmail || '',
            senderName: data.prefill.recipientName || '',
          });
        }
      })
      .catch(() => {})
      .finally(() => setPrefillLoading(false));
  }, [credit, isAuthenticated]);

  const displayAmount = credit ? `$${(credit.amountCents / 100).toFixed(0)}` : '$5';

  if (loading) {
    return (
      <div style={styles.page}>
        <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: FONT_STACK }}>Loading...</p>
      </div>
    );
  }

  if (error) {
    const isResolvedState = error === 'This credit has already been claimed.';
    return (
      <div style={styles.page}>
        <div style={{ textAlign: 'center', maxWidth: '440px', width: '100%' }}>
          {isResolvedState ? (
            <>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>&#10003;</div>
              <h2 style={{ color: '#10b981', marginBottom: '1rem', fontFamily: 'Georgia, serif' }}>This credit has already been applied</h2>
              <p style={{ color: 'rgba(255,255,255,0.7)', marginBottom: '1.5rem' }}>
                You&rsquo;re all set to send your next Greet-Me.
              </p>
              <button
                onClick={() => navigate('/dashboard/send')}
                style={{
                  ...styles.cta,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
                  cursor: 'pointer',
                  marginBottom: '0.75rem',
                }}
              >
                Send a Greet-Me
              </button>
              <button onClick={() => navigate('/dashboard')} style={styles.ctaSecondary}>
                Go to Dashboard
              </button>
            </>
          ) : (
            <>
              <h2 style={{ color: '#fff', marginBottom: '1rem', fontFamily: 'Georgia, serif' }}>Something went wrong</h2>
              <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '1.5rem' }}>{error}</p>
              <a href="/#/pricing" style={{ color: '#10b981', textDecoration: 'underline' }}>View plans</a>
            </>
          )}
        </div>
      </div>
    );
  }

  // Onboarding/test-send credit: auto-claimed state (no thank-you)
  if (credit?.isOnboardingTestSend) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={styles.icon}>🎁</div>
          <p style={styles.eyebrow}>A gift from Greet-Me</p>

          <h1 style={styles.headline}>Your {displayAmount} credit is ready</h1>
          <p style={styles.body}>
            You&rsquo;re all set to start sending.
          </p>

          <button onClick={() => navigate('/pricing')} style={{ ...styles.cta, marginBottom: '0.75rem' }}>
            View Plans &amp; Pricing
          </button>
          <button onClick={() => navigate('/dashboard')} style={styles.ctaSecondary}>
            Go to Dashboard
          </button>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  // Loop closer: sender receiving thank-you greeting taps QR
  const isLoopCloser = credit?.isLoopSend && preAuthSnapshot.userId;
  if (isLoopCloser) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>&#10003;</div>
          <h1 style={styles.headline}>The loop is closed</h1>
          <p style={styles.body}>
            This moment has come full circle.
          </p>
          <button
            onClick={() => navigate('/dashboard/send')}
            style={{
              ...styles.cta,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
              cursor: 'pointer',
              marginBottom: '0.75rem',
            }}
          >
            Send your own Greet-Me
          </button>
          <button onClick={() => navigate('/dashboard')} style={styles.ctaSecondary}>
            Go to Dashboard
          </button>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  // Sender viewing own greeting's credit
  const isSenderViewingOwnCredit =
    credit?.senderUserId &&
    credit.senderUserId === preAuthSnapshot.userId;

  if (isSenderViewingOwnCredit) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>&#10003;</div>
          <h1 style={styles.headline}>The loop is closed</h1>
          <p style={styles.body}>
            This moment has come full circle.
          </p>
          <button
            onClick={() => navigate('/dashboard/send')}
            style={{
              ...styles.cta,
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
              cursor: 'pointer',
              marginBottom: '0.75rem',
            }}
          >
            Send your own Greet-Me
          </button>
          <button onClick={() => navigate('/dashboard')} style={styles.ctaSecondary}>
            Go to Dashboard
          </button>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ maxWidth: '440px', width: '100%', textAlign: 'center' }}>
        <div style={styles.icon}>🎁</div>

        <p style={styles.eyebrow}>A gift from Greet-Me</p>

        {claimed && credit?.consumed ? (
          <>
            <h1 style={styles.headline}>Credit Already Used</h1>
            <p style={styles.body}>
              This {displayAmount} credit has already been applied to a purchase.
            </p>

            {credit?.sourceJobId && !credit?.isOnboardingTestSend && (
              <button
                onClick={() => navigate(`/thank-you?jobId=${credit.sourceJobId}`)}
                style={{ ...styles.cta, marginBottom: '0.75rem' }}
              >
                Send a Thank-You
              </button>
            )}
            <button onClick={() => navigate('/pricing')} style={{ ...styles.cta, marginBottom: '0.75rem' }}>
              View Plans
            </button>
            <button onClick={() => navigate('/dashboard')} style={styles.ctaSecondary}>
              Go to Dashboard
            </button>
          </>
        ) : claimed ? (
          <>
            {credit?.sourceJobId && !credit?.isOnboardingTestSend ? (
              <>
                <h1 style={styles.headline}>You&rsquo;re all set</h1>
                <p style={styles.body}>
                  Your {displayAmount} credit is saved. Now &mdash; send a thank-you back to the person who made your day.
                </p>
                <button
                  onClick={() => navigate(`/thank-you?jobId=${credit.sourceJobId}`)}
                  style={{
                    ...styles.cta,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
                    marginBottom: '0.75rem',
                  }}
                >
                  Send a Thank-You
                </button>
              </>
            ) : (
              <>
                <h1 style={styles.headline}>You&rsquo;re all set</h1>
                <p style={styles.body}>
                  Your {displayAmount} is ready when you are.
                </p>
              </>
            )}
            <button onClick={() => navigate('/pricing')} style={{ ...styles.cta, marginBottom: '0.75rem' }}>
              Plans and Pricing
            </button>
            <button onClick={() => navigate('/dashboard')} style={styles.ctaSecondary}>
              Go to Dashboard
            </button>
          </>
        ) : (
          <>
            <h1 style={styles.headline}>
              You&rsquo;ve received a {displayAmount} Greet-Me credit
            </h1>

            {isReturningUser ? (
              <>
                <h1 style={styles.headline}>Your {displayAmount} is ready</h1>
                <p style={styles.body}>
                  It&rsquo;s ready whenever you are.
                </p>
                <button
                  onClick={() => { sessionStorage.removeItem('greetme_session_mode'); navigate('/dashboard/send'); }}
                  style={{
                    ...styles.cta,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
                    cursor: 'pointer',
                    marginBottom: '0.75rem',
                  }}
                >
                  Send a Greet-Me
                </button>
                <button
                  onClick={() => { sessionStorage.removeItem('greetme_session_mode'); navigate('/dashboard'); }}
                  style={styles.ctaSecondary}
                >
                  Go to Dashboard
                </button>
              </>
            ) : claimInProgress ? (
              <p style={styles.body}>Completing your claim&hellip;</p>
            ) : claimedByOther ? (
              <>
                <h1 style={styles.headline}>This credit was claimed by another account</h1>
                <p style={styles.body}>
                  If you believe this is an error, please contact support.
                </p>
                <button onClick={() => navigate('/pricing')} style={{ ...styles.cta, marginBottom: '0.75rem' }}>
                  View Plans
                </button>
                <button onClick={() => navigate('/dashboard')} style={styles.ctaSecondary}>
                  Go to Dashboard
                </button>
              </>
            ) : isAuthenticated ? (
              <>
                <p style={styles.body}>
                  Your gift is ready. Say thank you, or continue when you&rsquo;re ready.
                </p>
                <button onClick={handleClaim} disabled={claiming} style={{
                  ...styles.cta,
                  background: claiming ? 'rgba(255,255,255,0.5)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  color: 'white',
                  boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
                  cursor: claiming ? 'default' : 'pointer',
                  marginBottom: '0.75rem',
                }}>
                  {claiming ? 'Claiming...' : 'Say Thank You'}
                </button>
                <p style={styles.terms}>
                  Applies to your first Greet-Me subscription.
                </p>
              </>
            ) : prefillLoading ? (
              <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.875rem', margin: '1.5rem 0' }}>
                Preparing your experience&hellip;
              </p>
            ) : isLoginMode ? (
              <>
                <p style={styles.body}>
                  Welcome back. Enter your password to continue.
                </p>
                <div style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  textAlign: 'left',
                }}>
                  {recipientPrefill?.email && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 0.125rem', fontWeight: 600 }}>Email</p>
                      <p style={{ fontSize: '0.9375rem', color: '#fff', margin: 0 }}>{recipientPrefill.email}</p>
                    </div>
                  )}
                  <div>
                    <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 0.125rem', fontWeight: 600 }}>Password</p>
                    <input
                      type="password"
                      value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}
                      placeholder="Your password"
                      style={{
                        width: '100%', padding: '0.625rem 0.75rem',
                        background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)',
                        borderRadius: '8px', color: '#fff', fontSize: '0.9375rem',
                        fontFamily: FONT_STACK, outline: 'none',
                      }}
                    />
                  </div>
                </div>
                {regError && (
                  <p style={{ color: '#fca5a5', fontSize: '0.8125rem', marginBottom: '0.75rem' }}>{regError}</p>
                )}
                <button
                  onClick={handleReturningLogin}
                  disabled={registering}
                  style={{
                    ...styles.cta,
                    background: registering ? 'rgba(255,255,255,0.5)' : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
                    cursor: registering ? 'default' : 'pointer',
                    marginBottom: '0.75rem',
                  }}
                >
                  {registering ? 'Logging in...' : 'Log In'}
                </button>
              </>
            ) : (
              <>
                <p style={styles.body}>
                  Send a quick thank-you to let them know it landed.
                </p>
                <div style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: '12px',
                  padding: '1rem',
                  marginBottom: '1rem',
                  textAlign: 'left',
                }}>
                  {recipientPrefill?.name && (
                    <div style={{ marginBottom: '0.5rem' }}>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 0.125rem', fontWeight: 600 }}>Name</p>
                      <p style={{ fontSize: '0.9375rem', color: '#fff', margin: 0 }}>{recipientPrefill.name}</p>
                    </div>
                  )}
                  {recipientPrefill?.email && (
                    <div>
                      <p style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', margin: '0 0 0.125rem', fontWeight: 600 }}>Email</p>
                      <p style={{ fontSize: '0.9375rem', color: '#fff', margin: 0 }}>{recipientPrefill.email}</p>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => navigate(`/thank-you?jobId=${credit.sourceJobId}&creditCode=${creditCode}`)}
                  style={{
                    ...styles.cta,
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    color: 'white',
                    boxShadow: '0 4px 20px rgba(16, 185, 129, 0.25)',
                    cursor: 'pointer',
                    marginBottom: '0.75rem',
                  }}
                >
                  Say Thank You
                </button>
                <button
                  onClick={() => navigate('/pricing')}
                  style={{
                    ...styles.cta,
                    cursor: 'pointer',
                    marginBottom: '0.75rem',
                  }}
                >
                  Continue
                </button>
              </>
            )}
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
    width: '100%',
  },
  ctaSecondary: {
    display: 'inline-block', padding: '0.875rem 2.5rem',
    background: 'transparent', color: 'rgba(255,255,255,0.7)',
    border: '1px solid rgba(255,255,255,0.3)', borderRadius: '2rem',
    fontSize: '0.9375rem', fontWeight: 600, fontFamily: 'Georgia, serif',
    cursor: 'pointer', boxShadow: 'none',
    width: '100%',
  },
  terms: {
    fontSize: '0.75rem', color: 'rgba(255,255,255,0.3)',
    margin: '2rem 0 0', lineHeight: 1.5,
  },
  footer: {
    fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', margin: '2rem 0 0',
  },
};
