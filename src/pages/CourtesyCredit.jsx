// src/pages/CourtesyCredit.jsx
// Public landing page for courtesy $5 credit from greeting finale
// Route: /courtesy-credit

import { useSearchParams, useNavigate } from 'react-router-dom';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function CourtesyCredit() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const amount = parseInt(searchParams.get('amount') || '5', 10);
  const displayAmount = `$${amount}`;

  const handleApply = () => {
    // Stash credit context so pricing page can read it
    localStorage.setItem('greetme_courtesy_credit', JSON.stringify({
      amount,
      source: 'finale',
      appliedAt: new Date().toISOString(),
    }));
    navigate('/pricing');
  };

  return (
    <div style={{
      minHeight: '100vh',
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
          You&rsquo;ve received {displayAmount} toward your first Greet-Me subscription.
        </h1>

        <p style={{
          fontSize: '0.9375rem',
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.6,
          margin: '0 0 2.5rem',
        }}>
          Apply your credit and start sending unforgettable greetings to the people who matter most.
        </p>

        <button
          onClick={handleApply}
          style={{
            display: 'inline-block',
            padding: '0.875rem 2.5rem',
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
          Apply My {displayAmount} Credit
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
