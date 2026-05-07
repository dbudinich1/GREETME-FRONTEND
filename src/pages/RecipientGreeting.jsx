// src/pages/RecipientGreeting.jsx
// Public recipient greeting view - no auth required
// V1: Structure + flow only, minimal styling

import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/api';
import { getErrorMessage } from '../utils/errorMessages';

// localStorage key pattern for thank you tracking
const getThankYouKey = (greetingId) => `greetme_thank_you_sent_${greetingId}`;

// Check if thank you already sent for this greeting
const hasThankYouBeenSent = (greetingId) => {
  return localStorage.getItem(getThankYouKey(greetingId)) === 'true';
};

// Mark thank you as sent
const markThankYouSent = (greetingId) => {
  localStorage.setItem(getThankYouKey(greetingId), 'true');
};

// Generate thank you text (template-based, no AI cost V1)
// 2-3 sentences, ~280 char hard cap
const generateThankYouText = (senderName, recipientNote) => {
  const name = senderName || 'Friend';
  const note = (recipientNote || '').trim().slice(0, 100);

  // Simple, warm templates (~280 chars max)
  const templates = [
    `Thank you so much for the thoughtful greeting, ${name}! It really made my day special. I'm so grateful to have you in my life.`,
    `${name}, your greeting meant the world to me! Thank you for taking the time to send such a warm message. It truly brightened my day.`,
    `What a wonderful surprise! Thank you, ${name}, for thinking of me. Your kindness and thoughtfulness are truly appreciated.`,
  ];

  const index = (name.length + note.length) % templates.length;
  let text = templates[index];

  // Append note if provided
  if (note) {
    text = text.replace('!', ` - ${note}!`);
  }

  return text.slice(0, 280);
};

