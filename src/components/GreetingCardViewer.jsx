// src/components/GreetingCardViewer.jsx
// ═══════════════════════════════════════════════════════════════════════════════
// GREET-ME™ — PREMIUM PACKAGING MASTER SPEC (FINAL / LOCKED)
// Status: CANONICAL · FINAL · LOCKED
// Creative Discretion: NONE
// Scope Expansion: FORBIDDEN
// Interpretation: LITERAL ONLY
// ═══════════════════════════════════════════════════════════════════════════════
//
// FOUNDATIONAL INTENT (ABSOLUTE):
// Greet-Me™ is a premium emotional keepsake competing directly with real physical
// greeting cards. Digital convenience is a liability, not a benefit.
//
// If something becomes faster, easier, clearer, more flexible, or more "usable"
// it is WRONG unless it simultaneously increases ceremony, restraint, and
// perceived effort.
//
// DO NOT MODIFY without explicit approval.
// ═══════════════════════════════════════════════════════════════════════════════

import { useState, useRef, useEffect, useCallback } from 'react';
import { Volume2 } from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS — LOCKED
// ═══════════════════════════════════════════════════════════════════════════════
const COMPLETION_STORAGE_KEY = 'greetme_card_completions';
const ENVELOPE_OPENED_KEY = 'greetme_envelope_opened';
const CUSTODY_RELEASE_KEY = 'greetme_custody_released';

// PRE-OCCASION CUSTODY (LOCKED - Section 4)
// Applies to: Christmas, major holidays, milestone occasions only
const CUSTODY_OCCASIONS = {
  christmas: { releaseDate: '12-25', copy: 'For Christmas morning.' },
  holiday: { releaseDate: null, copy: null }, // Generic holidays don't have custody
  // Future: new_year: { releaseDate: '01-01', copy: 'For New Year\'s Day.' },
};

// LOCKED TIMING CONTRACT
const TIMING = {
  // Envelope opening: 800-1200ms total
  OPENING_GESTURE_MIN: 800,
  OPENING_GESTURE_MAX: 1200,
  OPENING_SOUND_DURATION: 1000,    // ≤1 second

  // Voice presentation
  SILENCE_BEFORE_VOICE: 1500,      // 1-2 seconds silence
  VOICE_AFTER_ANIMATION: 400,      // 300-500ms after animation

  // Page turns
  PAGE_TURN_DURATION: 400,         // Weighted, resisted
  MIN_DWELL_TIME: 2000,            // Minimum time per page

  // Swipe detection
  SWIPE_THRESHOLD: 60,             // Higher threshold = more deliberate
};

