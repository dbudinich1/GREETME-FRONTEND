// src/pages/PublicGreetingCard.jsx
// Public greeting card view using GreetingCardProto
// Route: /g/:jobId

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/api';
import { getErrorMessage } from '../utils/errorMessages';
import { GreetingCard as GreetingCardProto } from '../components/GreetingCardProto';
import { useAccountState } from '../hooks/useAccountState';
import { shouldShowFirstTimeCTA, isSenderViewingOwnGreeting } from '../utils/accountState';

export default function PublicGreetingCard() {
  const { jobId } = useParams();
  // Phase 3D Batch D Slice 3 — gate the viral-loop CTA panel on first-time
  // visitor state. Authenticated viewers (senders, recipients with accounts)
  // still see the card and footer; only the register-loop CTA is suppressed.
  const accountState = useAccountState();

  const [greeting, setGreeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadGreeting();
  }, [jobId]);

  // Auto-poll while greeting is processing (check every 5s, max 5 min)
  useEffect(() => {
    if (!greeting || greeting.status === 'done' || greeting.status === 'completed') return;
    const start = Date.now();
    const interval = setInterval(async () => {
      if (Date.now() - start > 5 * 60 * 1000) { clearInterval(interval); return; }
      try {
        const res = await api.getPublicGreeting(jobId);
        if (res?.ok && res.greeting && (res.greeting.status === 'done' || res.greeting.status === 'completed')) {
          clearInterval(interval);
          loadGreeting(); // full reload with all fields
        }
      } catch {}
    }, 5000);
    return () => clearInterval(interval);
  }, [greeting?.status, jobId]);

  // Dynamic document title (Task 4.1)
  useEffect(() => {
    if (greeting) {
      document.title = `${greeting.senderName} sent you a Greet-Me™ greeting!`;
    }
    return () => { document.title = 'Greet-Me™ | Forget Them Not!™'; };
  }, [greeting]);

  // Growth Engine: GREETING_OPENED event (fire-and-forget, first-open-only)
  // Phase 1 semantic: fires on page load (envelope screen), NOT on Finale reached.
  // "They opened it" = "they opened your greeting link." Acceptable for launch.
  // Phase 2: move trigger to Finale screen via GreetingCard onScreenChange callback.
  useEffect(() => {
    if (greeting && jobId && !greeting.isOnboardingTestSend) {
      api.trackGreetingOpened(jobId).catch(() => {});
    }
  }, [greeting, jobId]);

  const loadGreeting = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getPublicGreeting(jobId);

      if (response?.ok && response?.greeting) {
        const g = response.greeting;
        setGreeting({
          jobId: g.jobId || jobId,
          recipientName: g.recipientName || 'Friend',
          senderName: g.senderName || 'Someone special',
          greetingText: g.greetingText || '',
          writtenIntroText: g.writtenIntroText || '',
          poemText: g.poemText || '',
          finaleText: g.finaleText || '',
          occasionKey: g.occasionKey || 'general',
          relationshipKey: g.relationshipKey || '',
          videoUrl: g.videoUrl || null,
          photoUrl: g.photoUrl || null,
          photos: g.photos || [],
          status: g.status || 'done',
          hasGift: g.hasGift || false,
          gift: g.gift || null,
          courtesyCreditCode: g.courtesyCreditCode || null,
          isOnboardingTestSend: g.isOnboardingTestSend === true,
          // Phase 3D Batch D D6 — opaque sender id (added in backend 5634cd4)
          // for client-side owner-self-encounter detection only. Null if missing.
          senderUserId: g.senderUserId || null,
        });
      } else {
        setError('not_found');
      }
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 410) {
        setError('expired');
      } else if (status === 404) {
        setError('not_found');
      } else {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f3f0',
        gap: '1rem',
      }}>
        <div style={{
          display: 'flex',
          gap: '6px',
        }}>
          {[0, 1, 2].map((i) => (
            <div key={i} style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              background: '#9ca3af',
              animation: `greetPulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
        <p style={{
          color: '#6b7280',
          fontSize: '1rem',
          fontFamily: 'Georgia, serif',
        }}>
          Loading your greeting&hellip;
        </p>
        <style>{`
          @keyframes greetPulse {
            0%, 100% { opacity: 0.3; transform: scale(0.8); }
            50% { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </div>
    );
  }

  // Error / expired / not found state (Task 4.3)
  if (error || !greeting) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f3f0',
        padding: '2rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          maxWidth: '500px',
          textAlign: 'center',
          padding: '2rem',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💌</div>
          <h2 style={{ color: '#1B2A4A', margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700 }}>
            {error === 'expired' ? 'This greeting has expired' : 'This greeting is unavailable'}
          </h2>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
            {error === 'expired'
              ? 'Greet-Me™ greetings are available for a limited time to keep your moments special. This greeting is no longer accessible.'
              : 'The link may have expired or the greeting doesn\'t exist.'}
          </p>
          <p style={{ color: '#888', fontSize: '0.9rem', margin: '0 0 1.25rem' }}>
            Want to send your own heartfelt greeting?
          </p>
          <a href="/" style={{
            display: 'inline-block',
            padding: '12px 28px',
            background: '#3A7BD5',
            color: '#FFF',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '1rem',
          }}>
            Create a Greet-Me™
          </a>
          <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#AAA' }}>
            © 2026 Greet-Me™ · Forget Them Not!™
          </p>
        </div>
      </div>
    );
  }

  // Failed state
  if (greeting.status === 'failed') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f3f0',
        padding: '2rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          maxWidth: '500px',
          textAlign: 'center',
          padding: '2rem',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>😔</div>
          <h2 style={{ color: '#1B2A4A', margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700 }}>
            This greeting couldn't be created
          </h2>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
            Something went wrong while preparing this greeting. Please contact the sender to request a new one.
          </p>
          <a href="/" style={{
            display: 'inline-block',
            padding: '12px 28px',
            background: '#3A7BD5',
            color: '#FFF',
            borderRadius: '8px',
            fontWeight: 600,
            textDecoration: 'none',
            fontSize: '1rem',
          }}>
            Learn About Greet-Me™
          </a>
          <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#AAA' }}>
            © 2026 Greet-Me™ · Forget Them Not!™
          </p>
        </div>
      </div>
    );
  }

  // Still processing state
  if (greeting.status !== 'done' && greeting.status !== 'completed') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f3f0',
        padding: '2rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <div style={{
          maxWidth: '500px',
          textAlign: 'center',
          padding: '2rem',
        }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'greetPulse 1.2s ease-in-out infinite' }}>✨</div>
          <h2 style={{ color: '#1B2A4A', margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700 }}>
            Your greeting is being prepared
          </h2>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6 }}>
            Someone special is crafting a personalized greeting just for you. This page will update automatically.
          </p>
          <p style={{ marginTop: '2rem', fontSize: '0.8rem', color: '#AAA' }}>
            Powered by Greet-Me™ · Forget Them Not!™
          </p>
        </div>
      </div>
    );
  }

  // Render the premium greeting card experience with wrapper
  return (
    <div className="gc-public-wrapper" style={{ minHeight: '100vh', background: '#f5f3f0' }}>
      {/* Branded header — subtle, tasteful (hidden in landscape via CSS) */}
      <div className="gc-public-chrome" style={{
        textAlign: 'center',
        padding: '1rem 1rem 0.5rem',
      }}>
        <p style={{
          fontSize: '0.8rem',
          color: '#9ca3af',
          margin: 0,
          letterSpacing: '0.05em',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}>
          <span style={{ fontWeight: 600 }}>Greet-Me™</span>
          <span style={{ margin: '0 0.5rem', opacity: 0.4 }}>·</span>
          <span style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>Forget Them Not!™</span>
        </p>
      </div>

      {/* Premium greeting card experience.
          Phase 3D Batch D D6 — isOwner prop pass-through for sender-self-encounter
          suppression of claim CTAs on the Finale spread. No layout/animation impact. */}
      <GreetingCardProto
        greeting={greeting}
        isOwner={isSenderViewingOwnGreeting({ greeting, userId: accountState.userId })}
      />

      {/* QR Cash™ claim lives inside the FinaleSpread (right page of the card) */}

      {/* "Send Your Own" CTA (Viral Loop) — hidden in landscape via CSS.
          Phase 3D Batch D Slice 3: first-time visitors only.
          Authenticated viewers see the card and footer without this panel. */}
      {shouldShowFirstTimeCTA(accountState) && (
        <div className="gc-public-chrome" style={{
          maxWidth: '640px',
          margin: '2rem auto 0',
          padding: '0 1rem',
        }}>
          <div style={{
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #3A7BD5 0%, #1B2A4A 100%)',
            borderRadius: '16px',
            textAlign: 'center',
            color: '#FFF',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.2rem', fontWeight: 700 }}>
              Create one of your own
            </h3>
            <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', opacity: 0.9, lineHeight: 1.5 }}>
              Send a Greet-Me in under a minute.
            </p>
            <a href="/#/register?fast=1" style={{
              display: 'inline-block',
              padding: '12px 32px',
              background: '#FFF',
              color: '#3A7BD5',
              borderRadius: '8px',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '1rem',
              minHeight: '44px',
              lineHeight: '20px',
            }}>
              Create Yours
            </a>
          </div>
        </div>
      )}

      {/* Footer — hidden in landscape via CSS */}
      <footer className="gc-public-chrome" style={{
        textAlign: 'center',
        padding: '2rem 1rem',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}>
        <p style={{ fontSize: '0.8rem', color: '#9ca3af', margin: '0 0 0.25rem' }}>
          © 2026 Greet-Me™. All rights reserved.
        </p>
        <p style={{ fontSize: '0.75rem', color: '#b0b0b0', margin: '0 0 0.5rem', fontStyle: 'italic' }}>
          Forget Them Not!™
        </p>
        <div style={{ fontSize: '0.75rem', color: '#b0b0b0' }}>
          <a href="/#/support" style={{ color: '#9ca3af', textDecoration: 'none' }}>Support</a>
          <span style={{ margin: '0 0.5rem', opacity: 0.4 }}>·</span>
          <a href="/#/legal#privacy" style={{ color: '#9ca3af', textDecoration: 'none' }}>Privacy</a>
          <span style={{ margin: '0 0.5rem', opacity: 0.4 }}>·</span>
          <a href="/#/legal#terms" style={{ color: '#9ca3af', textDecoration: 'none' }}>Terms</a>
        </div>
      </footer>
    </div>
  );
}
