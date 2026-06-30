// src/components/hub/HubMarketplace.jsx
// UX-HUB-3 Batch 2 — Hearts Marketplace (read-only, DISPLAY-ONLY) section. Behavior-preserving
// extraction from Rewards.jsx. Presentational only: receives catalog items + redeem flow state
// and callbacks as props; owns no state and makes no API calls (the redeem handler lives in the
// page). Renders ONLY when items exist — returns null while dormant/empty (identical to before).

export default function HubMarketplace({
  marketplaceItems,
  mktConfirmId,
  mktRedeemingId,
  mktOutcome,
  handleMarketplaceRedeem,
  setMktConfirmId,
}) {
  return (
    <div className="hub-card" style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.5rem',
      marginBottom: '2rem',
      border: '1px solid var(--border)'
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '1rem' }}>
        Hearts Marketplace
      </h2>
      {marketplaceItems.length === 0 ? (
        // UX-HUB-3 Batch 5 — intentional (not collapsed) empty state: centered, min-height,
        // soft icon + the approved copy. No fake items, no fiat.
        <div style={{
          minHeight: '240px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          gap: '1.125rem',
          padding: '2.5rem 1.5rem',
          background: 'var(--gray-50)',
          border: '1px dashed var(--border)',
          borderRadius: 'var(--radius-lg)'
        }}>
          <span style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '4.5rem',
            height: '4.5rem',
            borderRadius: '50%',
            background: 'rgba(236, 72, 153, 0.10)',
            border: '1px solid rgba(236, 72, 153, 0.18)'
          }} aria-hidden="true">
            <span style={{ fontSize: '2.25rem', lineHeight: 1 }}>🎁</span>
          </span>
          <p style={{
            fontSize: '0.9375rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            margin: 0,
            maxWidth: '24rem'
          }}>
            Your rewards marketplace is growing. New ways to redeem Hearts will appear here.
          </p>
        </div>
      ) : (
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: '1rem'
      }}>
        {marketplaceItems.map((item) => {
          const img = (Array.isArray(item.images) && item.images[0]?.url) ? item.images[0].url : null;
          return (
            <div
              key={item.id}
              data-reward-class={item.class || 'uncategorized'}
              style={{
                background: 'var(--gray-50)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden'
              }}
            >
              <div style={{
                width: '100%',
                height: '140px',
                background: img ? `url(${img}) center/cover no-repeat` : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.5rem'
              }}>
                {!img && '🎁'}
              </div>
              <div style={{ padding: '0.75rem' }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {item.title}
                </div>
                {item.vendor ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '0.125rem' }}>
                    Made by {item.vendor}
                  </div>
                ) : null}
                {/* UX-HUB-3 Batch 4 — fiat display REMOVED. Hearts never carry a dollar value;
                    priceCents is intentionally not rendered. A Hearts cost (if present) may be
                    shown in Hearts only. */}
                {item.state && item.state !== 'available' ? (
                  <div style={{
                    fontSize: '0.6875rem',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    marginTop: '0.375rem'
                  }}>
                    {item.state}
                  </div>
                ) : null}
                {/* Marketplace Stage 6 — redeem CTA. Shows ONLY when the server marks the
                    item structurally `redeemable` (false while marketplaceRedemptionEnabled
                    is off). Two-step confirm; eligibility is enforced server-side. */}
                {item.redeemable ? (
                  <div style={{ marginTop: '0.625rem' }}>
                    {mktConfirmId === item.id ? (
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          className="hub-btn"
                          onClick={() => handleMarketplaceRedeem(item)}
                          disabled={mktRedeemingId === item.id}
                          style={{ flex: 1, background: '#ec4899', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          {mktRedeemingId === item.id ? 'Redeeming…' : 'Confirm'}
                        </button>
                        <button
                          className="hub-btn"
                          onClick={() => setMktConfirmId(null)}
                          disabled={mktRedeemingId === item.id}
                          style={{ background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        className="hub-btn"
                        onClick={() => setMktConfirmId(item.id)}
                        style={{ width: '100%', background: '#ec4899', color: 'white', border: 'none', borderRadius: 'var(--radius-lg)', padding: '0.5rem 0.75rem', fontSize: '0.8125rem', fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}
                      >
                        Redeem with Hearts
                      </button>
                    )}
                    {mktOutcome[item.id] ? (
                      <div style={{ fontSize: '0.75rem', marginTop: '0.375rem', fontWeight: 600, color: mktOutcome[item.id].type === 'success' ? '#16a34a' : 'var(--text-secondary)' }}>
                        {mktOutcome[item.id].message}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
