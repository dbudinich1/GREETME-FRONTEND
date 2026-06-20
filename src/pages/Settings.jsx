// src/pages/Settings.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Lock, CreditCard, Database, Gift, ChevronRight, Download, Trash2, Key } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../api/api';
import { getErrorMessage } from '../utils/errorMessages';

const TIER_DISPLAY = {
  free: 'Free',
  basic: 'Basic',
  close_circle: 'Close Circle',
  social_butterfly: 'Social Butterfly',
  unforgettable: 'Legend™', // display name only — real backend key stays 'unforgettable'
  pro: 'Pro',
  premium: 'Premium',
  unlimited: 'Unlimited',
  small_business: 'Small Business',
  medium_business: 'Medium Business',
  enterprise: 'Enterprise',
  founder: 'Founder',
};

// Presentation-only banner descriptor (one line, per-plan; static fallback for any other plan).
const PLAN_DESCRIPTOR = {
  free: 'Get started with meaningful giving.',
  close_circle: 'Designed for close friends and family.',
  social_butterfly: 'Never miss an important occasion.',
  unforgettable: 'Your complete relationship-building membership.',
};
const FALLBACK_DESCRIPTOR = 'Built for meaningful relationships.';

// Presentation-only status pill labels + colors. Backend subscriptionStatus mappings untouched.
const PILL = {
  active:   { label: 'Active',           dot: '#16a34a', text: '#15803d', bg: '#dcfce7' },
  past_due: { label: 'Attention Needed', dot: '#d97706', text: '#b45309', bg: '#fef3c7' },
  canceled: { label: 'Inactive',         dot: '#9ca3af', text: '#6b7280', bg: '#f3f4f6' },
  refunded: { label: 'Inactive',         dot: '#9ca3af', text: '#6b7280', bg: '#f3f4f6' },
};

function g1g1Label(g) {
  if (!g) return 'No gift pending';
  if (g.status === 'paused') return 'Not Included';
  if (g.status === 'failed') return 'Ready to Gift';
  if (g.status === 'created') return g.giftSent ? 'Gift Shared' : 'Ready to Gift';
  return 'Not Included';
}

