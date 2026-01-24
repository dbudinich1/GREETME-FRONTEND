/**
 * GreetingCard.jsx
 * Screen controller for the 5-screen greeting experience
 * 
 * Screens:
 * 1. ENVELOPE - Interactive 3D envelope (front/back via drag)
 * 2. COVER - Standalone card cover
 * 3. INTERIOR - Message spread
 * 4. FEATURED - Video + Photo album
 * 5. FINALE - Signature + Gift
 */

import React, { useState, useCallback } from 'react';
import Envelope from './Envelope';
import Cover from './Cover';
import InteriorSpread from './InteriorSpread';
import FeaturedSpread from './FeaturedSpread';
import FinaleSpread from './FinaleSpread';
import './greetingCard.css';

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

  const advanceScreen = useCallback(() => {
    const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
    if (currentIndex >= SCREEN_ORDER.length - 1) return;

    const nextScreen = SCREEN_ORDER[currentIndex + 1];
    setCurrentScreen(nextScreen);
  }, [currentScreen]);

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
          message={greeting.greetingText}
          senderName={greeting.senderName}
          onClick={advanceScreen}
        />
      )}

      {currentScreen === SCREENS.FEATURED && (
        <FeaturedSpread
          videoUrl={greeting.videoUrl}
          photos={greeting.photos}
          onClick={advanceScreen}
        />
      )}

      {currentScreen === SCREENS.FINALE && (
        <FinaleSpread greeting={greeting} />
      )}
    </div>
  );
}
