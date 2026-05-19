// src/components/ThankYouModal.jsx
// Cost-controlled text-only thank you greeting modal

import { useState, useEffect } from 'react';
import { X, Send, CheckCircle, Heart } from 'lucide-react';
import { generateThankYouMessage, sendThankYouEmail, hasThankYouBeenSent } from '../utils/thankYou';

export default function ThankYouModal({ isOpen, onClose, greeting }) {
  const [context, setContext] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  // Phase 3D Batch B — B.4: in-render `const isMobile = window.innerWidth <= 480;`
  // re-computed on every render but never updated on resize alone. Promoted to
  // state with a resize listener so rotation and viewport changes are honored.
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  if (!isOpen || !greeting) return null;

  const alreadySent = hasThankYouBeenSent(greeting.id);

  const handleSend = () => {
    if (alreadySent || sending) return;

    setSending(true);
    setError('');

    // Generate message (no AI, uses templates)
    const message = generateThankYouMessage(greeting.senderName, context);

    // Send (V1: localStorage simulation)
    const result = sendThankYouEmail({
      greetingId: greeting.id,
      senderEmail: greeting.senderEmail,
      senderName: greeting.senderName,
      recipientName: greeting.recipientName,
      message,
    });

    setTimeout(() => {
      setSending(false);
      if (result.success) {
        setSent(true);
      } else {
        setError(result.message);
      }
    }, 800); // Brief delay for UX
  };

  const handleClose = () => {
    setContext('');
    setSent(false);
    setError('');
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: isMobile ? '1rem' : '2rem',
    }}>
      {/* Backdrop */}
      <div
        onClick={handleClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'relative',
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        width: '100%',
        maxWidth: '400px',
        boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          background: 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
          padding: isMobile ? '1rem' : '1.25rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: 'white',
          }}>
            <Heart size={20} />
            <h2 style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              margin: 0,
            }}>
              Send a Thank You
            </h2>
          </div>
          <button
            onClick={handleClose}
            style={{
              background: 'rgba(255, 255, 255, 0.2)',
              border: 'none',
              borderRadius: '50%',
              width: '2rem',
              height: '2rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: 'white',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: isMobile ? '1rem' : '1.5rem' }}>
          {sent ? (
            // Success state
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <CheckCircle size={32} style={{ color: 'white' }} />
              </div>
              <h3 style={{
                fontSize: '1.25rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}>
                Thank You Sent!
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: '1.5rem',
              }}>
                {greeting.senderName} will receive your heartfelt message.
              </p>
              <button
                onClick={handleClose}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--primary)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Done
              </button>
            </div>
          ) : alreadySent ? (
            // Already sent state
            <div style={{ textAlign: 'center', padding: '1rem 0' }}>
              <div style={{
                width: '4rem',
                height: '4rem',
                borderRadius: '50%',
                background: 'var(--gray-100)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 1rem',
              }}>
                <CheckCircle size={32} style={{ color: 'var(--gray-400)' }} />
              </div>
              <h3 style={{
                fontSize: '1.125rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                marginBottom: '0.5rem',
              }}>
                Already Sent
              </h3>
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: '1.5rem',
              }}>
                You've already sent a thank you for this greeting.
              </p>
              <button
                onClick={handleClose}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: 'var(--gray-200)',
                  color: 'var(--text-primary)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Close
              </button>
            </div>
          ) : (
            // Input state
            <>
              {greeting.photoUrl && (
                <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                  <img
                    src={greeting.photoUrl}
                    alt={greeting.senderName}
                    width={64}
                    height={64}
                    style={{
                      width: '64px',
                      height: '64px',
                      maxWidth: '64px',
                      maxHeight: '64px',
                      minWidth: '64px',
                      minHeight: '64px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '3px solid #f9a8d4',
                      display: 'block',
                      margin: '0 auto',
                    }}
                  />
                </div>
              )}
              <p style={{
                fontSize: '0.875rem',
                color: 'var(--text-secondary)',
                marginBottom: '1rem',
                lineHeight: 1.5,
              }}>
                Send a free thank you message to <strong>{greeting.senderName}</strong> for their thoughtful greeting.
              </p>

              <div style={{ marginBottom: '1rem' }}>
                <label style={{
                  display: 'block',
                  fontSize: '0.8125rem',
                  fontWeight: 600,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem',
                }}>
                  Add a personal touch (optional)
                </label>
                <input
                  type="text"
                  value={context}
                  onChange={(e) => setContext(e.target.value.slice(0, 100))}
                  placeholder="e.g., for the birthday wishes"
                  maxLength={100}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    background: 'var(--bg-primary)',
                    color: 'var(--text-primary)',
                  }}
                />
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  marginTop: '0.25rem',
                  textAlign: 'right',
                }}>
                  {context.length}/100
                </p>
              </div>

              {error && (
                <p style={{
                  fontSize: '0.8125rem',
                  color: 'var(--error)',
                  marginBottom: '1rem',
                  padding: '0.5rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderRadius: 'var(--radius-sm)',
                }}>
                  {error}
                </p>
              )}

              <div style={{
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-md)',
                padding: '0.75rem',
                marginBottom: '1.25rem',
              }}>
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-tertiary)',
                  margin: 0,
                  lineHeight: 1.4,
                }}>
                  A heartfelt thank you message will be generated and sent to {greeting.senderName}'s email. Text only, no media.
                </p>
              </div>

              <button
                onClick={handleSend}
                disabled={sending}
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  background: sending ? 'var(--gray-300)' : 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: sending ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  minHeight: isMobile ? '48px' : '44px',
                }}
              >
                {sending ? (
                  <>Sending...</>
                ) : (
                  <>
                    <Send size={18} />
                    Send Thank You
                  </>
                )}
              </button>

              <p style={{
                fontSize: '0.6875rem',
                color: 'var(--text-tertiary)',
                textAlign: 'center',
                marginTop: '0.75rem',
              }}>
                Free • One per greeting • Text only
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
