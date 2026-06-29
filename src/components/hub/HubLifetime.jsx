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
      padding: '1.5rem',
      marginBottom: '2rem',
      border: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h2 style={{
        fontSize: '1.25rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Trophy size={20} style={{ color: '#ec4899' }} />
        Lifetime Earned
      </h2>
      {/* UX-HUB-3 Batch 5 — center the number vertically so the (often short) Lifetime card
          stays balanced against its taller History companion at equal heights. */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <div
          aria-label={`Lifetime Hearts earned: ${lifetimeEarned}`}
          style={{
            fontSize: '2.5rem',
            fontWeight: 800,
            color: 'var(--text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums'
          }}
        >
          {lifetimeEarned} <span style={{ fontSize: '2rem' }}>❤️</span>
        </div>
        <p style={{
          fontSize: '0.8125rem',
          color: 'var(--text-secondary)',
          margin: '0.5rem 0 0'
        }}>
          Total Hearts earned over time
        </p>
      </div>
    </div>
  );
}
