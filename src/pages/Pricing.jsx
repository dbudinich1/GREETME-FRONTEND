// src/pages/Pricing.jsx
import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate, useLocation } from 'react-router-dom';
import { Check, CheckCircle, ShoppingCart, X, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import cartService from '../services/cartService';
import { personalPlans, businessPlans } from '../config/plans';

// Plan tiers ineligible for referral credit
const CREDIT_INELIGIBLE_TIERS = new Set(['close_circle']);

export default function Pricing() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [viewMode, setViewMode] = useState('personal'); // 'personal' or 'business'
  const [pricingMode, setPricingMode] = useState('founders'); // 'founders' or 'standard' (for personal)

  // Referral credit from URL or localStorage
  const [referralCode, setReferralCode] = useState(null);
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const code = params.get('referral') || localStorage.getItem('greetme_referral_code');
    if (code) setReferralCode(code);
  }, [location.search]);
  const [isNarrow, setIsNarrow] = useState(window.innerWidth < 768);

  // Handle resize for mobile detection
  useEffect(() => {
    const handleResize = () => setIsNarrow(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const [showEnterpriseForm, setShowEnterpriseForm] = useState(false);
  const [enterpriseFormData, setEnterpriseFormData] = useState({
    companyName: '',
    contactName: '',
    email: '',
    phone: '',
    employeeCount: '',
    message: ''
  });
  // Pricing Modal State (Cart-based two-state flow)
  const [showPricingModal, setShowPricingModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [pricingStep, setPricingStep] = useState('selection'); // 'selection' | 'confirmation'
  const [lastAddedPlan, setLastAddedPlan] = useState(null);

  const handlePlanSelect = (plan) => {
    if (plan.id.includes('enterprise')) {
      setShowEnterpriseForm(true);
    } else {
      // Skip Plan Summary modal — add to cart immediately, show confirmation
      setSelectedPlan(plan);
      handleAddPlanToCart(plan);
      setShowPricingModal(true);
    }
  };

  const handleEnterpriseSubmit = (e) => {
    e.preventDefault();
    alert('Thank you! Our sales team will contact you within 24 hours.');
    setShowEnterpriseForm(false);
    setEnterpriseFormData({
      companyName: '',
      contactName: '',
      email: '',
      phone: '',
      employeeCount: '',
      message: ''
    });
  };

  const handleAddPlanToCart = (plan) => {
    const cartItem = {
      type: 'subscription',
      name: `${plan.name} Plan`,
      price: plan.price,
      quantity: 1,
      planId: plan.id,
      period: plan.period,
      pricingMode: pricingMode,
      icon: '📋',
      // Stripe checkout fields (only present if plan defines them)
      ...(plan.priceId && { priceId: plan.priceId }),
      ...(plan.purchaseType && { purchaseType: plan.purchaseType }),
      ...(plan.planTier && { planTier: plan.planTier }),
      ...(plan.billingPeriod && { billingPeriod: plan.billingPeriod }),
    };

    // Use cartService
    cartService.addItem(cartItem);

    // Trigger cart badge update
    window.dispatchEvent(new Event('cartUpdated'));

    // Store the added plan and transition to confirmation state
    setLastAddedPlan(plan);
    setPricingStep('confirmation');
  };

  const resetPricingModal = () => {
    setShowPricingModal(false);
    setSelectedPlan(null);
    setPricingStep('selection');
    setLastAddedPlan(null);
  };

  const currentPlans = viewMode === 'personal'
    ? personalPlans[pricingMode]
    : businessPlans[pricingMode];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      {/* Background Frame for Page Body */}
      <div style={{
        maxWidth: '1280px',
        margin: '0 auto',
        padding: isNarrow ? '0.5rem' : '0.5rem'
      }}>
        <div style={{
          background: '#f8fafc',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid #e2e8f0',
          padding: isNarrow ? '1rem' : '2rem',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)'
        }}>
      {/* Header Banner with Toggle */}
      <div style={{
        maxWidth: '100%',
        margin: '0 auto',
        padding: '0'
      }}>
        <div style={{
          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
          padding: isNarrow ? '0.75rem 1rem' : '1rem 2rem',
          textAlign: 'center',
          borderRadius: isNarrow ? 'var(--radius-lg)' : 'var(--radius-xl)'
        }}>
        <h1 style={{
          fontSize: 'clamp(1.25rem, 3vw, 1.75rem)',
          fontWeight: 800,
          color: 'white',
          marginBottom: '0.25rem'
        }}>
          Choose Your Plan
        </h1>
        <p style={{
          fontSize: 'clamp(0.8125rem, 1.25vw, 0.9375rem)',
          color: 'rgba(255, 255, 255, 0.9)',
          maxWidth: '600px',
          margin: '0 auto 0.5rem auto'
        }}>
          Never forget the ones you love. Start with Founders Pricing or explore business options.
        </p>

        {/* View Mode Toggle */}
        <div style={{
          display: 'inline-flex',
          background: 'rgba(255, 255, 255, 0.2)',
          borderRadius: '9999px',
          padding: '0.25rem',
          border: '1px solid rgba(255, 255, 255, 0.3)'
        }}>
          <button
            onClick={() => setViewMode('personal')}
            style={{
              padding: isNarrow ? '0.5rem 1rem' : '0.5rem 1.5rem',
              borderRadius: '9999px',
              background: viewMode === 'personal' ? 'white' : 'transparent',
              color: viewMode === 'personal' ? '#667eea' : 'rgba(255, 255, 255, 0.9)',
              border: 'none',
              fontWeight: 600,
              fontSize: isNarrow ? '0.875rem' : '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit'
            }}
          >
            Personal
          </button>
          <button
            onClick={() => setViewMode('business')}
            style={{
              padding: isNarrow ? '0.5rem 1rem' : '0.5rem 1.5rem',
              borderRadius: '9999px',
              background: viewMode === 'business' ? 'white' : 'transparent',
              color: viewMode === 'business' ? '#667eea' : 'rgba(255, 255, 255, 0.9)',
              border: 'none',
              fontWeight: 600,
              fontSize: isNarrow ? '0.875rem' : '1rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit'
            }}
          >
            Business
          </button>
          </div>
        </div>
      </div>

      {/* Founders Banner - Show for both Personal and Business */}
      {(
        <div style={{
          marginTop: isNarrow ? '0.75rem' : '1rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            padding: isNarrow ? '0.75rem 1rem' : '1rem 2rem',
            textAlign: 'center',
            color: 'white',
            borderRadius: isNarrow ? 'var(--radius-lg)' : 'var(--radius-xl)'
          }}>
            <div style={{
              maxWidth: '800px',
              margin: '0 auto'
            }}>
            <h2 style={{
              fontSize: isNarrow ? '1rem' : '1.375rem',
              fontWeight: 700,
              marginBottom: '0.25rem'
            }}>
              🎉 {isNarrow ? 'Founders Offer' : 'Founders Offer: Lock in Founders Pricing for a limited time'}
            </h2>
            <p style={{
              fontSize: isNarrow ? '0.8125rem' : '0.9375rem',
              opacity: 0.95,
              marginBottom: '0.5rem'
            }}>
              {isNarrow ? 'Lock in lifetime discounted pricing!' : 'Founders get the same features at a lifetime discounted rate.'}
            </p>
            {/* Phase 8.3: Founders pricing explanation - neutral, factual */}
            {/* Phase 8.3B: Added lineHeight for mobile readability */}
            <p style={{
              fontSize: isNarrow ? '0.6875rem' : '0.75rem',
              opacity: 0.9,
              marginBottom: '0.5rem',
              fontStyle: 'italic',
              lineHeight: 1.4
            }}>
              Founders pricing is early-access pricing, locked for the lifetime of your subscription.
            </p>

            <div style={{
              display: 'flex',
              flexDirection: isNarrow ? 'column' : 'row',
              justifyContent: 'center',
              gap: isNarrow ? '0.5rem' : '0.75rem'
            }}>
              <button
                onClick={() => setPricingMode('founders')}
                style={{
                  padding: isNarrow ? '0.5rem 1.25rem' : '0.625rem 1.5rem',
                  background: pricingMode === 'founders' ? 'white' : 'rgba(255, 255, 255, 0.3)',
                  color: pricingMode === 'founders' ? '#f59e0b' : 'white',
                  border: pricingMode === 'founders' ? 'none' : '2px solid white',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: isNarrow ? '0.8125rem' : '0.875rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'all 0.2s'
                }}
              >
                {pricingMode === 'founders' ? '✓ Viewing Founders Pricing' : 'Get Founders Pricing'}
              </button>
              {pricingMode === 'founders' && (
                <button
                  onClick={() => setPricingMode('standard')}
                  style={{
                    padding: isNarrow ? '0.5rem 1.25rem' : '0.625rem 1.5rem',
                    background: 'rgba(255, 255, 255, 0.3)',
                    color: 'white',
                    border: '2px solid white',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: isNarrow ? '0.8125rem' : '0.875rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    transition: 'all 0.2s'
                  }}
                >
                  View Standard Pricing
                </button>
              )}
            </div>
          </div>
        </div>
        </div>
      )}

      {/* Plans Grid - with decorative frame */}
      <div style={{
        marginTop: isNarrow ? '1rem' : '1.5rem'
      }}>
        <div style={{
          background: 'white',
          borderRadius: isNarrow ? 'var(--radius-lg)' : 'var(--radius-xl)',
          border: '2px solid var(--border)',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.08)',
          padding: isNarrow ? '1.5rem 1rem' : '2.5rem 2rem'
        }}>
          {/* Phase 8.3B: alignItems: 'stretch' for equal card heights */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isNarrow ? '1fr' : 'repeat(3, 1fr)',
            gap: isNarrow ? '1.5rem' : '2rem',
            alignItems: 'stretch'
          }}>
          {currentPlans.map((plan) => {
            const isCreditIneligible = referralCode && CREDIT_INELIGIBLE_TIERS.has(plan.planTier);
            const isCreditEligible = referralCode && !CREDIT_INELIGIBLE_TIERS.has(plan.planTier) && plan.price !== 'Contact Sales';
            return (
              <div
                key={plan.id}
                style={{
                  background: 'white',
                  borderRadius: 'var(--radius-xl)',
                  padding: '2rem',
                  boxShadow: plan.highlight ? '0 20px 50px rgba(0, 0, 0, 0.15)' : 'var(--shadow-md)',
                  border: plan.highlight ? '2px solid var(--primary)' : '1px solid var(--border)',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  height: '100%'
                }}
              >
                {/* Phase 8.3: Enhanced featured tier badge with value sub-label */}
                {/* Phase 8.3B: Adjusted top offset for sub-label breathing room */}
                {plan.highlight && (
                  <div style={{
                    position: 'absolute',
                    top: '-1rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '0.25rem'
                  }}>
                    <div style={{
                      background: 'var(--primary)',
                      color: 'white',
                      padding: '0.25rem 1rem',
                      borderRadius: '9999px',
                      fontSize: '0.75rem',
                      fontWeight: 700
                    }}>
                      MOST POPULAR
                    </div>
                    <div style={{
                      fontSize: '0.6875rem',
                      color: 'var(--primary)',
                      fontWeight: 600,
                      whiteSpace: 'nowrap'
                    }}>
                      Best value for most users
                    </div>
                  </div>
                )}

                {/* G1G1™ Gold Foil Seal - Top Right (Personal plans only) */}
                {viewMode === 'personal' && (
                  <div style={{
                    position: 'absolute',
                    top: plan.highlight ? '1.5rem' : '1rem',
                    right: '1rem',
                    width: plan.highlight ? '50px' : '55px',
                    height: plan.highlight ? '50px' : '55px',
                    opacity: 0.9
                  }}>
                    {/* Star-point notched edge layer */}
                    {[...Array(16)].map((_, i) => {
                      const angle = (i * 22.5) - 90;
                      const radius = plan.highlight ? 25 : 27.5;
                      const x = (plan.highlight ? 25 : 27.5) + radius * Math.cos(angle * Math.PI / 180);
                      const y = (plan.highlight ? 25 : 27.5) + radius * Math.sin(angle * Math.PI / 180);
                      return (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            left: `${x}px`,
                            top: `${y}px`,
                            width: '4px',
                            height: '4px',
                            background: '#D4AF37',
                            transform: 'translate(-50%, -50%) rotate(45deg)',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                            pointerEvents: 'none'
                          }}
                        />
                      );
                    })}

                    {/* Main seal */}
                    <div style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      transform: 'translate(-50%, -50%)',
                      width: plan.highlight ? '46px' : '50px',
                      height: plan.highlight ? '46px' : '50px',
                      borderRadius: '9999px',
                      border: '1px solid #8B6914',
                      background:
                        'radial-gradient(circle at 35% 35%, rgba(255,245,220,1) 0%, rgba(255,240,200,0.8) 15%, transparent 40%),' +
                        'radial-gradient(circle at 65% 65%, rgba(0,0,0,0.15) 0%, transparent 30%),' +
                        'repeating-conic-gradient(from 0deg, #E8D7A3 0deg 9deg, #C9A961 9deg 18deg, #F5E6C8 18deg 27deg, #D4AF37 27deg 36deg)',
                      boxShadow:
                        '0 2px 6px rgba(0,0,0,0.12),' +
                        '0 4px 12px rgba(139,105,20,0.15),' +
                        'inset 0 1px 2px rgba(255,255,255,0.4),' +
                        'inset 0 -1px 2px rgba(0,0,0,0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                      padding: 0
                    }}>
                      {/* Faint G watermark */}
                      <div style={{
                        position: 'absolute',
                        fontSize: plan.highlight ? '1.5rem' : '1.75rem',
                        fontWeight: 900,
                        color: 'rgba(139,105,20,0.12)',
                        fontFamily: 'Georgia, serif',
                        top: '50%',
                        left: '50%',
                        transform: 'translate(-50%, -50%)',
                        pointerEvents: 'none',
                        userSelect: 'none',
                        zIndex: 0
                      }}>G</div>

                      {/* Star decorations */}
                      <span style={{
                        position: 'absolute',
                        top: '3px',
                        fontSize: '6px',
                        color: '#8B6914',
                        opacity: 0.8,
                        textShadow: '0 0 1px rgba(255,235,205,0.5)',
                        pointerEvents: 'none',
                        zIndex: 2
                      }}>★</span>
                      <span style={{
                        position: 'absolute',
                        bottom: '3px',
                        fontSize: '6px',
                        color: '#8B6914',
                        opacity: 0.8,
                        textShadow: '0 0 1px rgba(255,235,205,0.5)',
                        pointerEvents: 'none',
                        zIndex: 2
                      }}>★</span>

                      {/* Main content */}
                      <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                        <div style={{
                          fontSize: plan.highlight ? '0.625rem' : '0.6875rem',
                          fontWeight: 900,
                          color: '#3D2F0F',
                          letterSpacing: '0.3px',
                          textShadow: '0 0.5px 1px rgba(255,255,255,0.5)',
                          marginBottom: '0.5px'
                        }}>G1G1™</div>
                        <div style={{
                          fontSize: plan.highlight ? '0.3125rem' : '0.34rem',
                          fontWeight: 800,
                          color: '#4D3A12',
                          textShadow: '0 0.5px 1px rgba(255,255,255,0.3)',
                          lineHeight: 1.1
                        }}>
                          <div>Greet One</div>
                          <div>Give One™</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Name + Description wrapper - minHeight ensures uniform price alignment */}
                <div style={{ minHeight: '95px', marginBottom: '1rem' }}>
                  {/* Plan Name */}
                  <h3 style={{
                    fontSize: '1.5rem',
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: '0.5rem'
                  }}>
                    {plan.name}
                  </h3>

                  <p style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    marginBottom: '0'
                  }}>
                    {plan.description}
                  </p>
                </div>

                {/* Price */}
                <div style={{
                  marginBottom: '1rem',
                  color: 'var(--text-primary)',
                  textAlign: 'center'
                }}>
                  {plan.price === 'Custom' ? (
                    <div>
                      <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>Custom</span>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Contact us for pricing
                      </div>
                    </div>
                  ) : plan.price === 'Contact Sales' ? (
                    <div>
                      <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>Contact Sales</span>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
                        Custom enterprise pricing
                      </div>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>${plan.price}</span>
                      <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/{plan.period}</span>
                    </div>
                  )}
                </div>

                {/* Credit eligibility badge */}
                {isCreditEligible && (
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    background: '#ecfdf5',
                    border: '1px solid #6ee7b7',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '0.75rem',
                    fontSize: '0.8125rem',
                    color: '#065f46',
                    fontWeight: 600,
                  }}>
                    $10 credit applies &mdash; pay ${(plan.price - 10).toFixed(2)}/{plan.period}
                  </div>
                )}
                {isCreditIneligible && (
                  <div style={{
                    padding: '0.5rem 0.75rem',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '0.75rem',
                    fontSize: '0.8125rem',
                    color: '#991b1b',
                    fontWeight: 500,
                  }}>
                    Credit not valid for this plan
                  </div>
                )}

                {/* CTA Button */}
                <button
                  onClick={() => !isCreditIneligible && handlePlanSelect(plan)}
                  disabled={isCreditIneligible}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: isCreditIneligible ? 'var(--gray-200, #e5e7eb)' : plan.highlight ? 'var(--primary)' : 'var(--gray-100)',
                    color: isCreditIneligible ? 'var(--text-secondary, #6b7280)' : plan.highlight ? 'white' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: isCreditIneligible ? 'not-allowed' : 'pointer',
                    fontFamily: 'inherit',
                    marginBottom: '2rem',
                    transition: 'all 0.2s ease',
                    opacity: isCreditIneligible ? 0.6 : 1,
                  }}
                  onMouseEnter={(e) => {
                    if (!isCreditIneligible) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.15)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {plan.price === 'Contact Sales' ? 'Contact Sales' : isCreditIneligible ? 'Not Eligible' : 'Get Started'}
                </button>

                {/* Features - Phase 8.3: Grouped into sections for scannability */}
                <div style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '1.5rem'
                }}>
                  <p style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '1rem'
                  }}>
                    What's included:
                  </p>
                  <div>
                    {plan.featureGroups.map((group, groupIndex) => (
                      <div key={groupIndex} style={{ marginBottom: groupIndex < plan.featureGroups.length - 1 ? '1rem' : 0 }}>
                        {/* Section header */}
                        <p style={{
                          fontSize: '0.75rem',
                          fontWeight: 600,
                          color: 'var(--text-tertiary)',
                          textTransform: 'uppercase',
                          letterSpacing: '0.025em',
                          marginBottom: '0.5rem'
                        }}>
                          {group.section}
                        </p>
                        {/* Features in this section */}
                        <ul style={{
                          listStyle: 'none',
                          padding: 0,
                          margin: 0
                        }}>
                          {group.features.map((feature, featureIndex) => (
                            <li
                              key={featureIndex}
                              style={{
                                display: 'flex',
                                alignItems: 'flex-start',
                                gap: '0.75rem',
                                marginBottom: '0.5rem',
                                fontSize: '0.875rem',
                                color: 'var(--text-secondary)'
                              }}
                            >
                              <Check size={16} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '0.125rem' }} />
                              <span>{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
          </div>
        </div>
      </div>
        </div>
      </div>
      {/* End Background Frame */}

      {/* Enterprise Contact Form Modal */}
      {showEnterpriseForm && (
        <div style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '2rem'
        }}>
          <div style={{
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            maxWidth: '500px',
            width: '100%',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)'
          }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0
              }}>Contact Sales</h2>
              <button
                onClick={() => setShowEnterpriseForm(false)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontSize: '1.5rem',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)'
                }}
              >×</button>
            </div>
            <p style={{
              fontSize: '0.875rem',
              color: 'var(--text-secondary)',
              marginBottom: '1.5rem'
            }}>
              Tell us about your business and we'll create a custom enterprise solution for you.
            </p>
            <form onSubmit={handleEnterpriseSubmit}>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Company Name *
                </label>
                <input
                  type="text"
                  required
                  value={enterpriseFormData.companyName}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, companyName: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Contact Name *
                </label>
                <input
                  type="text"
                  required
                  value={enterpriseFormData.contactName}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, contactName: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Email *
                </label>
                <input
                  type="email"
                  required
                  value={enterpriseFormData.email}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, email: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Phone
                </label>
                <input
                  type="tel"
                  value={enterpriseFormData.phone}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, phone: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit'
                  }}
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Number of Employees *
                </label>
                <select
                  required
                  value={enterpriseFormData.employeeCount}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, employeeCount: e.target.value})}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    background: 'white'
                  }}
                >
                  <option value="">Select...</option>
                  <option value="51-100">51-100</option>
                  <option value="101-250">101-250</option>
                  <option value="251-500">251-500</option>
                  <option value="501-1000">501-1000</option>
                  <option value="1000+">1000+</option>
                </select>
              </div>
              <div style={{ marginBottom: '1.5rem' }}>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Tell us about your needs
                </label>
                <textarea
                  value={enterpriseFormData.message}
                  onChange={(e) => setEnterpriseFormData({...enterpriseFormData, message: e.target.value})}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '0.75rem',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '0.875rem',
                    fontFamily: 'inherit',
                    resize: 'vertical'
                  }}
                  placeholder="What features are most important? Any specific integrations needed?"
                />
              </div>
              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '0.875rem',
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '1rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit'
                }}
              >
                Submit Request
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Pricing Modal (Cart-based two-state flow) */}
      {showPricingModal && selectedPlan && createPortal(
        <>
          {/* Backdrop — rendered to document.body via portal to escape stacking context */}
          <div
            onClick={resetPricingModal}
            style={{
              position: 'fixed',
              inset: 0,
              background: 'rgba(0, 0, 0, 0.5)',
              zIndex: 99998,
            }}
          />

          {/* Modal */}
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            background: 'white',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            maxWidth: '450px',
            width: '90%',
            maxHeight: '90vh',
            overflowY: 'auto',
            boxShadow: '0 25px 50px rgba(0, 0, 0, 0.25)',
            zIndex: 99999,
          }}>
            {/* Header */}
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1.5rem'
            }}>
              <h2 style={{
                fontSize: '1.5rem',
                fontWeight: 700,
                color: 'var(--text-primary)',
                margin: 0
              }}>
                {pricingStep === 'selection' && 'Add to Cart'}
                {pricingStep === 'confirmation' && 'Added to Cart!'}
              </h2>
              <button
                onClick={resetPricingModal}
                style={{
                  background: 'var(--gray-100)',
                  border: 'none',
                  borderRadius: '50%',
                  width: '2rem',
                  height: '2rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* STATE 1: Selection */}
            {pricingStep === 'selection' && (
              <>
                <div style={{
                  background: 'var(--gray-50)',
                  borderRadius: 'var(--radius-lg)',
                  padding: '1.5rem',
                  marginBottom: '1.5rem'
                }}>
                  <h3 style={{
                    fontSize: '1rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '1rem'
                  }}>Plan Summary</h3>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.375rem'
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{selectedPlan.name}</span>
                    <span style={{ fontWeight: 600 }}>${selectedPlan.price}/{selectedPlan.period}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '0.375rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <span>One-Time Technology Fee</span>
                    <span>$4.99</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingTop: '0.75rem',
                    borderTop: '1px solid var(--border)',
                    marginTop: '0.5rem'
                  }}>
                    <span style={{ fontWeight: 700, color: 'var(--text-primary)' }}>Total</span>
                    <span style={{ fontWeight: 700, fontSize: '1.25rem', color: 'var(--primary)' }}>${(selectedPlan.price + 4.99).toFixed(2)}</span>
                  </div>
                  {pricingMode === 'founders' && (
                    <div style={{
                      marginTop: '0.75rem',
                      padding: '0.5rem',
                      background: 'rgba(251, 191, 36, 0.1)',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.75rem',
                      color: '#b45309',
                      textAlign: 'center',
                      fontWeight: 500
                    }}>
                      🎉 Founders pricing locked for life!
                    </div>
                  )}
                </div>

                {user && (
                  <div style={{
                    padding: '0.75rem',
                    background: '#dcfce7',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1rem',
                    fontSize: '0.875rem',
                    color: '#166534',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}>
                    <CheckCircle size={16} />
                    Signed in as {user.email}
                  </div>
                )}

                {/* Selection State Buttons */}
                <div style={{
                  display: 'flex',
                  gap: '0.75rem',
                  justifyContent: 'space-between'
                }}>
                  {/* Cancel - Secondary (outline) - LEFT */}
                  <button
                    onClick={resetPricingModal}
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
                    onClick={() => handleAddPlanToCart(selectedPlan)}
                    style={{
                      padding: '0.875rem 2rem',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-lg)',
                      fontSize: '0.9375rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontFamily: 'inherit',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)'
                    }}
                  >
                    <ShoppingCart size={18} />
                    Add to Cart
                  </button>
                </div>

                <p style={{
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  marginTop: '1rem'
                }}>
                  Secure checkout powered by Stripe. Cancel anytime.
                </p>
              </>
            )}

            {/* STATE 2: Confirmation */}
            {pricingStep === 'confirmation' && lastAddedPlan && (
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
                  {lastAddedPlan.name} Plan
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
                    marginBottom: '0.375rem'
                  }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{lastAddedPlan.name}</span>
                    <span style={{ fontWeight: 600, color: 'var(--primary)' }}>${lastAddedPlan.price}/{lastAddedPlan.period}</span>
                  </div>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginBottom: '0.375rem',
                    fontSize: '0.8125rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <span>One-Time Technology Fee</span>
                    <span>$4.99</span>
                  </div>
                  {(() => {
                    const cc = (() => { try { const s = localStorage.getItem('greetme_courtesy_credit'); return s ? JSON.parse(s) : null; } catch { return null; } })();
                    const creditAmt = referralCode ? 10 : (cc?.amount || 0);
                    const isEligible = !CREDIT_INELIGIBLE_TIERS.has(lastAddedPlan.planTier);
                    const effectiveCredit = isEligible ? creditAmt : 0;
                    return (
                      <>
                        {effectiveCredit > 0 && (
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            marginBottom: '0.375rem',
                            fontSize: '0.8125rem',
                            color: '#22c55e',
                            fontWeight: 600,
                          }}>
                            <span>Greet-Me Credit</span>
                            <span>&ndash;${effectiveCredit.toFixed(2)}</span>
                          </div>
                        )}
                        <div style={{
                          borderTop: '1px solid var(--border)',
                          paddingTop: '0.5rem',
                          display: 'flex',
                          justifyContent: 'space-between',
                          fontWeight: 600,
                        }}>
                          <span>Total</span>
                          <span style={{ color: 'var(--primary)' }}>${Math.max(0, lastAddedPlan.price + 4.99 - effectiveCredit).toFixed(2)}</span>
                        </div>
                      </>
                    );
                  })()}
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
                    onClick={resetPricingModal}
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
                      resetPricingModal();
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
        </>,
        document.body
      )}
    </div>
  );
}
