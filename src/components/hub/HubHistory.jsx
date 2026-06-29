// src/components/hub/HubHistory.jsx
// UX-HUB-3 Batch 3 — "Heart History" section (NEW). Presentational only: receives the user's
// real earn events via props.history (GET /api/hearts/history, newest-first, page-owned).
// Semantic list; each row labels the real behavior (BEHAVIOR_LABELS, else humanize) with its
// real amount (Hearts only) and a <time> when occurredAt exists. No fake/sample rows. Empty
// → honest empty state.

import { Clock } from 'lucide-react';
import { BEHAVIOR_LABELS, humanize } from './hubConfig';

// Format an ISO timestamp for display; returns '' if unparseable (the <time> is then omitted).
function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

export default function HubHistory({ history = [] }) {
  return (
    <div className="hub-card" style={{
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
        <Clock size={20} style={{ color: '#ec4899' }} />
        Heart History
      </h2>
      {history.length === 0 ? (
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          margin: 0
        }}>
          No Hearts earned yet — your history will appear here.
        </p>
      ) : (
        <ul style={{
          listStyle: 'none',
          margin: 0,
          padding: 0,
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          {history.map((entry, i) => {
            const label = BEHAVIOR_LABELS[entry.behavior] || humanize(entry.behavior) || 'Hearts earned';
            const when = formatDate(entry.occurredAt);
            return (
              <li
                key={`${entry.occurredAt || 'na'}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.75rem',
                  padding: '0.75rem 1rem',
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-lg)',
                  border: '1px solid var(--border)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.125rem', minWidth: 0 }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {label}
                  </span>
                  {when ? (
                    <time
                      dateTime={entry.occurredAt}
                      style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}
                    >
                      {when}
                    </time>
                  ) : null}
                </div>
                <span style={{
                  fontSize: '0.9375rem',
                  fontWeight: 700,
                  color: '#ec4899',
                  whiteSpace: 'nowrap'
                }}>
                  +{entry.amount} ❤️
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
