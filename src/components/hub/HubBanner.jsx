// src/components/hub/HubBanner.jsx
// UX-HUB-3 Batch 2 — Hearts Hub banner header. Behavior-preserving extraction from
// Rewards.jsx (static; no props, no state).

export default function HubBanner() {
  return (
    <div style={{
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      borderRadius: 'var(--radius-lg)',
      padding: '3rem 1.5rem',
      marginBottom: '1.5rem',
      color: 'white',
      textAlign: 'center',
      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
    }}>
      <h1 style={{
        fontSize: '1.75rem',
        fontWeight: 700,
        margin: 0,
        marginBottom: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '0.5rem'
      }}>
        <span style={{ fontSize: '2rem' }}>❤️</span> Hearts Hub
      </h1>
      <p style={{
        fontSize: '1rem',
        opacity: 0.9,
        fontStyle: 'italic',
        margin: 0
      }}>
        Earn Hearts for every Greet-Me™ you send and more.
      </p>
    </div>
  );
}
