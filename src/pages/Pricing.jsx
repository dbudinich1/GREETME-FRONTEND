// src/pages/Pricing.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check } from 'lucide-react';

const personalPlans = {
  founders: [
    {
      id: 'founders-close-circle',
      name: 'Close Circle',
      price: 9.99,
      period: 'year',
      description: 'Perfect for immediate family',
      features: [
        'Up to 5 recipients',
        'Greet One, Give One™ included',
        'American Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Email delivery'
      ]
    },
    {
      id: 'founders-social-butterfly',
      name: 'Social Butterfly',
      price: 19.99,
      period: 'year',
      description: 'For friends and extended family',
      features: [
        'Up to 25 recipients',
        'Greet One, Give One™ included',
        'American Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Priority email delivery',
        'Premium templates'
      ]
    },
    {
      id: 'founders-unlimited',
      name: 'Unlimited Unforgettable',
      price: 39.99,
      period: 'year',
      description: 'For the ultimate connector',
      features: [
        'Unlimited recipients',
        'Greet One, Give One™ included',
        'American Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Priority support',
        'Advanced AI personalization',
        'Video greetings',
        'Gift add-ons available'
      ],
      highlight: true
    }
  ],
  standard: [
    {
      id: 'standard-close-circle',
      name: 'Close Circle',
      price: 19.99,
      period: 'year',
      description: 'Perfect for immediate family',
      features: [
        'Up to 5 recipients',
        'Greet One, Give One™ included',
        'American Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Email delivery'
      ]
    },
    {
      id: 'standard-social-butterfly',
      name: 'Social Butterfly',
      price: 39.99,
      period: 'year',
      description: 'For friends and extended family',
      features: [
        'Up to 25 recipients',
        'Greet One, Give One™ included',
        'American Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Priority email delivery',
        'Premium templates'
      ]
    },
    {
      id: 'standard-unlimited',
      name: 'Unlimited Unforgettable',
      price: 79.99,
      period: 'year',
      description: 'For the ultimate connector',
      features: [
        'Unlimited recipients',
        'Greet One, Give One™ included',
        'American Marketplace',
        'Voice + Photo greetings',
        'Automated scheduled occasions',
        'Just Because greetings',
        'Priority support',
        'Advanced AI personalization',
        'Video greetings',
        'Gift add-ons available'
      ],
      highlight: true
    }
  ]
};

const businessPlans = [
  {
    id: 'client-appreciation',
    name: 'Client Appreciation',
    price: 199,
    period: 'year',
    description: 'Up to 25 gifted subscriptions',
    features: [
      'Client gifting bundles',
      'Branding + templates',
      'Hero impact reporting (coming soon)',
      'American Marketplace',
      'Bulk greeting sending',
      'Email support'
    ]
  },
  {
    id: 'growth-partner',
    name: 'Growth Partner',
    price: 499,
    period: 'year',
    description: 'Up to 100 gifted subscriptions',
    features: [
      'Everything in Client Appreciation',
      'Advanced branding options',
      'Hero impact reporting (coming soon)',
      'American Marketplace',
      'Analytics & reporting',
      'Priority support',
      'Team collaboration tools'
    ],
    highlight: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise / White Label',
    price: 'Custom',
    period: 'contact us',
    description: 'Custom enterprise solution',
    features: [
      'Everything in Growth Partner',
      'White-label platform option',
      'Custom integrations',
      'Hero impact reporting (coming soon)',
      'American Marketplace',
      'Dedicated account manager',
      'API access',
      'Custom SLA agreements'
    ]
  }
];

