/**
 * FinaleSpread.jsx
 * Screen 5: Closing + Gift
 * GS-06: Updated CTA text, removed "All my love", logo matches stamp brown
 */

import React from 'react';
import cardInteriorImg from '../../assets/card/card-interior.png';

export default function FinaleSpread({ greeting }) {
  return (
    <div className="gc-spread-wrapper">
      <div
        className="gc-spread gc-finale-spread"
        style={{ backgroundImage: `url(${cardInteriorImg})` }}
      >
        {/* Left Page */}
        <div className="gc-page gc-page-left">
          <div className="gc-page-content">
            <p className="gc-closing-message">
              I hope you loved this special greeting — these are precious moments worth cherishing, and I wanted you to have them always.
            </p>
            <p className="gc-closing-note">
              Don't forget to check the gift... I picked it just for you!
            </p>
          </div>
        </div>

        {/* Right Page */}
        <div className="gc-page gc-page-right">
          <div className="gc-page-content gc-gift-content">
            <h3 className="gc-gift-title">Scan and redeem</h3>

            <div className="gc-qr-frame">
              <div className="gc-qr-code">
                <svg viewBox="0 0 100 100" className="gc-qr-placeholder">
                  <rect x="10" y="10" width="20" height="20" fill="currentColor"/>
                  <rect x="70" y="10" width="20" height="20" fill="currentColor"/>
                  <rect x="10" y="70" width="20" height="20" fill="currentColor"/>
                  <rect x="40" y="40" width="20" height="20" fill="currentColor"/>
                  <rect x="35" y="15" width="10" height="10" fill="currentColor"/>
                  <rect x="55" y="35" width="10" height="10" fill="currentColor"/>
                  <rect x="15" y="45" width="10" height="10" fill="currentColor"/>
                  <rect x="75" y="55" width="10" height="10" fill="currentColor"/>
                  <rect x="45" y="75" width="10" height="10" fill="currentColor"/>
                </svg>
              </div>
            </div>

            <p className="gc-gift-instruction">
              Treat yourself to something<br/>
              that makes you smile
            </p>

            <div className="gc-branding">
              <span className="gc-brand-logo">G</span>
              <span className="gc-brand-name">Greet-Me</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
