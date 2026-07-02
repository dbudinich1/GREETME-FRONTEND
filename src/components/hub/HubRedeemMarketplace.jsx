// src/components/hub/HubRedeemMarketplace.jsx
// UX Cleanup (Unified Redemption / Marketplace) — merges the former separate "Redeem Hearts"
// (H7 Free Greeting) and "Hearts Marketplace" surfaces into ONE browsing experience. Every reward
// lives in a single grid with a truthful state badge: AVAILABLE or LOCKED only (no "Coming Soon",
// no fake inventory). Presentational only — no pricing, no reward-availability logic, and no API
// calls live here; all redemption handlers/state are page-owned and passed as props (unchanged).
// The Free Greeting is the always-present, live AVAILABLE reward; server marketplace items (empty
// while the catalog is dormant) render alongside it with their real server state.

import { useState } from 'react';
import { Gift, ChevronDown, X } from 'lucide-react';
import { REDEEM_COST } from './hubConfig';

// Truthful state → AVAILABLE | LOCKED badge (the only two canonical states).
function StateBadge({ available }) {
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.625rem',
      fontWeight: 700,
      letterSpacing: '0.06em',
      textTransform: 'uppercase',
      padding: '0.1875rem 0.5rem',
      borderRadius: '999px',
      color: available ? '#15803d' : 'var(--text-secondary)',
      background: available ? 'rgba(22, 163, 74, 0.10)' : 'var(--gray-100)',
      border: `1px solid ${available ? 'rgba(22, 163, 74, 0.25)' : 'var(--border)'}`
    }}>
      {available ? 'Available' : 'Locked'}
    </span>
  );
}

