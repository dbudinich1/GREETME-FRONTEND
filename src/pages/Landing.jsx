// src/pages/Landing.jsx
// Public entry screen for unauthenticated users; redirects logged-in users to dashboard

import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GreetMeLogo from '../components/GreetMeLogo';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3f0' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (isAuthenticated) return null; // redirect handles it

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f5f3f0 0%, #ede9e3 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1.5rem',
      fontFamily: FONT,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '2rem' }}>
        <GreetMeLogo />
      </div>

      {/* Card */}
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: '#fff',
        borderRadius: '16px',
        padding: '2.5rem 2rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontSize: '1.75rem',
          fontWeight: 700,
          color: '#1f2937',
          lineHeight: 1.3,
          margin: '0 0 1rem',
        }}>
          Your voice. Their moment.<br />Delivered automatically.
        </h1>

        <p style={{
          fontSize: '1rem',
          color: '#6b7280',
          lineHeight: 1.6,
          margin: '0 0 2rem',
        }}>
          Create personalized greeting cards and gifts using your voice
          and photo&mdash;and send them automatically for every occasion that matters.
        </p>

        {/* Primary CTA */}
        <button
          onClick={() => navigate('/register')}
          style={{
            width: '100%',
            padding: '1rem',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1.125rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: FONT,
            transition: 'transform 0.15s, box-shadow 0.15s',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.45)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.35)'; }}
        >
          Test My Greet-Me
        </button>

        <p style={{
          fontSize: '0.8125rem',
          color: '#9ca3af',
          margin: '0.75rem 0 0',
          fontStyle: 'italic',
        }}>
          Takes less than a minute. No commitment.
        </p>

        {/* Guest benefit note */}
        <div style={{
          marginTop: '1.5rem',
          padding: '1rem',
          background: '#f0fdf4',
          borderRadius: '10px',
          border: '1px solid #bbf7d0',
        }}>
          <p style={{
            fontSize: '0.9375rem',
            fontWeight: 600,
            color: '#166534',
            margin: '0 0 0.375rem',
          }}>
            Guest accounts include 3 free sends.
          </p>
          <p style={{
            fontSize: '0.75rem',
            color: '#4ade80',
            margin: 0,
          }}>
            Your onboarding test Greet-Me is free and does not count against them.
          </p>
        </div>
      </div>

      {/* Existing account link */}
      <p style={{
        marginTop: '1.5rem',
        fontSize: '0.875rem',
        color: '#6b7280',
      }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>

      {/* Footer */}
      <p style={{
        marginTop: '2rem',
        fontSize: '0.75rem',
        color: '#9ca3af',
      }}>
        &copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;
      </p>
    </div>
  );
}
