/**
 * FinaleSpread.jsx
 * Screen 5: Closing + Gift
 * GS-06: Updated CTA text, removed "All my love", logo matches stamp brown
 *
 * CANONICAL LAYOUT LOCKS:
 * - Typography: Tangerine font, blue ink, frame clamp
 * - NO SIGNATURE on Finale spread (removed per canonical rule)
 * - Uses shared letter block CSS system for frame clamp
 * - Shrink-only auto-fit: if content overflows, shrink font until it fits
 *
 * TODO: G Logo Asset Pending
 * - When final logo asset is provided, replace LogoPlaceholder component
 * - Do not recreate, approximate, or substitute the logo
 * - Current placeholder: Great Vibes "G" in circular brown seal (per reference HTML)
 */

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import cardInteriorImg from '../../assets/card/card-interior.png';

// Placeholder G logo component - awaiting final asset
// Style based on reference HTML: circular brown seal with "G"
const LogoPlaceholder = () => (
  <div
    className="gc-logo-seal"
    aria-label="Greet-Me™ logo placeholder"
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

// CANONICAL: Birthday greetings always end with this sign-off
const BIRTHDAY_SIGNOFF = 'May all your birthday wishes come true.';

// Check if occasion is a birthday type
const isBirthdayOccasion = (occasionKey) => {
  if (!occasionKey) return false;
  const key = occasionKey.toLowerCase();
  return key.includes('birthday') || key === 'bday';
};

// AUTO-FIT constants (same floors as InteriorSpread)
const MIN_FINALE_PX = 14;
const MAX_STEPS = 16;
const MIN_LH = 1.20;
const LH_TIGHTEN_STEP = 0.03;

function autoFitElement(el, cssVar, minPx, maxSteps) {
  if (!el) return;
  // Clear previous fit override so we measure from the CSS baseline
  el.style.removeProperty(cssVar);
  void el.offsetHeight;

  if (el.scrollHeight <= el.clientHeight) return; // Already fits

  const computed = getComputedStyle(el);
  let size = parseFloat(computed.fontSize);

  for (let step = 0; step < maxSteps; step++) {
    size -= 1;
    if (size < minPx) { size = minPx; el.style.setProperty(cssVar, `${size}px`); break; }
    el.style.setProperty(cssVar, `${size}px`);
    void el.offsetHeight;
    if (el.scrollHeight <= el.clientHeight) break;
  }
}

function tightenLineHeight(el) {
  if (!el) return;
  if (el.scrollHeight <= el.clientHeight) return;
  const computed = getComputedStyle(el);
  let lh = parseFloat(computed.lineHeight) / parseFloat(computed.fontSize);
  while (lh > MIN_LH && el.scrollHeight > el.clientHeight) {
    lh = Math.round((lh - LH_TIGHTEN_STEP) * 100) / 100;
    if (lh < MIN_LH) lh = MIN_LH;
    el.style.setProperty('--fit-finale-line-height', String(lh));
    void el.offsetHeight;
  }
}

export default function FinaleSpread({ finaleText, occasionKey, hasGift, gift, jobId }) {
  const closingMessageRef = useRef(null);
  const [qrImageError, setQrImageError] = useState(false);

  // Growth Engine: fire GIFT_IT_FORWARD_TRIGGERED event (fire-and-forget)
  const handleGiftItForward = () => {
    if (jobId) {
      fetch('/api/events/gift-it-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId }),
      }).catch(() => {});
    }
  };

  // AUTO-FIT: shrink-only until no clipping
  const runAutoFit = useCallback(() => {
    const el = closingMessageRef.current;
    if (!el) return;
    // Clear previous overrides
    el.style.removeProperty('--fit-finale-font-size');
    el.style.removeProperty('--fit-finale-line-height');
    void el.offsetHeight;

    // Shrink font
    autoFitElement(el, '--fit-finale-font-size', MIN_FINALE_PX, MAX_STEPS);
    // If still clips after font-size floor, tighten line-height
    tightenLineHeight(el);

    if (process.env.NODE_ENV === 'development') {
      if (el.scrollHeight > el.clientHeight + 2) {
        console.error('[AUTOFIT] FINALE_FIT_FAILED: closing message still clips after shrink-only auto-fit');
      }
    }
  }, []);

  useLayoutEffect(() => {
    runAutoFit();
  }, [finaleText, runAutoFit]);

  // Re-run after web fonts load
  useEffect(() => {
    document.fonts.ready.then(() => runAutoFit());
  }, [runAutoFit]);

  // Debounced resize handler
  useEffect(() => {
    let timer;
    const handleResize = () => {
      clearTimeout(timer);
      timer = setTimeout(runAutoFit, 200);
    };
    window.addEventListener('resize', handleResize);
    return () => { clearTimeout(timer); window.removeEventListener('resize', handleResize); };
  }, [runAutoFit]);

  // CANONICAL: NO SIGNATURE on Finale spread - strip any sign-off from AI text
  let cleanedFinale = stripSignature(finaleText);

  // CANONICAL: Birthday greetings MUST end with birthday sign-off
  if (isBirthdayOccasion(occasionKey)) {
    // Remove existing birthday sign-off if present (to avoid duplication)
    if (cleanedFinale) {
      cleanedFinale = cleanedFinale
        .replace(/may all your birthday wishes come true\.?\s*$/i, '')
        .trim();
    }
    // Append the canonical birthday sign-off
    cleanedFinale = cleanedFinale
      ? `${cleanedFinale}\n\n${BIRTHDAY_SIGNOFF}`
      : BIRTHDAY_SIGNOFF;
  }

  return (
    <div className="gc-spread-wrapper">
      <div
        className="gc-spread gc-finale-spread"
        style={{ backgroundImage: `url(${cardInteriorImg})` }}
      >
        {/* Left Page - CANONICAL: Tangerine font, blue ink, NO signature */}
        <div className="gc-page gc-page-left">
          <div className="gc-page-content">
            <div className="gc-closing-message" ref={closingMessageRef}>
              {(cleanedFinale || DEFAULT_FINALE).replace(/\n\n/g, '\n')}
            </div>
            {/* CANONICAL: No signature on Finale spread */}
          </div>
        </div>

        {/* Right Page */}
        <div className="gc-page gc-page-right">
          <div className="gc-page-content gc-gift-content">
            {hasGift && gift?.type === 'qrcash' ? (
              <>
                <h3 className="gc-gift-title">A little something extra</h3>

                {/* Real QR image from backend, wrapped as tap target */}
                {(gift.qrUrl || gift.qrImageUrl) && !qrImageError ? (
                  <a
                    href={gift.claimUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open your QR Cash gift"
                    style={{ display: 'block', textDecoration: 'none' }}
                  >
                    <div className="gc-qr-frame">
                      <div className="gc-qr-code">
                        <img
                          src={gift.qrUrl || gift.qrImageUrl}
                          alt="Scan to claim your QR Cash™ gift"
                          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          onError={() => setQrImageError(true)}
                        />
                      </div>
                    </div>
                  </a>
                ) : gift.claimUrl ? (
                  /* QR image failed or missing — minimal text-link fallback */
                  <a
                    href={gift.claimUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open your QR Cash gift"
                    style={{
                      display: 'inline-block',
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                      fontSize: '0.85em',
                      color: '#d97706',
                      textDecoration: 'underline',
                      marginBottom: '0.5em',
                    }}
                  >
                    Tap here to claim your gift
                  </a>
                ) : null}

                <p className="gc-gift-instruction">
                  {(gift.qrUrl || gift.qrImageUrl) && !qrImageError
                    ? 'Scan to claim your QR Cash\u2122 gift'
                    : 'A QR Cash\u2122 gift is included with this greeting'}
                </p>

                {/* Gift It Forward CTA — viral trigger at peak emotion
                     Phase 1: only shown for qrcash gifts. Non-qrcash and no-gift
                     greetings do not show this CTA. Expand in Phase 2. */}
                <a
                  href="/#/pricing"
                  onClick={handleGiftItForward}
                  style={{
                    display: 'inline-block',
                    marginTop: '0.75em',
                    padding: '0.5em 1.2em',
                    background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
                    color: '#fff',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '0.75em',
                    fontWeight: 600,
                    borderRadius: '6px',
                    textDecoration: 'none',
                    boxShadow: '0 2px 6px rgba(245, 158, 11, 0.3)',
                  }}
                >
                  Gift It Forward
                </a>
              </>
            ) : hasGift ? (
              <>
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
                  Treat yourself to something that makes you smile!
                </p>
              </>
            ) : (
              <>
                <h3 className="gc-gift-title">A Gift From Greet-Me</h3>

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
                  Enjoy $5 toward your first Greet-Me subscription.
                </p>
              </>
            )}

            {/* Share the Moment — Web Share API (all greetings) */}
            {typeof navigator !== 'undefined' && navigator.share && (
              <button
                onClick={() => {
                  const shareUrl = `${window.location.origin}/#/g/${jobId || ''}`;
                  navigator.share({
                    title: 'Someone sent me a Greet-Me',
                    text: 'I just received a beautiful AI-animated greeting. Check out Greet-Me!',
                    url: shareUrl,
                  }).catch(() => {});
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.4em',
                  marginTop: '0.75em',
                  marginBottom: '0.5em',
                  padding: '0.5em 1em',
                  background: 'linear-gradient(135deg, #3A7BD5 0%, #1B2A4A 100%)',
                  color: '#fff',
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                  fontSize: '0.7em',
                  fontWeight: 600,
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(58, 123, 213, 0.3)',
                }}
              >
                <span style={{ fontSize: '1.1em' }}>&#x1F4E4;</span>
                Share the Moment
              </button>
            )}

            <div className="gc-branding">
              {/* TODO: Replace with final G logo asset when provided */}
              <LogoPlaceholder />
              <span className="gc-brand-name">Greet-Me™</span>
            </div>
            <p className="gc-brand-tagline">This moment was lovingly prepared for you.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