export default function RecipientGreeting() {
  const { greetingId } = useParams();

  // State
  const [greeting, setGreeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [thankYouSent, setThankYouSent] = useState(false);
  const [showThankYouPanel, setShowThankYouPanel] = useState(false);
  const [recipientNote, setRecipientNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');

  useEffect(() => {
    loadGreeting();
    setThankYouSent(hasThankYouBeenSent(greetingId));
  }, [greetingId]);

  // Dynamic document title
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

      // Try backend first
      const response = await api.getPublicGreeting(greetingId);

      if (response && response.senderName && response.videoUrl) {
        setGreeting({
          greetingId: response.greetingId || greetingId,
          senderName: response.senderName,
          recipientName: response.recipientName,
          videoUrl: response.videoUrl,
          sentAt: response.sentAt,
          greetingTitle: response.greetingTitle || null,
          senderEmail: response.senderEmail,
        });
      } else {
        // Fallback: check localStorage for V1 testing
        const stored = JSON.parse(localStorage.getItem('greetme_sent_greetings') || '[]');
        const found = stored.find(g => g.id === greetingId || g.greetingId === greetingId);

        if (found && found.senderName && found.videoUrl) {
          setGreeting({
            greetingId: found.id || found.greetingId || greetingId,
            senderName: found.senderName,
            recipientName: found.recipientName,
            videoUrl: found.videoUrl,
            sentAt: found.sentAt || found.createdAt,
            greetingTitle: found.greetingTitle || null,
            senderEmail: found.senderEmail,
          });
        } else {
          setError('unavailable');
        }
      }
    } catch (err) {
      console.error('Error loading greeting:', err);
      // Check localStorage fallback
      try {
        const stored = JSON.parse(localStorage.getItem('greetme_sent_greetings') || '[]');
        const found = stored.find(g => g.id === greetingId || g.greetingId === greetingId);

        if (found && found.senderName && found.videoUrl) {
          setGreeting({
            greetingId: found.id || found.greetingId || greetingId,
            senderName: found.senderName,
            recipientName: found.recipientName,
            videoUrl: found.videoUrl,
            sentAt: found.sentAt || found.createdAt,
            greetingTitle: found.greetingTitle || null,
            senderEmail: found.senderEmail,
          });
        } else {
          setError(getErrorMessage(err));
        }
      } catch {
        setError(getErrorMessage(err));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendThankYou = async () => {
    if (thankYouSent || sending) return;

    setSending(true);
    setSendError('');

    const thankYouText = generateThankYouText(greeting.senderName, recipientNote);

    try {
      // Try backend
      await api.sendThankYou(greetingId, {
        message: thankYouText,
        recipientNote: recipientNote.slice(0, 100),
      });

      // Mark as sent
      markThankYouSent(greetingId);
      setThankYouSent(true);
      setShowThankYouPanel(false);
    } catch (err) {
      // V1 fallback: simulate success, store locally
      console.warn('Backend unavailable, storing locally:', err);

      const log = JSON.parse(localStorage.getItem('greetme_thank_you_log') || '[]');
      log.push({
        greetingId,
        to: greeting.senderEmail,
        toName: greeting.senderName,
        fromName: greeting.recipientName,
        subject: 'You received a Thank You!',
        body: thankYouText,
        sentAt: new Date().toISOString(),
      });
      localStorage.setItem('greetme_thank_you_log', JSON.stringify(log));

      // Mark as sent
      markThankYouSent(greetingId);
      setThankYouSent(true);
      setShowThankYouPanel(false);
    } finally {
      setSending(false);
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
        background: '#f9fafb',
      }}>
        <p style={{ color: '#6b7280', fontSize: '1rem' }}>Loading greeting...</p>
      </div>
    );
  }

  // Error/unavailable state (branded)
  if (error || !greeting) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#f9fafb',
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
            This greeting has expired
          </h2>
          <p style={{ color: '#666', fontSize: '1rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
            Greet-Me™ greetings are available for a limited time to keep your moments special.
            This greeting is no longer accessible.
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

  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      padding: '1rem',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    }}>
      <div style={{
        maxWidth: '640px',
        margin: '0 auto',
      }}>
        {/* Branded header */}
        <div style={{
          textAlign: 'center',
          padding: '0.5rem 0',
          marginBottom: '0.5rem',
        }}>
          <p style={{
            fontSize: '0.8rem',
            color: '#9ca3af',
            margin: 0,
            letterSpacing: '0.05em',
          }}>
            <span style={{ fontWeight: 600 }}>Greet-Me™</span>
            <span style={{ margin: '0 0.5rem', opacity: 0.4 }}>·</span>
            <span style={{ fontStyle: 'italic', fontSize: '0.75rem' }}>Forget Them Not!™</span>
          </p>
        </div>

        {/* Sender Context */}
        <div style={{
          textAlign: 'center',
          marginBottom: '1rem',
          paddingTop: '0.5rem',
        }}>
          <p style={{
            fontSize: '1.125rem',
            color: '#374151',
            margin: '0 0 0.25rem',
            fontWeight: 600,
          }}>
            From {greeting.senderName}
          </p>
          {greeting.greetingTitle && (
            <p style={{
              fontSize: '0.9rem',
              color: '#6b7280',
              margin: 0,
              fontStyle: 'italic',
            }}>
              {greeting.greetingTitle}
            </p>
          )}
        </div>

        {/* Video Player */}
        <div style={{
          background: '#000',
          borderRadius: '12px',
          overflow: 'hidden',
          marginBottom: '1.5rem',
        }}>
          <video
            src={greeting.videoUrl}
            controls
            autoPlay={false}
            loop={false}
            playsInline
            style={{
              width: '100%',
              display: 'block',
            }}
          >
            Your browser does not support video playback.
          </video>
        </div>

        {/* Primary CTA: Send Thank You */}
        {!showThankYouPanel && (
          <button
            onClick={() => !thankYouSent && setShowThankYouPanel(true)}
            disabled={thankYouSent}
            style={{
              width: '100%',
              padding: '1rem',
              background: thankYouSent ? '#e5e7eb' : '#6366f1',
              color: thankYouSent ? '#6b7280' : 'white',
              border: 'none',
              borderRadius: '10px',
              fontSize: '1rem',
              fontWeight: 600,
              cursor: thankYouSent ? 'default' : 'pointer',
              fontFamily: 'inherit',
              marginBottom: '0.75rem',
            }}
          >
            {thankYouSent ? 'Thank You sent' : 'Send a Thank You (Free)'}
          </button>
        )}

        {/* Thank You Panel (inline) */}
        {showThankYouPanel && !thankYouSent && (
          <div style={{
            background: 'white',
            borderRadius: '10px',
            padding: '1.25rem',
            marginBottom: '0.75rem',
            border: '1px solid #e5e7eb',
          }}>
            <p style={{
              fontSize: '0.875rem',
              color: '#374151',
              marginBottom: '1rem',
            }}>
              Send a free thank you to {greeting.senderName}
            </p>

            <input
              type="text"
              value={recipientNote}
              onChange={(e) => setRecipientNote(e.target.value.slice(0, 100))}
              placeholder="Add a name or short note (optional)"
              maxLength={100}
              style={{
                width: '100%',
                padding: '0.75rem',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '0.875rem',
                fontFamily: 'inherit',
                marginBottom: '0.5rem',
                boxSizing: 'border-box',
              }}
            />
            <p style={{
              fontSize: '0.75rem',
              color: '#9ca3af',
              textAlign: 'right',
              marginBottom: '1rem',
            }}>
              {recipientNote.length}/100
            </p>

            {sendError && (
              <p style={{
                fontSize: '0.8125rem',
                color: '#ef4444',
                marginBottom: '1rem',
              }}>
                {sendError}
              </p>
            )}

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setShowThankYouPanel(false)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  background: 'white',
                  color: '#6b7280',
                  border: '1px solid #e5e7eb',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSendThankYou}
                disabled={sending}
                style={{
                  flex: 2,
                  padding: '0.75rem',
                  background: sending ? '#9ca3af' : '#6366f1',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: sending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                {sending ? 'Sending...' : 'Send Thank You'}
              </button>
            </div>
          </div>
        )}

        {/* Sent with love attribution */}
        <p style={{
          textAlign: 'center',
          fontSize: '0.8rem',
          color: '#9ca3af',
          marginBottom: '1.5rem',
          fontStyle: 'italic',
        }}>
          This greeting was sent with love using Greet-Me™
        </p>

        {/* "Send Your Own" CTA (Viral Loop) */}
        <div style={{
          padding: '1.5rem',
          background: 'linear-gradient(135deg, #3A7BD5 0%, #1B2A4A 100%)',
          borderRadius: '16px',
          textAlign: 'center',
          color: '#FFF',
          marginBottom: '2rem',
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

        {/* Footer */}
        <footer style={{ textAlign: 'center', paddingBottom: '2rem' }}>
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
    </div>
  );
}