// ═══════════════════════════════════════════════════════════════════════════════
// OCCASION STYLE TOKENS — LOCKED
// ═══════════════════════════════════════════════════════════════════════════════
const OCCASION_STYLES = {
  birthday: {
    name: 'Celebratory Classic',
    coverBase: '#FFFBF5',
    openingTint: 'rgba(255, 200, 100, 0.12)',
    animationType: 'confetti',
  },
  anniversary: {
    name: 'Intimate Elegance',
    coverBase: '#FFF8F5',
    openingTint: 'rgba(255, 220, 200, 0.10)',
    animationType: 'shimmer',
  },
  valentine: {
    name: 'Romantic Keepsake',
    coverBase: '#FFF5F5',
    openingTint: 'rgba(255, 180, 180, 0.10)',
    animationType: 'heart-bokeh',
  },
  christmas: {
    name: 'Christmas Morning',
    coverBase: '#F8FBF5',
    openingTint: 'rgba(200, 220, 200, 0.10)',
    animationType: 'ambient',
  },
  holiday: {
    name: 'Seasonal Refinement',
    coverBase: '#F5F8F5',
    openingTint: 'rgba(200, 220, 200, 0.08)',
    animationType: 'ambient',
  },
  mothers_day: {
    name: 'Nurturing Warmth',
    coverBase: '#FFF8F8',
    openingTint: 'rgba(255, 200, 210, 0.10)',
    animationType: 'petal-drift',
  },
  just_because: {
    name: 'Pure Sentiment',
    coverBase: '#FFFDF8',
    openingTint: 'rgba(255, 245, 220, 0.08)',
    animationType: 'glow',
  },
  greeting: {
    name: 'Classic Elegance',
    coverBase: '#FFFCF5',
    openingTint: 'rgba(255, 240, 200, 0.08)',
    animationType: 'glow',
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

  const style = OCCASION_STYLES[occasionType] || OCCASION_STYLES.greeting;

  // ═══════════════════════════════════════════════════════════════════════════
  // STATE
  // ═══════════════════════════════════════════════════════════════════════════

  // Pre-Occasion Custody state (LOCKED: Section 4)
  const [inCustody, setInCustody] = useState(false);
  const [custodyCopy, setCustodyCopy] = useState(null);

  // Envelope state (LOCKED: Envelope Moment)
  const [envelopeState, setEnvelopeState] = useState('sealed'); // sealed | opening | opened
  const [openingProgress, setOpeningProgress] = useState(0);

  // Card state
  const [currentPage, setCurrentPage] = useState(0);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(false);
  const [pagesViewed, setPagesViewed] = useState(new Set([0]));
  const [canNavigate, setCanNavigate] = useState(false);

  // Audio state
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioMuted] = useState(false); // LOCKED: No mute control exposed

  // Animation state
  const [animationActive, setAnimationActive] = useState(false);

  // Gift state
  const [showGift, setShowGift] = useState(false);

  // Transition state
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // REFS
  // ═══════════════════════════════════════════════════════════════════════════
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const openingSoundRef = useRef(null);
  const timersRef = useRef([]);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const holdTimerRef = useRef(null);
  const openingStartRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // BUILD CANONICAL 5-PAGE STRUCTURE (LOCKED)
  // ═══════════════════════════════════════════════════════════════════════════
  const pages = [];

  // Page 1: Cover (ALWAYS)
  pages.push({ type: 'cover' });

  // Page 2: Traditional Greeting (ALWAYS)
  pages.push({
    type: 'traditional',
    cursiveMessage: personalMessage || 'Wishing you the very best on this special day.',
    printedGreeting: printedGreeting || getDefaultPrintedGreeting(occasionType),
  });

  // Page 3: THE MOMENT - Animated + Voice
  if (photoUrl || videoUrl || voiceUrl) {
    pages.push({
      type: 'moment',
      photoUrl,
      videoUrl,
      voiceUrl,
      scriptText: scriptText || personalMessage,
    });
  }

  // Page 4: Memory Layer (Optional)
  if (photos && photos.length > 0) {
    pages.push({
      type: 'memory',
      photos,
    });
  }

  // Page 5: Final/Gift Reveal (ALWAYS)
  pages.push({
    type: 'final',
    hasGift: !!gift,
  });

  const totalPages = pages.length;
  const currentPageData = pages[currentPage] || {};

  // ═══════════════════════════════════════════════════════════════════════════
  // PERSISTENCE CHECK & CUSTODY (LOCKED)
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (greetingId) {
      // Check completion
      const completions = JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY) || '{}');
      if (completions[greetingId]) {
        setHasCompletedOnce(true);
        setPagesViewed(new Set(Array.from({ length: totalPages }, (_, i) => i)));
      }

      // Check if envelope was opened before (RE-ENTRY MODE - Section 16)
      // LOCKED: No envelope on re-entry, card already open, objecthood preserved
      const envelopeOpened = JSON.parse(localStorage.getItem(ENVELOPE_OPENED_KEY) || '{}');
      if (envelopeOpened[greetingId]) {
        setEnvelopeState('opened');
      }

      // PRE-OCCASION CUSTODY CHECK (LOCKED - Section 4)
      // Applies to Christmas, major holidays, milestone occasions only
      const custodyConfig = CUSTODY_OCCASIONS[occasionType];
      if (custodyConfig?.releaseDate && custodyConfig?.copy) {
        const today = new Date();
        const [releaseMonth, releaseDay] = custodyConfig.releaseDate.split('-').map(Number);
        const releaseDate = new Date(today.getFullYear(), releaseMonth - 1, releaseDay);

        // Check if already released for this greeting
        const released = JSON.parse(localStorage.getItem(CUSTODY_RELEASE_KEY) || '{}');

        if (!released[greetingId] && today < releaseDate) {
          // LOCKED: Envelope visible, no opening affordance, no sound, no animation
          // No explanation, no feedback on interaction
          setInCustody(true);
          setCustodyCopy(custodyConfig.copy);
        } else if (today >= releaseDate && !released[greetingId]) {
          // On the date: opening affordance silently appears, copy disappears
          // No announcement - custody must feel human, not scheduled
          released[greetingId] = { releasedAt: new Date().toISOString() };
          localStorage.setItem(CUSTODY_RELEASE_KEY, JSON.stringify(released));
        }
      }
    }
  }, [greetingId, totalPages, occasionType]);

  // ═══════════════════════════════════════════════════════════════════════════
  // COMPLETION TRACKING
  // ═══════════════════════════════════════════════════════════════════════════
  const allPagesViewed = pagesViewed.size >= totalPages;
  const isOnFinalPage = currentPage === totalPages - 1;

  useEffect(() => {
    if (allPagesViewed && isOnFinalPage && !hasCompletedOnce && envelopeState === 'opened') {
      setHasCompletedOnce(true);

      if (greetingId) {
        const completions = JSON.parse(localStorage.getItem(COMPLETION_STORAGE_KEY) || '{}');
        completions[greetingId] = { completedAt: new Date().toISOString() };
        localStorage.setItem(COMPLETION_STORAGE_KEY, JSON.stringify(completions));
      }

      onComplete?.();

      // Gift reveal (LOCKED: appears only after full completion, still, quiet, centered)
      if (gift) {
        const timer = setTimeout(() => {
          setShowGift(true);
          onGiftReveal?.();
        }, 800);
        timersRef.current.push(timer);
      }
    }
  }, [allPagesViewed, isOnFinalPage, hasCompletedOnce, gift, greetingId, onComplete, onGiftReveal, envelopeState]);

  // ═══════════════════════════════════════════════════════════════════════════
  // MINIMUM DWELL TIME PER PAGE (LOCKED - Section 8)
  // Pages are surfaces, not slides - minimum dwell time enforced
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    if (envelopeState !== 'opened') return;

    setCanNavigate(false);

    // After first completion, no dwell time required (LOCKED - Section 16: Aftercare)
    if (hasCompletedOnce) {
      setCanNavigate(true);
      return;
    }

    const timer = setTimeout(() => {
      setCanNavigate(true);
    }, TIMING.MIN_DWELL_TIME);

    timersRef.current.push(timer);

    return () => clearTimeout(timer);
  }, [currentPage, envelopeState, hasCompletedOnce]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVELOPE MOMENT (LOCKED - Section 5)
  // Single object, centered, silent, no branding, no sender name
  // No interaction initially — must communicate: this exists, this is finished, this is waiting
  // ═══════════════════════════════════════════════════════════════════════════

  // ACT OF OPENING (LOCKED - Section 6)
  // One deliberate, irreversible gesture
  // Resisted, cannot be accidental, 800-1200ms total
  // Sound only at release (≤1s, paper/fiber)
  const handleEnvelopeMouseDown = () => {
    // LOCKED: No interaction during custody (Section 4)
    if (inCustody) return;
    if (envelopeState !== 'sealed') return;

    openingStartRef.current = Date.now();
    setEnvelopeState('opening');

    // Start tracking hold duration
    const updateProgress = () => {
      if (!openingStartRef.current) return;

      const elapsed = Date.now() - openingStartRef.current;
      const progress = Math.min(elapsed / TIMING.OPENING_GESTURE_MIN, 1);
      setOpeningProgress(progress);

      if (elapsed < TIMING.OPENING_GESTURE_MIN) {
        holdTimerRef.current = requestAnimationFrame(updateProgress);
      }
    };

    holdTimerRef.current = requestAnimationFrame(updateProgress);
  };

  const handleEnvelopeMouseUp = () => {
    if (envelopeState !== 'opening') return;

    if (holdTimerRef.current) {
      cancelAnimationFrame(holdTimerRef.current);
    }

    const elapsed = openingStartRef.current ? Date.now() - openingStartRef.current : 0;

    // Must hold for minimum duration (LOCKED: sustained, deliberate)
    if (elapsed >= TIMING.OPENING_GESTURE_MIN) {
      // Complete opening
      completeOpening();
    } else {
      // Failed attempt — reset
      setEnvelopeState('sealed');
      setOpeningProgress(0);
    }

    openingStartRef.current = null;
  };

  const completeOpening = () => {
    setEnvelopeState('opened');
    setOpeningProgress(1);

    // Play opening sound (LOCKED: ≤1 second, paper/fiber cue)
    if (openingSoundRef.current) {
      openingSoundRef.current.volume = 0.2;
      openingSoundRef.current.play().catch(() => {});
    }

    // Persist envelope opened state (LOCKED: irreversible)
    if (greetingId) {
      const envelopeOpened = JSON.parse(localStorage.getItem(ENVELOPE_OPENED_KEY) || '{}');
      envelopeOpened[greetingId] = { openedAt: new Date().toISOString() };
      localStorage.setItem(ENVELOPE_OPENED_KEY, JSON.stringify(envelopeOpened));
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VOICE PRESENTATION (LOCKED)
  // Voice plays only on Page 3
  // 1-2s silence before voice
  // Voice starts 300-500ms after animation
  // ═══════════════════════════════════════════════════════════════════════════
  const playMomentSequence = useCallback((pageData) => {
    if (!pageData.voiceUrl || isAudioMuted) return;

    const silenceTimer = setTimeout(() => {
      setAnimationActive(true);

      const voiceTimer = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.src = pageData.voiceUrl;
          audioRef.current.play().catch(() => {});
        }
      }, TIMING.VOICE_AFTER_ANIMATION);
      timersRef.current.push(voiceTimer);
    }, TIMING.SILENCE_BEFORE_VOICE);
    timersRef.current.push(silenceTimer);
  }, [isAudioMuted]);

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE NAVIGATION (LOCKED: swipe-only, weighted, resisted)
  // ═══════════════════════════════════════════════════════════════════════════
  const navigateToPage = useCallback((targetPage, direction = 'next') => {
    if (envelopeState !== 'opened') return;
    if (targetPage < 0 || targetPage >= totalPages) return;
    if (isTransitioning) return;

    // Check dwell time (LOCKED: minimum time per page)
    if (!hasCompletedOnce && !canNavigate) return;

    // LOCKED: First experience = sequential only, no skipping
    if (!hasCompletedOnce) {
      if (direction === 'next' && targetPage !== currentPage + 1) return;
      if (direction === 'prev' && targetPage !== currentPage - 1) return;
      if (direction === 'prev' && !pagesViewed.has(targetPage)) return;
    }

    // Clear pending timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    // Stop audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setAnimationActive(false);

    // LOCKED: Weighted, resisted page turn
    setIsTransitioning(true);
    setPagesViewed(prev => new Set([...prev, targetPage]));

    const transitionTimer = setTimeout(() => {
      setCurrentPage(targetPage);
      setIsTransitioning(false);

      const newPageData = pages[targetPage];
      if (newPageData?.type === 'moment') {
        playMomentSequence(newPageData);
      }
    }, TIMING.PAGE_TURN_DURATION);
    timersRef.current.push(transitionTimer);
  }, [envelopeState, currentPage, totalPages, hasCompletedOnce, pagesViewed, isTransitioning, canNavigate, playMomentSequence, pages]);

  // ═══════════════════════════════════════════════════════════════════════════
  // SWIPE HANDLERS (LOCKED: swipe-only, no taps, no buttons)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleTouchStart = (e) => {
    if (envelopeState !== 'opened') return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
  };

  const handleTouchMove = (e) => {
    // Prevent default to avoid scroll interference
    if (envelopeState === 'opened') {
      e.preventDefault();
    }
  };

  const handleTouchEnd = (e) => {
    if (envelopeState !== 'opened') return;

    const touch = e.changedTouches[0];
    const deltaX = touch.clientX - touchStartRef.current.x;
    const deltaY = touch.clientY - touchStartRef.current.y;

    // LOCKED: Higher threshold for more deliberate gesture
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > TIMING.SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        navigateToPage(currentPage + 1, 'next');
      } else {
        navigateToPage(currentPage - 1, 'prev');
      }
    }
  };

  const handleMouseDown = (e) => {
    if (envelopeState !== 'opened') return;
    touchStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
  };

  const handleMouseUp = (e) => {
    if (envelopeState !== 'opened') return;

    const deltaX = e.clientX - touchStartRef.current.x;
    if (Math.abs(deltaX) > TIMING.SWIPE_THRESHOLD) {
      if (deltaX < 0) {
        navigateToPage(currentPage + 1, 'next');
      } else {
        navigateToPage(currentPage - 1, 'prev');
      }
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIO HANDLERS (LOCKED - Section 10 & 11)
  // ═══════════════════════════════════════════════════════════════════════════
  const handleAudioEnded = () => {
    setIsAudioPlaying(false);
    // Taper animation (LOCKED: intensity tapers quickly)
    const taperTimer = setTimeout(() => {
      setAnimationActive(false);
    }, 3000);
    timersRef.current.push(taperTimer);
  };

  // Cleanup
  useEffect(() => {
    return () => {
      timersRef.current.forEach(clearTimeout);
      if (holdTimerRef.current) {
        cancelAnimationFrame(holdTimerRef.current);
      }
    };
  }, []);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 480;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: ENVELOPE MOMENT (LOCKED - Section 5)
  // Single object, centered, silent, no branding, no sender name
  // No sound, no motion, no instructions
  // Must communicate: this exists, this is finished, this is waiting
  // ═══════════════════════════════════════════════════════════════════════════
  if (envelopeState === 'sealed' || envelopeState === 'opening') {
    return (
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: '500px',
          margin: '0 auto',
          minHeight: '400px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          userSelect: 'none',
        }}
      >
        {/* Hidden audio for opening sound - plays only at release */}
        <audio ref={openingSoundRef} src="/assets/sounds/paper-open.mp3" preload="auto" />

        {/* PRE-OCCASION CUSTODY COPY (LOCKED - Section 4)
            Exact copy only: "For Christmas morning."
            No variations. No emojis. No instructions. */}
        {inCustody && custodyCopy && (
          <p style={{
            position: 'absolute',
            top: '15%',
            fontSize: '1rem',
            fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
            fontStyle: 'italic',
            color: '#666',
            margin: 0,
            letterSpacing: '0.02em',
          }}>
            {custodyCopy}
          </p>
        )}

        {/* ENVELOPE (LOCKED - Section 5: one centered object, no text/branding)
            No interaction initially during custody */}
        <div
          onMouseDown={handleEnvelopeMouseDown}
          onMouseUp={handleEnvelopeMouseUp}
          onMouseLeave={handleEnvelopeMouseUp}
          onTouchStart={handleEnvelopeMouseDown}
          onTouchEnd={handleEnvelopeMouseUp}
          style={{
            width: '280px',
            height: '180px',
            position: 'relative',
            // LOCKED: No cursor affordance - envelope must feel like an object, not a button
            cursor: inCustody ? 'default' : 'default',
            transform: envelopeState === 'opening'
              ? `scale(${1 + openingProgress * 0.05})`
              : 'scale(1)',
            transition: 'transform 0.1s ease-out',
          }}
        >
          {/* Envelope body */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, #F5F0E8 0%, #EDE5D8 100%)',
            borderRadius: '4px',
            boxShadow: `
              0 ${8 + openingProgress * 8}px ${24 + openingProgress * 16}px rgba(0, 0, 0, ${0.15 + openingProgress * 0.1}),
              0 2px 4px rgba(0, 0, 0, 0.08)
            `,
          }}>
            {/* Paper texture */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.04\'/%3E%3C/svg%3E")',
              borderRadius: '4px',
              pointerEvents: 'none',
            }} />

            {/* Envelope flap */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: `translateX(-50%) rotateX(${openingProgress * 60}deg)`,
              transformOrigin: 'top center',
              width: 0,
              height: 0,
              borderLeft: '140px solid transparent',
              borderRight: '140px solid transparent',
              borderTop: '90px solid #E8E0D0',
              filter: `brightness(${1 - openingProgress * 0.1})`,
              transition: 'transform 0.1s ease-out',
            }} />
          </div>

          {/* Wax seal (LOCKED - Section 12 & 13: Red wax seal with embossed "G")
              Gold foil on "G": embossed feel, warm muted gold, no glow/shimmer/animation */}
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${1 - openingProgress * 0.3})`,
            width: '48px',
            height: '48px',
            borderRadius: '50%',
            background: 'linear-gradient(145deg, #c41e3a 0%, #8b0000 100%)',
            boxShadow: `
              0 3px 8px rgba(139, 0, 0, 0.5),
              inset 0 2px 4px rgba(255, 255, 255, 0.2),
              inset 0 -2px 4px rgba(0, 0, 0, 0.2)
            `,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: 1 - openingProgress,
            transition: 'transform 0.1s ease-out, opacity 0.1s ease-out',
          }}>
            {/* LOCKED - Section 13: Gold foil "G"
                Embossed feel, warm muted gold (#C9A227), no glow/shimmer
                Gold must be discovered, not noticed */}
            <span style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: '#C9A227', // Warm muted gold
              fontFamily: 'Georgia, serif',
              textShadow: '0 1px 1px rgba(0, 0, 0, 0.4), 0 -1px 0 rgba(255, 255, 255, 0.1)',
              // Embossed feel through shadow layering
            }}>G</span>
          </div>

          {/* Light bloom on opening (LOCKED - Section 6 & 9: warm, subtle, one-time only) */}
          {envelopeState === 'opening' && (
            <div style={{
              position: 'absolute',
              inset: '-50%',
              background: `radial-gradient(ellipse at center, ${style.openingTint} 0%, transparent 60%)`,
              opacity: openingProgress,
              pointerEvents: 'none',
            }} />
          )}
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: OPENED CARD (LOCKED: Objecthood preserved)
  // Card exists within the screen, visible margins, clear edges, soft depth
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div
      ref={containerRef}
      style={{
        position: 'relative',
        width: '100%',
        maxWidth: '500px',
        margin: '0 auto',
        padding: '16px', // LOCKED: Visible margins on all sides
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Hidden Audio Elements */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        onPlay={() => setIsAudioPlaying(true)}
        onPause={() => setIsAudioPlaying(false)}
      />

      {/* Card Container (LOCKED: clear edges, soft depth, fixed proportions) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        style={{
          background: style.coverBase,
          borderRadius: '12px',
          overflow: 'hidden',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.18), 0 4px 12px rgba(0, 0, 0, 0.12)',
          cursor: 'grab',
          // LOCKED: Weighted, dampened movement
          transition: isTransitioning
            ? `opacity ${TIMING.PAGE_TURN_DURATION}ms ease-out`
            : 'box-shadow 0.3s ease',
          opacity: isTransitioning ? 0.6 : 1,
        }}
      >
        {/* Page Content */}
        <div style={{
          minHeight: '420px',
          position: 'relative',
          // LOCKED: Pages are turned into, one page visible at a time
        }}>

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PAGE 1: COVER (LOCKED - Section 12) */}
          {/* Occasion expressed visually first, no Greet-Me branding */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'cover' && (
            <div style={{
              minHeight: '420px',
              background: style.coverBase,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              padding: '2.5rem',
            }}>
              {/* INSET BORDER (LOCKED - Section 13)
                  Hairline thin, warm gray, never animated, never decorative
                  Purpose: imply thick stock */}
              <div style={{
                position: 'absolute',
                inset: '12px',
                border: '1px solid rgba(180, 170, 160, 0.3)',
                borderRadius: '2px',
                pointerEvents: 'none',
              }} />

              {/* Paper texture */}
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'3\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
                pointerEvents: 'none',
              }} />

              {/* Occasion visual (LOCKED - Section 12: occasion expressed visually first) */}
              <div style={{
                fontSize: '3.5rem',
                marginBottom: '2rem',
                opacity: 0.85,
              }}>
                {occasionType === 'birthday' && '🎂'}
                {occasionType === 'anniversary' && '💕'}
                {occasionType === 'valentine' && '💝'}
                {occasionType === 'holiday' && '✨'}
                {occasionType === 'christmas' && '🎄'}
                {occasionType === 'mothers_day' && '🌸'}
                {(occasionType === 'just_because' || occasionType === 'greeting') && '💌'}
              </div>

              <p style={{
                fontSize: '1rem',
                color: '#555',
                fontStyle: 'italic',
                marginBottom: '0',
              }}>
                For {recipientName}
              </p>

              {/* Wax seal on cover (LOCKED - Section 12 & 13)
                  Red wax seal with embossed "G" on every cover
                  Gold foil: warm muted gold, embossed feel, no glow/shimmer */}
              <div style={{
                position: 'absolute',
                bottom: '2rem',
                right: '2rem',
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'linear-gradient(145deg, #c41e3a 0%, #8b0000 100%)',
                boxShadow: '0 3px 10px rgba(139, 0, 0, 0.4), inset 0 2px 4px rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <span style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: '#C9A227', // Warm muted gold (LOCKED - Section 13)
                  fontFamily: 'Georgia, serif',
                  textShadow: '0 1px 1px rgba(0, 0, 0, 0.4), 0 -1px 0 rgba(255, 255, 255, 0.1)',
                }}>G</span>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PAGE 2: TRADITIONAL GREETING (LOCKED - Section 2) */}
          {/* Handwritten + printed, no UI elements */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'traditional' && (
            <div style={{
              minHeight: '420px',
              background: '#FFFEF8',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              position: 'relative',
            }}>
              {/* INSET BORDER (LOCKED - Section 13) */}
              <div style={{
                position: 'absolute',
                inset: '12px',
                border: '1px solid rgba(180, 170, 160, 0.25)',
                borderRadius: '2px',
                pointerEvents: 'none',
              }} />

              {/* Left: Handwritten (LOCKED: cursive, imperfect ink feel) */}
              <div style={{
                padding: isMobile ? '1.75rem' : '2.5rem',
                borderRight: '1px solid rgba(0, 0, 0, 0.04)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <p style={{
                  fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
                  fontSize: isMobile ? '1.25rem' : '1.5rem',
                  lineHeight: 1.9,
                  color: '#2c1810',
                  margin: 0,
                  textShadow: '0.5px 0.5px 0 rgba(0, 0, 0, 0.08)',
                }}>
                  {currentPageData.cursiveMessage}
                </p>
              </div>

              {/* Right: Printed (LOCKED: classic, premium, serif or refined script) */}
              <div style={{
                padding: isMobile ? '1.75rem' : '2.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                background: 'rgba(0, 0, 0, 0.008)',
              }}>
                <p style={{
                  fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
                  fontSize: isMobile ? '1rem' : '1.125rem',
                  lineHeight: 2,
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
            <div style={{ position: 'relative', minHeight: '420px' }}>
              {/* Animation Overlay (LOCKED: supports voice, never competes) */}
              {animationActive && (
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 10,
                  pointerEvents: 'none',
                  overflow: 'hidden',
                }}>
                  {renderOccasionAnimation(style)}
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
                    minHeight: '280px',
                    objectFit: 'cover',
                  }}
                />
              ) : currentPageData.photoUrl ? (
                <img
                  src={currentPageData.photoUrl}
                  alt=""
                  style={{
                    width: '100%',
                    height: 'auto',
                    display: 'block',
                    minHeight: '280px',
                    objectFit: 'cover',
                  }}
                />
              ) : (
                <div style={{
                  minHeight: '280px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{ fontSize: '4rem' }}>💝</span>
                </div>
              )}

              {/* Script text */}
              {currentPageData.scriptText && (
                <div style={{
                  padding: isMobile ? '1.25rem' : '1.5rem',
                  background: 'rgba(255, 255, 255, 0.97)',
                  borderTop: '1px solid rgba(0, 0, 0, 0.04)',
                }}>
                  <p style={{
                    fontSize: isMobile ? '1.0625rem' : '1.125rem',
                    lineHeight: 1.8,
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
                  background: 'rgba(0, 0, 0, 0.5)',
                  borderRadius: '50%',
                  width: '36px',
                  height: '36px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Volume2 size={18} color="white" />
                </div>
              )}
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* PAGE 4: MEMORY LAYER */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'memory' && (
            <div style={{
              minHeight: '420px',
              background: '#1a1a1a',
              padding: '1.25rem',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem',
            }}>
              {currentPageData.photos?.slice(0, 4).map((photo, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '8px',
                  }}
                >
                  <img
                    src={typeof photo === 'string' ? photo : photo.url}
                    alt=""
                    style={{
                      width: '100%',
                      height: '160px',
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
              minHeight: '420px',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '2.5rem',
              textAlign: 'center',
              position: 'relative',
            }}>
              {/* Gift Reveal (LOCKED: still, quiet, centered, no celebration) */}
              {showGift && gift ? (
                <div style={{
                  background: 'white',
                  borderRadius: '16px',
                  padding: '2.5rem',
                  maxWidth: '300px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                }}>
                  {gift.type === 'qr_cash' ? (
                    <>
                      {/* LOCKED: Treated as object, not amount-first */}
                      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💵</div>
                      <p style={{
                        fontSize: '0.875rem',
                        color: '#666',
                        marginBottom: '0.75rem',
                      }}>
                        A gift for you
                      </p>
                      <p style={{
                        fontSize: '2.25rem',
                        fontWeight: 700,
                        color: '#059669',
                        marginBottom: '1.5rem',
                      }}>
                        ${gift.amount}
                      </p>
                      <button
                        onClick={gift.onClaim}
                        style={{
                          padding: '0.875rem 2rem',
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
                        Claim
                      </button>
                    </>
                  ) : gift.type === 'physical' ? (
                    <>
                      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>🎁</div>
                      <p style={{
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        color: '#333',
                        marginBottom: '0.5rem',
                      }}>
                        Something special is on its way
                      </p>
                      <p style={{ fontSize: '0.875rem', color: '#666' }}>
                        {gift.message || 'A gift has been sent to you'}
                      </p>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>💐</div>
                      <p style={{
                        fontSize: '1.125rem',
                        fontWeight: 600,
                        color: '#333',
                      }}>
                        {gift.name || 'A special gift awaits'}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <>
                  <div style={{ fontSize: '3rem', marginBottom: '1.25rem' }}>
                    {occasionType === 'birthday' ? '🎉' : '💝'}
                  </div>
                  <h3 style={{
                    fontSize: '1.625rem',
                    fontWeight: 700,
                    color: 'white',
                    marginBottom: '0.75rem',
                  }}>
                    {getOccasionTitle(occasionType)}
                  </h3>
                  <p style={{
                    fontSize: '1.0625rem',
                    color: 'rgba(255, 255, 255, 0.9)',
                  }}>
                    With love, {senderName}
                  </p>
                </>
              )}

              {/* Brand Signature (LOCKED: final page only, small, understated) */}
              <p style={{
                position: 'absolute',
                bottom: '1.25rem',
                fontSize: '0.6875rem',
                color: 'rgba(255, 255, 255, 0.5)',
                fontStyle: 'italic',
              }}>
                Lovingly powered by Greet-Me™
              </p>
            </div>
          )}
        </div>

        {/* LOCKED - Section 8: No UI elements on pages
            Pages are surfaces, not slides
            No navigation footer, no page indicators, no thumbnails */}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes confettiFloat {
          0% { transform: translateY(-10px) rotate(0deg); opacity: 0; }
          10% { opacity: 0.8; }
          90% { opacity: 0.8; }
          100% { transform: translateY(300px) rotate(360deg); opacity: 0; }
        }
        @keyframes shimmer {
          0% { opacity: 0.2; }
          50% { opacity: 0.5; }
          100% { opacity: 0.2; }
        }
        @keyframes gentleGlow {
          0% { opacity: 0.15; }
          50% { opacity: 0.3; }
          100% { opacity: 0.15; }
        }
        @keyframes heartFloat {
          0% { transform: translateY(0) scale(1); opacity: 0.25; }
          50% { transform: translateY(-15px) scale(1.08); opacity: 0.4; }
          100% { transform: translateY(0) scale(1); opacity: 0.25; }
        }
        @keyframes petalDrift {
          0% { transform: translateY(-10px) translateX(0) rotate(0deg); opacity: 0; }
          20% { opacity: 0.5; }
          80% { opacity: 0.5; }
          100% { transform: translateY(300px) translateX(25px) rotate(180deg); opacity: 0; }
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
    christmas: 'May the magic of Christmas fill your heart with warmth, your home with love, and your life with joy.',
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
    christmas: 'Merry Christmas!',
    holiday: 'Happy Holidays!',
    mothers_day: 'Happy Mother\'s Day!',
    just_because: 'Thinking of You!',
    greeting: 'With Love!',
  };
  return titles[occasionType] || titles.greeting;
}

function renderOccasionAnimation(style) {
  // LOCKED - Section 11: Animation supports voice, never competes
  // Intensity tapers quickly, never loops
  const intensity = 0.8;

  switch (style.animationType) {
    case 'confetti':
      // Birthday: gentle confetti, minimal balloons (LOCKED: restrained)
      return (
        <>
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '-10px',
                left: `${18 + i * 16}%`,
                width: '7px',
                height: '7px',
                background: ['#FFD700', '#FF69B4', '#87CEEB', '#98FB98', '#DDA0DD'][i],
                borderRadius: i % 2 === 0 ? '50%' : '2px',
                animation: `confettiFloat ${4.5 + i * 0.4}s ease-in-out infinite`,
                animationDelay: `${i * 0.35}s`,
                opacity: intensity * 0.8,
              }}
            />
          ))}
        </>
      );

    case 'shimmer':
      // Anniversary: soft shimmer/glow (LOCKED: restrained)
      return (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 30% 30%, rgba(255, 215, 180, 0.12) 0%, transparent 50%)',
          animation: 'shimmer 3.5s ease-in-out infinite',
          opacity: intensity,
        }} />
      );

    case 'heart-bokeh':
      // Valentine: abstract heart bokeh (LOCKED: very subtle)
      return (
        <>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: `${25 + i * 18}%`,
                left: `${15 + i * 25}%`,
                width: '18px',
                height: '18px',
                background: 'radial-gradient(circle, rgba(236, 72, 153, 0.25) 0%, transparent 70%)',
                borderRadius: '50%',
                animation: `heartFloat ${3.5 + i * 0.5}s ease-in-out infinite`,
                animationDelay: `${i * 0.5}s`,
                opacity: intensity * 0.35,
              }}
            />
          ))}
        </>
      );

    case 'petal-drift':
      // Mother's Day: petals or bloom (LOCKED: gentle)
      return (
        <>
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              style={{
                position: 'absolute',
                top: '-15px',
                left: `${25 + i * 22}%`,
                width: '10px',
                height: '10px',
                background: 'linear-gradient(135deg, #FFB6C1 0%, #FFC0CB 100%)',
                borderRadius: '50% 0 50% 50%',
                animation: `petalDrift ${5.5 + i * 0.7}s ease-in-out infinite`,
                animationDelay: `${i * 0.7}s`,
                opacity: intensity * 0.5,
              }}
            />
          ))}
        </>
      );

    case 'ambient':
      // Holiday: ambient seasonal cues (LOCKED: extremely restrained)
      return (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at 50% 0%, rgba(255, 255, 255, 0.06) 0%, transparent 40%)',
          animation: 'gentleGlow 4.5s ease-in-out infinite',
          opacity: intensity,
        }} />
      );

    case 'glow':
    default:
      // Just Because: near-still glow (LOCKED: barely perceptible)
      return (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(255, 245, 200, 0.05) 0%, transparent 60%)',
          animation: 'gentleGlow 6s ease-in-out infinite',
          opacity: intensity * 0.4,
        }} />
      );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LEGACY CONVERTER
// ═══════════════════════════════════════════════════════════════════════════════
export const convertToMultiPageFormat = (legacyGreeting) => {
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
