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
// Phase 9: Volume2 import removed — voice indicator UI removed per doctrine ("no UI on pages")

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
// PAPER FILAMENT OVERLAY — CSS-only cotton fiber simulation
// Red/blue fibers embedded in paper stock, opacity ≤ 0.12
// ═══════════════════════════════════════════════════════════════════════════════
const PAPER_FILAMENT_STYLE = {
  position: 'absolute',
  inset: 0,
  pointerEvents: 'none',
  opacity: 0.11,
  background: `
    linear-gradient(14deg, rgba(180,45,45,.32) 0 1px, transparent 1px 100%),
    linear-gradient(-19deg, rgba(45,75,180,.32) 0 1px, transparent 1px 100%),
    linear-gradient(37deg, rgba(175,50,50,.22) 0 1px, transparent 1px 100%),
    linear-gradient(-43deg, rgba(50,70,175,.22) 0 1px, transparent 1px 100%),
    linear-gradient(8deg, rgba(170,55,55,.18) 0 1px, transparent 1px 100%),
    linear-gradient(-31deg, rgba(55,80,170,.18) 0 1px, transparent 1px 100%)
  `,
  backgroundSize: '210px 210px, 255px 255px, 290px 290px, 335px 335px, 180px 180px, 310px 310px',
  mixBlendMode: 'multiply',
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
  // Simplified: sealed | opened (no 'opening' state - single click destroys)
  const [envelopeState, setEnvelopeState] = useState('sealed');

  // Envelope error state (for failure message)
  const [envelopeError, setEnvelopeError] = useState(false);

  // Card state
  const [currentPage, setCurrentPage] = useState(0);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(false);
  const [pagesViewed, setPagesViewed] = useState(new Set([0]));
  const [canNavigate, setCanNavigate] = useState(false);

  // Audio state
  const [isAudioPlaying, setIsAudioPlaying] = useState(false);
  const [isAudioMuted] = useState(false); // LOCKED: No mute control exposed

  // Phase 9: Voice consent state (session-only, not persisted)
  // Voice must not auto-play — requires explicit user action
  const [voiceConsentGiven, setVoiceConsentGiven] = useState(false);

  // Animation state
  const [animationActive, setAnimationActive] = useState(false);

  // Phase 9: Media reveal state (face/video soft resolve)
  const [mediaRevealed, setMediaRevealed] = useState(false);

  // Gift state
  const [showGift, setShowGift] = useState(false);

  // Phase 9: Memory album state (separate from swipe flow, available post-completion)
  const [showMemoryAlbum, setShowMemoryAlbum] = useState(false);

  // Transition state
  const [isTransitioning, setIsTransitioning] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // REFS
  // ═══════════════════════════════════════════════════════════════════════════
  const containerRef = useRef(null);
  const audioRef = useRef(null);
  const timersRef = useRef([]);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

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

  // Phase 9: Memory photos stored separately for post-completion album access
  // Memory is no longer part of the swipe sequence — it's a separate gift
  const hasMemoryPhotos = photos && photos.length > 0;

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
  // Phase 9: MEDIA REVEAL (soft resolve for face/video)
  // Media starts hidden, then resolves — feels like materialization, not animation
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const currentPageData = pages[currentPage];
    if (currentPageData?.type === 'moment' && envelopeState === 'opened') {
      // Start hidden
      setMediaRevealed(false);
      // Resolve after brief delay (allows DOM to render at 0 opacity first)
      const revealTimer = setTimeout(() => {
        setMediaRevealed(true);
      }, 50);
      return () => clearTimeout(revealTimer);
    } else {
      // Reset when leaving moment page
      setMediaRevealed(false);
    }
  }, [currentPage, envelopeState, pages]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVELOPE MOMENT (LOCKED - Section 5)
  // Single object, below center, silent, no branding, no sender name
  // Seal is the only clickable element — single click destroys envelope
  // ═══════════════════════════════════════════════════════════════════════════

  // ACT OF OPENING — Single click on seal destroys envelope, reveals card
  // No hold gesture, no animation, no sound — instant replacement
  const handleSealClick = () => {
    // LOCKED: No interaction during custody (Section 4)
    if (inCustody) return;
    if (envelopeState !== 'sealed') return;

    try {
      // Destroy envelope, reveal card
      setEnvelopeState('opened');

      // Persist envelope opened state (LOCKED: irreversible)
      if (greetingId) {
        const envelopeOpened = JSON.parse(localStorage.getItem(ENVELOPE_OPENED_KEY) || '{}');
        envelopeOpened[greetingId] = { openedAt: new Date().toISOString() };
        localStorage.setItem(ENVELOPE_OPENED_KEY, JSON.stringify(envelopeOpened));
      }
    } catch {
      // Failure state
      setEnvelopeError(true);
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
  // Phase 9: VOICE CONSENT HANDLER
  // Voice requires explicit user action — "Play message" triggers the sequence
  // ═══════════════════════════════════════════════════════════════════════════
  const handleVoiceConsent = useCallback(() => {
    const currentPageData = pages[currentPage];
    if (currentPageData?.type === 'moment' && !voiceConsentGiven) {
      setVoiceConsentGiven(true);
      playMomentSequence(currentPageData);
    }
  }, [currentPage, pages, voiceConsentGiven, playMomentSequence]);

  // Reset voice consent when leaving Moment page (session-only behavior)
  useEffect(() => {
    const currentPageData = pages[currentPage];
    if (currentPageData?.type !== 'moment') {
      setVoiceConsentGiven(false);
    }
  }, [currentPage, pages]);

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

      // Phase 9: Voice no longer auto-triggers on page arrival
      // playMomentSequence is now called only via explicit consent action
    }, TIMING.PAGE_TURN_DURATION);
    timersRef.current.push(transitionTimer);
  }, [envelopeState, currentPage, totalPages, hasCompletedOnce, pagesViewed, isTransitioning, canNavigate, pages]);

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
    };
  }, []);

  const isMobile = typeof window !== 'undefined' && window.innerWidth <= 480;

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER: ENVELOPE MOMENT (LOCKED - Envelope Contract)
  // Single object, below center, silent, no branding, no sender name
  // Seal is the ONLY clickable element — single click destroys envelope
  // No sound, no animation, no hover effects
  // ═══════════════════════════════════════════════════════════════════════════
  if (envelopeState === 'sealed') {
    // Failure state
    if (envelopeError) {
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
            padding: '2rem',
            userSelect: 'none',
          }}
        >
          <p style={{
            fontSize: '1rem',
            fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
            fontStyle: 'italic',
            color: '#666',
            textAlign: 'center',
            lineHeight: 1.6,
          }}>
            This was prepared with care.<br />
            Please try again in a moment.
          </p>
        </div>
      );
    }

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
          // LOCKED: Below center, not centered
          justifyContent: 'flex-start',
          paddingTop: '55%',
          userSelect: 'none',
        }}
      >
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

        {/* ENVELOPE (LOCKED: one object, below center, no text/branding)
            No click handlers on envelope body — seal is the only interactive element */}
        <div
          style={{
            width: '280px',
            height: '180px',
            position: 'relative',
            // LOCKED: cursor remains default everywhere
            cursor: 'default',
          }}
        >
          {/* Envelope body — Phase 9.5: tactile paper stock with fold definition */}
          <div style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(180deg, #F5F0E8 0%, #EDE5D8 100%)',
            borderRadius: '4px',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15), 0 2px 4px rgba(0, 0, 0, 0.08)',
          }}>
            {/* Phase 9.5: Paper texture — low-contrast noise, no visible repetition */}
            <div style={{
              position: 'absolute',
              inset: 0,
              background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'paper\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.65\' numOctaves=\'4\' seed=\'15\' stitchTiles=\'stitch\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23paper)\' opacity=\'0.045\'/%3E%3C/svg%3E")',
              borderRadius: '4px',
              pointerEvents: 'none',
              mixBlendMode: 'multiply',
            }} />

            {/* Cotton filament overlay — CSS gradient-based red/blue fibers */}
            <div style={{ ...PAPER_FILAMENT_STYLE, borderRadius: '4px' }} />

            {/* Phase 9.5: Envelope fold edge definitions — micro shadows suggesting paper folds */}
            {/* Bottom fold line */}
            <div style={{
              position: 'absolute',
              bottom: '35%',
              left: '8%',
              right: '8%',
              height: '1px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(0,0,0,0.04) 20%, rgba(0,0,0,0.06) 50%, rgba(0,0,0,0.04) 80%, transparent 100%)',
              pointerEvents: 'none',
            }} />
            {/* Left diagonal fold */}
            <div style={{
              position: 'absolute',
              top: '0',
              left: '0',
              width: '50%',
              height: '65%',
              borderRight: '1px solid rgba(0,0,0,0.035)',
              borderBottom: '1px solid rgba(0,0,0,0.025)',
              borderBottomRightRadius: '2px',
              pointerEvents: 'none',
            }} />
            {/* Right diagonal fold */}
            <div style={{
              position: 'absolute',
              top: '0',
              right: '0',
              width: '50%',
              height: '65%',
              borderLeft: '1px solid rgba(0,0,0,0.035)',
              borderBottom: '1px solid rgba(0,0,0,0.025)',
              borderBottomLeftRadius: '2px',
              pointerEvents: 'none',
            }} />

            {/* Envelope flap — static, no animation */}
            <div style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              transformOrigin: 'top center',
              width: 0,
              height: 0,
              borderLeft: '140px solid transparent',
              borderRight: '140px solid transparent',
              borderTop: '90px solid #E8E0D0',
            }} />
          </div>

          {/* WAX SEAL — THE ONLY CLICKABLE ELEMENT
              Single click destroys envelope, reveals card
              No hover effects, cursor remains default */}
          <div
            onClick={handleSealClick}
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              width: '52px',
              height: '52px',
              // LOCKED: cursor remains default, no hover affordance
              cursor: inCustody ? 'default' : 'default',
            }}
          >
            {/* Contact shadow — where wax meets paper */}
            <div style={{
              position: 'absolute',
              inset: '-2px',
              borderRadius: '50% 48% 52% 50% / 50% 52% 48% 50%',
              boxShadow: '0 2px 6px rgba(60, 20, 20, 0.35)',
              pointerEvents: 'none',
            }} />
            {/* Wax body — organic edge, internal marbling */}
            <div style={{
              position: 'absolute',
              inset: 0,
              borderRadius: '52% 48% 50% 50% / 48% 52% 48% 52%',
              background: `
                radial-gradient(ellipse 120% 80% at 35% 25%, rgba(160, 40, 40, 0.15) 0%, transparent 50%),
                radial-gradient(ellipse 80% 100% at 70% 70%, rgba(80, 15, 15, 0.12) 0%, transparent 45%),
                #8b1a1a
              `,
              boxShadow: `
                inset 0 2px 4px rgba(180, 60, 60, 0.2),
                inset 0 -2px 6px rgba(50, 10, 10, 0.35),
                inset 1px 0 2px rgba(0, 0, 0, 0.1),
                inset -1px 0 2px rgba(0, 0, 0, 0.1)
              `,
            }}>
              {/* Subtle wax surface variation */}
              <div style={{
                position: 'absolute',
                inset: 0,
                borderRadius: 'inherit',
                background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 64 64\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'wax\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.5\' numOctaves=\'2\' seed=\'42\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23wax)\' opacity=\'0.06\'/%3E%3C/svg%3E")',
                mixBlendMode: 'overlay',
                pointerEvents: 'none',
              }} />
            </div>
            {/* Debossed "G" — recessed into wax via shadow/highlight, not color */}
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                fontFamily: 'Georgia, serif',
                color: '#7a4a30',
                textShadow: `
                  0 -1px 1px rgba(0, 0, 0, 0.4),
                  0 1px 1px rgba(200, 150, 100, 0.15),
                  0 0 0 transparent
                `,
                opacity: 0.75,
              }}>G</span>
            </div>
          </div>
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

              {/* Cotton filament overlay — CSS gradient-based red/blue fibers */}
              <div style={PAPER_FILAMENT_STYLE} />

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

              {/* Phase 9.5: Wax seal on cover — pressed-wax treatment, matches envelope seal */}
              <div style={{
                position: 'absolute',
                bottom: '2rem',
                right: '2rem',
                width: '52px',
                height: '52px',
              }}>
                {/* Contact shadow */}
                <div style={{
                  position: 'absolute',
                  inset: '-2px',
                  borderRadius: '50% 48% 52% 50% / 50% 52% 48% 50%',
                  boxShadow: '0 2px 8px rgba(60, 20, 20, 0.3)',
                  pointerEvents: 'none',
                }} />
                {/* Wax body — organic edge, internal marbling */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: '52% 48% 50% 50% / 48% 52% 48% 52%',
                  background: `
                    radial-gradient(ellipse 120% 80% at 35% 25%, rgba(160, 40, 40, 0.15) 0%, transparent 50%),
                    radial-gradient(ellipse 80% 100% at 70% 70%, rgba(80, 15, 15, 0.12) 0%, transparent 45%),
                    #8b1a1a
                  `,
                  boxShadow: `
                    inset 0 2px 4px rgba(180, 60, 60, 0.2),
                    inset 0 -2px 6px rgba(50, 10, 10, 0.35),
                    inset 1px 0 2px rgba(0, 0, 0, 0.1),
                    inset -1px 0 2px rgba(0, 0, 0, 0.1)
                  `,
                }}>
                  {/* Wax surface variation */}
                  <div style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: 'inherit',
                    background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 64 64\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'wax\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.5\' numOctaves=\'2\' seed=\'42\'/%3E%3CfeColorMatrix type=\'saturate\' values=\'0\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23wax)\' opacity=\'0.06\'/%3E%3C/svg%3E")',
                    mixBlendMode: 'overlay',
                    pointerEvents: 'none',
                  }} />
                </div>
                {/* Debossed "G" */}
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <span style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    fontFamily: 'Georgia, serif',
                    color: '#7a4a30',
                    textShadow: `
                      0 -1px 1px rgba(0, 0, 0, 0.4),
                      0 1px 1px rgba(200, 150, 100, 0.15)
                    `,
                    opacity: 0.75,
                  }}>G</span>
                </div>
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

              {/* Cotton filament overlay — CSS gradient-based red/blue fibers */}
              <div style={PAPER_FILAMENT_STYLE} />

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

              {/* Photo/Video — Phase 9: soft resolve (opacity transition) */}
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
                    opacity: mediaRevealed ? 1 : 0,
                    transition: 'opacity 0.6s ease-in-out',
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
                    opacity: mediaRevealed ? 1 : 0,
                    transition: 'opacity 0.6s ease-in-out',
                  }}
                />
              ) : (
                <div style={{
                  minHeight: '280px',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: mediaRevealed ? 1 : 0,
                  transition: 'opacity 0.6s ease-in-out',
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

              {/* Phase 9: Voice consent control — appears only before consent given
                  Text-only, centered, calm. Disappears once playback begins. */}
              {currentPageData.voiceUrl && !voiceConsentGiven && (
                <div style={{
                  padding: '1.5rem',
                  textAlign: 'center',
                }}>
                  <button
                    onClick={handleVoiceConsent}
                    style={{
                      padding: '0.875rem 2rem',
                      background: 'transparent',
                      border: '1px solid rgba(0, 0, 0, 0.15)',
                      borderRadius: '8px',
                      color: '#555',
                      fontSize: '1rem',
                      fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
                      fontStyle: 'italic',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'rgba(0, 0, 0, 0.03)';
                      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.25)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.borderColor = 'rgba(0, 0, 0, 0.15)';
                    }}
                  >
                    Play message
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Phase 9: Memory page removed from swipe sequence
              Memory is now a separate gift, accessed via album overlay post-completion */}

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

              {/* Phase 9 Group 6: Memory Album Invitation & Framing
                  Framing line: "When you're ready." — pure restraint, postscript feel
                  Label: "Memories" — neutral noun, no verbs */}
              {hasCompletedOnce && hasMemoryPhotos && !showMemoryAlbum && (
                <div style={{
                  position: 'absolute',
                  bottom: '2.75rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <p style={{
                    fontSize: '0.75rem',
                    color: 'rgba(255, 255, 255, 0.6)',
                    fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
                    fontStyle: 'italic',
                    margin: 0,
                  }}>
                    When you're ready.
                  </p>
                  <button
                    onClick={() => setShowMemoryAlbum(true)}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: 'rgba(255, 255, 255, 0.12)',
                      border: '1px solid rgba(255, 255, 255, 0.25)',
                      borderRadius: '8px',
                      color: 'rgba(255, 255, 255, 0.85)',
                      fontSize: '0.8125rem',
                      fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
                      fontStyle: 'italic',
                      cursor: 'pointer',
                      backdropFilter: 'blur(4px)',
                    }}
                  >
                    Memories
                  </button>
                </div>
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

        {/* Phase 9: Memory Album Surface (in-card postscript, not overlay)
            Feels like turning to the back of the letter — same world, same object
            Structure only — no invitation/framing copy (Group 6) */}
        {showMemoryAlbum && hasMemoryPhotos && (
          <div style={{
            background: '#1a1a1a',
            borderRadius: '12px',
            marginTop: '1rem',
            padding: '1.25rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          }}>
            {/* Photo grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '0.75rem',
            }}>
              {photos.slice(0, 4).map((photo, idx) => (
                <div
                  key={idx}
                  style={{
                    position: 'relative',
                    overflow: 'hidden',
                    borderRadius: '8px',
                    aspectRatio: '1',
                  }}
                >
                  <img
                    src={typeof photo === 'string' ? photo : photo.url}
                    alt=""
                    style={{
                      width: '100%',
                      height: '100%',
                      objectFit: 'cover',
                    }}
                  />
                </div>
              ))}
            </div>

            {/* In-world back affordance */}
            <button
              onClick={() => setShowMemoryAlbum(false)}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.7)',
                fontSize: '0.8125rem',
                fontFamily: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
                fontStyle: 'italic',
                cursor: 'pointer',
                display: 'block',
                width: '100%',
              }}
            >
              Back
            </button>
          </div>
        )}
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
