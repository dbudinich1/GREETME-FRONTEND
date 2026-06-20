// Animation Bank Page
// Shows user's animation credits with positive, asset-focused language
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Film, Plus, Gift, Calendar, Star, Sparkles, ShoppingCart, Check, ArrowRight } from 'lucide-react';
import animationBankService from '../services/animationBankService';
import cartService from '../services/cartService';
import api from '../api/api';

export default function AnimationBank() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Level 1 truth: plan inclusions come from live profile entitlements
  // (monthlyGreetMes / includedAnytime / rolloverCap), NOT the localStorage
  // mock. Show a neutral "—" until entitlements hydrate; never fabricate a value.
  const ent = user?.entitlements;
  const entReady = !!ent && ent.monthlyGreetMes !== undefined;
  const monthlyIncluded = entReady ? (ent.monthlyGreetMes ?? 0) : null;
  const anytimeIncluded = entReady ? (ent.includedAnytime ?? 0) : null;
  const bankingLimit = entReady ? (ent.rolloverCap ?? 0) : null;
  const showVal = (v) => (v === null || v === undefined ? '—' : v);
  const [bank, setBank] = useState(null);
  const [breakdown, setBreakdown] = useState(null);
  const [showPacksModal, setShowPacksModal] = useState(false);
  const [packsModalStep, setPacksModalStep] = useState('selection'); // 'selection' | 'confirmation'
  const [selectedPack, setSelectedPack] = useState(null);
  const [lastAddedPack, setLastAddedPack] = useState(null);
  // Level 2: live wallet balances from GET /api/wallet (authoritative send wallet).
  const [wallet, setWallet] = useState(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [walletError, setWalletError] = useState(false);

  useEffect(() => {
    loadAnimationBank();
  }, []);

  // Mount-fetch the live wallet. Never fabricates: on failure we show a clearly
  // labeled "Plan Includes" cap fallback (entitlement caps), not a balance.
  useEffect(() => {
    let alive = true;
    api.get('/api/wallet')
      .then((res) => {
        if (!alive) return;
        if (res?.ok && res.wallet) { setWallet(res.wallet); setWalletError(false); }
        else { setWalletError(true); }
      })
      .catch(() => { if (alive) setWalletError(true); })
      .finally(() => { if (alive) setWalletLoading(false); });
    return () => { alive = false; };
  }, []);

  const loadAnimationBank = () => {
    // Check for monthly reset
    animationBankService.resetMonthlyAllowance();
    // Check for holiday boost
    animationBankService.checkHolidayBoost();

    const bankData = animationBankService.getAnimationBank();
    const breakdownData = animationBankService.getBreakdown();

    setBank(bankData);
    setBreakdown(breakdownData);
  };

  const handleAddToCart = (pack) => {
    const cartItem = {
      type: 'animation-pack',
      name: `Animation Pack - ${pack.name}`,
      price: pack.price,
      quantity: 1,
      animations: pack.size,
      packName: pack.name,
      icon: pack.icon,
      ...(pack.priceId && { priceId: pack.priceId }),
      ...(pack.purchaseType && { purchaseType: pack.purchaseType }),
    };

    // Use cartService
    cartService.addItem(cartItem);

    // Trigger cart badge update
    window.dispatchEvent(new Event('cartUpdated'));

    // Store the added pack and transition to confirmation state
    setLastAddedPack(pack);
    setPacksModalStep('confirmation');
  };

  const resetPacksModal = () => {
    setShowPacksModal(false);
    setPacksModalStep('selection');
    setSelectedPack(null);
    setLastAddedPack(null);
  };

  if (!bank || !breakdown) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
        <div style={{ textAlign: 'center' }}>
          <Sparkles size={48} style={{ color: '#667eea', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Loading Animation Bank...</p>
        </div>
      </div>
    );
  }

  // ---- Level 2 wallet display (live balances; labeled non-live fallback on error) ----
  const w = wallet;
  let heroLabel, heroValue, heroSubtitle;
  if (w) {
    heroLabel = 'Total Spendable Now';
    heroValue = w.unmetered ? 'Unlimited' : w.totalSpendableNow;
    heroSubtitle = w.unmetered ? 'Unmetered plan' : 'Greet-Mes currently available to send';
  } else if (walletError) {
    heroLabel = 'Plan Includes';
    heroValue = showVal(monthlyIncluded);
    heroSubtitle = 'Monthly Greet-Mes included with your plan · live balance unavailable';
  } else {
    heroLabel = 'Total Spendable Now';
    heroValue = '—';
    heroSubtitle = 'Loading your wallet…';
  }

  let walletCards;
  if (w) {
    walletCards = [
      {
        label: 'Monthly Greet-Mes', color: '#667eea', Icon: Calendar,
        value: w.unmetered ? 'Unlimited' : `${w.monthly.remaining} of ${w.monthly.cap}`,
        secondary: w.unmetered
          ? 'Unmetered plan'
          : `left this month${w.monthlyWindowStale ? ' · Current-month display' : ''}`,
      },
      {
        label: 'Anytime Greet-Mes', color: '#764ba2', Icon: Sparkles,
        value: `${w.anytime.available}`,
        secondary: `available · ${w.anytime.includedCap} included with plan`,
      },
      {
        label: 'Banked Greet-Mes', color: '#10b981', Icon: Gift,
        value: `${w.banked.available}`,
        secondary: w.banked.cap > 0 ? `banked · up to ${w.banked.cap}` : 'No banking on this plan',
      },
    ];
    if (w.purchased?.animationCredits > 0) {
      walletCards.push({
        label: 'Purchased Credits', color: '#f59e0b', Icon: Star,
        value: `${w.purchased.animationCredits}`,
        secondary: w.purchased.spendable === true ? 'Available to send after plan credits.' : 'Recorded, not yet spendable.',
      });
    }
    if (w.bonus?.bonusGreetings > 0) {
      walletCards.push({
        label: 'Bonus Credits', color: '#ec4899', Icon: Star,
        value: `${w.bonus.bonusGreetings}`, secondary: 'Not spendable in current wallet path',
      });
    }
  } else if (walletError) {
    // Clearly-labeled NON-LIVE plan-inclusion fallback (caps only; never "available").
    walletCards = [
      { label: 'Monthly · Plan Includes', color: '#667eea', Icon: Calendar, value: showVal(monthlyIncluded), secondary: 'included monthly · live balance unavailable' },
      { label: 'Anytime · Plan Includes', color: '#764ba2', Icon: Sparkles, value: showVal(anytimeIncluded), secondary: 'included with plan' },
      { label: 'Banking Limit', color: '#10b981', Icon: Gift, value: showVal(bankingLimit), secondary: bankingLimit > 0 ? `bank up to ${bankingLimit}` : 'No banking on this plan' },
    ];
  } else {
    walletCards = [
      { label: 'Monthly Greet-Mes', color: '#667eea', Icon: Calendar, value: '—', secondary: 'Loading your wallet…' },
      { label: 'Anytime Greet-Mes', color: '#764ba2', Icon: Sparkles, value: '—', secondary: '' },
      { label: 'Banked Greet-Mes', color: '#10b981', Icon: Gift, value: '—', secondary: '' },
    ];
  }

  const packs = [
    { name: 'Starter', size: 3, price: 9.99, icon: '✨', color: '#667eea', priceId: 'price_1T4eK2Cf7KAA6aLanoQY2ekX', purchaseType: 'animation_pack' },
    { name: 'Celebration', size: 10, price: 24.99, icon: '🎉', color: '#10b981', priceId: 'price_1T4eK3Cf7KAA6aLao0taIyNT', purchaseType: 'animation_pack' },
    { name: 'Holiday', size: 25, price: 49.99, icon: '🎄', color: '#f59e0b', priceId: 'price_1T4eK3Cf7KAA6aLae8D9ahf8', purchaseType: 'animation_pack' }
  ];

  return (
    <div style={{ maxWidth: '100%', overflowX: 'hidden', padding: '0 1rem' }}>
      {/* Main Content Frame - includes banner */}
      <div style={{
        background: 'var(--bg-primary)',
        borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border)',
        padding: '1.5rem',
        marginBottom: '1rem'
      }}>
      {/* Header Banner - inside frame */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '1.5rem 2rem',
        marginBottom: '1.5rem',
        display: 'flex',
        alignItems: 'center',
        gap: '1rem'
      }}>
        <Film size={32} style={{ color: 'white' }} />
        <div>
          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 700,
            color: 'white',
            margin: 0
          }}>
            Animation Bank
          </h1>
          <p style={{
            fontSize: '0.875rem',
            color: 'rgba(255, 255, 255, 0.9)',
            margin: 0
          }}>
            Your collection of Animated Moments
          </p>
        </div>
      </div>

      {/* Total Available - Hero Card */}
      <div style={{
        background: 'white',
        borderRadius: '1rem',
        padding: '2rem',
        marginBottom: '2rem',
        boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
        border: '2px solid #667eea',
        textAlign: 'center'
      }}>
        <p style={{
          fontSize: '0.875rem',
          fontWeight: 600,
          color: '#667eea',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',
          marginBottom: '0.5rem'
        }}>
          {heroLabel}
        </p>
        <div style={{
          fontSize: '5rem',
          fontWeight: 700,
          color: '#667eea',
          lineHeight: 1,
          marginBottom: '0.5rem'
        }}>
          {heroValue}
        </div>
        <p style={{
          fontSize: '1.25rem',
          color: 'var(--text-secondary)',
          fontWeight: 500
        }}>
          {heroSubtitle}
        </p>
        <button
          onClick={() => setShowPacksModal(true)}
          style={{
            marginTop: '1.5rem',
            padding: '0.75rem 2rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '0.75rem',
            fontSize: '1rem',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
            transition: 'all 0.2s'
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
          <Plus size={20} />
          Add More
        </button>
      </div>

      {/* Breakdown Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '1rem',
        marginBottom: '2rem'
      }}>
        {/* Live wallet balances (Level 2) — from GET /api/wallet. On failure,
            renders a clearly-labeled NON-LIVE "Plan Includes" cap fallback. */}
        {walletCards.map((card, index) => {
          const Icon = card.Icon;
          return (
            <div key={index} style={{
              background: 'white',
              borderRadius: '0.75rem',
              padding: '1.5rem',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              border: `2px solid ${card.color}20`
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>
                <Icon size={32} style={{ color: card.color }} />
              </div>
              <p style={{
                fontSize: '0.75rem',
                fontWeight: 600,
                color: card.color,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                marginBottom: '0.5rem'
              }}>
                {card.label}
              </p>
              <p style={{
                fontSize: '2rem',
                fontWeight: 700,
                color: 'var(--text-primary)'
              }}>
                {card.value}
              </p>
              {card.secondary ? (
                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  marginTop: '0.25rem'
                }}>
                  {card.secondary}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* How It Works */}
      <div style={{
        background: '#faf5ff',
        borderRadius: '1rem',
        padding: '2rem',
        marginBottom: '2rem',
        border: '1px solid #e9d5ff'
      }}>
        <h2 style={{
          fontSize: '1.5rem',
          fontWeight: 700,
          color: 'var(--text-primary)',
          marginBottom: '1.5rem'
        }}>
          How Animated Moments Work
        </h2>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem'
        }}>
          <div>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Calendar size={20} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Monthly Refresh
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              Your plan includes {showVal(monthlyIncluded)} monthly Greet-Me{monthlyIncluded === 1 ? '' : 's'}. They refresh automatically!
            </p>
          </div>
          <div>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Gift size={20} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Never Expire
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              Purchased packs, holiday bonuses, and earned credits never expire. They're yours to use whenever!
            </p>
          </div>
          <div>
            <div style={{
              width: '3rem',
              height: '3rem',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: '1rem'
            }}>
              <Star size={20} style={{ color: 'white' }} />
            </div>
            <h3 style={{
              fontSize: '1rem',
              fontWeight: 600,
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              Earn Bonuses
            </h3>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              lineHeight: 1.5
            }}>
              We add bonus animations for holidays, milestones, and special moments throughout the year!
            </p>
          </div>
        </div>
      </div>
      </div>{/* End Main Content Frame */}

      {/* Packs Modal */}
      {showPacksModal && (
        <>
          {/* Backdrop */}
          <div
            onClick={resetPacksModal}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0,0,0,0.5)',
              zIndex: 1000,
              backdropFilter: 'blur(4px)'
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
            maxWidth: '600px',
            width: '90%',
            maxHeight: '90vh',
            zIndex: 1001,
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden'
          }}>
            {/* X Close Button */}
            <button
              onClick={resetPacksModal}
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
                zIndex: 10
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

            {/* Content */}
            <div style={{ padding: '2rem', paddingTop: '3rem', overflowY: 'auto', flex: 1 }}>
              {/* STATE 1: Selection */}
              {packsModalStep === 'selection' && (
                <>
                  <h2 style={{
                    fontSize: '1.75rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem',
                    textAlign: 'center'
                  }}>
                    Animation Packs
                  </h2>
                  <p style={{
                    fontSize: '0.9375rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '2rem',
                    textAlign: 'center'
                  }}>
                    Add more Animated Moments to your bank. Credits never expire!
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {packs.map(pack => (
                      <div
                        key={pack.name}
                        onClick={() => setSelectedPack(selectedPack?.name === pack.name ? null : pack)}
                        style={{
                          border: selectedPack?.name === pack.name ? '2px solid #667eea' : `2px solid ${pack.color}`,
                          borderRadius: '0.75rem',
                          padding: '1.5rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: selectedPack?.name === pack.name ? 'rgba(102, 126, 234, 0.1)' : `${pack.color}08`,
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                          transform: selectedPack?.name === pack.name ? 'scale(1.02)' : 'scale(1)'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedPack?.name !== pack.name) {
                            e.currentTarget.style.transform = 'translateY(-2px)';
                            e.currentTarget.style.boxShadow = `0 4px 12px ${pack.color}30`;
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (selectedPack?.name !== pack.name) {
                            e.currentTarget.style.transform = 'translateY(0)';
                            e.currentTarget.style.boxShadow = 'none';
                          }
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{ fontSize: '2.5rem' }}>
                            {pack.icon}
                          </div>
                          <div>
                            <h3 style={{
                              fontSize: '1.25rem',
                              fontWeight: 700,
                              color: 'var(--text-primary)',
                              marginBottom: '0.25rem'
                            }}>
                              {pack.name} Pack
                            </h3>
                            <p style={{
                              fontSize: '0.875rem',
                              color: 'var(--text-secondary)'
                            }}>
                              {pack.size} Animated Moments
                            </p>
                          </div>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <div style={{
                            fontSize: '1.25rem',
                            fontWeight: 700,
                            color: pack.color
                          }}>
                            ${pack.price}
                          </div>
                          {/* Selection Indicator */}
                          <div style={{
                            width: '1.5rem',
                            height: '1.5rem',
                            borderRadius: '50%',
                            border: selectedPack?.name === pack.name ? '2px solid #667eea' : '2px solid var(--border)',
                            background: selectedPack?.name === pack.name ? '#667eea' : 'white',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all 0.2s'
                          }}>
                            {selectedPack?.name === pack.name && (
                              <Check size={14} style={{ color: 'white' }} />
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Action Buttons */}
                  <div style={{
                    display: 'flex',
                    gap: '0.75rem',
                    justifyContent: 'space-between',
                    marginTop: '1.5rem'
                  }}>
                    {/* Cancel - Secondary (outline) - LEFT */}
                    <button
                      onClick={resetPacksModal}
                      style={{
                        padding: '0.875rem 1.5rem',
                        background: 'white',
                        color: 'var(--text-primary)',
                        border: '2px solid var(--border)',
                        borderRadius: '0.75rem',
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                    >
                      Cancel
                    </button>

                    {/* Add to Cart - Primary (solid) - RIGHT */}
                    <button
                      onClick={() => {
                        if (selectedPack) {
                          handleAddToCart(selectedPack);
                        }
                      }}
                      disabled={!selectedPack}
                      style={{
                        padding: '0.875rem 2rem',
                        background: selectedPack
                          ? 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                          : 'var(--gray-200)',
                        color: selectedPack ? 'white' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '0.75rem',
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        cursor: selectedPack ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        boxShadow: selectedPack ? '0 4px 12px rgba(102, 126, 234, 0.3)' : 'none'
                      }}
                    >
                      <ShoppingCart size={18} />
                      Add to Cart
                    </button>
                  </div>
                </>
              )}

              {/* STATE 2: Confirmation */}
              {packsModalStep === 'confirmation' && lastAddedPack && (
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
                    {lastAddedPack.name} Pack ({lastAddedPack.size} Animated Moments)
                  </p>

                  {/* Item Summary */}
                  <div style={{
                    background: 'var(--gray-50)',
                    borderRadius: '0.75rem',
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
                      <span style={{ color: 'var(--text-secondary)' }}>Animation Pack - {lastAddedPack.name}</span>
                      <span style={{ fontWeight: 600, color: lastAddedPack.color }}>${lastAddedPack.price}</span>
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
                      onClick={resetPacksModal}
                      style={{
                        flex: 1,
                        padding: '0.875rem 1.5rem',
                        background: 'white',
                        color: '#667eea',
                        border: '2px solid #667eea',
                        borderRadius: '0.75rem',
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
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
                        resetPacksModal();
                        navigate('/dashboard/cart');
                      }}
                      style={{
                        flex: 1,
                        padding: '0.875rem 1.5rem',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0.75rem',
                        fontSize: '0.9375rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
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
  );
}
