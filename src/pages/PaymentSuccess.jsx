import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import cartService from '../services/cartService';
import GreetMeLogo from '../components/GreetMeLogo';

// Phase 3D Batch A — A2.4: parse query from a HashRouter URL like
//   "#/payment/success?session_id=...&sendDraftId=..."
// Inline helper kept local — not a routing abstraction change.
function parseHashQuery(hash) {
  if (!hash || typeof hash !== 'string') return new URLSearchParams('');
  const q = hash.indexOf('?');
  if (q < 0) return new URLSearchParams('');
  return new URLSearchParams(hash.slice(q + 1));
}

// Phase 3D Batch A — A2.4: brief success flash for the resume happy path.
// No copy, no spinner — minimal-dwell visual that bridges Stripe close
// and SendGreeting re-mount. Founder-locked: <100ms target.
function ResumeSuccessFlash() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    }}>
      <div style={{
        width: '64px',
        height: '64px',
        borderRadius: '50%',
        background: '#22c55e',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '2rem',
        color: 'white',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      }}>
        ✓
      </div>
    </div>
  );
}

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [g1g1State, setG1g1State] = useState(null);
  const [g1g1Loading, setG1g1Loading] = useState(true);

  // Phase 3D Batch A — A2.4: send-flow resume routing state.
  // null         → standard payment-success path (existing four G1G1 states)
  // 'fast-resume'→ brief check visual + navigate to /dashboard/send
  // 'fallback'   → unified "Payment received" generic state (token lost/expired/corrupt)
  const [resumeStatus, setResumeStatus] = useState(null);

  // Phase 3D Batch A — A2.4: read sendDraftId from URL; if present and a valid
  // non-expired resume entry exists in localStorage, fast-redirect to
  // /dashboard/send so the resume effect there completes the dispatch.
  // Otherwise render the unified fallback. Runs synchronously on mount.
  useEffect(() => {
    const params = parseHashQuery(window.location.hash);
    const sendDraftId = params.get('sendDraftId');
    if (!sendDraftId) return;

    let parsed = null;
    try {
      const raw = localStorage.getItem(`greetme_send_resume_${sendDraftId}`);
      if (raw) parsed = JSON.parse(raw);
    } catch { /* fall through to fallback */ }

    const isValid = parsed && parsed.expiresAt && Date.now() <= new Date(parsed.expiresAt).getTime();

    if (!isValid) {
      // Stale/missing/corrupt — clean up if expired, render unified fallback.
      if (parsed) {
        try { localStorage.removeItem(`greetme_send_resume_${sendDraftId}`); } catch {}
      }
      setResumeStatus('fallback');
      return;
    }

    // Happy path: brief visual + replace navigate so back-button skips this page.
    setResumeStatus('fast-resume');
    navigate(`/dashboard/send?resumeDraft=${sendDraftId}`, { replace: true });
  }, []);

  // Backend is the ONLY source of truth for G1G1 state
  useEffect(() => {
    (async () => {
      if (user?.id) {
        try {
          const res = await api.get(`/api/payments/g1g1-status`);
          if (res?.ok && res.g1g1) {
            setG1g1State(res.g1g1);
          }
        } catch (err) {
          console.error('[Success] G1G1 status check failed:', err.message || err);
        }
      }
      setG1g1Loading(false);
    })();
  }, [user?.id]);

  // Clean up stale sessionStorage (no longer used as source of truth)
  useEffect(() => {
    sessionStorage.removeItem('greetme_g1g1_checkout');
    // Courtesy credit was consumed by the backend when the Stripe session was created.
    // Clear the client-side stash so it isn't offered again on the next purchase.
    localStorage.removeItem('greetme_courtesy_credit');
    // Phase 3C Stage 3 — clear merch from cart only after confirmed payment.
    // Targeted clear preserves existing subscription cart behavior.
    if (cartService.hasMerch()) {
      cartService.clearMerch();
      window.dispatchEvent(new Event('cartUpdated'));
    }
  }, []);

  const hasG1G1 = g1g1State?.eligible === true;
  const giftSent = hasG1G1 && g1g1State?.giftSent === true;
  const giftPending = hasG1G1 && !giftSent;

  const btnStyle = {
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    padding: '0.875rem 2rem',
    fontSize: '1rem',
    fontWeight: 600,
    cursor: 'pointer',
    width: '100%',
    fontFamily: 'inherit',
  };

  const btnSecondary = {
    ...btnStyle,
    background: 'transparent',
    color: '#667eea',
    border: '2px solid #667eea',
  };

  // Phase 3D Batch A — A2.4: render guards for resume routing.
  // fast-resume — minimal-dwell check while navigate() takes effect.
  // fallback    — unified generic "Payment received" state, no technical detail.
  if (resumeStatus === 'fast-resume') {
    return <ResumeSuccessFlash />;
  }
  if (resumeStatus === 'fallback') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, sans-serif'
      }}>
        <div style={{
          background: 'white',
          borderRadius: '16px',
          padding: '2.5rem 2rem',
          maxWidth: '480px',
          width: '100%',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
        }}>
          <GreetMeLogo size="medium" clickable={false} />
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: '#22c55e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '1.5rem auto',
            fontSize: '2rem',
            color: 'white'
          }}>
            ✓
          </div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.75rem' }}>
            Payment received
          </h1>
          <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
            Your payment was successful. We&rsquo;re finalizing your Greet-Me now and will follow up shortly.
          </p>
          <button
            onClick={() => navigate('/dashboard')}
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              padding: '0.875rem 2rem',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: 'pointer',
              width: '100%',
              fontFamily: 'inherit',
            }}
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '2rem',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      <div style={{
        background: 'white',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
        boxShadow: '0 20px 60px rgba(0,0,0,0.3)'
      }}>
        <GreetMeLogo size="medium" clickable={false} />

        <div style={{
          width: '64px',
          height: '64px',
          borderRadius: '50%',
          background: '#22c55e',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '1.5rem auto',
          fontSize: '2rem',
          color: 'white'
        }}>
          ✓
        </div>

        {/* State 1: Gift sent at checkout */}
        {giftSent && (
          <>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.75rem' }}>
              Your gift has been sent 🎉
            </h1>
            <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
              Your subscription is active, and your included gift subscription has been delivered.
            </p>
            <button onClick={() => navigate('/dashboard/send')} style={btnStyle}>
              Send Your First Greet-Me
            </button>
          </>
        )}

        {/* State 2: Gift pending (send later or no recipient yet) */}
        {giftPending && (
          <>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.75rem' }}>
              You&rsquo;re all set &mdash; your gift is ready 🎁
            </h1>
            <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.6, margin: '0 0 1rem' }}>
              Your subscription is active. We&rsquo;ve emailed you the gift link. You can also share it now:
            </p>
            {g1g1State?.giftCode && (
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '1rem', marginBottom: '1.25rem', textAlign: 'left' }}>
                <p style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#166534', margin: '0 0 0.5rem' }}>Your gift link:</p>
                <a href={`/#/gift/g1g1/${g1g1State.giftCode}`} style={{ fontSize: '0.875rem', color: '#4F2D7F', wordBreak: 'break-all' }}>
                  {`${window.location.origin}/#/gift/g1g1/${g1g1State.giftCode}`}
                </a>
                <button
                  onClick={() => { navigator.clipboard?.writeText(`${window.location.origin}/#/gift/g1g1/${g1g1State.giftCode}`).catch(() => {}); }}
                  style={{ display: 'block', marginTop: '0.5rem', background: 'none', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '0.375rem 0.75rem', fontSize: '0.75rem', color: '#166534', cursor: 'pointer', fontFamily: 'inherit' }}
                >
                  Copy Link
                </button>
              </div>
            )}
            <button onClick={() => navigate('/dashboard/send')} style={btnStyle}>
              Send Your First Greet-Me
            </button>
          </>
        )}

        {/* State 3: Still checking G1G1 status */}
        {g1g1Loading && !hasG1G1 && (
          <>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.75rem' }}>
              Payment Successful
            </h1>
            <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
              Processing your gift&hellip;
            </p>
          </>
        )}

        {/* State 4: No G1G1 (credit used or non-subscription) */}
        {!g1g1Loading && !hasG1G1 && (
          <>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.75rem' }}>
              Payment Successful
            </h1>
            <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
              Thank you! Your Greet-Me&trade; purchase was successful.
            </p>
            <button onClick={() => navigate('/dashboard')} style={btnStyle}>
              Go to Dashboard
            </button>
          </>
        )}
      </div>

      <footer style={{
        marginTop: '2rem',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '0.8125rem',
        textAlign: 'center'
      }}>
        <p>&copy; 2026 Greet-Me&trade;. All rights reserved. | Forget Them Not!&trade;</p>
        <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'rgba(255,255,255,0.7)' }}>
          <a href="#/support" style={{ color: 'inherit', textDecoration: 'underline' }}>Support</a>
          {' · '}
          <a href="#/legal#privacy" style={{ color: 'inherit', textDecoration: 'underline' }}>Privacy</a>
          {' · '}
          <a href="#/legal#terms" style={{ color: 'inherit', textDecoration: 'underline' }}>Terms</a>
        </p>
      </footer>
    </div>
  );
}
