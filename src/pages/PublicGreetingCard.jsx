// src/pages/PublicGreetingCard.jsx
// Public greeting card view using GreetingCardProto
// Route: /g/:jobId

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/api';
import { getErrorMessage } from '../utils/errorMessages';
import { GreetingCard as GreetingCardProto } from '../components/GreetingCardProto';
// TEAM C — Phase A5: map the sanitized corporate projection into viewer facts (DORMANT;
// null for personal greetings, so the personal path is unchanged).
import { buildCorporateViewerFacts } from '../components/GreetingCardProto/corporateDelivery';
import { useAccountState } from '../hooks/useAccountState';
import { shouldShowFirstTimeCTA, isSenderViewingOwnGreeting } from '../utils/accountState';
// TEAM 4 (growth-loops verification pass, 2026-09-29) — reconnects two EXISTING, already-built
// entry points that had no way to be reached from the live recipient card route (/#/g/:jobId):
// the live Thank-You composer (ThankYouFlow.jsx, unchanged) and the canonical "Share the Love"
// panel (ShareTheLovePanel.jsx, unchanged — covers both the email-invite loop and the honest,
// untracked-while-dormant social broadcast tile). No new flow, no new endpoint, no new copy
// beyond what these components already say. The $5 credit CTA is intentionally NOT duplicated
// here — it already lives on the FinaleSpread back-of-card (see FinaleSpread.jsx) and Item A of
// the growth-loops brief calls for avoiding duplicated CTAs across unrelated locations.
import ShareTheLovePanel from '../components/ShareTheLovePanel';
import ExpiredGreetingNotice from '../components/ExpiredGreetingNotice';

export default function PublicGreetingCard() {
  const { jobId } = useParams();
  // Phase 3D Batch D Slice 3 — gate the viral-loop CTA panel on first-time
  // visitor state. Authenticated viewers (senders, recipients with accounts)
  // still see the card and footer; only the register-loop CTA is suppressed.
  const accountState = useAccountState();

  const [greeting, setGreeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expiredClaim, setExpiredClaim] = useState(null);
  const [showShareModal, setShowShareModal] = useState(false);

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
        // TEAM C — Phase A5: corporate viewer facts (null for personal → no new fields added
        // to the personal greeting object, so personal rendering stays byte-compatible).
        const corporateFacts = buildCorporateViewerFacts(g.corporatePresentation, {
          jobId: g.jobId || jobId,
          apiBase: import.meta.env.VITE_API_BASE || '',
        });
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
          // TEAM C — Phase A5: only present for corporate greetings. `corporate` +
          // `featuredSpreadPresent` drive resolveScreenOrder; `corporateFacts` drives the
          // Featured Spread rendering. Absent entirely for personal greetings.
          ...(corporateFacts
            ? { corporate: true, featuredSpreadPresent: corporateFacts.featuredSpreadPresent, corporateFacts }
            : {}),
        });
      } else {
        setError('not_found');
      }
    } catch (err) {
      const status = err?.status || err?.response?.status;
      if (status === 410) {
        setError('expired');
        setExpiredClaim(err?.data?.claim || null);
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
            {error === 'expired' ? 'This greeting is no longer available' : 'This greeting is unavailable'}
          </h2>
          {error === 'expired' ? (
            <ExpiredGreetingNotice claim={expiredClaim} />
          ) : (
            <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
              The link may have expired or the greeting doesn't exist.
            </p>
          )}
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

  const isViewerTheSender = isSenderViewingOwnGreeting({ greeting, userId: accountState.userId });

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
        isOwner={isViewerTheSender}
      />

      {/* QR Cash™ claim lives inside the FinaleSpread (right page of the card) */}

      {/* TEAM 4 — Recipient decision surface (growth-loops brief, Item A). Reconnects the
          existing Thank-You composer and Share-the-Love panel to the live recipient card
          route, which previously had no path to either. Recipient-only (the sender viewing
          their own sent greeting doesn't need to "thank" themselves); the $5 credit CTA is
          deliberately left where it already lives (FinaleSpread) rather than duplicated here. */}
      {!isViewerTheSender && (
        <div className="gc-public-chrome" style={{
          maxWidth: '640px',
          margin: '2rem auto 0',
          padding: '0 1rem',
        }}>
          <div style={{
            padding: '1.5rem',
            background: '#fff',
            borderRadius: '16px',
            textAlign: 'center',
            border: '1px solid #e5e7eb',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}>
            <h3 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem', fontWeight: 700, color: '#1B2A4A' }}>
              Enjoyed this Greet-Me?
            </h3>
            <p style={{ margin: '0 0 1.25rem', fontSize: '0.9rem', color: '#6b7280', lineHeight: 1.5 }}>
              Send a thank-you back to {greeting.senderName}, or share this moment with someone else.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <a href={`/#/thank-you?jobId=${greeting.jobId}`} style={{
                display: 'inline-block',
                padding: '10px 24px',
                background: '#4F2D7F',
                color: '#FFF',
                borderRadius: '8px',
                fontWeight: 600,
                textDecoration: 'none',
                fontSize: '0.9375rem',
              }}>
                Send a Thank-You
              </a>
              <button
                type="button"
                onClick={() => setShowShareModal(true)}
                style={{
                  display: 'inline-block',
                  padding: '10px 24px',
                  background: '#fff',
                  color: '#4F2D7F',
                  border: '1px solid #4F2D7F',
                  borderRadius: '8px',
                  fontWeight: 600,
                  fontSize: '0.9375rem',
                  cursor: 'pointer',
                }}
              >
                Share
              </button>
            </div>
          </div>
        </div>
      )}

      {showShareModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Share"
          onClick={() => setShowShareModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.6)', display: 'flex',
            alignItems: 'center', justifyContent: 'center',
            zIndex: 1000, padding: '1rem',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '480px', width: '100%', background: '#fffdf8',
              borderRadius: '1rem', padding: '1.5rem',
              boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
              maxHeight: '90dvh', overflowY: 'auto',
            }}
          >
            {/* 2026-10-08 — email invite (Mode A) only for the greeting's own sender: the backend
                share-invite returns 403 unless greeting.userId === caller, so recipients get the
                broadcast share only and are never promised invite Hearts they cannot earn. */}
            <ShareTheLovePanel
              jobId={isViewerTheSender ? greeting.jobId : undefined}
              shareUrl={`${window.location.origin}/#/g/${greeting.jobId}`}
              shareText={`${greeting.senderName} sent me a Greet-Me — come see what I mean.`}
              defaultMode={isViewerTheSender ? 'invite' : 'broadcast'}
              inviteRewardEligible={isViewerTheSender}
            />
            <button
              onClick={() => setShowShareModal(false)}
              style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '0.8125rem', cursor: 'pointer', marginTop: '0.75rem', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
            >
              Close
            </button>
          </div>
        </div>
      )}

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
