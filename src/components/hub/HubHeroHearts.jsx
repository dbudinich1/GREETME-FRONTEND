// src/components/hub/HubHeroHearts.jsx
// UX-HUB-3 Batch 2 — Hero Hearts dedicated Hub section. Behavior-preserving extraction from
// Rewards.jsx. Presentational only: opens the existing Hero Hearts modal via the prop opener.
// Modal + purchase flow, economics, donation copy, and APIs are unchanged.

import { Heart } from 'lucide-react';

export default function HubHeroHearts({ setShowHeroHeartsModal }) {
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
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Heart size={20} style={{ color: '#ec4899' }} />
        Greet-Me™ Hero™ Hearts™
      </h2>
      {/* Brand identity mark (visual only) */}
      <span style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: '3.5rem',
        height: '3.5rem',
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
        boxShadow: '0 6px 18px rgba(236, 72, 153, 0.35)',
        marginBottom: '1rem'
      }}>
        <Heart size={26} style={{ color: 'white' }} fill="white" />
      </span>
      <p style={{
        fontSize: '0.9375rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        margin: '0 0 1rem'
      }}>
        Your home for Greet-Me™ Hero™ Hearts™.
      </p>
      <p style={{
        fontSize: '0.8125rem',
        color: 'var(--text-secondary)',
        lineHeight: 1.6,
        margin: '0 0 1.25rem',
        padding: '0.75rem 0.875rem',
        background: 'rgba(236, 72, 153, 0.06)',
        border: '1px solid rgba(236, 72, 153, 0.18)',
        borderRadius: 'var(--radius-md)'
      }}>
        25% of proceeds from Hero Hearts™ support U.S. Veterans and their families.
      </p>
      <button
        className="hub-btn"
        onClick={() => setShowHeroHeartsModal(true)}
        style={{
          marginTop: 'auto',
          width: '100%',
          padding: '0.9375rem',
          background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
          color: 'white',
          border: 'none',
          borderRadius: 'var(--radius-lg)',
          fontSize: '0.9375rem',
          fontWeight: 700,
          cursor: 'pointer',
          boxShadow: '0 8px 20px -6px rgba(236, 72, 153, 0.5)',
          fontFamily: 'inherit'
        }}
      >
        Open Hero Hearts
      </button>
    </div>
  );
}
