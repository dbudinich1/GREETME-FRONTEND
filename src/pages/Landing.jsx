// src/pages/Landing.jsx
// Public entry screen for unauthenticated users; redirects logged-in users to dashboard

import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GreetMeLogo from '../components/GreetMeLogo';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  const [demoMuted, setDemoMuted] = useState(true);
  const demoRef = useRef(null);

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

  if (isAuthenticated) return null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f5f3f0 0%, #ede9e3 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem 1.5rem',
      fontFamily: FONT,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '1.5rem' }}>
        <GreetMeLogo />
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: '2rem',
        fontWeight: 700,
        color: '#1f2937',
        lineHeight: 1.3,
        margin: '0 0 0.75rem',
        textAlign: 'center',
        maxWidth: '640px',
      }}>
        Your voice. Their moment.<br />Delivered automatically.
      </h1>

      {/* Updated subheadline */}
      <p style={{
        fontSize: '1rem',
        color: '#6b7280',
        lineHeight: 1.6,
        margin: '0 0 1.5rem',
        textAlign: 'center',
        maxWidth: '580px',
      }}>
        Create premium personalized greetings using your voice and photo&mdash;send one to everyone
        on your list automatically with a thoughtful gift for every occasion that matters.
      </p>

      {/* Demo video — large, central */}
      <div style={{
        width: '100%',
        maxWidth: '720px',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
        background: '#000',
        marginBottom: '1.5rem',
        position: 'relative',
        cursor: demoMuted ? 'pointer' : 'default',
      }}
        onClick={() => {
          if (demoMuted && demoRef.current) {
            demoRef.current.muted = false;
            setDemoMuted(false);
          }
        }}
      >
        <video
          ref={demoRef}
          src="/assets/demo/greetme-demo.mp4"
          autoPlay
          muted
          playsInline
          loop
          style={{ width: '100%', display: 'block' }}
        />
        {demoMuted && (
          <div style={{
            position: 'absolute',
            bottom: '0.75rem',
            right: '0.75rem',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            borderRadius: '2rem',
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            backdropFilter: 'blur(4px)',
          }}>
            🔇 Tap for sound
          </div>
        )}
      </div>

      {/* CTA card */}
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: '#fff',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        textAlign: 'center',
      }}>
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
          Test a Greet-Me
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
          marginTop: '1.25rem',
          padding: '0.875rem',
          background: '#f0fdf4',
          borderRadius: '10px',
          border: '1px solid #bbf7d0',
        }}>
          <p style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#166534',
            margin: '0 0 0.25rem',
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
        marginTop: '1.25rem',
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
        marginTop: '1.5rem',
        fontSize: '0.75rem',
        color: '#9ca3af',
      }}>
        &copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;
      </p>
    </div>
  );
}
