// src/components/hub/HubJourney.jsx
// UX-HUB-3 Batch 2 — "Your Journey" section (J1 + J2 next-chapter + SC2 introduction).
// Behavior-preserving extraction from Rewards.jsx. Presentational only: receives the J0
// progress facts verbatim (`journey`) and `navigate`; owns no state and makes no API calls.
// The next-chapter / graduation / Social Circuit branches are derived statelessly at render
// from the `journey` prop only — identical to before. JOURNEY_STEPS + SOCIAL_CIRCUIT_ENABLED
// come from hubConfig.

import { Heart } from 'lucide-react';
import { JOURNEY_STEPS, SOCIAL_CIRCUIT_ENABLED } from './hubConfig';

export default function HubJourney({ journey, navigate }) {
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
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Heart size={20} style={{ color: '#ec4899' }} fill="#ec4899" />
        Your Journey
      </h2>
      <p style={{
        fontSize: '0.95rem',
        color: 'var(--text-secondary)',
        margin: '0 0 1.25rem',
        lineHeight: 1.5
      }}>
        Welcome to your Greet-Me journey. Every heartfelt moment you create writes
        another chapter — here&apos;s the story you&apos;re building, one Heart at a time.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {JOURNEY_STEPS.map((step) => {
          const reached = Boolean(journey && journey[step.key]);
          return (
            <div key={step.key} style={{
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
                {step.label}
              </span>
            </div>
          );
        })}
      </div>

      {/* J2 — "Your next chapter": a gentle guide derived (statelessly, at render)
          from the FIRST not-yet-reached J0 fact in the existing Journey order.
          Pure meaning over J0 truth — no progress count/percent/bar/phase, no
          milestone, no stored Journey state, no new API call. When every fact is
          reached, a warm acknowledgment replaces it (never a reward/unlock). */}
      {(() => {
        const next = JOURNEY_STEPS.find((s) => !(journey && journey[s.key]));
        if (!next) {
          return (
            <>
              {/* Graduation warmth — "look what you did" (unchanged from J2). */}
              <div style={{
                marginTop: '1.25rem',
                padding: '1rem 1.125rem',
                borderRadius: 'var(--radius-lg)',
                background: 'rgba(236, 72, 153, 0.08)',
                border: '1px solid rgba(236, 72, 153, 0.25)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.625rem'
              }}>
                <Heart size={18} style={{ color: '#ec4899' }} fill="#ec4899" />
                <span style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  You&apos;ve begun your story beautifully — every chapter so far is written in Hearts.
                </span>
              </div>

              {/* SC2 — Social Circuit introduction (handoff). The tile does not end;
                  it WIDENS into the outward chapter. Same surface, same guide. An
                  invitation, never a task — no progress, no count, no milestone, no
                  economy value. One CTA → the EXISTING /dashboard/send flow. */}
              {SOCIAL_CIRCUIT_ENABLED && (
                <div style={{
                  marginTop: '1.25rem',
                  padding: '1.125rem 1.25rem',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border)'
                }}>
                  <p style={{
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--text-secondary)',
                    margin: '0 0 0.375rem'
                  }}>
                    Your next horizon
                  </p>
                  <p style={{
                    fontSize: '1.05rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    margin: '0 0 0.5rem'
                  }}>
                    Bring someone into the Greet-Me circle
                  </p>
                  <p style={{
                    fontSize: '0.95rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    margin: '0 0 0.875rem'
                  }}>
                    You&apos;ve mastered the moments that matter. Share Greet-Me with
                    someone new and become part of something larger.
                  </p>
                  <button
                    onClick={() => navigate('/dashboard/send')}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      background: '#ec4899',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      padding: '0.625rem 1.25rem',
                      fontSize: '0.9rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontFamily: 'inherit'
                    }}
                  >
                    <Heart size={16} fill="white" style={{ color: 'white' }} />
                    Share Greet-Me
                  </button>
                </div>
              )}
            </>
          );
        }
        const dest = next.key === 'hasCompletedOnboarding' ? '/dashboard/profile' : '/dashboard/send';
        return (
          <div style={{
            marginTop: '1.25rem',
            padding: '1.125rem 1.25rem',
            borderRadius: 'var(--radius-lg)',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)'
          }}>
            <p style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: 'var(--text-secondary)',
              margin: '0 0 0.375rem'
            }}>
              Your next chapter
            </p>
            <p style={{
              fontSize: '1.05rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              margin: '0 0 0.875rem'
            }}>
              {next.label}
            </p>
            <button
              onClick={() => navigate(dest)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                background: '#ec4899',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                padding: '0.625rem 1.25rem',
                fontSize: '0.9rem',
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              <Heart size={16} fill="white" style={{ color: 'white' }} />
              Continue your journey
            </button>
          </div>
        );
      })()}
    </div>
  );
}
