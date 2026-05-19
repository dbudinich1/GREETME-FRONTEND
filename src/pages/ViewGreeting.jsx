// src/pages/ViewGreeting.jsx
// Public greeting viewer for recipients (no account required)
// TODO: Migrate from GreetingCardViewer (deprecated) to GreetingCardProto
// Uses LOCKED Card Interaction Contract via GreetingCardViewer

import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Heart, AlertCircle } from 'lucide-react';
import GreetMeLogo from '../components/GreetMeLogo';
import ThankYouModal from '../components/ThankYouModal';
import GreetingCardViewer, { convertToMultiPageFormat } from '../components/GreetingCardViewer';
import { hasThankYouBeenSent } from '../utils/thankYou';

export default function ViewGreeting() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [greeting, setGreeting] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showThankYouModal, setShowThankYouModal] = useState(false);
  const [thankYouSent, setThankYouSent] = useState(false);
  const [cardCompleted, setCardCompleted] = useState(false);
  const [giftRevealed, setGiftRevealed] = useState(false);
  // Phase 3D Batch B — B.4: module-scope `isMobile = window.innerWidth <= 480;`
  // was frozen at module load and never updated on rotation/resize. Promoted
  // to component state with a resize listener.
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 480);
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth <= 480);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    loadGreeting();
  }, [id]);

  const loadGreeting = () => {
    try {
      // V1: Load from localStorage (simulates backend fetch)
      // Production would GET /api/greetings/:id (public endpoint)
      const greetings = JSON.parse(localStorage.getItem('greetme_sent_greetings') || '[]');
      const found = greetings.find(g => g.id === id);

      if (found) {
        setGreeting(found);
        setThankYouSent(hasThankYouBeenSent(id));
      } else {
        // Demo greeting for testing
        setGreeting({
          id: id,
          recipientName: 'Friend',
          senderName: 'Someone Special',
          senderEmail: 'sender@example.com',
          message: 'Wishing you a wonderful day filled with joy and happiness! You deserve all the best things in life.',
          occasionType: 'birthday',
          videoUrl: null,
          photoUrl: null,
          qrCashAmount: null,
          createdAt: new Date().toISOString(),
        });
      }
    } catch (err) {
      console.error('Error loading greeting:', err);
      setError('Unable to load greeting');
    } finally {
      setLoading(false);
    }
  };

  const handleThankYouClick = () => {
    setShowThankYouModal(true);
  };

  const handleThankYouClose = () => {
    setShowThankYouModal(false);
    setThankYouSent(hasThankYouBeenSent(id));
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
      }}>
        <div style={{ textAlign: 'center', color: 'white' }}>
          <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💌</div>
          <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>Loading your greeting...</p>
        </div>
      </div>
    );
  }

  if (error || !greeting) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        padding: '2rem',
      }}>
        <div style={{
          maxWidth: '500px',
          width: '100%',
          background: 'white',
          borderRadius: 'var(--radius-xl)',
          padding: '2rem',
          textAlign: 'center',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
        }}>
          <AlertCircle size={64} style={{ color: '#ef4444', marginBottom: '1rem' }} />
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem',
          }}>
            Greeting Not Found
          </h1>
          <p style={{
            fontSize: '1rem',
            color: 'var(--text-secondary)',
            marginBottom: '1.5rem',
          }}>
            {error || 'This greeting may have expired or the link is invalid.'}
          </p>
          <button
            onClick={() => navigate('/')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Go Home
          </button>
        </div>
      </div>
    );
  }

  // Convert greeting to canonical format for card viewer
  const canonicalGreeting = convertToMultiPageFormat({
    senderName: greeting.senderName,
    recipientName: greeting.recipientName,
    occasionType: greeting.occasionType,
    message: greeting.message,
    photoUrl: greeting.photoUrl,
    videoUrl: greeting.videoUrl,
    voiceUrl: greeting.voiceUrl,
    photos: greeting.photos,
  });

  // Build gift object if QR Cash is included
  const giftData = greeting.qrCashAmount ? {
    type: 'qr_cash',
    amount: greeting.qrCashAmount,
    onClaim: () => navigate(`/redeem/qr-cash/${greeting.qrCashId || id}`),
  } : null;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #ec4899 100%)',
      padding: isMobile ? '1rem' : '2rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        maxWidth: '500px',
        width: '100%',
      }}>
        {/* Logo */}
        <div style={{
          textAlign: 'center',
          marginBottom: '1.5rem',
        }}>
          <GreetMeLogo size="medium" clickable={false} />
        </div>

        {/* Greeting Card Viewer (LOCKED CANONICAL CONTRACT) */}
        <GreetingCardViewer
          greeting={canonicalGreeting}
          gift={giftData}
          greetingId={id}
          onComplete={() => setCardCompleted(true)}
          onGiftReveal={() => setGiftRevealed(true)}
        />

        {/* Thank You CTA - Only visible after card completion */}
        {cardCompleted && (
          <div style={{
            marginTop: '1.5rem',
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            padding: isMobile ? '1.25rem' : '1.5rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          }}>
            <button
              onClick={handleThankYouClick}
              disabled={thankYouSent}
              style={{
                width: '100%',
                padding: isMobile ? '0.875rem' : '1rem',
                background: thankYouSent
                  ? 'var(--gray-100)'
                  : 'linear-gradient(135deg, #ec4899 0%, #f472b6 100%)',
                color: thankYouSent ? 'var(--text-tertiary)' : 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.9375rem',
                fontWeight: 600,
                cursor: thankYouSent ? 'default' : 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                minHeight: isMobile ? '48px' : '44px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!thankYouSent) {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.4)';
                }
              }}
              onMouseLeave={(e) => {
                if (!thankYouSent) {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = 'none';
                }
              }}
            >
              <Heart size={18} />
              {thankYouSent ? 'Thank You Sent' : 'Send a Thank You (Free)'}
            </button>

            {!thankYouSent && (
              <p style={{
                fontSize: '0.6875rem',
                color: 'var(--text-tertiary)',
                textAlign: 'center',
                marginTop: '0.5rem',
              }}>
                Text only • No account needed
              </p>
            )}
          </div>
        )}

        {/* Create Your Own CTA */}
        <div style={{
          textAlign: 'center',
          marginTop: '1.5rem',
        }}>
          <button
            onClick={() => navigate('/register')}
            style={{
              padding: '0.75rem 1.5rem',
              background: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
              border: '2px solid rgba(255, 255, 255, 0.3)',
              borderRadius: 'var(--radius-lg)',
              fontSize: '0.875rem',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              backdropFilter: 'blur(10px)',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.25)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            }}
          >
            Create Your Own Greeting
          </button>
        </div>
      </div>

      {/* Thank You Modal */}
      <ThankYouModal
        isOpen={showThankYouModal}
        onClose={handleThankYouClose}
        greeting={greeting}
      />
    </div>
  );
}
