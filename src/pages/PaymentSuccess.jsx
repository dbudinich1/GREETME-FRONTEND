import { useNavigate } from 'react-router-dom';
import GreetMeLogo from '../components/GreetMeLogo';

export default function PaymentSuccess() {
  const navigate = useNavigate();
  const params = new URLSearchParams(window.location.search);
  const sessionId = params.get('session_id');

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
        padding: '3rem 2.5rem',
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

        <h1 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: '#1a1a2e',
          margin: '0 0 0.75rem 0'
        }}>
          Payment Successful
        </h1>

        <p style={{
          fontSize: '1rem',
          color: '#555',
          lineHeight: 1.6,
          margin: '0 0 1.5rem 0'
        }}>
          Thank you! Your Greet-Me™ subscription is active.
        </p>

        {sessionId && (
          <p style={{
            fontSize: '0.75rem',
            color: '#999',
            fontFamily: 'monospace',
            wordBreak: 'break-all',
            margin: '0 0 1.5rem 0'
          }}>
            Session: {sessionId}
          </p>
        )}

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
            width: '100%'
          }}
        >
          Go to Dashboard
        </button>
      </div>

      <footer style={{
        marginTop: '2rem',
        color: 'rgba(255,255,255,0.7)',
        fontSize: '0.8125rem',
        textAlign: 'center'
      }}>
        <p>&copy; 2026 Greet-Me™. All rights reserved. | Forget Them Not!™</p>
      </footer>
    </div>
  );
}
