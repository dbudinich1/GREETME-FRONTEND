// src/pages/ReferralCredit.jsx
// Public landing page for referral credit redemption
// Route: /credit/:referralCode

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';

const FONT_STACK = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

export default function ReferralCredit() {
  const { referralCode } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [loading, setLoading] = useState(true);
  const [valid, setValid] = useState(false);
  const [error, setError] = useState(null);
  const [creditCents, setCreditCents] = useState(null);

  useEffect(() => {
    if (!referralCode) {
      setError('Invalid referral link.');
      setLoading(false);
      return;
    }

    // Stash referral code immediately so it survives auth transition
    localStorage.setItem('greetme_referral_code', referralCode);

    api.getReferral(referralCode)
      .then((res) => {
        if (res?.ok && res.referralCreditCents) {
          setValid(true);
          setCreditCents(res.referralCreditCents);
        } else {
          setError('This referral credit is no longer valid.');
        }
      })
      .catch((err) => {
        if (err?.code === 'REFERRAL_ALREADY_USED') {
          setError('This referral credit has already been used.');
        } else {
          setError('This referral credit is not valid.');
        }
      })
      .finally(() => setLoading(false));
  }, [referralCode]);

  // If already authenticated, skip landing and go straight to send with referral
  useEffect(() => {
    if (isAuthenticated && valid) {
      navigate(`/dashboard/send?referral=${referralCode}`, { replace: true });
    }
  }, [isAuthenticated, valid, referralCode, navigate]);

  const fmt = (cents) => `$${(cents / 100).toFixed(0)}`;

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: 'center', color: '#065f46' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>&#127873;</div>
          <p style={{ fontSize: '1rem', fontFamily: FONT_STACK }}>Validating your credit...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={styles.card}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>&#128566;</div>
          <h1 style={styles.title}>Credit Unavailable</h1>
          <p style={styles.subtitle}>{error}</p>
          <a href="/#/login" style={styles.linkBtn}>Back to Greet-Me</a>
          <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.successIcon}>&#127873;</div>

        <h1 style={{ ...styles.title, fontSize: '1.625rem' }}>
          You've unlocked a {creditCents ? fmt(creditCents) : '$10'} credit
        </h1>

        <p style={{
          fontSize: '0.95rem',
          color: '#374151',
          lineHeight: 1.6,
          margin: '0 0 0.5rem',
        }}>
          Apply your {creditCents ? fmt(creditCents) : '$10'} credit toward a Greet-Me subscription.
        </p>
        <p style={{
          fontSize: '0.8125rem',
          color: '#6b7280',
          margin: '0 0 1.5rem',
        }}>
          Valid toward Social Butterfly or higher plans. Terms apply.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <a href="/#/login" style={styles.primaryBtn}>
            Log In to Apply Credit
          </a>
          <a href="/#/register" style={styles.secondaryBtn}>
            Create an Account
          </a>
        </div>

        <p style={{
          fontSize: '0.75rem',
          color: '#9ca3af',
          lineHeight: 1.5,
          margin: '1.25rem 0 0',
        }}>
          Credit is not cash and cannot be withdrawn or transferred. One-time use only.
        </p>

        <p style={styles.footer}>&copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;</p>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 50%, #f0fdf4 100%)',
    padding: '1.5rem',
    fontFamily: FONT_STACK,
  },
  card: {
    maxWidth: '420px',
    width: '100%',
    background: '#fff',
    borderRadius: '1rem',
    padding: '2rem',
    textAlign: 'center',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.08), 0 2px 8px rgba(0, 0, 0, 0.04)',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 700,
    color: '#1f2937',
    margin: '0 0 0.75rem',
  },
  subtitle: {
    fontSize: '1rem',
    color: '#6b7280',
    lineHeight: 1.6,
    margin: '0 0 1.5rem',
  },
  footer: {
    fontSize: '0.75rem',
    color: '#b0b0b0',
    margin: '1.5rem 0 0',
  },
  successIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  primaryBtn: {
    display: 'block',
    padding: '0.875rem',
    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
    color: '#fff',
    borderRadius: '0.5rem',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '1rem',
    fontFamily: FONT_STACK,
    boxShadow: '0 2px 6px rgba(16, 185, 129, 0.3)',
    textAlign: 'center',
  },
  secondaryBtn: {
    display: 'block',
    padding: '0.875rem',
    background: '#fff',
    color: '#059669',
    borderRadius: '0.5rem',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '1rem',
    fontFamily: FONT_STACK,
    border: '2px solid #10b981',
    textAlign: 'center',
  },
  linkBtn: {
    display: 'inline-block',
    padding: '0.625rem 1.5rem',
    background: '#3A7BD5',
    color: '#fff',
    borderRadius: '0.5rem',
    fontWeight: 600,
    textDecoration: 'none',
    fontSize: '0.9375rem',
    fontFamily: FONT_STACK,
  },
};
