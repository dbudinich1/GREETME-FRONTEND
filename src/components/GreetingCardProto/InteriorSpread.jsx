/**
 * InteriorSpread.jsx
 * Screen 3: Interior Message Spread
 */

import { useRef, useEffect, useLayoutEffect, useCallback } from 'react';
import cardInteriorImg from '../../assets/card/card-interior.png';
import { formatPersonName } from '../../utils/formatPersonName';

const DEFAULT_POEM = `On your special day, may you be
surrounded by those who love you most...

Another year of memories,
Another year of dreams,
May happiness find you always
In everything, it seems.`;

const MAX_POEM_LINES = 4;
const MAX_CHARS_PER_LINE = 42;

// Format poem to fit within frame constraints
function formatPoemToFit(poemText, maxLines = MAX_POEM_LINES, maxCharsPerLine = MAX_CHARS_PER_LINE) {
  if (!poemText) return DEFAULT_POEM;

  // Split into lines and remove empty
  let lines = poemText.split('\n').filter(line => line.trim());

  // Wrap long lines at nearest space
  const wrappedLines = [];
  lines.forEach(line => {
    if (line.length <= maxCharsPerLine) {
      wrappedLines.push(line);
    } else {
      let remaining = line;
      while (remaining.length > maxCharsPerLine) {
        let splitIndex = remaining.lastIndexOf(' ', maxCharsPerLine);
        if (splitIndex === -1) splitIndex = maxCharsPerLine;
        wrappedLines.push(remaining.substring(0, splitIndex));
        remaining = remaining.substring(splitIndex).trim();
      }
      if (remaining) wrappedLines.push(remaining);
    }
  });

  // Cap to max lines (no ellipsis — backend enforces poem budget)
  if (wrappedLines.length > maxLines) {
    return wrappedLines.slice(0, maxLines).join('\n');
  }

  return wrappedLines.join('\n');
}

const MIN_MESSAGE_PX_DEFAULT = 19;
const MIN_MESSAGE_PX_PORTRAIT = 16;
const MIN_POEM_PX = 13;
const MAX_STEPS_MESSAGE = 16;
const MAX_STEPS_POEM = 16;
const MIN_LH = 1.05;
const LH_TIGHTEN_STEP = 0.03;

function countSentences(el) {
  if (!el) return 3;
  const text = el.textContent || '';
  return text.split(/[.!?]+/).filter(s => s.trim().length > 0).length;
}

function autoFitElement(el, cssVar, minPx, maxSteps, varTarget, startSize) {
  if (!el) return;
  const target = varTarget || el;
  target.style.removeProperty(cssVar);
  void el.offsetHeight;

  let size;
  if (startSize != null) {
    size = startSize;
    target.style.setProperty(cssVar, `${size}px`);
    void el.offsetHeight;
    if (el.scrollHeight <= el.clientHeight) return;
  } else {
    if (el.scrollHeight <= el.clientHeight) return;
    const computed = getComputedStyle(el);
    size = parseFloat(computed.fontSize);
  }

  for (let step = 0; step < maxSteps; step++) {
    size -= 1;
    if (size < minPx) { size = minPx; target.style.setProperty(cssVar, `${size}px`); break; }
    target.style.setProperty(cssVar, `${size}px`);
    if (el.scrollHeight <= el.clientHeight) break;
  }
}

function tightenLineHeight(el, varTarget) {
  if (!el || !varTarget) return;
  if (el.scrollHeight <= el.clientHeight) return;
  const computed = getComputedStyle(el);
  let lh = parseFloat(computed.lineHeight) / parseFloat(computed.fontSize);
  const startLh = lh;
  while (lh > MIN_LH && el.scrollHeight > el.clientHeight) {
    lh = Math.round((lh - LH_TIGHTEN_STEP) * 100) / 100;
    if (lh < MIN_LH) lh = MIN_LH;
    varTarget.style.setProperty('--fit-message-line-height', String(lh));
    void el.offsetHeight;
  }
  if (process.env.NODE_ENV === 'development' && lh < startLh) {
    console.log(`[AUTOFIT] LH tighten: ${startLh.toFixed(2)}→${lh.toFixed(2)}`);
  }
}

