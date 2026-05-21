// src/components/AttachmentIndicator.jsx
//
// Phase 3D Batch A — A3
//
// Persistent attached-items indicator rendered inside the SendGreeting form.
// Purely presentational. No api calls, no cart mutations, no draft service,
// no orchestration. Renders nothing when no attachment exists.
//
// Founder-locked behavior:
//   - non-sticky (inline static placement)
//   - compact + emotionally secondary
//   - no totals / no pricing dominance
//   - "Including..." copy framing — never commerce language
//   - all states share the same elegant soft-card visual treatment
//     (no dashed borders, no warning chrome)

import { Heart, Gift, ShoppingBag } from 'lucide-react';

function formatDollarsFromCents(cents) {
  const n = typeof cents === 'number' && cents > 0 ? cents : 0;
  return `$${(n / 100).toFixed(n % 100 === 0 ? 0 : 2)}`;
}

// Shared visual contract — single row, soft palette per gift type.
// Returns { background, border, iconColor, textColor, secondaryColor }.
function paletteFor(state) {
  switch (state) {
    case 'qrcash':
      return {
        background: '#fefce8',
        border: '#fde68a',
        iconColor: '#a16207',
        textColor: '#854d0e',
        secondaryColor: '#a16207',
      };
    case 'curated':
      return {
        background: '#f5f3ff',
        border: '#ddd6fe',
        iconColor: '#6d28d9',
        textColor: '#5b21b6',
        secondaryColor: '#6d28d9',
      };
    case 'marketplace-with-items':
      return {
        background: '#f0fdf4',
        border: '#d1fae5',
        iconColor: '#047857',
        textColor: '#065f46',
        secondaryColor: '#047857',
      };
    case 'marketplace-empty':
      // Founder refinement — no dashed border, no warning chrome.
      // Same soft elegant card treatment as the other states, in a neutral key.
      return {
        background: '#f9fafb',
        border: '#e5e7eb',
        iconColor: '#6b7280',
        textColor: '#374151',
        secondaryColor: '#6b7280',
      };
    default:
      return null;
  }
}

export default function AttachmentIndicator({
  giftMode,
  qrCashAmountCents = 0,
  qrCashIsReferral = false,
  curatedMaxSpendCents = 0,
  marketplaceItemCount = 0,
}) {
  // No attachment → render nothing.
  if (!giftMode || giftMode === 'none') return null;

  // Resolve state + copy.
  let state = null;
  let icon = null;
  let primary = '';
  let secondary = null;

  if (giftMode === 'qrcash') {
    state = 'qrcash';
    icon = <Heart size={14} />;
    primary = `Including a QR Cash gift of ${formatDollarsFromCents(qrCashAmountCents)}`;
    if (qrCashIsReferral) {
      secondary = 'Applied as a referral credit';
    }
  } else if (giftMode === 'curated') {
    state = 'curated';
    icon = <Gift size={14} />;
    primary = 'Including a curated gift';
    if (curatedMaxSpendCents > 0) {
      secondary = `Greet-Me will select something up to ${formatDollarsFromCents(curatedMaxSpendCents)}`;
    }
  } else if (giftMode === 'marketplace') {
    icon = <ShoppingBag size={14} />;
    if (marketplaceItemCount > 0) {
      state = 'marketplace-with-items';
      const noun = marketplaceItemCount === 1 ? 'gift' : 'gifts';
      primary = `Including ${marketplaceItemCount} ${noun} from the Greet-Me Gift Place`;
    } else {
      state = 'marketplace-empty';
      primary = 'Greet-Me Gift Place selected — no items yet';
      secondary = 'Browse below to add a gift, or change the gift type';
    }
  } else {
    // Unknown gift type — defensive null render.
    return null;
  }

  const palette = paletteFor(state);
  if (!palette) return null;

  return (
    <div
      role="status"
      aria-label={primary}
      style={{
        margin: '0.75rem 0 1rem',
        padding: '0.625rem 0.875rem',
        background: palette.background,
        border: `1px solid ${palette.border}`,
        borderRadius: '0.5rem',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.625rem',
        fontFamily: 'inherit',
      }}
    >
      <span
        style={{
          color: palette.iconColor,
          display: 'flex',
          alignItems: 'center',
          flexShrink: 0,
          marginTop: '0.125rem',
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            margin: 0,
            fontSize: '0.8125rem',
            fontWeight: 500,
            color: palette.textColor,
            lineHeight: 1.4,
          }}
        >
          {primary}
        </p>
        {secondary && (
          <p
            style={{
              margin: '0.1875rem 0 0',
              fontSize: '0.75rem',
              fontWeight: 400,
              color: palette.secondaryColor,
              lineHeight: 1.4,
            }}
          >
            {secondary}
          </p>
        )}
      </div>
    </div>
  );
}
