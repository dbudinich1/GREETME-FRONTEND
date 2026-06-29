// src/components/hub/HubBalanceCard.jsx
// UX-HUB-3 Batch 4 — premium Hearts balance hero (Row 1, left). Presentational only:
// receives the server balance + the modal opener + a "view history" scroll callback as props;
// owns no state. Hearts are shown as Hearts ONLY — never a dollar-equivalent value. Includes
// the Buy Hero Hearts CTA, a View Heart History CTA (in-page scroll, no route), and the LOCKED
// Hero Hearts impact statement.

export default function HubBalanceCard({ balance, setShowHeroHeartsModal, onViewHistory }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      borderRadius: 'var(--radius-lg)',
      padding: '2rem 1.5rem',
      marginBottom: '2rem',
      color: 'white',
      boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)',
      display: 'flex',
      flexDirection: 'column',
      gap: '1.5rem'
    }}>
      <div>
        <p style={{
          fontSize: '0.875rem',
          opacity: 0.9,
          marginBottom: '0.5rem'
        }}>Your Hearts Balance</p>
        <div style={{
          fontSize: '3.5rem',
          fontWeight: 800,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          lineHeight: 1
        }}>
          {balance} <span style={{ fontSize: '2.5rem' }}>❤️</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
        <button
          onClick={() => setShowHeroHeartsModal(true)}
          style={{
            flex: '1 1 auto',
            background: 'white',
            color: '#be185d',
            border: 'none',
            borderRadius: 'var(--radius-lg)',
            padding: '0.75rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
            fontFamily: 'inherit'
          }}
        >
          ❤️ Buy Hero Hearts
        </button>
        <button
          onClick={onViewHistory}
          style={{
            flex: '1 1 auto',
            background: 'rgba(255, 255, 255, 0.15)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.6)',
            borderRadius: 'var(--radius-lg)',
            padding: '0.75rem 1.25rem',
            fontSize: '0.875rem',
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          View Heart History
        </button>
      </div>

      <p style={{
        fontSize: '0.8125rem',
        lineHeight: 1.5,
        opacity: 0.95,
        margin: 0
      }}>
        25% of proceeds from Hero Hearts™ support U.S. Veterans and their families.
      </p>
    </div>
  );
}
