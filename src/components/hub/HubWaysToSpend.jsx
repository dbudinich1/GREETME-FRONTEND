// src/components/hub/HubWaysToSpend.jsx
// UX-HUB-3 Batch 2 — "Spend Your Hearts" section (H7 Free Greeting redemption). Behavior-
// preserving extraction from Rewards.jsx. Presentational only: receives balance + redemption
// intent state and the open/cancel/confirm callbacks as props; owns no state, makes no API
// calls (the redemption handlers live in the page). REDEEM_COST imported from hubConfig.

import { Gift } from 'lucide-react';
import { REDEEM_COST } from './hubConfig';

export default function HubWaysToSpend({
  balance,
  redemptionPaused,
  redeemOpen,
  redeemSubmitting,
  redeemOutcome,
  openRedeemIntent,
  cancelRedeemIntent,
  confirmRedeemIntent,
}) {
  return (
    <div className="hub-card" style={{
      background: 'var(--bg-primary)',
      borderRadius: 'var(--radius-xl)',
      padding: '1.75rem',
      marginBottom: '2rem',
      border: '1px solid var(--border)'
    }}>
      <h2 style={{
        fontSize: '1.375rem',
        fontWeight: 700,
        color: 'var(--text-primary)',
        marginBottom: '1rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.5rem'
      }}>
        <Gift size={22} style={{ color: '#ec4899' }} />
        Redeem Hearts
      </h2>
      {redemptionPaused ? (
        <p style={{
          fontSize: '0.9375rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          margin: 0
        }}>
          Redemption is coming soon — keep earning Hearts and you'll be able to redeem them shortly.
        </p>
      ) : (
        <>
          {/* Batch 6 — the single real H7 redemption, composed as a richer premium card
              (icon · title · description · Hearts cost badge). Real option only, no fake tiles. */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '1.25rem',
            background: 'var(--gray-50)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border)',
            marginBottom: '1rem'
          }}>
            <span style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '3.5rem',
              height: '3.5rem',
              borderRadius: '50%',
              flexShrink: 0,
              background: 'rgba(236, 72, 153, 0.12)'
            }}>
              <Gift size={28} style={{ color: '#ec4899' }} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Free Greeting
              </div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.1875rem', lineHeight: 1.5 }}>
                Redeem {REDEEM_COST} Hearts for 1 Anytime Greet-Me
              </div>
            </div>
            <span style={{
              fontSize: '0.9375rem',
              fontWeight: 700,
              color: '#ec4899',
              whiteSpace: 'nowrap',
              background: 'rgba(236, 72, 153, 0.10)',
              border: '1px solid rgba(236, 72, 153, 0.25)',
              borderRadius: '999px',
              padding: '0.375rem 0.75rem'
            }}>
              {REDEEM_COST} ❤️
            </span>
          </div>

          {!redeemOpen ? (
            <button
              className="hub-btn"
              onClick={openRedeemIntent}
              disabled={balance < REDEEM_COST || redeemSubmitting}
              style={{
                width: '100%',
                padding: '1rem',
                background: balance < REDEEM_COST ? 'var(--gray-300)' : 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                color: 'white',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
                fontWeight: 700,
                boxShadow: balance < REDEEM_COST ? 'none' : '0 8px 20px -6px rgba(236, 72, 153, 0.5)',
                cursor: balance < REDEEM_COST ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit'
              }}
            >
              {balance < REDEEM_COST
                ? `Need ${REDEEM_COST - balance} more Hearts`
                : `Redeem ${REDEEM_COST} Hearts`}
            </button>
          ) : (
            <div style={{
              padding: '1rem',
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border)'
            }}>
              <p style={{ fontSize: '0.9375rem', color: 'var(--text-primary)', margin: '0 0 0.875rem' }}>
                Spend <strong>{REDEEM_COST} Hearts</strong> for <strong>1 Anytime Greet-Me</strong>?
              </p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button
                  className="hub-btn"
                  onClick={cancelRedeemIntent}
                  disabled={redeemSubmitting}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    background: 'var(--gray-100)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
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
                  disabled={redeemSubmitting || balance < REDEEM_COST}
                  style={{
                    flex: 1,
                    padding: '0.625rem',
                    background: (redeemSubmitting || balance < REDEEM_COST) ? 'var(--gray-300)' : '#ec4899',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: (redeemSubmitting || balance < REDEEM_COST) ? 'not-allowed' : 'pointer',
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
              marginTop: '0.75rem',
              marginBottom: 0,
              fontSize: '0.875rem',
              lineHeight: 1.5,
              fontWeight: 500,
              color: redeemOutcome.type === 'success'
                ? '#16a34a'
                : (redeemOutcome.type === 'paused' ? 'var(--text-secondary)' : '#dc2626')
            }}>
              {redeemOutcome.message}
            </p>
          )}
        </>
      )}
    </div>
  );
}
