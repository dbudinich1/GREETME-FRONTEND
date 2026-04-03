import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import GreetMeLogo from '../components/GreetMeLogo';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [g1g1State, setG1g1State] = useState(null);
  const [loaded, setLoaded] = useState(false);

  // Try backend first (entitlement doc), fall back to sessionStorage
  useEffect(() => {
    (async () => {
      // 1. Try reading G1G1 state from backend entitlements
      if (user?.id) {
        try {
          const res = await api.get(`/api/payments/g1g1-status`);
          if (res?.ok && res.g1g1) {
            console.log('[Success] G1G1 from backend:', res.g1g1);
            setG1g1State(res.g1g1);
            setLoaded(true);
            return;
          }
        } catch { /* fall through to sessionStorage */ }
      }

      // 2. Fall back to sessionStorage
      try {
        const stored = JSON.parse(sessionStorage.getItem('greetme_g1g1_checkout') || 'null');
        if (stored) {
          console.log('[Success] G1G1 from session:', stored);
          setG1g1State({
            eligible: stored.eligible,
            giftSent: stored.eligible && stored.recipientName && stored.recipientEmail && !stored.sendLater,
          });
        }
      } catch {}
      setLoaded(true);
    })();
  }, [user?.id]);

  // Clean up session after load
  useEffect(() => {
    return () => { sessionStorage.removeItem('greetme_g1g1_checkout'); };
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
        )}

        {/* State 3: No G1G1 (credit used or non-subscription) */}
        {!hasG1G1 && (
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
      </footer>
    </div>
  );
}
