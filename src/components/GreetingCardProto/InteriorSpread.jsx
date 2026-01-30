/**
 * InteriorSpread.jsx
 * Screen 3: Interior Message Spread
 *
 * CANONICAL LAYOUT LOCKS:
 * - Recipient name: top-left, 1.5in from top (via CSS --gc-letter-top-offset)
 * - Signature: bottom-right, 2.5in from crease (via CSS --gc-letter-crease-offset)
 * - Name capitalization: Title Case (via formatPersonName helper)
 */

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

export default function InteriorSpread({ recipientName, message, senderName, poemText, onClick }) {
  // CANONICAL: Title Case FIRST NAME only via formatPersonName helper
  const displayName = formatPersonName((recipientName || 'Friend').split(' ')[0]);

  // GS-03: Never render empty - always use placeholder if missing
  const rawMessage = message?.trim() || `Happy Birthday!\n\nI've been thinking about you lately and wanted to reach out.\n\nYou matter to me more than you know.\n\nI hope this message finds you well.`;

  // CANONICAL: Signature in Title Case (FIRST NAME only)
  const displaySender = formatPersonName((senderName || '').split(' ')[0]);

  // Split greeting (first line before \n\n) from body
  const [greeting, ...bodyParts] = rawMessage.split('\n\n');

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
            <p className="gc-greeting-occasion">{greeting}</p>
            <div className="gc-greeting-message">
              {bodyMessage
                .replace(/\r\n/g, '\n')           // Normalize Windows line endings
                .replace(/\n{2,}/g, '\n')         // Collapse multiple newlines to single
                .split('\n')                       // Split on every newline
                .map(line => line.trim())          // Trim whitespace
                .filter(line => line.length > 0)   // Remove empty lines
                .map((line, i) => (
                  <p key={i}>{line}</p>
                ))
              }
            </div>
            <p className="gc-signature">{displaySender}</p>
          </div>
        </div>

        {/* Right Page */}
        <div className="gc-page gc-page-right">
          <div className="gc-page-content gc-poem-content">
            {(() => {
              const formattedPoem = formatPoemToFit(poemText);
              const lineCount = formattedPoem.split('\n').length;
              return (
                <p className="gc-poem" style={{ fontSize: getPoemFontSize(lineCount) }}>
                  {formattedPoem}
                </p>
              );
            })()}
            <h3 className="gc-warm-wishes">With Warmest Wishes</h3>
          </div>
        </div>
      </div>
    </div>
  );
}
