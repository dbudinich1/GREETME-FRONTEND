// src/pages/PublicGreetingCard.jsx
// Public greeting card view using GreetingCardProto
// Route: /g/:jobId

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/api';
import { getErrorMessage } from '../utils/errorMessages';
import { GreetingCard as GreetingCardProto } from '../components/GreetingCardProto';

export default function PublicGreetingCard() {
  const { jobId } = useParams();

  const [greeting, setGreeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadGreeting();
  }, [jobId]);

  // Dynamic document title (Task 4.1)
  useEffect(() => {
    if (greeting) {
      document.title = `${greeting.senderName} sent you a Greet-Me™ greeting!`;
    }
    return () => { document.title = 'Greet-Me™ | Forget Them Not!™'; };
  }, [greeting]);

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
          photos: g.photos || [],
          status: g.status || 'done',
          hasGift: g.hasGift || false,
          gift: g.gift || null,
        });
      } else {
        setError('not_found');
      }
    } catch (err) {
      console.error('Error loading greeting:', err);
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
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f5f3f0',
      }}>
        <p style={{
          color: '#6b7280',
          fontSize: '1rem',
          fontFamily: 'Georgia, serif',
        }}>
          Loading your greeting...
        </p>
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
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✨</div>
          <h2 style={{ color: '#1B2A4A', margin: '0 0 0.75rem', fontSize: '1.5rem', fontWeight: 700 }}>
            Your greeting is being prepared...
          </h2>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6 }}>
            Someone special is crafting a personalized greeting just for you. Please check back in a few minutes.
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

      {/* Premium greeting card experience */}
      <GreetingCardProto greeting={greeting} />

      {/* QR Cash™ Gift Claim Section */}
      {greeting.hasGift && greeting.gift?.claimUrl && (
        <div style={{
          maxWidth: '640px',
          margin: '2rem auto 0',
          padding: '0 1rem',
        }}>
          <div style={{
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
            borderRadius: '16px',
            textAlign: 'center',
            border: '1px solid #fcd34d',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}>
            <h3 style={{ margin: '0 0 0.25rem', fontSize: '1.25rem', fontWeight: 700, color: '#92400e' }}>
              You also received QR Cash™!
            </h3>
            <p style={{ margin: '0 0 0.25rem', fontSize: '1.1rem', color: '#b45309', fontWeight: 600 }}>
              ${(greeting.gift.amount || 0).toFixed(2)} is waiting for you
            </p>
            <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: '#92400e' }}>
              Tap below to claim your gift
            </p>
            <a href={greeting.gift.claimUrl} style={{
              display: 'inline-block',
              padding: '14px 32px',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              color: '#FFF',
              borderRadius: '10px',
              fontWeight: 700,
              textDecoration: 'none',
              fontSize: '1.05rem',
              minHeight: '44px',
              lineHeight: '20px',
              boxShadow: '0 2px 8px rgba(245, 158, 11, 0.3)',
            }}>
              Claim Your QR Cash™ Gift
            </a>
            {greeting.gift.qrUrl && (
              <div style={{ marginTop: '1rem' }}>
                <p style={{ fontSize: '0.75rem', color: '#b45309', margin: '0 0 0.5rem' }}>Or scan this QR code:</p>
                <a href={greeting.gift.claimUrl} style={{ display: 'inline-block' }}>
                  <img
                    src={greeting.gift.qrUrl}
                    alt="QR Cash QR Code"
                    style={{ width: '160px', height: 'auto', borderRadius: '8px' }}
                  />
                </a>
              </div>
            )}
          </div>
        </div>
      )}

      {/* "Send Your Own" CTA (Viral Loop) — hidden in landscape via CSS */}
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
            ✨ Touched by this greeting?
          </h3>
          <p style={{ margin: '0 0 1rem', fontSize: '0.95rem', opacity: 0.9, lineHeight: 1.5 }}>
            Send your own personalized animated greeting to someone you love.
          </p>
          <a href="/" style={{
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
            Create Your Greet-Me™
          </a>
        </div>
      </div>

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
          <a href="/#/privacy" style={{ color: '#9ca3af', textDecoration: 'none' }}>Privacy</a>
          <span style={{ margin: '0 0.5rem', opacity: 0.4 }}>·</span>
          <a href="/#/terms" style={{ color: '#9ca3af', textDecoration: 'none' }}>Terms</a>
        </div>
      </footer>
    </div>
  );
}
