// src/components/hub/HubJourney.jsx
// WS-5 (T5.2 + T5.4) — the full 4-chapter lifetime Journey scaffold. Presentational +
// stateless: TRUTH comes entirely from the backend chapter/state model (the `chapters`
// prop from GET /api/journey/progress); the frontend only labels keys (JOURNEY_CHAPTERS)
// and renders lock/active/complete states. Composition (top → bottom):
//   1) Title + intro
//   2) BAND: lifetime Ring (chapters complete / total) | Current Chapter | Keep Going
//   3) CHAPTER SCAFFOLD: all 4 canonical chapters, each complete / active / LOCKED
//   4) Ch.1 ROADMAP (the 4 real J0 facts) — shown while Getting Started is the active chapter
//   5) CONTINUE CTA (the real next step)
// TRUTH RULES (Rule A — no fake progress): a chapter renders LOCKED unless the server says
// `unlocked`; `complete` comes only from real facts; NO fabricated progress on locked
// chapters. T5.4 milestone recognition is INLINE ONLY (no modal / no takeover — the locked
// Hearts-experience inline-celebration canon).

import { Heart, ArrowRight, Sparkles, Target, Lock, Check } from 'lucide-react';
import { JOURNEY_STEPS, JOURNEY_CHAPTERS, humanize } from './hubConfig';
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