export default function Settings() {
  const { user, refreshProfile } = useAuth();
  const navigate = useNavigate();
  const firstName = user?.name?.split(' ')[0] || 'there';
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState(null);
  const [g1g1, setG1g1] = useState(undefined);
  const [isNarrow, setIsNarrow] = useState(typeof window !== 'undefined' && window.innerWidth <= 768);
  // Live Greet-Me send wallet (read-only GET /api/wallet). Display only — never
  // fabricates: shows "—"/loading until loaded, a muted line on error.
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState(false);

  useEffect(() => {
    const onResize = () => setIsNarrow(window.innerWidth <= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // Self-refresh entitlement state from /api/profile on mount so Settings never
  // renders a stale in-memory plan/status (e.g. right after a G1G1 claim).
  useEffect(() => {
    refreshProfile?.().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const planKey = user?.tier || user?.plan || 'free';
  const tierLabel = TIER_DISPLAY[planKey] || (planKey === 'free' ? 'Free' : 'Active Plan');
  const descriptor = PLAN_DESCRIPTOR[planKey] || FALLBACK_DESCRIPTOR;
  const pill = PILL[user?.subscriptionStatus] || {
    label: planKey === 'free' ? 'Free' : 'Active',
    dot: '#6366f1', text: '#4f46e5', bg: '#eef2ff',
  };

  useEffect(() => {
    let alive = true;
    api.get('/api/payments/g1g1-status')
      .then((res) => { if (alive) setG1g1(res?.g1g1 ?? null); })
      .catch(() => { if (alive) setG1g1(null); });
    return () => { alive = false; };
  }, []);

  // Mount-fetch the live send wallet (separate from refreshProfile + g1g1-status).
  useEffect(() => {
    let alive = true;
    api.get('/api/wallet')
      .then((res) => {
        if (!alive) return;
        if (res?.ok && res.wallet) { setWallet(res.wallet); setWalletError(false); }
        else { setWalletError(true); }
      })
      .catch(() => { if (alive) setWalletError(true); })
      .finally(() => { if (alive) setWalletLoading(false); });
    return () => { alive = false; };
  }, []);

  const handleManageBilling = async () => {
    setBillingLoading(true);
    setBillingError(null);
    try {
      const data = await api.post('/api/payments/portal-session');
      if (data?.url) {
        window.location.href = data.url;
      } else {
        setBillingError('Unable to open billing portal. Please try again.');
      }
    } catch (err) {
      setBillingError(getErrorMessage(err));
    } finally {
      setBillingLoading(false);
    }
  };

  const hasBillingRelationship =
    ['active', 'past_due', 'canceled', 'trialing'].includes(user?.subscriptionStatus) ||
    user?.paymentLocked === true;

  // --- Shared token-based styles ---
  const card = (hero = false) => ({
    background: 'var(--bg-primary)',
    borderRadius: 'var(--radius-xl)',
    border: '1px solid var(--border)',
    boxShadow: hero ? '0 8px 24px rgba(99, 102, 241, 0.12)' : '0 1px 2px rgba(0, 0, 0, 0.04)',
    padding: isNarrow ? '1.25rem' : '1.75rem',
  });
  const cardHeader = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.75rem',
    marginBottom: '1.25rem',
  };
  const cardTitle = {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0,
  };
  const gridLabel = {
    fontSize: '0.6875rem',
    fontWeight: 700,
    letterSpacing: '0.05em',
    textTransform: 'uppercase',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginBottom: '0.25rem',
  };
  const gridValue = {
    fontSize: '0.9375rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
  };

  // Membership detail columns (G1G1 column hidden while g1g1 is still loading).
  const detailCols = [
    { label: 'CURRENT PLAN', value: tierLabel },
    { label: 'STATUS', value: pill.label },
  ];
  if (g1g1 !== undefined) {
    detailCols.push({ label: 'GREET ONE, GIVE ONE™', value: g1g1Label(g1g1), icon: Gift });
  }

  // SEND BALANCE cells — live /api/wallet values only (no caps fallback, no mock).
  const w = wallet;
  let sendCells = [
    { label: 'TOTAL SPENDABLE NOW', value: '—' },
    { label: 'MONTHLY', value: '—' },
    { label: 'ANYTIME', value: '—' },
    { label: 'BANKED', value: '—' },
  ];
  if (w) {
    sendCells = [
      { label: 'TOTAL SPENDABLE NOW', value: w.unmetered ? 'Unlimited' : w.totalSpendableNow },
      { label: 'MONTHLY', value: w.unmetered ? 'Unlimited' : `${w.monthly.remaining} of ${w.monthly.cap}` },
      { label: 'ANYTIME', value: `${w.anytime.available}`, sub: `${w.anytime.includedCap} included` },
      { label: 'BANKED', value: w.banked.cap > 0 ? `${w.banked.available} of ${w.banked.cap}` : '0' },
    ];
    if (w.purchased?.animationCredits > 0) {
      sendCells.push({ label: 'PURCHASED', value: `${w.purchased.animationCredits}`, sub: w.purchased.spendable === true ? 'Available to send after plan credits.' : 'Recorded, not yet spendable.' });
    }
    if (w.bonus?.bonusGreetings > 0) {
      sendCells.push({ label: 'BONUS', value: `${w.bonus.bonusGreetings}`, sub: 'Not spendable in current wallet path.' });
    }
  }

  const StatusPill = ({ onBanner = false }) => (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: '0.375rem',
      padding: '0.25rem 0.625rem',
      borderRadius: 'var(--radius-full, 9999px)',
      fontSize: '0.75rem',
      fontWeight: 700,
      background: onBanner ? 'rgba(255, 255, 255, 0.95)' : pill.bg,
      color: pill.text,
      whiteSpace: 'nowrap',
      flexShrink: 0,
    }}>
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: pill.dot }} />
      {pill.label}
    </span>
  );

  return (
    <div>
      <h1 style={{ fontSize: isNarrow ? '1.5rem' : '1.875rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.25rem' }}>
        Settings
      </h1>
      <p style={{ fontSize: '0.9375rem', color: 'var(--text-secondary)', margin: '0 0 1.5rem' }}>
        Manage your membership, preferences, and account.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: isNarrow ? '1.5rem' : '2rem' }}>

        {/* 1. Your Membership (HERO) */}
        <div style={card(true)}>
          <div style={cardHeader}>
            <CreditCard style={{ color: 'var(--primary)' }} size={24} />
            <h2 style={cardTitle}>Your Membership</h2>
          </div>

          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: '0 0 1rem' }}>
            Welcome back, {firstName}
          </p>

          {/* Premium membership banner */}
          <div style={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: 'var(--radius-lg)',
            padding: isNarrow ? '1.25rem' : '1.5rem 1.75rem',
            marginBottom: '1.5rem',
            display: 'flex',
            flexDirection: isNarrow ? 'column' : 'row',
            alignItems: isNarrow ? 'flex-start' : 'center',
            justifyContent: 'space-between',
            gap: isNarrow ? '0.875rem' : '1rem',
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: isNarrow ? '1.375rem' : '1.625rem',
                fontWeight: 700,
                color: '#ffffff',
                lineHeight: 1.2,
              }}>
                {tierLabel}
              </div>
              <div style={{
                fontSize: '0.8125rem',
                fontWeight: 400,
                color: 'rgba(255, 255, 255, 0.85)',
                marginTop: '0.375rem',
              }}>
                {descriptor}
              </div>
            </div>
            <StatusPill onBanner />
          </div>

          {/* Detail grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isNarrow ? '1fr' : `repeat(${detailCols.length}, 1fr)`,
            gap: isNarrow ? '1rem' : '1.25rem',
            marginBottom: '1.5rem',
          }}>
            {detailCols.map((col) => (
              <div key={col.label}>
                <div style={gridLabel}>
                  {col.icon ? <col.icon size={14} style={{ color: 'var(--primary)' }} /> : null}
                  {col.label}
                </div>
                <div style={gridValue}>{col.value}</div>
              </div>
            ))}
          </div>

          {/* SEND BALANCE — live Greet-Me wallet balances (GET /api/wallet) */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ ...gridLabel, marginBottom: '0.75rem' }}>SEND BALANCE</div>
            {walletError ? (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0 }}>
                Send balance temporarily unavailable.
              </p>
            ) : (
              <>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: isNarrow ? 'repeat(2, 1fr)' : `repeat(${sendCells.length}, 1fr)`,
                  gap: isNarrow ? '1rem' : '1.25rem',
                }}>
                  {sendCells.map((cell) => (
                    <div key={cell.label}>
                      <div style={gridLabel}>{cell.label}</div>
                      <div style={gridValue}>{cell.value}</div>
                      {cell.sub ? (
                        <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>{cell.sub}</div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {walletLoading && !wallet ? (
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: '0.5rem 0 0' }}>Loading send balance…</p>
                ) : null}
              </>
            )}
          </div>

          {billingError && (
            <p style={{ fontSize: '0.875rem', color: '#dc2626', margin: '0 0 0.875rem' }}>{billingError}</p>
          )}

          {/* Single primary filled brand button (logic unchanged) */}
          {hasBillingRelationship ? (
            <button
              onClick={handleManageBilling}
              disabled={billingLoading}
              style={{
                width: isNarrow ? '100%' : 'auto',
                padding: '0.75rem 1.75rem',
                background: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-md, 0.5rem)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: billingLoading ? 'default' : 'pointer',
                opacity: billingLoading ? 0.5 : 1,
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { if (!billingLoading) e.currentTarget.style.background = 'var(--primary-dark)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary)'; }}
            >
              {billingLoading ? 'Opening...' : 'Manage Billing'}
            </button>
          ) : (
            <button
              onClick={() => { navigate('/pricing'); }}
              style={{
                width: isNarrow ? '100%' : 'auto',
                padding: '0.75rem 1.75rem',
                background: 'var(--primary)',
                color: '#ffffff',
                border: 'none',
                borderRadius: 'var(--radius-md, 0.5rem)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--primary-dark)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--primary)'; }}
            >
              View Plans
            </button>
          )}
        </div>

        {/* 2. Notifications */}
        <div style={card()}>
          <div style={cardHeader}>
            <Bell style={{ color: 'var(--primary)' }} size={24} />
            <h2 style={cardTitle}>Notifications</h2>
          </div>
          <div>
            {[
              { title: 'Email me when greetings are sent', help: 'Get a receipt the moment a card delivers.', checked: true },
              { title: 'Remind me 7 days before upcoming occasions', help: 'Never miss a birthday or anniversary.', checked: true },
              { title: 'Send me monthly summary reports', help: 'A recap of everything you sent.', checked: false },
            ].map((row, i, arr) => (
              <label
                key={row.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '1rem',
                  padding: '0.875rem 0',
                  borderBottom: i < arr.length - 1 ? '1px solid var(--border-light, #f3f4f6)' : 'none',
                  cursor: 'pointer',
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                    {row.title}
                  </span>
                  <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                    {row.help}
                  </span>
                </span>
                <input
                  type="checkbox"
                  defaultChecked={row.checked}
                  style={{ width: '1.125rem', height: '1.125rem', accentColor: 'var(--primary)', flexShrink: 0, cursor: 'pointer' }}
                />
              </label>
            ))}
          </div>
        </div>

        {/* 3. Security */}
        <div style={card()}>
          <div style={cardHeader}>
            <Lock style={{ color: 'var(--primary)' }} size={24} />
            <h2 style={cardTitle}>Security</h2>
          </div>
          <button
            onClick={() => navigate('/forgot-password')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '1rem',
              width: '100%',
              padding: '0.875rem 0',
              background: 'transparent',
              border: 'none',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
              <Key size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: '0.9375rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                  Password
                </span>
                <span style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                  Change your account password
                </span>
              </span>
            </span>
            <ChevronRight size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
          </button>
        </div>

        {/* 4. Data & Privacy */}
        <div style={card()}>
          <div style={cardHeader}>
            <Database style={{ color: 'var(--primary)' }} size={24} />
            <h2 style={cardTitle}>Data &amp; Privacy</h2>
          </div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, margin: '0 0 1.25rem' }}>
            To request a copy of your data or to delete your account, email us at the address below.
            We process all requests within 30 days, as described in our{' '}
            <a href="/#/legal" style={{ color: 'var(--primary)', textDecoration: 'none' }}>privacy policy</a>.
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <a
              href="mailto:support@greet-me.com?subject=Data%20Export%20Request"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '0.875rem 1rem',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                textDecoration: 'none',
                color: 'var(--text-primary)',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <Download size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Request a copy of my data</span>
              </span>
              <ChevronRight size={18} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} />
            </a>
            <a
              href="mailto:support@greet-me.com?subject=Account%20Deletion%20Request"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '1rem',
                padding: '0.875rem 1rem',
                border: '1px solid #fecaca',
                borderRadius: 'var(--radius-lg)',
                textDecoration: 'none',
                color: '#dc2626',
                background: '#fef2f2',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
                <Trash2 size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
                <span style={{ fontSize: '0.9375rem', fontWeight: 500 }}>Request account deletion</span>
              </span>
              <ChevronRight size={18} style={{ color: '#dc2626', flexShrink: 0 }} />
            </a>
          </div>
        </div>

      </div>
    </div>
  );
}
