// src/components/PreSendReviewModal.jsx
// Phase 3D Batch A — A2.3
//
// Emotional send confirmation with attachment awareness.
// This is NOT a checkout review, cart confirmation, or payment page.
//
// Visual hierarchy (founder-locked):
//   1. Recipient + Occasion       (dominant emotional anchor)
//   2. Greeting confirmation       (message preview + photos)
//   3. Attachment awareness        (secondary layer)
//   4. Total / payment awareness   (tertiary — must not visually dominate)
//
// Architecture: purely presentational + callback-driven.
//   - No api.* calls
//   - No cartService.* mutations
//   - No draftService.* calls
//   - No internal persistence
//   - All effects flow through props (onConfirm*, onClose, onRemoveAttachment)

import { Heart, Calendar, Image as ImageIcon, Send, CreditCard, Lock, X } from 'lucide-react';

function formatPrice(cents) {
  const n = typeof cents === 'number' ? cents : 0;
  return `$${(n / 100).toFixed(2)}`;
}

export default function PreSendReviewModal({
  isOpen,
  onClose,
  recipientName,
  recipientEmail,
  occasionLabel,
  messagePreview,
  photoCount,
  giftMode,
  qrCashAttachment,           // { amountCents, feeCents, totalCents, kind: 'fresh' | 'referral' } | null
  curatedAttachment,          // { maxSpendCents } | null
  marketplaceAttachments,     // Array<{ id, name, price, partner }> | null
  sending,
  onConfirmDirectSend,
  onConfirmQRCashFresh,
  onMarketplaceCheckout,      // A2.4: active handler (replaces A2.3 onMarketplaceBlocked stub)
  onRemoveAttachment,
}) {
  if (!isOpen) return null;

  const hasMarketplaceItems = Array.isArray(marketplaceAttachments) && marketplaceAttachments.length > 0;

  // Primary CTA configuration — derived from giftMode + attachment kind.
  // Each path routes to an existing terminal handler in SendGreeting.jsx.
  // No new dispatch logic is introduced by the modal.
  const primaryCTA = (() => {
    if (!giftMode || giftMode === 'none') {
      return { label: 'Send Now', onClick: onConfirmDirectSend, disabled: !!sending, icon: 'send' };
    }
    if (giftMode === 'qrcash') {
      if (qrCashAttachment?.kind === 'referral') {
        return { label: 'Send Now', onClick: onConfirmDirectSend, disabled: !!sending, icon: 'send' };
      }
      return { label: 'Continue to Payment', onClick: onConfirmQRCashFresh, disabled: !!sending, icon: 'payment' };
    }
    if (giftMode === 'curated') {
      return { label: 'Send Request', onClick: onConfirmDirectSend, disabled: !!sending, icon: 'send' };
    }
    if (giftMode === 'marketplace') {
      // Phase 3D Batch A — A2.4: CTA enabled when items present and not sending.
      // The "next step" explanatory note is gone — the orchestration is real now.
      return {
        label: 'Continue to Secure Checkout',
        onClick: onMarketplaceCheckout,
        disabled: !hasMarketplaceItems || !!sending,
        icon: 'checkout',
        note: hasMarketplaceItems
          ? null
          : 'Add a marketplace gift below, or return to the greeting to change the gift type.',
      };
    }
    return { label: 'Send Now', onClick: onConfirmDirectSend, disabled: !!sending, icon: 'send' };
  })();

  const totalCents = (() => {
    if (giftMode === 'qrcash') return qrCashAttachment?.totalCents || 0;
    if (giftMode === 'marketplace') {
      return (marketplaceAttachments || []).reduce((sum, item) => {
        const cents = typeof item.price === 'number' ? Math.round(item.price * 100) : 0;
        return sum + cents;
      }, 0);
    }
    return 0;
  })();
  const showTotalRow = giftMode === 'qrcash' || giftMode === 'marketplace';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(17, 24, 39, 0.55)',
          backdropFilter: 'blur(2px)',
          zIndex: 9998,
        }}
      />

      {/* Modal panel — Phase 3D Batch B B.2.2: max-height moved to
          gm-max-h-modal-fullsize class (dual-line vh/dvh fallback).
          Internal scroll containment (overflowY: 'auto') preserved verbatim. */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="gm-max-h-modal-fullsize"
        style={{
          position: 'relative',
          zIndex: 10000,
          backgroundColor: 'white',
          borderRadius: '0.75rem',
          boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '500px',
          overflowY: 'auto',
          padding: '2rem 2rem 1.75rem',
        }}
      >
        {/* ───── 1. Recipient + Occasion (primary emotional anchor) ───── */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            padding: '0.25rem 0.75rem',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(118, 75, 162, 0.06) 100%)',
            border: '1px solid rgba(102, 126, 234, 0.18)',
            borderRadius: '9999px',
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#667eea',
            marginBottom: '0.875rem',
          }}>
            <Heart size={11} />
            Sending to
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: '#111827',
            margin: '0 0 0.25rem',
            lineHeight: 1.2,
          }}>
            {recipientName || 'Your recipient'}
          </h2>
          {recipientEmail && (
            <p style={{
              fontSize: '0.8125rem',
              color: '#9ca3af',
              margin: '0 0 0.5rem',
            }}>
              {recipientEmail}
            </p>
          )}
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.375rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#6b7280',
          }}>
            <Calendar size={14} />
            {occasionLabel || 'Just Because'}
          </div>
        </div>

        {/* Soft divider */}
        <div style={{ height: '1px', background: 'linear-gradient(90deg, transparent, #e5e7eb, transparent)', margin: '0 0 1.5rem' }} />

        {/* ───── 2. Greeting confirmation (message + photos) ───── */}
        <div style={{ marginBottom: '1.5rem' }}>
          <p style={{
            fontSize: '0.6875rem',
            fontWeight: 600,
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            color: '#9ca3af',
            margin: '0 0 0.625rem',
          }}>
            Your greeting
          </p>
          <div style={{
            padding: '1rem 1.125rem',
            background: '#fafafa',
            border: '1px solid #f3f4f6',
            borderRadius: '0.625rem',
          }}>
            {messagePreview ? (
              <p style={{
                fontSize: '0.9375rem',
                lineHeight: 1.55,
                color: '#374151',
                margin: 0,
                fontStyle: 'italic',
                // Soft truncation visual — preserves first 240 chars in render
                display: '-webkit-box',
                WebkitLineClamp: 4,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }}>
                {`“${messagePreview.slice(0, 240)}${messagePreview.length > 240 ? '…' : ''}”`}
              </p>
            ) : (
              <p style={{
                fontSize: '0.875rem',
                lineHeight: 1.5,
                color: '#9ca3af',
                margin: 0,
                fontStyle: 'italic',
              }}>
                Greet-Me will compose a warm, personal greeting.
              </p>
            )}
            {photoCount > 0 && (
              <div style={{
                marginTop: '0.75rem',
                paddingTop: '0.75rem',
                borderTop: '1px dashed #e5e7eb',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                fontSize: '0.75rem',
                color: '#6b7280',
              }}>
                <ImageIcon size={12} />
                {photoCount} {photoCount === 1 ? 'photo' : 'photos'} included
              </div>
            )}
          </div>
        </div>

        {/* ───── 3. Attachment awareness (secondary layer) ───── */}
        {giftMode && giftMode !== 'none' && (
          <div style={{ marginBottom: showTotalRow ? '1.25rem' : '1.5rem' }}>
            <p style={{
              fontSize: '0.6875rem',
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#9ca3af',
              margin: '0 0 0.625rem',
            }}>
              Gift attached
            </p>

            {/* QR Cash attachment */}
            {giftMode === 'qrcash' && qrCashAttachment && (
              <div style={{
                padding: '1rem 1.125rem',
                background: '#fefce8',
                border: '1px solid #fde68a',
                borderRadius: '0.625rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#854d0e' }}>
                    QR Cash{qrCashAttachment.kind === 'referral' ? ' — referral credit' : ''}
                  </span>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#854d0e' }}>
                    {formatPrice(qrCashAttachment.amountCents)}
                  </span>
                </div>
                {qrCashAttachment.kind === 'referral' && (
                  <p style={{
                    fontSize: '0.75rem',
                    color: '#a16207',
                    margin: '0.375rem 0 0',
                  }}>
                    Applied as a credit — no payment required.
                  </p>
                )}
              </div>
            )}

            {/* Curated attachment */}
            {giftMode === 'curated' && (
              <div style={{
                padding: '1rem 1.125rem',
                background: '#f5f3ff',
                border: '1px solid #ddd6fe',
                borderRadius: '0.625rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.9375rem', fontWeight: 600, color: '#5b21b6' }}>
                    Curated by Greet-Me
                  </span>
                  {curatedAttachment?.maxSpendCents > 0 && (
                    <span style={{ fontSize: '0.875rem', fontWeight: 500, color: '#6d28d9' }}>
                      Up to {formatPrice(curatedAttachment.maxSpendCents)}
                    </span>
                  )}
                </div>
                <p style={{
                  fontSize: '0.75rem',
                  color: '#6d28d9',
                  margin: '0.5rem 0 0',
                  lineHeight: 1.5,
                }}>
                  Greet-Me will personally follow up regarding your curated gift request.
                </p>
              </div>
            )}

            {/* Marketplace attachments */}
            {giftMode === 'marketplace' && (
              <>
                {hasMarketplaceItems ? (
                  <div style={{
                    border: '1px solid #d1fae5',
                    background: '#f0fdf4',
                    borderRadius: '0.625rem',
                    overflow: 'hidden',
                  }}>
                    {marketplaceAttachments.map((item, idx) => {
                      const priceCents = typeof item.price === 'number' ? Math.round(item.price * 100) : 0;
                      return (
                        <div
                          key={item.id ?? idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '0.75rem 1rem',
                            borderBottom: idx < marketplaceAttachments.length - 1 ? '1px solid #d1fae5' : 'none',
                            gap: '0.75rem',
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{
                              fontSize: '0.875rem',
                              fontWeight: 600,
                              color: '#065f46',
                              margin: 0,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}>
                              {item.name || 'Gift item'}
                            </p>
                            {item.partner && (
                              <p style={{ fontSize: '0.6875rem', color: '#047857', margin: '0.125rem 0 0' }}>
                                {item.partner}
                              </p>
                            )}
                          </div>
                          <span style={{ fontSize: '0.875rem', fontWeight: 600, color: '#065f46', whiteSpace: 'nowrap' }}>
                            {formatPrice(priceCents)}
                          </span>
                          <button
                            type="button"
                            onClick={() => onRemoveAttachment && onRemoveAttachment(item.id)}
                            aria-label={`Remove ${item.name || 'item'}`}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: '0.9375rem',
                              cursor: 'pointer',
                              color: '#10b981',
                              borderRadius: '0.25rem',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              transition: 'all 0.15s',
                              fontFamily: 'inherit',
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = '#dcfce7'; e.currentTarget.style.color = '#047857'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#10b981'; }}
                          >
                            <X size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{
                    padding: '1rem 1.125rem',
                    background: '#f9fafb',
                    border: '1px dashed #e5e7eb',
                    borderRadius: '0.625rem',
                    fontSize: '0.8125rem',
                    color: '#6b7280',
                    lineHeight: 1.5,
                  }}>
                    No gift items selected yet. Return to the greeting to browse the Greet-Me Gift Place, or change the gift type.
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ───── 4. Total / payment awareness (tertiary) ───── */}
        {showTotalRow && (
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            padding: '0.5rem 0',
            marginBottom: '1.25rem',
            borderTop: '1px solid #f3f4f6',
          }}>
            <span style={{ fontSize: '0.8125rem', color: '#6b7280', paddingTop: '0.5rem' }}>
              {giftMode === 'qrcash' && qrCashAttachment?.kind === 'fresh' ? 'Total (includes processing fee)' : 'Total'}
            </span>
            <span style={{
              fontSize: '0.9375rem',
              fontWeight: 600,
              color: '#374151',
              paddingTop: '0.5rem',
            }}>
              {formatPrice(totalCents)}
            </span>
          </div>
        )}

        {/* ───── Primary CTA ───── */}
        {primaryCTA && (
          <>
            <button
              type="button"
              onClick={primaryCTA.onClick}
              disabled={primaryCTA.disabled}
              style={{
                width: '100%',
                padding: '0.9375rem 1.25rem',
                background: primaryCTA.disabled
                  ? '#e5e7eb'
                  : (primaryCTA.icon === 'send'
                      ? 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)'
                      : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'),
                color: primaryCTA.disabled ? '#9ca3af' : 'white',
                border: 'none',
                borderRadius: '0.625rem',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: primaryCTA.disabled ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem',
                boxShadow: primaryCTA.disabled
                  ? 'none'
                  : (primaryCTA.icon === 'send'
                      ? '0 4px 12px rgba(34, 197, 94, 0.25)'
                      : '0 4px 12px rgba(102, 126, 234, 0.25)'),
                transition: 'all 0.2s',
              }}
            >
              {primaryCTA.icon === 'send' && <Send size={16} />}
              {primaryCTA.icon === 'payment' && <CreditCard size={16} />}
              {primaryCTA.icon === 'checkout' && <Lock size={16} />}
              {primaryCTA.label}
            </button>
            {primaryCTA.note && (
              <p style={{
                fontSize: '0.75rem',
                color: '#6b7280',
                textAlign: 'center',
                margin: '0.625rem 0 0',
                lineHeight: 1.5,
              }}>
                {primaryCTA.note}
              </p>
            )}
          </>
        )}

        {/* ───── Secondary: Edit Greeting (close-without-mutation) ───── */}
        <button
          type="button"
          onClick={onClose}
          style={{
            width: '100%',
            marginTop: '1rem',
            padding: '0.75rem 1.25rem',
            background: 'transparent',
            color: '#6b7280',
            border: 'none',
            borderRadius: '0.625rem',
            fontSize: '0.875rem',
            fontWeight: 500,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Edit greeting
        </button>
      </div>
    </div>
  );
}