export default function HubRedeemMarketplace({
  // Free Greeting (H7) redemption
  balance,
  redemptionPaused,
  redeemOpen,
  redeemSubmitting,
  redeemOutcome,
  openRedeemIntent,
  cancelRedeemIntent,
  confirmRedeemIntent,
  // Marketplace catalog
  marketplaceItems = [],
  mktConfirmId,
  mktRedeemingId,
  mktOutcome = {},
  handleMarketplaceRedeem,
  setMktConfirmId,
}) {
  const [allOpen, setAllOpen] = useState(false);
  const insufficient = balance < REDEEM_COST;
  const freeGreetingDisabled = redemptionPaused || insufficient || redeemSubmitting;

  // The FULL real catalog for the "All Rewards" modal = the always-present live Free Greeting
  // reward + whatever real items the server returns (empty while the catalog is dormant). No
  // fabricated/placeholder items are ever added.
  const fullCatalog = [
    { key: 'free-greeting', title: 'Free Greeting', subtitle: `Redeem ${REDEEM_COST} Hearts for 1 Anytime Greet-Me`, cost: REDEEM_COST, available: true },
    ...marketplaceItems.map((it) => ({
      key: it.id,
      title: it.title,
      subtitle: it.vendor ? `Made by ${it.vendor}` : '',
      cost: null,
      available: it.state ? it.state === 'available' : true,
    })),
  ];

  return (
    <div className="hub-card" style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.75rem',
      marginBottom: '2rem',
      border: '1px solid var(--border)'
    }}>
      {/* Header: title/subtitle (left) + "All Rewards" catalog affordance (top-right). */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1.25rem' }}>
        <div>
          <h2 style={{
            fontSize: '1.375rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: '0 0 0.375rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <Gift size={22} style={{ color: '#ec4899' }} />
            Hearts Marketplace
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
            Redeem your Hearts for rewards.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setAllOpen(true)}
          aria-haspopup="dialog"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            flexShrink: 0,
            padding: '0.5rem 0.875rem',
            background: 'var(--bg-primary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.8125rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit'
          }}
        >
          All Rewards <ChevronDown size={15} />
        </button>
      </div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: '1rem'
      }}>
        {/* ---- Free Greeting — the always-present live AVAILABLE reward (H7) ---- */}
        <div style={{
          background: 'var(--gray-50)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-lg)',
          padding: '1rem',
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '2.75rem',
              height: '2.75rem',
              borderRadius: '50%',
              background: 'rgba(236, 72, 153, 0.12)'
            }}>
              <Gift size={22} style={{ color: '#ec4899' }} />
            </span>
            <StateBadge available={true} />
          </div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>Free Greeting</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem', lineHeight: 1.5, flex: 1 }}>
            Redeem {REDEEM_COST} Hearts for 1 Anytime Greet-Me
          </div>
          <div style={{ marginTop: '0.625rem' }}>
            <span style={{
              fontSize: '0.8125rem',
              fontWeight: 700,
              color: '#ec4899',
              whiteSpace: 'nowrap',
              background: 'rgba(236, 72, 153, 0.10)',
              border: '1px solid rgba(236, 72, 153, 0.25)',
              borderRadius: '999px',
              padding: '0.25rem 0.625rem'
            }}>
              {REDEEM_COST} ❤️
            </span>
          </div>

          {!redeemOpen ? (
            <button
              className="hub-btn"
              onClick={openRedeemIntent}
              disabled={freeGreetingDisabled}
              style={{
                marginTop: '0.875rem',
                width: '100%',
                padding: '0.75rem',
                background: freeGreetingDisabled ? 'var(--gray-300)' : 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '0.875rem',
                fontWeight: 700,
                boxShadow: freeGreetingDisabled ? 'none' : '0 8px 20px -6px rgba(236, 72, 153, 0.5)',
                cursor: freeGreetingDisabled ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {redemptionPaused
                ? 'Temporarily unavailable'
                : insufficient
                  ? `Need ${REDEEM_COST - balance} more Hearts`
                  : `Redeem ${REDEEM_COST} Hearts`}
            </button>
          ) : (
            <div style={{ marginTop: '0.875rem' }}>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-primary)', margin: '0 0 0.75rem' }}>
                Spend <strong>{REDEEM_COST} Hearts</strong> for <strong>1 Anytime Greet-Me</strong>?
              </p>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className="hub-btn"
                  onClick={cancelRedeemIntent}
                  disabled={redeemSubmitting}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: 'var(--gray-100)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: redeemSubmitting ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  Cancel
                </button>
                <button
                  className="hub-btn"
                  onClick={confirmRedeemIntent}
                  disabled={redeemSubmitting || insufficient}
                  style={{
                    flex: 1,
                    padding: '0.5rem',
                    background: (redeemSubmitting || insufficient) ? 'var(--gray-300)' : '#ec4899',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.8125rem',
                    fontWeight: 600,
                    cursor: (redeemSubmitting || insufficient) ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit'
                  }}
                >
                  {redeemSubmitting ? 'Redeeming…' : 'Confirm'}
                </button>
              </div>
            </div>
          )}

          {redeemOutcome && (
            <p style={{
              marginTop: '0.625rem',
              marginBottom: 0,
              fontSize: '0.8125rem',
              lineHeight: 1.5,
              fontWeight: 500,
              color: redeemOutcome.type === 'success'
                ? '#16a34a'
                : (redeemOutcome.type === 'paused' ? 'var(--text-secondary)' : '#dc2626')
            }}>
              {redeemOutcome.message}
            </p>
          )}
        </div>

        {/* ---- Server marketplace items (empty while the catalog is dormant) ---- */}
        {marketplaceItems.map((item) => {
          const img = (Array.isArray(item.images) && item.images[0]?.url) ? item.images[0].url : null;
          const available = item.state ? item.state === 'available' : true;
          return (
            <div
              key={item.id}
              data-reward-class={item.class || 'uncategorized'}
              style={{
                background: 'var(--gray-50)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-lg)',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column'
              }}
            >
              <div style={{
                width: '100%',
                height: '120px',
                background: img ? `url(${img}) center/cover no-repeat` : 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '2.25rem',
                position: 'relative'
              }}>
                {!img && '🎁'}
                <span style={{ position: 'absolute', top: '0.5rem', right: '0.5rem' }}>
                  <StateBadge available={available} />
                </span>
              </div>
              <div style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {item.title}
                </div>
                {item.vendor ? (
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', fontStyle: 'italic', marginTop: '0.125rem' }}>
                    Made by {item.vendor}
                  </div>
                ) : null}
                {/* Hearts never carry a dollar value; priceCents is intentionally not rendered. */}
                {/* Redeem CTA shows ONLY when the server marks the item structurally redeemable. */}
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

      {/* "All Rewards" modal — the FULL real catalog in a focused view. Real items only:
          the live Free Greeting + any server catalog items. No fabricated/placeholder rewards. */}
      {allOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="All Rewards"
          onClick={() => setAllOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1000,
            background: 'rgba(15, 23, 42, 0.55)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.25rem'
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '560px',
              maxHeight: '82vh',
              overflowY: 'auto',
              background: 'var(--bg-primary)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)',
              padding: '1.5rem'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>All Rewards</h3>
              <button
                type="button"
                onClick={() => setAllOpen(false)}
                aria-label="Close"
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '0.25rem', display: 'inline-flex' }}
              >
                <X size={20} />
              </button>
            </div>
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
              {fullCatalog.map((r) => (
                <li key={r.key} style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.75rem',
                  padding: '0.875rem 1rem',
                  background: 'var(--gray-50)',
                  border: '1px solid var(--border)',
                  borderRadius: 'var(--radius-lg)'
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--text-primary)' }}>{r.title}</div>
                    {r.subtitle ? (
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem', lineHeight: 1.4 }}>{r.subtitle}</div>
                    ) : null}
                  </div>
                  {r.cost != null ? (
                    <span style={{
                      fontSize: '0.8125rem',
                      fontWeight: 700,
                      color: '#ec4899',
                      whiteSpace: 'nowrap',
                      background: 'rgba(236, 72, 153, 0.10)',
                      border: '1px solid rgba(236, 72, 153, 0.25)',
                      borderRadius: '999px',
                      padding: '0.25rem 0.625rem'
                    }}>{r.cost} ❤️</span>
                  ) : null}
                  <StateBadge available={r.available} />
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
