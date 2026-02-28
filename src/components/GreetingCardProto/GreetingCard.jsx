/**
 * GreetingCard.jsx
 * Screen controller for the 5-screen greeting experience
 *
 * Screens:
 * 1. ENVELOPE - Interactive 3D envelope (front/back via drag)
 * 2. COVER - Standalone card cover
 * 3. INTERIOR - Message spread
 * 4. FEATURED - Video + Photo album
 * 5. FINALE - Closing Message + Gift (no signature)
 *
 * Phase 4D-2: Premium page-turn transitions between screens
 * - 3D rotateY page turn (420ms, cubic-bezier)
 * - Envelope exit: seal pop + lift (280ms)
 * - Reduced motion: quick fade fallback (150ms)
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Envelope from './Envelope';
import Cover from './Cover';
import InteriorSpread from './InteriorSpread';
import FeaturedSpread from './FeaturedSpread';
import FinaleSpread from './FinaleSpread';
import './greetingCard.css';

// Audio asset paths
const PAPER_SLIDE_SRC = '/assets/sounds/paper-slide.mp3';
const WAX_CRACKLE_SRC = '/assets/sounds/wax-crackle.mp3';

const SCREENS = {
  ENVELOPE: 'envelope',
  COVER: 'cover',
  INTERIOR: 'interior',
  FEATURED: 'featured',
  FINALE: 'finale'
};

const SCREEN_ORDER = [
  SCREENS.ENVELOPE,
  SCREENS.COVER,
  SCREENS.INTERIOR,
  SCREENS.FEATURED,
  SCREENS.FINALE
];

// Motion timing (locked spec: 350–450ms acceptable range)
const TRANSITION_MS = 420;
const ENVELOPE_EXIT_MS = 280;
const REDUCED_MOTION_MS = 150;

export default function GreetingCard({ greeting }) {
  const [currentScreen, setCurrentScreen] = useState(SCREENS.ENVELOPE);
  const [transitionState, setTransitionState] = useState(null); // { from, to, direction }
  const [envelopeExiting, setEnvelopeExiting] = useState(false);
  const [hasCompletedFirstPass, setHasCompletedFirstPass] = useState(false);
  // Lift video state to persist across page navigation
  const [videoHasEnded, setVideoHasEnded] = useState(false);

  const transitionTimer = useRef(null);
  const isTransitioningRef = useRef(false);
  const waxAudioRef = useRef(null);
  const paperAudioRef = useRef(null);
  const audioUnlockedRef = useRef(false);

  // ── Preload audio on mount (start downloading immediately) ──────────
  useEffect(() => {
    const wax = new Audio(WAX_CRACKLE_SRC);
    wax.preload = 'auto';
    waxAudioRef.current = wax;

    const paper = new Audio(PAPER_SLIDE_SRC);
    paper.preload = 'auto';
    paperAudioRef.current = paper;
  }, []);

  // ── Audio Context Unlock ────────────────────────────────────────────
  // Mobile browsers block audio until a user gesture. On first tap,
  // play+pause the preloaded elements at volume 0 to unlock the context.
  useEffect(() => {
    const unlockAudio = () => {
      if (audioUnlockedRef.current) return;
      audioUnlockedRef.current = true;

      [waxAudioRef, paperAudioRef].forEach((ref) => {
        try {
          const el = ref.current;
          if (!el) return;
          el.volume = 0;
          el.play().then(() => { el.pause(); el.currentTime = 0; }).catch(() => {});
        } catch {}
      });

      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };

    document.addEventListener('pointerdown', unlockAudio, { once: true });
    document.addEventListener('click', unlockAudio, { once: true });

    return () => {
      document.removeEventListener('pointerdown', unlockAudio);
      document.removeEventListener('click', unlockAudio);
    };
  }, []);

  // ── Reusable play helper (uses preloaded refs, no new downloads) ────
  const playCue = useCallback((audioRef, volume, maxDuration) => {
    try {
      const el = audioRef.current;
      if (!el) return;
      el.volume = volume;
      el.currentTime = 0;
      el.play().catch(() => {});
      setTimeout(() => { el.pause(); el.currentTime = 0; }, maxDuration);
    } catch {}
  }, []);

  // Callbacks for child components
  const playWaxSound = useCallback(() => playCue(waxAudioRef, 0.20, 200), [playCue]);
  const playPaperSound = useCallback(() => playCue(paperAudioRef, 0.35, 300), [playCue]);

  // Reduced motion preference (checked once at mount)
  const reducedMotion = useRef(
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  );

  // Keep ref in sync with state (avoids stale closures in callbacks)
  useEffect(() => {
    isTransitioningRef.current = transitionState !== null || envelopeExiting;
  }, [transitionState, envelopeExiting]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => { if (transitionTimer.current) clearTimeout(transitionTimer.current); };
  }, []);

  // Duration: respect reduced-motion preference
  const dur = useCallback((base) => reducedMotion.current ? REDUCED_MOTION_MS : base, []);

  // Render a screen (non-interactive version for transition overlay)
  const renderScreenContent = useCallback((screen) => {
    switch (screen) {
      case SCREENS.ENVELOPE:
        return <Envelope recipientName={greeting.recipientName} onSealClick={() => {}} />;
      case SCREENS.COVER:
        return <Cover occasionKey={greeting.occasionKey} />;
      case SCREENS.INTERIOR:
        return (
          <InteriorSpread
            recipientName={greeting.recipientName}
            message={greeting.render?.writtenIntroText ?? greeting.writtenIntroText ?? greeting.greetingText}
            senderName={greeting.senderName}
            occasionKey={greeting.occasionKey}
            relationshipKey={greeting.relationshipKey}
            poemText={greeting.render?.poemText ?? greeting.poemText}
          />
        );
      case SCREENS.FEATURED:
        return (
          <FeaturedSpread
            videoUrl={greeting.videoUrl}
            photos={greeting.photos}
            videoHasEnded={videoHasEnded}
            onVideoEnd={() => setVideoHasEnded(true)}
          />
        );
      case SCREENS.FINALE:
        return (
          <FinaleSpread
            finaleText={greeting.finaleText}
            occasionKey={greeting.occasionKey}
            hasGift={greeting.hasGift}
          />
        );
      default:
        return null;
    }
  }, [greeting, videoHasEnded]);

  // Page-turn navigation (Cover ↔ Interior ↔ Featured ↔ Finale)
  const navigateTo = useCallback((toScreen, direction) => {
    if (isTransitioningRef.current) return;
    playPaperSound();
    setTransitionState({ from: currentScreen, to: toScreen, direction });
    transitionTimer.current = setTimeout(() => {
      setCurrentScreen(toScreen);
      setTransitionState(null);
      if (toScreen === SCREENS.FINALE) setHasCompletedFirstPass(true);
    }, dur(TRANSITION_MS));
  }, [currentScreen, dur]);

  // Advance to next screen (called by child onClick / seal click)
  const advanceScreen = useCallback(() => {
    if (isTransitioningRef.current) return;
    const idx = SCREEN_ORDER.indexOf(currentScreen);
    if (idx >= SCREEN_ORDER.length - 1) {
      setHasCompletedFirstPass(true);
      return;
    }
    const next = SCREEN_ORDER[idx + 1];

    // Envelope → Cover: special exit (seal pop + lift, no page turn)
    if (currentScreen === SCREENS.ENVELOPE) {
      setEnvelopeExiting(true);
      transitionTimer.current = setTimeout(() => {
        setEnvelopeExiting(false);
        setCurrentScreen(next);
      }, dur(ENVELOPE_EXIT_MS));
      return;
    }

    navigateTo(next, 'forward');
  }, [currentScreen, navigateTo, dur]);

  // Go to previous screen (arrow / swipe)
  const goBack = useCallback(() => {
    if (isTransitioningRef.current) return;
    const idx = SCREEN_ORDER.indexOf(currentScreen);
    if (idx <= 1) return; // Don't go back to envelope
    navigateTo(SCREEN_ORDER[idx - 1], 'back');
  }, [currentScreen, navigateTo]);

  // Go to next screen (arrow / swipe)
  const goForward = useCallback(() => {
    if (isTransitioningRef.current) return;
    const idx = SCREEN_ORDER.indexOf(currentScreen);
    if (idx >= SCREEN_ORDER.length - 1) return;

    // Envelope → use exit animation (not page turn)
    if (currentScreen === SCREENS.ENVELOPE) {
      setEnvelopeExiting(true);
      transitionTimer.current = setTimeout(() => {
        setEnvelopeExiting(false);
        setCurrentScreen(SCREEN_ORDER[idx + 1]);
      }, dur(ENVELOPE_EXIT_MS));
      return;
    }

    navigateTo(SCREEN_ORDER[idx + 1], 'forward');
  }, [currentScreen, navigateTo, dur]);

  // Keyboard navigation (arrow keys)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowLeft') {
        goBack();
      } else if (e.key === 'ArrowRight') {
        goForward();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [goBack, goForward]);

  // Swipe navigation (touch and mouse drag)
  const touchStartX = useRef(null);
  const touchStartY = useRef(null);
  const isDragging = useRef(false);
  const SWIPE_THRESHOLD = 50; // Minimum distance for swipe

  // Touch events
  const handleTouchStart = useCallback((e) => {
    // Disable swipe navigation on envelope (envelope has its own gestures)
    if (currentScreen === SCREENS.ENVELOPE) return;
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }, [currentScreen]);

  const handleTouchEnd = useCallback((e) => {
    if (touchStartX.current === null) return;

    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartX.current;
    const deltaY = touchEndY - touchStartY.current;

    // Only trigger if horizontal swipe is greater than vertical (not scrolling)
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      e.preventDefault(); // Prevent click from firing after swipe
      if (deltaX > 0) {
        // Swipe right = go back (like turning page backward)
        goBack();
      } else {
        // Swipe left = go forward (like turning page forward)
        goForward();
      }
    }

    touchStartX.current = null;
    touchStartY.current = null;
  }, [goBack, goForward]);

  // Mouse events (for desktop drag)
  const handleMouseDown = useCallback((e) => {
    // Disable drag navigation on envelope (envelope has its own drag for flip)
    if (currentScreen === SCREENS.ENVELOPE) return;
    isDragging.current = true;
    touchStartX.current = e.clientX;
    touchStartY.current = e.clientY;
  }, [currentScreen]);

  const handleMouseUp = useCallback((e) => {
    if (!isDragging.current || touchStartX.current === null) {
      isDragging.current = false;
      return;
    }

    const deltaX = e.clientX - touchStartX.current;
    const deltaY = e.clientY - touchStartY.current;

    // Only trigger if horizontal drag is greater than vertical
    if (Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      if (deltaX > 0) {
        // Drag right = go back
        goBack();
      } else {
        // Drag left = go forward
        goForward();
      }
    }

    isDragging.current = false;
    touchStartX.current = null;
    touchStartY.current = null;
  }, [goBack, goForward]);

  if (!greeting) {
    return (
      <div className="gc-container">
        <div className="gc-error">
          <p>This greeting could not be loaded.</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="gc-container"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {/* === Normal render (no transition active) === */}
      {!transitionState && !envelopeExiting && (
        <>
          {currentScreen === SCREENS.ENVELOPE && (
            <Envelope
              recipientName={greeting.recipientName}
              onSealClick={advanceScreen}
              onPlaySound={playWaxSound}
              onPlayFlipSound={playPaperSound}
            />
          )}

          {currentScreen === SCREENS.COVER && (
            <Cover
              occasionKey={greeting.occasionKey}
              onClick={advanceScreen}
            />
          )}

          {currentScreen === SCREENS.INTERIOR && (
            <InteriorSpread
              recipientName={greeting.recipientName}
              message={greeting.render?.writtenIntroText ?? greeting.writtenIntroText ?? greeting.greetingText}
              senderName={greeting.senderName}
              occasionKey={greeting.occasionKey}
              relationshipKey={greeting.relationshipKey}
              poemText={greeting.render?.poemText ?? greeting.poemText}
              onClick={advanceScreen}
            />
          )}

          {currentScreen === SCREENS.FEATURED && (
            <FeaturedSpread
              videoUrl={greeting.videoUrl}
              photos={greeting.photos}
              onClick={advanceScreen}
              videoHasEnded={videoHasEnded}
              onVideoEnd={() => setVideoHasEnded(true)}
            />
          )}

          {currentScreen === SCREENS.FINALE && (
            <FinaleSpread
              finaleText={greeting.finaleText}
              occasionKey={greeting.occasionKey}
              hasGift={greeting.hasGift}
            />
          )}
        </>
      )}

      {/* === Envelope exit (seal pop + lift away) === */}
      {envelopeExiting && (
        <div className="gc-envelope-exit">
          <Envelope
            recipientName={greeting.recipientName}
            onSealClick={() => {}}
          />
        </div>
      )}

      {/* === Page turn transition === */}
      {transitionState && (
        <div className="gc-screen-stage">
          <div className={`gc-screen ${transitionState.direction === 'forward' ? 'gc-turn-forward-out' : 'gc-turn-back-out'}`}>
            {renderScreenContent(transitionState.from)}
          </div>
          <div className={`gc-screen ${transitionState.direction === 'forward' ? 'gc-turn-forward-in' : 'gc-turn-back-in'}`}>
            {renderScreenContent(transitionState.to)}
          </div>
        </div>
      )}
    </div>
  );
}
