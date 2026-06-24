// src/pages/Rewards.jsx
// Greet-Me Rewards™ - Full rewards page with balance, history, and redemption

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Heart, Clock, Star, Trophy, Sparkles, Send, ExternalLink, ShoppingCart, X, Check, ArrowRight } from 'lucide-react';
import cartService from '../services/cartService';
import api from '../api/api';
import { pushInApp } from '../utils/notify';
import { COMMS_EVENTS } from '../utils/commsCatalog';

export default function Rewards() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [showHeroHeartsModal, setShowHeroHeartsModal] = useState(false);
  const [selectedHeroBundle, setSelectedHeroBundle] = useState(null);
  const [heroHeartsStep, setHeroHeartsStep] = useState('selection'); // 'selection' | 'confirmation'
  const [lastAddedHeroBundle, setLastAddedHeroBundle] = useState(null);

  // Hero Hearts Bundles - price tiers with bonus hearts
  const HERO_HEARTS_BUNDLES = [
    {
      id: 'bundle-100',
      name: 'Starter Bundle',
      price: 100,
      hearts: 1000,
      bonusHearts: 200,
      totalHearts: 1200,
      perDollar: 12,
      popular: false,
      description: 'Perfect for getting started with Hero Hearts',
      priceId: 'price_1T4eJxCf7KAA6aLaHqH2clKw',
      purchaseType: 'hero_hearts',
    },
    {
      id: 'bundle-250',
      name: 'Growth Bundle',
      price: 250,
      hearts: 2500,
      bonusHearts: 750,
      totalHearts: 3250,
      perDollar: 13,
      popular: true,
      description: 'Most popular choice - best value for regular gifters',
      priceId: 'price_1T4eJyCf7KAA6aLaJjJLgVTK',
      purchaseType: 'hero_hearts',
    },
    {
      id: 'bundle-500',
      name: 'Hero Bundle',
      price: 500,
      hearts: 5000,
      bonusHearts: 2000,
      totalHearts: 7000,
      perDollar: 14,
      popular: false,
      bestValue: true,
      description: 'Maximum impact - double your rewards balance',
      priceId: 'price_1T4eJzCf7KAA6aLagx468kzk',
      purchaseType: 'hero_hearts',
    }
  ];

  const handleAddToCart = (bundle) => {
    const cartItem = {
      type: 'hero-hearts',
      name: `Hero Hearts - ${bundle.name}`,
      price: bundle.price,
      quantity: 1,
      hearts: bundle.totalHearts,
      bundleId: bundle.id,
      icon: '❤️',
      ...(bundle.priceId && { priceId: bundle.priceId }),
      ...(bundle.purchaseType && { purchaseType: bundle.purchaseType }),
    };

    // Use cartService instead of direct localStorage
    cartService.addItem(cartItem);

    // Trigger cart badge update in DashboardLayout
    window.dispatchEvent(new Event('cartUpdated'));

    // Store the added bundle and transition to confirmation state
    setLastAddedHeroBundle(bundle);
    setHeroHeartsStep('confirmation');
  };

  // Reset Hero Hearts modal to initial state
  const resetHeroHeartsModal = () => {
    setShowHeroHeartsModal(false);
    setSelectedHeroBundle(null);
    setHeroHeartsStep('selection');
    setLastAddedHeroBundle(null);
  };

  // H6a: one-time, idempotent, non-fatal cleanup of legacy Hearts localStorage keys
  // (the localStorage Hearts economy was removed; the server is authoritative).
  useEffect(() => {
    try {
      localStorage.removeItem('greetme_rewards_balance');
      localStorage.removeItem('greetme_rewards_history');
      localStorage.removeItem('greetme_daily_greeting_hearts');
      localStorage.removeItem('greetme_dm_tag_claims');
      localStorage.removeItem('greetme_hero_member');
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => {
    loadRewardsData();
  }, []);

  const loadRewardsData = async () => {
    try {
      const res = await api.getHeartsBalance();
      setBalance(res?.balance ?? 0);
    } catch {
      setBalance(0);
    }
  };

  return (
    <div style={{ maxWidth: '100%', overflow: 'hidden' }}>
      {/* Background Frame for Page Body */}
      <div style={{
        background: '#f8fafc',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid #e2e8f0',
        padding: '2rem',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
      }}>
        {/* Banner Header */}
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
            <span style={{ fontSize: '2rem' }}>❤️</span> Greet-Me™ Rewards™
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

      {/* Balance Card */}
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

      {/* How to Earn Section */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Sparkles size={20} style={{ color: '#ec4899' }} />
          How to Earn Hearts
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem'
        }}>
          {[
            'Send a Thank-You Greet-Me',
            'Send your first independent Greet-Me',
            'Schedule an occasion',
            'Reach 5 delivered recipients',
            'Reach 10 delivered recipients',
            'Send a gift with your Greet-Me',
            'Share a Greet-Me',
            'Earn when your shared friend joins',
            'Subscribe',
            'Upgrade'
          ].map((label) => (
            <div
              key={label}
              style={{
                padding: '1rem',
                background: 'var(--gray-50)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}
            >
              <span style={{
                fontSize: '0.875rem',
                color: 'var(--text-primary)',
                fontWeight: 500
              }}>
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Redemption — coming soon (H6a: legacy redemption removed) */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '1.5rem',
        marginBottom: '2rem',
        border: '1px solid var(--border)'
      }}>
        <h2 style={{
          fontSize: '1.25rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Gift size={20} style={{ color: '#ec4899' }} />
          Redeem Your Hearts
        </h2>
        <p style={{
          fontSize: '0.9375rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          margin: 0
        }}>
          Redemption is coming soon — keep earning Hearts and you'll be able to redeem them shortly.
        </p>
      </div>

      {/* Hero Hearts Pricing Modal */}
      {showHeroHeartsModal && (
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
                Double your Rewards balance and support veterans & first responders
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
                🏅 10% of proceeds donated
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
                  Hearts are added to your Rewards balance immediately after purchase. 10% of all Hero Hearts purchases support veterans and first responders.
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
      )}
      </div>
    </div>
  );
}