export default function Pricing() {
  const navigate = useNavigate();
  const [viewMode, setViewMode] = useState('personal'); // 'personal' or 'business'
  const [pricingMode, setPricingMode] = useState('founders'); // 'founders' or 'standard' (for personal)

  const handlePlanSelect = (planId) => {
    if (planId.includes('enterprise') || planId.includes('appreciation') || planId.includes('growth')) {
      alert('Contact sales form - Integration coming soon');
    } else {
      navigate('/register');
    }
  };

  const currentPlans = viewMode === 'personal'
    ? personalPlans[pricingMode]
    : businessPlans;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-secondary)' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '2.5rem 2rem',
        textAlign: 'center',
        position: 'relative'
      }}>
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          style={{
            position: 'absolute',
            top: '1.5rem',
            left: '2rem',
            padding: '0.625rem 1.25rem',
            background: 'rgba(255, 255, 255, 0.2)',
            color: 'white',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: 'var(--radius-lg)',
            fontSize: '0.875rem',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            transition: 'all 0.2s',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
          }}
        >
          ← Back
        </button>

        <h1 style={{
          fontSize: 'clamp(1.75rem, 4vw, 2.5rem)',
          fontWeight: 800,
          color: 'white',
          marginBottom: '0.5rem'
        }}>
          Choose Your Plan
        </h1>
        <p style={{
          fontSize: 'clamp(0.9375rem, 1.5vw, 1.125rem)',
          color: 'rgba(255, 255, 255, 0.9)',
          maxWidth: '600px',
          margin: '0 auto'
        }}>
          Never forget the ones you love. Start with Founders Pricing or explore business options.
        </p>
      </div>

      {/* View Mode Toggle - Separate section with breathing room */}
      <div style={{
        background: 'var(--bg-secondary)',
        padding: '2rem 2rem 1rem',
        display: 'flex',
        justifyContent: 'center'
      }}>
        <div style={{
          display: 'inline-flex',
          background: 'rgba(102, 126, 234, 0.1)',
          borderRadius: '9999px',
          padding: '0.25rem',
          border: '1px solid rgba(102, 126, 234, 0.2)'
        }}>
          <button
            onClick={() => setViewMode('personal')}
            style={{
              padding: '0.5rem 1.5rem',
              borderRadius: '9999px',
              background: viewMode === 'personal' ? 'white' : 'transparent',
              color: viewMode === 'personal' ? '#667eea' : 'var(--text-secondary)',
              border: 'none',
              fontWeight: 600,
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
              padding: '0.5rem 1.5rem',
              borderRadius: '9999px',
              background: viewMode === 'business' ? 'white' : 'transparent',
              color: viewMode === 'business' ? '#667eea' : 'var(--text-secondary)',
              border: 'none',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontFamily: 'inherit'
            }}
          >
            Business / Corporate
          </button>
        </div>
      </div>

      {/* Founders Banner - Only show for Personal view */}
      {viewMode === 'personal' && (
        <div style={{
          maxWidth: '1200px',
          margin: '0 auto 2rem',
          padding: '0 2rem'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
            borderRadius: 'var(--radius-xl)',
            padding: '2rem',
            textAlign: 'center',
            color: 'white',
            boxShadow: '0 10px 30px rgba(251, 191, 36, 0.3)'
          }}>
            <h2 style={{
              fontSize: '1.75rem',
              fontWeight: 700,
              marginBottom: '0.5rem'
            }}>
              🎉 Founders Offer: Lock in Founders Pricing for a limited time
            </h2>
            <p style={{
              fontSize: '1.125rem',
              opacity: 0.95,
              marginBottom: '1.5rem'
            }}>
              Founders get the same features at a lifetime discounted rate.
            </p>
            <button
              onClick={() => setPricingMode('founders')}
              style={{
                padding: '0.875rem 2rem',
                background: pricingMode === 'founders' ? 'white' : 'rgba(255, 255, 255, 0.3)',
                color: pricingMode === 'founders' ? '#f59e0b' : 'white',
                border: pricingMode === 'founders' ? 'none' : '2px solid white',
                borderRadius: 'var(--radius-lg)',
                fontSize: '1rem',
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
                  marginLeft: '1rem',
                  padding: '0.875rem 2rem',
                  background: 'rgba(255, 255, 255, 0.3)',
                  color: 'white',
                  border: '2px solid white',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '1rem',
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
      )}

      {/* Plans Grid */}
      <div style={{
        maxWidth: '1200px',
        margin: '0 auto 4rem',
        padding: '0 2rem'
      }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '2rem',
          alignItems: 'start'
        }}>
          {currentPlans.map((plan) => {
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
                {plan.highlight && (
                  <div style={{
                    position: 'absolute',
                    top: '-0.75rem',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    background: 'var(--primary)',
                    color: 'white',
                    padding: '0.25rem 1rem',
                    borderRadius: '9999px',
                    fontSize: '0.75rem',
                    fontWeight: 700
                  }}>
                    MOST POPULAR
                  </div>
                )}

                {/* G1G1™ Gold Foil Seal - Top Right */}
                <div style={{
                  position: 'absolute',
                  top: plan.highlight ? '1.5rem' : '1rem',
                  right: '1rem',
                  width: plan.highlight ? '40px' : '45px',
                  height: plan.highlight ? '40px' : '45px',
                  opacity: 0.9
                }}>
                  {/* Star-point notched edge layer */}
                  {[...Array(16)].map((_, i) => {
                    const angle = (i * 22.5) - 90;
                    const radius = plan.highlight ? 20 : 22.5;
                    const x = (plan.highlight ? 20 : 22.5) + radius * Math.cos(angle * Math.PI / 180);
                    const y = (plan.highlight ? 20 : 22.5) + radius * Math.sin(angle * Math.PI / 180);
                    return (
                      <div
                        key={i}
                        style={{
                          position: 'absolute',
                          left: `${x}px`,
                          top: `${y}px`,
                          width: '3px',
                          height: '3px',
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
                    width: plan.highlight ? '36px' : '40px',
                    height: plan.highlight ? '36px' : '40px',
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
                      fontSize: plan.highlight ? '1.25rem' : '1.5rem',
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
                      top: '2px',
                      fontSize: '5px',
                      color: '#8B6914',
                      opacity: 0.8,
                      textShadow: '0 0 1px rgba(255,235,205,0.5)',
                      pointerEvents: 'none',
                      zIndex: 2
                    }}>★</span>
                    <span style={{
                      position: 'absolute',
                      bottom: '2px',
                      fontSize: '5px',
                      color: '#8B6914',
                      opacity: 0.8,
                      textShadow: '0 0 1px rgba(255,235,205,0.5)',
                      pointerEvents: 'none',
                      zIndex: 2
                    }}>★</span>

                    {/* Main content */}
                    <div style={{ position: 'relative', zIndex: 1, textAlign: 'center' }}>
                      <div style={{
                        fontSize: plan.highlight ? '0.5rem' : '0.5625rem',
                        fontWeight: 900,
                        color: '#3D2F0F',
                        letterSpacing: '0.3px',
                        textShadow: '0 0.5px 1px rgba(255,255,255,0.5)',
                        marginBottom: '0.5px'
                      }}>G1G1™</div>
                      <div style={{
                        fontSize: plan.highlight ? '0.25rem' : '0.28rem',
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

                {/* Plan Name */}
                <h3 style={{
                  fontSize: '1.5rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: '0.5rem'
                }}>
                  {plan.name}
                </h3>

                {/* Description */}
                <p style={{
                  fontSize: '0.875rem',
                  color: 'var(--text-secondary)',
                  marginBottom: '1.5rem'
                }}>
                  {plan.description}
                </p>

                {/* Price */}
                <div style={{
                  marginBottom: '2rem',
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
                  ) : (
                    <div>
                      <span style={{ fontSize: '2.5rem', fontWeight: 'bold' }}>${plan.price}</span>
                      <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>/{plan.period}</span>
                    </div>
                  )}
                </div>

                {/* CTA Button */}
                <button
                  onClick={() => handlePlanSelect(plan.id)}
                  style={{
                    width: '100%',
                    padding: '0.875rem',
                    background: plan.highlight ? 'var(--primary)' : 'var(--gray-100)',
                    color: plan.highlight ? 'white' : 'var(--text-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '1rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    marginBottom: '2rem',
                    transition: 'all 0.2s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = '0 10px 20px rgba(0, 0, 0, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                >
                  {plan.price === 'Custom' ? 'Contact Sales' : 'Get Started'}
                </button>

                {/* Features */}
                <div style={{
                  borderTop: '1px solid var(--border)',
                  paddingTop: '1.5rem',
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column'
                }}>
                  <p style={{
                    fontSize: '0.875rem',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    marginBottom: '1rem'
                  }}>
                    What's included:
                  </p>
                  <ul style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    flex: 1
                  }}>
                    {plan.features.map((feature, index) => (
                      <li
                        key={index}
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: '0.75rem',
                          marginBottom: '0.75rem',
                          fontSize: '0.875rem',
                          color: 'var(--text-secondary)'
                        }}
                      >
                        <Check size={18} style={{ color: 'var(--success)', flexShrink: 0, marginTop: '0.125rem' }} />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
