// src/pages/CourtesyCredit.jsx
// Legacy informational landing page. Route: /courtesy-credit
//
// CREDIT CONTRACT INTEGRITY (2026-09-30, display-honesty correction) — this page used to read
// an `amount` query parameter straight from the URL and stash it, unverified, into the same
// `greetme_courtesy_credit` localStorage key Checkout.jsx reads for its order-summary display.
// Every real claim path (CreditClaim.jsx, ThankYouFlow.jsx) always writes a backend-issued
// `creditCode` alongside the amount; this page never had one to offer, so it could only ever
// fabricate an apparent credit. Confirmed unreachable from any live in-app link today
// (FinaleSpread.jsx no longer points here) — kept only as an honest landing point for anyone
// who has bookmarked or directly visits the old URL. It no longer parses or displays any
// dollar amount, and no longer writes to localStorage at all.
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useAccountState } from '../hooks/useAccountState';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function CourtesyCredit() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const accountState = useAccountState();

  const handlePrimary = () => {
    if (accountState.isSubscribed) {
      navigate('/dashboard');
    } else if (isAuthenticated) {
      navigate('/dashboard/send');
    } else {
      navigate('/register', { state: { returnTo: '/dashboard/send' } });
    }
  };

  const handleThankYou = () => {
    // ThankYouFlow is public — handles its own auth
    const sourceJobId = searchParams.get('jobId');
    if (sourceJobId) {
      navigate(`/thank-you?jobId=${sourceJobId}`);
    } else if (isAuthenticated) {
      navigate('/dashboard/send');
    } else {
      navigate('/register', { state: { returnTo: '/dashboard/send' } });
    }
  };

  return (
    <div className="gm-min-h-screen" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'linear-gradient(160deg, #1B2A4A 0%, #2d1b4e 40%, #1B2A4A 100%)',
      padding: '2rem 1.5rem',
      fontFamily: FONT_STACK,
    }}>
      <div style={{
        maxWidth: '440px',
        width: '100%',
        textAlign: 'center',
      }}>
        {/* Gift icon */}
        <div style={{
          width: '4.5rem',
          height: '4.5rem',
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.15)',
          border: '2px solid rgba(16, 185, 129, 0.4)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 2rem',
          fontSize: '2rem',
        }}>
          🎁
        </div>

        <p style={{
          fontSize: '0.875rem',
          color: 'rgba(255,255,255,0.5)',
          letterSpacing: '0.15em',
          textTransform: 'uppercase',
          margin: '0 0 0.75rem',
        }}>
          A gift from Greet-Me
        </p>

        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 500,
          color: '#fff',
          lineHeight: 1.4,
          margin: '0 0 1rem',
          fontFamily: 'Georgia, serif',
        }}>
          Thanks for stopping by Greet-Me.
        </h1>

        <p style={{
          fontSize: '0.9375rem',
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.6,
          margin: '0 0 2.5rem',
        }}>
          Any Greet-Me Credit on your account is verified automatically and applied at checkout —
          there&rsquo;s nothing to claim manually here. Go to your account to see your current
          plan and credits.
        </p>

        {/* Primary CTA */}
        <button
          onClick={handlePrimary}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: '340px',
            margin: '0 auto 0.75rem',
            padding: '0.875rem 2rem',
            background: '#fff',
            color: '#1B2A4A',
            border: 'none',
            borderRadius: '2rem',
            fontSize: '1.0625rem',
            fontWeight: 600,
            fontFamily: 'Georgia, serif',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(255,255,255,0.15)',
          }}
        >
          {isAuthenticated ? 'Go to Your Account' : 'Create Your Account'}
        </button>

        {/* Smart loop: Thank You */}
        <button
          onClick={handleThankYou}
          style={{
            display: 'block',
            width: '100%',
            maxWidth: '340px',
            margin: '0 auto',
            padding: '0.75rem 2rem',
            background: 'rgba(255,255,255,0.12)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '2rem',
            fontSize: '0.9375rem',
            fontWeight: 600,
            fontFamily: 'Georgia, serif',
            cursor: 'pointer',
          }}
        >
          Send a Thank You Greet-Me
        </button>

        <p style={{
          fontSize: '0.75rem',
          color: 'rgba(255,255,255,0.3)',
          margin: '2rem 0 0',
          lineHeight: 1.5,
        }}>
          Valid toward Social Butterfly or higher plans. Terms apply.
        </p>

        <p style={{ fontSize: '0.7rem', color: 'rgba(255,255,255,0.15)', margin: '2rem 0 0' }}>
          &copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;
        </p>
      </div>
    </div>
  );
}
