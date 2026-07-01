// src/components/hub/HubWaysToEarn.jsx
// UX-HUB-3 Batch 3 — "Ways to Earn Hearts" section, LIVE data. Presentational only: receives the
// server-derived per-behavior amounts via props.amounts (GET /api/hearts/amounts, page-owned).
// UX Cleanup (Earn Collapse) — the section now defaults to a small CURATED set (the highest-value
// earn options) with a "View all" affordance; the expanded state reveals every real behavior. No
// earn option is removed from the underlying model — collapsing is purely presentational.

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { BEHAVIOR_LABELS, humanize } from './hubConfig';

// How many earn options the calm, collapsed default shows before "View all".
const COLLAPSED_COUNT = 4;

export default function HubWaysToEarn({ amounts = [] }) {
  const [expanded, setExpanded] = useState(false);

  // Curated default = the top COLLAPSED_COUNT by Heart value (amounts arrive weight-sorted).
  const hasMore = amounts.length > COLLAPSED_COUNT;
  const visible = expanded || !hasMore ? amounts : amounts.slice(0, COLLAPSED_COUNT);

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
        <>
          {/* Calm, collapsed default: a small curated set of slim single-row items (icon · label ·
              Hearts chip). "View all" reveals the rest. Real amounts only; nothing hidden from the
              model — the full list is one tap away. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))',
            columnGap: '0.75rem',
            rowGap: '0.625rem'
          }}>
            {visible.map(({ behavior, amount }) => (
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

          {hasMore && (
            <button
              type="button"
              className="hub-btn"
              onClick={() => setExpanded((v) => !v)}
              aria-expanded={expanded}
              style={{
                marginTop: '1rem',
                width: '100%',
                padding: '0.6875rem',
                background: 'transparent',
                color: '#be185d',
                border: '1px solid rgba(236, 72, 153, 0.30)',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {expanded ? 'Show less' : `View all ${amounts.length} ways to earn`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
