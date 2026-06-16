// src/pages/ResetPassword.jsx
// Reset-password landing flow — handles email-link target /#/reset-password?token=X&email=Y
// Backend endpoint: POST /api/auth/reset-password { token, email, newPassword }

import React, { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import GreetMeLogo from '../components/GreetMeLogo';
import api from '../api/api';

// Must match backend PASSWORD_REGEX (authRoutes.js:16):
// ^(?=.*[A-Z])(?=.*\d).{8,}$ — 8+ chars, >=1 uppercase, >=1 digit
const PASSWORD_REGEX = /^(?=.*[A-Z])(?=.*\d).{8,}$/;

export const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const email = searchParams.get('email');
  const tokenInvalid = !token || !email;

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
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

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (!PASSWORD_REGEX.test(password)) {
      setError('Password must be at least 8 characters and include an uppercase letter and a number.');
      return;
    }

    setLoading(true);
    try {
      await api.request('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ token, email, newPassword: password }),
      });
      setSuccess(true);
    } catch (err) {
      if (err?.code === 'INVALID_TOKEN' || err?.message?.toLowerCase?.().includes('expired')) {
        setError('This reset link has expired or is invalid. Please request a new one.');
      } else if (err?.code === 'WEAK_PASSWORD') {
        setError('Password is too weak. Please choose a stronger password.');
      } else {
        setError(err?.message || 'Could not reset password. Please try again.');
      }
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
  const primaryButton = (isLoading = false) => ({
    width: '100%',
    padding: '0.75rem 1.75rem',
    background: 'var(--primary)',
    color: '#ffffff',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: isLoading ? 'default' : 'pointer',
    opacity: isLoading ? 0.5 : 1,
    transition: 'background 0.2s',
  });
  const footerLink = {
    color: 'var(--primary)',
    fontWeight: 500,
    fontSize: '0.875rem',
    textDecoration: 'none',
  };
  const hoverIn = (e) => { if (!loading) e.currentTarget.style.background = 'var(--primary-dark)'; };
  const hoverOut = (e) => { e.currentTarget.style.background = 'var(--primary)'; };
  const onFocus = (e) => {
    e.currentTarget.style.borderColor = 'var(--primary)';
    e.currentTarget.style.boxShadow = '0 0 0 3px rgba(99, 102, 241, 0.15)';
  };
  const onBlur = (e) => {
    e.currentTarget.style.borderColor = 'var(--border)';
    e.currentTarget.style.boxShadow = 'none';
  };
  const StatusChip = ({ bg, color, icon: Icon }) => (
    <div style={{
      width: '48px', height: '48px', borderRadius: 'var(--radius-full, 9999px)',
      background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 1rem',
    }}>
      <Icon size={26} style={{ color }} />
    </div>
  );

  return (
    <div style={page}>
      <div style={card}>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
            <GreetMeLogo size={isNarrow ? 'medium' : 'large'} clickable={false} />
          </div>

          {tokenInvalid ? (
            <>
              <StatusChip bg="#fef3c7" color="#b45309" icon={AlertTriangle} />
              <h1 style={titleStyle}>This link has expired</h1>
              <p style={subtitleStyle}>For your security, reset links expire after a short time. Request a new one to continue.</p>
            </>
          ) : success ? (
            <>
              <StatusChip bg="#dcfce7" color="#15803d" icon={CheckCircle} />
              <h1 style={titleStyle}>You&rsquo;re all set</h1>
              <p style={subtitleStyle}>Your password has been updated. You can now sign in with your new password.</p>
            </>
          ) : (
            <>
              <h1 style={titleStyle}>Set a new password</h1>
              <p style={subtitleStyle}>Choose a strong password to secure your account.</p>
            </>
          )}
        </div>

        {tokenInvalid ? (
          <Link
            to="/forgot-password"
            style={{ ...primaryButton(false), display: 'block', textAlign: 'center', textDecoration: 'none' }}
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
          >
            Request a new link
          </Link>
        ) : success ? (
          <Link
            to="/login"
            style={{ ...primaryButton(false), display: 'block', textAlign: 'center', textDecoration: 'none' }}
            onMouseEnter={hoverIn}
            onMouseLeave={hoverOut}
          >
            Sign In
          </Link>
        ) : (
          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: '1.25rem' }}>
              <label style={labelStyle}>New password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                onFocus={onFocus}
                onBlur={onBlur}
                required
                autoComplete="new-password"
                autoFocus
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.375rem 0 0' }}>
                At least 8 characters with an uppercase letter and a number
              </p>
            </div>

            <div>
              <label style={labelStyle}>Confirm password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                style={inputStyle}
                onFocus={onFocus}
                onBlur={onBlur}
                required
                autoComplete="new-password"
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
              style={{ ...primaryButton(loading), marginTop: '1.25rem' }}
              onMouseEnter={hoverIn}
              onMouseLeave={hoverOut}
            >
              {loading ? 'Updating…' : 'Update password'}
            </button>
          </form>
        )}

        {!tokenInvalid && !success && (
          <p style={{ textAlign: 'center', marginTop: '1.5rem', marginBottom: 0 }}>
            <Link to="/login" style={footerLink}>Back to sign in</Link>
          </p>
        )}
      </div>
    </div>
  );
};

export default ResetPassword;