export default function HubJourney({ journey, chapters, navigate }) {
  // Chapter TRUTH from the backend model. Fallback (older payload / fetch miss): a single
  // Getting Started chapter derived from the 4 J0 facts — honest, never fabricated.
  const model = Array.isArray(chapters) && chapters.length
    ? chapters
    : [{
        key: 'getting_started',
        unlocked: true,
        complete: JOURNEY_STEPS.every((s) => journey && journey[s.key]),
        facts: journey || {},
      }];

  const total = model.length;
  const completeCount = model.filter((c) => c.complete).length;
  // Current chapter = first unlocked-but-incomplete chapter (visual emphasis).
  const active = model.find((c) => c.unlocked && !c.complete) || null;
  const gettingStarted = model.find((c) => c.key === 'getting_started');

  // Ch.1 next real step + destination (drives the Continue CTA + roadmap emphasis).
  const nextStep = JOURNEY_STEPS.find((s) => !(journey && journey[s.key]));
  const dest = nextStep
    ? (nextStep.key === 'hasCompletedOnboarding' ? '/dashboard/profile' : '/dashboard/send')
    : null;

  const meaningOf = (key) => JOURNEY_CHAPTERS[key] || { label: humanize(key), blurb: '', lockedBlurb: '' };
  const activeMeaning = active ? meaningOf(active.key) : null;

  return (
    <div className="hub-card hub-journey" style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-xl)',
      padding: '2.5rem',
      marginBottom: '2rem',
      border: '1px solid var(--border)'
    }}>
      <h2 style={{
        fontSize: '1.375rem', fontWeight: 700, color: 'var(--text-primary)',
        marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem'
      }}>
        <Heart size={22} style={{ color: '#ec4899' }} fill="#ec4899" />
        Your Hearts Journey
      </h2>
      <p style={{ fontSize: '0.95rem', color: 'var(--text-secondary)', margin: '0 0 1.25rem', lineHeight: 1.5 }}>
        Four chapters, one lifetime story — each opens as you and Greet-Me grow together.
      </p>

      {/* 1) BAND: lifetime Ring | Current Chapter | Keep Going */}
      <div className="hub-journey-band">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
          <HubJourneyRing reachedCount={completeCount} total={total} />
          <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {completeCount} of {total} chapters
          </span>
        </div>

        <div className="hub-journey-current" style={{
          padding: '1.375rem 1.5rem', borderRadius: 'var(--radius-lg)',
          background: 'linear-gradient(135deg, rgba(236, 72, 153, 0.10) 0%, rgba(190, 24, 93, 0.04) 100%)',
          border: '1px solid rgba(236, 72, 153, 0.25)', borderLeft: '4px solid #ec4899'
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
              {active ? 'Current Chapter' : 'Your Story So Far'}
            </p>
          </div>
          <p style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: '0 0 0.5rem', lineHeight: 1.3 }}>
            {active ? activeMeaning.label : 'Every open chapter reached'}
          </p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
            {active ? activeMeaning.blurb : 'You’ve reached every chapter open to you so far — beautifully done.'}
          </p>
        </div>

        <div style={{
          padding: '1.125rem 1.25rem', borderRadius: 'var(--radius-lg)',
          background: 'rgba(236, 72, 153, 0.06)', border: '1px solid rgba(236, 72, 153, 0.20)',
          display: 'flex', flexDirection: 'column', gap: '0.5rem'
        }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '2.5rem', height: '2.5rem', borderRadius: '50%', background: 'rgba(236, 72, 153, 0.15)'
          }}>
            <Sparkles size={22} style={{ color: '#ec4899' }} />
          </span>
          <p style={ZONE_LABEL}>Keep Going</p>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
            You’re building something meaningful — one heartfelt moment at a time.
          </p>
        </div>
      </div>

      {/* 2) CHAPTER SCAFFOLD — all 4 canonical chapters with truthful state */}
      <div role="list" aria-label="Your Journey chapters" style={{ display: 'flex', flexDirection: 'column', gap: '0.625rem', marginTop: '0.25rem' }}>
        {model.map((ch, i) => {
          const meaning = meaningOf(ch.key);
          const state = ch.complete ? 'complete' : (ch.unlocked ? 'active' : 'locked');
          const isActive = active && ch.key === active.key;
          const accent = state === 'locked' ? 'var(--border)' : '#ec4899';
          return (
            <div
              key={ch.key}
              role="listitem"
              aria-label={`Chapter ${i + 1}: ${meaning.label} — ${state}`}
              style={{
                display: 'flex', alignItems: 'flex-start', gap: '0.875rem',
                padding: '0.875rem 1rem', borderRadius: 'var(--radius-lg)',
                background: state === 'locked' ? 'var(--bg-secondary)' : 'rgba(236, 72, 153, 0.06)',
                border: `1px solid ${isActive ? 'rgba(236,72,153,0.35)' : 'var(--border)'}`,
                opacity: state === 'locked' ? 0.72 : 1,
              }}
            >
              <span aria-hidden="true" style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                width: '1.875rem', height: '1.875rem', borderRadius: '50%', marginTop: '0.0625rem',
                background: state === 'complete' ? 'linear-gradient(135deg,#ec4899,#be185d)' : (state === 'locked' ? 'var(--border)' : 'rgba(236,72,153,0.15)'),
                color: state === 'complete' ? 'white' : (state === 'locked' ? 'var(--text-secondary)' : '#be185d'),
                fontSize: '0.8125rem', fontWeight: 700,
              }}>
                {state === 'complete' ? <Check size={16} /> : state === 'locked' ? <Lock size={14} /> : i + 1}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: '1rem', fontWeight: 700, margin: '0 0 0.125rem',
                  color: state === 'locked' ? 'var(--text-secondary)' : 'var(--text-primary)'
                }}>
                  {meaning.label}
                </p>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                  {state === 'locked' ? (meaning.lockedBlurb || 'Opens later in your journey.') : meaning.blurb}
                </p>
                {/* T5.4 — inline milestone recognition (no modal, no takeover) */}
                {state === 'complete' && (
                  <p style={{
                    display: 'inline-flex', alignItems: 'center', gap: '0.3125rem',
                    fontSize: '0.8125rem', fontWeight: 700, color: '#be185d', margin: '0.375rem 0 0'
                  }}>
                    <Sparkles size={14} style={{ color: '#ec4899' }} /> Chapter complete
                  </p>
                )}
              </div>
              <span aria-hidden="true" style={{ ...ZONE_LABEL, margin: 0, color: accent, alignSelf: 'center' }}>
                {state === 'complete' ? 'Done' : state === 'locked' ? 'Locked' : 'Open'}
              </span>
            </div>
          );
        })}
      </div>

      {/* 3) Ch.1 ROADMAP — the 4 real J0 facts, while Getting Started is still the active chapter */}
      {gettingStarted && !gettingStarted.complete && (
        <div style={{ marginTop: '1.25rem' }}>
          <HubJourneyRoadmap journey={journey} />
        </div>
      )}

      {/* 4) CONTINUE CTA — the real next step within Getting Started */}
      {nextStep && (
        <button
          className="hub-btn"
          onClick={() => navigate(dest)}
          style={{
            marginTop: '1.75rem', width: '100%', display: 'inline-flex', alignItems: 'center',
            justifyContent: 'center', gap: '0.5rem',
            background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)', color: 'white',
            border: 'none', borderRadius: 'var(--radius-lg)', padding: '1rem 1.25rem',
            fontSize: '1rem', fontWeight: 700, letterSpacing: '0.01em', cursor: 'pointer',
            boxShadow: '0 8px 22px -6px rgba(236, 72, 153, 0.5)', fontFamily: 'inherit'
          }}
        >
          Continue your journey
          <ArrowRight size={18} />
        </button>
      )}
    </div>
  );
}
