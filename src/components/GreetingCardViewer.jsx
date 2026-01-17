// src/components/GreetingCardViewer.jsx
// LOCKED CONTRACT: Greet-Me Card Interaction
// - Page turns are swipe-only (horizontal)
// - Audio begins 1-2 seconds AFTER swipe to animated page
// - No skipping, jumping, or gift visibility until full card completed once
// - Gift appears only after final page
// - After first full experience, user may freely swipe, replay, review

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, RotateCcw } from 'lucide-react';

// Constants - DO NOT MODIFY
const AUDIO_DELAY_MS = 1500; // 1.5 seconds after swipe before audio starts
const SWIPE_THRESHOLD = 50; // Minimum pixels to trigger swipe
const COMPLETION_STORAGE_KEY = 'greetme_card_completions';

/**
 * GreetingCardViewer - Locked Interaction Contract
 *
 * @param {Object} props
 * @param {Array} props.pages - Array of page objects with type, content, audioUrl
 * @param {Object} props.gift - Gift object (QR Cash, physical, etc.) - only shown after completion
 * @param {string} props.greetingId - Unique greeting ID for completion tracking
 * @param {Function} props.onComplete - Called when full card is viewed for first time
 * @param {Function} props.onGiftReveal - Called when gift is revealed
 */
export default function GreetingCardViewer({
  pages = [],
  gift = null,
  greetingId,
  onComplete,
  onGiftReveal,
  senderName = 'Someone Special',
  recipientName = 'Friend',
  occasionType = 'greeting'
}) {
  // State
  const [currentPage, setCurrentPage] = useState(0);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(false);
  const [pagesViewed, setPagesViewed] = useState(new Set([0]));
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Refs
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const audioDelayTimerRef = useRef(null);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchMoveRef = useRef({ x: 0, y: 0 });

  // Check if this card was previously completed
  useEffect(() => {
    if (greetingId) {
      const completions = JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY) || '{}');
      if (completions[greetingId]) {
        setHasCompletedOnce(true);
        setPagesViewed(new Set(Array.from({ length: pages.length }, (_, i) => i)));
      }
    }
  }, [greetingId, pages.length]);

  // Calculate if all pages have been viewed
  const allPagesViewed = pagesViewed.size >= pages.length;
  const isOnFinalPage = currentPage === pages.length - 1;
  const canShowGift = hasCompletedOnce || (allPagesViewed && isOnFinalPage);

  // Mark completion and reveal gift
  useEffect(() => {
    if (allPagesViewed && isOnFinalPage && !hasCompletedOnce) {
      setHasCompletedOnce(true);

      // Persist completion
      if (greetingId) {
        const completions = JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY) || '{}');
        completions[greetingId] = { completedAt: new Date().toISOString() };
        localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(completions));
      }

      onComplete?.();

      // Reveal gift after brief delay
      if (gift) {
        setTimeout(() => {
          setShowGift(true);
          onGiftReveal?.();
        }, 500);
      }
    }
  }, [allPagesViewed, isOnFinalPage, hasCompletedOnce, gift, greetingId, onComplete, onGiftReveal]);

  // Handle audio playback with delay
  const playPageAudio = useCallback((pageIndex) => {
    // Clear any pending audio timer
    if (audioDelayTimerRef.current) {
      clearTimeout(audioDelayTimerRef.current);
    }

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }

    const page = pages[pageIndex];
    if (!page?.audioUrl || isAudioMuted) return;

    // Start audio after delay (LOCKED: 1-2 seconds)
    audioDelayTimerRef.current = setTimeout(() => {
      if (audioRef.current && pages[pageIndex]?.audioUrl) {
        audioRef.current.src = pages[pageIndex].audioUrl;
        audioRef.current.play().catch(() => {
          // Audio autoplay blocked - user needs to interact
          console.log('Audio autoplay blocked');
        });
        setIsAudioPlaying(true);
      }
    }, AUDIO_DELAY_MS);
  }, [pages, isAudioMuted]);

  // Navigate to page (with contract enforcement)
  const navigateToPage = useCallback((targetPage, direction = 'next') => {
    // Bounds check
    if (targetPage < 0 || targetPage >= pages.length) return;

    // LOCKED CONTRACT: If not completed, only allow sequential forward navigation
    if (!hasCompletedOnce) {
      if (direction === 'next' && targetPage !== currentPage + 1) return;
      if (direction === 'prev' && targetPage !== currentPage - 1) return;
      // Cannot go back if not completed (enforces sequential viewing)
      // Exception: allow going back to review already-viewed pages
      if (direction === 'prev' && !pagesViewed.has(targetPage)) return;
    }

    setIsTransitioning(true);

    // Mark page as viewed
    setPagesViewed(prev => new Set([...prev, targetPage]));

    setTimeout(() => {
      setCurrentPage(targetPage);
      setIsTransitioning(false);

      // Play audio for new page (with delay per contract)
      playPageAudio(targetPage);
    }, 300);
  }, [currentPage, pages.length, hasCompletedOnce, pagesViewed, playPageAudio]);

  // Swipe handlers (LOCKED: swipe-only navigation)
  const handleTouchStart = (e) => {
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY
    };
    touchMoveRef.current = { x: 0, y: 0 };
  };

  const handleTouchMove = (e) => {
    touchMoveRef.current = {
      x: e.touches[0].clientX - touchStartRef.current.x,
      y: e.touches[0].clientY - touchStartRef.current.y
    };
  };

  const handleTouchEnd = () => {
    const deltaX = touchMoveRef.current.x;
    const deltaY = touchMoveRef.current.y;

    // Only trigger if horizontal swipe is dominant
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        // Swipe left = next page
        navigateToPage(currentPage + 1, 'next');
      } else {
        // Swipe right = previous page
        navigateToPage(currentPage - 1, 'prev');
      }
    }

    touchStartRef.current = { x: 0, y: 0 };
    touchMoveRef.current = { x: 0, y: 0 };
  };

  // Mouse drag handlers for desktop
  const handleMouseDown = (e) => {
    touchStartRef.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e) => {
    const deltaX = e.clientX - touchStartRef.current.x;

    if (Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        navigateToPage(currentPage + 1, 'next');
      } else {
        navigateToPage(currentPage - 1, 'prev');
      }
    }

    touchStartRef.current = { x: 0, y: 0 };
  };

  // Toggle mute
  const toggleMute = () => {
    setIsAudioMuted(!isAudioMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isAudioMuted;
    }
  };

  // Replay from start
  const handleReplay = () => {
    if (!hasCompletedOnce) return; // Can only replay after completion

    setCurrentPage(0);
    setShowGift(false);
    playPageAudio(0);
  };

  // Audio ended handler
  const handleAudioEnded = () => {
    setIsAudioPlaying(false);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      if (audioDelayTimerRef.current) {
        clearTimeout(audioDelayTimerRef.current);
      }
    };
  }, []);

  // Start audio on first page load
  useEffect(() => {
    if (pages.length > 0 && pages[0]?.audioUrl) {
      playPageAudio(0);
    }
  }, [pages, playPageAudio]);

  const currentPageData = pages[currentPage] || {};
  const isMobile = window.innerWidth <= 480;

  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '500px',
        margin: '0 auto',
        userSelect: 'none',
        touchAction: 'pan-y pinch-zoom',
      }}
    >
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onPlay={() => setIsAudioPlaying(true)}
        onPause={() => setIsAudioPlaying(false)}
      />

      {/* Card Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        style={{
          background: 'white',
          borderRadius: 'var(--radius-xl)',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.25)',
          cursor: 'grab',
          transition: isTransitioning ? 'transform 0.3s ease' : 'none',
        }}
      >
        {/* Page Progress Indicator */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '6px',
          padding: '12px',
          background: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
        }}>
          {pages.map((_, index) => (
            <div
              key={index}
              style={{
                width: index === currentPage ? '24px' : '8px',
                height: '8px',
                borderRadius: '4px',
                background: pagesViewed.has(index)
                  ? 'white'
                  : 'rgba(255, 255, 255, 0.3)',
                opacity: index === currentPage ? 1 : 0.7,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>

        {/* Page Content */}
        <div style={{
          minHeight: '300px',
          position: 'relative',
          opacity: isTransitioning ? 0.5 : 1,
          transition: 'opacity 0.3s ease',
        }}>
          {/* Cover/Title Page */}
          {currentPageData.type === 'cover' && (
            <div style={{
              padding: isMobile ? '2rem 1.5rem' : '3rem 2rem',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #f472b6 0%, #ec4899 100%)',
              color: 'white',
              minHeight: '300px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              <p style={{ fontSize: '1rem', opacity: 0.9, marginBottom: '0.5rem' }}>
                A special {occasionType} greeting for
              </p>
              <h2 style={{ fontSize: '2rem', fontWeight: 700, marginBottom: '1rem' }}>
                {recipientName}
              </h2>
              <p style={{ fontSize: '0.875rem', opacity: 0.8 }}>
                From {senderName}
              </p>
              <div style={{ marginTop: '2rem', fontSize: '0.8125rem', opacity: 0.7 }}>
                <ChevronLeft size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />
                Swipe to begin
                <ChevronRight size={16} style={{ display: 'inline', verticalAlign: 'middle' }} />
              </div>
            </div>
          )}

          {/* Animated Page (Photo + Voice) */}
          {currentPageData.type === 'animated' && (
            <div style={{ position: 'relative' }}>
              {currentPageData.photoUrl && (
                <img
                  src={currentPageData.photoUrl}
                  alt="Greeting"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                  }}
                />
              )}
              {currentPageData.scriptText && (
                <div style={{
                  padding: isMobile ? '1rem' : '1.25rem',
                  background: 'rgba(0, 0, 0, 0.03)',
                  borderTop: '1px solid var(--border)',
                }}>
                  <p style={{
                    fontSize: isMobile ? '1rem' : '1.0625rem',
                    lineHeight: 1.7,
                    color: 'var(--text-primary)',
                    fontStyle: 'italic',
                    margin: 0,
                  }}>
                    "{currentPageData.scriptText}"
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Slideshow Page */}
          {currentPageData.type === 'slideshow' && (
            <div style={{
              padding: '1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.5rem',
            }}>
              {currentPageData.photos?.map((photo, idx) => (
                <img
                  key={idx}
                  src={photo.url || photo}
                  alt={`Memory ${idx + 1}`}
                  style={{
                    width: '100%',
                    height: '120px',
                    objectFit: 'cover',
                    borderRadius: 'var(--radius-md)',
                  }}
                />
              ))}
            </div>
          )}

          {/* Message Page */}
          {currentPageData.type === 'message' && (
            <div style={{
              padding: isMobile ? '1.5rem' : '2rem',
              textAlign: 'center',
              minHeight: '300px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              <div style={{
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-lg)',
                padding: isMobile ? '1.25rem' : '1.5rem',
                borderLeft: '4px solid #ec4899',
              }}>
                <p style={{
                  fontSize: isMobile ? '1.125rem' : '1.25rem',
                  lineHeight: 1.8,
                  color: 'var(--text-primary)',
                  fontStyle: 'italic',
                  margin: 0,
                }}>
                  "{currentPageData.message}"
                </p>
              </div>
              <p style={{
                marginTop: '1.5rem',
                fontSize: '0.9375rem',
                color: 'var(--text-secondary)',
              }}>
                With love, {senderName}
              </p>
            </div>
          )}

          {/* Final Page */}
          {currentPageData.type === 'final' && (
            <div style={{
              padding: isMobile ? '2rem 1.5rem' : '3rem 2rem',
              textAlign: 'center',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: 'white',
              minHeight: '300px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
            }}>
              <div style={{
                fontSize: '3rem',
                marginBottom: '1rem',
              }}>
                {occasionType === 'birthday' ? '🎂' : occasionType === 'holiday' ? '🎄' : '💝'}
              </div>
              <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>
                {currentPageData.title || 'Enjoy your special day!'}
              </h3>
              <p style={{ fontSize: '1rem', opacity: 0.9 }}>
                {currentPageData.subtitle || `From ${senderName}`}
              </p>
            </div>
          )}
        </div>

        {/* Navigation Hints */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderTop: '1px solid var(--border)',
          background: 'var(--gray-50)',
        }}>
          {/* Left Arrow Hint */}
          <div style={{
            opacity: currentPage > 0 ? 0.6 : 0.2,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
          }}>
            <ChevronLeft size={16} />
            {currentPage > 0 && (hasCompletedOnce || pagesViewed.has(currentPage - 1)) && 'Previous'}
          </div>

          {/* Audio Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentPageData.audioUrl && (
              <button
                onClick={toggleMute}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: isAudioPlaying ? '#6366f1' : 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                {isAudioMuted ? <VolumeX size={18} /> : <Volume2 size={18} />}
              </button>
            )}

            {hasCompletedOnce && (
              <button
                onClick={handleReplay}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: 'var(--text-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                }}
                title="Replay from start"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>

          {/* Right Arrow Hint */}
          <div style={{
            opacity: currentPage < pages.length - 1 ? 0.6 : 0.2,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            color: 'var(--text-tertiary)',
          }}>
            {currentPage < pages.length - 1 && 'Next'}
            <ChevronRight size={16} />
          </div>
        </div>
      </div>

      {/* Gift Reveal (LOCKED: only after full completion) */}
      {canShowGift && gift && showGift && (
        <div style={{
          marginTop: '1.5rem',
          animation: 'fadeSlideUp 0.5s ease',
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            borderRadius: 'var(--radius-xl)',
            padding: '1.25rem',
            boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '1rem',
            }}>
              <div style={{
                width: '3.5rem',
                height: '3.5rem',
                borderRadius: '50%',
                background: 'rgba(255, 255, 255, 0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
              }}>
                🎁
              </div>
              <div style={{ flex: 1 }}>
                <p style={{
                  fontSize: '0.875rem',
                  color: 'rgba(255, 255, 255, 0.9)',
                  marginBottom: '0.25rem',
                }}>
                  {gift.type === 'qr_cash' ? 'Cash Gift Included!' : 'Gift Included!'}
                </p>
                <p style={{
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  color: 'white',
                  margin: 0,
                }}>
                  {gift.type === 'qr_cash' ? `$${gift.amount}` : gift.name}
                </p>
              </div>
              <button
                onClick={gift.onClaim}
                style={{
                  padding: '0.625rem 1.25rem',
                  background: 'white',
                  color: '#f59e0b',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Claim
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Completion Message (first time only) */}
      {allPagesViewed && isOnFinalPage && !showGift && !gift && (
        <div style={{
          marginTop: '1rem',
          textAlign: 'center',
          padding: '0.75rem',
          background: 'rgba(255, 255, 255, 0.1)',
          borderRadius: 'var(--radius-lg)',
          backdropFilter: 'blur(10px)',
        }}>
          <p style={{
            fontSize: '0.8125rem',
            color: 'white',
            margin: 0,
          }}>
            You can now swipe back to review any page
          </p>
        </div>
      )}

      {/* CSS Animation */}
      <style>{`
        @keyframes fadeSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}

/**
 * Helper to convert a simple greeting to multi-page format
 * Use this to adapt legacy greetings to the card viewer
 */
export const convertToMultiPageFormat = (greeting) => {
  const pages = [];

  // Cover page
  pages.push({
    type: 'cover',
  });

  // Main animated page with photo and voice
  if (greeting.photoUrl || greeting.videoUrl) {
    pages.push({
      type: 'animated',
      photoUrl: greeting.photoUrl,
      audioUrl: greeting.voiceUrl || greeting.audioUrl,
      scriptText: greeting.message,
    });
  }

  // Message page
  if (greeting.message) {
    pages.push({
      type: 'message',
      message: greeting.message,
    });
  }

  // Final page
  pages.push({
    type: 'final',
    title: greeting.occasionType === 'birthday'
      ? 'Happy Birthday!'
      : 'Thinking of You!',
    subtitle: `From ${greeting.senderName}`,
  });

  return pages;
};
