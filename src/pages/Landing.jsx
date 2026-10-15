// src/pages/Landing.jsx
// Public entry screen for unauthenticated users; redirects logged-in users to dashboard

import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GreetMeLogo from '../components/GreetMeLogo';
import useIntroVideo from '../hooks/useIntroVideo';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

// Intro video. FAST_START is the same video (content, narration, music, length) re-encoded at 1080p
// with its playback index first, 5.3 MB instead of 114 MB. ORIGINAL is the file the page has always
// played; it stays untouched as the fallback and the rollback.
const INTRO_VIDEO_FAST_START = 'https://greetmedanny.blob.core.windows.net/public/greetme-intro-v2.mp4';
const INTRO_VIDEO_ORIGINAL = 'https://greetmedanny.blob.core.windows.net/public/greetme-demo.mp4.mp4';
const INTRO_VIDEO_PRELOAD = 'auto';

export default function Landing() {
  const { isAuthenticated, loading } = useAuth();
  const navigate = useNavigate();
  // Intro video: TAP TO PLAY, NO AUTOPLAY (founder, 2026-10-15). The first tap plays from the start
  // with sound; then the same tap pauses and resumes; after the end it replays. Load state drives the
  // branded placeholder/fallback so the hero never renders as an empty charcoal box. (P0.3)
  const intro = useIntroVideo();
  const videoStatus = intro.status;

  // Demo mode: ?demo=1 prevents auth redirect so founder can show landing while logged in
  const isDemoView = new URLSearchParams(window.location.hash.split('?')[1] || '').get('demo') === '1';
  useEffect(() => {
    if (!loading && isAuthenticated && !isDemoView) {
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, navigate, isDemoView]);

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f3f0' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #e5e7eb', borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (isAuthenticated && !isDemoView) return null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(160deg, #f5f3f0 0%, #ede9e3 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '2rem 1.5rem',
      fontFamily: FONT,
    }}>
      {/* Logo */}
      <div style={{ marginBottom: '1rem' }}>
        <GreetMeLogo />
      </div>

      {/* Headline */}
      <h1 style={{
        fontSize: '1.75rem',
        fontWeight: 700,
        color: '#1f2937',
        lineHeight: 1.3,
        margin: '0 0 0.5rem',
        textAlign: 'center',
        maxWidth: '600px',
      }}>
        Your voice. Their moment.<br />Delivered automatically on every occasion you set up.
      </h1>

      {/* Subheadline */}
      <p style={{
        fontSize: '0.9375rem',
        color: '#6b7280',
        lineHeight: 1.6,
        margin: '0 0 1.25rem',
        textAlign: 'center',
        maxWidth: '540px',
      }}>
        Create premium personalized greetings using your voice and photo&mdash;send a personalized greeting to everyone
        on your list automatically, and add a gift to any occasion.
      </p>

      {/* Demo video — large, central */}
      <div style={{
        width: '100%',
        maxWidth: '640px',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 12px 40px rgba(0,0,0,0.12)',
        background: '#000',
        marginBottom: '1.5rem',
        position: 'relative',
        // Reserve a branded area while loading/failed; once ready the video drives height.
        minHeight: videoStatus === 'ready' ? undefined : '320px',
        cursor: 'pointer',
      }}
        onClick={intro.tap}
      >
        <video
          ref={intro.videoRef}
          preload={INTRO_VIDEO_PRELOAD}
          playsInline
          {...intro.videoEvents}
          style={{ width: '100%', display: videoStatus === 'failed' ? 'none' : 'block', background: '#1f2937' }}
        >
          {/* The same video, re-encoded with its playback index at the start, then the original as a
              fallback: if the first cannot load (e.g. not uploaded yet), the browser moves to the
              next source by itself. A <source> that cannot be fetched reports its own error, so that
              case is driven by the LAST source. */}
          <source src={INTRO_VIDEO_FAST_START} type="video/mp4" />
          <source src={INTRO_VIDEO_ORIGINAL} type="video/mp4" onError={intro.lastSourceError} />
        </video>

        {/* Loading placeholder — branded; prevents an empty charcoal box during load */}
        {videoStatus === 'loading' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '0.5rem', textAlign: 'center', padding: '1rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff',
          }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.02em' }}>Greet&#8209;Me</div>
            <div style={{ fontSize: '0.8125rem', opacity: 0.9 }}>Loading demo&hellip;</div>
          </div>
        )}

        {/* Failure fallback — branded; safe link to the demo; never a black box */}
        {videoStatus === 'failed' && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: '0.5rem', textAlign: 'center', padding: '1.25rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: '#fff',
          }}>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, letterSpacing: '0.02em' }}>Greet&#8209;Me</div>
            <div style={{ fontSize: '0.875rem', opacity: 0.95, maxWidth: '22rem' }}>
              See how a Greet-Me comes to life.
            </div>
            <a
              href={INTRO_VIDEO_ORIGINAL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              style={{
                marginTop: '0.25rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                background: '#fff', color: '#5b3fb8', textDecoration: 'none',
                borderRadius: '2rem', padding: '0.5rem 1rem', fontSize: '0.875rem', fontWeight: 700,
              }}
            >
              ▶ Watch the demo
            </a>
          </div>
        )}

        {/* Tap-for-sound — only once the video is actually ready/playing */}
        {videoStatus === 'ready' && !intro.started && (
          <div style={{
            position: 'absolute',
            bottom: '0.75rem',
            right: '0.75rem',
            background: 'rgba(0,0,0,0.6)',
            color: '#fff',
            borderRadius: '2rem',
            padding: '0.4rem 0.75rem',
            fontSize: '0.75rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            backdropFilter: 'blur(4px)',
          }}>
            🔇 Tap for sound
          </div>
        )}
      </div>

      {/* CTA card */}
      <div style={{
        maxWidth: '480px',
        width: '100%',
        background: '#fff',
        borderRadius: '16px',
        padding: '2rem',
        boxShadow: '0 8px 32px rgba(0,0,0,0.08)',
        textAlign: 'center',
      }}>
        {/* Primary CTA */}
        <button
          onClick={() => navigate('/register')}
          style={{
            width: '100%',
            padding: '1rem',
            background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
            color: '#fff',
            border: 'none',
            borderRadius: '12px',
            fontSize: '1.125rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: FONT,
            transition: 'transform 0.15s, box-shadow 0.15s',
            boxShadow: '0 4px 14px rgba(99, 102, 241, 0.35)',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(99, 102, 241, 0.45)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 14px rgba(99, 102, 241, 0.35)'; }}
        >
          Test a Greet-Me
        </button>

        <p style={{
          fontSize: '0.8125rem',
          color: '#9ca3af',
          margin: '0.75rem 0 0',
          fontStyle: 'italic',
        }}>
          Takes less than a minute. No commitment.
        </p>

        {/* Guest benefit note */}
        <div style={{
          marginTop: '1.25rem',
          padding: '0.875rem',
          background: '#f0fdf4',
          borderRadius: '10px',
          border: '1px solid #bbf7d0',
        }}>
          <p style={{
            fontSize: '0.875rem',
            fontWeight: 600,
            color: '#166534',
            margin: '0 0 0.25rem',
          }}>
            New accounts include 5 free sends during your 7-day trial.
          </p>
          <p style={{
            fontSize: '0.75rem',
            color: '#4ade80',
            margin: 0,
          }}>
            Your onboarding test Greet-Me is free and does not count against them.
          </p>
        </div>
      </div>

      {/* Existing account link */}
      <p style={{
        marginTop: '1.25rem',
        fontSize: '0.875rem',
        color: '#6b7280',
      }}>
        Already have an account?{' '}
        <Link to="/login" style={{ color: '#6366f1', fontWeight: 600, textDecoration: 'none' }}>
          Sign in
        </Link>
      </p>

      {/* Footer */}
      <p style={{
        marginTop: '1.5rem',
        fontSize: '0.75rem',
        color: '#9ca3af',
      }}>
        &copy; 2026 Greet-Me&trade; &middot; Forget Them Not!&trade;
      </p>
      <p style={{
        marginTop: '0.5rem',
        fontSize: '0.75rem',
        color: '#9ca3af',
      }}>
        <a href="#/support" style={{ color: '#9ca3af', textDecoration: 'underline' }}>Support</a>
        {' · '}
        <a href="#/legal" style={{ color: '#9ca3af', textDecoration: 'underline' }}>Legal</a>
      </p>
    </div>
  );
}
