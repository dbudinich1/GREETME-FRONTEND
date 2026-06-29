// src/components/hub/HubHeroHeartsModal.jsx
// UX-HUB-3 Batch 2 — Hero Hearts pricing modal (selection + confirmation states). Behavior-
// preserving extraction from Rewards.jsx. Presentational only: receives the modal open flag,
// selection/step state, the last-added bundle, and the cart/reset/navigate callbacks as props;
// owns no state and makes no API calls (handleAddToCart / resetHeroHeartsModal live in the page).
// HERO_HEARTS_BUNDLES comes from hubConfig; cartService is read for the in-cart count (unchanged).

import { Heart, Check, ShoppingCart, ArrowRight } from 'lucide-react';
import cartService from '../../services/cartService';
import { HERO_HEARTS_BUNDLES } from './hubConfig';

export default function HubHeroHeartsModal({
  open,
  selectedHeroBundle,
  setSelectedHeroBundle,
  heroHeartsStep,
  lastAddedHeroBundle,
  handleAddToCart,
  resetHeroHeartsModal,
  navigate,
}) {
  if (!open) return null;
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={resetHeroHeartsModal}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          zIndex: 1000
        }}
      />
      {/* Modal */}
      <div style={{
        position: 'fixed',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'white',
        borderRadius: '1rem',
        width: '90%',
        maxWidth: '800px',
        maxHeight: '90vh',
        zIndex: 1001,
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Close Button - Fixed to modal frame */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            resetHeroHeartsModal();
          }}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: '#f3f4f6',
            border: 'none',
            borderRadius: '50%',
            width: '36px',
            height: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.2s',
            zIndex: 9999,
            boxShadow: '0 2px 8px rgba(0,0,0,0.2)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e5e7eb';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#f3f4f6';
          }}
        >
          <span style={{ fontSize: '24px', fontWeight: 'bold', color: '#374151', lineHeight: 1 }}>×</span>
        </button>

        {/* Scrollable Content */}
        <div style={{ padding: '2rem', paddingTop: '3rem', overflowY: 'auto', flex: 1 }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{
            width: '4rem',
            height: '4rem',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1rem'
          }}>
            <Heart size={28} style={{ color: 'white' }} />
          </div>
          <h2 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
            marginBottom: '0.5rem'
          }}>
            Greet-Me Hero Hearts™
          </h2>
          <p style={{
            fontSize: '0.9375rem',
            color: 'var(--text-secondary)',
            lineHeight: 1.5
          }}>
            Add Hearts to your Rewards balance.
          </p>
          <div style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #D4AF37 0%, #8B6914 100%)',
            color: 'white',
            padding: '0.375rem 0.75rem',
            borderRadius: 'var(--radius-md)',
            fontSize: '0.75rem',
            fontWeight: 600,
            marginTop: '0.75rem'
          }}>
            🏅 25% of proceeds donated
          </div>
        </div>

        {/* STATE 1: Selection */}
        {heroHeartsStep === 'selection' && (
          <>
            {/* Pricing Cards Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
              marginBottom: '1.5rem'
            }}>
              {HERO_HEARTS_BUNDLES.map((bundle) => (
                <div
                  key={bundle.id}
                  onClick={() => setSelectedHeroBundle(bundle.id)}
                  style={{
                    position: 'relative',
                    background: selectedHeroBundle === bundle.id
                      ? 'linear-gradient(135deg, rgba(236, 72, 153, 0.1) 0%, rgba(190, 24, 93, 0.05) 100%)'
                      : 'white',
                    border: selectedHeroBundle === bundle.id
                      ? '2px solid #ec4899'
                      : bundle.popular
                        ? '2px solid #ec4899'
                        : '2px solid var(--border)',
                    borderRadius: 'var(--radius-xl)',
                    padding: '1.5rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    transform: selectedHeroBundle === bundle.id ? 'scale(1.02)' : 'scale(1)'
                  }}
                >
                  {/* Popular Badge */}
                  {bundle.popular && (
                    <div style={{
                      position: 'absolute',
                      top: '-0.75rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Most Popular
                    </div>
                  )}

                  {/* Best Value Badge */}
                  {bundle.bestValue && (
                    <div style={{
                      position: 'absolute',
                      top: '-0.75rem',
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: 'linear-gradient(135deg, #D4AF37 0%, #8B6914 100%)',
                      color: 'white',
                      padding: '0.25rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Best Value
                    </div>
                  )}

                  {/* Selection Indicator */}
                  <div style={{
                    position: 'absolute',
                    top: '1rem',
                    right: '1rem',
                    width: '1.5rem',
                    height: '1.5rem',
                    borderRadius: '50%',
                    border: selectedHeroBundle === bundle.id ? '2px solid #ec4899' : '2px solid var(--border)',
                    background: selectedHeroBundle === bundle.id ? '#ec4899' : 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}>
                    {selectedHeroBundle === bundle.id && (
                      <Check size={14} style={{ color: 'white' }} />
                    )}
                  </div>

                  {/* Bundle Name */}
                  <h3 style={{
                    fontSize: '1.125rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                    paddingRight: '2rem'
                  }}>
                    {bundle.name}
                  </h3>

                  {/* Price */}
                  <div style={{
                    fontSize: '2rem',
                    fontWeight: 800,
                    color: '#ec4899',
                    marginBottom: '0.5rem'
                  }}>
                    ${bundle.price}
                  </div>

                  {/* Hearts Breakdown */}
                  <div style={{
                    background: 'var(--gray-50)',
                    borderRadius: 'var(--radius-lg)',
                    padding: '0.75rem',
                    marginBottom: '0.75rem'
                  }}>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8125rem',
                      color: 'var(--text-secondary)',
                      marginBottom: '0.25rem'
                    }}>
                      <span>Base Hearts:</span>
                      <span>{bundle.hearts.toLocaleString()} ❤️</span>
                    </div>
                    <div style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.8125rem',
                      color: '#22c55e',
                      fontWeight: 600,
                      marginBottom: '0.25rem'
                    }}>
                      <span>Bonus Hearts:</span>
                      <span>+{bundle.bonusHearts.toLocaleString()} ❤️</span>
                    </div>
                    <div style={{
                      borderTop: '1px solid var(--border)',
                      paddingTop: '0.5rem',
                      marginTop: '0.25rem',
                      display: 'flex',
                      justifyContent: 'space-between',
                      fontSize: '0.9375rem',
                      fontWeight: 700,
                      color: '#ec4899'
                    }}>
                      <span>Total:</span>
                      <span>{bundle.totalHearts.toLocaleString()} ❤️</span>
                    </div>
                  </div>

                  {/* Per Dollar Value */}
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--text-secondary)',
                    textAlign: 'center',
                    marginBottom: '0.75rem'
                  }}>
                    {bundle.perDollar} Hearts per dollar
                  </div>

                  {/* Description */}
                  <p style={{
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)',
                    lineHeight: 1.5,
                    textAlign: 'center'
                  }}>
                    {bundle.description}
                  </p>
                </div>
              ))}
            </div>

            {/* Selection State Buttons */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'space-between'
            }}>
              {/* Cancel - Secondary (outline) - LEFT */}
              <button
                onClick={resetHeroHeartsModal}
                style={{
                  padding: '0.875rem 1.5rem',
                  background: 'white',
                  color: 'var(--text-primary)',
                  border: '2px solid var(--border)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit'
                }}
              >
                Cancel
              </button>

              {/* Add to Cart - Primary (solid) - RIGHT */}
              <button
                onClick={() => {
                  const bundle = HERO_HEARTS_BUNDLES.find(b => b.id === selectedHeroBundle);
                  if (bundle) {
                    handleAddToCart(bundle);
                  }
                }}
                disabled={!selectedHeroBundle}
                style={{
                  padding: '0.875rem 2rem',
                  background: selectedHeroBundle
                    ? 'linear-gradient(135deg, #ec4899 0%, #be185d 100%)'
                    : 'var(--gray-200)',
                  color: selectedHeroBundle ? 'white' : 'var(--text-secondary)',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: selectedHeroBundle ? 'pointer' : 'not-allowed',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  boxShadow: selectedHeroBundle ? '0 4px 12px rgba(236, 72, 153, 0.3)' : 'none'
                }}
              >
                <ShoppingCart size={18} />
                Add to Cart
              </button>
            </div>

            {/* Info Note */}
            <p style={{
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              textAlign: 'center',
              marginTop: '1rem',
              fontStyle: 'italic'
            }}>
              Hearts are added to your Rewards balance immediately after purchase. 25% of proceeds from Hero Hearts™ support U.S. Veterans and their families.
            </p>
          </>
        )}

        {/* STATE 2: Confirmation */}
        {heroHeartsStep === 'confirmation' && lastAddedHeroBundle && (
          <div style={{ textAlign: 'center', padding: '1rem 0' }}>
            {/* Success Icon */}
            <div style={{
              width: '5rem',
              height: '5rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #22c55e 0%, #16a34a 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1.5rem',
              boxShadow: '0 4px 12px rgba(34, 197, 94, 0.3)'
            }}>
              <Check size={40} style={{ color: 'white' }} />
            </div>

            {/* Confirmation Message */}
            <h3 style={{
              fontSize: '1.5rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Added to Cart!
            </h3>

            <p style={{
              fontSize: '1rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem'
            }}>
              {lastAddedHeroBundle.name} ({lastAddedHeroBundle.totalHearts.toLocaleString()} ❤️)
            </p>

            {/* Item Summary */}
            <div style={{
              background: 'var(--gray-50)',
              borderRadius: 'var(--radius-lg)',
              padding: '1rem',
              marginBottom: '0.75rem',
              maxWidth: '320px',
              margin: '0 auto 1.5rem'
            }}>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.5rem'
              }}>
                <span style={{ color: 'var(--text-secondary)' }}>Hero Hearts - {lastAddedHeroBundle.name}</span>
                <span style={{ fontWeight: 600, color: '#ec4899' }}>${lastAddedHeroBundle.price}</span>
              </div>
              <div style={{
                borderTop: '1px solid var(--border)',
                paddingTop: '0.5rem',
                fontSize: '0.875rem',
                color: 'var(--text-secondary)'
              }}>
                {cartService.getCount()} {cartService.getCount() === 1 ? 'item' : 'items'} in cart
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'center',
              maxWidth: '400px',
              margin: '0 auto'
            }}>
              {/* Continue Shopping - Secondary (outline) */}
              <button
                onClick={resetHeroHeartsModal}
                style={{
                  flex: 1,
                  padding: '0.875rem 1.5rem',
                  background: 'white',
                  color: '#667eea',
                  border: '2px solid #667eea',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                <ShoppingCart size={18} />
                Continue Shopping
              </button>

              {/* Checkout - Primary (solid) */}
              <button
                onClick={() => {
                  resetHeroHeartsModal();
                  navigate('/dashboard/cart');
                }}
                style={{
                  flex: 1,
                  padding: '0.875rem 1.5rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '0.9375rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
                  fontFamily: 'inherit',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem'
                }}
              >
                Checkout
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
}
