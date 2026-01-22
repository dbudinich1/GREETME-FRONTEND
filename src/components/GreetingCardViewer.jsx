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
// CARD STOCK ASSETS — CANONICAL (LOCKED)
// ═══════════════════════════════════════════════════════════════════════════════
import envelopeFrontImg from '../assets/card/envelope-front.jpeg';
import envelopeBackImg from '../assets/card/envelope-back.jpeg';
import cardCoverImg from '../assets/card/card-cover.jpeg';
import cardInteriorImg from '../assets/card/card-interior.png';

// ═══════════════════════════════════════════════════════════════════════════════
// GOOGLE FONTS — GLOBAL TYPOGRAPHY LOCK
// Great Vibes: Titles, occasion headers
// Tangerine: Handwritten messages
// Cormorant Garamond: Body text, poems, formal copy
// Playfair Display: Brand signature, subtle branding
// ═══════════════════════════════════════════════════════════════════════════════
const GOOGLE_FONTS_URL = 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,600;1,400&family=Great+Vibes&family=Playfair+Display:ital,wght@0,400;0,600;1,400&family=Tangerine:wght@400;700&display=swap';

// Inject Google Fonts on mount (idempotent)
if (typeof document !== 'undefined') {
  const existingLink = document.querySelector(`link[href="${GOOGLE_FONTS_URL}"]`);
  if (!existingLink) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = GOOGLE_FONTS_URL;
    document.head.appendChild(link);
  }
}

// Typography constants
const FONTS = {
  title: "'Great Vibes', cursive",
  handwritten: "'Tangerine', cursive",
  body: "'Cormorant Garamond', serif",
  brand: "'Playfair Display', serif",
};

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

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURED GREETING DURATION LOCK (LOCKED)
  // Greeting video: 15-20 seconds total
  // - If video < 15s: hold on freeze frame until 15s elapsed
  // - If video ≥ 20s: stop at 20s, freeze frame
  // ═══════════════════════════════════════════════════════════════════════════
  FEATURED_MIN_DURATION: 15000,    // 15 seconds minimum
  FEATURED_MAX_DURATION: 20000,    // 20 seconds maximum
  VIDEO_FADE_IN_DELAY: 2500,       // Video fades in after 2.5s (Focus + Surprise)
};

