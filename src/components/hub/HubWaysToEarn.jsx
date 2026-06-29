// src/components/hub/HubWaysToEarn.jsx
// UX-HUB-3 Batch 2 — "Ways to Earn Hearts" section. Behavior-preserving extraction from
// Rewards.jsx (static label list; no props, no state). Live amounts are deferred to Batch 3.

import { Sparkles } from 'lucide-react';

export default function HubWaysToEarn() {
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
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '1rem'
      }}>
        {[
          'Send a Thank-You Greet-Me',
          'Send your first independent Greet-Me',
          'Schedule an occasion',
          'Reach 5 delivered recipients',
          'Reach 10 delivered recipients',
          'Send a gift with your Greet-Me',
          'Share a Greet-Me',
          'Earn when your shared friend joins',
          'Subscribe',
          'Upgrade'
        ].map((label) => (
          <div
            key={label}
            style={{
              padding: '1rem',
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-lg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <span style={{
              fontSize: '0.875rem',
              color: 'var(--text-primary)',
              fontWeight: 500
            }}>
              {label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
