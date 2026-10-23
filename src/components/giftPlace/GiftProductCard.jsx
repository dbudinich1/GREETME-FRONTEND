// src/components/giftPlace/GiftProductCard.jsx
//
// THE ONE GIFT CARD, and the one grid it sits in.
//
// Every Gift Place category renders through this file: Brandable Goods, Americana, Tech, Flowers,
// whatever comes next. There is no per-category card and no per-provider grid, because the shopper is
// making ONE comparison and the page must not change shape underneath them when they switch.
//
// FIXED, IN THIS ORDER, ALWAYS:
//   1. image            — one aspect ratio, whatever the source sent
//   2. name
//   3. short description — the slot is reserved even when empty, so heights cannot diverge
//   4. price
//   5. action           — same corner, same size, same weight
//
// The ACTION LABEL is the only thing context changes ("Select Gift" when shopping for a greeting,
// "Add to Cart" in the store). Its position and size do not move, which is the founder's rule.
//
// This component takes a PROJECTED card (see src/pages/giftPlaceViewModel.js) and never a raw
// provider payload — that is what stops a vendor's field names reaching the layout.

import { Check, ShoppingCart, Gift } from 'lucide-react';
import { AVAILABILITY_FAILED_LEAD, AVAILABILITY_RETRY_LABEL } from '../../pages/giftPlaceViewModel';

/** One fixed image ratio for every source, so a grid row cannot go ragged. */
const IMAGE_HEIGHT = { narrow: 150, wide: 240 };

// THE WHOLE PRODUCT, NEVER A CROP OF IT.
//
// This was `center/cover`, which scales the photo until the box is covered and throws the overflow
// away. Merch mockups are near-square so they survived it; a flower arrangement does not. The
// provider ships its own size as free text — '14"w x 20"h' is the convention — so arrangements are
// TALLER THAN WIDE, and a portrait photo scaled to cover a landscape box loses roughly half its
// height: the top of the blooms and the base of the vase both go.
//
// `contain` fits the entire image inside the box and crops nothing. The box itself is unchanged in
// kind — every card in every category still gets ONE identical frame, so no grid row can go ragged —
// and the letterboxing that a portrait photo leaves beside itself is filled with the neutral surface
// colour rather than a stretched copy of the product. Nothing is distorted: `contain` preserves the
// source aspect ratio by definition.
//
// Written as LONGHAND on purpose. jsdom does not expose the `background` shorthand's parts, so the
// previous shorthand could only be asserted by reading this file; these four properties are readable
// from the mounted DOM, which is why the proofs for this behaviour can be real assertions.
const IMAGE_FIT = {
  backgroundSize: 'contain',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  backgroundColor: 'var(--bg-secondary, #f8fafc)',
};

