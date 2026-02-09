/**
 * InteriorSpread.jsx
 * Screen 3: Interior Message Spread
 *
 * CANONICAL LAYOUT LOCKS:
 * - Recipient name: top-left, 1.5in from top (via CSS --gc-letter-top-offset)
 * - Signature: bottom-right, 2.5in from crease (via CSS --gc-letter-crease-offset)
 * - Name capitalization: Title Case (via formatPersonName helper)
 *
 * LOCK STATE: See GREETING_LOCK.md for authoritative CSS values
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

// CANONICAL: Poem fitting rules
const MAX_POEM_LINES = 8;
const MAX_CHARS_PER_LINE = 45;

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

  // Truncate to max lines with ellipsis
  if (wrappedLines.length > maxLines) {
    return wrappedLines.slice(0, maxLines).join('\n') + '...';
  }

  return wrappedLines.join('\n');
}

// Dynamic font size based on line count
function getPoemFontSize(lineCount) {
  if (lineCount <= 4) return '42px';
  if (lineCount <= 6) return '38px';
  return '34px';
}

// AUTO-FIT: Shrink font by 1px steps until content fits (no clipping)
const MIN_MESSAGE_PX = 16;
const MIN_POEM_PX = 13;
const MAX_STEPS = 8;

function autoFitElement(el, cssVar, minPx, maxSteps) {
  if (!el) return;
  // Clear previous fit override so we measure from the lock token baseline
  el.style.removeProperty(cssVar);
  // Allow browser to recalc after clearing
  void el.offsetHeight;
  if (el.scrollHeight <= el.clientHeight + 2) return; // Not clipped
  const computed = getComputedStyle(el);
  let size = parseFloat(computed.fontSize);
  for (let step = 0; step < maxSteps; step++) {
    size -= 1;
    if (size < minPx) { size = minPx; el.style.setProperty(cssVar, `${size}px`); break; }
    el.style.setProperty(cssVar, `${size}px`);
    if (el.scrollHeight <= el.clientHeight + 2) break;
  }
}

// CANONICAL: Limit intro message to 8 lines (backup constraint)
function limitToLines(text, maxLines = 8) {
  if (!text) return '';
  const lines = text.split('\n').filter(line => line.trim());
  if (lines.length > maxLines) {
    return lines.slice(0, maxLines).join('\n') + '...';
  }
  return text;
}

export default function InteriorSpread({ recipientName, message, senderName, poemText, onClick }) {
  // Refs for runtime fit check
  const messageRef = useRef(null);
  const poemRef = useRef(null);
  const signatureRef = useRef(null);
  const pageContentRef = useRef(null);

  // AUTO-FIT: shrink font until no clipping, runs after every render
  const runAutoFit = useCallback(() => {
    autoFitElement(messageRef.current, '--fit-message-font-size', MIN_MESSAGE_PX, MAX_STEPS);
    autoFitElement(poemRef.current, '--fit-poem-font-size', MIN_POEM_PX, MAX_STEPS);
  }, []);

  useLayoutEffect(() => {
    runAutoFit();
  }, [message, poemText, senderName, runAutoFit]);

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

  // CANONICAL: Title Case FIRST NAME only via formatPersonName helper
  const displayName = formatPersonName((recipientName || 'Friend').split(' ')[0]);

  // GS-03: Never render empty - always use placeholder if missing
  const rawMessage = message?.trim() || `Happy Birthday!\n\nI've been thinking about you lately and wanted to reach out.\n\nYou matter to me more than you know.\n\nI hope this message finds you well.`;

  // CANONICAL: Signature in Title Case (FIRST NAME only)
  // Fallback to 'Me' if senderName is missing
  const displaySender = formatPersonName((senderName || 'Me').split(' ')[0]);

  // CANONICAL: Strip duplicate salutation if content already includes "Dear X,"
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

  // CANONICAL: Never place text after signature - strip closing phrases and sender name
  // Common closing phrases that should appear BEFORE signature, not after
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

  // Strip any closing phrases from end of body (they belong before signature, not after)
  let bodyLower = bodyMessage.trim().toLowerCase();
  for (const phrase of CLOSING_PHRASES) {
    if (bodyLower.endsWith(phrase)) {
      bodyMessage = bodyMessage.slice(0, -phrase.length).trim();
      bodyLower = bodyMessage.trim().toLowerCase();
    }
  }
  // Strip trailing punctuation after phrase removal
  bodyMessage = bodyMessage.replace(/[,\s]+$/, '');

  // CANONICAL: Apply 8-line limit as backup constraint
  bodyMessage = limitToLines(bodyMessage, 8);

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
                .replace(/\r\n/g, '\n')           // Normalize Windows line endings
                .trim()                            // Remove leading/trailing whitespace
                .split(/\n\s*\n+/)                 // Split on blank lines (paragraphs only)
                .map(para => para.trim().replace(/\n/g, ' '))  // Collapse internal newlines to spaces
                .filter(para => para.length > 0)   // Remove empty paragraphs
                .map((para, i) => (
                  <p key={i}>{para}</p>
                ))
              }
            </div>
            <p className="gc-signature" ref={signatureRef}>{displaySender}</p>
          </div>
        </div>

        {/* Right Page */}
        <div className="gc-page gc-page-right">
          <div className="gc-page-content gc-poem-content">
            <p className="gc-poem" ref={poemRef}>{formatPoemToFit(poemText)}</p>
            <h3 className="gc-warm-wishes">With Warmest Wishes</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
