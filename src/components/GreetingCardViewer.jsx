// src/components/GreetingCardViewer.jsx
// ═══════════════════════════════════════════════════════════════════════════════
// GREET-ME™ PREMIUM GREETING CARD SYSTEM — CANONICAL SPEC (V1)
// Status: FINAL · LOCKED · IMPLEMENTATION-READY
// ═══════════════════════════════════════════════════════════════════════════════
//
// LOCKED CONTRACTS:
// 1. CARD INTERACTION: Swipe-only, no tap-to-skip, no thumbnails, no fast-forward
// 2. OPENING EFFECT: One-time paper-opening sound, warm light bloom, seal highlight
// 3. VOICE PRESENTATION: 1-2s silence after swipe, animation, then voice 300-500ms later
// 4. ANIMATION: Opens the door, voice delivers emotion. Occasion-mapped, never competes.
//
// DO NOT MODIFY without explicit approval.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, Volume2, VolumeX, RotateCcw } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS — LOCKED
// ═══════════════════════════════════════════════════════════════════════════════
const SWIPE_THRESHOLD = 50;
const COMPLETION_STORAGE_KEY = 'greetme_card_completions';
const OPENING_EFFECT_KEY = 'greetme_card_opened';

// LOCKED TIMING CONTRACT
const TIMING = {
  OPENING_EFFECT_DURATION: 1000,    // ≤ 1 second
  SILENCE_AFTER_SWIPE: 1500,        // 1-2 seconds silence
  ANIMATION_START_DELAY: 0,         // Animation starts immediately after silence
  VOICE_AFTER_ANIMATION: 400,       // 300-500ms after animation begins
  PAGE_TRANSITION: 300,
};

