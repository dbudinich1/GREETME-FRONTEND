// src/components/GiftMarketFilters.jsx
//
// I-GIFT-1 — client-side filter controls for the Maker Gifts grid on /dashboard/gifts.
//
// SCOPE: presentation + local input state only. No fetch, no query params, no storage — the
// parent owns the committed filter values and does the filtering. GET /api/gifts/catalog is
// consumed exactly as-is.
//
// STYLING NOTE: this repo has no Tailwind (no config, no directives, not in package.json); it
// styles with CSS custom properties and inline style objects. These controls follow that idiom.
// The one exception is the dual-handle range, which needs ::-webkit-slider-thumb and friends —
// pseudo-elements cannot be expressed inline — so it carries a scoped <style> block with
// gm-gmf- prefixed class names. Nothing global is touched.
import { useEffect, useState } from 'react';

const centsToDollars = (c) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;

export default function GiftMarketFilters({
  searchCommitted,
  onSearchCommit,
  priceFloor,
  priceCeiling,
  priceStep,
  priceMin,
  priceMax,
  onPriceChange,
  shownCount,
  totalCount,
  onReset,
  isNarrow,
}) {
  // Raw keystrokes live here; the parent only ever sees the debounced value.
  const [searchInput, setSearchInput] = useState(searchCommitted);

  // Debounce ~200ms. setState happens inside the timeout callback, never synchronously in the
  // effect body, so this does not trip react-hooks/set-state-in-effect.
  useEffect(() => {
    const t = setTimeout(() => onSearchCommit(searchInput), 200);
    return () => clearTimeout(t);
  }, [searchInput, onSearchCommit]);

  // No effect syncs this box on reset: the parent remounts this component via `key`, so searchInput
  // initialises from the committed value exactly once and never needs re-syncing.

  const atDefaults = searchCommitted === '' && priceMin === priceFloor && priceMax === priceCeiling;
  const span = Math.max(1, priceCeiling - priceFloor);
  const leftPct = ((priceMin - priceFloor) / span) * 100;
  const rightPct = ((priceMax - priceFloor) / span) * 100;

  const controlStyle = {
    width: '100%', padding: '0.625rem 0.75rem', border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)', fontSize: '0.875rem', fontFamily: 'inherit',
    background: 'var(--bg-primary)', color: 'var(--text-primary)', boxSizing: 'border-box',
  };
  const labelStyle = {
    display: 'block', fontSize: '0.75rem', fontWeight: 600, letterSpacing: '0.02em',
    color: 'var(--text-secondary)', marginBottom: '0.375rem', textTransform: 'uppercase',
  };

  return (
    <div style={{
      background: 'var(--bg-primary)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius-lg)', padding: isNarrow ? '0.875rem' : '1.25rem',
      marginBottom: '1rem',
      display: 'grid',
      // Stacks below 640px so both controls stay full-width and tappable at 380px.
      gridTemplateColumns: isNarrow ? '1fr' : 'minmax(180px, 1fr) minmax(220px, 1.2fr)',
      gap: isNarrow ? '0.875rem' : '1.25rem',
      alignItems: 'start',
    }}>
      <style>{`
        .gm-gmf-range-wrap { position: relative; height: 34px; }
        .gm-gmf-track, .gm-gmf-fill {
          position: absolute; top: 15px; height: 4px; border-radius: 2px;
        }
        .gm-gmf-track { left: 0; right: 0; background: var(--gray-200, #e5e7eb); }
        .gm-gmf-fill  { background: var(--primary); }
        .gm-gmf-range {
          position: absolute; left: 0; width: 100%; margin: 0; top: 0; height: 34px;
          -webkit-appearance: none; appearance: none; background: none;
          pointer-events: none; /* only the thumbs are interactive */
        }
        .gm-gmf-range:focus { outline: none; }
        .gm-gmf-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; pointer-events: auto;
          width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
          background: var(--primary); border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .gm-gmf-range::-moz-range-thumb {
          pointer-events: auto; width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
          background: var(--primary); border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .gm-gmf-range::-moz-range-track { background: none; }
        .gm-gmf-range:focus-visible::-webkit-slider-thumb { outline: 2px solid var(--primary-dark); outline-offset: 2px; }
      `}</style>

      {/* Search */}
      <div>
        <label style={labelStyle} htmlFor="gm-gift-search">Search gifts</label>
        <input
          id="gm-gift-search"
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="Search by name…"
          style={controlStyle}
        />
      </div>

      {/* Price */}
      <div>
        <label style={labelStyle} htmlFor="gm-gift-price-min">
          Price&nbsp;&nbsp;<span style={{ color: 'var(--text-primary)', fontWeight: 700, textTransform: 'none' }}>
            {centsToDollars(priceMin)} – {centsToDollars(priceMax)}
          </span>
        </label>
        <div className="gm-gmf-range-wrap">
          <div className="gm-gmf-track" />
          <div className="gm-gmf-fill" style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }} />
          <input
            id="gm-gift-price-min"
            className="gm-gmf-range"
            type="range"
            min={priceFloor}
            max={priceCeiling}
            step={priceStep}
            value={priceMin}
            aria-label="Minimum price"
            onChange={(e) => onPriceChange(Math.min(Number(e.target.value), priceMax - priceStep), priceMax)}
          />
          <input
            className="gm-gmf-range"
            type="range"
            min={priceFloor}
            max={priceCeiling}
            step={priceStep}
            value={priceMax}
            aria-label="Maximum price"
            onChange={(e) => onPriceChange(priceMin, Math.max(Number(e.target.value), priceMin + priceStep))}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.6875rem', color: 'var(--text-tertiary)' }}>
          <span>{centsToDollars(priceFloor)}</span>
          <span>{centsToDollars(priceCeiling)}</span>
        </div>
      </div>

      {/* Count + reset — full width under both controls */}
      <div style={{
        gridColumn: isNarrow ? 'auto' : '1 / -1',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: '0.75rem', flexWrap: 'wrap',
        borderTop: '1px solid var(--border)', paddingTop: '0.75rem',
      }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }} aria-live="polite">
          Showing <strong style={{ color: 'var(--text-primary)' }}>{shownCount}</strong> of {totalCount} gift{totalCount === 1 ? '' : 's'}
        </span>
        <button
          type="button"
          onClick={onReset}
          disabled={atDefaults}
          style={{
            padding: '0.375rem 0.875rem', borderRadius: 'var(--radius-md)',
            border: '1px solid var(--border)', background: 'transparent',
            color: atDefaults ? 'var(--text-tertiary)' : 'var(--primary)',
            fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit',
            cursor: atDefaults ? 'default' : 'pointer',
          }}
        >
          Reset filters
        </button>
      </div>
    </div>
  );
}