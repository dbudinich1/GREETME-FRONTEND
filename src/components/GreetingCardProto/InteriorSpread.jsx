/**
 * InteriorSpread.jsx
 * Screen 3: Interior Message Spread
 */

import React from 'react';
import cardInteriorImg from '../../assets/card/card-interior.png';

const DEFAULT_POEM = `On your special day, may you be
surrounded by those who love you most...

Another year of memories,
Another year of dreams,
May happiness find you always
In everything, it seems.`;

const DEFAULT_MESSAGE = `I wanted to take a moment to tell you how much you mean to me. Your kindness, your warmth, and your spirit light up every room you enter. The way you care for others, the joy you bring to every moment — these are gifts that touch everyone around you.

On this special day, I hope you feel as loved and cherished as you make everyone around you feel. You deserve all the happiness in the world, and so much more.

Through all of life's seasons, know that you are treasured beyond measure. Here's to celebrating you today and always — for the remarkable person you are and the light you bring to this world.`;

export default function InteriorSpread({ recipientName, message, senderName, onClick, navigation }) {
  // Capitalize first name per canonical rule
  const rawName = (recipientName || "Friend").trim() || "Friend";
  const displayName = rawName.charAt(0).toUpperCase() + rawName.slice(1);

  // GS-03: Never render empty - always use placeholder if missing
  // Note: message comes from writtenIntroText (backend), no personalSentiment
  const displayMessage = message?.trim() || `I've been thinking about you lately and wanted to reach out.\n\nYou matter to me more than you know.\n\nI hope this message finds you well.\n\nSending you all my best.`;

  // Signature: name only, no "With love" or similar
  const displaySender = senderName?.trim() || '';

  // Navigation available after first pass (for future back/forward UI)
  const canNavigate = navigation && !navigation.isFirstPass;
  
  return (
    <div 
      className="gc-spread-wrapper"
      onClick={onClick}
      role="button"
      tabIndex={0}
      aria-label="Click to continue"
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
    >
      <div 
        className="gc-spread gc-interior-spread"
        style={{ backgroundImage: `url(${cardInteriorImg})` }}
      >
        {/* Left Page */}
        <div className="gc-page gc-page-left">
          <div className="gc-page-content">
            <h2 className="gc-greeting-salutation">
              Dear {displayName},
            </h2>
            <p className="gc-greeting-message">
              {displayMessage}
            </p>
            <p className="gc-signature">{displaySender}</p>
            
          </div>
        </div>

        {/* Right Page */}
        <div className="gc-page gc-page-right">
          <div className="gc-page-content gc-poem-content">
            <p className="gc-poem">
              {DEFAULT_POEM}
            </p>
            <h3 className="gc-warm-wishes">With Warmest Wishes</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
