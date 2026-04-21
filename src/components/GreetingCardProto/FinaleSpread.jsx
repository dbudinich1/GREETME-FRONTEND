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
import QRCode from 'qrcode';
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
    /\n+[A-Z][\w.'-]*(?:\s+[A-Z][\w.'-]*){0,2}\.?\s*$/, // Standalone 1-3 word name at end after newline
  ];

  let cleaned = text.trim();
  for (const pattern of SIGNOFF_PATTERNS) {
    cleaned = cleaned.replace(pattern, '').trim();
  }
  return cleaned;
};

// CANONICAL: Deterministic finale sign-off by occasion
const OCCASION_SIGNOFFS = {
  birthday:       'May all your birthday wishes come true.',
  bday:           'May all your birthday wishes come true.',
  anniversary:    'All my love.',
  get_well:       'Get well soon!',
  getwell:        'Get well soon!',
  sympathy:       'With warmest regards.',
  condolence:     'With warmest regards.',
  thank_you:      'With warmest wishes.',
  thankyou:       'With warmest wishes.',
  thanks:         'With warmest wishes.',
  holiday:        'With warmest holiday wishes.',
  christmas:      'With warmest holiday wishes.',
  hanukkah:       'With warmest holiday wishes.',
  thinking_of_you:'With warmest wishes.',
  thinking:       'With warmest wishes.',
  general:        'With warmest wishes.',
};

function getOccasionSignoff(occasionKey) {
  if (!occasionKey) return null;
  const key = occasionKey.toLowerCase().replace(/[\s-]/g, '_');
  // Direct match
  if (OCCASION_SIGNOFFS[key]) return OCCASION_SIGNOFFS[key];
  // Partial match (e.g. "birthday_milestone" matches "birthday")
  for (const [k, v] of Object.entries(OCCASION_SIGNOFFS)) {
    if (key.includes(k)) return v;
  }
  return null;
}

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

export default function FinaleSpread({ finaleText, occasionKey, hasGift, gift, courtesyCreditCode }) {
  const closingMessageRef = useRef(null);
  const [qrImageError, setQrImageError] = useState(false);
  const [courtesyQrUrl, setCourtesyQrUrl] = useState(null);

  // Generate courtesy credit QR ONLY when a real tracked credit code exists
  useEffect(() => {
    if (hasGift || !courtesyCreditCode) return;
    const creditUrl = `${window.location.origin}/#/claim-credit/${courtesyCreditCode}`;
    QRCode.toDataURL(creditUrl, {
      width: 400, margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setCourtesyQrUrl).catch(() => {});
  }, [hasGift, courtesyCreditCode]);

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

  // CANONICAL: Strip ALL known occasion sign-offs to prevent duplication, then append one
  const signoff = getOccasionSignoff(occasionKey);
  if (cleanedFinale) {
    // Remove every known sign-off phrase (handles backend having already appended one)
    const allSignoffs = [...new Set(Object.values(OCCASION_SIGNOFFS))];
    for (const so of allSignoffs) {
      const escaped = so.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\./, '\\.?');
      cleanedFinale = cleanedFinale.replace(new RegExp('\\s*' + escaped + '\\s*', 'gi'), ' ').trim();
    }
    // Generic sign-off strip: catch AI variants not in the canonical list
    cleanedFinale = cleanedFinale
      .replace(/with\s+\w+\s+(wishes|regards|love)[.,]?/gi, '')
      .replace(/warm\s+(wishes|regards)[.,]?/gi, '')
      .replace(/wishing you[^.!\n]*/gi, '')
      .trim();
  }
  if (signoff && cleanedFinale) {
    cleanedFinale = `${cleanedFinale}\n\n${signoff}`;
  } else if (signoff) {
    cleanedFinale = signoff;
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
                    ? 'Scan or tap to claim your gift'
                    : 'A QR Cash\u2122 gift is included with this greeting'}
                </p>

                {/* Gift It Forward moved to unified CTA panel below */}
              </>
            ) : hasGift ? (
              <>
                <h3 className="gc-gift-title">A little something extra</h3>
                <p className="gc-gift-instruction" style={{ marginBottom: '0.75em' }}>
                  Treat yourself to something that makes you smile!
                </p>
                <a
                  href="/#/pricing"
                  style={{
                    display: 'inline-block',
                    padding: '0.45em 1.2em',
                    background: 'linear-gradient(135deg, #3A7BD5 0%, #1B2A4A 100%)',
                    color: '#fff',
                    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    fontSize: '0.7em',
                    fontWeight: 600,
                    borderRadius: '20px',
                    textDecoration: 'none',
                  }}
                >
                  Browse Plans
                </a>
              </>
            ) : (
              <>
                <h3 className="gc-gift-title" style={{ fontSize: '0.85em', whiteSpace: 'nowrap' }}>A Gift From Greet-Me</h3>

                {courtesyQrUrl && courtesyCreditCode ? (
                  <>
                    <a
                      href={`${window.location.origin}/#/claim-credit/${courtesyCreditCode}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label="Claim your $5 Greet-Me credit"
                      style={{ display: 'block', textDecoration: 'none' }}
                    >
                      <div className="gc-qr-frame">
                        <div className="gc-qr-code">
                          <img
                            src={courtesyQrUrl}
                            alt="Scan to claim your $5 Greet-Me credit"
                            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                          />
                        </div>
                      </div>
                    </a>
                    <p className="gc-gift-instruction">
                      Scan or tap to claim your gift
                    </p>
                  </>
                ) : (
                  <>
                    <p className="gc-gift-instruction" style={{ marginBottom: '0.5em' }}>
                      We've included $5 toward your first Greet-Me subscription.
                    </p>
                    <a
                      href="/#/courtesy-credit?amount=5&source=finale"
                      style={{
                        display: 'inline-block',
                        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                        fontSize: '0.85em',
                        color: '#10b981',
                        textDecoration: 'underline',
                        marginBottom: '0.5em',
                      }}
                    >
                      Tap to claim your $5 credit
                    </a>
                  </>
                )}
              </>
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
