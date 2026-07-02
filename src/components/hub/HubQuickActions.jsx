// src/components/hub/HubQuickActions.jsx
// UX-HUB-3 Batch 7 — Quick Actions card (engagement band, center column). Presentational only:
// receives `navigate` + the Hero Hearts modal opener; owns no state, makes no API calls.
// REAL DESTINATIONS ONLY — every action routes to an existing route or opens the existing modal.
// UX-HUB-4E truth alignment: exactly FOUR actions, each a UNIQUE production destination (no
// duplicate routes). Removed the redundant "Share a Greet-Me" (same /dashboard/send as Send)
// and "Subscribe" (same /pricing as Upgrade); "Send a Thank-You" → "Send a Greet-Me" (the real
// destination is the generic Send Greeting flow). No new routes/handlers/capabilities.

import { Send, UserPlus, TrendingUp, Heart, Share2 } from 'lucide-react';

export default function HubQuickActions({ navigate, setShowHeroHeartsModal, onShareTheLove }) {
  const actions = [
    { key: 'send', label: 'Send a Greet-Me', Icon: Send, onClick: () => navigate('/dashboard/send') },
    { key: 'add', label: 'Add a Recipient', Icon: UserPlus, onClick: () => navigate('/dashboard/contacts') },
    { key: 'upgrade', label: 'Upgrade Your Plan', Icon: TrendingUp, onClick: () => navigate('/pricing') },
    { key: 'buy', label: 'Buy Hero Hearts', Icon: Heart, onClick: () => setShowHeroHeartsModal(true) },
    // Quick Action (a fifth entry, not the centerpiece): opens the canonical Share the Love panel.
    ...(onShareTheLove ? [{ key: 'share', label: 'Share the Love', Icon: Share2, onClick: () => onShareTheLove() }] : []),
  ];

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
        <Send size={22} style={{ color: '#ec4899' }} />
        Quick Actions
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '0.875rem'
      }}>
        {actions.map(({ key, label, Icon, onClick }) => (
          <button
            key={key}
            className="hub-btn"
            onClick={onClick}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'flex-start',
              textAlign: 'center',
              gap: '0.625rem',
              padding: '1.25rem 0.875rem',
              background: 'var(--gray-50)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-lg)',
              cursor: 'pointer',
              fontFamily: 'inherit',
              color: 'var(--text-primary)'
            }}
          >
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '50%',
              background: 'rgba(236, 72, 153, 0.12)'
            }}>
              <Icon size={22} style={{ color: '#ec4899' }} />
            </span>
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, lineHeight: 1.35 }}>
              {label}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
