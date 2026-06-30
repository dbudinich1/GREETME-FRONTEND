// src/components/hub/HubJourney.jsx
// UX-HUB-3 Batch 7 — concept-faithful Journey. Presentational + stateless: derived entirely
// from the real J0 `journey` facts. Composition (top → bottom):
//   1) Title + intro
//   2) 3-ZONE BAND: Ring (N/4) | Current Chapter (real next step) | Keep Going (honest)
//   3) ROADMAP (the 4 real JOURNEY_STEPS) — "where am I?"
//   4) CHECKLIST (the same 4 real steps) — "what do I do next?"  [KEPT — never removed]
//   5) CONTINUE CTA (the real next-chapter action)
// TRUTH RULES: ring is N/4 only (no %, no "Mission X of 5"); NO reward amount, NO milestone,
// NO fabricated progress; roadmap + checklist use ONLY the real JOURNEY_STEPS (no 5th step).
// Roadmap and checklist are COMPLEMENTARY and both remain.

import { Heart, ArrowRight, Sparkles, Target } from 'lucide-react';
import { JOURNEY_STEPS, SOCIAL_CIRCUIT_ENABLED } from './hubConfig';
import HubJourneyRing from './HubJourneyRing';
import HubJourneyRoadmap from './HubJourneyRoadmap';

const ZONE_LABEL = {
  fontSize: '0.75rem',
  fontWeight: 700,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-secondary)',
  margin: '0 0 0.375rem',
};

export default function HubJourney({ journey, navigate }) {
  // Real progress: count of true J0 facts (0–4). Real facts ONLY.
  const reachedCount = JOURNEY_STEPS.reduce((n, s) => n + (journey && journey[s.key] ? 1 : 0), 0);
  // The first not-yet-reached real step (null when all four are complete).
  const next = JOURNEY_STEPS.find((s) => !(journey && journey[s.key]));
  const dest = next ? (next.key === 'hasCompletedOnboarding' ? '/dashboard/profile' : '/dashboard/send') : null;

  return (
    <div className="hub-card hub-journey" style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-xl)',
      padding: '2.5rem',
      marginBottom: '2rem',
      border: '1px solid var(--border)'
    }}>
      <h2 style={{
        fontSize: '1.375rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '0.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Heart size={22} style={{ color: '#ec4899' }} fill="#ec4899" />
        Getting Started
      </h2>
      <p style={{
        fontSize: '0.95rem',
        color: 'var(--text-secondary)',
        margin: '0 0 1.25rem',
        lineHeight: 1.5
      }}>
        This is the beginning of your Hearts journey — complete these first steps to get started.
      </p>

      {/* 1) 3-ZONE BAND: Ring | Current Chapter | Keep Going */}
      <div className="hub-journey-band">
        {/* Ring (left) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <HubJourneyRing reachedCount={reachedCount} total={4} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {reachedCount} of 4 chapters
          </span>
        </div>

        {/* Current Chapter (center) — premium feature card; real next step, no count/reward */}
        <div className="hub-journey-current" style={{
          padding: '1.375rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.10) 0%, rgba(190, 24, 93, 0.04) 100%)',
          border: '1px solid rgba(236, 72, 153, 0.25)',
          borderLeft: '4px solid #ec4899'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', margin: '0 0 0.625rem' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: '2.25rem', height: '2.25rem', borderRadius: '50%',
              background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
              boxShadow: '0 4px 12px rgba(236, 72, 153, 0.35)', flexShrink: 0
            }}>
              <Target size={18} style={{ color: 'white' }} />
            </span>
            <p style={{ ...ZONE_LABEL, color: '#be185d', margin: 0 }}>
              {next ? 'Current Chapter' : 'Your Story So Far'}
            </p>
          </div>
          {next ? (
            <>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
                {next.label}
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                Your next step in the story — complete it to write another chapter in Hearts.
              </p>
            </>
          ) : (
            <>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
                Every chapter reached
              </p>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                You&apos;ve begun your story beautifully — every chapter so far is written in Hearts.
              </p>
            </>
          )}
        </div>

        {/* Keep Going (right) — honest encouragement, NO reward number */}
        <div style={{
          padding: '1.125rem 1.25rem',
          borderRadius: 'var(--radius-lg)',
          background: 'rgba(236, 72, 153, 0.06)',
          border: '1px solid rgba(236, 72, 153, 0.20)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'rgba(236, 72, 153, 0.15)'
          }}>
            <Sparkles size={22} style={{ color: '#ec4899' }} />
          </span>
          <p style={ZONE_LABEL}>Keep Going</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            {next
              ? 'You’re building something meaningful — one heartfelt moment at a time.'
              : 'You’ve reached every chapter so far. Beautifully done.'}
          </p>
        </div>
      </div>

      {/* 2) ROADMAP — "where am I?" (4 real steps) */}
      {/* UX-HUB-5 — the roadmap is the single step display ("where am I?"). The redundant
          vertical checklist (same 4 facts) was removed; the roadmap retains all four real
          steps + completion, and the Current Chapter zone highlights the next one. */}
      <div style={{ margin: '0' }}>
        <HubJourneyRoadmap journey={journey} />
      </div>

      {/* CONTINUE CTA — the real next-chapter action (only when a real next step exists). */}
      {next && (
        <button
          className="hub-btn"
          onClick={() => navigate(dest)}
          style={{
            marginTop: '1.75rem',
            width: '100%',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem 1.25rem',
            fontSize: '1rem',
            fontWeight: 700,
            letterSpacing: '0.01em',
            cursor: 'pointer',
            boxShadow: '0 8px 22px -6px rgba(236, 72, 153, 0.5)',
            fontFamily: 'inherit'
          }}
        >
          Continue your journey
          <ArrowRight size={18} />
        </button>
      )}

      {/* When every real chapter is reached: the dormant Social Circuit handoff (flag-gated;
          unchanged — invitation only, no progress/count/milestone/economy). */}
      {!next && SOCIAL_CIRCUIT_ENABLED && (
        <div style={{
          marginTop: '1.5rem',
          padding: '1.125rem 1.25rem',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border)'
        }}>
          <p style={ZONE_LABEL}>Your next horizon</p>
          <p style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem' }}>
            Bring someone into the Greet-Me circle
          </p>
          <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: '0 0 0.875rem' }}>
            You&apos;ve mastered the moments that matter. Share Greet-Me with someone new and
            become part of something larger.
          </p>
          <button
            className="hub-btn"
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
    </div>
  );
}
