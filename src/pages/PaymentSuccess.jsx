import { useNavigate } from 'react-router-dom';
import GreetMeLogo from '../components/GreetMeLogo';

export default function PaymentSuccess() {
  const navigate = useNavigate();

  // Read G1G1 gift state from checkout
  const g1g1State = (() => {
    try {
      const stored = sessionStorage.getItem('greetme_g1g1_checkout');
      if (stored) sessionStorage.removeItem('greetme_g1g1_checkout'); // one-time read
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  })();

  const giftSent = g1g1State?.giftSent === true;
  const hasG1G1 = !!g1g1State;

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

        {/* Conditional: gift already sent at checkout */}
        {giftSent ? (
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
        ) : hasG1G1 ? (
          <>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.75rem' }}>
              You&rsquo;re all set &mdash; your gift is ready 🎁
            </h1>
            <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
              Your subscription is active. Send your included subscription gift now or later.
            </p>
            <button onClick={() => navigate('/dashboard/contacts')} style={{ ...btnStyle, marginBottom: '0.75rem' }}>
              Send Your Gift Subscription
            </button>
            <button onClick={() => navigate('/dashboard/send')} style={btnSecondary}>
              Send Your First Greet-Me
            </button>
          </>
        ) : (
          <>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#1a1a2e', margin: '0 0 0.75rem' }}>
              Payment Successful
            </h1>
            <p style={{ fontSize: '1rem', color: '#555', lineHeight: 1.6, margin: '0 0 1.5rem' }}>
              Thank you! Your Greet-Me™ purchase was successful.
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
      </footer>
    </div>
  );
}
