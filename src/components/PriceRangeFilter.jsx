// src/components/PriceRangeFilter.jsx
//
// GIFTS — the compact price-range control for the unified marketplace on /dashboard/gifts.
//
// SCOPE: presentation and local interaction only. No fetch, no query params, no storage. The page
// owns the committed range and does the filtering; this component only reports the numbers the
// shopper picked. It never sees, changes, rounds or stores a price — the values passed in are the
// server's own cents, and they go back out unchanged.
//
// WHY THIS IS NOT GiftMarketFilters.jsx
// -------------------------------------
// The dual-handle range presentation below is taken from that dormant component, which is the
// right thing to reuse. What is NOT reused is everything that made it part of the retired Shopify
// / Maker Gifts surface: its catalog search box, its "showing N of M gifts" count over a Shopify
// result set, and its coupling to that page's data flow. Importing the file itself would also
// reintroduce the identifier `GiftMarketFilters` into Merch.jsx, which the marketplace's own
// Shopify lock asserts is absent — so the presentation is reused, and the lock stays intact.
//
// STYLING: this repo has no Tailwind; it styles with CSS custom properties and inline style
// objects. A dual-handle range needs ::-webkit-slider-thumb and friends, which cannot be expressed
// inline, so it carries a scoped <style> block with gm-prf- prefixed class names. Nothing global
// is touched.

import { useState } from 'react';

const centsToDollars = (c) => `$${(c / 100).toFixed(c % 100 === 0 ? 0 : 2)}`;

// Founder 2026-10-24 (walkthrough §5, then "replace the price slide with min / max fields" on desktop too): blank
// Min $ / Max $ fields instead of the slider, at every width. Blank means no limit on that side; both blank is the full
// range. A typed amount is dollars (cents allowed); it is sent on as cents. "Any price" clears both.
const NO_MAX_CENTS = Number.MAX_SAFE_INTEGER; // the filter treats a non-finite bound as "no filter at all"
const dollarsToCents = (text) => {
  const t = String(text).trim();
  if (t === '') return null;
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return NaN;
  return Math.round(Number(t) * 100);
};

