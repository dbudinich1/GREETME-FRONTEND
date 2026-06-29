// src/components/hub/HubBalanceCard.jsx
// UX-HUB-3 Batch 2 — Hearts balance card. Behavior-preserving extraction from Rewards.jsx.
// Presentational only: receives the server balance and the modal opener as props; owns no
// state. (Becomes the richer "HubHeroBand" in Batch 4 when lifetime/Buy/History land.)

export default function HubBalanceCard({ balance, setShowHeroHeartsModal }) {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
      borderRadius: 'var(--radius-lg)',
      padding: '2rem 1.5rem',
      marginBottom: '1.5rem',
      color: 'white',
      boxShadow: '0 4px 12px rgba(236, 72, 153, 0.3)'
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
      }}>
        <div>
          <p style={{
            fontSize: '0.875rem',
            opacity: 0.9,
            marginBottom: '0.5rem'
          }}>Your Balance</p>
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
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          gap: '0.75rem'
        }}>
          <button
            onClick={() => setShowHeroHeartsModal(true)}
            style={{
              background: 'white',
              color: '#be185d',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              padding: '0.75rem 1.25rem',
              fontSize: '0.875rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0, 0, 0, 0.15)',
              transition: 'transform 0.2s, box-shadow 0.2s',
              fontFamily: 'inherit'
            }}
            onMouseEnter={(e) => {
              e.target.style.transform = 'scale(1.05)';
              e.target.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.2)';
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'scale(1)';
              e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.15)';
            }}
          >
            ❤️ Greet-Me™ Hero™ Hearts™
          </button>
        </div>
      </div>
    </div>
  );
}