// ═══════════════════════════════════════════════════════════════════════════════
// STYLE TOKENS — OCCASION THEMING
// ═══════════════════════════════════════════════════════════════════════════════
const OCCASION_STYLES = {
  birthday: {
    name: 'Celebratory Classic',
    coverBase: '#FFFBF5',           // Warm ivory
    coverAccent: '#D4AF37',         // Gold accent
    coverTexture: 'tone-on-tone confetti emboss',
    sealPosition: 'lower-right',
    openingTint: 'rgba(255, 200, 100, 0.15)', // Warmer glow
    animationType: 'confetti',
    animationIntensity: 'gentle',
  },
  anniversary: {
    name: 'Intimate Elegance',
    coverBase: '#FFF8F5',           // Cream / blush
    coverAccent: '#C9A0A0',         // Rose gold
    coverTexture: 'linen',
    sealPosition: 'bottom-center',
    openingTint: 'rgba(255, 220, 200, 0.12)',
    animationType: 'shimmer',
    animationIntensity: 'soft',
  },
  valentine: {
    name: 'Romantic Keepsake',
    coverBase: '#FFF5F5',           // Soft blush
    coverAccent: '#E8B4B4',         // Muted rose
    coverTexture: 'smooth cotton',
    sealPosition: 'bottom-center',
    openingTint: 'rgba(255, 180, 180, 0.12)', // Blush warmth
    animationType: 'heart-bokeh',
    animationIntensity: 'subtle',
  },
  holiday: {
    name: 'Seasonal Refinement',
    coverBase: '#F5F8F5',           // Evergreen undertone
    coverAccent: '#1E3A2F',         // Deep green
    coverTexture: 'subtle seasonal pattern',
    sealPosition: 'lower-right',
    openingTint: 'rgba(200, 220, 200, 0.1)', // Seasonal tone
    animationType: 'ambient',
    animationIntensity: 'restrained',
  },
  mothers_day: {
    name: 'Nurturing Warmth',
    coverBase: '#FFF8F8',
    coverAccent: '#E8A0B0',
    coverTexture: 'soft petal',
    sealPosition: 'bottom-center',
    openingTint: 'rgba(255, 200, 210, 0.12)',
    animationType: 'petal-drift',
    animationIntensity: 'gentle',
  },
  just_because: {
    name: 'Pure Sentiment',
    coverBase: '#FFFDF8',           // Warm neutral
    coverAccent: '#B8A080',         // Muted gold
    coverTexture: 'visible paper grain',
    sealPosition: 'center',
    openingTint: 'rgba(255, 245, 220, 0.1)', // Neutral warmth
    animationType: 'glow',
    animationIntensity: 'barely-perceptible',
  },
  greeting: {
    name: 'Classic Elegance',
    coverBase: '#FFFCF5',
    coverAccent: '#C4A052',
    coverTexture: 'cotton cardstock',
    sealPosition: 'lower-right',
    openingTint: 'rgba(255, 240, 200, 0.1)',
    animationType: 'glow',
    animationIntensity: 'soft',
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════
export default function GreetingCardViewer({
  greeting = {},
  gift = null,
  greetingId,
  onComplete,
  onGiftReveal,
}) {
  const {
    senderName = 'Someone Special',
    recipientName = 'Friend',
    occasionType = 'greeting',
    personalMessage = '',
    printedGreeting = '',
    photoUrl,
    voiceUrl,
    videoUrl,
    photos = [],
    scriptText = '',
  } = greeting;

  // Get occasion style
  const style = OCCASION_STYLES[occasionType] || OCCASION_STYLES.greeting;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════
  const [currentPage, setCurrentPage] = useState(0);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(false);
  const [pagesViewed, setPagesViewed] = useState(new Set([0]));
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [showGift, setShowGift] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showOpeningEffect, setShowOpeningEffect] = useState(false);
  const [hasPlayedOpeningEffect, setHasPlayedOpeningEffect] = useState(false);
  const [animationActive, setAnimationActive] = useState(false);
  const [isReplayMode, setIsReplayMode] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // REFS
  // ═══════════════════════════════════════════════════════════════════════════
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const openingSoundRef = useRef(null);
  const timersRef = useRef([]);
  const touchStartRef = useRef({ x: 0, y: 0 });
  const touchMoveRef = useRef({ x: 0, y: 0 });

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD CANONICAL 5-PAGE STRUCTURE
  // ═══════════════════════════════════════════════════════════════════════════
  const pages = [];

  // Page 1: Cover (ALWAYS)
  pages.push({ type: 'cover' });

  // Page 2: Traditional Greeting (ALWAYS)
  pages.push({
    type: 'traditional',
    cursiveMessage: personalMessage || `Wishing you the very best on this special day.`,
    printedGreeting: printedGreeting || getDefaultPrintedGreeting(occasionType),
  });

  // Page 3: THE MOMENT - Animated + Voice (if photo/video/voice exists)
  if (photoUrl || videoUrl || voiceUrl) {
    pages.push({
      type: 'moment',
      photoUrl,
      videoUrl,
      voiceUrl,
      scriptText: scriptText || personalMessage,
    });
  }

  // Page 4: Memory Layer - Optional photo album
  if (photos && photos.length > 0) {
    pages.push({
      type: 'memory',
      photos,
    });
  }

  // Page 5: Final/Gift Reveal (ALWAYS - last page)
  pages.push({
    type: 'final',
    hasGift: !!gift,
  });

  const totalPages = pages.length;
  const currentPageData = pages[currentPage] || {};

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLETION TRACKING
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (greetingId) {
      const completions = JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY) || '{}');
      if (completions[greetingId]) {
        setHasCompletedOnce(true);
        setPagesViewed(new Set(Array.from({ length: totalPages }, (_, i) => i)));
      }
      // Check if opening effect was played
      const opened = JSON.parse(localStorage.getItem(OPENING_EFFECT_KEY) || '{}');
      if (opened[greetingId]) {
        setHasPlayedOpeningEffect(true);
      }
    }
  }, [greetingId, totalPages]);

  const allPagesViewed = pagesViewed.size >= totalPages;
  const isOnFinalPage = currentPage === totalPages - 1;
  const canShowGift = hasCompletedOnce || (allPagesViewed && isOnFinalPage);

  // Mark completion
  useEffect(() => {
    if (allPagesViewed && isOnFinalPage && !hasCompletedOnce) {
      setHasCompletedOnce(true);

      if (greetingId) {
        const completions = JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY) || '{}');
        completions[greetingId] = { completedAt: new Date().toISOString() };
        localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(completions));
      }

      onComplete?.();

      if (gift) {
        const timer = setTimeout(() => {
          setShowGift(true);
          onGiftReveal?.();
        }, 500);
        timersRef.current.push(timer);
      }
    }
  }, [allPagesViewed, isOnFinalPage, hasCompletedOnce, gift, greetingId, onComplete, onGiftReveal]);

  // ═══════════════════════════════════════════════════════════════════════════
  // OPENING EFFECT (LOCKED: one-time, before Page 2, ≤1 second)
  // ═══════════════════════════════════════════════════════════════════════════
  const playOpeningEffect = useCallback(() => {
    if (hasPlayedOpeningEffect) return;

    setShowOpeningEffect(true);

    // Play soft paper-opening sound (if available)
    if (openingSoundRef.current) {
      openingSoundRef.current.volume = 0.15; // Very subtle
      openingSoundRef.current.play().catch(() => {});
    }

    // Mark as played
    setHasPlayedOpeningEffect(true);
    if (greetingId) {
      const opened = JSON.parse(localStorage.getItem(OPENING_EFFECT_KEY) || '{}');
      opened[greetingId] = true;
      localStorage.setItem(OPENING_EFFECT_KEY, JSON.stringify(opened));
    }

    // Hide effect after duration
    const timer = setTimeout(() => {
      setShowOpeningEffect(false);
    }, TIMING.OPENING_EFFECT_DURATION);
    timersRef.current.push(timer);
  }, [hasPlayedOpeningEffect, greetingId]);

  // ═══════════════════════════════════════════════════════════════════════════
  // VOICE PLAYBACK (LOCKED: 1-2s silence, animation, voice 300-500ms after)
  // ═══════════════════════════════════════════════════════════════════════════
  const playMomentSequence = useCallback((pageData) => {
    if (!pageData.voiceUrl || isAudioMuted) return;

    // 1. Silence period
    const silenceTimer = setTimeout(() => {
      // 2. Start animation
      setAnimationActive(true);

      // 3. Voice starts 300-500ms after animation
      const voiceTimer = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = pageData.voiceUrl;
          audioRef.current.play().catch(() => {
            console.log('Audio autoplay blocked');
          });
        }
      }, TIMING.VOICE_AFTER_ANIMATION);
      timersRef.current.push(voiceTimer);
    }, TIMING.SILENCE_AFTER_SWIPE);
    timersRef.current.push(silenceTimer);
  }, [isAudioMuted]);

  // ═══════════════════════════════════════════════════════════════════════════
  // NAVIGATION (LOCKED: swipe-only, sequential on first experience)
  // ═══════════════════════════════════════════════════════════════════════════
  const navigateToPage = useCallback((targetPage, direction = 'next') => {
    if (targetPage < 0 || targetPage >= totalPages) return;
    if (isTransitioning) return;

    // LOCKED CONTRACT: First experience = sequential only
    if (!hasCompletedOnce) {
      if (direction === 'next' && targetPage !== currentPage + 1) return;
      if (direction === 'prev' && targetPage !== currentPage - 1) return;
      if (direction === 'prev' && !pagesViewed.has(targetPage)) return;
    }

    // Clear any pending timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    // Stop current audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAnimationActive(false);

    // Trigger opening effect when leaving cover (Page 1 → Page 2)
    if (currentPage === 0 && targetPage === 1 && !hasPlayedOpeningEffect) {
      playOpeningEffect();
    }

    setIsTransitioning(true);
    setPagesViewed(prev => new Set([...prev, targetPage]));

    const transitionTimer = setTimeout(() => {
      setCurrentPage(targetPage);
      setIsTransitioning(false);

      // If navigating to THE MOMENT page, trigger sequence
      const newPageData = pages[targetPage];
      if (newPageData?.type === 'moment') {
        playMomentSequence(newPageData);
      }
    }, TIMING.PAGE_TRANSITION);
    timersRef.current.push(transitionTimer);
  }, [currentPage, totalPages, hasCompletedOnce, pagesViewed, isTransitioning, hasPlayedOpeningEffect, playOpeningEffect, playMomentSequence, pages]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SWIPE HANDLERS (LOCKED: swipe-only navigation)
  // ═══════════════════════════════════════════════════════════════════════════
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

    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        navigateToPage(currentPage + 1, 'next');
      } else {
        navigateToPage(currentPage - 1, 'prev');
      }
    }

    touchStartRef.current = { x: 0, y: 0 };
    touchMoveRef.current = { x: 0, y: 0 };
  };

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

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTROLS
  // ═══════════════════════════════════════════════════════════════════════════
  const toggleMute = () => {
    setIsAudioMuted(!isAudioMuted);
    if (audioRef.current) {
      audioRef.current.muted = !isAudioMuted;
    }
  };

  const handleReplay = () => {
    if (!hasCompletedOnce) return;
    setIsReplayMode(true);
    setCurrentPage(0);
    setShowGift(false);
    setAnimationActive(false);
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const handleAudioEnded = () => {
    setIsAudioPlaying(false);
    // Taper animation after voice ends
    const taperTimer = setTimeout(() => {
      setAnimationActive(false);
    }, 3000);
    timersRef.current.push(taperTimer);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
    };
  }, []);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 480;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════
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
      {/* Hidden Audio Elements */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onPlay={() => setIsAudioPlaying(true)}
        onPause={() => setIsAudioPlaying(false)}
      />
      <audio ref={openingSoundRef} src="/assets/sounds/paper-open.mp3" preload="auto" />

      {/* Opening Effect Overlay (LOCKED: one-time, ≤1s) */}
      {showOpeningEffect && (
        <div style={{
          position: 'absolute',
          inset: 0,
          zIndex: 100,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse at center, ${style.openingTint} 0%, transparent 70%)`,
          animation: 'openingBloom 1s ease-out forwards',
        }} />
      )}

      {/* Card Container */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        style={{
          background: style.coverBase,
          borderRadius: '16px',
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0, 0, 0, 0.2), 0 8px 24px rgba(0, 0, 0, 0.15)',
          cursor: 'grab',
          transition: isTransitioning ? 'opacity 0.3s ease' : 'none',
          opacity: isTransitioning ? 0.7 : 1,
        }}
      >
        {/* Page Content */}
        <div style={{ minHeight: '400px', position: 'relative' }}>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PAGE 1: COVER */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'cover' && (
            <div style={{
              minHeight: '400px',
              background: style.coverBase,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              padding: '2rem',
            }}>
              {/* Paper texture overlay */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
                pointerEvents: 'none',
              }} />

              {/* Wax Seal */}
              <div style={{
                position: 'absolute',
                ...(style.sealPosition === 'bottom-center'
                  ? { bottom: '2rem', left: '50%', transform: 'translateX(-50%)' }
                  : style.sealPosition === 'center'
                  ? { bottom: '50%', left: '50%', transform: 'translate(-50%, 50%)' }
                  : { bottom: '2rem', right: '2rem' }
                ),
                width: '64px',
                height: '64px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #c41e3a 0%, #8b0000 100%)',
                boxShadow: '0 4px 12px rgba(139, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: '1.75rem',
                  fontWeight: 700,
                  color: '#ffd700',
                  fontFamily: 'Georgia, serif',
                  textShadow: '0 1px 2px rgba(0, 0, 0, 0.3)',
                }}>G</span>
              </div>

              {/* Cover visual cue (occasion-based, subtle) */}
              <div style={{
                fontSize: '3rem',
                marginBottom: '1.5rem',
                opacity: 0.8,
              }}>
                {occasionType === 'birthday' && '🎂'}
                {occasionType === 'anniversary' && '💕'}
                {occasionType === 'valentine' && '💝'}
                {occasionType === 'holiday' && '✨'}
                {occasionType === 'mothers_day' && '🌸'}
                {(occasionType === 'just_because' || occasionType === 'greeting') && '💌'}
              </div>

              <p style={{
                fontSize: '0.875rem',
                color: '#666',
                marginBottom: '0.5rem',
                fontStyle: 'italic',
              }}>
                For {recipientName}
              </p>

              {/* Swipe hint */}
              <div style={{
                position: 'absolute',
                bottom: '1rem',
                left: '50%',
                transform: 'translateX(-50%)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                fontSize: '0.75rem',
                color: '#999',
              }}>
                <ChevronLeft size={14} />
                <span>Swipe to open</span>
                <ChevronRight size={14} />
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PAGE 2: TRADITIONAL GREETING */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'traditional' && (
            <div style={{
              minHeight: '400px',
              background: '#FFFEF8',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 0,
            }}>
              {/* Left: Cursive/Handwritten Message */}
              <div style={{
                padding: isMobile ? '1.5rem' : '2rem',
                borderRight: '1px solid rgba(0, 0, 0, 0.05)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <p style={{
                  fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
                  fontSize: isMobile ? '1.125rem' : '1.375rem',
                  lineHeight: 1.8,
                  color: '#2c1810',
                  margin: 0,
                  // Imperfect ink feel
                  textShadow: '0.5px 0.5px 0 rgba(0, 0, 0, 0.1)',
                }}>
                  {currentPageData.cursiveMessage}
                </p>
              </div>

              {/* Right: Printed Greeting */}
              <div style={{
                padding: isMobile ? '1.5rem' : '2rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.01)',
              }}>
                <p style={{
                  fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
                  fontSize: isMobile ? '0.9375rem' : '1.0625rem',
                  lineHeight: 1.9,
                  color: '#1a1a1a',
                  margin: 0,
                  fontStyle: 'italic',
                }}>
                  {currentPageData.printedGreeting}
                </p>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PAGE 3: THE MOMENT (Animated + Voice) */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'moment' && (
            <div style={{ position: 'relative', minHeight: '400px' }}>
              {/* Animation Overlay (occasion-mapped) */}
              {animationActive && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 10,
                  pointerEvents: 'none',
                  overflow: 'hidden',
                }}>
                  {renderOccasionAnimation(occasionType, style, isReplayMode)}
                </div>
              )}

              {/* Photo/Video */}
              {currentPageData.videoUrl ? (
                <video
                  src={currentPageData.videoUrl}
                  autoPlay={false}
                  controls={hasCompletedOnce}
                  muted={!hasCompletedOnce}
                  playsInline
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    minHeight: '250px',
                    objectFit: 'cover',
                  }}
                />
              ) : currentPageData.photoUrl ? (
                <img
                  src={currentPageData.photoUrl}
                  alt="Greeting moment"
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    minHeight: '250px',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div style={{
                  minHeight: '250px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '4rem' }}>💝</span>
                </div>
              )}

              {/* Script/Message Display */}
              {currentPageData.scriptText && (
                <div style={{
                  padding: isMobile ? '1rem' : '1.25rem',
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderTop: '1px solid rgba(0, 0, 0, 0.05)',
                }}>
                  <p style={{
                    fontSize: isMobile ? '1rem' : '1.0625rem',
                    lineHeight: 1.7,
                    color: '#333',
                    fontStyle: 'italic',
                    margin: 0,
                    textAlign: 'center',
                  }}>
                    "{currentPageData.scriptText}"
                  </p>
                </div>
              )}

              {/* Voice indicator */}
              {isAudioPlaying && (
                <div style={{
                  position: 'absolute',
                  top: '1rem',
                  right: '1rem',
                  background: 'rgba(0, 0, 0, 0.6)',
                  borderRadius: '50%',
                  width: '40px',
                  height: '40px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Volume2 size={20} color="white" />
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PAGE 4: MEMORY LAYER (Optional Photo Album) */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'memory' && (
            <div style={{
              minHeight: '400px',
              background: '#1a1a1a',
              padding: '1rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.5rem',
            }}>
              {currentPageData.photos?.slice(0, 4).map((photo, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '8px',
                    // Ken-Burns style subtle motion
                    animation: animationActive ? `kenBurns${idx % 2} 8s ease-in-out infinite` : 'none',
                  }}
                >
                  <img
                    src={typeof photo === 'string' ? photo : photo.url}
                    alt={`Memory ${idx + 1}`}
                    style={{
                      width: '100%',
                      height: '150px',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              ))}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PAGE 5: FINAL / GIFT REVEAL */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'final' && (
            <div style={{
              minHeight: '400px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2rem',
              textAlign: 'center',
            }}>
              {/* Gift Reveal (LOCKED: only after full completion, dignified) */}
              {canShowGift && gift && showGift ? (
                <div style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '2rem',
                  maxWidth: '320px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                }}>
                  {gift.type === 'qr_cash' ? (
                    <>
                      <div style={{
                        fontSize: '2.5rem',
                        marginBottom: '0.75rem',
                      }}>💵</div>
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#666',
                        marginBottom: '0.5rem',
                      }}>
                        A cash gift for you
                      </p>
                      <p style={{
                        fontSize: '2.5rem',
                        fontWeight: 700,
                        color: '#059669',
                        marginBottom: '1rem',
                      }}>
                        ${gift.amount}
                      </p>
                      <button
                        onClick={gift.onClaim}
                        style={{
                          padding: '0.75rem 2rem',
                          background: 'linear-gradient(135deg, #059669 0%, #10b981 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '1rem',
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontFamily: 'inherit',
                        }}
                      >
                        Claim Gift
                      </button>
                    </>
                  ) : gift.type === 'physical' ? (
                    <>
                      <div style={{
                        fontSize: '2.5rem',
                        marginBottom: '0.75rem',
                      }}>🎁</div>
                      <p style={{
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        color: '#333',
                        marginBottom: '0.5rem',
                      }}>
                        Something special is on its way
                      </p>
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#666',
                      }}>
                        {gift.message || 'A gift has been sent to you!'}
                      </p>
                    </>
                  ) : (
                    <>
                      <div style={{
                        fontSize: '2.5rem',
                        marginBottom: '0.75rem',
                      }}>💐</div>
                      <p style={{
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        color: '#333',
                        marginBottom: '0.5rem',
                      }}>
                        {gift.name || 'A special gift awaits'}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div style={{
                    fontSize: '3rem',
                    marginBottom: '1rem',
                  }}>
                    {occasionType === 'birthday' ? '🎉' : '💝'}
                  </div>
                  <h3 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'white',
                    marginBottom: '0.5rem',
                  }}>
                    {getOccasionTitle(occasionType)}
                  </h3>
                  <p style={{
                    fontSize: '1rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                    marginBottom: '2rem',
                  }}>
                    With love, {senderName}
                  </p>
                </>
              )}

              {/* Brand Signature (LOCKED: final page only, small, refined) */}
              <p style={{
                position: 'absolute',
                bottom: '1rem',
                fontSize: '0.6875rem',
                color: 'rgba(255, 255, 255, 0.6)',
                fontStyle: 'italic',
              }}>
                Lovingly powered by Greet-Me™
              </p>
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '12px 16px',
          borderTop: '1px solid rgba(0, 0, 0, 0.08)',
          background: '#fafafa',
        }}>
          {/* Left: Previous hint */}
          <div style={{
            opacity: currentPage > 0 && (hasCompletedOnce || pagesViewed.has(currentPage - 1)) ? 0.6 : 0.2,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            color: '#666',
          }}>
            <ChevronLeft size={16} />
            {currentPage > 0 && (hasCompletedOnce || pagesViewed.has(currentPage - 1)) && 'Previous'}
          </div>

          {/* Center: Controls */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {currentPageData.type === 'moment' && currentPageData.voiceUrl && (
              <button
                onClick={toggleMute}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '4px',
                  cursor: 'pointer',
                  color: isAudioPlaying ? '#6366f1' : '#999',
                  display: 'flex',
                }}
                aria-label={isAudioMuted ? 'Unmute' : 'Mute'}
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
                  color: '#999',
                  display: 'flex',
                }}
                title="Replay"
                aria-label="Replay from start"
              >
                <RotateCcw size={16} />
              </button>
            )}
          </div>

          {/* Right: Next hint */}
          <div style={{
            opacity: currentPage < totalPages - 1 ? 0.6 : 0.2,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '0.75rem',
            color: '#666',
          }}>
            {currentPage < totalPages - 1 && 'Next'}
            <ChevronRight size={16} />
          </div>
        </div>

        {/* Page indicator dots */}
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '6px',
          padding: '8px',
          background: '#f5f5f5',
        }}>
          {pages.map((_, index) => (
            <div
              key={index}
              style={{
                width: index === currentPage ? '20px' : '6px',
                height: '6px',
                borderRadius: '3px',
                background: pagesViewed.has(index) ? '#6366f1' : '#ddd',
                opacity: index === currentPage ? 1 : 0.7,
                transition: 'all 0.3s ease',
              }}
            />
          ))}
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes openingBloom {
          0% { opacity: 0; transform: scale(0.8); }
          50% { opacity: 1; }
          100% { opacity: 0; transform: scale(1.2); }
        }

        @keyframes confettiFloat {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
          10% { opacity: 1; }
          90% { opacity: 1; }
          100% { transform: translateY(300px) rotate(360deg); opacity: 0; }
        }

        @keyframes shimmer {
          0% { opacity: 0.3; }
          50% { opacity: 0.6; }
          100% { opacity: 0.3; }
        }

        @keyframes gentleGlow {
          0% { opacity: 0.2; }
          50% { opacity: 0.4; }
          100% { opacity: 0.2; }
        }

        @keyframes heartFloat {
          0% { transform: translateY(0) scale(1); opacity: 0.3; }
          50% { transform: translateY(-20px) scale(1.1); opacity: 0.5; }
          100% { transform: translateY(0) scale(1); opacity: 0.3; }
        }

        @keyframes petalDrift {
          0% { transform: translateY(-10px) translateX(0) rotate(0deg); opacity: 0; }
          20% { opacity: 0.6; }
          80% { opacity: 0.6; }
          100% { transform: translateY(300px) translateX(30px) rotate(180deg); opacity: 0; }
        }

        @keyframes kenBurns0 {
          0% { transform: scale(1) translate(0, 0); }
          50% { transform: scale(1.05) translate(-1%, -1%); }
          100% { transform: scale(1) translate(0, 0); }
        }

        @keyframes kenBurns1 {
          0% { transform: scale(1.05) translate(-1%, 0); }
          50% { transform: scale(1) translate(0, -1%); }
          100% { transform: scale(1.05) translate(-1%, 0); }
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(20px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getDefaultPrintedGreeting(occasionType) {
  const greetings = {
    birthday: 'May this day bring you countless moments of joy, and may the year ahead be filled with beautiful surprises and cherished memories.',
    anniversary: 'Celebrating the beautiful journey you\'ve shared together, and wishing you many more years of love and happiness.',
    valentine: 'Love is the greatest gift of all. May your heart be full today and always.',
    holiday: 'Wishing you warmth, peace, and joy during this special season.',
    mothers_day: 'For all the love you\'ve given and all the sacrifices you\'ve made, thank you for being extraordinary.',
    just_because: 'Sometimes the best moments are the unexpected ones. Thinking of you today.',
    greeting: 'Sending you warm wishes and hoping this message brings a smile to your day.',
  };
  return greetings[occasionType] || greetings.greeting;
}

function getOccasionTitle(occasionType) {
  const titles = {
    birthday: 'Happy Birthday!',
    anniversary: 'Happy Anniversary!',
    valentine: 'Happy Valentine\'s Day!',
    holiday: 'Happy Holidays!',
    mothers_day: 'Happy Mother\'s Day!',
    just_because: 'Thinking of You!',
    greeting: 'With Love!',
  };
  return titles[occasionType] || titles.greeting;
}

function renderOccasionAnimation(occasionType, style, isReplayMode) {
  // LOCKED: Animation supports voice, never competes
  // Intensity tapers after first 3-5 seconds
  // Replay mode = reduced intensity

  const intensity = isReplayMode ? 0.5 : 1;

  switch (style.animationType) {
    case 'confetti':
      // Birthday: Gentle confetti (slow, sparse), 1-2 soft balloons max
      return (
        <>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '-10px',
                left: `${15 + i * 14}%`,
                width: '8px',
                height: '8px',
                background: ['#FFD700', '#FF69B4', '#87CEEB', '#98FB98', '#DDA0DD', '#F0E68C'][i],
                borderRadius: i % 2 === 0 ? '50%' : '2px',
                animation: `confettiFloat ${4 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.3}s`,
                opacity: intensity,
              }}
            />
          ))}
        </>
      );

    case 'shimmer':
      // Anniversary: Soft shimmer, ambient glow
      return (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 30% 30%, rgba(255, 215, 180, 0.15) 0%, transparent 50%)',
          animation: 'shimmer 3s ease-in-out infinite',
          opacity: intensity,
        }} />
      );

    case 'heart-bokeh':
      // Valentine: Abstract heart bokeh (very subtle)
      return (
        <>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${20 + i * 15}%`,
                left: `${10 + i * 20}%`,
                width: '20px',
                height: '20px',
                background: 'radial-gradient(circle, rgba(236, 72, 153, 0.3) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: `heartFloat ${3 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.4}s`,
                opacity: intensity * 0.4,
              }}
            />
          ))}
        </>
      );

    case 'petal-drift':
      // Mother's Day: Gentle petal drift
      return (
        <>
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '-20px',
                left: `${20 + i * 20}%`,
                width: '12px',
                height: '12px',
                background: 'linear-gradient(135deg, #FFB6C1 0%, #FFC0CB 100%)',
                borderRadius: '50% 0 50% 50%',
                animation: `petalDrift ${5 + i * 0.8}s ease-in-out infinite`,
                animationDelay: `${i * 0.6}s`,
                opacity: intensity * 0.6,
              }}
            />
          ))}
        </>
      );

    case 'ambient':
      // Holiday: Seasonal ambient (extremely restrained)
      return (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.08) 0%, transparent 40%)',
          animation: 'gentleGlow 4s ease-in-out infinite',
          opacity: intensity,
        }} />
      );

    case 'glow':
    default:
      // Just Because / Default: Barely perceptible glow
      return (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(255, 245, 200, 0.08) 0%, transparent 60%)',
          animation: 'gentleGlow 5s ease-in-out infinite',
          opacity: intensity * 0.5,
        }} />
      );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY CONVERTER
// ═══════════════════════════════════════════════════════════════════════════════
export const convertToMultiPageFormat = (legacyGreeting) => {
  // Convert legacy single-object greeting to canonical format
  return {
    senderName: legacyGreeting.senderName || 'Someone Special',
    recipientName: legacyGreeting.recipientName || 'Friend',
    occasionType: legacyGreeting.occasionType || 'greeting',
    personalMessage: legacyGreeting.message || '',
    printedGreeting: '',
    photoUrl: legacyGreeting.photoUrl,
    voiceUrl: legacyGreeting.voiceUrl || legacyGreeting.audioUrl,
    videoUrl: legacyGreeting.videoUrl,
    photos: legacyGreeting.photos || [],
    scriptText: legacyGreeting.message || '',
  };
};