function PriceFields({ onChange, onReset, isNarrow, trailing }) {
  const [minText, setMinText] = useState('');
  const [maxText, setMaxText] = useState('');
  const lo = dollarsToCents(minText);
  const hi = dollarsToCents(maxText);
  const invalid = Number.isNaN(lo) || Number.isNaN(hi);
  const crossed = !invalid && lo !== null && hi !== null && lo > hi;
  const apply = (minT, maxT) => {
    const a = dollarsToCents(minT);
    const b = dollarsToCents(maxT);
    if (Number.isNaN(a) || Number.isNaN(b) || (a !== null && b !== null && a > b)) return; // shown below; nothing applied
    if (a === null && b === null) onReset();
    else onChange(a === null ? 0 : a, b === null ? NO_MAX_CENTS : b);
  };
  const clear = () => { setMinText(''); setMaxText(''); onReset(); };
  const field = (id, label, value, set, other, isMin) => (
    <label htmlFor={id} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', flex: isNarrow ? '1 1 0' : '0 1 11rem', minWidth: 0 }}>
      <span style={{ flex: 'none', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.02em' }}>{label}</span>
      <input id={id} data-testid={id} type="text" inputMode="decimal" autoComplete="off" placeholder="Any" value={value}
        aria-label={isMin ? 'Minimum price in dollars' : 'Maximum price in dollars'}
        onChange={(e) => { set(e.target.value); if (isMin) apply(e.target.value, other); else apply(other, e.target.value); }}
        style={{ flex: 1, minWidth: 0, height: '2.25rem', padding: '0 0.625rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', fontSize: '0.9375rem', fontFamily: 'inherit', background: '#fff' }} />
    </label>
  );
  return (
    <div data-testid="price-range-filter" data-mode="fields" style={{ marginBottom: isNarrow ? '0.5rem' : '0.625rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        {field('gm-price-min-field', 'Min $', minText, setMinText, maxText, true)}
        {field('gm-price-max-field', 'Max $', maxText, setMaxText, minText, false)}
        {(minText !== '' || maxText !== '') ? (
          <button type="button" data-testid="price-range-any" onClick={clear}
            style={{ flexShrink: 0, minHeight: 0, padding: '0.375rem 0.75rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)', background: 'transparent', color: 'var(--primary)', fontSize: '0.8125rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            Any price
          </button>
        ) : null}
        {trailing ? <span data-testid="price-range-trailing" style={{ flexShrink: 0, marginLeft: isNarrow ? 0 : 'auto', fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{trailing}</span> : null}
      </div>
      {invalid || crossed ? (
        <p data-testid="price-range-note" role="alert" style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#b91c1c' }}>
          {invalid ? 'Enter a dollar amount, like 25 or 25.50.' : 'Min $ is more than Max $.'}
        </p>
      ) : null}
    </div>
  );
}

export default function PriceRangeFilter({
  floor,
  ceiling,
  minCents,
  maxCents,
  onChange,
  onReset,
  isNarrow,
  trailing = null,
  fields = false,
}) {
  if (fields) return <PriceFields onChange={onChange} onReset={onReset} isNarrow={isNarrow} trailing={trailing} />;
  // A catalog where everything costs the same gives the shopper nothing to choose between, and a
  // zero-width track would divide by zero below. Render nothing rather than an inert control.
  if (!Number.isFinite(floor) || !Number.isFinite(ceiling) || ceiling <= floor) return null;

  const atFullRange = minCents <= floor && maxCents >= ceiling;
  const span = Math.max(1, ceiling - floor);
  const leftPct = ((minCents - floor) / span) * 100;
  const rightPct = ((maxCents - floor) / span) * 100;
  // One cent would make the handles fight over identical values; a dollar is the smallest step
  // that stays meaningful at these prices.
  const step = 100;

  return (
    <div
      data-testid="price-range-filter"
      style={{
        display: 'flex',
        alignItems: 'center',
        // Wraps internally on a narrow screen instead of pushing the page wider.
        flexWrap: 'wrap',
        gap: isNarrow ? '0.5rem 0.75rem' : '1rem',
        maxWidth: '100%',
        boxSizing: 'border-box',
        // A light single row under the Gift Place header (founder 2026-10-22), not a boxed panel.
        padding: isNarrow ? '0.125rem 0.125rem' : '0.125rem 0.25rem',
        marginBottom: isNarrow ? '0.5rem' : '0.625rem',
      }}
    >
      <style>{`
        .gm-prf-wrap { position: relative; height: 30px; }
        .gm-prf-track, .gm-prf-fill { position: absolute; top: 13px; height: 4px; border-radius: 2px; }
        .gm-prf-track { left: 0; right: 0; background: var(--gray-200, #e5e7eb); }
        .gm-prf-fill  { background: var(--primary); }
        .gm-prf-range {
          position: absolute; left: 0; width: 100%; margin: 0; top: 0; height: 30px;
          -webkit-appearance: none; appearance: none; background: none;
          pointer-events: none; /* only the thumbs are interactive */
        }
        .gm-prf-range:focus { outline: none; }
        .gm-prf-range::-webkit-slider-thumb {
          -webkit-appearance: none; appearance: none; pointer-events: auto;
          width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
          background: var(--primary); border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .gm-prf-range::-moz-range-thumb {
          pointer-events: auto; width: 22px; height: 22px; border-radius: 50%; cursor: pointer;
          background: var(--primary); border: 2px solid #fff;
          box-shadow: 0 1px 4px rgba(0,0,0,0.3);
        }
        .gm-prf-range::-moz-range-track { background: none; }
        .gm-prf-range:focus-visible::-webkit-slider-thumb {
          outline: 2px solid var(--primary-dark); outline-offset: 2px;
        }
      `}</style>

      <label
        htmlFor="gm-price-min"
        style={{
          flexShrink: 0,
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.02em',
          textTransform: 'uppercase',
          color: 'var(--text-secondary)',
          whiteSpace: 'nowrap',
        }}
      >
        Price&nbsp;&nbsp;
        <span style={{ color: 'var(--text-primary)', fontWeight: 700, textTransform: 'none' }}>
          {centsToDollars(minCents)} – {centsToDollars(maxCents)}
        </span>
      </label>

      <div className="gm-prf-wrap" style={{ flex: '1 1 180px', minWidth: '140px' }}>
        <div className="gm-prf-track" />
        <div className="gm-prf-fill" style={{ left: `${leftPct}%`, right: `${100 - rightPct}%` }} />
        <input
          id="gm-price-min"
          className="gm-prf-range"
          type="range"
          min={floor}
          max={ceiling}
          step={step}
          value={minCents}
          aria-label="Minimum price"
          onChange={(e) => onChange(Math.min(Number(e.target.value), maxCents), maxCents)}
        />
        <input
          className="gm-prf-range"
          type="range"
          min={floor}
          max={ceiling}
          step={step}
          value={maxCents}
          aria-label="Maximum price"
          onChange={(e) => onChange(minCents, Math.max(Number(e.target.value), minCents))}
        />
      </div>

      <button
        type="button"
        onClick={onReset}
        disabled={atFullRange}
        style={{
          flexShrink: 0,
          padding: '0.375rem 0.875rem',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--border)',
          background: 'transparent',
          color: atFullRange ? 'var(--text-tertiary)' : 'var(--primary)',
          fontSize: '0.8125rem',
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: atFullRange ? 'default' : 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Any price
      </button>
      {trailing ? <span data-testid="price-range-trailing" style={{ flexShrink: 0, marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-tertiary)', whiteSpace: 'nowrap' }}>{trailing}</span> : null}
    </div>
  );
}
