// src/pages/ForgotPassword.jsx
import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import GreetMeLogo from '../components/GreetMeLogo';
import api from '../api/api';

export const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' && window.innerWidth <= 768);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await api.request('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      setSent(true);
    } catch (err) {
      setError(err?.message || 'Could not send reset email. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // --- Premium auth shell (token-based, Settings family) ---
  const page = {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
  };
  const card = {
    width: '100%',
    maxWidth: '440px',
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius-xl)',
    boxShadow: '0 8px 24px rgba(99, 102, 241, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06)',
    padding: isNarrow ? '2rem 1.5rem' : '2.5rem 2rem',
  };
  const titleStyle = {
    fontSize: isNarrow ? '1.5rem' : '1.75rem',
    fontWeight: 700,
    color: 'var(--text-primary)',
    margin: '0 0 0.5rem',
  };
  const subtitleStyle = {
    fontSize: '0.9375rem',
    color: 'var(--text-secondary)',
    lineHeight: 1.5,
    margin: 0,
  };
  const labelStyle = {
    display: 'block',
    fontSize: '0.875rem',
    fontWeight: 500,
    color: 'var(--text-primary)',
    marginBottom: '0.375rem',
  };
  const inputStyle = {
    width: '100%',
    padding: '0.75rem 1rem',
    fontSize: '16px',
    color: 'var(--text-primary)',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    outline: 'none',
    boxSizing: 'border-box',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  };
  const primaryButton = {
    width: '100%',
    padding: '0.75rem 1.75rem',
    background: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: loading ? 'default' : 'pointer',
    opacity: loading ? 0.5 : 1,
    transition: 'background 0.2s',
    marginTop: '1.25rem',
  };
  const footerLink = {
    color: 'var(--primary)',
    fontWeight: 500,
    fontSize: '0.875rem',
    textDecoration: 'none',
  };
  const onFocus = (e) => {
    e.currentTarget.style.borderColor = 'var(--primary)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.15)';
  };
  const onBlur = (e) => {
    e.currentTarget.style.borderColor = 'var(--border)';
    e.currentTarget.style.boxShadow = 'none';
  };

  return (
    <div style={page}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <GreetMeLogo size={isNarrow ? 'medium' : 'large'} clickable={false} />
          </div>
          {sent ? (
            <>
              <div style={{
                width: '48px', height: '48px', borderRadius: 'var(--radius-full, 9999px)',
                background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <CheckCircle size={26} style={{ color: '#15803d' }} />
              </div>
              <h1 style={titleStyle}>Check your inbox</h1>
            </>
          ) : (
            <>
              <h1 style={titleStyle}>Forgot your password?</h1>
              <p style={subtitleStyle}>Enter your email and we&rsquo;ll send you a secure reset link.</p>
            </>
          )}
        </div>

        {sent ? (
          <p style={{ ...subtitleStyle, textAlign: 'center' }}>
            If an account exists for{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>, a password reset link is on its way.
            It expires shortly for your security.
          </p>
        ) : (
          <form onSubmit={handleSubmit}>
            <div>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={inputStyle}
                onFocus={onFocus}
                onBlur={onBlur}
                required
              />
            </div>

            {error && (
              <div style={{
                marginTop: '1rem', padding: '0.75rem 1rem', fontSize: '0.875rem',
                color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca',
                borderRadius: 'var(--radius-md)',
              }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              style={primaryButton}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'var(--primary-dark)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary)'; }}
            >
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        )}

        <p style={{ textAlign: 'center', marginTop: '1.5rem', marginBottom: 0 }}>
          <Link to="/login" style={footerLink}>Back to sign in</Link>
        </p>
      </div>
    </div>
  );
};

export default ForgotPassword;
