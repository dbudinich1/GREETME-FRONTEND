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

const DEFAULT_MESSAGE = 'Wishing you all the best on this special day. May it bring you joy and wonderful memories.';

export default function InteriorSpread({ recipientName, message, senderName, onClick }) {
  // GS-03: Never render empty - always use placeholder if missing
  const displayMessage = message?.trim() || DEFAULT_MESSAGE;
  const displaySender = senderName?.trim() || 'With love';
  
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
              Dearest {recipientName || 'Friend'},
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
