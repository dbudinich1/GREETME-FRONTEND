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

import React, { useState, useCallback, useRef } from 'react';
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

// Audio paths
const AUDIO = {
  PAPER_SLIDE: '/assets/sounds/paper-slide.mp3',
  WAX_CRACKLE: '/assets/sounds/wax-crackle.mp3'
};

export default function GreetingCard({ greeting }) {
  const [currentScreen, setCurrentScreen] = useState(SCREENS.ENVELOPE);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioRef = useRef(null);

  const playAudio = useCallback((src) => {
    if (!audioUnlocked) return;
    
    try {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      
      audioRef.current = new Audio(src);
      audioRef.current.volume = 0.5;
      
      const timeout = setTimeout(() => {
        if (audioRef.current) {
          audioRef.current.pause();
        }
      }, 2000);
      
      audioRef.current.play().catch(() => {});
      audioRef.current.onended = () => clearTimeout(timeout);
    } catch (e) {}
  }, [audioUnlocked]);

  const advanceScreen = useCallback(() => {
    const currentIndex = SCREEN_ORDER.indexOf(currentScreen);
    if (currentIndex >= SCREEN_ORDER.length - 1) return;
    
    const nextScreen = SCREEN_ORDER[currentIndex + 1];
    
    if (!audioUnlocked) {
      setAudioUnlocked(true);
    }
    
    // Play audio based on transition
    if (currentScreen === SCREENS.ENVELOPE) {
      setTimeout(() => playAudio(AUDIO.WAX_CRACKLE), 100);
    } else {
      setTimeout(() => playAudio(AUDIO.PAPER_SLIDE), 100);
    }
    
    setCurrentScreen(nextScreen);
  }, [currentScreen, audioUnlocked, playAudio]);

  if (!greeting) {
    return (
      <div className="gc-container">
        <div className="gc-error">
          <p>This greeting could not be loaded.</p>
        </div>
      </div>
    );
  }

  console.log('Greeting object:', greeting);
  console.log('Photos field:', greeting.photos);

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
