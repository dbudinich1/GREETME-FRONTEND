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

import { useState, useCallback } from 'react';
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
const playSound = (src, volume = 0.4) => {
  try {
    const audio = new Audio(src);
    audio.volume = volume;
    audio.play().catch(() => {
      // Fail silently - audio may be blocked by browser
    });
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
      playSound(PAPER_SLIDE_SRC, 0.4);
    }

    const nextScreen = SCREEN_ORDER[currentIndex + 1];
    setCurrentScreen(nextScreen);

    // Mark first pass complete when reaching finale
    if (nextScreen === SCREENS.FINALE) {
      setHasCompletedFirstPass(true);
    }
  }, [currentScreen]);

  // Go to previous screen (only after first pass)
  const goBack = useCallback(() => {
    if (!hasCompletedFirstPass) return;
    const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
    if (currentIndex <= 1) return; // Don't go back to envelope

    playSound(PAPER_SLIDE_SRC, 0.4);
    setCurrentScreen(SCREEN_ORDER[currentIndex - 1]);
  }, [currentScreen, hasCompletedFirstPass]);

  // Go to next screen (only after first pass)
  const goForward = useCallback(() => {
    if (!hasCompletedFirstPass) return;
    const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
    if (currentIndex >= SCREEN_ORDER.length - 1) return;

    playSound(PAPER_SLIDE_SRC, 0.4);
    setCurrentScreen(SCREEN_ORDER[currentIndex + 1]);
  }, [currentScreen, hasCompletedFirstPass]);

  // Navigation state for child components
  const navigation = {
    canGoBack: hasCompletedFirstPass && SCREEN_ORDER.indexOf(currentScreen) > 1,
    canGoForward: hasCompletedFirstPass && SCREEN_ORDER.indexOf(currentScreen) < SCREEN_ORDER.length - 1,
    goBack,
    goForward,
    isFirstPass: !hasCompletedFirstPass
  };

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
    <div className="gc-container">
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
          onClick={advanceScreen}
          navigation={navigation}
        />
      )}

      {currentScreen === SCREENS.FEATURED && (
        <FeaturedSpread
          videoUrl={greeting.videoUrl}
          photos={greeting.photos}
          onClick={advanceScreen}
          navigation={navigation}
        />
      )}

      {currentScreen === SCREENS.FINALE && (
        <FinaleSpread />
      )}
    </div>
  );
}
