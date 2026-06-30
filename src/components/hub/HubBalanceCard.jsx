// src/components/hub/HubBalanceCard.jsx
// UX-HUB-3 Batch 7 → UX-HUB-4A — full-width Premium Hearts Hero (Row 1). Presentational only:
// server balance + modal opener + view-history scroll. Concept-faithful 3-zone composition:
// balance lockup + CTAs (left) · heart energy zone (center) · gold 25% impact (right).
// UX-HUB-4A is VISUAL ONLY — premium dark brand gradient, layered lighting, heart glow, gradient
// numeral, gold impact coin, glass chip. Behavior, routes, copy, and data are UNCHANGED.
// Hearts ONLY — never a dollar value. 25% line is the locked copy.

export default function HubBalanceCard({ balance, setShowHeroHeartsModal, onViewHistory }) {
  return (
    <div className="hub-card hub-hero hub-hero-row" style={{
      // Premium dark brand gradient with layered lighting (magenta bloom + top-left highlight).
      background:
        'radial-gradient(55% 75% at 80% 35%, rgba(236, 72, 153, 0.45) 0%, rgba(236, 72, 153, 0) 62%), ' +
        'radial-gradient(45% 60% at 10% 8%, rgba(255, 255, 255, 0.16) 0%, rgba(255, 255, 255, 0) 55%), ' +
        'linear-gradient(135deg, #2b0a22 0%, #6d1038 50%, #ab1a52 100%)',
      borderRadius: 'var(--radius-xl)',
      padding: '2.5rem',
      marginBottom: '2rem',
      color: 'white'
    }}>
      {/* LEFT — balance lockup + CTAs */}
      <div style={{ minWidth: 0, position: 'relative', zIndex: 1 }}>
        <p style={{
          fontSize: '0.8125rem',
          fontWeight: 600,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          opacity: 0.85,
          margin: '0 0 0.625rem'
        }}>
          Your Hearts Balance
        </p>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.625rem',
          lineHeight: 1,
          marginBottom: '1.75rem'
        }}>
          <span className="hub-hero__balance" style={{
            fontSize: 'clamp(3.5rem, 6vw, 4.75rem)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            fontVariantNumeric: 'tabular-nums'
          }}>
            {balance}
          </span>
          <span style={{ fontSize: '2.5rem', filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.3))' }}>❤️</span>
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
              padding: '0.875rem 1.375rem',
              fontSize: '0.9375rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.18)',
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
              background: 'rgba(255, 255, 255, 0.14)',
              color: 'white',
              border: '1px solid rgba(255, 255, 255, 0.55)',
              borderRadius: 'var(--radius-lg)',
              padding: '0.875rem 1.375rem',
              fontSize: '0.9375rem',
              fontWeight: 700,
              cursor: 'pointer',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              fontFamily: 'inherit'
            }}
          >
            View Heart History
          </button>
        </div>
      </div>

      {/* CENTER — heart energy zone (CSS glow + bloom; placeholder for the 3-D heart in UX-HUB-4B) */}
      <div className="hub-hero-art hub-hero__art" aria-hidden="true" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <span className="hub-hero__heart" style={{ fontSize: '6rem', lineHeight: 1 }}>❤️</span>
      </div>

      {/* RIGHT — gold 25% impact, glass chip (locked copy) */}
      <div className="hub-hero__impact" style={{
        position: 'relative',
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        padding: '1.125rem 1.25rem',
        minWidth: 0
      }}>
        <p style={{
          fontSize: '0.75rem',
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          opacity: 0.9,
          margin: 0
        }}>
          Making an Impact
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.875rem' }}>
          <span className="hub-hero__badge" style={{
            flexShrink: 0,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '3.75rem',
            height: '3.75rem',
            borderRadius: '50%',
            fontSize: '1.0625rem',
            fontWeight: 800
          }}>
            25%
          </span>
          <p style={{ fontSize: '0.8125rem', lineHeight: 1.5, opacity: 0.97, margin: 0 }}>
            25% of proceeds from Hero Hearts™ support U.S. Veterans and their families. <span aria-hidden="true">🇺🇸</span>
          </p>
        </div>
      </div>
    </div>
  );
}
