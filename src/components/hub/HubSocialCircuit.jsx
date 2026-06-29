// src/components/hub/HubSocialCircuit.jsx
// UX-HUB-3 Batch 3 — "Social Circuit" section (NEW). Presentational only: receives the
// server fact object via props.circuit (GET /api/social/circuit, page-owned) and renders
// ONE reached/not-yet row PER RESPONSE KEY — data-driven, never hardcoded to two rows. A
// future backend fact renders automatically (label via SOCIAL_FACT_LABELS, else humanize).
// Boolean facts only: no social score, no connection count, no popularity metric. Empty
// response → honest empty state.

import { Heart } from 'lucide-react';
import { SOCIAL_FACT_LABELS, humanize } from './hubConfig';

export default function HubSocialCircuit({ circuit = {} }) {
  const facts = Object.entries(circuit || {});
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
        <Heart size={20} style={{ color: '#ec4899' }} />
        Social Circuit
      </h2>
      {facts.length === 0 ? (
        <p style={{
          fontSize: '0.875rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          margin: 0
        }}>
          Your Social Circuit will appear here.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {facts.map(([key, value]) => {
            const reached = Boolean(value);
            return (
              <div key={key} style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '0.875rem 1rem',
                borderRadius: 'var(--radius-lg)',
                background: reached ? 'rgba(236, 72, 153, 0.08)' : 'var(--bg-secondary)',
                border: reached ? '1px solid rgba(236, 72, 153, 0.25)' : '1px solid var(--border)'
              }}>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: '2rem',
                  height: '2rem',
                  borderRadius: '50%',
                  flexShrink: 0,
                  background: reached ? 'rgba(236, 72, 153, 0.15)' : 'transparent'
                }}>
                  <Heart
                    size={18}
                    style={{
                      color: reached ? '#ec4899' : 'var(--text-secondary)',
                      opacity: reached ? 1 : 0.4
                    }}
                    fill={reached ? '#ec4899' : 'none'}
                  />
                </span>
                <span style={{
                  fontSize: '0.95rem',
                  fontWeight: reached ? 600 : 500,
                  color: reached ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}>
                  {SOCIAL_FACT_LABELS[key] || humanize(key)}
                </span>
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: reached ? '#ec4899' : 'var(--text-secondary)'
                }}>
                  {reached ? 'Reached' : 'Not yet'}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
