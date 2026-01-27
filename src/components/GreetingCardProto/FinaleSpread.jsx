/**
 * FinaleSpread.jsx
 * Screen 5: Closing + Gift
 * GS-06: Updated CTA text, removed "All my love", logo matches stamp brown
 *
 * CANONICAL LAYOUT LOCKS:
 * - Typography must match InteriorSpread (same ink color, font sizes, spacing)
 * - Uses shared letter block CSS system
 * - Signature: bottom-right, 2.5in from crease (via CSS --gc-letter-crease-offset)
 * - Name capitalization: Title Case (via formatPersonName helper)
 *
 * TODO: G Logo Asset Pending
 * - When final logo asset is provided, replace LogoPlaceholder component
 * - Do not recreate, approximate, or substitute the logo
 * - Current placeholder: Great Vibes "G" in circular brown seal (per reference HTML)
 */

import cardInteriorImg from '../../assets/card/card-interior.png';
import { formatPersonName } from '../../utils/formatPersonName';

// Placeholder G logo component - awaiting final asset
// Style based on reference HTML: circular brown seal with "G"
const LogoPlaceholder = () => (
  <div
    className="gc-logo-seal"
    aria-label="Greet-Me logo placeholder"
  >
    <span>G</span>
  </div>
);

export default function FinaleSpread({ greeting }) {
  // CANONICAL: Signature in Title Case (person's name)
  const displaySender = formatPersonName(greeting?.senderName);

  return (
    <div className="gc-spread-wrapper">
      <div
        className="gc-spread gc-finale-spread"
        style={{ backgroundImage: `url(${cardInteriorImg})` }}
      >
        {/* Left Page - CANONICAL: Same typography as InteriorSpread */}
        <div className="gc-page gc-page-left">
          <div className="gc-page-content">
            <p className="gc-closing-message">
              I hope this greeting brought a smile to your face and warmth to your heart. These moments we share are what life is all about — the connections, the memories, the love that binds us together.
            </p>
            <p className="gc-closing-note">
              May you carry this feeling with you always, and know that you are treasured beyond words.
            </p>
            {/* CANONICAL: Signature at bottom-right, 2.5in from crease */}
            {displaySender && (
              <p className="gc-finale-signature">{displaySender}</p>
            )}
          </div>
        </div>

        {/* Right Page */}
        <div className="gc-page gc-page-right">
          <div className="gc-page-content gc-gift-content">
            <h3 className="gc-gift-title">A little something extra</h3>

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
              Scan to redeem<br/>
              Treat yourself to something that makes you smile
            </p>

            <div className="gc-branding">
              {/* TODO: Replace with final G logo asset when provided */}
              <LogoPlaceholder />
              <span className="gc-brand-name">Greet-Me</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
