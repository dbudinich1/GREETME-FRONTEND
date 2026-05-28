// src/components/AddToCartModal.jsx
import { Check, ShoppingCart, ArrowRight, ArrowLeft } from 'lucide-react';
import { getHoverHandlers } from '../utils/hoverable';

export default function AddToCartModal({
  isOpen,
  onClose,
  item,
  // Variant-picker mode (Phase 3C Stage 3): caller passes variants + productName.
  // When variants is a non-empty array AND no item is set, the modal renders the picker.
  variants,
  productName,
  onVariantSelected,
  onContinueShopping,
  onGoToCheckout,
  onReturnToRecipient,
  showReturnToRecipient,
  returnToLabel = "Return to Recipient Settings",
  // Phase 3D Batch A — A2.1: when false (typically in send-flow context),
  // the "Go to Checkout" CTA is suppressed so the user must return to the
  // greeting flow rather than leaking out to checkout mid-build.
  // Defaults to true to preserve all standalone storefront behavior.
  showGoToCheckout = true,
}) {
  if (!isOpen) return null;

  const isPickerMode = Array.isArray(variants) && variants.length > 0 && !item;

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1rem',
      paddingTop: 'env(safe-area-inset-top, 0px)'
    }}>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          zIndex: 9998
        }}
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="gm-max-h-modal"
        style={{
          position: 'relative',
          zIndex: 10000,
          backgroundColor: 'white',
          borderRadius: '1rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '400px',
          padding: '2rem',
          textAlign: 'center',
          overflowY: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {isPickerMode ? (
          <>
            {/* Picker title */}
            <h3 style={{
              fontSize: '1.125rem',
              fontWeight: 700,
              color: '#111827',
              marginBottom: '0.25rem'
            }}>
              Choose your size
            </h3>
            {productName && (
              <p style={{
                fontSize: '0.875rem',
                color: '#6b7280',
                marginBottom: '1.25rem'
              }}>
                {productName}
              </p>
            )}

            {/* Variant chips — wrap, full-width tap targets on mobile */}
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '0.5rem',
              marginBottom: '1.25rem',
              justifyContent: 'center'
            }}>
              {variants.map((v) => (
                <button
                  key={v.syncVariantId}
                  onClick={() => onVariantSelected && onVariantSelected(v)}
                  style={{
                    padding: '0.625rem 0.875rem',
                    minHeight: '44px',
                    background: 'white',
                    color: '#374151',
                    border: '2px solid #e5e7eb',
                    borderRadius: '0.625rem',
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.15s',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                  {...getHoverHandlers({
                    onEnter: (e) => {
                      e.currentTarget.style.borderColor = '#667eea';
                      e.currentTarget.style.background = '#f5f3ff';
                    },
                    onLeave: (e) => {
                      e.currentTarget.style.borderColor = '#e5e7eb';
                      e.currentTarget.style.background = 'white';
                    },
                  })}
                >
                  <span>{v.label}</span>
                  <span style={{ color: '#667eea', fontWeight: 700 }}>
                    ${(v.priceCents / 100).toFixed(v.priceCents % 100 === 0 ? 0 : 2)}
                  </span>
                </button>
              ))}
            </div>

            <button
              onClick={onClose}
              style={{
                width: '100%',
                padding: '0.75rem 1rem',
                background: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '0.625rem',
                fontSize: '0.875rem',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit'
              }}
            >
              Cancel
            </button>
          </>
        ) : (
          <>
            {/* Success Icon */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
            }}>
              <Check size={32} color="white" strokeWidth={3} />
            </div>

            {/* Title */}
            <h3 style={{
              fontSize: '1.375rem',
              fontWeight: 700,
              color: '#111827',
              marginBottom: '0.5rem'
            }}>
              Added to Cart!
            </h3>

            {/* Item Info */}
            {item && (
              <div style={{
                background: '#f9fafb',
                borderRadius: '0.75rem',
                padding: '1rem',
                marginBottom: '1.5rem'
              }}>
                <p style={{
                  fontSize: '1rem',
                  fontWeight: 600,
                  color: '#374151',
                  marginBottom: '0.25rem'
                }}>
                  {item.name}
                </p>
                <p style={{
                  fontSize: '1.125rem',
                  fontWeight: 700,
                  color: '#667eea'
                }}>
                  ${typeof item.price === 'number' ? item.price.toFixed(2) : item.price}
                </p>
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem'
            }}>
              {/* Continue Shopping Button */}
              <button
                onClick={onContinueShopping}
                style={{
                  width: '100%',
                  padding: '0.875rem 1.5rem',
                  background: 'white',
                  color: '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: '0.75rem',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit'
                }}
                {...getHoverHandlers({
                  onEnter: (e) => { e.currentTarget.style.background = '#f5f3ff'; },
                  onLeave: (e) => { e.currentTarget.style.background = 'white'; },
                })}
              >
                <ShoppingCart size={18} />
                Continue Shopping
              </button>

              {/* Go to Checkout Button — A2.1: suppressed in send-flow context */}
              {showGoToCheckout && (
                <button
                  onClick={onGoToCheckout}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1.5rem',
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '0.75rem',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                    fontFamily: 'inherit'
                  }}
                  {...getHoverHandlers({
                    onEnter: (e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
                    },
                    onLeave: (e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
                    },
                  })}
                >
                  Go to Checkout
                  <ArrowRight size={18} />
                </button>
              )}

              {/* Return to Recipient Settings Button - only show if came from recipient form */}
              {showReturnToRecipient && onReturnToRecipient && (
                <button
                  onClick={onReturnToRecipient}
                  style={{
                    width: '100%',
                    padding: '0.875rem 1.5rem',
                    background: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '0.75rem',
                    fontSize: '0.9375rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    transition: 'all 0.2s',
                    fontFamily: 'inherit'
                  }}
                  {...getHoverHandlers({
                    onEnter: (e) => { e.currentTarget.style.background = '#e5e7eb'; },
                    onLeave: (e) => { e.currentTarget.style.background = '#f3f4f6'; },
                  })}
                >
                  <ArrowLeft size={18} />
                  {returnToLabel}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
