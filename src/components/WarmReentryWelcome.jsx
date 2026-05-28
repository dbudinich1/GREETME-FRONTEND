// src/components/WarmReentryWelcome.jsx
//
// Warm "already personalized" dashboard re-entry acknowledgment.
//
// Visible only when the dashboard's onboarding-complete gate identifies a
// recipient-origin user who has finished personalization (voice + photo
// persisted in Cosmos) but has not yet added their own recipients. The
// component fills the moment between the ThankYouFlow ceremonial finish
// and the dashboard's utility-first chrome.
//
// Mounted exclusively via `shouldShowWarmReentry()` in src/utils/accountState.js
// and structurally disjoint from <OnboardingCoach />. Mutual-exclusivity is
// enforced by the gate functions themselves; both cannot fire concurrently.
//
// Tone: subtle parchment bridge inside dashboard architecture. Warm cream
// background, Georgia headline, bronze CTA matching the email-insert button.
// No wax-seal motif, no icon, no animation (deliberate restraint — the wax
// seal is reserved for one-shot ceremonial moments; the dashboard is the
// working surface). Self-extinguishes the moment the user adds a recipient.
//
// Last reviewed: 2026-05-28 (Stage 3 implementation, Tier 2 warm re-entry).

import { useNavigate } from 'react-router-dom';
import { getHoverHandlers } from '../utils/hoverable';

export default function WarmReentryWelcome({ isNarrow = false }) {
  const navigate = useNavigate();

  return (
    <section
      aria-label="Welcome — your account is ready"
      style={{
        background: '#fffbef',
        border: '1px solid #e9e1d1',
        borderRadius: 'var(--radius-lg)',
        padding: isNarrow ? '1rem' : '1.25rem',
        marginBottom: '1rem',
        boxShadow: '0 1px 3px rgba(58, 45, 31, 0.08)',
      }}
    >
      <h2
        style={{
          fontFamily: 'Georgia, serif',
          fontSize: isNarrow ? '1.125rem' : '1.375rem',
          fontWeight: 500,
          color: '#3a2d1f',
          lineHeight: 1.3,
          margin: '0 0 ' + (isNarrow ? '0.5rem' : '0.625rem'),
        }}
      >
        You&rsquo;re set up.
      </h2>
      <p
        style={{
          fontSize: isNarrow ? '0.875rem' : '0.9375rem',
          color: '#6b6155',
          lineHeight: 1.55,
          margin: '0 0 ' + (isNarrow ? '0.875rem' : '1rem'),
        }}
      >
        Your voice and your photo are part of every Greet-Me you&rsquo;ll send. Add someone to your recipients when you&rsquo;re ready to make their day.
      </p>
      <button
        type="button"
        onClick={() => navigate('/dashboard/contacts', { state: { openAddRecipient: true } })}
        style={{
          background: '#6b3a2a',
          color: '#fffbef',
          border: 'none',
          borderRadius: 'var(--radius-md)',
          padding: isNarrow ? '0.75rem 1.25rem' : '0.625rem 1.5rem',
          fontFamily: 'Georgia, serif',
          fontSize: '0.9375rem',
          fontWeight: 600,
          cursor: 'pointer',
          minHeight: isNarrow ? '48px' : '44px',
          width: isNarrow ? '100%' : 'auto',
          transition: 'background 0.2s',
        }}
        {...getHoverHandlers({
          onEnter: (e) => { e.currentTarget.style.background = '#5a3022'; },
          onLeave: (e) => { e.currentTarget.style.background = '#6b3a2a'; },
          onDown:  (e) => { e.currentTarget.style.background = '#4a2618'; },
          onUp:    (e) => { e.currentTarget.style.background = '#5a3022'; },
        })}
      >
        Add your first recipient &rarr;
      </button>
    </section>
  );
}