export function GiftProductCard({ card, actionLabel, onAction, selected = false, isNarrow = false, disabled: disabledProp = false, onRetryAvailability = null, variant = 'standard', chip = '', priceNote = '' }) {
  if (!card) return null;
  if (variant === 'gallery') return <GalleryCard card={card} actionLabel={actionLabel} onAction={onAction} selected={selected} isNarrow={isNarrow} disabled={disabledProp || Boolean(card.unavailableNote)} onRetryAvailability={onRetryAvailability} chip={chip} priceNote={priceNote} />;
  // A card that cannot be chosen here (e.g. a gift box whose provider requires options) says why and cannot be acted on.
  const disabled = disabledProp || Boolean(card.unavailableNote);
  const isSelect = actionLabel === 'Select Gift';

  return (
    <div
      data-testid={`gift-card-${card.id}`}
      data-gift-source={card.source}
      style={{
        background: 'var(--bg-primary)',
        border: selected ? '2px solid var(--primary, #4F2D7F)' : '1px solid var(--border)',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        transition: 'all 0.2s ease',
        position: 'relative',
        // One column layout for every card, so the action row lands at the same place in each.
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 1. IMAGE — identical box for every source. A card with no image gets the same box with a
             placeholder inside it, never a shorter card. */}
      <div
        data-testid={`gift-card-image-${card.id}`}
        style={{
          width: '100%',
          height: isNarrow ? IMAGE_HEIGHT.narrow : IMAGE_HEIGHT.wide,
          flexShrink: 0,
          // A little room so a tall arrangement does not touch the frame edge. Uniform for every
          // category, so the frames stay identically sized.
          padding: isNarrow ? '0.375rem' : '0.5rem',
          boxSizing: 'border-box',
          ...(card.imageUrl
            ? { backgroundImage: `url(${card.imageUrl})`, ...IMAGE_FIT }
            : { background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' }),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: isNarrow ? '2.5rem' : '4rem',
        }}
      >
        {!card.imageUrl && '🎁'}
      </div>

      <div style={{
        padding: isNarrow ? '0.75rem' : '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        minHeight: 0,
      }}>
        {/* 2. NAME */}
        <h3 style={{
          fontSize: isNarrow ? '0.875rem' : '1.0625rem',
          fontWeight: 600,
          color: 'var(--text-primary)',
          margin: '0 0 0.25rem',
          lineHeight: 1.3,
        }}>
          {card.name}
        </h3>

        {/* 3. SHORT DESCRIPTION — the slot is ALWAYS rendered. An absent description leaves an empty
               line rather than collapsing the card, because a grid whose cards are different heights
               is the thing this component exists to prevent. */}
        <p
          data-testid={`gift-card-desc-${card.id}`}
          style={{
            fontSize: '0.75rem',
            color: 'var(--text-tertiary, #9ca3af)',
            lineHeight: 1.4,
            margin: '0 0 0.75rem',
            minHeight: '2.1em',
            // Two lines at most, so one verbose supplier cannot make its row taller than the others.
            display: '-webkit-box',
            // A "can't be chosen" note may take a third line on a narrow card, so its retry ("Try again.") is never
            // clipped; an ordinary description stays at two.
            WebkitLineClamp: card.unavailableNote ? 3 : 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {card.availability === 'failed' && onRetryAvailability
            // "Availability unavailable. Try again." — the "Try again." is the retry control itself, so the note reads
            // exactly as approved and stays in the same slot (no reflow).
            ? <span data-testid="gift-card-unavailable" style={{ color: '#b45309', fontWeight: 600 }}>{AVAILABILITY_FAILED_LEAD}{' '}
                <button type="button" data-testid={`gift-card-availability-retry-${card.id}`} onClick={(e) => { e.stopPropagation(); onRetryAvailability(); }}
                  style={{ padding: 0, margin: 0, border: 'none', background: 'none', color: 'var(--primary)', font: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>{AVAILABILITY_RETRY_LABEL}</button></span>
            : card.unavailableNote ? <span data-testid="gift-card-unavailable" style={{ color: '#b45309', fontWeight: 600 }}>{card.unavailableNote}</span> : (card.description || ' ')}
        </p>

        {/* 4 + 5. PRICE AND ACTION — pinned to the bottom by marginTop:auto, so they sit at the same
                  height on every card in the row no matter how long the name above them was. */}
        <div style={{
          marginTop: 'auto',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: isNarrow ? '0.5rem' : '0.75rem',
          borderTop: isNarrow ? 'none' : '1px solid var(--border)',
          gap: '0.5rem',
        }}>
          <span
            data-testid={`gift-card-price-${card.id}`}
            style={{
              fontSize: isNarrow ? '1rem' : '1.25rem',
              fontWeight: 700,
              color: 'var(--primary)',
              whiteSpace: 'nowrap',
            }}
          >
            {card.priceLabel}
          </span>
          <button
            type="button"
            data-testid={`gift-card-action-${card.id}`}
            disabled={disabled}
            onClick={(e) => { e.stopPropagation(); if (!disabled) onAction(card); }}
            style={{
              padding: isNarrow ? '0.375rem 0.75rem' : '0.5rem 1.1rem',
              background: selected ? '#22c55e' : 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.55 : 1,
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: isNarrow ? '0.75rem' : '0.875rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              whiteSpace: 'nowrap',
            }}
          >
            {selected
              ? <><Check size={isNarrow ? 14 : 16} />{isNarrow ? '✓' : 'Selected'}</>
              : <>
                  {isSelect ? <Gift size={isNarrow ? 14 : 16} /> : <ShoppingCart size={isNarrow ? 14 : 16} />}
                  {isNarrow ? (isSelect ? 'Select' : 'Add') : actionLabel}
                </>}
          </button>
        </div>
      </div>
    </div>
  );
}

// The Gift Place's gallery card (founder 2026-10-22, Base44 reference): image with its category label, name and price
// on one line, a two-line description, and one full-width action. Same test hooks and the same behaviour as the
// standard card (which the scheduled-gift picker keeps); only the arrangement differs.
const GALLERY_IMAGE_HEIGHT = { narrow: 128, wide: 148 };
function GalleryCard({ card, actionLabel, onAction, selected, isNarrow, disabled, onRetryAvailability, chip, priceNote }) {
  const isSelect = actionLabel === 'Select Gift';
  return (
    <div data-testid={`gift-card-${card.id}`} data-gift-source={card.source} style={{
      background: '#fff', border: selected ? '2px solid #2C1D46' : '1px solid #e7e0f0', borderRadius: '0.875rem', overflow: 'hidden',
      position: 'relative', display: 'flex', flexDirection: 'column', boxShadow: '0 10px 24px -22px rgba(44,29,70,.55)',
    }}>
      <div data-testid={`gift-card-image-${card.id}`} style={{
        position: 'relative', width: '100%', height: isNarrow ? GALLERY_IMAGE_HEIGHT.narrow : GALLERY_IMAGE_HEIGHT.wide, flexShrink: 0,
        padding: '0.375rem', boxSizing: 'border-box',
        ...(card.imageUrl ? { backgroundImage: `url(${card.imageUrl})`, ...IMAGE_FIT } : { background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)' }),
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: isNarrow ? '2.25rem' : '3rem',
      }}>
        {!card.imageUrl && '🎁'}
        {chip ? (
          <span data-testid={`gift-card-chip-${card.id}`} style={{ position: 'absolute', top: '0.5rem', left: '0.5rem', maxWidth: 'calc(100% - 1rem)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            background: 'rgba(255,255,255,.94)', color: '#2C1D46', fontSize: '0.625rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            padding: '0.1875rem 0.5rem', borderRadius: '9999px', boxShadow: '0 1px 2px rgba(44,29,70,.12)' }}>{chip}</span>
        ) : null}
      </div>
      <div style={{ padding: isNarrow ? '0.625rem' : '0.75rem 0.875rem 0.875rem', display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: '0.5rem' }}>
          <h3 style={{ margin: 0, minWidth: 0, fontFamily: '"Playfair Display", Georgia, serif', fontSize: isNarrow ? '0.875rem' : '1rem', fontWeight: 700, color: '#2C1D46', lineHeight: 1.25 }}>{card.name}</h3>
          <span data-testid={`gift-card-price-${card.id}`} style={{ flex: 'none', fontFamily: '"Playfair Display", Georgia, serif', fontSize: isNarrow ? '0.875rem' : '1rem', fontWeight: 700, color: '#b4232f', whiteSpace: 'nowrap' }}>{card.priceLabel}{priceNote ? <span data-testid={`gift-card-price-note-${card.id}`} style={{ fontFamily: 'Inter, -apple-system, "Segoe UI", Roboto, sans-serif', fontSize: '0.6875rem', fontWeight: 600, color: '#6B6079', marginLeft: '0.25rem' }}>{priceNote}</span> : null}</span>
        </div>
        <p data-testid={`gift-card-desc-${card.id}`} style={{
          fontSize: '0.75rem', color: '#6B6079', lineHeight: 1.4, margin: '0.25rem 0 0.625rem', minHeight: '2.1em',
          display: '-webkit-box', WebkitLineClamp: card.unavailableNote ? 3 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>
          {card.availability === 'failed' && onRetryAvailability
            ? <span data-testid="gift-card-unavailable" style={{ color: '#b45309', fontWeight: 600 }}>{AVAILABILITY_FAILED_LEAD}{' '}
                <button type="button" data-testid={`gift-card-availability-retry-${card.id}`} onClick={(e) => { e.stopPropagation(); onRetryAvailability(); }}
                  style={{ padding: 0, margin: 0, border: 'none', background: 'none', color: 'var(--primary)', font: 'inherit', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', minHeight: 0 }}>{AVAILABILITY_RETRY_LABEL}</button></span>
            : card.unavailableNote ? <span data-testid="gift-card-unavailable" style={{ color: '#b45309', fontWeight: 600 }}>{card.unavailableNote}</span> : (card.description || '\u00a0')}
        </p>
        <button type="button" data-testid={`gift-card-action-${card.id}`} disabled={disabled}
          onClick={(e) => { e.stopPropagation(); if (!disabled) onAction(card); }}
          style={{
            marginTop: 'auto', width: '100%', height: isNarrow ? '2.25rem' : '2.375rem', minHeight: 0, padding: '0 0.75rem', borderRadius: '9999px', border: 'none',
            background: selected ? '#2C6A4B' : '#2C1D46', color: '#fff', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
            fontFamily: 'inherit', fontWeight: 600, fontSize: isNarrow ? '0.75rem' : '0.8125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', whiteSpace: 'nowrap',
          }}>
          {selected
            ? <><Check size={14} />{isNarrow ? '✓' : 'Selected'}</>
            : <>{isSelect ? <Gift size={14} /> : <ShoppingCart size={14} />}{isNarrow ? (isSelect ? 'Select' : 'Add') : actionLabel}</>}
        </button>
      </div>
    </div>
  );
}

/**
 * THE ONE GRID, with the one set of states.
 *
 * loading / failed / empty are distinct and each says only what is true. "We could not look" and
 * "there is nothing here" are different sentences, and conflating them tells a shopper a collection
 * does not exist when it does — which is exactly what a bare empty array from a failed request does.
 */
export function GiftProductGrid({
  cards, state, actionLabel, onAction, onRetry,
  selectedId = null, isNarrow = false, emptyLabel = 'This collection', onRetryAvailability = null,
  variant = 'standard', chipFor = null, priceNoteFor = null,
}) {
  if (state === 'loading') {
    // Skeletons in the real grid, at the real card size, so the layout does not jump when they
    // resolve into products.
    return (
      <div data-testid="gift-grid-loading" style={gridStyle(isNarrow)}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-xl)',
            overflow: 'hidden',
          }}>
            <div style={{
              width: '100%',
              height: isNarrow ? IMAGE_HEIGHT.narrow : IMAGE_HEIGHT.wide,
              background: 'var(--bg-secondary, #f1f5f9)',
            }} />
            <div style={{ padding: isNarrow ? '0.75rem' : '1.25rem' }}>
              <div style={{ height: '1rem', width: '70%', background: 'var(--bg-secondary, #f1f5f9)', borderRadius: 4, marginBottom: '0.5rem' }} />
              <div style={{ height: '0.75rem', width: '90%', background: 'var(--bg-secondary, #f1f5f9)', borderRadius: 4, marginBottom: '0.75rem' }} />
              <div style={{ height: '1.5rem', width: '50%', background: 'var(--bg-secondary, #f1f5f9)', borderRadius: 4 }} />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (state === 'failed') {
    return (
      <div data-testid="gift-grid-error" role="alert" style={panelStyle}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>😕</div>
        <h3 style={panelTitleStyle}>We could not load this collection just now.</h3>
        <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, margin: '0 0 1rem' }}>
          Nothing is wrong with your order — the list simply did not arrive.
        </p>
        {onRetry && (
          <button type="button" data-testid="gift-grid-retry" onClick={onRetry} style={retryStyle}>
            Try again
          </button>
        )}
      </div>
    );
  }

  if (!cards || cards.length === 0) {
    return (
      <div data-testid="gift-grid-empty" style={panelStyle}>
        <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>✨</div>
        <h3 style={panelTitleStyle}>{emptyLabel} &mdash; Coming Soon</h3>
        <p style={{ fontSize: '0.9375rem', lineHeight: 1.6, margin: 0 }}>
          We&rsquo;re curating this collection. Check back soon.
        </p>
      </div>
    );
  }

  return (
    <div data-testid="gift-grid" style={variant === 'gallery' ? galleryGridStyle(isNarrow) : gridStyle(isNarrow)}>
      {cards.map((card) => (
        <GiftProductCard
          key={`${card.source}:${card.id}`}
          card={card}
          actionLabel={actionLabel}
          onAction={onAction}
          selected={selectedId != null && selectedId === card.id}
          isNarrow={isNarrow}
          onRetryAvailability={onRetryAvailability}
          variant={variant}
          chip={chipFor ? chipFor(card) || '' : ''}
          priceNote={priceNoteFor ? priceNoteFor(card) || '' : ''}
        />
      ))}
    </div>
  );
}

/** The Gift Place's gallery grid (founder 2026-10-22): four across on desktop, two on phones. */
const galleryGridStyle = (isNarrow) => ({
  display: 'grid',
  gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(auto-fill, minmax(220px, 1fr))',
  gap: isNarrow ? '0.625rem' : '1rem',
  maxWidth: '100%',
  overflowX: 'hidden',
  alignItems: 'stretch',
});

/** One grid definition. Every category gets these columns and this gap — including Flowers. */
const gridStyle = (isNarrow) => ({
  display: 'grid',
  gridTemplateColumns: isNarrow ? '1fr 1fr' : 'repeat(auto-fill, minmax(300px, 1fr))',
  gap: isNarrow ? '0.75rem' : '1.5rem',
  maxWidth: '100%',
  overflowX: 'hidden',
  // Cards stretch to the tallest in the row, so the pinned action rows line up.
  alignItems: 'stretch',
});

const panelStyle = {
  padding: '4rem 2rem',
  textAlign: 'center',
  color: 'var(--text-secondary)',
  border: '1px dashed var(--border)',
  borderRadius: 'var(--radius-xl)',
};

const panelTitleStyle = {
  fontSize: '1.125rem',
  fontWeight: 700,
  color: 'var(--text-primary)',
  margin: '0 0 0.5rem',
};

const retryStyle = {
  padding: '0.55rem 1.25rem',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--primary)',
  background: 'transparent',
  color: 'var(--primary)',
  fontSize: '0.875rem',
  fontWeight: 600,
  fontFamily: 'inherit',
  cursor: 'pointer',
};

export default GiftProductCard;
