// src/components/hub/HubBalanceCard.jsx
// UX-HUB-3 Batch 7 — full-width Premium Hearts Hero (Row 1; Hero Hearts has moved to the Row 4
// engagement band). Presentational only: server balance + modal opener + view-history scroll.
// Concept-faithful 3-zone internal composition: balance lockup + CTAs (left) · reserved heart
// art zone (center; the 3-D heart lands in UX-HUB-4) · 25% impact badge + flag (right).
// Hearts ONLY — never a dollar-equivalent value. 25% copy is the locked line.

export default function HubBalanceCard({ balance, setShowHeroHeartsModal, onViewHistory }) {
  return (
    <div className="hub-card hub-hero hub-hero-row" style={{
      background: 'radial-gradient(120% 120% at 0% 0%, #f472b6 0%, #ec4899 45%, #be185d 100%)',
      borderRadius: 'var(--radius-xl)',
      padding: '2.25rem',
      marginBottom: '2rem',
      color: 'white'
    }}>
      {/* LEFT — balance lockup + CTAs */}
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: '0.875rem', opacity: 0.9, marginBottom: '0.5rem', letterSpacing: '0.02em' }}>
          Your Hearts Balance
        </p>
        <div style={{
          fontSize: '4rem',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          lineHeight: 1,
          letterSpacing: '-0.02em',
          fontVariantNumeric: 'tabular-nums',
          marginBottom: '1.5rem'
        }}>
          {balance} <span style={{ fontSize: '2.5rem' }}>❤️</span>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
          <button
            className="hub-btn"
            onClick={() => setShowHeroHeartsModal(true)}
            style={{
              flex: '1 1 auto',
              background: 'white',
              color: '#be185d',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              padding: '0.8125rem 1.25rem',
              fontSize: '0.9375rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              fontFamily: 'inherit'
            }}
          >
            ❤️ Buy Hero Hearts
          </button>
          <button
            className="hub-btn"
            onClick={onViewHistory}
            style={{
              flex: '1 1 auto',
              background: 'rgba(255, 255, 255, 0.15)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.6)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.8125rem 1.25rem',
              fontSize: '0.9375rem',
              fontWeight: 700,
              cursor: 'pointer',
              fontFamily: 'inherit'
            }}
          >
            View Heart History
          </button>
        </div>
      </div>

      {/* CENTER — reserved heart art zone (placeholder now; 3-D heart art = UX-HUB-4) */}
      <div className="hub-hero-art" aria-hidden="true" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span style={{ fontSize: '5.5rem', lineHeight: 1, opacity: 0.85, filter: 'drop-shadow(0 6px 18px rgba(0,0,0,0.25))' }}>
          ❤️
        </span>
      </div>

      {/* RIGHT — 25% impact badge + flag (locked copy) */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.625rem',
        minWidth: 0
      }}>
        <p style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          opacity: 0.9,
          margin: 0
        }}>
          Making an Impact
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <span style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '3.5rem',
            height: '3.5rem',
            borderRadius: '50%',
            border: '2px solid rgba(255, 255, 255, 0.7)',
            fontSize: '1.0625rem',
            fontWeight: 800
          }}>
            25%
          </span>
          <p style={{ fontSize: '0.8125rem', lineHeight: 1.5, opacity: 0.95, margin: 0 }}>
            25% of proceeds from Hero Hearts™ support U.S. Veterans and their families. <span aria-hidden="true">🇺🇸</span>
          </p>
        </div>
      </div>
    </div>
  );
}
