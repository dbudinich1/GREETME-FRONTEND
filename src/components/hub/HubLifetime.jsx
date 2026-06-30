// src/components/hub/HubLifetime.jsx
// UX-HUB-3 Batch 3 — "Lifetime Earned" stat (NEW). Presentational only: receives the real
// derived lifetime total via props.lifetimeEarned (GET /api/hearts/lifetime, page-owned).
// Hearts only — no dollar value, no fabricated milestone, no "on fire." Zero shows as 0.

import { Trophy } from 'lucide-react';

export default function HubLifetime({ lifetimeEarned = 0 }) {
  return (
    <div className="hub-card" style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.75rem',
      marginBottom: '2rem',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h2 style={{
        fontSize: '1.375rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Trophy size={22} style={{ color: '#ec4899' }} />
        Lifetime Earned
      </h2>
      {/* UX-HUB-3 Batch 6 — narrow achievement-style card: a centered trophy badge + the real
          lifetime number, vertically centered so it balances the wider History feed. No
          milestone, no "on fire," no dollar value. */}
      <div style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: '0.875rem',
        padding: '0.5rem 0'
      }}>
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '5rem',
          height: '5rem',
          borderRadius: '50%',
          background: 'rgba(236, 72, 153, 0.12)'
        }}>
          <Trophy size={40} style={{ color: '#ec4899' }} />
        </span>
        <div
          aria-label={`Lifetime Hearts earned: ${lifetimeEarned}`}
          style={{
            fontSize: '3.5rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {lifetimeEarned} <span style={{ fontSize: '2.25rem' }}>❤️</span>
        </div>
        <p style={{
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          margin: 0
        }}>
          Total Hearts earned over time
        </p>
      </div>
    </div>
  );
}
