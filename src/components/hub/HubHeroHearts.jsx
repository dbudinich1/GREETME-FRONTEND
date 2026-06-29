// src/components/hub/HubHeroHearts.jsx
// UX-HUB-3 Batch 2 — Hero Hearts dedicated Hub section. Behavior-preserving extraction from
// Rewards.jsx. Presentational only: opens the existing Hero Hearts modal via the prop opener.
// Modal + purchase flow, economics, donation copy, and APIs are unchanged.

import { Heart } from 'lucide-react';

export default function HubHeroHearts({ setShowHeroHeartsModal }) {
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
        <Heart size={20} style={{ color: '#ec4899' }} />
        Greet-Me™ Hero™ Hearts™
      </h2>
      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        margin: '0 0 0.75rem'
      }}>
        Your home for Greet-Me™ Hero™ Hearts™.
      </p>
      <p style={{
        fontSize: '0.875rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        margin: '0 0 1rem'
      }}>
        25% of proceeds from Hero Hearts™ support U.S. Veterans and their families.
      </p>
      <button
        onClick={() => setShowHeroHeartsModal(true)}
        style={{
          width: '100%',
          padding: '0.75rem',
          background: '#ec4899',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          fontSize: '0.9375rem',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit'
        }}
      >
        Open Hero Hearts
      </button>
    </div>
  );
}