// Audio file paths (graceful failure if missing)
const AUDIO = {
  paperSlide: '/assets/sounds/paper-slide.mp3',
  waxCrackle: '/assets/sounds/wax-crackle.mp3',
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

// PAPER_FILAMENT_STYLE removed - now using image-based card stock backgrounds

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

  // Envelope flip state (LOCKED: hover flips front↔back)
  const [envelopeFlipped, setEnvelopeFlipped] = useState(false);

  // Envelope error state (for failure message)
  const [envelopeError, setEnvelopeError] = useState(false);

  // ═══════════════════════════════════════════════════════════════════════════
  // FEATURED GREETING STATE (LOCKED: Focus + Surprise Rule)
  // During greeting focus period:
  // - Video fades in after 2.5s
  // - Memory album disabled
  // - Navigation disabled
  // - Final spread blurred
  // After completion:
  // - Freeze frame shown
  // - Album/navigation enabled
  // - Final spread revealed
  // ═══════════════════════════════════════════════════════════════════════════
  const [greetingFocusActive, setGreetingFocusActive] = useState(false);
  const [greetingCompleted, setGreetingCompleted] = useState(false);
  const [videoFadedIn, setVideoFadedIn] = useState(false);
  const [greetingElapsedMs, setGreetingElapsedMs] = useState(0);

  // Card state
  const [currentPage, setCurrentPage] = useState(0);
  const [hasCompletedOnce, setHasCompletedOnce] = useState(false);
  const [pagesViewed, setPagesViewed] = useState(new Set([0]));
  const [canNavigate, setCanNavigate] = useState(false);

  // Audio state
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
  const videoRef = useRef(null);
  const paperAudioRef = useRef(null);
  const waxAudioRef = useRef(null);
  const timersRef = useRef([]);
  const cueTimersRef = useRef([]);
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });
  const greetingStartTimeRef = useRef(null);
  const greetingIntervalRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // AUDIO CUE HELPER — plays short tactile cue then stops
  // Tracks timers for cleanup on unmount (no leaks)
  // ═══════════════════════════════════════════════════════════════════════════
  const playCue = useCallback((audioRefEl, ms = 600) => {
    try {
      const el = audioRefEl?.current;
      if (!el) return;

      // Always restart cue
      el.currentTime = 0;

      // Attempt play, but do not block UI if it fails
      const p = el.play();
      if (p && typeof p.catch === 'function') p.catch(() => {});

      // Stop after cue window, track timer for cleanup
      const t = window.setTimeout(() => {
        try {
          el.pause();
          el.currentTime = 0;
        } catch {}
      }, ms);

      cueTimersRef.current.push(t);
    } catch {}
  }, []);

  // Cleanup cue timers on unmount
  useEffect(() => {
    return () => {
      try {
        cueTimersRef.current.forEach((t) => clearTimeout(t));
        cueTimersRef.current = [];
      } catch {}
    };
  }, []);

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
  // FEATURED GREETING DURATION GATING (LOCKED)
  // 15-20s focus period with video fade-in at 2.5s
  // Navigation/album disabled during focus, final spread blurred
  // ═══════════════════════════════════════════════════════════════════════════
  useEffect(() => {
    const currentPageData = pages[currentPage];
    const isFeaturedPage = currentPageData?.type === 'moment' && envelopeState === 'opened';

    if (isFeaturedPage && !greetingCompleted && !hasCompletedOnce) {
      // Start greeting focus period
      setGreetingFocusActive(true);
      setVideoFadedIn(false);
      setGreetingElapsedMs(0);
      greetingStartTimeRef.current = Date.now();

      // Video fade-in after 2.5s
      const fadeInTimer = setTimeout(() => {
        setVideoFadedIn(true);
        // Auto-play video if present
        if (videoRef.current) {
          videoRef.current.play().catch(() => {});
        }
      }, TIMING.VIDEO_FADE_IN_DELAY);

      // Track elapsed time
      greetingIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - greetingStartTimeRef.current;
        setGreetingElapsedMs(elapsed);

        // Stop at max duration (20s)
        if (elapsed >= TIMING.FEATURED_MAX_DURATION) {
          if (videoRef.current) {
            videoRef.current.pause();
          }
          clearInterval(greetingIntervalRef.current);

          // Complete greeting after min duration met
          setGreetingCompleted(true);
          setGreetingFocusActive(false);
        }
      }, 100);

      return () => {
        clearTimeout(fadeInTimer);
        clearInterval(greetingIntervalRef.current);
      };
    } else if (!isFeaturedPage) {
      // Left the featured page - check if min duration was met
      if (greetingFocusActive && greetingElapsedMs < TIMING.FEATURED_MIN_DURATION) {
        // Did not complete minimum - reset for next visit
        setGreetingFocusActive(false);
        setVideoFadedIn(false);
      }
    }
  }, [currentPage, envelopeState, pages, greetingCompleted, hasCompletedOnce, greetingFocusActive, greetingElapsedMs]);

  // Handle video ended - complete greeting if min duration met
  const handleVideoEnded = useCallback(() => {
    const elapsed = Date.now() - (greetingStartTimeRef.current || Date.now());

    if (elapsed >= TIMING.FEATURED_MIN_DURATION) {
      setGreetingCompleted(true);
      setGreetingFocusActive(false);
    } else {
      // Hold on freeze frame until min duration
      const remainingMs = TIMING.FEATURED_MIN_DURATION - elapsed;
      const holdTimer = setTimeout(() => {
        setGreetingCompleted(true);
        setGreetingFocusActive(false);
      }, remainingMs);
      timersRef.current.push(holdTimer);
    }
  }, []);

  // Handle video time update - enforce max duration
  const handleVideoTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const currentTimeMs = videoRef.current.currentTime * 1000;
      if (currentTimeMs >= TIMING.FEATURED_MAX_DURATION) {
        videoRef.current.pause();
        setGreetingCompleted(true);
        setGreetingFocusActive(false);
      }
    }
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // ENVELOPE MOMENT (LOCKED - Section 5)
  // Single object, below center, silent, no branding, no sender name
  // Seal is the only clickable element — single click destroys envelope
  // Hover flips front↔back, audio on flip/seal break
  // ═══════════════════════════════════════════════════════════════════════════

  // Envelope hover handler — flip front↔back
  const handleEnvelopeMouseEnter = useCallback(() => {
    if (envelopeState !== 'sealed' || inCustody) return;
    setEnvelopeFlipped(true);
    playCue(paperAudioRef, 550);
  }, [envelopeState, inCustody, playCue]);

  const handleEnvelopeMouseLeave = useCallback(() => {
    if (envelopeState !== 'sealed') return;
    setEnvelopeFlipped(false);
    playCue(paperAudioRef, 550);
  }, [envelopeState, playCue]);

  // ACT OF OPENING — Single click on seal destroys envelope, reveals card
  // No hold gesture, no animation — instant replacement with wax crackle sound
  // KEY: State transition FIRST (never blocked), audio second (non-blocking)
  const handleSealClick = useCallback(() => {
    // LOCKED: No interaction during custody (Section 4)
    if (inCustody) return;
    if (envelopeState !== 'sealed') return;

    try {
      // 1) State transition FIRST (never blocked)
      setEnvelopeState('opened');

      // 2) Persist envelope opened state (LOCKED: irreversible)
      if (greetingId) {
        const envelopeOpened = JSON.parse(localStorage.getItem(ENVELOPE_OPENED_KEY) || '{}');
        envelopeOpened[greetingId] = { openedAt: new Date().toISOString() };
        localStorage.setItem(ENVELOPE_OPENED_KEY, JSON.stringify(envelopeOpened));
      }

      // 3) Audio cue AFTER state (non-blocking)
      playCue(waxAudioRef, 650);
    } catch {
      // Failure state
      setEnvelopeError(true);
    }
  }, [inCustody, envelopeState, greetingId, playCue]);

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
  // Uses actual envelope images with hover flip behavior
  // Hover flips front↔back, seal click destroys envelope
  // Audio on flip (paper-slide) and seal break (wax-crackle)
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
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem',
            userSelect: 'none',
            background: '#f5f3f0',
          }}
        >
          <p style={{
            fontSize: '1.125rem',
            fontFamily: FONTS.body,
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
          width: '100vw',
          height: '100vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          // LOCKED: Below center, not centered
          justifyContent: 'flex-start',
          paddingTop: '25vh',
          userSelect: 'none',
          background: '#f5f3f0',
        }}
      >
        {/* Hidden Audio Elements for envelope sounds */}
        <audio ref={paperAudioRef} src={AUDIO.paperSlide} preload="auto" />
        <audio ref={waxAudioRef} src={AUDIO.waxCrackle} preload="auto" />

        {/* PRE-OCCASION CUSTODY COPY (LOCKED - Section 4)
            Exact copy only: "For Christmas morning."
            No variations. No emojis. No instructions. */}
        {inCustody && custodyCopy && (
          <p style={{
            position: 'absolute',
            top: '12%',
            fontSize: '1.125rem',
            fontFamily: FONTS.body,
            fontStyle: 'italic',
            color: '#666',
            margin: 0,
            letterSpacing: '0.02em',
          }}>
            {custodyCopy}
          </p>
        )}

        {/* ENVELOPE WITH FLIP (LOCKED: hover flips front↔back)
            Uses actual envelope images from assets
            Perspective container for 3D flip effect */}
        <div
          onMouseEnter={handleEnvelopeMouseEnter}
          onMouseLeave={handleEnvelopeMouseLeave}
          style={{
            width: '320px',
            height: '220px',
            perspective: '1000px',
            cursor: 'default',
          }}
        >
          {/* Flip container - rotates on hover */}
          <div style={{
            position: 'relative',
            width: '100%',
            height: '100%',
            transformStyle: 'preserve-3d',
            transition: 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
            transform: envelopeFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)',
          }}>
            {/* FRONT FACE - Envelope with wax seal */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1)',
            }}>
              <img
                src={envelopeFrontImg}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />
              {/* WAX SEAL OVERLAY — clickable, centered on image seal position */}
              <div
                onClick={handleSealClick}
                style={{
                  position: 'absolute',
                  top: '55%',
                  left: '50%',
                  transform: 'translate(-50%, -50%)',
                  width: '90px',
                  height: '90px',
                  cursor: inCustody ? 'default' : 'pointer',
                  borderRadius: '50%',
                  zIndex: 50,
                  pointerEvents: 'auto',
                }}
                aria-label="Open envelope"
              />
            </div>

            {/* BACK FACE - Envelope back (flipped) */}
            <div style={{
              position: 'absolute',
              inset: 0,
              backfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 12px 40px rgba(0, 0, 0, 0.2), 0 4px 12px rgba(0, 0, 0, 0.1)',
            }}>
              <img
                src={envelopeBackImg}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          </div>
        </div>

        {/* Subtle instruction - only shows when not in custody */}
        {!inCustody && (
          <p style={{
            marginTop: '2rem',
            fontSize: '0.875rem',
            fontFamily: FONTS.body,
            fontStyle: 'italic',
            color: 'rgba(0, 0, 0, 0.4)',
            textAlign: 'center',
          }}>
            {envelopeFlipped ? 'Flip back to open' : 'Hover to turn over'}
          </p>
        )}
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
      <audio ref={audioRef} onEnded={handleAudioEnded} />
      <audio ref={paperAudioRef} src={AUDIO.paperSlide} preload="auto" />
      <audio ref={waxAudioRef} src={AUDIO.waxCrackle} preload="auto" />

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
          {/* PAGE 1: COVER (LOCKED)
              Uses card-cover.jpeg as background
              Occasion title in Great Vibes, recipient name in Playfair Display
              Text overlaid inside card frame (never below) */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'cover' && (
            <div style={{
              position: 'relative',
              width: '100%',
              minHeight: '500px',
              overflow: 'hidden',
            }}>
              <img
                src={cardCoverImg}
                alt=""
                style={{
                  width: '100%',
                  height: '100%',
                  minHeight: '500px',
                  objectFit: 'cover',
                  display: 'block',
                }}
              />

              {/* Occasion title - positioned overlay */}
              <div style={{
                position: 'absolute',
                top: '18%',
                width: '100%',
                textAlign: 'center',
                fontFamily: FONTS.title,
                fontSize: isMobile ? '2.5rem' : '3.5rem',
                color: '#2b1b12',
                textShadow: '0 1px 0 rgba(255, 255, 255, 0.35)',
              }}>
                {getOccasionTitle(occasionType)}
              </div>

              {/* Recipient name - positioned overlay */}
              <div style={{
                position: 'absolute',
                top: '33%',
                width: '100%',
                textAlign: 'center',
                fontFamily: FONTS.brand,
                fontSize: isMobile ? '1.25rem' : '1.5rem',
                letterSpacing: '0.06em',
                color: '#2b1b12',
                opacity: 0.9,
              }}>
                For {recipientName}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* INTRO SPREAD (Pages 1-2): TRADITIONAL GREETING
              Uses card-interior.png as background
              Left: Handwritten in Tangerine, Right: Printed in Cormorant Garamond */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'traditional' && (
            <div style={{
              minHeight: '500px',
              backgroundImage: `url(${cardInteriorImg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              position: 'relative',
            }}>
              {/* Left: Handwritten message in Tangerine */}
              <div style={{
                padding: isMobile ? '2rem' : '3rem',
                borderRight: '1px solid rgba(0, 0, 0, 0.06)',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <p style={{
                  fontFamily: FONTS.handwritten,
                  fontSize: isMobile ? '1.75rem' : '2.25rem',
                  fontWeight: 700,
                  lineHeight: 1.6,
                  color: '#2c1810',
                  margin: 0,
                }}>
                  {currentPageData.cursiveMessage}
                </p>
              </div>

              {/* Right: Printed greeting in Cormorant Garamond */}
              <div style={{
                padding: isMobile ? '2rem' : '3rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}>
                <p style={{
                  fontFamily: FONTS.body,
                  fontSize: isMobile ? '1.125rem' : '1.25rem',
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
          {/* FEATURED GREETING SPREAD (Pages 3-4): THE MOMENT
              Video with 15-20s duration gating
              Focus + Surprise: video fades in after 2.5s
              Navigation disabled during focus period */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'moment' && (
            <div style={{
              position: 'relative',
              minHeight: '500px',
              backgroundImage: `url(${cardInteriorImg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }}>
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

              {/* Video/Photo container with Focus + Surprise fade-in */}
              <div style={{
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '400px',
              }}>
                {currentPageData.videoUrl ? (
                  <video
                    ref={videoRef}
                    src={currentPageData.videoUrl}
                    autoPlay={false}
                    controls={greetingCompleted || hasCompletedOnce}
                    muted={false}
                    playsInline
                    onEnded={handleVideoEnded}
                    onTimeUpdate={handleVideoTimeUpdate}
                    style={{
                      width: '100%',
                      maxWidth: '400px',
                      height: 'auto',
                      display: 'block',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                      // Focus + Surprise: fade in after 2.5s
                      opacity: videoFadedIn || hasCompletedOnce ? 1 : 0,
                      transition: 'opacity 1.2s ease-in-out',
                    }}
                  />
                ) : currentPageData.photoUrl ? (
                  <img
                    src={currentPageData.photoUrl}
                    alt=""
                    style={{
                      width: '100%',
                      maxWidth: '400px',
                      height: 'auto',
                      display: 'block',
                      borderRadius: '12px',
                      boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                      opacity: mediaRevealed ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  />
                ) : (
                  <div style={{
                    width: '100%',
                    maxWidth: '400px',
                    minHeight: '280px',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    opacity: mediaRevealed ? 1 : 0,
                    transition: 'opacity 0.8s ease-in-out',
                  }}>
                    <span style={{ fontSize: '4rem' }}>💝</span>
                  </div>
                )}

                {/* Script text in Cormorant Garamond */}
                {currentPageData.scriptText && (
                  <div style={{
                    marginTop: '1.5rem',
                    padding: '1rem 1.5rem',
                    background: 'rgba(255, 255, 255, 0.9)',
                    borderRadius: '8px',
                    maxWidth: '400px',
                  }}>
                    <p style={{
                      fontFamily: FONTS.body,
                      fontSize: isMobile ? '1.125rem' : '1.25rem',
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

                {/* Voice consent control */}
                {currentPageData.voiceUrl && !voiceConsentGiven && !greetingFocusActive && (
                  <button
                    onClick={handleVoiceConsent}
                    style={{
                      marginTop: '1.5rem',
                      padding: '0.875rem 2rem',
                      background: 'rgba(255, 255, 255, 0.9)',
                      border: '1px solid rgba(0, 0, 0, 0.15)',
                      borderRadius: '8px',
                      color: '#555',
                      fontSize: '1rem',
                      fontFamily: FONTS.body,
                      fontStyle: 'italic',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    Play message
                  </button>
                )}

                {/* Focus period indicator (subtle) */}
                {greetingFocusActive && !hasCompletedOnce && (
                  <div style={{
                    position: 'absolute',
                    bottom: '1rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    fontSize: '0.75rem',
                    fontFamily: FONTS.body,
                    fontStyle: 'italic',
                    color: 'rgba(0, 0, 0, 0.4)',
                  }}>
                    {Math.ceil((TIMING.FEATURED_MIN_DURATION - greetingElapsedMs) / 1000)}s
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Phase 9: Memory page removed from swipe sequence
              Memory is now a separate gift, accessed via album overlay post-completion */}

          {/* ═══════════════════════════════════════════════════════════════ */}
          {/* FINAL SPREAD (Pages 7-8): SIGNATURE & GIFT
              Focus + Surprise: blurred during greeting focus period
              Uses card-interior.png as background
              Typography: Great Vibes for title, Cormorant Garamond for body */}
          {/* ═══════════════════════════════════════════════════════════════ */}
          {currentPageData.type === 'final' && (
            <div style={{
              minHeight: '500px',
              backgroundImage: `url(${cardInteriorImg})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '3rem',
              textAlign: 'center',
              position: 'relative',
              // Focus + Surprise: blur during greeting focus period
              filter: greetingFocusActive && !hasCompletedOnce ? 'blur(8px)' : 'none',
              transition: 'filter 0.8s ease-out',
            }}>
              {/* Gift Reveal (LOCKED: still, quiet, centered, no celebration) */}
              {showGift && gift ? (
                <div style={{
                  background: 'rgba(255, 255, 255, 0.95)',
                  borderRadius: '16px',
                  padding: '2.5rem',
                  maxWidth: '320px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.15)',
                }}>
                  {gift.type === 'qr_cash' ? (
                    <>
                      {/* LOCKED: QR Cash copy per spec */}
                      <p style={{
                        fontFamily: FONTS.body,
                        fontSize: '1.125rem',
                        fontStyle: 'italic',
                        color: '#4a3c35',
                        marginBottom: '1.5rem',
                      }}>
                        {gift.amount ? 'Just a little something for you.' : '$5 credit toward any subscription.'}
                      </p>
                      {gift.amount && (
                        <p style={{
                          fontSize: '2.5rem',
                          fontWeight: 700,
                          color: '#059669',
                          marginBottom: '1.5rem',
                          fontFamily: FONTS.title,
                        }}>
                          ${gift.amount}
                        </p>
                      )}
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
                          fontFamily: FONTS.body,
                        }}
                      >
                        Claim
                      </button>
                    </>
                  ) : gift.type === 'physical' ? (
                    <>
                      <p style={{
                        fontFamily: FONTS.body,
                        fontSize: '1.25rem',
                        fontStyle: 'italic',
                        color: '#4a3c35',
                        marginBottom: '0.5rem',
                      }}>
                        Something special is on its way
                      </p>
                      <p style={{
                        fontFamily: FONTS.body,
                        fontSize: '1rem',
                        color: '#666',
                      }}>
                        {gift.message || 'A gift has been sent to you'}
                      </p>
                    </>
                  ) : (
                    <p style={{
                      fontFamily: FONTS.body,
                      fontSize: '1.25rem',
                      fontStyle: 'italic',
                      color: '#4a3c35',
                    }}>
                      {gift.name || 'A special gift awaits'}
                    </p>
                  )}
                </div>
              ) : (
                <>
                  <h3 style={{
                    fontSize: isMobile ? '2rem' : '2.5rem',
                    fontFamily: FONTS.title,
                    color: '#2c1810',
                    marginBottom: '1rem',
                  }}>
                    {getOccasionTitle(occasionType)}
                  </h3>
                  <p style={{
                    fontSize: '1.25rem',
                    fontFamily: FONTS.body,
                    fontStyle: 'italic',
                    color: '#4a3c35',
                  }}>
                    With love, {senderName}
                  </p>
                </>
              )}

              {/* Memory Album Invitation (post-completion only)
                  Disabled during greeting focus period */}
              {hasCompletedOnce && hasMemoryPhotos && !showMemoryAlbum && !greetingFocusActive && (
                <div style={{
                  position: 'absolute',
                  bottom: '3.5rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  <p style={{
                    fontSize: '0.875rem',
                    color: 'rgba(44, 24, 16, 0.5)',
                    fontFamily: FONTS.body,
                    fontStyle: 'italic',
                    margin: 0,
                  }}>
                    When you're ready.
                  </p>
                  <button
                    onClick={() => setShowMemoryAlbum(true)}
                    style={{
                      padding: '0.5rem 1.25rem',
                      background: 'rgba(44, 24, 16, 0.08)',
                      border: '1px solid rgba(44, 24, 16, 0.2)',
                      borderRadius: '8px',
                      color: 'rgba(44, 24, 16, 0.7)',
                      fontSize: '0.875rem',
                      fontFamily: FONTS.body,
                      fontStyle: 'italic',
                      cursor: 'pointer',
                    }}
                  >
                    Memories
                  </button>
                </div>
              )}

              {/* Brand Signature in Playfair Display */}
              <p style={{
                position: 'absolute',
                bottom: '1.25rem',
                fontSize: '0.75rem',
                fontFamily: FONTS.brand,
                color: 'rgba(44, 24, 16, 0.35)',
                fontStyle: 'italic',
              }}>
                Greet-Me
              </p>
            </div>
          )}
        </div>

        {/* LOCKED - Section 8: No UI elements on pages
            Pages are surfaces, not slides
            No navigation footer, no page indicators, no thumbnails */}

        {/* Memory Album Surface (in-card postscript)
            First image + peek edges, disabled during video, hover transitions after video */}
        {showMemoryAlbum && hasMemoryPhotos && !greetingFocusActive && (
          <div style={{
            background: 'rgba(44, 24, 16, 0.95)',
            borderRadius: '12px',
            marginTop: '1rem',
            padding: '1.5rem',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)',
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
                    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.3)',
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

            {/* Back button */}
            <button
              onClick={() => setShowMemoryAlbum(false)}
              style={{
                marginTop: '1rem',
                padding: '0.5rem 1rem',
                background: 'transparent',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '6px',
                color: 'rgba(255, 255, 255, 0.8)',
                fontSize: '0.875rem',
                fontFamily: FONTS.body,
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
