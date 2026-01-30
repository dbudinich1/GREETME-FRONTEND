/**
 * FinaleSpread.jsx
 * Screen 5: Closing + Gift
 * GS-06: Updated CTA text, removed "All my love", logo matches stamp brown
 *
 * CANONICAL LAYOUT LOCKS:
 * - Typography: Tangerine font, blue ink, frame clamp
 * - NO SIGNATURE on Finale spread (removed per canonical rule)
 * - Uses shared letter block CSS system for frame clamp
 *
 * TODO: G Logo Asset Pending
 * - When final logo asset is provided, replace LogoPlaceholder component
 * - Do not recreate, approximate, or substitute the logo
 * - Current placeholder: Great Vibes "G" in circular brown seal (per reference HTML)
 */

import cardInteriorImg from '../../assets/card/card-interior.png';

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

// Default closing message when no finaleText is provided
const DEFAULT_FINALE = `I hope this greeting brought a smile to your face and warmth to your heart. These moments we share are what life is all about — the connections, the memories, the love that binds us together.

May you carry this feeling with you always, and know that you are treasured beyond words.

May all your Birthday wishes come true.`;

// Strip signature/sign-off from end of finaleText
const stripSignature = (text) => {
  if (!text) return text;

  // Common sign-off patterns to remove from end
  const SIGNOFF_PATTERNS = [
    /,?\s*(with all my love|all my love|with love|love always|yours truly|yours forever|always yours|forever yours|warmly|fondly|xoxo|thinking of you)[,\s]*[\w]+\.?\s*$/i,
    /,?\s*(with all my love|all my love|with love|love always|yours truly|yours forever|always yours|forever yours|warmly|fondly|xoxo|thinking of you)[,\s]*$/i,
    /\n+[\w]+\.?\s*$/i, // Standalone name at end after newline
  ];

  let cleaned = text.trim();
  for (const pattern of SIGNOFF_PATTERNS) {
    cleaned = cleaned.replace(pattern, '').trim();
  }
  return cleaned;
};

export default function FinaleSpread({ finaleText }) {
  // CANONICAL: NO SIGNATURE on Finale spread - strip any sign-off from AI text
  const cleanedFinale = stripSignature(finaleText);

  return (
    <div className="gc-spread-wrapper">
      <div
        className="gc-spread gc-finale-spread"
        style={{ backgroundImage: `url(${cardInteriorImg})` }}
      >
        {/* Left Page - CANONICAL: Tangerine font, blue ink, NO signature */}
        <div className="gc-page gc-page-left">
          <div className="gc-page-content">
            <div className="gc-closing-message">
              {(cleanedFinale || DEFAULT_FINALE).split('\n\n').map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
            {/* CANONICAL: No signature on Finale spread */}
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
              Scan to redeem your gift<br/>
              Treat yourself to something that makes you smile!
            </p>

            <div className="gc-branding">
              {/* TODO: Replace with final G logo asset when provided */}
              <LogoPlaceholder />
              <span className="gc-brand-name">Greet-Me</span>
            </div>
            <p className="gc-brand-tagline">This moment was lovingly prepared for you</p>
          </div>
        </div>
      </div>
    </div>
  );
}
