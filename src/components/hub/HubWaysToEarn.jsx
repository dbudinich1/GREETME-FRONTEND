// src/components/hub/HubWaysToEarn.jsx
// UX-HUB-3 Batch 3 — "Ways to Earn Hearts" section, now LIVE data. Presentational only:
// receives the server-derived per-behavior amounts via props.amounts (GET /api/hearts/amounts,
// page-owned). Renders one row per real behavior with its real Heart amount (Hearts only — no
// dollar value). The server already excludes retired (share_act) + internal (test_send); the
// frontend only labels what it returns. No hardcoded amounts, no fallback to a static list.

import { Sparkles } from 'lucide-react';
import { BEHAVIOR_LABELS, humanize } from './hubConfig';

export default function HubWaysToEarn({ amounts = [] }) {
  return (
    <div style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.5rem',
      marginBottom: '2rem',
      border: '1px solid var(--border)'
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
        <Sparkles size={20} style={{ color: '#ec4899' }} />
        Ways to Earn Hearts
      </h2>
      {amounts.length === 0 ? (
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          margin: 0
        }}>
          Ways to earn will appear here.
        </p>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {amounts.map(({ behavior, amount }) => (
            <div
              key={behavior}
              style={{
                padding: '1rem',
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '0.75rem'
              }}
            >
              <span style={{
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                fontWeight: 500
              }}>
                {BEHAVIOR_LABELS[behavior] || humanize(behavior)}
              </span>
              <span style={{
                fontSize: '0.875rem',
                fontWeight: 700,
                color: '#ec4899',
                whiteSpace: 'nowrap'
              }}>
                {amount} ❤️
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