// Constant closing text — no occasion variations (spec: always this exact string)
const CLOSING_TEXT = 'With Warmest Wishes';

export default function InteriorSpread({ recipientName, message, senderName, occasionKey, poemText, onClick }) {
  // Refs for runtime fit check
  const messageRef = useRef(null);
  const poemRef = useRef(null);
  const signatureRef = useRef(null);
  const pageContentRef = useRef(null);

  const runAutoFit = useCallback(() => {
    const varTarget = pageContentRef.current;
    if (varTarget) varTarget.style.removeProperty('--fit-message-line-height');
    if (varTarget) varTarget.style.removeProperty('--fit-message-font-size');
    if (poemRef.current) poemRef.current.style.removeProperty('--fit-poem-font-size');
    let messageStartSize = null;
    if (messageRef.current && varTarget) {
      const baseSize = parseFloat(getComputedStyle(messageRef.current).fontSize);
      const sentences = countSentences(messageRef.current);
      if (sentences <= 3) messageStartSize = baseSize + 2;
    }
    const isPortraitMobile =
      window.matchMedia &&
      window.matchMedia('(max-width: 430px) and (orientation: portrait)').matches;

    const minMessagePx = isPortraitMobile ? MIN_MESSAGE_PX_PORTRAIT : MIN_MESSAGE_PX_DEFAULT;

    autoFitElement(messageRef.current, '--fit-message-font-size', minMessagePx, MAX_STEPS_MESSAGE, varTarget, messageStartSize);
    tightenLineHeight(messageRef.current, varTarget);

    // Page-level fit: shrink message font until full stack (salutation + occasion + message + signature) fits container.
    // Uses bounding rects because container may have overflow:visible (scrollHeight === clientHeight).
    // Subtracts container padding-bottom since getBoundingClientRect includes padding but flex content sits above it.
    if (varTarget && signatureRef.current) {
      const pageOverflows = () => {
        const pageRect = varTarget.getBoundingClientRect();
        const padBottom = parseFloat(getComputedStyle(varTarget).paddingBottom) || 0;
        const contentBottom = pageRect.bottom - padBottom;
        const sigRect = signatureRef.current.getBoundingClientRect();
        return sigRect.bottom > contentBottom;
      };
      if (pageOverflows()) {
        const computed = getComputedStyle(messageRef.current);
        let size = parseFloat(computed.fontSize);
        for (let step = 0; step < MAX_STEPS_MESSAGE; step++) {
          size -= 1;
          if (size < minMessagePx) { size = minMessagePx; varTarget.style.setProperty('--fit-message-font-size', `${size}px`); break; }
          varTarget.style.setProperty('--fit-message-font-size', `${size}px`);
          void varTarget.offsetHeight;
          if (!pageOverflows()) break;
        }
      }
    }

    autoFitElement(poemRef.current, '--fit-poem-font-size', MIN_POEM_PX, MAX_STEPS_POEM);

    // DEV: flag fit failures (content must never be truncated — regenerate instead)
    if (process.env.NODE_ENV === 'development') {
      if (messageRef.current && messageRef.current.scrollHeight > messageRef.current.clientHeight) {
        console.error('[AUTOFIT] INTRO_FIT_FAILED: message still clips after shrink-only auto-fit');
      }
      if (poemRef.current && poemRef.current.scrollHeight > poemRef.current.clientHeight) {
        console.error('[AUTOFIT] POEM_FIT_FAILED: poem still clips after shrink-only auto-fit');
      }
    }
  }, []);

  useLayoutEffect(() => {
    runAutoFit();
  }, [message, poemText, senderName, runAutoFit]);

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

  // DEV ONLY: Runtime fit check - warn if message overlaps signature
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;

    const checkFit = () => {
      if (!messageRef.current || !signatureRef.current || !pageContentRef.current) return;

      const messageRect = messageRef.current.getBoundingClientRect();
      const signatureRect = signatureRef.current.getBoundingClientRect();
      const pageRect = pageContentRef.current.getBoundingClientRect();

      // Check if message bottom overlaps signature top
      const messageBottom = messageRect.bottom;
      const signatureTop = signatureRect.top;

      if (messageBottom > signatureTop) {
        console.warn(
          `[LAYOUT FIT GATE] Message overlaps signature by ${Math.round(messageBottom - signatureTop)}px. ` +
          `Message: ${messageRect.height}px, Signature at: ${signatureTop - pageRect.top}px from page top.`
        );
      }

      // Check if content exceeds page bounds
      if (messageRect.bottom > pageRect.bottom || signatureRect.bottom > pageRect.bottom) {
        console.warn(
          `[LAYOUT FIT GATE] Content exceeds page bounds. ` +
          `Page height: ${pageRect.height}px, Content extends: ${Math.max(messageRect.bottom, signatureRect.bottom) - pageRect.top}px`
        );
      }
    };

    // Check on mount and when message changes
    const timer = setTimeout(checkFit, 100);
    return () => clearTimeout(timer);
  }, [message, senderName]);

  const displayName = formatPersonName((recipientName || 'Friend').split(' ')[0]);

  // GS-03: Never render empty - always use placeholder if missing
  const rawMessage = message?.trim() || `Happy Birthday!\n\nI've been thinking about you lately and wanted to reach out.\n\nYou matter to me more than you know.\n\nI hope this message finds you well.`;

  const displaySender = formatPersonName((senderName || 'Me').split(' ')[0]);

  const normalizedRawMessage = (() => {
    const lines = String(rawMessage || '').split('\n');
    // Remove leading blank lines
    while (lines.length && lines[0].trim() === '') lines.shift();
    // If first line is a salutation (Dear ...,), strip it
    if (lines.length && /^dear\s+.+,\s*$/i.test(lines[0].trim())) {
      lines.shift();
      // Also remove blank line after salutation if present
      if (lines.length && lines[0].trim() === '') lines.shift();
    }
    return lines.join('\n');
  })();

  // Split greeting (first line before \n\n) from body
  const [greeting, ...bodyParts] = normalizedRawMessage.split('\n\n');

  const CLOSING_PHRASES = [
    'thinking of you today and always',
    'thinking of you always',
    'with all my love',
    'all my love',
    'with love always',
    'love always',
    'with love',
    'yours truly',
    'yours forever',
    'always yours',
    'forever yours',
    'warmly',
    'fondly',
    'xoxo',
  ];

  let bodyMessage = bodyParts.join('\n\n');

  // Strip sender name from end if present
  if (displaySender && bodyMessage.trim().toLowerCase().endsWith(displaySender.toLowerCase())) {
    bodyMessage = bodyMessage.slice(0, -displaySender.length).trim();
  }
  // Strip trailing punctuation after name removal
  bodyMessage = bodyMessage.replace(/[,\s]+$/, '');

  let bodyLower = bodyMessage.trim().toLowerCase();
  for (const phrase of CLOSING_PHRASES) {
    if (bodyLower.endsWith(phrase)) {
      bodyMessage = bodyMessage.slice(0, -phrase.length).trim();
      bodyLower = bodyMessage.trim().toLowerCase();
    }
  }
  // Strip trailing punctuation after phrase removal
  bodyMessage = bodyMessage.replace(/[,\s]+$/, '');

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
          <div className="gc-page-content" ref={pageContentRef}>
            <h2 className="gc-greeting-salutation">
              Dear {displayName},
            </h2>
            <p className="gc-greeting-occasion">{greeting}</p>
            <div className="gc-greeting-message" ref={messageRef}>
              {bodyMessage
                .replace(/\r\n/g, '\n')
                .trim()
                .replace(/\n\s*\n+/g, '\n')
              }
            </div>
            <p className="gc-signature" ref={signatureRef}>{displaySender}</p>
          </div>
        </div>

        {/* Right Page */}
        <div className="gc-page gc-page-right">
          <div className="gc-page-content gc-poem-content">
            <p className="gc-poem" ref={poemRef}>{formatPoemToFit(poemText)}</p>
            <h3 className="gc-warm-wishes">{CLOSING_TEXT}</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
