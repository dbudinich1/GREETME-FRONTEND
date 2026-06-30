// src/components/hub/HubSocialCircuit.jsx
// UX-HUB-3 Batch 3 — "Social Circuit" section (NEW). Presentational only: receives the
// server fact object via props.circuit (GET /api/social/circuit, page-owned) and renders
// ONE reached/not-yet row PER RESPONSE KEY — data-driven, never hardcoded to two rows. A
// future backend fact renders automatically (label via SOCIAL_FACT_LABELS, else humanize).
// Boolean facts only: no social score, no connection count, no popularity metric. Empty
// response → honest empty state.

import { Heart, Check, User } from 'lucide-react';
import { SOCIAL_FACT_LABELS, humanize } from './hubConfig';

export default function HubSocialCircuit({ circuit = {} }) {
  const facts = Object.entries(circuit || {});
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
        <Heart size={22} style={{ color: '#ec4899' }} />
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
                gap: '1rem',
                padding: '1rem',
                borderRadius: 'var(--radius-lg)',
                background: reached ? 'rgba(236, 72, 153, 0.08)' : 'var(--bg-secondary)',
                border: reached ? '1px solid rgba(236, 72, 153, 0.25)' : '1px solid var(--border)'
              }}>
                {/* Batch 6 — relationship connection motif: you ── them, the link filling in when
                    the real fact is reached. Booleans only; no score, no count. */}
                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }} aria-hidden="true">
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: 'rgba(236, 72, 153, 0.15)'
                  }}>
                    <Heart size={20} style={{ color: '#ec4899' }} fill="#ec4899" />
                  </span>
                  <span style={{
                    width: '2.25rem',
                    height: '3px',
                    borderRadius: '2px',
                    background: reached
                      ? 'linear-gradient(90deg, #ec4899 0%, #be185d 100%)'
                      : 'var(--border)'
                  }} />
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '2.5rem',
                    height: '2.5rem',
                    borderRadius: '50%',
                    background: reached ? 'rgba(236, 72, 153, 0.15)' : 'transparent',
                    border: reached ? 'none' : '2px dashed var(--border)'
                  }}>
                    {reached
                      ? <Check size={20} style={{ color: '#ec4899' }} />
                      : <User size={16} style={{ color: 'var(--text-secondary)', opacity: 0.5 }} />}
                  </span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontSize: '0.95rem',
                    fontWeight: reached ? 600 : 500,
                    color: reached ? 'var(--text-primary)' : 'var(--text-secondary)'
                  }}>
                    {SOCIAL_FACT_LABELS[key] || humanize(key)}
                  </div>
                  <div style={{
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    marginTop: '0.125rem',
                    color: reached ? '#ec4899' : 'var(--text-secondary)'
                  }}>
                    {reached ? 'Connected' : 'Not yet'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
