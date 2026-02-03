/**
 * fitTextBudget.js
 * Compute a conservative max character budget for a given message style + container size.
 *
 * We measure using an offscreen clone that matches gc-greeting-message styles.
 * We ensure at least one line of breathing room above the signature by subtracting lineHeight.
 */

export async function measureIntroMaxChars({
  messageEl,
  signatureEl,
  pageContentEl,
  sampleText,
  safetyLines = 1,
}) {
  // Ensure fonts are loaded before measurement (prevents "second test regressions")
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch {}
  }

  if (!messageEl || !signatureEl || !pageContentEl) {
    return null;
  }

  const pageRect = pageContentEl.getBoundingClientRect();
  const sigRect = signatureEl.getBoundingClientRect();

  // Available height for message = space from top of message box to top of signature
  // minus 1 line of breathing room
  const computed = window.getComputedStyle(messageEl);
  const lineHeightPx = parseFloat(computed.lineHeight) || 0;

  const availablePxRaw = sigRect.top - pageRect.top;
  const availablePx = Math.max(0, availablePxRaw - (lineHeightPx * safetyLines));

  // Build an offscreen measurer that matches the real message box width + typography
  const measurer = document.createElement('div');
  measurer.style.position = 'fixed';
  measurer.style.left = '-99999px';
  measurer.style.top = '0';
  measurer.style.width = `${messageEl.clientWidth}px`;
  measurer.style.fontFamily = computed.fontFamily;
  measurer.style.fontSize = computed.fontSize;
  measurer.style.fontWeight = computed.fontWeight;
  measurer.style.lineHeight = computed.lineHeight;
  measurer.style.letterSpacing = computed.letterSpacing;
  measurer.style.whiteSpace = 'normal';
  measurer.style.wordBreak = 'normal';
  measurer.style.overflowWrap = 'break-word';

  document.body.appendChild(measurer);

  // Binary search a max character count that fits in availablePx.
  const text = (sampleText || '').trim();
  if (!text) {
    document.body.removeChild(measurer);
    return null;
  }

  let lo = 0;
  let hi = text.length;
  let best = 0;

  while (lo <= hi) {
    const mid = Math.floor((lo + hi) / 2);
    measurer.textContent = text.slice(0, mid);

    const h = measurer.getBoundingClientRect().height;
    if (h <= availablePx) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  document.body.removeChild(measurer);

  // Conservative: shave 5% to account for punctuation/paragraph variance
  const conservative = Math.max(80, Math.floor(best * 0.95));
  return conservative;
}
