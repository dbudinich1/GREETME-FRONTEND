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
 */

import { useState, useCallback, useEffect, useRef } from 'react';
import Envelope from './Envelope';
import Cover from './Cover';
import InteriorSpread from './InteriorSpread';
import FeaturedSpread from './FeaturedSpread';
import FinaleSpread from './FinaleSpread';
import './greetingCard.css';

// Audio: Paper slide sound for page transitions
// TODO: Final audio asset pending - currently using placeholder
const PAPER_SLIDE_SRC = '/assets/sounds/paper-slide.mp3';

// Play audio with error handling (fail-silent)
// Canon: paper-slide volume = 0.35, max duration = 300ms
const playSound = (src, volume = 0.35, maxDuration = 300) => {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {
      // Fail silently - audio may be blocked by browser
    });
    // Hard-stop at maxDuration (canon restraint)
    setTimeout(() => {
      audio.pause();
      audio.currentTime = 0;
    }, maxDuration);
  } catch {
    // Fail silently
  }
};

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

export default function GreetingCard({ greeting }) {
  const [currentScreen, setCurrentScreen] = useState(SCREENS.ENVELOPE);
  const [hasCompletedFirstPass, setHasCompletedFirstPass] = useState(false);
  // Lift video state to persist across page navigation
  const [videoHasEnded, setVideoHasEnded] = useState(false);

  // Advance to next screen (guided navigation)
  const advanceScreen = useCallback(() => {
    const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
    if (currentIndex >= SCREEN_ORDER.length - 1) {
      // Reached finale - unlock free navigation
      setHasCompletedFirstPass(true);
      return;
    }

    // Play paper slide sound on page turn (not on envelope->cover, seal handles that)
    if (currentIndex > 0) {
      playSound(PAPER_SLIDE_SRC);
    }

    const nextScreen = SCREEN_ORDER[currentIndex + 1];
    setCurrentScreen(nextScreen);

    // Mark first pass complete when reaching finale
    if (nextScreen === SCREENS.FINALE) {
      setHasCompletedFirstPass(true);
    }
  }, [currentScreen]);

  // Go to previous screen (available after leaving envelope)
  const goBack = useCallback(() => {
    const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
    if (currentIndex <= 1) return; // Don't go back to envelope

    playSound(PAPER_SLIDE_SRC);
    setCurrentScreen(SCREEN_ORDER[currentIndex - 1]);
  }, [currentScreen]);

  // Go to next screen
  const goForward = useCallback(() => {
    const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
    if (currentIndex >= SCREEN_ORDER.length - 1) return;

    playSound(PAPER_SLIDE_SRC);
    setCurrentScreen(SCREEN_ORDER[currentIndex + 1]);

    // Mark first pass complete when reaching finale
    if (SCREEN_ORDER[currentIndex + 1] === SCREENS.FINALE) {
      setHasCompletedFirstPass(true);
    }
  }, [currentScreen]);

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
      {currentScreen === SCREENS.ENVELOPE && (
        <Envelope
          recipientName={greeting.recipientName}
          onSealClick={advanceScreen}
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
          message={greeting.writtenIntroText || greeting.greetingText}
          senderName={greeting.senderName}
          occasionKey={greeting.occasionKey}
          relationshipKey={greeting.relationshipKey}
          poemText={greeting.poemText}
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
        <FinaleSpread finaleText={greeting.finaleText} />
      )}
    </div>
  );
}
