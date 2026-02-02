// src/components/AddToCartModal.jsx
import { Check, ShoppingCart, ArrowRight, ArrowLeft } from 'lucide-react';

export default function AddToCartModal({ isOpen, onClose, item, onContinueShopping, onGoToCheckout, onReturnToRecipient, showReturnToRecipient, returnToLabel = "Return to Recipient Settings" }) {
  if (!isOpen) return null;

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
      padding: '1rem'
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
        style={{
          position: 'relative',
          zIndex: 10000,
          backgroundColor: 'white',
          borderRadius: '1rem',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          width: '100%',
          maxWidth: '400px',
          padding: '2rem',
          textAlign: 'center'
        }}
        onClick={(e) => e.stopPropagation()}
      >
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
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f5f3ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'white';
            }}
          >
            <ShoppingCart size={18} />
            Continue Shopping
          </button>

          {/* Go to Checkout Button */}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-2px)';
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(102, 126, 234, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.3)';
            }}
          >
            Go to Checkout
            <ArrowRight size={18} />
          </button>

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
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#e5e7eb';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
              }}
            >
              <ArrowLeft size={18} />
              {returnToLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
