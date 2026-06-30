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
    <div className="hub-card" style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.75rem',
      marginBottom: '2rem',
      border: '1px solid var(--border)'
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
        <Sparkles size={22} style={{ color: '#ec4899' }} />
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
        // UX-HUB-5 — compact premium presentation: every real earn behavior is a slim
        // single-row item (icon · label · Hearts chip) in a multi-column grid. Dramatically
        // less vertical sprawl than the tall tiles; all behaviors stay visible, none hidden,
        // no expander. Real amounts only.
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))',
          columnGap: '0.75rem',
          rowGap: '0.625rem'
        }}>
          {amounts.map(({ behavior, amount }) => (
            <div
              key={behavior}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.6875rem 0.875rem',
                background: 'var(--gray-50)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)'
              }}
            >
              <span style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '2rem',
                height: '2rem',
                borderRadius: '50%',
                flexShrink: 0,
                background: 'rgba(236, 72, 153, 0.12)'
              }}>
                <Sparkles size={16} style={{ color: '#ec4899' }} />
              </span>
              <span style={{
                flex: 1,
                minWidth: 0,
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                fontWeight: 600,
                lineHeight: 1.3
              }}>
                {BEHAVIOR_LABELS[behavior] || humanize(behavior)}
              </span>
              <span style={{
                flexShrink: 0,
                fontSize: '0.8125rem',
                fontWeight: 700,
                color: '#ec4899',
                whiteSpace: 'nowrap',
                background: 'rgba(236, 72, 153, 0.10)',
                border: '1px solid rgba(236, 72, 153, 0.25)',
                borderRadius: '999px',
                padding: '0.25rem 0.625rem'
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
